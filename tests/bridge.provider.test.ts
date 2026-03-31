/**
 * BridgePropertyDataProvider — Unit Tests
 *
 * Tests every field mapping + control-flow branch without hitting the real
 * Bridge API.  BridgeInteractiveService is fully mocked so the provider's
 * own logic (extractList, buildCore, buildPublicRecord, buildFlood) is the
 * only thing under test.
 *
 * Coverage:
 *   extractList
 *     - bundle[], value[], results[], bare array, null, non-object → []
 *   buildCore / MLS fields
 *     - grossLivingArea, bedrooms, yearBuilt, propertyType, stories, county
 *     - BathroomsTotalDecimal: full + half splitting (2.5 → 2 full, 1 half)
 *     - LotSizeArea in sqft  → stored as-is
 *     - LotSizeArea in acres → converted to sqft
 *     - GarageSpaces + GarageType → formatted string
 *     - GarageSpaces only (no type)
 *   buildCore / parcel fields
 *     - apn primary, parcelNumber fallback
 *     - GeoJSON coordinates [lng, lat] correctly decoded
 *     - [0, 0] coordinates ignored
 *     - lotSizeSquareFeet used when MLS has no lot size
 *     - county falls back to parcel when MLS has no county
 *     - parcel county not applied when MLS already set county
 *   buildPublicRecord / parcel
 *     - zoningCode primary, zoning fallback
 *     - landUseCode, landUse fallback, landUseGeneral fallback
 *     - legal.lotDescription extracted correctly
 *   buildPublicRecord / assessment
 *     - totalValue primary
 *     - assessedValue fallback when totalValue absent
 *     - taxAssessedValue fallback when both absent
 *     - taxAmount (annualTaxAmount fallback)
 *     - year and taxYear fallback
 *     - ownerName NOT present — field stays undefined
 *   buildPublicRecord / transaction
 *     - salesPrice primary
 *     - amount fallback
 *     - saleAmount fallback
 *     - recordingDate trimmed to YYYY-MM-DD
 *   buildFlood
 *     - floodZone, femaFloodZone fallback
 *     - floodMapNumber, femaMapNumber fallback
 *     - floodMapDate trimmed
 *     - missing parcel → empty object
 *   lookupByAddress
 *     - MLS + parcels called in parallel (both calls fired)
 *     - returns null when both sources miss
 *     - returns MLS-only result when parcels miss
 *     - returns parcel-only result when MLS misses
 *     - fetches assessments + transactions when parcel has id
 *     - skips assessment/transaction fetch when parcel has no id
 *     - picks most recent assessment (highest year)
 *     - picks most recent transaction (latest recordingDate)
 *     - MLS failure is non-fatal (continues with parcel data)
 *     - parcels failure is non-fatal (continues with MLS data)
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// ─── Mock BridgeInteractiveService before importing the provider ──────────────
vi.mock('../src/services/bridge-interactive.service.js', () => {
  const mock = {
    searchByAddress: vi.fn(),
    searchParcels:   vi.fn(),
    getParcelAssessments:  vi.fn(),
    getParcelTransactions: vi.fn(),
  };
  return { BridgeInteractiveService: vi.fn(() => mock) };
});

import { BridgePropertyDataProvider } from '../src/services/property-data-providers/bridge.provider';
import { BridgeInteractiveService }    from '../src/services/bridge-interactive.service';

// ─── Helpers to get the mocked instance created inside the provider ───────────
function getBridgeMock() {
  // The provider constructor calls `new BridgeInteractiveService()`; the factory
  // returns the same mock object every time so we can inspect calls on it.
  return (BridgeInteractiveService as unknown as ReturnType<typeof vi.fn>).mock.results[
    (BridgeInteractiveService as unknown as ReturnType<typeof vi.fn>).mock.results.length - 1
  ]?.value as {
    searchByAddress:       MockedFunction<(...a: any[]) => any>;
    searchParcels:         MockedFunction<(...a: any[]) => any>;
    getParcelAssessments:  MockedFunction<(...a: any[]) => any>;
    getParcelTransactions: MockedFunction<(...a: any[]) => any>;
  };
}

const PARAMS = {
  street:  '4104 Illinois St',
  city:    'San Diego',
  state:   'CA',
  zipCode: '92104',
};

const FULL_ADDRESS = '4104 Illinois St, San Diego, CA 92104';

// ─── Fixture factories ────────────────────────────────────────────────────────

function makeMlsRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    LivingArea:             2150,
    BedroomsTotal:          3,
    BathroomsTotalDecimal:  2.5,
    YearBuilt:              1958,
    LotSizeArea:            8700,
    LotSizeUnits:           'Square Feet',
    PropertyType:           'Residential',
    StoriesTotal:           2,
    CountyOrParish:         'San Diego',
    GarageSpaces:           2,
    GarageType:             'Attached',
    ...overrides,
  };
}

function makeParcel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:                 'parcel-001',
    apn:                '550-010-01-00',
    coordinates:        [-117.1234, 32.7500],   // [lng, lat]
    lotSizeSquareFeet:  8700,
    county:             'San Diego',
    zoningCode:         'R-1',
    landUseCode:        'RESIDENTIAL',
    legal:              { lotDescription: 'LOT 14, BLOCK 7' },
    floodZone:          'X',
    floodMapNumber:     '06073C1605G',
    floodMapDate:       '2012-05-16T00:00:00Z',
    ...overrides,
  };
}

function makeAssessment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    totalValue:   420_000,
    year:         2025,
    taxAmount:    4_800,
    ...overrides,
  };
}

function makeTransaction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    salesPrice:     500_000,
    recordingDate:  '2023-07-14T00:00:00Z',
    ...overrides,
  };
}

// ─── Convenience: set all four mock methods on the bridge instance ────────────
function wireBridge(provider: BridgePropertyDataProvider, opts: {
  mls?:          unknown;
  parcels?:      unknown;
  assessments?:  unknown;
  transactions?: unknown;
}) {
  const m = getBridgeMock();
  m.searchByAddress.mockResolvedValue(opts.mls ?? []);
  m.searchParcels.mockResolvedValue(opts.parcels ?? null);
  m.getParcelAssessments.mockResolvedValue(opts.assessments ?? null);
  m.getParcelTransactions.mockResolvedValue(opts.transactions ?? null);
}

// ─────────────────────────────────────────────────────────────────────────────
// extractList (tested indirectly via parcels / assessments / transactions)
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — extractList (response shape variants)', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('handles bundle[] — Bridge public API shape', async () => {
    const parcel = makeParcel();
    const assessment = makeAssessment();
    wireBridge(provider, {
      mls:          { value: [makeMlsRecord()] },
      parcels:      { bundle: [parcel] },          // ← bridge public shape
      assessments:  { bundle: [assessment] },
      transactions: { bundle: [makeTransaction()] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
    expect(result!.publicRecord.taxAssessedValue).toBe(420_000);
  });

  it('handles value[] — MLS OData shape', async () => {
    wireBridge(provider, {
      mls:     { value: [makeMlsRecord()] },
      parcels: { value: [makeParcel()] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.grossLivingArea).toBe(2150);
  });

  it('handles results[] wrapper', async () => {
    wireBridge(provider, {
      parcels:      { results: [makeParcel()] },
      assessments:  { results: [makeAssessment()] },
      transactions: { results: [makeTransaction()] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
  });

  it('handles a bare array', async () => {
    wireBridge(provider, {
      parcels:      [makeParcel()],
      assessments:  [makeAssessment()],
      transactions: [makeTransaction()],
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
  });

  it('returns no data when response is null / undefined', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue(null);
    m.searchParcels.mockResolvedValue(null);
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });

  it('returns no data when response is not an object', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue(42);
    m.searchParcels.mockResolvedValue('bad');
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCore — MLS fields
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildCore MLS field mapping', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('maps all standard MLS fields', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord()] } });
    const result = await provider.lookupByAddress(PARAMS);
    const core = result!.core;

    expect(core.grossLivingArea).toBe(2150);
    expect(core.bedrooms).toBe(3);
    expect(core.bathsFull).toBe(2);
    expect(core.bathsHalf).toBe(1);   // 0.5 → 1 half
    expect(core.yearBuilt).toBe(1958);
    expect(core.lotSizeSqFt).toBe(8700);
    expect(core.propertyType).toBe('Residential');
    expect(core.stories).toBe(2);
    expect(core.county).toBe('San Diego');
  });

  it('splits whole bathroom decimal (2.0) into 2 full, 0 half', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord({ BathroomsTotalDecimal: 2.0 })] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.bathsFull).toBe(2);
    expect(result!.core.bathsHalf).toBe(0);
  });

  it('splits 3.5 baths → 3 full, 1 half', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord({ BathroomsTotalDecimal: 3.5 })] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.bathsFull).toBe(3);
    expect(result!.core.bathsHalf).toBe(1);
  });

  it('converts LotSizeArea in acres to sqft', async () => {
    wireBridge(provider, {
      mls: { value: [makeMlsRecord({ LotSizeArea: 0.25, LotSizeUnits: 'Acres' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.lotSizeSqFt).toBe(Math.round(0.25 * 43_560));
  });

  it('formats garage as "<n>-car <type>" when both spaces and type present', async () => {
    wireBridge(provider, {
      mls: { value: [makeMlsRecord({ GarageSpaces: 2, GarageType: 'Attached' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.garage).toBe('2-car Attached');
  });

  it('formats garage as "<n>-car" when only spaces present', async () => {
    wireBridge(provider, {
      mls: { value: [makeMlsRecord({ GarageSpaces: 1, GarageType: undefined })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.garage).toBe('1-car');
  });

  it('omits garage field when neither spaces nor type present', async () => {
    wireBridge(provider, {
      mls: { value: [makeMlsRecord({ GarageSpaces: undefined, GarageType: undefined })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.garage).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCore — parcel fields
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildCore parcel field mapping', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('reads APN from `apn` field (primary)', async () => {
    wireBridge(provider, { parcels: { bundle: [makeParcel({ apn: '123-456-78' })] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.parcelNumber).toBe('123-456-78');
  });

  it('falls back to `parcelNumber` when `apn` is absent', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ apn: undefined, parcelNumber: 'OLD-FORMAT' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.parcelNumber).toBe('OLD-FORMAT');
  });

  it('decodes GeoJSON [lng, lat] into core.latitude / core.longitude', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ coordinates: [-117.1234, 32.7500] })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.latitude).toBe(32.7500);
    expect(result!.core.longitude).toBe(-117.1234);
  });

  it('ignores [0, 0] coordinates (means unavailable in Bridge API)', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ coordinates: [0, 0] })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.latitude).toBeUndefined();
    expect(result!.core.longitude).toBeUndefined();
  });

  it('uses parcel lotSizeSquareFeet when MLS provides no lot size', async () => {
    wireBridge(provider, {
      mls:     { value: [makeMlsRecord({ LotSizeArea: undefined })] },
      parcels: { bundle: [makeParcel({ lotSizeSquareFeet: 6_534 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.lotSizeSqFt).toBe(6_534);
  });

  it('does NOT overwrite MLS lot size with parcel value', async () => {
    wireBridge(provider, {
      mls:     { value: [makeMlsRecord({ LotSizeArea: 8700, LotSizeUnits: 'Square Feet' })] },
      parcels: { bundle: [makeParcel({ lotSizeSquareFeet: 6_534 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.lotSizeSqFt).toBe(8700);
  });

  it('uses parcel county when MLS has no county', async () => {
    wireBridge(provider, {
      mls:     { value: [makeMlsRecord({ CountyOrParish: undefined })] },
      parcels: { bundle: [makeParcel({ county: 'Riverside' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.county).toBe('Riverside');
  });

  it('does NOT overwrite MLS county with parcel county', async () => {
    wireBridge(provider, {
      mls:     { value: [makeMlsRecord({ CountyOrParish: 'San Diego' })] },
      parcels: { bundle: [makeParcel({ county: 'Los Angeles' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.core.county).toBe('San Diego');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPublicRecord — parcel portion
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildPublicRecord parcel fields', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('reads zoningCode (primary)', async () => {
    wireBridge(provider, { parcels: { bundle: [makeParcel({ zoningCode: 'R-2', zoning: 'OLD' })] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.zoning).toBe('R-2');
  });

  it('falls back to zoning when zoningCode absent', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ zoningCode: undefined, zoning: 'C-1' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.zoning).toBe('C-1');
  });

  it('reads landUseCode (primary)', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ landUseCode: 'SFR', landUse: 'OLD', landUseGeneral: 'GENERAL' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.landUseCode).toBe('SFR');
  });

  it('falls back to landUse then landUseGeneral', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ landUseCode: undefined, landUse: undefined, landUseGeneral: 'RESIDENTIAL' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.landUseCode).toBe('RESIDENTIAL');
  });

  it('reads legal description from parcel.legal.lotDescription', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ legal: { lotDescription: 'LOT 14, BLOCK 7' } })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.legalDescription).toBe('LOT 14, BLOCK 7');
  });

  it('leaves legalDescription undefined when legal object is absent', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ legal: undefined })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.legalDescription).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPublicRecord — assessment portion
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildPublicRecord assessment fields', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('reads totalValue as taxAssessedValue (primary)', async () => {
    const parcel = makeParcel();
    wireBridge(provider, {
      parcels:     { bundle: [parcel] },
      assessments: { bundle: [makeAssessment({ totalValue: 420_000 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxAssessedValue).toBe(420_000);
  });

  it('falls back to assessedValue when totalValue absent', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [makeAssessment({ totalValue: undefined, assessedValue: 390_000 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxAssessedValue).toBe(390_000);
  });

  it('falls back to taxAssessedValue when both primary fields absent', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [{ year: 2024, taxAmount: 4_000, taxAssessedValue: 350_000 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxAssessedValue).toBe(350_000);
  });

  it('reads taxAmount as annualTaxAmount (primary)', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [makeAssessment({ taxAmount: 5_100 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.annualTaxAmount).toBe(5_100);
  });

  it('falls back to annualTaxAmount field name', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [{ totalValue: 400_000, year: 2024, annualTaxAmount: 4_600 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.annualTaxAmount).toBe(4_600);
  });

  it('reads year as taxYear', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [makeAssessment({ year: 2025 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxYear).toBe(2025);
  });

  it('falls back to taxYear field name', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [{ totalValue: 420_000, taxYear: 2024, taxAmount: 4_800 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxYear).toBe(2024);
  });

  it('does NOT set ownerName — Bridge assessment has no owner field', async () => {
    wireBridge(provider, {
      parcels:     { bundle: [makeParcel()] },
      assessments: { bundle: [{ ...makeAssessment(), ownerName: 'Should Be Ignored' }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    // ownerName is not in PropertyDataPublicRecord — confirm it's not set
    expect((result!.publicRecord as any).ownerName).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPublicRecord — transaction portion
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildPublicRecord transaction fields', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('reads salesPrice as deedTransferAmount (primary)', async () => {
    wireBridge(provider, {
      parcels:      { bundle: [makeParcel()] },
      transactions: { bundle: [makeTransaction({ salesPrice: 500_000 })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferAmount).toBe(500_000);
  });

  it('falls back to amount field', async () => {
    wireBridge(provider, {
      parcels:      { bundle: [makeParcel()] },
      transactions: { bundle: [{ recordingDate: '2022-01-01', amount: 450_000 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferAmount).toBe(450_000);
  });

  it('falls back to saleAmount field', async () => {
    wireBridge(provider, {
      parcels:      { bundle: [makeParcel()] },
      transactions: { bundle: [{ recordingDate: '2022-01-01', saleAmount: 430_000 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferAmount).toBe(430_000);
  });

  it('trims recordingDate to YYYY-MM-DD', async () => {
    wireBridge(provider, {
      parcels:      { bundle: [makeParcel()] },
      transactions: { bundle: [makeTransaction({ recordingDate: '2023-07-14T00:00:00Z' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferDate).toBe('2023-07-14');
  });

  it('leaves deedTransferDate undefined when recordingDate absent', async () => {
    wireBridge(provider, {
      parcels:      { bundle: [makeParcel()] },
      transactions: { bundle: [{ salesPrice: 400_000 }] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferDate).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFlood
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — buildFlood', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => { provider = new BridgePropertyDataProvider(); });

  it('reads floodZone (primary)', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ floodZone: 'AE', femaFloodZone: 'X' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood.femaFloodZone).toBe('AE');
  });

  it('falls back to femaFloodZone', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ floodZone: undefined, femaFloodZone: 'X500' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood.femaFloodZone).toBe('X500');
  });

  it('reads floodMapNumber (primary)', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ floodMapNumber: '06073C1605G', femaMapNumber: 'OLD' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood.femaMapNumber).toBe('06073C1605G');
  });

  it('falls back to femaMapNumber', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ floodMapNumber: undefined, femaMapNumber: 'ALT-MAP' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood.femaMapNumber).toBe('ALT-MAP');
  });

  it('trims floodMapDate to YYYY-MM-DD', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({ floodMapDate: '2012-05-16T00:00:00Z' })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood.femaMapDate).toBe('2012-05-16');
  });

  it('returns empty flood object when parcel has no flood fields', async () => {
    wireBridge(provider, {
      parcels: { bundle: [makeParcel({
        floodZone: undefined, femaFloodZone: undefined,
        floodMapNumber: undefined, femaMapNumber: undefined,
        floodMapDate: undefined, femaMapDate: undefined,
      })] },
    });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.flood).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lookupByAddress — control flow
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePropertyDataProvider — lookupByAddress control flow', () => {
  let provider: BridgePropertyDataProvider;
  beforeEach(() => {
    vi.clearAllMocks();
    provider = new BridgePropertyDataProvider();
  });

  it('calls MLS searchByAddress with the full address string', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord()] } });
    await provider.lookupByAddress(PARAMS);
    const m = getBridgeMock();
    expect(m.searchByAddress).toHaveBeenCalledWith({ address: FULL_ADDRESS });
  });

  it('calls searchParcels with the full address string', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord()] } });
    await provider.lookupByAddress(PARAMS);
    const m = getBridgeMock();
    expect(m.searchParcels).toHaveBeenCalledWith({ address: FULL_ADDRESS });
  });

  it('issues MLS + parcel calls in parallel (both called in same pass)', async () => {
    let mlsCalled = false;
    let parcelCalled = false;
    const m = getBridgeMock();
    m.searchByAddress.mockImplementation(() => {
      mlsCalled = true;
      return Promise.resolve([makeMlsRecord()]);
    });
    m.searchParcels.mockImplementation(() => {
      parcelCalled = true;
      return Promise.resolve({ bundle: [makeParcel()] });
    });
    m.getParcelAssessments.mockResolvedValue(null);
    m.getParcelTransactions.mockResolvedValue(null);
    await provider.lookupByAddress(PARAMS);
    expect(mlsCalled).toBe(true);
    expect(parcelCalled).toBe(true);
  });

  it('returns null when both MLS and parcels miss', async () => {
    wireBridge(provider, { mls: [], parcels: null });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });

  it('returns MLS-only data when parcels return no results', async () => {
    wireBridge(provider, { mls: { value: [makeMlsRecord()] }, parcels: { bundle: [] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.grossLivingArea).toBe(2150);
    expect(result!.core.parcelNumber).toBeUndefined();
  });

  it('returns parcel-only data when MLS returns no results', async () => {
    wireBridge(provider, { mls: [], parcels: { bundle: [makeParcel()] } });
    const result = await provider.lookupByAddress(PARAMS);
    expect(result).not.toBeNull();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
    expect(result!.core.grossLivingArea).toBeUndefined();
  });

  it('fetches assessments and transactions when parcel has an id', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([]);
    m.searchParcels.mockResolvedValue({ bundle: [makeParcel({ id: 'parcel-001' })] });
    m.getParcelAssessments.mockResolvedValue({ bundle: [makeAssessment()] });
    m.getParcelTransactions.mockResolvedValue({ bundle: [makeTransaction()] });

    await provider.lookupByAddress(PARAMS);

    expect(m.getParcelAssessments).toHaveBeenCalledWith('parcel-001');
    expect(m.getParcelTransactions).toHaveBeenCalledWith('parcel-001');
  });

  it('skips assessment/transaction fetch when parcel has no id', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([]);
    const parcelNoId = makeParcel({ id: undefined, parcelId: undefined });
    m.searchParcels.mockResolvedValue({ bundle: [parcelNoId] });

    await provider.lookupByAddress(PARAMS);

    expect(m.getParcelAssessments).not.toHaveBeenCalled();
    expect(m.getParcelTransactions).not.toHaveBeenCalled();
  });

  it('picks the most recent assessment by year (highest year wins)', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([]);
    m.searchParcels.mockResolvedValue({ bundle: [makeParcel()] });
    m.getParcelAssessments.mockResolvedValue({ bundle: [
      { totalValue: 300_000, year: 2023, taxAmount: 3_600 },
      { totalValue: 420_000, year: 2025, taxAmount: 4_800 },
      { totalValue: 360_000, year: 2024, taxAmount: 4_200 },
    ]});
    m.getParcelTransactions.mockResolvedValue(null);

    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.taxAssessedValue).toBe(420_000);
    expect(result!.publicRecord.taxYear).toBe(2025);
  });

  it('picks the most recent transaction by recordingDate', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([]);
    m.searchParcels.mockResolvedValue({ bundle: [makeParcel()] });
    m.getParcelAssessments.mockResolvedValue(null);
    m.getParcelTransactions.mockResolvedValue({ bundle: [
      { salesPrice: 300_000, recordingDate: '2018-03-10' },
      { salesPrice: 500_000, recordingDate: '2023-07-14' },
      { salesPrice: 420_000, recordingDate: '2021-11-05' },
    ]});

    const result = await provider.lookupByAddress(PARAMS);
    expect(result!.publicRecord.deedTransferAmount).toBe(500_000);
    expect(result!.publicRecord.deedTransferDate).toBe('2023-07-14');
  });

  it('MLS failure is non-fatal — continues with parcel-only data', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockRejectedValue(new Error('MLS network error'));
    m.searchParcels.mockResolvedValue({ bundle: [makeParcel()] });
    m.getParcelAssessments.mockResolvedValue({ bundle: [makeAssessment()] });
    m.getParcelTransactions.mockResolvedValue({ bundle: [makeTransaction()] });

    const result = await provider.lookupByAddress(PARAMS);

    expect(result).not.toBeNull();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
    expect(result!.core.grossLivingArea).toBeUndefined();
  });

  it('parcels failure is non-fatal — continues with MLS-only data', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([makeMlsRecord()]);
    m.searchParcels.mockRejectedValue(new Error('parcels API 503'));

    const result = await provider.lookupByAddress(PARAMS);

    expect(result).not.toBeNull();
    expect(result!.core.grossLivingArea).toBe(2150);
    expect(result!.core.parcelNumber).toBeUndefined();
  });

  it('assessments failure is non-fatal — result still includes parcel + MLS data', async () => {
    const m = getBridgeMock();
    m.searchByAddress.mockResolvedValue([makeMlsRecord()]);
    m.searchParcels.mockResolvedValue({ bundle: [makeParcel()] });
    m.getParcelAssessments.mockRejectedValue(new Error('assessments 429'));
    m.getParcelTransactions.mockResolvedValue(null);

    const result = await provider.lookupByAddress(PARAMS);

    expect(result).not.toBeNull();
    expect(result!.publicRecord.taxAssessedValue).toBeUndefined();
    expect(result!.core.parcelNumber).toBe('550-010-01-00');
    expect(result!.core.grossLivingArea).toBe(2150);
  });

  it('result shape includes source, fetchedAt, rawProviderData', async () => {
    wireBridge(provider, {
      mls:          { value: [makeMlsRecord()] },
      parcels:      { bundle: [makeParcel()] },
      assessments:  { bundle: [makeAssessment()] },
      transactions: { bundle: [makeTransaction()] },
    });
    const result = await provider.lookupByAddress(PARAMS);

    expect(result!.source).toBe('Bridge Interactive');
    expect(result!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result!.rawProviderData).toBeDefined();
    expect(result!.rawProviderData.parcel).toBeDefined();
    expect(result!.rawProviderData.mls).toBeDefined();
    expect(result!.rawProviderData.assessment).toBeDefined();
    expect(result!.rawProviderData.transaction).toBeDefined();
  });
});
