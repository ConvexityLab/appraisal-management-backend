/**
 * @file tests/income-approach-review.test.ts
 * @description Tests for Phase 2.9 — Income Approach Review Service
 *
 * Validates income approach methodology: rent derivation evidence, STR misuse,
 * vacancy/expense reasonableness, cap rate/GRM evidence, and market rate context.
 *
 * References: USPAP SR 1-4, Fannie Mae B4-1.6, Form 1007/216
 */
import { describe, it, expect } from 'vitest';
import {
  checkRentDerivationEvidence,
  checkStrMisuse,
  checkVacancyExpenseReasonableness,
  checkCapRateEvidence,
  checkGrmConsistency,
  checkMarketRateContext,
  INCOME_REVIEW_EVALUATORS,
  IncomeApproachReviewService,
  type IncomeApproachReviewInput,
} from '../src/services/income-approach-review.service';

function makeInput(overrides?: Partial<IncomeApproachReviewInput>): IncomeApproachReviewInput {
  return {
    incomeApproach: {
      estimatedMonthlyMarketRent: 2500,
      rentBasis: 'long-term lease',
      rentCompCount: 3,
      grossRentMultiplier: 150,
      grmComps: [145, 152, 148],
      potentialGrossIncome: 30000,
      vacancyRate: 0.05,
      effectiveGrossIncome: 28500,
      operatingExpenses: 6000,
      operatingExpenseRatio: 0.21,
      replacementReserves: 500,
      netOperatingIncome: 22000,
      capRate: 0.05,
      capRateSource: 'Comparable income property sales',
      indicatedValueByIncomeApproach: 440000,
    },
    narrative: {
      incomeApproachComments: 'Income approach developed using three comparable rentals within 0.5 miles. GRM derived from paired sales analysis.',
    },
    ...overrides,
  };
}

// ─── checkRentDerivationEvidence ──────────────────────────────────────
describe('checkRentDerivationEvidence', () => {
  it('passes when rent comps are provided', () => {
    const result = checkRentDerivationEvidence(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when no rent comps are used', () => {
    const input = makeInput();
    input.incomeApproach!.rentCompCount = 0;
    const result = checkRentDerivationEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when income approach not provided', () => {
    const result = checkRentDerivationEvidence(makeInput({ incomeApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkStrMisuse ───────────────────────────────────────────────────
describe('checkStrMisuse', () => {
  it('passes when rent basis is long-term lease', () => {
    const result = checkStrMisuse(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when rent basis indicates STR', () => {
    const input = makeInput();
    input.incomeApproach!.rentBasis = 'short-term rental';
    const result = checkStrMisuse(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags STR keywords in narrative', () => {
    const result = checkStrMisuse(makeInput({
      narrative: { incomeApproachComments: 'Rent estimate based on Airbnb data and VRBO occupancy rates.' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when income approach not provided', () => {
    const result = checkStrMisuse(makeInput({ incomeApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── checkVacancyExpenseReasonableness ────────────────────────────────
describe('checkVacancyExpenseReasonableness', () => {
  it('passes when vacancy and expenses are reasonable', () => {
    const result = checkVacancyExpenseReasonableness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when vacancy rate is zero', () => {
    const input = makeInput();
    input.incomeApproach!.vacancyRate = 0;
    const result = checkVacancyExpenseReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags when vacancy rate exceeds 25%', () => {
    const input = makeInput();
    input.incomeApproach!.vacancyRate = 0.30;
    const result = checkVacancyExpenseReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('flags when operating expense ratio is very low', () => {
    const input = makeInput();
    input.incomeApproach!.operatingExpenseRatio = 0.05;
    const result = checkVacancyExpenseReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── checkCapRateEvidence ─────────────────────────────────────────────
describe('checkCapRateEvidence', () => {
  it('passes when cap rate source is documented', () => {
    const result = checkCapRateEvidence(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when cap rate source is missing', () => {
    const input = makeInput();
    delete (input.incomeApproach as Record<string, unknown>).capRateSource;
    const result = checkCapRateEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags unreasonably low cap rate', () => {
    const input = makeInput();
    input.incomeApproach!.capRate = 0.01;
    const result = checkCapRateEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags unreasonably high cap rate', () => {
    const input = makeInput();
    input.incomeApproach!.capRate = 0.20;
    const result = checkCapRateEvidence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });
});

// ─── checkGrmConsistency ──────────────────────────────────────────────
describe('checkGrmConsistency', () => {
  it('passes when GRM is within comp range', () => {
    const result = checkGrmConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when GRM is outside comp range', () => {
    const input = makeInput();
    input.incomeApproach!.grossRentMultiplier = 200; // well above 145-152
    const result = checkGrmConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when no GRM comp data', () => {
    const input = makeInput();
    delete (input.incomeApproach as Record<string, unknown>).grmComps;
    const result = checkGrmConsistency(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkMarketRateContext ───────────────────────────────────────────
describe('checkMarketRateContext', () => {
  it('passes when cap rate is reasonable for market context', () => {
    const result = checkMarketRateContext(makeInput());
    expect(result.passed).toBe(true);
  });

  it('passes when income approach not provided', () => {
    const result = checkMarketRateContext(makeInput({ incomeApproach: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── Registry + Aggregate ─────────────────────────────────────────────
describe('INCOME_REVIEW_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(INCOME_REVIEW_EVALUATORS)).toHaveLength(6);
  });
});

describe('IncomeApproachReviewService.performReview', () => {
  const service = new IncomeApproachReviewService();

  it('returns pass for well-supported income approach', () => {
    const report = service.performReview('ORD-500', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail for STR misuse', () => {
    const input = makeInput();
    input.incomeApproach!.rentBasis = 'short-term rental';
    const report = service.performReview('ORD-501', input);
    expect(report.overallStatus).toBe('fail');
  });
});
