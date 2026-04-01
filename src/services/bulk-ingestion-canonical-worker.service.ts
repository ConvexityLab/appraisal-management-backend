import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type {
  BaseEvent,
  BulkIngestionCanonicalizedEvent,
  BulkIngestionOrderingRequestedEvent,
  BulkIngestionProcessedEvent,
  EventHandler,
} from '../types/events.js';
import type {
  BulkIngestionCanonicalFailure,
  BulkIngestionCanonicalRecord,
  BulkIngestionCanonicalizationSummary,
  BulkIngestionJob,
  BulkIngestionItem,
} from '../types/bulk-ingestion.types.js';

type CanonicalValidationResult =
  | {
      ok: true;
      canonicalData: Record<string, unknown>;
      documentBlobName?: string;
      diagnostics?: Record<string, unknown>;
    }
  | {
      ok: false;
      code: string;
      message: string;
      stage: 'adapter-registry' | 'canonical-validation' | 'persistence';
      severity: 'warning' | 'error';
      diagnostics?: Record<string, unknown>;
    };

type AdapterCanonicalizer = {
  adapterKey: string;
  canonicalize: (job: BulkIngestionJob, item: BulkIngestionItem) => CanonicalValidationResult;
};

export class BulkIngestionCanonicalWorkerService {
  private readonly logger = new Logger('BulkIngestionCanonicalWorkerService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly adapterRegistry: Map<string, AdapterCanonicalizer>;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-canonical-worker-service',
    );
    this.adapterRegistry = this.buildAdapterRegistry();
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionCanonicalWorkerService already started');
      return;
    }

    await this.subscriber.subscribe<BulkIngestionProcessedEvent>(
      'bulk.ingestion.processed',
      this.makeHandler('bulk.ingestion.processed', this.onBulkIngestionProcessed.bind(this)),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionCanonicalWorkerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.processed').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionCanonicalWorkerService stopped');
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

  private async onBulkIngestionProcessed(event: BulkIngestionProcessedEvent): Promise<void> {
    const { jobId, tenantId, clientId, adapterKey, status } = event.data;

    if (!jobId || !tenantId || !clientId || !adapterKey) {
      throw new Error(
        `Invalid bulk.ingestion.processed payload: jobId='${jobId}', tenantId='${tenantId}', clientId='${clientId}', adapterKey='${adapterKey}'`,
      );
    }

    if (status === 'FAILED') {
      this.logger.info('Skipping canonical persistence for fully failed ingestion job', {
        jobId,
        tenantId,
      });
      return;
    }

    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found for tenant '${tenantId}'`);
    }

    const candidateItems = job.items.filter((item) => item.status === 'COMPLETED');
    const failures: BulkIngestionCanonicalFailure[] = [];
    let persistedCount = 0;
    const now = new Date().toISOString();

    for (const item of candidateItems) {
      const validation = this.validateAndBuildCanonical(job, item);
      if (!validation.ok) {
        failures.push({
          itemId: item.id,
          rowIndex: item.rowIndex,
          code: validation.code,
          message: validation.message,
          stage: validation.stage,
          severity: validation.severity,
          ...(validation.diagnostics ? { diagnostics: validation.diagnostics } : {}),
        });
        continue;
      }

      const record: BulkIngestionCanonicalRecord = {
        id: `bulk-canonical-${job.id}-${item.rowIndex}`,
        type: 'bulk-ingestion-canonical-record',
        tenantId: job.tenantId,
        clientId: job.clientId,
        jobId: job.id,
        itemId: item.id,
        rowIndex: item.rowIndex,
        adapterKey: job.adapterKey,
        canonicalData: validation.canonicalData,
        sourceData: {
          ...(item.source.loanNumber !== undefined ? { loanNumber: item.source.loanNumber } : {}),
          ...(item.source.externalId !== undefined ? { externalId: item.source.externalId } : {}),
          ...(item.source.propertyAddress !== undefined ? { propertyAddress: item.source.propertyAddress } : {}),
          ...(item.source.documentFileName !== undefined
            ? { documentFileName: item.source.documentFileName }
            : {}),
        },
        ...(validation.documentBlobName ? { documentBlobName: validation.documentBlobName } : {}),
        persistedAt: now,
      };

      const saveResult = await this.dbService.upsertItem<BulkIngestionCanonicalRecord>('bulk-portfolio-jobs', record);
      if (!saveResult.success || !saveResult.data) {
        failures.push({
          itemId: item.id,
          rowIndex: item.rowIndex,
          code: 'PERSIST_FAILED',
          message: `Failed to persist canonical record for item '${item.id}'`,
          stage: 'persistence',
          severity: 'error',
          diagnostics: {
            adapterKey: job.adapterKey,
            recordId: record.id,
          },
        });
        continue;
      }

      persistedCount++;
    }

    const summary: BulkIngestionCanonicalizationSummary = {
      id: `bulk-canonical-summary-${job.id}`,
      type: 'bulk-ingestion-canonicalization-summary',
      tenantId: job.tenantId,
      clientId: job.clientId,
      jobId: job.id,
      adapterKey: job.adapterKey,
      totalCandidateItems: candidateItems.length,
      persistedCount,
      failedCount: failures.length,
      failures,
      processedAt: now,
    };

    await this.dbService.upsertItem<BulkIngestionCanonicalizationSummary>('bulk-portfolio-jobs', summary);
    await this.publishCanonicalizedEvent(summary);
    await this.publishOrderingRequestedEvent(summary);

    this.logger.info('Bulk ingestion canonical validation/persistence complete', {
      jobId,
      tenantId,
      adapterKey,
      totalCandidateItems: summary.totalCandidateItems,
      persistedCount: summary.persistedCount,
      failedCount: summary.failedCount,
    });
  }

  private validateAndBuildCanonical(job: BulkIngestionJob, item: BulkIngestionItem): CanonicalValidationResult {
    const normalizedAdapter = job.adapterKey.toLowerCase();
    const canonicalizer = this.adapterRegistry.get(normalizedAdapter);
    if (!canonicalizer) {
      return {
        ok: false,
        code: 'UNSUPPORTED_ADAPTER',
        message: `Unsupported adapterKey '${job.adapterKey}' for canonicalization`,
        stage: 'adapter-registry',
        severity: 'error',
        diagnostics: {
          requestedAdapter: job.adapterKey,
          supportedAdapters: Array.from(this.adapterRegistry.keys()),
        },
      };
    }

    return canonicalizer.canonicalize(job, item);
  }

  private validateBridgeStandard(job: BulkIngestionJob, item: BulkIngestionItem): CanonicalValidationResult {
    const loanNumber = item.source.loanNumber?.trim();
    const externalId = item.source.externalId?.trim();
    const documentBlobName = this.resolveDocumentBlobName(job, item.source.documentFileName);

    if (!loanNumber && !externalId) {
      return {
        ok: false,
        code: 'BRIDGE_ID_REQUIRED',
        message: `bridge-standard requires loanNumber or externalId (item '${item.id}')`,
        stage: 'canonical-validation',
        severity: 'error',
        diagnostics: {
          itemId: item.id,
          rowIndex: item.rowIndex,
          adapterKey: job.adapterKey,
        },
      };
    }

    if (!documentBlobName) {
      return {
        ok: false,
        code: 'BRIDGE_DOCUMENT_REQUIRED',
        message: `bridge-standard requires mapped document blob for item '${item.id}'`,
        stage: 'canonical-validation',
        severity: 'error',
        diagnostics: {
          itemId: item.id,
          requestedDocumentFileName: item.source.documentFileName,
          availableMappedDocuments: Object.keys(job.documentBlobMap ?? {}),
        },
      };
    }

    return {
      ok: true,
      canonicalData: {
        sourceAdapter: 'bridge-standard',
        correlationKey: item.correlationKey,
        loanNumber,
        externalId,
        propertyAddress: item.source.propertyAddress,
        dataFileBlobName: job.dataFileBlobName,
      },
      documentBlobName,
    };
  }

  private validateBpoReport(job: BulkIngestionJob, item: BulkIngestionItem): CanonicalValidationResult {
    const documentBlobName = this.resolveDocumentBlobName(job, item.source.documentFileName);
    if (!documentBlobName) {
      return {
        ok: false,
        code: 'BPO_DOCUMENT_REQUIRED',
        message: `bpo-report-v1 requires document blob mapping for item '${item.id}'`,
        stage: 'canonical-validation',
        severity: 'error',
        diagnostics: {
          itemId: item.id,
          requestedDocumentFileName: item.source.documentFileName,
          availableMappedDocuments: Object.keys(job.documentBlobMap ?? {}),
        },
      };
    }

    return {
      ok: true,
      canonicalData: {
        sourceAdapter: 'bpo-report-v1',
        correlationKey: item.correlationKey,
        propertyAddress: item.source.propertyAddress,
        externalId: item.source.externalId,
        bpoDocumentType: 'BPO_REPORT',
      },
      documentBlobName,
    };
  }

  private buildAdapterRegistry(): Map<string, AdapterCanonicalizer> {
    const canonicalizers: AdapterCanonicalizer[] = [
      {
        adapterKey: 'bridge-standard',
        canonicalize: (job, item) => this.validateBridgeStandard(job, item),
      },
      {
        adapterKey: 'bpo-report-v1',
        canonicalize: (job, item) => this.validateBpoReport(job, item),
      },
    ];

    const registry = new Map<string, AdapterCanonicalizer>();
    for (const canonicalizer of canonicalizers) {
      registry.set(canonicalizer.adapterKey.toLowerCase(), canonicalizer);
    }

    return registry;
  }

  private resolveDocumentBlobName(job: BulkIngestionJob, sourceDocumentName?: string): string | undefined {
    if (!sourceDocumentName?.trim()) {
      return undefined;
    }

    const blobMap = job.documentBlobMap ?? {};
    if (blobMap[sourceDocumentName]) {
      return blobMap[sourceDocumentName];
    }

    const base = this.basename(sourceDocumentName).toLowerCase();
    for (const [key, value] of Object.entries(blobMap)) {
      if (this.basename(key).toLowerCase() === base) {
        return value;
      }
    }

    return undefined;
  }

  private async publishCanonicalizedEvent(summary: BulkIngestionCanonicalizationSummary): Promise<void> {
    const event: BulkIngestionCanonicalizedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.canonicalized',
      timestamp: new Date(),
      source: 'bulk-ingestion-canonical-worker-service',
      version: '1.0',
      category: EventCategory.DOCUMENT,
      data: {
        jobId: summary.jobId,
        tenantId: summary.tenantId,
        clientId: summary.clientId,
        adapterKey: summary.adapterKey,
        totalCandidateItems: summary.totalCandidateItems,
        persistedCount: summary.persistedCount,
        failedCount: summary.failedCount,
        processedAt: summary.processedAt,
        priority: summary.failedCount > 0 ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(event);
  }

  private async publishOrderingRequestedEvent(summary: BulkIngestionCanonicalizationSummary): Promise<void> {
    const event: BulkIngestionOrderingRequestedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.ordering.requested',
      timestamp: new Date(),
      source: 'bulk-ingestion-canonical-worker-service',
      version: '1.0',
      category: EventCategory.DOCUMENT,
      data: {
        jobId: summary.jobId,
        tenantId: summary.tenantId,
        clientId: summary.clientId,
        adapterKey: summary.adapterKey,
        totalCandidateItems: summary.totalCandidateItems,
        persistedCount: summary.persistedCount,
        failedCount: summary.failedCount,
        processedAt: summary.processedAt,
        priority: summary.failedCount > 0 ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(event);
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
}
