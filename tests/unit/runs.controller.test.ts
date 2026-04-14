import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockCreateExtractionRun,
  mockCreateCriteriaRun,
  mockRerunCriteriaStep,
  mockGetRunById,
  mockSetRunStatus,
  mockUpdateRun,
  mockCreateCriteriaStepRun,
  mockDispatchExtraction,
  mockDispatchCriteria,
  mockDispatchCriteriaStep,
  mockRefreshStatus,
  mockCreateFromExtractionRun,
  mockGetSnapshotById,
  mockCreateStepInputSlice,
  mockGetStepInputSliceById,
  mockGetLatestStepInputSliceForRun,
  mockListRuns,
} = vi.hoisted(() => ({
  mockCreateExtractionRun: vi.fn(),
  mockCreateCriteriaRun: vi.fn(),
  mockRerunCriteriaStep: vi.fn(),
  mockGetRunById: vi.fn(),
  mockSetRunStatus: vi.fn(),
  mockUpdateRun: vi.fn(),
  mockCreateCriteriaStepRun: vi.fn(),
  mockDispatchExtraction: vi.fn(),
  mockDispatchCriteria: vi.fn(),
  mockDispatchCriteriaStep: vi.fn(),
  mockRefreshStatus: vi.fn(),
  mockCreateFromExtractionRun: vi.fn(),
  mockGetSnapshotById: vi.fn(),
  mockCreateStepInputSlice: vi.fn(),
  mockGetStepInputSliceById: vi.fn(),
  mockGetLatestStepInputSliceForRun: vi.fn(),
  mockListRuns: vi.fn(),
}));

vi.mock('../../src/services/run-ledger.service.js', () => ({
  RunLedgerService: vi.fn().mockImplementation(() => ({
    createExtractionRun: mockCreateExtractionRun,
    createCriteriaRun: mockCreateCriteriaRun,
    rerunCriteriaStep: mockRerunCriteriaStep,
    getRunById: mockGetRunById,
    listRuns: mockListRuns,
    setRunStatus: mockSetRunStatus,
    updateRun: mockUpdateRun,
    createCriteriaStepRun: mockCreateCriteriaStepRun,
  })),
}));

vi.mock('../../src/services/engine-dispatch.service.js', () => ({
  EngineDispatchService: vi.fn().mockImplementation(() => ({
    dispatchExtraction: mockDispatchExtraction,
    dispatchCriteria: mockDispatchCriteria,
    dispatchCriteriaStep: mockDispatchCriteriaStep,
    refreshStatus: mockRefreshStatus,
  })),
}));

vi.mock('../../src/services/canonical-snapshot.service.js', () => ({
  CanonicalSnapshotService: vi.fn().mockImplementation(() => ({
    createFromExtractionRun: mockCreateFromExtractionRun,
    getSnapshotById: mockGetSnapshotById,
  })),
}));

vi.mock('../../src/services/criteria-step-input.service.js', () => ({
  CriteriaStepInputService: vi.fn().mockImplementation(() => ({
    createStepInputSlice: mockCreateStepInputSlice,
    getStepInputSliceById: mockGetStepInputSliceById,
    getLatestStepInputSliceForRun: mockGetLatestStepInputSliceForRun,
  })),
}));

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({})),
}));

import { createRunsRouter } from '../../src/controllers/runs.controller.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      tenantId: 'tenant-1',
    };
    next();
  });
  app.use('/api/runs', createRunsRouter({} as any));
  return app;
}

describe('RunsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when Idempotency-Key is missing', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/runs/extraction')
      .set('X-Correlation-Id', 'corr-1')
      .send({
        documentId: 'doc-1',
        runReason: 'INITIAL_INGEST',
        engineTarget: 'AXIOM',
        schemaKey: {
          clientId: 'client-a',
          subClientId: 'sub-a',
          documentType: 'APPRAISAL_REPORT',
          version: '1.0.0',
        },
      });

    expect(res.status).toBe(400);
    expect(mockCreateExtractionRun).not.toHaveBeenCalled();
  });

  it('lists runs by engagement id', async () => {
    mockListRuns.mockResolvedValue([
      {
        id: 'ext_run_1',
        type: 'run-ledger-entry',
        runType: 'extraction',
        status: 'completed',
        tenantId: 'tenant-1',
      },
    ]);

    const app = buildApp();
    const res = await request(app).get('/api/runs').query({ engagementId: 'eng-1', limit: 25 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockListRuns).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ engagementId: 'eng-1', limit: 25 }),
    );
  });

  it('creates extraction run and returns 202', async () => {
    mockCreateExtractionRun.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      status: 'queued',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
    });
    mockDispatchExtraction.mockResolvedValue({
      status: 'running',
      engineRunRef: 'eng-1',
      engineVersion: 'v1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
    });
    mockSetRunStatus.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      status: 'running',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'MOP_PRIO',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'eng-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'run-ledger-entry',
    });
    mockCreateFromExtractionRun.mockResolvedValue({ id: 'snapshot-1' });
    mockUpdateRun.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      status: 'running',
      canonicalSnapshotId: 'snapshot-1',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'MOP_PRIO',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'eng-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'run-ledger-entry',
    });

    const app = buildApp();

    const res = await request(app)
      .post('/api/runs/extraction')
      .set('Idempotency-Key', 'idem-1')
      .set('X-Correlation-Id', 'corr-1')
      .send({
        documentId: 'doc-1',
        runReason: 'INITIAL_INGEST',
        engineTarget: 'MOP_PRIO',
        schemaKey: {
          clientId: 'client-a',
          subClientId: 'sub-a',
          documentType: 'APPRAISAL_REPORT',
          version: '1.0.0',
        },
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canonicalSnapshotId).toBe('snapshot-1');
    expect(mockCreateExtractionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
        engineTarget: 'MOP_PRIO',
      }),
    );
  });

  it('returns 404 when run id is not found', async () => {
    mockGetRunById.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/runs/non-existent-run');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockGetRunById).toHaveBeenCalledWith('non-existent-run', 'tenant-1');
  });

  it('refreshes run status and returns updated run', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRefreshStatus.mockResolvedValue({
      status: 'completed',
      engineRunRef: 'job-1',
      engineVersion: 'v1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
    });
    mockSetRunStatus.mockResolvedValue({
      id: 'ext_run_1',
      runType: 'extraction',
      status: 'completed',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await request(app).post('/api/runs/ext_run_1/refresh-status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });

  it('returns linked snapshot for a run', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'crt_run_1',
      runType: 'criteria',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      canonicalSnapshotId: 'snapshot-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockGetSnapshotById.mockResolvedValue({
      id: 'snapshot-1',
      type: 'canonical-snapshot',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
      status: 'ready',
      sourceRefs: [],
      normalizedDataRef: 'canonical://tenant-1/run-1/normalized-data',
      createdByRunIds: ['ext_run_1'],
    });

    const app = buildApp();
    const res = await request(app).get('/api/runs/crt_run_1/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('snapshot-1');
  });

  it('returns step input slice by statusDetails.stepInputSliceId when available', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'step_run_1',
      runType: 'criteria-step',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      statusDetails: {
        stepInputSliceId: 'step_input_1',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockGetStepInputSliceById.mockResolvedValue({
      id: 'step_input_1',
      type: 'criteria-step-input-slice',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
      snapshotId: 'snapshot-1',
      criteriaRunId: 'crt_run_1',
      stepRunId: 'step_run_1',
      stepKey: 'overall-criteria',
      payloadRef: 'step-input://tenant-1/step_run_1',
      payload: { stepKey: 'overall-criteria' },
      evidenceRefs: [],
    });

    const app = buildApp();
    const res = await request(app).get('/api/runs/step_run_1/step-input');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('step_input_1');
    expect(mockGetStepInputSliceById).toHaveBeenCalledWith('step_input_1', 'tenant-1');
    expect(mockGetLatestStepInputSliceForRun).not.toHaveBeenCalled();
  });

  it('falls back to latest step input slice lookup when statusDetails has no stepInputSliceId', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'step_run_2',
      runType: 'criteria-step',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      statusDetails: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockGetLatestStepInputSliceForRun.mockResolvedValue({
      id: 'step_input_latest',
      type: 'criteria-step-input-slice',
      tenantId: 'tenant-1',
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
      snapshotId: 'snapshot-1',
      criteriaRunId: 'crt_run_1',
      stepRunId: 'step_run_2',
      stepKey: 'overall-criteria',
      payloadRef: 'step-input://tenant-1/step_run_2',
      payload: { stepKey: 'overall-criteria' },
      evidenceRefs: [],
    });

    const app = buildApp();
    const res = await request(app).get('/api/runs/step_run_2/step-input');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('step_input_latest');
    expect(mockGetLatestStepInputSliceForRun).toHaveBeenCalledWith('step_run_2', 'tenant-1');
  });

  it('returns 400 when step-input is requested for a non criteria-step run', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'crt_run_2',
      runType: 'criteria',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = buildApp();
    const res = await request(app).get('/api/runs/crt_run_2/step-input');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RUN_TYPE_INVALID');
    expect(mockGetStepInputSliceById).not.toHaveBeenCalled();
    expect(mockGetLatestStepInputSliceForRun).not.toHaveBeenCalled();
  });

  it('returns 404 when no step input slice exists for criteria-step run', async () => {
    mockGetRunById.mockResolvedValue({
      id: 'step_run_missing_input',
      runType: 'criteria-step',
      status: 'running',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      engine: 'AXIOM',
      engineSelectionMode: 'EXPLICIT',
      engineVersion: 'v1',
      engineRunRef: 'job-1',
      engineRequestRef: 'req-1',
      engineResponseRef: 'res-1',
      statusDetails: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockGetLatestStepInputSliceForRun.mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/runs/step_run_missing_input/step-input');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STEP_INPUT_NOT_FOUND');
  });

  it('creates criteria step slices and persists evidence refs in step status details', async () => {
    mockGetSnapshotById.mockResolvedValue({
      id: 'snapshot-1',
      type: 'canonical-snapshot',
      tenantId: 'tenant-1',
      sourceRefs: [{ sourceType: 'document-extraction', sourceId: 'doc-1', sourceRunId: 'ext_run_1' }],
      normalizedDataRef: 'canonical://tenant-1/ext_run_1/normalized-data',
      createdByRunIds: ['ext_run_1'],
      createdAt: new Date().toISOString(),
      createdBy: 'user-1',
      status: 'ready',
    });
    mockCreateCriteriaRun.mockResolvedValue({
      id: 'crt_run_1',
      runType: 'criteria',
      status: 'queued',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
    });
    mockDispatchCriteria.mockResolvedValue({
      status: 'running',
      engineRunRef: 'criteria-job-1',
      engineVersion: 'v1',
      engineRequestRef: 'req-criteria-1',
      engineResponseRef: 'res-criteria-1',
    });
    mockSetRunStatus
      .mockResolvedValueOnce({
        id: 'crt_run_1',
        runType: 'criteria',
        status: 'running',
        type: 'run-ledger-entry',
        tenantId: 'tenant-1',
      })
      .mockResolvedValueOnce({
        id: 'step_run_1',
        runType: 'criteria-step',
        status: 'running',
        type: 'run-ledger-entry',
        tenantId: 'tenant-1',
        statusDetails: {
          stepInputPayloadRef: 'step-input://tenant-1/step_run_1',
        },
      });
    mockCreateCriteriaStepRun.mockResolvedValue({
      id: 'step_run_1',
      runType: 'criteria-step',
      status: 'queued',
      stepKey: 'overall-criteria',
      type: 'run-ledger-entry',
      tenantId: 'tenant-1',
    });
    mockCreateStepInputSlice.mockResolvedValue({
      id: 'step_input_1',
      payloadRef: 'step-input://tenant-1/step_run_1',
      payload: { stepKey: 'overall-criteria' },
      evidenceRefs: [{ sourceType: 'document-extraction', sourceId: 'doc-1', sourceRunId: 'ext_run_1' }],
    });
    mockDispatchCriteriaStep.mockResolvedValue({
      status: 'running',
      engineRunRef: 'step-job-1',
      engineVersion: 'v1',
      engineRequestRef: 'req-step-1',
      engineResponseRef: 'res-step-1',
    });
    mockUpdateRun.mockResolvedValue({ id: 'crt_run_1', criteriaStepRunIds: ['step_run_1'] });

    const app = buildApp();

    const res = await request(app)
      .post('/api/runs/criteria')
      .set('Idempotency-Key', 'idem-criteria-1')
      .set('X-Correlation-Id', 'corr-criteria-1')
      .send({
        snapshotId: 'snapshot-1',
        runMode: 'FULL',
        engineTarget: 'AXIOM',
        criteriaStepKeys: ['overall-criteria'],
        programKey: {
          clientId: 'client-a',
          subClientId: 'sub-a',
          programId: 'program-a',
          version: '1.0.0',
        },
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(mockCreateStepInputSlice).toHaveBeenCalledTimes(1);
    expect(mockDispatchCriteriaStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step_run_1' }),
      expect.objectContaining({
        inputSliceRef: 'step-input://tenant-1/step_run_1',
        evidenceRefs: expect.arrayContaining([
          expect.objectContaining({ sourceType: 'document-extraction', sourceId: 'doc-1' }),
        ]),
      }),
    );
  });
});
