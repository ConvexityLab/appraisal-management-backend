import type { AppraisalOrder } from '../types/index.js';
import { BlobStorageService } from './blob-storage.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { AxiomService } from './axiom.service.js';
import { RunLedgerService } from './run-ledger.service.js';
import { CanonicalSnapshotService } from './canonical-snapshot.service.js';
import { EngineDispatchService } from './engine-dispatch.service.js';
import { CriteriaStepInputService } from './criteria-step-input.service.js';
import type { RunLedgerRecord } from '../types/run-ledger.types.js';
import type { AxiomEvaluationResult } from './axiom.service.js';
import type {
  AnalysisSubmissionActorContext,
  AnalysisSubmissionRequest,
  AnalysisSubmissionResponse,
  AnalysisSubmissionType,
  CriteriaSubmissionRequest,
  DocumentAnalyzeSubmissionRequest,
  ExtractionSubmissionRequest,
} from '../types/analysis-submission.types.js';

export class AnalysisSubmissionService {
  private readonly axiomService: AxiomService;
  private readonly runLedgerService: RunLedgerService;
  private readonly snapshotService: CanonicalSnapshotService;
  private readonly dispatchService: EngineDispatchService;
  private readonly stepInputService: CriteriaStepInputService;
  private readonly blobService: BlobStorageService;

  constructor(private readonly dbService: CosmosDbService, axiomService?: AxiomService) {
    this.axiomService = axiomService ?? new AxiomService(dbService);
    this.runLedgerService = new RunLedgerService(dbService);
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.dispatchService = new EngineDispatchService(this.axiomService);
    this.stepInputService = new CriteriaStepInputService(dbService);
    this.blobService = new BlobStorageService();
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
    const order: AppraisalOrder | null = orderResult.success ? orderResult.data ?? null : null;
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
    const documents = [
      {
        documentName: document.name || document.fileName || request.documentId,
        documentReference: sasUrl,
      },
    ];

    const clientId = (order as any).clientInformation?.clientId || order.clientId;
    const subClientId = (order as any).subClientId ?? '';
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
    const run = await this.runLedgerService.createExtractionRun({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      correlationId: actor.correlationId,
      idempotencyKey: actor.idempotencyKey,
      documentId: request.documentId,
      schemaKey: request.schemaKey,
      runReason: request.runReason,
      ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
      ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
      ...(request.engagementId ? { engagementId: request.engagementId } : {}),
      ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
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
    const snapshot = await this.snapshotService.getSnapshotById(request.snapshotId, actor.tenantId);
    if (!snapshot) {
      throw new Error(`Snapshot '${request.snapshotId}' not found for tenant '${actor.tenantId}'`);
    }

    const run = await this.runLedgerService.createCriteriaRun({
      tenantId: actor.tenantId,
      initiatedBy: actor.initiatedBy,
      correlationId: actor.correlationId,
      idempotencyKey: actor.idempotencyKey,
      snapshotId: request.snapshotId,
      programKey: request.programKey,
      runMode: request.runMode,
      ...(request.engineTarget ? { engineTarget: request.engineTarget } : {}),
      ...(request.enginePolicyRef ? { enginePolicyRef: request.enginePolicyRef } : {}),
      ...(request.rerunReason ? { rerunReason: request.rerunReason } : {}),
      ...(request.parentRunId ? { parentRunId: request.parentRunId } : {}),
      ...(request.engagementId ? { engagementId: request.engagementId } : {}),
      ...(request.loanPropertyContextId ? { loanPropertyContextId: request.loanPropertyContextId } : {}),
    });

    const dispatchResult = await this.dispatchService.dispatchCriteria(run);
    const criteriaStepKeys =
      Array.isArray(request.criteriaStepKeys) && request.criteriaStepKeys.length > 0
        ? request.criteriaStepKeys
        : (process.env.RUN_DEFAULT_CRITERIA_STEPS
            ? process.env.RUN_DEFAULT_CRITERIA_STEPS.split(',').map((value) => value.trim()).filter(Boolean)
            : ['overall-criteria']);

    const updatedCriteriaRun = await this.runLedgerService.setRunStatus(run.id, actor.tenantId, dispatchResult.status, {
      engineRunRef: dispatchResult.engineRunRef,
      engineVersion: dispatchResult.engineVersion,
      engineRequestRef: dispatchResult.engineRequestRef,
      engineResponseRef: dispatchResult.engineResponseRef,
      canonicalSnapshotId: snapshot.id,
      criteriaStepKeys,
      ...(dispatchResult.statusDetails ? { statusDetails: dispatchResult.statusDetails } : {}),
    });

    const stepRuns: RunLedgerRecord[] = [];
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

    const finalCriteriaRun = await this.runLedgerService.updateRun(updatedCriteriaRun.id, actor.tenantId, {
      criteriaStepRunIds: stepRuns.map((item) => item.id),
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

  private buildOrderFields(order: AppraisalOrder): Array<{ fieldName: string; fieldType: string; value: unknown }> {
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
}
