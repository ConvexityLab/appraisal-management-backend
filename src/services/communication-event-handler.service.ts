/**
 * Communication Event Handler Service
 *
 * Listens to lifecycle events on the Service Bus and fires automated email
 * notifications without any manual operator trigger.
 *
 * Events handled:
 *   vendor.bid.sent             → bid invitation email/SMS to vendor
 *   vendor.bid.accepted         → acceptance confirmation to coordinator
 *   order.delivered             → delivery email to client
 *   engagement.status.changed   → engagement complete email to client
 *   vendor.assignment.exhausted → escalation email to staff recipients
 *   review.assignment.exhausted → escalation email to staff recipients
 *
 * Email addresses are resolved by loading the relevant Cosmos documents.
 * When an address cannot be resolved the notification is logged as skipped
 * (not thrown) so the pipeline is never blocked by a missing contact.
 *
 * Sending is delegated to EmailService; if ACS is not configured the
 * constructor catches the error and operates in dry-run / log-only mode.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import type {
  BaseEvent,
  EventHandler,
  VendorBidSentEvent,
  VendorBidAcceptedEvent,
  VendorAssignmentExhaustedEvent,
  ReviewAssignmentExhaustedEvent,
  OrderDeliveredEvent,
  EngagementStatusChangedEvent,
} from '../types/events.js';

// EmailService throws at construction when AZURE_COMMUNICATION_EMAIL_DOMAIN is absent.
// We import lazily and swallow the error so the rest of the pipeline keeps running.
let EmailService: any;
let EmailOptions: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../services/email.service.js') as typeof import('./email.service.js');
  EmailService = mod.EmailService;
} catch {
  // ACS package not available in this environment — dry-run mode.
}

export class CommunicationEventHandler {
  private readonly logger = new Logger('CommunicationEventHandler');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private emailService: InstanceType<typeof import('./email.service.js').EmailService> | null = null;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'communication-event-handler',
    );
    this.tenantConfigService = new TenantAutomationConfigService();

    // Initialise email service gracefully — if ACS is not configured this
    // service runs in log-only mode (no emails sent, no errors thrown).
    if (EmailService) {
      try {
        this.emailService = new EmailService();
      } catch (err) {
        this.logger.warn(
          'EmailService could not be initialised — running in log-only mode. ' +
            'Set AZURE_COMMUNICATION_EMAIL_DOMAIN and AZURE_COMMUNICATION_ENDPOINT to enable sending.',
          { error: err instanceof Error ? err.message : String(err) },
        );
      }
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('CommunicationEventHandler already started');
      return;
    }

    await Promise.all([
      this.subscriber.subscribe<VendorBidSentEvent>(
        'vendor.bid.sent',
        this.makeHandler('vendor.bid.sent', this.onVendorBidSent.bind(this)),
      ),
      this.subscriber.subscribe<VendorBidAcceptedEvent>(
        'vendor.bid.accepted',
        this.makeHandler('vendor.bid.accepted', this.onVendorBidAccepted.bind(this)),
      ),
      this.subscriber.subscribe<VendorAssignmentExhaustedEvent>(
        'vendor.assignment.exhausted',
        this.makeHandler(
          'vendor.assignment.exhausted',
          this.onVendorAssignmentExhausted.bind(this),
        ),
      ),
      this.subscriber.subscribe<ReviewAssignmentExhaustedEvent>(
        'review.assignment.exhausted',
        this.makeHandler(
          'review.assignment.exhausted',
          this.onReviewAssignmentExhausted.bind(this),
        ),
      ),
      this.subscriber.subscribe<OrderDeliveredEvent>(
        'order.delivered',
        this.makeHandler('order.delivered', this.onOrderDelivered.bind(this)),
      ),
      this.subscriber.subscribe<EngagementStatusChangedEvent>(
        'engagement.status.changed',
        this.makeHandler(
          'engagement.status.changed',
          this.onEngagementStatusChanged.bind(this),
        ),
      ),
    ]);

    this.isStarted = true;
    this.logger.info('CommunicationEventHandler started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all([
      this.subscriber.unsubscribe('vendor.bid.sent'),
      this.subscriber.unsubscribe('vendor.bid.accepted'),
      this.subscriber.unsubscribe('vendor.assignment.exhausted'),
      this.subscriber.unsubscribe('review.assignment.exhausted'),
      this.subscriber.unsubscribe('order.delivered'),
      this.subscriber.unsubscribe('engagement.status.changed'),
    ]);
    this.isStarted = false;
    this.logger.info('CommunicationEventHandler stopped');
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async onVendorBidSent(event: VendorBidSentEvent): Promise<void> {
    const { orderId, vendorId, vendorName, orderNumber, tenantId, expiresAt } = event.data;

    const vendorEmail = await this.resolveVendorEmail(vendorId, tenantId);
    if (!vendorEmail) {
      this.logger.warn('vendor.bid.sent: no email for vendor — skipping notification', {
        vendorId,
        vendorName,
      });
      return;
    }

    const expiry = new Date(expiresAt).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    await this.sendEmail({
      to: vendorEmail,
      subject: `New Appraisal Order Invitation — ${orderNumber}`,
      html: `
        <p>Hi ${vendorName},</p>
        <p>You have been invited to bid on appraisal order <strong>${orderNumber}</strong>.</p>
        <p>Please log in to the portal to accept or decline this invitation before
           <strong>${expiry}</strong>.</p>
        <p>If you have any questions, please contact your coordinator.</p>
      `,
      context: { event: 'vendor.bid.sent', orderId, vendorId },
    });
  }

  private async onVendorBidAccepted(event: VendorBidAcceptedEvent): Promise<void> {
    const { orderId, orderNumber, vendorId, vendorName, tenantId } = event.data;

    // Notify the order's coordinator / client contact.
    const coordinatorEmail = await this.resolveOrderContactEmail(orderId, tenantId);
    if (!coordinatorEmail) {
      this.logger.warn('vendor.bid.accepted: no coordinator email — skipping', {
        orderId,
        vendorId,
      });
      return;
    }

    await this.sendEmail({
      to: coordinatorEmail,
      subject: `Vendor Accepted Order ${orderNumber}`,
      html: `
        <p>Vendor <strong>${vendorName}</strong> has accepted the bid for order
           <strong>${orderNumber}</strong>.</p>
        <p>The appraisal is now in progress.</p>
      `,
      context: { event: 'vendor.bid.accepted', orderId, vendorId },
    });
  }

  private async onVendorAssignmentExhausted(
    event: VendorAssignmentExhaustedEvent,
  ): Promise<void> {
    const { orderId, orderNumber, tenantId, attemptsCount } = event.data;
    const recipients = await this.resolveEscalationRecipients(tenantId);

    if (recipients.length === 0) {
      this.logger.warn('vendor.assignment.exhausted: no escalation recipients configured', {
        tenantId,
        orderId,
      });
      return;
    }

    await this.sendEmail({
      to: recipients,
      subject: `⚠️ Vendor Assignment Exhausted — ${orderNumber}`,
      html: `
        <p>All ${attemptsCount} vendor attempt(s) have been exhausted for order
           <strong>${orderNumber}</strong> (${orderId}).</p>
        <p><strong>Manual vendor assignment is required.</strong></p>
      `,
      context: { event: 'vendor.assignment.exhausted', orderId },
    });
  }

  private async onReviewAssignmentExhausted(
    event: ReviewAssignmentExhaustedEvent,
  ): Promise<void> {
    const { orderId, orderNumber, tenantId, attemptsCount } = event.data;
    const recipients = await this.resolveEscalationRecipients(tenantId);

    if (recipients.length === 0) {
      this.logger.warn('review.assignment.exhausted: no escalation recipients configured', {
        tenantId,
        orderId,
      });
      return;
    }

    await this.sendEmail({
      to: recipients,
      subject: `⚠️ Review Assignment Exhausted — ${orderNumber}`,
      html: `
        <p>All ${attemptsCount} reviewer attempt(s) have been exhausted for order
           <strong>${orderNumber}</strong> (${orderId}).</p>
        <p><strong>Manual review assignment is required.</strong></p>
      `,
      context: { event: 'review.assignment.exhausted', orderId },
    });
  }

  private async onOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, clientId, deliveredAt } = event.data;

    const clientEmail = await this.resolveClientEmail(clientId, orderId, tenantId);
    if (!clientEmail) {
      this.logger.warn('order.delivered: no client email — skipping delivery notification', {
        orderId,
        clientId,
      });
      return;
    }

    const deliveryTime = new Date(deliveredAt).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    await this.sendEmail({
      to: clientEmail,
      subject: `Your Appraisal Report is Ready — ${orderNumber}`,
      html: `
        <p>Your appraisal report for order <strong>${orderNumber}</strong> has been
           delivered to the portal on <strong>${deliveryTime}</strong>.</p>
        <p>Please log in to view and download the report.</p>
      `,
      context: { event: 'order.delivered', orderId, clientId },
    });
  }

  private async onEngagementStatusChanged(
    event: EngagementStatusChangedEvent,
  ): Promise<void> {
    if (event.data.newStatus !== 'DELIVERED') return;

    const { engagementId, tenantId } = event.data;

    const clientEmail = await this.resolveEngagementClientEmail(engagementId, tenantId);
    if (!clientEmail) {
      this.logger.warn(
        'engagement.status.changed(DELIVERED): no client email — skipping notification',
        { engagementId },
      );
      return;
    }

    await this.sendEmail({
      to: clientEmail,
      subject: 'All Appraisal Reports Delivered',
      html: `
        <p>All appraisal reports for your engagement have been completed and delivered.</p>
        <p>Engagement reference: <strong>${engagementId}</strong></p>
        <p>Please log in to the portal to review all reports.</p>
      `,
      context: { event: 'engagement.status.changed', engagementId },
    });
  }

  // ── Email resolution helpers ───────────────────────────────────────────────

  private async resolveVendorEmail(
    vendorId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      const result = await this.dbService.getItem('vendors', vendorId, tenantId);
      const vendor = (result as any)?.data ?? result;
      return vendor?.email ?? vendor?.contactEmail ?? null;
    } catch {
      return null;
    }
  }

  private async resolveOrderContactEmail(
    orderId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      const result = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (result as any)?.data ?? result;
      return (
        order?.coordinatorEmail ??
        order?.clientEmail ??
        order?.contactEmail ??
        null
      );
    } catch {
      return null;
    }
  }

  private async resolveClientEmail(
    clientId: string,
    orderId: string,
    tenantId: string,
  ): Promise<string | null> {
    // First try the clients container.
    if (clientId) {
      try {
        const result = await this.dbService.getItem('clients', clientId, tenantId);
        const client = (result as any)?.data ?? result;
        const email = client?.email ?? client?.contactEmail;
        if (email) return email;
      } catch {
        // Fall through to order-based lookup.
      }
    }

    // Fall back to the email stored inline on the order.
    return this.resolveOrderContactEmail(orderId, tenantId);
  }

  private async resolveEngagementClientEmail(
    engagementId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      const container = this.dbService.getEngagementsContainer();
      const response = await container.item(engagementId, tenantId).read();
      const engagement = response.resource;
      if (!engagement) return null;
      const clientId: string | undefined = engagement.client?.clientId;
      if (!clientId) return null;

      const clientResult = await this.dbService.getItem('clients', clientId, tenantId);
      const client = (clientResult as any)?.data ?? clientResult;
      return client?.email ?? client?.contactEmail ?? null;
    } catch {
      return null;
    }
  }

  private async resolveEscalationRecipients(tenantId: string): Promise<string[]> {
    try {
      const config = await this.tenantConfigService.getConfig(tenantId);
      return config.escalationRecipients ?? [];
    } catch {
      return [];
    }
  }

  // ── Send wrapper ───────────────────────────────────────────────────────────

  private async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    const { to, subject, html, context } = params;
    const recipients = Array.isArray(to) ? to : [to];

    if (!this.emailService) {
      this.logger.info('[dry-run] Would send email', { to: recipients, subject, ...context });
      return;
    }

    try {
      const result = await this.emailService.sendEmail({ to: recipients, subject, html });
      if (!result.success) {
        this.logger.warn('Email send failed — non-fatal, pipeline continues', {
          subject,
          error: result.error,
          ...context,
        });
      } else {
        this.logger.info('Email sent', { subject, to: recipients, messageId: result.messageId });
      }
    } catch (err) {
      // Never let a notification failure block the event pipeline.
      this.logger.error('Email send threw — non-fatal', {
        subject,
        error: err instanceof Error ? err.message : String(err),
        ...context,
      });
    }
  }

  // ── Handler factory ────────────────────────────────────────────────────────

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        this.logger.debug(`Handling ${eventType}`, { eventId: event.id });
        await fn(event);
      },
    };
  }
}
