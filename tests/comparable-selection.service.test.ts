/**
 * ComparableSelectionService — Unit Tests
 *
 * Tests cover:
 *   - Pure scoring functions: scoreDistance, scoreSaleRecency, scoreNumericSimilarity, scoreBedBathMatch
 *   - scoreCandidates: composite scoring, sorting, weight normalization
 *   - mapAttomTypeToRecordType: mapping correctness, unmapped types
 *   - Phase 1 filtering: property type, sale price, sale date, subject exclusion
 *   - selectForOrder: end-to-end with mocks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComparableSelectionService,
  COMP_SELECTION_PRODUCT_TYPES,
  scoreCandidates,
  scoreDistance,
  scoreSaleRecency,
  scoreNumericSimilarity,
  scoreBedBathMatch,
  mapAttomTypeToRecordType,
} from '../src/services/comparable-selection.service';
import { PropertyRecordType } from '../src/types/property-record.types';
import type { SelectionSubjectSummary, CompCandidate, RankingWeights } from '../src/types/comparable-selection.types';
import type { PropertyDataCacheEntry } from '../src/services/property-data-cache.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSubject(overrides?: Partial<SelectionSubjectSummary>): SelectionSubjectSummary {
  return {
    propertyId: 'prop-subject-001',
    tenantId: 'tenant-1',
    latitude: 30.33,
    longitude: -81.65,
    gla: 2000,
    yearBuilt: 2000,
    bedrooms: 3,
    bathrooms: 2,
    propertyType: PropertyRecordType.SINGLE_FAMILY,
    state: 'FL',
    ...overrides,
  };
}

function makeCandidate(overrides?: Partial<CompCandidate>): CompCandidate {
  return {
    attomId: 'attom-001',
    latitude: 30.335,
    longitude: -81.645,
    gla: 2100,
    yearBuilt: 2002,
    bedrooms: 3,
    bathrooms: 2,
    attomPropertyType: 'SFR',
    lastSaleDate: '2026-01-15',
    lastSaleAmount: 350000,
    address: '456 OAK AVE, JACKSONVILLE FL 32205',
    cacheEntry: {} as PropertyDataCacheEntry,
    ...overrides,
  };
}

function makeCacheEntry(overrides?: Partial<PropertyDataCacheEntry>): PropertyDataCacheEntry {
  return {
    id: 'attom-100',
    type: 'property-data-cache',
    attomId: 'attom-100',
    apnFormatted: '123-456-789',
    source: 'attom-csv-import' as const,
    cachedAt: '2026-01-01T00:00:00Z',
    sourcedAt: '2026-01-01T00:00:00Z',
    address: {
      full: '789 PINE ST, JACKSONVILLE FL 32205',
      houseNumber: '789',
      streetDirection: '',
      streetName: 'PINE',
      streetSuffix: 'ST',
      streetPostDirection: '',
      unitPrefix: '',
      unitValue: '',
      city: 'JACKSONVILLE',
      state: 'FL',
      zip: '32205',
      zip4: '',
      county: 'DUVAL',
    },
    location: { type: 'Point', coordinates: [-81.648, 30.332] },
    propertyDetail: {
      attomPropertyType: 'SFR',
      attomPropertySubtype: '',
      mlsPropertyType: '',
      mlsPropertySubtype: '',
      yearBuilt: 2001,
      livingAreaSqft: 2050,
      lotSizeAcres: 0.25,
      lotSizeSqft: 10890,
      bedroomsTotal: 3,
      bathroomsFull: 2,
      bathroomsHalf: 0,
      stories: '1',
      garageSpaces: 2,
      poolPrivate: false,
    },
    assessment: {
      taxYear: '2025',
      assessedValueTotal: 300000,
      marketValue: 340000,
      marketValueDate: '2025-01-01',
      taxAmount: 4500,
    },
    salesHistory: {
      lastSaleDate: '2025-06-15',
      lastSaleAmount: 345000,
    },
    mlsData: {
      mlsListingId: '',
      mlsRecordId: '',
      mlsNumber: '',
      mlsSource: '',
      listingStatus: '',
      currentStatus: '',
      listingDate: '',
      latestListingPrice: null,
      previousListingPrice: null,
      soldDate: '',
      soldPrice: null,
      daysOnMarket: null,
      pendingDate: '',
      originalListingDate: '',
      originalListingPrice: null,
    },
    rawData: {},
    ...overrides,
  } as PropertyDataCacheEntry;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 5,
  saleRecency: 4,
  glaSimilarity: 3,
  ageSimilarity: 2,
  bedBathMatch: 2,
};

// ═════════════════════════════════════════════════════════════════════════════
// Pure scoring function tests
// ═════════════════════════════════════════════════════════════════════════════

describe('scoreDistance', () => {
  it('returns 1.0 at 0 miles', () => {
    expect(scoreDistance(0)).toBeCloseTo(1.0, 5);
  });

  it('decays with distance', () => {
    const at1 = scoreDistance(1);
    const at3 = scoreDistance(3);
    const at5 = scoreDistance(5);
    expect(at1).toBeLessThan(1.0);
    expect(at3).toBeLessThan(at1);
    expect(at5).toBeLessThan(at3);
    expect(at5).toBeGreaterThan(0);
  });
});

describe('scoreSaleRecency', () => {
  const now = new Date('2026-04-19T00:00:00Z').getTime();

  it('returns ~1.0 for a sale today', () => {
    expect(scoreSaleRecency('2026-04-19', now)).toBeCloseTo(1.0, 1);
  });

  it('returns ~0.5 for a sale 12 months ago', () => {
    expect(scoreSaleRecency('2025-04-19', now)).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for a sale 24+ months ago', () => {
    expect(scoreSaleRecency('2024-04-19', now)).toBeCloseTo(0.0, 1);
  });
});

describe('scoreNumericSimilarity', () => {
  it('returns 1.0 for identical values', () => {
    expect(scoreNumericSimilarity(2000, 2000)).toBe(1.0);
  });

  it('returns 1.0 for both zero', () => {
    expect(scoreNumericSimilarity(0, 0)).toBe(1.0);
  });

  it('returns < 1 for different values', () => {
    const score = scoreNumericSimilarity(2000, 2500);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns higher score for closer values', () => {
    const closer = scoreNumericSimilarity(2000, 2100);
    const farther = scoreNumericSimilarity(2000, 3000);
    expect(closer).toBeGreaterThan(farther);
  });
});

describe('scoreBedBathMatch', () => {
  it('returns 1.0 for exact match', () => {
    expect(scoreBedBathMatch(3, 2, 3, 2)).toBe(1.0);
  });

  it('penalizes bedroom difference', () => {
    const score = scoreBedBathMatch(3, 2, 4, 2);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0);
  });

  it('penalizes bathroom difference', () => {
    const score = scoreBedBathMatch(3, 2, 3, 3);
    expect(score).toBeLessThan(1.0);
    expect(score).toBeGreaterThan(0);
  });

  it('floors at 0 for large differences', () => {
    const score = scoreBedBathMatch(3, 2, 8, 8);
    expect(score).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// scoreCandidates
// ═════════════════════════════════════════════════════════════════════════════

describe('scoreCandidates', () => {
  const subject = makeSubject();

  it('returns candidates sorted by composite score descending', () => {
    const close = makeCandidate({ attomId: 'close', latitude: 30.331, longitude: -81.651 });
    const far = makeCandidate({ attomId: 'far', latitude: 30.38, longitude: -81.70 });

    const result = scoreCandidates(subject, [far, close], DEFAULT_WEIGHTS);
    expect(result).toHaveLength(2);
    expect(result[0]!.candidate.attomId).toBe('close');
    expect(result[0]!.compositeScore).toBeGreaterThan(result[1]!.compositeScore);
  });

  it('returns empty array for empty candidates', () => {
    const result = scoreCandidates(subject, [], DEFAULT_WEIGHTS);
    expect(result).toHaveLength(0);
  });

  it('throws if weights sum to zero', () => {
    const zeroWeights: RankingWeights = {
      distance: 0, saleRecency: 0, glaSimilarity: 0, ageSimilarity: 0, bedBathMatch: 0,
    };
    expect(() => scoreCandidates(subject, [makeCandidate()], zeroWeights)).toThrow();
  });

  it('composite score is between 0 and 1', () => {
    const result = scoreCandidates(subject, [makeCandidate()], DEFAULT_WEIGHTS);
    expect(result[0]!.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result[0]!.compositeScore).toBeLessThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// mapAttomTypeToRecordType
// ═════════════════════════════════════════════════════════════════════════════

describe('mapAttomTypeToRecordType', () => {
  it('maps SFR to SINGLE_FAMILY', () => {
    expect(mapAttomTypeToRecordType('SFR')).toBe(PropertyRecordType.SINGLE_FAMILY);
  });

  it('maps case-insensitively', () => {
    expect(mapAttomTypeToRecordType('sfr')).toBe(PropertyRecordType.SINGLE_FAMILY);
    expect(mapAttomTypeToRecordType('Condo')).toBe(PropertyRecordType.CONDO);
  });

  it('returns null for unmapped types', () => {
    expect(mapAttomTypeToRecordType('SPACESHIP')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(mapAttomTypeToRecordType('  TOWNHOUSE  ')).toBe(PropertyRecordType.TOWNHOME);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COMP_SELECTION_PRODUCT_TYPES
// ═════════════════════════════════════════════════════════════════════════════

describe('COMP_SELECTION_PRODUCT_TYPES', () => {
  it('includes BPO and DESKTOP_REVIEW', () => {
    expect(COMP_SELECTION_PRODUCT_TYPES.has('BPO')).toBe(true);
    expect(COMP_SELECTION_PRODUCT_TYPES.has('DESKTOP_REVIEW')).toBe(true);
  });

  it('does not include FULL_APPRAISAL or AVM', () => {
    expect(COMP_SELECTION_PRODUCT_TYPES.has('FULL_APPRAISAL')).toBe(false);
    expect(COMP_SELECTION_PRODUCT_TYPES.has('AVM')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ComparableSelectionService — integration with mocks
// ═════════════════════════════════════════════════════════════════════════════

describe('ComparableSelectionService', () => {
  function makeMockPropertyRecordService(record: any) {
    return {
      getById: vi.fn().mockResolvedValue(record),
    };
  }

  function makeMockPropertyDataCacheService(entries: PropertyDataCacheEntry[]) {
    return {
      searchByRadius: vi.fn().mockResolvedValue(entries),
    };
  }

  function makeMockCosmosService() {
    return {
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      queryDocuments: vi.fn().mockResolvedValue([]),
    };
  }

  const subjectRecord = {
    id: 'prop-subject-001',
    tenantId: 'tenant-1',
    address: {
      street: '123 MAIN ST',
      city: 'JACKSONVILLE',
      state: 'FL',
      zip: '32205',
      latitude: 30.33,
      longitude: -81.65,
    },
    propertyType: PropertyRecordType.SINGLE_FAMILY,
    building: { gla: 2000, yearBuilt: 2000, bedrooms: 3, bathrooms: 2 },
  };

  it('selectForOrder returns top 3 from candidates', async () => {
    const entries = [
      makeCacheEntry({ attomId: 'c1', id: 'c1', location: { type: 'Point', coordinates: [-81.648, 30.332] } }),
      makeCacheEntry({ attomId: 'c2', id: 'c2', location: { type: 'Point', coordinates: [-81.655, 30.335] } }),
      makeCacheEntry({ attomId: 'c3', id: 'c3', location: { type: 'Point', coordinates: [-81.660, 30.338] } }),
      makeCacheEntry({ attomId: 'c4', id: 'c4', location: { type: 'Point', coordinates: [-81.670, 30.340] } }),
    ];

    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService(entries) as any,
    );

    const result = await service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-subject-001');
    expect(result.selected.length).toBeLessThanOrEqual(3);
    expect(result.orderId).toBe('order-1');
    expect(result.productType).toBe('BPO');
  });

  it('loads subject observations before building the canonical subject summary', async () => {
    const cosmos = makeMockCosmosService();
    const service = new ComparableSelectionService(
      cosmos as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([]) as any,
    );

    await service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-subject-001');

    expect(cosmos.queryDocuments).toHaveBeenCalledWith(
      'property-observations',
      expect.stringContaining('SELECT * FROM c'),
      expect.arrayContaining([
        expect.objectContaining({ name: '@tenantId', value: 'tenant-1' }),
        expect.objectContaining({ name: '@propertyId', value: 'prop-subject-001' }),
      ]),
    );
  });

  it('throws if product type has no config', async () => {
    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([]) as any,
    );

    await expect(
      service.selectForOrder('order-1', 'tenant-1', 'FULL_APPRAISAL', 'prop-1'),
    ).rejects.toThrow('no comp selection config');
  });

  it('throws if subject has no lat/lng', async () => {
    const noGeoRecord = {
      ...subjectRecord,
      address: { ...subjectRecord.address, latitude: undefined, longitude: undefined },
    };

    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(noGeoRecord) as any,
      makeMockPropertyDataCacheService([]) as any,
    );

    await expect(
      service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-1'),
    ).rejects.toThrow('no lat/lng');
  });

  it('excludes candidates with no sale price', async () => {
    const noSale = makeCacheEntry({
      attomId: 'no-sale',
      id: 'no-sale',
      salesHistory: { lastSaleDate: '2025-06-15', lastSaleAmount: null as any },
    });
    const withSale = makeCacheEntry({ attomId: 'with-sale', id: 'with-sale' });

    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([noSale, withSale]) as any,
    );

    const result = await service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-subject-001');
    // Only withSale should survive Phase 1 filters
    expect(result.candidateCount).toBe(1);
  });

  it('excludes candidates with mismatched property type', async () => {
    const condo = makeCacheEntry({
      attomId: 'condo-1',
      id: 'condo-1',
      propertyDetail: {
        ...makeCacheEntry().propertyDetail,
        attomPropertyType: 'CONDO',
      },
    });
    const sfr = makeCacheEntry({ attomId: 'sfr-1', id: 'sfr-1' });

    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([condo, sfr]) as any,
    );

    const result = await service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-subject-001');
    expect(result.candidateCount).toBe(1);
    expect(result.selected[0]?.candidate.attomId).toBe('sfr-1');
  });

  it('returns empty selected when no candidates pass filters', async () => {
    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([]) as any,
    );

    const result = await service.selectForOrder('order-1', 'tenant-1', 'BPO', 'prop-subject-001');
    expect(result.selected).toHaveLength(0);
    expect(result.candidateCount).toBe(0);
  });

  it('validates required parameters', async () => {
    const service = new ComparableSelectionService(
      makeMockCosmosService() as any,
      makeMockPropertyRecordService(subjectRecord) as any,
      makeMockPropertyDataCacheService([]) as any,
    );

    await expect(service.selectForOrder('', 'tenant-1', 'BPO', 'prop-1')).rejects.toThrow('orderId is required');
    await expect(service.selectForOrder('order-1', '', 'BPO', 'prop-1')).rejects.toThrow('tenantId is required');
    await expect(service.selectForOrder('order-1', 'tenant-1', '', 'prop-1')).rejects.toThrow('productType is required');
    await expect(service.selectForOrder('order-1', 'tenant-1', 'BPO', '')).rejects.toThrow('propertyId is required');
  });
});
