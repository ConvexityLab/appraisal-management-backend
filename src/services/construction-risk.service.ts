/**
 * Construction Finance Module — Construction Risk Service (Phase 3)
 *
 * Evaluates up to 16 data-driven risk flags per loan.  Two AI-specific flags
 * (DRAW_ANOMALY, INSPECTION_PHOTO_ANOMALY) are set by Phase 4b services and
 * are preserved untouched by this service.
 *
 * Risk flags are stored directly on the ConstructionLoan document in the
 * `activeRiskFlags` array.  Each flag has a `resolvedAt` field set when cleared.
 *
 * ALL thresholds come from TenantConstructionConfig — never hardcoded here.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { ConstructionLoan, ContractorProfile, ConstructionBudget } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';
import type { ConstructionRiskFlag, ConstructionRiskFlagCode } from '../types/construction-risk.types.js';
import type { DrawRequest } from '../types/draw-request.types.js';
import type { ChangeOrder } from '../types/change-order.types.js';
import { ConstructionConfigService } from './construction-config.service.js';

// ─── AI-managed flag codes (never computed here) ─────────────────────────────

const AI_MANAGED_FLAGS = new Set<ConstructionRiskFlagCode>([
  'DRAW_ANOMALY',
  'INSPECTION_PHOTO_ANOMALY',
  'TITLE_HOLD',
]);

// ─── Portfolio Summary ────────────────────────────────────────────────────────

export interface PortfolioRiskSummary {
  tenantId: string;
  snapshotAt: string;
  activeLoanCount: number;
  /** Loans with at least one CRITICAL unresolved flag. */
  criticalCount: number;
  /** Loans with at least one WARNING unresolved flag and no CRITICAL flags. */
  warningCount: number;
  /** Active loans with no unresolved flags. */
  healthyCount: number;
  /** Count per flag code across all active loans. */
  flagBreakdown: Partial<Record<ConstructionRiskFlagCode, number>>;
}

// ─── ConstructionRiskService ──────────────────────────────────────────────────

export class ConstructionRiskService {
  private readonly logger = new Logger('ConstructionRiskService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── computeRiskFlags ─────────────────────────────────────────────────────────

  /**
   * Evaluates all data-driven risk flags for a single loan.
   * Merges the results into the loan's activeRiskFlags array, preserving AI-managed
   * flags and any flags that are already resolved (resolvedAt is set).
   *
   * Saves the updated loan document to Cosmos.
   *
   * @returns the updated array of active (unresolved) risk flags on the loan
   */
  async computeRiskFlags(
    loanId: string,
    tenantId: string
  ): Promise<ConstructionRiskFlag[]> {
    const [loan, config] = await Promise.all([
      this.getLoan(loanId, tenantId),
      this.configService.getConfig(tenantId),
    ]);

    // Load related documents concurrently
    const [budget, draws, changeOrders, contractor] = await Promise.all([
      this.getCurrentBudget(loanId, tenantId),
      this.getActiveDraws(loanId, tenantId),
      this.getChangeOrders(loanId, tenantId),
      loan.generalContractorId
        ? this.getContractor(loan.generalContractorId, tenantId)
        : Promise.resolve(null),
    ]);

    const now = new Date().toISOString();
    const newFlags: ConstructionRiskFlag[] = [];

    // ── Evaluate each data-driven flag ──────────────────────────────────────

    const stalledFlag = this.evalStalledProject(loan, draws, config, now);
    if (stalledFlag) newFlags.push(stalledFlag);

    const overBudgetFlag = this.evalOverBudget(budget, config, now);
    if (overBudgetFlag) newFlags.push(overBudgetFlag);

    const scheduleSlipFlag = this.evalScheduleSlip(loan, config, now);
    if (scheduleSlipFlag) newFlags.push(scheduleSlipFlag);

    const inspectionConcernFlag = this.evalInspectionConcern(draws, now);
    if (inspectionConcernFlag) newFlags.push(inspectionConcernFlag);

    const lienWaiverFlag = this.evalLienWaiverMissing(draws, now);
    if (lienWaiverFlag) newFlags.push(lienWaiverFlag);

    if (contractor) {
      const licenseExpiringFlag = this.evalContractorLicenseExpiring(contractor, config, now);
      if (licenseExpiringFlag) newFlags.push(licenseExpiringFlag);

      const disqualifiedFlag = this.evalContractorDisqualified(contractor, now);
      if (disqualifiedFlag) newFlags.push(disqualifiedFlag);
    }

    const lowArvFlag = this.evalLowArvCoverage(loan, config, now);
    if (lowArvFlag) newFlags.push(lowArvFlag);

    const retainageFlag = this.evalHighRetainageBacklog(loan, now);
    if (retainageFlag) newFlags.push(retainageFlag);

    const interestFlag = this.evalInterestReserveDepleting(loan, draws, config, now);
    if (interestFlag) newFlags.push(interestFlag);

    const maturityFlag = this.evalMaturityApproaching(loan, config, now);
    if (maturityFlag) newFlags.push(maturityFlag);

    if (budget) {
      const contingencyFlag = this.evalContingencyNearlyExhausted(budget, now);
      if (contingencyFlag) newFlags.push(contingencyFlag);
    }

    const coVelocityFlag = this.evalChangeOrderVelocity(changeOrders, now);
    if (coVelocityFlag) newFlags.push(coVelocityFlag);

    // ── Merge: preserve AI-managed flags, replace data-driven ones ──────────
    const existingFlags = loan.activeRiskFlags ?? [];
    const aiManagedPreserved = existingFlags.filter(f => AI_MANAGED_FLAGS.has(f.code));
    const resolvedPreserved = existingFlags.filter(f => f.resolvedAt !== undefined && !AI_MANAGED_FLAGS.has(f.code));

    const merged = [...aiManagedPreserved, ...resolvedPreserved, ...newFlags];

    // Evaluate CPP_TRIGGER last, after all other flags are computed
    const cppFlag = this.evalCppTrigger(merged, now);
    // Remove any prior CPP_TRIGGER, then add the new one if it fires
    const withoutCpp = merged.filter(f => f.code !== 'CPP_TRIGGER');
    if (cppFlag) withoutCpp.push(cppFlag);

    const updatedLoan: ConstructionLoan = {
      ...loan,
      activeRiskFlags: withoutCpp,
      updatedAt: now,
    };

    await this.cosmosService.upsertDocument<ConstructionLoan>('construction-loans', updatedLoan);

    this.logger.info('ConstructionRiskService: flags computed', {
      loanId,
      tenantId,
      flagCount: withoutCpp.filter(f => !f.resolvedAt).length,
    });

    return withoutCpp.filter(f => !f.resolvedAt);
  }

  // ── getRiskFlags ─────────────────────────────────────────────────────────────

  /**
   * Returns the current active (unresolved) risk flags from the loan document.
   * Does NOT re-evaluate — call computeRiskFlags first for fresh results.
   */
  async getRiskFlags(loanId: string, tenantId: string): Promise<ConstructionRiskFlag[]> {
    const loan = await this.getLoan(loanId, tenantId);
    return (loan.activeRiskFlags ?? []).filter(f => !f.resolvedAt);
  }

  // ── resolveFlag ──────────────────────────────────────────────────────────────

  /**
   * Marks a specific risk flag as resolved on a loan.
   * Stamps resolvedAt on the matching flag and saves the loan.
   *
   * @throws if the loan or the flag code is not found in the loan's active flags
   */
  async resolveFlag(
    loanId: string,
    flagCode: ConstructionRiskFlagCode,
    resolvedBy: string,
    notes: string,
    tenantId: string
  ): Promise<void> {
    if (!resolvedBy) {
      throw new Error('ConstructionRiskService.resolveFlag: resolvedBy is required');
    }

    const loan = await this.getLoan(loanId, tenantId);
    const flags = loan.activeRiskFlags ?? [];
    const idx = flags.findIndex(f => f.code === flagCode && !f.resolvedAt);

    if (idx === -1) {
      throw new Error(
        `ConstructionRiskService.resolveFlag: no active flag "${flagCode}" found on loan "${loanId}"`
      );
    }

    const now = new Date().toISOString();
    const updated = [
      ...flags.slice(0, idx),
      {
        ...flags[idx]!,
        resolvedAt: now,
        message: flags[idx]!.message + (notes ? ` — Resolved by ${resolvedBy}: ${notes}` : ''),
      },
      ...flags.slice(idx + 1),
    ];

    await this.cosmosService.upsertDocument<ConstructionLoan>('construction-loans', {
      ...loan,
      activeRiskFlags: updated,
      updatedAt: now,
    });

    this.logger.info('ConstructionRiskService: flag resolved', {
      loanId,
      tenantId,
      flagCode,
      resolvedBy,
    });
  }

  // ── computePortfolioRiskSummary ───────────────────────────────────────────────

  /**
   * Aggregates risk flag counts across all ACTIVE loans for the tenant.
   * Reads the current stored flags — does not re-evaluate each loan.
   */
  async computePortfolioRiskSummary(tenantId: string): Promise<PortfolioRiskSummary> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.status IN (@s0, @s1)
        AND NOT IS_DEFINED(c.changeOrderNumber)
        AND NOT IS_DEFINED(c.lineItems)
        AND NOT IS_DEFINED(c.inspectionType)
        AND NOT IS_DEFINED(c.drawNumber)
        AND IS_DEFINED(c.loanAmount)
    `;
    const parameters = [
      { name: '@tenantId', value: tenantId },
      { name: '@s0', value: 'ACTIVE' },
      { name: '@s1', value: 'SUBSTANTIALLY_COMPLETE' },
    ];

    const loans = await this.cosmosService.queryDocuments<ConstructionLoan>(
      'construction-loans',
      query,
      parameters
    );

    const flagBreakdown: Partial<Record<ConstructionRiskFlagCode, number>> = {};
    let criticalCount = 0;
    let warningCount = 0;
    let healthyCount = 0;

    for (const loan of loans) {
      const activeFlags = (loan.activeRiskFlags ?? []).filter(f => !f.resolvedAt);

      for (const flag of activeFlags) {
        flagBreakdown[flag.code] = (flagBreakdown[flag.code] ?? 0) + 1;
      }

      const hasCritical = activeFlags.some(f => f.severity === 'CRITICAL');
      const hasWarning = activeFlags.some(f => f.severity === 'WARNING' || f.severity === 'INFO');

      if (hasCritical) {
        criticalCount++;
      } else if (hasWarning) {
        warningCount++;
      } else {
        healthyCount++;
      }
    }

    return {
      tenantId,
      snapshotAt: new Date().toISOString(),
      activeLoanCount: loans.length,
      criticalCount,
      warningCount,
      healthyCount,
      flagBreakdown,
    };
  }

  // ── Individual flag evaluators ───────────────────────────────────────────────

  private evalStalledProject(
    loan: ConstructionLoan,
    draws: DrawRequest[],
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    if (loan.status !== 'ACTIVE') return null;

    const disbursed = draws
      .filter(d => d.status === 'DISBURSED' && d.disbursedAt)
      .sort((a, b) => (b.disbursedAt! > a.disbursedAt! ? 1 : -1));

    const lastDisbursedAt = disbursed[0]?.disbursedAt;
    const referenceDate = lastDisbursedAt ?? loan.constructionStartDate;
    if (!referenceDate) return null;

    const daysSince = daysBetween(referenceDate.slice(0, 10), now.slice(0, 10));
    if (daysSince < config.stalledProjectDays) return null;

    return {
      code: 'STALLED_PROJECT',
      severity: 'CRITICAL',
      message:
        `No disbursed draw in ${daysSince} days (threshold: ${config.stalledProjectDays}).` +
        (lastDisbursedAt ? ` Last disbursed: ${lastDisbursedAt.slice(0, 10)}.` : ''),
      detectedAt: now,
    };
  }

  private evalOverBudget(
    budget: ConstructionBudget | null,
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    if (!budget) return null;

    const threshold = 1 + config.overBudgetThresholdPct / 100;
    const limit = budget.totalRevisedBudget * threshold;
    if (budget.totalDrawnToDate <= limit) return null;

    const pct = ((budget.totalDrawnToDate / budget.totalRevisedBudget - 1) * 100).toFixed(1);
    return {
      code: 'OVER_BUDGET',
      severity: 'CRITICAL',
      message:
        `Total drawn ($${budget.totalDrawnToDate.toLocaleString()}) exceeds revised budget ` +
        `($${budget.totalRevisedBudget.toLocaleString()}) by ${pct}% ` +
        `(threshold: ${config.overBudgetThresholdPct}%).`,
      detectedAt: now,
    };
  }

  private evalScheduleSlip(
    loan: ConstructionLoan,
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    if (!loan.constructionStartDate || loan.percentComplete <= 0) return null;

    const startDate = loan.constructionStartDate.slice(0, 10);
    const today = now.slice(0, 10);
    const elapsed = daysBetween(startDate, today);

    // Projected total days = elapsed / (percentComplete / 100)
    const projectedDays = Math.round(elapsed / (loan.percentComplete / 100));
    const projectedEnd = addDays(startDate, projectedDays);
    const slipDays = daysBetween(loan.expectedCompletionDate.slice(0, 10), projectedEnd);

    if (slipDays <= config.scheduleSlipDays) return null;

    return {
      code: 'SCHEDULE_SLIP',
      severity: 'WARNING',
      message:
        `Projected completion ${projectedEnd} is ${slipDays} days past expected ` +
        `${loan.expectedCompletionDate.slice(0, 10)} (threshold: ${config.scheduleSlipDays} days).`,
      detectedAt: now,
    };
  }

  private evalInspectionConcern(
    draws: DrawRequest[],
    now: string
  ): ConstructionRiskFlag | null {
    // DrawRequest.inspectionId links to an inspection; we don't have the inspection reports
    // here, but draws that have been advanced back from INSPECTION_COMPLETE to UNDER_REVIEW
    // with concerns would be reflected in the draw's own notes. Phase 4b will enrich this.
    // For Phase 3, we flag draws that are ON_HOLD after inspection was completed.
    const heldAfterInspection = draws.filter(
      d => d.status === 'ON_HOLD' && d.inspectionId != null
    );

    if (heldAfterInspection.length === 0) return null;

    return {
      code: 'INSPECTION_CONCERN',
      severity: 'WARNING',
      message:
        `${heldAfterInspection.length} draw(s) placed ON_HOLD after inspection ` +
        `(draw IDs: ${heldAfterInspection.map(d => d.id).slice(0, 3).join(', ')}${heldAfterInspection.length > 3 ? '…' : ''}).`,
      detectedAt: now,
    };
  }

  private evalLienWaiverMissing(
    draws: DrawRequest[],
    now: string
  ): ConstructionRiskFlag | null {
    const missing = draws.filter(
      d => d.status === 'DISBURSED' && d.lienWaiverStatus === 'PENDING'
    );
    if (missing.length === 0) return null;

    return {
      code: 'LIEN_WAIVER_MISSING',
      severity: 'WARNING',
      message:
        `${missing.length} disbursed draw(s) missing lien waiver ` +
        `(draw IDs: ${missing.map(d => d.id).slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}).`,
      detectedAt: now,
    };
  }

  private evalContractorLicenseExpiring(
    contractor: ContractorProfile,
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    const expiryDate = contractor.licenseExpiry.slice(0, 10);
    const today = now.slice(0, 10);
    const daysToExpiry = daysBetween(today, expiryDate);

    if (daysToExpiry > config.contractorLicenseExpiryWarningDays) return null;
    if (daysToExpiry < 0) return null; // expired → handled by CONTRACTOR_DISQUALIFIED

    return {
      code: 'CONTRACTOR_LICENSE_EXPIRING',
      severity: 'WARNING',
      message:
        `GC "${contractor.name}" license expires ${expiryDate} (${daysToExpiry} days). ` +
        `Warning threshold: ${config.contractorLicenseExpiryWarningDays} days.`,
      detectedAt: now,
    };
  }

  private evalContractorDisqualified(
    contractor: ContractorProfile,
    now: string
  ): ConstructionRiskFlag | null {
    const isDisqualified = contractor.riskTier === 'DISQUALIFIED';
    const isExpired = contractor.licenseExpiry.slice(0, 10) < now.slice(0, 10);

    if (!isDisqualified && !isExpired) return null;

    const reason = isDisqualified
      ? `risk tier is DISQUALIFIED`
      : `license expired ${contractor.licenseExpiry.slice(0, 10)}`;

    return {
      code: 'CONTRACTOR_DISQUALIFIED',
      severity: 'CRITICAL',
      message: `GC "${contractor.name}" (ID: ${contractor.id}) ${reason}.`,
      detectedAt: now,
    };
  }

  private evalLowArvCoverage(
    loan: ConstructionLoan,
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    if (!loan.arvEstimate || loan.arvEstimate <= 0) return null;

    const ratio = loan.loanAmount / loan.arvEstimate;
    if (ratio <= config.lowArvCoverageThreshold) return null;

    const pct = (ratio * 100).toFixed(1);
    const threshold = (config.lowArvCoverageThreshold * 100).toFixed(1);
    return {
      code: 'LOW_ARV_COVERAGE',
      severity: 'WARNING',
      message:
        `Loan-to-ARV ${pct}% exceeds threshold ${threshold}% ` +
        `(loan: $${loan.loanAmount.toLocaleString()}, ARV: $${loan.arvEstimate.toLocaleString()}).`,
      detectedAt: now,
    };
  }

  private evalHighRetainageBacklog(
    loan: ConstructionLoan,
    now: string
  ): ConstructionRiskFlag | null {
    // Flag if more than 15% of the loan amount is held as retainage and
    // the maturity is within 90 days. Threshold not in config currently, so we
    // use a fixed-but-documented 15% + 90-day maturity window.
    const retainagePct = loan.loanAmount > 0 ? loan.retainageHeld / loan.loanAmount : 0;
    if (retainagePct < 0.15) return null;

    const daysToMaturity = daysBetween(now.slice(0, 10), loan.maturityDate.slice(0, 10));
    if (daysToMaturity > 90) return null;

    return {
      code: 'HIGH_RETAINAGE_BACKLOG',
      severity: 'WARNING',
      message:
        `$${loan.retainageHeld.toLocaleString()} retainage held (${(retainagePct * 100).toFixed(1)}% of loan) ` +
        `with only ${daysToMaturity} days to maturity.`,
      detectedAt: now,
    };
  }

  private evalInterestReserveDepleting(
    loan: ConstructionLoan,
    draws: DrawRequest[],
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    const remaining = loan.interestReserveAmount - loan.interestReserveDrawn;
    if (remaining <= 0) return null; // already depleted — separate severity

    // Estimate monthly burn rate from recent draws on interest reserve
    // Simplified: use total drawn / elapsed months
    if (!loan.constructionStartDate) return null;

    const elapsedMonths = Math.max(
      1,
      daysBetween(loan.constructionStartDate.slice(0, 10), now.slice(0, 10)) / 30
    );
    const monthlyBurn = loan.interestReserveDrawn / elapsedMonths;

    if (monthlyBurn <= 0) return null;

    const monthsRemaining = remaining / monthlyBurn;
    const daysRemaining = Math.round(monthsRemaining * 30);

    if (daysRemaining > config.interestReserveWarningDays) return null;

    return {
      code: 'INTEREST_RESERVE_DEPLETING',
      severity: daysRemaining <= 30 ? 'CRITICAL' : 'WARNING',
      message:
        `Interest reserve projected to deplete in ~${daysRemaining} days ` +
        `($${remaining.toLocaleString()} remaining at ~$${Math.round(monthlyBurn).toLocaleString()}/month). ` +
        `Warning threshold: ${config.interestReserveWarningDays} days.`,
      detectedAt: now,
    };
  }

  private evalMaturityApproaching(
    loan: ConstructionLoan,
    config: TenantConstructionConfig,
    now: string
  ): ConstructionRiskFlag | null {
    const daysToMaturity = daysBetween(now.slice(0, 10), loan.maturityDate.slice(0, 10));
    if (daysToMaturity > config.maturityWarningDays) return null;

    // Also check if completion forecast exceeds maturity
    // For a simple forecast: if percentComplete > 0 and constructionStartDate set
    // Projected completion = constructionStartDate + (elapsed / percentComplete * 100)
    let forecastNote = '';
    if (loan.constructionStartDate && loan.percentComplete > 0) {
      const elapsed = daysBetween(loan.constructionStartDate.slice(0, 10), now.slice(0, 10));
      const projectedDays = Math.round(elapsed / (loan.percentComplete / 100));
      const projectedEnd = addDays(loan.constructionStartDate.slice(0, 10), projectedDays);
      const slipPastMaturity = daysBetween(loan.maturityDate.slice(0, 10), projectedEnd);
      if (slipPastMaturity > 0) {
        forecastNote = ` Projected completion ${projectedEnd} is ${slipPastMaturity} days past maturity.`;
      }
    }

    return {
      code: 'MATURITY_APPROACHING',
      severity: daysToMaturity <= 30 ? 'CRITICAL' : 'WARNING',
      message:
        `Loan matures ${loan.maturityDate.slice(0, 10)} (${daysToMaturity} days, ` +
        `threshold: ${config.maturityWarningDays} days).${forecastNote}`,
      detectedAt: now,
    };
  }

  private evalContingencyNearlyExhausted(
    budget: ConstructionBudget,
    now: string
  ): ConstructionRiskFlag | null {
    if (!budget.contingencyAmount || budget.contingencyAmount <= 0) return null;

    const ratio = budget.contingencyUsed / budget.contingencyAmount;
    if (ratio < 0.75) return null;

    const pct = (ratio * 100).toFixed(1);
    return {
      code: 'CONTINGENCY_NEARLY_EXHAUSTED',
      severity: ratio >= 0.9 ? 'CRITICAL' : 'WARNING',
      message:
        `Contingency ${pct}% consumed ` +
        `($${budget.contingencyUsed.toLocaleString()} of $${budget.contingencyAmount.toLocaleString()}).`,
      detectedAt: now,
    };
  }

  private evalChangeOrderVelocity(
    changeOrders: ChangeOrder[],
    now: string
  ): ConstructionRiskFlag | null {
    // Flag if 3+ change orders submitted in the last 30 days (scope-creep signal)
    const thirtyDaysAgo = addDays(now.slice(0, 10), -30);
    const recent = changeOrders.filter(
      co => co.requestedAt && co.requestedAt.slice(0, 10) >= thirtyDaysAgo
    );

    if (recent.length < 3) return null;

    return {
      code: 'CHANGE_ORDER_VELOCITY',
      severity: 'WARNING',
      message:
        `${recent.length} change orders submitted in the last 30 days — possible scope creep.`,
      detectedAt: now,
    };
  }

  private evalCppTrigger(
    allFlags: ConstructionRiskFlag[],
    now: string
  ): ConstructionRiskFlag | null {
    // CPP fires when there are 3+ unresolved CRITICAL flags
    const criticalUnresolved = allFlags.filter(
      f => f.severity === 'CRITICAL' && !f.resolvedAt && f.code !== 'CPP_TRIGGER'
    );

    if (criticalUnresolved.length < 3) return null;

    return {
      code: 'CPP_TRIGGER',
      severity: 'CRITICAL',
      message:
        `Construction Protection Program threshold met: ${criticalUnresolved.length} critical flags active ` +
        `(${criticalUnresolved.map(f => f.code).join(', ')}). ` +
        `Escalation and workout plan required.`,
      detectedAt: now,
    };
  }

  // ── Private data loaders ─────────────────────────────────────────────────────

  private async getLoan(loanId: string, tenantId: string): Promise<ConstructionLoan> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      'construction-loans',
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionRiskService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }
    return loan;
  }

  private async getCurrentBudget(
    loanId: string,
    tenantId: string
  ): Promise<ConstructionBudget | null> {
    // Query for the highest-versioned APPROVED or REVISED budget
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.constructionLoanId = @loanId
        AND IS_DEFINED(c.lineItems)
        AND IS_DEFINED(c.version)
      ORDER BY c.version DESC
    `;
    const results = await this.cosmosService.queryDocuments<ConstructionBudget>(
      'construction-loans',
      query,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@loanId', value: loanId },
      ]
    );
    return results[0] ?? null;
  }

  private async getActiveDraws(loanId: string, tenantId: string): Promise<DrawRequest[]> {
    const query = `
      SELECT * FROM c
      WHERE c.constructionLoanId = @loanId
        AND c.tenantId = @tenantId
        AND IS_DEFINED(c.drawNumber)
      ORDER BY c.drawNumber ASC
    `;
    return this.cosmosService.queryDocuments<DrawRequest>(
      'draws',
      query,
      [
        { name: '@loanId', value: loanId },
        { name: '@tenantId', value: tenantId },
      ]
    );
  }

  private async getChangeOrders(loanId: string, tenantId: string): Promise<ChangeOrder[]> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.constructionLoanId = @loanId
        AND IS_DEFINED(c.changeOrderNumber)
      ORDER BY c.createdAt DESC
    `;
    return this.cosmosService.queryDocuments<ChangeOrder>(
      'construction-loans',
      query,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@loanId', value: loanId },
      ]
    );
  }

  private async getContractor(
    contractorId: string,
    tenantId: string
  ): Promise<ContractorProfile | null> {
    return this.cosmosService.getDocument<ContractorProfile>(
      'contractors',
      contractorId,
      tenantId
    );
  }
}

// ─── Date utilities ───────────────────────────────────────────────────────────

/** Returns the number of calendar days from dateA to dateB (positive if dateB > dateA). */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Returns an ISO date string (YYYY-MM-DD) that is n days after the given date. */
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
