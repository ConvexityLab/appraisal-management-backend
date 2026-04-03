import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import type {
  BulkIngestionItemStatus,
  BulkIngestionCanonicalRecord,
  BulkIngestionCanonicalizationResult,
  BulkIngestionCanonicalizationSummary,
  BulkIngestionFailure,
  BulkIngestionItem,
  BulkIngestionJob,
  BulkIngestionJobStatus,
  BulkIngestionSubmitRequest,
} from '../types/bulk-ingestion.types.js';
import { EventCategory, EventPriority, type BulkIngestionRequestedEvent } from '../types/events.js';

type BulkIngestionAuditAction =
  | 'SUBMIT'
  | 'RETRY_FAILED_ITEMS'
  | 'RETRY_ITEM'
  | 'PAUSE_JOB'
  | 'RESUME_JOB'
  | 'CANCEL_JOB';

export interface BulkIngestionFailureExport {
  fileName: string;
  contentType:
    | 'text/csv; charset=utf-8'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  content: string | Buffer;
}

export type BulkIngestionFailureExportFormat = 'csv' | 'xlsx';

export type BulkIngestionFailureSort =
  | 'occurredAt_desc'
  | 'occurredAt_asc'
  | 'rowIndex_asc'
  | 'rowIndex_desc'
  | 'stage_asc'
  | 'stage_desc'
  | 'code_asc'
  | 'code_desc';

export interface BulkIngestionFailureListFilters {
  stage?: string;
  code?: string;
  retryable?: boolean;
  itemStatus?: BulkIngestionItemStatus;
  search?: string;
  sort?: BulkIngestionFailureSort;
  cursor?: string;
  limit?: number;
}

export interface BulkIngestionFailureListItem {
  jobId: string;
  itemId: string;
  rowIndex: number;
  itemStatus: BulkIngestionItemStatus;
  failureStage: string;
  failureCode: string;
  failureMessage: string;
  retryable: boolean;
  occurredAt: string;
  loanNumber: string;
  externalId: string;
  documentFileName: string;
}

export interface BulkIngestionFailureListResult {
  jobId: string;
  total: number;
  limit: number;
  prevCursor: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  sort: BulkIngestionFailureSort;
  filters: {
    stage?: string;
    code?: string;
    retryable?: boolean;
    itemStatus?: BulkIngestionItemStatus;
    search?: string;
  };
  items: BulkIngestionFailureListItem[];
}

export interface BulkIngestionJobSummary {
  id: string;
  tenantId: string;
  clientId: string;
  jobName?: string;
  adapterKey?: string;
  status: BulkIngestionJobStatus;
  submittedAt: string;
  completedAt?: string;
  totalItems: number;
  successItems: number;
  failedItems: number;
  pendingItems: number;
}

export class BulkIngestionService {
  private readonly logger = new Logger('BulkIngestionService');
  private readonly eventPublisher = new ServiceBusEventPublisher();
  private readonly stageRetryPolicy: Record<string, number> = {
    validation: 0,
    'artifact-resolution': 3,
    'canonical-validation': 2,
    'axiom-extraction': 3,
    criteria: 2,
    default: 2,
  };

  constructor(private readonly dbService: CosmosDbService) {}

  async submit(
    request: BulkIngestionSubmitRequest,
    tenantId: string,
    submittedBy: string,
  ): Promise<BulkIngestionJob> {
    const now = new Date().toISOString();
    const jobId = `bulk-ingest-${uuidv4()}`;

    const items: BulkIngestionItem[] = request.items.map((input, index) => {
      const rowIndex = input.rowIndex ?? index + 1;
      const stableKey = input.loanNumber?.trim() || input.externalId?.trim() || `${rowIndex}`;
      const correlationKey = `${jobId}::${stableKey}`;
      return {
        id: `${jobId}:${rowIndex}`,
        rowIndex,
        correlationKey,
        status: 'PENDING',
        source: input,
        matchedDocumentFileNames: input.documentFileName ? [input.documentFileName] : [],
        failures: [],
      };
    });

    const job: BulkIngestionJob = {
      id: jobId,
      type: 'bulk-ingestion-job',
      tenantId,
      clientId: request.clientId,
      ...(request.jobName !== undefined ? { jobName: request.jobName } : {}),
      analysisType: request.analysisType,
      ingestionMode: request.ingestionMode,
      status: 'PENDING',
      adapterKey: request.adapterKey,
      dataFileName: request.dataFileName,
      ...(request.dataFileBlobUrl !== undefined ? { dataFileBlobUrl: request.dataFileBlobUrl } : {}),
      ...(request.dataFileBlobName !== undefined ? { dataFileBlobName: request.dataFileBlobName } : {}),
      documentFileNames: request.documentFileNames,
      ...(request.documentBlobMap !== undefined ? { documentBlobMap: request.documentBlobMap } : {}),
      ...(request.sharedStorage !== undefined ? { sharedStorage: request.sharedStorage } : {}),
      submittedBy,
      submittedAt: now,
      totalItems: items.length,
      successItems: 0,
      failedItems: 0,
      pendingItems: items.length,
      items,
    };

    const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', job);
    if (!saveResult.success || !saveResult.data) {
      throw new Error('Failed to persist bulk ingestion job');
    }

    const event: BulkIngestionRequestedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.requested',
      timestamp: new Date(),
      source: 'bulk-ingestion-service',
      version: '1.0',
      category: EventCategory.DOCUMENT,
      data: {
        jobId,
        tenantId,
        clientId: request.clientId,
        ingestionMode: request.ingestionMode,
        adapterKey: request.adapterKey,
        dataFileName: request.dataFileName,
        ...(request.dataFileBlobName !== undefined ? { dataFileBlobName: request.dataFileBlobName } : {}),
        documentFileNames: request.documentFileNames,
        ...(request.sharedStorage !== undefined
          ? {
              sharedStorage: {
                storageAccountName: request.sharedStorage.storageAccountName,
                containerName: request.sharedStorage.containerName,
                dataFileBlobName: request.sharedStorage.dataFileBlobName,
                documentBlobNames: request.sharedStorage.documentBlobNames,
                ...(request.sharedStorage.pathPrefix !== undefined
                  ? { pathPrefix: request.sharedStorage.pathPrefix }
                  : {}),
              },
            }
          : {}),
        priority: EventPriority.NORMAL,
      },
    };

    await this.eventPublisher.publish(event);
    await this.writeImmutableAudit(saveResult.data, {
      action: 'SUBMIT',
      requestedBy: submittedBy,
      requestedAt: now,
      details: {
        ingestionMode: request.ingestionMode,
        adapterKey: request.adapterKey,
        totalItems: items.length,
      },
    });

    this.logger.info('Bulk ingestion job submitted', {
      jobId,
      tenantId,
      clientId: request.clientId,
      itemCount: items.length,
      dataFileName: request.dataFileName,
      documentCount: request.documentFileNames.length,
    });

    return saveResult.data;
  }

  async pauseJob(jobId: string, tenantId: string, requestedBy: string): Promise<BulkIngestionJob> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    this.ensureTransition(job.status, ['PENDING', 'PROCESSING'], 'pause');

    const now = new Date().toISOString();
    const updatedJob: BulkIngestionJob = {
      ...job,
      status: 'PAUSED',
      items: job.items.map((item) =>
        item.status === 'PROCESSING'
          ? { ...item, status: 'PENDING' as const, updatedAt: now }
          : item,
      ),
    };

    await this.persistAndAudit(updatedJob, {
      action: 'PAUSE_JOB',
      requestedBy,
      requestedAt: now,
      details: {
        previousStatus: job.status,
        nextStatus: 'PAUSED',
      },
    });

    return updatedJob;
  }

  async resumeJob(jobId: string, tenantId: string, requestedBy: string): Promise<BulkIngestionJob> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    this.ensureTransition(job.status, ['PAUSED'], 'resume');

    const now = new Date().toISOString();
    const resumedStatus = this.computeStatusFromItems(job.items);
    const updatedJob: BulkIngestionJob = {
      ...job,
      status: resumedStatus,
      ...(resumedStatus === 'COMPLETED' || resumedStatus === 'PARTIAL' || resumedStatus === 'FAILED'
        ? { completedAt: now }
        : {}),
    };

    await this.persistAndAudit(updatedJob, {
      action: 'RESUME_JOB',
      requestedBy,
      requestedAt: now,
      details: {
        previousStatus: job.status,
        nextStatus: resumedStatus,
      },
    });

    return updatedJob;
  }

  async cancelJob(jobId: string, tenantId: string, requestedBy: string): Promise<BulkIngestionJob> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    this.ensureTransition(job.status, ['PENDING', 'PROCESSING', 'PAUSED'], 'cancel');

    const now = new Date().toISOString();
    const updatedItems = job.items.map((item) =>
      item.status === 'PENDING' || item.status === 'PROCESSING'
        ? { ...item, status: 'CANCELLED' as const, updatedAt: now }
        : item,
    );

    const failedItems = updatedItems.filter((item) => item.status === 'FAILED').length;
    const successItems = updatedItems.filter((item) => item.status === 'COMPLETED').length;

    const updatedJob: BulkIngestionJob = {
      ...job,
      status: 'CANCELLED',
      failedItems,
      successItems,
      pendingItems: 0,
      items: updatedItems,
      completedAt: now,
    };

    await this.persistAndAudit(updatedJob, {
      action: 'CANCEL_JOB',
      requestedBy,
      requestedAt: now,
      details: {
        previousStatus: job.status,
        nextStatus: 'CANCELLED',
      },
    });

    return updatedJob;
  }

  async listJobs(tenantId: string, clientId?: string): Promise<BulkIngestionJobSummary[]> {
    let query =
      'SELECT c.id, c.tenantId, c.clientId, c.jobName, c.adapterKey, c.status, c.submittedAt, c.completedAt, c.totalItems, c.successItems, c.failedItems, c.pendingItems FROM c WHERE c.type = @type AND c.tenantId = @tenantId';
    const parameters: Array<{ name: string; value: string }> = [
      { name: '@type', value: 'bulk-ingestion-job' },
      { name: '@tenantId', value: tenantId },
    ];

    if (clientId) {
      query += ' AND c.clientId = @clientId';
      parameters.push({ name: '@clientId', value: clientId });
    }

    query += ' ORDER BY c.submittedAt DESC OFFSET 0 LIMIT 100';

    const result = await this.dbService.queryItems<BulkIngestionJobSummary>('bulk-portfolio-jobs', query, parameters);
    if (!result.success || !result.data) {
      throw new Error('Failed to query bulk ingestion jobs');
    }

    return result.data;
  }

  async getJob(jobId: string, tenantId: string): Promise<BulkIngestionJob | null> {
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

  async retryFailedItems(jobId: string, tenantId: string, requestedBy: string): Promise<BulkIngestionJob> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    const now = new Date().toISOString();
    let retriedCount = 0;
    let blockedCount = 0;

    const updatedItems = job.items.map((item) => {
      if (item.status !== 'FAILED') {
        return item;
      }

      const policy = this.evaluateRetryPolicy(item);
      if (!policy.allowed) {
        blockedCount++;
        const blockedFailure: BulkIngestionFailure = {
          code: 'RETRY_REJECTED',
          stage: 'retry-policy',
          message: policy.reason ?? `Retry rejected for stage='${policy.stage}'`,
          retryable: false,
          occurredAt: now,
        };

        return {
          ...item,
          failures: [...item.failures, blockedFailure],
          updatedAt: now,
        };
      }

      retriedCount++;
      const resetFailure: BulkIngestionFailure = {
        code: 'RETRY_REQUESTED',
        stage: 'retry-policy',
        message: `Operator requested retry (scope=job; stage=${policy.stage}; attempt=${policy.nextAttempt}/${policy.maxAttempts})`,
        retryable: true,
        occurredAt: now,
      };

      return {
        ...item,
        status: 'PENDING' as const,
        failures: [...item.failures, resetFailure],
        updatedAt: now,
      };
    });

    const updatedJob = this.rebuildJobFromItems(job, updatedItems, now);
    await this.persistAndAudit(
      updatedJob,
      {
        action: 'RETRY_FAILED_ITEMS',
        requestedBy,
        requestedAt: now,
        details: {
          retriedCount,
          blockedCount,
          totalFailedItemsBeforeRequest: job.failedItems,
        },
      },
    );

    return updatedJob;
  }

  async retryItem(jobId: string, itemId: string, tenantId: string, requestedBy: string): Promise<BulkIngestionJob> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    const targetItem = job.items.find((item) => item.id === itemId);
    if (!targetItem) {
      throw new Error(`Bulk ingestion item '${itemId}' not found in job '${jobId}'`);
    }

    if (targetItem.status !== 'FAILED') {
      throw new Error(`Only FAILED items can be retried. Item '${itemId}' is '${targetItem.status}'`);
    }

    const policy = this.evaluateRetryPolicy(targetItem);
    if (!policy.allowed) {
      throw new Error(policy.reason ?? `Retry rejected for item '${itemId}'`);
    }

    const now = new Date().toISOString();
    const retryFailure: BulkIngestionFailure = {
      code: 'RETRY_REQUESTED',
      stage: 'retry-policy',
      message: `Operator requested retry (scope=item; stage=${policy.stage}; attempt=${policy.nextAttempt}/${policy.maxAttempts})`,
      retryable: true,
      occurredAt: now,
    };

    const updatedItems = job.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            status: 'PENDING' as const,
            failures: [...item.failures, retryFailure],
            updatedAt: now,
          }
        : item,
    );

    const updatedJob = this.rebuildJobFromItems(job, updatedItems, now);
    await this.persistAndAudit(
      updatedJob,
      {
        action: 'RETRY_ITEM',
        requestedBy,
        requestedAt: now,
        details: {
          itemId,
          stage: policy.stage,
          attempt: policy.nextAttempt,
          maxAttempts: policy.maxAttempts,
        },
      },
    );

    return updatedJob;
  }

  private evaluateRetryPolicy(item: BulkIngestionItem): {
    allowed: boolean;
    stage: string;
    attemptsUsed: number;
    nextAttempt: number;
    maxAttempts: number;
    reason?: string;
  } {
    const sourceFailure = this.getLatestSourceFailure(item);
    if (!sourceFailure) {
      return {
        allowed: false,
        stage: 'unknown',
        attemptsUsed: 0,
        nextAttempt: 1,
        maxAttempts: 0,
        reason: 'No source failure found for retry policy evaluation',
      };
    }

    if (!sourceFailure.retryable) {
      return {
        allowed: false,
        stage: sourceFailure.stage,
        attemptsUsed: 0,
        nextAttempt: 1,
        maxAttempts: 0,
        reason: `Latest source failure is non-retryable (stage='${sourceFailure.stage}')`,
      };
    }

    const normalizedStage = sourceFailure.stage.toLowerCase();
    const maxAttempts = this.stageRetryPolicy[normalizedStage] ?? this.stageRetryPolicy['default'] ?? 0;
    const attemptsUsed = item.failures.filter(
      (failure) =>
        failure.code === 'RETRY_REQUESTED' &&
        failure.stage === 'retry-policy' &&
        failure.message.includes(`stage=${sourceFailure.stage}`),
    ).length;

    if (maxAttempts <= 0) {
      return {
        allowed: false,
        stage: sourceFailure.stage,
        attemptsUsed,
        nextAttempt: attemptsUsed + 1,
        maxAttempts,
        reason: `Retry is disabled for stage '${sourceFailure.stage}'`,
      };
    }

    if (attemptsUsed >= maxAttempts) {
      return {
        allowed: false,
        stage: sourceFailure.stage,
        attemptsUsed,
        nextAttempt: attemptsUsed + 1,
        maxAttempts,
        reason: `Retry attempts exhausted for stage '${sourceFailure.stage}' (${attemptsUsed}/${maxAttempts})`,
      };
    }

    return {
      allowed: true,
      stage: sourceFailure.stage,
      attemptsUsed,
      nextAttempt: attemptsUsed + 1,
      maxAttempts,
    };
  }

  private getLatestSourceFailure(item: BulkIngestionItem): BulkIngestionFailure | null {
    for (let index = item.failures.length - 1; index >= 0; index--) {
      const failure = item.failures[index];
      if (!failure) continue;
      if (failure.code === 'RETRY_REQUESTED' || failure.code === 'RETRY_REJECTED') {
        continue;
      }
      return failure;
    }

    return item.failures[item.failures.length - 1] ?? null;
  }

  private rebuildJobFromItems(job: BulkIngestionJob, items: BulkIngestionItem[], now: string): BulkIngestionJob {
    const failedItems = items.filter((item) => item.status === 'FAILED').length;
    const pendingItems = items.filter((item) => item.status === 'PENDING' || item.status === 'PROCESSING').length;
    const successItems = items.filter((item) => item.status === 'COMPLETED').length;

    return {
      ...job,
      status: pendingItems > 0 ? 'PROCESSING' : failedItems > 0 ? 'PARTIAL' : 'COMPLETED',
      failedItems,
      successItems,
      pendingItems,
      items,
      ...(pendingItems > 0 ? {} : { completedAt: now }),
    };
  }

  private computeStatusFromItems(items: BulkIngestionItem[]): BulkIngestionJobStatus {
    const failedItems = items.filter((item) => item.status === 'FAILED').length;
    const pendingItems = items.filter((item) => item.status === 'PENDING' || item.status === 'PROCESSING').length;

    if (pendingItems > 0) {
      return 'PROCESSING';
    }

    if (failedItems === items.length && items.length > 0) {
      return 'FAILED';
    }

    if (failedItems > 0) {
      return 'PARTIAL';
    }

    return 'COMPLETED';
  }

  private ensureTransition(currentStatus: BulkIngestionJobStatus, allowed: BulkIngestionJobStatus[], action: string): void {
    if (allowed.includes(currentStatus)) {
      return;
    }

    throw new Error(
      `Cannot ${action} job from status '${currentStatus}'. Allowed from: ${allowed.join(', ')}`,
    );
  }

  private async persistAndAudit(
    updatedJob: BulkIngestionJob,
    audit: {
      action: BulkIngestionAuditAction;
      requestedBy: string;
      requestedAt: string;
      details: Record<string, unknown>;
    },
  ): Promise<void> {
    const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', updatedJob);
    if (!saveResult.success || !saveResult.data) {
      throw new Error(`Failed to persist retry request for job '${updatedJob.id}'`);
    }

    await this.writeImmutableAudit(updatedJob, audit);
  }

  private async writeImmutableAudit(
    job: BulkIngestionJob,
    audit: {
      action: BulkIngestionAuditAction;
      requestedBy: string;
      requestedAt: string;
      details: Record<string, unknown>;
    },
  ): Promise<void> {
    const auditDoc = {
      id: `bulk-ingestion-audit-${uuidv4()}`,
      type: 'bulk-ingestion-audit-event',
      tenantId: job.tenantId,
      clientId: job.clientId,
      jobId: job.id,
      action: audit.action,
      actorType: 'USER',
      actorId: audit.requestedBy,
      timestamp: audit.requestedAt,
      immutable: true,
      details: audit.details,
    };

    const auditResult = await this.dbService.createItem('bulk-portfolio-jobs', auditDoc);
    if (!auditResult.success) {
      throw new Error(`Immutable audit write failed for job '${job.id}' and action '${audit.action}'`);
    }
  }

  async getCanonicalizationByJobId(
    jobId: string,
    tenantId: string,
  ): Promise<BulkIngestionCanonicalizationResult> {
    const summaryResult = await this.dbService.queryItems<BulkIngestionCanonicalizationSummary>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.type = @type AND c.jobId = @jobId AND c.tenantId = @tenantId ORDER BY c.processedAt DESC OFFSET 0 LIMIT 1',
      [
        { name: '@type', value: 'bulk-ingestion-canonicalization-summary' },
        { name: '@jobId', value: jobId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!summaryResult.success || !summaryResult.data) {
      throw new Error(`Failed to load canonicalization summary for job '${jobId}'`);
    }

    const recordsResult = await this.dbService.queryItems<BulkIngestionCanonicalRecord>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.type = @type AND c.jobId = @jobId AND c.tenantId = @tenantId ORDER BY c.rowIndex ASC',
      [
        { name: '@type', value: 'bulk-ingestion-canonical-record' },
        { name: '@jobId', value: jobId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!recordsResult.success || !recordsResult.data) {
      throw new Error(`Failed to load canonicalization records for job '${jobId}'`);
    }

    return {
      summary: summaryResult.data[0] ?? null,
      records: recordsResult.data,
    };
  }

  async exportFailuresCsv(jobId: string, tenantId: string): Promise<BulkIngestionFailureExport> {
    return this.exportFailures(jobId, tenantId, 'csv');
  }

  async exportFailures(
    jobId: string,
    tenantId: string,
    format: BulkIngestionFailureExportFormat,
  ): Promise<BulkIngestionFailureExport> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    const header = [
      'jobId',
      'itemId',
      'rowIndex',
      'itemStatus',
      'failureStage',
      'failureCode',
      'failureMessage',
      'retryable',
      'occurredAt',
      'loanNumber',
      'externalId',
      'documentFileName',
    ];

    const failureRows = this.flattenFailures(job);
    const rows = failureRows.map((failure) => [
      failure.jobId,
      failure.itemId,
      String(failure.rowIndex),
      failure.itemStatus,
      failure.failureStage,
      failure.failureCode,
      failure.failureMessage,
      String(failure.retryable),
      failure.occurredAt,
      failure.loanNumber,
      failure.externalId,
      failure.documentFileName,
    ]);

    const exportTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'xlsx') {
      const workbook = await this.buildXlsxWorkbook([header, ...rows]);
      return {
        fileName: `bulk-ingestion-failures-${job.id}-${exportTimestamp}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: workbook,
      };
    }

    const csvRows: string[] = [header.map((column) => this.escapeCsv(column)).join(',')];
    for (const row of rows) {
      csvRows.push(row.map((value) => this.escapeCsv(value)).join(','));
    }

    return {
      fileName: `bulk-ingestion-failures-${job.id}-${exportTimestamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: csvRows.join('\n'),
    };
  }

  async listFailures(
    jobId: string,
    tenantId: string,
    filters: BulkIngestionFailureListFilters = {},
  ): Promise<BulkIngestionFailureListResult> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found`);
    }

    const sort: BulkIngestionFailureSort = filters.sort ?? 'occurredAt_desc';
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const normalizedStage = filters.stage?.trim().toLowerCase();
    const normalizedCode = filters.code?.trim().toLowerCase();
    const normalizedSearch = filters.search?.trim().toLowerCase();

    const filtered = this
      .flattenFailures(job)
      .filter((failure) => {
        if (normalizedStage && failure.failureStage.toLowerCase() !== normalizedStage) {
          return false;
        }
        if (normalizedCode && failure.failureCode.toLowerCase() !== normalizedCode) {
          return false;
        }
        if (filters.retryable !== undefined && failure.retryable !== filters.retryable) {
          return false;
        }
        if (filters.itemStatus && failure.itemStatus !== filters.itemStatus) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          failure.itemId,
          failure.failureStage,
          failure.failureCode,
          failure.failureMessage,
          failure.loanNumber,
          failure.externalId,
          failure.documentFileName,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    const sorted = [...filtered].sort((left, right) => {
      switch (sort) {
        case 'occurredAt_asc':
          return left.occurredAt.localeCompare(right.occurredAt);
        case 'occurredAt_desc':
          return right.occurredAt.localeCompare(left.occurredAt);
        case 'rowIndex_asc':
          return left.rowIndex - right.rowIndex;
        case 'rowIndex_desc':
          return right.rowIndex - left.rowIndex;
        case 'stage_asc':
          return left.failureStage.localeCompare(right.failureStage);
        case 'stage_desc':
          return right.failureStage.localeCompare(left.failureStage);
        case 'code_asc':
          return left.failureCode.localeCompare(right.failureCode);
        case 'code_desc':
          return right.failureCode.localeCompare(left.failureCode);
        default:
          return 0;
      }
    });

    const total = sorted.length;
    const offset = this.decodeFailuresCursor(filters.cursor, sort);
    const paged = sorted.slice(offset, offset + limit);
    const consumed = offset + paged.length;
    const hasMore = consumed < total;
    const prevOffset = Math.max(offset - limit, 0);
    const prevCursor = offset > 0 ? this.encodeFailuresCursor(prevOffset, sort) : null;
    const nextCursor = hasMore ? this.encodeFailuresCursor(consumed, sort) : null;

    return {
      jobId,
      total,
      limit,
      prevCursor,
      nextCursor,
      hasMore,
      sort,
      filters: {
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.code ? { code: filters.code } : {}),
        ...(filters.retryable !== undefined ? { retryable: filters.retryable } : {}),
        ...(filters.itemStatus ? { itemStatus: filters.itemStatus } : {}),
        ...(filters.search ? { search: filters.search } : {}),
      },
      items: paged,
    };
  }

  private encodeFailuresCursor(offset: number, sort: BulkIngestionFailureSort): string {
    const payload = JSON.stringify({ offset, sort });
    return Buffer.from(payload, 'utf8').toString('base64url');
  }

  private decodeFailuresCursor(cursor: string | undefined, sort: BulkIngestionFailureSort): number {
    if (!cursor) {
      return 0;
    }

    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { offset?: number; sort?: string };
      if (!Number.isInteger(parsed.offset) || (parsed.offset ?? -1) < 0) {
        throw new Error('Cursor offset must be a non-negative integer');
      }
      if (parsed.sort !== sort) {
        throw new Error('Cursor sort mismatch');
      }
      return parsed.offset ?? 0;
    } catch {
      throw new Error('Invalid cursor for bulk ingestion failures listing');
    }
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private columnName(index: number): string {
    let value = index + 1;
    let label = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  }

  private async buildXlsxWorkbook(rows: string[][]): Promise<Buffer> {
    const sheetRows = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((cellValue, colIndex) => {
            const ref = `${this.columnName(colIndex)}${rowIndex + 1}`;
            return `<c r="${ref}" t="inlineStr"><is><t>${this.escapeXml(cellValue)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join('');

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;

    const files: Record<string, string> = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Failures" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
      'xl/worksheets/sheet1.xml': sheetXml,
    };

    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      archive.on('error', reject);

      archive.pipe(stream);
      for (const [name, content] of Object.entries(files)) {
        archive.append(content, { name });
      }
      void archive.finalize();
    });
  }

  private flattenFailures(job: BulkIngestionJob): BulkIngestionFailureListItem[] {
    const rows: BulkIngestionFailureListItem[] = [];

    for (const item of job.items) {
      for (const failure of item.failures) {
        rows.push({
          jobId: job.id,
          itemId: item.id,
          rowIndex: item.rowIndex,
          itemStatus: item.status,
          failureStage: failure.stage,
          failureCode: failure.code,
          failureMessage: failure.message,
          retryable: failure.retryable,
          occurredAt: failure.occurredAt,
          loanNumber: item.source.loanNumber ?? '',
          externalId: item.source.externalId ?? '',
          documentFileName: item.source.documentFileName ?? '',
        });
      }
    }

    return rows;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
