import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { BlobStorageService } from './blob-storage.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type {
  BulkIngestionFailure,
  BulkIngestionJob,
  BulkIngestionItem,
  BulkIngestionManualReviewItem,
} from '../types/bulk-ingestion.types.js';
import type {
  BaseEvent,
  BulkIngestionProcessedEvent,
  BulkIngestionRequestedEvent,
  EventHandler,
} from '../types/events.js';

export class BulkIngestionProcessorService {
  private readonly logger = new Logger('BulkIngestionProcessorService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly eventPublisher: ServiceBusEventPublisher;
  private readonly blobStorageService: BlobStorageService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService, blobStorageService?: BlobStorageService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.blobStorageService = blobStorageService ?? new BlobStorageService();
    this.eventPublisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-processor-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionProcessorService already started');
      return;
    }

    try {
      await this.subscriber.subscribe<BulkIngestionRequestedEvent>(
        'bulk.ingestion.requested',
        this.makeHandler('bulk.ingestion.requested', this.onBulkIngestionRequested.bind(this)),
      );
      this.isStarted = true;
      this.isRunning = true;
      this.logger.info('BulkIngestionProcessorService started');
    } catch (err) {
      this.isRunning = false;
      this.logger.error('BulkIngestionProcessorService failed to start', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.requested').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionProcessorService stopped');
  }

  private makeHandler<T extends BaseEvent>(eventType: string, fn: (event: T) => Promise<void>): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (err) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: (err as Error).message,
            eventId: event.id,
          });
          throw err;
        }
      },
    };
  }

  private async onBulkIngestionRequested(event: BulkIngestionRequestedEvent): Promise<void> {
    const { jobId, tenantId, ingestionMode, sharedStorage } = event.data;

    if (!jobId || !tenantId) {
      throw new Error(`Invalid bulk.ingestion.requested payload: jobId='${jobId}', tenantId='${tenantId}'`);
    }

    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found for tenant '${tenantId}'`);
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      this.logger.info('Skipping already terminal bulk ingestion job', {
        jobId,
        status: job.status,
      });
      return;
    }

    let workingJob: BulkIngestionJob = {
      ...job,
      status: 'PROCESSING',
    };

    try {
      if (ingestionMode === 'SHARED_STORAGE') {
        if (!sharedStorage) {
          throw new Error(`Job '${jobId}' is SHARED_STORAGE but event.sharedStorage is missing`);
        }

        const skipBlobCopy = process.env.BULK_INGESTION_SKIP_BLOB_COPY === 'true';
        if (skipBlobCopy) {
          // Dev/test mode: skip actual blob copy, synthesize blob names from shared-storage config
          // so downstream pipeline stages have valid references without real Azure Storage access.
          const dataFileName = sharedStorage.dataFileBlobName.split('/').pop();
          if (!dataFileName) {
            throw new Error(
              `Job '${jobId}' sharedStorage.dataFileBlobName must include a file name. Received '${sharedStorage.dataFileBlobName}'.`,
            );
          }

          this.logger.warn('BULK_INGESTION_SKIP_BLOB_COPY=true: skipping blob copy (dev/test mode only)', {
            jobId,
            tenantId,
            sourceAccount: sharedStorage.storageAccountName,
          });
          workingJob = {
            ...workingJob,
            dataFileBlobName: `bulk-ingestion/${tenantId}/${jobId}/copied/data/${dataFileName}`,
            dataFileName,
            documentBlobMap: Object.fromEntries(
              sharedStorage.documentBlobNames.map((name) => [
                name,
                `bulk-ingestion/${tenantId}/${jobId}/copied/document/${name.split('/').pop()}`,
              ]),
            ),
          };
        } else {
          workingJob = await this.copySharedStorageArtifacts(workingJob, sharedStorage);
        }
      } else if (ingestionMode === 'MULTIPART') {
        if (!workingJob.dataFileBlobName) {
          throw new Error(`Job '${jobId}' in MULTIPART mode is missing dataFileBlobName`);
        }
      }

      const { processedJob, manualReviewItems } = this.processItems(workingJob);
      for (const reviewItem of manualReviewItems) {
        const queueResult = await this.dbService.createItem<BulkIngestionManualReviewItem>(
          'bulk-portfolio-jobs',
          reviewItem,
        );

        if (!queueResult.success) {
          throw new Error(
            `Failed to persist bulk ingestion manual review item '${reviewItem.id}' for job '${workingJob.id}'`,
          );
        }
      }

      const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', processedJob);
      if (!saveResult.success || !saveResult.data) {
        throw new Error(`Failed to persist processed job '${jobId}'`);
      }

      await this.publishProcessedEvent(processedJob);

      this.logger.info('Bulk ingestion job processed', {
        jobId,
        tenantId,
        status: processedJob.status,
        successItems: processedJob.successItems,
        failedItems: processedJob.failedItems,
        manualReviewCount: manualReviewItems.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown processing error';
      const failedJob: BulkIngestionJob = {
        ...workingJob,
        status: 'FAILED',
        pendingItems: 0,
        failedItems: workingJob.totalItems,
        successItems: 0,
        completedAt: new Date().toISOString(),
        lastError: message,
      };
      await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', failedJob);
      await this.publishProcessedEvent(failedJob);
      throw error;
    }
  }

  private async publishProcessedEvent(job: BulkIngestionJob): Promise<void> {
    if (!job.completedAt) {
      return;
    }

    const event: BulkIngestionProcessedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.processed',
      timestamp: new Date(),
      source: 'bulk-ingestion-processor-service',
      version: '1.0',
      category: EventCategory.DOCUMENT,
      data: {
        jobId: job.id,
        tenantId: job.tenantId,
        clientId: job.clientId,
        ingestionMode: job.ingestionMode,
        status: job.status === 'COMPLETED' ? 'COMPLETED' : job.status === 'PARTIAL' ? 'PARTIAL' : 'FAILED',
        adapterKey: job.adapterKey,
        totalItems: job.totalItems,
        successItems: job.successItems,
        failedItems: job.failedItems,
        completedAt: job.completedAt,
        ...(job.lastError ? { lastError: job.lastError } : {}),
        priority: job.status === 'FAILED' ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.eventPublisher.publish(event);
  }

  private processItems(job: BulkIngestionJob): {
    processedJob: BulkIngestionJob;
    manualReviewItems: BulkIngestionManualReviewItem[];
  } {
    const now = new Date().toISOString();
    const updatedItems: BulkIngestionItem[] = [];
    const manualReviewItems: BulkIngestionManualReviewItem[] = [];

    for (const item of job.items) {
      const existingFailures = [...item.failures];
      const newFailures: BulkIngestionFailure[] = [];
      const rowLabel = `rowIndex=${item.rowIndex}`;
      let matchedDocumentBlob: string | undefined;
      let matchedDocumentNames: string[] = [...item.matchedDocumentFileNames];
      let resolvedBlobNames: string[] = [];

      if (!item.source.loanNumber?.trim() && !item.source.externalId?.trim()) {
        newFailures.push({
          code: 'MISSING_IDENTIFIER',
          stage: 'validation',
          message: `Item ${rowLabel} is missing both loanNumber and externalId`,
          retryable: false,
          occurredAt: now,
        });
      }

      if (item.source.documentFileName) {
        const association = this.associateDocumentBlobDeterministically(job, item.source.documentFileName);
        if (association.status === 'matched') {
          matchedDocumentBlob = association.blobName;
          matchedDocumentNames = association.matchedInputNames;
        } else if (association.status === 'ambiguous') {
          newFailures.push({
            code: 'DOCUMENT_ASSOCIATION_AMBIGUOUS',
            stage: 'artifact-resolution',
            message: `Multiple staged documents match '${item.source.documentFileName}'. Manual review required.`,
            retryable: false,
            occurredAt: now,
          });

          manualReviewItems.push({
            id: `bulk-manual-review-${uuidv4()}`,
            type: 'bulk-ingestion-manual-review-item',
            tenantId: job.tenantId,
            clientId: job.clientId,
            jobId: job.id,
            itemId: item.id,
            rowIndex: item.rowIndex,
            adapterKey: job.adapterKey,
            status: 'QUEUED',
            reasonCode: 'DOCUMENT_ASSOCIATION_AMBIGUOUS',
            reason: `Ambiguous document association for '${item.source.documentFileName}'`,
            requestedDocumentFileName: item.source.documentFileName,
            candidateDocumentBlobNames: association.candidateBlobNames,
            createdAt: now,
            createdBy: 'bulk-ingestion-processor-service',
          });
        } else {
          newFailures.push({
            code: 'DOCUMENT_BLOB_NOT_FOUND',
            stage: 'artifact-resolution',
            message: `No staged document blob found for '${item.source.documentFileName}'`,
            retryable: true,
            occurredAt: now,
          });

          manualReviewItems.push({
            id: `bulk-manual-review-${uuidv4()}`,
            type: 'bulk-ingestion-manual-review-item',
            tenantId: job.tenantId,
            clientId: job.clientId,
            jobId: job.id,
            itemId: item.id,
            rowIndex: item.rowIndex,
            adapterKey: job.adapterKey,
            status: 'QUEUED',
            reasonCode: 'DOCUMENT_NOT_FOUND',
            reason: `No staged document blob matched '${item.source.documentFileName}'`,
            requestedDocumentFileName: item.source.documentFileName,
            candidateDocumentBlobNames: [],
            createdAt: now,
            createdBy: 'bulk-ingestion-processor-service',
          });
        }
      }

      // Multi-doc: items.*.documentFileNames[] (T3.3) — used when caller specifies multiple PDFs per row.
      // Mutually exclusive with documentFileName; documentFileNames takes precedence when both somehow present.
      if (!item.source.documentFileName && item.source.documentFileNames && item.source.documentFileNames.length > 0) {
        const blobs: string[] = [];
        const names: string[] = [];
        let multiDocFailed = false;
        for (const docName of item.source.documentFileNames) {
          const association = this.associateDocumentBlobDeterministically(job, docName);
          if (association.status === 'matched') {
            blobs.push(association.blobName);
            names.push(...association.matchedInputNames);
          } else if (association.status === 'ambiguous') {
            newFailures.push({
              code: 'DOCUMENT_ASSOCIATION_AMBIGUOUS',
              stage: 'artifact-resolution',
              message: `Multiple staged documents match '${docName}'. Manual review required.`,
              retryable: false,
              occurredAt: now,
            });
            manualReviewItems.push({
              id: `bulk-manual-review-${uuidv4()}`,
              type: 'bulk-ingestion-manual-review-item',
              tenantId: job.tenantId,
              clientId: job.clientId,
              jobId: job.id,
              itemId: item.id,
              rowIndex: item.rowIndex,
              adapterKey: job.adapterKey,
              status: 'QUEUED',
              reasonCode: 'DOCUMENT_ASSOCIATION_AMBIGUOUS',
              reason: `Ambiguous document association for '${docName}'`,
              requestedDocumentFileName: docName,
              candidateDocumentBlobNames: association.candidateBlobNames,
              createdAt: now,
              createdBy: 'bulk-ingestion-processor-service',
            });
            multiDocFailed = true;
            break;
          } else {
            newFailures.push({
              code: 'DOCUMENT_BLOB_NOT_FOUND',
              stage: 'artifact-resolution',
              message: `No staged document blob found for '${docName}'`,
              retryable: true,
              occurredAt: now,
            });
            manualReviewItems.push({
              id: `bulk-manual-review-${uuidv4()}`,
              type: 'bulk-ingestion-manual-review-item',
              tenantId: job.tenantId,
              clientId: job.clientId,
              jobId: job.id,
              itemId: item.id,
              rowIndex: item.rowIndex,
              adapterKey: job.adapterKey,
              status: 'QUEUED',
              reasonCode: 'DOCUMENT_NOT_FOUND',
              reason: `No staged document blob matched '${docName}'`,
              requestedDocumentFileName: docName,
              candidateDocumentBlobNames: [],
              createdAt: now,
              createdBy: 'bulk-ingestion-processor-service',
            });
            multiDocFailed = true;
            break;
          }
        }
        if (!multiDocFailed) {
          matchedDocumentBlob = blobs[0]; // first blob for backward compat
          matchedDocumentNames = names;
          resolvedBlobNames = blobs;
        }
      }

      if (newFailures.length > 0) {
        updatedItems.push({
          ...item,
          status: 'FAILED',
          failures: [...existingFailures, ...newFailures],
          updatedAt: now,
        });
        continue;
      }

      updatedItems.push({
        ...item,
        status: 'COMPLETED',
        matchedDocumentFileNames: matchedDocumentNames,
        canonicalRecord: {
          loanNumber: item.source.loanNumber,
          externalId: item.source.externalId,
          propertyAddress: item.source.propertyAddress,
          adapterKey: job.adapterKey,
          dataFileBlobName: job.dataFileBlobName,
          ...(matchedDocumentBlob ? { documentBlobName: matchedDocumentBlob } : {}),
          ...(resolvedBlobNames.length > 1 ? { documentBlobNames: resolvedBlobNames } : {}),
          // Include all source loan/property fields so criteria rules can evaluate them
          ...(item.source.loanAmount !== undefined ? { loanAmount: item.source.loanAmount } : {}),
          ...(item.source.propertyType !== undefined ? { propertyType: item.source.propertyType } : {}),
          ...(item.source.city !== undefined ? { city: item.source.city } : {}),
          ...(item.source.state !== undefined ? { state: item.source.state } : {}),
          ...(item.source.zipCode !== undefined ? { zipCode: item.source.zipCode } : {}),
          ...(item.source.borrowerName !== undefined ? { borrowerName: item.source.borrowerName } : {}),
          ...(item.source.loanType !== undefined ? { loanType: item.source.loanType } : {}),
          ...(item.source.loanPurpose !== undefined ? { loanPurpose: item.source.loanPurpose } : {}),
          ...(item.source.occupancyType !== undefined ? { occupancyType: item.source.occupancyType } : {}),
        },
        updatedAt: now,
      });
    }

    const successItems = updatedItems.filter((item) => item.status === 'COMPLETED').length;
    const failedItems = updatedItems.filter((item) => item.status === 'FAILED').length;
    const pendingItems = 0;

    const status =
      failedItems === 0
        ? 'COMPLETED'
        : successItems > 0
          ? 'PARTIAL'
          : 'FAILED';

    const processedJob: BulkIngestionJob = {
      ...job,
      status,
      successItems,
      failedItems,
      pendingItems,
      completedAt: new Date().toISOString(),
      items: updatedItems,
      ...(failedItems > 0
        ? {
            lastError:
              updatedItems
                .flatMap((item) => item.failures)
                .find((failure) => failure.code === 'DOCUMENT_BLOB_NOT_FOUND' || failure.code === 'MISSING_IDENTIFIER')
                ?.message ?? 'One or more ingestion items failed',
          }
        : {}),
    };

    return {
      processedJob,
      manualReviewItems,
    };
  }

  private associateDocumentBlobDeterministically(
    job: BulkIngestionJob,
    requestedName?: string,
  ):
    | { status: 'matched'; blobName: string; matchedInputNames: string[] }
    | { status: 'not_found' }
    | { status: 'ambiguous'; candidateBlobNames: string[] } {
    if (!requestedName?.trim()) {
      return { status: 'not_found' };
    }

    const blobMap = job.documentBlobMap ?? {};
    const normalizedRequested = requestedName.trim().toLowerCase();
    const requestedBase = this.basename(normalizedRequested);
    const requestedStem = this.fileStem(requestedBase);

    const entries = Object.entries(blobMap).map(([key, blobName]) => ({
      key,
      blobName,
      normalizedKey: key.trim().toLowerCase(),
      normalizedBase: this.basename(key.trim().toLowerCase()),
      normalizedStem: this.fileStem(this.basename(key.trim().toLowerCase())),
    }));

    const exactMatches = entries.filter((entry) => entry.normalizedKey === normalizedRequested);
    if (exactMatches.length === 1 && exactMatches[0]) {
      return {
        status: 'matched',
        blobName: exactMatches[0].blobName,
        matchedInputNames: [exactMatches[0].key],
      };
    }

    const basenameMatches = entries.filter((entry) => entry.normalizedBase === requestedBase);
    const uniqueBasenameBlobNames = Array.from(new Set(basenameMatches.map((entry) => entry.blobName))).sort();
    if (uniqueBasenameBlobNames.length === 1 && uniqueBasenameBlobNames[0]) {
      return {
        status: 'matched',
        blobName: uniqueBasenameBlobNames[0],
        matchedInputNames: basenameMatches.map((entry) => entry.key).sort(),
      };
    }
    if (uniqueBasenameBlobNames.length > 1) {
      return {
        status: 'ambiguous',
        candidateBlobNames: uniqueBasenameBlobNames,
      };
    }

    const stemMatches = entries.filter((entry) => entry.normalizedStem === requestedStem);
    const uniqueStemBlobNames = Array.from(new Set(stemMatches.map((entry) => entry.blobName))).sort();
    if (uniqueStemBlobNames.length === 1 && uniqueStemBlobNames[0]) {
      return {
        status: 'matched',
        blobName: uniqueStemBlobNames[0],
        matchedInputNames: stemMatches.map((entry) => entry.key).sort(),
      };
    }
    if (uniqueStemBlobNames.length > 1) {
      return {
        status: 'ambiguous',
        candidateBlobNames: uniqueStemBlobNames,
      };
    }

    return { status: 'not_found' };
  }

  private async copySharedStorageArtifacts(
    job: BulkIngestionJob,
    sharedStorage: {
      storageAccountName: string;
      containerName: string;
      dataFileBlobName: string;
      documentBlobNames: string[];
      pathPrefix?: string;
    },
  ): Promise<BulkIngestionJob> {
    const targetContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!targetContainerName) {
      throw new Error('STORAGE_CONTAINER_DOCUMENTS is required for shared-storage ingestion processing');
    }

    const targetPrefix = `bulk-ingestion/${job.tenantId}/${job.id}/copied`;
    const dataTargetBlobName = `${targetPrefix}/data/${this.basename(sharedStorage.dataFileBlobName)}`;

    const copiedData = await this.copyBlobBetweenAccounts(
      sharedStorage.storageAccountName,
      sharedStorage.containerName,
      sharedStorage.dataFileBlobName,
      targetContainerName,
      dataTargetBlobName,
      {
        tenantId: job.tenantId,
        ingestionJobId: job.id,
        sourceContainer: sharedStorage.containerName,
      },
    );

    const documentBlobMap: Record<string, string> = { ...(job.documentBlobMap ?? {}) };
    for (const sourceBlobName of sharedStorage.documentBlobNames) {
      const targetBlobName = `${targetPrefix}/document/${this.basename(sourceBlobName)}`;
      const copiedDoc = await this.copyBlobBetweenAccounts(
        sharedStorage.storageAccountName,
        sharedStorage.containerName,
        sourceBlobName,
        targetContainerName,
        targetBlobName,
        {
          tenantId: job.tenantId,
          ingestionJobId: job.id,
          sourceContainer: sharedStorage.containerName,
        },
      );

      const sourceBaseName = this.basename(sourceBlobName);
      documentBlobMap[sourceBlobName] = copiedDoc.blobName;
      documentBlobMap[sourceBaseName] = copiedDoc.blobName;
    }

    return {
      ...job,
      dataFileBlobName: copiedData.blobName,
      dataFileBlobUrl: copiedData.url,
      dataFileName: this.basename(sharedStorage.dataFileBlobName),
      documentBlobMap,
      documentFileNames:
        job.documentFileNames.length > 0
          ? job.documentFileNames
          : sharedStorage.documentBlobNames.map((name) => this.basename(name)),
    };
  }

  private async copyBlobBetweenAccounts(
    sourceAccountName: string,
    sourceContainerName: string,
    sourceBlobName: string,
    targetContainerName: string,
    targetBlobName: string,
    metadata?: Record<string, string>,
  ): Promise<{ blobName: string; url: string }> {
    const sourceBuffer = await this.downloadBlobFromAccount(sourceAccountName, sourceContainerName, sourceBlobName);
    const uploaded = await this.blobStorageService.uploadBlob({
      containerName: targetContainerName,
      blobName: targetBlobName,
      data: sourceBuffer,
      contentType: 'application/octet-stream',
      ...(metadata ? { metadata } : {}),
    });

    return {
      blobName: uploaded.blobName,
      url: uploaded.url,
    };
  }

  private async downloadBlobFromAccount(
    accountName: string,
    containerName: string,
    blobName: string,
  ): Promise<Buffer> {
    const accountUrl = `https://${accountName}.blob.core.windows.net`;
    const client = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
    const blobClient = client.getContainerClient(containerName).getBlockBlobClient(blobName);
    const response = await blobClient.download(0);

    if (!response.readableStreamBody) {
      throw new Error(
        `Blob '${blobName}' from container '${containerName}' in account '${accountName}' returned no stream body`,
      );
    }

    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async getJob(jobId: string, tenantId: string): Promise<BulkIngestionJob | null> {
    const result = await this.dbService.queryItems<BulkIngestionJob>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId',
      [
        { name: '@type', value: 'bulk-ingestion-job' },
        { name: '@id', value: jobId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data) {
      throw new Error(`Failed to load bulk ingestion job '${jobId}'`);
    }

    return result.data[0] ?? null;
  }

  private basename(pathValue: string): string {
    return pathValue.split('/').filter(Boolean).pop() ?? pathValue;
  }

  private fileStem(fileName: string): string {
    const idx = fileName.lastIndexOf('.');
    return idx > 0 ? fileName.slice(0, idx) : fileName;
  }
}
