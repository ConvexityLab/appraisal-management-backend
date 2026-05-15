import { describe, expect, it, vi } from 'vitest';
import { VendorOutboundWorkerService } from '../../src/services/vendor-integrations/VendorOutboundWorkerService.js';
import type { VendorDomainEvent, VendorOutboxDocument } from '../../src/types/vendor-integration.types.js';

function buildEvent(overrides: Partial<VendorDomainEvent> = {}): VendorDomainEvent {
  return {
    id: 'evt-1',
    tenantId: 'tenant-1',
    vendorType: 'aim-port',
    lenderId: 'lender-1',
    vendorOrderId: 'AP-2001',
    ourOrderId: 'order-456',
    eventType: 'vendor.order.created',
    occurredAt: '2026-05-01T00:00:00.000Z',
    payload: { notes: 'outbound dispatch test' },
    ...overrides,
  };
}

function buildDocument(overrides: Partial<VendorOutboxDocument> = {}): VendorOutboxDocument {
  return {
    id: 'vendor-outbound:evt-1',
    tenantId: 'tenant-1',
    type: 'vendor-event-outbox',
    direction: 'outbound',
    status: 'PENDING',
    vendorType: 'aim-port',
    connectionId: 'vc-aim-1',
    lenderId: 'lender-1',
    vendorOrderId: 'AP-2001',
    ourOrderId: 'order-456',
    eventType: 'vendor.order.created',
    occurredAt: '2026-05-01T00:00:00.000Z',
    receivedAt: '2026-05-01T00:00:00.000Z',
    availableAt: '2026-05-01T00:00:00.000Z',
    attemptCount: 0,
    payload: { notes: 'outbound dispatch test' },
    outboundEvent: buildEvent(),
    metadata: { transport: 'sync-post' },
    ...overrides,
  };
}

function createContainerStub(document: VendorOutboxDocument) {
  let current = { ...document };
  let etagCounter = 1;
  const replace = vi.fn().mockImplementation(async (nextDocument) => {
    current = { ...nextDocument };
    etagCounter += 1;
    return { resource: current, etag: `etag-${etagCounter}` };
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

describe('VendorOutboundWorkerService', () => {
  it('claims, dispatches, and completes outbound documents', async () => {
    const document = buildDocument();
    const container = createContainerStub(document);
    const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboundWorkerService(db as any, dispatcher as any, {
      workerId: 'worker-1',
    });

    const processed = await service.processPendingBatch('2026-05-01T01:00:00.000Z');

    expect(processed).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    const [dispatchedEvent, connectionId] = dispatcher.dispatch.mock.calls[0] as [VendorDomainEvent, string];
    expect(dispatchedEvent).toEqual(buildEvent());
    expect(connectionId).toBe('vc-aim-1');
    expect(container.current()).toMatchObject({
      status: 'COMPLETED',
      claimedBy: 'worker-1',
      attemptCount: 1,
      completedAt: '2026-05-01T01:00:00.000Z',
    });
  });

  it('marks document FAILED with backoff when dispatch throws', async () => {
    const document = buildDocument();
    const container = createContainerStub(document);
    const dispatcher = { dispatch: vi.fn().mockRejectedValue(new Error('vendor endpoint down')) };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboundWorkerService(db as any, dispatcher as any, {
      workerId: 'worker-1',
      baseBackoffMs: 60_000,
      maxBackoffMs: 60_000,
    });

    const processed = await service.processPendingBatch('2026-05-01T01:00:00.000Z');

    expect(processed).toBe(0);
    expect(container.current()).toMatchObject({
      status: 'FAILED',
      attemptCount: 1,
      lastError: 'vendor endpoint down',
      availableAt: '2026-05-01T01:01:00.000Z',
    });
  });

  it('dead-letters documents that exceed maxAttempts', async () => {
    const document = buildDocument({ attemptCount: 2 });
    const container = createContainerStub(document);
    const dispatcher = { dispatch: vi.fn().mockRejectedValue(new Error('still failing')) };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboundWorkerService(db as any, dispatcher as any, {
      workerId: 'worker-1',
      maxAttempts: 3,
    });

    await service.processPendingBatch('2026-05-01T01:00:00.000Z');

    expect(container.current()).toMatchObject({
      status: 'DEAD_LETTER',
      attemptCount: 3,
      lastError: 'still failing',
    });
  });

  it('skips documents missing outboundEvent without throwing', async () => {
    const document = buildDocument({ outboundEvent: undefined });
    const container = createContainerStub(document);
    const dispatcher = { dispatch: vi.fn() };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboundWorkerService(db as any, dispatcher as any, {
      workerId: 'worker-1',
    });

    const processed = await service.processPendingBatch('2026-05-01T01:00:00.000Z');

    expect(processed).toBe(0);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('skips documents where ETag optimistic-lock claim fails (412)', async () => {
    const document = buildDocument();
    const container = createContainerStub(document);
    // Override replace to simulate a 412 on the claim
    container.item.mockImplementation(() => ({
      read: vi.fn().mockResolvedValue({ resource: { ...document }, etag: 'etag-1' }),
      replace: vi.fn().mockRejectedValue(Object.assign(new Error('precondition failed'), { code: 412 })),
    }));
    const dispatcher = { dispatch: vi.fn() };
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [document] }),
      getContainer: vi.fn().mockReturnValue(container),
    };

    const service = new VendorOutboundWorkerService(db as any, dispatcher as any, {
      workerId: 'worker-1',
    });

    const processed = await service.processPendingBatch('2026-05-01T01:00:00.000Z');

    expect(processed).toBe(0);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});
