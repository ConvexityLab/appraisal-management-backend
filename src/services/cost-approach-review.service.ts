/**
 * @file src/services/cost-approach-review.service.ts
 * @description Phase 2.8 — Cost Approach Review Service
 *
 * Validates cost approach methodology and evidence quality:
 *   - Cost source documentation (Marshall & Swift, etc.)
 *   - Depreciation method consistency with narrative
 *   - Effective age vs. actual age reasonableness
 *   - Land value evidence and method
 *   - Cost-per-SF reasonableness
 *   - Soft costs / entrepreneurial profit reasonableness
 *
 * References: USPAP SR 1-4, Fannie Mae B4-1.5, Marshall & Swift
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface CostApproachData {
  estimatedLandValue: number;
  landValueSource?: string;
  landValueMethod?: string;
  replacementCostNew: number;
  costFactorSource?: string;
  grossLivingArea?: number;
  softCosts?: number;
  entrepreneurialProfit?: number;
  siteImprovementsCost?: number;
  depreciationAmount: number;
  depreciationType?: string;
  effectiveAge?: number;
  economicLife?: number;
  physicalDepreciationCurable?: number;
  physicalDepreciationIncurable?: number;
  functionalObsolescence?: number;
  externalObsolescence?: number;
  depreciatedCostOfImprovements: number;
  indicatedValueByCostApproach: number;
}

export interface PropertyData {
  actualAge: number;
  condition: string;
  quality: string;
  yearBuilt: number;
}

export interface CostNarrative {
  depreciationCommentary?: string;
  costApproachComments?: string;
}

export interface CostApproachReviewInput {
  costApproach?: CostApproachData;
  property: PropertyData;
  narrative?: CostNarrative;
}

export interface CostReviewResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface CostReviewCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface CostReviewReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: CostReviewCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type CostReviewEvaluator = (input: CostApproachReviewInput) => CostReviewResult;

// ── Constants ────────────────────────────────────────────────────────

const COST_PER_SF_LOW = 50;
const COST_PER_SF_HIGH = 500;
const MAX_ENTREPRENEURIAL_PROFIT_PCT = 0.25;
const EFFECTIVE_AGE_RATIO_HIGH = 2.0;

// ── Evaluators ───────────────────────────────────────────────────────

export function checkCostSourceDocumentation(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach) {
    return { passed: true, message: 'No cost approach data — skipping.', severity: 'high' };
  }

  const issues: string[] = [];

  if (!input.costApproach.costFactorSource) {
    issues.push('Cost factor source not documented (e.g., Marshall & Swift, CoreLogic)');
  }
  if (!input.costApproach.landValueSource) {
    issues.push('Land value source not documented');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Cost source documentation missing: ${issues.join('; ')}. Per Fannie Mae B4-1.5, all cost data sources must be identified.`,
      severity: 'high',
      details: { issues },
    };
  }

  return { passed: true, message: 'Cost factor and land value sources are documented.', severity: 'high' };
}

export function checkDepreciationMethodConsistency(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach) {
    return { passed: true, message: 'No cost approach data — skipping.', severity: 'high' };
  }

  const ca = input.costApproach;
  const issues: string[] = [];

  if (!ca.depreciationType) {
    issues.push('Depreciation method not specified (age-life, market extraction, or breakdown)');
  }

  if (ca.depreciationType?.toLowerCase().includes('age-life')) {
    if (!ca.economicLife || ca.economicLife <= 0) {
      issues.push('Age-life method requires economic life estimate');
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Depreciation method issues: ${issues.join('; ')}. Per USPAP SR 1-4, depreciation methodology must be identified and supported.`,
      severity: 'high',
      details: { issues, depreciationType: ca.depreciationType },
    };
  }

  return { passed: true, message: 'Depreciation method is documented and consistent.', severity: 'high' };
}

export function checkEffectiveAgeConsistency(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach || input.costApproach.effectiveAge === undefined) {
    return { passed: true, message: 'No effective age data — skipping.', severity: 'medium' };
  }

  const effectiveAge = input.costApproach.effectiveAge;
  const actualAge = input.property.actualAge;
  const issues: string[] = [];

  if (effectiveAge === 0 && actualAge > 5) {
    issues.push(`Effective age is 0 but actual age is ${actualAge} — requires strong renovation evidence`);
  }

  if (actualAge > 0 && effectiveAge / actualAge > EFFECTIVE_AGE_RATIO_HIGH) {
    issues.push(`Effective age (${effectiveAge}) exceeds ${EFFECTIVE_AGE_RATIO_HIGH}x actual age (${actualAge})`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Effective age concerns: ${issues.join('; ')}. Effective age must be supported by condition analysis and improvement history.`,
      severity: 'medium',
      details: { effectiveAge, actualAge, issues },
    };
  }

  return { passed: true, message: `Effective age (${effectiveAge}) is reasonable relative to actual age (${actualAge}).`, severity: 'medium' };
}

export function checkLandValueEvidence(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach) {
    return { passed: true, message: 'No cost approach data — skipping.', severity: 'high' };
  }

  const ca = input.costApproach;
  const issues: string[] = [];

  if (ca.estimatedLandValue <= 0) {
    return {
      passed: false,
      message: `Estimated land value is ${ca.estimatedLandValue} — land must have positive value for improved property.`,
      severity: 'critical',
      details: { estimatedLandValue: ca.estimatedLandValue },
    };
  }

  if (!ca.landValueMethod) {
    issues.push('Land value derivation method not specified (sales comparison, allocation, or abstraction)');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Land value evidence issues: ${issues.join('; ')}. Per Fannie Mae B4-1.5, land value must be supported by market evidence.`,
      severity: 'high',
      details: { issues },
    };
  }

  return { passed: true, message: 'Land value evidence is documented.', severity: 'high' };
}

export function checkCostFactorReasonableness(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach || !input.costApproach.grossLivingArea || input.costApproach.grossLivingArea <= 0) {
    return { passed: true, message: 'No GLA for cost-per-SF check — skipping.', severity: 'high' };
  }

  const costPerSf = input.costApproach.replacementCostNew / input.costApproach.grossLivingArea;

  if (costPerSf < COST_PER_SF_LOW) {
    return {
      passed: false,
      message: `Replacement cost is $${costPerSf.toFixed(0)}/SF — below $${COST_PER_SF_LOW}/SF threshold. Verify cost source and quality rating.`,
      severity: 'high',
      details: { costPerSf: Math.round(costPerSf), threshold: { low: COST_PER_SF_LOW, high: COST_PER_SF_HIGH } },
    };
  }

  if (costPerSf > COST_PER_SF_HIGH) {
    return {
      passed: false,
      message: `Replacement cost is $${costPerSf.toFixed(0)}/SF — above $${COST_PER_SF_HIGH}/SF threshold. Verify cost source and quality rating.`,
      severity: 'high',
      details: { costPerSf: Math.round(costPerSf), threshold: { low: COST_PER_SF_LOW, high: COST_PER_SF_HIGH } },
    };
  }

  return { passed: true, message: `Cost per SF ($${costPerSf.toFixed(0)}) is within reasonable range.`, severity: 'high' };
}

export function checkSoftCostsReasonableness(input: CostApproachReviewInput): CostReviewResult {
  if (!input.costApproach) {
    return { passed: true, message: 'No cost approach data — skipping.', severity: 'medium' };
  }

  const ca = input.costApproach;
  const issues: string[] = [];

  if (ca.entrepreneurialProfit && ca.replacementCostNew > 0) {
    const profitPct = ca.entrepreneurialProfit / ca.replacementCostNew;
    if (profitPct > MAX_ENTREPRENEURIAL_PROFIT_PCT) {
      issues.push(`Entrepreneurial profit is ${(profitPct * 100).toFixed(1)}% of replacement cost (typical max: ${MAX_ENTREPRENEURIAL_PROFIT_PCT * 100}%)`);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Soft cost concerns: ${issues.join('; ')}.`,
      severity: 'medium',
      details: { issues },
    };
  }

  return { passed: true, message: 'Soft costs and entrepreneurial profit are within reasonable ranges.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const COST_REVIEW_EVALUATORS: Record<string, CostReviewEvaluator> = {
  checkCostSourceDocumentation,
  checkDepreciationMethodConsistency,
  checkEffectiveAgeConsistency,
  checkLandValueEvidence,
  checkCostFactorReasonableness,
  checkSoftCostsReasonableness,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class CostApproachReviewService {
  performReview(orderId: string, input: CostApproachReviewInput): CostReviewReport {
    const checks: CostReviewCheck[] = [];

    for (const [name, evaluator] of Object.entries(COST_REVIEW_EVALUATORS)) {
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
