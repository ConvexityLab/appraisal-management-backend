import { beforeEach, describe, expect, it, vi } from 'vitest';

const { axiosPost, axiosGet } = vi.hoisted(() => ({
  axiosPost: vi.fn(),
  axiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: axiosPost,
    get: axiosGet,
  },
  AxiosError: class AxiosError extends Error {
    response?: { status?: number };
  },
}));

import { EngineDispatchService } from '../../src/services/engine-dispatch.service.js';
import type { RunLedgerRecord } from '../../src/types/run-ledger.types.js';

function buildCriteriaRun(overrides: Partial<RunLedgerRecord> = {}): RunLedgerRecord {
  return {
    id: 'run-1',
    type: 'run-ledger-entry',
    runType: 'criteria',
    status: 'queued',
    tenantId: 'tenant-1',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    initiatedBy: 'user-1',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    engine: 'MOP_PRIO',
    engineVersion: 'pending',
    engineRunRef: 'pending',
    engineRequestRef: 'pending',
    engineResponseRef: 'pending',
    engineSelectionMode: 'EXPLICIT',
    snapshotId: 'snapshot-1',
    programKey: {
      clientId: 'client-1',
      subClientId: 'sub-1',
      programId: 'mop-qc',
      version: '1.0',
    },
    preparedContextId: 'prepared-1',
    preparedContextVersion: 'review-context:order-1:1',
    preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-qc:1.0',
    preparedPayloadContractType: 'mop-prio-review-dispatch',
    preparedPayloadContractVersion: '1.0',
    ...overrides,
  };
}

function buildAxiomCriteriaRun(overrides: Partial<RunLedgerRecord> = {}): RunLedgerRecord {
  return {
    id: 'axiom-run-1',
    type: 'run-ledger-entry',
    runType: 'criteria',
    status: 'queued',
    tenantId: 'tenant-1',
    createdAt: '2026-04-29T00:00:00.000Z',
    updatedAt: '2026-04-29T00:00:00.000Z',
    initiatedBy: 'user-1',
    correlationId: 'corr-axiom-1',
    idempotencyKey: 'idem-axiom-1',
    engine: 'AXIOM',
    engineVersion: 'pending',
    engineRunRef: 'pending',
    engineRequestRef: 'pending',
    engineResponseRef: 'pending',
    engineSelectionMode: 'EXPLICIT',
    programKey: {
      clientId: 'client-1',
      subClientId: 'sub-1',
      programId: 'axiom-qc',
      version: '1.0',
    },
    preparedContextId: 'prepared-axiom-1',
    preparedContextVersion: 'review-context:order-1:1',
    preparedPayloadRef: 'prepared-context://prepared-axiom-1/dispatch/AXIOM/axiom-qc:1.0',
    preparedPayloadContractType: 'axiom-review-dispatch',
    preparedPayloadContractVersion: '1.0',
    ...overrides,
  };
}

describe('EngineDispatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOP_PRIO_API_BASE_URL = 'http://mop-prio.local';
  });

  it('dispatches MOP/Prio criteria runs using the persisted prepared payload contract', async () => {
    axiosPost.mockResolvedValue({
      data: {
        runId: 'mop-run-1',
        status: 'queued',
        engineVersion: 'mop-prio-v1',
      },
    });

    const dbService = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'prepared-1',
            type: 'review-program-prepared-context',
            tenantId: 'tenant-1',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            preparedAt: '2026-04-29T00:00:00.000Z',
            contextSummary: {
              documentCount: 1,
              hasDocuments: true,
              hasEnrichment: true,
              extractionRunCount: 1,
              criteriaRunCount: 0,
              reviewProgramsRequested: 1,
              reviewProgramsResolved: 1,
            },
            programs: [],
            warnings: [],
            recommendedActions: [],
            context: {
              identity: { orderId: 'order-1', tenantId: 'tenant-1' },
              order: { id: 'order-1' },
              reviewPrograms: [],
              documents: [],
              runs: [],
              runSummary: { totalRuns: 1, extractionRuns: 1, criteriaRuns: 0, latestSnapshotId: 'snapshot-1' },
              evidenceRefs: [],
              warnings: [],
              assembledAt: '2026-04-29T00:00:00.000Z',
              assembledBy: 'user-1',
              contextVersion: 'review-context:order-1:1',
            },
            plannedEngineDispatches: [
              {
                id: 'prepared-1:MOP_PRIO:mop-qc:1.0',
                reviewProgramId: 'prog-1',
                reviewProgramVersion: '1.0',
                engine: 'MOP_PRIO',
                engineProgramId: 'mop-qc',
                engineProgramVersion: '1.0',
                payloadContractType: 'mop-prio-review-dispatch',
                payloadContractVersion: '1.0',
                payloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-qc:1.0',
                canDispatch: true,
                blockedReasons: [],
                payload: {
                  contractType: 'mop-prio-review-dispatch',
                  contractVersion: '1.0',
                  preparedContextId: 'prepared-1',
                  preparedContextVersion: 'review-context:order-1:1',
                  orderId: 'order-1',
                  tenantId: 'tenant-1',
                  reviewProgramId: 'prog-1',
                  reviewProgramVersion: '1.0',
                  engineProgramId: 'mop-qc',
                  engineProgramVersion: '1.0',
                  snapshotId: 'snapshot-1',
                  programKey: {
                    clientId: 'client-1',
                    subClientId: 'sub-1',
                    programId: 'mop-qc',
                    version: '1.0',
                  },
                  dispatchMode: 'prepared-context',
                  unmetRequiredInputs: [
                    {
                      criterionId: 'crit-2',
                      criterionTitle: 'Condition verification',
                      inputType: 'data',
                      requirement: 'occupancyType',
                    },
                  ],
                  criteriaSummary: {
                    totalCriteria: 1,
                    readyCriteriaCount: 1,
                    warningCriteriaCount: 0,
                    blockedCriteriaCount: 0,
                    criteriaWithUnmetRequiredInputsCount: 1,
                  },
                  provenanceSummary: {
                    sourceTypesUsed: ['extraction', 'providerData'],
                    resolvedBindingsBySource: {
                      subjectProperty: [],
                      extraction: [
                        {
                          requirementPath: 'comparables.selected',
                          resolvedPath: 'report.comps[0]',
                        },
                      ],
                      providerData: [],
                      order: [],
                      provenance: [],
                    },
                    matchedDocumentIds: [],
                    matchedDocumentTypes: [],
                    evidenceSourceTypes: ['report-comp'],
                    snapshotLinked: true,
                    snapshotId: 'snapshot-1',
                  },
                  criteria: [
                    {
                      criterionId: 'crit-1',
                      criterionTitle: 'Comp Support',
                      readiness: 'ready',
                      resolvedDataBindings: [
                        {
                          requirementPath: 'comparables.selected',
                          resolvedPath: 'report.comps[0]',
                          sourceType: 'extraction',
                        },
                      ],
                      missingDataPaths: [],
                      missingDocumentTypes: [],
                      warnings: [],
                    },
                  ],
                  documentInventory: [],
                  evidenceRefs: [{ sourceType: 'report-comp', sourceId: 'comp-1' }],
                },
              },
            ],
          },
        ],
      }),
    } as any;

    const axiomService = {
      submitPipeline: vi.fn(),
      getPipelineStatus: vi.fn(),
      fetchPipelineResults: vi.fn(),
      fetchAndStorePipelineResults: vi.fn(),
    } as any;

    const service = new EngineDispatchService(axiomService, dbService);
    const result = await service.dispatchCriteria(buildCriteriaRun());

    expect(result.engineRunRef).toBe('mop-run-1');
    expect(result.statusDetails).toEqual(expect.objectContaining({
      providerStatus: 'queued',
      unmetRequiredInputs: [
        expect.objectContaining({
          criterionId: 'crit-2',
          requirement: 'occupancyType',
        }),
      ],
      criteriaSummary: expect.objectContaining({
        totalCriteria: 1,
        criteriaWithUnmetRequiredInputsCount: 1,
      }),
      provenanceSummary: expect.objectContaining({
        sourceTypesUsed: ['extraction', 'providerData'],
        snapshotLinked: true,
      }),
    }));
    expect(axiosPost).toHaveBeenCalledWith(
      'http://mop-prio.local/api/runs/criteria',
      expect.objectContaining({
        runId: 'run-1',
        dispatchMode: 'prepared-context',
        preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-qc:1.0',
        preparedPayloadContractType: 'mop-prio-review-dispatch',
        preparedPayload: expect.objectContaining({
          contractType: 'mop-prio-review-dispatch',
          engineProgramId: 'mop-qc',
          criteria: expect.any(Array),
        }),
      }),
    );
  });

  it('fails fast when prepared-context dispatch is missing a payload reference', async () => {
    const dbService = { queryItems: vi.fn() } as any;
    const axiomService = {
      submitPipeline: vi.fn(),
      getPipelineStatus: vi.fn(),
      fetchPipelineResults: vi.fn(),
      fetchAndStorePipelineResults: vi.fn(),
    } as any;

    const service = new EngineDispatchService(axiomService, dbService);

    await expect(
      service.dispatchCriteria(
        buildCriteriaRun({
          preparedPayloadRef: undefined,
          preparedPayloadContractType: undefined,
        }),
      ),
    ).rejects.toThrow("missing preparedPayloadRef");
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('rejects MOP/Prio criteria responses that omit the engine run reference', async () => {
    axiosPost.mockResolvedValue({
      data: {
        status: 'queued',
        engineVersion: 'mop-prio-v1',
      },
    });

    const dbService = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'prepared-1',
            type: 'review-program-prepared-context',
            tenantId: 'tenant-1',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            preparedAt: '2026-04-29T00:00:00.000Z',
            contextSummary: { documentCount: 1, hasDocuments: true, hasEnrichment: true, extractionRunCount: 1, criteriaRunCount: 0, reviewProgramsRequested: 1, reviewProgramsResolved: 1 },
            programs: [],
            warnings: [],
            recommendedActions: [],
            context: { identity: { orderId: 'order-1', tenantId: 'tenant-1' }, order: { id: 'order-1' }, reviewPrograms: [], documents: [], runs: [], runSummary: { totalRuns: 1, extractionRuns: 1, criteriaRuns: 0, latestSnapshotId: 'snapshot-1' }, evidenceRefs: [], warnings: [], assembledAt: '2026-04-29T00:00:00.000Z', assembledBy: 'user-1', contextVersion: 'review-context:order-1:1' },
            plannedEngineDispatches: [
              {
                id: 'prepared-1:MOP_PRIO:mop-qc:1.0',
                reviewProgramId: 'prog-1',
                reviewProgramVersion: '1.0',
                engine: 'MOP_PRIO',
                engineProgramId: 'mop-qc',
                engineProgramVersion: '1.0',
                payloadContractType: 'mop-prio-review-dispatch',
                payloadContractVersion: '1.0',
                payloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-qc:1.0',
                canDispatch: true,
                blockedReasons: [],
                payload: {
                  contractType: 'mop-prio-review-dispatch',
                  contractVersion: '1.0',
                  preparedContextId: 'prepared-1',
                  preparedContextVersion: 'review-context:order-1:1',
                  orderId: 'order-1',
                  tenantId: 'tenant-1',
                  reviewProgramId: 'prog-1',
                  reviewProgramVersion: '1.0',
                  engineProgramId: 'mop-qc',
                  engineProgramVersion: '1.0',
                  dispatchMode: 'prepared-context',
                  criteria: [],
                  documentInventory: [],
                  evidenceRefs: [],
                },
              },
            ],
          },
        ],
      }),
    } as any;
    const axiomService = { submitPipeline: vi.fn(), getPipelineStatus: vi.fn(), fetchPipelineResults: vi.fn(), fetchAndStorePipelineResults: vi.fn() } as any;
    const service = new EngineDispatchService(axiomService, dbService);

    // Adapter rejects when neither runId nor jobId is present in the
    // dispatch response. Wording lives in the Zod schema's refine().
    await expect(service.dispatchCriteria(buildCriteriaRun())).rejects.toThrow('Dispatch response must include runId or jobId');
  });

  it('maps MOP/Prio refresh success and failure statuses explicitly', async () => {
    axiosGet
      .mockResolvedValueOnce({ data: { status: 'success', engineVersion: 'mop-prio-v2' } })
      .mockResolvedValueOnce({ data: { status: 'error', engineVersion: 'mop-prio-v2' } });

    const dbService = { queryItems: vi.fn() } as any;
    const axiomService = { submitPipeline: vi.fn(), getPipelineStatus: vi.fn(), fetchPipelineResults: vi.fn(), fetchAndStorePipelineResults: vi.fn() } as any;
    const service = new EngineDispatchService(axiomService, dbService);
    const run = buildCriteriaRun({ engineRunRef: 'mop-run-1' });

    await expect(service.refreshStatus(run)).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      engineVersion: 'mop-prio-v2',
      statusDetails: { providerStatus: 'success' },
    }));

    await expect(service.refreshStatus(run)).resolves.toEqual(expect.objectContaining({
      status: 'failed',
      engineVersion: 'mop-prio-v2',
      statusDetails: { providerStatus: 'error' },
    }));
  });

  it('dispatches Axiom prepared-context criteria runs without a snapshot', async () => {
    const submitPipeline = vi.fn().mockResolvedValue({
      jobId: 'axiom-job-1',
      status: 'submitted',
    });

    const dbService = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'prepared-axiom-1',
            type: 'review-program-prepared-context',
            tenantId: 'tenant-1',
            preparedContextId: 'prepared-axiom-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            preparedAt: '2026-04-29T00:00:00.000Z',
            contextSummary: { documentCount: 1, hasDocuments: true, hasEnrichment: true, extractionRunCount: 0, criteriaRunCount: 0, reviewProgramsRequested: 1, reviewProgramsResolved: 1 },
            programs: [],
            warnings: [],
            recommendedActions: [],
            context: {
              identity: { orderId: 'order-1', tenantId: 'tenant-1', clientId: 'client-1', subClientId: 'sub-1' },
              order: { id: 'order-1', loanAmount: 500000 },
              reviewPrograms: [],
              documents: [],
              runs: [],
              runSummary: { totalRuns: 0, extractionRuns: 0, criteriaRuns: 0 },
              evidenceRefs: [],
              warnings: [],
              assembledAt: '2026-04-29T00:00:00.000Z',
              assembledBy: 'user-1',
              contextVersion: 'review-context:order-1:1',
            },
            plannedEngineDispatches: [
              {
                id: 'prepared-axiom-1:AXIOM:axiom-qc:1.0',
                reviewProgramId: 'prog-1',
                reviewProgramVersion: '1.0',
                engine: 'AXIOM',
                engineProgramId: 'axiom-qc',
                engineProgramVersion: '1.0',
                payloadContractType: 'axiom-review-dispatch',
                payloadContractVersion: '1.0',
                payloadRef: 'prepared-context://prepared-axiom-1/dispatch/AXIOM/axiom-qc:1.0',
                canDispatch: true,
                blockedReasons: [],
                payload: {
                  contractType: 'axiom-review-dispatch',
                  contractVersion: '1.0',
                  dispatchMode: 'prepared-context',
                  preparedContextId: 'prepared-axiom-1',
                  preparedContextVersion: 'review-context:order-1:1',
                  orderId: 'order-1',
                  tenantId: 'tenant-1',
                  reviewProgramId: 'prog-1',
                  reviewProgramVersion: '1.0',
                  engineProgramId: 'axiom-qc',
                  engineProgramVersion: '1.0',
                  programKey: {
                    clientId: 'client-1',
                    subClientId: 'sub-1',
                    programId: 'axiom-qc',
                    version: '1.0',
                  },
                  unmetRequiredInputs: [
                    {
                      criterionId: 'crit-7',
                      criterionTitle: 'Photo coverage',
                      inputType: 'document',
                      requirement: 'interior-photo',
                    },
                  ],
                  criteriaSummary: {
                    totalCriteria: 0,
                    readyCriteriaCount: 0,
                    warningCriteriaCount: 0,
                    blockedCriteriaCount: 0,
                    criteriaWithUnmetRequiredInputsCount: 1,
                  },
                  provenanceSummary: {
                    sourceTypesUsed: ['providerData'],
                    resolvedBindingsBySource: {
                      subjectProperty: [],
                      extraction: [],
                      providerData: [
                        {
                          requirementPath: 'propertyType',
                          resolvedPath: 'providerData.propertyType',
                        },
                      ],
                      order: [],
                      provenance: [],
                    },
                    matchedDocumentIds: [],
                    matchedDocumentTypes: [],
                    evidenceSourceTypes: [],
                    snapshotLinked: false,
                  },
                  criteria: [],
                  documentInventory: [],
                  evidenceRefs: [],
                },
              },
            ],
          },
        ],
      }),
    } as any;

    const axiomService = {
      submitPipeline,
      getPipelineStatus: vi.fn(),
      fetchPipelineResults: vi.fn(),
      fetchAndStorePipelineResults: vi.fn(),
    } as any;

    const service = new EngineDispatchService(axiomService, dbService);
    const result = await service.dispatchCriteria(buildAxiomCriteriaRun());

    expect(result.engineRunRef).toBe('axiom-job-1');
    expect(result.statusDetails).toEqual(expect.objectContaining({
      providerStatus: 'submitted',
      unmetRequiredInputs: [
        expect.objectContaining({
          criterionId: 'crit-7',
          inputType: 'document',
        }),
      ],
      criteriaSummary: expect.objectContaining({
        criteriaWithUnmetRequiredInputsCount: 1,
      }),
      provenanceSummary: expect.objectContaining({
        sourceTypesUsed: ['providerData'],
        snapshotLinked: false,
      }),
    }));
    expect(submitPipeline).toHaveBeenCalledWith(
      'tenant-1',
      'client-1',
      'sub-1',
      'prepared-axiom-1',
      'CRITERIA_ONLY',
      expect.objectContaining({
        dispatchMode: 'prepared-context',
        preparedPayloadRef: 'prepared-context://prepared-axiom-1/dispatch/AXIOM/axiom-qc:1.0',
        preparedPayload: expect.objectContaining({
          contractType: 'axiom-review-dispatch',
          dispatchMode: 'prepared-context',
        }),
      }),
      undefined,
    );
  });
});
