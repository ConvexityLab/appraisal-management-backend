/**
 * ROV Research Service — Phase 0.8 De-stub Tests
 *
 * Tests the wiring of searchComparables() and analyzeMarketTrends()
 * to a generic MlsDataProvider interface (seeded in-memory implementation).
 *
 * MlsDataProvider is mocked — no real MLS API calls.
 *
 * Run: pnpm vitest run tests/rov-research-phase0.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MlsDataProvider, MlsListing } from '../src/types/mls-data.types';

// ── Mock non-MLS dependencies ────────────────────────────────────────────────

vi.mock('../src/services/enhanced-property-intelligence-v2.service', () => ({
  EnhancedPropertyIntelligenceV2Service: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { ROVResearchService, type ComparableSearchCriteria } from '../src/services/rov-research.service';
import { mapMlsListingToROVComparable } from '../src/services/rov-research.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers — MLS listing fixtures + mock provider
// ═══════════════════════════════════════════════════════════════════════════════

function makeMlsListing(overrides: Partial<MlsListing> = {}): MlsListing {
  return {
    id: 'MLS-12345',
    listingId: '12345',
    address: '456 Oak Ave',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75201',
    salePrice: 425000,
    saleDate: '2026-02-15',
    squareFootage: 1800,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2005,
    lotSize: 7500,
    latitude: 32.79,
    longitude: -96.81,
    propertyType: 'Single Family',
    propertySubType: 'Single Family Residence',
    source: 'SeededMLS',
    ...overrides,
  };
}

function makeSearchCriteria(overrides: Partial<ComparableSearchCriteria> = {}): ComparableSearchCriteria {
  return {
    subjectAddress: '123 Main St, Dallas, TX 75201',
    latitude: 32.78,
    longitude: -96.80,
    radiusMiles: 1.0,
    maxResults: 10,
    ...overrides,
  };
}

function createMockProvider(): MlsDataProvider & { searchSoldListings: ReturnType<typeof vi.fn> } {
  return {
    searchSoldListings: vi.fn().mockResolvedValue([]),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. mapMlsListingToROVComparable
// ═══════════════════════════════════════════════════════════════════════════════

describe('mapMlsListingToROVComparable', () => {
  it('maps all required fields from MlsListing format', () => {
    const listing = makeMlsListing();
    const subjectLat = 32.78;
    const subjectLon = -96.80;
    const result = mapMlsListingToROVComparable(listing, subjectLat, subjectLon);

    expect(result.id).toBe('MLS-12345');
    expect(result.address).toBe('456 Oak Ave');
    expect(result.city).toBe('Dallas');
    expect(result.state).toBe('TX');
    expect(result.zipCode).toBe('75201');
    expect(result.salePrice).toBe(425000);
    expect(result.squareFootage).toBe(1800);
    expect(result.bedrooms).toBe(3);
    expect(result.bathrooms).toBe(2);
    expect(result.yearBuilt).toBe(2005);
    expect(result.source).toBe('SeededMLS');
    expect(result.listingId).toBe('12345');
    expect(result.selected).toBe(false);
  });

  it('sets saleDate as a Date object', () => {
    const listing = makeMlsListing({ saleDate: '2026-01-20' });
    const result = mapMlsListingToROVComparable(listing, 32.78, -96.80);
    expect(result.saleDate).toBeInstanceOf(Date);
    expect(result.saleDate.toISOString()).toContain('2026-01-20');
  });

  it('calculates distance from subject using coordinates', () => {
    const listing = makeMlsListing({ latitude: 32.79, longitude: -96.81 });
    const result = mapMlsListingToROVComparable(listing, 32.78, -96.80);
    expect(result.distanceFromSubject).toBeGreaterThan(0);
    expect(result.distanceFromSubject).toBeLessThan(5);
  });

  it('initializes adjustments with zeroes and adjustedValue = salePrice', () => {
    const listing = makeMlsListing({ salePrice: 350000 });
    const result = mapMlsListingToROVComparable(listing, 32.78, -96.80);
    expect(result.adjustments.total).toBe(0);
    expect(result.adjustedValue).toBe(350000);
  });

  it('sets condition to average (MLS has no normalized condition)', () => {
    const listing = makeMlsListing();
    const result = mapMlsListingToROVComparable(listing, 32.78, -96.80);
    expect(result.condition).toBe('average');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. searchComparables — wired to MlsDataProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('searchComparables', () => {
  let service: ROVResearchService;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();
    service = new ROVResearchService(undefined, mockProvider);
  });

  it('returns mapped ROVComparables from MLS data', async () => {
    mockProvider.searchSoldListings.mockResolvedValue([
      makeMlsListing(),
      makeMlsListing({ id: 'MLS-67890', address: '789 Elm St', salePrice: 380000 }),
    ]);

    const results = await service.searchComparables(makeSearchCriteria());

    expect(results).toHaveLength(2);
    expect(results[0].address).toBe('456 Oak Ave');
    expect(results[1].address).toBe('789 Elm St');
    expect(results[0].source).toBe('SeededMLS');
  });

  it('passes search criteria through to searchSoldListings', async () => {
    await service.searchComparables(makeSearchCriteria({
      radiusMiles: 2.0,
      maxResults: 15,
      minBedrooms: 2,
      maxBedrooms: 4,
      minBathrooms: 1,
      maxBathrooms: 3,
      minSquareFeet: 1200,
      maxSquareFeet: 2500,
    }));

    expect(mockProvider.searchSoldListings).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 32.78,
      longitude: -96.80,
      radiusMiles: 2.0,
      limit: 15,
      minBeds: 2,
      maxBeds: 4,
      minBaths: 1,
      maxBaths: 3,
      minSqft: 1200,
      maxSqft: 2500,
    }));
  });

  it('converts saleDateStart to soldWithinDays', async () => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    await service.searchComparables(makeSearchCriteria({
      saleDateStart: ninetyDaysAgo,
    }));

    const callArgs = mockProvider.searchSoldListings.mock.calls[0][0];
    expect(callArgs.soldWithinDays).toBeGreaterThanOrEqual(89);
    expect(callArgs.soldWithinDays).toBeLessThanOrEqual(91);
  });

  it('returns empty array when provider returns no results', async () => {
    const results = await service.searchComparables(makeSearchCriteria());
    expect(results).toEqual([]);
  });

  it('propagates errors from MLS provider', async () => {
    mockProvider.searchSoldListings.mockRejectedValue(new Error('MLS provider unavailable'));

    await expect(service.searchComparables(makeSearchCriteria())).rejects.toThrow('MLS provider unavailable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. analyzeMarketTrends — wired to MlsDataProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('analyzeMarketTrends', () => {
  let service: ROVResearchService;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();
    service = new ROVResearchService(undefined, mockProvider);
  });

  it('returns real statistics from MLS sales data', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const onetwentyDaysAgo = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    mockProvider.searchSoldListings.mockResolvedValue([
      makeMlsListing({ salePrice: 400000, saleDate: onetwentyDaysAgo }),
      makeMlsListing({ salePrice: 410000, saleDate: ninetyDaysAgo }),
      makeMlsListing({ salePrice: 430000, saleDate: sixtyDaysAgo }),
      makeMlsListing({ salePrice: 440000, saleDate: thirtyDaysAgo }),
    ]);

    const result = await service.analyzeMarketTrends('123 Main St', 32.78, -96.80, 180);

    expect(result.sampleSize).toBe(4);
    expect(result.averageSalePrice).toBe(420000);
    expect(result.medianSalePrice).toBeGreaterThan(0);
    expect(result.priceRange.min).toBe(400000);
    expect(result.priceRange.max).toBe(440000);
    expect(result.analysisDate).toBeInstanceOf(Date);
  });

  it('returns zero-data result when provider returns no sales', async () => {
    const result = await service.analyzeMarketTrends('123 Main St', 32.78, -96.80);

    expect(result.sampleSize).toBe(0);
    expect(result.averageSalePrice).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('detects increasing trend when recent prices are higher', async () => {
    const now = new Date();
    mockProvider.searchSoldListings.mockResolvedValue([
      makeMlsListing({ salePrice: 300000, saleDate: new Date(now.getTime() - 150 * 86400000).toISOString().split('T')[0] }),
      makeMlsListing({ salePrice: 310000, saleDate: new Date(now.getTime() - 120 * 86400000).toISOString().split('T')[0] }),
      makeMlsListing({ salePrice: 380000, saleDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0] }),
      makeMlsListing({ salePrice: 390000, saleDate: new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0] }),
    ]);

    const result = await service.analyzeMarketTrends('123 Main St', 32.78, -96.80, 180);

    expect(result.trend).toBe('increasing');
    expect(result.trendPercentage).toBeGreaterThan(2);
  });

  it('passes soldWithinDays derived from analysisWindowDays', async () => {
    await service.analyzeMarketTrends('123 Main St', 32.78, -96.80, 365);

    expect(mockProvider.searchSoldListings).toHaveBeenCalledWith(expect.objectContaining({
      soldWithinDays: 365,
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Integration: searchComparables → calculateAdjustments → selectBest
// ═══════════════════════════════════════════════════════════════════════════════

describe('end-to-end comp research pipeline', () => {
  let service: ROVResearchService;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();
    service = new ROVResearchService(undefined, mockProvider);
  });

  it('searched comps can be adjusted and ranked', async () => {
    mockProvider.searchSoldListings.mockResolvedValue([
      makeMlsListing({ id: 'A', salePrice: 400000, squareFootage: 1800, bedrooms: 3, bathrooms: 2 }),
      makeMlsListing({ id: 'B', salePrice: 350000, squareFootage: 1500, bedrooms: 2, bathrooms: 2 }),
      makeMlsListing({ id: 'C', salePrice: 500000, squareFootage: 2200, bedrooms: 4, bathrooms: 3 }),
    ]);

    const subject = {
      address: '123 Main St',
      squareFootage: 1800,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 2010,
      propertyType: 'SINGLE_FAMILY',
    };

    const comps = await service.searchComparables(makeSearchCriteria());
    expect(comps).toHaveLength(3);

    // Adjust each comp
    const adjusted = comps.map(c => {
      const { adjustments, adjustedValue } = service.calculateAdjustments(subject, c);
      return { ...c, adjustments, adjustedValue };
    });

    // Select best 2
    const best = service.selectBestComparables(subject, adjusted, 2);
    expect(best).toHaveLength(2);
    // The closest in sq ft / beds / baths to subject should score highest
    expect(best[0].id).toBe('A'); // exact match on sqft/beds/baths
  });
});
