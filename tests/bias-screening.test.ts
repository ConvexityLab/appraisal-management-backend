/**
 * ECOA/Fair Lending Bias Screening Service — Phase 2.2 Tests
 *
 * Tests all 7 bias evaluators and the aggregate screening report.
 * Per Fair Housing Act (42 U.S.C. § 3604-3606), ECOA (15 U.S.C. § 1691),
 * FHFA Appraisal Bias guidance, and Fannie Mae Selling Guide B4-1.4-08.
 *
 * Run: pnpm vitest run tests/bias-screening.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  BiasScreeningService,
  scanProhibitedFactors,
  scanSteeringLanguage,
  checkNeighborhoodNarrative,
  scanProtectedClassReferences,
  checkCompGeographicDiversity,
  checkLocationAdjustments,
  validateEngagementAlignment,
  BIAS_EVALUATORS,
  type BiasScreeningInput,
} from '../src/services/bias-screening.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeInput(overrides: Partial<BiasScreeningInput> = {}): BiasScreeningInput {
  return {
    narrative: 'The subject is a well-maintained single family residence in a suburban neighborhood with good access to schools and shopping.',
    neighborhoodDescription: 'Suburban residential area with stable property values.',
    marketConditionsCommentary: 'Market conditions are stable with balanced supply and demand.',
    conditionQualityCommentary: 'The property is in average condition with normal wear consistent with age.',
    subjectProperty: {
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      latitude: 32.78,
      longitude: -96.80,
    },
    comparables: [
      { address: '456 Oak Ave', city: 'Dallas', state: 'TX', zipCode: '75201', latitude: 32.79, longitude: -96.81, locationAdjustment: 2000, salePrice: 400000 },
      { address: '789 Elm St', city: 'Dallas', state: 'TX', zipCode: '75202', latitude: 32.77, longitude: -96.79, locationAdjustment: -1500, salePrice: 380000 },
      { address: '101 Pine Rd', city: 'Dallas', state: 'TX', zipCode: '75201', latitude: 32.78, longitude: -96.82, locationAdjustment: 0, salePrice: 420000 },
    ],
    engagement: {
      client: 'First National Bank',
      intendedUse: 'Mortgage lending decision',
      valueType: 'AS_IS',
      effectiveDate: '2026-03-01',
    },
    reportStated: {
      client: 'First National Bank',
      intendedUse: 'Mortgage lending decision',
      valueType: 'AS_IS',
      effectiveDate: '2026-03-01',
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. scanProhibitedFactors
// ═══════════════════════════════════════════════════════════════════════════════

describe('scanProhibitedFactors', () => {
  it('passes when narrative has no prohibited demographic terms', () => {
    const result = scanProhibitedFactors(makeInput());
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('fails when narrative references racial demographics', () => {
    const result = scanProhibitedFactors(makeInput({
      neighborhoodDescription: 'The area is a predominantly black neighborhood with older housing stock.',
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.details?.matches).toContain('predominantly black');
  });

  it('fails when market commentary references ethnic composition', () => {
    const result = scanProhibitedFactors(makeInput({
      marketConditionsCommentary: 'The ethnic composition of the area is primarily hispanic area residents.',
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.details?.matches).toContain('ethnic composition');
  });

  it('detects multiple prohibited terms', () => {
    const result = scanProhibitedFactors(makeInput({
      narrative: 'This is a minority area with racial makeup that is predominantly white.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matchCount).toBeGreaterThanOrEqual(2);
  });

  it('passes when text is empty', () => {
    const result = scanProhibitedFactors(makeInput({
      narrative: '',
      neighborhoodDescription: '',
      marketConditionsCommentary: '',
      conditionQualityCommentary: '',
    }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. scanSteeringLanguage
// ═══════════════════════════════════════════════════════════════════════════════

describe('scanSteeringLanguage', () => {
  it('passes with neutral market language', () => {
    const result = scanSteeringLanguage(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags "pride of ownership" coded phrase', () => {
    const result = scanSteeringLanguage(makeInput({
      neighborhoodDescription: 'Residents display a strong pride of ownership in this community.',
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.matches).toContain('pride of ownership');
  });

  it('flags "undesirable" characterizations', () => {
    const result = scanSteeringLanguage(makeInput({
      narrative: 'The adjacent commercial property is undesirable and impacts values.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('undesirable');
  });

  it('flags "ghetto" and "barrio" slurs', () => {
    const result = scanSteeringLanguage(makeInput({
      neighborhoodDescription: 'Property is near what locals call the ghetto area.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('ghetto');
  });

  it('flags safety-related coded language', () => {
    const result = scanSteeringLanguage(makeInput({
      neighborhoodDescription: 'This is a crime-ridden area with an unsafe neighborhood feel.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matchCount).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. checkNeighborhoodNarrative
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkNeighborhoodNarrative', () => {
  it('passes with data-supported market commentary', () => {
    const result = checkNeighborhoodNarrative(makeInput({
      marketConditionsCommentary: 'Market data shows a declining area with 14 months of inventory and average days on market of 95.',
    }));
    expect(result.passed).toBe(true);
    expect(result.details?.dataSupported).toBe(true);
  });

  it('flags "declining neighborhood" without data support', () => {
    const result = checkNeighborhoodNarrative(makeInput({
      neighborhoodDescription: 'This is a declining neighborhood with limited appeal.',
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.details?.dataSupported).toBe(false);
  });

  it('flags "in transition" without data support', () => {
    const result = checkNeighborhoodNarrative(makeInput({
      neighborhoodDescription: 'The area is in transition with uncertain market direction.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('in transition');
  });

  it('passes "up and coming" when absorption rate data is cited', () => {
    const result = checkNeighborhoodNarrative(makeInput({
      marketConditionsCommentary: 'The neighborhood is up and coming. Absorption rate data indicates 3-month supply with rising list-to-sale ratios.',
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when no trend language is present', () => {
    const result = checkNeighborhoodNarrative(makeInput());
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. scanProtectedClassReferences
// ═══════════════════════════════════════════════════════════════════════════════

describe('scanProtectedClassReferences', () => {
  it('passes with no protected class mentions', () => {
    const result = scanProtectedClassReferences(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags familial status references', () => {
    const result = scanProtectedClassReferences(makeInput({
      neighborhoodDescription: 'This is an adult only community with no children allowed.',
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags disability-related neighborhood descriptions', () => {
    const result = scanProtectedClassReferences(makeInput({
      neighborhoodDescription: 'There is a group home nearby which may affect values.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('group home nearby');
  });

  it('flags public assistance references', () => {
    const result = scanProtectedClassReferences(makeInput({
      neighborhoodDescription: 'Several section 8 tenants in the building.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('section 8');
  });

  it('flags religious proximity as value factor', () => {
    const result = scanProtectedClassReferences(makeInput({
      narrative: 'Value is impacted by location near mosque.',
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.matches).toContain('near mosque');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. checkCompGeographicDiversity
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkCompGeographicDiversity', () => {
  it('passes when comps span multiple zip codes including subject zip', () => {
    const result = checkCompGeographicDiversity(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when all comps are from a single zip different from subject', () => {
    const result = checkCompGeographicDiversity(makeInput({
      subjectProperty: { address: '123 Main', city: 'Dallas', state: 'TX', zipCode: '75201' },
      comparables: [
        { address: 'A', zipCode: '75225', salePrice: 400000 },
        { address: 'B', zipCode: '75225', salePrice: 410000 },
        { address: 'C', zipCode: '75225', salePrice: 390000 },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('geographic steering');
  });

  it('passes when all comps share subject zip code', () => {
    const result = checkCompGeographicDiversity(makeInput({
      subjectProperty: { address: '123 Main', city: 'Dallas', state: 'TX', zipCode: '75201' },
      comparables: [
        { address: 'A', zipCode: '75201', salePrice: 400000 },
        { address: 'B', zipCode: '75201', salePrice: 410000 },
      ],
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when fewer than 2 comparables are provided', () => {
    const result = checkCompGeographicDiversity(makeInput({
      comparables: [{ address: 'A', zipCode: '75225', salePrice: 400000 }],
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when no comparables are provided', () => {
    const result = checkCompGeographicDiversity(makeInput({ comparables: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. checkLocationAdjustments
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkLocationAdjustments', () => {
  it('passes with modest mixed-direction adjustments', () => {
    const result = checkLocationAdjustments(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when all location adjustments are large and same direction', () => {
    const result = checkLocationAdjustments(makeInput({
      comparables: [
        { address: 'A', locationAdjustment: -50000, salePrice: 400000 },
        { address: 'B', locationAdjustment: -55000, salePrice: 380000 },
        { address: 'C', locationAdjustment: -45000, salePrice: 420000 },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.direction).toBe('all-negative');
  });

  it('passes when adjustments are uniform but small', () => {
    const result = checkLocationAdjustments(makeInput({
      comparables: [
        { address: 'A', locationAdjustment: -2000, salePrice: 400000 },
        { address: 'B', locationAdjustment: -1500, salePrice: 380000 },
        { address: 'C', locationAdjustment: -1000, salePrice: 420000 },
      ],
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when fewer than 2 comps have location adjustments', () => {
    const result = checkLocationAdjustments(makeInput({
      comparables: [{ address: 'A', locationAdjustment: -50000, salePrice: 400000 }],
    }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. validateEngagementAlignment
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateEngagementAlignment', () => {
  it('passes when engagement and report match', () => {
    const result = validateEngagementAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when client name differs', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'First National Bank', intendedUse: 'Mortgage lending decision' },
      reportStated: { client: 'Second Regional Bank', intendedUse: 'Mortgage lending decision' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.mismatches).toHaveLength(1);
    expect(result.details?.mismatches[0]).toContain('Client');
  });

  it('fails when intended use differs', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'Acme Bank', intendedUse: 'Mortgage lending decision' },
      reportStated: { client: 'Acme Bank', intendedUse: 'Estate settlement' },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.mismatches[0]).toContain('Intended use');
  });

  it('fails when value type differs', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'Acme Bank', valueType: 'AS_IS' },
      reportStated: { client: 'Acme Bank', valueType: 'PROSPECTIVE_AS_COMPLETED' },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.mismatches[0]).toContain('Value type');
  });

  it('fails when effective date differs', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'Acme Bank', effectiveDate: '2026-03-01' },
      reportStated: { client: 'Acme Bank', effectiveDate: '2026-02-15' },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.mismatches[0]).toContain('Effective date');
  });

  it('detects multiple mismatches at once', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'Bank A', intendedUse: 'Lending', valueType: 'AS_IS', effectiveDate: '2026-03-01' },
      reportStated: { client: 'Bank B', intendedUse: 'Portfolio', valueType: 'RETROSPECTIVE', effectiveDate: '2026-01-01' },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.mismatches).toHaveLength(4);
  });

  it('passes when engagement data is not provided', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: undefined,
      reportStated: { client: 'Acme Bank' },
    }));
    expect(result.passed).toBe(true);
  });

  it('is case-insensitive for text comparisons', () => {
    const result = validateEngagementAlignment(makeInput({
      engagement: { client: 'FIRST NATIONAL BANK' },
      reportStated: { client: 'First National Bank' },
    }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Evaluator registry
// ═══════════════════════════════════════════════════════════════════════════════

describe('BIAS_EVALUATORS registry', () => {
  it('contains all 7 evaluators', () => {
    expect(Object.keys(BIAS_EVALUATORS)).toHaveLength(7);
    expect(BIAS_EVALUATORS).toHaveProperty('scanProhibitedFactors');
    expect(BIAS_EVALUATORS).toHaveProperty('scanSteeringLanguage');
    expect(BIAS_EVALUATORS).toHaveProperty('checkNeighborhoodNarrative');
    expect(BIAS_EVALUATORS).toHaveProperty('scanProtectedClassReferences');
    expect(BIAS_EVALUATORS).toHaveProperty('checkCompGeographicDiversity');
    expect(BIAS_EVALUATORS).toHaveProperty('checkLocationAdjustments');
    expect(BIAS_EVALUATORS).toHaveProperty('validateEngagementAlignment');
  });

  it('all evaluators are functions', () => {
    for (const evaluator of Object.values(BIAS_EVALUATORS)) {
      expect(typeof evaluator).toBe('function');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. BiasScreeningService.performScreening (aggregate)
// ═══════════════════════════════════════════════════════════════════════════════

describe('BiasScreeningService.performScreening', () => {
  let service: BiasScreeningService;

  beforeEach(() => {
    service = new BiasScreeningService();
  });

  it('returns pass when all checks pass', () => {
    const report = service.performScreening('ORD-001', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.criticalIssues).toBe(0);
    expect(report.orderId).toBe('ORD-001');
    expect(report.reportDate).toBeInstanceOf(Date);
    expect(report.checks).toHaveLength(7);
  });

  it('returns fail when critical issues found (prohibited demographics)', () => {
    const report = service.performScreening('ORD-002', makeInput({
      neighborhoodDescription: 'This is a predominantly black neighborhood.',
    }));
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
    expect(report.totalIssues).toBeGreaterThanOrEqual(1);
  });

  it('returns warnings for non-critical issues', () => {
    const report = service.performScreening('ORD-003', makeInput({
      neighborhoodDescription: 'Residents show great pride of ownership in the area.',
    }));
    expect(report.overallStatus).toBe('warnings');
    expect(report.highIssues).toBeGreaterThanOrEqual(1);
    expect(report.criticalIssues).toBe(0);
  });

  it('counts severity levels correctly across multiple failing checks', () => {
    const report = service.performScreening('ORD-004', makeInput({
      neighborhoodDescription: 'A predominantly hispanic area, pride of ownership is lacking, declining neighborhood.',
      engagement: { client: 'Bank A', intendedUse: 'Lending' },
      reportStated: { client: 'Bank B', intendedUse: 'Portfolio' },
    }));
    // critical: prohibited demographics
    // high: coded language + engagement mismatch
    // medium: unsupported trend claim
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
    expect(report.highIssues).toBeGreaterThanOrEqual(1);
    expect(report.totalIssues).toBeGreaterThanOrEqual(3);
  });

  it('runs all 7 evaluators and returns a check for each', () => {
    const report = service.performScreening('ORD-005', makeInput());
    const evaluatorNames = report.checks.map(c => c.evaluatorName);
    expect(evaluatorNames).toContain('scanProhibitedFactors');
    expect(evaluatorNames).toContain('scanSteeringLanguage');
    expect(evaluatorNames).toContain('checkNeighborhoodNarrative');
    expect(evaluatorNames).toContain('scanProtectedClassReferences');
    expect(evaluatorNames).toContain('checkCompGeographicDiversity');
    expect(evaluatorNames).toContain('checkLocationAdjustments');
    expect(evaluatorNames).toContain('validateEngagementAlignment');
  });
});
