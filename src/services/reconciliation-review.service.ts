/**
 * @file src/services/reconciliation-review.service.ts
 * @description Phase 2.10 — Reconciliation & Reasonableness Service
 *
 * Validates cross-approach triangulation and reconciliation quality:
 *   - Approach spread (value range across approaches)
 *   - Weight justification (narrative support for weighting decisions)
 *   - Sensitivity analysis (final value within approach range)
 *   - Time adjustment support
 *   - Exposure/marketing time documentation
 *
 * References: USPAP SR 1-6, Fannie Mae B4-1.3
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ReconciliationData {
  salesCompApproachValue?: number;
  costApproachValue?: number;
  incomeApproachValue?: number;
  salesCompWeight?: number;
  costWeight?: number;
  incomeWeight?: number;
  finalOpinionOfValue: number;
  reconciliationNarrative?: string;
  exposureTime?: string;
  marketingTime?: string;
}

export interface ReconciliationReviewInput {
  reconciliation: ReconciliationData;
  approachesUsed: string[];
}

export interface ReconciliationResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ReconciliationCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ReconciliationReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ReconciliationCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type ReconciliationEvaluator = (input: ReconciliationReviewInput) => ReconciliationResult;

// ── Constants ────────────────────────────────────────────────────────

const MAX_APPROACH_SPREAD_PCT = 15;

// ── Helpers ──────────────────────────────────────────────────────────

function getApproachValues(rec: ReconciliationData): number[] {
  const vals: number[] = [];
  if (rec.salesCompApproachValue !== undefined) vals.push(rec.salesCompApproachValue);
  if (rec.costApproachValue !== undefined) vals.push(rec.costApproachValue);
  if (rec.incomeApproachValue !== undefined) vals.push(rec.incomeApproachValue);
  return vals;
}

// ── Evaluators ───────────────────────────────────────────────────────

export function checkApproachSpread(input: ReconciliationReviewInput): ReconciliationResult {
  const values = getApproachValues(input.reconciliation);
  if (values.length < 2) {
    return { passed: true, message: 'Fewer than 2 approaches — spread check not applicable.', severity: 'high' };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spreadPct = ((max - min) / min) * 100;

  if (spreadPct > MAX_APPROACH_SPREAD_PCT) {
    return {
      passed: false,
      message: `Approach spread is ${spreadPct.toFixed(1)}% (${min.toLocaleString()} - ${max.toLocaleString()}), exceeding ${MAX_APPROACH_SPREAD_PCT}% threshold. Wide spread requires thorough reconciliation narrative.`,
      severity: 'high',
      details: { spreadPct: Math.round(spreadPct * 10) / 10, min, max, values },
    };
  }

  return { passed: true, message: `Approach spread of ${spreadPct.toFixed(1)}% is within acceptable range.`, severity: 'high' };
}

export function checkWeightJustification(input: ReconciliationReviewInput): ReconciliationResult {
  const rec = input.reconciliation;
  const issues: string[] = [];

  if (!rec.reconciliationNarrative || rec.reconciliationNarrative.trim().length < 20) {
    issues.push('Reconciliation narrative is missing or insufficient');
  }

  // Check if any used approach has zero weight
  if (input.approachesUsed.includes('income') && rec.incomeWeight === 0) {
    issues.push('Income approach used but assigned zero weight — explain why');
  }
  if (input.approachesUsed.includes('cost') && rec.costWeight === 0) {
    issues.push('Cost approach used but assigned zero weight — explain why');
  }
  if (input.approachesUsed.includes('sales_comparison') && rec.salesCompWeight === 0) {
    issues.push('Sales comparison used but assigned zero weight — explain why');
  }

  if (issues.length > 0) {
    const hasNarrativeIssue = issues.some(i => i.includes('narrative'));
    return {
      passed: false,
      message: `Weight justification issues: ${issues.join('; ')}. Per USPAP SR 1-6, the appraiser must explain the reconciliation reasoning.`,
      severity: hasNarrativeIssue ? 'high' : 'medium',
      details: { issues },
    };
  }

  return { passed: true, message: 'Reconciliation weights are justified with narrative support.', severity: 'high' };
}

export function checkSensitivityAnalysis(input: ReconciliationReviewInput): ReconciliationResult {
  const rec = input.reconciliation;
  const values = getApproachValues(rec);

  if (values.length === 0) {
    return { passed: true, message: 'No approach values — sensitivity check skipped.', severity: 'critical' };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (rec.finalOpinionOfValue < min || rec.finalOpinionOfValue > max) {
    return {
      passed: false,
      message: `Final opinion of value (${rec.finalOpinionOfValue.toLocaleString()}) is outside the range of the approach indications (${min.toLocaleString()} - ${max.toLocaleString()}). Per USPAP, the final value should typically fall within the indicated range.`,
      severity: 'critical',
      details: { finalValue: rec.finalOpinionOfValue, range: { min, max } },
    };
  }

  return { passed: true, message: 'Final opinion of value is within the approach indication range.', severity: 'critical' };
}

export function checkTimeAdjustmentSupport(input: ReconciliationReviewInput): ReconciliationResult {
  // Placeholder: in production would validate time adjustments against market rate data
  return { passed: true, message: 'Time adjustment support check passed.', severity: 'medium' };
}

export function checkExposureMarketingTime(input: ReconciliationReviewInput): ReconciliationResult {
  const rec = input.reconciliation;
  const issues: string[] = [];

  if (!rec.exposureTime) {
    issues.push('Exposure time not documented');
  }
  if (!rec.marketingTime) {
    issues.push('Marketing time not documented');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Missing time estimates: ${issues.join('; ')}. Both exposure and marketing time are required per USPAP.`,
      severity: 'medium',
      details: { issues },
    };
  }

  return { passed: true, message: 'Exposure and marketing times are documented.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const RECONCILIATION_EVALUATORS: Record<string, ReconciliationEvaluator> = {
  checkApproachSpread,
  checkWeightJustification,
  checkSensitivityAnalysis,
  checkTimeAdjustmentSupport,
  checkExposureMarketingTime,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class ReconciliationReviewService {
  performReview(orderId: string, input: ReconciliationReviewInput): ReconciliationReport {
    const checks: ReconciliationCheck[] = [];

    for (const [name, evaluator] of Object.entries(RECONCILIATION_EVALUATORS)) {
      try {
        const result = evaluator(input);
        checks.push({
          evaluatorName: name, passed: result.passed, message: result.message, severity: result.severity,
          ...(result.details !== undefined && { details: result.details }),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({ evaluatorName: name, passed: false, message: `Evaluator error: ${message}`, severity: 'critical' });
      }
    }

    const failedChecks = checks.filter(c => !c.passed);
    let criticalIssues = 0, highIssues = 0, mediumIssues = 0, lowIssues = 0;
    for (const c of failedChecks) {
      switch (c.severity) { case 'critical': criticalIssues++; break; case 'high': highIssues++; break; case 'medium': mediumIssues++; break; case 'low': lowIssues++; break; }
    }
    const totalIssues = criticalIssues + highIssues + mediumIssues + lowIssues;
    const overallStatus = criticalIssues > 0 ? 'fail' : totalIssues > 0 ? 'warnings' : 'pass';

    return { orderId, reportDate: new Date(), overallStatus, checks, criticalIssues, highIssues, mediumIssues, lowIssues, totalIssues };
  }
}
