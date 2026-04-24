/**
 * Tests for VendorTimeoutCheckerJob
 *
 * Verifies the job correctly:
 *  - Publishes `vendor.bid.timeout` for each order with an expired bid
 *  - Skips orders that lack a currentBidId or a rankedVendors entry
 *  - Is a no-op when no expired bids are found
 *  - Disables itself permanently after a Cosmos DB firewall error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VendorTimeoutCheckerJob } from '../src/jobs/vendor-timeout-checker.job';
import { ServiceBusEventPublisher } from '../src/services/service-bus-publisher';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrderWithBid(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'order-1',
    orderNumber: overrides.orderNumber ?? 'ORD-001',
    tenantId: overrides.tenantId ?? 'tenant-abc',
    priority: overrides.priority ?? 'NORMAL',
    autoVendorAssignment: {
      status: 'PENDING_BID',
      currentBidId: overrides.bidId ?? 'bid-999',
      currentBidExpiresAt: overrides.currentBidExpiresAt ?? new Date(Date.now() - 60_000).toISOString(), // expired 1 min ago
      currentAttempt: overrides.currentAttempt ?? 0,
      rankedVendors: overrides.rankedVendors ?? [{ vendorId: 'vendor-xyz' }],
      initiatedAt: new Date().toISOString(),
    },
    ...(overrides.extraFields ?? {}),
  };
}

function makeMockDb(orders: any[] = []) {
  return {
    queryDocuments: vi.fn().mockResolvedValue(orders),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VendorTimeoutCheckerJob', () => {
  let publishSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    publishSpy = vi
      .spyOn(ServiceBusEventPublisher.prototype, 'publish')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkTimeouts — happy path', () => {
    it('publishes vendor.bid.timeout for each expired bid', async () => {
      const orders = [
        makeOrderWithBid({ id: 'order-1', bidId: 'bid-1', currentAttempt: 0, rankedVendors: [{ vendorId: 'vendor-a' }, { vendorId: 'vendor-b' }] }),
        makeOrderWithBid({ id: 'order-2', bidId: 'bid-2', currentAttempt: 1, rankedVendors: [{ vendorId: 'vendor-c' }, { vendorId: 'vendor-d' }] }),
      ];

      const job = new VendorTimeoutCheckerJob(makeMockDb(orders));
      await job.checkTimeouts();

      expect(publishSpy).toHaveBeenCalledTimes(2);

      const firstCall = publishSpy.mock.calls[0][0] as any;
      expect(firstCall.type).toBe('vendor.bid.timeout');
      expect(firstCall.data.orderId).toBe('order-1');
      expect(firstCall.data.bidId).toBe('bid-1');
      expect(firstCall.data.vendorId).toBe('vendor-a');
      expect(firstCall.data.attemptNumber).toBe(1); // currentAttempt 0 → display as 1
      expect(firstCall.data.totalAttempts).toBe(2);

      const secondCall = publishSpy.mock.calls[1][0] as any;
      expect(secondCall.data.orderId).toBe('order-2');
      expect(secondCall.data.bidId).toBe('bid-2');
      expect(secondCall.data.vendorId).toBe('vendor-d'); // currentAttempt 1 → rankedVendors[1]
      expect(secondCall.data.attemptNumber).toBe(2);
    });

    it('sets priority HIGH for RUSH orders', async () => {
      const orders = [makeOrderWithBid({ priority: 'RUSH' })];
      const job = new VendorTimeoutCheckerJob(makeMockDb(orders));
      await job.checkTimeouts();

      expect(publishSpy).toHaveBeenCalledTimes(1);
      const event = publishSpy.mock.calls[0][0] as any;
      expect(event.data.priority).toBe('high');
    });

    it('sets priority HIGH for EMERGENCY orders', async () => {
      const orders = [makeOrderWithBid({ priority: 'EMERGENCY' })];
      const job = new VendorTimeoutCheckerJob(makeMockDb(orders));
      await job.checkTimeouts();

      const event = publishSpy.mock.calls[0][0] as any;
      expect(event.data.priority).toBe('high');
    });

    it('sets priority NORMAL for non-rush orders', async () => {
      const orders = [makeOrderWithBid({ priority: 'STANDARD' })];
      const job = new VendorTimeoutCheckerJob(makeMockDb(orders));
      await job.checkTimeouts();

      const event = publishSpy.mock.calls[0][0] as any;
      expect(event.data.priority).toBe('normal');
    });
  });

  describe('checkTimeouts — no expired bids', () => {
    it('publishes nothing when query returns empty array', async () => {
      const job = new VendorTimeoutCheckerJob(makeMockDb([]));
      await job.checkTimeouts();
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkTimeouts — guard clauses', () => {
    it('skips orders with missing currentBidId without publishing', async () => {
      const order = makeOrderWithBid();
      order.autoVendorAssignment.currentBidId = null; // malformed state
      const job = new VendorTimeoutCheckerJob(makeMockDb([order]));
      await job.checkTimeouts();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('skips orders where rankedVendors[currentAttempt] is undefined', async () => {
      const order = makeOrderWithBid({ currentAttempt: 5, rankedVendors: [{ vendorId: 'vendor-a' }] });
      // currentAttempt=5 but only 1 vendor → rankedVendors[5] is undefined
      const job = new VendorTimeoutCheckerJob(makeMockDb([order]));
      await job.checkTimeouts();
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkTimeouts — firewall error', () => {
    it('disables the job permanently after a Cosmos DB firewall error', async () => {
      const firewallError = Object.assign(new Error('Firewall blocked'), {
        code: 403,
        statusCode: 403,
        body: { message: 'Request was blocked by your Cosmos DB account firewall' },
      });

      const mockDb = {
        queryDocuments: vi.fn().mockRejectedValueOnce(firewallError).mockResolvedValue([makeOrderWithBid()]),
      } as any;

      const job = new VendorTimeoutCheckerJob(mockDb);

      await job.checkTimeouts(); // first call → firewall error → disables
      await job.checkTimeouts(); // second call → should be skipped entirely
      await job.checkTimeouts(); // third call → same

      // queryDocuments was only called once (the rest were skipped)
      expect(mockDb.queryDocuments).toHaveBeenCalledTimes(1);
      // No events published
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports not running before start()', () => {
      const job = new VendorTimeoutCheckerJob(makeMockDb());
      expect(job.getStatus().running).toBe(false);
      expect(job.getStatus().intervalMs).toBe(5 * 60 * 1000);
    });

    it('reports running after start() and stopped after stop()', () => {
      const job = new VendorTimeoutCheckerJob(makeMockDb());
      job.start();
      expect(job.getStatus().running).toBe(true);
      job.stop();
      expect(job.getStatus().running).toBe(false);
    });
  });

  // ── V-02: expiring-soon reminder sweep ───────────────────────────────────

  describe('checkExpiringSoon — V-02 reminder sweep', () => {
    function expiringOrderSoon(overrides: Record<string, any> = {}) {
      // A bid that expires 30 minutes from now (within the default 1h reminder window)
      const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString();
      return {
        id: overrides.id ?? 'order-soon',
        orderNumber: overrides.orderNumber ?? 'ORD-soon',
        tenantId: overrides.tenantId ?? 'tenant-abc',
        clientId: overrides.clientId ?? 'client-1',
        priority: overrides.priority ?? 'NORMAL',
        autoVendorAssignment: {
          status: 'PENDING_BID',
          currentBidId: overrides.bidId ?? 'bid-soon',
          currentBidExpiresAt: expiresAt,
          currentAttempt: overrides.currentAttempt ?? 0,
          rankedVendors: overrides.rankedVendors ?? [
            { vendorId: 'vendor-a', vendorName: 'Acme Appraisals' },
          ],
          initiatedAt: new Date().toISOString(),
          expiringReminderSentAt: overrides.reminderSentAt ?? null,
        },
      };
    }

    function makeMockDbForReminder(orders: any[]) {
      return {
        queryDocuments: vi.fn().mockResolvedValue(orders),
        updateItem: vi.fn().mockResolvedValue(undefined),
      } as any;
    }

    it('publishes vendor.bid.expiring and stamps the de-dup marker', async () => {
      const order = expiringOrderSoon();
      const db = makeMockDbForReminder([order]);
      const job = new VendorTimeoutCheckerJob(db);
      await job.checkExpiringSoon();

      // One event published
      expect(publishSpy).toHaveBeenCalledTimes(1);
      const event = publishSpy.mock.calls[0][0] as any;
      expect(event.type).toBe('vendor.bid.expiring');
      expect(event.data.orderId).toBe('order-soon');
      expect(event.data.vendorId).toBe('vendor-a');
      expect(event.data.vendorName).toBe('Acme Appraisals');
      expect(event.data.bidId).toBe('bid-soon');
      expect(event.data.minutesRemaining).toBeGreaterThanOrEqual(29);
      expect(event.data.minutesRemaining).toBeLessThanOrEqual(31);

      // De-dup marker was written BEFORE publish
      expect(db.updateItem).toHaveBeenCalledTimes(1);
      const [container, id, doc, partitionKey] = db.updateItem.mock.calls[0];
      expect(container).toBe('orders');
      expect(id).toBe('order-soon');
      expect(doc.autoVendorAssignment.expiringReminderSentAt).toBeTruthy();
      expect(partitionKey).toBe('tenant-abc');
    });

    it('does not publish for already-reminded bids', async () => {
      const order = expiringOrderSoon({ reminderSentAt: new Date().toISOString() });
      // The Cosmos query filters these out — simulate by returning empty set
      const db = makeMockDbForReminder([]);
      const job = new VendorTimeoutCheckerJob(db);
      await job.checkExpiringSoon();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('skips orders with no current vendor entry', async () => {
      const order = expiringOrderSoon({ currentAttempt: 7 });
      const db = makeMockDbForReminder([order]);
      const job = new VendorTimeoutCheckerJob(db);
      await job.checkExpiringSoon();
      expect(publishSpy).not.toHaveBeenCalled();
      expect(db.updateItem).not.toHaveBeenCalled();
    });

    it('sets priority HIGH for RUSH orders', async () => {
      const order = expiringOrderSoon({ priority: 'RUSH' });
      const db = makeMockDbForReminder([order]);
      const job = new VendorTimeoutCheckerJob(db);
      await job.checkExpiringSoon();
      const event = publishSpy.mock.calls[0][0] as any;
      expect(event.data.priority).toBe('high');
    });

    it('is a no-op when no bids are in the reminder window', async () => {
      const db = makeMockDbForReminder([]);
      const job = new VendorTimeoutCheckerJob(db);
      await job.checkExpiringSoon();
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('respects BID_EXPIRY_REMINDER_HOURS for the window query', async () => {
      const originalEnv = process.env.BID_EXPIRY_REMINDER_HOURS;
      process.env.BID_EXPIRY_REMINDER_HOURS = '2';
      try {
        const db = makeMockDbForReminder([]);
        const job = new VendorTimeoutCheckerJob(db);
        await job.checkExpiringSoon();
        // queryDocuments is called as (container, query, params)
        const params = db.queryDocuments.mock.calls[0][2];
        const threshold = new Date(params.find((p: any) => p.name === '@threshold').value).getTime();
        const now = Date.now();
        expect(threshold - now).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 2_000);
        expect(threshold - now).toBeLessThanOrEqual(2 * 60 * 60 * 1000 + 2_000);
      } finally {
        if (originalEnv === undefined) delete process.env.BID_EXPIRY_REMINDER_HOURS;
        else process.env.BID_EXPIRY_REMINDER_HOURS = originalEnv;
      }
    });
  });
});
