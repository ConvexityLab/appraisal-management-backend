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
  OrderOverdueEvent,
  EngagementStatusChangedEvent,
  ReviewSLAWarningEvent,
  ReviewSLABreachedEvent,
  EngagementLetterSentEvent,
  EngagementLetterSignedEvent,
  EngagementLetterDeclinedEvent,
  SupervisionTimedOutEvent,
  AxiomEvaluationTimedOutEvent,
} from '../types/events.js';

export class CommunicationEventHandler {
  private readonly logger = new Logger('CommunicationEventHandler');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private emailService: InstanceType<typeof import('./email.service.js').EmailService> | null = null;
  private isStarted = false;

  // Resolved once EmailService is loaded (or failed). Awaited inside every
  // handler so that the service is never used before initialization completes.
  private readonly _emailServiceReady: Promise<void>;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'communication-event-handler',
    );
    this.tenantConfigService = new TenantAutomationConfigService();

    // Load EmailService lazily via dynamic import so the module is never
    // required at startup (ACS env-vars may be absent in dev / CI). The
    // returned Promise always resolves (never rejects) — failures put the
    // service in log-only mode.
    this._emailServiceReady = import('./email.service.js')
      .then(mod => {
        try {
          this.emailService = new (mod as any).EmailService();
        } catch (err) {
          this.logger.warn(
            'EmailService could not be initialised — running in log-only mode. ' +
              'Set AZURE_COMMUNICATION_EMAIL_DOMAIN and AZURE_COMMUNICATION_ENDPOINT to enable sending.',
            { error: err instanceof Error ? err.message : String(err) },
          );
        }
      })
      .catch(() => {
        // ACS package not installed in this environment — dry-run mode.
      });
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
      this.subscriber.subscribe<ReviewSLAWarningEvent>(
        'review.sla.warning',
        this.makeHandler('review.sla.warning', this.onReviewSLAWarning.bind(this)),
      ),
      this.subscriber.subscribe<ReviewSLABreachedEvent>(
        'review.sla.breached',
        this.makeHandler('review.sla.breached', this.onReviewSLABreached.bind(this)),
      ),
      this.subscriber.subscribe<EngagementLetterSentEvent>(
        'engagement.letter.sent',
        this.makeHandler('engagement.letter.sent', this.onEngagementLetterSent.bind(this)),
      ),
      this.subscriber.subscribe<EngagementLetterSignedEvent>(
        'engagement.letter.signed',
        this.makeHandler('engagement.letter.signed', this.onEngagementLetterSigned.bind(this)),
      ),
      this.subscriber.subscribe<EngagementLetterDeclinedEvent>(
        'engagement.letter.declined',
        this.makeHandler(
          'engagement.letter.declined',
          this.onEngagementLetterDeclined.bind(this),
        ),
      ),
      this.subscriber.subscribe<OrderOverdueEvent>(
        'order.overdue',
        this.makeHandler('order.overdue', this.onOrderOverdue.bind(this)),
      ),
      this.subscriber.subscribe<SupervisionTimedOutEvent>(
        'supervision.timeout',
        this.makeHandler('supervision.timeout', this.onSupervisionTimedOut.bind(this)),
      ),
      this.subscriber.subscribe<AxiomEvaluationTimedOutEvent>(
        'axiom.evaluation.timeout',
        this.makeHandler('axiom.evaluation.timeout', this.onAxiomEvaluationTimedOut.bind(this)),
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
      this.subscriber.unsubscribe('review.sla.warning'),
      this.subscriber.unsubscribe('review.sla.breached'),
      this.subscriber.unsubscribe('engagement.letter.sent'),
      this.subscriber.unsubscribe('engagement.letter.signed'),
      this.subscriber.unsubscribe('engagement.letter.declined'),
      this.subscriber.unsubscribe('order.overdue'),
      this.subscriber.unsubscribe('supervision.timeout'),
      this.subscriber.unsubscribe('axiom.evaluation.timeout'),
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

  private async onReviewSLAWarning(event: ReviewSLAWarningEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, reviewerId, percentElapsed, remainingMinutes } =
      event.data;

    const recipients = await this.resolveEscalationRecipients(tenantId);
    const reviewerEmail = await this.resolveReviewerEmail(reviewerId, tenantId);

    const to = Array.from(new Set([...recipients, ...(reviewerEmail ? [reviewerEmail] : [])]));
    if (to.length === 0) {
      this.logger.warn('review.sla.warning: no recipients — skipping', { orderId });
      return;
    }

    await this.sendEmail({
      to,
      subject: `⚠️ SLA Warning (${percentElapsed}% elapsed) — ${orderNumber}`,
      html: `
        <p>The QC review for order <strong>${orderNumber}</strong> is at
           <strong>${percentElapsed}%</strong> of its SLA with
           <strong>${remainingMinutes} minute(s)</strong> remaining.</p>
        <p>Please ensure the review is completed on time to avoid an SLA breach.</p>
      `,
      context: { event: 'review.sla.warning', orderId, reviewerId },
    });
  }

  private async onReviewSLABreached(event: ReviewSLABreachedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, reviewerId, minutesOverdue } = event.data;

    const recipients = await this.resolveEscalationRecipients(tenantId);
    if (recipients.length === 0) {
      this.logger.warn('review.sla.breached: no escalation recipients — skipping', { orderId });
      return;
    }

    await this.sendEmail({
      to: recipients,
      subject: `🚨 SLA Breached — ${orderNumber}`,
      html: `
        <p>The QC review for order <strong>${orderNumber}</strong> has breached its SLA by
           <strong>${minutesOverdue} minute(s)</strong>.</p>
        <p>Reviewer ID: <strong>${reviewerId}</strong></p>
        <p><strong>Immediate manual escalation is required.</strong></p>
      `,
      context: { event: 'review.sla.breached', orderId, reviewerId },
    });
  }

  private async onEngagementLetterSent(event: EngagementLetterSentEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, vendorId, letterId } = event.data;

    const coordinatorEmail = await this.resolveOrderContactEmail(orderId, tenantId);
    if (!coordinatorEmail) {
      this.logger.warn('engagement.letter.sent: no coordinator email — skipping', {
        orderId,
        vendorId,
      });
      return;
    }

    await this.sendEmail({
      to: coordinatorEmail,
      subject: `Engagement Letter Sent — ${orderNumber}`,
      html: `
        <p>An engagement letter (ref: <code>${letterId}</code>) has been automatically sent to
           vendor <strong>${vendorId}</strong> for order <strong>${orderNumber}</strong>.</p>
        <p>The vendor has been asked to sign or decline the letter via the portal.</p>
      `,
      context: { event: 'engagement.letter.sent', orderId, vendorId },
    });
  }

  private async onEngagementLetterSigned(event: EngagementLetterSignedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, vendorId, letterId, signedAt } = event.data;

    const coordinatorEmail = await this.resolveOrderContactEmail(orderId, tenantId);
    if (!coordinatorEmail) {
      this.logger.warn('engagement.letter.signed: no coordinator email — skipping', {
        orderId,
        vendorId,
      });
      return;
    }

    const signedTime = new Date(signedAt).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    await this.sendEmail({
      to: coordinatorEmail,
      subject: `✅ Engagement Letter Signed — ${orderNumber}`,
      html: `
        <p>Vendor <strong>${vendorId}</strong> has signed the engagement letter
           (ref: <code>${letterId}</code>) for order <strong>${orderNumber}</strong>
           at <strong>${signedTime}</strong>.</p>
        <p>The order is now ready to proceed to the next stage.</p>
      `,
      context: { event: 'engagement.letter.signed', orderId, vendorId },
    });
  }

  private async onEngagementLetterDeclined(event: EngagementLetterDeclinedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, vendorId, letterId, reason } = event.data;

    const recipients = await this.resolveEscalationRecipients(tenantId);
    const coordinatorEmail = await this.resolveOrderContactEmail(orderId, tenantId);
    const to = Array.from(
      new Set([...recipients, ...(coordinatorEmail ? [coordinatorEmail] : [])]),
    );

    if (to.length === 0) {
      this.logger.warn('engagement.letter.declined: no recipients — skipping', {
        orderId,
        vendorId,
      });
      return;
    }

    const reasonText = reason ? `<p>Reason given: <em>${reason}</em></p>` : '';

    await this.sendEmail({
      to,
      subject: `⚠️ Engagement Letter Declined — ${orderNumber}`,
      html: `
        <p>Vendor <strong>${vendorId}</strong> has <strong>declined</strong> the engagement letter
           (ref: <code>${letterId}</code>) for order <strong>${orderNumber}</strong>.</p>
        ${reasonText}
        <p><strong>Manual re-assignment may be required.</strong></p>
      `,
      context: { event: 'engagement.letter.declined', orderId, vendorId },
    });
  }

  // ── Email resolution helpers ───────────────────────────────────────────────

  private async onOrderOverdue(event: OrderOverdueEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, dueDate, hoursOverdue, currentStatus } = event.data;
    const recipients = await this.resolveEscalationRecipients(tenantId);
    const coordinatorEmail = await this.resolveOrderContactEmail(orderId, tenantId);
    const to = Array.from(
      new Set([...recipients, ...(coordinatorEmail ? [coordinatorEmail] : [])]),
    );
    if (to.length === 0) {
      this.logger.warn('order.overdue: no recipients — skipping', { orderId });
      return;
    }
    await this.sendEmail({
      to,
      subject: `⏰ Order Overdue — ${orderNumber}`,
      html: `
        <p>Order <strong>${orderNumber}</strong> (${orderId}) passed its due date of
           <strong>${new Date(dueDate).toLocaleDateString()}</strong> and is
           <strong>${hoursOverdue} hours overdue</strong>.</p>
        <p>Current status: <strong>${currentStatus}</strong></p>
        <p>Please review and take appropriate action.</p>
      `,
      context: { event: 'order.overdue', orderId },
    });
  }

  private async onSupervisionTimedOut(event: SupervisionTimedOutEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, supervisorId, requestedAt, slaHours } = event.data;
    const recipients = await this.resolveEscalationRecipients(tenantId);
    const supervisorEmail = await this.resolveReviewerEmail(supervisorId, tenantId);
    const to = Array.from(
      new Set([...recipients, ...(supervisorEmail ? [supervisorEmail] : [])]),
    );
    if (to.length === 0) {
      this.logger.warn('supervision.timeout: no recipients — skipping', { orderId });
      return;
    }
    await this.sendEmail({
      to,
      subject: `⚠️ Supervisor Co-Sign Overdue — ${orderNumber}`,
      html: `
        <p>Order <strong>${orderNumber}</strong> (${orderId}) requires supervisory co-sign
           but has not been co-signed within the <strong>${slaHours}-hour SLA</strong>.</p>
        <p>Co-sign was requested at <strong>${new Date(requestedAt).toLocaleString()}</strong>.</p>
        <p>Assigned supervisor: <strong>${supervisorId}</strong>.</p>
        <p><strong>Immediate action is required to unblock delivery.</strong></p>
      `,
      context: { event: 'supervision.timeout', orderId, supervisorId },
    });
  }

  private async onAxiomEvaluationTimedOut(event: AxiomEvaluationTimedOutEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, submittedAt, timeoutMinutes } = event.data;
    const recipients = await this.resolveEscalationRecipients(tenantId);
    if (recipients.length === 0) {
      this.logger.warn('axiom.evaluation.timeout: no escalation recipients — skipping', { orderId });
      return;
    }
    await this.sendEmail({
      to: recipients,
      subject: `⚠️ Axiom Evaluation Timed Out — ${orderNumber}`,
      html: `
        <p>The Axiom evaluation for order <strong>${orderNumber}</strong> (${orderId}) did not
           complete within the <strong>${timeoutMinutes}-minute timeout</strong>.</p>
        <p>Submitted to Axiom at: <strong>${new Date(submittedAt).toLocaleString()}</strong></p>
        <p>The order has been routed to human QC review. Please investigate the Axiom pipeline
           if this recurs.</p>
      `,
      context: { event: 'axiom.evaluation.timeout', orderId },
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

  private async resolveReviewerEmail(
    reviewerId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      const result = await this.dbService.getItem('users', reviewerId, tenantId);
      const user = (result as any)?.data ?? result;
      return user?.email ?? null;
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
    // Ensure EmailService initialisation has completed before we check it.
    await this._emailServiceReady;

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
