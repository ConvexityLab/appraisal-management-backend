/**
 * Construction Finance Module — Draw Anomaly Detector (AI Pillar 2)
 *
 * Runs four anomaly checks on every submitted DrawRequest:
 *   1. PHASE_SEQUENCE  — draw requests items before prior phases are reasonably complete
 *   2. AMOUNT_OUTLIER  — draw total deviates significantly from prior draw history
 *   3. TIMING_ANOMALY  — draw submitted suspiciously soon after the last disbursement
 *   4. GC_SYNC_PATTERN — same GC submitted coincident draws across multiple loans (fraud signal)
 *
 * Attaches a DrawAnomalyAnalysis to the DrawRequest document on every run.
 * When anomalyDetected = true, sets the DRAW_ANOMALY risk flag on the loan.
 *
 * ALL business thresholds come from TenantConstructionConfig.
 * Model constants (phase order map, outlier multipliers, timing floor)
 * are defined here — they represent the AI model's built-in knowledge,
 * analogous to BENCHMARK_PCT in the feasibility engine.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan, BudgetCategory } from '../../types/construction-loan.types.js';
import type { ConstructionRiskFlag } from '../../types/construction-risk.types.js';
import type { DrawRequest, DrawAnomalyAnalysis } from '../../types/draw-request.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';

// ─── Containers ───────────────────────────────────────────────────────────────

const DRAWS_CONTAINER = 'draws';
const LOANS_CONTAINER = 'construction-loans';

// ─── Model constants ──────────────────────────────────────────────────────────

const MODEL_VERSION = 'draw-anomaly-v1.0.0';

/**
 * Build-phase order for budget categories.
 * Lower number = earlier in construction sequence.
 * Categories not listed are treated as phase 5 (finish-work stage).
 *
 * Source: standard construction sequencing (site prep → structure → MEP → finish).
 */
const PHASE_ORDER: Partial<Record<BudgetCategory, number>> = {
  LAND_ACQUISITION: 0,
  PERMITS_FEES:     1,
  SOFT_COSTS:       1,
  SITE_WORK:        2,
  FOUNDATION:       3,
  FRAMING:          4,
  ROOFING:          4,
  EXTERIOR:         5,
  WINDOWS_DOORS:    5,
  PLUMBING:         6,
  ELECTRICAL:       6,
  HVAC:             6,
  INSULATION:       7,
  DRYWALL:          7,
  FLOORING:         8,
  KITCHEN:          8,
  BATHROOMS:        8,
  INTERIOR_FINISH:  8,
  LANDSCAPING:      9,
  GARAGE:           9,
  INTEREST_RESERVE: 10,
  CONTINGENCY:      10,
  OTHER:            10,
};

/**
 * Phase imbalance threshold.
 * When a draw requests items in a phase that is more than PHASE_GAP_THRESHOLD
 * increments ahead of the median phase of already-substantially-drawn items,
 * the PHASE_SEQUENCE anomaly fires.
 *
 * Example: if most drawn budget is in phases 3-4 (foundation/framing) but this
 * draw requests FLOORING (phase 8), the gap is 4 — triggers the flag.
 */
const PHASE_GAP_THRESHOLD = 3;

/**
 * Multipliers for AMOUNT_OUTLIER detection.
 * Flag fires when requestedAmount is outside the range:
 *   [historicalMedian × MIN_FACTOR, historicalMedian × MAX_FACTOR]
 *
 * Requires at least MIN_HISTORY_DRAWS prior disbursed draws to compute a baseline.
 */
const AMOUNT_MIN_FACTOR = 0.2;  // draw is less than 20% of typical draw → suspicious
const AMOUNT_MAX_FACTOR = 2.5;  // draw is more than 250% of typical draw → suspicious
const MIN_HISTORY_DRAWS = 2;    // minimum prior disbursed draws before outlier check activates

/**
 * Minimum calendar days between draw disbursements before a timing anomaly fires.
 * Platform operational standard: wire settlement + lien waiver collection
 * requires at least 7 business days in normal workflows.
 */
const MIN_DAYS_BETWEEN_DRAWS = 7;

/**
 * GC synchronised-draw detection window in calendar days.
 * If the same GC has another draw SUBMITTED on a *different* loan within
 * this window, GC_SYNC_PATTERN fires.
 */
const GC_SYNC_WINDOW_DAYS = 3;

// ─── DrawAnomalyDetectorService ───────────────────────────────────────────────

export class DrawAnomalyDetectorService {
  private readonly logger = new Logger('DrawAnomalyDetectorService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── analyzeDrawRequest ───────────────────────────────────────────────────────

  /**
   * Runs all four anomaly checks on the specified draw and persists the results.
   *
   * When aiDrawAnomalyDetection is disabled in TenantConstructionConfig this method
   * is a no-op (returns null without writing any analysis).
   *
   * @returns the populated DrawAnomalyAnalysis, or null when monitoring is disabled
   * @throws when the draw or loan cannot be found
   */
  async analyzeDrawRequest(
    drawId: string,
    tenantId: string
  ): Promise<DrawAnomalyAnalysis | null> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiMonitoringEnabled || !config.aiDrawAnomalyDetection) {
      this.logger.info('DrawAnomalyDetectorService: anomaly detection disabled', { tenantId, drawId });
      return null;
    }

    // ── Fetch the draw (cross-partition query) ─────────────────────────────
    const draws = await this.cosmosService.queryDocuments<DrawRequest>(
      DRAWS_CONTAINER,
      'SELECT * FROM c WHERE c.id = @drawId AND c.tenantId = @tenantId',
      [
        { name: '@drawId',    value: drawId },
        { name: '@tenantId',  value: tenantId },
      ]
    );
    const draw = draws[0];
    if (!draw) {
      throw new Error(
        `DrawAnomalyDetectorService: draw "${drawId}" not found for tenant "${tenantId}"`
      );
    }

    // ── Fetch the loan ─────────────────────────────────────────────────────
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      draw.constructionLoanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `DrawAnomalyDetectorService: loan "${draw.constructionLoanId}" not found for tenant "${tenantId}"`
      );
    }

    // ── Fetch prior draws on this loan ─────────────────────────────────────
    const priorDraws = await this.cosmosService.queryDocuments<DrawRequest>(
      DRAWS_CONTAINER,
      `SELECT * FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId = @tenantId
         AND c.id != @drawId`,
      [
        { name: '@loanId',   value: draw.constructionLoanId },
        { name: '@tenantId', value: tenantId },
        { name: '@drawId',   value: drawId },
      ]
    );

    // ── Run checks ─────────────────────────────────────────────────────────
    const findings: DrawAnomalyAnalysis['findings'] = [];

    const phaseSeqFinding       = this.checkPhaseSequence(draw, loan);
    const amountOutlierFinding  = this.checkAmountOutlier(draw, priorDraws);
    const timingAnomalyFinding  = this.checkTimingAnomaly(draw, priorDraws);

    if (phaseSeqFinding)      findings.push(phaseSeqFinding);
    if (amountOutlierFinding) findings.push(amountOutlierFinding);
    if (timingAnomalyFinding) findings.push(timingAnomalyFinding);

    // GC sync check requires querying across loans — only run if GC is present
    if (loan.generalContractorId) {
      const gcSyncFinding = await this.checkGcSyncPattern(
        draw,
        loan.generalContractorId,
        tenantId
      );
      if (gcSyncFinding) findings.push(gcSyncFinding);
    }

    // ── Compute aggregate score ────────────────────────────────────────────
    const anomalyDetected = findings.some(
      f => f.severity === 'WARNING' || f.severity === 'CRITICAL'
    );

    const anomalyScore = computeAnomalyScore(findings);
    const recommendedAction = deriveRecommendedAction(findings);

    const analysis: DrawAnomalyAnalysis = {
      analyzedAt:      new Date().toISOString(),
      modelVersion:    MODEL_VERSION,
      anomalyDetected,
      anomalyScore,
      findings,
      recommendedAction,
    };

    // ── Write analysis back to the DrawRequest document ────────────────────
    const updatedDraw: DrawRequest = {
      ...draw,
      anomalyAnalysis: analysis,
      updatedAt: new Date().toISOString(),
    };
    await this.cosmosService.upsertDocument<DrawRequest>(DRAWS_CONTAINER, updatedDraw);

    // ── Set / clear DRAW_ANOMALY risk flag on the loan ─────────────────────
    await this.updateLoanRiskFlag(loan, anomalyDetected, findings, tenantId);

    this.logger.info('DrawAnomalyDetectorService: analysis complete', {
      drawId,
      tenantId,
      anomalyDetected,
      anomalyScore,
      recommendedAction,
      findingCount: findings.length,
    });

    return analysis;
  }

  // ── checkPhaseSequence ───────────────────────────────────────────────────────

  /**
   * Detects draws that request budget items from a much later construction phase
   * than the project's current disbursement stage.
   *
   * Algorithm:
   *   - Determine the "current phase frontier" as the max phase of any category
   *     that has been more than 50% disbursed on this loan.
   *   - For each line item in this draw, check if its phase exceeds frontend + PHASE_GAP_THRESHOLD.
   *   - If any do, fire a WARNING.
   */
  private checkPhaseSequence(
    draw: DrawRequest,
    loan: ConstructionLoan
  ): DrawAnomalyAnalysis['findings'][number] | null {
    // We need the budget line items for this loan — we embed percentDisbursed.
    // Use lineItemRequests category directly; for phase frontier, rely on loan.percentComplete
    // as a proxy (we don't have full budget in this service without fetching it).
    // Fallback: estimate frontier from loan percentComplete mapped to approximate phase.
    const completionPhaseFrontier = Math.floor((loan.percentComplete / 100) * 10);

    const earlyPhaseItems = draw.lineItemRequests.filter(item => {
      const phase = PHASE_ORDER[item.category] ?? 5;
      return phase > completionPhaseFrontier + PHASE_GAP_THRESHOLD;
    });

    if (earlyPhaseItems.length === 0) return null;

    const categories = earlyPhaseItems.map(i => i.category).join(', ');

    return {
      type:       'PHASE_SEQUENCE',
      severity:   'WARNING',
      message:    `Draw requests ${earlyPhaseItems.length} item(s) (${categories}) in a ` +
                  `later build phase than the project's current completion stage ` +
                  `(${loan.percentComplete}% complete, estimated frontier phase ${completionPhaseFrontier}).`,
      confidence: 0.72,
    };
  }

  // ── checkAmountOutlier ───────────────────────────────────────────────────────

  /**
   * Flags draws that deviate significantly from the historical draw amounts for this loan.
   *
   * Requires at least MIN_HISTORY_DRAWS prior disbursed draws; skips check otherwise.
   */
  private checkAmountOutlier(
    draw: DrawRequest,
    priorDraws: DrawRequest[]
  ): DrawAnomalyAnalysis['findings'][number] | null {
    const disbursed = priorDraws.filter(d => d.status === 'DISBURSED');
    if (disbursed.length < MIN_HISTORY_DRAWS) return null;

    const amounts = disbursed.map(d => d.requestedAmount).sort((a, b) => a - b);
    const medianAmount = amounts[Math.floor(amounts.length / 2)]!;

    const low  = medianAmount * AMOUNT_MIN_FACTOR;
    const high = medianAmount * AMOUNT_MAX_FACTOR;

    if (draw.requestedAmount >= low && draw.requestedAmount <= high) return null;

    const direction = draw.requestedAmount < low ? 'far below' : 'far above';
    const ratio     = (draw.requestedAmount / medianAmount).toFixed(2);

    return {
      type:       'AMOUNT_OUTLIER',
      severity:   'WARNING',
      message:    `Requested amount ($${draw.requestedAmount.toLocaleString()}) is ${direction} ` +
                  `the loan's historical median draw amount ` +
                  `($${medianAmount.toLocaleString()}) — ratio: ${ratio}×.`,
      confidence: 0.80,
    };
  }

  // ── checkTimingAnomaly ───────────────────────────────────────────────────────

  /**
   * Flags draws submitted suspiciously soon after the previous disbursement.
   * Uses MIN_DAYS_BETWEEN_DRAWS as the minimum expected interval.
   */
  private checkTimingAnomaly(
    draw: DrawRequest,
    priorDraws: DrawRequest[]
  ): DrawAnomalyAnalysis['findings'][number] | null {
    const disbursedDraws = priorDraws
      .filter(d => d.status === 'DISBURSED' && d.disbursedAt)
      .sort((a, b) => new Date(b.disbursedAt!).getTime() - new Date(a.disbursedAt!).getTime());

    if (disbursedDraws.length === 0) return null;

    const lastDisbursedAt = new Date(disbursedDraws[0]!.disbursedAt!);
    const requestedAt     = new Date(draw.requestedAt);
    const daysDiff        = (requestedAt.getTime() - lastDisbursedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff >= MIN_DAYS_BETWEEN_DRAWS) return null;

    return {
      type:       'TIMING_ANOMALY',
      severity:   'WARNING',
      message:    `Draw submitted only ${daysDiff.toFixed(1)} days after the last disbursement ` +
                  `(minimum expected interval: ${MIN_DAYS_BETWEEN_DRAWS} days). ` +
                  `Lien waiver may still be outstanding.`,
      confidence: 0.75,
    };
  }

  // ── checkGcSyncPattern ───────────────────────────────────────────────────────

  /**
   * Detects coordinated draw submissions across different loans by the same GC.
   * Fires when another SUBMITTED draw from the same GC on a *different* loan
   * exists within GC_SYNC_WINDOW_DAYS of this draw's requestedAt.
   */
  private async checkGcSyncPattern(
    draw: DrawRequest,
    generalContractorId: string,
    tenantId: string
  ): Promise<DrawAnomalyAnalysis['findings'][number] | null> {
    // Find loans managed by this GC on this tenant (excluding the current loan)
    const gcLoans = await this.cosmosService.queryDocuments<ConstructionLoan>(
      LOANS_CONTAINER,
      `SELECT c.id FROM c
       WHERE c.tenantId = @tenantId
         AND c.generalContractorId = @gcId
         AND c.id != @loanId`,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@gcId',     value: generalContractorId },
        { name: '@loanId',   value: draw.constructionLoanId },
      ]
    );

    if (gcLoans.length === 0) return null;

    const gcLoanIds = gcLoans.map(l => l.id);
    const drawDate  = new Date(draw.requestedAt);

    // Check for draws on other GC loans submitted within the sync window
    for (const otherLoanId of gcLoanIds) {
      const otherDraws = await this.cosmosService.queryDocuments<DrawRequest>(
        DRAWS_CONTAINER,
        `SELECT c.id, c.requestedAt, c.constructionLoanId FROM c
         WHERE c.constructionLoanId = @loanId
           AND c.tenantId = @tenantId
           AND c.status IN ('SUBMITTED', 'INSPECTION_ORDERED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED')`,
        [
          { name: '@loanId',   value: otherLoanId },
          { name: '@tenantId', value: tenantId },
        ]
      );

      const syncDraw = otherDraws.find(od => {
        const diff = Math.abs(
          new Date(od.requestedAt).getTime() - drawDate.getTime()
        ) / (1000 * 60 * 60 * 24);
        return diff <= GC_SYNC_WINDOW_DAYS;
      });

      if (syncDraw) {
        return {
          type:       'GC_SYNC_PATTERN',
          severity:   'CRITICAL',
          message:    `Same GC (${generalContractorId}) submitted draws on loan ` +
                      `"${draw.constructionLoanId}" and loan "${otherLoanId}" ` +
                      `within ${GC_SYNC_WINDOW_DAYS} days. ` +
                      `Coordinated multi-loan draw pattern detected.`,
          confidence: 0.65,
        };
      }
    }

    return null;
  }

  // ── updateLoanRiskFlag ───────────────────────────────────────────────────────

  /**
   * Sets or clears the DRAW_ANOMALY risk flag on the loan document
   * based on the current analysis result.
   */
  private async updateLoanRiskFlag(
    loan: ConstructionLoan,
    anomalyDetected: boolean,
    findings: DrawAnomalyAnalysis['findings'],
    tenantId: string
  ): Promise<void> {
    const existingFlags = loan.activeRiskFlags ?? [];

    if (anomalyDetected) {
      // Replace any prior DRAW_ANOMALY flag
      const otherFlags = existingFlags.filter(f => f.code !== 'DRAW_ANOMALY');
      const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
      const severity: ConstructionRiskFlag['severity'] = criticalFindings.length > 0
        ? 'CRITICAL'
        : 'WARNING';

      const newFlag: ConstructionRiskFlag = {
        code:        'DRAW_ANOMALY',
        severity,
        message:     findings
          .filter(f => f.severity !== 'INFO')
          .map(f => f.message)
          .join(' | '),
        detectedAt:  new Date().toISOString(),
      };

      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: [...otherFlags, newFlag],
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    } else {
      // Clear the flag (set resolvedAt) if it was previously set
      const flagIndex = existingFlags.findIndex(f => f.code === 'DRAW_ANOMALY' && !f.resolvedAt);
      if (flagIndex === -1) return;

      const resolvedFlags = existingFlags.map((f, i) =>
        i === flagIndex ? { ...f, resolvedAt: new Date().toISOString() } : f
      );
      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: resolvedFlags,
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    }
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Aggregate anomaly score 0–100.
 * Computed as the highest single-finding severity score, with secondary findings
 * adding a small increment.
 *
 * CRITICAL  → 80 base
 * WARNING   → 50 base
 * INFO      →  5 base
 */
function computeAnomalyScore(findings: DrawAnomalyAnalysis['findings']): number {
  if (findings.length === 0) return 0;

  const baseScore = (f: DrawAnomalyAnalysis['findings'][number]): number => {
    if (f.severity === 'CRITICAL') return 80;
    if (f.severity === 'WARNING')  return 50;
    return 5;
  };

  const primary   = Math.max(...findings.map(baseScore));
  const secondary = findings
    .filter(f => baseScore(f) < primary)
    .reduce((sum, f) => sum + baseScore(f) * 0.1, 0);

  return Math.min(100, Math.round(primary + secondary));
}

/**
 * Derives recommendedAction from the worst-severity finding.
 */
function deriveRecommendedAction(
  findings: DrawAnomalyAnalysis['findings']
): DrawAnomalyAnalysis['recommendedAction'] {
  if (findings.some(f => f.severity === 'CRITICAL')) return 'HOLD';
  if (findings.some(f => f.severity === 'WARNING'))  return 'REVIEW';
  return 'APPROVE';
}
