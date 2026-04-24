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
  BulkAdapterDefinition,
  BulkAdapterDefinitionValueSource,
  BulkIngestionCanonicalFailure,
  BulkIngestionCanonicalRecord,
  BulkIngestionCanonicalizationSummary,
  BulkIngestionJob,
  BulkIngestionItem,
} from '../types/bulk-ingestion.types.js';
import { BulkAdapterDefinitionService } from './bulk-adapter-definition.service.js';

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

export class BulkIngestionCanonicalWorkerService {
  private readonly logger = new Logger('BulkIngestionCanonicalWorkerService');
  private readonly dbService: CosmosDbService;
  private readonly adapterDefinitionService: BulkAdapterDefinitionService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.adapterDefinitionService = new BulkAdapterDefinitionService(this.dbService);
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-canonical-worker-service',
    );
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

    const adapterDefinitions = await this.adapterDefinitionService.listDefinitions(job.tenantId);
    const candidateItems = job.items.filter((item) => item.status === 'COMPLETED');
    const failures: BulkIngestionCanonicalFailure[] = [];
    let persistedCount = 0;
    const now = new Date().toISOString();

    for (const item of candidateItems) {
      const validation = this.validateAndBuildCanonical(job, item, adapterDefinitions);
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
          ...(item.source.documentFileName !== undefined ? { documentFileName: item.source.documentFileName } : {}),
          ...(item.source.city !== undefined ? { city: item.source.city } : {}),
          ...(item.source.state !== undefined ? { state: item.source.state } : {}),
          ...(item.source.zipCode !== undefined ? { zipCode: item.source.zipCode } : {}),
          ...(item.source.county !== undefined ? { county: item.source.county } : {}),
          ...(item.source.propertyType !== undefined ? { propertyType: item.source.propertyType } : {}),
          ...(item.source.borrowerName !== undefined ? { borrowerName: item.source.borrowerName } : {}),
          ...(item.source.borrowerEmail !== undefined ? { borrowerEmail: item.source.borrowerEmail } : {}),
          ...(item.source.borrowerPhone !== undefined ? { borrowerPhone: item.source.borrowerPhone } : {}),
          ...(item.source.loanAmount !== undefined ? { loanAmount: item.source.loanAmount } : {}),
          ...(item.source.loanType !== undefined ? { loanType: item.source.loanType } : {}),
          ...(item.source.loanPurpose !== undefined ? { loanPurpose: item.source.loanPurpose } : {}),
          ...(item.source.occupancyType !== undefined ? { occupancyType: item.source.occupancyType } : {}),
          ...(item.source.documentUrl !== undefined ? { documentUrl: item.source.documentUrl } : {}),
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

  private validateAndBuildCanonical(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    adapterDefinitions: BulkAdapterDefinition[],
  ): CanonicalValidationResult {
    const normalizedAdapter = job.adapterKey.toLowerCase();
    const definition = this.resolveAdapterDefinition(normalizedAdapter, adapterDefinitions);

    if (!definition) {
      return {
        ok: false,
        code: 'UNSUPPORTED_ADAPTER',
        message: `Unsupported adapterKey '${job.adapterKey}' for canonicalization`,
        stage: 'adapter-registry',
        severity: 'error',
        diagnostics: {
          requestedAdapter: job.adapterKey,
          supportedAdapters: adapterDefinitions.map((candidate) => candidate.adapterKey).sort(),
        },
      };
    }

    return this.validateAgainstDefinition(job, item, definition);
  }

  private validateAgainstDefinition(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    definition: BulkAdapterDefinition,
  ): CanonicalValidationResult {
    const documentBlobName = this.resolveDocumentBlobName(job, item.source.documentFileName);

    for (const requirement of definition.requiredAnyOf ?? []) {
      const hasValue = requirement.sources.some(
        (source) => this.resolveDefinitionValue(job, item, source, requirement.trim) !== undefined,
      );
      if (!hasValue) {
        return this.makeDefinitionFailure(job, item, requirement.code, requirement.messageTemplate, {
          itemId: item.id,
          rowIndex: item.rowIndex,
          adapterKey: job.adapterKey,
        });
      }
    }

    for (const requirement of definition.requiredFields ?? []) {
      const value = this.resolveDefinitionValue(job, item, requirement.source, requirement.trim);
      if (value === undefined) {
        return this.makeDefinitionFailure(job, item, requirement.code, requirement.messageTemplate, {
          itemId: item.id,
          rowIndex: item.rowIndex,
          adapterKey: job.adapterKey,
        });
      }
    }

    if (definition.documentRequirement?.required && !documentBlobName) {
      return this.makeDefinitionFailure(
        job,
        item,
        definition.documentRequirement.code,
        definition.documentRequirement.messageTemplate,
        {
          itemId: item.id,
          requestedDocumentFileName: item.source.documentFileName,
          availableMappedDocuments: Object.keys(job.documentBlobMap ?? {}),
        },
      );
    }

    const canonicalData: Record<string, unknown> = {
      sourceAdapter: definition.sourceAdapter,
      ...(definition.staticCanonicalData ?? {}),
    };

    for (const mapping of definition.canonicalFieldMappings) {
      const resolvedValue = this.resolveDefinitionValue(job, item, mapping.source, mapping.trim);
      if (resolvedValue !== undefined) {
        canonicalData[mapping.targetField] = resolvedValue;
      }
    }

    return {
      ok: true,
      canonicalData,
      ...(documentBlobName ? { documentBlobName } : {}),
    };
  }

  private makeDefinitionFailure(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    code: string,
    messageTemplate: string,
    diagnostics?: Record<string, unknown>,
  ): CanonicalValidationResult {
    return {
      ok: false,
      code,
      message: this.renderMessageTemplate(messageTemplate, job, item),
      stage: 'canonical-validation',
      severity: 'error',
      ...(diagnostics ? { diagnostics } : {}),
    };
  }

  private resolveAdapterDefinition(
    normalizedAdapter: string,
    definitions: BulkAdapterDefinition[],
  ): BulkAdapterDefinition | null {
    const candidates = definitions.filter((definition) => {
      if (definition.matchMode === 'EXACT') {
        return definition.adapterKey === normalizedAdapter;
      }
      return (
        definition.adapterKey === normalizedAdapter ||
        normalizedAdapter.startsWith(`${definition.adapterKey}-`)
      );
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => {
      const leftExact = left.adapterKey === normalizedAdapter ? 1 : 0;
      const rightExact = right.adapterKey === normalizedAdapter ? 1 : 0;
      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }
      if ((left.isBuiltIn ?? false) !== (right.isBuiltIn ?? false)) {
        return left.isBuiltIn ? 1 : -1;
      }
      return right.adapterKey.length - left.adapterKey.length;
    });

    return candidates[0] ?? null;
  }

  private resolveDefinitionValue(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    source: BulkAdapterDefinitionValueSource,
    trim = true,
  ): unknown {
    let value: unknown;

    switch (source) {
      case 'job.adapterKey':
        value = job.adapterKey;
        break;
      case 'job.analysisType':
        value = job.analysisType;
        break;
      case 'job.dataFileBlobName':
        value = job.dataFileBlobName;
        break;
      case 'item.id':
        value = item.id;
        break;
      case 'item.rowIndex':
        value = item.rowIndex;
        break;
      case 'item.correlationKey':
        value = item.correlationKey;
        break;
      case 'item.source.loanNumber':
        value = item.source.loanNumber;
        break;
      case 'item.source.externalId':
        value = item.source.externalId;
        break;
      case 'item.source.propertyAddress':
        value = item.source.propertyAddress;
        break;
      case 'item.source.city':
        value = item.source.city;
        break;
      case 'item.source.state':
        value = item.source.state;
        break;
      case 'item.source.zipCode':
        value = item.source.zipCode;
        break;
      case 'item.source.propertyType':
        value = item.source.propertyType;
        break;
      case 'item.source.county':
        value = item.source.county;
        break;
      case 'item.source.borrowerName':
        value = item.source.borrowerName;
        break;
      case 'item.source.borrowerEmail':
        value = item.source.borrowerEmail;
        break;
      case 'item.source.borrowerPhone':
        value = item.source.borrowerPhone;
        break;
      case 'item.source.loanAmount':
        value = item.source.loanAmount;
        break;
      case 'item.source.loanType':
        value = item.source.loanType;
        break;
      case 'item.source.loanPurpose':
        value = item.source.loanPurpose;
        break;
      case 'item.source.occupancyType':
        value = item.source.occupancyType;
        break;
      case 'item.source.documentFileName':
        value = item.source.documentFileName;
        break;
      case 'item.source.documentUrl':
        value = item.source.documentUrl;
        break;
      default:
        value = undefined;
        break;
    }

    if (typeof value === 'string') {
      const normalized = trim ? value.trim() : value;
      return normalized.length > 0 ? normalized : undefined;
    }

    return value === null ? undefined : value;
  }

  private renderMessageTemplate(
    messageTemplate: string,
    job: BulkIngestionJob,
    item: BulkIngestionItem,
  ): string {
    const replacements: Record<string, string> = {
      itemId: item.id,
      adapterKey: job.adapterKey,
      rowIndex: String(item.rowIndex),
    };

    return messageTemplate.replace(/\{(itemId|adapterKey|rowIndex)\}/g, (_, token: string) => replacements[token] ?? '');
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
