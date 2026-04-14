/**
 * BulkIngestionOrderCreationWorkerService — Unit Tests
 *
 * Covers:
 *   - Per-order enrichment: enrichOrder() fired for each successfully created order
 *   - enrichOrder receives correct orderId, tenantId, address, engagementId, propertyId
 *   - Non-fatal: enrichOrder rejection does not abort the order creation loop
 *   - Orders are still created and counted when enrichment fails
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module-level mocks — must hoist above all imports ────────────────────────

const mockSubscribe   = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockPublish     = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe:   mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

vi.mock('../../src/services/property-record.service.js', () => ({
  PropertyRecordService: vi.fn().mockImplementation(() => ({})),
}));

// Capture the PropertyEnrichmentService instance auto-created by the worker.
let capturedEnrichOrder: ReturnType<typeof vi.fn>;
vi.mock('../../src/services/property-enrichment.service.js', () => ({
  PropertyEnrichmentService: vi.fn().mockImplementation(() => {
    capturedEnrichOrder = vi.fn().mockResolvedValue({
      enrichmentId: 'enrich-mock-123',
      propertyId:   'prop-001',
      status:       'enriched',
    });
    return { enrichOrder: capturedEnrichOrder };
  }),
}));

// Capture the EngagementService instance so we can control createEngagement.
let capturedCreateEngagement: ReturnType<typeof vi.fn>;
vi.mock('../../src/services/engagement.service.js', () => ({
  EngagementService: vi.fn().mockImplementation(() => {
    capturedCreateEngagement = vi.fn().mockResolvedValue({
      id:       'eng-001',
      tenantId: 'tenant-001',
      loans: [
        {
          id:         'loan-001',
          loanNumber: 'LN-001',
          propertyId: 'prop-001',
          products: [],
          property: { address: '123 Main St', city: 'Denver', state: 'CO', zipCode: '80203' },
        },
      ],
    });
    return { createEngagement: capturedCreateEngagement };
  }),
}));

// ── Worker import (after mocks) ───────────────────────────────────────────────
import { BulkIngestionOrderCreationWorkerService } from '../../src/services/bulk-ingestion-order-creation-worker.service.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const JOB_ID   = 'job-001';
const TENANT   = 'tenant-001';
const CLIENT   = 'client-001';
const ADAPTER  = 'bridge-standard';

function makeOrderingRequestedEvent(overrides?: Partial<{ jobId: string; tenantId: string }>) {
  return {
    id:            'evt-001',
    type:          'bulk.ingestion.ordering.requested',
    timestamp:     new Date(),
    source:        'bulk-ingestion-processor-service',
    version:       '1.0',
    category:      'document',
    correlationId: 'corr-001',
    data: {
      jobId:      overrides?.jobId      ?? JOB_ID,
      tenantId:   overrides?.tenantId   ?? TENANT,
      clientId:   CLIENT,
      adapterKey: ADAPTER,
    },
  } as any;
}

function makeJob(itemCount = 1, overrides?: Record<string, unknown>) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id:              `${JOB_ID}:${i}`,
    jobId:           JOB_ID,
    tenantId:        TENANT,
    clientId:        CLIENT,
    rowIndex:        i,
    correlationKey:  `${JOB_ID}::LN-00${i}`,
    status:          'COMPLETED',
    source: {
      rowIndex:        i,
      loanNumber:      `LN-00${i}`,
      externalId:      `EXT-00${i}`,
      propertyAddress: `12${i} Main St, Denver, CO 80203`,
    },
    failures:   [],
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  }));

  return {
    id:             JOB_ID,
    type:           'bulk-ingestion-job',
    tenantId:       TENANT,
    clientId:       CLIENT,
    analysisType:   'FULL_APPRAISAL',
    adapterKey:     ADAPTER,
    submittedBy:    'user-001',
    submittedAt:    new Date().toISOString(),
    status:         'COMPLETED',
    totalItems:     itemCount,
    successItems:   itemCount,
    failedItems:    0,
    pendingItems:   0,
    items,
    ...overrides,
  };
}

function makeCanonicalRecord(item: any) {
  return {
    id:        `canon-${item.id}`,
    type:      'bulk-ingestion-canonical-record',
    jobId:     JOB_ID,
    itemId:    item.id,
    rowIndex:  item.rowIndex,
    canonicalData: {},
    source:    item.source,
  };
}

function makeDbStub(job: ReturnType<typeof makeJob>) {
  const canonicalRecords = job.items.map(makeCanonicalRecord);
  let queryCallCount = 0;

  return {
    queryItems: vi.fn().mockImplementation(async (_container: string, _query: string, params?: any[]) => {
      queryCallCount++;
      // First call: getJob (type = 'bulk-ingestion-job')
      // Second call: getCanonicalRecords (type = 'bulk-ingestion-canonical-record')
      const typeParam = params?.find((p: any) => p.name === '@type');
      if (typeParam?.value === 'bulk-ingestion-job') {
        return { success: true, data: [job] };
      }
      return { success: true, data: canonicalRecords };
    }),
    createOrder: vi.fn().mockImplementation(async (orderData: any) => ({
      success: true,
      data: {
        id:          `order-${Math.random().toString(36).slice(2)}`,
        orderNumber: orderData.orderNumber,
        ...orderData,
      },
    })),
    upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkIngestionOrderCreationWorkerService — per-order enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublish.mockResolvedValue(undefined);
  });

  it('fires enrichOrder once per successfully created order', async () => {
    const job    = makeJob(1);
    const db     = makeDbStub(job);
    const worker = new BulkIngestionOrderCreationWorkerService(db);
    const event  = makeOrderingRequestedEvent();

    await (worker as any).onOrderingRequested(event);

    await vi.waitFor(() => expect(capturedEnrichOrder).toHaveBeenCalledOnce());
  });

  it('fires enrichOrder N times for N created orders (multi-item job)', async () => {
    const job    = makeJob(3);
    const db     = makeDbStub(job);
    // EngagementService mock must return N loans to match N items
    capturedCreateEngagement.mockResolvedValue({
      id:       'eng-001',
      tenantId: TENANT,
      loans: job.items.map((item, i) => ({
        id:         `loan-00${i}`,
        loanNumber: `LN-00${i}`,
        propertyId: `prop-00${i}`,
        products: [],
        property: { address: `12${i} Main St`, city: 'Denver', state: 'CO', zipCode: '80203' },
      })),
    });

    const worker = new BulkIngestionOrderCreationWorkerService(db);
    const event  = makeOrderingRequestedEvent();

    await (worker as any).onOrderingRequested(event);

    await vi.waitFor(() => expect(capturedEnrichOrder).toHaveBeenCalledTimes(3));
  });

  it('passes orderId, tenantId, parsed address, and engagementId to enrichOrder', async () => {
    const job    = makeJob(1);
    const db     = makeDbStub(job);
    const worker = new BulkIngestionOrderCreationWorkerService(db);
    const event  = makeOrderingRequestedEvent();

    await (worker as any).onOrderingRequested(event);

    await vi.waitFor(() => expect(capturedEnrichOrder).toHaveBeenCalled());

    const [orderId, tenantId, address, meta] = capturedEnrichOrder.mock.calls[0] as any[];
    expect(typeof orderId).toBe('string');
    expect(orderId).toMatch(/^order-/);
    expect(tenantId).toBe(TENANT);
    expect(address).toMatchObject({ street: expect.any(String), state: 'CO', zipCode: '80203' });
    expect(meta.engagementId).toBe('eng-001');
  });

  it('passes propertyId from the matching engagement loan to enrichOrder', async () => {
    const job    = makeJob(1);
    const db     = makeDbStub(job);
    const worker = new BulkIngestionOrderCreationWorkerService(db);
    const event  = makeOrderingRequestedEvent();

    await (worker as any).onOrderingRequested(event);

    await vi.waitFor(() => expect(capturedEnrichOrder).toHaveBeenCalled());

    const [, , , meta] = capturedEnrichOrder.mock.calls[0] as any[];
    expect(meta.propertyId).toBe('prop-001');
  });

  it('does not throw or abort order loop when enrichOrder rejects (non-fatal)', async () => {
    const job    = makeJob(2);
    const db     = makeDbStub(job);
    capturedCreateEngagement.mockResolvedValue({
      id:       'eng-001',
      tenantId: TENANT,
      loans: job.items.map((item, i) => ({
        id: `loan-00${i}`, loanNumber: `LN-00${i}`, propertyId: `prop-00${i}`,
        products: [], property: { address: `12${i} Main St`, city: 'Denver', state: 'CO', zipCode: '80203' },
      })),
    });

    // enrichOrder always rejects
    capturedEnrichOrder.mockRejectedValue(new Error('provider down'));

    const worker = new BulkIngestionOrderCreationWorkerService(db);
    const event  = makeOrderingRequestedEvent();

    // Must not throw — order creation continues for all items
    await expect((worker as any).onOrderingRequested(event)).resolves.not.toThrow();

    // Both orders were still created despite enrichment failures
    expect(db.createOrder).toHaveBeenCalledTimes(2);
  });

  it('does not fire enrichOrder when there are no canonical records', async () => {
    const job = makeJob(0); // zero items
    const db: any = {
      queryItems: vi.fn().mockImplementation(async (_c: string, _q: string, params?: any[]) => {
        const typeParam = params?.find((p: any) => p.name === '@type');
        if (typeParam?.value === 'bulk-ingestion-job') return { success: true, data: [job] };
        return { success: true, data: [] }; // no canonical records
      }),
      upsertItem:  vi.fn().mockResolvedValue({ success: true, data: {} }),
      createOrder: vi.fn(),
    };

    const worker = new BulkIngestionOrderCreationWorkerService(db);
    await (worker as any).onOrderingRequested(makeOrderingRequestedEvent());

    expect(capturedEnrichOrder).not.toHaveBeenCalled();
  });
});
