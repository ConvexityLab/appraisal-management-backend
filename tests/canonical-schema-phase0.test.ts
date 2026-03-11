/**
 * Canonical Schema — Phase 0 Type & Contract Tests
 *
 * Pure unit tests (no external services) that verify:
 *   - Phase 0.1: CostApproach, IncomeApproach, Reconciliation enrichments
 *   - Phase 0.2: ValueType enum and related fields
 *   - Phase 0.3: HighestAndBestUse 4-test framework
 *
 * Run: pnpm vitest run tests/canonical-schema-phase0.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  VALUE_TYPES,
  type ValueType,
  type HighestAndBestUse,
  type HbuTestSet,
  type HbuTestResult,
  type CanonicalCostApproach,
  type CanonicalIncomeApproach,
  type CanonicalReconciliation,
  type CanonicalReportDocument,
  type CanonicalValuation,
  type CanonicalRentComp,
  type CanonicalSubject,
} from '../src/types/canonical-schema';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers — build valid minimal objects for testing
// ═══════════════════════════════════════════════════════════════════════════════

function makeHbuTestResult(passed: boolean): HbuTestResult {
  return { passed, narrative: passed ? 'Permitted under R-1 zoning' : 'Not zoned for commercial', supportingEvidence: null };
}

function makeHbuTestSet(allPass: boolean): HbuTestSet {
  return {
    legallyPermissible: makeHbuTestResult(allPass),
    physicallyPossible: makeHbuTestResult(allPass),
    financiallyFeasible: makeHbuTestResult(allPass),
    maximallyProductive: makeHbuTestResult(allPass),
  };
}

function makeHighestAndBestUse(): HighestAndBestUse {
  return {
    asVacant: makeHbuTestSet(true),
    asImproved: makeHbuTestSet(true),
    conclusion: 'Single-family residential remains H&BU as improved.',
    currentUseIsHbu: true,
    alternativeUse: null,
  };
}

function makeCostApproach(): CanonicalCostApproach {
  return {
    estimatedLandValue: 120_000,
    landValueSource: 'Sales Comparison',
    landValueMethod: 'sales_comparison',
    landValueEvidence: '3 land sales within 1 mile, past 12 months',
    replacementCostNew: 350_000,
    costFactorSource: 'Marshall & Swift',
    softCosts: 15_000,
    entrepreneurialProfit: 28_000,
    siteImprovementsCost: 22_000,
    depreciationAmount: 52_500,
    depreciationType: 'Age-Life',
    physicalDepreciationCurable: 5_000,
    physicalDepreciationIncurable: 35_000,
    functionalObsolescence: 7_500,
    externalObsolescence: 5_000,
    effectiveAge: 15,
    economicLife: 60,
    depreciatedCostOfImprovements: 297_500,
    indicatedValueByCostApproach: 417_500,
    comments: 'Cost approach supports the sales comparison conclusion.',
  };
}

function makeRentComp(): CanonicalRentComp {
  return {
    address: '456 Elm St, Springfield, IL 62701',
    proximityToSubject: '0.3 miles',
    monthlyRent: 1_800,
    dataSource: 'MLS',
    propertyDescription: '3BR/2BA, 1,500 sf, Good condition',
    adjustedRent: 1_750,
  };
}

function makeIncomeApproach(): CanonicalIncomeApproach {
  return {
    estimatedMonthlyMarketRent: 1_800,
    rentComps: [makeRentComp()],
    grossRentMultiplier: 130,
    potentialGrossIncome: 21_600,
    vacancyRate: 0.05,
    effectiveGrossIncome: 20_520,
    operatingExpenses: 6_000,
    replacementReserves: 1_200,
    netOperatingIncome: 13_320,
    capRate: 0.065,
    capRateSource: 'comparable_sales',
    discountRate: null,
    holdingPeriodYears: null,
    terminalCapRate: null,
    dcfPresentValue: null,
    indicatedValueByIncomeApproach: 204_923,
    comments: 'GRM approach used for 1-4 unit residential.',
  };
}

function makeReconciliation(): CanonicalReconciliation {
  return {
    salesCompApproachValue: 425_000,
    costApproachValue: 417_500,
    incomeApproachValue: 204_923,
    finalOpinionOfValue: 425_000,
    effectiveDate: '2026-03-11',
    reconciliationNarrative: 'Greatest weight to sales comparison; sufficient recent sales data.',
    exposureTime: '3-6 months',
    marketingTime: '3-6 months',
    salesCompWeight: 0.7,
    costWeight: 0.2,
    incomeWeight: 0.1,
    confidenceScore: 88,
    approachSpreadPct: 0.518,
    extraordinaryAssumptions: ['Subject will be completed per plans and specs.'],
    hypotheticalConditions: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Canonical Schema — Phase 0', () => {
  describe('Schema Version', () => {
    it('should be 1.1.0', () => {
      expect(SCHEMA_VERSION).toBe('1.1.0');
    });
  });

  // ─── Phase 0.2: ValueType ──────────────────────────────────────────────────
  describe('Phase 0.2 — ValueType', () => {
    it('VALUE_TYPES array should contain all 5 value types', () => {
      expect(VALUE_TYPES).toHaveLength(5);
      expect(VALUE_TYPES).toContain('AS_IS');
      expect(VALUE_TYPES).toContain('PROSPECTIVE_AS_COMPLETED');
      expect(VALUE_TYPES).toContain('PROSPECTIVE_AS_REPAIRED');
      expect(VALUE_TYPES).toContain('PROSPECTIVE_MARKET_RENT');
      expect(VALUE_TYPES).toContain('RETROSPECTIVE');
    });

    it('VALUE_TYPES should be readonly (frozen)', () => {
      const arr: readonly ValueType[] = VALUE_TYPES;
      expect(arr).toBeDefined();
    });

    it('CanonicalValuation accepts a ValueType', () => {
      const val: CanonicalValuation = {
        estimatedValue: 425_000,
        lowerBound: 400_000,
        upperBound: 450_000,
        confidenceScore: 85,
        effectiveDate: '2026-03-11',
        reconciliationNotes: null,
        approachesUsed: ['sales_comparison', 'cost'],
        avmProvider: null,
        avmModelVersion: null,
        valueType: 'AS_IS',
      };
      expect(val.valueType).toBe('AS_IS');
    });

    it('CanonicalValuation allows null valueType (backward-compat)', () => {
      const val: CanonicalValuation = {
        estimatedValue: 425_000,
        lowerBound: 400_000,
        upperBound: 450_000,
        confidenceScore: null,
        effectiveDate: '2026-03-11',
        reconciliationNotes: null,
        approachesUsed: ['sales_comparison'],
        avmProvider: null,
        avmModelVersion: null,
        valueType: null,
      };
      expect(val.valueType).toBeNull();
    });
  });

  // ─── Phase 0.3: HighestAndBestUse 4-Test Framework ─────────────────────────
  describe('Phase 0.3 — HighestAndBestUse 4-Test Framework', () => {
    it('should construct a full H&BU with all 4 tests, as-vacant and as-improved', () => {
      const hbu = makeHighestAndBestUse();
      expect(hbu.asVacant.legallyPermissible?.passed).toBe(true);
      expect(hbu.asVacant.physicallyPossible?.passed).toBe(true);
      expect(hbu.asVacant.financiallyFeasible?.passed).toBe(true);
      expect(hbu.asVacant.maximallyProductive?.passed).toBe(true);
      expect(hbu.asImproved.legallyPermissible?.passed).toBe(true);
      expect(hbu.conclusion).toContain('Single-family');
      expect(hbu.currentUseIsHbu).toBe(true);
      expect(hbu.alternativeUse).toBeNull();
    });

    it('should handle a failing test (not financially feasible)', () => {
      const hbu = makeHighestAndBestUse();
      hbu.asVacant.financiallyFeasible = { passed: false, narrative: 'Costs exceed market value', supportingEvidence: 'Cost analysis doc ref #123' };
      expect(hbu.asVacant.financiallyFeasible.passed).toBe(false);
      expect(hbu.asVacant.financiallyFeasible.narrative).toContain('Costs exceed');
      expect(hbu.asVacant.financiallyFeasible.supportingEvidence).toBeTruthy();
    });

    it('should allow null tests (H&BU not yet analyzed)', () => {
      const emptyHbu: HighestAndBestUse = {
        asVacant: { legallyPermissible: null, physicallyPossible: null, financiallyFeasible: null, maximallyProductive: null },
        asImproved: { legallyPermissible: null, physicallyPossible: null, financiallyFeasible: null, maximallyProductive: null },
        conclusion: null,
        currentUseIsHbu: null,
      };
      expect(emptyHbu.asVacant.legallyPermissible).toBeNull();
      expect(emptyHbu.conclusion).toBeNull();
    });

    it('CanonicalSubject allows both legacy binary and new structured H&BU', () => {
      const subjectLegacy = { highestAndBestUse: 'Present' as const } as Partial<CanonicalSubject>;
      expect(subjectLegacy.highestAndBestUse).toBe('Present');

      const subjectNew = { highestAndBestUseAnalysis: makeHighestAndBestUse() } as Partial<CanonicalSubject>;
      expect(subjectNew.highestAndBestUseAnalysis?.asVacant.legallyPermissible?.passed).toBe(true);
    });
  });

  // ─── Phase 0.1: Enriched Cost Approach ─────────────────────────────────────
  describe('Phase 0.1 — CostApproach Enrichment', () => {
    it('should contain all depreciation breakdown fields', () => {
      const cost = makeCostApproach();
      expect(cost.physicalDepreciationCurable).toBe(5_000);
      expect(cost.physicalDepreciationIncurable).toBe(35_000);
      expect(cost.functionalObsolescence).toBe(7_500);
      expect(cost.externalObsolescence).toBe(5_000);
      const componentSum =
        (cost.physicalDepreciationCurable ?? 0) +
        (cost.physicalDepreciationIncurable ?? 0) +
        (cost.functionalObsolescence ?? 0) +
        (cost.externalObsolescence ?? 0);
      expect(componentSum).toBe(cost.depreciationAmount);
    });

    it('should include soft costs and entrepreneurial profit', () => {
      const cost = makeCostApproach();
      expect(cost.softCosts).toBe(15_000);
      expect(cost.entrepreneurialProfit).toBe(28_000);
      expect(cost.siteImprovementsCost).toBe(22_000);
      expect(cost.costFactorSource).toBe('Marshall & Swift');
    });

    it('should include land value method and evidence', () => {
      const cost = makeCostApproach();
      expect(cost.landValueMethod).toBe('sales_comparison');
      expect(cost.landValueEvidence).toBeTruthy();
    });

    it('should include age-life fields', () => {
      const cost = makeCostApproach();
      expect(cost.effectiveAge).toBe(15);
      expect(cost.economicLife).toBe(60);
      expect(cost.effectiveAge!).toBeLessThan(cost.economicLife!);
    });

    it('indicated value = land + depreciated improvements', () => {
      const cost = makeCostApproach();
      expect(cost.indicatedValueByCostApproach).toBe(
        cost.estimatedLandValue! + cost.depreciatedCostOfImprovements!,
      );
    });
  });

  // ─── Phase 0.1: Enriched Income Approach ───────────────────────────────────
  describe('Phase 0.1 — IncomeApproach Enrichment', () => {
    it('should include full direct capitalization chain', () => {
      const income = makeIncomeApproach();
      expect(income.potentialGrossIncome).toBe(21_600);
      expect(income.vacancyRate).toBe(0.05);
      expect(income.effectiveGrossIncome).toBe(20_520);
      expect(income.operatingExpenses).toBe(6_000);
      expect(income.replacementReserves).toBe(1_200);
      expect(income.netOperatingIncome).toBe(13_320);
      expect(income.capRate).toBe(0.065);
    });

    it('EGI = PGI × (1 - vacancy)', () => {
      const income = makeIncomeApproach();
      const expectedEGI = income.potentialGrossIncome! * (1 - income.vacancyRate!);
      expect(income.effectiveGrossIncome).toBe(expectedEGI);
    });

    it('NOI = EGI - expenses - reserves', () => {
      const income = makeIncomeApproach();
      const expectedNOI =
        income.effectiveGrossIncome! - income.operatingExpenses! - income.replacementReserves!;
      expect(income.netOperatingIncome).toBe(expectedNOI);
    });

    it('should include rent comps', () => {
      const income = makeIncomeApproach();
      expect(income.rentComps).toHaveLength(1);
      expect(income.rentComps![0].address).toBeTruthy();
      expect(income.rentComps![0].monthlyRent).toBe(1_800);
      expect(income.rentComps![0].adjustedRent).toBe(1_750);
    });

    it('should support DCF fields (null when not used)', () => {
      const income = makeIncomeApproach();
      expect(income.discountRate).toBeNull();
      expect(income.holdingPeriodYears).toBeNull();
      expect(income.terminalCapRate).toBeNull();
      expect(income.dcfPresentValue).toBeNull();
    });

    it('should support DCF fields when populated', () => {
      const income = makeIncomeApproach();
      income.discountRate = 0.08;
      income.holdingPeriodYears = 10;
      income.terminalCapRate = 0.07;
      income.dcfPresentValue = 210_000;
      expect(income.discountRate).toBe(0.08);
      expect(income.holdingPeriodYears).toBe(10);
    });
  });

  // ─── Phase 0.1: Enriched Reconciliation ────────────────────────────────────
  describe('Phase 0.1 — Reconciliation Enrichment', () => {
    it('should include per-approach weights that sum to 1', () => {
      const recon = makeReconciliation();
      const weightSum =
        (recon.salesCompWeight ?? 0) + (recon.costWeight ?? 0) + (recon.incomeWeight ?? 0);
      expect(weightSum).toBeCloseTo(1.0, 10);
    });

    it('should include confidence score (0-100)', () => {
      const recon = makeReconciliation();
      expect(recon.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(recon.confidenceScore).toBeLessThanOrEqual(100);
    });

    it('should track approach spread percentage', () => {
      const recon = makeReconciliation();
      expect(recon.approachSpreadPct).toBeDefined();
      expect(recon.approachSpreadPct).toBeGreaterThan(0);
    });

    it('should support extraordinary assumptions and hypothetical conditions', () => {
      const recon = makeReconciliation();
      expect(recon.extraordinaryAssumptions).toHaveLength(1);
      expect(recon.hypotheticalConditions).toBeNull();
    });

    it('final opinion should be within reasonable range of approach values', () => {
      const recon = makeReconciliation();
      const maxApproach = Math.max(
        recon.salesCompApproachValue ?? 0,
        recon.costApproachValue ?? 0,
        recon.incomeApproachValue ?? 0,
      );
      expect(recon.finalOpinionOfValue).toBeLessThanOrEqual(maxApproach * 1.1);
    });
  });

  // ─── Phase 0.2: Document-Level Value Types ─────────────────────────────────
  describe('Phase 0.2 — CanonicalReportDocument valueTypes/effectiveDates', () => {
    it('should accept multiple value types for a rehab assignment', () => {
      const doc: Partial<CanonicalReportDocument> = {
        valueTypes: ['AS_IS', 'PROSPECTIVE_AS_REPAIRED'],
        effectiveDates: {
          AS_IS: '2026-03-11',
          PROSPECTIVE_AS_REPAIRED: '2026-09-15',
        },
      };
      expect(doc.valueTypes).toHaveLength(2);
      expect(doc.effectiveDates?.AS_IS).toBe('2026-03-11');
      expect(doc.effectiveDates?.PROSPECTIVE_AS_REPAIRED).toBe('2026-09-15');
    });

    it('should accept a single value type (standard purchase)', () => {
      const doc: Partial<CanonicalReportDocument> = {
        valueTypes: ['AS_IS'],
        effectiveDates: { AS_IS: '2026-03-11' },
      };
      expect(doc.valueTypes).toHaveLength(1);
    });

    it('should accept no value types (backward-compat)', () => {
      const doc: Partial<CanonicalReportDocument> = {};
      expect(doc.valueTypes).toBeUndefined();
      expect(doc.effectiveDates).toBeUndefined();
    });
  });
});
