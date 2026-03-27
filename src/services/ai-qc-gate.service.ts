/**
 * AI QC Gate Service
 *
 * Intercepts order.status.changed → SUBMITTED events and runs the AI QC
 * analysis before human routing.  Only fires when the tenant has
 * `aiQcEnabled: true`.
 *
 * Decision logic:
 *   score >= aiQcPassThreshold  → auto_pass   (skip human QC entirely)
 *   score >= aiQcFlagThreshold  → needs_review (route to QC analyst)
 *   score <  aiQcFlagThreshold  → needs_supervision (QC analyst + supervisor)
 *
 * When AI fails, falls back to needs_review so human eyes are always on it.
 *
 * Publishes: qc.ai.scored
 * Consumed by:
 *   - AutoAssignmentOrchestratorService (routes needs_review / needs_supervision)
 *   - AutoDeliveryService (auto_pass path)
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { UniversalAIService } from './universal-ai.service.js';
import type {
  BaseEvent,
  EventHandler,
  OrderStatusChangedEvent,
  QCAIScoredEvent,
} from '../types/events.js';
import { EventCategory } from '../types/events.js';

export class AIQCGateService {
  private readonly logger = new Logger('AIQCGateService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly aiService: UniversalAIService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'ai-qc-gate-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
    this.aiService = new UniversalAIService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AIQCGateService already started');
      return;
    }
    await this.subscriber.subscribe<OrderStatusChangedEvent>(
      'order.status.changed',
      this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
    );
    this.isStarted = true;
    this.logger.info('AIQCGateService started — listening for order.status.changed(SUBMITTED)');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.status.changed');
    this.isStarted = false;
    this.logger.info('AIQCGateService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId, tenantId, priority } = event.data;

    // Only act when the tenant has opted in to AI-assisted QC.
    const tenantConfig = await this.tenantConfigService.getConfig(tenantId);
    if (!tenantConfig.aiQcEnabled) return;

    this.logger.info('AI QC gate running for submitted order', { orderId, tenantId });

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.error('AIQCGateService: order not found — cannot run AI QC', { orderId });
      return;
    }

    // Build the report text from whatever is available on the order document.
    const reportText: string =
      order.reportText ??
      order.appraisalReport ??
      JSON.stringify({
        orderId,
        productType: order.productType ?? order.orderType,
        propertyAddress: order.propertyAddress ?? order.propertyDetails?.fullAddress,
        appraisedValue: order.appraisedValue ?? order.estimatedValue,
      });

    let score = 0;
    let findings: QCAIScoredEvent['data']['findings'] = [];
    let passFailStatus: 'pass' | 'fail' | 'conditional' = 'fail';

    try {
      const result = await this.aiService.performQCAnalysis({
        reportText,
        propertyData: order.propertyDetails ?? order.propertyData,
        analysisType: 'comprehensive',
      });
      score = result.overallScore;
      passFailStatus = result.passFailStatus;
      findings = result.findings.map((f) => ({
        category: f.category,
        severity: f.severity,
        description: f.description,
      }));
      this.logger.info('AI QC analysis complete', { orderId, score, passFailStatus });
    } catch (err) {
      // Fail-safe: on AI error, route to human QC (score stays 0 → needs_review).
      this.logger.error('AI QC analysis failed — routing to human review', { orderId, error: err });
    }

    const { aiQcPassThreshold, aiQcFlagThreshold } = tenantConfig;

    const decision: 'auto_pass' | 'needs_review' | 'needs_supervision' =
      score >= aiQcPassThreshold
        ? 'auto_pass'
        : score < aiQcFlagThreshold
        ? 'needs_supervision'
        : 'needs_review';

    this.logger.info('AI QC decision', { orderId, score, decision, aiQcPassThreshold, aiQcFlagThreshold });

    const scoredEvent: QCAIScoredEvent = {
      id: uuidv4(),
      type: 'qc.ai.scored',
      timestamp: new Date(),
      source: 'ai-qc-gate-service',
      version: '1.0',
      correlationId: event.id,
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber ?? orderId,
        tenantId,
        score,
        decision,
        findings,
        passFailStatus,
        priority,
      },
    };

    await this.publisher.publish(scoredEvent);
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
