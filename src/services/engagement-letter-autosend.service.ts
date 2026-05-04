/**
 * Engagement Letter Auto-Send Service
 *
 * Subscribes to vendor assignment events and, when the tenant has
 * engagementLetterAutoSend enabled, automatically:
 *   1. Generates an engagement letter via EngagementLetterService
 *   2. Creates a one-time signing token via InternalESignService
 *   3. Emails the vendor with the signing URL
 *   4. Publishes engagement.letter.sent
 *
 * If requireSignedLetterBeforeProgress is also enabled, the order lifecycle
 * service (and the vendor-bid-accepted handler in the orchestrator) will
 * wait for the signed event before allowing the order to advance.
 *
 * Service Bus subscription: 'engagement-letter-autosend-service'
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { EngagementLetterService } from './engagement-letter.service.js';
import { InternalESignService } from './internal-esign.service.js';
import { EmailService } from './email.service.js';
import type {
  BaseEvent,
  EventHandler,
  VendorBidAcceptedEvent,
  VendorStaffAssignedEvent,
  EngagementLetterSentEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export class EngagementLetterAutoSendService {
  private readonly logger = new Logger('EngagementLetterAutoSendService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly letterService: EngagementLetterService;
  private readonly esignService: InternalESignService;
  private readonly emailService: EmailService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'engagement-letter-autosend-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
    this.letterService = new EngagementLetterService(this.dbService);
    this.esignService = new InternalESignService(this.dbService);
    this.emailService = new EmailService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('EngagementLetterAutoSendService already started');
      return;
    }

    await Promise.all([
      this.subscriber.subscribe<VendorBidAcceptedEvent>(
        'vendor.bid.accepted',
        this.makeHandler('vendor.bid.accepted', this.onBidAccepted.bind(this)),
      ),
      this.subscriber.subscribe<VendorStaffAssignedEvent>(
        'vendor.staff.assigned',
        this.makeHandler('vendor.staff.assigned', this.onStaffAssigned.bind(this)),
      ),
    ]);

    this.isStarted = true;
    this.logger.info('EngagementLetterAutoSendService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all([
      this.subscriber.unsubscribe('vendor.bid.accepted').catch(() => {}),
      this.subscriber.unsubscribe('vendor.staff.assigned').catch(() => {}),
    ]);
    this.isStarted = false;
    this.logger.info('EngagementLetterAutoSendService stopped');
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async onBidAccepted(event: VendorBidAcceptedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, vendorId, vendorName } = event.data;
    await this.maybeAutoSend(orderId, orderNumber, tenantId, vendorId, vendorName);
  }

  private async onStaffAssigned(event: VendorStaffAssignedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, vendorId, vendorName } = event.data;
    await this.maybeAutoSend(orderId, orderNumber, tenantId, vendorId, vendorName);
  }

  private async maybeAutoSend(
    orderId: string,
    orderNumber: string,
    tenantId: string,
    vendorId: string,
    vendorName: string,
  ): Promise<void> {
    // Load order to get clientId, productType and other needed fields
    const orderResult = await this.dbService.findOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      this.logger.warn('Cannot auto-send engagement letter: order not found', { orderId });
      return;
    }
    const order = orderResult.data as unknown as Record<string, unknown>;
    const productType = (order['productType'] as string | undefined) ?? 'full_appraisal';
    const clientId = order['clientId'] as string;
    if (!clientId) {
      this.logger.warn('Cannot auto-send engagement letter: order has no clientId', { orderId });
      return;
    }

    const config = await this.tenantConfigService.getConfig(clientId);
    if (!config.engagementLetterAutoSend) {
      this.logger.info('engagementLetterAutoSend disabled for client — skipping', { clientId, orderId });
      return;
    }

    // Get vendor email
    const vendorEmail = await this.getVendorEmail(vendorId, tenantId);
    if (!vendorEmail) {
      this.logger.warn('Cannot auto-send engagement letter: vendor email not found', { vendorId, orderId });
      return;
    }

    // Generate letter
    let letter: Awaited<ReturnType<EngagementLetterService['generateEngagementLetter']>>;
    try {
      letter = await this.letterService.generateEngagementLetter({
        orderId,
        vendorId,
        tenantId,
        clientId,
        productType,
      });
    } catch (err) {
      this.logger.error('Failed to generate engagement letter', {
        orderId,
        error: (err as Error).message,
      });
      return;
    }

    // Generate signing token
    let signing: Awaited<ReturnType<InternalESignService['generateSigningToken']>>;
    try {
      signing = await this.esignService.generateSigningToken(
        letter.letterId,
        orderId,
        orderNumber,
        tenantId,
        vendorId,
        vendorEmail,
      );
    } catch (err) {
      this.logger.error('Failed to generate signing token', {
        letterId: letter.letterId,
        error: (err as Error).message,
      });
      return;
    }

    // Send email
    const emailSent = await this.emailService.sendEmail({
      to: vendorEmail,
      subject: `Engagement Letter — Order ${orderNumber}`,
      html: this.buildEmailHtml(vendorName, orderNumber, signing.signingUrl, signing.expiresAt),
    });

    if (!emailSent.success) {
      this.logger.warn('Engagement letter email delivery failed (non-fatal)', {
        orderId,
        vendorEmail,
        error: emailSent.error,
      });
    }

    // Publish event
    const sentEvent: EngagementLetterSentEvent = {
      id: uuidv4(),
      type: 'engagement.letter.sent',
      timestamp: new Date(),
      source: 'engagement-letter-autosend-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId,
        orderNumber,
        tenantId,
        clientId,
        vendorId,
        letterId: letter.letterId,
        signingToken: signing.token,
        expiresAt: signing.expiresAt,
        priority: EventPriority.NORMAL,
      },
    };
    await this.publisher.publish(sentEvent).catch(err =>
      this.logger.warn('Failed to publish engagement.letter.sent', { error: (err as Error).message }),
    );

    this.logger.info('Engagement letter auto-sent', {
      orderId,
      orderNumber,
      vendorId,
      letterId: letter.letterId,
      expiresAt: signing.expiresAt,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getVendorEmail(vendorId: string, tenantId: string): Promise<string | null> {
    const container = this.dbService.getContainer('vendors');
    const { resources } = await container.items.query({
      query: `SELECT c.email, c.contactEmail FROM c WHERE c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: vendorId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    if (resources.length === 0) return null;
    const v = resources[0] as { email?: string; contactEmail?: string };
    return v.email ?? v.contactEmail ?? null;
  }

  private buildEmailHtml(vendorName: string, orderNumber: string, signingUrl: string, expiresAt: Date): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px;">
  <h2 style="color: #1a1a2e;">Engagement Letter — Order ${orderNumber}</h2>
  <p>Hello ${vendorName},</p>
  <p>Please review and sign the engagement letter for order <strong>${orderNumber}</strong>.</p>
  <p>
    <a href="${signingUrl}"
       style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px;">
      Review &amp; Sign Engagement Letter
    </a>
  </p>
  <p style="color: #6b7280; font-size: 13px;">
    This link expires on ${expiresAt.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.<br>
    Do not share this link. If you have questions, contact your AMC coordinator.
  </p>
</body>
</html>`;
  }

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (err) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: (err as Error).message,
          });
        }
      },
    };
  }
}
