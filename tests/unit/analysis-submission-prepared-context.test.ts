import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: vi.fn(),
  })),
}));

const mockCreateCriteriaRun = vi.fn().mockResolvedValue({
  id: 'criteria-run-1',
  tenantId: 'tenant-123',
  runType: 'criteria',
  status: 'queued',
  engine: 'MOP_PRIO',
  correlationId: 'corr-123',
  idempotencyKey: 'idem-123',
  programKey: { clientId: 'client-123', subClientId: 'sub-client-123', programId: 'mop-program', version: '1.0' },
  preparedContextId: 'prepared-1',
  preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-program:1.0',
});
const mockSetRunStatus = vi.fn().mockImplementation(async (id: string, _tenantId: string, status: string, metadata: Record<string, unknown>) => ({
  id,
  tenantId: 'tenant-123',
  runType: 'criteria',
  status,
  engine: 'MOP_PRIO',
  correlationId: 'corr-123',
  idempotencyKey: 'idem-123',
  programKey: { clientId: 'client-123', subClientId: 'sub-client-123', programId: 'mop-program', version: '1.0' },
  ...metadata,
}));
const mockUpdateRun = vi.fn().mockImplementation(async (id: string, _tenantId: string, updates: Record<string, unknown>) => ({
  id,
  tenantId: 'tenant-123',
  runType: 'criteria',
  status: 'running',
  engine: 'MOP_PRIO',
  correlationId: 'corr-123',
  idempotencyKey: 'idem-123',
  programKey: { clientId: 'client-123', subClientId: 'sub-client-123', programId: 'mop-program', version: '1.0' },
  ...updates,
}));
const mockCreateCriteriaStepRun = vi.fn();
const mockDispatchCriteria = vi.fn().mockResolvedValue({
  status: 'running',
  engineRunRef: 'engine-run-1',
  engineVersion: 'mop-prio-current',
  engineRequestRef: 'req-1',
  engineResponseRef: 'res-1',
  statusDetails: {
    providerStatus: 'queued',
    unmetRequiredInputs: [
      {
        criterionId: 'crit-1',
        criterionTitle: 'Property type check',
        inputType: 'data',
        requirement: 'propertyType',
      },
    ],
    criteriaSummary: {
      totalCriteria: 1,
      readyCriteriaCount: 0,
      warningCriteriaCount: 0,
      blockedCriteriaCount: 1,
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
      evidenceSourceTypes: ['property-enrichment'],
      snapshotLinked: false,
    },
  },
});
const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/run-ledger.service.js', () => ({
  RunLedgerService: vi.fn().mockImplementation(() => ({
    getRunById: vi.fn(),
    listCriteriaStepRuns: vi.fn().mockResolvedValue([]),
    createExtractionRun: vi.fn(),
    createCriteriaRun: mockCreateCriteriaRun,
    setRunStatus: mockSetRunStatus,
    updateRun: mockUpdateRun,
    createCriteriaStepRun: mockCreateCriteriaStepRun,
    rerunCriteriaStep: vi.fn(),
  })),
}));

vi.mock('../../src/services/canonical-snapshot.service.js', () => ({
  CanonicalSnapshotService: vi.fn().mockImplementation(() => ({
    getSnapshotById: vi.fn().mockResolvedValue(null),
    createFromExtractionRun: vi.fn(),
  })),
}));

vi.mock('../../src/services/engine-dispatch.service.js', () => ({
  EngineDispatchService: vi.fn().mockImplementation(() => ({
    dispatchCriteria: mockDispatchCriteria,
    dispatchCriteriaStep: vi.fn(),
    dispatchExtraction: vi.fn(),
  })),
}));

vi.mock('../../src/services/criteria-step-input.service.js', () => ({
  CriteriaStepInputService: vi.fn().mockImplementation(() => ({
    createStepInputSlice: vi.fn(),
  })),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockResolvedValue({
      axiomDefaultCriteriaStepKeys: ['overall-criteria'],
    }),
  })),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

import { AnalysisSubmissionService } from '../../src/services/analysis-submission.service.js';

describe('AnalysisSubmissionService prepared-context criteria dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows prepared MOP/Prio criteria dispatch without a snapshot', async () => {
    const service = new AnalysisSubmissionService({ findOrderById: vi.fn().mockResolvedValue({ success: false }) } as any, {
      submitOrderEvaluation: vi.fn(),
      getLastPipelineSubmissionError: vi.fn(),
    } as any);

    const response = await service.submit(
      {
        analysisType: 'CRITERIA',
        programKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-123',
          programId: 'mop-program',
          version: '1.0',
        },
        runMode: 'FULL',
        engineTarget: 'MOP_PRIO',
        preparedContextId: 'prepared-1',
        preparedContextVersion: 'review-context:order-123:1',
        preparedDispatchId: 'dispatch-1',
        preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-program:1.0',
        preparedPayloadContractType: 'mop-prio-review-dispatch',
        preparedPayloadContractVersion: '1.0',
        loanPropertyContextId: 'order-123',
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );

    expect(mockCreateCriteriaRun).toHaveBeenCalledWith(expect.objectContaining({
      preparedContextId: 'prepared-1',
      preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-program:1.0',
    }));
    expect(mockDispatchCriteria).toHaveBeenCalledTimes(1);
    expect(mockSetRunStatus).toHaveBeenCalledWith(
      'criteria-run-1',
      'tenant-123',
      'running',
      expect.objectContaining({
        statusDetails: expect.objectContaining({
          providerStatus: 'queued',
          preparedContextId: 'prepared-1',
          preparedDispatchId: 'dispatch-1',
          preparedPayloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-program:1.0',
          unmetRequiredInputs: [
            expect.objectContaining({
              requirement: 'propertyType',
            }),
          ],
          criteriaSummary: expect.objectContaining({
            criteriaWithUnmetRequiredInputsCount: 1,
          }),
          provenanceSummary: expect.objectContaining({
            sourceTypesUsed: ['providerData'],
          }),
        }),
      }),
    );
    expect(mockCreateCriteriaStepRun).not.toHaveBeenCalled();
    expect(response.analysisType).toBe('CRITERIA');
    expect(response.run?.id).toBe('criteria-run-1');
    expect(response.stepRuns).toEqual([]);
  });

  it('allows prepared Axiom criteria dispatch without a snapshot', async () => {
    mockCreateCriteriaRun.mockResolvedValueOnce({
      id: 'criteria-run-axiom-1',
      tenantId: 'tenant-123',
      runType: 'criteria',
      status: 'queued',
      engine: 'AXIOM',
      correlationId: 'corr-123',
      idempotencyKey: 'idem-123',
      programKey: { clientId: 'client-123', subClientId: 'sub-client-123', programId: 'axiom-program', version: '1.0' },
      preparedContextId: 'prepared-1',
      preparedPayloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-program:1.0',
    });

    const service = new AnalysisSubmissionService({ findOrderById: vi.fn().mockResolvedValue({ success: false }) } as any, {
      submitOrderEvaluation: vi.fn(),
      getLastPipelineSubmissionError: vi.fn(),
    } as any);

    const response = await service.submit(
      {
        analysisType: 'CRITERIA',
        programKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-123',
          programId: 'axiom-program',
          version: '1.0',
        },
        runMode: 'FULL',
        engineTarget: 'AXIOM',
        preparedContextId: 'prepared-1',
        preparedContextVersion: 'review-context:order-123:1',
        preparedDispatchId: 'dispatch-1',
        preparedPayloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-program:1.0',
        preparedPayloadContractType: 'axiom-review-dispatch',
        preparedPayloadContractVersion: '1.0',
        loanPropertyContextId: 'order-123',
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );

    expect(mockCreateCriteriaRun).toHaveBeenCalledWith(expect.objectContaining({
      preparedContextId: 'prepared-1',
      preparedPayloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-program:1.0',
    }));
    expect(mockDispatchCriteria).toHaveBeenCalledTimes(1);
    expect(mockCreateCriteriaStepRun).not.toHaveBeenCalled();
    expect(response.analysisType).toBe('CRITERIA');
    expect(response.run?.id).toBe('criteria-run-axiom-1');
    expect(response.stepRuns).toEqual([]);
  });
});
