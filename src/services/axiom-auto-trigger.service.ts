/**
 * Axiom Auto-Trigger Service
 *
 * Subscribes to order.status.changed(SUBMITTED) and, when the tenant's
 * axiomAutoTrigger config flag is true, submits the order to the Axiom
 * evaluation pipeline (if it hasn't already been submitted by the order
 * controller's inline path).
 *
 * The Axiom webhook controller publishes axiom.evaluation.completed once
 * Axiom posts its result.  The orchestrator's onAxiomEvaluationCompleted
 * handler then routes the order to the QC review queue.
 *
 * Idempotency guard: if order.axiomStatus is already 'submitted' or
 * 'processing', this service skips submission.
 *
 * Service Bus subscription: 'axiom-auto-trigger-service'
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { AxiomService } from './axiom.service.js';
import { DocumentService } from './document.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import type {
  BaseEvent,
  EventHandler,
  OrderStatusChangedEvent,
  AxiomEvaluationSubmittedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

/** Minimal fields the service reads from an AppraisalOrder document. */
interface OrderSnapshot {
  id: string;
  tenantId?: string;
  clientId?: string;
  orderNumber?: string;
  axiomStatus?: string;
  axiomPipelineJobId?: string;
  productType?: string;
  propertyAddress?: unknown;
  [key: string]: unknown;
}

export class AxiomAutoTriggerService {
  private readonly logger = new Logger('AxiomAutoTriggerService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly axiomService: AxiomService;
  private readonly documentService: DocumentService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'axiom-auto-trigger-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
    this.axiomService = new AxiomService(this.dbService);
    this.documentService = new DocumentService(this.dbService, new BlobStorageService());
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AxiomAutoTriggerService already started');
      return;
    }

    await this.subscriber.subscribe<OrderStatusChangedEvent>(
      'order.status.changed',
      this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
    );

    this.isStarted = true;
    this.logger.info('AxiomAutoTriggerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.status.changed').catch(() => {});
    this.isStarted = false;
    this.logger.info('AxiomAutoTriggerService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId, tenantId } = event.data;

    const config = await this.tenantConfigService.getConfig(tenantId);
    if (!config.axiomAutoTrigger) {
      return; // tenant hasn't enabled auto-trigger
    }

    // Load the order to build fields
    const orderResult = await this.dbService.findOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      this.logger.warn('AxiomAutoTrigger: order not found', { orderId });
      return;
    }
    const order = orderResult.data as unknown as OrderSnapshot;

    // Idempotency: skip if already submitted
    if (order.axiomStatus === 'submitted' || order.axiomStatus === 'processing' || order.axiomPipelineJobId) {
      this.logger.info('AxiomAutoTrigger: Axiom already submitted — skipping', { orderId });
      return;
    }

    const resolvedTenantId = order.tenantId ?? tenantId;
    const clientId = order.clientId;
    if (!clientId) {
      this.logger.error('AxiomAutoTrigger: order has no clientId', { orderId });
      return;
    }

    // Build fields from order data
    const fields = this.buildOrderFields(order);

    // Build documents list
    const docResult = await this.documentService.listDocuments(resolvedTenantId, { orderId });
    const appraisalDocs = docResult.success && docResult.data
      ? docResult.data
          .filter((d) => d.category === 'appraisal-report')
          .map((d) => ({ documentName: d.name, documentReference: d.blobUrl ?? '' }))
      : [];

    const result = await this.axiomService.submitOrderEvaluation(
      orderId,
      fields,
      appraisalDocs,
      resolvedTenantId,
      clientId,
    );

    if (!result) {
      this.logger.warn('AxiomAutoTrigger: submitOrderEvaluation returned null', { orderId });
      return;
    }

    const { pipelineJobId, evaluationId } = result;

    // Stamp axiomStatus on order so the webhook/orchestrator can correlate
    await this.dbService.updateOrder(orderId, {
      axiomStatus: 'submitted' as any,
      axiomPipelineJobId: pipelineJobId,
      axiomEvaluationId: evaluationId,
    }).catch((err) =>
      this.logger.warn('AxiomAutoTrigger: failed to stamp axiomStatus on order', {
        orderId,
        error: (err as Error).message,
      }),
    );

    // Publish submitted event
    const submittedEvent: AxiomEvaluationSubmittedEvent = {
      id: uuidv4(),
      type: 'axiom.evaluation.submitted',
      timestamp: new Date(),
      source: 'axiom-auto-trigger-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber ?? orderId,
        tenantId: resolvedTenantId,
        evaluationId,
        pipelineJobId,
        priority: EventPriority.NORMAL,
      },
    };
    await this.publisher.publish(submittedEvent).catch((err) =>
      this.logger.warn('AxiomAutoTrigger: failed to publish axiom.evaluation.submitted', {
        error: (err as Error).message,
      }),
    );

    this.logger.info('Axiom auto-trigger: evaluation submitted', {
      orderId,
      pipelineJobId,
      evaluationId,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildOrderFields(order: OrderSnapshot): Array<{ fieldName: string; fieldType: string; value: unknown }> {
    const address = order.propertyAddress as Record<string, unknown> | undefined;
    const entries: Array<[string, string, unknown]> = [
      ['orderId',         'string',  order.id],
      ['productType',     'string',  order.productType ?? ''],
      ['propertyAddress', 'string',  address
        ? `${address['streetAddress'] ?? ''} ${address['city'] ?? ''} ${address['state'] ?? ''} ${address['zipCode'] ?? ''}`.trim()
        : ''],
      ['orderValue',      'number',  order['orderFee'] ?? order['orderValue'] ?? 0],
      ['propertyType',    'string',  order['propertyType'] ?? ''],
      ['loanAmount',      'number',  order['loanAmount'] ?? 0],
    ];
    return entries
      .filter(([, , value]) => value !== '' && value !== 0 && value != null)
      .map(([fieldName, fieldType, value]) => ({ fieldName, fieldType, value }));
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
