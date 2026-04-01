import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type {
  BaseEvent,
  BulkIngestionCriteriaCompletedEvent,
  BulkIngestionExtractionCompletedEvent,
  EventHandler,
} from '../types/events.js';

export class BulkIngestionCriteriaWorkerService {
  private readonly logger = new Logger('BulkIngestionCriteriaWorkerService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private isStarted = false;
  public isRunning = false;

  constructor() {
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-criteria-worker-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionCriteriaWorkerService already started');
      return;
    }

    await this.subscriber.subscribe<BulkIngestionExtractionCompletedEvent>(
      'bulk.ingestion.extraction.completed',
      this.makeHandler(
        'bulk.ingestion.extraction.completed',
        this.onBulkIngestionExtractionCompleted.bind(this),
      ),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionCriteriaWorkerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.extraction.completed').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionCriteriaWorkerService stopped');
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

  private async onBulkIngestionExtractionCompleted(
    event: BulkIngestionExtractionCompletedEvent,
  ): Promise<void> {
    const { jobId, tenantId, clientId, itemId, rowIndex, status, completedAt, error } = event.data;

    const criteriaEnabled = process.env.BULK_INGESTION_ENABLE_CRITERIA_STAGE === 'true';
    const criteriaEvent: BulkIngestionCriteriaCompletedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.criteria.completed',
      timestamp: new Date(),
      source: 'bulk-ingestion-criteria-worker-service',
      version: '1.0',
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
      category: EventCategory.DOCUMENT,
      data: {
        jobId,
        tenantId,
        clientId,
        itemId,
        rowIndex,
        status: status === 'completed' ? 'completed' : 'failed',
        criteriaStatus:
          status === 'failed'
            ? 'failed'
            : criteriaEnabled
              ? 'completed'
              : 'skipped',
        completedAt,
        ...(status === 'failed'
          ? { reason: error ?? 'Criteria stage not run because extraction failed' }
          : criteriaEnabled
            ? { reason: 'Criteria stage completed' }
            : { reason: 'Criteria stage skipped (BULK_INGESTION_ENABLE_CRITERIA_STAGE=false)' }),
        priority: status === 'failed' ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(criteriaEvent);
  }
}
