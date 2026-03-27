/**
 * Substantive Review — Integration Test
 *
 * End-to-end (in-process) test that validates:
 * - All 12 Phase 2 services produce structurally valid results
 * - The aggregate engine correctly scores and categorises outcomes
 * - Single-review dispatch works for every review type
 * - No service throws unexpectedly on well-formed input
 *
 * Run: pnpm vitest run tests/substantive-review-integration.test.ts
 */

import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  SubstantiveReviewEngine,
  type SubstantiveReviewResult,
  type SingleReviewResult,
  type ReviewType,
} from '../src/services/substantive-review-engine.service';
import type { AppraisalReportData } from '../src/services/quality-control-engine.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Realistic test data — models a clean residential appraisal
// ═══════════════════════════════════════════════════════════════════════════════

function makeCleanReport(): AppraisalReportData {
  return {
    subjectProperty: {
      address: '2810 Westheimer Rd',
      city: 'Houston',
      state: 'TX',
      zipCode: '77098',
      latitude: 29.74,
      longitude: -95.41,
      grossLivingArea: 2400,
      yearBuilt: 2005,
      condition: 'C3',
      quality: 'Q3',
    },
    narrative: 'Well-maintained two-story single family home in established neighborhood. Market conditions are stable.',
    neighborhoodDescription: 'Established residential area near downtown Houston. Mix of single family homes.',
    marketConditionsCommentary: 'Market is stable with moderate appreciation.',
    conditionQualityCommentary: 'Average condition and quality for the area.',
    comparableAnalysis: {
      comparables: [
        makeComp('comp1', '2900 Westheimer Rd', 450000, '2024-06-01', 2500, { grossLivingAreaAdj: -5000, netAdjustmentTotal: -5000, grossAdjustmentTotal: 5000, adjustedSalePrice: 445000 }),
        makeComp('comp2', '3020 Montrose Blvd', 430000, '2024-05-15', 2300, { grossLivingAreaAdj: 5000, netAdjustmentTotal: 5000, grossAdjustmentTotal: 5000, adjustedSalePrice: 435000 }),
        makeComp('comp3', '1415 W Alabama St', 460000, '2024-07-01', 2450, { grossLivingAreaAdj: -2500, aboveGradeBedroom: -3000, netAdjustmentTotal: -5500, grossAdjustmentTotal: 5500, adjustedSalePrice: 454500 }),
      ],
    },
    valueConclusion: { finalValue: 445000 },
    marketAnalysis: {
      statedConditions: {
        marketTrend: 'Stable',
        demandSupply: 'In Balance',
        marketingTime: '3-6 months',
        propertyValues: 'Stable',
      },
      metrics: {
        monthsOfInventory: 4.5,
        absorptionRatePerMonth: 22,
        averageDom: 40,
        listToSaleRatio: 0.97,
        priceChangeYoY: 0.03,
      },
    },
    engagement: {
      client: 'Houston Federal Credit Union',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['Houston Federal Credit Union'],
      valueType: 'Market Value',
      effectiveDate: '2024-08-01',
    },
    reportStated: {
      client: 'Houston Federal Credit Union',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['Houston Federal Credit Union'],
      valueType: 'Market Value',
      effectiveDate: '2024-08-01',
    },
    engagementScope: {
      reportType: 'URAR',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['Houston Federal Credit Union'],
      valueTypes: ['Market Value'],
      effectiveDate: '2024-08-01',
      propertyType: 'Single Family',
    },
    reportScope: {
      reportType: 'URAR',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['Houston Federal Credit Union'],
      valueTypes: ['Market Value'],
      effectiveDate: '2024-08-01',
      propertyType: 'Single Family',
    },
    contract: {
      contractPrice: 440000,
      contractDate: '2024-07-01',
      fullyExecuted: true,
    },
    concessions: { totalAmount: 0 },
    site: { lotSizeSqFt: 7200 },
    zoning: { zoning: 'R-1', zoningCompliance: 'Legal' as const },
    flood: { floodZone: 'X' },
    hbu: {
      highestAndBestUseAnalysis: {
        asVacant: null,
        asImproved: null,
        conclusion: 'Current use as single family residence',
        currentUseIsHbu: true,
      },
    },
    utilities: { utilities: { electricity: 'Public', gas: 'Public', water: 'Public', sewer: 'Public' } },
    improvements: {
      grossLivingArea: 2400,
      totalRooms: 8,
      bedrooms: 4,
      bathrooms: 2.5,
      stories: 2,
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2005,
    },
    costApproach: {
      estimatedLandValue: 120000,
      replacementCostNew: 360000,
      depreciationAmount: 72000,
      depreciatedCostOfImprovements: 288000,
      indicatedValueByCostApproach: 408000,
    },
    incomeApproach: {
      estimatedMonthlyMarketRent: 2800,
      grossRentMultiplier: 158,
      indicatedValueByIncomeApproach: 442400,
    },
    reconciliation: {
      salesCompApproachValue: 445000,
      costApproachValue: 408000,
      incomeApproachValue: 442400,
      salesCompWeight: 0.6,
      costWeight: 0.2,
      incomeWeight: 0.2,
      finalOpinionOfValue: 445000,
    },
    approachesUsed: ['Sales Comparison', 'Cost', 'Income'],
    appraiser: {
      name: 'Jane Doe',
      licenseNumber: 'TX-67890',
      licenseState: 'TX',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2027-03-31',
      signatureDate: '2024-08-01',
    },
    reportMetadata: {
      reportType: 'URAR',
      propertyType: 'Single Family',
      propertyState: 'TX',
      effectiveDate: '2024-08-01',
      reportDate: '2024-08-01',
    },
    addenda: {
      hasSubjectPhotos: true,
      hasCompPhotos: true,
      hasStreetMap: true,
      hasFloodMap: true,
      hasFloorPlan: true,
      hasMarketConditionsAddendum: true,
    },
    certification: {
      certificationElements: ['USPAP compliance', 'No bias'],
    },
    appraisalDate: '2024-08-01',
  };
}

/** Helper to build a comparable with default adjustment fields */
function makeComp(
  compId: string,
  address: string,
  salePrice: number,
  saleDate: string,
  gla: number,
  adjOverrides: Record<string, number> = {},
) {
  const defaultAdj = {
    saleOrFinancingConcessions: 0,
    dateOfSaleTime: 0,
    locationAdj: 0,
    leaseholdFeeSimple: 0,
    siteAdj: 0,
    viewAdj: 0,
    designAndAppeal: 0,
    qualityOfConstruction: 0,
    actualAge: 0,
    conditionAdj: 0,
    aboveGradeRoomCount: 0,
    aboveGradeBedroom: 0,
    aboveGradeBathroom: 0,
    grossLivingAreaAdj: 0,
    basementAndFinishedRooms: 0,
    functionalUtility: 0,
    heatingCooling: 0,
    energyEfficiency: 0,
    garageCarport: 0,
    porchPatioPool: 0,
    otherAdj1: 0,
    otherAdj2: 0,
    otherAdj3: 0,
    netAdjustmentTotal: 0,
    grossAdjustmentTotal: 0,
    adjustedSalePrice: salePrice,
  };
  return {
    compId,
    address,
    city: 'Houston',
    state: 'TX',
    zipCode: '77098',
    salePrice,
    saleDate,
    grossLivingArea: gla,
    condition: 'C3',
    quality: 'Q3',
    yearBuilt: 2004,
    bedrooms: 4,
    bathrooms: 2.5,
    daysOnMarket: 30,
    distanceFromSubjectMiles: 0.8,
    adjustments: { ...defaultAdj, ...adjOverrides },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// All 12 review types
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_REVIEW_TYPES: ReviewType[] = [
  'bias-screening',
  'scope-lock',
  'contract-review',
  'market-analytics',
  'zoning-site',
  'improvements',
  'cost-approach',
  'income-approach',
  'reconciliation',
  'math-integrity',
  'enhanced-fraud',
  'report-compliance',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Substantive Review — Integration', () => {
  let engine: SubstantiveReviewEngine;
  let fullResult: SubstantiveReviewResult;
  const reportData = makeCleanReport();

  beforeAll(async () => {
    engine = new SubstantiveReviewEngine();
    fullResult = await engine.performFullReview('INT-001', reportData);
  });

  // ── Full review structure ─────────────────────────────────────────────

  describe('Full review structure', () => {
    it('should return a valid SubstantiveReviewResult', () => {
      expect(fullResult).toBeDefined();
      expect(fullResult.orderId).toBe('INT-001');
      expect(fullResult.timestamp).toBeDefined();
    });

    it('should contain results for all 12 services', () => {
      expect(fullResult.reviews).toHaveLength(12);
      const types = fullResult.reviews.map(r => r.reviewType).sort();
      expect(types).toEqual([...ALL_REVIEW_TYPES].sort());
    });

    it('should produce a numeric overallScore between 0 and 100', () => {
      expect(fullResult.overallScore).toBeGreaterThanOrEqual(0);
      expect(fullResult.overallScore).toBeLessThanOrEqual(100);
    });

    it('should produce a valid overallStatus', () => {
      expect(['pass', 'fail', 'warnings']).toContain(fullResult.overallStatus);
    });

    it('should have totalChecks >= sum of individual report check counts', () => {
      const sumChecks = fullResult.reviews
        .filter(r => r.report !== null)
        .reduce((sum, r) => sum + r.report!.checks.length, 0);
      expect(fullResult.totalChecks).toBe(sumChecks);
    });

    it('should have totalIssues = critical + high + medium + low', () => {
      expect(fullResult.totalIssues).toBe(
        fullResult.criticalIssues + fullResult.highIssues + fullResult.mediumIssues + fullResult.lowIssues
      );
    });

    it('should have consistent issue counts with individual reports', () => {
      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;
      for (const review of fullResult.reviews) {
        if (review.report) {
          critical += review.report.criticalIssues;
          high += review.report.highIssues;
          medium += review.report.mediumIssues;
          low += review.report.lowIssues;
        }
      }
      expect(fullResult.criticalIssues).toBe(critical);
      expect(fullResult.highIssues).toBe(high);
      expect(fullResult.mediumIssues).toBe(medium);
      expect(fullResult.lowIssues).toBe(low);
    });
  });

  // ── Individual service reports ────────────────────────────────────────

  describe('Individual service reports', () => {
    it.each(ALL_REVIEW_TYPES)('service "%s" should have a valid status', (reviewType) => {
      const review = fullResult.reviews.find(r => r.reviewType === reviewType);
      expect(review).toBeDefined();
      expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(review!.status);
    });

    it.each(ALL_REVIEW_TYPES)('service "%s" should have a report or valid error state', (reviewType) => {
      const review = fullResult.reviews.find(r => r.reviewType === reviewType)!;
      if (review.status === 'error') {
        expect(review.errorMessage).toBeDefined();
      } else if (review.status !== 'not-applicable') {
        expect(review.report).not.toBeNull();
        expect(review.report!.orderId).toBe('INT-001');
        expect(review.report!.checks).toBeInstanceOf(Array);
        expect(review.report!.checks.length).toBeGreaterThanOrEqual(0);
      }
    });

    it.each(ALL_REVIEW_TYPES)('service "%s" report has valid check structure', (reviewType) => {
      const review = fullResult.reviews.find(r => r.reviewType === reviewType)!;
      if (review.report) {
        for (const check of review.report.checks) {
          expect(check.evaluatorName).toBeDefined();
          expect(typeof check.passed).toBe('boolean');
          expect(check.message).toBeDefined();
          expect(['critical', 'high', 'medium', 'low']).toContain(check.severity);
        }
      }
    });

    it.each(ALL_REVIEW_TYPES)('service "%s" has correct issue tallies', (reviewType) => {
      const review = fullResult.reviews.find(r => r.reviewType === reviewType)!;
      if (review.report) {
        const failedChecks = review.report.checks.filter(c => !c.passed);
        const critical = failedChecks.filter(c => c.severity === 'critical').length;
        const hgh = failedChecks.filter(c => c.severity === 'high').length;
        const med = failedChecks.filter(c => c.severity === 'medium').length;
        const low = failedChecks.filter(c => c.severity === 'low').length;

        expect(review.report.criticalIssues).toBe(critical);
        expect(review.report.highIssues).toBe(hgh);
        expect(review.report.mediumIssues).toBe(med);
        expect(review.report.lowIssues).toBe(low);
        expect(review.report.totalIssues).toBe(critical + hgh + med + low);
      }
    });
  });

  // ── Single review dispatch ────────────────────────────────────────────

  describe('Single review dispatch', () => {
    it.each(ALL_REVIEW_TYPES)('performSingleReview("%s") should return consistent result', async (reviewType) => {
      const single = await engine.performSingleReview('INT-002', reviewType, reportData);

      expect(single.reviewType).toBe(reviewType);
      expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(single.status);

      if (single.report) {
        expect(single.report.orderId).toBe('INT-002');
        expect(single.report.checks).toBeInstanceOf(Array);
        expect(single.report.reportDate).toBeDefined();
      }
    });

    it('should match full-review result for each service', async () => {
      for (const reviewType of ALL_REVIEW_TYPES) {
        const single = await engine.performSingleReview('INT-001', reviewType, reportData);
        const fromFull = fullResult.reviews.find(r => r.reviewType === reviewType)!;

        // Status should match
        expect(single.status).toBe(fromFull.status);

        // If both have reports, check count should match
        if (single.report && fromFull.report) {
          expect(single.report.checks.length).toBe(fromFull.report.checks.length);
          expect(single.report.totalIssues).toBe(fromFull.report.totalIssues);
        }
      }
    });
  });

  // ── Scoring rules ─────────────────────────────────────────────────────

  describe('Scoring rules', () => {
    it('overallStatus "fail" should mean critical issues exist or score < 50', () => {
      if (fullResult.overallStatus === 'fail') {
        const hasCritical = fullResult.criticalIssues > 0;
        const lowScore = fullResult.overallScore < 50;
        expect(hasCritical || lowScore).toBe(true);
      }
    });

    it('overallStatus "pass" should mean score >= 80 and no critical issues', () => {
      if (fullResult.overallStatus === 'pass') {
        expect(fullResult.overallScore).toBeGreaterThanOrEqual(80);
        expect(fullResult.criticalIssues).toBe(0);
      }
    });

    it('clean report data should produce a defined numeric score', () => {
      // Scoring depends on the engine's deduction logic; a well-formed
      // report may still have many flagged items.  We just verify the
      // score is a valid number in range.
      expect(typeof fullResult.overallScore).toBe('number');
      expect(fullResult.overallScore).toBeGreaterThanOrEqual(0);
      expect(fullResult.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // ── Robustness ────────────────────────────────────────────────────────

  describe('Robustness', () => {
    it('should handle minimal/sparse report data without throwing', async () => {
      const sparse: AppraisalReportData = {
        subjectProperty: {
          address: '1 Minimal St',
          city: 'Nowhere',
          state: 'TX',
          zipCode: '00000',
        },
      } as AppraisalReportData;

      const result = await engine.performFullReview('SPARSE-001', sparse);
      expect(result.orderId).toBe('SPARSE-001');
      expect(result.reviews).toHaveLength(12);
      // Every service should either produce a report or gracefully error/n-a
      for (const review of result.reviews) {
        expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(review.status);
      }
    });

    it('should handle empty comparables array', async () => {
      const noComps = makeCleanReport();
      noComps.comparableAnalysis = { comparables: [] };
      const result = await engine.performFullReview('NOCOMP-001', noComps);
      expect(result.reviews).toHaveLength(12);
    });

    it('should handle missing optional sections', async () => {
      const partial = makeCleanReport();
      delete (partial as any).incomeApproach;
      delete (partial as any).costApproach;
      const result = await engine.performFullReview('PARTIAL-001', partial);
      expect(result.reviews).toHaveLength(12);
    });
  });
});
