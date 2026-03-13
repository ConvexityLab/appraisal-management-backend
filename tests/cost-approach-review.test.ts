/**
 * @file tests/cost-approach-review.test.ts
 * @description Tests for Phase 2.8 — Cost Approach Review Service
 *
 * Validates cost approach methodology: cost source documentation, depreciation
 * method consistency, effective age vs narrative, land value evidence, and
 * cost factor reasonableness.
 *
 * References: USPAP SR 1-4, Fannie Mae B4-1.5, Marshall & Swift cost factors
 */
import { describe, it, expect } from 'vitest';
import {
  checkCostSourceDocumentation,
  checkDepreciationMethodConsistency,
  checkEffectiveAgeConsistency,
  checkLandValueEvidence,
  checkCostFactorReasonableness,
  checkSoftCostsReasonableness,
  COST_REVIEW_EVALUATORS,
  CostApproachReviewService,
  type CostApproachReviewInput,
} from '../src/services/cost-approach-review.service';

function makeInput(overrides?: Partial<CostApproachReviewInput>): CostApproachReviewInput {
  return {
    costApproach: {
      estimatedLandValue: 80000,
      landValueSource: 'Land sales comparison',
      landValueMethod: 'sales comparison',
      replacementCostNew: 350000,
      costFactorSource: 'Marshall & Swift',
      grossLivingArea: 2000,
      softCosts: 10000,
      entrepreneurialProfit: 20000,
      siteImprovementsCost: 15000,
      depreciationAmount: 30000,
      depreciationType: 'age-life',
      effectiveAge: 10,
      economicLife: 60,
      physicalDepreciationCurable: 5000,
      physicalDepreciationIncurable: 20000,
      functionalObsolescence: 3000,
      externalObsolescence: 2000,
      depreciatedCostOfImprovements: 350000,
      indicatedValueByCostApproach: 445000,
    },
    property: {
      actualAge: 15,
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2011,
    },
    narrative: {
      depreciationCommentary: 'The subject shows some deferred maintenance consistent with its age. Physical depreciation is estimated using age-life method. Effective age of 10 years reflects updates to kitchen and bathrooms.',
      costApproachComments: 'Cost approach developed using Marshall & Swift residential cost handbook. Site value derived from three comparable land sales within 1 mile.',
    },
    ...overrides,
  };
}

// ─── checkCostSourceDocumentation ─────────────────────────────────────
describe('checkCostSourceDocumentation', () => {
  it('passes when cost factor source is documented', () => {
    const result = checkCostSourceDocumentation(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when cost factor source is missing', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).costFactorSource;
    const result = checkCostSourceDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('fails when land value source is missing', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).landValueSource;
    const result = checkCostSourceDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when cost approach is not provided', () => {
    const result = checkCostSourceDocumentation(makeInput({ costApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkDepreciationMethodConsistency ───────────────────────────────
describe('checkDepreciationMethodConsistency', () => {
  it('passes when depreciation method is consistent with narrative', () => {
    const result = checkDepreciationMethodConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when depreciation type is not specified', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).depreciationType;
    const result = checkDepreciationMethodConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags when age-life method has no economic life', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).economicLife;
    const result = checkDepreciationMethodConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when cost approach not provided', () => {
    const result = checkDepreciationMethodConsistency(makeInput({ costApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkEffectiveAgeConsistency ─────────────────────────────────────
describe('checkEffectiveAgeConsistency', () => {
  it('passes when effective age is reasonable relative to actual age', () => {
    const result = checkEffectiveAgeConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when effective age exceeds actual age significantly', () => {
    const input = makeInput();
    input.costApproach!.effectiveAge = 40;
    input.property.actualAge = 15;
    const result = checkEffectiveAgeConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('flags when effective age is 0 for a non-new property', () => {
    const input = makeInput();
    input.costApproach!.effectiveAge = 0;
    input.property.actualAge = 15;
    const result = checkEffectiveAgeConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('passes when no effective age given', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).effectiveAge;
    const result = checkEffectiveAgeConsistency(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkLandValueEvidence ───────────────────────────────────────────
describe('checkLandValueEvidence', () => {
  it('passes when land value source and method are documented', () => {
    const result = checkLandValueEvidence(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when land value method is not specified', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).landValueMethod;
    const result = checkLandValueEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags when land value is zero or negative', () => {
    const input = makeInput();
    input.costApproach!.estimatedLandValue = 0;
    const result = checkLandValueEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when cost approach not provided', () => {
    const result = checkLandValueEvidence(makeInput({ costApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkCostFactorReasonableness ────────────────────────────────────
describe('checkCostFactorReasonableness', () => {
  it('passes when cost per SF is within normal range', () => {
    const result = checkCostFactorReasonableness(makeInput());
    // 350000 / 2000 = $175/SF — reasonable
    expect(result.passed).toBe(true);
  });

  it('flags when cost per SF is extremely low', () => {
    const input = makeInput();
    input.costApproach!.replacementCostNew = 40000; // $20/SF
    const result = checkCostFactorReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags when cost per SF is extremely high', () => {
    const input = makeInput();
    input.costApproach!.replacementCostNew = 1400000; // $700/SF
    const result = checkCostFactorReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when GLA is not available', () => {
    const input = makeInput();
    delete (input.costApproach as Record<string, unknown>).grossLivingArea;
    const result = checkCostFactorReasonableness(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkSoftCostsReasonableness ─────────────────────────────────────
describe('checkSoftCostsReasonableness', () => {
  it('passes when soft costs and profit are reasonable', () => {
    const result = checkSoftCostsReasonableness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when entrepreneurial profit exceeds 25% of replacement cost', () => {
    const input = makeInput();
    input.costApproach!.entrepreneurialProfit = 100000; // ~29% of 350000
    const result = checkSoftCostsReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('passes when cost approach not provided', () => {
    const result = checkSoftCostsReasonableness(makeInput({ costApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── Registry + Aggregate ─────────────────────────────────────────────
describe('COST_REVIEW_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(COST_REVIEW_EVALUATORS)).toHaveLength(6);
  });
});

describe('CostApproachReviewService.performReview', () => {
  const service = new CostApproachReviewService();

  it('returns pass for a well-documented cost approach', () => {
    const report = service.performReview('ORD-400', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.checks).toHaveLength(6);
  });

  it('returns fail for critical issues', () => {
    const input = makeInput();
    input.costApproach!.estimatedLandValue = 0;
    const report = service.performReview('ORD-401', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
  });
});
