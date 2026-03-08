/**
 * Construction Finance Module — AI Report Generator Service (Phase 4c, Pillar 3)
 *
 * Generates ConstructionStatusReport documents from live loan data.
 *
 *   generateStatusReport(loanId, reportType, tenantId)
 *     → Fetches loan state, budget snapshot, risk flags, and pending items;
 *       calls CompletionForecasterService for P50 / P75 estimates;
 *       builds a rule-based AI narrative; writes the report to Cosmos and returns it.
 *
 *   getReports(loanId, tenantId)
 *     → Lists all status reports on file for a loan (newest first).
 *
 *   scheduleStatusReports(tenantId)
 *     → Cron-callable method.  Generates a SCHEDULED report for each ACTIVE loan
 *       that has gone at least statusReportFrequencyDays since its last report.
 *       Reports for a given loan are idempotent within a calendar day.
 *
 * Reports are stored in the `construction-loans` Cosmos container alongside
 * the loan documents (partition key: /tenantId).  Each report's id follows
 * the pattern: `status-report-${loanId}-${Date.now()}`.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan, ConstructionBudget } from '../../types/construction-loan.types.js';
import type { ConstructionStatusReport } from '../../types/construction-status-report.types.js';
import type { ConstructionRiskFlag } from '../../types/construction-risk.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';
import { CompletionForecasterService } from './completion-forecaster.service.js';

// ─── Containers ────────────────────────────────────────────────────────────────

const LOANS_CONTAINER = 'construction-loans';
const DRAWS_CONTAINER = 'draws';

const logger = new Logger('ConstructionReportGeneratorService');

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConstructionReportGeneratorService {
  private readonly configService: ConstructionConfigService;
  private readonly forecasterService: CompletionForecasterService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService    = new ConstructionConfigService(cosmosService);
    this.forecasterService = new CompletionForecasterService(cosmosService);
  }

  // ── generateStatusReport ──────────────────────────────────────────────────────

  /**
   * Generates and persists a ConstructionStatusReport for the given loan.
   *
   * The generation process:
   *   1. Fetch loan and its approved budget
   *   2. Run completion forecast (P50 / P75)
   *   3. Count pending draws, inspections, lien waivers, and change orders
   *   4. Derive budget snapshot, active risk flags
   *   5. Build rule-based AI narrative, insights, and recommended actions
   *   6. Write the report document to Cosmos and return it
   *
   * @throws when loan or its budget is not found, or autoGenerateStatusReports = false
   */
  async generateStatusReport(
    loanId: string,
    reportType: ConstructionStatusReport['reportType'],
    tenantId: string
  ): Promise<ConstructionStatusReport> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiServicingEnabled) {
      throw new Error(
        `ConstructionReportGeneratorService: aiServicingEnabled is false for tenant "${tenantId}".`
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionReportGeneratorService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      LOANS_CONTAINER,
      loan.budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ConstructionReportGeneratorService: budget "${loan.budgetId}" not found for loan "${loanId}"`
      );
    }

    // ── Completion forecast ───────────────────────────────────────────────────
    const forecast = await this.forecasterService.forecastCompletion(loanId, tenantId);
    const today    = new Date().toISOString().slice(0, 10);

    const completionForecastP50 = forecast?.p50 ?? loan.expectedCompletionDate;
    const completionForecastP75 = forecast?.p75 ?? loan.expectedCompletionDate;

    // ── Days to maturity ──────────────────────────────────────────────────────
    const maturityMs     = new Date(loan.maturityDate).getTime() - Date.now();
    const daysToMaturity = Math.max(0, Math.floor(maturityMs / (24 * 60 * 60 * 1000)));

    // ── Pending item counts ───────────────────────────────────────────────────
    const [pendingDraws, pendingInspections, pendingLienWaivers, pendingChangeOrders] =
      await Promise.all([
        this.countPendingDraws(loanId),
        this.countPendingInspections(loanId),
        this.countPendingLienWaivers(loanId),
        this.countPendingChangeOrders(loanId, tenantId),
      ]);

    // ── Budget snapshot ───────────────────────────────────────────────────────
    const budgetSnapshot: ConstructionStatusReport['budgetSnapshot'] = {
      totalBudget:           budget.totalRevisedBudget,
      totalDrawnToDate:      budget.totalDrawnToDate,
      totalRemainingBudget:  budget.totalRevisedBudget - budget.totalDrawnToDate,
      contingencyRemaining:  budget.contingencyRemaining,
      retainageHeld:         loan.retainageHeld,
    };

    // ── Active risk flags ─────────────────────────────────────────────────────
    const activeRiskFlags = (loan.activeRiskFlags ?? []).filter(
      (f): f is ConstructionRiskFlag => !f.resolvedAt
    );

    // ── AI narrative ──────────────────────────────────────────────────────────
    const summary            = buildSummary(loan, budget, completionForecastP50, activeRiskFlags);
    const narrativeInsights  = buildNarrativeInsights(loan, budget, forecast, activeRiskFlags);
    const recommendedActions = buildRecommendedActions(
      loan,
      activeRiskFlags,
      pendingDraws,
      pendingInspections,
      pendingLienWaivers,
      pendingChangeOrders
    );

    // ── Assemble report ───────────────────────────────────────────────────────
    const reportId = `status-report-${loanId}-${Date.now()}`;

    const report: ConstructionStatusReport = {
      id:                    reportId,
      constructionLoanId:    loanId,
      tenantId,
      reportDate:            today,
      reportType,
      generatedBy:           'AI_AUTO',
      summary,
      percentComplete:       loan.percentComplete,
      completionForecastP50,
      completionForecastP75,
      daysToMaturity,
      budgetSnapshot,
      activeRiskFlags,
      pendingDraws,
      pendingInspections,
      pendingLienWaivers,
      pendingChangeOrders,
      narrativeInsights,
      recommendedActions,
      createdAt:             new Date().toISOString(),
    };

    await this.cosmosService.upsertDocument<ConstructionStatusReport>(LOANS_CONTAINER, report);

    return report;
  }

  // ── getReports ────────────────────────────────────────────────────────────────

  /**
   * Returns all status reports for a loan, sorted newest-first by createdAt.
   *
   * Uses the presence of the `reportDate` field to distinguish report documents
   * from other docs that share the `construction-loans` container partition.
   */
  async getReports(loanId: string, tenantId: string): Promise<ConstructionStatusReport[]> {
    const reports = await this.cosmosService.queryDocuments<ConstructionStatusReport>(
      LOANS_CONTAINER,
      `SELECT * FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId           = @tenantId
         AND IS_DEFINED(c.reportDate)
       ORDER BY c.createdAt DESC`,
      [
        { name: '@loanId',   value: loanId },
        { name: '@tenantId', value: tenantId },
      ]
    );

    return reports;
  }

  // ── scheduleStatusReports ─────────────────────────────────────────────────────

  /**
   * Cron-callable method intended to be triggered once daily.
   *
   * For each ACTIVE loan belonging to tenantId:
   *   - Looks up the most recent report for that loan
   *   - If no report exists, or the last report is older than statusReportFrequencyDays, generates one
   *   - Reports are NOT generated more than once per calendar day (idempotent by reportDate)
   *
   * @returns { processed, errors } counts
   */
  async scheduleStatusReports(tenantId: string): Promise<{ processed: number; errors: number }> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiServicingEnabled) {
      logger.warn('scheduleStatusReports: aiServicingEnabled is false — skipping', { tenantId });
      return { processed: 0, errors: 0 };
    }
    if (!config.autoGenerateStatusReports) {
      logger.warn('scheduleStatusReports: autoGenerateStatusReports is false — skipping', { tenantId });
      return { processed: 0, errors: 0 };
    }

    const activeLoans = await this.cosmosService.queryDocuments<ConstructionLoan>(
      LOANS_CONTAINER,
      `SELECT c.id, c.budgetId, c.status, c.tenantId FROM c
       WHERE c.tenantId = @tenantId
         AND c.status   = 'ACTIVE'
         AND IS_DEFINED(c.loanNumber)`,
      [{ name: '@tenantId', value: tenantId }]
    );

    const today      = new Date().toISOString().slice(0, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.statusReportFrequencyDays);
    const cutoffStr  = cutoffDate.toISOString().slice(0, 10);

    let processed = 0;
    let errors    = 0;

    for (const loan of activeLoans) {
      try {
        // Check whether a report already exists today or within the frequency window
        const recentReports = await this.cosmosService.queryDocuments<ConstructionStatusReport>(
          LOANS_CONTAINER,
          `SELECT TOP 1 c.reportDate FROM c
           WHERE c.constructionLoanId = @loanId
             AND c.tenantId           = @tenantId
             AND IS_DEFINED(c.reportDate)
           ORDER BY c.createdAt DESC`,
          [
            { name: '@loanId',   value: loan.id },
            { name: '@tenantId', value: tenantId },
          ]
        );

        const lastReportDate = recentReports[0]?.reportDate;

        // Skip if a report was generated today
        if (lastReportDate === today) continue;

        // Skip if last report is within the frequency window
        if (lastReportDate && lastReportDate >= cutoffStr) continue;

        await this.generateStatusReport(loan.id, 'SCHEDULED', tenantId);
        processed++;
      } catch (err) {
        logger.error('scheduleStatusReports: error generating report for loan', {
          error: err,
          loanId: loan.id,
          tenantId,
        });
        errors++;
      }
    }

    return { processed, errors };
  }

  // ── Pending-count helpers ─────────────────────────────────────────────────────

  private async countPendingDraws(loanId: string): Promise<number> {
    const rows = await this.cosmosService.queryDocuments<{ id: string }>(
      DRAWS_CONTAINER,
      `SELECT c.id FROM c
       WHERE c.constructionLoanId = @loanId
         AND IS_DEFINED(c.requestedAmount)
         AND (c.status = 'SUBMITTED' OR c.status = 'INSPECTION_ORDERED'
              OR c.status = 'UNDER_REVIEW' OR c.status = 'APPROVED')`,
      [{ name: '@loanId', value: loanId }]
    );
    return rows.length;
  }

  private async countPendingInspections(loanId: string): Promise<number> {
    const rows = await this.cosmosService.queryDocuments<{ id: string }>(
      DRAWS_CONTAINER,
      `SELECT c.id FROM c
       WHERE c.constructionLoanId = @loanId
         AND IS_DEFINED(c.drawRequestId)
         AND (c.status = 'SCHEDULED' OR c.status = 'IN_PROGRESS')`,
      [{ name: '@loanId', value: loanId }]
    );
    return rows.length;
  }

  private async countPendingLienWaivers(loanId: string): Promise<number> {
    const rows = await this.cosmosService.queryDocuments<{ id: string }>(
      DRAWS_CONTAINER,
      `SELECT c.id FROM c
       WHERE c.constructionLoanId = @loanId
         AND IS_DEFINED(c.requestedAmount)
         AND c.status             = 'DISBURSED'
         AND c.lienWaiverStatus   = 'PENDING'`,
      [{ name: '@loanId', value: loanId }]
    );
    return rows.length;
  }

  private async countPendingChangeOrders(loanId: string, tenantId: string): Promise<number> {
    const rows = await this.cosmosService.queryDocuments<{ id: string }>(
      LOANS_CONTAINER,
      `SELECT c.id FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId           = @tenantId
         AND IS_DEFINED(c.requestedAmount)
         AND IS_DEFINED(c.requestedAt)
         AND (c.status = 'SUBMITTED' OR c.status = 'UNDER_REVIEW')`,
      [
        { name: '@loanId',   value: loanId },
        { name: '@tenantId', value: tenantId },
      ]
    );
    return rows.length;
  }
}

// ─── Pure AI narrative builders ───────────────────────────────────────────────

function buildSummary(
  loan: ConstructionLoan,
  budget: ConstructionBudget,
  completionForecastP50: string,
  activeFlags: ConstructionRiskFlag[]
): string {
  const pct         = loan.percentComplete;
  const drawn       = budget.totalDrawnToDate;
  const total       = budget.totalRevisedBudget;
  const drawPct     = total > 0 ? Math.round((drawn / total) * 100) : 0;
  const flagCount   = activeFlags.length;
  const criticals   = activeFlags.filter(f => f.severity === 'CRITICAL').length;

  let progressCtx: string;
  if (pct < 25)       progressCtx = 'is in early-stage construction';
  else if (pct < 50)  progressCtx = 'has passed the one-quarter completion mark';
  else if (pct < 75)  progressCtx = 'is approaching the halfway point';
  else if (pct < 90)  progressCtx = 'is in advanced construction stages';
  else                progressCtx = 'is approaching substantial completion';

  const riskCtx = criticals > 0
    ? ` There are ${criticals} critical risk flag(s) requiring immediate lender attention.`
    : flagCount > 0
      ? ` ${flagCount} risk flag(s) are currently active and should be monitored.`
      : ' No active risk flags are present at this time.';

  return (
    `${loan.borrowerName}'s ${loan.loanType.toLowerCase().replace('_', ' ')} project at ` +
    `${loan.propertyAddress.city}, ${loan.propertyAddress.state} ` +
    `${progressCtx} at ${pct}% complete. ` +
    `${drawPct}% of the revised budget ($${(drawn / 1_000).toFixed(0)}K of ` +
    `$${(total / 1_000).toFixed(0)}K) has been drawn to date. ` +
    `The AI model estimates completion by ${completionForecastP50} (P50).` +
    riskCtx
  );
}

function buildNarrativeInsights(
  loan: ConstructionLoan,
  budget: ConstructionBudget,
  forecast: { velocityPctPerDay: number; p50: string; p75: string } | null,
  activeFlags: ConstructionRiskFlag[]
): string[] {
  const insights: string[] = [];

  // Budget burn pace
  const drawPct = budget.totalRevisedBudget > 0
    ? Math.round((budget.totalDrawnToDate / budget.totalRevisedBudget) * 100)
    : 0;
  const pctComplete = loan.percentComplete;
  const burnDiff    = drawPct - pctComplete;

  if (Math.abs(burnDiff) <= 5) {
    insights.push(`Budget draw pace (${drawPct}%) is tracking closely with inspector-certified completion (${pctComplete}%).`);
  } else if (burnDiff > 5) {
    insights.push(
      `Draw pace (${drawPct}%) is running ahead of certified completion (${pctComplete}%). ` +
      `Verify that disbursements are justified by on-site progress.`
    );
  } else {
    insights.push(
      `Draw pace (${drawPct}%) is lagging behind certified completion (${pctComplete}%). ` +
      `Project may have unreimbursed costs.`
    );
  }

  // Contingency
  if (budget.contingencyAmount > 0) {
    const contingencyUsedPct = Math.round(
      (budget.contingencyUsed / budget.contingencyAmount) * 100
    );
    if (contingencyUsedPct >= 75) {
      insights.push(
        `Contingency is ${contingencyUsedPct}% consumed ` +
        `($${(budget.contingencyRemaining / 1_000).toFixed(0)}K remaining). ` +
        `Monitor scope changes carefully.`
      );
    } else {
      insights.push(
        `Contingency reserve is ${100 - contingencyUsedPct}% intact ` +
        `($${(budget.contingencyRemaining / 1_000).toFixed(0)}K remaining).`
      );
    }
  }

  // Completion forecast context
  if (forecast) {
    const velocity = forecast.velocityPctPerDay;
    if (velocity < 0.14) {
      insights.push(
        `Construction velocity is low (~${(velocity * 7).toFixed(1)}% per week). ` +
        `At this pace, completion by ${forecast.p75} is the pessimistic scenario.`
      );
    } else {
      insights.push(
        `Construction is progressing at ~${(velocity * 7).toFixed(1)}% per week. ` +
        `P50 forecast target: ${forecast.p50}; P75 (pessimistic): ${forecast.p75}.`
      );
    }
  }

  // Retainage
  if (loan.retainageHeld > 0) {
    insights.push(
      `$${(loan.retainageHeld / 1_000).toFixed(0)}K retainage is currently held. ` +
      `$${(loan.retainageReleased / 1_000).toFixed(0)}K has been released to date.`
    );
  }

  // Summarize any active risk flags
  const criticalFlags = activeFlags.filter(f => f.severity === 'CRITICAL');
  if (criticalFlags.length > 0) {
    insights.push(
      `Active CRITICAL flags: ${criticalFlags.map(f => f.code).join(', ')}. ` +
      `Immediate lender review is required.`
    );
  }

  return insights;
}

function buildRecommendedActions(
  loan: ConstructionLoan,
  activeFlags: ConstructionRiskFlag[],
  pendingDraws: number,
  pendingInspections: number,
  pendingLienWaivers: number,
  pendingChangeOrders: number
): string[] {
  const actions: string[] = [];

  const flagCodes = new Set(activeFlags.map(f => f.code));

  if (pendingDraws > 0) {
    actions.push(
      `Review ${pendingDraws} pending draw request(s) and advance them through the approval pipeline.`
    );
  }
  if (pendingInspections > 0) {
    actions.push(
      `${pendingInspections} draw inspection(s) are in progress or scheduled — follow up for completion.`
    );
  }
  if (pendingLienWaivers > 0) {
    actions.push(
      `Obtain lien waivers for ${pendingLienWaivers} disbursed draw(s) still showing PENDING waiver status.`
    );
  }
  if (pendingChangeOrders > 0) {
    actions.push(
      `Evaluate ${pendingChangeOrders} pending change order(s) — approve or reject to keep the budget current.`
    );
  }

  if (flagCodes.has('STALLED_PROJECT')) {
    actions.push('Contact the general contractor to determine the cause of the construction stall and obtain a revised schedule.');
  }
  if (flagCodes.has('OVER_BUDGET')) {
    actions.push('Review budget vs. actuals in detail. Consider a change order or identify line items where realignment is possible.');
  }
  if (flagCodes.has('CONTRACTOR_LICENSE_EXPIRING') || flagCodes.has('CONTRACTOR_DISQUALIFIED')) {
    actions.push('Verify the general contractor\'s license and insurance are current before authorizing additional disbursements.');
  }
  if (flagCodes.has('MATURITY_APPROACHING')) {
    actions.push(`Initiate extension discussions — P75 completion forecast exceeds the maturity warning threshold.`);
  }
  if (flagCodes.has('INTEREST_RESERVE_DEPLETING')) {
    actions.push('Review interest reserve balance and consider a reserve replenishment or payment arrangement with the borrower.');
  }
  if (flagCodes.has('CPP_TRIGGER')) {
    actions.push('CPP workout is active — follow the workout plan and escalate to senior credit committee for resolution timeline.');
  }
  if (flagCodes.has('CONTINGENCY_NEARLY_EXHAUSTED')) {
    actions.push('Contingency is nearly exhausted. Any further scope changes will require supplemental funding approval.');
  }

  // Approaching substantial completion
  if (loan.percentComplete >= 90 && loan.loanType === 'GROUND_UP' && !loan.actualCompletionDate) {
    actions.push('Project is near completion. Initiate conversion-readiness review and order the as-completed appraisal if not yet ordered.');
  }

  return actions.length > 0
    ? actions
    : ['No immediate actions required. Continue routine monitoring per the servicing schedule.'];
}
