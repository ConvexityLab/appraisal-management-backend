/**
 * @file src/services/scope-lock-validation.service.ts
 * @description Phase 2.1 — Scope Lock-in Validation Service
 *
 * Validates that the delivered appraisal report conforms to the locked engagement scope.
 * Detects mismatches in report type, property rights, intended use/users, value types,
 * effective dates, property type, and unauthorized scope changes after lock-in.
 *
 * Follows the evaluator-registry pattern (see bias-screening.service.ts).
 *
 * References:
 *   - USPAP SR 1-2 (scope of work must be consistent with engagement)
 *   - Fannie Mae B4-1.1 (engagement letter requirements)
 *   - FHFA guidance on scope-of-work documentation
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

/** Scope fields captured at engagement lock-in */
export interface EngagementScopeFields {
  reportType?: string;
  productType?: string;
  propertyRightsAppraised?: string;
  intendedUse?: string;
  intendedUsers?: string[];
  valueTypes?: string[];
  effectiveDate?: string;
  propertyType?: string;
  useCase?: string;
  lockInTimestamp?: string;
}

/** Scope fields as stated in the delivered report */
export interface ReportScopeFields {
  reportType?: string;
  propertyRightsAppraised?: string;
  intendedUse?: string;
  intendedUsers?: string[];
  valueTypes?: string[];
  effectiveDate?: string;
  propertyType?: string;
}

/** Record of a scope change after lock-in */
export interface ScopeChange {
  field: string;
  originalValue: string;
  newValue: string;
  changeTimestamp: string;
  clientApproved: boolean;
  feeAdjusted: boolean;
  dueDateAdjusted: boolean;
}

/** Input to all scope-lock evaluators */
export interface ScopeLockInput {
  engagementScope: EngagementScopeFields;
  reportScope: ReportScopeFields;
  scopeChanges?: ScopeChange[];
}

/** Result of a single evaluator */
export interface ScopeLockResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

/** Individual check in the aggregate report */
export interface ScopeLockCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

/** Aggregate validation report */
export interface ScopeLockReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ScopeLockCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

/** Evaluator function signature */
export type ScopeLockEvaluator = (input: ScopeLockInput) => ScopeLockResult;


// ── Evaluators ───────────────────────────────────────────────────────

/**
 * Checks that the delivered report type matches the engagement-specified form.
 * A mismatch (e.g., 1004 vs 1073) is critical — it invalidates the entire scope.
 */
export function checkReportTypeAlignment(input: ScopeLockInput): ScopeLockResult {
  const engaged = input.engagementScope.reportType;
  const reported = input.reportScope.reportType;

  if (!engaged) {
    return {
      passed: true,
      message: 'No report type specified in engagement scope — skipping.',
      severity: 'medium',
    };
  }

  if (!reported) {
    return {
      passed: false,
      message: `Engagement requires report type "${engaged}" but no report type found in delivered report.`,
      severity: 'critical',
      details: { engaged, reported: undefined },
    };
  }

  if (engaged.toLowerCase() !== reported.toLowerCase()) {
    return {
      passed: false,
      message: `Report type mismatch: engagement specified "${engaged}" but report delivered as "${reported}". Per USPAP SR 1-2, the report type must match the agreed scope of work.`,
      severity: 'critical',
      details: { engaged, reported },
    };
  }

  return {
    passed: true,
    message: `Report type "${reported}" matches engagement scope.`,
    severity: 'critical',
  };
}

/**
 * Validates that property rights appraised (Fee Simple / Leasehold / Other)
 * match the engagement specification. A mismatch fundamentally changes the valuation basis.
 */
export function checkPropertyRightsAlignment(input: ScopeLockInput): ScopeLockResult {
  const engaged = input.engagementScope.propertyRightsAppraised;
  const reported = input.reportScope.propertyRightsAppraised;

  if (!engaged) {
    return {
      passed: true,
      message: 'No property rights specified in engagement scope — skipping.',
      severity: 'critical',
    };
  }

  if (!reported || engaged.toLowerCase() !== reported.toLowerCase()) {
    return {
      passed: false,
      message: `Property rights mismatch: engagement specified "${engaged}" but report states "${reported ?? 'not specified'}". Property rights directly affect valuation basis per USPAP SR 1-2(b).`,
      severity: 'critical',
      details: { engaged, reported: reported ?? null },
    };
  }

  return {
    passed: true,
    message: `Property rights "${reported}" match engagement scope.`,
    severity: 'critical',
  };
}

/**
 * Validates intended use and intended users against engagement terms.
 * - Intended use mismatch is critical (changes the entire valuation framework)
 * - Intended user mismatch is high (changes who may rely on the report)
 */
export function checkIntendedUseAlignment(input: ScopeLockInput): ScopeLockResult {
  const engagedUse = input.engagementScope.intendedUse;
  const reportedUse = input.reportScope.intendedUse;
  const engagedUsers = input.engagementScope.intendedUsers;
  const reportedUsers = input.reportScope.intendedUsers;

  // If engagement doesn't specify either, skip
  if (!engagedUse && (!engagedUsers || engagedUsers.length === 0)) {
    return {
      passed: true,
      message: 'No intended use/users specified in engagement scope — skipping.',
      severity: 'critical',
    };
  }

  // Check intended use first (critical)
  if (engagedUse && reportedUse) {
    if (engagedUse.toLowerCase() !== reportedUse.toLowerCase()) {
      return {
        passed: false,
        message: `Intended use mismatch: engagement specified "${engagedUse}" but report states "${reportedUse}". Per USPAP SR 1-2(a), the intended use must be identified and reported consistent with the engagement.`,
        severity: 'critical',
        details: { engagedUse, reportedUse },
      };
    }
  }

  // Check intended users (high)
  if (engagedUsers && engagedUsers.length > 0 && reportedUsers) {
    const engagedSet = new Set(engagedUsers.map(u => u.toLowerCase()));
    const reportedSet = new Set(reportedUsers.map(u => u.toLowerCase()));

    const missingFromReport = engagedUsers.filter(u => !reportedSet.has(u.toLowerCase()));
    const extraInReport = reportedUsers.filter(u => !engagedSet.has(u.toLowerCase()));

    if (missingFromReport.length > 0 || extraInReport.length > 0) {
      const issues: string[] = [];
      if (missingFromReport.length > 0) {
        issues.push(`missing from report: ${missingFromReport.join(', ')}`);
      }
      if (extraInReport.length > 0) {
        issues.push(`added in report but not in engagement: ${extraInReport.join(', ')}`);
      }
      return {
        passed: false,
        message: `Intended users mismatch: ${issues.join('; ')}. Per USPAP SR 1-2(a), intended users must match the engagement terms.`,
        severity: 'high',
        details: { engagedUsers, reportedUsers, missingFromReport, extraInReport },
      };
    }
  }

  return {
    passed: true,
    message: 'Intended use and users match engagement scope.',
    severity: 'critical',
  };
}

/**
 * Validates that value types (AS_IS, PROSPECTIVE_AS_COMPLETED, etc.)
 * match between engagement and report. Extra or missing value types are critical.
 */
export function checkValueTypeAlignment(input: ScopeLockInput): ScopeLockResult {
  const engaged = input.engagementScope.valueTypes;
  const reported = input.reportScope.valueTypes;

  if (!engaged || engaged.length === 0) {
    return {
      passed: true,
      message: 'No value types specified in engagement scope — skipping.',
      severity: 'critical',
    };
  }

  if (!reported || reported.length === 0) {
    return {
      passed: false,
      message: `Engagement requires value types [${engaged.join(', ')}] but no value types found in report.`,
      severity: 'critical',
      details: { engaged, reported: [] },
    };
  }

  const engagedSet = new Set(engaged.map(v => v.toUpperCase()));
  const reportedSet = new Set(reported.map(v => v.toUpperCase()));

  const missingFromReport = engaged.filter(v => !reportedSet.has(v.toUpperCase()));
  const extraInReport = reported.filter(v => !engagedSet.has(v.toUpperCase()));

  if (missingFromReport.length > 0 || extraInReport.length > 0) {
    const issues: string[] = [];
    if (missingFromReport.length > 0) {
      issues.push(`missing from report: ${missingFromReport.join(', ')}`);
    }
    if (extraInReport.length > 0) {
      issues.push(`extra in report: ${extraInReport.join(', ')}`);
    }
    return {
      passed: false,
      message: `Value type mismatch: ${issues.join('; ')}. Engagement specified [${engaged.join(', ')}], report contains [${reported.join(', ')}]. Per USPAP SR 1-2, the type of value must conform to the engagement.`,
      severity: 'critical',
      details: { engaged, reported, missingFromReport, extraInReport },
    };
  }

  return {
    passed: true,
    message: `Value types [${reported.join(', ')}] match engagement scope.`,
    severity: 'critical',
  };
}

/**
 * Validates the effective date of value matches the engagement-specified date.
 * Date mismatches can indicate the wrong valuation date was used.
 */
export function checkEffectiveDateAlignment(input: ScopeLockInput): ScopeLockResult {
  const engaged = input.engagementScope.effectiveDate;
  const reported = input.reportScope.effectiveDate;

  if (!engaged) {
    return {
      passed: true,
      message: 'No effective date specified in engagement scope — skipping.',
      severity: 'high',
    };
  }

  if (!reported) {
    return {
      passed: false,
      message: `Engagement requires effective date "${engaged}" but no effective date found in report.`,
      severity: 'high',
      details: { engaged, reported: null },
    };
  }

  // Normalize to date-only for comparison (strip time components)
  const engagedDate = engaged.substring(0, 10);
  const reportedDate = reported.substring(0, 10);

  if (engagedDate !== reportedDate) {
    return {
      passed: false,
      message: `Effective date mismatch: engagement specified "${engagedDate}" but report states "${reportedDate}". The effective date of value must align with the engagement terms.`,
      severity: 'high',
      details: { engaged: engagedDate, reported: reportedDate },
    };
  }

  return {
    passed: true,
    message: `Effective date "${reportedDate}" matches engagement scope.`,
    severity: 'high',
  };
}

/**
 * Validates property type consistency between engagement and report.
 * A mismatch may indicate the wrong property was appraised or the form was wrong.
 */
export function checkPropertyTypeConsistency(input: ScopeLockInput): ScopeLockResult {
  const engaged = input.engagementScope.propertyType;
  const reported = input.reportScope.propertyType;

  if (!engaged) {
    return {
      passed: true,
      message: 'No property type specified in engagement scope — skipping.',
      severity: 'high',
    };
  }

  if (!reported || engaged.toUpperCase() !== reported.toUpperCase()) {
    return {
      passed: false,
      message: `Property type mismatch: engagement specified "${engaged}" but report states "${reported ?? 'not specified'}". Verify the correct property was appraised and the appropriate report form was used.`,
      severity: 'high',
      details: { engaged, reported: reported ?? null },
    };
  }

  return {
    passed: true,
    message: `Property type "${reported}" matches engagement scope.`,
    severity: 'high',
  };
}

/**
 * Validates that any scope changes after lock-in have proper client approval
 * and appropriate fee/time adjustments. Per USPAP, scope changes require
 * mutual agreement between appraiser and client.
 *
 * Severity escalation:
 *   - No client approval → critical
 *   - Approved but no fee adjustment → high
 *   - Approved, fee adjusted, but no due date adjustment → medium
 */
export function checkScopeChangeApproval(input: ScopeLockInput): ScopeLockResult {
  const changes = input.scopeChanges;

  if (!changes || changes.length === 0) {
    return {
      passed: true,
      message: 'No scope changes detected after lock-in.',
      severity: 'critical',
    };
  }

  const unapproved = changes.filter(c => !c.clientApproved);
  if (unapproved.length > 0) {
    return {
      passed: false,
      message: `${unapproved.length} scope change(s) after lock-in lack client approval: [${unapproved.map(c => c.field).join(', ')}]. Per USPAP, scope changes require mutual agreement and written client approval.`,
      severity: 'critical',
      details: {
        unapprovedChanges: unapproved,
        totalChanges: changes.length,
      },
    };
  }

  const noFeeAdjust = changes.filter(c => !c.feeAdjusted);
  if (noFeeAdjust.length > 0) {
    return {
      passed: false,
      message: `${noFeeAdjust.length} approved scope change(s) have no fee adjustment: [${noFeeAdjust.map(c => c.field).join(', ')}]. Scope changes typically require fee reconsideration.`,
      severity: 'high',
      details: {
        noFeeAdjustChanges: noFeeAdjust,
        totalChanges: changes.length,
      },
    };
  }

  const noDueDateAdjust = changes.filter(c => !c.dueDateAdjusted);
  if (noDueDateAdjust.length > 0) {
    return {
      passed: false,
      message: `${noDueDateAdjust.length} approved scope change(s) have no due date adjustment: [${noDueDateAdjust.map(c => c.field).join(', ')}]. Scope changes may require due date extensions.`,
      severity: 'medium',
      details: {
        noDueDateAdjustChanges: noDueDateAdjust,
        totalChanges: changes.length,
      },
    };
  }

  return {
    passed: true,
    message: `All ${changes.length} scope change(s) have client approval with fee and time adjustments.`,
    severity: 'critical',
  };
}


// ── Evaluator Registry ───────────────────────────────────────────────

export const SCOPE_LOCK_EVALUATORS: Record<string, ScopeLockEvaluator> = {
  checkReportTypeAlignment,
  checkPropertyRightsAlignment,
  checkIntendedUseAlignment,
  checkValueTypeAlignment,
  checkEffectiveDateAlignment,
  checkPropertyTypeConsistency,
  checkScopeChangeApproval,
};


// ── Aggregate Service ────────────────────────────────────────────────

export class ScopeLockValidationService {
  performValidation(orderId: string, input: ScopeLockInput): ScopeLockReport {
    const checks: ScopeLockCheck[] = [];

    for (const [name, evaluator] of Object.entries(SCOPE_LOCK_EVALUATORS)) {
      try {
        const result = evaluator(input);
        checks.push({
          evaluatorName: name,
          passed: result.passed,
          message: result.message,
          severity: result.severity,
          ...(result.details !== undefined && { details: result.details }),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          evaluatorName: name,
          passed: false,
          message: `Evaluator threw an error: ${message}`,
          severity: 'critical',
        });
      }
    }

    const failedChecks = checks.filter(c => !c.passed);
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;

    for (const check of failedChecks) {
      switch (check.severity) {
        case 'critical': criticalIssues++; break;
        case 'high': highIssues++; break;
        case 'medium': mediumIssues++; break;
        case 'low': lowIssues++; break;
      }
    }

    const totalIssues = criticalIssues + highIssues + mediumIssues + lowIssues;
    let overallStatus: 'pass' | 'fail' | 'warnings' = 'pass';
    if (criticalIssues > 0) {
      overallStatus = 'fail';
    } else if (totalIssues > 0) {
      overallStatus = 'warnings';
    }

    return {
      orderId,
      reportDate: new Date(),
      overallStatus,
      checks,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      totalIssues,
    };
  }
}
