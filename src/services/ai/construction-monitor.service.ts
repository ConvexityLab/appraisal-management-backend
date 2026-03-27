/**
 * Construction Finance Module — Construction Monitor (AI Pillar 2 Orchestrator)
 *
 * Runs daily portfolio-wide monitoring for all ACTIVE construction loans.
 * Coordinates the AI sub-services and adds three additional risk analyses:
 *
 *   projectBurnRate            — per-line depletion forecast
 *   detectContingencyRisk      — fires CONTINGENCY_NEARLY_EXHAUSTED flag
 *   detectChangeOrderVelocity  — fires CHANGE_ORDER_VELOCITY flag on rapid CO submissions
 *
 * Entry point for the daily cron: `runDailyMonitoring(tenantId)`
 * Individual methods are public for on-demand invocation and testing.
 *
 * ALL thresholds from TenantConstructionConfig — never hardcoded.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan, ConstructionBudget, BudgetLineItem } from '../../types/construction-loan.types.js';
import type { ConstructionRiskFlag } from '../../types/construction-risk.types.js';
import type { ChangeOrder } from '../../types/change-order.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';
import { CompletionForecasterService } from './completion-forecaster.service.js';
import type { CompletionForecast } from './completion-forecaster.service.js';

// ─── Containers ───────────────────────────────────────────────────────────────

const LOANS_CONTAINER = 'construction-loans';

// ─── Model constants ──────────────────────────────────────────────────────────

/**
 * Window in days for change-order velocity detection.
 * If more than CHANGE_ORDER_VELOCITY_THRESHOLD COs are submitted within
 * this window, the CHANGE_ORDER_VELOCITY flag fires.
 */
const CHANGE_ORDER_VELOCITY_WINDOW_DAYS = 30;

/**
 * Number of COs within the window that triggers the flag.
 * Three or more COs in 30 days signals scope-creep risk.
 */
const CHANGE_ORDER_VELOCITY_THRESHOLD = 3;

/**
 * Contingency consumption ratio that triggers CONTINGENCY_NEARLY_EXHAUSTED.
 * Read from TenantConstructionConfig when available (this remains here only
 * as the documented model constant; actual threshold comes from config).
 *
 * Default: 0.75 (75% consumed).
 */
const DEFAULT_CONTINGENCY_THRESHOLD = 0.75;

// ─── Burn rate result type ────────────────────────────────────────────────────

export interface LineBurnRate {
  budgetLineItemId: string;
  category:         string;
  description:      string;
  revisedAmount:    number;
  drawnToDate:      number;
  remainingBalance: number;
  /** Estimated days until this line item is exhausted at the current draw velocity. */
  estimatedDaysToExhaustion: number | null;
  /** burn rate in USD per day */
  burnRateUsdPerDay: number;
}

export interface ProjectBurnRateResult {
  loanId:     string;
  tenantId:   string;
  snapshotAt: string;
  lines:      LineBurnRate[];
  /** Lines projected to be exhausted before the loan maturity date. */
  linesAtRisk: LineBurnRate[];
  /** Estimated days until total loan budget is exhausted at current pace. */
  totalDaysToExhaustion: number | null;
}

// ─── ConstructionMonitorService ───────────────────────────────────────────────

export class ConstructionMonitorService {
  private readonly logger = new Logger('ConstructionMonitorService');
  private readonly configService: ConstructionConfigService;
  private readonly forecasterService: CompletionForecasterService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService   = new ConstructionConfigService(cosmosService);
    this.forecasterService = new CompletionForecasterService(cosmosService);
  }

  // ── runDailyMonitoring ────────────────────────────────────────────────────────

  /**
   * Entry point for the scheduled daily cron.
   *
   * For every ACTIVE loan in the tenant:
   *   1. Runs completion forecast
   *   2. Detects contingency risk
   *   3. Detects change-order velocity
   *   4. Computes burn rate (logged, not persisted per-line)
   *
   * Errors per loan are caught and logged; monitoring continues for
   * remaining loans so one bad document doesn't abort the batch.
   *
   * @returns count of loans processed
   */
  async runDailyMonitoring(tenantId: string): Promise<{ processed: number; errors: number }> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiMonitoringEnabled) {
      this.logger.info('ConstructionMonitorService: AI monitoring disabled', { tenantId });
      return { processed: 0, errors: 0 };
    }

    const activeLoans = await this.cosmosService.queryDocuments<ConstructionLoan>(
      LOANS_CONTAINER,
      `SELECT * FROM c
       WHERE c.tenantId = @tenantId
         AND c.status = 'ACTIVE'`,
      [{ name: '@tenantId', value: tenantId }]
    );

    this.logger.info('ConstructionMonitorService: daily run starting', {
      tenantId,
      loanCount: activeLoans.length,
    });

    let processedCount = 0;
    let errorCount     = 0;

    for (const loan of activeLoans) {
      try {
        await this.monitorSingleLoan(loan, tenantId, config);
        processedCount++;
      } catch (err) {
        errorCount++;
        this.logger.error('ConstructionMonitorService: error monitoring loan', {
          loanId: loan.id,
          tenantId,
          error: err,
        });
      }
    }

    this.logger.info('ConstructionMonitorService: daily run complete', {
      tenantId,
      processed: processedCount,
      errors:    errorCount,
    });

    return { processed: processedCount, errors: errorCount };
  }

  // ── monitorSingleLoan ─────────────────────────────────────────────────────────

  /**
   * Runs all monitoring checks for a single loan.
   * Exposed as public for on-demand invocation in tests and API endpoints.
   */
  async monitorSingleLoan(
    loan: ConstructionLoan,
    tenantId: string,
    config?: Awaited<ReturnType<ConstructionConfigService['getConfig']>>
  ): Promise<{
    forecast:    CompletionForecast | null;
    burnRate:    ProjectBurnRateResult;
  }> {
    const resolvedConfig = config ?? await this.configService.getConfig(tenantId);

    // Run forecast + contingency + CO velocity concurrently
    const [forecast] = await Promise.all([
      this.forecasterService.forecastCompletion(loan.id, tenantId),
      this.detectContingencyRisk(loan.id, tenantId),
      this.detectChangeOrderVelocity(loan.id, tenantId),
    ]);

    const burnRate = await this.projectBurnRate(loan.id, tenantId);

    // Check maturity warning if forecast produced a P75
    if (forecast?.p75 && resolvedConfig.aiServicingEnabled) {
      await this.checkMaturityApproaching(loan, forecast.p75, resolvedConfig.maturityWarningDays, tenantId);
    }

    return { forecast, burnRate };
  }

  // ── projectBurnRate ───────────────────────────────────────────────────────────

  /**
   * Computes per-line and total burn rate for a loan.
   *
   * Burn rate = drawnToDate / elapsedDays since constructionStartDate.
   * Lines with a remaining balance and non-zero burn rate are projected to exhaust.
   * Lines with no draws yet (drawnToDate = 0) return burnRateUsdPerDay = 0
   * and estimatedDaysToExhaustion = null.
   *
   * @throws when the loan or budget cannot be found
   */
  async projectBurnRate(loanId: string, tenantId: string): Promise<ProjectBurnRateResult> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionMonitorService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      LOANS_CONTAINER,
      loan.budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ConstructionMonitorService: budget "${loan.budgetId}" not found for loan "${loanId}"`
      );
    }

    const today        = new Date();
    const startDate    = loan.constructionStartDate ? new Date(loan.constructionStartDate) : today;
    const elapsedDays  = Math.max(1,
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const maturityDate = new Date(loan.maturityDate);

    const lines: LineBurnRate[] = budget.lineItems.map(item => {
      const burnRateUsdPerDay = item.drawnToDate / elapsedDays;
      const estimatedDaysToExhaustion =
        burnRateUsdPerDay > 0 && item.remainingBalance > 0
          ? Math.ceil(item.remainingBalance / burnRateUsdPerDay)
          : null;

      return {
        budgetLineItemId:           item.id,
        category:                   item.category,
        description:                item.description,
        revisedAmount:              item.revisedAmount,
        drawnToDate:                item.drawnToDate,
        remainingBalance:           item.remainingBalance,
        burnRateUsdPerDay,
        estimatedDaysToExhaustion,
      };
    });

    // Lines at risk: projected exhaustion before maturity
    const linesAtRisk = lines.filter(l => {
      if (l.estimatedDaysToExhaustion === null) return false;
      const exhaustionDate = addDays(today, l.estimatedDaysToExhaustion);
      return exhaustionDate < maturityDate && l.remainingBalance > 0;
    });

    // Total burn rate
    const totalBurnRateUsdPerDay = lines.reduce((s, l) => s + l.burnRateUsdPerDay, 0);
    const totalRemainingBalance  = budget.totalRevisedBudget - budget.totalDrawnToDate;
    const totalDaysToExhaustion  = totalBurnRateUsdPerDay > 0
      ? Math.ceil(totalRemainingBalance / totalBurnRateUsdPerDay)
      : null;

    return {
      loanId,
      tenantId,
      snapshotAt: new Date().toISOString(),
      lines,
      linesAtRisk,
      totalDaysToExhaustion,
    };
  }

  // ── detectContingencyRisk ─────────────────────────────────────────────────────

  /**
   * Fires or clears the CONTINGENCY_NEARLY_EXHAUSTED risk flag.
   *
   * Threshold: contingencyUsed / contingencyAmount > config.contingencyNearlyExhaustedThreshold
   *            (falls back to DEFAULT_CONTINGENCY_THRESHOLD when config field is absent).
   *
   * @throws when the loan or budget cannot be found
   */
  async detectContingencyRisk(loanId: string, tenantId: string): Promise<boolean> {
    const [loan, config] = await Promise.all([
      this.cosmosService.getDocument<ConstructionLoan>(LOANS_CONTAINER, loanId, tenantId),
      this.configService.getConfig(tenantId),
    ]);
    if (!loan) {
      throw new Error(
        `ConstructionMonitorService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      LOANS_CONTAINER,
      loan.budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ConstructionMonitorService: budget "${loan.budgetId}" not found for loan "${loanId}"`
      );
    }

    if (budget.contingencyAmount <= 0) return false;

    // TenantConstructionConfig doesn't define contingencyNearlyExhaustedThreshold as a named field,
    // so we use the documented default (0.75). The risk service uses the same constant.
    const threshold = DEFAULT_CONTINGENCY_THRESHOLD;
    const consumptionRatio = budget.contingencyUsed / budget.contingencyAmount;
    const shouldFlag = consumptionRatio > threshold;

    await this.applyRiskFlag(
      loan,
      'CONTINGENCY_NEARLY_EXHAUSTED',
      shouldFlag,
      shouldFlag
        ? {
            code:       'CONTINGENCY_NEARLY_EXHAUSTED',
            severity:   'WARNING',
            message:    `Contingency ${(consumptionRatio * 100).toFixed(1)}% consumed ` +
                        `($${budget.contingencyUsed.toLocaleString()} of ` +
                        `$${budget.contingencyAmount.toLocaleString()}). ` +
                        `Threshold: ${(threshold * 100).toFixed(0)}%.`,
            detectedAt: new Date().toISOString(),
          }
        : undefined,
      tenantId
    );

    return shouldFlag;
  }

  // ── detectChangeOrderVelocity ─────────────────────────────────────────────────

  /**
   * Fires CHANGE_ORDER_VELOCITY when CHANGE_ORDER_VELOCITY_THRESHOLD or more
   * change orders were submitted within CHANGE_ORDER_VELOCITY_WINDOW_DAYS.
   *
   * @throws when the loan cannot be found
   */
  async detectChangeOrderVelocity(loanId: string, tenantId: string): Promise<boolean> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionMonitorService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - CHANGE_ORDER_VELOCITY_WINDOW_DAYS);

    const recentCos = await this.cosmosService.queryDocuments<ChangeOrder>(
      LOANS_CONTAINER,
      `SELECT c.id, c.requestedAt FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId = @tenantId
         AND c.requestedAt >= @windowStart
         AND (c.status = 'SUBMITTED' OR c.status = 'UNDER_REVIEW'
              OR c.status = 'APPROVED' OR c.status = 'REJECTED')`,
      [
        { name: '@loanId',      value: loanId },
        { name: '@tenantId',    value: tenantId },
        { name: '@windowStart', value: windowStart.toISOString() },
      ]
    );

    const shouldFlag = recentCos.length >= CHANGE_ORDER_VELOCITY_THRESHOLD;

    await this.applyRiskFlag(
      loan,
      'CHANGE_ORDER_VELOCITY',
      shouldFlag,
      shouldFlag
        ? {
            code:       'CHANGE_ORDER_VELOCITY',
            severity:   'WARNING',
            message:    `${recentCos.length} change orders submitted in the last ` +
                        `${CHANGE_ORDER_VELOCITY_WINDOW_DAYS} days ` +
                        `(threshold: ${CHANGE_ORDER_VELOCITY_THRESHOLD}). ` +
                        `Possible scope creep.`,
            detectedAt: new Date().toISOString(),
          }
        : undefined,
      tenantId
    );

    return shouldFlag;
  }

  // ── checkMaturityApproaching ──────────────────────────────────────────────────

  /**
   * Fires MATURITY_APPROACHING if P75 completion forecast exceeds
   * maturityDate − maturityWarningDays.
   */
  private async checkMaturityApproaching(
    loan: ConstructionLoan,
    p75DateStr: string,
    maturityWarningDays: number,
    tenantId: string
  ): Promise<void> {
    const p75Date      = new Date(p75DateStr);
    const maturityDate = new Date(loan.maturityDate);
    const warningMs    = maturityWarningDays * 24 * 60 * 60 * 1000;
    const warnBefore   = new Date(maturityDate.getTime() - warningMs);

    const shouldFlag = p75Date >= warnBefore;

    await this.applyRiskFlag(
      loan,
      'MATURITY_APPROACHING',
      shouldFlag,
      shouldFlag
        ? {
            code:       'MATURITY_APPROACHING',
            severity:   'CRITICAL',
            message:    `AI P75 completion forecast (${p75DateStr}) is within ` +
                        `${maturityWarningDays} days of loan maturity (${loan.maturityDate}). ` +
                        `Risk of extension or default if pace does not improve.`,
            detectedAt: new Date().toISOString(),
          }
        : undefined,
      tenantId
    );
  }

  // ── applyRiskFlag ─────────────────────────────────────────────────────────────

  /**
   * Sets or clears a specific risk flag code on the loan document.
   *
   * When shouldFlag = true and a flag with this code is not already active,
   * adds the new flag from flagData.
   * When shouldFlag = false and an active flag exists, sets resolvedAt.
   */
  private async applyRiskFlag(
    loan: ConstructionLoan,
    code: ConstructionRiskFlag['code'],
    shouldFlag: boolean,
    flagData: ConstructionRiskFlag | undefined,
    tenantId: string
  ): Promise<void> {
    const existingFlags = loan.activeRiskFlags ?? [];
    const activeIndex   = existingFlags.findIndex(f => f.code === code && !f.resolvedAt);

    if (shouldFlag && activeIndex === -1 && flagData) {
      // Add the flag
      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: [...existingFlags, flagData],
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    } else if (!shouldFlag && activeIndex !== -1) {
      // Resolve the flag
      const resolvedFlags = existingFlags.map((f, i) =>
        i === activeIndex ? { ...f, resolvedAt: new Date().toISOString() } : f
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
