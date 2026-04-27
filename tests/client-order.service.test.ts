/**
 * Tests for ClientOrderService — placeClientOrder + addVendorOrders.
 *
 * Phase 1 contract (rules-as-suggestions): the service does NOT consult any
 * decomposition rule itself. The caller passes whatever VendorOrder specs
 * the user (or a future auto-place adapter) decided on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClientOrderService,
  ClientOrderNotFoundError,
  InvalidClientOrderInputError,
  type PlaceClientOrderInput,
  type VendorOrderSpec,
} from '../src/services/client-order.service';
import { ProductType } from '../src/types/product-catalog';
import { CLIENT_ORDERS_CONTAINER, type ClientOrder } from '../src/types/client-order.types';
import type { PropertyDetails } from '../src/types/index';
import type { AppEvent, ClientOrderCreatedEvent, EventPublisher } from '../src/types/events';

// ── Helpers ──────────────────────────────────────────────────────────────────

function basePropertyDetails(): PropertyDetails {
  return {
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 1995,
    grossLivingArea: 2000,
    bedrooms: 3,
    bathrooms: 2,
  } as any;
}

function baseInput(overrides: Partial<PlaceClientOrderInput> = {}): PlaceClientOrderInput {
  return {
    tenantId: 'tenant-a',
    createdBy: 'user-1',
    engagementId: 'eng-1',
    engagementLoanId: 'loan-1',
    clientId: 'client-1',
    productType: ProductType.FULL_APPRAISAL,
    propertyDetails: basePropertyDetails(),
    ...overrides,
  };
}

/**
 * In-memory mock of CosmosDbService covering only what the service uses:
 *   - getContainer(CLIENT_ORDERS_CONTAINER).items.create / item().read / item().replace
 *   - createOrder(): returns success with auto-incrementing id 'vo-1', 'vo-2', …
 */
function makeMockDb() {
  const created: ClientOrder[] = [];
  const replaced: ClientOrder[] = [];
  const store = new Map<string, ClientOrder>();
  let voIdCounter = 0;

  const coContainer = {
    items: {
      create: vi.fn(async (doc: ClientOrder) => {
        created.push(doc);
        store.set(doc.id, { ...doc });
        return { resource: { ...doc } };
      }),
    },
    item: vi.fn((id: string, _pk: string) => ({
      read: vi.fn(async () => {
        const found = store.get(id);
        return { resource: found ? { ...found } : undefined };
      }),
      replace: vi.fn(async (doc: ClientOrder) => {
        replaced.push(doc);
        store.set(doc.id, { ...doc });
        return { resource: { ...doc } };
      }),
    })),
  };

  const db = {
    getContainer: vi.fn((name: string) => {
      if (name !== CLIENT_ORDERS_CONTAINER) {
        throw new Error(`Unexpected container request: ${name}`);
      }
      return coContainer;
    }),
    createOrder: vi.fn(async (order: any) => {
      voIdCounter += 1;
      const id = `vo-${voIdCounter}`;
      return { success: true, data: { ...order, id, type: 'order' } };
    }),
  } as any;

  return { db, created, replaced, store };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ClientOrderService.placeClientOrder', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let svc: ClientOrderService;

  beforeEach(() => {
    mock = makeMockDb();
    svc = new ClientOrderService(mock.db, makeMockPublisher());
  });

  describe('input validation', () => {
    it.each([
      'tenantId',
      'createdBy',
      'engagementId',
      'engagementLoanId',
      'clientId',
      'productType',
      'propertyDetails',
    ] as const)('throws InvalidClientOrderInputError when %s is missing', async (field) => {
      const input = baseInput();
      delete (input as any)[field];
      const promise = svc.placeClientOrder(input);
      await expect(promise).rejects.toBeInstanceOf(InvalidClientOrderInputError);
      await expect(promise).rejects.toMatchObject({ missing: [field] });
    });

    it('throws when tenantId is empty string', async () => {
      await expect(svc.placeClientOrder(baseInput({ tenantId: '' }))).rejects.toBeInstanceOf(
        InvalidClientOrderInputError,
      );
    });
  });

  describe('with no vendor-order specs (suggestion-less / day-one path)', () => {
    it('creates the ClientOrder in PLACED with empty vendorOrderIds', async () => {
      const result = await svc.placeClientOrder(baseInput());

      expect(mock.created).toHaveLength(1);
      expect(mock.replaced).toHaveLength(0); // no patch when no children
      expect(mock.db.createOrder).not.toHaveBeenCalled();

      const co = mock.created[0]!;
      expect(co.type).toBe('client-order');
      expect(co.clientOrderStatus).toBe('PLACED');
      expect(co.vendorOrderIds).toEqual([]);
      expect(co.clientOrderNumber).toMatch(/^CO-/);

      expect(result.clientOrder.vendorOrderIds).toEqual([]);
      expect(result.vendorOrders).toEqual([]);
    });

    it('treats an empty specs array the same as undefined (no children)', async () => {
      const result = await svc.placeClientOrder(baseInput(), []);
      expect(mock.db.createOrder).not.toHaveBeenCalled();
      expect(result.vendorOrders).toEqual([]);
    });
  });

  describe('with one vendor-order spec', () => {
    it('creates one VendorOrder, links it, and patches the ClientOrder', async () => {
      const specs: VendorOrderSpec[] = [{ vendorWorkType: ProductType.FULL_APPRAISAL }];

      const result = await svc.placeClientOrder(
        baseInput({
          propertyAddress: { streetAddress: '123 Main', city: 'X', state: 'TX', zipCode: '75001' } as any,
        }),
        specs,
      );

      expect(mock.db.createOrder).toHaveBeenCalledTimes(1);
      const voInput = (mock.db.createOrder as any).mock.calls[0][0];
      expect(voInput.clientOrderId).toBe(mock.created[0]!.id);
      expect(voInput.vendorWorkType).toBe(ProductType.FULL_APPRAISAL);
      expect(voInput.status).toBe('NEW');
      // Vendor passthrough fields are forwarded.
      expect(voInput.propertyAddress?.streetAddress).toBe('123 Main');

      expect(mock.replaced).toHaveLength(1);
      expect(mock.replaced[0]!.vendorOrderIds).toEqual(['vo-1']);

      expect(result.vendorOrders).toHaveLength(1);
      expect(result.vendorOrders[0]!.id).toBe('vo-1');
      expect(result.vendorOrders[0]!.clientOrderId).toBe(mock.created[0]!.id);
    });
  });

  describe('with multiple vendor-order specs (1-to-many)', () => {
    it('creates one VendorOrder per spec with denormalized ancestry on each', async () => {
      const specs: VendorOrderSpec[] = [
        { vendorWorkType: ProductType.BPO_EXTERIOR },
        { vendorWorkType: ProductType.BPO_INTERIOR, vendorFee: 175, instructions: 'access via lockbox' },
      ];

      const result = await svc.placeClientOrder(baseInput({ productType: ProductType.BPO }), specs);

      expect(mock.db.createOrder).toHaveBeenCalledTimes(2);
      const callArgs = (mock.db.createOrder as any).mock.calls.map((c: any[]) => c[0]);
      expect(callArgs[0].vendorWorkType).toBe(ProductType.BPO_EXTERIOR);
      expect(callArgs[1].vendorWorkType).toBe(ProductType.BPO_INTERIOR);
      expect(callArgs[1].vendorFee).toBe(175);
      expect(callArgs[1].instructions).toBe('access via lockbox');

      const coId = mock.created[0]!.id;
      expect(callArgs.every((a: any) => a.clientOrderId === coId)).toBe(true);

      expect(mock.replaced[0]!.vendorOrderIds).toEqual(['vo-1', 'vo-2']);
      expect(result.vendorOrders).toHaveLength(2);
    });
  });

  describe('error propagation', () => {
    it('propagates a dbService.createOrder failure', async () => {
      mock.db.createOrder = vi.fn(async () => ({
        success: false,
        error: { code: 'X', message: 'cosmos blew up' },
      }));
      const specs: VendorOrderSpec[] = [{ vendorWorkType: ProductType.FULL_APPRAISAL }];

      await expect(svc.placeClientOrder(baseInput(), specs)).rejects.toThrow(/cosmos blew up/);
    });
  });
});

// ─── client-order.created event publishing ──────────────────────────────────

function makeMockPublisher(): EventPublisher & {
  published: AppEvent[];
  publish: ReturnType<typeof vi.fn>;
} {
  const published: AppEvent[] = [];
  const publish = vi.fn(async (event: AppEvent) => {
    published.push(event);
  });
  return {
    published,
    publish,
    publishBatch: vi.fn(async (events: AppEvent[]) => {
      published.push(...events);
    }),
  } as any;
}

describe('ClientOrderService — client-order.created event', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let publisher: ReturnType<typeof makeMockPublisher>;
  let svc: ClientOrderService;

  beforeEach(() => {
    mock = makeMockDb();
    publisher = makeMockPublisher();
    svc = new ClientOrderService(mock.db, publisher);
  });

  it('publishes client-order.created for a triggering ProductType (BPO)', async () => {
    const result = await svc.placeClientOrder(
      baseInput({ productType: ProductType.BPO, propertyId: 'prop-1' }),
    );

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const event = publisher.published[0] as ClientOrderCreatedEvent;
    expect(event.type).toBe('client-order.created');
    expect(event.data.clientOrderId).toBe(result.clientOrder.id);
    expect(event.data.tenantId).toBe('tenant-a');
    expect(event.data.propertyId).toBe('prop-1');
    expect(event.data.productType).toBe(ProductType.BPO);
    expect(event.data.placedAt).toBe(result.clientOrder.placedAt);
  });

  it('publishes for every ProductType — domain event is unconditional', async () => {
    // client-order.created is a domain event, not a "trigger comp collection"
    // signal. Consumers (e.g. the comp-collection listener) do their own
    // filtering. The publisher must NOT gate on product type or future
    // consumers will silently miss events.
    const productTypes = [
      ProductType.BPO,
      ProductType.DESKTOP_APPRAISAL,
      ProductType.DESKTOP_REVIEW,
      ProductType.DVR,
      ProductType.HYBRID,
      ProductType.EVALUATION,
      ProductType.FULL_APPRAISAL,
      ProductType.AVM,
    ];
    for (const productType of productTypes) {
      publisher.publish.mockClear();
      await svc.placeClientOrder(baseInput({ productType }));
      expect(publisher.publish).toHaveBeenCalledTimes(1);
      const event = publisher.publish.mock.calls[0]![0] as ClientOrderCreatedEvent;
      expect(event.data.productType).toBe(productType);
    }
  });

  it('omits propertyId from event data when not supplied', async () => {
    await svc.placeClientOrder(baseInput({ productType: ProductType.BPO }));
    const event = publisher.published[0] as ClientOrderCreatedEvent;
    expect(event.data.propertyId).toBeUndefined();
  });

  it('does NOT throw when publisher.publish fails — order placement still succeeds', async () => {
    publisher.publish = vi.fn(async () => {
      throw new Error('service bus unreachable');
    });
    const result = await svc.placeClientOrder(baseInput({ productType: ProductType.BPO }));
    expect(result.clientOrder.clientOrderStatus).toBe('PLACED');
  });
});

describe('ClientOrderService.addVendorOrders', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let svc: ClientOrderService;

  beforeEach(() => {
    mock = makeMockDb();
    svc = new ClientOrderService(mock.db, makeMockPublisher());
  });

  it('appends VendorOrders to an existing ClientOrder and updates vendorOrderIds', async () => {
    // Arrange: place a CO with no children, then add two VendorOrders.
    const placed = await svc.placeClientOrder(baseInput());
    expect(placed.vendorOrders).toEqual([]);

    const added = await svc.addVendorOrders(placed.clientOrder.id, 'tenant-a', [
      { vendorWorkType: ProductType.BPO_EXTERIOR },
      { vendorWorkType: ProductType.BPO_INTERIOR },
    ]);

    expect(added).toHaveLength(2);
    expect(added.map((v) => v.id)).toEqual(['vo-1', 'vo-2']);

    // The parent ClientOrder in the store has been patched.
    const parent = mock.store.get(placed.clientOrder.id)!;
    expect(parent.vendorOrderIds).toEqual(['vo-1', 'vo-2']);
  });

  it('preserves existing vendorOrderIds when appending more later', async () => {
    const placed = await svc.placeClientOrder(baseInput(), [
      { vendorWorkType: ProductType.FULL_APPRAISAL },
    ]);
    expect(placed.vendorOrders.map((v) => v.id)).toEqual(['vo-1']);

    await svc.addVendorOrders(placed.clientOrder.id, 'tenant-a', [
      { vendorWorkType: ProductType.DESK_REVIEW },
    ]);

    const parent = mock.store.get(placed.clientOrder.id)!;
    expect(parent.vendorOrderIds).toEqual(['vo-1', 'vo-2']);
  });

  it('returns [] without writes when specs is empty', async () => {
    const placed = await svc.placeClientOrder(baseInput());
    const before = (mock.db.createOrder as any).mock.calls.length;

    const result = await svc.addVendorOrders(placed.clientOrder.id, 'tenant-a', []);

    expect(result).toEqual([]);
    expect((mock.db.createOrder as any).mock.calls.length).toBe(before);
  });

  it('throws ClientOrderNotFoundError when the parent does not exist', async () => {
    await expect(
      svc.addVendorOrders('does-not-exist', 'tenant-a', [
        { vendorWorkType: ProductType.FULL_APPRAISAL },
      ]),
    ).rejects.toBeInstanceOf(ClientOrderNotFoundError);
  });
});

// ── Optimistic concurrency on addVendorOrders ────────────────────────────────

describe('ClientOrderService.addVendorOrders — etag concurrency', () => {
  /**
   * Build a mock that:
   *   - tracks _etag on every CO doc
   *   - lets the test pre-seed vendorOrderIds and an _etag
   *   - allows a queued sequence of 412 errors before replace() succeeds
   */
  function makeEtagAwareMock() {
    const store = new Map<string, ClientOrder & { _etag: string }>();
    const replaceCalls: Array<{ doc: ClientOrder; ifMatch: string | undefined }> = [];
    let etagCounter = 0;
    let voIdCounter = 0;
    /** Number of 412 errors to inject on the next replace() calls. */
    let pendingConflicts = 0;
    /** Optional hook fired BEFORE each replace() — lets a test mutate the
     *  store between read+replace to simulate another writer racing in. */
    let onBeforeReplace: ((id: string) => void) | undefined;

    const nextEtag = (): string => `etag-${++etagCounter}`;

    const coContainer = {
      items: {
        create: vi.fn(async (doc: ClientOrder) => {
          const stored = { ...doc, _etag: nextEtag() };
          store.set(doc.id, stored);
          return { resource: { ...stored } };
        }),
      },
      item: vi.fn((id: string, _pk: string) => ({
        read: vi.fn(async () => {
          const found = store.get(id);
          return { resource: found ? { ...found } : undefined };
        }),
        replace: vi.fn(
          async (
            doc: ClientOrder,
            opts?: { accessCondition?: { type: string; condition: string } },
          ) => {
            const ifMatch = opts?.accessCondition?.condition;
            replaceCalls.push({ doc: { ...doc }, ifMatch });
            onBeforeReplace?.(id);
            if (pendingConflicts > 0) {
              pendingConflicts -= 1;
              const err: Error & { code?: number } = new Error('PreconditionFailed');
              err.code = 412;
              throw err;
            }
            const current = store.get(id);
            if (current && ifMatch && current._etag !== ifMatch) {
              const err: Error & { code?: number } = new Error('PreconditionFailed');
              err.code = 412;
              throw err;
            }
            const updated = { ...doc, _etag: nextEtag() };
            store.set(id, updated);
            return { resource: { ...updated } };
          },
        ),
      })),
    };

    const db = {
      getContainer: vi.fn((name: string) => {
        if (name !== CLIENT_ORDERS_CONTAINER) {
          throw new Error(`Unexpected container request: ${name}`);
        }
        return coContainer;
      }),
      createOrder: vi.fn(async (order: any) => {
        voIdCounter += 1;
        const id = `vo-${voIdCounter}`;
        return { success: true, data: { ...order, id, type: 'order' } };
      }),
    } as any;

    return {
      db,
      store,
      replaceCalls,
      seedClientOrder(co: ClientOrder) {
        store.set(co.id, { ...co, _etag: nextEtag() });
      },
      queueConflicts(n: number) {
        pendingConflicts = n;
      },
      setOnBeforeReplace(fn: ((id: string) => void) | undefined) {
        onBeforeReplace = fn;
      },
    };
  }

  function seedCo(overrides: Partial<ClientOrder> = {}): ClientOrder {
    return {
      id: 'co-1',
      tenantId: 'tenant-a',
      type: 'client-order',
      clientOrderNumber: 'CO-co-1',
      engagementId: 'eng-1',
      engagementLoanId: 'loan-1',
      clientId: 'client-1',
      productType: ProductType.FULL_APPRAISAL,
      propertyDetails: basePropertyDetails(),
      clientOrderStatus: 'PLACED' as any,
      placedAt: new Date().toISOString(),
      vendorOrderIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-1',
      ...overrides,
    } as ClientOrder;
  }

  it('passes the parent etag as IfMatch on the patch (happy path)', async () => {
    const mock = makeEtagAwareMock();
    mock.seedClientOrder(seedCo());
    const svc = new ClientOrderService(mock.db, makeMockPublisher());

    await svc.addVendorOrders('co-1', 'tenant-a', [
      { vendorWorkType: ProductType.BPO_EXTERIOR },
    ]);

    expect(mock.replaceCalls).toHaveLength(1);
    expect(mock.replaceCalls[0]!.ifMatch).toBe('etag-1');
    const stored = mock.store.get('co-1')!;
    expect(stored.vendorOrderIds).toEqual(['vo-1']);
  });

  it('retries with a fresh etag on 412 and merges into the latest vendorOrderIds', async () => {
    const mock = makeEtagAwareMock();
    mock.seedClientOrder(seedCo({ vendorOrderIds: [] }));
    const svc = new ClientOrderService(mock.db, makeMockPublisher());

    // Simulate another writer adding 'vo-existing' between our read and our
    // first replace attempt. We do this by hooking in BEFORE the replace
    // and rewriting the stored doc + bumping its etag, then queue one 412.
    let triggered = false;
    mock.setOnBeforeReplace((id) => {
      if (triggered) return;
      triggered = true;
      const cur = mock.store.get(id)!;
      mock.store.set(id, {
        ...cur,
        vendorOrderIds: [...cur.vendorOrderIds, 'vo-existing'],
        _etag: 'etag-conflict',
      });
    });
    mock.queueConflicts(1);

    const result = await svc.addVendorOrders('co-1', 'tenant-a', [
      { vendorWorkType: ProductType.BPO_INTERIOR },
    ]);

    expect(result.map((v) => v.id)).toEqual(['vo-1']);
    expect(mock.replaceCalls).toHaveLength(2);
    expect(mock.replaceCalls[0]!.ifMatch).toBe('etag-1');
    expect(mock.replaceCalls[1]!.ifMatch).toBe('etag-conflict');
    // Merge result preserves the racer's vo-existing AND our vo-1.
    const stored = mock.store.get('co-1')!;
    expect(stored.vendorOrderIds).toEqual(['vo-existing', 'vo-1']);
  });

  it('throws ClientOrderConcurrencyError after exhausting retries', async () => {
    const mock = makeEtagAwareMock();
    mock.seedClientOrder(seedCo());
    const svc = new ClientOrderService(mock.db, makeMockPublisher());

    // Force every replace to return 412.
    mock.queueConflicts(100);

    await expect(
      svc.addVendorOrders('co-1', 'tenant-a', [
        { vendorWorkType: ProductType.FULL_APPRAISAL },
      ]),
    ).rejects.toMatchObject({
      name: 'ClientOrderConcurrencyError',
      createdVendorOrderIds: ['vo-1'],
    });
  });
});

