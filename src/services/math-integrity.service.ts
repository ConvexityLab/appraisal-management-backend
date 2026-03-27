/**
 * @file src/services/math-integrity.service.ts
 * @description Phase 2.11 — Math & Integrity Validation Service
 *
 * Validates arithmetic correctness across the appraisal report:
 *   - Sales Comparison grid: net/gross adjustment totals, adjusted sale prices
 *   - GLA consistency: sketch-reported vs. public record
 *   - Per-SF adjustment direction consistency
 *   - Cost Approach: depreciation breakdown, depreciated cost, indicated value
 *   - Income Approach: PGI, EGI, NOI, cap rate value
 *   - Reconciliation: weight sums, weighted average, approach spread
 *
 * Follows the evaluator-registry pattern (see bias-screening.service.ts).
 *
 * References:
 *   - USPAP SR 1-1(a) (credible assignment results require correct calculations)
 *   - Fannie Mae B4-1.3 (sales comparison grid requirements)
 *   - FNMA 1004 grid fields
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SubjectInput {
  grossLivingArea: number;
  publicRecordGla?: number;
}

export interface CompAdjustments {
  // Transactional
  saleOrFinancingConcessions: number;
  dateOfSaleTime: number;
  // Location
  locationAdj: number;
  leaseholdFeeSimple: number;
  siteAdj: number;
  viewAdj: number;
  // Physical
  designAndAppeal: number;
  qualityOfConstruction: number;
  actualAge: number;
  conditionAdj: number;
  aboveGradeRoomCount: number;
  aboveGradeBedroom: number;
  aboveGradeBathroom: number;
  grossLivingAreaAdj: number;
  basementAndFinishedRooms: number;
  functionalUtility: number;
  heatingCooling: number;
  energyEfficiency: number;
  garageCarport: number;
  porchPatioPool: number;
  // Other
  otherAdj1: number;
  otherAdj2: number;
  otherAdj3: number;
  // Computed
  netAdjustmentTotal: number;
  grossAdjustmentTotal: number;
  adjustedSalePrice: number;
}

export interface CompInput {
  compId: string;
  salePrice: number;
  grossLivingArea: number;
  adjustments: CompAdjustments;
}

export interface CostApproachInput {
  estimatedLandValue: number;
  replacementCostNew: number;
  softCosts?: number;
  entrepreneurialProfit?: number;
  siteImprovementsCost?: number;
  physicalDepreciationCurable?: number;
  physicalDepreciationIncurable?: number;
  functionalObsolescence?: number;
  externalObsolescence?: number;
  depreciationAmount: number;
  depreciatedCostOfImprovements: number;
  indicatedValueByCostApproach: number;
}

export interface IncomeApproachInput {
  estimatedMonthlyMarketRent?: number;
  grossRentMultiplier?: number;
  potentialGrossIncome?: number;
  vacancyRate?: number;
  effectiveGrossIncome?: number;
  operatingExpenses?: number;
  replacementReserves?: number;
  netOperatingIncome?: number;
  capRate?: number;
  indicatedValueByIncomeApproach?: number;
}

export interface ReconciliationInput {
  salesCompApproachValue?: number;
  costApproachValue?: number;
  incomeApproachValue?: number;
  salesCompWeight?: number;
  costWeight?: number;
  incomeWeight?: number;
  finalOpinionOfValue: number;
}

export interface MathIntegrityInput {
  subject: SubjectInput;
  comps: CompInput[];
  costApproach?: CostApproachInput;
  incomeApproach?: IncomeApproachInput;
  reconciliation?: ReconciliationInput;
}

export interface MathIntegrityResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface MathIntegrityCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface MathIntegrityReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: MathIntegrityCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type MathIntegrityEvaluator = (input: MathIntegrityInput) => MathIntegrityResult;

// ── Constants ────────────────────────────────────────────────────────

/** Rounding tolerance for arithmetic checks ($) */
const ROUNDING_TOLERANCE = 1;

/** GLA variance threshold (%) to flag sketch vs public record */
const GLA_VARIANCE_THRESHOLD_PCT = 10;

/** GLA difference (sqft) below which zero-adjustment is acceptable */
const GLA_ZERO_ADJ_TOLERANCE_SQFT = 100;

/** Reconciliation weight sum tolerance */
const WEIGHT_SUM_TOLERANCE = 0.02;

/** Reconciliation final value tolerance (%) vs weighted average */
const FINAL_VALUE_TOLERANCE_PCT = 1;

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract all individual adjustment values from a comp's adjustments record. */
function getIndividualAdjustments(adj: CompAdjustments): number[] {
  return [
    adj.saleOrFinancingConcessions,
    adj.dateOfSaleTime,
    adj.locationAdj,
    adj.leaseholdFeeSimple,
    adj.siteAdj,
    adj.viewAdj,
    adj.designAndAppeal,
    adj.qualityOfConstruction,
    adj.actualAge,
    adj.conditionAdj,
    adj.aboveGradeRoomCount,
    adj.aboveGradeBedroom,
    adj.aboveGradeBathroom,
    adj.grossLivingAreaAdj,
    adj.basementAndFinishedRooms,
    adj.functionalUtility,
    adj.heatingCooling,
    adj.energyEfficiency,
    adj.garageCarport,
    adj.porchPatioPool,
    adj.otherAdj1,
    adj.otherAdj2,
    adj.otherAdj3,
  ];
}

function withinTolerance(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}


// ── Evaluators ───────────────────────────────────────────────────────

/**
 * Verifies net and gross adjustment totals and adjusted sale price for each comp.
 */
export function validateAdjustmentGridMath(input: MathIntegrityInput): MathIntegrityResult {
  if (input.comps.length === 0) {
    return { passed: true, message: 'No comps provided — grid math check skipped.', severity: 'critical' };
  }

  const errors: string[] = [];

  for (const comp of input.comps) {
    const adj = comp.adjustments;
    const values = getIndividualAdjustments(adj);

    const computedNet = values.reduce((sum, v) => sum + v, 0);
    const computedGross = values.reduce((sum, v) => sum + Math.abs(v), 0);
    const computedAdjPrice = comp.salePrice + computedNet;

    if (!withinTolerance(adj.netAdjustmentTotal, computedNet, ROUNDING_TOLERANCE)) {
      errors.push(`${comp.compId}: net adjustment total is ${adj.netAdjustmentTotal} but computed ${computedNet}`);
    }
    if (!withinTolerance(adj.grossAdjustmentTotal, computedGross, ROUNDING_TOLERANCE)) {
      errors.push(`${comp.compId}: gross adjustment total is ${adj.grossAdjustmentTotal} but computed ${computedGross}`);
    }
    if (!withinTolerance(adj.adjustedSalePrice, computedAdjPrice, ROUNDING_TOLERANCE)) {
      errors.push(`${comp.compId}: adjusted sale price is ${adj.adjustedSalePrice} but computed ${computedAdjPrice}`);
    }
  }

  if (errors.length > 0) {
    return {
      passed: false,
      message: `Adjustment grid arithmetic errors: ${errors.join('; ')}. Per USPAP SR 1-1(a), all calculations must be mathematically correct.`,
      severity: 'critical',
      details: { errors },
    };
  }

  return {
    passed: true,
    message: `All ${input.comps.length} comp(s) have correct grid arithmetic.`,
    severity: 'critical',
  };
}

/**
 * Compares subject GLA from the report against public record GLA.
 * Flags when variance exceeds threshold.
 */
export function validateGlaConsistency(input: MathIntegrityInput): MathIntegrityResult {
  const { grossLivingArea, publicRecordGla } = input.subject;

  if (publicRecordGla === undefined || publicRecordGla === null) {
    return { passed: true, message: 'No public record GLA available — skipping comparison.', severity: 'high' };
  }

  if (publicRecordGla === 0) {
    return { passed: true, message: 'Public record GLA is zero — skipping comparison.', severity: 'high' };
  }

  const variancePct = Math.abs(grossLivingArea - publicRecordGla) / publicRecordGla * 100;

  if (variancePct >= GLA_VARIANCE_THRESHOLD_PCT) {
    return {
      passed: false,
      message: `Subject GLA (${grossLivingArea} sqft) differs from public record (${publicRecordGla} sqft) by ${variancePct.toFixed(1)}%, exceeding the ${GLA_VARIANCE_THRESHOLD_PCT}% threshold. Appraiser must explain the discrepancy.`,
      severity: 'high',
      details: { reportedGla: grossLivingArea, publicRecordGla, variancePct: Math.round(variancePct * 10) / 10 },
    };
  }

  return {
    passed: true,
    message: `Subject GLA (${grossLivingArea} sqft) within ${GLA_VARIANCE_THRESHOLD_PCT}% of public record (${publicRecordGla} sqft).`,
    severity: 'high',
  };
}

/**
 * Validates that GLA adjustments are directionally consistent with GLA differences.
 * - If comp GLA < subject GLA → adjustment should be positive (or zero if trivial)
 * - If comp GLA > subject GLA → adjustment should be negative (or zero if trivial)
 * - If GLA differs significantly but adjustment is zero → flag
 */
export function validatePerSfAdjustments(input: MathIntegrityInput): MathIntegrityResult {
  if (input.comps.length === 0) {
    return { passed: true, message: 'No comps — per-SF check skipped.', severity: 'high' };
  }

  const issues: string[] = [];
  const subjectGla = input.subject.grossLivingArea;

  for (const comp of input.comps) {
    const glaDiff = subjectGla - comp.grossLivingArea; // positive = subject larger
    const glaAdj = comp.adjustments.grossLivingAreaAdj;

    if (glaAdj === 0 && Math.abs(glaDiff) > GLA_ZERO_ADJ_TOLERANCE_SQFT) {
      issues.push(`${comp.compId}: GLA differs by ${glaDiff} sqft but adjustment is $0`);
      continue;
    }

    // Direction check: if subject is larger (glaDiff > 0), adjustment to comp should be positive
    // (adding value to smaller comp to make it equivalent to subject)
    if (glaAdj !== 0 && glaDiff !== 0) {
      const adjDirection = glaAdj > 0 ? 'positive' : 'negative';
      const expectedDirection = glaDiff > 0 ? 'positive' : 'negative';
      if (adjDirection !== expectedDirection) {
        issues.push(`${comp.compId}: GLA difference is ${glaDiff} sqft (subject ${glaDiff > 0 ? 'larger' : 'smaller'}) but adjustment is ${glaAdj} (${adjDirection})`);
      }
    }
  }

  if (issues.length > 0) {
    const severity = issues.some(i => i.includes('but adjustment is')) ? 'high' : 'medium';
    return {
      passed: false,
      message: `GLA adjustment inconsistencies: ${issues.join('; ')}.`,
      severity: issues.some(i => !i.includes('$0')) ? 'high' : 'medium',
      details: { issues },
    };
  }

  return {
    passed: true,
    message: 'GLA adjustments are directionally consistent with GLA differences.',
    severity: 'high',
  };
}

/**
 * Validates Cost Approach arithmetic:
 *   - depreciationAmount ≈ sum of depreciation components
 *   - depreciatedCostOfImprovements ≈ (replacementCostNew + softCosts + entrepreneurialProfit) − depreciationAmount
 *   - indicatedValueByCostApproach ≈ depreciatedCostOfImprovements + siteImprovementsCost + estimatedLandValue
 */
export function validateCostApproachMath(input: MathIntegrityInput): MathIntegrityResult {
  if (!input.costApproach) {
    return { passed: true, message: 'No cost approach data — skipping.', severity: 'critical' };
  }

  const ca = input.costApproach;
  const errors: string[] = [];

  // Depreciation breakdown sum
  const depComponents = (ca.physicalDepreciationCurable ?? 0)
    + (ca.physicalDepreciationIncurable ?? 0)
    + (ca.functionalObsolescence ?? 0)
    + (ca.externalObsolescence ?? 0);

  if (!withinTolerance(ca.depreciationAmount, depComponents, ROUNDING_TOLERANCE)) {
    errors.push(`Total depreciation is ${ca.depreciationAmount} but component sum is ${depComponents}`);
  }

  // Depreciated cost of improvements
  const totalCost = ca.replacementCostNew + (ca.softCosts ?? 0) + (ca.entrepreneurialProfit ?? 0);
  const expectedDepreciatedCost = totalCost - ca.depreciationAmount;

  if (!withinTolerance(ca.depreciatedCostOfImprovements, expectedDepreciatedCost, ROUNDING_TOLERANCE)) {
    errors.push(`Depreciated cost is ${ca.depreciatedCostOfImprovements} but computed ${expectedDepreciatedCost}`);
  }

  // Indicated value
  const expectedIndicatedValue = ca.depreciatedCostOfImprovements + (ca.siteImprovementsCost ?? 0) + ca.estimatedLandValue;

  if (!withinTolerance(ca.indicatedValueByCostApproach, expectedIndicatedValue, ROUNDING_TOLERANCE)) {
    errors.push(`Indicated value is ${ca.indicatedValueByCostApproach} but computed ${expectedIndicatedValue}`);
  }

  if (errors.length > 0) {
    return {
      passed: false,
      message: `Cost approach arithmetic errors: ${errors.join('; ')}. Per USPAP SR 1-1(a), all cost approach calculations must be verifiable.`,
      severity: 'critical',
      details: { errors },
    };
  }

  return {
    passed: true,
    message: 'Cost approach arithmetic is correct.',
    severity: 'critical',
  };
}

/**
 * Validates Income Approach arithmetic:
 *   - PGI ≈ monthlyRent × 12
 *   - EGI ≈ PGI × (1 − vacancyRate)
 *   - NOI ≈ EGI − operatingExpenses − replacementReserves
 *   - Cap rate value ≈ NOI / capRate
 */
export function validateIncomeApproachMath(input: MathIntegrityInput): MathIntegrityResult {
  if (!input.incomeApproach) {
    return { passed: true, message: 'No income approach data — skipping.', severity: 'critical' };
  }

  const ia = input.incomeApproach;
  const errors: string[] = [];

  // PGI check
  if (ia.estimatedMonthlyMarketRent !== undefined && ia.potentialGrossIncome !== undefined) {
    const expectedPgi = ia.estimatedMonthlyMarketRent * 12;
    if (!withinTolerance(ia.potentialGrossIncome, expectedPgi, ROUNDING_TOLERANCE)) {
      errors.push(`PGI is ${ia.potentialGrossIncome} but monthly rent × 12 = ${expectedPgi}`);
    }
  }

  // EGI check
  if (ia.potentialGrossIncome !== undefined && ia.vacancyRate !== undefined && ia.effectiveGrossIncome !== undefined) {
    const expectedEgi = ia.potentialGrossIncome * (1 - ia.vacancyRate);
    if (!withinTolerance(ia.effectiveGrossIncome, expectedEgi, ROUNDING_TOLERANCE)) {
      errors.push(`EGI is ${ia.effectiveGrossIncome} but PGI × (1 − vacancy) = ${expectedEgi}`);
    }
  }

  // NOI check
  if (ia.effectiveGrossIncome !== undefined && ia.netOperatingIncome !== undefined) {
    const expectedNoi = ia.effectiveGrossIncome - (ia.operatingExpenses ?? 0) - (ia.replacementReserves ?? 0);
    if (!withinTolerance(ia.netOperatingIncome, expectedNoi, ROUNDING_TOLERANCE)) {
      errors.push(`NOI is ${ia.netOperatingIncome} but EGI − expenses − reserves = ${expectedNoi}`);
    }
  }

  // Cap rate indicated value check
  if (ia.netOperatingIncome !== undefined && ia.capRate !== undefined && ia.capRate > 0 && ia.indicatedValueByIncomeApproach !== undefined) {
    const expectedCapValue = ia.netOperatingIncome / ia.capRate;
    // Use larger tolerance for division (1% of expected)
    const divisionTolerance = Math.max(ROUNDING_TOLERANCE, expectedCapValue * 0.01);
    if (!withinTolerance(ia.indicatedValueByIncomeApproach, expectedCapValue, divisionTolerance)) {
      errors.push(`Indicated value is ${ia.indicatedValueByIncomeApproach} but NOI / capRate = ${Math.round(expectedCapValue)}`);
    }
  }

  if (errors.length > 0) {
    return {
      passed: false,
      message: `Income approach arithmetic errors: ${errors.join('; ')}. Per USPAP SR 1-1(a), all income calculations must be verifiable.`,
      severity: 'critical',
      details: { errors },
    };
  }

  return {
    passed: true,
    message: 'Income approach arithmetic is correct.',
    severity: 'critical',
  };
}

/**
 * Validates Reconciliation arithmetic:
 *   - Approach weights sum to 1.0 (±tolerance)
 *   - Final opinion of value ≈ weighted average of approach values (±1%)
 */
export function validateReconciliationMath(input: MathIntegrityInput): MathIntegrityResult {
  if (!input.reconciliation) {
    return { passed: true, message: 'No reconciliation data — skipping.', severity: 'critical' };
  }

  const rec = input.reconciliation;
  const errors: string[] = [];

  const hasWeights = rec.salesCompWeight !== undefined
    || rec.costWeight !== undefined
    || rec.incomeWeight !== undefined;

  if (hasWeights) {
    const weightSum = (rec.salesCompWeight ?? 0) + (rec.costWeight ?? 0) + (rec.incomeWeight ?? 0);

    if (Math.abs(weightSum - 1.0) > WEIGHT_SUM_TOLERANCE) {
      errors.push(`Approach weights sum to ${weightSum.toFixed(3)}, expected 1.0 (±${WEIGHT_SUM_TOLERANCE})`);
    }

    // Weighted average check
    const weightedAvg = (rec.salesCompApproachValue ?? 0) * (rec.salesCompWeight ?? 0)
      + (rec.costApproachValue ?? 0) * (rec.costWeight ?? 0)
      + (rec.incomeApproachValue ?? 0) * (rec.incomeWeight ?? 0);

    if (weightedAvg > 0) {
      const tolerance = weightedAvg * FINAL_VALUE_TOLERANCE_PCT / 100;
      if (!withinTolerance(rec.finalOpinionOfValue, weightedAvg, tolerance)) {
        errors.push(`Final opinion of value is ${rec.finalOpinionOfValue} but weighted average is ${Math.round(weightedAvg)} (±${FINAL_VALUE_TOLERANCE_PCT}% tolerance)`);
      }
    }
  }

  if (errors.length > 0) {
    // Weight error is high, value deviation is critical
    const hasCritical = errors.some(e => e.includes('Final opinion'));
    return {
      passed: false,
      message: `Reconciliation arithmetic issues: ${errors.join('; ')}.`,
      severity: hasCritical ? 'critical' : 'high',
      details: { errors },
    };
  }

  return {
    passed: true,
    message: 'Reconciliation arithmetic is correct.',
    severity: 'critical',
  };
}


// ── Evaluator Registry ───────────────────────────────────────────────

export const MATH_INTEGRITY_EVALUATORS: Record<string, MathIntegrityEvaluator> = {
  validateAdjustmentGridMath,
  validateGlaConsistency,
  validatePerSfAdjustments,
  validateCostApproachMath,
  validateIncomeApproachMath,
  validateReconciliationMath,
};


// ── Aggregate Service ────────────────────────────────────────────────

export class MathIntegrityService {
  performValidation(orderId: string, input: MathIntegrityInput): MathIntegrityReport {
    const checks: MathIntegrityCheck[] = [];

    for (const [name, evaluator] of Object.entries(MATH_INTEGRITY_EVALUATORS)) {
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
