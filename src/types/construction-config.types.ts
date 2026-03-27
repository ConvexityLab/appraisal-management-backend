/**
 * Construction Finance Module — Tenant Configuration & Feasibility Rule Types
 *
 * TenantConstructionConfig drives ALL configurable behavior in the construction finance module.
 * ZERO hardcoded thresholds exist in service logic — every threshold and default is read from here.
 *
 * Stored in the `construction-loans` Cosmos container (partition key: /tenantId)
 * with a well-known document ID pattern: `config-{tenantId}`.
 */

import type { BudgetCategory, ConstructionLoanType } from './construction-loan.types.js';

// ─── Feasibility Rule ─────────────────────────────────────────────────────────

/**
 * A lender-defined rule evaluated by the Feasibility Engine (AI Pillar 1) on top of
 * the base AI scoring.  Rules are stored as `TenantConstructionConfig.feasibilityCustomRules`.
 *
 * Examples:
 *   - "HVAC must be ≥ 3% of total budget for ground-up"
 *   - "Contingency must be ≥ 8% for projects over $500K"
 *   - "SOFT_COSTS cannot exceed 15% of total budget"
 */
export interface FeasibilityRule {
  /** Stable identifier for this rule within the tenant's rule set. */
  id: string;

  /** Human-readable name shown to underwriters in the feasibility report. */
  name: string;

  /**
   * Which budget category this rule targets, or 'OVERALL' for rules that
   * operate on the total budget amount or overall feasibility score.
   */
  category: BudgetCategory | 'OVERALL';

  /**
   * Rule evaluation type:
   * MIN_AMOUNT           — line item amount must be ≥ value (in USD)
   * MAX_AMOUNT           — line item amount must be ≤ value (in USD)
   * MIN_PCT_OF_TOTAL     — line item must be ≥ value % of the total budget
   * MAX_PCT_OF_TOTAL     — line item must be ≤ value % of the total budget
   * REQUIRED_IF_TYPE     — category must be present (amount > 0) for the given loanTypes
   * CUSTOM_EXPRESSION    — reserved for future use; expression string in `customExpression`
   */
  ruleType:
    | 'MIN_AMOUNT'
    | 'MAX_AMOUNT'
    | 'MIN_PCT_OF_TOTAL'
    | 'MAX_PCT_OF_TOTAL'
    | 'REQUIRED_IF_TYPE'
    | 'CUSTOM_EXPRESSION';

  /**
   * Numeric threshold for the rule.
   * Interpretation depends on ruleType:
   *   - AMOUNT rules: USD value
   *   - PCT_OF_TOTAL rules: percentage (e.g. 8 for 8%)
   *   - REQUIRED_IF_TYPE: ignored (presence check only)
   */
  value: number;

  /** Loan types this rule applies to. Empty array means the rule applies to all types. */
  loanTypes: ConstructionLoanType[];

  /**
   * Result severity when the rule fails:
   * WARNING — adds a warning to the feasibility report but does not affect overallVerdict by itself
   * FAIL    — causes overallVerdict to be FAIL (if feasibilityBlocksApproval is true, this blocks the loan)
   */
  severity: 'WARNING' | 'FAIL';

  /** Message shown to reviewers when this rule fails. Should include the expected vs. actual values. */
  message: string;

  /** Optional: expression string for CUSTOM_EXPRESSION rules (evaluated server-side in a sandbox). */
  customExpression?: string;
}

// ─── Tenant Construction Config ───────────────────────────────────────────────

/**
 * Per-tenant configuration document for the entire Construction Finance module.
 *
 * IMPORTANT: Service layer MUST read ALL thresholds from this config — never hardcode values.
 * The defaults documented in JSDoc below represent what the service layer inserts when
 * creating a new config document; they are NOT hardcoded into service logic.
 *
 * Note on retainageReleaseRequiresHumanApproval:
 * This field is included in the config type for completeness in config documents, but the
 * service layer treats it as always-true by design.  A value of false in this field MUST be
 * ignored by the draw-request service and logged as a config anomaly.  Automated retainage
 * disbursement without human approval is a prohibited pattern in this platform.
 */
export interface TenantConstructionConfig {
  tenantId: string;

  // ── Draw Rules ────────────────────────────────────────────────────────────
  /**
   * Whether multiple draws may be in flight simultaneously for the same loan.
   * Default: false (only one draw may be in SUBMITTED / INSPECTION_ORDERED / UNDER_REVIEW /
   * APPROVED state at a time).
   */
  allowConcurrentDraws: boolean;

  /**
   * Maximum number of concurrent draws allowed when allowConcurrentDraws is true.
   * Default: 1 (i.e. concurrent draws are off by default — this value is only active
   * when allowConcurrentDraws = true).
   */
  maxConcurrentDraws: number;

  /**
   * Whether an accepted DrawInspectionReport is required before a draw can advance
   * to UNDER_REVIEW.
   * Default: true.
   */
  requireInspectionBeforeDraw: boolean;

  /**
   * Whether DESKTOP inspection type is permitted for draws on this tenant's loans.
   * Default: true.
   */
  allowDesktopInspection: boolean;

  /**
   * Number of days after a draw disbursement within which the lien waiver from that
   * draw may be outstanding before it blocks the next draw.
   * Default: 0 (lien waiver from prior draw must be RECEIVED before next draw is submitted).
   */
  lienWaiverGracePeriodDays: number;

  // ── Retainage ─────────────────────────────────────────────────────────────
  /**
   * Default retainage percentage withheld from each gross approved draw amount.
   * Individual loans may override this in ConstructionLoan.retainagePercent.
   * Default: 10 (10%).
   */
  defaultRetainagePercent: number;

  /**
   * Whether the system should automatically create a Retainage Release draw record
   * and fire a notification when the loan's percentComplete reaches
   * retainageReleaseThreshold.
   * Default: true.
   */
  retainageReleaseAutoTrigger: boolean;

  /**
   * percentComplete value (0–100) at which retainage auto-release is triggered.
   * Default: 95.
   */
  retainageReleaseThreshold: number;

  /**
   * See type-level JSDoc above.  Always treated as true by service layer.
   * Default: true (and must remain true — see note above).
   */
  retainageReleaseRequiresHumanApproval: boolean;

  // ──  Feasibility Engine ───────────────────────────────────────────────────
  /**
   * Whether the AI Feasibility Engine (Pillar 1) is active for this tenant.
   * Default: true.
   */
  feasibilityEnabled: boolean;

  /**
   * When true, a FeasibilityReport with overallVerdict = 'FAIL' (or any FAIL-severity
   * custom rule result) prevents the loan from advancing beyond UNDERWRITING until a
   * human reviewer overrides the verdict.
   * When false, the feasibility report is advisory only.
   * Default: false (warning-only).
   */
  feasibilityBlocksApproval: boolean;

  /**
   * Minimum AI feasibility score (0–100) required for overallVerdict to be PASS.
   * Default: 65.
   */
  feasibilityMinScore: number;

  /** Lender-defined custom feasibility rules evaluated on top of the base AI score. */
  feasibilityCustomRules: FeasibilityRule[];

  // ── Risk Monitoring Thresholds ────────────────────────────────────────────
  /**
   * Days without a disbursed draw on an ACTIVE loan before STALLED_PROJECT flag fires.
   * Default: 60.
   */
  stalledProjectDays: number;

  /**
   * Percentage over the totalRevisedBudget that triggers the OVER_BUDGET risk flag.
   * e.g. 5 means the flag fires when (totalDrawsApproved + pendingCO deltas) > budget × 1.05.
   * Default: 5.
   */
  overBudgetThresholdPct: number;

  /**
   * Number of days the AI completion forecast P50 date may surpass the
   * expectedCompletionDate before the SCHEDULE_SLIP risk flag fires.
   * Default: 30.
   */
  scheduleSlipDays: number;

  /**
   * Loan-to-ARV ratio threshold above which LOW_ARV_COVERAGE fires.
   * e.g. 0.90 means the flag fires when loanAmount / arvEstimate > 0.90.
   * Default: 0.90.
   */
  lowArvCoverageThreshold: number;

  /**
   * Days before contractor license expiry that CONTRACTOR_LICENSE_EXPIRING fires.
   * Default: 30.
   */
  contractorLicenseExpiryWarningDays: number;

  // ── AI Monitoring (Pillar 2) ──────────────────────────────────────────────
  /**
   * Master switch for all AI monitoring features (Pillar 2).
   * When false, aiDrawAnomalyDetection and aiCompletionForecastingEnabled are overridden.
   * Default: true.
   */
  aiMonitoringEnabled: boolean;

  /**
   * Whether AI draw anomaly detection runs on each draw submission.
   * Requires aiMonitoringEnabled = true.
   * Default: true.
   */
  aiDrawAnomalyDetection: boolean;

  /**
   * Whether the AI completion forecaster runs after each draw disbursement / inspection.
   * Requires aiMonitoringEnabled = true.
   * Default: true.
   */
  aiCompletionForecastingEnabled: boolean;

  // ── AI Servicing (Pillar 3) ───────────────────────────────────────────────
  /**
   * Master switch for all AI servicing features (Pillar 3).
   * Default: true.
   */
  aiServicingEnabled: boolean;

  /**
   * Days before projected interest reserve depletion that INTEREST_RESERVE_DEPLETING fires.
   * Requires aiServicingEnabled = true.
   * Default: 30.
   */
  interestReserveWarningDays: number;

  /**
   * Days before loan maturityDate that MATURITY_APPROACHING fires (when completion is uncertain).
   * Requires aiServicingEnabled = true.
   * Default: 60.
   */
  maturityWarningDays: number;

  /**
   * Whether the system auto-generates ConstructionStatusReport documents on a schedule.
   * Requires aiServicingEnabled = true.
   * Default: true.
   */
  autoGenerateStatusReports: boolean;

  /**
   * How frequently (in days) scheduled status reports are auto-generated per active loan.
   * Default: 30.
   */
  statusReportFrequencyDays: number;

  // ── Audit ─────────────────────────────────────────────────────────────────
  updatedAt: string;
  updatedBy: string;
}
