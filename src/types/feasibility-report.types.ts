/**
 * Construction Finance Module — Feasibility Report Types (AI Pillar 1)
 *
 * The Feasibility Engine runs during the UNDERWRITING phase, producing a FeasibilityReport
 * attached to the loan.  It scores the budget against market benchmarks, evaluates
 * contractor suitability, checks ARV/LTV coverage, and applies tenant-defined custom rules.
 *
 * Lender-configurable as warning-only or a hard approval gate via TenantConstructionConfig.
 *
 * Stored in the `construction-loans` Cosmos container (partition key: /tenantId).
 */

import type { BudgetCategory } from './construction-loan.types.js';

// ─── Feasibility Report ───────────────────────────────────────────────────────

/**
 * Full feasibility assessment produced by the AI Feasibility Engine.
 * One report per loan per budget version — re-run when the budget is revised.
 */
export interface FeasibilityReport {
  id: string;
  constructionLoanId: string;

  /** ID of the ConstructionBudget version that was evaluated. */
  budgetId: string;

  tenantId: string;

  /** ISO timestamp when this report was generated. */
  generatedAt: string;

  /** Identifies the model version used for reproducibility and audit. */
  modelVersion: string;

  // ── Overall Score & Verdict ───────────────────────────────────────────────
  /**
   * Composite AI feasibility score from 0 to 100.
   * Scores ≥ TenantConstructionConfig.feasibilityMinScore produce a PASS verdict.
   * Custom rule FAILs can override a PASS score to FAIL or WARN regardless.
   */
  overallScore: number;

  /**
   * Aggregate verdict:
   * PASS — budget appears feasible; no blocking issues detected
   * WARN — concerns exist but not necessarily blocking (lender may proceed with awareness)
   * FAIL — significant issues require remediation before advancing the loan
   */
  overallVerdict: 'PASS' | 'WARN' | 'FAIL';

  // ── Line-Item Findings ────────────────────────────────────────────────────
  /**
   * Per-budget-line-item analysis comparing submitted amounts to market benchmarks.
   * At least one Finding entry is generated for each BudgetLineItem.
   */
  lineItemFindings: {
    /** Refers to BudgetLineItem.id in the evaluated budget. */
    budgetLineItemId: string;

    category: BudgetCategory;

    /** The amount in the submitted budget. */
    submittedAmount: number;

    /** Lower bound of the market benchmark range for this category in this market. */
    benchmarkLow: number;

    /** Upper bound of the market benchmark range for this category in this market. */
    benchmarkHigh: number;

    /**
     * Source of the benchmark data used.
     * e.g. "RSMeans 2026 Southeast Region", "Platform Portfolio Actuals 2024–2025"
     */
    benchmarkSource: string;

    /**
     * AI determination for this line item:
     * OK           — submitted amount is within benchmark range
     * UNDER_FUNDED — amount is below the benchmark low; high change-order probability
     * OVER_FUNDED  — amount is above the benchmark high; possible GC padding
     * MISSING      — required category for this loan type has no line item (amount = 0)
     * SUSPICIOUS   — statistical outlier requiring human review
     */
    finding: 'OK' | 'UNDER_FUNDED' | 'OVER_FUNDED' | 'MISSING' | 'SUSPICIOUS';

    /** AI model confidence in this finding, from 0 (low) to 1 (high). */
    confidence: number;

    /** Human-readable explanation of the finding with specific figures. */
    message: string;
  }[];

  // ── Custom Rule Results ───────────────────────────────────────────────────
  /**
   * Results of each FeasibilityRule from TenantConstructionConfig.feasibilityCustomRules.
   * An empty array means no custom rules are configured for this tenant.
   */
  customRuleResults: {
    ruleId: string;
    ruleName: string;
    result: 'PASS' | 'WARN' | 'FAIL';
    /** Message from the FeasibilityRule.message template, populated with actual values. */
    message: string;
  }[];

  // ── ARV / Loan Coverage ───────────────────────────────────────────────────
  /**
   * loanAmount / arvEstimate.  Compared to TenantConstructionConfig.lowArvCoverageThreshold.
   * Null when the loan has no arvEstimate yet.
   */
  loanToArvRatio: number | null;

  loanToArvVerdict: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';

  /** Explanation of the LTV coverage finding, including the actual ratio and threshold used. */
  loanToArvMessage: string;

  // ── Contractor Feasibility ────────────────────────────────────────────────
  /**
   * Feasibility check for the primary general contractor.
   * Null when no GC is assigned to the loan yet.
   */
  contractorFeasibility: ContractorFeasibilityResult | null;

  // ── Timeline Feasibility ──────────────────────────────────────────────────
  /** AI model's estimated days to complete based on loan type, scope, and market comparables. */
  estimatedDaysToComplete: number;

  /** Actual requested duration: days from constructionStartDate to expectedCompletionDate. */
  requestedDaysToComplete: number;

  /**
   * Timeline realism assessment:
   * REALISTIC    — requested duration is consistent with AI model estimate
   * AGGRESSIVE   — requested duration is shorter than model estimate; risk of schedule slip
   * UNREALISTIC  — requested duration is so short it indicates a likely planning deficiency
   */
  timelineFinding: 'REALISTIC' | 'AGGRESSIVE' | 'UNREALISTIC';

  timelineMessage: string;

  // ── Human Override ────────────────────────────────────────────────────────
  /** User ID of the reviewer who applied a manual override verdict. */
  reviewedBy?: string;
  reviewNotes?: string;

  /**
   * Human-overridden verdict.  When set, this takes precedence over overallVerdict.
   * The original AI overallVerdict is preserved for audit purposes.
   */
  overrideVerdict?: 'PASS' | 'WARN' | 'FAIL';

  createdAt: string;
  updatedAt: string;
}

// ─── Contractor Feasibility Result ────────────────────────────────────────────

/**
 * Embedded within FeasibilityReport; assesses the GC's suitability for this specific loan.
 */
export interface ContractorFeasibilityResult {
  contractorId: string;
  contractorName: string;

  verdict: 'PASS' | 'WARN' | 'FAIL';

  /** License is valid and not expiring within the contractorLicenseExpiryWarningDays threshold. */
  licenseValid: boolean;

  /** Insurance certificate is on file and not expired. */
  insuranceValid: boolean;

  /** Bond amount covers at least the loan draw exposure (if bond is required by tenant policy). */
  bondSufficient: boolean;

  /** Number of other ACTIVE construction loans on this platform where this GC is the primary GC. */
  activePlatformProjects: number;

  /** Whether this GC has any prior loans on this platform that ended in IN_DEFAULT or CPP. */
  hasPriorDefaultsOnPlatform: boolean;

  /** Human-readable summary of the contractor feasibility finding. */
  message: string;
}
