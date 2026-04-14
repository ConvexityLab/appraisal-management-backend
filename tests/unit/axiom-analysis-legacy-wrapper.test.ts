import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAxiomRouter } from '../../src/controllers/axiom.controller';

const { mockSubmit } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
}));

vi.mock('../../src/services/analysis-submission.service.js', () => ({
  AnalysisSubmissionService: vi.fn().mockImplementation(() => ({
    submit: mockSubmit,
  })),
}));

vi.mock('../../src/services/axiom.service', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/bulk-portfolio.service', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({ publishAxiomWebhookEvent: vi.fn() })),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/axiom-bulk-submission.service.js', () => ({
  AxiomBulkSubmissionService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/run-ledger.service.js', () => ({
  RunLedgerService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/canonical-snapshot.service.js', () => ({
  CanonicalSnapshotService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/engine-dispatch.service.js', () => ({
  EngineDispatchService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/criteria-step-input.service.js', () => ({
  CriteriaStepInputService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/middleware/verify-axiom-webhook.middleware.js', () => ({
  verifyAxiomWebhook: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe('Axiom legacy analyze wrapper', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
  });

  it('maps /api/axiom/analyze to the unified submission contract', async () => {
    mockSubmit.mockResolvedValue({
      submissionId: 'submission-123',
      analysisType: 'DOCUMENT_ANALYZE',
      status: 'queued',
      provider: 'AXIOM',
      evaluationId: 'eval-123',
      pipelineJobId: 'pipe-123',
      orderId: 'order-123',
      documentId: 'doc-123',
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
    app.use('/api/axiom', createAxiomRouter({} as any));

    const response = await request(app)
      .post('/api/axiom/analyze')
      .set('X-Correlation-Id', 'corr-123')
      .set('Idempotency-Key', 'idem-123')
      .send({
        orderId: 'order-123',
        documentId: 'doc-123',
        documentType: 'APPRAISAL_REPORT',
        evaluationMode: 'CRITERIA_EVALUATION',
      });

    expect(mockSubmit).toHaveBeenCalledWith(
      {
        analysisType: 'DOCUMENT_ANALYZE',
        orderId: 'order-123',
        documentId: 'doc-123',
        documentType: 'APPRAISAL_REPORT',
        evaluationMode: 'CRITERIA_EVALUATION',
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );
    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      data: {
        evaluationId: 'eval-123',
        pipelineJobId: 'pipe-123',
        orderId: 'order-123',
        documentId: 'doc-123',
        message: 'Document submitted for AI analysis',
      },
    });
  });
});
