import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { BlobStorageService } from './blob-storage.service.js';
import { AxiomService } from './axiom.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type {
  BaseEvent,
  BulkIngestionExtractionCompletedEvent,
  BulkIngestionOrdersCreatedEvent,
  EventHandler,
} from '../types/events.js';
import type {
  BulkIngestionCanonicalRecord,
  BulkIngestionJob,
  BulkIngestionItem,
} from '../types/bulk-ingestion.types.js';
import { ANALYSIS_TYPE_TO_AXIOM_PROGRAM } from '../types/bulk-portfolio.types.js';

const BULK_INGESTION_AXIOM_CORRELATION_PREFIX = 'bulk-ingestion';

export class BulkIngestionExtractionWorkerService {
  private readonly logger = new Logger('BulkIngestionExtractionWorkerService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly blobStorageService: BlobStorageService;
  private readonly axiomService: AxiomService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.blobStorageService = new BlobStorageService();
    this.axiomService = new AxiomService(this.dbService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-extraction-worker-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionExtractionWorkerService already started');
      return;
    }

    // P2-AX-01: Refuse to process bulk extraction in production without a real Axiom endpoint.
    // In dev/test (NODE_ENV !== 'production') mock mode is tolerated but logged loudly.
    if (!process.env.AXIOM_API_BASE_URL && process.env.NODE_ENV === 'production') {
      throw new Error(
        'BulkIngestionExtractionWorkerService cannot start in production without AXIOM_API_BASE_URL. ' +
        'Set AXIOM_API_BASE_URL (and optionally AXIOM_API_KEY) to enable real Axiom extraction.',
      );
    }

    if (!process.env.AXIOM_API_BASE_URL) {
      this.logger.warn(
        'AXIOM_API_BASE_URL is not configured — bulk extraction will use Axiom mock mode. ' +
        'This is only acceptable for local development. Set AXIOM_API_BASE_URL before deploying.',
      );
    }

    await this.subscriber.subscribe<BulkIngestionOrdersCreatedEvent>(
      'bulk.ingestion.orders.created',
      this.makeHandler('bulk.ingestion.orders.created', this.onBulkIngestionOrdersCreated.bind(this)),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionExtractionWorkerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.orders.created').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionExtractionWorkerService stopped');
  }

  private makeHandler<T extends BaseEvent>(eventType: string, fn: (event: T) => Promise<void>): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (error) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.id,
          });
          throw error;
        }
      },
    };
  }

  private async onBulkIngestionOrdersCreated(event: BulkIngestionOrdersCreatedEvent): Promise<void> {
    const { jobId, tenantId, clientId } = event.data;
    if (!jobId || !tenantId || !clientId) {
      throw new Error(
        `Invalid bulk.ingestion.orders.created payload: jobId='${jobId}', tenantId='${tenantId}', clientId='${clientId}'`,
      );
    }

    const containerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!containerName) {
      throw new Error(
        'STORAGE_CONTAINER_DOCUMENTS is required for bulk ingestion extraction worker',
      );
    }

    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found for tenant '${tenantId}'`);
    }

    const canonicalRecords = await this.getCanonicalRecords(jobId);
    if (canonicalRecords.length === 0) {
      this.logger.info('No canonical records found for extraction dispatch', { jobId, tenantId });
      return;
    }

    const itemsById = new Map(job.items.map((item) => [item.id, item]));
    const now = new Date().toISOString();
    let submitted = 0;
    let skipped = 0;
    let immediateFailures = 0;

    for (const record of canonicalRecords) {
      const item = itemsById.get(record.itemId);
      if (!item) {
        continue;
      }

      const existingPipelineJobId = this.getString(item.canonicalRecord?.['axiomPipelineJobId']);
      const existingStatus = this.getString(item.canonicalRecord?.['axiomExtractionStatus']);
      if (existingPipelineJobId || existingStatus === 'COMPLETED') {
        skipped++;
        continue;
      }

      const orderId = this.getString(item.canonicalRecord?.['orderId']);
      if (!orderId) {
        immediateFailures++;
        await this.publishExtractionCompleted({
          job,
          item,
          correlationId: this.buildCorrelationId(job.id, item.id),
          status: 'failed',
          completedAt: now,
          error: `Order creation is required before extraction. Missing orderId for item '${item.id}'`,
        });
        continue;
      }

      if (!record.documentBlobName) {
        immediateFailures++;
        await this.publishExtractionCompleted({
          job,
          item,
          correlationId: this.buildCorrelationId(job.id, item.id),
          status: 'failed',
          completedAt: now,
          error: `Canonical record '${record.id}' is missing documentBlobName`,
        });
        continue;
      }

      const correlationId = this.buildCorrelationId(job.id, item.id);
      const fileName = record.documentBlobName.split('/').pop() ?? record.documentBlobName;
      const { programId, programVersion } = ANALYSIS_TYPE_TO_AXIOM_PROGRAM[job.analysisType];

      const blobSasUrl = await this.blobStorageService.generateReadSasUrl(containerName, record.documentBlobName);
      const submitResult = await this.axiomService.submitDocumentForSchemaExtraction({
        documentId: correlationId,
        blobSasUrl,
        fileName,
        documentType: 'APPRAISAL_REPORT',
        tenantId: job.tenantId,
        clientId: job.clientId,
        subClientId: job.subClientId ?? '',
        programId,
        programVersion,
      });

      if (!submitResult) {
        immediateFailures++;
        await this.publishExtractionCompleted({
          job,
          item,
          correlationId,
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: `Axiom extraction submission failed for item '${item.id}'`,
        });
        continue;
      }

      item.canonicalRecord = {
        ...(item.canonicalRecord ?? {}),
        axiomCorrelationId: correlationId,
        axiomPipelineJobId: submitResult.pipelineJobId,
        axiomExtractionStatus: 'AXIOM_PENDING',
        axiomSubmittedAt: new Date().toISOString(),
      };
      item.updatedAt = new Date().toISOString();
      submitted++;

      // Open an SSE stream to Axiom for this item's pipeline execution.
      // The stream fires fetchAndStorePipelineResults when pipeline_final arrives,
      // writing axiomExtractionResult / axiomCriteriaResult to aiInsights while
      // Axiom's results window is still open.  The subsequent DOCUMENT webhook
      // will attempt the same call and receive a 409 (already consumed) — that
      // is harmless since the data has already been persisted via this path.
      this.axiomService.watchOrderPipelineStream(submitResult.pipelineJobId, orderId);

      // Stamp axiomPipelineJobId on the order document so the SSE proxy endpoint
      // (GET /api/axiom/evaluations/order/:orderId/stream) can look it up.
      await this.dbService.updateOrder(orderId, {
        axiomPipelineJobId: submitResult.pipelineJobId,
        axiomStatus: 'submitted' as any,
      }).catch((err: Error) =>
        this.logger.warn('ExtractionWorker: failed to stamp axiomPipelineJobId on order', {
          orderId,
          error: err.message,
        }),
      );
    }

    const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', {
      ...job,
      items: Array.from(itemsById.values()),
    });
    if (!saveResult.success || !saveResult.data) {
      throw new Error(`Failed to persist extraction dispatch updates for job '${jobId}'`);
    }

    this.logger.info('Bulk ingestion extraction dispatch complete', {
      jobId,
      tenantId,
      totalCanonicalRecords: canonicalRecords.length,
      submitted,
      skipped,
      immediateFailures,
    });
  }

  private async getJob(jobId: string, tenantId: string): Promise<BulkIngestionJob | null> {
    const query =
      'SELECT * FROM c WHERE c.id = @id AND c.type = @type AND c.tenantId = @tenantId';
    const result = await this.dbService.queryItems<BulkIngestionJob>('bulk-portfolio-jobs', query, [
      { name: '@id', value: jobId },
      { name: '@type', value: 'bulk-ingestion-job' },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private async getCanonicalRecords(jobId: string): Promise<BulkIngestionCanonicalRecord[]> {
    const query =
      'SELECT * FROM c WHERE c.type = @type AND c.jobId = @jobId';
    const result = await this.dbService.queryItems<BulkIngestionCanonicalRecord>('bulk-portfolio-jobs', query, [
      { name: '@type', value: 'bulk-ingestion-canonical-record' },
      { name: '@jobId', value: jobId },
    ]);

    return result.success && result.data ? result.data : [];
  }

  private buildCorrelationId(jobId: string, itemId: string): string {
    // BullMQ (used internally by Axiom) rejects job custom IDs that contain colons.
    // Replace all colons (from the :: separators and the :N item suffix) with hyphens.
    const raw = `${BULK_INGESTION_AXIOM_CORRELATION_PREFIX}::${jobId}::${itemId}`;
    return raw.replace(/:/g, '-');
  }

  private getString(input: unknown): string | undefined {
    return typeof input === 'string' && input.trim().length > 0 ? input : undefined;
  }

  private async publishExtractionCompleted(params: {
    job: BulkIngestionJob;
    item: BulkIngestionItem;
    correlationId: string;
    status: 'completed' | 'failed';
    completedAt: string;
    error?: string;
    pipelineJobId?: string;
    result?: Record<string, unknown>;
  }): Promise<void> {
    const event: BulkIngestionExtractionCompletedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.extraction.completed',
      timestamp: new Date(),
      source: 'bulk-ingestion-extraction-worker-service',
      version: '1.0',
      correlationId: params.correlationId,
      category: EventCategory.DOCUMENT,
      data: {
        jobId: params.job.id,
        tenantId: params.job.tenantId,
        clientId: params.job.clientId,
        itemId: params.item.id,
        rowIndex: params.item.rowIndex,
        correlationId: params.correlationId,
        ...(params.pipelineJobId ? { pipelineJobId: params.pipelineJobId } : {}),
        status: params.status,
        completedAt: params.completedAt,
        ...(params.error ? { error: params.error } : {}),
        ...(params.result ? { result: params.result } : {}),
        priority: params.status === 'failed' ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(event);
  }
}
