/**
 * @file tests/market-analytics.test.ts
 * @description Tests for Phase 2.4 — Market Analytics Validation Service
 *
 * Validates appraiser's market condition claims against computed market metrics:
 * MOI, absorption rate, list-to-sale ratio, DOM aggregation, price trend,
 * and submarket boundary crossing detection.
 *
 * References: Fannie Mae B4-1.3-05, USPAP SR 1-3, UAD 3.6 market conditions
 */
import { describe, it, expect } from 'vitest';
import {
  validateMarketConditionsAlignment,
  validateDomConsistency,
  validateAbsorptionRate,
  validateListToSaleRatio,
  checkSubmarketBoundaryCrossing,
  validatePriceTrend,
  MARKET_ANALYTICS_EVALUATORS,
  MarketAnalyticsService,
  type MarketAnalyticsInput,
} from '../src/services/market-analytics.service';

function makeInput(overrides?: Partial<MarketAnalyticsInput>): MarketAnalyticsInput {
  return {
    statedConditions: {
      marketTrend: 'Stable',
      demandSupply: 'In Balance',
      marketingTime: '3-6 months',
      propertyValues: 'Stable',
    },
    marketMetrics: {
      monthsOfInventory: 5.0,
      absorptionRatePerMonth: 12,
      averageDom: 45,
      medianDom: 40,
      listToSaleRatio: 0.97,
      priceCutRate: 0.15,
      contractRatio: 0.55,
      priceChangeYoY: 0.02,
    },
    comps: [
      {
        compId: 'COMP-1',
        address: '123 Main St',
        zipCode: '75201',
        city: 'Dallas',
        county: 'Dallas',
        schoolDistrict: 'Dallas ISD',
        daysOnMarket: 42,
        listPrice: 410000,
        salePrice: 400000,
        saleDate: '2026-02-15',
      },
      {
        compId: 'COMP-2',
        address: '456 Oak Ave',
        zipCode: '75201',
        city: 'Dallas',
        county: 'Dallas',
        schoolDistrict: 'Dallas ISD',
        daysOnMarket: 38,
        listPrice: 425000,
        salePrice: 420000,
        saleDate: '2026-01-20',
      },
      {
        compId: 'COMP-3',
        address: '789 Elm Blvd',
        zipCode: '75201',
        city: 'Dallas',
        county: 'Dallas',
        schoolDistrict: 'Dallas ISD',
        daysOnMarket: 50,
        listPrice: 390000,
        salePrice: 385000,
        saleDate: '2026-03-01',
      },
    ],
    subject: {
      zipCode: '75201',
      city: 'Dallas',
      county: 'Dallas',
      schoolDistrict: 'Dallas ISD',
    },
    ...overrides,
  };
}

// ─── validateMarketConditionsAlignment ────────────────────────────────
describe('validateMarketConditionsAlignment', () => {
  it('passes when stated conditions align with metrics', () => {
    const result = validateMarketConditionsAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when stated trend is "Stable" but MOI indicates declining market', () => {
    const result = validateMarketConditionsAlignment(makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        monthsOfInventory: 9.0, // > 7 = declining
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('MOI');
  });

  it('fails when stated trend is "Stable" but metrics suggest increasing', () => {
    const result = validateMarketConditionsAlignment(makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        monthsOfInventory: 2.5, // < 3 = increasing
        priceChangeYoY: 0.08,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when stated conditions data is not provided', () => {
    const result = validateMarketConditionsAlignment(makeInput({
      statedConditions: undefined,
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when market metrics are not provided', () => {
    const result = validateMarketConditionsAlignment(makeInput({
      marketMetrics: undefined,
    }));
    expect(result.passed).toBe(true);
  });
});

// ─── validateDomConsistency ──────────────────────────────────────────
describe('validateDomConsistency', () => {
  it('passes when stated marketing time aligns with comp DOM', () => {
    const result = validateDomConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when stated marketing time is "Under 3 months" but comps average much higher', () => {
    const result = validateDomConsistency(makeInput({
      statedConditions: {
        ...makeInput().statedConditions,
        marketingTime: 'Under 3 months',
      },
      marketMetrics: {
        ...makeInput().marketMetrics,
        averageDom: 120,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('DOM');
  });

  it('fails when stated marketing time is "Over 6 months" but DOM is low', () => {
    const result = validateDomConsistency(makeInput({
      statedConditions: {
        ...makeInput().statedConditions,
        marketingTime: 'Over 6 months',
      },
      marketMetrics: {
        ...makeInput().marketMetrics,
        averageDom: 30,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('passes when marketing time is not stated', () => {
    const input = makeInput();
    delete input.statedConditions!.marketingTime;
    const result = validateDomConsistency(input);
    expect(result.passed).toBe(true);
  });
});

// ─── validateAbsorptionRate ──────────────────────────────────────────
describe('validateAbsorptionRate', () => {
  it('passes when absorption rate is reasonable', () => {
    const result = validateAbsorptionRate(makeInput());
    expect(result.passed).toBe(true);
  });

  it('warns when absorption rate is very low (< 4 per month)', () => {
    const result = validateAbsorptionRate(makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        absorptionRatePerMonth: 2,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('absorption');
  });

  it('passes when market metrics not provided', () => {
    const result = validateAbsorptionRate(makeInput({ marketMetrics: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ─── validateListToSaleRatio ─────────────────────────────────────────
describe('validateListToSaleRatio', () => {
  it('passes when list-to-sale ratio is normal', () => {
    const result = validateListToSaleRatio(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when list-to-sale ratio is very low (< 0.90)', () => {
    const result = validateListToSaleRatio(makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        listToSaleRatio: 0.85,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('List-to-sale');
  });

  it('flags when list-to-sale ratio exceeds 1.0 (bidding wars)', () => {
    const result = validateListToSaleRatio(makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        listToSaleRatio: 1.05,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('computes ratio from comp data when metrics not provided', () => {
    const result = validateListToSaleRatio(makeInput({
      marketMetrics: undefined,
    }));
    // Comp data: 400/410 + 420/425 + 385/390 → avg ~0.98
    expect(result.passed).toBe(true);
  });
});

// ─── checkSubmarketBoundaryCrossing ──────────────────────────────────
describe('checkSubmarketBoundaryCrossing', () => {
  it('passes when all comps are in the same submarket', () => {
    const result = checkSubmarketBoundaryCrossing(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when a comp crosses zip code boundary', () => {
    const input = makeInput();
    input.comps[2].zipCode = '76101'; // Fort Worth zip
    const result = checkSubmarketBoundaryCrossing(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('COMP-3');
    expect(result.message).toContain('zip');
  });

  it('flags when a comp crosses county boundary', () => {
    const input = makeInput();
    input.comps[1].county = 'Tarrant';
    const result = checkSubmarketBoundaryCrossing(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('county');
  });

  it('flags when a comp crosses school district boundary', () => {
    const input = makeInput();
    input.comps[0].schoolDistrict = 'Highland Park ISD';
    const result = checkSubmarketBoundaryCrossing(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
  });

  it('passes when no comps are provided', () => {
    const result = checkSubmarketBoundaryCrossing(makeInput({ comps: [] }));
    expect(result.passed).toBe(true);
  });
});

// ─── validatePriceTrend ──────────────────────────────────────────────
describe('validatePriceTrend', () => {
  it('passes when stated property values align with price change', () => {
    const result = validatePriceTrend(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when stated "Increasing" but YoY change is negative', () => {
    const result = validatePriceTrend(makeInput({
      statedConditions: {
        ...makeInput().statedConditions,
        propertyValues: 'Increasing',
      },
      marketMetrics: {
        ...makeInput().marketMetrics,
        priceChangeYoY: -0.05,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('fails when stated "Declining" but YoY change is positive', () => {
    const result = validatePriceTrend(makeInput({
      statedConditions: {
        ...makeInput().statedConditions,
        propertyValues: 'Declining',
      },
      marketMetrics: {
        ...makeInput().marketMetrics,
        priceChangeYoY: 0.05,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when property values stated condition is not provided', () => {
    const input = makeInput();
    delete input.statedConditions!.propertyValues;
    const result = validatePriceTrend(input);
    expect(result.passed).toBe(true);
  });
});

// ─── MARKET_ANALYTICS_EVALUATORS registry ────────────────────────────
describe('MARKET_ANALYTICS_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(MARKET_ANALYTICS_EVALUATORS)).toHaveLength(6);
  });

  it('all evaluators are functions', () => {
    for (const [, fn] of Object.entries(MARKET_ANALYTICS_EVALUATORS)) {
      expect(typeof fn).toBe('function');
    }
  });
});

// ─── Aggregate report ─────────────────────────────────────────────────
describe('MarketAnalyticsService.performValidation', () => {
  const service = new MarketAnalyticsService();

  it('returns pass for fully consistent market data', () => {
    const report = service.performValidation('ORD-300', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.checks).toHaveLength(6);
  });

  it('returns warnings for non-critical market inconsistencies', () => {
    const report = service.performValidation('ORD-301', makeInput({
      marketMetrics: {
        ...makeInput().marketMetrics,
        listToSaleRatio: 0.85,
      },
    }));
    expect(report.overallStatus).toBe('warnings');
    expect(report.mediumIssues).toBeGreaterThanOrEqual(1);
  });

  it('returns fail for critical market misalignment', () => {
    const report = service.performValidation('ORD-302', makeInput({
      statedConditions: {
        ...makeInput().statedConditions,
        propertyValues: 'Increasing',
        marketTrend: 'Increasing',
      },
      marketMetrics: {
        ...makeInput().marketMetrics,
        monthsOfInventory: 10,
        priceChangeYoY: -0.08,
      },
    }));
    expect(report.totalIssues).toBeGreaterThanOrEqual(2);
  });
});
