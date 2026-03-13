/**
 * Auto-Delivery Service
 *
 * Listens to two events that signal an order is cleared for delivery:
 *   1. qc.ai.scored { decision: 'auto_pass' }  — AI bypassed human review
 *   2. supervision.cosigned                      — supervisor co-signed off
 *
 * When autoDeliveryEnabled is true for the tenant, this service:
 *   - Updates the order status to DELIVERED
 *   - Records the delivery timestamp on the order
 *   - Publishes order.delivered (consumed by EngagementLifecycleService,
 *     CommunicationEventHandler, and any other downstream consumers)
 *
 * When autoDeliveryEnabled is false, nothing happens here and the delivery
 * step remains a manual coordinator action (no regression from current state).
 *
 * NOTE: Actual PDF report generation / portal upload is out of scope for this
 * service. A future ReportGenerationService can subscribe to order.delivered
 * and attach the artefact. This service is intentionally narrow.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import type {
  BaseEvent,
  EventHandler,
  QCAIScoredEvent,
  SupervisionCosignedEvent,
  OrderDeliveredEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export class AutoDeliveryService {
  private readonly logger = new Logger('AutoDeliveryService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'auto-delivery-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AutoDeliveryService already started');
      return;
    }

    await Promise.all([
      this.subscriber.subscribe<QCAIScoredEvent>(
        'qc.ai.scored',
        this.makeHandler('qc.ai.scored', this.onQCAIScored.bind(this)),
      ),
      this.subscriber.subscribe<SupervisionCosignedEvent>(
        'supervision.cosigned',
        this.makeHandler('supervision.cosigned', this.onSupervisionCosigned.bind(this)),
      ),
    ]);

    this.isStarted = true;
    this.logger.info('AutoDeliveryService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all([
      this.subscriber.unsubscribe('qc.ai.scored'),
      this.subscriber.unsubscribe('supervision.cosigned'),
    ]);
    this.isStarted = false;
    this.logger.info('AutoDeliveryService stopped');
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Only acts on AI auto-pass decisions — needs_review / needs_supervision are
   *  handled by the orchestrator and routed to human QC first. */
  private async onQCAIScored(event: QCAIScoredEvent): Promise<void> {
    if (event.data.decision !== 'auto_pass') return;

    const { orderId, tenantId, priority } = event.data;
    this.logger.info('AI auto-pass detected — checking auto-delivery config', { orderId, tenantId });
    await this.deliverOrder(orderId, tenantId, 'ai_auto_pass', priority);
  }

  /** Fires after a supervisor co-signs, regardless of whether AI flagged it or
   *  the tenant requires supervisory review for all orders. */
  private async onSupervisionCosigned(event: SupervisionCosignedEvent): Promise<void> {
    const { orderId, tenantId, priority } = event.data;
    this.logger.info('Supervision cosigned — checking auto-delivery config', { orderId, tenantId });
    await this.deliverOrder(orderId, tenantId, 'supervision_cosigned', priority);
  }

  // ── Core delivery logic ────────────────────────────────────────────────────

  private async deliverOrder(
    orderId: string,
    tenantId: string,
    trigger: string,
    priority: EventPriority,
  ): Promise<void> {
    const tenantConfig = await this.tenantConfigService.getConfig(tenantId);
    if (!tenantConfig.autoDeliveryEnabled) {
      this.logger.info('Auto-delivery disabled by tenant config — skipping', {
        orderId,
        tenantId,
        trigger,
      });
      return;
    }

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.error('AutoDeliveryService: order not found', { orderId });
      return;
    }

    // Idempotency guard — don't re-deliver an already-delivered order.
    if (order.status === 'DELIVERED') {
      this.logger.info('Order already delivered — skipping', { orderId });
      return;
    }

    const deliveredAt = new Date();

    await this.dbService.updateItem(
      'orders',
      orderId,
      {
        ...order,
        status: 'DELIVERED',
        deliveredAt: deliveredAt.toISOString(),
        autoDeliveryTrigger: trigger,
        updatedAt: deliveredAt.toISOString(),
      },
      tenantId,
    );

    this.logger.info('Order status set to DELIVERED', { orderId, trigger });

    const deliveredEvent: OrderDeliveredEvent = {
      id: uuidv4(),
      type: 'order.delivered',
      timestamp: deliveredAt,
      source: 'auto-delivery-service',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId,
        orderNumber: order.orderNumber ?? orderId,
        engagementId: order.engagementId,
        tenantId,
        clientId: order.clientId ?? '',
        deliveredAt,
        deliveryMethod: 'portal',
        priority,
      },
    };

    await this.publisher.publish(deliveredEvent);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async loadOrder(orderId: string, tenantId: string): Promise<any | null> {
    try {
      const result = await this.dbService.getItem('orders', orderId, tenantId);
      return (result as any)?.data ?? result ?? null;
    } catch (err) {
      this.logger.error('Failed to load order', { orderId, tenantId, error: err });
      return null;
    }
  }

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
