import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VendorFile } from '../../src/types/vendor-integration.types.js';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import AFTER mocks are registered.
import { VendorOrderNotificationService } from '../../src/services/vendor-integrations/VendorOrderNotificationService.js';
import { VendorOutboundOutboxService } from '../../src/services/vendor-integrations/VendorOutboundOutboxService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-1';
const OUR_ORDER_ID = 'order-abc';

/** vendor integration metadata stored on the order document */
const VENDOR_META = {
  connectionId: 'conn-42',
  vendorOrderId: 'vord-999',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
};

function makeDb(override?: { success?: boolean; rows?: unknown[] }) {
  const rows = override?.rows ?? [{ metadata: { vendorIntegration: VENDOR_META } }];
  const success = override?.success ?? true;
  return {
    queryItems: vi.fn().mockResolvedValue({ success, data: rows }),
  };
}

function makeOutbox() {
  return {
    dispatch: vi.fn().mockResolvedValue(undefined),
  } as unknown as VendorOutboundOutboxService;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VendorOrderNotificationService', () => {
  let db: ReturnType<typeof makeDb>;
  let outbox: VendorOutboundOutboxService;
  let svc: VendorOrderNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb();
    outbox = makeOutbox();
    svc = new VendorOrderNotificationService(db, outbox);
  });

  // ── resolveVendorContext ──────────────────────────────────────────────────

  describe('when order has no vendor integration metadata', () => {
    it('is a no-op for notifyCancel', async () => {
      db = makeDb({ rows: [{ metadata: {} }] });
      svc = new VendorOrderNotificationService(db, outbox);

      await expect(svc.notifyCancel(OUR_ORDER_ID, TENANT_ID, 'bye')).resolves.toBe(false);

      expect(outbox.dispatch).not.toHaveBeenCalled();
    });

    it('is a no-op for notifyHold', async () => {
      db = makeDb({ rows: [{ metadata: {} }] });
      svc = new VendorOrderNotificationService(db, outbox);

      await expect(svc.notifyHold(OUR_ORDER_ID, TENANT_ID)).resolves.toBe(false);

      expect(outbox.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when order is not found', () => {
    it('returns false (does not throw)', async () => {
      db = makeDb({ rows: [] });
      svc = new VendorOrderNotificationService(db, outbox);

      await expect(svc.notifyCancel(OUR_ORDER_ID, TENANT_ID)).resolves.toBe(false);
      expect(outbox.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when DB query fails', () => {
    it('returns false (does not throw)', async () => {
      db = makeDb({ success: false, rows: [] });
      svc = new VendorOrderNotificationService(db, outbox);

      await expect(svc.notifyResume(OUR_ORDER_ID, TENANT_ID)).resolves.toBe(false);
      expect(outbox.dispatch).not.toHaveBeenCalled();
    });
  });

  // ── notifyCancel ─────────────────────────────────────────────────────────

  describe('notifyCancel', () => {
    it('dispatches vendor.order.cancelled with the reason message', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID, 'Client withdrew');

      expect(outbox.dispatch).toHaveBeenCalledOnce();
      const [event, connectionId] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(connectionId).toBe(VENDOR_META.connectionId);
      expect(event.eventType).toBe('vendor.order.cancelled');
      expect(event.vendorOrderId).toBe(VENDOR_META.vendorOrderId);
      expect(event.ourOrderId).toBe(OUR_ORDER_ID);
      expect(event.tenantId).toBe(TENANT_ID);
      expect(event.lenderId).toBe(VENDOR_META.lenderId);
      expect(event.payload).toEqual({ message: 'Client withdrew' });
    });

    it('omits message field from payload when none provided', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(event.payload).toEqual({});
    });

    it('queries the correct container and tenant', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID);

      expect(db.queryItems).toHaveBeenCalledWith(
        'orders',
        expect.stringContaining('c.id = @ourOrderId'),
        expect.arrayContaining([
          expect.objectContaining({ name: '@ourOrderId', value: OUR_ORDER_ID }),
          expect.objectContaining({ name: '@tenantId', value: TENANT_ID }),
        ]),
      );
    });
  });

  // ── notifyHold ───────────────────────────────────────────────────────────

  describe('notifyHold', () => {
    it('dispatches vendor.order.held with optional message', async () => {
      await svc.notifyHold(OUR_ORDER_ID, TENANT_ID, 'Waiting on flood cert');

      const [event, connectionId] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(connectionId).toBe(VENDOR_META.connectionId);
      expect(event.eventType).toBe('vendor.order.held');
      expect(event.payload).toEqual({ message: 'Waiting on flood cert' });
    });

    it('dispatches with empty payload when no message provided', async () => {
      await svc.notifyHold(OUR_ORDER_ID, TENANT_ID);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(event.eventType).toBe('vendor.order.held');
      expect(event.payload).toEqual({});
    });
  });

  // ── notifyResume ─────────────────────────────────────────────────────────

  describe('notifyResume', () => {
    it('dispatches vendor.order.resumed with optional message', async () => {
      await svc.notifyResume(OUR_ORDER_ID, TENANT_ID, 'Flood cert received');

      const [event, connectionId] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(connectionId).toBe(VENDOR_META.connectionId);
      expect(event.eventType).toBe('vendor.order.resumed');
      expect(event.payload).toEqual({ message: 'Flood cert received' });
    });

    it('dispatches with empty payload when no message provided', async () => {
      await svc.notifyResume(OUR_ORDER_ID, TENANT_ID);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(event.eventType).toBe('vendor.order.resumed');
      expect(event.payload).toEqual({});
    });
  });

  // ── notifyMessage ────────────────────────────────────────────────────────

  describe('notifyMessage', () => {
    it('dispatches vendor.message.received with subject and content', async () => {
      await svc.notifyMessage(OUR_ORDER_ID, TENANT_ID, 'Revision needed', 'Please redo kitchen');

      const [event, connectionId] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(connectionId).toBe(VENDOR_META.connectionId);
      expect(event.eventType).toBe('vendor.message.received');
      expect(event.payload).toEqual({ subject: 'Revision needed', content: 'Please redo kitchen' });
    });
  });

  // ── notifyFileDelivery ───────────────────────────────────────────────────

  describe('notifyFileDelivery', () => {
    const FILES: VendorFile[] = [
      { fileId: 'f1', filename: 'report.pdf', category: 'appraisal', content: 'base64abc' },
    ];

    it('dispatches vendor.order.completed by default (withCompletion=true)', async () => {
      await svc.notifyFileDelivery(OUR_ORDER_ID, TENANT_ID, FILES);

      const [event, connectionId] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(connectionId).toBe(VENDOR_META.connectionId);
      expect(event.eventType).toBe('vendor.order.completed');
      expect(event.payload).toEqual({ files: FILES });
    });

    it('dispatches vendor.file.received_no_completion when withCompletion=false', async () => {
      await svc.notifyFileDelivery(OUR_ORDER_ID, TENANT_ID, FILES, false);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(event.eventType).toBe('vendor.file.received_no_completion');
      expect(event.payload).toEqual({ files: FILES });
    });

    it('is a no-op when order has no vendor context', async () => {
      db = makeDb({ rows: [{ metadata: {} }] });
      svc = new VendorOrderNotificationService(db, outbox);

      await expect(svc.notifyFileDelivery(OUR_ORDER_ID, TENANT_ID, FILES)).resolves.toBe(false);

      expect(outbox.dispatch).not.toHaveBeenCalled();
    });
  });

  // ── event shape invariants ───────────────────────────────────────────────

  describe('event shape', () => {
    it('always sets a unique UUID id on each event', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID);
      await svc.notifyHold(OUR_ORDER_ID, TENANT_ID);

      const calls = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls;
      const id1 = calls[0][0].id as string;
      const id2 = calls[1][0].id as string;
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
      expect(id2).toMatch(/^[0-9a-f-]{36}$/);
      expect(id1).not.toBe(id2);
    });

    it('always includes a valid ISO occurredAt timestamp', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(() => new Date(event.occurredAt)).not.toThrow();
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });

    it('passes the correct vendorType from the order metadata', async () => {
      await svc.notifyCancel(OUR_ORDER_ID, TENANT_ID);

      const [event] = (outbox.dispatch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(event.vendorType).toBe('aim-port');
    });
  });
});
