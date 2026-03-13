/**
 * @file tests/reconciliation-review.test.ts
 * @description Tests for Phase 2.10 — Reconciliation & Reasonableness Service
 *
 * Validates cross-approach triangulation, sensitivity analysis,
 * time-adjustment validation, and approach spread reasonableness.
 *
 * References: USPAP SR 1-6, Fannie Mae B4-1.3
 */
import { describe, it, expect } from 'vitest';
import {
  checkApproachSpread,
  checkWeightJustification,
  checkSensitivityAnalysis,
  checkTimeAdjustmentSupport,
  checkExposureMarketingTime,
  RECONCILIATION_EVALUATORS,
  ReconciliationReviewService,
  type ReconciliationReviewInput,
} from '../src/services/reconciliation-review.service';

function makeInput(overrides?: Partial<ReconciliationReviewInput>): ReconciliationReviewInput {
  return {
    reconciliation: {
      salesCompApproachValue: 425000,
      costApproachValue: 445000,
      incomeApproachValue: 440000,
      salesCompWeight: 0.50,
      costWeight: 0.25,
      incomeWeight: 0.25,
      finalOpinionOfValue: 432500,
      reconciliationNarrative: 'Greatest weight given to sales comparison approach based on strong comparable data. Cost and income approaches provide support. All three approaches indicate a narrow range.',
      exposureTime: '30-90 days',
      marketingTime: '30-90 days',
    },
    approachesUsed: ['sales_comparison', 'cost', 'income'],
    ...overrides,
  };
}

// ─── checkApproachSpread ──────────────────────────────────────────────
describe('checkApproachSpread', () => {
  it('passes when approach spread is reasonable', () => {
    const result = checkApproachSpread(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when approach spread exceeds 15%', () => {
    const result = checkApproachSpread(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        costApproachValue: 550000, // big gap
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when only one approach is used', () => {
    const result = checkApproachSpread(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        costApproachValue: undefined,
        incomeApproachValue: undefined,
      },
    }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkWeightJustification ─────────────────────────────────────────
describe('checkWeightJustification', () => {
  it('passes when weights are provided with narrative', () => {
    const result = checkWeightJustification(makeInput());
    expect(result.passed).toBe(true);
  });

  it('warns when a used approach has zero weight', () => {
    const result = checkWeightJustification(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        incomeWeight: 0,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('flags when narrative is missing', () => {
    const result = checkWeightJustification(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        reconciliationNarrative: undefined,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });
});

// ─── checkSensitivityAnalysis ─────────────────────────────────────────
describe('checkSensitivityAnalysis', () => {
  it('passes when final value is within approach range', () => {
    const result = checkSensitivityAnalysis(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when final value is outside approach range', () => {
    const result = checkSensitivityAnalysis(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        finalOpinionOfValue: 500000, // above all approaches
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });
});

// ─── checkTimeAdjustmentSupport ───────────────────────────────────────
describe('checkTimeAdjustmentSupport', () => {
  it('passes by default (placeholder for market rate data)', () => {
    const result = checkTimeAdjustmentSupport(makeInput());
    expect(result.passed).toBe(true);
  });
});

// ─── checkExposureMarketingTime ───────────────────────────────────────
describe('checkExposureMarketingTime', () => {
  it('passes when exposure/marketing times are documented', () => {
    const result = checkExposureMarketingTime(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when exposure time is missing', () => {
    const result = checkExposureMarketingTime(makeInput({
      reconciliation: {
        ...makeInput().reconciliation,
        exposureTime: undefined,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── Registry + Aggregate ─────────────────────────────────────────────
describe('RECONCILIATION_EVALUATORS registry', () => {
  it('contains all 5 evaluators', () => {
    expect(Object.keys(RECONCILIATION_EVALUATORS)).toHaveLength(5);
  });
});

describe('ReconciliationReviewService.performReview', () => {
  const service = new ReconciliationReviewService();

  it('returns pass for well-supported reconciliation', () => {
    const report = service.performReview('ORD-600', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail when final value outside range', () => {
    const input = makeInput();
    input.reconciliation.finalOpinionOfValue = 600000;
    const report = service.performReview('ORD-601', input);
    expect(report.overallStatus).toBe('fail');
  });
});
