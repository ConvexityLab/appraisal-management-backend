/**
 * PropertyEnrichmentService — Unit Tests
 *
 * Tests cover:
 *   - enrichOrder: happy-path with a full provider result (enriched status)
 *   - enrichOrder: provider miss (provider_miss status)
 *   - enrichOrder: createVersion called with correct building + top-level fields
 *   - enrichOrder: tax assessment appended when present
 *   - enrichOrder: tax assessment skipped when year already exists
 *   - enrichOrder: enrichment record persisted to Cosmos
 *   - enrichOrder: enrichment failure is non-fatal (does not throw)
 *   - enrichOrder: throws on missing orderId / tenantId / address fields
 *   - enrichOrder: returns status=cached when PropertyRecord is fresh (no Bridge call)
 *   - enrichOrder: calls Bridge when PropertyRecord is stale (> TTL days)
 *   - enrichOrder: always calls Bridge for brand-new PropertyRecords (isNew=true)
 *   - getLatestEnrichment: returns most recent enrichment record
 *   - getLatestEnrichment: returns null when none found
 *   - OrderEventService.handleOrderCreated: calls enrichOrder on complete address
 *   - OrderEventService.handleOrderCreated: skips enrichment on incomplete address
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PropertyEnrichmentService,
  PROPERTY_ENRICHMENTS_CONTAINER,
} from '../src/services/property-enrichment.service';
import type { PropertyEnrichmentRecord } from '../src/services/property-enrichment.service';
import type { PropertyDataProvider, PropertyDataResult } from '../src/types/property-data.types';
import type { PropertyRecord } from '../src/types/property-record.types';
import { PropertyRecordType } from '../src/types/property-record.types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT = 'tenant-abc';
const ORDER_ID = 'order-001';
const PROPERTY_ID = 'prop-xyz';

const BASE_ADDRESS = {
  street: '5432 Mockingbird Ln',
  city: 'Dallas',
  state: 'TX',
  zipCode: '75206',
};

function makeFullDataResult(): PropertyDataResult {
  return {
    source: 'Bridge Interactive',
    fetchedAt: '2026-03-30T12:00:00.000Z',
    core: {
      grossLivingArea: 2_150,
      bedrooms: 3,
      bathsFull: 2,
      bathsHalf: 0,
      yearBuilt: 1958,
      lotSizeSqFt: 8_700,
      propertyType: 'Residential',
      parcelNumber: '00-1234-0056-789',
      county: 'Dallas',
      latitude: 32.8348,
      longitude: -96.7697,
    },
    publicRecord: {
      taxAssessedValue: 385_000,
      taxYear: 2025,
      annualTaxAmount: 9_200,
      ownerName: 'Alice Homeowner',
      legalDescription: 'LOT 14, BLOCK 7, MOCKINGBIRD PARK',
      zoning: 'R-7.5',
      deedTransferDate: '2020-06-15',
      deedTransferAmount: 310_000,
    },
    flood: {
      femaFloodZone: 'X',
      femaMapNumber: '48113C0340J',
      femaMapDate: '2009-09-25',
    },
  };
}

function makeExistingPropertyRecord(overrides: Partial<PropertyRecord> = {}): PropertyRecord {
  return {
    id: PROPERTY_ID,
    tenantId: TENANT,
    address: {
      street: '5432 MOCKINGBIRD LN',
      city: 'DALLAS',
      state: 'TX',
      zip: '75206',
    },
    propertyType: PropertyRecordType.SINGLE_FAMILY,
    building: {
      gla: 0,
      yearBuilt: 0,
      bedrooms: 0,
      bathrooms: 0,
    },
    taxAssessments: [],
    permits: [],
    recordVersion: 1,
    versionHistory: [],
    dataSource: 'MANUAL_ENTRY',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    createdBy: 'SYSTEM',
    ...overrides,
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeProvider(result: PropertyDataResult | null): PropertyDataProvider {
  return {
    lookupByAddress: vi.fn().mockResolvedValue(result),
  };
}

function makePropertyRecordService(isNew: boolean = false) {
  const record = makeExistingPropertyRecord();
  return {
    resolveOrCreate: vi.fn().mockResolvedValue({
      propertyId: PROPERTY_ID,
      isNew,
      method: isNew ? 'ADDRESS_NORM' : 'ADDRESS_NORM',
    }),
    getById: vi.fn().mockResolvedValue(record),
    createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
      ...record,
      ...changes,
    })),
  };
}

function makeCosmosService(existingEnrichments: PropertyEnrichmentRecord[] = []) {
  return {
    createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
    queryDocuments: vi.fn().mockResolvedValue(existingEnrichments),
  };
}

/**
 * Default no-op geocoder used by tests that don't exercise the geocoding
 * branch of enrichOrder. Returns null so the new geocoding step in
 * PropertyEnrichmentService produces a structured warning and continues
 * without mutating the address — leaving existing assertions on
 * createVersion call counts / payloads intact.
 */
function makeNoopGeocoder() {
  return { geocode: vi.fn().mockResolvedValue(null) };
}

/**
 * Mock BridgeInteractiveService injected into PropertyEnrichmentService to
 * prevent tests from instantiating a real service that reads env vars.
 * Returns null so the AVM extraction finds no numeric value and
 * createVersion is NOT called for AVM — keeping existing assertions intact.
 */
function makeBridgeService() {
  return { getZestimateByStructuredAddress: vi.fn().mockResolvedValue(null) };
}

// ─── enrichOrder: happy path ──────────────────────────────────────────────────

describe('PropertyEnrichmentService.enrichOrder', () => {
  it('returns status=enriched when provider returns data', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('enriched');
    expect(result.propertyId).toBe(PROPERTY_ID);
    expect(result.enrichmentId).toMatch(/^enrich-order-001-/);
    expect(provider.lookupByAddress).toHaveBeenCalledOnce();
    expect(provider.lookupByAddress).toHaveBeenCalledWith({
      street: BASE_ADDRESS.street,
      city: BASE_ADDRESS.city,
      state: BASE_ADDRESS.state,
      zipCode: BASE_ADDRESS.zipCode,
    });
  });

  it('calls resolveOrCreate with correct address', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(propSvc.resolveOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        address: {
          street: BASE_ADDRESS.street,
          city: BASE_ADDRESS.city,
          state: BASE_ADDRESS.state,
          zip: BASE_ADDRESS.zipCode,
        },
        tenantId: TENANT,
      }),
    );
  });

  it('calls createVersion with building and top-level changes from enrichment', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false); // existing record → createVersion
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    // createVersion called at least once (building data + possibly tax assessment)
    expect(propSvc.createVersion).toHaveBeenCalled();

    const [firstCallId, firstCallTenant, firstCallChanges] =
      propSvc.createVersion.mock.calls[0] as [string, string, any];

    expect(firstCallId).toBe(PROPERTY_ID);
    expect(firstCallTenant).toBe(TENANT);
    // Building fields
    expect(firstCallChanges.building?.gla).toBe(2_150);
    expect(firstCallChanges.building?.yearBuilt).toBe(1958);
    expect(firstCallChanges.building?.bedrooms).toBe(3);
    expect(firstCallChanges.building?.fullBathrooms).toBe(2);
    // Top-level fields
    expect(firstCallChanges.apn).toBe('00-1234-0056-789');
    expect(firstCallChanges.lotSizeSqFt).toBe(8_700);
    expect(firstCallChanges.zoning).toBe('R-7.5');
    expect(firstCallChanges.currentOwner).toBe('Alice Homeowner');
    expect(firstCallChanges.floodZone).toBe('X');
  });

  it('passes provider photos through to createVersion changes', async () => {
    const dataResult = makeFullDataResult();
    dataResult.photos = [
      { url: 'https://photos.example.com/abc/photo_1.jpg', source: 'vendor', type: null },
      { url: 'https://photos.example.com/abc/photo_2.jpg', source: 'vendor', type: null },
    ];
    const provider = makeProvider(dataResult);
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const [, , firstCallChanges] = propSvc.createVersion.mock.calls[0] as [string, string, any];
    expect(firstCallChanges.photos).toEqual(dataResult.photos);
  });

  it('does NOT overwrite photos when provider returns an empty array', async () => {
    const dataResult = makeFullDataResult();
    dataResult.photos = [];
    const provider = makeProvider(dataResult);
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const [, , firstCallChanges] = propSvc.createVersion.mock.calls[0] as [string, string, any];
    expect(firstCallChanges.photos).toBeUndefined();
  });

  it('records lastVerifiedSource on the record and forwards sourceProvider to createVersion', async () => {
    const provider = makeProvider(makeFullDataResult()); // source: 'Bridge Interactive'
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const [, , firstCallChanges, , , , sourceArtifactId, firstCallSourceProvider] =
      propSvc.createVersion.mock.calls[0] as [
        string,
        string,
        any,
        string,
        string,
        string,
        string | undefined,
        string,
      ];

    // Top-level lastVerifiedSource is set on the PropertyRecord changes payload
    expect(firstCallChanges.lastVerifiedSource).toBe('Bridge Interactive');
    // The 8th argument to createVersion is the per-version sourceProvider audit value
    expect(firstCallSourceProvider).toBe('Bridge Interactive');
  });

  it('appends tax assessment when year not already present', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    // createVersion should have been called at least twice:
    // once for building/top-level, once for tax assessment
    const taxCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => (args[5] as string) === 'SYSTEM:property-enrichment' &&
        (args[4] as string) === 'PUBLIC_RECORDS_API' &&
        Array.isArray(args[2].taxAssessments)
    );
    expect(taxCall).toBeDefined();
    expect(taxCall![2].taxAssessments[0]).toMatchObject({
      taxYear: 2025,
      totalAssessedValue: 385_000,
      annualTaxAmount: 9_200,
    });
  });

  it('skips tax assessment append when year already exists in record', async () => {
    const provider = makeProvider(makeFullDataResult());

    // Record already has a 2025 assessment
    const existingRecord = makeExistingPropertyRecord({
      taxAssessments: [{ taxYear: 2025, totalAssessedValue: 375_000 }],
    });
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: false, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(existingRecord),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...existingRecord,
        ...changes,
      })),
    };
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const taxCalls = propSvc.createVersion.mock.calls.filter(
      (args: any[]) => Array.isArray(args[2]?.taxAssessments)
    );
    expect(taxCalls).toHaveLength(0);
  });

  it('persists an enrichment record to Cosmos', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(cosmos.createDocument).toHaveBeenCalledWith(
      PROPERTY_ENRICHMENTS_CONTAINER,
      expect.objectContaining({
        type: 'property-enrichment',
        orderId: ORDER_ID,
        tenantId: TENANT,
        propertyId: PROPERTY_ID,
        status: 'enriched',
      }),
    );
  });

  it('returns status=provider_miss and persists record when provider returns null', async () => {
    const provider = makeProvider(null);
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('provider_miss');
    // createVersion must NOT have been called on a miss
    expect(propSvc.createVersion).not.toHaveBeenCalled();
    // But enrichment record IS persisted
    expect(cosmos.createDocument).toHaveBeenCalledWith(
      PROPERTY_ENRICHMENTS_CONTAINER,
      expect.objectContaining({ status: 'provider_miss', dataResult: null }),
    );
  });

  it('throws when orderId is missing', async () => {
    const svc = new PropertyEnrichmentService(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );
    await expect(svc.enrichOrder('', TENANT, BASE_ADDRESS)).rejects.toThrow('orderId is required');
  });

  it('throws when tenantId is missing', async () => {
    const svc = new PropertyEnrichmentService(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );
    await expect(svc.enrichOrder(ORDER_ID, '', BASE_ADDRESS)).rejects.toThrow('tenantId is required');
  });

  it('throws when address fields are incomplete', async () => {
    const svc = new PropertyEnrichmentService(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );
    await expect(
      svc.enrichOrder(ORDER_ID, TENANT, { street: '', city: 'Dallas', state: 'TX', zipCode: '75206' }),
    ).rejects.toThrow('address.street, city, state, and zipCode are all required');
  });

  // ── Cache-hit: PropertyRecord is fresh → Bridge not called ─────────────────
  it('returns status=cached and skips Bridge when PropertyRecord was verified recently', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const freshRecord = makeExistingPropertyRecord({ lastVerifiedAt: yesterday });

    const provider = makeProvider(makeFullDataResult());
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: false, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(freshRecord),
      createVersion: vi.fn(),
    };
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('cached');
    expect(result.propertyId).toBe(PROPERTY_ID);
    // Provider must NOT be called when cache is fresh
    expect(provider.lookupByAddress).not.toHaveBeenCalled();
    // PropertyRecord must NOT be mutated
    expect(propSvc.createVersion).not.toHaveBeenCalled();
    // Enrichment record IS written to Cosmos with status=cached
    expect(cosmos.createDocument).toHaveBeenCalledWith(
      PROPERTY_ENRICHMENTS_CONTAINER,
      expect.objectContaining({
        type: 'property-enrichment',
        orderId: ORDER_ID,
        tenantId: TENANT,
        propertyId: PROPERTY_ID,
        status: 'cached',
        dataResult: null,
      }),
    );
  });

  // ── Cache-miss: data is stale → Bridge called normally ─────────────────────
  it('calls Bridge and returns status=enriched when PropertyRecord is older than TTL', async () => {
    // 31 days ago — beyond the default 30-day TTL
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const staleRecord = makeExistingPropertyRecord({ lastVerifiedAt: staleDate });

    const provider = makeProvider(makeFullDataResult());
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: false, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(staleRecord),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...staleRecord,
        ...changes,
      })),
    };
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('enriched');
    expect(provider.lookupByAddress).toHaveBeenCalledOnce();
  });

  // ── New record: always hits Bridge even if lastVerifiedAt is set ────────────
  it('calls Bridge even when lastVerifiedAt is recent on a brand-new PropertyRecord', async () => {
    // Edge case: resolveOrCreate returns isNew=true but somehow lastVerifiedAt is set.
    // We must always call Bridge for new records so the first-ever data is populated.
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const newRecord = makeExistingPropertyRecord({ lastVerifiedAt: yesterday });

    const provider = makeProvider(makeFullDataResult());
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: true, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(newRecord),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...newRecord,
        ...changes,
      })),
    };
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('enriched');
    expect(provider.lookupByAddress).toHaveBeenCalledOnce();
  });
});

// ─── enrichOrder: geocoding step ─────────────────────────────────────────────
//
// The geocoding step runs after `resolveOrCreate` / `getById` and only when
// the resolved PropertyRecord lacks `address.latitude` or `address.longitude`.
// It exists because downstream comp-collection refuses to run without subject
// coordinates (NO_COORDINATES skip), and the property-data provider does not
// supply lat/lng for newly resolved subjects.

describe('PropertyEnrichmentService.enrichOrder — geocoding', () => {
  it('throws at construction time when no geocoder is provided (no silent fallback)', () => {
    expect(() => new (PropertyEnrichmentService as any)(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      undefined,
    )).toThrow(/geocoder is required/);
  });

  it('calls geocoder and patches address.latitude/longitude when record lacks coordinates', async () => {
    const provider = makeProvider(null); // status irrelevant; we want to assert the geocoding side-effect
    const propSvc = makePropertyRecordService(false); // record has no lat/lng
    const cosmos = makeCosmosService();
    const geocoder = {
      geocode: vi.fn().mockResolvedValue({ latitude: 32.8348, longitude: -96.7697 }),
    };

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, geocoder as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(geocoder.geocode).toHaveBeenCalledOnce();
    expect(geocoder.geocode).toHaveBeenCalledWith({
      street: BASE_ADDRESS.street,
      city: BASE_ADDRESS.city,
      state: BASE_ADDRESS.state,
      zip: BASE_ADDRESS.zipCode,
    });

    // createVersion called for the address patch (provider returned null so no
    // building/tax versions follow).
    const addressPatchCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address?.latitude === 32.8348 && args[2]?.address?.longitude === -96.7697,
    );
    expect(addressPatchCall).toBeDefined();
    expect(addressPatchCall![2].address.isNormalized).toBe(true);
    expect(typeof addressPatchCall![2].address.geocodedAt).toBe('string');
    // Patch must preserve the rest of the address.
    expect(addressPatchCall![2].address.street).toBe('5432 MOCKINGBIRD LN');
    expect(addressPatchCall![2].address.city).toBe('DALLAS');
  });

  it('does NOT call geocoder when the record already has coordinates', async () => {
    const recordWithCoords = makeExistingPropertyRecord({
      address: {
        street: '5432 MOCKINGBIRD LN',
        city: 'DALLAS',
        state: 'TX',
        zip: '75206',
        latitude: 32.8348,
        longitude: -96.7697,
      },
    });
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: false, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(recordWithCoords),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...recordWithCoords,
        ...changes,
      })),
    };
    const provider = makeProvider(null);
    const cosmos = makeCosmosService();
    const geocoder = { geocode: vi.fn().mockResolvedValue({ latitude: 99, longitude: 99 }) };

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, geocoder as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(geocoder.geocode).not.toHaveBeenCalled();
    // Address must not be patched.
    const addressPatchCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address !== undefined,
    );
    expect(addressPatchCall).toBeUndefined();
  });

  it('does not throw when geocoder rejects — order placement must not be blocked', async () => {
    const provider = makeProvider(null);
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();
    const geocoder = { geocode: vi.fn().mockRejectedValue(new Error('geocoder API down')) };

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, geocoder as any, makeBridgeService() as any);
    await expect(svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS)).resolves.toBeDefined();
    expect(geocoder.geocode).toHaveBeenCalledOnce();
    // No address-patch version was created.
    const addressPatchCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address !== undefined,
    );
    expect(addressPatchCall).toBeUndefined();
  });

  it('does not patch when geocoder returns null (no-match)', async () => {
    const provider = makeProvider(null);
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();
    const geocoder = { geocode: vi.fn().mockResolvedValue(null) };

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, geocoder as any, makeBridgeService() as any);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(geocoder.geocode).toHaveBeenCalledOnce();
    const addressPatchCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address !== undefined,
    );
    expect(addressPatchCall).toBeUndefined();
  });
});

// ─── getLatestEnrichment ──────────────────────────────────────────────────────

describe('PropertyEnrichmentService.getLatestEnrichment', () => {
  it('returns the enrichment record when one exists', async () => {
    const record: PropertyEnrichmentRecord = {
      id: 'enrich-order-001-111',
      type: 'property-enrichment',
      orderId: ORDER_ID,
      tenantId: TENANT,
      propertyId: PROPERTY_ID,
      status: 'enriched',
      dataResult: null,
      createdAt: '2026-03-30T12:00:00.000Z',
    };

    const cosmos = makeCosmosService([record]);
    const svc = new PropertyEnrichmentService(
      cosmos as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );

    const result = await svc.getLatestEnrichment(ORDER_ID, TENANT);
    expect(result).toEqual(record);
  });

  it('returns null when no enrichment record exists', async () => {
    const cosmos = makeCosmosService([]);
    const svc = new PropertyEnrichmentService(
      cosmos as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );

    const result = await svc.getLatestEnrichment(ORDER_ID, TENANT);
    expect(result).toBeNull();
  });

  it('throws when tenantId is missing', async () => {
    const cosmos = makeCosmosService([]);
    const svc = new PropertyEnrichmentService(
      cosmos as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );
    await expect(svc.getLatestEnrichment(ORDER_ID, '')).rejects.toThrow('tenantId is required');
  });
});

// ─── OrderEventService integration ───────────────────────────────────────────

describe('OrderEventService with PropertyEnrichmentService', () => {
  it('calls enrichOrder on handleOrderCreated with full address', async () => {
    // Import here to avoid hoisting issues
    const { OrderEventService } = await import('../src/services/order-event.service');

    const enrichSpy = vi.fn().mockResolvedValue({
      enrichmentId: 'enrich-order-001-111',
      propertyId: PROPERTY_ID,
      status: 'enriched',
    });
    const mockEnrichmentSvc = { enrichOrder: enrichSpy } as any;

    const svc = new OrderEventService(mockEnrichmentSvc);

    // Access the private method via casting
    const eventData = {
      eventType: 'ORDER_CREATED',
      orderId: ORDER_ID,
      tenantId: TENANT,
      propertyAddress: {
        streetAddress: '5432 Mockingbird Ln',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75206',
      },
    };

    // processOrderEvent is public-facing; exercise through it
    await (svc as any).processOrderEvent(eventData);

    expect(enrichSpy).toHaveBeenCalledOnce();
    expect(enrichSpy).toHaveBeenCalledWith(
      ORDER_ID,
      TENANT,
      { street: '5432 Mockingbird Ln', city: 'Dallas', state: 'TX', zipCode: '75206' },
    );
  });

  it('does not throw when enrichOrder rejects (non-fatal)', async () => {
    const { OrderEventService } = await import('../src/services/order-event.service');

    const enrichSpy = vi.fn().mockRejectedValue(new Error('bridge API down'));
    const mockEnrichmentSvc = { enrichOrder: enrichSpy } as any;

    const svc = new OrderEventService(mockEnrichmentSvc);

    const eventData = {
      eventType: 'ORDER_CREATED',
      orderId: ORDER_ID,
      tenantId: TENANT,
      propertyAddress: {
        streetAddress: '5432 Mockingbird Ln',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75206',
      },
    };

    // Must not throw even though enrichOrder rejected
    await expect((svc as any).processOrderEvent(eventData)).resolves.not.toThrow();
  });

  it('skips enrichOrder when propertyAddress is incomplete', async () => {
    const { OrderEventService } = await import('../src/services/order-event.service');

    const enrichSpy = vi.fn();
    const mockEnrichmentSvc = { enrichOrder: enrichSpy } as any;

    const svc = new OrderEventService(mockEnrichmentSvc);

    const eventData = {
      eventType: 'ORDER_CREATED',
      orderId: ORDER_ID,
      tenantId: TENANT,
      propertyAddress: { streetAddress: '', city: 'Dallas', state: 'TX', zipCode: '75206' },
    };

    await (svc as any).processOrderEvent(eventData);
    expect(enrichSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PropertyEnrichmentService.enrichEngagement
// ─────────────────────────────────────────────────────────────────────────────

describe('PropertyEnrichmentService.enrichEngagement', () => {
  it('delegates to enrichOrder using loanId as the entity reference', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    const enrichOrderSpy = vi.spyOn(svc, 'enrichOrder').mockResolvedValue({
      enrichmentId: 'enrich-loan-001-123',
      propertyId:   'prop-001',
      status:       'enriched',
    });

    const result = await svc.enrichEngagement('eng-001', 'loan-001', TENANT, BASE_ADDRESS);

    expect(enrichOrderSpy).toHaveBeenCalledOnce();
    expect(enrichOrderSpy).toHaveBeenCalledWith('loan-001', TENANT, BASE_ADDRESS, { engagementId: 'eng-001' });
    expect(result.status).toBe('enriched');
  });

  it('throws when engagementId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null), makeNoopGeocoder() as any, makeBridgeService() as any);
    await expect(
      svc.enrichEngagement('', 'loan-001', TENANT, BASE_ADDRESS),
    ).rejects.toThrow('engagementId is required');
  });

  it('throws when loanId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null), makeNoopGeocoder() as any, makeBridgeService() as any);
    await expect(
      svc.enrichEngagement('eng-001', '', TENANT, BASE_ADDRESS),
    ).rejects.toThrow('loanId is required');
  });

  it('propagates enrichOrder result status=provider_miss when provider returns null', async () => {
    const provider = makeProvider(null);
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    vi.spyOn(svc, 'enrichOrder').mockResolvedValue({
      enrichmentId: 'enrich-loan-001-123',
      propertyId:   'prop-001',
      status:       'provider_miss',
    });

    const result = await svc.enrichEngagement('eng-001', 'loan-001', TENANT, BASE_ADDRESS);
    expect(result.status).toBe('provider_miss');
  });

  it('stores engagementId on the persisted enrichment record', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider, makeNoopGeocoder() as any, makeBridgeService() as any);
    await svc.enrichEngagement('eng-abc', 'loan-xyz', TENANT, BASE_ADDRESS);

    const [, storedDoc] = (cosmos.createDocument as ReturnType<typeof vi.fn>).mock.calls[0] as [string, any];
    expect(storedDoc.engagementId).toBe('eng-abc');
    expect(storedDoc.orderId).toBe('loan-xyz');
  });
});

// ─── getEnrichmentsByEngagement ─────────────────────────────────────────────────────────────

describe('PropertyEnrichmentService.getEnrichmentsByEngagement', () => {
  const engRecord: PropertyEnrichmentRecord = {
    id: 'enrich-loan-001-111',
    type: 'property-enrichment',
    orderId: 'loan-001',
    engagementId: 'eng-001',
    tenantId: TENANT,
    propertyId: PROPERTY_ID,
    status: 'enriched',
    dataResult: null,
    createdAt: '2026-03-30T12:00:00.000Z',
  };

  it('returns enrichment records for the engagement', async () => {
    const cosmos = makeCosmosService([engRecord]);
    const svc = new PropertyEnrichmentService(
      cosmos as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );

    const results = await svc.getEnrichmentsByEngagement('eng-001', TENANT);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(engRecord);
    expect(cosmos.queryDocuments).toHaveBeenCalledOnce();
    const [, , params] = (cosmos.queryDocuments as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, any[]];
    expect(params).toContainEqual({ name: '@engagementId', value: 'eng-001' });
    expect(params).toContainEqual({ name: '@tenantId', value: TENANT });
  });

  it('returns an empty array when no records exist', async () => {
    const cosmos = makeCosmosService([]);
    const svc = new PropertyEnrichmentService(
      cosmos as any,
      makePropertyRecordService() as any,
      makeProvider(null),
      makeNoopGeocoder() as any,
      makeBridgeService() as any,
    );

    const results = await svc.getEnrichmentsByEngagement('eng-002', TENANT);
    expect(results).toEqual([]);
  });

  it('throws when engagementId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null), makeNoopGeocoder() as any, makeBridgeService() as any);
    await expect(
      svc.getEnrichmentsByEngagement('', TENANT),
    ).rejects.toThrow('engagementId is required');
  });

  it('throws when tenantId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null), makeNoopGeocoder() as any, makeBridgeService() as any);
    await expect(
      svc.getEnrichmentsByEngagement('eng-001', ''),
    ).rejects.toThrow('tenantId is required');
  });
});
