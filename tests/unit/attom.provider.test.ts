/**
 * Unit tests for AttomPropertyDataProvider
 *
 * Verifies:
 *   - lookupByAddress returns null when the ATTOM API finds no property
 *   - Core building characteristics are mapped correctly
 *   - Public record fields (owner, tax, legal, deed) are mapped correctly
 *   - Flood zone fields are mapped correctly
 *   - Graceful handling of missing attomId (skips follow-up calls)
 *   - Partial data (fields absent from response) does not throw
 *   - Date normalisation: ISO, MM/DD/YYYY, and YYYYMMDD formats
 *   - bathsTotal fallback when bathsFull / bathsHalf are absent
 *   - lotSize1 (acres) fallback when lotSize2 (sq ft) is zero/absent
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock AttomService BEFORE importing the provider ───────────────────────────
const mockGetPropertyDetailOwner = vi.fn();
const mockGetAssessmentDetail = vi.fn();
const mockGetSaleHistoryBasic = vi.fn();

vi.mock('../../src/services/attom.service.js', () => ({
  AttomService: vi.fn().mockImplementation(() => ({
    getPropertyDetailOwner: mockGetPropertyDetailOwner,
    getAssessmentDetail: mockGetAssessmentDetail,
    getSaleHistoryBasic: mockGetSaleHistoryBasic,
  })),
}));

vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

import { AttomPropertyDataProvider } from '../../src/services/property-data-providers/attom.provider.js';

// ── Fixture helpers ───────────────────────────────────────────────────────────

const BASE_LOOKUP = {
  street: '123 Main St',
  city: 'Dallas',
  state: 'TX',
  zipCode: '75201',
};

/** Minimal ATTOM /property/detailowner envelope with all commonly-used fields. */
function makeDetailOwnerEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    status: { version: '1.0.0', code: 0, msg: 'SuccessWithResult', total: 1 },
    property: [
      {
        identifier: { Id: 123, fips: '48113', apn: '0914501010000', attomId: 184196315 },
        lot: {
          lotSize1: 0.25,
          lotSize2: 10890,
          zoningCodeLocal: 'R-1',
          floodZone: 'AE',
          floodMapNumber: '48113C0093F',
          floodMapDate: '20091218',
        },
        address: {
          line1: '123 MAIN ST',
          locality: 'DALLAS',
          county: 'Dallas',
          latitude: '32.745678',
          longitude: '-96.876543',
        },
        building: {
          size: { universalSize: 2100, livingSize: 1900, bldgSize: 2100 },
          rooms: { beds: 3, bathsFull: 2, bathsHalf: 1, roomsTotal: 7 },
          summary: { yearBuilt: 2005, propType: 'SFR', propClass: 'Single Family Residential', stories: '2' },
          parking: { prkgType: 'GARAGE', prkgSize: '2' },
          interior: { bsmtType: 'FULL', bsmtSize: 800 },
        },
        owner: {
          owner1: { firstName: 'JOHN', lastName: 'SMITH', fullName: 'JOHN SMITH' },
        },
        summary: { propLandUse: 'SFR', propType: 'SFR' },
        ...overrides,
      },
    ],
  };
}

function makeAssessmentEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    status: { code: 0, msg: 'SuccessWithResult' },
    property: [
      {
        identifier: { attomId: 184196315 },
        assessment: {
          assessed: { assdTtlValue: 280_000, assdLndValue: 50_000 },
          tax: { taxAmt: 5_600, taxYear: 2023 },
        },
        lot: {
          legalDescription1: 'LOT 5 BLK 10 OAK HILLS',
          zoningCodeLocal: 'R-1',
        },
        ...overrides,
      },
    ],
  };
}

function makeSaleHistoryEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    status: { code: 0, msg: 'SuccessWithResult' },
    property: [
      {
        identifier: { attomId: 184196315 },
        salehistory: [
          {
            saleTransDate: '2021-06-15',
            recordingDate: '2021-06-28',
            amount: { saleamt: 425_000 },
          },
        ],
        ...overrides,
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttomPropertyDataProvider', () => {
  let provider: AttomPropertyDataProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AttomPropertyDataProvider();
  });

  // ── null / miss cases ──────────────────────────────────────────────────────

  describe('lookupByAddress — no match', () => {
    it('returns null when detailowner returns an empty property array', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue({
        status: { code: 0, msg: 'SuccessWithResult', total: 0 },
        property: [],
      });

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).toBeNull();
    });

    it('returns null when detailowner returns no property key', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue({
        status: { code: 0, msg: 'SuccessWithResult', total: 0 },
      });

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).toBeNull();
    });

    it('returns null when detailowner call fails (non-fatal)', async () => {
      mockGetPropertyDetailOwner.mockRejectedValue(new Error('ATTOM API error: HTTP 503'));

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).toBeNull();
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('result metadata', () => {
    it('sets source to "ATTOM Data Solutions"', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.source).toBe('ATTOM Data Solutions');
    });

    it('includes a fetchedAt ISO timestamp', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ── Core field mappings ────────────────────────────────────────────────────

  describe('core field mappings', () => {
    beforeEach(() => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());
    });

    it('maps universalSize to grossLivingArea', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.grossLivingArea).toBe(2100);
    });

    it('maps beds to bedrooms', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.bedrooms).toBe(3);
    });

    it('maps bathsFull and bathsHalf directly', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.bathsFull).toBe(2);
      expect(result?.core?.bathsHalf).toBe(1);
    });

    it('maps yearBuilt', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.yearBuilt).toBe(2005);
    });

    it('maps propType to propertyType', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.propertyType).toBe('SFR');
    });

    it('maps stories (string "2" → number 2)', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.stories).toBe(2);
    });

    it('maps roomsTotal to totalRooms', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.totalRooms).toBe(7);
    });

    it('maps parking to garage string', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.garage).toBe('2-car GARAGE');
    });

    it('maps bsmtType + bsmtSize to basement string', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.basement).toBe('FULL (800 sq ft)');
    });

    it('maps lotSize2 (sq ft) to lotSizeSqFt', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.lotSizeSqFt).toBe(10890);
    });

    it('maps APN from identifier.apn to parcelNumber', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.parcelNumber).toBe('0914501010000');
    });

    it('maps address.county to county', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.county).toBe('Dallas');
    });

    it('maps latitude and longitude (string → float)', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.core?.latitude).toBeCloseTo(32.745678);
      expect(result?.core?.longitude).toBeCloseTo(-96.876543);
    });
  });

  // ── Core field fallbacks ───────────────────────────────────────────────────

  describe('core field fallbacks', () => {
    it('derives bathsFull and bathsHalf from bathsTotal when split values are absent', async () => {
      const envelope = makeDetailOwnerEnvelope({
        building: {
          size: { universalSize: 1200 },
          rooms: { beds: 2, bathsTotal: 2.5 }, // no bathsFull / bathsHalf
          summary: { yearBuilt: 2000, propType: 'SFR', stories: '1' },
          parking: {},
        },
      });
      mockGetPropertyDetailOwner.mockResolvedValue(envelope);
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.core?.bathsFull).toBe(2);
      expect(result?.core?.bathsHalf).toBe(1);
    });

    it('converts lotSize1 acres to sq ft when lotSize2 is absent', async () => {
      const envelope = makeDetailOwnerEnvelope({
        lot: { lotSize1: 0.5, lotSize2: 0, zoningCodeLocal: 'R-1' },
      });
      mockGetPropertyDetailOwner.mockResolvedValue(envelope);
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.core?.lotSizeSqFt).toBe(21_780); // 0.5 × 43,560
    });

    it('falls back to livingSize when universalSize is absent', async () => {
      const envelope = makeDetailOwnerEnvelope({
        building: {
          size: { livingSize: 1850 }, // no universalSize
          rooms: { beds: 3, bathsFull: 2, bathsHalf: 0 },
          summary: { yearBuilt: 2000, propType: 'SFR', stories: '1' },
          parking: {},
        },
      });
      mockGetPropertyDetailOwner.mockResolvedValue(envelope);
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.core?.grossLivingArea).toBe(1850);
    });
  });

  // ── Public record mappings ─────────────────────────────────────────────────

  describe('publicRecord field mappings', () => {
    beforeEach(() => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());
    });

    it('maps owner1.fullName to ownerName', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.ownerName).toBe('JOHN SMITH');
    });

    it('maps lot.zoningCodeLocal to zoning', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.zoning).toBe('R-1');
    });

    it('maps summary.propLandUse to landUseCode', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.landUseCode).toBe('SFR');
    });

    it('maps assessment.assessed.assdTtlValue to taxAssessedValue', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.taxAssessedValue).toBe(280_000);
    });

    it('maps assessment.tax.taxYear to taxYear', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.taxYear).toBe(2023);
    });

    it('maps assessment.tax.taxAmt to annualTaxAmount', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.annualTaxAmount).toBe(5_600);
    });

    it('maps lot.legalDescription1 to legalDescription', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.legalDescription).toBe('LOT 5 BLK 10 OAK HILLS');
    });

    it('maps salehistory[0].saleTransDate to deedTransferDate', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.deedTransferDate).toBe('2021-06-15');
    });

    it('maps salehistory[0].amount.saleamt to deedTransferAmount', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.deedTransferAmount).toBe(425_000);
    });
  });

  // ── Owner name composition ─────────────────────────────────────────────────

  describe('owner name composition', () => {
    it('composes ownerName from firstName + lastName when fullName is absent', async () => {
      const envelope = makeDetailOwnerEnvelope({
        owner: { owner1: { firstName: 'JANE', lastName: 'DOE' } },
      });
      mockGetPropertyDetailOwner.mockResolvedValue(envelope);
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result?.publicRecord?.ownerName).toBe('JANE DOE');
    });
  });

  // ── Flood field mappings ───────────────────────────────────────────────────

  describe('flood field mappings', () => {
    beforeEach(() => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());
    });

    it('maps lot.floodZone to femaFloodZone', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.flood?.femaFloodZone).toBe('AE');
    });

    it('maps lot.floodMapNumber to femaMapNumber', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.flood?.femaMapNumber).toBe('48113C0093F');
    });

    it('normalises lot.floodMapDate (YYYYMMDD) to ISO', async () => {
      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.flood?.femaMapDate).toBe('2009-12-18');
    });
  });

  // ── Date normalisation ─────────────────────────────────────────────────────
  // Tested indirectly via the various response shapes that reach normaliseDate.

  describe('date normalisation', () => {
    it('keeps ISO YYYY-MM-DD unchanged', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope()); // uses 2021-06-15

      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.deedTransferDate).toBe('2021-06-15');
    });

    it('converts MM/DD/YYYY to ISO YYYY-MM-DD', async () => {
      const saleEnvelope = {
        status: { code: 0 },
        property: [
          {
            salehistory: [{ saleTransDate: '06/15/2021', amount: { saleamt: 400_000 } }],
          },
        ],
      };
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(saleEnvelope);

      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.deedTransferDate).toBe('2021-06-15');
    });

    it('converts YYYYMMDD compact date to ISO YYYY-MM-DD', async () => {
      // floodMapDate '20091218' tested via flood section above; also test via sale date
      const saleEnvelope = {
        status: { code: 0 },
        property: [
          {
            salehistory: [{ saleTransDate: '20210615', amount: { saleamt: 400_000 } }],
          },
        ],
      };
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(saleEnvelope);

      const result = await provider.lookupByAddress(BASE_LOOKUP);
      expect(result?.publicRecord?.deedTransferDate).toBe('2021-06-15');
    });
  });

  // ── Missing attomId ────────────────────────────────────────────────────────

  describe('missing attomId', () => {
    it('skips assessment and sale history calls when attomId is absent', async () => {
      const envelopeWithoutAttomId = makeDetailOwnerEnvelope({
        identifier: { Id: 123, fips: '48113', apn: '0914501010000' }, // no attomId
      });
      mockGetPropertyDetailOwner.mockResolvedValue(envelopeWithoutAttomId);

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(mockGetAssessmentDetail).not.toHaveBeenCalled();
      expect(mockGetSaleHistoryBasic).not.toHaveBeenCalled();
      // Core should still map from the detail record
      expect(result?.core?.parcelNumber).toBe('0914501010000');
    });
  });

  // ── Follow-up call failures ────────────────────────────────────────────────

  describe('follow-up call failures are non-fatal', () => {
    it('still returns a result when assessment call fails', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockRejectedValue(new Error('upstream timeout'));
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).not.toBeNull();
      expect(result?.core?.bedrooms).toBe(3);
      expect(result?.publicRecord?.taxAssessedValue).toBeUndefined();
    });

    it('still returns a result when sale history call fails', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockRejectedValue(new Error('404 Not Found'));

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      expect(result).not.toBeNull();
      expect(result?.publicRecord?.deedTransferDate).toBeUndefined();
    });
  });

  // ── Raw provider data ──────────────────────────────────────────────────────

  describe('rawProviderData', () => {
    it('includes detail, assessment and saleHistory in rawProviderData', async () => {
      mockGetPropertyDetailOwner.mockResolvedValue(makeDetailOwnerEnvelope());
      mockGetAssessmentDetail.mockResolvedValue(makeAssessmentEnvelope());
      mockGetSaleHistoryBasic.mockResolvedValue(makeSaleHistoryEnvelope());

      const result = await provider.lookupByAddress(BASE_LOOKUP);

      const raw = result?.rawProviderData as Record<string, unknown>;
      expect(raw.detail).toBeDefined();
      expect(raw.assessment).toBeDefined();
      expect(raw.saleHistory).toBeDefined();
    });
  });
});
