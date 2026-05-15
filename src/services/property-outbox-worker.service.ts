import { randomUUID } from 'node:crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { Logger } from '../utils/logger.js';
import type {
  AppEvent,
  EventPublisher,
  PropertyCurrentCanonicalUpdatedEvent,
  PropertyObservationRecordedEvent,
  PropertySnapshotCreatedEvent,
  PropertySnapshotRefreshedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { PropertyEventOutboxRecord } from '../types/property-event-outbox.types.js';
import { PROPERTY_EVENT_OUTBOX_CONTAINER } from './property-event-outbox.service.js';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_BACKOFF_MS = 15_000;
const DEFAULT_MAX_BACKOFF_MS = 15 * 60 * 1_000;

type WorkerManagedStatus = 'pending' | 'failed';
type ClaimedPropertyEventOutboxRecord = PropertyEventOutboxRecord & { _etag: string };

export class PropertyOutboxWorkerService {
  private readonly logger = new Logger('PropertyOutboxWorkerService');
  private readonly db: Pick<CosmosDbService, 'getContainer' | 'queryItems'>;
  private readonly publisher: EventPublisher;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly workerId: string;
  private timer: NodeJS.Timeout | null = null;
  private isStarted = false;
  private isTickRunning = false;

  constructor(
    db?: Pick<CosmosDbService, 'getContainer' | 'queryItems'>,
    publisher?: EventPublisher,
    options?: {
      pollIntervalMs?: number;
      batchSize?: number;
      maxAttempts?: number;
      baseBackoffMs?: number;
      maxBackoffMs?: number;
      workerId?: string;
    },
  ) {
    this.db = db ?? new CosmosDbService();
    this.publisher = publisher ?? new ServiceBusEventPublisher();
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseBackoffMs = options?.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.maxBackoffMs = options?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.workerId = options?.workerId ?? `property-outbox-worker:${randomUUID()}`;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('PropertyOutboxWorkerService already started');
      return;
    }

    this.isStarted = true;
    this.logger.info('PropertyOutboxWorkerService started', {
      workerId: this.workerId,
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
      maxAttempts: this.maxAttempts,
    });
    this.scheduleNextTick(0);
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if ('close' in this.publisher && typeof this.publisher.close === 'function') {
      await this.publisher.close();
    }

    this.logger.info('PropertyOutboxWorkerService stopped', { workerId: this.workerId });
  }

  async processPendingBatch(nowIso: string = new Date().toISOString()): Promise<number> {
    const documents = await this.loadPendingDocuments(nowIso);
    let processedCount = 0;

    for (const document of documents) {
      const claimed = await this.claimDocument(document.id, document.tenantId, nowIso);
      if (!claimed) {
        continue;
      }

      try {
        await this.publisher.publish(this.toAppEvent(claimed));
        await this.completeDocument(claimed, nowIso);
        processedCount += 1;
      } catch (error) {
        await this.failDocument(claimed, error, nowIso);
      }
    }

    return processedCount;
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.isStarted) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.runTick();
    }, delayMs);
  }

  private async runTick(): Promise<void> {
    if (!this.isStarted || this.isTickRunning) {
      return;
    }

    this.isTickRunning = true;
    try {
      const processedCount = await this.processPendingBatch();
      this.logger.debug('Property outbox tick completed', {
        workerId: this.workerId,
        processedCount,
      });
    } catch (error) {
      this.logger.error('Property outbox tick failed', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isTickRunning = false;
      this.scheduleNextTick(this.pollIntervalMs);
    }
  }

  private async loadPendingDocuments(nowIso: string): Promise<PropertyEventOutboxRecord[]> {
    const result = await this.db.queryItems<PropertyEventOutboxRecord>(
      PROPERTY_EVENT_OUTBOX_CONTAINER,
      [
        'SELECT * FROM c',
        'WHERE c.type = @type',
        'AND ARRAY_CONTAINS(@statuses, c.status)',
        'AND c.availableAt <= @now',
        'ORDER BY c.availableAt ASC',
        `OFFSET 0 LIMIT ${this.batchSize}`,
      ].join(' '),
      [
        { name: '@type', value: 'property-event-outbox' },
        { name: '@statuses', value: ['pending', 'failed'] },
        { name: '@now', value: nowIso },
      ],
    );

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to load pending property outbox documents');
    }

    return result.data;
  }

  private async claimDocument(
    documentId: string,
    tenantId: string,
    claimedAt: string,
  ): Promise<ClaimedPropertyEventOutboxRecord | null> {
    const container = this.db.getContainer(PROPERTY_EVENT_OUTBOX_CONTAINER);
    const response = await container.item(documentId, tenantId).read<PropertyEventOutboxRecord>();
    const current = response.resource;
    const etag = response.etag;

    if (!current || !etag) {
      return null;
    }

    if (!this.isClaimableStatus(current.status) || current.availableAt > claimedAt) {
      return null;
    }

    const claimed: PropertyEventOutboxRecord = {
      ...current,
      status: 'processing',
      publishAttempts: (current.publishAttempts ?? 0) + 1,
      claimedAt,
      claimedBy: this.workerId,
      lastAttemptAt: claimedAt,
    };

    try {
      const replaceResponse = await container.item(documentId, tenantId).replace(claimed, {
        accessCondition: { type: 'IfMatch', condition: etag },
      });
      return {
        ...(replaceResponse.resource as PropertyEventOutboxRecord),
        _etag: replaceResponse.etag,
      };
    } catch (error) {
      const errorCode = (error as { code?: number }).code;
      if (errorCode === 412) {
        this.logger.debug('Property outbox claim lost optimistic-lock race', {
          workerId: this.workerId,
          documentId,
          tenantId,
        });
        return null;
      }
      throw error;
    }
  }

  private async completeDocument(document: ClaimedPropertyEventOutboxRecord, completedAt: string): Promise<void> {
    const container = this.db.getContainer(PROPERTY_EVENT_OUTBOX_CONTAINER);
    await container.item(document.id, document.tenantId).replace({
      ...document,
      status: 'published',
      publishedAt: completedAt,
      availableAt: completedAt,
      lastError: undefined,
    }, {
      accessCondition: { type: 'IfMatch', condition: document._etag },
    });
  }

  private async failDocument(
    document: ClaimedPropertyEventOutboxRecord,
    error: unknown,
    failedAt: string,
  ): Promise<void> {
    const container = this.db.getContainer(PROPERTY_EVENT_OUTBOX_CONTAINER);
    const isDeadLetter = document.publishAttempts >= this.maxAttempts;
    const status = isDeadLetter ? 'dead-letter' : 'failed';
    const nextAvailableAt = isDeadLetter
      ? failedAt
      : new Date(Date.parse(failedAt) + this.computeBackoffMs(document.publishAttempts)).toISOString();

    await container.item(document.id, document.tenantId).replace({
      ...document,
      status,
      availableAt: nextAvailableAt,
      lastError: error instanceof Error ? error.message : String(error),
    }, {
      accessCondition: { type: 'IfMatch', condition: document._etag },
    });

    this.logger.warn('Property outbox document processing failed', {
      workerId: this.workerId,
      documentId: document.id,
      tenantId: document.tenantId,
      aggregateId: document.aggregateId,
      eventType: document.eventType,
      status,
      nextAvailableAt,
      publishAttempts: document.publishAttempts,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private computeBackoffMs(attemptCount: number): number {
    return Math.min(this.baseBackoffMs * (2 ** Math.max(attemptCount - 1, 0)), this.maxBackoffMs);
  }

  private isClaimableStatus(status: PropertyEventOutboxRecord['status']): status is WorkerManagedStatus {
    return status === 'pending' || status === 'failed';
  }

  private toAppEvent(document: PropertyEventOutboxRecord): AppEvent {
    if (document.eventType === 'property.currentCanonical.updated') {
      const event: PropertyCurrentCanonicalUpdatedEvent = {
        id: document.id,
        type: 'property.currentCanonical.updated',
        timestamp: new Date(document.occurredAt),
        source: 'property-outbox-worker-service',
        version: '1.0',
        correlationId: document.correlationId,
        category: EventCategory.PROPERTY,
        data: {
          tenantId: document.tenantId,
          propertyId: document.payload.propertyId,
          ...(document.payload.snapshotId !== undefined ? { snapshotId: document.payload.snapshotId } : {}),
          ...(document.payload.recordVersion !== undefined ? { recordVersion: document.payload.recordVersion } : {}),
          ...(document.payload.observedAt !== undefined ? { observedAt: document.payload.observedAt } : {}),
          ...(document.payload.sourceSystem !== undefined ? { sourceSystem: document.payload.sourceSystem } : {}),
          sourceProvider: document.payload.sourceProvider ?? null,
          orderId: document.payload.orderId ?? null,
          engagementId: document.payload.engagementId ?? null,
          documentId: document.payload.documentId ?? null,
          sourceRecordId: document.payload.sourceRecordId ?? null,
          sourceArtifactRef: document.payload.sourceArtifactRef ?? null,
          lineageRefs: document.payload.lineageRefs ?? [],
          priority: EventPriority.NORMAL,
        },
      };

      return event;
    }

    if (document.eventType === 'property.snapshot.created' || document.eventType === 'property.snapshot.refreshed') {
      const baseEvent = {
        id: document.id,
        timestamp: new Date(document.occurredAt),
        source: 'property-outbox-worker-service',
        version: '1.0',
        correlationId: document.correlationId,
        category: EventCategory.PROPERTY,
        data: {
          tenantId: document.tenantId,
          propertyId: document.payload.propertyId,
          ...(document.payload.snapshotId !== undefined ? { snapshotId: document.payload.snapshotId } : {}),
          ...(document.payload.observedAt !== undefined ? { observedAt: document.payload.observedAt } : {}),
          ...(document.payload.sourceSystem !== undefined ? { sourceSystem: document.payload.sourceSystem } : {}),
          sourceProvider: document.payload.sourceProvider ?? null,
          orderId: document.payload.orderId ?? null,
          engagementId: document.payload.engagementId ?? null,
          documentId: document.payload.documentId ?? null,
          sourceRecordId: document.payload.sourceRecordId ?? null,
          sourceArtifactRef: document.payload.sourceArtifactRef ?? null,
          lineageRefs: document.payload.lineageRefs ?? [],
          priority: EventPriority.NORMAL,
        },
      };

      if (document.eventType === 'property.snapshot.created') {
        // Cast: baseEvent.data is built via conditional spreads (to satisfy
        // exactOptionalPropertyTypes), so TS can't narrow it to the exact
        // PropertySnapshotCreatedEvent.data shape automatically.
        const event = {
          ...baseEvent,
          type: 'property.snapshot.created' as const,
        } as PropertySnapshotCreatedEvent;

        return event;
      }

      const event = {
        ...baseEvent,
        type: 'property.snapshot.refreshed' as const,
      } as PropertySnapshotRefreshedEvent;

      return event;
    }

    const event: PropertyObservationRecordedEvent = {
      id: document.id,
      type: 'property.observation.recorded',
      timestamp: new Date(document.occurredAt),
      source: 'property-outbox-worker-service',
      version: '1.0',
      correlationId: document.correlationId,
      category: EventCategory.PROPERTY,
      data: {
        tenantId: document.tenantId,
        propertyId: document.payload.propertyId,
        ...(document.payload.observationId !== undefined ? { observationId: document.payload.observationId } : {}),
        ...(document.payload.snapshotId !== undefined ? { snapshotId: document.payload.snapshotId } : {}),
        ...(document.payload.observationType !== undefined ? { observationType: document.payload.observationType } : {}),
        ...(document.payload.observedAt !== undefined ? { observedAt: document.payload.observedAt } : {}),
        ...(document.payload.sourceSystem !== undefined ? { sourceSystem: document.payload.sourceSystem } : {}),
        sourceProvider: document.payload.sourceProvider ?? null,
        orderId: document.payload.orderId ?? null,
        engagementId: document.payload.engagementId ?? null,
        documentId: document.payload.documentId ?? null,
        sourceRecordId: document.payload.sourceRecordId ?? null,
        sourceArtifactRef: document.payload.sourceArtifactRef ?? null,
        lineageRefs: document.payload.lineageRefs ?? [],
        priority: EventPriority.NORMAL,
      },
    };

    return event;
  }
}