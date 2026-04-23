/**
 * Unit tests for LocalAttomPropertyDataProvider
 *
 * Verifies:
 *   - Returns null when state/zip are missing (no Cosmos call)
 *   - Returns null when the Cosmos query returns no candidates
 *   - Matches by APN (preferred) when supplied; APN normalisation handles
 *     dashes/spaces/case differences
 *   - Falls back to address match when APN is absent or doesn't match a
 *     candidate
 *   - Multi-candidate sets pick the newest by sourcedAt (driven by the
 *     ORDER BY in the query — verified by feeding pre-sorted candidates)
 *   - Address comparison is case- and punctuation-insensitive
 *   - Cosmos errors propagate (so the chain provider can fall through)
 *   - Field mapping from AttomDataDocument → PropertyDataResult
 *   - flood is left undefined (no FEMA data in CSV)
 *   - GeoJSON [lon, lat] order is mapped correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock Logger BEFORE importing the provider ────────────────────────────────
vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

import { LocalAttomPropertyDataProvider } from '../../src/services/property-data-providers/local-attom.provider.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import type { AttomDataDocument } from '../../src/types/attom-data.types.js';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const BASE_LOOKUP = {
  street: '123 N Main St',
  city: 'Dallas',
  state: 'TX',
  zipCode: '75201',
};

function makeDoc(overrides: Partial<AttomDataDocument> = {}): AttomDataDocument {
  return {
    id: 'attom-1',
    type: 'attom-data',
    geohash5: 'abcde',
    attomId: 'attom-1',
    apnFormatted: '0914-501-010-0000',
    ingestedAt: '2026-04-01T00:00:00.000Z',
    sourcedAt: '2026-03-15T00:00:00.000Z',
    address: {
      full: '123 N MAIN ST, DALLAS, TX 75201',
      houseNumber: '123',
      streetDirection: 'N',
      streetName: 'MAIN',
      streetSuffix: 'ST',
      streetPostDirection: '',
      unitPrefix: '',
      unitValue: '',
      city: 'DALLAS',
      state: 'TX',
      zip: '75201',
      zip4: '',
      county: 'DALLAS',
    },
    location: { type: 'Point', coordinates: [-96.876543, 32.745678] },
    propertyDetail: {
      attomPropertyType: 'SFR',
      attomPropertySubtype: '',
      mlsPropertyType: '',
      mlsPropertySubtype: '',
      yearBuilt: 2005,
      livingAreaSqft: 2100,
      lotSizeAcres: 0.25,
      lotSizeSqft: 10890,
      bedroomsTotal: 3,
      bathroomsFull: 2,
      bathroomsHalf: 1,
      stories: '2',
      garageSpaces: 2,
      poolPrivate: false,
    },
    assessment: {
      taxYear: '2023',
      assessedValueTotal: 280_000,
      marketValue: 310_000,
      marketValueDate: '2023-12-31',
      taxAmount: 5_600,
    },
    salesHistory: {
      lastSaleDate: '2021-06-15',
      lastSaleAmount: 295_000,
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
  };
}

function makeMockCosmos(candidates: AttomDataDocument[]): CosmosDbService {
  return {
    queryDocuments: vi.fn().mockResolvedValue(candidates),
  } as unknown as CosmosDbService;
}

function makeFailingCosmos(errorMsg: string): CosmosDbService {
  return {
    queryDocuments: vi.fn().mockRejectedValue(new Error(errorMsg)),
  } as unknown as CosmosDbService;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LocalAttomPropertyDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lookupByAddress — guard clauses', () => {
    it('returns null without querying Cosmos when state is missing', async () => {
      const cosmos = makeMockCosmos([]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({ ...BASE_LOOKUP, state: '' });

      expect(result).toBeNull();
      expect(cosmos.queryDocuments).not.toHaveBeenCalled();
    });

    it('returns null without querying Cosmos when zipCode is missing', async () => {
      const cosmos = makeMockCosmos([]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({ ...BASE_LOOKUP, zipCode: '' });

      expect(result).toBeNull();
      expect(cosmos.queryDocuments).not.toHaveBeenCalled();
    });

    it('returns null when Cosmos returns no candidates', async () => {
      const cosmos = makeMockCosmos([]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).toBeNull();
      expect(cosmos.queryDocuments).toHaveBeenCalledOnce();
    });
  });

  describe('lookupByAddress — query shape', () => {
    it('queries with uppercased state and 5-digit zip', async () => {
      const cosmos = makeMockCosmos([]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      await provider.lookupByAddress({
        ...BASE_LOOKUP,
        state: 'tx',
        zipCode: '75201-1234',
      });

      const call = (cosmos.queryDocuments as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe('attom-data');
      expect(call[1]).toContain("c.address.state = @state");
      expect(call[1]).toContain('c.address.zip = @zip');
      expect(call[1]).toContain('ORDER BY c.sourcedAt DESC');
      expect(call[2]).toEqual([
        { name: '@state', value: 'TX' },
        { name: '@zip', value: '75201' },
      ]);
    });

    it('propagates Cosmos errors so the chain provider can fall through', async () => {
      const cosmos = makeFailingCosmos('Cosmos 503');
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      await expect(provider.lookupByAddress(BASE_LOOKUP)).rejects.toThrow('Cosmos 503');
    });
  });

  describe('lookupByAddress — APN match', () => {
    it('matches by APN when supplied; APN normalisation strips dashes/spaces and ignores case', async () => {
      const cosmos = makeMockCosmos([
        makeDoc({ apnFormatted: '0914-501-010-0000' }),
      ]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({
        ...BASE_LOOKUP,
        apn: '09 145 010100 00',
      });

      expect(result).not.toBeNull();
      expect(result?.source).toBe('ATTOM Data Solutions (Cosmos cache)');
      expect(result?.core?.parcelNumber).toBe('0914-501-010-0000');
    });

    it('picks the newest candidate (first in pre-sorted set) on APN match', async () => {
      const newer = makeDoc({
        attomId: 'newer',
        sourcedAt: '2026-03-15T00:00:00.000Z',
      });
      const older = makeDoc({
        attomId: 'older',
        sourcedAt: '2024-01-01T00:00:00.000Z',
      });
      // Cosmos returns newest-first because of ORDER BY sourcedAt DESC.
      const cosmos = makeMockCosmos([newer, older]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({
        ...BASE_LOOKUP,
        apn: '0914-501-010-0000',
      });

      expect(result).not.toBeNull();
      const raw = result?.rawProviderData as { attomDataDocument: AttomDataDocument };
      expect(raw.attomDataDocument.attomId).toBe('newer');
    });

    it('falls back to address match when APN is supplied but does not match', async () => {
      const cosmos = makeMockCosmos([makeDoc({ apnFormatted: 'OTHER-APN' })]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({
        ...BASE_LOOKUP,
        apn: 'WRONG-APN',
      });

      // Address still matches the candidate, so we should get a hit.
      expect(result).not.toBeNull();
    });
  });

  describe('lookupByAddress — address match', () => {
    it('matches when normalised street + city match (case- and punctuation-insensitive)', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({
        street: '123 n. Main st.',
        city: 'dallas',
        state: 'tx',
        zipCode: '75201',
      });

      expect(result).not.toBeNull();
    });

    it('returns null when no candidate street/city matches', async () => {
      const cosmos = makeMockCosmos([
        makeDoc({
          address: {
            ...makeDoc().address,
            houseNumber: '999',
            streetName: 'OTHER',
          },
        }),
      ]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).toBeNull();
    });

    it('returns null when street is missing for an address-only lookup', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress({ ...BASE_LOOKUP, street: '' });

      expect(result).toBeNull();
    });
  });

  describe('mapDocumentToResult — field mapping', () => {
    it('maps core building characteristics from propertyDetail', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.core).toMatchObject({
        grossLivingArea: 2100,
        bedrooms: 3,
        bathsFull: 2,
        bathsHalf: 1,
        yearBuilt: 2005,
        lotSizeSqFt: 10890,
        propertyType: 'SFR',
        stories: 2,
        garage: '2-car',
        parcelNumber: '0914-501-010-0000',
        county: 'DALLAS',
      });
    });

    it('maps GeoJSON [lon, lat] coordinates to latitude/longitude in the correct order', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      // Document has coordinates: [-96.876543, 32.745678]
      expect(result?.core?.latitude).toBe(32.745678);
      expect(result?.core?.longitude).toBe(-96.876543);
    });

    it('falls back to lotSizeAcres × 43,560 when lotSizeSqft is absent or zero', async () => {
      const cosmos = makeMockCosmos([
        makeDoc({
          propertyDetail: {
            ...makeDoc().propertyDetail,
            lotSizeSqft: null,
            lotSizeAcres: 0.5,
          },
        }),
      ]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.core?.lotSizeSqFt).toBe(21_780);
    });

    it('maps public record fields from assessment + salesHistory', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.publicRecord).toMatchObject({
        taxAssessedValue: 280_000,
        taxYear: 2023,
        annualTaxAmount: 5_600,
        deedTransferDate: '2021-06-15',
        deedTransferAmount: 295_000,
      });
    });

    it('leaves flood undefined (no FEMA data in CSV)', async () => {
      const cosmos = makeMockCosmos([makeDoc()]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.flood).toBeUndefined();
    });

    it('preserves the raw document under rawProviderData for traceability', async () => {
      const doc = makeDoc();
      const cosmos = makeMockCosmos([doc]);
      const provider = new LocalAttomPropertyDataProvider(cosmos);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.rawProviderData).toEqual({ attomDataDocument: doc });
    });
  });
});
