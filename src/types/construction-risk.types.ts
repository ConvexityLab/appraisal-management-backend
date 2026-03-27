/**
 * Construction Finance Module — Risk Flag Types
 *
 * Risk flags are auto-computed by the ConstructionRiskService on each draw submission,
 * inspection, and via a scheduled daily evaluation of all ACTIVE loans.
 *
 * Used by:
 *   - ConstructionLoan (activeRiskFlags array)
 *   - ConstructionStatusReport
 *   - Portfolio dashboard
 *   - CPP trigger evaluation
 */

// ─── Risk Flag Codes ──────────────────────────────────────────────────────────

/**
 * All eighteen AI-computed risk flag codes.
 * Each flag code maps to a specific evaluation rule in construction-risk.service.ts.
 * ALL thresholds that trigger these flags are read from TenantConstructionConfig — not hardcoded.
 */
export type ConstructionRiskFlagCode =
  | 'STALLED_PROJECT'               // No disbursed draw in stalledProjectDays days on an ACTIVE loan
  | 'OVER_BUDGET'                   // Actuals + pending COs > totalRevisedBudget × (1 + overBudgetThresholdPct/100)
  | 'SCHEDULE_SLIP'                 // AI completion P50 forecast exceeds expectedCompletionDate by scheduleSlipDays days
  | 'INSPECTION_CONCERN'            // Inspector submitted report with non-empty concerns array
  | 'INSPECTION_PHOTO_ANOMALY'      // AI detected EXIF date/location inconsistency in inspection photos
  | 'LIEN_WAIVER_MISSING'           // Draw is in DISBURSED state but lienWaiverStatus is still PENDING
  | 'CONTRACTOR_LICENSE_EXPIRING'   // GC license expires within contractorLicenseExpiryWarningDays days
  | 'CONTRACTOR_DISQUALIFIED'       // GC riskTier is DISQUALIFIED or license is past expiry
  | 'CONTRACTOR_CAPACITY_RISK'      // GC has too many concurrent ACTIVE projects on the platform
  | 'LOW_ARV_COVERAGE'              // loanAmount / arvEstimate exceeds lowArvCoverageThreshold
  | 'HIGH_RETAINAGE_BACKLOG'        // Large unreleased retainageHeld approaching loan maturity
  | 'TITLE_HOLD'                    // Title search returned an exception that has not been resolved
  | 'INTEREST_RESERVE_DEPLETING'    // Projected interest reserve depletion within interestReserveWarningDays days
  | 'MATURITY_APPROACHING'          // AI P75 completion forecast exceeds maturityDate − maturityWarningDays
  | 'DRAW_ANOMALY'                  // AI draw anomaly detector triggered on a submitted draw
  | 'CONTINGENCY_NEARLY_EXHAUSTED'  // contingencyUsed / contingencyAmount > 0.75
  | 'CHANGE_ORDER_VELOCITY'         // Multiple change orders submitted in a short window (scope-creep signal)
  | 'CPP_TRIGGER';                  // Construction Protection Program threshold met — escalation required

// ─── Risk Flag ────────────────────────────────────────────────────────────────

/**
 * A single active or resolved risk condition on a construction loan.
 * Risk flags are embedded in ConstructionLoan.activeRiskFlags and
 * ConstructionStatusReport.activeRiskFlags.
 */
export interface ConstructionRiskFlag {
  code: ConstructionRiskFlagCode;

  /**
   * Severity tier:
   * INFO     — informational; no immediate action required
   * WARNING  — requires awareness and monitoring
   * CRITICAL — requires immediate lender action; may trigger CPP evaluation
   */
  severity: 'INFO' | 'WARNING' | 'CRITICAL';

  /**
   * Human-readable description of the specific condition that triggered this flag.
   * Should include the actual values that exceeded the threshold.
   */
  message: string;

  /** ISO timestamp when this flag was first detected. */
  detectedAt: string;

  /**
   * ISO timestamp when this flag was resolved (condition no longer met).
   * Null while the flag is still active.
   */
  resolvedAt?: string;
}
