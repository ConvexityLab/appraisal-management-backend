/**
 * DataShareBlobSyncAdapter
 *
 * Handles 'data-share-sync' flavor BlobSyncMessages — triggered when an Azure
 * Data Share subscription synchronization completes. Enumerates all blobs in the
 * received container that have been modified since the last sync cursor, applies
 * idempotency via SHA-256 blob fingerprints, and emits vendor.file.received
 * events into the vendor-event-outbox for downstream processing.
 */

import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Logger } from '../../utils/logger.js';
import type {
  BlobIntakeJobDocument,
  BlobSyncCursorDocument,
  VendorConnection,
  VendorDomainEvent,
  VendorFileRef,
} from '../../types/vendor-integration.types.js';
import type {
  BlobSyncAdapter,
  BlobSyncAdapterContext,
  BlobSyncMessage,
  BlobSyncResult,
} from './BlobSyncAdapter.js';
import { parseBlobPathTokens } from './BlobSyncAdapter.js';

const BLOB_INTAKE_JOBS_CONTAINER = 'blob-intake-jobs';

export class DataShareBlobSyncAdapter implements BlobSyncAdapter {
  readonly supportedFlavor = 'data-share-sync' as const;

  private readonly logger = new Logger('DataShareBlobSyncAdapter');

  canHandle(message: BlobSyncMessage, connection: VendorConnection): boolean {
    return (
      message.flavor === 'data-share-sync' &&
      connection.blobConfig !== undefined
    );
  }

  async processSync(
    message: BlobSyncMessage,
    connection: VendorConnection,
    context: BlobSyncAdapterContext,
  ): Promise<BlobSyncResult> {
    const { blobConfig } = connection;
    if (!blobConfig) {
      throw new Error(
        `DataShareBlobSyncAdapter: VendorConnection ${connection.id} has no blobConfig. ` +
        'Set blobConfig on the connection to enable blob-drop processing.',
      );
    }

    // Only process successful syncs — failed/canceled syncs mean no new data arrived.
    if (message.syncStatus !== 'Succeeded') {
      this.logger.info('Skipping non-successful Data Share sync event', {
        vendorType: message.vendorType,
        syncRunId: message.syncRunId,
        syncStatus: message.syncStatus,
      });
      return { blobsEnumerated: 0, jobsCreated: 0, jobsSkipped: 0, jobsRequeued: 0 };
    }

    if (!message.syncRunId || !message.syncEndTime) {
      throw new Error(
        `DataShareBlobSyncAdapter: data-share-sync message is missing syncRunId or syncEndTime ` +
        `(vendorType=${message.vendorType}, messageId=${message.messageId})`,
      );
    }

    // ── Load cursor ──────────────────────────────────────────────────────────
    const cursorId = `cursor:${connection.id}`;
    const cursor = await this.loadOrCreateCursor(
      cursorId,
      connection,
      message.syncRunId,
      context,
    );

    // Already processed this exact sync run — idempotent re-delivery guard.
    if (cursor.lastSyncRunId === message.syncRunId) {
      this.logger.info('Sync run already processed — skipping (idempotent)', {
        vendorType: message.vendorType,
        syncRunId: message.syncRunId,
        connectionId: connection.id,
      });
      return { blobsEnumerated: 0, jobsCreated: 0, jobsSkipped: 0, jobsRequeued: 0 };
    }

    const sinceDate = cursor.lastSyncCompletedAt
      ? new Date(cursor.lastSyncCompletedAt)
      : null;

    // ── Enumerate blobs ──────────────────────────────────────────────────────
    const receivedAt = new Date().toISOString();
    const result: BlobSyncResult = {
      blobsEnumerated: 0,
      jobsCreated: 0,
      jobsSkipped: 0,
      jobsRequeued: 0,
    };
    const eventsToPublish: VendorDomainEvent[] = [];

    for await (const blob of context.blobClient.listBlobsSince(
      blobConfig.storageAccountName,
      blobConfig.receivedContainerName,
      sinceDate,
    )) {
      result.blobsEnumerated++;

      // ── Extension filter ──────────────────────────────────────────────────
      const ext = path.extname(blob.name).toLowerCase();
      if (!blobConfig.acceptedExtensions.map(e => e.toLowerCase()).includes(ext)) {
        this.logger.debug('Skipping blob with non-accepted extension', {
          blobName: blob.name,
          ext,
          acceptedExtensions: blobConfig.acceptedExtensions,
        });
        continue;
      }

      // ── Path token parsing ────────────────────────────────────────────────
      const tokens = parseBlobPathTokens(blob.name, blobConfig.blobPathPattern);
      if (!tokens) {
        this.logger.warn('Blob path does not match blobPathPattern — skipping', {
          blobName: blob.name,
          pattern: blobConfig.blobPathPattern,
          connectionId: connection.id,
        });
        continue;
      }

      const subClientId = tokens['subClientRef'] ?? 'unknown';
      const filename = tokens['filename'] ?? path.basename(blob.name);

      // ── SHA-256 fingerprint ───────────────────────────────────────────────
      const fileId = createHash('sha256')
        .update(`${blobConfig.storageAccountName}:${blobConfig.receivedContainerName}:${blob.name}:${blob.eTag}`)
        .digest('hex');

      // ── Idempotency check ─────────────────────────────────────────────────
      const existingJob = await this.loadIntakeJob(fileId, connection.tenantId, context);

      if (existingJob) {
        if (existingJob.status === 'failed' && existingJob.retryCount < (blobConfig.maxRetries ?? 3)) {
          // Re-queue for retry
          await this.updateIntakeJobStatus(existingJob, 'received', context);
          result.jobsRequeued++;
        } else {
          result.jobsSkipped++;
          continue;
        }
      } else {
        // ── Create BlobIntakeJobDocument ──────────────────────────────────
        const job: BlobIntakeJobDocument = {
          id: fileId,
          tenantId: connection.tenantId,
          type: 'blob-intake-job',
          clientId: connection.inboundIdentifier,
          subClientId,
          taskType: blobConfig.taskType,
          connectionId: connection.id,
          storageAccountName: blobConfig.storageAccountName,
          containerName: blobConfig.receivedContainerName,
          blobPath: blob.name,
          eTag: blob.eTag,
          ...(blob.contentLength !== undefined ? { contentLengthBytes: blob.contentLength } : {}),
          filename,
          syncRunId: message.syncRunId,
          status: 'received',
          retryCount: 0,
          receivedAt,
        };

        await this.createIntakeJob(job, context);
      }

      // ── Build VendorDomainEvent ───────────────────────────────────────────
      const fileRef: VendorFileRef = {
        fileId,
        filename,
        category: inferCategory(ext),
        storageAccountName: blobConfig.storageAccountName,
        containerName: blobConfig.receivedContainerName,
        blobPath: blob.name,
        eTag: blob.eTag,
        ...(blob.contentLength !== undefined ? { contentLengthBytes: blob.contentLength } : {}),
        subClientId,
        taskType: blobConfig.taskType,
      };

      const event: VendorDomainEvent = {
        id: randomUUID(),
        eventType: 'vendor.file.received',
        vendorType: connection.vendorType,
        vendorOrderId: fileId,           // stable per-file identity
        ourOrderId: null,
        lenderId: connection.lenderId,
        tenantId: connection.tenantId,
        occurredAt: blob.lastModified.toISOString(),
        payload: { fileRefs: [fileRef] },
        clientId: connection.inboundIdentifier,
        subClientId,
        taskType: blobConfig.taskType,
      };

      eventsToPublish.push(event);
    }

    // ── Publish to outbox ────────────────────────────────────────────────────
    if (eventsToPublish.length > 0) {
      await context.outboxService.persistBlobSyncEvents(connection, eventsToPublish);
      result.jobsCreated += eventsToPublish.length;

      // Mark intake jobs as queued
      await this.markJobsQueued(eventsToPublish, connection.tenantId, context);
    }

    // ── Advance cursor ────────────────────────────────────────────────────────
    await this.advanceCursor(cursorId, connection, message.syncRunId, message.syncEndTime, context);

    this.logger.info('Data Share sync processing complete', {
      connectionId: connection.id,
      vendorType: connection.vendorType,
      syncRunId: message.syncRunId,
      ...result,
    });

    return result;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async loadOrCreateCursor(
    cursorId: string,
    connection: VendorConnection,
    syncRunId: string,
    context: BlobSyncAdapterContext,
  ): Promise<BlobSyncCursorDocument> {
    const existing = await context.db.queryItems<BlobSyncCursorDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
      [
        { name: '@id', value: cursorId },
        { name: '@tenantId', value: connection.tenantId },
      ],
    );

    if (existing.success && existing.data && existing.data.length > 0 && existing.data[0]) {
      return existing.data[0];
    }

    // First ever sync for this connection — cursor starts at epoch (process all blobs)
    const cursor: BlobSyncCursorDocument = {
      id: cursorId,
      tenantId: connection.tenantId,
      type: 'blob-sync-cursor',
      connectionId: connection.id,
      clientId: connection.inboundIdentifier,
      lastSyncRunId: '',                   // empty = never synced
      lastSyncCompletedAt: '',             // empty = enumerate all blobs on first run
    };

    const result = await context.db.upsertItem<BlobSyncCursorDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      cursor,
    );

    if (!result.success || !result.data) {
      throw new Error(
        result.error?.message ??
        `Failed to create initial sync cursor for connectionId=${connection.id}`,
      );
    }

    return result.data;
  }

  private async advanceCursor(
    cursorId: string,
    connection: VendorConnection,
    syncRunId: string,
    syncEndTime: string,
    context: BlobSyncAdapterContext,
  ): Promise<void> {
    const cursor: BlobSyncCursorDocument = {
      id: cursorId,
      tenantId: connection.tenantId,
      type: 'blob-sync-cursor',
      connectionId: connection.id,
      clientId: connection.inboundIdentifier,
      lastSyncRunId: syncRunId,
      lastSyncCompletedAt: syncEndTime,
    };

    const result = await context.db.upsertItem<BlobSyncCursorDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      cursor,
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ??
        `Failed to advance sync cursor for connectionId=${connection.id}`,
      );
    }
  }

  private async loadIntakeJob(
    fileId: string,
    tenantId: string,
    context: BlobSyncAdapterContext,
  ): Promise<BlobIntakeJobDocument | null> {
    const result = await context.db.queryItems<BlobIntakeJobDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId AND c.type = @type',
      [
        { name: '@id', value: fileId },
        { name: '@tenantId', value: tenantId },
        { name: '@type', value: 'blob-intake-job' },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) return null;
    return result.data[0] ?? null;
  }

  private async createIntakeJob(
    job: BlobIntakeJobDocument,
    context: BlobSyncAdapterContext,
  ): Promise<void> {
    const result = await context.db.upsertItem<BlobIntakeJobDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      job,
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ??
        `Failed to create BlobIntakeJobDocument id=${job.id}`,
      );
    }
  }

  private async updateIntakeJobStatus(
    job: BlobIntakeJobDocument,
    status: BlobIntakeJobDocument['status'],
    context: BlobSyncAdapterContext,
  ): Promise<void> {
    const result = await context.db.upsertItem<BlobIntakeJobDocument>(
      BLOB_INTAKE_JOBS_CONTAINER,
      { ...job, status },
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ??
        `Failed to update BlobIntakeJobDocument id=${job.id} to status=${status}`,
      );
    }
  }

  private async markJobsQueued(
    events: VendorDomainEvent[],
    tenantId: string,
    context: BlobSyncAdapterContext,
  ): Promise<void> {
    for (const event of events) {
      const job = await this.loadIntakeJob(event.vendorOrderId, tenantId, context);
      if (!job) continue;
      await this.updateIntakeJobStatus(job, 'queued', context);
    }
  }
}

function inferCategory(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.pdf': return 'document';
    case '.csv': return 'data';
    case '.xlsx':
    case '.xls': return 'spreadsheet';
    case '.json': return 'data';
    case '.xml': return 'data';
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.tiff': return 'image';
    default: return 'file';
  }
}
