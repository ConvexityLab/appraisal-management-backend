import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubmit, mockGetSubmission } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockGetSubmission: vi.fn(),
}));

vi.mock('../../src/services/analysis-submission.service.js', () => ({
  AnalysisSubmissionService: vi.fn().mockImplementation(() => ({
    submit: mockSubmit,
    getSubmission: mockGetSubmission,
  })),
}));

async function buildApp() {
  const { createAnalysisSubmissionRouter } = await import('../../src/controllers/analysis-submission.controller.js');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'user-123',
      tenantId: 'tenant-123',
      azureAdObjectId: 'aad-user-123',
    };
    next();
  });
  app.use('/api/analysis', createAnalysisSubmissionRouter({} as any));
  return app;
}

describe('analysis submission controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the exact UI DOCUMENT_ANALYZE payload and actor headers', async () => {
    mockSubmit.mockResolvedValue({
      submissionId: 'sub-123',
      analysisType: 'DOCUMENT_ANALYZE',
      status: 'queued',
      provider: 'AXIOM',
      evaluationId: 'eval-123',
      pipelineJobId: 'job-123',
    });

    const app = await buildApp();

    const payload = {
      analysisType: 'DOCUMENT_ANALYZE',
      orderId: 'order-123',
      documentId: 'doc-123',
      documentType: 'supporting-document',
      evaluationMode: 'COMPLETE_EVALUATION',
    };

    const response = await request(app)
      .post('/api/analysis/submissions')
      .set('X-Correlation-Id', 'ui-correlation-123')
      .set('Idempotency-Key', 'ui-idempotency-123')
      .send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      data: {
        submissionId: 'sub-123',
        analysisType: 'DOCUMENT_ANALYZE',
        status: 'queued',
        provider: 'AXIOM',
        evaluationId: 'eval-123',
        pipelineJobId: 'job-123',
      },
    });
    expect(mockSubmit).toHaveBeenCalledWith(payload, {
      tenantId: 'tenant-123',
      initiatedBy: 'user-123',
      correlationId: 'ui-correlation-123',
      idempotencyKey: 'ui-idempotency-123',
    });
  });

  it('rejects invalid DOCUMENT_ANALYZE requests before the service is called', async () => {
    const app = await buildApp();

    const response = await request(app)
      .post('/api/analysis/submissions')
      .send({
        analysisType: 'DOCUMENT_ANALYZE',
        documentId: 'doc-123',
        evaluationMode: 'BAD_MODE',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'orderId is required for DOCUMENT_ANALYZE',
      },
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});