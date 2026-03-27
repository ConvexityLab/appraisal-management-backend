/**
 * @file tests/enhanced-fraud-detection.test.ts
 * @description Phase 2.12 — Enhanced Fraud Detection Tests
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  detectSerialFlip,
  detectCompClustering,
  detectPerfectMatchComps,
  detectValueRoundingBias,
  detectAdjustmentSymmetry,
  detectCompStaleness,
  ENHANCED_FRAUD_EVALUATORS,
  EnhancedFraudDetectionService,
  EnhancedFraudInput,
} from '../src/services/enhanced-fraud-detection.service';

beforeAll(() => { console.log('🧪 Setting up test environment...'); console.log('✅ Test environment ready'); });
afterAll(() => { console.log('🧹 Cleaning up test environment...'); console.log('✅ Test cleanup complete'); });

function makeInput(overrides?: Partial<EnhancedFraudInput>): EnhancedFraudInput {
  return {
    appraisedValue: 432500,
    appraisalDate: '2026-01-15',
    subject: {
      currentSalePrice: 430000,
      currentSaleDate: '2025-12-01',
      priorSalePrice: 380000,
      priorSaleDate: '2023-06-15',
    },
    comps: [
      {
        address: '123 Oak St',
        salePrice: 425000,
        saleDate: '2025-11-01',
        distanceFromSubjectMiles: 0.8,
        latitude: 34.0522,
        longitude: -118.2437,
        adjustments: { netAdjustmentTotal: 5000, grossAdjustmentTotal: 15000 },
      },
      {
        address: '456 Elm Ave',
        salePrice: 445000,
        saleDate: '2025-10-15',
        distanceFromSubjectMiles: 1.2,
        latitude: 34.0530,
        longitude: -118.2500,
        adjustments: { netAdjustmentTotal: -10000, grossAdjustmentTotal: 20000 },
      },
      {
        address: '789 Maple Dr',
        salePrice: 440000,
        saleDate: '2025-09-20',
        distanceFromSubjectMiles: 1.5,
        latitude: 34.0600,
        longitude: -118.2600,
        adjustments: { netAdjustmentTotal: -5000, grossAdjustmentTotal: 12000 },
      },
    ],
    ...overrides,
  };
}

// ─── detectSerialFlip ────────────────────────────────────────────────
describe('detectSerialFlip', () => {
  it('passes when no serial flip pattern', () => {
    const result = detectSerialFlip(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags serial flip within 6 months with >20% appreciation', () => {
    const input = makeInput({
      subject: {
        currentSalePrice: 500000,
        currentSaleDate: '2026-01-15',
        priorSalePrice: 350000,
        priorSaleDate: '2025-09-01',
      },
    });
    const result = detectSerialFlip(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('Serial flip');
  });

  it('passes when no prior sale data', () => {
    const input = makeInput({
      subject: {
        currentSalePrice: 430000,
        currentSaleDate: '2025-12-01',
        priorSalePrice: null,
        priorSaleDate: null,
      },
    });
    const result = detectSerialFlip(input);
    expect(result.passed).toBe(true);
  });
});

// ─── detectCompClustering ────────────────────────────────────────────
describe('detectCompClustering', () => {
  it('passes with geographically dispersed comps', () => {
    const result = detectCompClustering(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags all comps within 0.5 miles of each other', () => {
    const input = makeInput({
      comps: [
        { address: '100 A St', salePrice: 425000, saleDate: '2025-11-01', distanceFromSubjectMiles: 0.3, latitude: 34.05220, longitude: -118.24370 },
        { address: '102 A St', salePrice: 430000, saleDate: '2025-10-15', distanceFromSubjectMiles: 0.3, latitude: 34.05225, longitude: -118.24375 },
        { address: '104 A St', salePrice: 435000, saleDate: '2025-09-20', distanceFromSubjectMiles: 0.3, latitude: 34.05230, longitude: -118.24380 },
      ],
    });
    const result = detectCompClustering(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('clustered');
  });

  it('passes when insufficient geo-coded comps', () => {
    const input = makeInput({
      comps: [
        { address: '100 A St', salePrice: 425000, saleDate: '2025-11-01', distanceFromSubjectMiles: 0.3 },
        { address: '102 B St', salePrice: 430000, saleDate: '2025-10-15', distanceFromSubjectMiles: 1.2 },
      ],
    });
    const result = detectCompClustering(input);
    expect(result.passed).toBe(true);
  });
});

// ─── detectPerfectMatchComps ─────────────────────────────────────────
describe('detectPerfectMatchComps', () => {
  it('passes when all comps are unique', () => {
    const result = detectPerfectMatchComps(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags duplicate comp addresses', () => {
    const input = makeInput();
    input.comps[2] = { ...input.comps[0], saleDate: '2025-08-01' };
    const result = detectPerfectMatchComps(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('Duplicate');
  });

  it('detects case-insensitive duplicates', () => {
    const input = makeInput();
    input.comps[1] = { ...input.comps[1], address: '123 OAK ST' };
    const result = detectPerfectMatchComps(input);
    expect(result.passed).toBe(false);
  });
});

// ─── detectValueRoundingBias ─────────────────────────────────────────
describe('detectValueRoundingBias', () => {
  it('passes for non-round value', () => {
    const result = detectValueRoundingBias(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags round appraised value', () => {
    const input = makeInput({ appraisedValue: 450000 });
    const result = detectValueRoundingBias(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('low');
  });
});

// ─── detectAdjustmentSymmetry ────────────────────────────────────────
describe('detectAdjustmentSymmetry', () => {
  it('passes with mixed adjustment directions', () => {
    const result = detectAdjustmentSymmetry(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags all-positive net adjustments', () => {
    const input = makeInput({
      comps: [
        { address: '100 A St', salePrice: 400000, saleDate: '2025-11-01', distanceFromSubjectMiles: 0.8, adjustments: { netAdjustmentTotal: 25000, grossAdjustmentTotal: 25000 } },
        { address: '200 B St', salePrice: 410000, saleDate: '2025-10-15', distanceFromSubjectMiles: 1.2, adjustments: { netAdjustmentTotal: 15000, grossAdjustmentTotal: 15000 } },
        { address: '300 C St', salePrice: 395000, saleDate: '2025-09-20', distanceFromSubjectMiles: 1.5, adjustments: { netAdjustmentTotal: 30000, grossAdjustmentTotal: 30000 } },
      ],
    });
    const result = detectAdjustmentSymmetry(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('positive');
  });

  it('flags excessive gross adjustments', () => {
    const input = makeInput({
      comps: [
        { address: '100 A St', salePrice: 400000, saleDate: '2025-11-01', distanceFromSubjectMiles: 0.8, adjustments: { netAdjustmentTotal: 5000, grossAdjustmentTotal: 120000 } },
        { address: '200 B St', salePrice: 410000, saleDate: '2025-10-15', distanceFromSubjectMiles: 1.2, adjustments: { netAdjustmentTotal: -3000, grossAdjustmentTotal: 8000 } },
        { address: '300 C St', salePrice: 395000, saleDate: '2025-09-20', distanceFromSubjectMiles: 1.5, adjustments: { netAdjustmentTotal: -2000, grossAdjustmentTotal: 5000 } },
      ],
    });
    const result = detectAdjustmentSymmetry(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('gross');
  });
});

// ─── detectCompStaleness ─────────────────────────────────────────────
describe('detectCompStaleness', () => {
  it('passes when all comps recent', () => {
    const result = detectCompStaleness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags stale comps over 12 months old', () => {
    const input = makeInput();
    input.comps[2] = { ...input.comps[2], saleDate: '2024-06-01' };
    const result = detectCompStaleness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('flags high severity when all comps are stale', () => {
    const input = makeInput({
      comps: [
        { address: '100 A St', salePrice: 400000, saleDate: '2024-06-01', distanceFromSubjectMiles: 0.8 },
        { address: '200 B St', salePrice: 410000, saleDate: '2024-05-15', distanceFromSubjectMiles: 1.2 },
        { address: '300 C St', salePrice: 395000, saleDate: '2024-04-20', distanceFromSubjectMiles: 1.5 },
      ],
    });
    const result = detectCompStaleness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });
});

// ─── Registry ────────────────────────────────────────────────────────
describe('ENHANCED_FRAUD_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(ENHANCED_FRAUD_EVALUATORS)).toHaveLength(6);
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectSerialFlip');
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectCompClustering');
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectPerfectMatchComps');
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectValueRoundingBias');
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectAdjustmentSymmetry');
    expect(ENHANCED_FRAUD_EVALUATORS).toHaveProperty('detectCompStaleness');
  });
});

// ─── Aggregate Service ──────────────────────────────────────────────
describe('EnhancedFraudDetectionService.performReview', () => {
  it('returns pass for clean data', () => {
    const svc = new EnhancedFraudDetectionService();
    const report = svc.performReview('order-fraud-1', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail for serial flip', () => {
    const input = makeInput({
      subject: {
        currentSalePrice: 500000,
        currentSaleDate: '2026-01-15',
        priorSalePrice: 350000,
        priorSaleDate: '2025-09-01',
      },
    });
    const svc = new EnhancedFraudDetectionService();
    const report = svc.performReview('order-fraud-2', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThan(0);
  });
});
