/**
 * Vendor Performance Updater Service
 *
 * Subscribes to qc.completed events where result='passed' and triggers a
 * full recalculation of the vendor's performance metrics via
 * VendorPerformanceCalculatorService, then stamps the fresh overall score
 * onto the vendor document in Cosmos.
 *
 * Also stamps the calculated score onto the order for matching-engine
 * reference on the next assignment.
 *
 * Service Bus subscription: 'vendor-performance-updater-service'
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { VendorPerformanceCalculatorService } from './vendor-performance-calculator.service.js';
import type {
  BaseEvent,
  EventHandler,
  QCCompletedEvent,
  VendorPerformanceUpdatedEvent,
  VendorScorecardCreatedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export class VendorPerformanceUpdaterService {
  private readonly logger = new Logger('VendorPerformanceUpdaterService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly performanceCalc: VendorPerformanceCalculatorService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'vendor-performance-updater-service',
    );
    this.performanceCalc = new VendorPerformanceCalculatorService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('VendorPerformanceUpdaterService already started');
      return;
    }

    await this.subscriber.subscribe<QCCompletedEvent>(
      'qc.completed',
      this.makeHandler('qc.completed', this.onQCCompleted.bind(this)),
    );

    // Phase A — recompute vendor metrics whenever a reviewer scorecard lands
    // (initial QC scoring or a post-release re-score). Without this the
    // trailing-25 blend on VendorPerformanceMetrics goes stale between
    // scorecards and the matcher sees outdated overallScore until some
    // unrelated event re-triggers calculateVendorMetrics.
    await this.subscriber.subscribe<VendorScorecardCreatedEvent>(
      'vendor-scorecard.created',
      this.makeHandler('vendor-scorecard.created', this.onScorecardCreated.bind(this)),
    );

    this.isStarted = true;
    this.logger.info('VendorPerformanceUpdaterService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('qc.completed').catch(() => {});
    await this.subscriber.unsubscribe('vendor-scorecard.created').catch(() => {});
    this.isStarted = false;
    this.logger.info('VendorPerformanceUpdaterService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onQCCompleted(event: QCCompletedEvent): Promise<void> {
    if (event.data.result !== 'passed') {
      return; // Only update score on QC pass
    }

    const { orderId } = event.data;

    // Load order to get vendorId and tenantId
    const orderResult = await this.dbService.findOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      this.logger.warn('VendorPerformanceUpdater: order not found', { orderId });
      return;
    }

    const order = orderResult.data as unknown as Record<string, unknown>;
    const vendorId = order['vendorId'] as string | undefined;
    const tenantId = order['tenantId'] as string | undefined;

    if (!vendorId || !tenantId) {
      this.logger.warn('VendorPerformanceUpdater: order missing vendorId or tenantId', { orderId });
      return;
    }

    // Fetch previous score from vendor document before recalculating
    const vendorContainer = this.dbService.getContainer('vendors');
    const vendorLookup = await vendorContainer.items.query<Record<string, unknown>>({
      query: `SELECT c.overallScore FROM c WHERE c.id = @id AND c.tenantId = @tid`,
      parameters: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: '@id', value: vendorId } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: '@tid', value: tenantId } as any,
      ],
    }).fetchAll();
    const previousScore = (vendorLookup.resources[0]?.['overallScore'] as number | undefined) ?? 0;

    // Recalculate full performance metrics
    let metrics: Awaited<ReturnType<VendorPerformanceCalculatorService['calculateVendorMetrics']>>;
    try {
      metrics = await this.performanceCalc.calculateVendorMetrics(vendorId, tenantId);
    } catch (err) {
      this.logger.error('VendorPerformanceUpdater: calculateVendorMetrics failed', {
        vendorId,
        error: (err as Error).message,
      });
      return;
    }

    const newScore = metrics.overallScore;
    // previousScore fetched above from vendor document before recalculation

    // Stamp updated score onto vendor document
    await this.stampVendorScore(vendorId, tenantId, newScore, metrics.tier, metrics.totalOrdersCompleted).catch(
      (err) =>
        this.logger.warn('VendorPerformanceUpdater: failed to stamp vendor score', {
          vendorId,
          error: (err as Error).message,
        }),
    );

    // Publish update event
    const updateEvent: VendorPerformanceUpdatedEvent = {
      id: uuidv4(),
      type: 'vendor.performance.updated',
      timestamp: new Date(),
      source: 'vendor-performance-updater-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        vendorId,
        vendorName: (order['vendorName'] as string | undefined) ?? vendorId,
        previousScore,
        newScore,
        ordersCompleted: metrics.totalOrdersCompleted ?? 0,
        averageDeliveryTime: metrics.avgTurnaroundTime ?? 0,
        priority: EventPriority.LOW,
      },
    };
    await this.publisher.publish(updateEvent).catch((err) =>
      this.logger.warn('VendorPerformanceUpdater: failed to publish vendor.performance.updated', {
        error: (err as Error).message,
      }),
    );

    this.logger.info('Vendor performance updated after QC pass', {
      vendorId,
      previousScore,
      newScore,
      orderId,
    });
  }

  /**
   * Handler for vendor-scorecard.created. The scorecard service stamps the
   * vendorId on the event when the order has an assignedVendorId; load the
   * order anyway for tenantId + name (events carry minimal context).
   */
  private async onScorecardCreated(event: VendorScorecardCreatedEvent): Promise<void> {
    const { orderId, scorecardId } = event.data;
    const orderResult = await this.dbService.findOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      this.logger.warn('VendorPerformanceUpdater: order not found for scorecard event', {
        orderId,
        scorecardId,
      });
      return;
    }
    const order = orderResult.data as unknown as Record<string, unknown>;
    const vendorId =
      event.data.vendorId ??
      (order['assignedVendorId'] as string | undefined) ??
      (order['vendorId'] as string | undefined);
    const tenantId = order['tenantId'] as string | undefined;
    if (!vendorId || !tenantId) {
      this.logger.warn('VendorPerformanceUpdater: scorecard event missing vendorId or tenantId', {
        orderId,
        vendorId,
        tenantId,
      });
      return;
    }
    await this.recomputeAndStamp(
      vendorId,
      tenantId,
      (order['vendorName'] as string | undefined) ?? (order['assignedVendorName'] as string | undefined),
      `scorecard ${scorecardId} on order ${orderId}`,
    );
  }

  /**
   * Shared recompute path. Loads previous score, runs the calculator, stamps
   * the new score onto the vendor doc, publishes vendor.performance.updated.
   * Used by both QC-completion and scorecard-created handlers so the two
   * paths can't diverge.
   */
  private async recomputeAndStamp(
    vendorId: string,
    tenantId: string,
    vendorName: string | undefined,
    trigger: string,
  ): Promise<void> {
    const vendorContainer = this.dbService.getContainer('vendors');
    const vendorLookup = await vendorContainer.items.query<Record<string, unknown>>({
      query: `SELECT c.overallScore FROM c WHERE c.id = @id AND c.tenantId = @tid`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parameters: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: '@id', value: vendorId } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: '@tid', value: tenantId } as any,
      ],
    }).fetchAll();
    const previousScore =
      (vendorLookup.resources[0]?.['overallScore'] as number | undefined) ?? 0;

    let metrics: Awaited<ReturnType<VendorPerformanceCalculatorService['calculateVendorMetrics']>>;
    try {
      metrics = await this.performanceCalc.calculateVendorMetrics(vendorId, tenantId);
    } catch (err) {
      this.logger.error('VendorPerformanceUpdater: recompute failed', {
        vendorId,
        trigger,
        error: (err as Error).message,
      });
      return;
    }

    await this.stampVendorScore(
      vendorId,
      tenantId,
      metrics.overallScore,
      metrics.tier,
      metrics.totalOrdersCompleted,
    ).catch((err) =>
      this.logger.warn('VendorPerformanceUpdater: failed to stamp vendor score', {
        vendorId,
        trigger,
        error: (err as Error).message,
      }),
    );

    const updateEvent: VendorPerformanceUpdatedEvent = {
      id: uuidv4(),
      type: 'vendor.performance.updated',
      timestamp: new Date(),
      source: 'vendor-performance-updater-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        vendorId,
        vendorName: vendorName ?? vendorId,
        previousScore,
        newScore: metrics.overallScore,
        ordersCompleted: metrics.totalOrdersCompleted ?? 0,
        averageDeliveryTime: metrics.avgTurnaroundTime ?? 0,
        priority: EventPriority.LOW,
      },
    };
    await this.publisher.publish(updateEvent).catch((err) =>
      this.logger.warn('VendorPerformanceUpdater: failed to publish vendor.performance.updated', {
        error: (err as Error).message,
      }),
    );

    this.logger.info('Vendor performance recomputed', {
      vendorId,
      previousScore,
      newScore: metrics.overallScore,
      trigger,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async stampVendorScore(
    vendorId: string,
    tenantId: string,
    score: number,
    tier: string,
    completedOrders: number,
  ): Promise<void> {
    const container = this.dbService.getContainer('vendors');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: vendorId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    if (resources.length === 0) {
      this.logger.warn('stampVendorScore: vendor document not found', { vendorId });
      return;
    }

    const vendor = resources[0] as Record<string, unknown>;
    vendor['overallScore'] = score;
    vendor['performanceTier'] = tier;
    vendor['completedOrderCount'] = completedOrders;
    vendor['scoreUpdatedAt'] = new Date().toISOString();

    await container.items.upsert(vendor);
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
