/**
 * Construction Finance Module — Inspection AI Analyzer (AI Pillar 2)
 *
 * Analyzes submitted DrawInspectionReport documents using five signal sources:
 *   1. EXIF date/location validation — photo timestamps vs. scheduled inspection date
 *   2. Photo authenticity score      — proxy via cross-inspection photo count variance
 *   3. NLP concerns classification   — keyword-based severity categorization
 *   4. AI-recommended draw amount    — estimated from certified % complete × remaining budget
 *   5. % complete trend consistency  — progression checked against prior accepted reports
 *
 * Attaches an InspectionAiAnalysis to the DrawInspectionReport document.
 * When overallVerdict = 'FLAG', sets INSPECTION_PHOTO_ANOMALY risk flag on the loan.
 *
 * ALL business thresholds come from TenantConstructionConfig.
 * Keyword lists and scoring weights are model constants — documented here.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan, ConstructionBudget } from '../../types/construction-loan.types.js';
import type { ConstructionRiskFlag } from '../../types/construction-risk.types.js';
import type { DrawInspectionReport, InspectionAiAnalysis } from '../../types/draw-request.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';

// ─── Containers ───────────────────────────────────────────────────────────────

const DRAWS_CONTAINER  = 'draws';
const LOANS_CONTAINER  = 'construction-loans';

// ─── Model constants ──────────────────────────────────────────────────────────

const MODEL_VERSION = 'inspection-ai-v1.0.0';

/**
 * Inspection date tolerance in calendar days.
 * Photos with takenAt dates more than this many days outside
 * the scheduled inspection date are flagged in EXIF validation.
 */
const EXIF_DATE_TOLERANCE_DAYS = 3;

/**
 * Minimum percent-complete increment per inspection.
 * If progress between two consecutive ACCEPTED inspections is below this
 * and the time elapsed is more than 30 days, INCONSISTENT trend fires.
 */
const MIN_PROGRESS_PER_INSPECTION_PCT = 2;

/**
 * NLP concern keywords mapped to severity levels.
 * Real NLP would use embeddings; this rule-based approach is the platform's
 * heuristic substitute (same pattern as benchmark-driven feasibility scoring).
 *
 * Order matters per severity group — more specific terms first.
 */
const CRITICAL_CONCERN_KEYWORDS = [
  'structural', 'collapse', 'foundation crack', 'load-bearing', 'unsafe',
  'stop work', 'code violation', 'condemned', 'mold', 'asbestos',
  'water intrusion', 'flood',
];

const MODERATE_CONCERN_KEYWORDS = [
  'substandard', 'non-compliant', 'defect', 'cracking', 'leak',
  'improper', 'not to code', 'requires repair', 'corrective',
  'delay', 'work stoppage',
];

const MINOR_CONCERN_KEYWORDS = [
  'minor', 'cosmetic', 'touch-up', 'incomplete trim', 'punch list',
  'recommend', 'review', 'verify', 'follow up',
];

// ─── InspectionAiAnalyzerService ──────────────────────────────────────────────

export class InspectionAiAnalyzerService {
  private readonly logger = new Logger('InspectionAiAnalyzerService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── analyzeInspectionReport ──────────────────────────────────────────────────

  /**
   * Runs all AI checks on the specified inspection report and persists results.
   *
   * When aiMonitoringEnabled is disabled, returns null without writing analysis.
   *
   * @returns the populated InspectionAiAnalysis, or null when monitoring is disabled
   * @throws when the inspection report or loan cannot be found
   */
  async analyzeInspectionReport(
    inspectionId: string,
    tenantId: string
  ): Promise<InspectionAiAnalysis | null> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiMonitoringEnabled) {
      this.logger.info('InspectionAiAnalyzerService: AI monitoring disabled', {
        tenantId,
        inspectionId,
      });
      return null;
    }

    // ── Fetch the inspection (cross-partition query) ────────────────────────
    const reports = await this.cosmosService.queryDocuments<DrawInspectionReport>(
      DRAWS_CONTAINER,
      'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
      [
        { name: '@id',       value: inspectionId },
        { name: '@tenantId', value: tenantId },
      ]
    );
    const report = reports[0];
    if (!report) {
      throw new Error(
        `InspectionAiAnalyzerService: inspection "${inspectionId}" not found for tenant "${tenantId}"`
      );
    }

    // ── Fetch the loan ─────────────────────────────────────────────────────
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      report.constructionLoanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `InspectionAiAnalyzerService: loan "${report.constructionLoanId}" not found for tenant "${tenantId}"`
      );
    }

    // ── Fetch the current budget for recommended amount calc ──────────────
    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      LOANS_CONTAINER,
      loan.budgetId,
      tenantId
    );

    // ── Fetch prior accepted inspections for this loan ─────────────────────
    const priorInspections = await this.cosmosService.queryDocuments<DrawInspectionReport>(
      DRAWS_CONTAINER,
      `SELECT c.overallPercentComplete, c.scheduledDate, c.acceptedAt FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId = @tenantId
         AND c.id != @inspectionId
         AND c.status = 'ACCEPTED'
       ORDER BY c.scheduledDate DESC`,
      [
        { name: '@loanId',       value: report.constructionLoanId },
        { name: '@tenantId',     value: tenantId },
        { name: '@inspectionId', value: inspectionId },
      ]
    );

    // ── Run analysis signals ────────────────────────────────────────────────
    const { exifValidation, exifMessage }                         = analyzeExif(report);
    const photoAuthenticityScore                                  = computePhotoAuthenticityScore(report, priorInspections);
    const { concernsSeverity, concernsClassification }           = classifyConcerns(report.concerns);
    const aiRecommendedDrawAmount                                 = computeRecommendedDrawAmount(report, budget);
    const { percentCompleteTrend, percentCompleteTrendMessage }  = analyzeTrend(report, priorInspections);

    // ── Derive overall verdict ───────────────────────────────────────────────
    const overallVerdict = deriveVerdict({
      exifValidation,
      photoAuthenticityScore,
      concernsSeverity,
      percentCompleteTrend,
    });

    const analysis: InspectionAiAnalysis = {
      analyzedAt:                  new Date().toISOString(),
      modelVersion:                MODEL_VERSION,
      photoAuthenticityScore,
      exifValidation,
      exifMessage,
      concernsSeverity,
      concernsClassification,
      aiRecommendedDrawAmount,
      percentCompleteTrend,
      percentCompleteTrendMessage,
      overallVerdict,
    };

    // ── Persist analysis onto the inspection document ─────────────────────
    const updatedReport: DrawInspectionReport = {
      ...report,
      aiAnalysis: analysis,
      updatedAt:  new Date().toISOString(),
    };
    await this.cosmosService.upsertDocument<DrawInspectionReport>(DRAWS_CONTAINER, updatedReport);

    // ── Set / clear INSPECTION_PHOTO_ANOMALY risk flag ─────────────────────
    await this.updateLoanRiskFlag(loan, overallVerdict, analysis, tenantId);

    this.logger.info('InspectionAiAnalyzerService: analysis complete', {
      inspectionId,
      tenantId,
      overallVerdict,
      photoAuthenticityScore,
      concernsSeverity,
    });

    return analysis;
  }

  // ── updateLoanRiskFlag ───────────────────────────────────────────────────────

  /**
   * Sets or clears the INSPECTION_PHOTO_ANOMALY flag on the loan.
   */
  private async updateLoanRiskFlag(
    loan: ConstructionLoan,
    verdict: InspectionAiAnalysis['overallVerdict'],
    analysis: InspectionAiAnalysis,
    tenantId: string
  ): Promise<void> {
    const existingFlags = loan.activeRiskFlags ?? [];
    const shouldFlag    = verdict === 'FLAG';

    if (shouldFlag) {
      const otherFlags = existingFlags.filter(f => f.code !== 'INSPECTION_PHOTO_ANOMALY');
      const severity: ConstructionRiskFlag['severity'] =
        analysis.concernsSeverity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';

      const newFlag: ConstructionRiskFlag = {
        code:       'INSPECTION_PHOTO_ANOMALY',
        severity,
        message:    buildFlagMessage(analysis),
        detectedAt: new Date().toISOString(),
      };

      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: [...otherFlags, newFlag],
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    } else {
      const flagIndex = existingFlags.findIndex(
        f => f.code === 'INSPECTION_PHOTO_ANOMALY' && !f.resolvedAt
      );
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

// ─── Pure signal functions ────────────────────────────────────────────────────

/**
 * Validates photo EXIF timestamps against the inspection scheduled date.
 *
 * Real platform: photo EXIF would be extracted from uploaded blobs.
 * Here we analyze the inspector-recorded `takenAt` timestamps on each photo.
 */
function analyzeExif(
  report: DrawInspectionReport
): { exifValidation: InspectionAiAnalysis['exifValidation']; exifMessage: string } {
  if (report.photos.length === 0) {
    return {
      exifValidation: 'UNAVAILABLE',
      exifMessage:    'No photos attached to this inspection report.',
    };
  }

  const scheduledDate = new Date(report.scheduledDate);
  const toleranceMs   = EXIF_DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;

  const outliers = report.photos.filter(p => {
    const taken = new Date(p.takenAt);
    return Math.abs(taken.getTime() - scheduledDate.getTime()) > toleranceMs;
  });

  if (outliers.length === 0) {
    return {
      exifValidation: 'PASS',
      exifMessage:    `All ${report.photos.length} photo(s) have timestamps within ` +
                      `${EXIF_DATE_TOLERANCE_DAYS} days of the scheduled inspection date.`,
    };
  }

  const outlierPct = Math.round((outliers.length / report.photos.length) * 100);

  if (outlierPct > 50) {
    return {
      exifValidation: 'FAIL',
      exifMessage:    `${outliers.length} of ${report.photos.length} photos ` +
                      `(${outlierPct}%) have timestamps more than ` +
                      `${EXIF_DATE_TOLERANCE_DAYS} days from the inspection date (${report.scheduledDate}). ` +
                      `Photos may have been taken on a different day.`,
    };
  }

  return {
    exifValidation: 'WARN',
    exifMessage:    `${outliers.length} of ${report.photos.length} photos have ` +
                    `timestamps outside the expected window — minor EXIF variance.`,
  };
}

/**
 * Computes a proxy photo authenticity score 0–1.
 *
 * Factors:
 *   - Photo count relative to prior inspections (very few photos = reduce score)
 *   - EXIF outlier ratio
 *
 * Full photo authenticity (duplicate detection, GPS, etc.) requires
 * computer vision integration — this is the rule-based proxy.
 */
function computePhotoAuthenticityScore(
  report: DrawInspectionReport,
  priorInspections: DrawInspectionReport[]
): number {
  if (report.photos.length === 0) return 0.5; // No photos: neutral

  // If we have prior inspections, compare photo counts
  if (priorInspections.length > 0) {
    const avgPriorPhotos = priorInspections.reduce((s, i) => s + (i.photos?.length ?? 0), 0)
      / priorInspections.length;

    // If current photos are less than 30% of the typical count → suspicious
    if (avgPriorPhotos > 0 && report.photos.length < avgPriorPhotos * 0.3) {
      return 0.35;
    }
  }

  const scheduledDate = new Date(report.scheduledDate);
  const toleranceMs   = EXIF_DATE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000;
  const outlierCount  = report.photos.filter(p =>
    Math.abs(new Date(p.takenAt).getTime() - scheduledDate.getTime()) > toleranceMs
  ).length;

  const outlierRatio = outlierCount / report.photos.length;
  return Math.round((1 - outlierRatio * 0.7) * 100) / 100;
}

/**
 * Keyword-based NLP concerns severity classification.
 *
 * Scans all items in report.concerns for keyword hits, assigning the
 * highest severity found.
 */
function classifyConcerns(
  concerns: string[]
): { concernsSeverity: InspectionAiAnalysis['concernsSeverity']; concernsClassification: string } {
  if (concerns.length === 0) {
    return {
      concernsSeverity:       'NONE',
      concernsClassification: 'No concerns reported.',
    };
  }

  const text = concerns.join(' ').toLowerCase();

  for (const keyword of CRITICAL_CONCERN_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        concernsSeverity:       'CRITICAL',
        concernsClassification: `Critical structural or safety concern detected ("${keyword}" mentioned).`,
      };
    }
  }

  for (const keyword of MODERATE_CONCERN_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        concernsSeverity:       'MODERATE',
        concernsClassification: `Moderate workmanship or compliance concern detected ("${keyword}" mentioned).`,
      };
    }
  }

  for (const keyword of MINOR_CONCERN_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        concernsSeverity:       'MINOR',
        concernsClassification: `Minor cosmetic or punch-list concern detected ("${keyword}" mentioned).`,
      };
    }
  }

  return {
    concernsSeverity:       'MINOR',
    concernsClassification: `${concerns.length} concern(s) noted; no critical keywords detected.`,
  };
}

/**
 * Computes an AI-recommended draw amount based on certified % complete
 * and the remaining undrawn budget.
 *
 * Formula: remainingBudget × (percentCompleteThisDraw / 100)
 * Capped to remainingBudget.
 */
function computeRecommendedDrawAmount(
  report: DrawInspectionReport,
  budget: ConstructionBudget | null
): number {
  if (!budget) return 0;

  const remainingBudget = budget.totalRevisedBudget - budget.totalDrawnToDate;
  if (remainingBudget <= 0) return 0;

  const recommended = Math.round(
    remainingBudget * (report.percentCompleteThisDraw / 100)
  );
  return Math.min(recommended, remainingBudget);
}

/**
 * Analyses % complete progression across inspections.
 *
 * INSUFFICIENT_DATA — fewer than 2 accepted inspections (no trend to compare)
 * INCONSISTENT      — percent stagnant or regressed between two consecutive inspections
 *                     when more than 30 days have elapsed
 * CONSISTENT        — measurable forward progress in every comparison
 */
function analyzeTrend(
  report: DrawInspectionReport,
  priorInspections: DrawInspectionReport[]
): { percentCompleteTrend: InspectionAiAnalysis['percentCompleteTrend']; percentCompleteTrendMessage: string } {
  if (priorInspections.length === 0) {
    return {
      percentCompleteTrend:        'INSUFFICIENT_DATA',
      percentCompleteTrendMessage: 'First inspection for this loan — no prior data to compare.',
    };
  }

  // Sort prior by scheduledDate descending — most recent first
  const sorted = [...priorInspections].sort(
    (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
  );

  const latest = sorted[0]!;
  const progress = report.overallPercentComplete - latest.overallPercentComplete;
  const daysSince = (
    new Date(report.scheduledDate).getTime() - new Date(latest.scheduledDate).getTime()
  ) / (1000 * 60 * 60 * 24);

  if (progress < 0) {
    return {
      percentCompleteTrend:        'INCONSISTENT',
      percentCompleteTrendMessage: `% complete regressed from ${latest.overallPercentComplete}% ` +
                                   `to ${report.overallPercentComplete}%. Possible over-certification ` +
                                   `on a prior inspection.`,
    };
  }

  if (daysSince > 30 && progress < MIN_PROGRESS_PER_INSPECTION_PCT) {
    return {
      percentCompleteTrend:        'INCONSISTENT',
      percentCompleteTrendMessage: `Only ${progress.toFixed(1)}% progress over ${Math.round(daysSince)} days ` +
                                   `(minimum expected: ${MIN_PROGRESS_PER_INSPECTION_PCT}%). ` +
                                   `Project may be stalled.`,
    };
  }

  return {
    percentCompleteTrend:        'CONSISTENT',
    percentCompleteTrendMessage: `Progress of +${progress.toFixed(1)}% over ` +
                                 `${Math.round(daysSince)} days is within expected range.`,
  };
}

/**
 * Derives the overall verdict from individual signal results.
 *
 * FLAG             — EXIF FAIL or concernsSeverity CRITICAL or photoAuthenticityScore < 0.4
 * REVIEW_REQUIRED  — EXIF WARN or concernsSeverity MODERATE or INCONSISTENT trend
 * PASS             — all signals OK
 */
function deriveVerdict(signals: {
  exifValidation:      InspectionAiAnalysis['exifValidation'];
  photoAuthenticityScore: number;
  concernsSeverity:    InspectionAiAnalysis['concernsSeverity'];
  percentCompleteTrend: InspectionAiAnalysis['percentCompleteTrend'];
}): InspectionAiAnalysis['overallVerdict'] {
  if (
    signals.exifValidation === 'FAIL' ||
    signals.concernsSeverity === 'CRITICAL' ||
    signals.photoAuthenticityScore < 0.4
  ) {
    return 'FLAG';
  }
  if (
    signals.exifValidation === 'WARN' ||
    signals.concernsSeverity === 'MODERATE' ||
    signals.percentCompleteTrend === 'INCONSISTENT'
  ) {
    return 'REVIEW_REQUIRED';
  }
  return 'PASS';
}

/**
 * Builds a human-readable message for the INSPECTION_PHOTO_ANOMALY risk flag.
 */
function buildFlagMessage(analysis: InspectionAiAnalysis): string {
  const parts: string[] = [];
  if (analysis.exifValidation === 'FAIL') {
    parts.push(`EXIF: ${analysis.exifMessage}`);
  }
  if (analysis.concernsSeverity === 'CRITICAL') {
    parts.push(`Concerns: ${analysis.concernsClassification}`);
  }
  if (analysis.photoAuthenticityScore < 0.4) {
    parts.push(`Photo authenticity score: ${analysis.photoAuthenticityScore.toFixed(2)}`);
  }
  return parts.join(' | ') || 'Inspection AI flagged anomaly.';
}
