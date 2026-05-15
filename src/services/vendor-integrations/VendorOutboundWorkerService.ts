import { randomUUID } from 'node:crypto';
import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { VendorOutboxDocument } from '../../types/vendor-integration.types.js';
import { VendorOutboundDispatcher } from './VendorOutboundDispatcher.js';

const VENDOR_EVENT_OUTBOX_CONTAINER = 'vendor-event-outbox';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_BACKOFF_MS = 15_000;
const DEFAULT_MAX_BACKOFF_MS = 15 * 60 * 1_000;

type WorkerManagedStatus = 'PENDING' | 'FAILED';

type ClaimedVendorOutboxDocument = VendorOutboxDocument & { _etag: string };

/**
 * Background worker that polls the vendor-event-outbox Cosmos container for
 * PENDING/FAILED outbound documents and delivers them via VendorOutboundDispatcher.
 *
 * Mirrors VendorOutboxWorkerService exactly but:
 *  - queries direction = 'outbound'
 *  - dispatches HTTP (via dispatcher) instead of publishing to Service Bus
 *  - replays from document.outboundEvent rather than reconstructing an AppEvent
 *
 * Dead-lettered documents (≥ maxAttempts failures) remain in Cosmos and are
 * handled by the existing vendor-outbox-monitor controller (requeue / acknowledge).
 */
export class VendorOutboundWorkerService {
  private readonly logger = new Logger('VendorOutboundWorkerService');
  private readonly db: Pick<CosmosDbService, 'getContainer' | 'queryItems'>;
  private readonly dispatcher: Pick<VendorOutboundDispatcher, 'dispatch'>;
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
    dispatcher?: Pick<VendorOutboundDispatcher, 'dispatch'>,
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
    this.dispatcher = dispatcher ?? new VendorOutboundDispatcher();
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseBackoffMs = options?.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
    this.maxBackoffMs = options?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.workerId = options?.workerId ?? `vendor-outbound-worker:${randomUUID()}`;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('VendorOutboundWorkerService already started');
      return;
    }

    this.isStarted = true;
    this.logger.info('VendorOutboundWorkerService started', {
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

    this.logger.info('VendorOutboundWorkerService stopped', { workerId: this.workerId });
  }

  async processPendingBatch(nowIso: string = new Date().toISOString()): Promise<number> {
    const documents = await this.loadPendingDocuments(nowIso);
    let processedCount = 0;

    for (const document of documents) {
      if (!document.outboundEvent) {
        this.logger.warn('Outbound outbox document missing outboundEvent — skipping', {
          documentId: document.id,
          tenantId: document.tenantId,
        });
        continue;
      }

      const claimed = await this.claimDocument(document.id, document.tenantId, nowIso);
      if (!claimed) {
        continue;
      }

      try {
        await this.dispatcher.dispatch(claimed.outboundEvent!, claimed.connectionId);
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
      this.logger.debug('Vendor outbound outbox tick completed', {
        workerId: this.workerId,
        processedCount,
      });
    } catch (error) {
      this.logger.error('Vendor outbound outbox tick failed', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isTickRunning = false;
      this.scheduleNextTick(this.pollIntervalMs);
    }
  }

  private async loadPendingDocuments(nowIso: string): Promise<VendorOutboxDocument[]> {
    const result = await this.db.queryItems<VendorOutboxDocument>(
      VENDOR_EVENT_OUTBOX_CONTAINER,
      [
        'SELECT * FROM c',
        'WHERE c.type = @type',
        'AND c.direction = @direction',
        'AND ARRAY_CONTAINS(@statuses, c.status)',
        'AND c.availableAt <= @now',
        'ORDER BY c.availableAt ASC',
        `OFFSET 0 LIMIT ${this.batchSize}`,
      ].join(' '),
      [
        { name: '@type', value: 'vendor-event-outbox' },
        { name: '@direction', value: 'outbound' },
        { name: '@statuses', value: ['PENDING', 'FAILED'] },
        { name: '@now', value: nowIso },
      ],
    );

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? 'Failed to load pending outbound vendor outbox documents');
    }

    return result.data;
  }

  private async claimDocument(
    documentId: string,
    tenantId: string,
    claimedAt: string,
  ): Promise<ClaimedVendorOutboxDocument | null> {
    const container = this.db.getContainer(VENDOR_EVENT_OUTBOX_CONTAINER);
    const response = await container.item(documentId, tenantId).read<VendorOutboxDocument>();
    const current = response.resource;
    const etag = response.etag;

    if (!current || !etag) {
      return null;
    }

    if (!this.isClaimableStatus(current.status) || current.availableAt > claimedAt) {
      return null;
    }

    const claimed: VendorOutboxDocument = {
      ...current,
      status: 'PROCESSING',
      attemptCount: (current.attemptCount ?? 0) + 1,
      claimedAt,
      claimedBy: this.workerId,
      lastAttemptAt: claimedAt,
    };

    try {
      const replaceResponse = await container.item(documentId, tenantId).replace(claimed, {
        accessCondition: { type: 'IfMatch', condition: etag },
      });
      return {
        ...(replaceResponse.resource as VendorOutboxDocument),
        _etag: replaceResponse.etag,
      };
    } catch (error) {
      const errorCode = (error as { code?: number }).code;
      if (errorCode === 412) {
        this.logger.debug('Outbound outbox claim lost optimistic-lock race', {
          workerId: this.workerId,
          documentId,
          tenantId,
        });
        return null;
      }
      throw error;
    }
  }

  private async completeDocument(document: ClaimedVendorOutboxDocument, completedAt: string): Promise<void> {
    const container = this.db.getContainer(VENDOR_EVENT_OUTBOX_CONTAINER);
    await container.item(document.id, document.tenantId).replace({
      ...document,
      status: 'COMPLETED',
      completedAt,
      availableAt: completedAt,
      lastError: undefined,
    }, {
      accessCondition: { type: 'IfMatch', condition: document._etag },
    });
  }

  private async failDocument(
    document: ClaimedVendorOutboxDocument,
    error: unknown,
    failedAt: string,
  ): Promise<void> {
    const container = this.db.getContainer(VENDOR_EVENT_OUTBOX_CONTAINER);
    const isDeadLetter = document.attemptCount >= this.maxAttempts;
    const status = isDeadLetter ? 'DEAD_LETTER' : 'FAILED';
    const nextAvailableAt = isDeadLetter
      ? failedAt
      : new Date(Date.parse(failedAt) + this.computeBackoffMs(document.attemptCount)).toISOString();

    await container.item(document.id, document.tenantId).replace({
      ...document,
      status,
      availableAt: nextAvailableAt,
      lastError: error instanceof Error ? error.message : String(error),
    }, {
      accessCondition: { type: 'IfMatch', condition: document._etag },
    });

    if (isDeadLetter) {
      this.logger.warn('Outbound outbox document dead-lettered — operator action required', {
        workerId: this.workerId,
        documentId: document.id,
        tenantId: document.tenantId,
        vendorType: document.vendorType,
        vendorOrderId: document.vendorOrderId,
        eventType: document.eventType,
        attemptCount: document.attemptCount,
        connectionId: document.connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      this.logger.warn('Outbound outbox document delivery failed', {
        workerId: this.workerId,
        documentId: document.id,
        tenantId: document.tenantId,
        vendorType: document.vendorType,
        vendorOrderId: document.vendorOrderId,
        status,
        nextAvailableAt,
        attemptCount: document.attemptCount,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private computeBackoffMs(attemptCount: number): number {
    return Math.min(this.baseBackoffMs * (2 ** Math.max(attemptCount - 1, 0)), this.maxBackoffMs);
  }

  private isClaimableStatus(status: VendorOutboxDocument['status']): status is WorkerManagedStatus {
    // Only PENDING and FAILED documents are returned by loadPendingDocuments.
    // PROCESSING documents are never in the query result — including PROCESSING
    // here would be dead code and would make the WorkerManagedStatus type guard
    // a lie (it claims to narrow to PENDING|FAILED only).
    return status === 'PENDING' || status === 'FAILED';
  }
}
