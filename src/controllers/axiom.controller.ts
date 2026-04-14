/**
 * Axiom AI Platform Controller
 * 
 * REST API endpoints for Axiom AI integration:
 * - Document notification (upload documents for analysis)
 * - Evaluation retrieval (get AI analysis results)
 * - Webhook handling (receive completion notifications)
 * - Document comparison (revision change detection)
 */

import { v4 as uuidv4 } from 'uuid';
import { Request, Response, Router } from 'express';
import { Logger } from '../utils/logger.js';
import { AxiomService, AxiomDocumentNotification, AxiomWebhookPayload, DocumentType } from '../services/axiom.service';
import { AxiomExecutionService } from '../services/axiom-execution.service';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BulkPortfolioService } from '../services/bulk-portfolio.service';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { verifyAxiomWebhook } from '../middleware/verify-axiom-webhook.middleware.js';
import type { TapeExtractionWebhookPayload } from '../types/review-tape.types.js';
import type { AppraisalOrder } from '../types/index.js';
import { BlobStorageService } from '../services/blob-storage.service';
import { AxiomBulkSubmissionService } from '../services/axiom-bulk-submission.service.js';
import { TenantAutomationConfigService } from '../services/tenant-automation-config.service.js';
import { RunLedgerService } from '../services/run-ledger.service.js';
import { CanonicalSnapshotService } from '../services/canonical-snapshot.service.js';
import { EngineDispatchService } from '../services/engine-dispatch.service.js';
import { CriteriaStepInputService } from '../services/criteria-step-input.service.js';
import { AnalysisSubmissionService } from '../services/analysis-submission.service.js';
import type { DocumentMetadata } from '../types/document.types.js';
import type { RunStatus } from '../types/run-ledger.types.js';
import type { DocumentAnalyzeEvaluationMode } from '../types/analysis-submission.types.js';
import type {
  AxiomBulkSubmissionDlqAgeBucket,
  AxiomBulkSubmissionDlqSortPreset,
  AxiomBulkSubmissionDlqStatus,
} from '../services/axiom-bulk-submission.service.js';
import type {
  AxiomEvaluationCompletedEvent,
  AxiomExecutionCompletedEvent,
  BulkIngestionExtractionCompletedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { normalizeAxiomPropertyRequestBody } from './axiom-request-normalizer.js';

const BULK_INGESTION_AXIOM_CORRELATION_PREFIX = 'bulk-ingestion--';

export class AxiomController {
  private axiomService: AxiomService;
  private axiomExecutionService: AxiomExecutionService;
  private dbService: CosmosDbService;
  private bulkPortfolioService: BulkPortfolioService;
  private axiomBulkSubmissionService: AxiomBulkSubmissionService;
  private readonly blobService: BlobStorageService;
  private readonly eventPublisher: ServiceBusEventPublisher;
  private readonly tenantAutomationConfigService: TenantAutomationConfigService;
  private readonly runLedgerService: RunLedgerService;
  private readonly snapshotService: CanonicalSnapshotService;
  private readonly engineDispatchService: EngineDispatchService;
  private readonly criteriaStepInputService: CriteriaStepInputService;
  private readonly analysisSubmissionService: AnalysisSubmissionService;
  private readonly logger = new Logger('AxiomController');

  private createHeaderOrGeneratedValue(req: UnifiedAuthRequest, headerName: string, prefix: string): string {
    const value = req.header(headerName);
    if (value && value.trim()) {
      return value.trim();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Build structured Axiom pipeline fields from an order.
   * Only includes fields with a non-empty / non-zero value.
   */
  private static buildOrderFields(
    order: AppraisalOrder,
  ): Array<{ fieldName: string; fieldType: string; value: unknown }> {
    const addr = order.propertyAddress;
    const prop = order.propertyDetails;
    const loan = order.loanInformation;
    const borrower = order.borrowerInformation;
    return [
      { fieldName: 'loanAmount',      fieldType: 'number', value: loan?.loanAmount ?? 0 },
      { fieldName: 'loanType',        fieldType: 'string', value: String(loan?.loanType ?? '') },
      { fieldName: 'propertyAddress', fieldType: 'string', value: addr?.streetAddress ?? '' },
      { fieldName: 'city',            fieldType: 'string', value: addr?.city ?? '' },
      { fieldName: 'state',           fieldType: 'string', value: addr?.state ?? '' },
      { fieldName: 'zipCode',         fieldType: 'string', value: addr?.zipCode ?? '' },
      { fieldName: 'propertyType',    fieldType: 'string', value: String(prop?.propertyType ?? '') },
      { fieldName: 'yearBuilt',       fieldType: 'number', value: prop?.yearBuilt ?? 0 },
      { fieldName: 'gla',             fieldType: 'number', value: prop?.grossLivingArea ?? 0 },
      { fieldName: 'bedrooms',        fieldType: 'number', value: prop?.bedrooms ?? 0 },
      { fieldName: 'bathrooms',       fieldType: 'number', value: prop?.bathrooms ?? 0 },
      { fieldName: 'borrowerName',    fieldType: 'string', value: `${borrower?.firstName ?? ''} ${borrower?.lastName ?? ''}`.trim() },
    ].filter(
      (f) =>
        (typeof f.value === 'string' && f.value !== '') ||
        (typeof f.value === 'number' && f.value !== 0),
    );
  }

  private mapWebhookStatusToRunStatus(status: string): RunStatus {
    const normalized = status.toLowerCase();
    if (normalized === 'completed' || normalized === 'success') return 'completed';
    if (normalized === 'failed' || normalized === 'error') return 'failed';
    if (normalized === 'pending' || normalized === 'queued') return 'queued';
    return 'running';
  }

  private normalizeDocumentType(document: DocumentMetadata): string {
    if (document.documentType && document.documentType.trim().length > 0) {
      return document.documentType.trim().toUpperCase();
    }

    if (document.category && document.category.trim().length > 0) {
      return document.category.trim().toUpperCase().replace(/-/g, '_');
    }

    throw new Error(`Document '${document.id}' is missing both documentType and category`);
  }

  private async orchestrateDocumentRunLedger(params: {
    documentId: string;
    pipelineJobId?: string;
    webhookStatus: string;
  }): Promise<void> {
    const documentResult = await this.dbService.getItem<DocumentMetadata>('documents', params.documentId);
    if (!documentResult.success || !documentResult.data) {
      throw new Error(`Document '${params.documentId}' was not found for run orchestration`);
    }

    const document = documentResult.data;
    if (!document.tenantId) {
      throw new Error(`Document '${document.id}' is missing tenantId required for run orchestration`);
    }
    if (!document.orderId) {
      throw new Error(`Document '${document.id}' is missing orderId required for run orchestration`);
    }

    const orderResult = await this.dbService.findOrderById(document.orderId);
    if (!orderResult.success || !orderResult.data) {
      throw new Error(`Order '${document.orderId}' was not found for document '${document.id}'`);
    }

    const order = orderResult.data as unknown as Record<string, unknown>;
    const clientId = typeof order['clientId'] === 'string' ? order['clientId'] : undefined;
    if (!clientId) {
      throw new Error(`Order '${document.orderId}' is missing clientId required for schema/program keys`);
    }

    const tenantConfig = await this.tenantAutomationConfigService.getConfig(document.tenantId);
    const subClientId = tenantConfig.axiomSubClientId;
    if (!subClientId) {
      throw new Error(
        `Tenant '${document.tenantId}' is missing axiomSubClientId in tenant automation config required for run orchestration`,
      );
    }

    const schemaVersion = tenantConfig.axiomDocumentSchemaVersion ?? tenantConfig.axiomProgramVersion;
    if (!schemaVersion) {
      throw new Error(
        `Tenant '${document.tenantId}' is missing axiomDocumentSchemaVersion (or axiomProgramVersion fallback) in tenant automation config`,
      );
    }

    const documentType = this.normalizeDocumentType(document);
    const correlationId = `axiom-document:${params.pipelineJobId ?? params.documentId}`;
    const extractionIdempotency = `axiom-document-extraction:${params.pipelineJobId ?? params.documentId}`;

    const extractionRun = await this.runLedgerService.createExtractionRun({
      tenantId: document.tenantId,
      initiatedBy: 'SYSTEM:axiom-webhook',
      correlationId,
      idempotencyKey: extractionIdempotency,
      documentId: document.id,
      schemaKey: {
        clientId,
        subClientId,
        documentType,
        version: schemaVersion,
      },
      runReason: 'AUTO_DOCUMENT_EXTRACTION_WEBHOOK',
      engineTarget: 'AXIOM',
      ...(typeof order['engagementId'] === 'string' ? { engagementId: order['engagementId'] } : {}),
      loanPropertyContextId: typeof order['engagementLoanId'] === 'string'
        ? order['engagementLoanId']
        : document.orderId,
    });

    const extractionStatus = this.mapWebhookStatusToRunStatus(params.webhookStatus);
    const updatedExtractionRun = await this.runLedgerService.setRunStatus(
      extractionRun.id,
      document.tenantId,
      extractionStatus,
      {
        engineRunRef: params.pipelineJobId ?? extractionRun.engineRunRef,
        engineVersion: extractionRun.engineVersion === 'pending'
          ? (process.env.AXIOM_API_VERSION ?? 'axiom-current')
          : extractionRun.engineVersion,
        engineRequestRef: extractionRun.engineRequestRef === 'pending'
          ? `axiom:webhook:req:${params.documentId}`
          : extractionRun.engineRequestRef,
        engineResponseRef: params.pipelineJobId
          ? `axiom:job:${params.pipelineJobId}`
          : extractionRun.engineResponseRef,
        statusDetails: {
          providerStatus: params.webhookStatus,
          source: 'axiom-webhook-document',
        },
      },
    );

    if (extractionStatus !== 'completed') {
      return;
    }

    const snapshot = await this.snapshotService.createFromExtractionRun(updatedExtractionRun);
    await this.runLedgerService.updateRun(updatedExtractionRun.id, document.tenantId, {
      canonicalSnapshotId: snapshot.id,
    });

    if (!tenantConfig.axiomProgramId || !tenantConfig.axiomProgramVersion) {
      throw new Error(
        `Tenant '${document.tenantId}' must set axiomProgramId and axiomProgramVersion for criteria orchestration`,
      );
    }

    const criteriaIdempotency = `axiom-document-criteria:${params.pipelineJobId ?? params.documentId}`;
    const criteriaRun = await this.runLedgerService.createCriteriaRun({
      tenantId: document.tenantId,
      initiatedBy: 'SYSTEM:axiom-webhook',
      correlationId: `${correlationId}:criteria`,
      idempotencyKey: criteriaIdempotency,
      snapshotId: snapshot.id,
      programKey: {
        clientId,
        subClientId,
        programId: tenantConfig.axiomProgramId,
        version: tenantConfig.axiomProgramVersion,
      },
      runMode: 'FULL',
      engineTarget: 'AXIOM',
      ...(typeof order['engagementId'] === 'string' ? { engagementId: order['engagementId'] } : {}),
      loanPropertyContextId: typeof order['engagementLoanId'] === 'string'
        ? order['engagementLoanId']
        : document.orderId,
    });

    const criteriaDispatch = await this.engineDispatchService.dispatchCriteria(criteriaRun);
    const criteriaStepKeys =
      Array.isArray(tenantConfig.axiomDefaultCriteriaStepKeys) && tenantConfig.axiomDefaultCriteriaStepKeys.length > 0
        ? tenantConfig.axiomDefaultCriteriaStepKeys
        : (process.env.RUN_DEFAULT_CRITERIA_STEPS
            ? process.env.RUN_DEFAULT_CRITERIA_STEPS.split(',').map((value) => value.trim()).filter(Boolean)
            : ['overall-criteria']);

    const updatedCriteriaRun = await this.runLedgerService.setRunStatus(
      criteriaRun.id,
      document.tenantId,
      criteriaDispatch.status,
      {
        engineRunRef: criteriaDispatch.engineRunRef,
        engineVersion: criteriaDispatch.engineVersion,
        engineRequestRef: criteriaDispatch.engineRequestRef,
        engineResponseRef: criteriaDispatch.engineResponseRef,
        canonicalSnapshotId: snapshot.id,
        criteriaStepKeys,
        ...(criteriaDispatch.statusDetails ? { statusDetails: criteriaDispatch.statusDetails } : {}),
      },
    );

    const stepRunIds: string[] = [];
    for (const stepKey of criteriaStepKeys) {
      const stepRun = await this.runLedgerService.createCriteriaStepRun({
        tenantId: document.tenantId,
        initiatedBy: 'SYSTEM:axiom-webhook',
        correlationId: `${correlationId}:criteria:${stepKey}`,
        idempotencyKey: `${criteriaIdempotency}:${stepKey}`,
        parentCriteriaRunId: updatedCriteriaRun.id,
        stepKey,
        engineTarget: 'AXIOM',
      });

      const stepInputSlice = await this.criteriaStepInputService.createStepInputSlice({
        tenantId: document.tenantId,
        initiatedBy: 'SYSTEM:axiom-webhook',
        criteriaRun: updatedCriteriaRun,
        stepRun,
        snapshot,
      });

      const stepDispatch = await this.engineDispatchService.dispatchCriteriaStep(stepRun, {
        inputSliceRef: stepInputSlice.payloadRef,
        inputSlice: stepInputSlice.payload,
        evidenceRefs: stepInputSlice.evidenceRefs,
      });

      await this.runLedgerService.setRunStatus(stepRun.id, document.tenantId, stepDispatch.status, {
        engineRunRef: stepDispatch.engineRunRef,
        engineVersion: stepDispatch.engineVersion,
        engineRequestRef: stepDispatch.engineRequestRef,
        engineResponseRef: stepDispatch.engineResponseRef,
        statusDetails: {
          ...(stepDispatch.statusDetails ?? {}),
          stepInputSliceId: stepInputSlice.id,
          stepInputPayloadRef: stepInputSlice.payloadRef,
          stepEvidenceRefs: stepInputSlice.evidenceRefs,
        },
      });

      stepRunIds.push(stepRun.id);
    }

    await this.runLedgerService.updateRun(updatedCriteriaRun.id, document.tenantId, {
      criteriaStepRunIds: stepRunIds,
    });
  }

  constructor(dbService: CosmosDbService, axiomService?: AxiomService) {
    this.dbService = dbService;
    this.axiomService = axiomService || new AxiomService(dbService);
    this.axiomExecutionService = new AxiomExecutionService(dbService);
    this.bulkPortfolioService = new BulkPortfolioService(dbService);
    this.axiomBulkSubmissionService = new AxiomBulkSubmissionService(dbService);
    this.blobService = new BlobStorageService();
    this.eventPublisher = new ServiceBusEventPublisher();
    this.tenantAutomationConfigService = new TenantAutomationConfigService(dbService);
    this.runLedgerService = new RunLedgerService(dbService);
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.engineDispatchService = new EngineDispatchService(this.axiomService);
    this.criteriaStepInputService = new CriteriaStepInputService(dbService);
    this.analysisSubmissionService = new AnalysisSubmissionService(dbService, this.axiomService);
  }

  /**
   * Get operational metrics for Axiom bulk submission orchestration.
   * GET /api/axiom/bulk-submission/metrics
   */
  getBulkSubmissionMetrics = async (_req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const metrics = await this.axiomBulkSubmissionService.getOperationalMetrics();
      res.json({
        success: true,
        data: {
          metrics,
          asOf: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to get Axiom bulk submission metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_BULK_METRICS_ERROR',
          message: 'Failed to retrieve Axiom bulk submission metrics',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  /**
   * List Axiom bulk submission DLQ entries with optional filters.
   * GET /api/axiom/bulk-submission/dlq?tenantId=&jobId=&status=&fromFailedAt=&toFailedAt=&sortPreset=&ageBucket=&page=&pageSize=
   */
  getBulkSubmissionDlq = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const tenantId = typeof req.query['tenantId'] === 'string' ? req.query['tenantId'].trim() : undefined;
      const jobId = typeof req.query['jobId'] === 'string' ? req.query['jobId'].trim() : undefined;
      const rawStatus = typeof req.query['status'] === 'string' ? req.query['status'].trim().toUpperCase() : undefined;
      const status = rawStatus as AxiomBulkSubmissionDlqStatus | undefined;
      const rawSortPreset = typeof req.query['sortPreset'] === 'string'
        ? req.query['sortPreset'].trim().toUpperCase()
        : undefined;
      const sortPreset = rawSortPreset as AxiomBulkSubmissionDlqSortPreset | undefined;
      const rawAgeBucket = typeof req.query['ageBucket'] === 'string'
        ? req.query['ageBucket'].trim().toUpperCase()
        : undefined;
      const ageBucket = rawAgeBucket as AxiomBulkSubmissionDlqAgeBucket | undefined;
      const fromFailedAt = typeof req.query['fromFailedAt'] === 'string'
        ? req.query['fromFailedAt'].trim()
        : undefined;
      const toFailedAt = typeof req.query['toFailedAt'] === 'string'
        ? req.query['toFailedAt'].trim()
        : undefined;
      const rawLimit = typeof req.query['limit'] === 'string' ? Number.parseInt(req.query['limit'], 10) : undefined;
      const rawPage = typeof req.query['page'] === 'string' ? Number.parseInt(req.query['page'], 10) : undefined;
      const rawPageSize = typeof req.query['pageSize'] === 'string' ? Number.parseInt(req.query['pageSize'], 10) : undefined;

      if (rawStatus && status !== 'OPEN' && status !== 'REPLAYED') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: "status must be one of: OPEN, REPLAYED",
          },
        });
        return;
      }

      if (rawLimit !== undefined && (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 500)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'limit must be an integer between 1 and 500',
          },
        });
        return;
      }

      if (rawPage !== undefined && (!Number.isFinite(rawPage) || rawPage < 1)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'page must be an integer greater than or equal to 1',
          },
        });
        return;
      }

      if (rawPageSize !== undefined && (!Number.isFinite(rawPageSize) || rawPageSize < 1 || rawPageSize > 500)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'pageSize must be an integer between 1 and 500',
          },
        });
        return;
      }

      if (rawSortPreset && !['FAILED_AT_DESC', 'FAILED_AT_ASC', 'RETRY_COUNT_DESC'].includes(rawSortPreset)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sortPreset must be one of: FAILED_AT_DESC, FAILED_AT_ASC, RETRY_COUNT_DESC',
          },
        });
        return;
      }

      if (rawAgeBucket && !['ANY', 'LAST_24_HOURS', 'LAST_7_DAYS', 'OLDER_THAN_7_DAYS'].includes(rawAgeBucket)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ageBucket must be one of: ANY, LAST_24_HOURS, LAST_7_DAYS, OLDER_THAN_7_DAYS',
          },
        });
        return;
      }

      if (fromFailedAt && Number.isNaN(Date.parse(fromFailedAt))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'fromFailedAt must be a valid ISO-8601 datetime',
          },
        });
        return;
      }

      if (toFailedAt && Number.isNaN(Date.parse(toFailedAt))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'toFailedAt must be a valid ISO-8601 datetime',
          },
        });
        return;
      }

      if (fromFailedAt && toFailedAt && Date.parse(fromFailedAt) > Date.parse(toFailedAt)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'fromFailedAt must be less than or equal to toFailedAt',
          },
        });
        return;
      }

      const result = await this.axiomBulkSubmissionService.listDlqEvents({
        ...(tenantId ? { tenantId } : {}),
        ...(jobId ? { jobId } : {}),
        ...(status ? { status } : {}),
        ...(fromFailedAt ? { fromFailedAt } : {}),
        ...(toFailedAt ? { toFailedAt } : {}),
        ...(sortPreset ? { sortPreset } : {}),
        ...(ageBucket ? { ageBucket } : {}),
        ...(rawPage !== undefined ? { page: rawPage } : {}),
        ...(rawPageSize !== undefined ? { pageSize: rawPageSize } : {}),
        ...(rawLimit !== undefined ? { limit: rawLimit } : {}),
      });

      res.json({
        success: true,
        data: {
          asOf: new Date().toISOString(),
          count: result.items.length,
          filters: {
            ...(tenantId ? { tenantId } : {}),
            ...(jobId ? { jobId } : {}),
            ...(status ? { status } : {}),
            ...(fromFailedAt ? { fromFailedAt } : {}),
            ...(toFailedAt ? { toFailedAt } : {}),
            ...(sortPreset ? { sortPreset } : { sortPreset: result.sortPreset }),
            ...(ageBucket ? { ageBucket } : { ageBucket: result.ageBucket }),
            ...(rawPage !== undefined ? { page: rawPage } : { page: result.page }),
            ...(rawPageSize !== undefined
              ? { pageSize: rawPageSize }
              : rawLimit !== undefined
                ? { pageSize: rawLimit }
                : { pageSize: result.pageSize }),
          },
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            hasMore: result.hasMore,
          },
          items: result.items,
        },
      });
    } catch (error) {
      this.logger.error('Failed to list Axiom bulk submission DLQ events', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.query['tenantId'],
        jobId: req.query['jobId'],
        status: req.query['status'],
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_BULK_DLQ_LIST_ERROR',
          message: 'Failed to list Axiom bulk submission DLQ events',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  /**
   * Replay a failed Axiom bulk submission event from DLQ.
   * POST /api/axiom/bulk-submission/dlq/:eventId/replay
   */
  replayBulkSubmissionDlqEvent = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const eventId = req.params['eventId'];
      if (!eventId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'eventId route parameter is required',
          },
        });
        return;
      }

      const requestedBy = req.user?.id ?? 'unknown';
      const replayResult = await this.axiomBulkSubmissionService.replayDlqEvent(eventId, requestedBy);

      res.status(202).json({
        success: true,
        data: {
          eventId,
          replayEventId: replayResult.replayEventId,
          pipelineJobId: replayResult.pipelineJobId,
          batchId: replayResult.batchId,
        },
        message: `Replay accepted for DLQ event '${eventId}'`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message,
          },
        });
        return;
      }

      this.logger.error('Failed to replay Axiom bulk submission DLQ event', {
        eventId: req.params['eventId'],
        error: message,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_BULK_DLQ_REPLAY_ERROR',
          message: 'Failed to replay Axiom bulk submission DLQ event',
          details: message,
        },
      });
    }
  };

  /**
   * Check if Axiom integration is enabled
   * GET /api/axiom/status
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const enabled = this.axiomService.isEnabled();

      res.json({
        success: true,
        data: {
          enabled,
          message: enabled 
            ? 'Axiom AI Platform integration is active'
            : 'Axiom AI Platform not configured - AI features disabled'
        }
      });
    } catch (error) {
      this.logger.error('Error checking Axiom status', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_STATUS_ERROR',
          message: 'Failed to check Axiom status',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Notify Axiom of a new document upload
   * POST /api/axiom/documents
   * 
   * Body: {
   *   orderId: string,
   *   documentType: 'appraisal' | 'revision' | 'rov' | 'supporting',
   *   documentUrl: string, // Azure Blob Storage SAS URL
   *   metadata?: { ... }
   * }
   */
  notifyDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const notification: AxiomDocumentNotification = req.body;

      // Validate required fields
      if (!notification.orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!notification.documentType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentType is required'
          }
        });
        return;
      }

      if (!notification.documentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentUrl is required (Azure Blob Storage SAS URL)'
          }
        });
        return;
      }

      // Load order for structured pipeline fields (A-2)
      const orderResult = await this.dbService.findOrderById(notification.orderId);
      const order: AppraisalOrder | null = orderResult.success ? orderResult.data ?? null : null;
      if (!order) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Order ${notification.orderId} not found — cannot submit to Axiom without tenant/client context`,
          },
        });
        return;
      }
      const fields = AxiomController.buildOrderFields(order);
      const documents = [{
        documentName: (notification.metadata as any)?.fileName ?? notification.orderId,
        documentReference: notification.documentUrl,
      }];

      const pipelineResult = await this.axiomService.submitOrderEvaluation(
        notification.orderId,
        fields,
        documents,
        order.tenantId,
        order.clientId,
        undefined, // programId
        undefined, // programVersion
        'ORDER',
        'COMPLETE_EVALUATION',
        notification.forceResubmit === true,
      );

      if (!pipelineResult) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: 'Failed to submit document to Axiom pipeline',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: pipelineResult.evaluationId,
          pipelineJobId: pipelineResult.pipelineJobId,
          orderId: notification.orderId,
          message: 'Document submitted to Axiom pipeline - evaluation in progress'
        }
      });
    } catch (error) {
      this.logger.error('Error notifying Axiom of document', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process document notification',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Analyze a document via Axiom (frontend-friendly route)
   * POST /api/axiom/analyze
   * 
   * Accepts the frontend AxiomAnalyzeDocumentRequest shape, looks up the
   * document's blob URL from Cosmos, and submits to the Axiom pipeline
   * via submitOrderEvaluation().
   * 
   * Body: {
   *   documentId: string,
   *   orderId: string,
   *   documentType?: string
   * }
   */
  analyzeDocument = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { documentId, orderId, documentType, evaluationMode, programId, programVersion, forceResubmit } = req.body;
      const normalizedEvaluationMode =
        typeof evaluationMode === 'string'
        && ['EXTRACTION', 'CRITERIA_EVALUATION', 'COMPLETE_EVALUATION'].includes(evaluationMode)
          ? evaluationMode as DocumentAnalyzeEvaluationMode
          : undefined;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'documentId is required' }
        });
        return;
      }

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId is required' }
        });
        return;
      }

      if (typeof evaluationMode === 'string' && !normalizedEvaluationMode) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `evaluationMode '${evaluationMode}' is invalid. Expected EXTRACTION, CRITERIA_EVALUATION, or COMPLETE_EVALUATION`,
          },
        });
        return;
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } });
        return;
      }

      const submission = await this.analysisSubmissionService.submit({
        analysisType: 'DOCUMENT_ANALYZE',
        documentId,
        orderId,
        ...(typeof documentType === 'string' && documentType.trim().length > 0 ? { documentType } : {}),
        ...(normalizedEvaluationMode ? { evaluationMode: normalizedEvaluationMode } : {}),
        ...(typeof programId === 'string' && programId.trim().length > 0 ? { programId } : {}),
        ...(typeof programVersion === 'string' && programVersion.trim().length > 0 ? { programVersion } : {}),
        ...(forceResubmit === true ? { forceResubmit: true } : {}),
      }, {
        tenantId,
        initiatedBy: req.user?.id ?? req.user?.azureAdObjectId ?? 'unknown-user',
        correlationId: this.createHeaderOrGeneratedValue(req, 'X-Correlation-Id', 'axiom-analyze-correlation'),
        idempotencyKey: this.createHeaderOrGeneratedValue(req, 'Idempotency-Key', 'axiom-analyze-idempotency'),
      });

      res.status(202).json({
        success: true,
        data: {
          evaluationId: submission.evaluationId,
          pipelineJobId: submission.pipelineJobId,
          orderId,
          documentId,
          message: 'Document submitted for AI analysis'
        }
      });
    } catch (error) {
      this.logger.error('Error analyzing document via Axiom', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit document for analysis',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Retrieve ALL evaluation results for an order
   * GET /api/axiom/evaluations/order/:orderId
   * 
   * Returns an array of all evaluations (pending, processing, completed, failed).
   * Frontend uses this to show Axiom status badges on each document.
   */
  getEvaluationByOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId parameter is required'
          }
        });
        return;
      }

      const tenantId = (req as unknown as import('../middleware/unified-auth.middleware.js').UnifiedAuthRequest).user?.tenantId;
      const evaluations = await this.axiomService.getEvaluationsForOrder(orderId, tenantId);

      res.json({
        success: true,
        data: evaluations
      });
    } catch (error) {
      this.logger.error('Error retrieving Axiom evaluations', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluations',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * SSE stream of Axiom pipeline events for a given order.
   * GET /api/axiom/evaluations/order/:orderId/stream
   *
   * Looks up axiomPipelineJobId on the order document (retrying up to 30 s
   * because the auto-trigger may not have stamped it yet), then proxies the
   * raw Axiom /api/pipelines/:jobId/observe SSE stream directly to the caller.
   */
  streamOrderPipeline = async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'orderId parameter is required' },
      });
      return;
    }

    // Wait up to 30 s for axiomPipelineJobId to appear (auto-trigger fires within
    // a second or two of order creation; we give it 6 × 5 s to handle slow starts).
    let pipelineJobId: string | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      const orderResult = await this.dbService.findOrderById(orderId);
      if (!orderResult.success || !orderResult.data) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Order ${orderId} not found` },
        });
        return;
      }
      pipelineJobId = (orderResult.data as unknown as Record<string, unknown>)['axiomPipelineJobId'] as string | undefined;
      if (pipelineJobId) break;
      // Not stamped yet — wait and retry
      await new Promise<void>((r) => setTimeout(r, 5_000));
    }

    if (!pipelineJobId) {
      res.status(409).json({
        success: false,
        error: {
          code: 'AXIOM_NOT_TRIGGERED',
          message: `No Axiom pipeline job found for order ${orderId} after waiting 30 s. The auto-trigger may not have fired yet.`,
        },
      });
      return;
    }

    await this.axiomService.proxyPipelineStream(pipelineJobId, req, res);
  };

  /**
   * Retrieve evaluation results by evaluation ID
   * GET /api/axiom/evaluations/:evaluationId
   */
  getEvaluationById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { evaluationId } = req.params;
      const bypassCache = req.query['bypassCache'] === 'true';

      if (!evaluationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'evaluationId parameter is required'
          }
        });
        return;
      }

      const evaluation = await this.axiomService.getEvaluationById(evaluationId, bypassCache);

      if (!evaluation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Evaluation ${evaluationId} not found`
          }
        });
        return;
      }

      res.json({
        success: true,
        data: evaluation
      });
    } catch (error) {
      this.logger.error('Error retrieving Axiom evaluation by ID', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluation',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Receive Axiom pipeline webhook for single-order evaluations.
   * POST /api/axiom/webhook
   *
   * Accepts either the new pipeline payload:
   *   { correlationId, correlationType, pipelineJobId, status, timestamp, result? }
   * or the legacy shape (mock/dev):
   *   { evaluationId, orderId, status, timestamp }
   *
   * Protected by HMAC signature verification via verifyAxiomWebhook middleware.
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;

      // ── New pipeline shape ────────────────────────────────────────────────
      const correlationType = body['correlationType'] as string | undefined;
      const rawCorrelationId = body['correlationId'] as string | undefined;
      if (rawCorrelationId && correlationType === 'EXECUTION') {
        const executionId = rawCorrelationId;
        const pipelineJobId = body['pipelineJobId'] as string | undefined;
        // Axiom nests status/result/error inside body.payload; fall back to root-level for legacy/mock shapes.
        const webhookPayload0 = body['payload'] as Record<string, unknown> | undefined;
        const status = (webhookPayload0?.['status'] ?? body['status'] as string | undefined) ?? 'completed';
        const result = (webhookPayload0?.['result'] ?? body['result']) as Record<string, unknown> | undefined;
        const error = (webhookPayload0?.['error'] ?? body['error']) as string | undefined;

        this.logger.info('Axiom webhook: EXECUTION update', { executionId, status, pipelineJobId });

        const executionStatus = status === 'completed' ? 'COMPLETED' : 'FAILED';
        await this.axiomExecutionService.updateExecutionStatus(
          executionId,
          executionStatus,
          result,
          error,
        );

        const execCompletedEvent: AxiomExecutionCompletedEvent = {
          id: uuidv4(),
          type: 'axiom.execution.completed',
          timestamp: new Date(),
          source: 'axiom-controller',
          version: '1.0',
          category: EventCategory.SYSTEM,
          data: {
            executionId,
            status: executionStatus,
            ...(pipelineJobId !== undefined ? { pipelineJobId } : {}),
          },
        };
        await this.eventPublisher.publish(execCompletedEvent);
        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      if (rawCorrelationId && correlationType === 'TAPE_LOAN') {
        // correlationId is '{jobId}::{loanNumber}' — encoded by submitBatchEvaluation
        const separatorIdx = rawCorrelationId.indexOf('::');
        if (separatorIdx === -1) {
          this.logger.error('Axiom webhook TAPE_LOAN: malformed correlationId (missing ::)', { correlationId: rawCorrelationId });
          res.status(400).json({ success: false, error: 'Malformed correlationId for TAPE_LOAN (expected jobId::loanNumber)' });
          return;
        }
        const jobId = rawCorrelationId.slice(0, separatorIdx);
        const loanNumber = rawCorrelationId.slice(separatorIdx + 2);
        // Axiom sends executionId; our mock/test harness sends pipelineJobId — accept both.
        const executionId = (body['executionId'] ?? body['pipelineJobId']) as string | undefined;
        // Axiom nests status inside body.payload; fall back to root-level for legacy/mock shapes.
        const webhookPayload1 = body['payload'] as Record<string, unknown> | undefined;
        const status = (webhookPayload1?.['status'] ?? body['status'] as string | undefined) ?? 'completed';

        type LoanResult = Parameters<typeof this.bulkPortfolioService.stampBatchEvaluationResults>[1][number];
        const loanStatus: 'completed' | 'failed' = status === 'completed' ? 'completed' : 'failed';
        const loanEntry: LoanResult = { loanNumber, status: loanStatus };

        // Axiom's pipeline.completed webhook is a status notification only — no inline result payload.
        // Call GET /api/pipelines/{executionId}/results to get the actual score and decision.
        if (status === 'completed' && executionId) {
          try {
            const rawResults = await this.axiomService.fetchPipelineResults(executionId);
            if (rawResults) {
              const inner = (rawResults['results'] as Record<string, unknown> | undefined) ?? rawResults;
              const riskScore = typeof inner['overallRiskScore'] === 'number'
                ? inner['overallRiskScore'] as number
                : typeof rawResults['overallRiskScore'] === 'number'
                ? rawResults['overallRiskScore'] as number
                : undefined;
              if (riskScore !== undefined) loanEntry.riskScore = riskScore;
              const dec = (inner['overallDecision'] ?? rawResults['overallDecision']) as string | undefined;
              if (dec === 'ACCEPT' || dec === 'CONDITIONAL' || dec === 'REJECT') loanEntry.decision = dec;
            }
          } catch (fetchErr) {
            this.logger.warn('Axiom TAPE_LOAN webhook: could not fetch pipeline results — stamping status only', {
              jobId, loanNumber, executionId, error: (fetchErr as Error).message,
            });
          }
        }

        this.logger.info('Axiom TAPE_LOAN webhook received', { jobId, loanNumber, executionId, status });

        await this.bulkPortfolioService.stampBatchEvaluationResults(jobId, [loanEntry]);
        await this.axiomService.broadcastBatchJobUpdate(jobId);
        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      if (rawCorrelationId && correlationType === 'DOCUMENT') {
        // correlationId is the documentId set by AxiomDocumentProcessingService.
        const documentId = rawCorrelationId;
        // Axiom sends executionId; our mock/test harness sends pipelineJobId — accept both.
        const pipelineJobId = (body['executionId'] ?? body['pipelineJobId']) as string | undefined;
        // Axiom nests status/result inside body.payload; fall back to root-level for legacy/mock shapes.
        const webhookPayload2 = body['payload'] as Record<string, unknown> | undefined;
        const status = (webhookPayload2?.['status'] ?? body['status'] as string | undefined) ?? 'completed';
        const result = (webhookPayload2?.['result'] ?? body['result']) as Record<string, unknown> | undefined;

        if (documentId.startsWith(BULK_INGESTION_AXIOM_CORRELATION_PREFIX)) {
          // correlationId format: 'bulk-ingestion--<jobId>--<itemId>' (colons replaced with hyphens for BullMQ compatibility)
          // buildCorrelationId() replaces ALL colons with hyphens, so itemId 'jobId:rowIndex'
          // becomes 'jobId-rowIndex'.  Reverse by restoring the trailing row-index colon.
          const parts = documentId.split('--');
          const [, jobId, rawItemId] = parts;
          const itemId = rawItemId ? rawItemId.replace(/-(\d+)$/, ':$1') : rawItemId;
          if (!jobId || !itemId) {
            this.logger.error('Axiom webhook: malformed bulk-ingestion DOCUMENT correlation id', {
              correlationId: documentId,
            });
            res.status(400).json({ success: false, error: 'Malformed bulk-ingestion correlationId for DOCUMENT webhook' });
            return;
          }

          const jobResult = await this.dbService.queryItems<import('../types/bulk-ingestion.types.js').BulkIngestionJob>(
            'bulk-portfolio-jobs',
            'SELECT * FROM c WHERE c.id = @id AND c.type = @type',
            [
              { name: '@id', value: jobId },
              { name: '@type', value: 'bulk-ingestion-job' },
            ],
          );

          const job = jobResult.success && jobResult.data?.[0] ? jobResult.data[0] : null;
          if (!job) {
            this.logger.error('Axiom webhook: bulk-ingestion job not found for DOCUMENT correlation id', {
              correlationId: documentId,
              jobId,
              itemId,
            });
            res.status(404).json({ success: false, error: `Bulk ingestion job '${jobId}' not found` });
            return;
          }

          const itemIndex = job.items.findIndex((item) => item.id === itemId);
          if (itemIndex === -1) {
            this.logger.error('Axiom webhook: bulk-ingestion item not found for DOCUMENT correlation id', {
              correlationId: documentId,
              jobId,
              itemId,
            });
            res.status(404).json({ success: false, error: `Bulk ingestion item '${itemId}' not found on job '${jobId}'` });
            return;
          }

          // Axiom's webhook body carries no result payload for DOCUMENT type — fetch it explicitly.
          // Do this before the idempotency check so results are available for both the DB save and the event.
          let axiomPipelineResults: Record<string, unknown> | undefined;
          let axiomExtractionResult: unknown;
          let axiomCriteriaResult: unknown;
          let pipelineExecutionLog: Array<{ stage: string; event: 'completed' | 'failed'; timestamp: string; error?: string }> | undefined;
          if (status === 'completed' && pipelineJobId) {
            // Log the full webhook body once (at debug level) so we can inspect Axiom's payload structure.
            // This helps determine whether Axiom sends inline results for DOCUMENT/bulk executions.
            this.logger.info('Axiom bulk-ingestion DOCUMENT webhook body (diagnostic)', {
              jobId, itemId, pipelineJobId,
              bodyKeys: Object.keys(body),
              hasResult: 'result' in body,
              hasOutput: 'output' in body,
              hasData: 'data' in body,
              hasStages: 'stages' in body,
              resultSample: result ? JSON.stringify(result).slice(0, 300) : undefined,
            });

            // First attempt: use inline result from the webhook body if present
            // (some Axiom API versions embed results directly in the completion webhook).
            const inlineResult = (result ?? body['output'] ?? body['data']) as Record<string, unknown> | undefined;
            if (inlineResult && typeof inlineResult === 'object' && Object.keys(inlineResult).length > 0) {
              this.logger.info('Axiom bulk-ingestion webhook: using inline result from webhook body', {
                jobId, itemId, pipelineJobId, resultKeys: Object.keys(inlineResult),
              });
              axiomPipelineResults = inlineResult;
            } else {
              // Second attempt: fetch via REST (works for standard executions; 409 for bulk idempotent IDs).
              // fetchPipelineResults will attempt to use the 409 response body if it contains result fields.
              try {
                const rawResults = await this.axiomService.fetchPipelineResults(pipelineJobId);
                if (rawResults) {
                  axiomPipelineResults = rawResults;
                }
              } catch (fetchErr) {
                this.logger.warn('Axiom bulk-ingestion webhook: could not fetch pipeline results — stamping status only', {
                  jobId, itemId, pipelineJobId, error: (fetchErr as Error).message,
                });
              }
            }

            if (axiomPipelineResults) {
              // Pull the structured extraction output from the pipeline stages
              const stages = (axiomPipelineResults['stages'] as Record<string, unknown> | undefined) ?? {};
              const extractStage = stages['extractStructuredData'];
              if (Array.isArray(extractStage) && extractStage.length > 0) {
                axiomExtractionResult = extractStage;
              } else if (axiomPipelineResults['extractedData']) {
                axiomExtractionResult = axiomPipelineResults['extractedData'];
              }
              // Pull criteria evaluation summary from aggregateResults stage
              const aggregateStage = stages['aggregateResults'];
              if (Array.isArray(aggregateStage) && aggregateStage.length > 0) {
                axiomCriteriaResult = aggregateStage[0];
              } else if (axiomPipelineResults['criteriaResults']) {
                axiomCriteriaResult = axiomPipelineResults['criteriaResults'];
              }
              // Build a best-effort stage execution log from the stages map.
              // The results endpoint carries no per-stage timing, so durationMs is omitted.
              pipelineExecutionLog = Object.entries(stages).map(([stageName, output]) => {
                const out = output as Record<string, unknown> | null | undefined;
                const failed = !!(out?.['_processingFailed']);
                const error = out?.['_failureDetail'] as string | undefined;
                return {
                  stage: stageName,
                  event: failed ? 'failed' as const : 'completed' as const,
                  timestamp: new Date().toISOString(),
                  ...(error ? { error } : {}),
                };
              });
            }
          }

          const updatedItems = [...job.items];
          const targetItem = { ...updatedItems[itemIndex]! };
          const currentExtractionStatus = typeof targetItem.canonicalRecord?.['axiomExtractionStatus'] === 'string'
            ? (targetItem.canonicalRecord?.['axiomExtractionStatus'] as string)
            : undefined;

          const terminal = currentExtractionStatus === 'COMPLETED' || currentExtractionStatus === 'FAILED';
          if (!terminal) {
            targetItem.canonicalRecord = {
              ...(targetItem.canonicalRecord ?? {}),
              ...(pipelineJobId ? { axiomPipelineJobId: pipelineJobId } : {}),
              axiomExtractionStatus: status === 'completed' ? 'COMPLETED' : 'FAILED',
              ...(axiomPipelineResults ? { axiomPipelineResults } : {}),
              ...(axiomExtractionResult !== undefined ? { axiomExtractionResult } : {}),
              ...(axiomCriteriaResult !== undefined ? { axiomCriteriaResult } : {}),
              ...(pipelineExecutionLog && pipelineExecutionLog.length > 0 ? { pipelineExecutionLog } : {}),
              axiomCompletedAt: new Date().toISOString(),
            };
            targetItem.updatedAt = new Date().toISOString();
            updatedItems[itemIndex] = targetItem;

            const saveResult = await this.dbService.upsertItem('bulk-portfolio-jobs', {
              ...job,
              items: updatedItems,
            });
            if (!saveResult.success || !saveResult.data) {
              throw new Error(`Failed to persist bulk-ingestion webhook stamp for job '${job.id}' item '${itemId}'`);
            }
          }

          // Also write to aiInsights (the same path as single-order / SSE flow) so the
          // evaluation record is queryable and visible in the UI regardless of ingestion path.
          const canonicalOrderId = typeof targetItem.canonicalRecord?.['orderId'] === 'string'
            ? (targetItem.canonicalRecord['orderId'] as string)
            : undefined;
          if (status === 'completed' && canonicalOrderId && pipelineJobId) {
            await this.axiomService.fetchAndStorePipelineResults(
              canonicalOrderId,
              pipelineJobId,
              undefined,
              undefined,
              pipelineExecutionLog,
            ).catch((err: Error) =>
              this.logger.warn('Axiom bulk-ingestion webhook: failed to write aiInsights record', {
                jobId, itemId, canonicalOrderId, pipelineJobId, error: err.message,
              }),
            );
          }

          const extractionCompletedEvent: BulkIngestionExtractionCompletedEvent = {
            id: uuidv4(),
            type: 'bulk.ingestion.extraction.completed',
            timestamp: new Date(),
            source: 'axiom-controller',
            version: '1.0',
            correlationId: documentId,
            category: EventCategory.DOCUMENT,
            data: {
              jobId: job.id,
              tenantId: job.tenantId,
              clientId: job.clientId,
              itemId,
              rowIndex: targetItem.rowIndex,
              correlationId: documentId,
              ...(pipelineJobId ? { pipelineJobId } : {}),
              status: status === 'completed' ? 'completed' : 'failed',
              completedAt: new Date().toISOString(),
              ...(status !== 'completed' ? { error: (body['error'] as string | undefined) ?? 'Axiom extraction failed' } : {}),
              ...(axiomPipelineResults ? { result: axiomPipelineResults } : {}),
              ...(axiomExtractionResult !== undefined ? { extractionResult: axiomExtractionResult } : {}),
              ...(axiomCriteriaResult !== undefined ? { criteriaResult: axiomCriteriaResult } : {}),
              priority: status === 'completed' ? EventPriority.NORMAL : EventPriority.HIGH,
            },
          };

          await this.eventPublisher.publish(extractionCompletedEvent);
          res.status(200).json({ success: true, message: 'Webhook processed' });
          return;
        }

        const extractionStatus = status === 'completed' ? 'COMPLETED' : 'AXIOM_FAILED';

        this.logger.info('Axiom webhook: DOCUMENT extraction update', {
          documentId,
          pipelineJobId,
          extractionStatus,
        });

        const updateResult = await this.dbService.updateItem<import('../types/document.types.js').DocumentMetadata>(
          'documents',
          documentId,
          {
            extractionStatus,
            ...(result ? { extractedData: result as Record<string, unknown> } : {}),
          },
        );

        if (!updateResult.success) {
          const errDetail = typeof updateResult.error === 'string'
            ? updateResult.error
            : JSON.stringify(updateResult.error ?? 'unknown error');
          throw new Error(`Failed to stamp document extraction result for documentId=${documentId}: ${errDetail}`);
        }

        try {
          await this.orchestrateDocumentRunLedger({
            documentId,
            ...(pipelineJobId ? { pipelineJobId } : {}),
            webhookStatus: String(status),
          });
        } catch (orchestrationError) {
          this.logger.warn('Axiom webhook: run-ledger orchestration failed for document', {
            documentId,
            pipelineJobId,
            error: orchestrationError instanceof Error ? orchestrationError.message : String(orchestrationError),
          });
        }

        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      if (rawCorrelationId && correlationType === 'ORDER') {
        // On forceResubmit the service sends correlationId as `<orderId>~r<timestamp>` to
        // bypass Axiom's Cosmos idempotency guard (which uses correlationId as its document id).
        // Strip the `~r...` suffix here to recover the real orderId for all DB lookups.
        const correlationId = rawCorrelationId.includes('~r')
          ? rawCorrelationId.split('~r')[0]!
          : rawCorrelationId;
        // Axiom sends executionId; our mock/test harness sends pipelineJobId — accept both.
        const pipelineJobId = (body['executionId'] ?? body['pipelineJobId']) as string | undefined;
        // Axiom nests status/result inside body.payload; fall back to root-level for legacy/mock shapes.
        const webhookPayload3 = body['payload'] as Record<string, unknown> | undefined;
        const status = (webhookPayload3?.['status'] ?? body['status'] as string | undefined) ?? 'completed';
        const result = (webhookPayload3?.['result'] ?? body['result']) as Record<string, unknown> | undefined;

        const updateData: Partial<AppraisalOrder> = {};
        // Narrow the status string so exactOptionalPropertyTypes is satisfied
        const axiomStatusValue = status as AppraisalOrder['axiomStatus'];
        if (axiomStatusValue !== undefined) updateData.axiomStatus = axiomStatusValue;
        if (pipelineJobId) updateData.axiomPipelineJobId = pipelineJobId;
        // Stamp axiomCompletedAt on ALL terminal states so the timeout watcher can exclude
        // already-finished orders via the axiomCompletedAt field (not just axiomStatus).
        if (status === 'completed' || status === 'failed') {
          updateData.axiomCompletedAt = new Date().toISOString();
        }
        if (result) {
          if (typeof result['overallRiskScore'] === 'number') updateData.axiomRiskScore = result['overallRiskScore'];
          const dec = result['overallDecision'] as AppraisalOrder['axiomDecision'] | undefined;
          if (dec !== undefined) updateData.axiomDecision = dec;
          if (Array.isArray(result['flags'])) updateData.axiomFlags = result['flags'] as string[];
        }

        const orderUpdateResult = await this.dbService.updateOrder(correlationId, updateData);
        if (!orderUpdateResult.success) {
          throw new Error(`Failed to stamp order from webhook for orderId=${correlationId}: ${orderUpdateResult.error ?? 'unknown error'}`);
        }

        // For completed pipelines, fetch full criteria results and store them in aiInsights.
        // This is the authoritative path — it fires even when the SSE stream was not open
        // (e.g. server restarted between submit and completion).
        if (status === 'completed' && pipelineJobId) {
          await this.axiomService.fetchAndStorePipelineResults(correlationId, pipelineJobId);
        }

        // Signal the SSE proxy so it can terminate any open stream for this job.
        // pipeline.completed is NOT written to Cosmos — Axiom only delivers it via
        // webhookBus (this HTTP call). The registry bridges that gap.
        if (pipelineJobId) {
          this.axiomService.signalPipelineTermination(
            pipelineJobId,
            status === 'completed' ? 'completed' : 'failed',
          );
        }

        // Publish axiom.evaluation.completed to Service Bus so the orchestrator
        // can gate QC routing on Axiom completion when axiomAutoTrigger=true.
        const orderForEvent = await this.dbService.findOrderById(correlationId);
        const resolvedTenantId: string = (orderForEvent?.data as any)?.tenantId ?? '';
        if (!resolvedTenantId) {
          this.logger.warn('Axiom webhook: could not resolve tenantId for axiom.evaluation.completed event', { orderId: correlationId });
        }
        const evalCompletedEvent: AxiomEvaluationCompletedEvent = {
          id: uuidv4(),
          type: 'axiom.evaluation.completed',
          timestamp: new Date(),
          source: 'axiom-controller',
          version: '1.0',
          category: EventCategory.QC,
          data: {
            orderId: correlationId,
            orderNumber: (orderForEvent?.data as any)?.orderNumber ?? correlationId,
            tenantId: resolvedTenantId,
            evaluationId: `eval-${correlationId}`,
            pipelineJobId: pipelineJobId ?? '',
            overallRiskScore: typeof updateData.axiomRiskScore === 'number' ? updateData.axiomRiskScore : 0,
            overallDecision: (updateData.axiomDecision as 'ACCEPT' | 'CONDITIONAL' | 'REJECT' | 'UNKNOWN') ?? 'UNKNOWN',
            status: (status === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed',
            priority: EventPriority.HIGH,
          },
        };
        await this.eventPublisher.publish(evalCompletedEvent);

        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      // ── Legacy shape (mock / dev tests) ──────────────────────────────────
      const legacyPayload = body as unknown as AxiomWebhookPayload;
      if (legacyPayload.evaluationId && legacyPayload.orderId) {
        await this.axiomService.handleWebhook(legacyPayload);
        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      this.logger.warn('Axiom webhook received with unrecognised payload shape', { keys: Object.keys(body) });
      res.status(400).json({ success: false, error: 'Unrecognized webhook payload shape' });
    } catch (error) {
      this.logger.error('Axiom webhook durable processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_FAILED',
          message: 'Webhook processing failed before durable completion',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  /**
   * Compare two document versions (for revision workflows)
   * POST /api/axiom/documents/compare
   * 
   * Body: {
   *   orderId: string,
   *   originalDocumentUrl: string,
   *   revisedDocumentUrl: string
   * }
   */
  compareDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, originalDocumentUrl, revisedDocumentUrl } = req.body;

      // Validate required fields
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!originalDocumentUrl || !revisedDocumentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'originalDocumentUrl and revisedDocumentUrl are required'
          }
        });
        return;
      }

      // Initiate document comparison
      const result = await this.axiomService.compareDocuments(
        orderId,
        originalDocumentUrl,
        revisedDocumentUrl
      );

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to compare documents',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          comparisonId: result.comparisonId,
          evaluationId: result.evaluationId,
          orderId,
          changes: result.changes,
          message: 'Document comparison initiated - results will be available shortly'
        }
      });
    } catch (error) {
      this.logger.error('Error comparing documents via Axiom', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compare documents',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Receive Axiom TAPE_EXTRACTION webhook
   * POST /api/axiom/webhook/extraction
   *
   * Axiom calls this endpoint when a structured field extraction job finishes.
   * The payload contains extractedFields (Partial<RiskTapeItem>) which are
   * mapped to a RiskTapeItem, evaluated against the ReviewProgram, and stored
   * as a ReviewTapeResult on the originating BulkPortfolioJob.
   *
   * Returns 200 only after durable processing succeeds.
   */
  handleExtractionWebhook = async (req: Request, res: Response): Promise<void> => {
    const payload = req.body as TapeExtractionWebhookPayload;

    if (!payload.evaluationId || !payload.jobId || !payload.loanNumber) {
      this.logger.error('Extraction webhook missing required fields', {
        hasEvaluationId: !!payload.evaluationId,
        hasJobId: !!payload.jobId,
        hasLoanNumber: !!payload.loanNumber,
      });
      res.status(400).json({ success: false, error: 'evaluationId, jobId, and loanNumber are required' });
      return;
    }

    try {
      await this.bulkPortfolioService.processExtractionCompletion(payload);
      res.status(200).json({ success: true, message: 'Extraction webhook processed' });
    } catch (error) {
      this.logger.error('Failed to process extraction webhook', {
        evaluationId: payload.evaluationId,
        jobId: payload.jobId,
        loanNumber: payload.loanNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ success: false, error: 'Extraction webhook processing failed' });
    }
  };

  /**
   * Receive Axiom pipeline webhook for bulk tape jobs.
   * POST /api/axiom/webhook/bulk
   *
   * Payload: { correlationId, correlationType: 'BULK_JOB', pipelineJobId, status, timestamp, results[] }
   *
   * Protected by HMAC signature verification.
   */
  handleBulkWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const jobId = body['correlationId'] as string | undefined;
      // Axiom sends executionId; our mock/test harness sends pipelineJobId — accept both.
      const pipelineJobId = (body['executionId'] ?? body['pipelineJobId']) as string | undefined;
      // Axiom nests status inside body.payload; fall back to root-level for legacy/mock shapes.
      const webhookPayload4 = body['payload'] as Record<string, unknown> | undefined;
      const status = (webhookPayload4?.['status'] ?? body['status'] as string | undefined) ?? 'completed';
      // BULK_JOB is now a legacy correlationType. The primary bulk submission path uses
      // TAPE_LOAN (correlationId: '{jobId}::{loanNumber}') handled by handleWebhook, which
      // calls GET /api/pipelines/{executionId}/results per loan for score+decision stamping.
      // Axiom's pipeline.completed payload is { executionId, entityId, status, durationMs };
      // there is no inline results[] array.

      if (!jobId) {
        this.logger.warn('Axiom bulk webhook missing correlationId', { keys: Object.keys(body) });
        res.status(400).json({ success: false, error: 'correlationId is required' });
        return;
      }

      this.logger.info('Axiom bulk webhook received', { jobId, pipelineJobId, status });

      // Broadcast the job-level status change. Per-loan results are stamped by
      // the TAPE_LOAN webhook handler as each individual pipeline job completes.
      await this.axiomService.broadcastBatchJobUpdate(jobId);
      res.status(200).json({ success: true, message: 'Bulk webhook processed' });
    } catch (err) {
      this.logger.error('Axiom bulk webhook durable processing failed', {
        error: (err as Error).message,
      });
      res.status(500).json({ success: false, error: 'Bulk webhook processing failed' });
    }
  };

  /**
   * Run the Axiom agent (synchronous proxy)
   * POST /api/axiom/agent/run
   *
   * Body: {
   *   prompt: string,
   *   context?: Record<string, unknown>,
   *   maxIterations?: number
   * }
   */
  runAgent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { prompt, context, maxIterations } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'prompt is required'
          }
        });
        return;
      }

      const result = await this.axiomService.runAgent(prompt, context, maxIterations);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error running Axiom agent', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to run Axiom agent',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  // ── P2-B: GET /api/axiom/comparisons/:comparisonId ───────────────────────

  getComparison = async (req: Request, res: Response): Promise<void> => {
    try {
      const { comparisonId } = req.params as { comparisonId: string };
      if (!comparisonId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'comparisonId is required' } });
        return;
      }
      const result = await this.axiomService.getComparison(comparisonId);
      if (!result) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Comparison ${comparisonId} not found` } });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('getComparison failed', { error: (error as Error).message });
      res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to retrieve comparison from Axiom' } });
    }
  };

  // ── P2-C: POST /api/axiom/property/enrich ────────────────────────────────

  enrichProperty = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as unknown as import('../middleware/unified-auth.middleware.js').UnifiedAuthRequest;
    try {
      const tenantId = authReq.user?.tenantId;
      const clientId = (authReq.user as any)?.clientId ?? (req.body?.clientId as string | undefined);
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT', message: 'tenantId is required (ensure auth middleware is applied)' } });
        return;
      }
      const { propertyInfo, orderId } = normalizeAxiomPropertyRequestBody(req.body);
      if (!propertyInfo || !orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyInfo and orderId are required (canonical: { orderId, propertyInfo })' } });
        return;
      }
      if (!clientId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CLIENT', message: 'clientId is required' } });
        return;
      }
      const result = await this.axiomService.enrichProperty(propertyInfo, orderId, tenantId, clientId);
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      this.logger.error('enrichProperty failed', { error: (error as Error).message });
      res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to submit property enrichment to Axiom' } });
    }
  };

  // ── P2-C: GET /api/axiom/property/enrichment/:orderId ─────────────────────

  getPropertyEnrichment = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as unknown as import('../middleware/unified-auth.middleware.js').UnifiedAuthRequest;
    try {
      const tenantId = authReq.user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT', message: 'tenantId is required' } });
        return;
      }
      const { orderId } = req.params as { orderId: string };
      const result = await this.axiomService.getPropertyEnrichment(orderId, tenantId);
      if (!result) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No enrichment found for order ${orderId}` } });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('getPropertyEnrichment failed', { error: (error as Error).message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve property enrichment' } });
    }
  };

  // ── P2-D: POST /api/axiom/scoring/complexity ─────────────────────────────

  calculateComplexityScore = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as unknown as import('../middleware/unified-auth.middleware.js').UnifiedAuthRequest;
    try {
      const tenantId = authReq.user?.tenantId;
      const clientId = (authReq.user as any)?.clientId ?? (req.body?.clientId as string | undefined);
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT', message: 'tenantId is required' } });
        return;
      }
      if (!clientId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CLIENT', message: 'clientId is required' } });
        return;
      }
      const { propertyInfo, orderId } = normalizeAxiomPropertyRequestBody(req.body);
      if (!propertyInfo || !orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyInfo and orderId are required (canonical: { orderId, propertyInfo })' } });
        return;
      }
      const result = await this.axiomService.calculateComplexityScore(propertyInfo, orderId, tenantId, clientId);
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('calculateComplexityScore failed', { error: (error as Error).message });
      res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to calculate complexity score' } });
    }
  };

  // ── P2-D: GET /api/axiom/scoring/complexity/:orderId ─────────────────────

  getComplexityScore = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as unknown as import('../middleware/unified-auth.middleware.js').UnifiedAuthRequest;
    try {
      const tenantId = authReq.user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT', message: 'tenantId is required' } });
        return;
      }
      const { orderId } = req.params as { orderId: string };
      const result = await this.axiomService.getComplexityScore(orderId, tenantId);
      if (!result) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No complexity score found for order ${orderId}` } });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('getComplexityScore failed', { error: (error as Error).message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve complexity score' } });
    }
  };
}

/**
 * Create Axiom router with all endpoints.
 * Accepts an optional shared AxiomService so the in-memory compileCache is shared
 * with the criteria-programs router (P1-H — avoid duplicate instance / split cache).
 */
export function createAxiomRouter(dbService: CosmosDbService, axiomService?: AxiomService): Router {
  const router = Router();
  const controller = new AxiomController(dbService, axiomService);

  // Status check
  router.get('/status', controller.getStatus);

  // Document notification (raw, used by backend-to-backend calls)
  router.post('/documents', controller.notifyDocument);

  // Document analysis (frontend-friendly, looks up blob URL by documentId)
  router.post('/analyze', controller.analyzeDocument);

  // Agent proxy
  router.post('/agent/run', controller.runAgent);
  router.get('/bulk-submission/metrics', controller.getBulkSubmissionMetrics);
  router.get('/bulk-submission/dlq', controller.getBulkSubmissionDlq);
  router.post('/bulk-submission/dlq/:eventId/replay', controller.replayBulkSubmissionDlqEvent);

  // Evaluation retrieval
  router.get('/evaluations/order/:orderId', controller.getEvaluationByOrder);
  router.get('/evaluations/order/:orderId/stream', controller.streamOrderPipeline);
  router.get('/evaluations/:evaluationId', controller.getEvaluationById);

  // Webhooks — HMAC verification applied before handlers
  router.post('/webhook', verifyAxiomWebhook, controller.handleWebhook);
  router.post('/webhook/bulk', verifyAxiomWebhook, controller.handleBulkWebhook);
  router.post('/webhook/extraction', verifyAxiomWebhook, controller.handleExtractionWebhook);

  // Document comparison (P2-A: was at /compare, now correctly at /documents/compare)
  router.post('/documents/compare', controller.compareDocuments);
  // P2-B: comparison retrieval
  router.get('/comparisons/:comparisonId', controller.getComparison);

  // P2-C: property enrichment
  router.post('/property/enrich', controller.enrichProperty);
  router.get('/property/enrichment/:orderId', controller.getPropertyEnrichment);

  // P2-D: complexity scoring
  router.post('/scoring/complexity', controller.calculateComplexityScore);
  router.get('/scoring/complexity/:orderId', controller.getComplexityScore);

  return router;
}

/**
 * Create webhook-only Axiom router.
 *
 * This router is intentionally unauthenticated (no UnifiedAuth) because Axiom
 * callbacks are server-to-server and must be validated by HMAC signature,
 * not by end-user JWTs.
 */
export function createAxiomWebhookRouter(dbService: CosmosDbService, axiomService?: AxiomService): Router {
  const router = Router();
  const controller = new AxiomController(dbService, axiomService);

  // Webhooks — HMAC verification applied before handlers
  router.post('/webhook', verifyAxiomWebhook, controller.handleWebhook);
  router.post('/webhook/bulk', verifyAxiomWebhook, controller.handleBulkWebhook);
  router.post('/webhook/extraction', verifyAxiomWebhook, controller.handleExtractionWebhook);

  return router;
}
