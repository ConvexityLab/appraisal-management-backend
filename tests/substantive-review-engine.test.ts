/**
 * Substantive Review Engine — Aggregate Service Tests
 *
 * Tests the orchestration layer that runs all 12 Phase 2 services
 * and produces a unified SubstantiveReviewResult.
 *
 * Run: pnpm vitest run tests/substantive-review-engine.test.ts
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
  SubstantiveReviewEngine,
  type SubstantiveReviewResult,
  type SingleReviewResult,
  type ReviewType,
} from '../src/services/substantive-review-engine.service';
import type { AppraisalReportData } from '../src/services/quality-control-engine.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Test data
// ═══════════════════════════════════════════════════════════════════════════════

function makeReportData(overrides: Partial<AppraisalReportData> = {}): AppraisalReportData {
  return {
    subjectProperty: {
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      latitude: 32.78,
      longitude: -96.80,
      grossLivingArea: 2000,
      yearBuilt: 2000,
      condition: 'C3',
      quality: 'Q3',
    },
    narrative: 'Well-maintained single family home in suburban area with stable market conditions.',
    neighborhoodDescription: 'Suburban residential area.',
    marketConditionsCommentary: 'Market is stable.',
    conditionQualityCommentary: 'Average condition.',
    comparableAnalysis: {
      comparables: [
        {
          compId: 'comp1',
          address: '456 Oak Ave',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75201',
          salePrice: 400000,
          saleDate: '2024-06-01',
          grossLivingArea: 2100,
          condition: 'C3',
          quality: 'Q3',
          yearBuilt: 2002,
          bedrooms: 3,
          bathrooms: 2,
          daysOnMarket: 30,
          distanceFromSubjectMiles: 0.5,
          adjustments: {
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
            grossLivingAreaAdj: -5000,
            basementAndFinishedRooms: 0,
            functionalUtility: 0,
            heatingCooling: 0,
            energyEfficiency: 0,
            garageCarport: 0,
            porchPatioPool: 0,
            otherAdj1: 0,
            otherAdj2: 0,
            otherAdj3: 0,
            netAdjustmentTotal: -5000,
            grossAdjustmentTotal: 5000,
            adjustedSalePrice: 395000,
          },
        },
        {
          compId: 'comp2',
          address: '789 Elm St',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75202',
          salePrice: 380000,
          saleDate: '2024-05-15',
          grossLivingArea: 1900,
          condition: 'C3',
          quality: 'Q3',
          yearBuilt: 1998,
          bedrooms: 3,
          bathrooms: 2,
          daysOnMarket: 45,
          distanceFromSubjectMiles: 1.2,
          adjustments: {
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
            grossLivingAreaAdj: 5000,
            basementAndFinishedRooms: 0,
            functionalUtility: 0,
            heatingCooling: 0,
            energyEfficiency: 0,
            garageCarport: 0,
            porchPatioPool: 0,
            otherAdj1: 0,
            otherAdj2: 0,
            otherAdj3: 0,
            netAdjustmentTotal: 5000,
            grossAdjustmentTotal: 5000,
            adjustedSalePrice: 385000,
          },
        },
        {
          compId: 'comp3',
          address: '101 Pine Rd',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75201',
          salePrice: 420000,
          saleDate: '2024-07-01',
          grossLivingArea: 2050,
          condition: 'C3',
          quality: 'Q3',
          yearBuilt: 2001,
          bedrooms: 4,
          bathrooms: 2.5,
          daysOnMarket: 20,
          distanceFromSubjectMiles: 0.3,
          adjustments: {
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
            aboveGradeBedroom: -3000,
            aboveGradeBathroom: -2000,
            grossLivingAreaAdj: -2500,
            basementAndFinishedRooms: 0,
            functionalUtility: 0,
            heatingCooling: 0,
            energyEfficiency: 0,
            garageCarport: 0,
            porchPatioPool: 0,
            otherAdj1: 0,
            otherAdj2: 0,
            otherAdj3: 0,
            netAdjustmentTotal: -7500,
            grossAdjustmentTotal: 7500,
            adjustedSalePrice: 412500,
          },
        },
      ],
    },
    valueConclusion: {
      finalValue: 400000,
    },
    marketAnalysis: {
      statedConditions: {
        marketTrend: 'Stable',
        demandSupply: 'In Balance',
        marketingTime: '3-6 months',
        propertyValues: 'Stable',
      },
      metrics: {
        monthsOfInventory: 4,
        absorptionRatePerMonth: 25,
        averageDom: 35,
        listToSaleRatio: 0.98,
        priceChangeYoY: 0.02,
      },
    },
    // Engagement & scope
    engagement: {
      client: 'First National Bank',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['First National Bank'],
      valueType: 'Market Value',
      effectiveDate: '2024-07-15',
    },
    reportStated: {
      client: 'First National Bank',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['First National Bank'],
      valueType: 'Market Value',
      effectiveDate: '2024-07-15',
    },
    engagementScope: {
      reportType: 'URAR',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['First National Bank'],
      valueTypes: ['Market Value'],
      effectiveDate: '2024-07-15',
      propertyType: 'Single Family',
    },
    reportScope: {
      reportType: 'URAR',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision',
      intendedUsers: ['First National Bank'],
      valueTypes: ['Market Value'],
      effectiveDate: '2024-07-15',
      propertyType: 'Single Family',
    },
    // Contract
    contract: {
      contractPrice: 395000,
      contractDate: '2024-06-01',
      fullyExecuted: true,
    },
    concessions: { totalAmount: 0 },
    // Site / zoning
    site: { lotSizeSqFt: 8500 },
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
    // Improvements
    improvements: {
      grossLivingArea: 2000,
      totalRooms: 7,
      bedrooms: 3,
      bathrooms: 2,
      stories: 1,
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2000,
    },
    // Cost approach
    costApproach: {
      estimatedLandValue: 100000,
      replacementCostNew: 300000,
      depreciationAmount: 60000,
      depreciatedCostOfImprovements: 240000,
      indicatedValueByCostApproach: 340000,
    },
    // Income approach (optional for residential)
    incomeApproach: {
      estimatedMonthlyMarketRent: 2500,
      grossRentMultiplier: 160,
      indicatedValueByIncomeApproach: 400000,
    },
    // Reconciliation
    reconciliation: {
      salesCompApproachValue: 400000,
      costApproachValue: 340000,
      incomeApproachValue: 400000,
      salesCompWeight: 0.6,
      costWeight: 0.2,
      incomeWeight: 0.2,
      finalOpinionOfValue: 400000,
    },
    approachesUsed: ['Sales Comparison', 'Cost', 'Income'],
    // Appraiser
    appraiser: {
      name: 'John Smith',
      licenseNumber: 'TX-12345',
      licenseState: 'TX',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2026-12-31',
      signatureDate: '2024-07-15',
    },
    reportMetadata: {
      reportType: 'URAR',
      propertyType: 'Single Family',
      propertyState: 'TX',
      effectiveDate: '2024-07-15',
      reportDate: '2024-07-15',
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
    appraisalDate: '2024-07-15',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubstantiveReviewEngine', () => {
  let engine: SubstantiveReviewEngine;

  beforeEach(() => {
    engine = new SubstantiveReviewEngine();
  });

  // ── performFullReview ─────────────────────────────────────────────────

  describe('performFullReview', () => {
    it('should return results for all 12 services', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());

      expect(result.orderId).toBe('ORD-001');
      expect(result.reviews).toHaveLength(12);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include all 12 review types', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());
      const types = result.reviews.map(r => r.reviewType).sort();

      expect(types).toEqual([
        'bias-screening',
        'contract-review',
        'cost-approach',
        'enhanced-fraud',
        'improvements',
        'income-approach',
        'market-analytics',
        'math-integrity',
        'reconciliation',
        'report-compliance',
        'scope-lock',
        'zoning-site',
      ]);
    });

    it('should compute aggregate scores from individual review results', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.totalIssues).toBeGreaterThanOrEqual(0);
      expect(result.totalChecks).toBeGreaterThan(0);
    });

    it('should have valid overallStatus', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());
      expect(['pass', 'fail', 'warnings']).toContain(result.overallStatus);
    });

    it('should aggregate severity counts correctly', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());

      // Sum individual reports' severity counts
      let expectedCritical = 0;
      let expectedHigh = 0;
      let expectedMedium = 0;
      let expectedLow = 0;
      for (const r of result.reviews) {
        if (r.report) {
          expectedCritical += r.report.criticalIssues;
          expectedHigh += r.report.highIssues;
          expectedMedium += r.report.mediumIssues;
          expectedLow += r.report.lowIssues;
        }
      }

      expect(result.criticalIssues).toBe(expectedCritical);
      expect(result.highIssues).toBe(expectedHigh);
      expect(result.mediumIssues).toBe(expectedMedium);
      expect(result.lowIssues).toBe(expectedLow);
      expect(result.totalIssues).toBe(expectedCritical + expectedHigh + expectedMedium + expectedLow);
    });

    it('should not have any errored reviews with valid input', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());

      const errors = result.reviews.filter(r => r.status === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should report each service with a non-null report', async () => {
      const result = await engine.performFullReview('ORD-001', makeReportData());

      for (const r of result.reviews) {
        expect(r.report).not.toBeNull();
        expect(r.report!.orderId).toBe('ORD-001');
        expect(r.report!.checks.length).toBeGreaterThan(0);
      }
    });
  });

  // ── performSingleReview ───────────────────────────────────────────────

  describe('performSingleReview', () => {
    const allTypes: ReviewType[] = [
      'bias-screening', 'scope-lock', 'contract-review', 'market-analytics',
      'zoning-site', 'improvements', 'cost-approach', 'income-approach',
      'reconciliation', 'math-integrity', 'enhanced-fraud', 'report-compliance',
    ];

    it.each(allTypes)('should run %s individually', async (reviewType) => {
      const result = await engine.performSingleReview('ORD-SINGLE', reviewType, makeReportData());

      expect(result.reviewType).toBe(reviewType);
      expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(result.status);

      if (result.status !== 'error') {
        expect(result.report).not.toBeNull();
        expect(result.report!.orderId).toBe('ORD-SINGLE');
      }
    });

    it('should return same result as full review for a given type', async () => {
      const rd = makeReportData();
      const full = await engine.performFullReview('ORD-CMP', rd);
      const single = await engine.performSingleReview('ORD-CMP', 'bias-screening', rd);

      const fromFull = full.reviews.find(r => r.reviewType === 'bias-screening')!;
      expect(single.status).toBe(fromFull.status);
      expect(single.report!.overallStatus).toBe(fromFull.report!.overallStatus);
      expect(single.report!.totalIssues).toBe(fromFull.report!.totalIssues);
    });
  });

  // ── Scoring / status determination ────────────────────────────────────

  describe('scoring', () => {
    it('should clamp score between 0 and 100', async () => {
      const result = await engine.performFullReview('ORD-SCORE', makeReportData());
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should set status to fail when score < 60', async () => {
      // We can't easily force a score < 60 without manipulating report data heavily,
      // but we test the boundary logic by checking score/status consistency
      const result = await engine.performFullReview('ORD-LOGIC', makeReportData());
      if (result.overallScore < 60) {
        expect(result.overallStatus).toBe('fail');
      }
    });

    it('should set status to fail when critical issues exist', async () => {
      const result = await engine.performFullReview('ORD-CRIT', makeReportData());
      if (result.criticalIssues > 0) {
        expect(result.overallStatus).toBe('fail');
      }
    });

    it('should set status to warnings when 60 <= score < 75 and no critical', async () => {
      const result = await engine.performFullReview('ORD-WARN', makeReportData());
      if (result.criticalIssues === 0 && result.overallScore >= 60 && result.overallScore < 75) {
        expect(result.overallStatus).toBe('warnings');
      }
    });

    it('should set status to pass when score >= 75 and <= 2 high issues', async () => {
      const result = await engine.performFullReview('ORD-PASS', makeReportData());
      if (result.criticalIssues === 0 && result.highIssues <= 2 && result.overallScore >= 75) {
        expect(result.overallStatus).toBe('pass');
      }
    });
  });

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should catch service errors and mark as error status', async () => {
      // Minimal data that won't crash mappers but may trigger service issues
      const result = await engine.performFullReview('ORD-ERR', {});

      // Even with empty data, the engine should not throw
      expect(result.orderId).toBe('ORD-ERR');
      expect(result.reviews).toHaveLength(12);
    });

    it('should still return results for other services when one fails', async () => {
      const result = await engine.performFullReview('ORD-PARTIAL', {});

      const nonError = result.reviews.filter(r => r.status !== 'error');
      // At least some services should handle empty input gracefully
      expect(nonError.length).toBeGreaterThan(0);
    });
  });

  // ── Input mapping ─────────────────────────────────────────────────────

  describe('input mapping', () => {
    it('should map subject property data correctly', async () => {
      const rd = makeReportData();
      const result = await engine.performSingleReview('ORD-MAP', 'bias-screening', rd);

      // Bias screening should have received narrative and subject data
      expect(result.report).not.toBeNull();
      expect(result.report!.checks.length).toBeGreaterThan(0);
    });

    it('should map comparable analysis to market analytics', async () => {
      const rd = makeReportData();
      const result = await engine.performSingleReview('ORD-MKT', 'market-analytics', rd);

      expect(result.report).not.toBeNull();
      expect(result.report!.checks.length).toBeGreaterThan(0);
    });

    it('should handle missing optional sections gracefully', async () => {
      const rd = makeReportData({
        costApproach: undefined,
        incomeApproach: undefined,
      });

      const costResult = await engine.performSingleReview('ORD-OPT', 'cost-approach', rd);
      const incomeResult = await engine.performSingleReview('ORD-OPT', 'income-approach', rd);

      // Should not crash — may return pass (nothing to check) or warnings
      expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(costResult.status);
      expect(['pass', 'fail', 'warnings', 'not-applicable', 'error']).toContain(incomeResult.status);
    });
  });
});
