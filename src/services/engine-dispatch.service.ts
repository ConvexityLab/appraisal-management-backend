import axios, { AxiosError } from 'axios';
import { Logger } from '../utils/logger.js';
import { AxiomService } from './axiom.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import type {
  CriteriaStepEvidenceRef,
  EngineDispatchResult,
  EngineTarget,
  RunLedgerRecord,
} from '../types/run-ledger.types.js';

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
    this.adapters = {
      AXIOM: new AxiomEngineAdapter(axiomService, dbService, new BlobStorageService()),
      MOP_PRIO: new MopPrioEngineAdapter(),
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
    if (!run.programKey?.clientId) {
      throw new Error(`Criteria run '${run.id}' missing programKey.clientId required for Axiom dispatch`);
    }
    if (!run.snapshotId) {
      throw new Error(`Criteria run '${run.id}' missing snapshotId`);
    }

    const response = await this.axiomService.submitPipeline(
      run.tenantId,
      run.programKey.clientId,
      run.programKey.subClientId,
      run.snapshotId,
      'CRITERIA_ONLY',
      {
        snapshotId: run.snapshotId,
        programKey: run.programKey,
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
      statusDetails: { providerStatus: response.status },
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

      const body = response.data as Record<string, unknown>;
      const engineRunRef = String(body['runId'] ?? body['jobId'] ?? run.id);
      const providerStatus = String(body['status'] ?? 'queued');

      return {
        status: providerStatus === 'completed' ? 'completed' : 'running',
        engineRunRef,
        engineVersion: String(body['engineVersion'] ?? 'mop-prio-current'),
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
    if (!run.programKey?.clientId || !run.snapshotId) {
      throw new Error(`Criteria run '${run.id}' missing required programKey.clientId or snapshotId`);
    }

    try {
      const response = await axios.post(`${baseUrl}/api/runs/criteria`, {
        runId: run.id,
        tenantId: run.tenantId,
        correlationId: run.correlationId,
        idempotencyKey: run.idempotencyKey,
        snapshotId: run.snapshotId,
        programKey: run.programKey,
      });

      const body = response.data as Record<string, unknown>;
      const engineRunRef = String(body['runId'] ?? body['jobId'] ?? run.id);
      const providerStatus = String(body['status'] ?? 'queued');

      return {
        status: providerStatus === 'completed' ? 'completed' : 'running',
        engineRunRef,
        engineVersion: String(body['engineVersion'] ?? 'mop-prio-current'),
        engineRequestRef: `mop-prio:req:${run.id}`,
        engineResponseRef: `mop-prio:run:${engineRunRef}`,
        statusDetails: { providerStatus },
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

      const body = response.data as Record<string, unknown>;
      const engineRunRef = String(body['runId'] ?? body['jobId'] ?? run.id);
      const providerStatus = String(body['status'] ?? 'queued');

      return {
        status: providerStatus === 'completed' ? 'completed' : 'running',
        engineRunRef,
        engineVersion: String(body['engineVersion'] ?? 'mop-prio-current'),
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
      const body = response.data as Record<string, unknown>;
      const providerStatus = String(body['status'] ?? 'running').toLowerCase();

      let mappedStatus: EngineDispatchResult['status'] = 'running';
      if (providerStatus === 'completed' || providerStatus === 'success') mappedStatus = 'completed';
      else if (providerStatus === 'failed' || providerStatus === 'error') mappedStatus = 'failed';
      else if (providerStatus === 'queued' || providerStatus === 'pending') mappedStatus = 'queued';

      return {
        status: mappedStatus,
        engineRunRef: run.engineRunRef,
        engineVersion: String(body['engineVersion'] ?? run.engineVersion ?? 'mop-prio-current'),
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
}
