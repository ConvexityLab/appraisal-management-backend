/**
 * BlobCreatedBlobSyncAdapter
 *
 * Handles 'blob-created' flavor BlobSyncMessages — triggered when Azure Event Grid
 * fires a Microsoft.Storage.BlobCreated event on the client's storage account and
 * routes it to the blob-sync-events Service Bus queue.
 *
 * Unlike the Data Share adapter, this processes a single blob per message.
 * No cursor management is needed — the event carries the exact blob URL and eTag.
 */

import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Logger } from '../../utils/logger.js';
import type {
  BlobIntakeJobDocument,
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

export class BlobCreatedBlobSyncAdapter implements BlobSyncAdapter {
  readonly supportedFlavor = 'blob-created' as const;

  private readonly logger = new Logger('BlobCreatedBlobSyncAdapter');

  canHandle(message: BlobSyncMessage, connection: VendorConnection): boolean {
    return (
      message.flavor === 'blob-created' &&
      connection.blobConfig !== undefined &&
      message.blobUrl !== undefined
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
        `BlobCreatedBlobSyncAdapter: VendorConnection ${connection.id} has no blobConfig. ` +
        'Set blobConfig on the connection to enable blob-drop processing.',
      );
    }

    if (!message.blobUrl) {
      throw new Error(
        `BlobCreatedBlobSyncAdapter: blob-created message is missing blobUrl ` +
        `(vendorType=${message.vendorType}, messageId=${message.messageId})`,
      );
    }

    // ── Parse blob path from URL ─────────────────────────────────────────────
    // URL format: https://<account>.blob.core.windows.net/<container>/<blobPath>
    const parsedUrl = new URL(message.blobUrl);
    const urlSegments = parsedUrl.pathname.replace(/^\//, '').split('/');
    if (urlSegments.length < 2) {
      throw new Error(
        `BlobCreatedBlobSyncAdapter: cannot parse blobUrl into container+path: ${message.blobUrl}`,
      );
    }
    const containerFromUrl = urlSegments[0];
    const blobPath = urlSegments.slice(1).join('/');

    // Validate the container matches the configured receivedContainerName
    if (containerFromUrl !== blobConfig.receivedContainerName) {
      this.logger.warn('BlobCreated event container does not match configured receivedContainerName — skipping', {
        urlContainer: containerFromUrl,
        configuredContainer: blobConfig.receivedContainerName,
        blobUrl: message.blobUrl,
        connectionId: connection.id,
      });
      return { blobsEnumerated: 1, jobsCreated: 0, jobsSkipped: 1, jobsRequeued: 0 };
    }

    // ── Extension filter ─────────────────────────────────────────────────────
    const ext = path.extname(blobPath).toLowerCase();
    if (!blobConfig.acceptedExtensions.map(e => e.toLowerCase()).includes(ext)) {
      this.logger.debug('Skipping blob with non-accepted extension', {
        blobPath, ext, acceptedExtensions: blobConfig.acceptedExtensions,
      });
      return { blobsEnumerated: 1, jobsCreated: 0, jobsSkipped: 1, jobsRequeued: 0 };
    }

    // ── Path token parsing ───────────────────────────────────────────────────
    const tokens = parseBlobPathTokens(blobPath, blobConfig.blobPathPattern);
    if (!tokens) {
      this.logger.warn('Blob path does not match blobPathPattern — skipping', {
        blobPath,
        pattern: blobConfig.blobPathPattern,
        connectionId: connection.id,
      });
      return { blobsEnumerated: 1, jobsCreated: 0, jobsSkipped: 1, jobsRequeued: 0 };
    }

    const subClientId = tokens['subClientRef'] ?? 'unknown';
    const filename = tokens['filename'] ?? path.basename(blobPath);

    // ── Resolve eTag ─────────────────────────────────────────────────────────
    // Prefer eTag from the event; fetch from storage if absent.
    let eTag = message.eTag ?? '';
    let contentLengthBytes = message.contentLengthBytes;

    if (!eTag) {
      const blobInfo = await context.blobClient.getBlobInfo(
        blobConfig.storageAccountName,
        blobConfig.receivedContainerName,
        blobPath,
      );
      if (!blobInfo) {
        this.logger.warn('Blob no longer exists after BlobCreated event — skipping', {
          blobPath, connectionId: connection.id,
        });
        return { blobsEnumerated: 1, jobsCreated: 0, jobsSkipped: 1, jobsRequeued: 0 };
      }
      eTag = blobInfo.eTag;
      contentLengthBytes = blobInfo.contentLength;
    }

    // ── SHA-256 fingerprint ───────────────────────────────────────────────────
    const fileId = createHash('sha256')
      .update(`${blobConfig.storageAccountName}:${blobConfig.receivedContainerName}:${blobPath}:${eTag}`)
      .digest('hex');

    // ── Idempotency check ─────────────────────────────────────────────────────
    const existingJob = await this.loadIntakeJob(fileId, connection.tenantId, context);

    if (existingJob) {
      if (existingJob.status === 'failed' && existingJob.retryCount < (blobConfig.maxRetries ?? 3)) {
        await this.updateIntakeJobStatus(existingJob, 'received', context);
        // Fall through to re-emit the event
      } else {
        return { blobsEnumerated: 1, jobsCreated: 0, jobsSkipped: 1, jobsRequeued: 0 };
      }
    }

    // ── Create BlobIntakeJobDocument ─────────────────────────────────────────
    const receivedAt = new Date().toISOString();
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
      blobPath,
      eTag,
      ...(contentLengthBytes !== undefined ? { contentLengthBytes } : {}),
      filename,
      syncRunId: 'blob-created',
      status: 'received',
      retryCount: 0,
      receivedAt,
    };

    await this.createIntakeJob(job, context);

    // ── Build and publish VendorDomainEvent ──────────────────────────────────
    const fileRef: VendorFileRef = {
      fileId,
      filename,
      category: inferCategory(ext),
      storageAccountName: blobConfig.storageAccountName,
      containerName: blobConfig.receivedContainerName,
      blobPath,
      eTag,
      ...(contentLengthBytes !== undefined ? { contentLengthBytes } : {}),
      subClientId,
      taskType: blobConfig.taskType,
    };

    const event: VendorDomainEvent = {
      id: randomUUID(),
      eventType: 'vendor.file.received',
      vendorType: connection.vendorType,
      vendorOrderId: fileId,
      ourOrderId: null,
      lenderId: connection.lenderId,
      tenantId: connection.tenantId,
      occurredAt: receivedAt,
      payload: { fileRefs: [fileRef] },
      clientId: connection.inboundIdentifier,
      subClientId,
      taskType: blobConfig.taskType,
    };

    await context.outboxService.persistBlobSyncEvents(connection, [event]);

    // Mark intake job as queued
    await this.updateIntakeJobStatus(job, 'queued', context);

    this.logger.info('BlobCreated event processed', {
      connectionId: connection.id,
      vendorType: connection.vendorType,
      fileId,
      blobPath,
      subClientId,
      taskType: blobConfig.taskType,
    });

    return { blobsEnumerated: 1, jobsCreated: 1, jobsSkipped: 0, jobsRequeued: 0 };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

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
        result.error?.message ?? `Failed to create BlobIntakeJobDocument id=${job.id}`,
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
