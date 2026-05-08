/**
 * Engagement Lifecycle Service
 *
 * Listens to order.delivered events and automatically closes an engagement
 * when ALL of its child orders have reached DELIVERED status.
 *
 * This is the final step of the autonomous pipeline:
 *
 *   order.delivered (×N)
 *       → check all orders for engagement
 *       → if all DELIVERED → step engagement status to DELIVERED
 *       → publish engagement.status.changed
 *
 * Only acts when autoCloseEngagementEnabled is true for the tenant.
 *
 * Status transition path respects the engagement state machine:
 *   IN_PROGRESS → QC → DELIVERED
 *   QC          → DELIVERED
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { EngagementService } from './engagement.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import type {
  BaseEvent,
  EventHandler,
  OrderDeliveredEvent,
  EngagementStatusChangedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { EngagementStatus } from '../types/engagement.types.js';

export class EngagementLifecycleService {
  private readonly logger = new Logger('EngagementLifecycleService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly engagementService: EngagementService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'engagement-lifecycle-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
    this.engagementService = new EngagementService(this.dbService, new PropertyRecordService(this.dbService));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('EngagementLifecycleService already started');
      return;
    }
    await this.subscriber.subscribe<OrderDeliveredEvent>(
      'order.delivered',
      this.makeHandler('order.delivered', this.onOrderDelivered.bind(this)),
    );
    this.isStarted = true;
    this.logger.info('EngagementLifecycleService started — listening for order.delivered');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.delivered');
    this.isStarted = false;
    this.logger.info('EngagementLifecycleService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    const { orderId, engagementId, tenantId, clientId, priority } = event.data;

    if (!engagementId) {
      // Order is not associated with an engagement — nothing to roll up.
      return;
    }

    const tenantConfig = await this.tenantConfigService.getConfig(clientId);
    if (!tenantConfig.autoCloseEngagementEnabled) {
      this.logger.info('Auto-close engagement disabled by tenant config — skipping', {
        engagementId,
        tenantId,
      });
      return;
    }

    this.logger.info('Checking engagement close condition after order delivery', {
      orderId,
      engagementId,
      tenantId,
    });

    // Load the engagement to inspect all child orders.
    const engagement = await this.loadEngagement(engagementId, tenantId);
    if (!engagement) {
      this.logger.error('EngagementLifecycleService: engagement not found', {
        engagementId,
        tenantId,
      });
      return;
    }

    // Already closed — idempotency guard.
    if (engagement.status === EngagementStatus.DELIVERED) {
      this.logger.info('Engagement already DELIVERED — skipping', { engagementId });
      return;
    }

    // Gather all vendorOrderIds across every loan/clientOrder in the engagement.
    const allOrderIds: string[] = (engagement.loans ?? []).flatMap(
      (loan: any) =>
        (loan.clientOrders ?? []).flatMap((co: any) => co.vendorOrderIds ?? []),
    );

    if (allOrderIds.length === 0) {
      this.logger.info('Engagement has no child orders — skipping auto-close', { engagementId });
      return;
    }

    // Load all child orders and check their statuses.
    const orderStatuses = await Promise.all(
      allOrderIds.map((oid) => this.loadOrderStatus(oid, tenantId)),
    );

    const allDelivered = orderStatuses.every((s) => s === 'DELIVERED');
    if (!allDelivered) {
      const remaining = orderStatuses.filter((s) => s !== 'DELIVERED').length;
      this.logger.info('Not all orders delivered — engagement remains open', {
        engagementId,
        remaining,
        total: allOrderIds.length,
      });
      return;
    }

    this.logger.info('All orders delivered — auto-closing engagement', {
      engagementId,
      orderCount: allOrderIds.length,
    });

    const previousStatus = engagement.status as string;

    // Step through valid transitions: IN_PROGRESS → QC → DELIVERED.
    try {
      if (engagement.status === EngagementStatus.IN_PROGRESS) {
        await this.engagementService.changeStatus(
          engagementId,
          tenantId,
          EngagementStatus.QC,
          'auto-lifecycle',
        );
      }

      await this.engagementService.changeStatus(
        engagementId,
        tenantId,
        EngagementStatus.DELIVERED,
        'auto-lifecycle',
      );
    } catch (err) {
      this.logger.error('Failed to auto-close engagement — status transition rejected', {
        engagementId,
        previousStatus,
        error: err,
      });
      return;
    }

    const changedEvent: EngagementStatusChangedEvent = {
      id: uuidv4(),
      type: 'engagement.status.changed',
      timestamp: new Date(),
      source: 'engagement-lifecycle-service',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        engagementId,
        tenantId,
        clientId,
        previousStatus,
        newStatus: EngagementStatus.DELIVERED,
        reason: 'all_orders_delivered',
        priority: priority ?? EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(changedEvent);
    this.logger.info('Engagement auto-closed and event published', { engagementId });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async loadEngagement(engagementId: string, tenantId: string): Promise<any | null> {
    try {
      const container = this.dbService.getEngagementsContainer();
      const response = await container.item(engagementId, tenantId).read();
      return response.resource ?? null;
    } catch (err) {
      this.logger.error('Failed to load engagement', { engagementId, tenantId, error: err });
      return null;
    }
  }

  /** Returns the order status string or null if the order cannot be loaded. */
  private async loadOrderStatus(
    orderId: string,
    tenantId: string,
  ): Promise<string | null> {
    try {
      const result = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (result as any)?.data ?? result;
      return order?.status ?? null;
    } catch {
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
