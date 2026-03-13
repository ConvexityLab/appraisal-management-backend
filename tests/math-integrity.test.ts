/**
 * @file tests/math-integrity.test.ts
 * @description Tests for Phase 2.11 — Math & Integrity Validation Service
 *
 * Validates arithmetic correctness of the Sales Comparison grid, Cost Approach,
 * Income Approach, and Reconciliation, plus GLA consistency checks.
 *
 * References: USPAP SR 1-1(a), Fannie Mae B4-1.3, FNMA 1004 grid fields
 */
import { describe, it, expect } from 'vitest';
import {
  validateAdjustmentGridMath,
  validateGlaConsistency,
  validateCostApproachMath,
  validateIncomeApproachMath,
  validateReconciliationMath,
  validatePerSfAdjustments,
  MATH_INTEGRITY_EVALUATORS,
  MathIntegrityService,
  type MathIntegrityInput,
} from '../src/services/math-integrity.service';

/** Builds a minimal clean input. All math is correct by default. */
function makeInput(overrides?: Partial<MathIntegrityInput>): MathIntegrityInput {
  return {
    subject: {
      grossLivingArea: 2000,
      publicRecordGla: 2000,
    },
    comps: [
      {
        compId: 'COMP-1',
        salePrice: 400000,
        grossLivingArea: 1800,
        adjustments: {
          locationAdj: 5000,
          grossLivingAreaAdj: 10000,
          conditionAdj: -3000,
          qualityOfConstruction: 0,
          siteAdj: 0,
          viewAdj: 0,
          designAndAppeal: 0,
          actualAge: -2000,
          aboveGradeRoomCount: 0,
          aboveGradeBedroom: 0,
          aboveGradeBathroom: 1500,
          basementAndFinishedRooms: 0,
          functionalUtility: 0,
          heatingCooling: 0,
          energyEfficiency: 0,
          garageCarport: 0,
          porchPatioPool: 0,
          saleOrFinancingConcessions: 0,
          dateOfSaleTime: 0,
          leaseholdFeeSimple: 0,
          otherAdj1: 0,
          otherAdj2: 0,
          otherAdj3: 0,
          // correct math:
          netAdjustmentTotal: 11500,  // 5000+10000-3000-2000+1500
          grossAdjustmentTotal: 21500, // |5000|+|10000|+|3000|+|2000|+|1500|
          adjustedSalePrice: 411500,   // 400000+11500
        },
      },
    ],
    costApproach: {
      estimatedLandValue: 80000,
      replacementCostNew: 350000,
      softCosts: 10000,
      entrepreneurialProfit: 20000,
      siteImprovementsCost: 15000,
      physicalDepreciationCurable: 5000,
      physicalDepreciationIncurable: 20000,
      functionalObsolescence: 3000,
      externalObsolescence: 2000,
      depreciationAmount: 30000, // 5000+20000+3000+2000
      depreciatedCostOfImprovements: 350000, // (350000+10000+20000) - 30000
      indicatedValueByCostApproach: 445000,  // 350000+15000+80000
    },
    incomeApproach: {
      estimatedMonthlyMarketRent: 2500,
      grossRentMultiplier: 150,
      potentialGrossIncome: 30000,  // 2500*12
      vacancyRate: 0.05,
      effectiveGrossIncome: 28500,  // 30000*(1-0.05)
      operatingExpenses: 6000,
      replacementReserves: 500,
      netOperatingIncome: 22000,    // 28500-6000-500
      capRate: 0.05,
      indicatedValueByIncomeApproach: 440000, // 22000/0.05
    },
    reconciliation: {
      salesCompApproachValue: 411500,
      costApproachValue: 445000,
      incomeApproachValue: 440000,
      salesCompWeight: 0.50,
      costWeight: 0.25,
      incomeWeight: 0.25,
      finalOpinionOfValue: 427125,
      // weighted avg: 411500*0.50 + 445000*0.25 + 440000*0.25 = 205750+111250+110000 = 427000
      // allowing ±1% tolerance
    },
    ...overrides,
  };
}

// ─── validateAdjustmentGridMath ───────────────────────────────────────
describe('validateAdjustmentGridMath', () => {
  it('passes when all comp grid math is correct', () => {
    const result = validateAdjustmentGridMath(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when netAdjustmentTotal is wrong', () => {
    const input = makeInput();
    input.comps[0].adjustments.netAdjustmentTotal = 99999;
    const result = validateAdjustmentGridMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('COMP-1');
    expect(result.message).toContain('net');
  });

  it('fails when grossAdjustmentTotal is wrong', () => {
    const input = makeInput();
    input.comps[0].adjustments.grossAdjustmentTotal = 5000;
    const result = validateAdjustmentGridMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when adjustedSalePrice is wrong', () => {
    const input = makeInput();
    input.comps[0].adjustments.adjustedSalePrice = 500000;
    const result = validateAdjustmentGridMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when comps array is empty', () => {
    const result = validateAdjustmentGridMath(makeInput({ comps: [] }));
    expect(result.passed).toBe(true);
  });

  it('tolerates rounding within $1', () => {
    const input = makeInput();
    input.comps[0].adjustments.netAdjustmentTotal = 11501; // off by $1
    const result = validateAdjustmentGridMath(input);
    expect(result.passed).toBe(true);
  });

  it('detects errors across multiple comps', () => {
    const input = makeInput();
    input.comps.push({
      compId: 'COMP-2',
      salePrice: 420000,
      grossLivingArea: 2100,
      adjustments: {
        ...input.comps[0].adjustments,
        locationAdj: 0,
        grossLivingAreaAdj: -5000,
        conditionAdj: 0,
        actualAge: 0,
        aboveGradeBathroom: 0,
        netAdjustmentTotal: -5000,
        grossAdjustmentTotal: 5000,
        adjustedSalePrice: 415000,
      },
    });
    // break COMP-2 math
    input.comps[1].adjustments.adjustedSalePrice = 999999;
    const result = validateAdjustmentGridMath(input);
    expect(result.passed).toBe(false);
    expect(result.details?.errors).toBeDefined();
  });
});

// ─── validateGlaConsistency ───────────────────────────────────────────
describe('validateGlaConsistency', () => {
  it('passes when GLA matches public record', () => {
    const result = validateGlaConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when GLA differs from public record by ≥ 10%', () => {
    const result = validateGlaConsistency(makeInput({
      subject: { grossLivingArea: 2000, publicRecordGla: 1700 },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('2000');
    expect(result.message).toContain('1700');
  });

  it('passes when GLA difference is under 10%', () => {
    const result = validateGlaConsistency(makeInput({
      subject: { grossLivingArea: 2000, publicRecordGla: 1850 },
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when public record GLA is not available', () => {
    const result = validateGlaConsistency(makeInput({
      subject: { grossLivingArea: 2000 },
    }));
    expect(result.passed).toBe(true);
  });
});

// ─── validatePerSfAdjustments ─────────────────────────────────────────
describe('validatePerSfAdjustments', () => {
  it('passes when GLA adj direction is consistent with GLA difference', () => {
    const result = validatePerSfAdjustments(makeInput());
    // subject=2000, comp=1800: comp smaller → positive adj expected → adj=+10000 ✓
    expect(result.passed).toBe(true);
  });

  it('fails when GLA adj direction contradicts GLA difference', () => {
    const input = makeInput();
    input.comps[0].adjustments.grossLivingAreaAdj = -10000; // negative, but comp is smaller
    const result = validatePerSfAdjustments(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when GLA adj is zero and GLA is same', () => {
    const input = makeInput();
    input.comps[0].grossLivingArea = 2000;
    input.comps[0].adjustments.grossLivingAreaAdj = 0;
    const result = validatePerSfAdjustments(input);
    expect(result.passed).toBe(true);
  });

  it('flags when GLA adj is zero but GLA differs significantly', () => {
    const input = makeInput();
    input.comps[0].grossLivingArea = 1500; // 500 sqft diff, no adjustment
    input.comps[0].adjustments.grossLivingAreaAdj = 0;
    const result = validatePerSfAdjustments(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── validateCostApproachMath ─────────────────────────────────────────
describe('validateCostApproachMath', () => {
  it('passes when cost approach math is correct', () => {
    const result = validateCostApproachMath(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when depreciation sum is wrong', () => {
    const input = makeInput();
    input.costApproach!.depreciationAmount = 99999;
    const result = validateCostApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('depreciation');
  });

  it('fails when depreciated cost of improvements is wrong', () => {
    const input = makeInput();
    input.costApproach!.depreciatedCostOfImprovements = 99999;
    const result = validateCostApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when indicated value is wrong', () => {
    const input = makeInput();
    input.costApproach!.indicatedValueByCostApproach = 99999;
    const result = validateCostApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when cost approach data is not provided', () => {
    const result = validateCostApproachMath(makeInput({ costApproach: undefined }));
    expect(result.passed).toBe(true);
  });

  it('tolerates rounding within $1', () => {
    const input = makeInput();
    input.costApproach!.depreciationAmount = 30001; // off by $1
    const result = validateCostApproachMath(input);
    expect(result.passed).toBe(true);
  });
});

// ─── validateIncomeApproachMath ───────────────────────────────────────
describe('validateIncomeApproachMath', () => {
  it('passes when income approach math is correct', () => {
    const result = validateIncomeApproachMath(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when PGI is wrong', () => {
    const input = makeInput();
    input.incomeApproach!.potentialGrossIncome = 99999;
    const result = validateIncomeApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when EGI is wrong', () => {
    const input = makeInput();
    input.incomeApproach!.effectiveGrossIncome = 99999;
    const result = validateIncomeApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when NOI is wrong', () => {
    const input = makeInput();
    input.incomeApproach!.netOperatingIncome = 99999;
    const result = validateIncomeApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when cap rate indicated value is wrong', () => {
    const input = makeInput();
    input.incomeApproach!.indicatedValueByIncomeApproach = 99999;
    const result = validateIncomeApproachMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when income approach data is not provided', () => {
    const result = validateIncomeApproachMath(makeInput({ incomeApproach: undefined }));
    expect(result.passed).toBe(true);
  });

  it('tolerates rounding within $1', () => {
    const input = makeInput();
    // 28500 - 6000 - 500 = 22000, let's be off by $1
    input.incomeApproach!.netOperatingIncome = 22001;
    const result = validateIncomeApproachMath(input);
    expect(result.passed).toBe(true);
  });
});

// ─── validateReconciliationMath ───────────────────────────────────────
describe('validateReconciliationMath', () => {
  it('passes when reconciliation math is correct', () => {
    const result = validateReconciliationMath(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when weights do not sum to 1.0', () => {
    const input = makeInput();
    input.reconciliation!.salesCompWeight = 0.50;
    input.reconciliation!.costWeight = 0.30;
    input.reconciliation!.incomeWeight = 0.30;
    // Set final value to match the incorrect-weight weighted average so only weight error fires
    // 411500*0.5 + 445000*0.3 + 440000*0.3 = 205750+133500+132000 = 471250
    input.reconciliation!.finalOpinionOfValue = 471250;
    const result = validateReconciliationMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('weight');
  });

  it('fails when final value deviates from weighted average by > 1%', () => {
    const input = makeInput();
    input.reconciliation!.finalOpinionOfValue = 500000; // way off
    const result = validateReconciliationMath(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when reconciliation data is not provided', () => {
    const result = validateReconciliationMath(makeInput({ reconciliation: undefined }));
    expect(result.passed).toBe(true);
  });

  it('passes when weights are not provided (skip weight check)', () => {
    const input = makeInput();
    delete input.reconciliation!.salesCompWeight;
    delete input.reconciliation!.costWeight;
    delete input.reconciliation!.incomeWeight;
    const result = validateReconciliationMath(input);
    expect(result.passed).toBe(true);
  });
});

// ─── MATH_INTEGRITY_EVALUATORS registry ───────────────────────────────
describe('MATH_INTEGRITY_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(MATH_INTEGRITY_EVALUATORS)).toHaveLength(6);
  });

  it('all evaluators are functions', () => {
    for (const [, fn] of Object.entries(MATH_INTEGRITY_EVALUATORS)) {
      expect(typeof fn).toBe('function');
    }
  });
});

// ─── Aggregate report ─────────────────────────────────────────────────
describe('MathIntegrityService.performValidation', () => {
  const service = new MathIntegrityService();

  it('returns pass for fully correct math', () => {
    const report = service.performValidation('ORD-200', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.checks).toHaveLength(6);
    expect(report.orderId).toBe('ORD-200');
  });

  it('returns fail for critical math errors', () => {
    const input = makeInput();
    input.comps[0].adjustments.netAdjustmentTotal = 99999;
    const report = service.performValidation('ORD-201', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
  });

  it('aggregates issues across all evaluators', () => {
    const input = makeInput();
    input.comps[0].adjustments.netAdjustmentTotal = 99999;
    input.costApproach!.depreciationAmount = 99999;
    input.reconciliation!.finalOpinionOfValue = 999999;
    const report = service.performValidation('ORD-202', input);
    expect(report.totalIssues).toBeGreaterThanOrEqual(3);
  });
});
