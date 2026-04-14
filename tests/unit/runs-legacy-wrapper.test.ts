import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRunsRouter } from '../../src/controllers/runs.controller';

const { mockSubmit, mockRerunCriteriaStep } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockRerunCriteriaStep: vi.fn(),
}));

vi.mock('../../src/services/analysis-submission.service.js', () => ({
  AnalysisSubmissionService: vi.fn().mockImplementation(() => ({
    submit: mockSubmit,
    rerunCriteriaStep: mockRerunCriteriaStep,
  })),
}));

describe('Runs legacy wrappers', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockRerunCriteriaStep.mockReset();
  });

  it('maps /api/runs/extraction to the unified submission contract', async () => {
    mockSubmit.mockResolvedValue({
      submissionId: 'submission-extraction',
      analysisType: 'EXTRACTION',
      status: 'queued',
      provider: 'RUN_LEDGER',
      run: {
        id: 'run-123',
      },
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { user?: unknown }).user = {
        tenantId: 'tenant-123',
        id: 'user-123',
      };
      next();
    });
    app.use('/api/runs', createRunsRouter({} as any));

    const response = await request(app)
      .post('/api/runs/extraction')
      .set('X-Correlation-Id', 'corr-123')
      .set('Idempotency-Key', 'idem-123')
      .send({
        documentId: 'doc-123',
        runReason: 'USER_UPLOAD',
        schemaKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-456',
          documentType: 'APPRAISAL_REPORT',
          version: '2025-01-01',
        },
      });

    expect(response.status).toBe(202);
    expect(mockSubmit).toHaveBeenCalledWith(
      {
        analysisType: 'EXTRACTION',
        documentId: 'doc-123',
        runReason: 'USER_UPLOAD',
        schemaKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-456',
          documentType: 'APPRAISAL_REPORT',
          version: '2025-01-01',
        },
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        id: 'run-123',
      },
    });
  });

  it('maps /api/runs/criteria to the unified submission contract including criteriaStepKeys', async () => {
    mockSubmit.mockResolvedValue({
      submissionId: 'submission-criteria',
      analysisType: 'CRITERIA',
      status: 'queued',
      provider: 'RUN_LEDGER',
      run: {
        id: 'criteria-run-123',
      },
      stepRuns: [
        {
          id: 'step-1',
          stepKey: 'occupancy',
        },
      ],
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { user?: unknown }).user = {
        tenantId: 'tenant-123',
        id: 'user-123',
      };
      next();
    });
    app.use('/api/runs', createRunsRouter({} as any));

    const response = await request(app)
      .post('/api/runs/criteria')
      .set('X-Correlation-Id', 'corr-criteria-123')
      .set('Idempotency-Key', 'idem-criteria-123')
      .send({
        snapshotId: 'snapshot-123',
        programKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-456',
          programId: 'program-123',
          version: 'criteria-v1',
        },
        runMode: 'STEP_ONLY',
        criteriaStepKeys: ['occupancy', 'dscr'],
      });

    expect(response.status).toBe(202);
    expect(mockSubmit).toHaveBeenCalledWith(
      {
        analysisType: 'CRITERIA',
        snapshotId: 'snapshot-123',
        programKey: {
          clientId: 'client-123',
          subClientId: 'sub-client-456',
          programId: 'program-123',
          version: 'criteria-v1',
        },
        runMode: 'STEP_ONLY',
        criteriaStepKeys: ['occupancy', 'dscr'],
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-criteria-123',
        idempotencyKey: 'idem-criteria-123',
      },
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        run: {
          id: 'criteria-run-123',
        },
        stepRuns: [
          {
            id: 'step-1',
            stepKey: 'occupancy',
          },
        ],
      },
    });
  });
});
