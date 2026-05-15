import { describe, expect, it, vi } from 'vitest';
import { VendorOutboundOutboxService } from '../../src/services/vendor-integrations/VendorOutboundOutboxService.js';
import type { VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

function buildEvent(overrides: Partial<VendorDomainEvent> = {}): VendorDomainEvent {
  return {
    id: 'evt-outbound-1',
    tenantId: 'tenant-1',
    vendorType: 'aim-port',
    lenderId: 'lender-1',
    vendorOrderId: 'AP-2001',
    ourOrderId: 'order-456',
    eventType: 'vendor.order.created',
    occurredAt: '2026-05-01T00:00:00.000Z',
    payload: { notes: 'rush order' },
    ...overrides,
  };
}

describe('VendorOutboundOutboxService', () => {
  it('writes a PENDING outbound document with deterministic id', async () => {
    const upsertItem = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'vendor-outbound:evt-outbound-1' },
    });
    const db = { upsertItem };
    const service = new VendorOutboundOutboxService(db as any);
    const event = buildEvent();

    await service.dispatch(event, 'vc-aim-1');

    expect(upsertItem).toHaveBeenCalledOnce();
    const [container, document] = upsertItem.mock.calls[0] as [string, { id: string; direction: string; status: string; outboundEvent: VendorDomainEvent; connectionId: string }];
    expect(container).toBe('vendor-event-outbox');
    expect(document.id).toBe('vendor-outbound:evt-outbound-1');
    expect(document.direction).toBe('outbound');
    expect(document.status).toBe('PENDING');
    expect(document.connectionId).toBe('vc-aim-1');
    expect(document.outboundEvent).toEqual(event);
  });

  it('is idempotent — same event produces same id prefix', async () => {
    const upsertItem = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'vendor-outbound:evt-abc' },
    });
    const db = { upsertItem };
    const service = new VendorOutboundOutboxService(db as any);
    const event = buildEvent({ id: 'evt-abc' });

    await service.dispatch(event, 'conn-1');
    await service.dispatch(event, 'conn-1');

    // Both calls upsert the same id — Cosmos upsert semantics handle idempotency
    const ids = upsertItem.mock.calls.map(
      (call) => (call[1] as { id: string }).id,
    );
    expect(ids).toEqual(['vendor-outbound:evt-abc', 'vendor-outbound:evt-abc']);
  });

  it('throws when Cosmos upsert reports failure', async () => {
    const upsertItem = vi.fn().mockResolvedValue({
      success: false,
      data: undefined,
      error: new Error('Cosmos unavailable'),
    });
    const db = { upsertItem };
    const service = new VendorOutboundOutboxService(db as any);

    await expect(service.dispatch(buildEvent(), 'conn-1')).rejects.toThrow(
      'Failed to enqueue outbound vendor event evt-outbound-1: Cosmos unavailable',
    );
  });

  it('throws when Cosmos upsert returns success=true but no data', async () => {
    const upsertItem = vi.fn().mockResolvedValue({ success: true, data: undefined });
    const db = { upsertItem };
    const service = new VendorOutboundOutboxService(db as any);

    await expect(service.dispatch(buildEvent(), 'conn-1')).rejects.toThrow(
      'Failed to enqueue outbound vendor event evt-outbound-1',
    );
  });
});
