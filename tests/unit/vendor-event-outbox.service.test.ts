import { describe, expect, it, vi } from 'vitest';
import { VendorEventOutboxService } from '../../src/services/vendor-integrations/VendorEventOutboxService.js';
import { AimPortAdapter } from '../../src/services/vendor-integrations/AimPortAdapter.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

const connection: VendorConnection = {
  id: 'vc-aim-1',
  tenantId: 'tenant-1',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
  lenderName: 'Sample Lender',
  inboundIdentifier: '501102',
  credentials: {
    inboundApiKeySecretName: 'aim-inbound',
    outboundApiKeySecretName: 'aim-outbound',
    outboundClientId: '501102',
  },
  outboundEndpointUrl: 'https://vendor.example.com/api',
  active: true,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
};

const events: VendorDomainEvent[] = [{
  id: 'evt-1',
  eventType: 'vendor.message.received',
  vendorType: 'aim-port',
  vendorOrderId: 'AP-1001',
  ourOrderId: 'order-123',
  lenderId: 'lender-1',
  tenantId: 'tenant-1',
  occurredAt: '2026-04-23T00:00:00.000Z',
  payload: {
    subject: 'Question',
    content: 'Please confirm the due date.',
  },
}];

describe('VendorEventOutboxService', () => {
  it('persists normalized inbound events as pending outbox documents', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'receipt-1' } }),
      queryItems: vi.fn(),
      upsertItem: vi.fn().mockImplementation(async (_container, document) => ({
        success: true,
        data: document,
      })),
    };

    const service = new VendorEventOutboxService(db as any);
    const adapter = new AimPortAdapter();
    const result = await service.persistInboundEvents(connection, adapter, events);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'vendor-outbox:evt-1',
      tenantId: 'tenant-1',
      type: 'vendor-event-outbox',
      direction: 'inbound',
      status: 'PENDING',
      connectionId: 'vc-aim-1',
      eventType: 'vendor.message.received',
      vendorOrderId: 'AP-1001',
      ourOrderId: 'order-123',
    });
    expect(db.upsertItem).toHaveBeenCalledWith(
      'vendor-event-outbox',
      expect.objectContaining({
        metadata: expect.objectContaining({
          transport: 'sync-post',
          replayKey: expect.stringContaining('vc-aim-1:vendor.message.received:AP-1001:'),
        }),
      }),
    );
  });

  it('skips replayed inbound events when the immutable receipt already exists', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: false, error: { message: 'conflict' } }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'existing-receipt' }] }),
      upsertItem: vi.fn(),
    };

    const service = new VendorEventOutboxService(db as any);
    const adapter = new AimPortAdapter();
    const result = await service.persistInboundEvents(connection, adapter, events);

    expect(result).toEqual([]);
    expect(db.upsertItem).not.toHaveBeenCalled();
  });
});
