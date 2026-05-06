import type { VendorOrder } from '../types/vendor-order.types.js';
import { BlobStorageService } from './blob-storage.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { AxiomService } from './axiom.service.js';
import { RunLedgerService } from './run-ledger.service.js';
import { CanonicalSnapshotService } from './canonical-snapshot.service.js';
import { EngineDispatchService } from './engine-dispatch.service.js';
import { CriteriaStepInputService } from './criteria-step-input.service.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { recordEventPublishFailure } from '../utils/event-publish-failure-counter.js';
import type { RunLedgerRecord } from '../types/run-ledger.types.js';
import type { AxiomEvaluationResult } from './axiom.service.js';
import type { DocumentMetadata } from '../types/document.types.js';
import type { IntakeSourceIdentity } from '../types/intake-source.types.js';
import type {
  AnalysisSubmissionActorContext,
  AnalysisSubmissionRequest,
  AnalysisSubmissionResponse,
  AnalysisSubmissionType,
  CriteriaSubmissionRequest,
  DocumentAnalyzeSubmissionRequest,
  ExtractionSubmissionRequest,
} from '../types/analysis-submission.types.js';
import { buildManualDraftSourceIdentity, extendIntakeSourceIdentity } from '../types/intake-source.types.js';

export class AnalysisSubmissionService {
  private readonly axiomService: AxiomService;
  private readonly runLedgerService: RunLedgerService;
  private readonly snapshotService: CanonicalSnapshotService;
  private readonly dispatchService: EngineDispatchService;
  private readonly stepInputService: CriteriaStepInputService;
  private readonly blobService: BlobStorageService;
  private readonly configService: TenantAutomationConfigService;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly logger = new Logger('AnalysisSubmissionService');

  constructor(private readonly dbService: CosmosDbService, axiomService?: AxiomService) {
    this.axiomService = axiomService ?? new AxiomService(dbService);
    this.runLedgerService = new RunLedgerService(dbService);
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.dispatchService = new EngineDispatchService(this.axiomService, dbService);
    this.stepInputService = new CriteriaStepInputService(dbService);
    this.blobService = new BlobStorageService();
    this.configService = new TenantAutomationConfigService(dbService);
    this.publisher = new ServiceBusEventPublisher();
  }

  /**
   * Publish an event to Service Bus. Best-effort — never throws.
   *
   * Failures are logged AND recorded on the EventPublishFailureCounter so that
   * a Service Bus outage shows up as a queryable signal for ops, not silent
   * data loss for downstream audit / event consumers.
   */
  private async publishEvent(
    type: string,
    category: EventCategory,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.publisher.publish({
        id: uuidv4(),
        type,
        timestamp: new Date(),
        source: 'analysis-submission-service',
        version: '1.0',
        category,
        data: { priority: EventPriority.NORMAL, ...data },
      } as any);
    } catch (err) {
      this.logger.warn(`Failed to publish ${type}`, { error: (err as Error).message });
      recordEventPublishFailure({
        eventType: type,
        error: err,
        source: 'analysis-submission-service',
        context: {
          ...(typeof data['correlationId'] === 'string' ? { correlationId: data['correlationId'] } : {}),
          ...(typeof data['orderId'] === 'string' ? { orderId: data['orderId'] } : {}),
        },
      });
    }
  }

  async submit(
    request: AnalysisSubmissionRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    switch (request.analysisType) {
      case 'DOCUMENT_ANALYZE':
        return this.submitDocumentAnalyze(request, actor);
      case 'EXTRACTION':
        return this.submitExtraction(request, actor);
      case 'CRITERIA':
        return this.submitCriteria(request, actor);
      default:
        throw new Error(`Unsupported analysisType: ${(request as { analysisType?: string }).analysisType ?? 'unknown'}`);
    }
  }

  async rerunCriteriaStep(
    request: {
      criteriaRunId: string;
      stepKey: string;
      rerunReason: string;
      engineTarget?: 'AXIOM' | 'MOP_PRIO';
      enginePolicyRef?: string;
    },
    actor: AnalysisSubmissionActorContext,
  ): Promise<RunLedgerRecord> {
    const criteriaRun = await this.runLedgerService.getRunById(request.criteriaRunId, actor.tenantId);
    if (!criteriaRun || criteriaRun.runType !== 'criteria') {
      throw new Error(`Criteria run '${request.criteriaRunId}' was not found`);
    }

    const snapshotId = criteriaRun.canonicalSnapshotId ?? criteriaRun.snapshotId;
    if (!snapshotId) {
      throw new Error(`Criteria run '${request.criteriaRunId}' is missing snapshot linkage`);
    }

    const snapshot = await this.snapshotService.getSnapshotById(snapshotId, actor.tenantId);
    if (!snapshot) {
      throw new Error(`Snapshot '${snapshotId}' was not found for tenant '${actor.tenantId}'`);
    }

    const stepRun = await this.runLedgerService.rerunCriteriaStep({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      correlationId: actor.correlationId,
      idempotencyKey: actor.idempotencyKey,
      criteriaRunId: request.criteriaRunId,
      stepKey: request.stepKey,
      rerunReason: request.rerunReason,
      ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
      ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
    });

    const stepInputSlice = await this.stepInputService.createStepInputSlice({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      criteriaRun,
      stepRun,
      snapshot,
    });

    const stepDispatchResult = await this.dispatchService.dispatchCriteriaStep(stepRun, {
      inputSliceRef: stepInputSlice.payloadRef,
      inputSlice: stepInputSlice.payload,
      evidenceRefs: stepInputSlice.evidenceRefs,
    });

    return this.runLedgerService.setRunStatus(stepRun.id, actor.tenantId, stepDispatchResult.status, {
      engineRunRef: stepDispatchResult.engineRunRef,
      engineVersion: stepDispatchResult.engineVersion,
      engineRequestRef: stepDispatchResult.engineRequestRef,
      engineResponseRef: stepDispatchResult.engineResponseRef,
      statusDetails: {
        ...(stepDispatchResult.statusDetails ?? {}),
        stepInputSliceId: stepInputSlice.id,
        stepInputPayloadRef: stepInputSlice.payloadRef,
        stepEvidenceRefs: stepInputSlice.evidenceRefs,
      },
    });
  }

  async getSubmission(
    submissionId: string,
    actor: AnalysisSubmissionActorContext,
    requestedType?: AnalysisSubmissionType,
  ): Promise<AnalysisSubmissionResponse> {
    if (!submissionId || submissionId.trim().length === 0) {
      throw new Error('submissionId is required');
    }

    if (requestedType === 'DOCUMENT_ANALYZE') {
      return this.getDocumentAnalyzeSubmission(submissionId, actor);
    }

    if (requestedType === 'EXTRACTION' || requestedType === 'CRITERIA') {
      return this.getRunLedgerSubmission(submissionId, actor, requestedType);
    }

    const runRecord = await this.runLedgerService.getRunById(submissionId, actor.tenantId);
    if (runRecord) {
      return this.buildRunLedgerResponse(runRecord, actor);
    }

    return this.getDocumentAnalyzeSubmission(submissionId, actor);
  }

  private async getRunLedgerSubmission(
    submissionId: string,
    actor: AnalysisSubmissionActorContext,
    requestedType: 'EXTRACTION' | 'CRITERIA',
  ): Promise<AnalysisSubmissionResponse> {
    const runRecord = await this.runLedgerService.getRunById(submissionId, actor.tenantId);
    if (!runRecord) {
      throw new Error(`Submission '${submissionId}' not found`);
    }

    const derivedType = runRecord.runType === 'extraction' ? 'EXTRACTION' : 'CRITERIA';
    if (derivedType !== requestedType) {
      throw new Error(`Submission '${submissionId}' is not a ${requestedType} submission`);
    }

    return this.buildRunLedgerResponse(runRecord, actor);
  }

  private async getDocumentAnalyzeSubmission(
    submissionId: string,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    const evaluation = await this.axiomService.getEvaluationById(submissionId);
    if (!evaluation) {
      throw new Error(`Submission '${submissionId}' not found`);
    }

    const authorized = await this.verifyEvaluationTenantAccess(evaluation, actor.tenantId);
    if (!authorized) {
      throw new Error(`Submission '${submissionId}' not found`);
    }

    return {
      submissionId: evaluation.evaluationId,
      analysisType: 'DOCUMENT_ANALYZE',
      status: this.mapAxiomStatusToRunStatus(evaluation.status),
      provider: 'AXIOM',
      evaluationId: evaluation.evaluationId,
      ...(evaluation.pipelineJobId ? { pipelineJobId: evaluation.pipelineJobId } : {}),
    };
  }

  private async buildRunLedgerResponse(
    runRecord: RunLedgerRecord,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    const analysisType: AnalysisSubmissionType = runRecord.runType === 'extraction' ? 'EXTRACTION' : 'CRITERIA';

    if (runRecord.runType === 'criteria') {
      const stepRuns = await this.runLedgerService.listCriteriaStepRuns(runRecord.id, actor.tenantId);
      return {
        submissionId: runRecord.id,
        analysisType,
        status: runRecord.status,
        provider: 'RUN_LEDGER',
        run: runRecord,
        stepRuns,
      };
    }

    if (runRecord.runType === 'criteria-step') {
      return {
        submissionId: runRecord.id,
        analysisType,
        status: runRecord.status,
        provider: 'RUN_LEDGER',
        run: runRecord,
        stepRuns: [runRecord],
      };
    }

    return {
      submissionId: runRecord.id,
      analysisType,
      status: runRecord.status,
      provider: 'RUN_LEDGER',
      run: runRecord,
    };
  }

  private mapAxiomStatusToRunStatus(status: AxiomEvaluationResult['status']): AnalysisSubmissionResponse['status'] {
    switch (status) {
      case 'pending':
        return 'queued';
      case 'processing':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        throw new Error(`Unsupported Axiom evaluation status '${status}'`);
    }
  }

  private async verifyEvaluationTenantAccess(evaluation: AxiomEvaluationResult, tenantId: string): Promise<boolean> {
    if (evaluation.tenantId) {
      return evaluation.tenantId === tenantId;
    }

    if (!evaluation.orderId) {
      return false;
    }

    const orderResult = await this.dbService.findOrderById(evaluation.orderId);
    if (!orderResult.success || !orderResult.data) {
      return false;
    }

    return orderResult.data.tenantId === tenantId;
  }

  private async submitDocumentAnalyze(
    request: DocumentAnalyzeSubmissionRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    const queryResult = await this.dbService.queryItems<any>(
      'documents',
      'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
      [
        { name: '@id', value: request.documentId },
        { name: '@tenantId', value: actor.tenantId },
      ],
    );

    const document = queryResult.success && queryResult.data && queryResult.data.length > 0
      ? queryResult.data[0]
      : null;

    if (!document) {
      throw new Error(`Document '${request.documentId}' not found`);
    }

    const orderResult = await this.dbService.findOrderById(request.orderId);
    const order: VendorOrder | null = orderResult.success ? orderResult.data ?? null : null;
    if (!order) {
      throw new Error(`Order '${request.orderId}' not found`);
    }

    if (!document.blobName) {
      throw new Error(`Document '${request.documentId}' has no blobName — cannot generate SAS URL`);
    }

    const documentContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!documentContainerName) {
      throw new Error('STORAGE_CONTAINER_DOCUMENTS not configured');
    }

    const sasUrl = await this.blobService.generateReadSasUrl(documentContainerName, document.blobName);

    const fields = this.buildOrderFields(order);
    // T1.3: pass our internal documentId alongside the SAS URL so submitOrderEvaluation
    // can stamp _metadata for downstream resolvedDocumentId enrichment.
    const documents = [
      {
        documentName: document.name || document.fileName || request.documentId,
        documentReference: sasUrl,
        documentId: request.documentId,
      },
    ];

    const clientId = (order as any).clientInformation?.clientId || order.clientId;
    const subClientId = (order as any).subClientId ?? '';
    const sourceIdentity = await this.resolveSubmissionSourceIdentity({
      tenantId: actor.tenantId,
      documentId: request.documentId,
      orderId: request.orderId,
      engagementId: typeof (order as any).engagementId === 'string' ? (order as any).engagementId : undefined,
      loanPropertyContextId: request.orderId,
    });
    const pipelineResult = await this.axiomService.submitOrderEvaluation(
      request.orderId,
      fields,
      documents,
      order.tenantId,
      clientId,
      subClientId,
      request.programId,
      request.programVersion,
      'ORDER',
      request.evaluationMode,
      request.forceResubmit ?? false,
    );

    if (!pipelineResult) {
      const lastError = this.axiomService.getLastPipelineSubmissionError();
      throw new Error(lastError?.message ?? 'Failed to submit document to Axiom pipeline');
    }

    // Create a run-ledger record so the unified monitoring UI can track this submission
    try {
      const config = await this.configService.getConfig(clientId, subClientId);
      const run = await this.runLedgerService.createExtractionRun({
        tenantId: actor.tenantId,
        initiatedBy: actor.initiatedBy,
        correlationId: actor.correlationId,
        idempotencyKey: `${actor.idempotencyKey}-ledger`,
        documentId: request.documentId,
        schemaKey: {
          clientId,
          subClientId,
          documentType: request.documentType ?? 'appraisal-report',
          version: config.axiomDocumentSchemaVersion ?? '1.0.0',
        },
        runReason: 'DOCUMENT_ANALYZE submission',
        ...(request.evaluationMode === 'EXTRACTION' && config.axiomPipelineIdExtraction ? { pipelineId: config.axiomPipelineIdExtraction }
          : request.evaluationMode === 'CRITERIA_EVALUATION' && config.axiomPipelineIdCriteria ? { pipelineId: config.axiomPipelineIdCriteria }
          : config.axiomPipelineIdComplete ? { pipelineId: config.axiomPipelineIdComplete }
          : {}),
        ...(request.orderId ? { loanPropertyContextId: request.orderId } : {}),
        ...(sourceIdentity ? { sourceIdentity } : {}),
      });
      await this.runLedgerService.setRunStatus(run.id, actor.tenantId, 'running', {
        engineRunRef: pipelineResult.pipelineJobId,
        engineVersion: 'axiom-current',
        engineRequestRef: `axiom:req:${run.id}`,
        engineResponseRef: `axiom:job:${pipelineResult.pipelineJobId}`,
      });
    } catch (ledgerErr) {
      this.logger.error('Failed to create run-ledger record for DOCUMENT_ANALYZE submission — submission succeeded but run will not appear in run ledger', {
        orderId: request.orderId,
        documentId: request.documentId,
        error: (ledgerErr as Error).message,
      });
    }

    return {
      submissionId: pipelineResult.evaluationId,
      analysisType: 'DOCUMENT_ANALYZE',
      status: 'queued',
      provider: 'AXIOM',
      evaluationId: pipelineResult.evaluationId,
      pipelineJobId: pipelineResult.pipelineJobId,
    };
  }

  private async submitExtraction(
    request: ExtractionSubmissionRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    const clientId = request.schemaKey.clientId;
    const subClientId = request.schemaKey.subClientId;
    const config = await this.configService.getConfig(clientId, subClientId);
    const sourceIdentity = await this.resolveSubmissionSourceIdentity({
      tenantId: actor.tenantId,
      documentId: request.documentId,
      ...(request.loanPropertyContextId ? { orderId: request.loanPropertyContextId } : {}),
      ...(request.engagementId ? { engagementId: request.engagementId } : {}),
      ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
    });

    const run = await this.runLedgerService.createExtractionRun({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      correlationId: actor.correlationId,
      idempotencyKey: actor.idempotencyKey,
      documentId: request.documentId,
      schemaKey: request.schemaKey,
      runReason: request.runReason,
      ...(config.axiomPipelineIdExtraction ? { pipelineId: config.axiomPipelineIdExtraction } : {}),
      ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
      ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
      ...(request.engagementId ? { engagementId: request.engagementId } : {}),
      ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
      ...(sourceIdentity ? { sourceIdentity } : {}),
    });

    const dispatchResult = await this.dispatchService.dispatchExtraction(run);
    const runningRun = await this.runLedgerService.setRunStatus(run.id, actor.tenantId, dispatchResult.status, {
      engineRunRef: dispatchResult.engineRunRef,
      engineVersion: dispatchResult.engineVersion,
      engineRequestRef: dispatchResult.engineRequestRef,
      engineResponseRef: dispatchResult.engineResponseRef,
      ...(dispatchResult.statusDetails ? { statusDetails: dispatchResult.statusDetails } : {}),
    });

    const snapshot = await this.snapshotService.createFromExtractionRun(runningRun);
    const linkedRun = await this.runLedgerService.updateRun(run.id, actor.tenantId, {
      canonicalSnapshotId: snapshot.id,
    });

    // Publish axiom.evaluation.submitted event so the engagement stream shows the extraction run
    await this.publishEvent('axiom.evaluation.submitted', EventCategory.AXIOM, {
      orderId: request.loanPropertyContextId,
      engagementId: request.engagementId,
      tenantId: actor.tenantId,
      clientId,
      evaluationId: linkedRun.id,
      pipelineJobId: dispatchResult.engineRunRef,
      pipelineName: run.pipelineId ?? 'adaptive-document-processing',
      runType: 'extraction',
      documentId: request.documentId,
    });

    return {
      submissionId: linkedRun.id,
      analysisType: 'EXTRACTION',
      status: linkedRun.status,
      provider: 'RUN_LEDGER',
      run: linkedRun,
    };
  }

  private async submitCriteria(
    request: CriteriaSubmissionRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<AnalysisSubmissionResponse> {
    const snapshot = request.snapshotId
      ? await this.snapshotService.getSnapshotById(request.snapshotId, actor.tenantId)
      : null;
    if (request.snapshotId && !snapshot) {
      throw new Error(`Snapshot '${request.snapshotId}' not found for tenant '${actor.tenantId}'`);
    }
    if (!snapshot && !(request.preparedContextId && request.preparedPayloadRef)) {
      throw new Error('Criteria submission requires a snapshot unless it is a prepared-context dispatch.');
    }

    const clientId = request.programKey.clientId;
    const subClientId = request.programKey.subClientId;
    const config = await this.configService.getConfig(clientId, subClientId);
    const sourceIdentity = snapshot?.sourceIdentity
      ? extendIntakeSourceIdentity(snapshot.sourceIdentity, {
          ...(request.loanPropertyContextId ? { orderId: request.loanPropertyContextId } : {}),
          ...(request.engagementId ? { engagementId: request.engagementId } : {}),
          ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
        })
      : await this.resolveSubmissionSourceIdentity({
          tenantId: actor.tenantId,
          ...(request.loanPropertyContextId ? { orderId: request.loanPropertyContextId } : {}),
          ...(request.engagementId ? { engagementId: request.engagementId } : {}),
          ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
        });

    const run = await this.runLedgerService.createCriteriaRun({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      correlationId: actor.correlationId,
      idempotencyKey: actor.idempotencyKey,
      programKey: request.programKey,
      runMode: request.runMode,
      ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
      ...(config.axiomPipelineIdCriteria ? { pipelineId: config.axiomPipelineIdCriteria } : {}),
      ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
      ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
      ...(request.rerunReason ? { rerunReason: request.rerunReason } : {}),
      ...(request.parentRunId ? { parentRunId: request.parentRunId } : {}),
      ...(request.engagementId ? { engagementId: request.engagementId } : {}),
      ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
      ...(request.preparedContextId ? { preparedContextId: request.preparedContextId } : {}),
      ...(request.preparedContextVersion ? { preparedContextVersion: request.preparedContextVersion } : {}),
      ...(request.preparedDispatchId ? { preparedDispatchId: request.preparedDispatchId } : {}),
      ...(request.preparedPayloadRef ? { preparedPayloadRef: request.preparedPayloadRef } : {}),
      ...(request.preparedPayloadContractType ? { preparedPayloadContractType: request.preparedPayloadContractType } : {}),
      ...(request.preparedPayloadContractVersion ? { preparedPayloadContractVersion: request.preparedPayloadContractVersion } : {}),
      ...(sourceIdentity ? { sourceIdentity } : {}),
    });

    const dispatchResult = await this.dispatchService.dispatchCriteria(run);
    const criteriaStepKeys = snapshot
      ? (
          Array.isArray(request.criteriaStepKeys) && request.criteriaStepKeys.length > 0
            ? request.criteriaStepKeys
            : (Array.isArray(config.axiomDefaultCriteriaStepKeys) && config.axiomDefaultCriteriaStepKeys.length > 0
                ? config.axiomDefaultCriteriaStepKeys
                : ['overall-criteria'])
        )
      : [];

    const updatedCriteriaRun = await this.runLedgerService.setRunStatus(run.id, actor.tenantId, dispatchResult.status, {
      engineRunRef: dispatchResult.engineRunRef,
      engineVersion: dispatchResult.engineVersion,
      engineRequestRef: dispatchResult.engineRequestRef,
      engineResponseRef: dispatchResult.engineResponseRef,
      ...(snapshot ? { canonicalSnapshotId: snapshot.id } : {}),
      criteriaStepKeys,
      ...((dispatchResult.statusDetails || request.preparedContextId)
        ? {
            statusDetails: {
              ...(dispatchResult.statusDetails ?? {}),
              ...(request.preparedContextId ? { preparedContextId: request.preparedContextId } : {}),
              ...(request.preparedDispatchId ? { preparedDispatchId: request.preparedDispatchId } : {}),
              ...(request.preparedPayloadRef ? { preparedPayloadRef: request.preparedPayloadRef } : {}),
              ...(request.preparedPayloadContractType ? { preparedPayloadContractType: request.preparedPayloadContractType } : {}),
              ...(request.preparedPayloadContractVersion ? { preparedPayloadContractVersion: request.preparedPayloadContractVersion } : {}),
            },
          }
        : {}),
    });

    const stepRuns: RunLedgerRecord[] = [];
    if (snapshot) {
      for (const stepKey of criteriaStepKeys) {
        const stepRun = await this.runLedgerService.createCriteriaStepRun({
          tenantId: actor.tenantId,
          initiatedBy: actor.initiatedBy,
          correlationId: `${actor.correlationId}:${stepKey}`,
          idempotencyKey: `${actor.idempotencyKey}:${stepKey}`,
          parentCriteriaRunId: updatedCriteriaRun.id,
          stepKey,
          ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
          ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
        });

        const stepInputSlice = await this.stepInputService.createStepInputSlice({
          tenantId: actor.tenantId,
          initiatedBy: actor.initiatedBy,
          criteriaRun: updatedCriteriaRun,
          stepRun,
          snapshot,
        });

        const stepDispatchResult = await this.dispatchService.dispatchCriteriaStep(stepRun, {
          inputSliceRef: stepInputSlice.payloadRef,
          inputSlice: stepInputSlice.payload,
          evidenceRefs: stepInputSlice.evidenceRefs,
        });

        const hydratedStepRun = await this.runLedgerService.setRunStatus(stepRun.id, actor.tenantId, stepDispatchResult.status, {
          engineRunRef: stepDispatchResult.engineRunRef,
          engineVersion: stepDispatchResult.engineVersion,
          engineRequestRef: stepDispatchResult.engineRequestRef,
          engineResponseRef: stepDispatchResult.engineResponseRef,
          statusDetails: {
            ...(stepDispatchResult.statusDetails ?? {}),
            stepInputSliceId: stepInputSlice.id,
            stepInputPayloadRef: stepInputSlice.payloadRef,
            stepEvidenceRefs: stepInputSlice.evidenceRefs,
          },
        });
        stepRuns.push(hydratedStepRun);
      }
    }

    const finalCriteriaRun = await this.runLedgerService.updateRun(updatedCriteriaRun.id, actor.tenantId, {
      criteriaStepRunIds: stepRuns.map((item) => item.id),
    });

    // Publish axiom.evaluation.submitted event for criteria evaluation
    await this.publishEvent('axiom.evaluation.submitted', EventCategory.AXIOM, {
      orderId: request.loanPropertyContextId,
      engagementId: request.engagementId,
      tenantId: actor.tenantId,
      clientId,
      evaluationId: finalCriteriaRun.id,
      pipelineJobId: dispatchResult.engineRunRef,
      pipelineName: run.pipelineId ?? 'criteria-evaluation',
      runType: 'criteria',
      ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
      programKey: request.programKey,
      stepCount: stepRuns.length,
    });

    return {
      submissionId: finalCriteriaRun.id,
      analysisType: 'CRITERIA',
      status: finalCriteriaRun.status,
      provider: 'RUN_LEDGER',
      run: finalCriteriaRun,
      stepRuns,
    };
  }

  private buildOrderFields(order: VendorOrder): Array<{ fieldName: string; fieldType: string; value: unknown }> {
    const address = order.propertyAddress;
    const property = order.propertyDetails;
    const loan = order.loanInformation;
    const borrower = order.borrowerInformation;

    return [
      { fieldName: 'orderId', fieldType: 'string', value: order.id },
      { fieldName: 'loanAmount', fieldType: 'number', value: loan?.loanAmount ?? 0 },
      { fieldName: 'loanType', fieldType: 'string', value: String(loan?.loanType ?? '') },
      { fieldName: 'productType', fieldType: 'string', value: order.productType },
      { fieldName: 'borrowerName', fieldType: 'string', value: `${borrower?.firstName ?? ''} ${borrower?.lastName ?? ''}`.trim() },
      { fieldName: 'propertyStreet', fieldType: 'string', value: address?.streetAddress },
      { fieldName: 'propertyCity', fieldType: 'string', value: address?.city },
      { fieldName: 'propertyState', fieldType: 'string', value: address?.state },
      { fieldName: 'propertyZip', fieldType: 'string', value: address?.zipCode },
      { fieldName: 'propertyType', fieldType: 'string', value: String(property?.propertyType ?? '') },
      { fieldName: 'tenantId', fieldType: 'string', value: order.tenantId },
      { fieldName: 'clientId', fieldType: 'string', value: order.clientId },
    ].filter((field) => {
      if (typeof field.value === 'string') return field.value.trim().length > 0;
      if (typeof field.value === 'number') return field.value !== 0;
      return field.value !== null && field.value !== undefined;
    });
  }

  private async resolveSubmissionSourceIdentity(params: {
    tenantId: string;
    documentId?: string;
    orderId?: string;
    engagementId?: string;
    loanPropertyContextId?: string;
  }): Promise<IntakeSourceIdentity | undefined> {
    const document = params.documentId
      ? await this.loadDocumentById(params.documentId, params.tenantId)
      : null;

    if (document?.sourceIdentity) {
      return extendIntakeSourceIdentity(document.sourceIdentity, {
        ...(params.orderId ?? document.orderId ? { orderId: params.orderId ?? document.orderId } : {}),
        ...(params.engagementId ? { engagementId: params.engagementId } : {}),
        ...(params.loanPropertyContextId ? { loanPropertyContextId: params.loanPropertyContextId } : {}),
        documentId: document.id,
      });
    }

    if (document?.entityType === 'order-intake-draft' && document.entityId) {
      return buildManualDraftSourceIdentity({
        intakeDraftId: document.entityId,
        ...(params.orderId ?? document.orderId ? { orderId: params.orderId ?? document.orderId } : {}),
        ...(params.engagementId ? { engagementId: params.engagementId } : {}),
        ...(params.loanPropertyContextId ? { loanPropertyContextId: params.loanPropertyContextId } : {}),
        documentId: document.id,
      });
    }

    const resolvedOrderId = params.orderId ?? document?.orderId;
    if (!resolvedOrderId) {
      return undefined;
    }

    const orderResult = await this.dbService.findOrderById(resolvedOrderId);
    if (!orderResult.success || !orderResult.data) {
      return undefined;
    }

    return extendIntakeSourceIdentity(
      ((orderResult.data as any).metadata?.sourceIdentity ?? undefined) as IntakeSourceIdentity | undefined,
      {
        orderId: resolvedOrderId,
        ...(params.engagementId ? { engagementId: params.engagementId } : {}),
        ...(params.loanPropertyContextId ? { loanPropertyContextId: params.loanPropertyContextId } : {}),
        ...(document?.id ? { documentId: document.id } : {}),
      },
    );
  }

  private async loadDocumentById(documentId: string, tenantId: string): Promise<DocumentMetadata | null> {
    const result = await this.dbService.queryItems<DocumentMetadata>(
      'documents',
      'SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
      [
        { name: '@id', value: documentId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }
}
