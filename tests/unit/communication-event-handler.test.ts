/**
 * CommunicationEventHandler — Unit Tests
 *
 * Covers:
 *   Existing events (regression smoke):
 *     - vendor.bid.sent           → email to vendor
 *     - vendor.bid.accepted       → email to coordinator
 *     - order.delivered           → email to client
 *
 *   New events (this PR):
 *     - review.sla.warning        → email reviewer + escalation recipients
 *     - review.sla.breached       → email escalation recipients only
 *     - engagement.letter.sent    → email coordinator confirmation
 *     - engagement.letter.signed  → email coordinator (vendor signed)
 *     - engagement.letter.declined → email coordinator + escalation recipients
 *
 * EmailService is mocked. CosmosDbService is stubbed in-memory.
 * Run: pnpm test:unit
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── EmailService mock ─────────────────────────────────────────────────────────

const mockSendEmail = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-test' });

vi.mock('../../src/services/email.service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({ sendEmail: mockSendEmail })),
}));

// ── ServiceBus mocks ──────────────────────────────────────────────────────────

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ── TenantAutomationConfigService mock ────────────────────────────────────────

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockResolvedValue({
      escalationRecipients: ['ops@unit.test'],
    }),
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { CommunicationEventHandler } from '../../src/services/communication-event-handler.service.js';
import { EventCategory, EventPriority } from '../../src/types/events.js';

// ── In-memory CosmosDB stub ────────────────────────────────────────────────────

function createDbStub(overrides: Record<string, any> = {}) {
  const store: Record<string, any> = {
    // Pre-seeded defaults
    'orders::tenant1::order-1': {
      id: 'order-1', tenantId: 'tenant1',
      coordinatorEmail: 'coord@unit.test',
      clientId: 'client-1',
    },
    'vendors::tenant1::vendor-1': {
      id: 'vendor-1', tenantId: 'tenant1', email: 'vendor@appraisal.test',
    },
    'clients::tenant1::client-1': {
      id: 'client-1', tenantId: 'tenant1', email: 'client@unit.test',
    },
    'users::tenant1::reviewer-1': {
      id: 'reviewer-1', tenantId: 'tenant1', email: 'reviewer@unit.test',
    },
    ...overrides,
  };

  return {
    getItem: vi.fn(async (container: string, id: string, tenantId: string) => {
      const item = store[`${container}::${tenantId}::${id}`];
      return item ? { success: true, data: item } : { success: false, data: null };
    }),
    getEngagementsContainer: vi.fn().mockReturnValue({
      item: vi.fn().mockReturnValue({
        read: vi.fn().mockResolvedValue({ resource: null }),
      }),
    }),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TENANT = 'tenant1';

function baseEvent(type: string, data: Record<string, unknown>) {
  return {
    id: `evt-${type}`,
    type,
    timestamp: new Date(),
    source: 'unit-test',
    version: '1.0',
    category: EventCategory.VENDOR,
    data,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommunicationEventHandler', () => {
  let handler: CommunicationEventHandler;
  let db: ReturnType<typeof createDbStub>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDbStub();
    handler = new CommunicationEventHandler(db as any);
  });

  // ── Regression: existing handler smoke tests ─────────────────────────────

  it('vendor.bid.sent sends bid invitation email to vendor', async () => {
    await (handler as any).onVendorBidSent(
      baseEvent('vendor.bid.sent', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', vendorName: 'Test Vendor',
        bidId: 'bid-1', expiresAt: new Date(Date.now() + 3600_000),
        attemptNumber: 1, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('vendor@appraisal.test');
    expect(args[0].subject).toMatch(/invitation/i);
  });

  it('vendor.bid.accepted notifies coordinator', async () => {
    await (handler as any).onVendorBidAccepted(
      baseEvent('vendor.bid.accepted', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', vendorName: 'Test Vendor', priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('coord@unit.test');
  });

  it('order.delivered emails the client', async () => {
    await (handler as any).onOrderDelivered(
      baseEvent('order.delivered', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        clientId: 'client-1', deliveredAt: new Date().toISOString(), priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('client@unit.test');
    expect(args[0].subject).toMatch(/Appraisal Report is Ready/i);
  });

  // ── New: review.sla.warning ────────────────────────────────────────────────

  it('review.sla.warning emails reviewer AND escalation recipients', async () => {
    await (handler as any).onReviewSLAWarning(
      baseEvent('review.sla.warning', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        qcReviewId: 'qc-1', reviewerId: 'reviewer-1',
        percentElapsed: 82, targetDate: new Date(Date.now() + 1800_000),
        remainingMinutes: 30, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    const recipients: string[] = Array.isArray(args[0].to) ? args[0].to : [args[0].to];
    expect(recipients).toContain('reviewer@unit.test');
    expect(recipients).toContain('ops@unit.test');
    expect(args[0].subject).toMatch(/SLA Warning/i);
    expect(args[0].html).toMatch(/82/);    // percentElapsed
    expect(args[0].html).toMatch(/30/);    // remainingMinutes
  });

  it('review.sla.warning skips send when no recipients can be resolved', async () => {
    // Override db so reviewer lookup fails and escalationRecipients is empty
    db.getItem.mockResolvedValue({ success: false, data: null });
    const handler2 = new CommunicationEventHandler(db as any);

    // Also mock TenantAutomationConfigService for this instance to return no recipients
    const { TenantAutomationConfigService } = await import(
      '../../src/services/tenant-automation-config.service.js'
    );
    const tcsMock = (TenantAutomationConfigService as any).mock.results.at(-1).value;
    tcsMock.getConfig.mockResolvedValue({ escalationRecipients: [] });

    await (handler2 as any).onReviewSLAWarning(
      baseEvent('review.sla.warning', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        qcReviewId: 'qc-1', reviewerId: 'unknown-reviewer',
        percentElapsed: 90, targetDate: new Date(), remainingMinutes: 10,
        priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── New: review.sla.breached ──────────────────────────────────────────────

  it('review.sla.breached emails escalation recipients with minutesOverdue in body', async () => {
    await (handler as any).onReviewSLABreached(
      baseEvent('review.sla.breached', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        qcReviewId: 'qc-2', reviewerId: 'reviewer-1',
        targetDate: new Date(Date.now() - 3600_000), minutesOverdue: 60,
        priority: EventPriority.HIGH,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    const recipients: string[] = Array.isArray(args[0].to) ? args[0].to : [args[0].to];
    expect(recipients).toContain('ops@unit.test');
    expect(args[0].subject).toMatch(/SLA Breached/i);
    expect(args[0].html).toMatch(/60/);   // minutesOverdue
  });

  it('review.sla.breached skips send when no escalation recipients configured', async () => {
    const { TenantAutomationConfigService } = await import(
      '../../src/services/tenant-automation-config.service.js'
    );
    const tcsMock = (TenantAutomationConfigService as any).mock.results.at(-1).value;
    tcsMock.getConfig.mockResolvedValue({ escalationRecipients: [] });

    await (handler as any).onReviewSLABreached(
      baseEvent('review.sla.breached', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        qcReviewId: 'qc-2', reviewerId: 'reviewer-1',
        targetDate: new Date(), minutesOverdue: 30, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── New: engagement.letter.sent ───────────────────────────────────────────

  it('engagement.letter.sent emails coordinator with letter reference', async () => {
    await (handler as any).onEngagementLetterSent(
      baseEvent('engagement.letter.sent', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-abc-123',
        signingToken: 'tok-xyz', expiresAt: new Date(Date.now() + 86400_000),
        priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('coord@unit.test');
    expect(args[0].subject).toMatch(/Engagement Letter Sent/i);
    expect(args[0].html).toMatch(/letter-abc-123/);
  });

  it('engagement.letter.sent skips send when coordinator email cannot be resolved', async () => {
    db.getItem.mockResolvedValue({ success: false, data: null });
    const handler2 = new CommunicationEventHandler(db as any);

    await (handler2 as any).onEngagementLetterSent(
      baseEvent('engagement.letter.sent', {
        orderId: 'order-missing', orderNumber: 'ORD-000', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-xyz',
        signingToken: 'tok', expiresAt: new Date(), priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── New: engagement.letter.signed ─────────────────────────────────────────

  it('engagement.letter.signed emails coordinator with signed confirmation', async () => {
    const signedAt = new Date();
    await (handler as any).onEngagementLetterSigned(
      baseEvent('engagement.letter.signed', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-signed-001',
        signedAt, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('coord@unit.test');
    expect(args[0].subject).toMatch(/Engagement Letter Signed/i);
    expect(args[0].html).toMatch(/letter-signed-001/);
  });

  // ── New: engagement.letter.declined ──────────────────────────────────────

  it('engagement.letter.declined emails coordinator AND escalation recipients', async () => {
    await (handler as any).onEngagementLetterDeclined(
      baseEvent('engagement.letter.declined', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-declined-001',
        declinedAt: new Date(), reason: 'Out of coverage area',
        priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    const recipients: string[] = Array.isArray(args[0].to) ? args[0].to : [args[0].to];
    expect(recipients).toContain('coord@unit.test');
    expect(recipients).toContain('ops@unit.test');
    expect(args[0].subject).toMatch(/Engagement Letter Declined/i);
    expect(args[0].html).toMatch(/Out of coverage area/);
  });

  it('engagement.letter.declined includes declined reason when provided', async () => {
    await (handler as any).onEngagementLetterDeclined(
      baseEvent('engagement.letter.declined', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-nd-001',
        declinedAt: new Date(), reason: 'Fee too low',
        priority: EventPriority.NORMAL,
      }),
    );

    const [args] = mockSendEmail.mock.calls;
    expect(args[0].html).toMatch(/Fee too low/);
  });

  it('engagement.letter.declined sends without reason when none given', async () => {
    await (handler as any).onEngagementLetterDeclined(
      baseEvent('engagement.letter.declined', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        vendorId: 'vendor-1', letterId: 'letter-nd-002',
        declinedAt: new Date(), priority: EventPriority.NORMAL,
        // no reason field
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  // ── Dry-run mode: service starts when email service is unavailable ─────────

  it('operates in log-only mode when EmailService constructor throws', async () => {
    const { EmailService } = await import('../../src/services/email.service.js');
    (EmailService as any).mockImplementationOnce(() => {
      throw new Error('ACS not configured');
    });

    // Should not throw
    const dryRunHandler = new CommunicationEventHandler(db as any);

    await expect(
      (dryRunHandler as any).onVendorBidSent(
        baseEvent('vendor.bid.sent', {
          orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
          vendorId: 'vendor-1', vendorName: 'Test Vendor',
          bidId: 'bid-1', expiresAt: new Date(), attemptNumber: 1,
          priority: EventPriority.NORMAL,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  // ── V-02: vendor.bid.expiring ──────────────────────────────────────────────

  it('vendor.bid.expiring sends reminder email to vendor with minutesRemaining in body', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
    await (handler as any).onVendorBidExpiring(
      baseEvent('vendor.bid.expiring', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        clientId: 'client-1', vendorId: 'vendor-1', vendorName: 'Acme',
        bidId: 'bid-1', expiresAt, minutesRemaining: 20,
        attemptNumber: 1, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    expect(args[0].to).toContain('vendor@appraisal.test');
    expect(args[0].subject).toMatch(/Reminder.*Expires Soon/i);
    expect(args[0].html).toMatch(/20 minute/);
  });

  it('vendor.bid.expiring skips send when vendor email cannot be resolved', async () => {
    db.getItem.mockResolvedValue({ success: false, data: null });
    const handler2 = new CommunicationEventHandler(db as any);

    await (handler2 as any).onVendorBidExpiring(
      baseEvent('vendor.bid.expiring', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        clientId: 'client-1', vendorId: 'vendor-ghost', vendorName: 'Unknown',
        bidId: 'bid-1', expiresAt: new Date().toISOString(), minutesRemaining: 15,
        attemptNumber: 1, priority: EventPriority.NORMAL,
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── V-03: vendor.assignment.exhausted ────────────────────────────────────

  it('vendor.assignment.exhausted emails escalation recipients for the client', async () => {
    await (handler as any).onVendorAssignmentExhausted(
      baseEvent('vendor.assignment.exhausted', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        clientId: 'client-1', attemptsCount: 5,
        vendorsContacted: ['vendor-1', 'vendor-2'],
        priority: EventPriority.HIGH, requiresHumanIntervention: true,
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [args] = mockSendEmail.mock.calls;
    const recipients: string[] = Array.isArray(args[0].to) ? args[0].to : [args[0].to];
    expect(recipients).toContain('ops@unit.test');
    expect(args[0].subject).toMatch(/Vendor Assignment Exhausted/i);
    expect(args[0].html).toMatch(/5/); // attemptsCount
    expect(args[0].html).toMatch(/Manual vendor assignment is required/i);
  });

  it('vendor.assignment.exhausted skips send when no escalation recipients configured', async () => {
    const { TenantAutomationConfigService } = await import(
      '../../src/services/tenant-automation-config.service.js'
    );
    const tcsMock = (TenantAutomationConfigService as any).mock.results.at(-1).value;
    tcsMock.getConfig.mockResolvedValue({ escalationRecipients: [] });

    await (handler as any).onVendorAssignmentExhausted(
      baseEvent('vendor.assignment.exhausted', {
        orderId: 'order-1', orderNumber: 'ORD-001', tenantId: TENANT,
        clientId: 'client-1', attemptsCount: 5,
        vendorsContacted: ['vendor-1'], priority: EventPriority.HIGH,
        requiresHumanIntervention: true,
      }),
    );

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
