/**
 * @file tests/zoning-site-review.test.ts
 * @description Phase 2.5 — Zoning & Site Analysis Review Tests
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkZoningCompliance,
  checkFloodZoneDocumentation,
  checkHbuAnalysis,
  checkUtilityDocumentation,
  checkSiteDimensionConsistency,
  checkLegalDescriptionPresence,
  ZONING_SITE_EVALUATORS,
  ZoningSiteReviewService,
  ZoningSiteReviewInput,
} from '../src/services/zoning-site-review.service';

beforeAll(() => { console.log('🧪 Setting up test environment...'); console.log('✅ Test environment ready'); });
afterAll(() => { console.log('🧹 Cleaning up test environment...'); console.log('✅ Test cleanup complete'); });

function makeInput(overrides?: Partial<ZoningSiteReviewInput>): ZoningSiteReviewInput {
  return {
    site: {
      lotSizeSqFt: 8500,
      siteDimensions: '85x100',
      siteShape: 'Rectangular',
      zoningDescription: 'Single family residential',
      locationRating: 'Neutral',
      siteAreaUnit: 'sf',
    },
    zoning: {
      zoning: 'R-1',
      zoningCompliance: 'Legal',
      zoningDescription: 'Single family residential zoning district',
      propertyType: 'SFR',
    },
    flood: {
      floodZone: 'X',
      floodMapNumber: '06037C1625F',
      floodMapDate: '2021-09-26',
    },
    hbu: {
      highestAndBestUseAnalysis: {
        asVacant: {
          legallyPermissible: { passed: true, narrative: 'Zoning permits single family residential development.', supportingEvidence: 'R-1 zoning ordinance' },
          physicallyPossible: { passed: true, narrative: 'Size, shape, and topography support residential use.', supportingEvidence: null },
          financiallyFeasible: { passed: true, narrative: 'Demand for SFR in this market supports development.', supportingEvidence: null },
          maximallyProductive: { passed: true, narrative: 'Single family use is the maximally productive use.', supportingEvidence: null },
        },
        asImproved: {
          legallyPermissible: { passed: true, narrative: 'Current use is legally permissible under R-1 zoning.', supportingEvidence: null },
          physicallyPossible: { passed: true, narrative: 'Existing improvements are adequate for continued use.', supportingEvidence: null },
          financiallyFeasible: { passed: true, narrative: 'Continued use as SFR is financially feasible.', supportingEvidence: null },
          maximallyProductive: { passed: true, narrative: 'Current residential use is the maximally productive use.', supportingEvidence: null },
        },
        conclusion: 'The highest and best use of the subject property as improved is its current use as a single-family residence.',
        currentUseIsHbu: true,
      },
    },
    utilities: {
      utilities: {
        electricity: 'Public',
        gas: 'Public',
        water: 'Public',
        sewer: 'Public',
      },
    },
    ...overrides,
  };
}

// ─── checkZoningCompliance ───────────────────────────────────────────
describe('checkZoningCompliance', () => {
  it('passes when zoning is documented and legal', () => {
    const result = checkZoningCompliance(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when zoning classification and description are both missing', () => {
    const input = makeInput({ zoning: { zoning: null, zoningDescription: null, zoningCompliance: null } });
    const result = checkZoningCompliance(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags critical when zoning compliance is Illegal', () => {
    const input = makeInput({ zoning: { ...makeInput().zoning, zoningCompliance: 'Illegal' } });
    const result = checkZoningCompliance(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags medium when zoning is legal non-conforming', () => {
    const input = makeInput({ zoning: { ...makeInput().zoning, zoningCompliance: 'LegalNonConforming' } });
    const result = checkZoningCompliance(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── checkFloodZoneDocumentation ─────────────────────────────────────
describe('checkFloodZoneDocumentation', () => {
  it('passes when all flood data is documented and low-risk zone', () => {
    const result = checkFloodZoneDocumentation(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when flood zone is missing', () => {
    const input = makeInput({ flood: { floodZone: null, floodMapNumber: '06037C1625F', floodMapDate: '2021-09-26' } });
    const result = checkFloodZoneDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('fails when flood map number is missing', () => {
    const input = makeInput({ flood: { floodZone: 'X', floodMapNumber: null, floodMapDate: '2021-09-26' } });
    const result = checkFloodZoneDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags medium for high-risk flood zone', () => {
    const input = makeInput({ flood: { floodZone: 'AE', floodMapNumber: '06037C1625F', floodMapDate: '2021-09-26' } });
    const result = checkFloodZoneDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('high-risk');
  });
});

// ─── checkHbuAnalysis ────────────────────────────────────────────────
describe('checkHbuAnalysis', () => {
  it('passes when full four-test framework is documented', () => {
    const result = checkHbuAnalysis(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails critical when HBU analysis is missing entirely', () => {
    const input = makeInput({ hbu: { highestAndBestUseAnalysis: null } });
    const result = checkHbuAnalysis(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags when as-improved tests lack narrative', () => {
    const input = makeInput();
    input.hbu.highestAndBestUseAnalysis!.asImproved!.legallyPermissible = { passed: true, narrative: '', supportingEvidence: null };
    const result = checkHbuAnalysis(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('narrative');
  });

  it('flags when conclusion is missing', () => {
    const input = makeInput();
    input.hbu.highestAndBestUseAnalysis!.conclusion = null;
    const result = checkHbuAnalysis(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('conclusion');
  });
});

// ─── checkUtilityDocumentation ───────────────────────────────────────
describe('checkUtilityDocumentation', () => {
  it('passes when all utilities are documented', () => {
    const result = checkUtilityDocumentation(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when utilities block is null', () => {
    const input = makeInput({ utilities: { utilities: null } });
    const result = checkUtilityDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('flags missing individual utilities', () => {
    const input = makeInput({ utilities: { utilities: { electricity: 'Public', gas: 'Public' } } });
    const result = checkUtilityDocumentation(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('water');
  });
});

// ─── checkSiteDimensionConsistency ───────────────────────────────────
describe('checkSiteDimensionConsistency', () => {
  it('passes for reasonable lot size', () => {
    const result = checkSiteDimensionConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when lot size is missing', () => {
    const input = makeInput({ site: { ...makeInput().site, lotSizeSqFt: 0 } });
    const result = checkSiteDimensionConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('flags very large lots for unit verification', () => {
    const input = makeInput({ site: { ...makeInput().site, lotSizeSqFt: 300000, siteAreaUnit: 'sf' } });
    const result = checkSiteDimensionConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('acres');
  });
});

// ─── checkLegalDescriptionPresence ───────────────────────────────────
describe('checkLegalDescriptionPresence', () => {
  it('passes when zoning description is present', () => {
    const result = checkLegalDescriptionPresence(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when zoning description is missing', () => {
    const input = makeInput({ zoning: { ...makeInput().zoning, zoningDescription: null } });
    const result = checkLegalDescriptionPresence(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });
});

// ─── Registry ────────────────────────────────────────────────────────
describe('ZONING_SITE_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(ZONING_SITE_EVALUATORS)).toHaveLength(6);
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkZoningCompliance');
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkFloodZoneDocumentation');
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkHbuAnalysis');
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkUtilityDocumentation');
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkSiteDimensionConsistency');
    expect(ZONING_SITE_EVALUATORS).toHaveProperty('checkLegalDescriptionPresence');
  });
});

// ─── Aggregate Service ──────────────────────────────────────────────
describe('ZoningSiteReviewService.performReview', () => {
  it('returns pass for a well-documented site', () => {
    const svc = new ZoningSiteReviewService();
    const report = svc.performReview('order-zs-1', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail for critical issues', () => {
    const input = makeInput({ hbu: { highestAndBestUseAnalysis: null } });
    const svc = new ZoningSiteReviewService();
    const report = svc.performReview('order-zs-2', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThan(0);
  });
});
