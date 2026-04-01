import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import type {
  BaseEvent,
  BulkIngestionCriteriaCompletedEvent,
  EventHandler,
} from '../types/events.js';
import type {
  BulkIngestionFailure,
  BulkIngestionJob,
} from '../types/bulk-ingestion.types.js';

export class BulkIngestionFinalizerService {
  private readonly logger = new Logger('BulkIngestionFinalizerService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-finalizer-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionFinalizerService already started');
      return;
    }

    await this.subscriber.subscribe<BulkIngestionCriteriaCompletedEvent>(
      'bulk.ingestion.criteria.completed',
      this.makeHandler(
        'bulk.ingestion.criteria.completed',
        this.onBulkIngestionCriteriaCompleted.bind(this),
      ),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionFinalizerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.criteria.completed').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionFinalizerService stopped');
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

  private async onBulkIngestionCriteriaCompleted(
    event: BulkIngestionCriteriaCompletedEvent,
  ): Promise<void> {
    const { jobId, tenantId, itemId, status, completedAt, reason } = event.data;

    if (!jobId || !tenantId || !itemId) {
      throw new Error(
        `Invalid bulk.ingestion.criteria.completed payload: jobId='${jobId}', tenantId='${tenantId}', itemId='${itemId}'`,
      );
    }

    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found for tenant '${tenantId}'`);
    }

    const itemIndex = job.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      this.logger.warn('Extraction completion item not found on job', { jobId, tenantId, itemId });
      return;
    }

    const item = { ...job.items[itemIndex]! };
    const currentStatus = this.getString(item.canonicalRecord?.['criteriaStatus']);
    if (currentStatus === 'COMPLETED' || currentStatus === 'FAILED') {
      this.logger.info('Skipping duplicate criteria terminal update', {
        jobId,
        itemId,
        currentStatus,
      });
      return;
    }

    if (status === 'completed') {
      item.status = 'COMPLETED';
      item.canonicalRecord = {
        ...(item.canonicalRecord ?? {}),
        criteriaStatus: 'COMPLETED',
        criteriaCompletedAt: completedAt,
      };
    } else {
      const failure: BulkIngestionFailure = {
        code: 'CRITERIA_FAILED',
        stage: 'criteria',
        message: reason ?? `Criteria stage failed for item '${item.id}'`,
        retryable: true,
        occurredAt: completedAt,
      };

      item.status = 'FAILED';
      item.failures = [...item.failures, failure];
      item.canonicalRecord = {
        ...(item.canonicalRecord ?? {}),
        criteriaStatus: 'FAILED',
        criteriaCompletedAt: completedAt,
      };
    }

    item.updatedAt = completedAt;

    const updatedItems = [...job.items];
    updatedItems[itemIndex] = item;

    const successItems = updatedItems.filter((candidate) => candidate.status === 'COMPLETED').length;
    const failedItems = updatedItems.filter((candidate) => candidate.status === 'FAILED').length;
    const pendingItems = updatedItems.length - successItems - failedItems;

    const updatedJob: BulkIngestionJob = {
      ...job,
      items: updatedItems,
      successItems,
      failedItems,
      pendingItems,
      status:
        pendingItems > 0
          ? 'PROCESSING'
          : failedItems === 0
            ? 'COMPLETED'
            : successItems > 0
              ? 'PARTIAL'
              : 'FAILED',
      ...(pendingItems === 0 ? { completedAt } : {}),
      ...(status === 'failed' && reason ? { lastError: reason } : {}),
    };

    const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', updatedJob);
    if (!saveResult.success || !saveResult.data) {
      throw new Error(`Failed to persist finalized bulk ingestion job '${jobId}'`);
    }

    this.logger.info('Bulk ingestion finalizer applied criteria terminal update', {
      jobId,
      tenantId,
      itemId,
      status,
      jobStatus: updatedJob.status,
      successItems: updatedJob.successItems,
      failedItems: updatedJob.failedItems,
      pendingItems: updatedJob.pendingItems,
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

  private getString(input: unknown): string | undefined {
    return typeof input === 'string' && input.trim().length > 0 ? input : undefined;
  }
}
