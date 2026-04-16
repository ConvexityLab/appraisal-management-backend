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
import { lookupProductDefinition } from '../types/product-catalog.js';

/** Minimal fields the service reads from an AppraisalOrder document. */
interface OrderSnapshot {
  id: string;
  tenantId?: string;
  clientId?: string;
  subClientId?: string;
  orderNumber?: string;
  axiomStatus?: string;
  axiomPipelineJobId?: string;
  productType?: string;
  propertyAddress?: unknown;
  [key: string]: unknown;
}

/**
 * Returns the primary document category for the given productType, derived
 * from PRODUCT_CATALOG.
 *
 * Accepts both SCREAMING_SNAKE ('FULL_APPRAISAL') and legacy snake_case
 * ('full_appraisal') values — normalises via .toUpperCase() before lookup.
 *
 * Returns null when productType is absent or unknown; the caller handles
 * those as hard errors (stamps axiomStatus and aborts) so there is no
 * silent fallback to a wrong category.
 */
function primaryDocumentCategory(productType: string | undefined): string | null {
  if (!productType) return null;
  const def = lookupProductDefinition(productType);
  return def?.primaryDocumentCategory ?? null;
}

export class AxiomAutoTriggerService {
  private readonly logger = new Logger('AxiomAutoTriggerService');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly axiomService: AxiomService;
  private readonly documentService: DocumentService;
  private readonly blobService: BlobStorageService;
  private isStarted = false;
  /** P3-A: exposed for health checks */
  public isRunning = false;

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
    this.blobService = new BlobStorageService();
    this.documentService = new DocumentService(this.dbService, this.blobService);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * P3-A: Start with exponential backoff retry (max 5 attempts, 30 s apart).
   * Sets isRunning=true once the subscription is live so health checks can surface failures.
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AxiomAutoTriggerService already started');
      return;
    }

    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 30_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.subscriber.subscribe<OrderStatusChangedEvent>(
          'order.status.changed',
          this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
        );
        this.isStarted = true;
        this.isRunning = true;
        this.logger.info('AxiomAutoTriggerService started');
        return;
      } catch (err) {
        const isLastAttempt = attempt === MAX_ATTEMPTS;
        if (isLastAttempt) {
          this.isRunning = false;
          this.logger.error(
            `AxiomAutoTriggerService failed to start after ${MAX_ATTEMPTS} attempts — auto-trigger disabled`,
            { error: (err as Error).message },
          );
          return; // Don't throw — keep the overall server alive
        }
        this.logger.warn(
          `AxiomAutoTriggerService start attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${RETRY_DELAY_MS / 1000}s`,
          { error: (err as Error).message },
        );
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.status.changed').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('AxiomAutoTriggerService stopped');
  }

  // ── Public trigger API (used by missed-trigger recovery job) ──────────────

  /**
   * Programmatically trigger Axiom evaluation for a specific order.
   * Identical logic to the Service Bus–driven path; idempotency is enforced
   * inside `submitOrderEvaluation`.
   *
   * Throws on submit failure so the caller (recovery job) can log and
   * continue with other candidates.
   */
  async triggerForOrder(orderId: string): Promise<void> {
    // Build a synthetic event and reuse the existing handler.
    const orderResult = await this.dbService.findOrderById(orderId);
    if (!orderResult.success || !orderResult.data) {
      throw new Error(`AxiomAutoTrigger.triggerForOrder: order not found — orderId=${orderId}`);
    }
    const order = orderResult.data as unknown as { tenantId?: string };
    const tenantId = order.tenantId;
    if (!tenantId) {
      throw new Error(`AxiomAutoTrigger.triggerForOrder: order has no tenantId — orderId=${orderId}`);
    }
    // Re-use the handler directly (avoids duplicating the submit logic).
    await this.onOrderStatusChanged({
      id: `recovery-${orderId}`,
      type: 'order.status.changed',
      timestamp: new Date(),
      source: 'axiom-missed-trigger-job',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId,
        tenantId,
        newStatus: 'SUBMITTED',
        previousStatus: 'SUBMITTED',
        changedBy: 'axiom-missed-trigger-job',
        priority: EventPriority.NORMAL,
        orderNumber: (orderResult.data as any).orderNumber ?? orderId,
      },
    } as unknown as OrderStatusChangedEvent);
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId, tenantId } = event.data;

    // Load the order to build fields and resolve clientId
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

    const config = await this.tenantConfigService.getConfig(clientId);
    if (!config.axiomAutoTrigger) {
      this.logger.info('AxiomAutoTrigger: axiomAutoTrigger disabled for client — skipping', { clientId, orderId });
      return;
    }

    // Build fields from order data
    const fields = this.buildOrderFields(order);

    // P3-B: Guard against empty document list — skip rather than submit an empty evaluation.
    // The required document category depends on product type: BPO orders produce bpo-report
    // documents; all other product types (appraisals, DVR, AVM, reviews, ROV, etc.) use
    // appraisal-report as the primary deliverable.
    const docResult = await this.documentService.listDocuments(resolvedTenantId, { orderId });
    const docContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    const requiredCategory = primaryDocumentCategory(order.productType);

    // If the productType is absent or not in PRODUCT_CATALOG, stamp a distinct
    // status instead of silently falling back to the wrong document category.
    if (requiredCategory === null) {
      this.logger.error(
        `AxiomAutoTrigger: productType '${order.productType ?? 'undefined'}' is not in PRODUCT_CATALOG — cannot determine document category. Add it to src/types/product-catalog.ts.`,
        { orderId, productType: order.productType },
      );
      await this.dbService.updateOrder(orderId, { axiomStatus: 'skipped-unknown-product-type' as any }).catch(() => undefined);
      return;
    }

    const rawPrimaryDocs = docResult.success && docResult.data
      ? docResult.data.filter((d) => d.category === requiredCategory && d.blobName)
      : [];

    // Generate SAS URLs so Axiom (external) can download the blobs
    const primaryDocs: Array<{ documentName: string; documentReference: string }> = [];
    if (docContainerName) {
      for (const d of rawPrimaryDocs) {
        try {
          const sasUrl = await this.blobService.generateReadSasUrl(docContainerName, d.blobName);
          primaryDocs.push({ documentName: d.name, documentReference: sasUrl });
        } catch (err) {
          this.logger.warn('AxiomAutoTrigger: failed to generate SAS URL for document', {
            orderId, documentId: d.id, error: (err as Error).message,
          });
        }
      }
    } else {
      this.logger.error('AxiomAutoTrigger: STORAGE_CONTAINER_DOCUMENTS not configured — cannot generate SAS URLs');
    }

    if (primaryDocs.length === 0) {
      // If already marked skipped, return silently — avoids re-publishing axiom.evaluation.skipped
      // on every missed-trigger recovery pass (every 15 min × 48 h = 192 duplicate events per order).
      if (order.axiomStatus === 'skipped-no-documents') {
        this.logger.debug(
          'AxiomAutoTrigger: already skipped due to no documents — still no docs, staying skipped',
          { orderId },
        );
        return;
      }
      this.logger.warn(
        `AxiomAutoTrigger: order has no '${requiredCategory}' documents for productType='${order.productType ?? 'unknown'}' — skipping Axiom submission`,
        { orderId, requiredCategory, productType: order.productType },
      );
      await this.dbService.updateOrder(orderId, { axiomStatus: 'skipped-no-documents' as any }).catch(() => undefined);
      await this.publisher.publish({
        id: uuidv4(),
        type: 'axiom.evaluation.skipped',
        timestamp: new Date(),
        source: 'axiom-auto-trigger-service',
        version: '1.0',
        category: EventCategory.QC,
        data: { orderId, orderNumber: order.orderNumber ?? orderId, tenantId: resolvedTenantId, reason: 'no-documents', priority: EventPriority.NORMAL },
      } as any).catch((err: Error) => this.logger.warn('AxiomAutoTrigger: failed to publish axiom.evaluation.skipped', { error: err.message }));
      return;
    }

    // P3-C: Throw on submit failure so the Service Bus SDK abandons the message and retries.
    // Stamp submit-failed on the order and publish an event before re-throwing.
    let result: { pipelineJobId: string; evaluationId: string } | null;
    try {
      const subClientId = order.subClientId ?? config.axiomSubClientId ?? '';
      result = await this.axiomService.submitOrderEvaluation(
        orderId,
        fields,
        primaryDocs,
        resolvedTenantId,
        clientId,
        subClientId,
      );
    } catch (submitErr) {
      this.logger.error('AxiomAutoTrigger: submitOrderEvaluation threw an exception', {
        orderId,
        error: (submitErr as Error).message,
      });
      await this.dbService.updateOrder(orderId, { axiomStatus: 'submit-failed' as any }).catch(() => undefined);
      // Only publish axiom.evaluation.failed on the FIRST failure.
      // On SB retries the order already has axiomStatus='submit-failed', so the downstream
      // handlers (email, routing) have already been triggered — re-publishing would spam them.
      if (order.axiomStatus !== 'submit-failed') {
        await this.publisher.publish({
          id: uuidv4(),
          type: 'axiom.evaluation.failed',
          timestamp: new Date(),
          source: 'axiom-auto-trigger-service',
          version: '1.0',
          category: EventCategory.QC,
          data: { orderId, orderNumber: order.orderNumber ?? orderId, tenantId: resolvedTenantId, reason: 'submit-exception', priority: EventPriority.NORMAL },
        } as any).catch(() => undefined);
      }
      throw submitErr; // re-throw → message is abandoned by the Service Bus SDK → retry
    }

    if (!result) {
      this.logger.error('AxiomAutoTrigger: submitOrderEvaluation returned null — stamping submit-failed', { orderId });
      await this.dbService.updateOrder(orderId, { axiomStatus: 'submit-failed' as any }).catch(() => undefined);
      // Only publish axiom.evaluation.failed on the FIRST failure (same SB-retry-spam guard as above).
      if (order.axiomStatus !== 'submit-failed') {
        await this.publisher.publish({
          id: uuidv4(),
          type: 'axiom.evaluation.failed',
          timestamp: new Date(),
          source: 'axiom-auto-trigger-service',
          version: '1.0',
          category: EventCategory.QC,
          data: { orderId, orderNumber: order.orderNumber ?? orderId, tenantId: resolvedTenantId, reason: 'submit-null', priority: EventPriority.NORMAL },
        } as any).catch(() => undefined);
      }
      throw new Error(`AxiomAutoTrigger: submitOrderEvaluation returned null for orderId=${orderId}`);
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
        clientId,
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
          // Re-throw so the Service Bus subscriber can propagate the failure
          // to the SDK, which will abandon the message and allow retry /
          // dead-letter after max-delivery-count is exceeded (P3-C).
          throw err;
        }
      },
    };
  }
}
