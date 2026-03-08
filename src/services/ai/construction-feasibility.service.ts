/**
 * Construction Finance Module — Feasibility Engine (AI Pillar 1)
 *
 * Scores a ConstructionBudget against market benchmarks, applies lender-defined
 * FeasibilityRules from TenantConstructionConfig, evaluates ARV/LTV coverage,
 * assesses timeline realism, and checks contractor suitability.
 *
 * All thresholds (feasibilityMinScore, lowArvCoverageThreshold, etc.) are read
 * from TenantConstructionConfig — never hardcoded in service logic.
 *
 * FeasibilityReport documents are stored in the `construction-loans` Cosmos
 * container with a deterministic ID: `feasibility-{loanId}`.
 * Partition key: /tenantId
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type {
  ConstructionLoan,
  ConstructionBudget,
  ContractorProfile,
  ConstructionLoanType,
  BudgetCategory,
} from '../../types/construction-loan.types.js';
import type { TenantConstructionConfig, FeasibilityRule } from '../../types/construction-config.types.js';
import type {
  FeasibilityReport,
  ContractorFeasibilityResult,
} from '../../types/feasibility-report.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'construction-loans';
const CONTRACTORS_CONTAINER = 'contractors';
const MODEL_VERSION = 'feasibility-v1.0.0';

/**
 * Market benchmark ranges for each budget category, expressed as percentage of
 * the total construction budget (excluding LAND_ACQUISITION and INTEREST_RESERVE,
 * which sit outside the hard-cost stack).
 *
 * Source: RSMeans 2026 National Averages / Platform Portfolio Actuals 2024-2025.
 * IMPORTANT: These represent typical single-family residential ranges for GROUND_UP.
 * Fix-and-flip and rehab projects have different expected distributions — the
 * REQUIRED_CATEGORIES_BY_TYPE handles the missing-line-item check; the benchmark
 * pcts produce UNDER_FUNDED / OVER_FUNDED findings when a line is present but oddly sized.
 */
const BENCHMARK_PCT: Partial<Record<BudgetCategory, { low: number; high: number; source: string }>> = {
  SITE_WORK:       { low: 3,  high: 12, source: 'RSMeans 2026 Nat\'l Avg' },
  FOUNDATION:      { low: 7,  high: 15, source: 'RSMeans 2026 Nat\'l Avg' },
  FRAMING:         { low: 10, high: 20, source: 'RSMeans 2026 Nat\'l Avg' },
  ROOFING:         { low: 4,  high: 10, source: 'RSMeans 2026 Nat\'l Avg' },
  EXTERIOR:        { low: 3,  high: 9,  source: 'RSMeans 2026 Nat\'l Avg' },
  WINDOWS_DOORS:   { low: 3,  high: 8,  source: 'RSMeans 2026 Nat\'l Avg' },
  PLUMBING:        { low: 4,  high: 9,  source: 'RSMeans 2026 Nat\'l Avg' },
  ELECTRICAL:      { low: 4,  high: 10, source: 'RSMeans 2026 Nat\'l Avg' },
  HVAC:            { low: 4,  high: 10, source: 'RSMeans 2026 Nat\'l Avg' },
  INSULATION:      { low: 2,  high: 5,  source: 'RSMeans 2026 Nat\'l Avg' },
  DRYWALL:         { low: 2,  high: 6,  source: 'RSMeans 2026 Nat\'l Avg' },
  FLOORING:        { low: 3,  high: 8,  source: 'RSMeans 2026 Nat\'l Avg' },
  KITCHEN:         { low: 4,  high: 12, source: 'RSMeans 2026 Nat\'l Avg' },
  BATHROOMS:       { low: 3,  high: 9,  source: 'RSMeans 2026 Nat\'l Avg' },
  INTERIOR_FINISH: { low: 3,  high: 9,  source: 'RSMeans 2026 Nat\'l Avg' },
  LANDSCAPING:     { low: 0.5, high: 4, source: 'RSMeans 2026 Nat\'l Avg' },
  PERMITS_FEES:    { low: 0.5, high: 4, source: 'RSMeans 2026 Nat\'l Avg' },
  SOFT_COSTS:      { low: 3,  high: 12, source: 'RSMeans 2026 Nat\'l Avg' },
  CONTINGENCY:     { low: 5,  high: 15, source: 'Industry standard (5–15%)' },
};

/**
 * Categories required to appear (amount > 0) on a budget, by loan type.
 * Absence produces a MISSING finding and zero contribution to the score.
 */
const REQUIRED_CATEGORIES_BY_TYPE: Readonly<Record<ConstructionLoanType, BudgetCategory[]>> = {
  GROUND_UP:   ['FOUNDATION', 'FRAMING', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING', 'INSULATION', 'CONTINGENCY'],
  FIX_FLIP:    ['ELECTRICAL', 'PLUMBING', 'FLOORING', 'INTERIOR_FINISH', 'CONTINGENCY'],
  REHAB:       ['ELECTRICAL', 'PLUMBING', 'CONTINGENCY'],
  MULTIFAMILY: ['FOUNDATION', 'FRAMING', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING', 'INSULATION', 'CONTINGENCY'],
  COMMERCIAL:  ['FOUNDATION', 'FRAMING', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'CONTINGENCY'],
};

/**
 * P50 construction timeline estimate in days per loan type.
 * Used to assess timeline realism: requested duration vs. AI-model estimate.
 */
const ESTIMATED_DAYS_P50: Readonly<Record<ConstructionLoanType, number>> = {
  GROUND_UP:   330,
  FIX_FLIP:    120,
  REHAB:       120,
  MULTIFAMILY: 450,
  COMMERCIAL:  420,
};

// ─── Score weights ────────────────────────────────────────────────────────────

/**
 * Contribution weights when rolling up the overall feasibility score (0–100).
 * Sum must equal 1.0.
 */
const SCORE_WEIGHTS = {
  lineItems:   0.55,  // budget benchmark analysis
  arvCoverage: 0.25,  // ARV/LTV check
  timeline:    0.20,  // timeline realism
} as const;

// ─── Line-item score mapping ──────────────────────────────────────────────────

const FINDING_SCORE: Record<FeasibilityReport['lineItemFindings'][0]['finding'], number> = {
  OK:           100,
  OVER_FUNDED:  75,   // possible GC padding, but not as dangerous as under-funding
  UNDER_FUNDED: 35,   // high change-order probability
  SUSPICIOUS:   25,   // extreme outlier
  MISSING:      0,    // required category absent
};

// ─── ConstructionFeasibilityService ──────────────────────────────────────────

export class ConstructionFeasibilityService {
  private readonly logger = new Logger('ConstructionFeasibilityService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── reportDocId ─────────────────────────────────────────────────────────────

  /**
   * Deterministic Cosmos document ID for a loan's feasibility report.
   * One report per loan (overwritten on re-run, preserving human overrides).
   */
  private reportDocId(loanId: string): string {
    return `feasibility-${loanId}`;
  }

  // ── runFeasibilityAnalysis ───────────────────────────────────────────────────

  /**
   * Generates (or refreshes) a FeasibilityReport for the given loan and budget version.
   *
   * Steps:
   *   1. Load loan + config concurrently
   *   2. Load the specific budget version
   *   3. Analyse each line item against market benchmarks
   *   4. Evaluate tenant custom FeasibilityRules
   *   5. Check ARV/LTV coverage ratio
   *   6. Assess timeline realism
   *   7. Run contractor check (if a GC is assigned)
   *   8. Compute overall score + verdict
   *   9. Preserve any existing human override verdict
   *  10. Save and return the report
   *
   * @throws when loan, budget, or config cannot be found for the tenant
   */
  async runFeasibilityAnalysis(
    loanId: string,
    budgetId: string,
    tenantId: string
  ): Promise<FeasibilityReport> {
    const [loan, config] = await Promise.all([
      this.getLoan(loanId, tenantId),
      this.configService.getConfig(tenantId),
    ]);

    const budget = await this.getBudget(budgetId, tenantId);

    // Derive total hard-cost budget (exclude INTEREST_RESERVE and LAND_ACQUISITION
    // because many benchmarks are pct of the construction cost stack only)
    const hardCostTotal = budget.lineItems.reduce((sum, item) => {
      if (item.category === 'INTEREST_RESERVE' || item.category === 'LAND_ACQUISITION') {
        return sum;
      }
      return sum + item.revisedAmount;
    }, 0);

    // ── Step 3: Analyse line items ──────────────────────────────────────────
    const lineItemFindings = this.evaluateLineItems(
      budget,
      hardCostTotal,
      loan.loanType
    );

    // ── Step 4: Evaluate custom rules ──────────────────────────────────────
    const customRuleResults = this.evaluateCustomRules(
      config.feasibilityCustomRules,
      budget,
      hardCostTotal,
      loan.loanType
    );

    // ── Step 5: ARV coverage ─────────────────────────────────────────────────
    const { loanToArvRatio, loanToArvVerdict, loanToArvMessage } =
      this.evaluateArvCoverage(loan, config);

    // ── Step 6: Timeline realism ────────────────────────────────────────────
    const { requestedDays, estimatedDays, timelineFinding, timelineMessage } =
      this.evaluateTimeline(loan);

    // ── Step 7: Contractor feasibility (optional) ───────────────────────────
    const contractor = loan.generalContractorId
      ? await this.getContractor(loan.generalContractorId, tenantId)
      : null;

    const contractorFeasibility = contractor
      ? await this.runContractorFeasibilityCheck(contractor, loan, tenantId)
      : null;

    // ── Step 8: Compute overall score ───────────────────────────────────────
    const lineItemScore = computeLineItemScore(lineItemFindings);
    const arvScore = verdictToScore(loanToArvVerdict);
    const timelineScore = timelineFindingToScore(timelineFinding);

    let overallScore = Math.round(
      lineItemScore   * SCORE_WEIGHTS.lineItems +
      arvScore        * SCORE_WEIGHTS.arvCoverage +
      timelineScore   * SCORE_WEIGHTS.timeline
    );

    // Custom rules with FAIL severity reduce the composite score by 10 points each (capped)
    const failRules = customRuleResults.filter(r => r.result === 'FAIL');
    overallScore = Math.max(0, overallScore - failRules.length * 10);

    const overallVerdict = scoreToVerdict(overallScore, config.feasibilityMinScore);

    // ── Step 9: Preserve existing override verdict ──────────────────────────
    const existing = await this.cosmosService.getDocument<FeasibilityReport>(
      CONTAINER,
      this.reportDocId(loanId),
      tenantId
    );

    const now = new Date().toISOString();

    const report: FeasibilityReport = {
      id: this.reportDocId(loanId),
      constructionLoanId: loanId,
      budgetId,
      tenantId,
      generatedAt: now,
      modelVersion: MODEL_VERSION,
      overallScore,
      overallVerdict,
      lineItemFindings,
      customRuleResults,
      loanToArvRatio,
      loanToArvVerdict,
      loanToArvMessage,
      contractorFeasibility,
      estimatedDaysToComplete: estimatedDays,
      requestedDaysToComplete: requestedDays,
      timelineFinding,
      timelineMessage,
      // Carry over human override from any prior run (conditional spread preserves exactOptionalPropertyTypes)
      ...(existing?.reviewedBy      !== undefined && { reviewedBy:      existing.reviewedBy }),
      ...(existing?.reviewNotes     !== undefined && { reviewNotes:     existing.reviewNotes }),
      ...(existing?.overrideVerdict !== undefined && { overrideVerdict: existing.overrideVerdict }),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // ── Step 10: Persist ────────────────────────────────────────────────────
    await this.cosmosService.upsertDocument<FeasibilityReport>(CONTAINER, report);

    this.logger.info('ConstructionFeasibilityService: analysis complete', {
      loanId,
      tenantId,
      budgetId,
      overallScore,
      overallVerdict,
    });

    return report;
  }

  // ── runContractorFeasibilityCheck ───────────────────────────────────────────

  /**
   * Checks contractor suitability for the loan.
   * Used internally by runFeasibilityAnalysis and may be called standalone.
   */
  async runContractorFeasibilityCheck(
    contractor: ContractorProfile,
    loan: ConstructionLoan,
    tenantId: string
  ): Promise<ContractorFeasibilityResult> {
    const today = new Date().toISOString().slice(0, 10);

    const licenseValid = !!contractor.licenseExpiry && contractor.licenseExpiry.slice(0, 10) > today;
    const insuranceValid = !!contractor.insuranceCertExpiry &&
      contractor.insuranceCertExpiry.slice(0, 10) > today;

    // Bond sufficient when bondAmount >= loan amount (or no bond required — treat as sufficient)
    const bondSufficient = contractor.bondAmount === undefined
      ? true
      : contractor.bondAmount >= loan.loanAmount;

    // Active project count: ACTIVE or APPROVED loans where this GC is assigned
    const activePlatformProjects = await this.countActiveProjectsForContractor(
      contractor.id,
      tenantId
    );

    // Prior defaults: any IN_DEFAULT loans on this platform for this GC
    const hasPriorDefaultsOnPlatform = await this.contractorHasPriorDefaults(
      contractor.id,
      tenantId
    );

    // Determine verdict
    let verdict: ContractorFeasibilityResult['verdict'] = 'PASS';
    const issues: string[] = [];

    if (!licenseValid) {
      verdict = 'FAIL';
      issues.push(`License expired (${contractor.licenseExpiry?.slice(0, 10) ?? 'unknown'})`);
    }
    if (!insuranceValid) {
      if (verdict !== 'FAIL') verdict = 'WARN';
      issues.push(`Insurance cert expired (${contractor.insuranceCertExpiry.slice(0, 10)})`);
    }
    if (!bondSufficient) {
      if (verdict !== 'FAIL') verdict = 'WARN';
      issues.push(
        `Bond ($${(contractor.bondAmount ?? 0).toLocaleString()}) less than loan amount ($${loan.loanAmount.toLocaleString()})`
      );
    }
    if (contractor.riskTier === 'DISQUALIFIED') {
      verdict = 'FAIL';
      issues.push('Contractor is DISQUALIFIED');
    } else if (contractor.riskTier === 'WATCH' || contractor.riskTier === 'CONDITIONAL') {
      if (verdict !== 'FAIL') verdict = 'WARN';
      issues.push(`Risk tier: ${contractor.riskTier}`);
    }
    if (activePlatformProjects >= 5) {
      if (verdict !== 'FAIL') verdict = 'WARN';
      issues.push(`${activePlatformProjects} active platform projects — capacity concern`);
    }
    if (hasPriorDefaultsOnPlatform) {
      if (verdict !== 'FAIL') verdict = 'WARN';
      issues.push('Prior loan default(s) on this platform');
    }

    const message = issues.length === 0
      ? `${contractor.name} meets all suitability requirements for this loan.`
      : `${contractor.name}: ${issues.join('; ')}.`;

    return {
      contractorId:              contractor.id,
      contractorName:            contractor.name,
      verdict,
      licenseValid,
      insuranceValid,
      bondSufficient,
      activePlatformProjects,
      hasPriorDefaultsOnPlatform,
      message,
    };
  }

  // ── getFeasibilityReport ───────────────────────────────────────────────────

  /**
   * Retrieves the stored feasibility report for a loan.
   *
   * @throws if no report has been generated for this loan
   */
  async getFeasibilityReport(loanId: string, tenantId: string): Promise<FeasibilityReport> {
    const report = await this.cosmosService.getDocument<FeasibilityReport>(
      CONTAINER,
      this.reportDocId(loanId),
      tenantId
    );
    if (!report) {
      throw new Error(
        `ConstructionFeasibilityService: no feasibility report found for loan "${loanId}" ` +
        `(tenant "${tenantId}"). Run the analysis first.`
      );
    }
    return report;
  }

  // ── overrideFeasibilityVerdict ─────────────────────────────────────────────

  /**
   * Applies a human override verdict on an existing feasibility report.
   * The original AI overallVerdict is preserved; overrideVerdict takes precedence in the gate check.
   *
   * @throws if review notes are absent or an existing report is not found
   */
  async overrideFeasibilityVerdict(
    reportId: string,
    verdict: 'PASS' | 'WARN' | 'FAIL',
    notes: string,
    reviewerId: string,
    tenantId: string
  ): Promise<FeasibilityReport> {
    if (!notes || notes.trim().length === 0) {
      throw new Error(
        'ConstructionFeasibilityService.overrideFeasibilityVerdict: ' +
        'review notes are required when overriding an AI verdict'
      );
    }
    if (!reviewerId) {
      throw new Error(
        'ConstructionFeasibilityService.overrideFeasibilityVerdict: reviewerId is required'
      );
    }

    // reportId IS the document id (e.g. 'feasibility-{loanId}')
    const existing = await this.cosmosService.getDocument<FeasibilityReport>(
      CONTAINER,
      reportId,
      tenantId
    );
    if (!existing) {
      throw new Error(
        `ConstructionFeasibilityService.overrideFeasibilityVerdict: ` +
        `report "${reportId}" not found for tenant "${tenantId}"`
      );
    }

    const now = new Date().toISOString();
    const updated: FeasibilityReport = {
      ...existing,
      reviewedBy:      reviewerId,
      reviewNotes:     notes,
      overrideVerdict: verdict,
      updatedAt:       now,
    };

    await this.cosmosService.upsertDocument<FeasibilityReport>(CONTAINER, updated);

    this.logger.info('ConstructionFeasibilityService: verdict overridden', {
      reportId,
      tenantId,
      verdict,
      reviewerId,
    });

    return updated;
  }

  // ── isFeasibilityGateBlocking ──────────────────────────────────────────────

  /**
   * Returns true when:
   *   a. A feasibility report exists for this loan, AND
   *   b. `TenantConstructionConfig.feasibilityBlocksApproval` is enabled, AND
   *   c. The effective verdict (overrideVerdict if set, else overallVerdict) is 'FAIL'
   *
   * This is called by the draw eligibility check (DrawRequestService) before approving draws.
   * When feasibilityEnabled is false in config, always returns false.
   */
  async isFeasibilityGateBlocking(loanId: string, tenantId: string): Promise<boolean> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.feasibilityEnabled || !config.feasibilityBlocksApproval) {
      return false;
    }

    const report = await this.cosmosService.getDocument<FeasibilityReport>(
      CONTAINER,
      this.reportDocId(loanId),
      tenantId
    );
    if (!report) {
      // No report run yet — cannot block (analysis hasn't been performed)
      return false;
    }

    const effectiveVerdict = report.overrideVerdict ?? report.overallVerdict;
    return effectiveVerdict === 'FAIL';
  }

  // ── Line-item evaluation ──────────────────────────────────────────────────

  private evaluateLineItems(
    budget: ConstructionBudget,
    hardCostTotal: number,
    loanType: ConstructionLoanType
  ): FeasibilityReport['lineItemFindings'] {
    const required = new Set<BudgetCategory>(REQUIRED_CATEGORIES_BY_TYPE[loanType]);

    // Build a category → summed-amount map for the budget
    const categoryTotals = new Map<BudgetCategory, number>();
    for (const item of budget.lineItems) {
      categoryTotals.set(
        item.category,
        (categoryTotals.get(item.category) ?? 0) + item.revisedAmount
      );
    }

    const findings: FeasibilityReport['lineItemFindings'] = [];

    // Produce a finding per line item
    for (const item of budget.lineItems) {
      const benchmark = BENCHMARK_PCT[item.category];

      if (!benchmark) {
        // No benchmark data for this category — treat as OK
        findings.push({
          budgetLineItemId: item.id,
          category:         item.category,
          submittedAmount:  item.revisedAmount,
          benchmarkLow:     0,
          benchmarkHigh:    0,
          benchmarkSource:  'No benchmark available',
          finding:          'OK',
          confidence:       0.5,
          message:          `No benchmark data available for ${item.category}; marked OK by default.`,
        });
        continue;
      }

      const submittedPct = hardCostTotal > 0
        ? (item.revisedAmount / hardCostTotal) * 100
        : 0;

      const benchmarkLowAmt = (benchmark.low / 100) * hardCostTotal;
      const benchmarkHighAmt = (benchmark.high / 100) * hardCostTotal;

      let finding: FeasibilityReport['lineItemFindings'][0]['finding'] = 'OK';
      let confidence = 0.85;
      let message: string;

      if (item.revisedAmount === 0 && required.has(item.category)) {
        finding = 'MISSING';
        confidence = 0.95;
        message =
          `${item.category} is required for ${loanType} projects but has zero budget allocation.`;
      } else if (item.revisedAmount === 0) {
        // Optional category with zero — not a finding, skip
        finding = 'OK';
        message = `${item.category} is not budgeted (optional for this loan type).`;
      } else if (submittedPct > benchmark.high * 2) {
        finding = 'SUSPICIOUS';
        confidence = 0.70;
        message =
          `${item.category} at ${submittedPct.toFixed(1)}% of budget is more than 2× the ` +
          `expected high of ${benchmark.high}% — possible misclassification or data error. ` +
          `Benchmark: ${benchmark.low}–${benchmark.high}% (${benchmark.source}).`;
      } else if (submittedPct > benchmark.high) {
        finding = 'OVER_FUNDED';
        message =
          `${item.category} at ${submittedPct.toFixed(1)}% ($${item.revisedAmount.toLocaleString()}) ` +
          `exceeds benchmark high of ${benchmark.high}% ($${Math.round(benchmarkHighAmt).toLocaleString()}). ` +
          `Possible GC padding. Benchmark: ${benchmark.source}.`;
      } else if (submittedPct < benchmark.low) {
        finding = 'UNDER_FUNDED';
        confidence = 0.88;
        message =
          `${item.category} at ${submittedPct.toFixed(1)}% ($${item.revisedAmount.toLocaleString()}) ` +
          `is below benchmark low of ${benchmark.low}% ($${Math.round(benchmarkLowAmt).toLocaleString()}). ` +
          `High change-order probability. Benchmark: ${benchmark.source}.`;
      } else {
        message =
          `${item.category} at ${submittedPct.toFixed(1)}% ($${item.revisedAmount.toLocaleString()}) ` +
          `is within the ${benchmark.low}–${benchmark.high}% benchmark range. Source: ${benchmark.source}.`;
      }

      findings.push({
        budgetLineItemId: item.id,
        category:         item.category,
        submittedAmount:  item.revisedAmount,
        benchmarkLow:     benchmarkLowAmt,
        benchmarkHigh:    benchmarkHighAmt,
        benchmarkSource:  benchmark.source,
        finding,
        confidence,
        message,
      });
    }

    // Also synthesize MISSING findings for required categories not present in the budget at all
    for (const reqCat of required) {
      const isPresent = budget.lineItems.some(i => i.category === reqCat && i.revisedAmount > 0);
      if (!isPresent) {
        const alreadyFlagged = findings.some(
          f => f.category === reqCat && f.finding === 'MISSING'
        );
        if (!alreadyFlagged) {
          const benchmark = BENCHMARK_PCT[reqCat];
          findings.push({
            budgetLineItemId: `missing-${reqCat}`,
            category:         reqCat,
            submittedAmount:  0,
            benchmarkLow:     benchmark ? (benchmark.low / 100) * hardCostTotal : 0,
            benchmarkHigh:    benchmark ? (benchmark.high / 100) * hardCostTotal : 0,
            benchmarkSource:  benchmark?.source ?? 'N/A',
            finding:          'MISSING',
            confidence:       0.95,
            message:          `${reqCat} is required for ${loanType} projects but is absent from the budget.`,
          });
        }
      }
    }

    return findings;
  }

  // ── Custom rule evaluation ────────────────────────────────────────────────

  private evaluateCustomRules(
    rules: FeasibilityRule[],
    budget: ConstructionBudget,
    hardCostTotal: number,
    loanType: ConstructionLoanType
  ): FeasibilityReport['customRuleResults'] {
    return rules.map(rule => {
      // Only evaluate if the rule applies to this loan type (empty = all types)
      if (rule.loanTypes.length > 0 && !rule.loanTypes.includes(loanType)) {
        return { ruleId: rule.id, ruleName: rule.name, result: 'PASS' as const, message: `Rule skipped (does not apply to ${loanType}).` };
      }

      const categoryTotal = budget.lineItems
        .filter(i => i.category === rule.category || rule.category === 'OVERALL')
        .reduce((s, i) => s + i.revisedAmount, 0);

      const categoryPct = hardCostTotal > 0 ? (categoryTotal / hardCostTotal) * 100 : 0;
      const totalBudget = budget.totalRevisedBudget;

      let passed = true;

      switch (rule.ruleType) {
        case 'MIN_AMOUNT':
          passed = categoryTotal >= rule.value;
          break;
        case 'MAX_AMOUNT':
          passed = categoryTotal <= rule.value;
          break;
        case 'MIN_PCT_OF_TOTAL':
          passed = categoryPct >= rule.value;
          break;
        case 'MAX_PCT_OF_TOTAL':
          passed = categoryPct <= rule.value;
          break;
        case 'REQUIRED_IF_TYPE':
          passed = categoryTotal > 0;
          break;
        case 'CUSTOM_EXPRESSION':
          // Not evaluated — treat as PASS with informational message
          return {
            ruleId:   rule.id,
            ruleName: rule.name,
            result:   'PASS' as const,
            message:  `CUSTOM_EXPRESSION rules are not evaluated by this model version (${MODEL_VERSION}).`,
          };
      }

      if (passed) {
        return {
          ruleId:   rule.id,
          ruleName: rule.name,
          result:   'PASS' as const,
          message:  rule.message
            ? `PASS — ${rule.message}`
            : `Rule "${rule.name}" passed.`,
        };
      }

      // Rule failed
      const actualDisplay = ['MIN_AMOUNT', 'MAX_AMOUNT'].includes(rule.ruleType)
        ? `$${categoryTotal.toLocaleString()} actual vs $${rule.value.toLocaleString()} required`
        : `${categoryPct.toFixed(1)}% actual vs ${rule.value}% required (total budget $${totalBudget.toLocaleString()})`;

      return {
        ruleId:   rule.id,
        ruleName: rule.name,
        result:   rule.severity === 'FAIL' ? 'FAIL' as const : 'WARN' as const,
        message:  rule.message
          ? `${rule.severity}: ${rule.message} [${actualDisplay}]`
          : `Rule "${rule.name}" failed: ${actualDisplay}.`,
      };
    });
  }

  // ── ARV coverage evaluation ───────────────────────────────────────────────

  private evaluateArvCoverage(
    loan: ConstructionLoan,
    config: TenantConstructionConfig
  ): { loanToArvRatio: number | null; loanToArvVerdict: FeasibilityReport['loanToArvVerdict']; loanToArvMessage: string } {
    if (!loan.arvEstimate || loan.arvEstimate <= 0) {
      return {
        loanToArvRatio:    null,
        loanToArvVerdict: 'UNAVAILABLE',
        loanToArvMessage:  'No ARV estimate has been entered for this loan; coverage check skipped.',
      };
    }

    const ratio = loan.loanAmount / loan.arvEstimate;
    const threshold = config.lowArvCoverageThreshold;

    let verdict: FeasibilityReport['loanToArvVerdict'];
    let message: string;

    if (ratio <= threshold) {
      verdict = 'PASS';
      message =
        `Loan-to-ARV ratio ${(ratio * 100).toFixed(1)}% is within the ` +
        `${(threshold * 100).toFixed(0)}% threshold. ` +
        `(Loan: $${loan.loanAmount.toLocaleString()} / ARV: $${loan.arvEstimate.toLocaleString()})`;
    } else if (ratio <= threshold + 0.05) {
      verdict = 'WARN';
      message =
        `Loan-to-ARV ratio ${(ratio * 100).toFixed(1)}% slightly exceeds the ` +
        `${(threshold * 100).toFixed(0)}% threshold (within 5% above). ` +
        `(Loan: $${loan.loanAmount.toLocaleString()} / ARV: $${loan.arvEstimate.toLocaleString()})`;
    } else {
      verdict = 'FAIL';
      message =
        `Loan-to-ARV ratio ${(ratio * 100).toFixed(1)}% materially exceeds the ` +
        `${(threshold * 100).toFixed(0)}% threshold. Insufficient ARV coverage requires remediation. ` +
        `(Loan: $${loan.loanAmount.toLocaleString()} / ARV: $${loan.arvEstimate.toLocaleString()})`;
    }

    return { loanToArvRatio: parseFloat(ratio.toFixed(4)), loanToArvVerdict: verdict, loanToArvMessage: message };
  }

  // ── Timeline evaluation ──────────────────────────────────────────────────

  private evaluateTimeline(
    loan: ConstructionLoan
  ): { requestedDays: number; estimatedDays: number; timelineFinding: FeasibilityReport['timelineFinding']; timelineMessage: string } {
    const estimatedDays = ESTIMATED_DAYS_P50[loan.loanType];

    // Requested duration: days from constructionStartDate (or today) to expectedCompletionDate
    const startDate = loan.constructionStartDate ?? new Date().toISOString().slice(0, 10);
    const requestedDays = Math.max(
      1,
      daysBetween(startDate.slice(0, 10), loan.expectedCompletionDate.slice(0, 10))
    );

    const ratio = requestedDays / estimatedDays;
    let timelineFinding: FeasibilityReport['timelineFinding'];
    let timelineMessage: string;

    if (ratio >= 0.8) {
      // Within 20% below or any amount above the estimate: realistic
      timelineFinding = 'REALISTIC';
      timelineMessage =
        `Requested duration of ${requestedDays} days is consistent with the ` +
        `AI model estimate of ${estimatedDays} days for a ${loan.loanType} project. `;
    } else if (ratio >= 0.6) {
      // 20–40% shorter than estimate: aggressive
      timelineFinding = 'AGGRESSIVE';
      timelineMessage =
        `Requested duration of ${requestedDays} days is ${Math.round((1 - ratio) * 100)}% shorter ` +
        `than the AI model estimate of ${estimatedDays} days for a ${loan.loanType} project. ` +
        `Schedule slip risk is elevated.`;
    } else {
      // > 40% shorter: unrealistic
      timelineFinding = 'UNREALISTIC';
      timelineMessage =
        `Requested duration of ${requestedDays} days is ${Math.round((1 - ratio) * 100)}% shorter ` +
        `than the AI model estimate of ${estimatedDays} days for a ${loan.loanType} project. ` +
        `This indicates a planning deficiency — review scope and subcontractor capacity.`;
    }

    return { requestedDays, estimatedDays, timelineFinding, timelineMessage };
  }

  // ── Contractor active project count ────────────────────────────────────────

  private async countActiveProjectsForContractor(
    contractorId: string,
    tenantId: string
  ): Promise<number> {
    const query = `
      SELECT VALUE COUNT(1) FROM c
      WHERE c.tenantId = @tenantId
        AND c.generalContractorId = @contractorId
        AND c.status IN (@s0, @s1)
        AND IS_DEFINED(c.loanAmount)
    `;
    const results = await this.cosmosService.queryDocuments<{ $1: number }>(
      CONTAINER,
      query,
      [
        { name: '@tenantId',      value: tenantId },
        { name: '@contractorId',  value: contractorId },
        { name: '@s0',            value: 'ACTIVE' },
        { name: '@s1',            value: 'APPROVED' },
      ]
    );
    return (results[0] as unknown as number) ?? 0;
  }

  private async contractorHasPriorDefaults(
    contractorId: string,
    tenantId: string
  ): Promise<boolean> {
    const query = `
      SELECT VALUE COUNT(1) FROM c
      WHERE c.tenantId = @tenantId
        AND c.generalContractorId = @contractorId
        AND c.status = @status
        AND IS_DEFINED(c.loanAmount)
    `;
    const results = await this.cosmosService.queryDocuments<unknown>(
      CONTAINER,
      query,
      [
        { name: '@tenantId',     value: tenantId },
        { name: '@contractorId', value: contractorId },
        { name: '@status',       value: 'IN_DEFAULT' },
      ]
    );
    return ((results[0] as unknown as number) ?? 0) > 0;
  }

  // ── Private data loaders ────────────────────────────────────────────────────

  private async getLoan(loanId: string, tenantId: string): Promise<ConstructionLoan> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionFeasibilityService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }
    return loan;
  }

  private async getBudget(budgetId: string, tenantId: string): Promise<ConstructionBudget> {
    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      CONTAINER,
      budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ConstructionFeasibilityService: budget "${budgetId}" not found for tenant "${tenantId}"`
      );
    }
    return budget;
  }

  private async getContractor(
    contractorId: string,
    tenantId: string
  ): Promise<ContractorProfile | null> {
    return this.cosmosService.getDocument<ContractorProfile>(
      CONTRACTORS_CONTAINER,
      contractorId,
      tenantId
    );
  }
}

// ─── Pure score helpers ───────────────────────────────────────────────────────

/**
 * Computes a 0–100 score from the lineItemFindings array.
 * Weights each finding by FINDING_SCORE.
 * Missing items are zero-weighted but penalise the average heavily.
 */
function computeLineItemScore(
  findings: FeasibilityReport['lineItemFindings']
): number {
  if (findings.length === 0) return 100;
  const total = findings.reduce((sum, f) => sum + FINDING_SCORE[f.finding], 0);
  return Math.round(total / findings.length);
}

/**
 * Converts an ARV verdict to a contribution score (0–100) for the composite.
 */
function verdictToScore(verdict: FeasibilityReport['loanToArvVerdict']): number {
  switch (verdict) {
    case 'PASS':        return 100;
    case 'WARN':        return 60;
    case 'FAIL':        return 10;
    case 'UNAVAILABLE': return 70; // penalise missing ARV but not as much as a FAIL
  }
}

/**
 * Converts a timeline finding to a score contribution.
 */
function timelineFindingToScore(finding: FeasibilityReport['timelineFinding']): number {
  switch (finding) {
    case 'REALISTIC':    return 100;
    case 'AGGRESSIVE':   return 65;
    case 'UNREALISTIC':  return 20;
  }
}

/**
 * Maps a composite score to an overall verdict using the tenant's minimum score threshold.
 */
function scoreToVerdict(
  score: number,
  minScore: number
): FeasibilityReport['overallVerdict'] {
  if (score >= minScore) return 'PASS';
  if (score >= minScore - 15) return 'WARN';
  return 'FAIL';
}

// ─── Date utility ─────────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
