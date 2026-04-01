/**
 * Axiom Bulk Submission Service
 *
 * Subscribes to `axiom.bulk-evaluation.requested` and submits the referenced
 * TAPE_EVALUATION job to Axiom via BulkPortfolioService.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { BulkPortfolioService } from './bulk-portfolio.service.js';
import type {
  AxiomBulkEvaluationRequestedEvent,
  BaseEvent,
  EventHandler,
  SystemAlertEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';

type BulkSubmissionMetricKey =
  | 'eventsReceived'
  | 'eventsReplaySkipped'
  | 'eventsDuplicateSkipped'
  | 'submissionsSucceeded'
  | 'submissionsFailed'
  | 'dlqCreated'
  | 'replayAttempts'
  | 'replaySucceeded'
  | 'replayFailed'
  | 'alertsSent'
  | 'alertFailures';

interface AxiomBulkSubmissionMetricsDoc {
  id: string;
  type: 'axiom-bulk-submission-metrics';
  tenantId: 'system';
  metrics: Record<BulkSubmissionMetricKey, number>;
  updatedAt: string;
}

export type AxiomBulkSubmissionDlqStatus = 'OPEN' | 'REPLAYED';
export type AxiomBulkSubmissionDlqSortPreset = 'FAILED_AT_DESC' | 'FAILED_AT_ASC' | 'RETRY_COUNT_DESC';
export type AxiomBulkSubmissionDlqAgeBucket = 'ANY' | 'LAST_24_HOURS' | 'LAST_7_DAYS' | 'OLDER_THAN_7_DAYS';

export interface AxiomBulkSubmissionDlqItem {
  id: string;
  type: 'axiom-bulk-submission-dlq';
  tenantId: string;
  clientId: string;
  jobId: string;
  eventId: string;
  source: string;
  failedAt: string;
  error: string;
  eventPayload?: Record<string, unknown>;
  status: AxiomBulkSubmissionDlqStatus;
  retryCount?: number;
  replayedAt?: string;
  replayedBy?: string;
  replayEventId?: string;
  replayResult?: {
    pipelineJobId?: string;
    batchId?: string;
  };
  lastReplayAttemptAt?: string;
  lastReplayAttemptBy?: string;
  lastReplayError?: string;
}

export interface AxiomBulkSubmissionDlqListResult {
  items: AxiomBulkSubmissionDlqItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  sortPreset: AxiomBulkSubmissionDlqSortPreset;
  ageBucket: AxiomBulkSubmissionDlqAgeBucket;
}

export class AxiomBulkSubmissionService {
  private readonly logger = new Logger('AxiomBulkSubmissionService');
  private readonly dbService: CosmosDbService;
  private readonly eventPublisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly bulkPortfolioService: BulkPortfolioService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    const resolvedDbService = dbService ?? new CosmosDbService();
    this.dbService = resolvedDbService;
    this.eventPublisher = new ServiceBusEventPublisher();
    this.bulkPortfolioService = new BulkPortfolioService(resolvedDbService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'axiom-bulk-submission-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AxiomBulkSubmissionService already started');
      return;
    }

    try {
      await this.subscriber.subscribe<AxiomBulkEvaluationRequestedEvent>(
        'axiom.bulk-evaluation.requested',
        this.makeHandler('axiom.bulk-evaluation.requested', this.onBulkEvaluationRequested.bind(this)),
      );
      this.isStarted = true;
      this.isRunning = true;
      this.logger.info('AxiomBulkSubmissionService started');
    } catch (err) {
      this.isRunning = false;
      this.logger.error('AxiomBulkSubmissionService failed to start', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('axiom.bulk-evaluation.requested').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('AxiomBulkSubmissionService stopped');
  }

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        try {
          await fn(event);
        } catch (err) {
          this.logger.error(`AxiomBulkSubmission handler failed for ${eventType}`, {
            error: (err as Error).message,
            eventId: event.id,
          });
          throw err;
        }
      },
    };
  }

  private async onBulkEvaluationRequested(event: AxiomBulkEvaluationRequestedEvent): Promise<void> {
    const { jobId, tenantId, clientId, reviewProgramId } = event.data;

    if (!jobId || !tenantId || !clientId) {
      throw new Error(
        `AxiomBulkSubmissionService received invalid event payload: ` +
        `jobId='${jobId}', tenantId='${tenantId}', clientId='${clientId}'`,
      );
    }

    await this.incrementMetric('eventsReceived');

    const now = new Date().toISOString();
    const receiptRegistered = await this.registerEventReceipt(event, now);
    if (!receiptRegistered) {
      await this.incrementMetric('eventsReplaySkipped');
      this.logger.info('Skipping replayed Axiom bulk evaluation event (already received)', {
        eventId: event.id,
        jobId,
        tenantId,
      });
      return;
    }

    const lock = await this.acquireSubmissionLock(event, now);
    if (!lock.acquired) {
      await this.incrementMetric('eventsDuplicateSkipped');
      await this.updateEventReceiptStatus(event, 'ignored-duplicate', {
        reason: lock.reason,
      });
      this.logger.info('Skipping duplicate Axiom bulk submission attempt', {
        eventId: event.id,
        jobId,
        tenantId,
        reason: lock.reason,
      });
      return;
    }

    try {
      const submitResult = await this.bulkPortfolioService.submitTapeEvaluationJobToAxiom(
        jobId,
        tenantId,
        clientId,
        reviewProgramId,
      );

      await this.upsertSubmissionLock({
        id: lock.lockId,
        type: 'axiom-bulk-submission-lock',
        tenantId,
        clientId,
        jobId,
        ownerEventId: event.id,
        status: 'completed',
        acquiredAt: lock.acquiredAt,
        updatedAt: new Date().toISOString(),
        attemptCount: lock.attemptCount,
        pipelineJobId: submitResult.pipelineJobId,
        batchId: submitResult.batchId,
      });

      await this.updateEventReceiptStatus(event, 'completed', {
        pipelineJobId: submitResult.pipelineJobId,
        batchId: submitResult.batchId,
      });
      await this.incrementMetric('submissionsSucceeded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.upsertSubmissionLock({
        id: lock.lockId,
        type: 'axiom-bulk-submission-lock',
        tenantId,
        clientId,
        jobId,
        ownerEventId: event.id,
        status: 'failed',
        acquiredAt: lock.acquiredAt,
        updatedAt: new Date().toISOString(),
        attemptCount: lock.attemptCount,
        lastError: errorMessage,
      });

      await this.writeDlqEntry(event, errorMessage);
      await this.updateEventReceiptStatus(event, 'failed', {
        error: errorMessage,
      });
      await this.incrementMetric('submissionsFailed');
      await this.sendOperationalAlert('error', `Axiom bulk submission failed for job '${jobId}'`, {
        jobId,
        tenantId,
        eventId: event.id,
        error: errorMessage,
      });
      throw error;
    }
  }

  async replayDlqEvent(
    sourceEventId: string,
    requestedBy: string,
  ): Promise<{ replayEventId: string; pipelineJobId: string; batchId: string }> {
    const dlqId = this.buildDlqId(sourceEventId);
    const dlq = await this.queryDocById<{
      id: string;
      type: string;
      tenantId: string;
      clientId: string;
      jobId: string;
      eventPayload?: { reviewProgramId?: string };
      status?: string;
      retryCount?: number;
    }>(dlqId);

    if (!dlq || dlq.type !== 'axiom-bulk-submission-dlq') {
      throw new Error(`DLQ event '${sourceEventId}' not found`);
    }

    await this.incrementMetric('replayAttempts');

    const replayEventId = `replay-${uuidv4()}`;
    const replayEvent: AxiomBulkEvaluationRequestedEvent = {
      id: replayEventId,
      type: 'axiom.bulk-evaluation.requested',
      timestamp: new Date(),
      source: 'axiom-bulk-submission-replayer',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        jobId: dlq.jobId,
        tenantId: dlq.tenantId,
        clientId: dlq.clientId,
        ...(dlq.eventPayload?.reviewProgramId ? { reviewProgramId: dlq.eventPayload.reviewProgramId } : {}),
        priority: EventPriority.HIGH,
      },
    };

    try {
      const submitResult = await this.bulkPortfolioService.submitTapeEvaluationJobToAxiom(
        replayEvent.data.jobId,
        replayEvent.data.tenantId,
        replayEvent.data.clientId,
        replayEvent.data.reviewProgramId,
      );

      await this.dbService.upsertItem('bulk-portfolio-jobs', {
        ...dlq,
        status: 'REPLAYED',
        replayedAt: new Date().toISOString(),
        replayedBy: requestedBy,
        replayEventId,
        replayResult: {
          pipelineJobId: submitResult.pipelineJobId,
          batchId: submitResult.batchId,
        },
        retryCount: (dlq.retryCount ?? 0) + 1,
      });

      await this.incrementMetric('replaySucceeded');
      return {
        replayEventId,
        pipelineJobId: submitResult.pipelineJobId,
        batchId: submitResult.batchId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.dbService.upsertItem('bulk-portfolio-jobs', {
        ...dlq,
        status: 'OPEN',
        lastReplayAttemptAt: new Date().toISOString(),
        lastReplayAttemptBy: requestedBy,
        lastReplayError: errorMessage,
        retryCount: (dlq.retryCount ?? 0) + 1,
      });

      await this.incrementMetric('replayFailed');
      await this.sendOperationalAlert('warning', `Axiom bulk DLQ replay failed for source event '${sourceEventId}'`, {
        sourceEventId,
        replayEventId,
        error: errorMessage,
      });
      throw error;
    }
  }

  async getOperationalMetrics(): Promise<Record<BulkSubmissionMetricKey, number>> {
    const metricsDoc = await this.queryDocById<AxiomBulkSubmissionMetricsDoc>(this.metricsDocId());
    return metricsDoc?.metrics ?? this.initialMetrics();
  }

  async listDlqEvents(filters?: {
    tenantId?: string;
    jobId?: string;
    status?: AxiomBulkSubmissionDlqStatus;
    fromFailedAt?: string;
    toFailedAt?: string;
    sortPreset?: AxiomBulkSubmissionDlqSortPreset;
    ageBucket?: AxiomBulkSubmissionDlqAgeBucket;
    page?: number;
    pageSize?: number;
    limit?: number;
  }): Promise<AxiomBulkSubmissionDlqListResult> {
    const tenantId = filters?.tenantId?.trim();
    const jobId = filters?.jobId?.trim();
    const status = filters?.status;
    const fromFailedAt = filters?.fromFailedAt?.trim();
    const toFailedAt = filters?.toFailedAt?.trim();
    const sortPreset = filters?.sortPreset ?? 'FAILED_AT_DESC';
    const ageBucket = filters?.ageBucket ?? 'ANY';
    const page = filters?.page && Number.isFinite(filters.page)
      ? Math.max(Math.floor(filters.page), 1)
      : 1;
    const pageSizeInput = filters?.pageSize ?? filters?.limit;
    const pageSize = pageSizeInput && Number.isFinite(pageSizeInput)
      ? Math.min(Math.max(Math.floor(pageSizeInput), 1), 500)
      : 100;

    if (status && status !== 'OPEN' && status !== 'REPLAYED') {
      throw new Error(`Invalid DLQ status '${status}'. Allowed values: OPEN, REPLAYED`);
    }

    if (!['FAILED_AT_DESC', 'FAILED_AT_ASC', 'RETRY_COUNT_DESC'].includes(sortPreset)) {
      throw new Error(
        `Invalid sortPreset '${sortPreset}'. Allowed values: FAILED_AT_DESC, FAILED_AT_ASC, RETRY_COUNT_DESC`,
      );
    }

    if (!['ANY', 'LAST_24_HOURS', 'LAST_7_DAYS', 'OLDER_THAN_7_DAYS'].includes(ageBucket)) {
      throw new Error(
        `Invalid ageBucket '${ageBucket}'. Allowed values: ANY, LAST_24_HOURS, LAST_7_DAYS, OLDER_THAN_7_DAYS`,
      );
    }

    if (fromFailedAt && Number.isNaN(Date.parse(fromFailedAt))) {
      throw new Error(`Invalid fromFailedAt '${fromFailedAt}'. Must be a valid ISO-8601 datetime.`);
    }

    if (toFailedAt && Number.isNaN(Date.parse(toFailedAt))) {
      throw new Error(`Invalid toFailedAt '${toFailedAt}'. Must be a valid ISO-8601 datetime.`);
    }

    if (fromFailedAt && toFailedAt && Date.parse(fromFailedAt) > Date.parse(toFailedAt)) {
      throw new Error('fromFailedAt must be less than or equal to toFailedAt');
    }

    const now = new Date();
    const last24HoursIso = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
    const last7DaysIso = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();

    const whereClauses: string[] = ['c.type = @type'];
    const parameters: Array<{ name: string; value: string }> = [
      { name: '@type', value: 'axiom-bulk-submission-dlq' },
    ];

    if (tenantId) {
      whereClauses.push('c.tenantId = @tenantId');
      parameters.push({ name: '@tenantId', value: tenantId });
    }

    if (jobId) {
      whereClauses.push('c.jobId = @jobId');
      parameters.push({ name: '@jobId', value: jobId });
    }

    if (status) {
      whereClauses.push('c.status = @status');
      parameters.push({ name: '@status', value: status });
    }

    if (fromFailedAt) {
      whereClauses.push('c.failedAt >= @fromFailedAt');
      parameters.push({ name: '@fromFailedAt', value: fromFailedAt });
    }

    if (toFailedAt) {
      whereClauses.push('c.failedAt <= @toFailedAt');
      parameters.push({ name: '@toFailedAt', value: toFailedAt });
    }

    if (ageBucket === 'LAST_24_HOURS') {
      whereClauses.push('c.failedAt >= @ageBucketFrom');
      parameters.push({ name: '@ageBucketFrom', value: last24HoursIso });
    } else if (ageBucket === 'LAST_7_DAYS') {
      whereClauses.push('c.failedAt >= @ageBucketFrom');
      parameters.push({ name: '@ageBucketFrom', value: last7DaysIso });
    } else if (ageBucket === 'OLDER_THAN_7_DAYS') {
      whereClauses.push('c.failedAt < @ageBucketTo');
      parameters.push({ name: '@ageBucketTo', value: last7DaysIso });
    }

    const orderBy =
      sortPreset === 'FAILED_AT_ASC'
        ? 'c.failedAt ASC'
        : sortPreset === 'RETRY_COUNT_DESC'
          ? 'c.retryCount DESC, c.failedAt DESC'
          : 'c.failedAt DESC';

    const offset = (page - 1) * pageSize;
    const fetchLimit = pageSize + 1;

    const queryText = `SELECT * FROM c WHERE ${whereClauses.join(' AND ')} ORDER BY ${orderBy} OFFSET ${offset} LIMIT ${fetchLimit}`;
    const queryResult = await this.dbService.queryItems<AxiomBulkSubmissionDlqItem>(
      'bulk-portfolio-jobs',
      queryText,
      parameters,
    );

    if (!queryResult.success || !queryResult.data) {
      throw new Error('Failed to query Axiom bulk submission DLQ events');
    }

    const hasMore = queryResult.data.length > pageSize;
    const items = hasMore ? queryResult.data.slice(0, pageSize) : queryResult.data;

    return {
      items,
      page,
      pageSize,
      hasMore,
      sortPreset,
      ageBucket,
    };
  }

  private async registerEventReceipt(event: AxiomBulkEvaluationRequestedEvent, receivedAt: string): Promise<boolean> {
    const receiptId = this.buildReceiptId(event.id);
    const receiptDoc = {
      id: receiptId,
      type: 'axiom-bulk-submission-receipt',
      eventId: event.id,
      tenantId: event.data.tenantId,
      clientId: event.data.clientId,
      jobId: event.data.jobId,
      status: 'received',
      receivedAt,
      updatedAt: receivedAt,
      immutable: true,
    };

    const createResult = await this.dbService.createItem('bulk-portfolio-jobs', receiptDoc);
    if (createResult.success) {
      return true;
    }

    const existing = await this.queryDocById<{ id: string }>(receiptId);
    return !existing;
  }

  private async acquireSubmissionLock(
    event: AxiomBulkEvaluationRequestedEvent,
    acquiredAt: string,
  ): Promise<
    | { acquired: true; lockId: string; acquiredAt: string; attemptCount: number }
    | { acquired: false; reason: string }
  > {
    const lockId = this.buildLockId(event.data.tenantId, event.data.jobId);
    const initialLockDoc = {
      id: lockId,
      type: 'axiom-bulk-submission-lock',
      tenantId: event.data.tenantId,
      clientId: event.data.clientId,
      jobId: event.data.jobId,
      ownerEventId: event.id,
      status: 'in-progress',
      acquiredAt,
      updatedAt: acquiredAt,
      attemptCount: 1,
    };

    const createResult = await this.dbService.createItem('bulk-portfolio-jobs', initialLockDoc);
    if (createResult.success) {
      return { acquired: true, lockId, acquiredAt, attemptCount: 1 };
    }

    const existingLock = await this.queryDocById<{
      ownerEventId?: string;
      status?: string;
      acquiredAt?: string;
      attemptCount?: number;
    }>(lockId);

    if (!existingLock) {
      throw new Error(`Failed to acquire Axiom submission lock '${lockId}' and no existing lock could be queried`);
    }

    if (existingLock.status === 'completed') {
      return { acquired: false, reason: 'already-completed' };
    }

    if (existingLock.status === 'in-progress' && existingLock.ownerEventId !== event.id) {
      return { acquired: false, reason: 'in-progress-by-another-event' };
    }

    const nextAttemptCount = (existingLock.attemptCount ?? 0) + 1;
    await this.upsertSubmissionLock({
      id: lockId,
      type: 'axiom-bulk-submission-lock',
      tenantId: event.data.tenantId,
      clientId: event.data.clientId,
      jobId: event.data.jobId,
      ownerEventId: event.id,
      status: 'in-progress',
      acquiredAt: existingLock.acquiredAt ?? acquiredAt,
      updatedAt: acquiredAt,
      attemptCount: nextAttemptCount,
    });

    return {
      acquired: true,
      lockId,
      acquiredAt: existingLock.acquiredAt ?? acquiredAt,
      attemptCount: nextAttemptCount,
    };
  }

  private async updateEventReceiptStatus(
    event: AxiomBulkEvaluationRequestedEvent,
    status: 'completed' | 'failed' | 'ignored-duplicate',
    details: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const receiptId = this.buildReceiptId(event.id);
    await this.dbService.upsertItem('bulk-portfolio-jobs', {
      id: receiptId,
      type: 'axiom-bulk-submission-receipt',
      eventId: event.id,
      tenantId: event.data.tenantId,
      clientId: event.data.clientId,
      jobId: event.data.jobId,
      status,
      updatedAt: now,
      details,
      immutable: true,
    });
  }

  private async upsertSubmissionLock(lockDoc: Record<string, unknown>): Promise<void> {
    const upsertResult = await this.dbService.upsertItem('bulk-portfolio-jobs', lockDoc);
    if (!upsertResult.success) {
      throw new Error(`Failed to persist Axiom bulk submission lock '${String(lockDoc.id)}'`);
    }
  }

  private async writeDlqEntry(event: AxiomBulkEvaluationRequestedEvent, errorMessage: string): Promise<void> {
    const dlqDoc = {
      id: this.buildDlqId(event.id),
      type: 'axiom-bulk-submission-dlq',
      tenantId: event.data.tenantId,
      clientId: event.data.clientId,
      jobId: event.data.jobId,
      eventId: event.id,
      source: 'axiom-bulk-submission-service',
      failedAt: new Date().toISOString(),
      error: errorMessage,
      eventPayload: event.data,
      status: 'OPEN',
      retryCount: 0,
    };

    const createResult = await this.dbService.createItem('bulk-portfolio-jobs', dlqDoc);
    if (!createResult.success) {
      this.logger.error('Failed to persist Axiom bulk submission DLQ item', {
        eventId: event.id,
        jobId: event.data.jobId,
      });
      await this.incrementMetric('alertFailures');
      return;
    }

    await this.incrementMetric('dlqCreated');
  }

  private async incrementMetric(key: BulkSubmissionMetricKey): Promise<void> {
    const metricsId = this.metricsDocId();
    const now = new Date().toISOString();
    const existing = await this.queryDocById<AxiomBulkSubmissionMetricsDoc>(metricsId);
    const currentMetrics = existing?.metrics ?? this.initialMetrics();
    const updated: AxiomBulkSubmissionMetricsDoc = {
      id: metricsId,
      type: 'axiom-bulk-submission-metrics',
      tenantId: 'system',
      metrics: {
        ...currentMetrics,
        [key]: (currentMetrics[key] ?? 0) + 1,
      },
      updatedAt: now,
    };

    await this.dbService.upsertItem('bulk-portfolio-jobs', updated);
  }

  private initialMetrics(): Record<BulkSubmissionMetricKey, number> {
    return {
      eventsReceived: 0,
      eventsReplaySkipped: 0,
      eventsDuplicateSkipped: 0,
      submissionsSucceeded: 0,
      submissionsFailed: 0,
      dlqCreated: 0,
      replayAttempts: 0,
      replaySucceeded: 0,
      replayFailed: 0,
      alertsSent: 0,
      alertFailures: 0,
    };
  }

  private async sendOperationalAlert(
    severity: 'warning' | 'error',
    message: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      const alertEvent: SystemAlertEvent = {
        id: uuidv4(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'axiom-bulk-submission-service',
        version: '1.0',
        category: EventCategory.SYSTEM,
        data: {
          alertType: 'AXIOM_BULK_SUBMISSION',
          severity,
          message,
          source: 'axiom-bulk-submission-service',
          priority: severity === 'error' ? EventPriority.HIGH : EventPriority.NORMAL,
          requiresAction: severity === 'error',
        },
      };

      await this.eventPublisher.publish(alertEvent);

      const webhookUrl = process.env.AXIOM_BULK_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'axiom-bulk-submission-service',
            severity,
            message,
            context,
            timestamp: new Date().toISOString(),
          }),
        });
      }

      await this.incrementMetric('alertsSent');
    } catch (error) {
      this.logger.warn('Failed to send Axiom bulk submission operational alert', {
        severity,
        message,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.incrementMetric('alertFailures');
    }
  }

  private async queryDocById<T>(id: string): Promise<T | null> {
    const queryResult = await this.dbService.queryItems<T>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.id = @id OFFSET 0 LIMIT 1',
      [{ name: '@id', value: id }],
    );

    if (!queryResult.success || !queryResult.data) {
      throw new Error(`Failed to query document by id '${id}'`);
    }

    return queryResult.data[0] ?? null;
  }

  private buildReceiptId(eventId: string): string {
    return `axiom-bulk-submission-receipt:${eventId}`;
  }

  private buildDlqId(eventId: string): string {
    return `axiom-bulk-submission-dlq:${eventId}`;
  }

  private metricsDocId(): string {
    return 'axiom-bulk-submission-metrics:global';
  }

  private buildLockId(tenantId: string, jobId: string): string {
    return `axiom-bulk-submission-lock:${tenantId}:${jobId}`;
  }
}
