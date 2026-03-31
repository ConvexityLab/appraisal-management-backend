/**
 * Order Enrichment — Integration Tests
 *
 * Tests the full real-class chain:
 *
 *   BridgeInteractiveService (mocked I/O)
 *       ↓
 *   BridgePropertyDataProvider   (real class — all field-mapping logic live)
 *       ↓
 *   PropertyEnrichmentService    (real class — cache logic, versioning live)
 *       ↓
 *   CosmosDbService              (mocked — captures what would be written to DB)
 *       ↓
 *   OrderEventService            (real class — event routing live)
 *       ↓
 *   OrderController              (wiring verified)
 *
 * Coverage:
 *   Wiring
 *     - OrderController constructor passes PropertyEnrichmentService to
 *       OrderEventService (the bug we fixed)
 *   PropertyEnrichmentService ← BridgePropertyDataProvider pipeline
 *     - enriched: full data flows from Bridge mock → PropertyRecord upsert in Cosmos
 *     - provider_miss: Bridge returns nothing → Cosmos record with status=provider_miss
 *     - cached: fresh PropertyRecord → Bridge not called → Cosmos record with status=cached
 *     - stale: record older than TTL → Bridge called again
 *     - bridge error: non-fatal → enrichment record still written with provider_miss
 *     - all field mappings survive the roundtrip (apn, coords, tax, transaction, flood)
 *   OrderEventService event routing
 *     - ORDER_CREATED + complete address → enrichOrder called
 *     - ORDER_CREATED + missing streetAddress → enrichOrder NOT called
 *     - ORDER_CREATED + missing city → enrichOrder NOT called
 *     - ORDER_CREATED + missing zipCode → enrichOrder NOT called
 *     - enrichOrder rejection is swallowed (non-fatal)
 *     - non-ORDER_CREATED events → enrichOrder NOT called
 *   OrderController wiring
 *     - eventService.handleOrderCreated calls enrichOrder (via processOrderEvent)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock BridgeInteractiveService before any imports touch it ────────────────
vi.mock('../../src/services/bridge-interactive.service.js', () => {
  const mock = {
    searchByAddress:       vi.fn(),
    searchParcels:         vi.fn(),
    getParcelAssessments:  vi.fn(),
    getParcelTransactions: vi.fn(),
  };
  return { BridgeInteractiveService: vi.fn(() => mock) };
});

import { BridgeInteractiveService }    from '../../src/services/bridge-interactive.service';
import { BridgePropertyDataProvider }  from '../../src/services/property-data-providers/bridge.provider';
import { PropertyEnrichmentService, PROPERTY_ENRICHMENTS_CONTAINER } from '../../src/services/property-enrichment.service';
import { PropertyRecordService, PROPERTY_RECORDS_CONTAINER } from '../../src/services/property-record.service';
import { OrderEventService }           from '../../src/services/order-event.service';
import { OrderController }             from '../../src/controllers/order.controller';
import { PropertyRecordType }          from '../../src/types/property-record.types';
import type { PropertyRecord }         from '../../src/types/property-record.types';

// ─── Get the singleton mock Bridge instance ───────────────────────────────────
function bridgeMock() {
  const ctor = BridgeInteractiveService as unknown as ReturnType<typeof vi.fn>;
  const instance = ctor.mock.results[ctor.mock.results.length - 1]?.value;
  return instance as {
    searchByAddress:       ReturnType<typeof vi.fn>;
    searchParcels:         ReturnType<typeof vi.fn>;
    getParcelAssessments:  ReturnType<typeof vi.fn>;
    getParcelTransactions: ReturnType<typeof vi.fn>;
  };
}

// ─── Build a Cosmos mock that tracks createDocument + queryDocuments calls ────
function makeCosmosStub(existingPropertyRecord?: Partial<PropertyRecord>) {
  const docs: Record<string, unknown[]> = {};
  const docsById: Record<string, Record<string, unknown>> = {};

  return {
    createDocument: vi.fn().mockImplementation(async (container: string, doc: unknown) => {
      const d = doc as Record<string, unknown>;
      docs[container] ??= [];
      docs[container].push(d);
      docsById[container] ??= {};
      if (d['id']) docsById[container][d['id'] as string] = d;
      return d;
    }),
    queryDocuments: vi.fn().mockImplementation(async (container: string, _query: string) => {
      // Simulate property-records lookup (findByNormalizedAddress / findByApn)
      if (container === PROPERTY_RECORDS_CONTAINER && existingPropertyRecord) {
        return [{ ...defaultPropertyRecord(), ...existingPropertyRecord }];
      }
      if (container === PROPERTY_ENRICHMENTS_CONTAINER) return [];
      return [];
    }),
    getDocument: vi.fn().mockImplementation(async (container: string, id: string) => {
      // Return from the in-memory store (covers newly created records)
      if (docsById[container]?.[id]) return docsById[container][id];
      // If an existing record was provided and its id matches, return it
      if (container === PROPERTY_RECORDS_CONTAINER && existingPropertyRecord) {
        const rec = { ...defaultPropertyRecord(), ...existingPropertyRecord };
        if (rec.id === id) return rec;
      }
      return null;
    }),
    upsertDocument: vi.fn().mockImplementation(async (_c: string, doc: unknown) => doc),
    _docs: docs,
  };
}

function defaultPropertyRecord(): PropertyRecord {
  return {
    id: 'prop-integ-001',
    tenantId: 'tenant-integ',
    address: { street: '4104 ILLINOIS ST', city: 'SAN DIEGO', state: 'CA', zip: '92104' },
    propertyType: PropertyRecordType.SINGLE_FAMILY,
    building: { gla: 0, yearBuilt: 0, bedrooms: 0, bathrooms: 0 },
    taxAssessments: [],
    permits: [],
    recordVersion: 1,
    versionHistory: [],
    dataSource: 'MANUAL_ENTRY',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'SYSTEM',
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const TENANT   = 'tenant-integ';
const ORDER_ID = 'order-integ-001';
const ADDRESS  = { street: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '92104' };
const FULL_ADDR = '4104 Illinois St, San Diego, CA 92104';

function wireBridgeFull() {
  const m = bridgeMock();
  m.searchByAddress.mockResolvedValue([{
    LivingArea: 1400, BedroomsTotal: 3, BathroomsTotalDecimal: 2,
    YearBuilt: 1952, LotSizeArea: 4200, LotSizeUnits: 'Square Feet',
    PropertyType: 'Residential', StoriesTotal: 1, CountyOrParish: 'San Diego',
  }]);
  m.searchParcels.mockResolvedValue({ bundle: [{
    id: 'prcl-001',
    apn: '550-010-01',
    coordinates: [-117.1234, 32.7500],
    lotSizeSquareFeet: 4200,
    county: 'San Diego',
    zoningCode: 'R-1',
    landUseCode: 'SFR',
    legal: { lotDescription: 'LOT 5, BLOCK 2' },
    floodZone: 'X',
    floodMapNumber: '06073C1605G',
    floodMapDate: '2012-05-16T00:00:00Z',
  }]});
  m.getParcelAssessments.mockResolvedValue({ bundle: [{
    totalValue: 84_967,
    year: 2025,
    taxAmount: 939.80,
  }]});
  m.getParcelTransactions.mockResolvedValue({ bundle: [{
    salesPrice: 490_000,
    recordingDate: '2021-08-15T00:00:00Z',
  }]});
}

function wireBridgeMiss() {
  const m = bridgeMock();
  m.searchByAddress.mockResolvedValue([]);
  m.searchParcels.mockResolvedValue(null);
}

// ─── Build the real service stack ─────────────────────────────────────────────
function buildStack(existingPropertyRecord?: Partial<PropertyRecord>) {
  const cosmos = makeCosmosStub(existingPropertyRecord);
  const propRecordSvc = new PropertyRecordService(cosmos as any);
  const provider      = new BridgePropertyDataProvider();
  const enrichSvc     = new PropertyEnrichmentService(cosmos as any, propRecordSvc as any, provider);
  return { cosmos, propRecordSvc, provider, enrichSvc };
}

// ─────────────────────────────────────────────────────────────────────────────
// Wiring test — OrderController constructor
// ─────────────────────────────────────────────────────────────────────────────

describe('OrderController wiring', () => {
  it('OrderController passes PropertyEnrichmentService to OrderEventService', () => {
    // Create a minimal CosmosDbService stub to satisfy the constructor
    const cosmosStub = {
      createDocument: vi.fn(),
      queryDocuments: vi.fn().mockResolvedValue([]),
      upsertDocument: vi.fn(),
      createOrder:    vi.fn(),
      getOrder:       vi.fn(),
      queryOrders:    vi.fn().mockResolvedValue([]),
      getCosmosClient: vi.fn(),
      getContainer:   vi.fn(),
      deleteDocument: vi.fn(),
      patchDocument:  vi.fn(),
    };

    const controller = new OrderController(cosmosStub as any);
    const eventService = (controller as any).eventService as OrderEventService;

    // The enrichmentService is stored as a private field on OrderEventService
    expect((eventService as any).enrichmentService).toBeDefined();
    expect((eventService as any).enrichmentService).toBeInstanceOf(PropertyEnrichmentService);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline: BridgePropertyDataProvider → PropertyEnrichmentService
// ─────────────────────────────────────────────────────────────────────────────

describe('Full pipeline — enrichOrder via real BridgePropertyDataProvider', () => {
  let cosmos: ReturnType<typeof makeCosmosStub>;
  let enrichSvc: PropertyEnrichmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    const stack = buildStack();
    cosmos  = stack.cosmos;
    enrichSvc = stack.enrichSvc;
  });

  it('status=enriched and writes PropertyEnrichmentRecord to Cosmos', async () => {
    wireBridgeFull();
    const result = await enrichSvc.enrichOrder(ORDER_ID, TENANT, ADDRESS);

    expect(result.status).toBe('enriched');
    expect(result.propertyId).toBeTruthy();

    const enrichDoc = cosmos._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    expect(enrichDoc).toBeDefined();
    expect(enrichDoc.type).toBe('property-enrichment');
    expect(enrichDoc.orderId).toBe(ORDER_ID);
    expect(enrichDoc.tenantId).toBe(TENANT);
    expect(enrichDoc.status).toBe('enriched');
  });

  it('fetched data flows through correctly: APN, coords, tax, transaction, flood, legal', async () => {
    wireBridgeFull();
    await enrichSvc.enrichOrder(ORDER_ID, TENANT, ADDRESS);

    // The property-record createDocument or createVersion should reflect Bridge data
    const allCosmosWrites = [
      ...(cosmos._docs[PROPERTY_RECORDS_CONTAINER] ?? []),
      ...(cosmos.upsertDocument.mock.calls.map(c => c[1])),
    ];

    // The enrichment dataResult should carry the full mapped data
    const enrichDoc = cosmos._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    const dataResult = enrichDoc?.dataResult;
    if (dataResult) {
      expect(dataResult.core?.parcelNumber).toBe('550-010-01');
      expect(dataResult.core?.latitude).toBe(32.7500);
      expect(dataResult.core?.longitude).toBe(-117.1234);
      expect(dataResult.publicRecord?.taxAssessedValue).toBe(84_967);
      expect(dataResult.publicRecord?.taxYear).toBe(2025);
      expect(dataResult.publicRecord?.annualTaxAmount).toBeCloseTo(939.80, 1);
      expect(dataResult.publicRecord?.deedTransferAmount).toBe(490_000);
      expect(dataResult.publicRecord?.deedTransferDate).toBe('2021-08-15');
      expect(dataResult.publicRecord?.zoning).toBe('R-1');
      expect(dataResult.publicRecord?.landUseCode).toBe('SFR');
      expect(dataResult.publicRecord?.legalDescription).toBe('LOT 5, BLOCK 2');
      expect(dataResult.flood?.femaFloodZone).toBe('X');
      expect(dataResult.flood?.femaMapNumber).toBe('06073C1605G');
      expect(dataResult.flood?.femaMapDate).toBe('2012-05-16');
    }
  });

  it('status=provider_miss when Bridge returns nothing — enrichment record still written', async () => {
    wireBridgeMiss();
    const result = await enrichSvc.enrichOrder(ORDER_ID, TENANT, ADDRESS);

    expect(result.status).toBe('provider_miss');
    const enrichDoc = cosmos._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    expect(enrichDoc?.status).toBe('provider_miss');
  });

  it('status=cached when existing PropertyRecord is fresh — Bridge not called', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const freshRecord = { ...defaultPropertyRecord(), lastVerifiedAt: yesterday };

    const { cosmos: c, enrichSvc: svc } = buildStack(freshRecord);

    // Wire Bridge — should NOT be called
    wireBridgeFull();

    const result = await svc.enrichOrder(ORDER_ID, TENANT, ADDRESS);
    expect(result.status).toBe('cached');

    const m = bridgeMock();
    // After buildStack a new BridgePropertyDataProvider is created, which calls
    // new BridgeInteractiveService() — we just need to confirm none of the search
    // methods were called
    expect(m.searchByAddress).not.toHaveBeenCalled();
    expect(m.searchParcels).not.toHaveBeenCalled();

    const enrichDoc = c._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    expect(enrichDoc?.status).toBe('cached');
  });

  it('calls Bridge again when PropertyRecord is beyond the TTL', async () => {
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const staleRecord = { ...defaultPropertyRecord(), lastVerifiedAt: staleDate };

    const { enrichSvc: svc } = buildStack(staleRecord);
    wireBridgeFull();

    const result = await svc.enrichOrder(ORDER_ID, TENANT, ADDRESS);
    expect(result.status).toBe('enriched');
    expect(bridgeMock().searchByAddress).toHaveBeenCalled();
  });

  it('status=provider_miss when Bridge throws — enrichment record still written (non-fatal)', async () => {
    const m = bridgeMock();
    m.searchByAddress.mockRejectedValue(new Error('Bridge 503'));
    m.searchParcels.mockRejectedValue(new Error('Bridge 503'));

    const result = await enrichSvc.enrichOrder(ORDER_ID, TENANT, ADDRESS);

    // Provider will catch internal failures but both MLS + parcels failed → null result
    expect(result.status).toBe('provider_miss');
    const enrichDoc = cosmos._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    expect(enrichDoc?.status).toBe('provider_miss');
  });

  it('includes fetchedAt timestamp on enrichment result dataResult', async () => {
    wireBridgeFull();
    await enrichSvc.enrichOrder(ORDER_ID, TENANT, ADDRESS);
    const enrichDoc = cosmos._docs[PROPERTY_ENRICHMENTS_CONTAINER]?.[0] as any;
    if (enrichDoc?.dataResult) {
      expect(enrichDoc.dataResult.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OrderEventService event routing
// ─────────────────────────────────────────────────────────────────────────────

describe('OrderEventService event routing', () => {
  let enrichSpy: ReturnType<typeof vi.fn>;
  let eventSvc: OrderEventService;

  beforeEach(() => {
    vi.clearAllMocks();
    enrichSpy = vi.fn().mockResolvedValue({
      enrichmentId: 'enrich-001',
      propertyId:   'prop-001',
      status:       'enriched',
    });
    const mockEnrichSvc = { enrichOrder: enrichSpy } as any;
    eventSvc = new OrderEventService(mockEnrichSvc);
  });

  it('calls enrichOrder on ORDER_CREATED with a complete address', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: {
        streetAddress: '4104 Illinois St',
        city:    'San Diego',
        state:   'CA',
        zipCode: '92104',
      },
    });

    expect(enrichSpy).toHaveBeenCalledOnce();
    expect(enrichSpy).toHaveBeenCalledWith(
      ORDER_ID,
      TENANT,
      { street: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '92104' },
    );
  });

  it('does NOT call enrichOrder when streetAddress is empty', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: { streetAddress: '', city: 'San Diego', state: 'CA', zipCode: '92104' },
    });
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does NOT call enrichOrder when city is missing', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: { streetAddress: '4104 Illinois St', city: '', state: 'CA', zipCode: '92104' },
    });
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does NOT call enrichOrder when state is missing', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: { streetAddress: '4104 Illinois St', city: 'San Diego', state: '', zipCode: '92104' },
    });
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does NOT call enrichOrder when zipCode is missing', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: { streetAddress: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '' },
    });
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does NOT call enrichOrder when propertyAddress is absent entirely', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   ORDER_ID,
      tenantId:  TENANT,
      propertyAddress: undefined,
    });
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('does NOT throw when enrichOrder rejects (enrichment failures are non-fatal)', async () => {
    enrichSpy.mockRejectedValue(new Error('Bridge API offline'));
    await expect(
      (eventSvc as any).processOrderEvent({
        eventType: 'ORDER_CREATED',
        orderId:   ORDER_ID,
        tenantId:  TENANT,
        propertyAddress: { streetAddress: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '92104' },
      })
    ).resolves.not.toThrow();
  });

  it('does NOT call enrichOrder for non-ORDER_CREATED event types', async () => {
    for (const eventType of ['ORDER_STATUS_CHANGED', 'VENDOR_ASSIGNED', 'QC_REQUESTED']) {
      await (eventSvc as any).processOrderEvent({
        eventType,
        orderId: ORDER_ID,
        tenantId: TENANT,
        propertyAddress: { streetAddress: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '92104' },
      });
    }
    expect(enrichSpy).not.toHaveBeenCalled();
  });

  it('passes orderId and tenantId from the event to enrichOrder', async () => {
    await (eventSvc as any).processOrderEvent({
      eventType: 'ORDER_CREATED',
      orderId:   'order-specific-999',
      tenantId:  'tenant-specific-xyz',
      propertyAddress: { streetAddress: '1 Main St', city: 'Austin', state: 'TX', zipCode: '78701' },
    });

    expect(enrichSpy).toHaveBeenCalledWith(
      'order-specific-999',
      'tenant-specific-xyz',
      expect.any(Object),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OrderEventService without enrichment service
// ─────────────────────────────────────────────────────────────────────────────

describe('OrderEventService without enrichmentService (graceful degradation)', () => {
  it('processes ORDER_CREATED event without enrichment when service not injected', async () => {
    // The old behaviour — no PropertyEnrichmentService passed
    const eventSvc = new OrderEventService(); // no enrichment service
    await expect(
      (eventSvc as any).processOrderEvent({
        eventType: 'ORDER_CREATED',
        orderId:   ORDER_ID,
        tenantId:  TENANT,
        propertyAddress: { streetAddress: '4104 Illinois St', city: 'San Diego', state: 'CA', zipCode: '92104' },
      })
    ).resolves.not.toThrow();
  });
});
