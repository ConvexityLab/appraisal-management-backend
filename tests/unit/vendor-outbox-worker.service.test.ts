import { describe, expect, it, vi } from 'vitest';
import { EventCategory, EventPriority } from '../../src/types/events.js';
import { VendorOutboxWorkerService } from '../../src/services/vendor-integrations/VendorOutboxWorkerService.js';
import type { VendorOutboxDocument } from '../../src/types/vendor-integration.types.js';

function buildDocument(overrides: Partial<VendorOutboxDocument> = {}): VendorOutboxDocument {
  return {
    id: 'vendor-outbox:evt-1',
    tenantId: 'tenant-1',
    type: 'vendor-event-outbox',
    direction: 'inbound',
    status: 'PENDING',
    vendorType: 'aim-port',
    connectionId: 'vc-aim-1',
    lenderId: 'lender-1',
    vendorOrderId: 'AP-1001',
    ourOrderId: 'order-123',
    eventType: 'vendor.message.received',
    occurredAt: '2026-04-23T00:00:00.000Z',
    receivedAt: '2026-04-23T00:00:00.000Z',
    availableAt: '2026-04-23T00:00:00.000Z',
    attemptCount: 0,
    payload: {
      subject: 'Need docs',
      content: 'Please upload the revised report.',
    },
    metadata: {
      transport: 'sync-post',
      replayKey: 'vc-aim-1:vendor.message.received:AP-1001:abc123',
    },
    ...overrides,
  };
}

function createContainerStub(document: VendorOutboxDocument) {
  let current = { ...document };
  let etagCounter = 1;
  const replace = vi.fn().mockImplementation(async (nextDocument) => {
    current = { ...nextDocument };
    etagCounter += 1;
    return {
      resource: current,
      etag: `etag-${etagCounter}`,
    };
  });

  return {
    current: () => current,
    item: vi.fn().mockImplementation(() => ({
      read: vi.fn().mockResolvedValue({
        resource: current,
        etag: `etag-${etagCounter}`,
      }),
      replace,
    })),
    replace,
  };
}

describe('VendorOutboxWorkerService', () => {
  it('claims, publishes, and completes pending inbound outbox documents', async () => {
    const document = buildDocument();
    const container = createContainerStub(document);
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn(),
    };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboxWorkerService(db as any, publisher as any, {
      workerId: 'worker-1',
      pollIntervalMs: 100,
    });

    const processed = await service.processPendingBatch('2026-04-23T01:00:00.000Z');

    expect(processed).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      id: 'vendor-outbox:evt-1',
      type: 'vendor.message.received',
      category: EventCategory.VENDOR,
      data: expect.objectContaining({
        connectionId: 'vc-aim-1',
        tenantId: 'tenant-1',
        lenderId: 'lender-1',
        vendorType: 'aim-port',
        vendorOrderId: 'AP-1001',
        ourOrderId: 'order-123',
        priority: EventPriority.NORMAL,
      }),
    }));
    expect(container.current()).toMatchObject({
      status: 'COMPLETED',
      claimedBy: 'worker-1',
      attemptCount: 1,
      completedAt: '2026-04-23T01:00:00.000Z',
    });
  });

  it('backs off failed documents and leaves them retryable until max attempts', async () => {
    const document = buildDocument();
    const container = createContainerStub(document);
    const publisher = {
      publish: vi.fn().mockRejectedValue(new Error('service bus unavailable')),
      publishBatch: vi.fn(),
    };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboxWorkerService(db as any, publisher as any, {
      workerId: 'worker-1',
      baseBackoffMs: 60_000,
      maxBackoffMs: 60_000,
    });

    const processed = await service.processPendingBatch('2026-04-23T01:00:00.000Z');

    expect(processed).toBe(0);
    expect(container.current()).toMatchObject({
      status: 'FAILED',
      attemptCount: 1,
      lastError: 'service bus unavailable',
      availableAt: '2026-04-23T01:01:00.000Z',
    });
  });

  it('dead-letters documents that exceed max attempts', async () => {
    const document = buildDocument({ attemptCount: 2 });
    const container = createContainerStub(document);
    const publisher = {
      publish: vi.fn().mockRejectedValue(new Error('still failing')),
      publishBatch: vi.fn(),
    };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboxWorkerService(db as any, publisher as any, {
      workerId: 'worker-1',
      maxAttempts: 3,
    });

    await service.processPendingBatch('2026-04-23T01:00:00.000Z');

    expect(container.current()).toMatchObject({
      status: 'DEAD_LETTER',
      attemptCount: 3,
      lastError: 'still failing',
    });
  });
});