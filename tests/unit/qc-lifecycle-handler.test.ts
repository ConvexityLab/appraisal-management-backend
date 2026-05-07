import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Service Bus subscriber so no real bus is touched
vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock QCReviewQueueService so we can assert the queue interaction
const addToQueueMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: vi.fn().mockImplementation(() => ({
    addToQueue: addToQueueMock,
  })),
}));

// Mock delivery-workflow so Q-04 path doesn't pull in the full service tree
const createRevisionRequestMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/services/delivery-workflow.service.js', () => ({
  DeliveryWorkflowService: vi.fn().mockImplementation(() => ({
    createRevisionRequest: createRevisionRequestMock,
  })),
}));

import { QCLifecycleHandler } from '../../src/services/qc-lifecycle-handler.service.js';
import { EventCategory, EventPriority } from '../../src/types/events.js';

function makeDbStub(overrides: Record<string, any> = {}) {
  const store: Record<string, any> = {
    'orders::tenant-1::order-1': {
      id: 'order-1',
      orderNumber: 'ORD-001',
      tenantId: 'tenant-1',
      status: 'QC_REVIEW',
      priority: 'STANDARD',
      clientId: 'client-1',
      appraisedValue: 500_000,
      assignedVendorId: 'vendor-1',
      assignedVendorName: 'Acme',
      propertyAddress: { streetAddress: '1 Main', city: 'Austin', state: 'TX', zipCode: '78701' },
      submittedAt: new Date().toISOString(),
    },
    ...overrides,
  };
  // Phase 7 of Order-relocation: QCLifecycleHandler now loads orders
  // through OrderContextLoader, which calls findOrderById on the
  // CosmosDbService. Provide it on the stub so the handler can resolve
  // the VendorOrder + (null) ClientOrder pair.
  return {
    getItem: vi.fn(async (container: string, id: string, tenantId: string) => {
      const item = store[`${container}::${tenantId}::${id}`];
      return item ? { data: item } : { data: null };
    }),
    findOrderById: vi.fn(async (id: string) => {
      // Cross-partition lookup — search all tenant slots for the id.
      for (const key of Object.keys(store)) {
        const item = store[key];
        if (item?.id === id) return { success: true, data: item };
      }
      return { success: false, data: null, error: { message: 'not found' } };
    }),
    getContainer: vi.fn(() => ({
      // Stub Container.item().read() so OrderContextLoader's ClientOrder
      // lookup returns no resource (legacy row → ClientOrder is null).
      item: vi.fn(() => ({
        read: vi.fn(async () => ({ resource: undefined })),
      })),
    })),
    queryItems: vi.fn(async (_container: string, _query: string, _params: any[]) => {
      return { data: [] };
    }),
    updateItem: vi.fn().mockResolvedValue(undefined),
  };
}

function event(type: string, data: any) {
  return {
    id: `evt-${type}`,
    type,
    timestamp: new Date(),
    source: 'unit-test',
    version: '1.0',
    category: EventCategory.ORDER,
    data,
  };
}

describe('QCLifecycleHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Q-01: onOrderStatusChanged', () => {
    it('adds the order to the QC queue when status transitions to QC_REVIEW', async () => {
      const db = makeDbStub();
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onOrderStatusChanged(
        event('order.status.changed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          oldStatus: 'SUBMITTED',
          newStatus: 'QC_REVIEW',
        }),
      );

      expect(addToQueueMock).toHaveBeenCalledTimes(1);
      const call = addToQueueMock.mock.calls[0][0];
      expect(call.orderId).toBe('order-1');
      expect(call.orderNumber).toBe('ORD-001');
      expect(call.propertyAddress).toContain('1 Main');
      expect(call.vendorId).toBe('vendor-1');
    });

    it('is a no-op for non-QC_REVIEW transitions', async () => {
      const db = makeDbStub();
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onOrderStatusChanged(
        event('order.status.changed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          oldStatus: 'SUBMITTED',
          newStatus: 'DELIVERED',
        }),
      );
      expect(addToQueueMock).not.toHaveBeenCalled();
    });

    it('is idempotent — skips when a QC queue entry already exists', async () => {
      const db = makeDbStub();
      db.queryItems.mockResolvedValueOnce({ data: [{ id: 'existing-queue-entry' }] });
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onOrderStatusChanged(
        event('order.status.changed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          oldStatus: 'SUBMITTED',
          newStatus: 'QC_REVIEW',
        }),
      );
      expect(addToQueueMock).not.toHaveBeenCalled();
    });

    it('logs and skips when the order cannot be found', async () => {
      const db = makeDbStub();
      db.getItem.mockResolvedValueOnce({ data: null });
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onOrderStatusChanged(
        event('order.status.changed', {
          orderId: 'missing',
          tenantId: 'tenant-1',
          oldStatus: 'SUBMITTED',
          newStatus: 'QC_REVIEW',
        }),
      );
      expect(addToQueueMock).not.toHaveBeenCalled();
    });
  });

  describe('Q-03: onQCCompleted — passed', () => {
    it('advances the order to FINAL_UNDER_REVIEW', async () => {
      const db = makeDbStub();
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onQCCompleted(
        event('qc.completed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          result: 'passed',
          reviewerId: 'reviewer-1',
          priority: EventPriority.NORMAL,
        }),
      );

      expect(db.updateItem).toHaveBeenCalledTimes(1);
      const [container, id, doc, partitionKey] = db.updateItem.mock.calls[0];
      expect(container).toBe('orders');
      expect(id).toBe('order-1');
      expect(doc.status).toBe('FINAL_UNDER_REVIEW');
      expect(doc.qcPassedBy).toBe('reviewer-1');
      expect(partitionKey).toBe('tenant-1');
    });

    it('does not advance if the order has already moved past QC_REVIEW', async () => {
      const db = makeDbStub({
        'orders::tenant-1::order-1': {
          id: 'order-1',
          tenantId: 'tenant-1',
          status: 'DELIVERED',
        },
      });
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onQCCompleted(
        event('qc.completed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          result: 'passed',
          reviewerId: 'reviewer-1',
        }),
      );
      expect(db.updateItem).not.toHaveBeenCalled();
    });
  });

  describe('Q-04: onQCCompleted — failed', () => {
    it('creates a revision request anchored on the latest document', async () => {
      const db = makeDbStub();
      db.queryItems.mockResolvedValueOnce({ data: [{ id: 'doc-99', orderId: 'order-1' }] });
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onQCCompleted(
        event('qc.completed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          result: 'failed',
          reviewerId: 'reviewer-1',
        }),
      );

      expect(createRevisionRequestMock).toHaveBeenCalledTimes(1);
      const [doc, requestedBy, description, tenantId, opts] =
        createRevisionRequestMock.mock.calls[0];
      expect(doc.id).toBe('doc-99');
      expect(doc.orderId).toBe('order-1');
      expect(requestedBy).toBe('reviewer-1');
      expect(description).toMatch(/QC review failed/);
      expect(tenantId).toBe('tenant-1');
      expect(opts.severity).toBe('MAJOR');
    });

    it('skips if no document can be found to anchor the revision', async () => {
      const db = makeDbStub();
      db.queryItems.mockResolvedValueOnce({ data: [] });
      const handler = new QCLifecycleHandler(db as any);
      await (handler as any).onQCCompleted(
        event('qc.completed', {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          result: 'failed',
          reviewerId: 'reviewer-1',
        }),
      );
      expect(createRevisionRequestMock).not.toHaveBeenCalled();
    });
  });
});
