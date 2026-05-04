import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadVendorAndOrderContext,
  publishVendorBidSent,
  publishVendorBidAccepted,
} from '../../src/services/vendor-notification-bridge.service.js';

/**
 * Covers V-01: the bridge between the direct HTTP controller path and the
 * event-driven notification pipeline. The bridge must publish events with the
 * exact shape `CommunicationEventHandler` expects, so that a single email
 * pipeline serves both call paths.
 */

function makeDbStub(overrides: Partial<{
  order: any;
  vendor: any;
}> = {}) {
  return {
    queryItems: vi.fn().mockResolvedValue({
      resources: overrides.order === undefined
        ? [{ id: 'order-1', orderNumber: 'ORD-1001', tenantId: 'tenant-A', clientId: 'client-A' }]
        : overrides.order ? [overrides.order] : [],
    }),
    getItem: vi.fn().mockResolvedValue(
      overrides.vendor === undefined
        ? { data: { id: 'vendor-1', name: 'Acme Appraisals', email: 'ops@acme.example' } }
        : overrides.vendor ? { data: overrides.vendor } : null,
    ),
  } as any;
}

describe('V-01 vendor-notification bridge', () => {
  describe('loadVendorAndOrderContext', () => {
    it('returns merged context from order + vendor lookups', async () => {
      const db = makeDbStub();
      const ctx = await loadVendorAndOrderContext(db, 'vendor-1', 'order-1');
      expect(ctx).toEqual({
        vendorId: 'vendor-1',
        vendorName: 'Acme Appraisals',
        vendorEmail: 'ops@acme.example',
        orderNumber: 'ORD-1001',
        clientId: 'client-A',
        tenantId: 'tenant-A',
      });
    });

    it('returns null when order is not found and does not probe the vendor', async () => {
      const db = makeDbStub({ order: null });
      const ctx = await loadVendorAndOrderContext(db, 'vendor-1', 'missing-order');
      expect(ctx).toBeNull();
      expect(db.getItem).not.toHaveBeenCalled();
    });

    it('returns null when vendor is not found', async () => {
      const db = makeDbStub({ vendor: null });
      const ctx = await loadVendorAndOrderContext(db, 'vendor-gone', 'order-1');
      expect(ctx).toBeNull();
    });

    it('composes a display name from firstName/lastName when name is absent', async () => {
      const db = makeDbStub({
        vendor: { id: 'vendor-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example' },
      });
      const ctx = await loadVendorAndOrderContext(db, 'vendor-1', 'order-1');
      expect(ctx?.vendorName).toBe('Ada Lovelace');
    });

    it('falls back to vendorId when no name fields are present', async () => {
      const db = makeDbStub({ vendor: { id: 'vendor-1', email: 'x@example' } });
      const ctx = await loadVendorAndOrderContext(db, 'vendor-1', 'order-1');
      expect(ctx?.vendorName).toBe('vendor-1');
    });

    it('swallows DB errors and returns null so callers are not blocked', async () => {
      const db = {
        queryItems: vi.fn().mockRejectedValue(new Error('cosmos down')),
        getItem: vi.fn(),
      } as any;
      const ctx = await loadVendorAndOrderContext(db, 'vendor-1', 'order-1');
      expect(ctx).toBeNull();
    });
  });

  describe('publishVendorBidSent', () => {
    const ctx = {
      vendorId: 'vendor-1',
      vendorName: 'Acme',
      vendorEmail: 'ops@acme.example',
      orderNumber: 'ORD-1001',
      clientId: 'client-A',
      tenantId: 'tenant-A',
    };

    it('publishes a well-formed vendor.bid.sent event', async () => {
      const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() } as any;
      const before = Date.now();
      await publishVendorBidSent(publisher, ctx, 'order-1', 4, 'test');
      const after = Date.now();

      expect(publisher.publish).toHaveBeenCalledOnce();
      const evt = publisher.publish.mock.calls[0][0];
      expect(evt.type).toBe('vendor.bid.sent');
      expect(evt.source).toBe('test');
      expect(evt.id).toMatch(/[0-9a-f-]{36}/);
      expect(evt.data).toMatchObject({
        orderId: 'order-1',
        orderNumber: 'ORD-1001',
        tenantId: 'tenant-A',
        clientId: 'client-A',
        vendorId: 'vendor-1',
        vendorName: 'Acme',
        bidId: 'bid-order-1-vendor-1',
        attemptNumber: 1,
      });
      // expiresAt is now + 4h (± 1s tolerance for clock drift within the call).
      const expiresMs = new Date(evt.data.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 4 * 60 * 60 * 1000 - 1000);
      expect(expiresMs).toBeLessThanOrEqual(after + 4 * 60 * 60 * 1000 + 1000);
    });

    it('respects a custom expirationHours', async () => {
      const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() } as any;
      const before = Date.now();
      await publishVendorBidSent(publisher, ctx, 'order-1', 24, 'broadcast');
      const evt = publisher.publish.mock.calls[0][0];
      const expiresMs = new Date(evt.data.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
    });
  });

  describe('publishVendorBidAccepted', () => {
    it('publishes a well-formed vendor.bid.accepted event', async () => {
      const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() } as any;
      const ctx = {
        vendorId: 'vendor-1',
        vendorName: 'Acme',
        orderNumber: 'ORD-1001',
        clientId: 'client-A',
        tenantId: 'tenant-A',
      };
      await publishVendorBidAccepted(publisher, ctx, 'order-1', 'test');
      const evt = publisher.publish.mock.calls[0][0];
      expect(evt.type).toBe('vendor.bid.accepted');
      expect(evt.data).toMatchObject({
        orderId: 'order-1',
        orderNumber: 'ORD-1001',
        tenantId: 'tenant-A',
        clientId: 'client-A',
        vendorId: 'vendor-1',
        vendorName: 'Acme',
        bidId: 'bid-order-1-vendor-1',
      });
      expect(new Date(evt.data.acceptedAt).getTime()).toBeGreaterThan(0);
    });
  });
});
