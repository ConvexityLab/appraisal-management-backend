import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetConfig,
  mockCreateExtractionRun,
  mockSetRunStatus,
  mockUpdateRun,
  mockCreateCriteriaRun,
  mockCreateCriteriaStepRun,
  mockCreateFromExtractionRun,
  mockDispatchCriteria,
  mockDispatchCriteriaStep,
  mockCreateStepInputSlice,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockCreateExtractionRun: vi.fn(),
  mockSetRunStatus: vi.fn(),
  mockUpdateRun: vi.fn(),
  mockCreateCriteriaRun: vi.fn(),
  mockCreateCriteriaStepRun: vi.fn(),
  mockCreateFromExtractionRun: vi.fn(),
  mockDispatchCriteria: vi.fn(),
  mockDispatchCriteriaStep: vi.fn(),
  mockCreateStepInputSlice: vi.fn(),
}));

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: vi.fn().mockResolvedValue('https://blob/sas'),
  })),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({
    updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/bulk-portfolio.service', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({
    stampBatchEvaluationResults: vi.fn().mockResolvedValue({ items: [] }),
    processExtractionCompletion: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

vi.mock('../../src/services/run-ledger.service.js', () => ({
  RunLedgerService: vi.fn().mockImplementation(() => ({
    createExtractionRun: mockCreateExtractionRun,
    setRunStatus: mockSetRunStatus,
    updateRun: mockUpdateRun,
    createCriteriaRun: mockCreateCriteriaRun,
    createCriteriaStepRun: mockCreateCriteriaStepRun,
  })),
}));

vi.mock('../../src/services/canonical-snapshot.service.js', () => ({
  CanonicalSnapshotService: vi.fn().mockImplementation(() => ({
    createFromExtractionRun: mockCreateFromExtractionRun,
  })),
}));

vi.mock('../../src/services/engine-dispatch.service.js', () => ({
  EngineDispatchService: vi.fn().mockImplementation(() => ({
    dispatchCriteria: mockDispatchCriteria,
    dispatchCriteriaStep: mockDispatchCriteriaStep,
  })),
}));

vi.mock('../../src/services/criteria-step-input.service.js', () => ({
  CriteriaStepInputService: vi.fn().mockImplementation(() => ({
    createStepInputSlice: mockCreateStepInputSlice,
  })),
}));

import { AxiomController } from '../../src/controllers/axiom.controller.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('AxiomController webhook durable ACK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 only after ORDER webhook durable processing succeeds', async () => {
    const dbStub = {
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
      findOrderById: vi.fn().mockResolvedValue({ success: true, data: { tenantId: 'tenant-1', orderNumber: 'ORD-1' } }),
    };

    const axiomServiceStub = {
      fetchAndStorePipelineResults: vi.fn().mockResolvedValue(undefined),
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
      signalPipelineTermination: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'order-1',
        correlationType: 'ORDER',
        pipelineJobId: 'pjob-1',
        status: 'completed',
        result: { overallRiskScore: 42, overallDecision: 'ACCEPT', flags: ['f1'] },
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(dbStub.updateOrder).toHaveBeenCalledTimes(1);
    expect(axiomServiceStub.fetchAndStorePipelineResults).toHaveBeenCalledWith('order-1', 'pjob-1');
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 when durable ORDER webhook update fails', async () => {
    const dbStub = {
      updateOrder: vi.fn().mockResolvedValue({ success: false, error: 'cosmos write failed' }),
      findOrderById: vi.fn().mockResolvedValue({ success: true, data: { tenantId: 'tenant-1', orderNumber: 'ORD-1' } }),
    };

    const axiomServiceStub = {
      fetchAndStorePipelineResults: vi.fn().mockResolvedValue(undefined),
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'order-1',
        correlationType: 'ORDER',
        pipelineJobId: 'pjob-1',
        status: 'completed',
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('triggers run-ledger orchestration on DOCUMENT webhook completion', async () => {
    const now = new Date().toISOString();
    const dbStub = {
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'doc-1',
          tenantId: 'tenant-1',
          orderId: 'order-1',
          documentType: 'APPRAISAL_REPORT',
          category: 'appraisal-report',
        },
      }),
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          engagementId: 'eng-1',
          engagementLoanId: 'loan-1',
        },
      }),
    };

    mockGetConfig.mockResolvedValue({
      axiomSubClientId: 'sub-1',
      axiomDocumentSchemaVersion: '1.0.0',
      axiomProgramId: 'FNMA-URAR',
      axiomProgramVersion: '2.1.0',
      axiomDefaultCriteriaStepKeys: ['overall-criteria', 'market-support'],
    });

    mockCreateExtractionRun.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      tenantId: 'tenant-1',
      engineVersion: 'pending',
      engineRunRef: 'pending',
      engineRequestRef: 'pending',
      engineResponseRef: 'pending',
    });
    mockSetRunStatus
      .mockResolvedValueOnce({ id: 'ext_run_1', runType: 'extraction', tenantId: 'tenant-1', initiatedBy: 'SYSTEM:axiom-webhook' })
      .mockResolvedValueOnce({ id: 'crt_run_1', runType: 'criteria', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({ id: 'step_run_1', runType: 'criteria-step', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({ id: 'step_run_2', runType: 'criteria-step', tenantId: 'tenant-1' });
    mockCreateFromExtractionRun.mockResolvedValue({ id: 'snapshot-1' });
    mockCreateCriteriaRun.mockResolvedValue({ id: 'crt_run_1', tenantId: 'tenant-1' });
    mockDispatchCriteria.mockResolvedValue({
      status: 'running',
      engineRunRef: 'criteria-job-1',
      engineVersion: 'v1',
      engineRequestRef: 'req-criteria-1',
      engineResponseRef: 'res-criteria-1',
    });
    mockCreateCriteriaStepRun
      .mockResolvedValueOnce({ id: 'step_run_1', stepKey: 'overall-criteria', tenantId: 'tenant-1' })
      .mockResolvedValueOnce({ id: 'step_run_2', stepKey: 'market-support', tenantId: 'tenant-1' });
    mockCreateStepInputSlice
      .mockResolvedValueOnce({ id: 'slice-1', payloadRef: 'step-input://tenant-1/step_run_1', payload: { stepKey: 'overall-criteria' }, evidenceRefs: [] })
      .mockResolvedValueOnce({ id: 'slice-2', payloadRef: 'step-input://tenant-1/step_run_2', payload: { stepKey: 'market-support' }, evidenceRefs: [] });
    mockDispatchCriteriaStep.mockResolvedValue({
      status: 'running',
      engineRunRef: 'step-job',
      engineVersion: 'v1',
      engineRequestRef: 'req-step',
      engineResponseRef: 'res-step',
    });
    mockUpdateRun.mockResolvedValue({ id: 'crt_run_1', criteriaStepRunIds: ['step_run_1', 'step_run_2'], updatedAt: now });

    const axiomServiceStub = {
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'doc-1',
        correlationType: 'DOCUMENT',
        executionId: 'pipe-1',
        status: 'completed',
        result: { extracted: true },
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dbStub.updateItem).toHaveBeenCalledWith(
      'documents',
      'doc-1',
      expect.objectContaining({ extractionStatus: 'COMPLETED' }),
    );
    expect(mockCreateExtractionRun).toHaveBeenCalledTimes(1);
    expect(mockCreateFromExtractionRun).toHaveBeenCalledTimes(1);
    expect(mockCreateCriteriaRun).toHaveBeenCalledTimes(1);
    expect(mockCreateCriteriaStepRun).toHaveBeenCalledTimes(2);
    expect(mockCreateStepInputSlice).toHaveBeenCalledTimes(2);
    expect(mockDispatchCriteriaStep).toHaveBeenCalledTimes(2);
  });

  it('logs warning and still ACKs DOCUMENT webhook when tenant config is missing orchestration fields', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const dbStub = {
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'doc-2',
          tenantId: 'tenant-1',
          orderId: 'order-2',
          documentType: 'APPRAISAL_REPORT',
        },
      }),
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-2',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          engagementId: 'eng-1',
          engagementLoanId: 'loan-1',
        },
      }),
    };

    mockGetConfig.mockResolvedValue({
      axiomProgramId: 'FNMA-URAR',
      axiomProgramVersion: '2.1.0',
      // axiomSubClientId intentionally missing
    });

    const axiomServiceStub = {
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'doc-2',
        correlationType: 'DOCUMENT',
        executionId: 'pipe-2',
        status: 'completed',
        result: { extracted: true },
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dbStub.updateItem).toHaveBeenCalledWith(
      'documents',
      'doc-2',
      expect.objectContaining({ extractionStatus: 'COMPLETED' }),
    );
    expect(mockCreateExtractionRun).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Axiom webhook: run-ledger orchestration failed for document'),
    );

    warnSpy.mockRestore();
  });
});
