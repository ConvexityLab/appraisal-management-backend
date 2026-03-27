/**
 * @file tests/improvements-review.test.ts
 * @description Phase 2.7 — Improvements & Condition Review Tests
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkConditionQualityRatings,
  checkGlaReasonableness,
  checkRoomCountLogic,
  checkBasementConsistency,
  checkEffectiveAgeReasonableness,
  checkFunctionalUtility,
  IMPROVEMENTS_EVALUATORS,
  ImprovementsReviewService,
  ImprovementsReviewInput,
} from '../src/services/improvements-review.service';

beforeAll(() => { console.log('🧪 Setting up test environment...'); console.log('✅ Test environment ready'); });
afterAll(() => { console.log('🧹 Cleaning up test environment...'); console.log('✅ Test cleanup complete'); });

function makeInput(overrides?: Partial<ImprovementsReviewInput>): ImprovementsReviewInput {
  return {
    subject: {
      grossLivingArea: 2100,
      totalRooms: 7,
      bedrooms: 3,
      bathrooms: 2.5,
      stories: 2,
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2005,
      effectiveAge: 15,
      foundationType: 'Full Basement',
      basement: 'Full',
      basementSqFt: 1050,
      basementFinishedSqFt: 600,
      exteriorWalls: 'Vinyl Siding',
      roofSurface: 'Asphalt Shingle',
      heating: 'FWA',
      cooling: 'Central',
      garageType: 'Attached',
      garageSpaces: 2,
      pool: false,
      conditionDescription: null,
    },
    comps: [
      { grossLivingArea: 2000, condition: 'C3', quality: 'Q3', yearBuilt: 2003, bedrooms: 3, bathrooms: 2 },
      { grossLivingArea: 2200, condition: 'C3', quality: 'Q4', yearBuilt: 2006, bedrooms: 4, bathrooms: 2.5 },
      { grossLivingArea: 1950, condition: 'C4', quality: 'Q3', yearBuilt: 2001, bedrooms: 3, bathrooms: 2 },
    ],
    ...overrides,
  };
}

// ─── checkConditionQualityRatings ────────────────────────────────────
describe('checkConditionQualityRatings', () => {
  it('passes for valid C/Q ratings', () => {
    const result = checkConditionQualityRatings(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails for invalid condition rating', () => {
    const input = makeInput();
    input.subject.condition = 'Good';
    const result = checkConditionQualityRatings(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails for invalid quality rating', () => {
    const input = makeInput();
    input.subject.quality = 'Average';
    const result = checkConditionQualityRatings(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags C5/C6 without condition description', () => {
    const input = makeInput();
    input.subject.condition = 'C5';
    input.subject.conditionDescription = null;
    const result = checkConditionQualityRatings(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('deficiencies');
  });

  it('passes C5 with adequate condition description', () => {
    const input = makeInput();
    input.subject.condition = 'C5';
    input.subject.conditionDescription = 'Significant deferred maintenance: roof near end of useful life, HVAC system needs replacement, foundation cracks observed.';
    const result = checkConditionQualityRatings(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkGlaReasonableness ─────────────────────────────────────────
describe('checkGlaReasonableness', () => {
  it('passes for reasonable GLA', () => {
    const result = checkGlaReasonableness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags GLA below minimum', () => {
    const input = makeInput();
    input.subject.grossLivingArea = 300;
    const result = checkGlaReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags GLA above maximum', () => {
    const input = makeInput();
    input.subject.grossLivingArea = 15000;
    const result = checkGlaReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags large GLA divergence from comps', () => {
    const input = makeInput();
    input.subject.grossLivingArea = 4000;
    const result = checkGlaReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('diverge');
  });
});

// ─── checkRoomCountLogic ────────────────────────────────────────────
describe('checkRoomCountLogic', () => {
  it('passes for consistent room counts', () => {
    const result = checkRoomCountLogic(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when total rooms < bedrooms + 1', () => {
    const input = makeInput();
    input.subject.totalRooms = 3;
    input.subject.bedrooms = 3;
    const result = checkRoomCountLogic(input);
    expect(result.passed).toBe(false);
  });

  it('flags zero bedrooms', () => {
    const input = makeInput();
    input.subject.bedrooms = 0;
    const result = checkRoomCountLogic(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags zero bathrooms', () => {
    const input = makeInput();
    input.subject.bathrooms = 0;
    const result = checkRoomCountLogic(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });
});

// ─── checkBasementConsistency ───────────────────────────────────────
describe('checkBasementConsistency', () => {
  it('passes for consistent basement data', () => {
    const result = checkBasementConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('passes when no basement', () => {
    const input = makeInput();
    input.subject.basement = 'None';
    input.subject.basementSqFt = null;
    input.subject.basementFinishedSqFt = null;
    const result = checkBasementConsistency(input);
    expect(result.passed).toBe(true);
  });

  it('flags when no basement but basement sq ft reported', () => {
    const input = makeInput();
    input.subject.basement = 'None';
    input.subject.basementSqFt = 800;
    const result = checkBasementConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags when finished exceeds total basement area', () => {
    const input = makeInput();
    input.subject.basementSqFt = 800;
    input.subject.basementFinishedSqFt = 1200;
    const result = checkBasementConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });
});

// ─── checkEffectiveAgeReasonableness ────────────────────────────────
describe('checkEffectiveAgeReasonableness', () => {
  it('passes for reasonable effective age', () => {
    const result = checkEffectiveAgeReasonableness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('skips when effective age not provided', () => {
    const input = makeInput();
    input.subject.effectiveAge = null;
    const result = checkEffectiveAgeReasonableness(input);
    expect(result.passed).toBe(true);
  });

  it('flags negative effective age', () => {
    const input = makeInput();
    input.subject.effectiveAge = -5;
    const result = checkEffectiveAgeReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags zero effective age for older property', () => {
    const input = makeInput();
    input.subject.yearBuilt = 1990;
    input.subject.effectiveAge = 0;
    const result = checkEffectiveAgeReasonableness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── checkFunctionalUtility ─────────────────────────────────────────
describe('checkFunctionalUtility', () => {
  it('passes when all building components documented', () => {
    const result = checkFunctionalUtility(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when heating is None', () => {
    const input = makeInput();
    input.subject.heating = 'None';
    const result = checkFunctionalUtility(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags missing foundation type', () => {
    const input = makeInput();
    input.subject.foundationType = undefined;
    const result = checkFunctionalUtility(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Foundation');
  });

  it('flags missing exterior walls and roof', () => {
    const input = makeInput();
    input.subject.exteriorWalls = undefined;
    input.subject.roofSurface = undefined;
    const result = checkFunctionalUtility(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Exterior');
    expect(result.message).toContain('Roof');
  });
});

// ─── Registry ────────────────────────────────────────────────────────
describe('IMPROVEMENTS_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(IMPROVEMENTS_EVALUATORS)).toHaveLength(6);
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkConditionQualityRatings');
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkGlaReasonableness');
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkRoomCountLogic');
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkBasementConsistency');
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkEffectiveAgeReasonableness');
    expect(IMPROVEMENTS_EVALUATORS).toHaveProperty('checkFunctionalUtility');
  });
});

// ─── Aggregate Service ──────────────────────────────────────────────
describe('ImprovementsReviewService.performReview', () => {
  it('returns pass for well-documented improvements', () => {
    const svc = new ImprovementsReviewService();
    const report = svc.performReview('order-imp-1', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail for critical issues', () => {
    const input = makeInput();
    input.subject.condition = 'Excellent';
    input.subject.effectiveAge = -5;
    const svc = new ImprovementsReviewService();
    const report = svc.performReview('order-imp-2', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThan(0);
  });
});
