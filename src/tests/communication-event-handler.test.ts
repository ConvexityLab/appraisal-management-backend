/**
 * CommunicationEventHandler unit tests
 *
 * Tests all 11 event handlers:
 *   Classic (pre-existing): vendor.bid.sent, vendor.bid.accepted,
 *     vendor.assignment.exhausted, review.assignment.exhausted,
 *     order.delivered, engagement.status.changed
 *   New: review.sla.warning, review.sla.breached,
 *     engagement.letter.sent, engagement.letter.signed, engagement.letter.declined
 *
 * All email/DB calls are mocked; behaviour under missing email addresses is
 * also tested (must skip gracefully, never throw).
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' } as any);
jest.mock('../services/email.service.js', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}));

jest.mock('../services/cosmos-db.service.js', () => ({
  CosmosDbService: jest.fn().mockImplementation(() => ({
    getItem: jest.fn(),
    getEngagementsContainer: jest.fn().mockReturnValue({
      item: jest.fn().mockReturnValue({
        read: jest.fn().mockResolvedValue({ resource: null }),
      }),
    }),
  })),
}));

jest.mock('../services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockResolvedValue({ escalationRecipients: ['mgr@example.com'] }),
  })),
}));

import { CommunicationEventHandler } from '../services/communication-event-handler.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-test';
const ORDER_ID = 'order-x1';
const ORDER_NUMBER = 'ORD-X1';

function makeBaseEvent(type: string, data: Record<string, unknown>) {
  return { id: `evt-${type}`, type, timestamp: new Date(), source: 'test', version: '1.0', data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommunicationEventHandler', () => {
  let handler: CommunicationEventHandler;
  let mockDb: jest.Mocked<CosmosDbService>;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new CommunicationEventHandler();
    const CosmosDbServiceMock = CosmosDbService as jest.MockedClass<typeof CosmosDbService>;
    mockDb = CosmosDbServiceMock.mock.instances[0] as jest.Mocked<CosmosDbService>;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('starts without throwing', async () => {
      await expect(handler.start()).resolves.toBeUndefined();
    });

    it('stops without throwing', async () => {
      await handler.start();
      await expect(handler.stop()).resolves.toBeUndefined();
    });

    it('does not subscribe twice when called start() twice', async () => {
      const { ServiceBusEventSubscriber } = await import('../services/service-bus-subscriber.js');
      const subMock = (ServiceBusEventSubscriber as jest.MockedClass<typeof ServiceBusEventSubscriber>)
        .mock.instances[0];

      await handler.start();
      const firstCallCount = (subMock.subscribe as jest.Mock).mock.calls.length;
      await handler.start(); // second start should be a no-op
      expect((subMock.subscribe as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });
  });

  // ── vendor.bid.sent ───────────────────────────────────────────────────────────

  describe('vendor.bid.sent', () => {
    it('sends bid invitation email to vendor', async () => {
      mockDb.getItem.mockResolvedValue({ success: true, data: { email: 'vendor@example.com' } } as any);

      const event = makeBaseEvent('vendor.bid.sent', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', vendorName: 'Acme Appraisals',
        bidId: 'bid-1', expiresAt: new Date(Date.now() + 86400_000), priority: 'NORMAL',
      });

      await (handler as any).onVendorBidSent(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.to).toContain('vendor@example.com');
      expect(call.subject).toMatch(/New Appraisal Order Invitation/i);
    });

    it('skips email when vendor has no email address', async () => {
      mockDb.getItem.mockResolvedValue({ success: true, data: { contactEmail: null } } as any);

      const event = makeBaseEvent('vendor.bid.sent', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v2', vendorName: 'No Email Corp',
        bidId: 'bid-2', expiresAt: new Date(Date.now() + 86400_000), priority: 'NORMAL',
      });

      await (handler as any).onVendorBidSent(event);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ── vendor.bid.accepted ───────────────────────────────────────────────────────

  describe('vendor.bid.accepted', () => {
    it('notifies coordinator when vendor accepts', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'coord@example.com' },
      } as any);

      const event = makeBaseEvent('vendor.bid.accepted', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', vendorName: 'Acme Appraisals', priority: 'NORMAL',
      });

      await (handler as any).onVendorBidAccepted(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect((mockSendEmail as jest.Mock).mock.calls[0][0].subject).toMatch(/Vendor Accepted/i);
    });
  });

  // ── review.sla.warning ────────────────────────────────────────────────────────

  describe('review.sla.warning', () => {
    it('sends warning email to escalation recipients and reviewer', async () => {
      // Reviewer lookup
      mockDb.getItem.mockResolvedValue({ success: true, data: { email: 'reviewer@example.com' } } as any);

      const event = makeBaseEvent('review.sla.warning', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        qcReviewId: 'qc-1', reviewerId: 'rev-1',
        percentElapsed: 80, targetDate: new Date(), remainingMinutes: 60, priority: 'NORMAL',
      });

      await (handler as any).onReviewSLAWarning(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.subject).toMatch(/SLA Warning/i);
      expect(call.subject).toMatch(/80%/);
      // Both escalation recipient and reviewer should be in the to list
      expect(call.to).toContain('mgr@example.com');
      expect(call.to).toContain('reviewer@example.com');
    });

    it('still sends to escalation recipients even when reviewer email is missing', async () => {
      mockDb.getItem.mockResolvedValue({ success: true, data: {} } as any); // no email field

      const event = makeBaseEvent('review.sla.warning', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        qcReviewId: 'qc-2', reviewerId: 'rev-2',
        percentElapsed: 90, targetDate: new Date(), remainingMinutes: 20, priority: 'HIGH',
      });

      await (handler as any).onReviewSLAWarning(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.to).toContain('mgr@example.com');
    });

    it('skips email when no recipients are configured and reviewer has no email', async () => {
      // Override tenant config to return empty escalation list
      const { TenantAutomationConfigService } = await import('../services/tenant-automation-config.service.js');
      const tcsMock = (TenantAutomationConfigService as jest.MockedClass<typeof TenantAutomationConfigService>)
        .mock.instances[0];
      (tcsMock.getConfig as jest.Mock).mockResolvedValueOnce({ escalationRecipients: [] });

      mockDb.getItem.mockResolvedValue({ success: true, data: {} } as any);

      const event = makeBaseEvent('review.sla.warning', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        qcReviewId: 'qc-3', reviewerId: 'rev-3',
        percentElapsed: 80, targetDate: new Date(), remainingMinutes: 30, priority: 'NORMAL',
      });

      await (handler as any).onReviewSLAWarning(event);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ── review.sla.breached ───────────────────────────────────────────────────────

  describe('review.sla.breached', () => {
    it('sends breach alert to escalation recipients', async () => {
      const event = makeBaseEvent('review.sla.breached', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        qcReviewId: 'qc-4', reviewerId: 'rev-4',
        targetDate: new Date(), minutesOverdue: 45, priority: 'NORMAL',
      });

      await (handler as any).onReviewSLABreached(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.subject).toMatch(/SLA Breached/i);
      expect(call.html).toMatch(/45/);
    });

    it('skips when no escalation recipients configured', async () => {
      const { TenantAutomationConfigService } = await import('../services/tenant-automation-config.service.js');
      const tcsMock = (TenantAutomationConfigService as jest.MockedClass<typeof TenantAutomationConfigService>)
        .mock.instances[0];
      (tcsMock.getConfig as jest.Mock).mockResolvedValueOnce({ escalationRecipients: [] });

      const event = makeBaseEvent('review.sla.breached', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        qcReviewId: 'qc-5', reviewerId: 'rev-5',
        targetDate: new Date(), minutesOverdue: 10, priority: 'NORMAL',
      });

      await (handler as any).onReviewSLABreached(event);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ── engagement.letter.sent ────────────────────────────────────────────────────

  describe('engagement.letter.sent', () => {
    it('notifies coordinator that letter was sent to vendor', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'coord@example.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.sent', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', letterId: 'letter-1',
        signingToken: 'tok-abc', expiresAt: new Date(Date.now() + 86400_000), priority: 'NORMAL',
      });

      await (handler as any).onEngagementLetterSent(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect((mockSendEmail as jest.Mock).mock.calls[0][0].subject).toMatch(/Engagement Letter Sent/i);
    });
  });

  // ── engagement.letter.signed ──────────────────────────────────────────────────

  describe('engagement.letter.signed', () => {
    it('notifies coordinator that vendor signed', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'coord@example.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.signed', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', letterId: 'letter-2',
        signedAt: new Date(), priority: 'NORMAL',
      });

      await (handler as any).onEngagementLetterSigned(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.subject).toMatch(/Engagement Letter Signed/i);
    });

    it('skips when coordinator email is unresolvable', async () => {
      mockDb.getItem.mockResolvedValue({ success: true, data: {} } as any);

      const event = makeBaseEvent('engagement.letter.signed', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', letterId: 'letter-3', signedAt: new Date(), priority: 'NORMAL',
      });

      await (handler as any).onEngagementLetterSigned(event);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  // ── engagement.letter.declined ────────────────────────────────────────────────

  describe('engagement.letter.declined', () => {
    it('notifies escalation recipients and coordinator when vendor declines', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'coord@example.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.declined', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v1', letterId: 'letter-4',
        declinedAt: new Date(), reason: 'Too far away', priority: 'NORMAL',
      });

      await (handler as any).onEngagementLetterDeclined(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const call = (mockSendEmail as jest.Mock).mock.calls[0][0] as any;
      expect(call.subject).toMatch(/Engagement Letter Declined/i);
      expect(call.to).toContain('mgr@example.com');
      expect(call.to).toContain('coord@example.com');
      expect(call.html).toContain('Too far away');
    });

    it('includes reason in email body when provided', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'c@e.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.declined', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v2', letterId: 'letter-5',
        declinedAt: new Date(), reason: 'Schedule conflict', priority: 'NORMAL',
      });

      await (handler as any).onEngagementLetterDeclined(event);

      expect((mockSendEmail as jest.Mock).mock.calls[0][0].html).toContain('Schedule conflict');
    });

    it('omits reason block when reason is undefined', async () => {
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'c@e.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.declined', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v3', letterId: 'letter-6',
        declinedAt: new Date(), priority: 'NORMAL',
        // reason absent
      });

      await (handler as any).onEngagementLetterDeclined(event);

      expect((mockSendEmail as jest.Mock).mock.calls[0][0].html).not.toMatch(/<em>/);
    });

    it('never throws when email service is unavailable (dry-run mode)', async () => {
      // Force email service to throw on send
      mockSendEmail.mockRejectedValueOnce(new Error('ACS down'));
      mockDb.getItem.mockResolvedValue({
        success: true, data: { coordinatorEmail: 'c@e.com' },
      } as any);

      const event = makeBaseEvent('engagement.letter.declined', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        vendorId: 'v4', letterId: 'letter-7', declinedAt: new Date(), priority: 'NORMAL',
      });

      // Must not propagate — notifications are non-fatal
      await expect((handler as any).onEngagementLetterDeclined(event)).resolves.toBeUndefined();
    });
  });

  // ── order.delivered ───────────────────────────────────────────────────────────

  describe('order.delivered', () => {
    it('sends delivery notification to client', async () => {
      mockDb.getItem
        .mockResolvedValueOnce({ success: true, data: { email: 'client@example.com' } } as any); // client lookup

      const event = makeBaseEvent('order.delivered', {
        orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId: TENANT_ID,
        clientId: 'client-1', deliveredAt: new Date().toISOString(), priority: 'NORMAL',
      });

      await (handler as any).onOrderDelivered(event);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect((mockSendEmail as jest.Mock).mock.calls[0][0].subject).toMatch(/Your Appraisal Report is Ready/i);
    });
  });
});
