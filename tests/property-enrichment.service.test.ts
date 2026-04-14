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

// ─── enrichOrder: happy path ──────────────────────────────────────────────────

describe('PropertyEnrichmentService.enrichOrder', () => {
  it('returns status=enriched when provider returns data', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

  it('appends tax assessment when year not already present', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc = makePropertyRecordService(false);
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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
    );
    await expect(svc.enrichOrder('', TENANT, BASE_ADDRESS)).rejects.toThrow('orderId is required');
  });

  it('throws when tenantId is missing', async () => {
    const svc = new PropertyEnrichmentService(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
    );
    await expect(svc.enrichOrder(ORDER_ID, '', BASE_ADDRESS)).rejects.toThrow('tenantId is required');
  });

  it('throws when address fields are incomplete', async () => {
    const svc = new PropertyEnrichmentService(
      makeCosmosService() as any,
      makePropertyRecordService() as any,
      makeProvider(null),
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    expect(result.status).toBe('enriched');
    expect(provider.lookupByAddress).toHaveBeenCalledOnce();
  });

  // ── meta.propertyId: skips resolveOrCreate ─────────────────────────────────
  it('skips resolveOrCreate and uses getById when meta.propertyId is provided', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS, {
      propertyId: PROPERTY_ID,
    });

    // resolveOrCreate must NOT be called — caller already resolved the record
    expect(propSvc.resolveOrCreate).not.toHaveBeenCalled();
    // getById MUST be called to fetch the actual record
    expect(propSvc.getById).toHaveBeenCalledWith(PROPERTY_ID, TENANT);
    expect(result.propertyId).toBe(PROPERTY_ID);
    expect(result.status).toBe('enriched');
  });

  it('returns status=enriched via the provided propertyId path even on a stale record', async () => {
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const staleRecord = makeExistingPropertyRecord({ lastVerifiedAt: staleDate });

    const provider = makeProvider(makeFullDataResult());
    const propSvc = {
      resolveOrCreate: vi.fn(),
      getById: vi.fn().mockResolvedValue(staleRecord),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...staleRecord,
        ...changes,
      })),
    };
    const cosmos = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    const result = await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS, { propertyId: PROPERTY_ID });

    expect(propSvc.resolveOrCreate).not.toHaveBeenCalled();
    expect(propSvc.getById).toHaveBeenCalledWith(PROPERTY_ID, TENANT);
    expect(result.status).toBe('enriched');
  });

  // ── propertyType: mapped from provider and written to PropertyRecord ────────
  it('writes propertyType=SINGLE_FAMILY when provider returns "Residential"', async () => {
    const provider = makeProvider(makeFullDataResult()); // core.propertyType = 'Residential'
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const buildingCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.building != null,
    );
    expect(buildingCall).toBeDefined();
    expect(buildingCall![2].propertyType).toBe(PropertyRecordType.SINGLE_FAMILY);
  });

  it('writes propertyType=CONDO when provider returns "Condominium"', async () => {
    const condoResult: PropertyDataResult = {
      ...makeFullDataResult(),
      core: { ...makeFullDataResult().core!, propertyType: 'Condominium' },
    };
    const provider = makeProvider(condoResult);
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const buildingCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.building != null,
    );
    expect(buildingCall).toBeDefined();
    expect(buildingCall![2].propertyType).toBe(PropertyRecordType.CONDO);
  });

  it('does not overwrite propertyType when provider returns an unrecognised type string', async () => {
    const unknownResult: PropertyDataResult = {
      ...makeFullDataResult(),
      core: { ...makeFullDataResult().core!, propertyType: 'UnknownNewType' },
    };
    const provider = makeProvider(unknownResult);
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    // buildTopLevelChanges should not include propertyType for unknown strings
    const buildingCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.building != null,
    );
    expect(buildingCall).toBeDefined();
    expect(buildingCall![2].propertyType).toBeUndefined();
  });

  // ── Address enrichment: county / latitude / longitude ──────────────────────
  it('writes county to address when provider returns it and record has none', async () => {
    const provider = makeProvider(makeFullDataResult()); // core.county = 'Dallas'
    // Records from makePropertyRecordService default to no county on address
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    // Find the createVersion call that includes address changes
    const addrCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address?.county != null,
    );
    expect(addrCall).toBeDefined();
    expect(addrCall![2].address.county).toBe('Dallas');
  });

  it('writes latitude and longitude when provider returns them and record has none', async () => {
    const provider = makeProvider(makeFullDataResult()); // core.latitude = 32.8348, longitude = -96.7697
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    const addrCall = propSvc.createVersion.mock.calls.find(
      (args: any[]) => args[2]?.address?.latitude != null,
    );
    expect(addrCall).toBeDefined();
    expect(addrCall![2].address.latitude).toBeCloseTo(32.8348);
    expect(addrCall![2].address.longitude).toBeCloseTo(-96.7697);
  });

  it('does not overwrite existing county on PropertyRecord address', async () => {
    const recordWithCounty = makeExistingPropertyRecord({
      address: {
        street:  '5432 MOCKINGBIRD LN',
        city:    'DALLAS',
        state:   'TX',
        zip:     '75206',
        county:  'Dallas', // already set
      },
    });
    const propSvc = {
      resolveOrCreate: vi.fn().mockResolvedValue({ propertyId: PROPERTY_ID, isNew: false, method: 'ADDRESS_NORM' }),
      getById: vi.fn().mockResolvedValue(recordWithCounty),
      createVersion: vi.fn().mockImplementation(async (_id: string, _tid: string, changes: any) => ({
        ...recordWithCounty,
        ...changes,
      })),
    };
    const provider = makeProvider(makeFullDataResult()); // also returns county = 'Dallas'
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichOrder(ORDER_ID, TENANT, BASE_ADDRESS);

    // If no address patch was needed, no createVersion call with address block
    // OR if there is one, the county must still equal 'Dallas' (not changed)
    const addrCalls = propSvc.createVersion.mock.calls.filter(
      (args: any[]) => args[2]?.address != null,
    );
    for (const call of addrCalls) {
      expect(call[2].address.county).toBe('Dallas');
    }
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null));
    await expect(
      svc.enrichEngagement('', 'loan-001', TENANT, BASE_ADDRESS),
    ).rejects.toThrow('engagementId is required');
  });

  it('throws when loanId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null));
    await expect(
      svc.enrichEngagement('eng-001', '', TENANT, BASE_ADDRESS),
    ).rejects.toThrow('loanId is required');
  });

  it('propagates enrichOrder result status=provider_miss when provider returns null', async () => {
    const provider = makeProvider(null);
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
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

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    await svc.enrichEngagement('eng-abc', 'loan-xyz', TENANT, BASE_ADDRESS);

    const [, storedDoc] = (cosmos.createDocument as ReturnType<typeof vi.fn>).mock.calls[0] as [string, any];
    expect(storedDoc.engagementId).toBe('eng-abc');
    expect(storedDoc.orderId).toBe('loan-xyz');
  });

  it('passes propertyId to enrichOrder meta when provided as 5th argument', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    const enrichOrderSpy = vi.spyOn(svc, 'enrichOrder').mockResolvedValue({
      enrichmentId: 'enrich-loan-001-123',
      propertyId:   PROPERTY_ID,
      status:       'enriched',
    });

    await svc.enrichEngagement('eng-001', 'loan-001', TENANT, BASE_ADDRESS, PROPERTY_ID);

    expect(enrichOrderSpy).toHaveBeenCalledWith(
      'loan-001',
      TENANT,
      BASE_ADDRESS,
      { engagementId: 'eng-001', propertyId: PROPERTY_ID },
    );
  });

  it('does not include propertyId in enrichOrder meta when not provided', async () => {
    const provider = makeProvider(makeFullDataResult());
    const propSvc  = makePropertyRecordService(false);
    const cosmos   = makeCosmosService();

    const svc = new PropertyEnrichmentService(cosmos as any, propSvc as any, provider);
    const enrichOrderSpy = vi.spyOn(svc, 'enrichOrder').mockResolvedValue({
      enrichmentId: 'enrich-loan-001-123',
      propertyId:   PROPERTY_ID,
      status:       'enriched',
    });

    await svc.enrichEngagement('eng-001', 'loan-001', TENANT, BASE_ADDRESS);

    expect(enrichOrderSpy).toHaveBeenCalledWith(
      'loan-001',
      TENANT,
      BASE_ADDRESS,
      { engagementId: 'eng-001' }, // no propertyId key
    );
    const [, , , meta] = enrichOrderSpy.mock.calls[0] as any[];
    expect(meta).not.toHaveProperty('propertyId');
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
    );

    const results = await svc.getEnrichmentsByEngagement('eng-002', TENANT);
    expect(results).toEqual([]);
  });

  it('throws when engagementId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null));
    await expect(
      svc.getEnrichmentsByEngagement('', TENANT),
    ).rejects.toThrow('engagementId is required');
  });

  it('throws when tenantId is missing', async () => {
    const svc = new PropertyEnrichmentService({} as any, {} as any, makeProvider(null));
    await expect(
      svc.getEnrichmentsByEngagement('eng-001', ''),
    ).rejects.toThrow('tenantId is required');
  });
});
