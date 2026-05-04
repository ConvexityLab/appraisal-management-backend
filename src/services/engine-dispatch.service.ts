import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger.js';
import { AxiomService } from './axiom.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import { ReviewPreparedContextService } from './review-prepared-context.service.js';
import type {
  CriteriaStepEvidenceRef,
  EngineDispatchResult,
  EngineTarget,
  RunLedgerRecord,
} from '../types/run-ledger.types.js';
import type { AxiomPreparedPayload, MopPrioPreparedPayload, PreparedEngineDispatch } from '../types/review-preparation.types.js';

interface CriteriaStepDispatchOptions {
  inputSliceRef: string;
  inputSlice: Record<string, unknown>;
  evidenceRefs: CriteriaStepEvidenceRef[];
}

interface EngineAdapter {
  dispatchExtraction(run: RunLedgerRecord): Promise<EngineDispatchResult>;
  dispatchCriteria(run: RunLedgerRecord): Promise<EngineDispatchResult>;
  dispatchCriteriaStep(run: RunLedgerRecord, options: CriteriaStepDispatchOptions): Promise<EngineDispatchResult>;
  refreshStatus(run: RunLedgerRecord): Promise<EngineDispatchResult>;
}

export class EngineDispatchService {
  private readonly logger = new Logger('EngineDispatchService');
  private readonly adapters: Record<EngineTarget, EngineAdapter>;

  constructor(axiomService: AxiomService, dbService: CosmosDbService) {
    const preparedContextService = new ReviewPreparedContextService(dbService);
    this.adapters = {
      AXIOM: new AxiomEngineAdapter(axiomService, dbService, new BlobStorageService(), preparedContextService),
      MOP_PRIO: new MopPrioEngineAdapter(preparedContextService),
    };
  }

  async dispatchExtraction(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    return this.adapters[run.engine].dispatchExtraction(run);
  }

  async dispatchCriteria(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    return this.adapters[run.engine].dispatchCriteria(run);
  }

  async dispatchCriteriaStep(
    run: RunLedgerRecord,
    options: CriteriaStepDispatchOptions,
  ): Promise<EngineDispatchResult> {
    return this.adapters[run.engine].dispatchCriteriaStep(run, options);
  }

  async refreshStatus(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    return this.adapters[run.engine].refreshStatus(run);
  }
}

class AxiomEngineAdapter implements EngineAdapter {
  private readonly logger = new Logger('AxiomEngineAdapter');

  constructor(
    private readonly axiomService: AxiomService,
    private readonly dbService: CosmosDbService,
    private readonly blobService: BlobStorageService,
    private readonly preparedContextService: ReviewPreparedContextService,
  ) {}

  async dispatchExtraction(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    if (!run.schemaKey?.clientId) {
      throw new Error(`Extraction run '${run.id}' missing schemaKey.clientId required for Axiom dispatch`);
    }
    if (!run.documentId) {
      throw new Error(`Extraction run '${run.id}' missing documentId`);
    }

    const doc = await this.dbService.getItem<{ id: string; blobName: string; name: string }>('documents', run.documentId);
    if (!doc?.success || !doc.data?.blobName) {
      throw new Error(`Document '${run.documentId}' not found or missing blobName`);
    }

    const blobContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!blobContainerName) {
      throw new Error('STORAGE_CONTAINER_DOCUMENTS is required for Axiom extraction dispatch');
    }

    const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!storageAccountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required for Axiom extraction dispatch');
    }

    const blobUrl = await this.blobService.generateReadSasUrl(blobContainerName, doc.data.blobName);

    const response = await this.axiomService.submitPipeline(
      run.tenantId,
      run.schemaKey.clientId,
      run.schemaKey.subClientId,
      run.documentId,
      'EXTRACTION_ONLY',
      {
        documentId: run.documentId,
        blobUrl,
        fileName: doc.data.name,
        // FileSetInitializerActor expects a files array with { fileName, url, downloadMethod }
        files: [{ fileName: doc.data.name, url: blobUrl, downloadMethod: 'fetch' as const }],
        schemaKey: run.schemaKey,
        correlationId: run.correlationId,
        storageAccountName,
        containerNames: {
          pageDocuments: 'pages',
          blobPages: 'page-images',
          fileSets: 'file-sets',
        },
      },
      run.pipelineId,
    );

    if (!response?.jobId) {
      throw new Error(`Axiom extraction dispatch failed for run '${run.id}'`);
    }

    return {
      status: response.status === 'submitted' || response.status === 'processing' ? 'running'
        : response.status === 'completed' ? 'completed'
        : response.status === 'failed' ? 'failed'
        : 'queued',
      engineRunRef: response.jobId,
      engineVersion: process.env.AXIOM_API_VERSION ?? 'axiom-current',
      engineRequestRef: `axiom:req:${run.id}`,
      engineResponseRef: `axiom:job:${response.jobId}`,
      statusDetails: { providerStatus: response.status },
    };
  }

  async dispatchCriteria(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    const preparedDispatch = await loadPreparedDispatchIfPresent<AxiomPreparedPayload>(
      this.preparedContextService,
      run,
      'axiom-review-dispatch',
      'AXIOM',
    );
    const resolvedProgramKey = preparedDispatch?.payload.programKey ?? run.programKey;
    const resolvedSnapshotId = preparedDispatch?.payload.snapshotId ?? run.snapshotId;
    const dispatchInputRef = preparedDispatch?.payload.preparedContextId ?? resolvedSnapshotId;

    if (!resolvedProgramKey?.clientId) {
      throw new Error(`Criteria run '${run.id}' missing programKey.clientId required for Axiom dispatch`);
    }
    if (!dispatchInputRef) {
      throw new Error(`Criteria run '${run.id}' is missing preparedContextId or snapshotId required for Axiom dispatch`);
    }

    const response = await this.axiomService.submitPipeline(
      run.tenantId,
      resolvedProgramKey.clientId,
      resolvedProgramKey.subClientId,
      dispatchInputRef,
      'CRITERIA_ONLY',
      preparedDispatch
        ? {
            dispatchMode: 'prepared-context' as const,
            ...(resolvedSnapshotId ? { snapshotId: resolvedSnapshotId } : {}),
            programKey: resolvedProgramKey,
            preparedPayloadRef: preparedDispatch.payloadRef,
            preparedPayload: preparedDispatch.payload,
            correlationId: run.correlationId,
          }
        : {
            snapshotId: resolvedSnapshotId,
            programKey: resolvedProgramKey,
            correlationId: run.correlationId,
          },
      run.pipelineId,
    );

    if (!response?.jobId) {
      throw new Error(`Axiom criteria dispatch failed for run '${run.id}'`);
    }

    return {
      status: response.status === 'submitted' || response.status === 'processing' ? 'running'
        : response.status === 'completed' ? 'completed'
        : response.status === 'failed' ? 'failed'
        : 'queued',
      engineRunRef: response.jobId,
      engineVersion: process.env.AXIOM_API_VERSION ?? 'axiom-current',
      engineRequestRef: `axiom:req:${run.id}`,
      engineResponseRef: `axiom:job:${response.jobId}`,
      statusDetails: buildPreparedDispatchStatusDetails(response.status, preparedDispatch?.payload),
    };
  }

  async dispatchCriteriaStep(
    run: RunLedgerRecord,
    options: CriteriaStepDispatchOptions,
  ): Promise<EngineDispatchResult> {
    if (!run.programKey?.clientId) {
      throw new Error(`Criteria step run '${run.id}' missing programKey.clientId required for Axiom dispatch`);
    }
    if (!run.snapshotId) {
      throw new Error(`Criteria step run '${run.id}' missing snapshotId`);
    }
    if (!run.stepKey) {
      throw new Error(`Criteria step run '${run.id}' missing stepKey`);
    }

    const response = await this.axiomService.submitPipeline(
      run.tenantId,
      run.programKey.clientId,
      run.programKey.subClientId,
      `${run.snapshotId}:${run.stepKey}`,
      'CRITERIA_ONLY',
      {
        snapshotId: run.snapshotId,
        programKey: run.programKey,
        stepKey: run.stepKey,
        stepInputPayloadRef: options.inputSliceRef,
        stepInputPayload: options.inputSlice,
        stepEvidenceRefs: options.evidenceRefs,
        correlationId: run.correlationId,
      },
      run.pipelineId,
    );

    if (!response?.jobId) {
      throw new Error(`Axiom criteria step dispatch failed for run '${run.id}'`);
    }

    return {
      status: response.status === 'submitted' || response.status === 'processing' ? 'running'
        : response.status === 'completed' ? 'completed'
        : response.status === 'failed' ? 'failed'
        : 'queued',
      engineRunRef: response.jobId,
      engineVersion: process.env.AXIOM_API_VERSION ?? 'axiom-current',
      engineRequestRef: `axiom:req:${run.id}`,
      engineResponseRef: `axiom:job:${response.jobId}`,
      statusDetails: { providerStatus: response.status },
    };
  }

  async refreshStatus(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    if (!run.engineRunRef || run.engineRunRef === 'pending') {
      throw new Error(`Run '${run.id}' has no engineRunRef to refresh`);
    }

    // First, check Axiom's pipeline status API directly
    const pipelineStatus = await this.axiomService.getPipelineStatus(run.engineRunRef);
    if (pipelineStatus) {
      if (pipelineStatus.status === 'completed') {
        const results = await this.axiomService.fetchPipelineResults(run.engineRunRef);

        // Store results in aiInsights so the AI Analysis tab can display them
        // (mirrors what the webhook handler does — needed for local dev where webhooks can't reach localhost)
        const orderId = run.loanPropertyContextId ?? run.documentId ?? run.id;
        try {
          await this.axiomService.fetchAndStorePipelineResults(orderId, run.engineRunRef);
        } catch (storeErr) {
          this.logger.warn('refreshStatus: pipeline completed but failed to store results', {
            runId: run.id, engineRunRef: run.engineRunRef, error: (storeErr as Error).message,
          });
        }

        return {
          status: 'completed',
          engineRunRef: run.engineRunRef,
          engineVersion: run.engineVersion,
          engineRequestRef: run.engineRequestRef,
          engineResponseRef: run.engineResponseRef,
          statusDetails: { providerStatus: 'completed', resultKeys: results ? Object.keys(results).slice(0, 12) : [] },
        };
      }

      if (pipelineStatus.status === 'failed') {
        return {
          status: 'failed',
          engineRunRef: run.engineRunRef,
          engineVersion: run.engineVersion,
          engineRequestRef: run.engineRequestRef,
          engineResponseRef: run.engineResponseRef,
          statusDetails: { providerStatus: 'failed', error: pipelineStatus.error, progress: pipelineStatus.progress },
        };
      }

      return {
        status: pipelineStatus.status === 'pending' ? 'queued' : 'running',
        engineRunRef: run.engineRunRef,
        engineVersion: run.engineVersion,
        engineRequestRef: run.engineRequestRef,
        engineResponseRef: run.engineResponseRef,
        statusDetails: { providerStatus: pipelineStatus.status, progress: pipelineStatus.progress },
      };
    }

    this.logger.info('Axiom pipeline status unavailable', { runId: run.id, engineRunRef: run.engineRunRef });
    return {
      status: 'running',
      engineRunRef: run.engineRunRef,
      engineVersion: run.engineVersion,
      engineRequestRef: run.engineRequestRef,
      engineResponseRef: run.engineResponseRef,
      statusDetails: { providerStatus: 'unknown' },
    };
  }
}

class MopPrioEngineAdapter implements EngineAdapter {
  private readonly logger = new Logger('MopPrioEngineAdapter');

  constructor(private readonly preparedContextService: ReviewPreparedContextService) {}

  private getBaseUrl(): string {
    const baseUrl = process.env.MOP_PRIO_API_BASE_URL;
    if (!baseUrl) {
      throw new Error('MOP_PRIO_API_BASE_URL is required for MOP/Prio engine dispatch');
    }
    return baseUrl.replace(/\/+$/, '');
  }

  async dispatchExtraction(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    const baseUrl = this.getBaseUrl();
    if (!run.schemaKey?.clientId) {
      throw new Error(`Extraction run '${run.id}' missing schemaKey.clientId required for MOP/Prio dispatch`);
    }

    try {
      const response = await axios.post(`${baseUrl}/api/runs/extraction`, {
        runId: run.id,
        tenantId: run.tenantId,
        correlationId: run.correlationId,
        idempotencyKey: run.idempotencyKey,
        documentId: run.documentId,
        schemaKey: run.schemaKey,
      });

      const { engineRunRef, providerStatus, engineVersion, status } = this.parseDispatchResponse(
        response.data,
        run,
        'extraction',
      );

      return {
        status,
        engineRunRef,
        engineVersion,
        engineRequestRef: `mop-prio:req:${run.id}`,
        engineResponseRef: `mop-prio:run:${engineRunRef}`,
        statusDetails: { providerStatus },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `MOP/Prio extraction dispatch failed: ${axiosError.response?.status ?? 'n/a'} ${axiosError.message}`,
      );
    }
  }

  async dispatchCriteria(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    const baseUrl = this.getBaseUrl();
    if (run.preparedContextId && !run.preparedPayloadRef) {
      throw new Error(`Criteria run '${run.id}' is linked to prepared context '${run.preparedContextId}' but is missing preparedPayloadRef`);
    }

    const preparedDispatch = await this.loadPreparedDispatchIfPresent(run);

    try {
      const response = await axios.post(`${baseUrl}/api/runs/criteria`, {
        runId: run.id,
        tenantId: run.tenantId,
        correlationId: run.correlationId,
        idempotencyKey: run.idempotencyKey,
        ...(preparedDispatch
          ? {
              dispatchMode: 'prepared-context' as const,
              preparedPayloadRef: preparedDispatch.payloadRef,
              preparedPayloadContractType: preparedDispatch.payloadContractType,
              preparedPayloadContractVersion: preparedDispatch.payloadContractVersion,
              preparedPayload: preparedDispatch.payload,
            }
          : {
              snapshotId: run.snapshotId,
              programKey: run.programKey,
            }),
      });

      const { engineRunRef, providerStatus, engineVersion, status } = this.parseDispatchResponse(
        response.data,
        run,
        'criteria',
      );

      return {
        status,
        engineRunRef,
        engineVersion,
        engineRequestRef: `mop-prio:req:${run.id}`,
        engineResponseRef: `mop-prio:run:${engineRunRef}`,
        statusDetails: buildPreparedDispatchStatusDetails(providerStatus, preparedDispatch?.payload),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `MOP/Prio criteria dispatch failed: ${axiosError.response?.status ?? 'n/a'} ${axiosError.message}`,
      );
    }
  }

  async dispatchCriteriaStep(
    run: RunLedgerRecord,
    options: CriteriaStepDispatchOptions,
  ): Promise<EngineDispatchResult> {
    const baseUrl = this.getBaseUrl();
    if (!run.programKey?.clientId || !run.snapshotId || !run.stepKey) {
      throw new Error(`Criteria step run '${run.id}' missing required snapshot/program/step data`);
    }

    try {
      const response = await axios.post(`${baseUrl}/api/runs/criteria-steps`, {
        stepRunId: run.id,
        criteriaRunId: run.criteriaRunId,
        stepKey: run.stepKey,
        tenantId: run.tenantId,
        snapshotId: run.snapshotId,
        programKey: run.programKey,
        stepInputPayloadRef: options.inputSliceRef,
        stepInputPayload: options.inputSlice,
        stepEvidenceRefs: options.evidenceRefs,
      });

      const { engineRunRef, providerStatus, engineVersion, status } = this.parseDispatchResponse(
        response.data,
        run,
        'criteria-step',
      );

      return {
        status,
        engineRunRef,
        engineVersion,
        engineRequestRef: `mop-prio:req:${run.id}`,
        engineResponseRef: `mop-prio:run:${engineRunRef}`,
        statusDetails: { providerStatus },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `MOP/Prio criteria-step dispatch failed: ${axiosError.response?.status ?? 'n/a'} ${axiosError.message}`,
      );
    }
  }

  async refreshStatus(run: RunLedgerRecord): Promise<EngineDispatchResult> {
    const baseUrl = this.getBaseUrl();
    if (!run.engineRunRef || run.engineRunRef === 'pending') {
      throw new Error(`Run '${run.id}' has no engineRunRef to refresh`);
    }

    try {
      const response = await axios.get(`${baseUrl}/api/runs/${encodeURIComponent(run.engineRunRef)}`);
      const { providerStatus, mappedStatus, engineVersion } = this.parseRefreshResponse(response.data, run);

      return {
        status: mappedStatus,
        engineRunRef: run.engineRunRef,
        engineVersion,
        engineRequestRef: run.engineRequestRef,
        engineResponseRef: run.engineResponseRef,
        statusDetails: { providerStatus },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.warn('Failed to refresh MOP/Prio run status', {
        runId: run.id,
        engineRunRef: run.engineRunRef,
        status: axiosError.response?.status,
      });
      throw new Error(
        `MOP/Prio status refresh failed: ${axiosError.response?.status ?? 'n/a'} ${axiosError.message}`,
      );
    }
  }

  private async loadPreparedDispatchIfPresent(
    run: RunLedgerRecord,
  ): Promise<PreparedEngineDispatch & { payload: MopPrioPreparedPayload } | null> {
    if (!run.preparedPayloadRef && !run.preparedContextId) {
      if (!run.programKey?.clientId || !run.snapshotId) {
        throw new Error(`Criteria run '${run.id}' missing required programKey.clientId or snapshotId`);
      }
      return null;
    }

    if (!run.preparedPayloadRef) {
      throw new Error(`Criteria run '${run.id}' is missing preparedPayloadRef required for prepared-context dispatch`);
    }
    if (run.preparedPayloadContractType !== 'mop-prio-review-dispatch') {
      throw new Error(
        `Criteria run '${run.id}' has unsupported prepared payload contract '${run.preparedPayloadContractType ?? 'undefined'}'; expected 'mop-prio-review-dispatch'`,
      );
    }

    const dispatch = await this.preparedContextService.getPreparedDispatchByRef(run.preparedPayloadRef, run.tenantId);
    if (dispatch.engine !== 'MOP_PRIO') {
      throw new Error(`Prepared payload '${run.preparedPayloadRef}' targets engine '${dispatch.engine}', not 'MOP_PRIO'`);
    }
    if (dispatch.payloadContractVersion !== (run.preparedPayloadContractVersion ?? dispatch.payloadContractVersion)) {
      throw new Error(
        `Prepared payload '${run.preparedPayloadRef}' version '${dispatch.payloadContractVersion}' does not match run version '${run.preparedPayloadContractVersion}'`,
      );
    }

    return dispatch as PreparedEngineDispatch & { payload: MopPrioPreparedPayload };
  }

  private parseDispatchResponse(
    responseData: unknown,
    run: RunLedgerRecord,
    operation: 'extraction' | 'criteria' | 'criteria-step',
  ): {
    engineRunRef: string;
    providerStatus: string;
    engineVersion: string;
    status: EngineDispatchResult['status'];
  } {
    const body = this.readObjectResponse(responseData, operation, run);
    const engineRunRef = this.readRequiredString(body, ['runId', 'jobId'], `${operation} dispatch response`, run);
    const providerStatus = this.readRequiredString(body, ['status'], `${operation} dispatch response`, run).toLowerCase();

    return {
      engineRunRef,
      providerStatus,
      engineVersion: this.readOptionalString(body, ['engineVersion']) ?? 'mop-prio-current',
      status: this.mapProviderStatus(providerStatus),
    };
  }

  private parseRefreshResponse(
    responseData: unknown,
    run: RunLedgerRecord,
  ): {
    providerStatus: string;
    mappedStatus: EngineDispatchResult['status'];
    engineVersion: string;
  } {
    const body = this.readObjectResponse(responseData, 'status refresh', run);
    const providerStatus = this.readRequiredString(body, ['status'], 'status refresh response', run).toLowerCase();

    return {
      providerStatus,
      mappedStatus: this.mapProviderStatus(providerStatus),
      engineVersion: this.readOptionalString(body, ['engineVersion']) ?? run.engineVersion ?? 'mop-prio-current',
    };
  }

  private readObjectResponse(responseData: unknown, operation: string, run: RunLedgerRecord): Record<string, unknown> {
    if (!responseData || typeof responseData !== 'object' || Array.isArray(responseData)) {
      throw new Error(`MOP/Prio ${operation} failed for run '${run.id}': response body must be an object`);
    }

    return responseData as Record<string, unknown>;
  }

  private readRequiredString(
    body: Record<string, unknown>,
    keys: string[],
    responseLabel: string,
    run: RunLedgerRecord,
  ): string {
    const value = this.readOptionalString(body, keys);
    if (!value) {
      throw new Error(`MOP/Prio ${responseLabel} failed for run '${run.id}': missing required field ${keys.join(' or ')}`);
    }
    return value;
  }

  private readOptionalString(body: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private mapProviderStatus(providerStatus: string): EngineDispatchResult['status'] {
    if (providerStatus === 'completed' || providerStatus === 'success') {
      return 'completed';
    }
    if (providerStatus === 'failed' || providerStatus === 'error') {
      return 'failed';
    }
    if (providerStatus === 'queued' || providerStatus === 'pending') {
      return 'queued';
    }
    return 'running';
  }
}

interface PreparedDispatchResolution<TPayload extends AxiomPreparedPayload | MopPrioPreparedPayload> {
  payloadRef: string;
  payload: TPayload;
}

async function loadPreparedDispatchIfPresent<TPayload extends AxiomPreparedPayload | MopPrioPreparedPayload>(
  preparedContextService: ReviewPreparedContextService,
  run: RunLedgerRecord,
  expectedContractType: TPayload['contractType'],
  expectedEngine: EngineTarget,
): Promise<PreparedDispatchResolution<TPayload> | null> {
  if (!run.preparedPayloadRef && !run.preparedContextId) {
    return null;
  }

  if (!run.preparedPayloadRef) {
    throw new Error(`Run '${run.id}' is linked to prepared context '${run.preparedContextId}' but is missing preparedPayloadRef`);
  }
  if (run.preparedPayloadContractType !== expectedContractType) {
    throw new Error(
      `Run '${run.id}' has unsupported prepared payload contract '${run.preparedPayloadContractType ?? 'undefined'}'; expected '${expectedContractType}'`,
    );
  }

  const dispatch = await preparedContextService.getPreparedDispatchByRef(run.preparedPayloadRef, run.tenantId);
  if (dispatch.engine !== expectedEngine) {
    throw new Error(`Prepared payload '${run.preparedPayloadRef}' targets engine '${dispatch.engine}', not '${expectedEngine}'`);
  }
  if (dispatch.payloadContractType !== expectedContractType) {
    throw new Error(
      `Prepared payload '${run.preparedPayloadRef}' has contract '${dispatch.payloadContractType}', expected '${expectedContractType}'`,
    );
  }
  if (run.preparedPayloadContractVersion && dispatch.payloadContractVersion !== run.preparedPayloadContractVersion) {
    throw new Error(
      `Prepared payload '${run.preparedPayloadRef}' version '${dispatch.payloadContractVersion}' does not match run version '${run.preparedPayloadContractVersion}'`,
    );
  }

  return {
    payloadRef: dispatch.payloadRef,
    payload: dispatch.payload as TPayload,
  };
}

function buildPreparedDispatchStatusDetails(
  providerStatus: string,
  payload?: Pick<AxiomPreparedPayload, 'unmetRequiredInputs' | 'criteriaSummary' | 'provenanceSummary'>,
): Record<string, unknown> {
  return {
    providerStatus,
    ...(payload?.unmetRequiredInputs ? { unmetRequiredInputs: payload.unmetRequiredInputs } : {}),
    ...(payload?.criteriaSummary ? { criteriaSummary: payload.criteriaSummary } : {}),
    ...(payload?.provenanceSummary ? { provenanceSummary: payload.provenanceSummary } : {}),
  };
}
