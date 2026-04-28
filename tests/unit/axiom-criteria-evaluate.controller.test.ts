/**
 * T2.3 — POST /api/axiom/criteria/evaluate controller tests.
 *
 * Covers Pattern A (auto-resolve fileSetId from prior extraction), Pattern B
 * (caller-supplied extractedDocuments + createIfMissing), validation errors,
 * and the bridge to the service-level NO_PRIOR_EXTRACTION case which surfaces
 * as a 409.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({ publish: vi.fn() })),
}));
vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../src/services/bulk-portfolio.service', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockResolvedValue({ axiomSubClientId: 'platform' }),
  })),
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

import { AxiomController } from '../../src/controllers/axiom.controller.js';

function makeRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {} as any;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const ORDER = { id: 'seed-order-003', tenantId: 'tenant-1', clientId: 'vision', subClientId: 'platform' };
const AUTH = { user: { tenantId: 'tenant-1', id: 'u1' } } as const;

function makeController(opts: {
  submitResult?: { pipelineJobId: string; evaluationId: string } | null;
  lastError?: { code: string; message: string };
  orderFound?: boolean;
} = {}) {
  const dbStub = {
    getItem: vi.fn().mockImplementation(async (container: string, id: string) => {
      if (container === 'orders' && id === ORDER.id && opts.orderFound !== false) {
        return { success: true, data: ORDER };
      }
      return { success: false, data: null };
    }),
  };
  const axiomServiceStub = {
    // Distinguish "explicitly null" (failure) from "not specified" (use happy default).
    submitCriteriaReevaluation: vi.fn().mockResolvedValue(
      'submitResult' in opts ? opts.submitResult : { pipelineJobId: 'pjob-1', evaluationId: 'eval-1' },
    ),
    getLastPipelineSubmissionError: vi.fn().mockReturnValue(opts.lastError ?? null),
  };
  return {
    controller: new AxiomController(dbStub as any, axiomServiceStub as any),
    dbStub,
    axiomServiceStub,
  };
}

describe('POST /api/axiom/criteria/evaluate (T2.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path Pattern A — returns 202 + evaluationId/pipelineJobId', async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = { ...AUTH, body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(axiomServiceStub.submitCriteriaReevaluation).toHaveBeenCalledWith(expect.objectContaining({
      orderId: ORDER.id,
      tenantId: 'tenant-1',
      clientId: 'vision',
      programId: 'FNMA-1004',
      programVersion: '1.0.0',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ pattern: 'A', evaluationId: 'eval-1', pipelineJobId: 'pjob-1' }),
    }));
  });

  it('happy path Pattern B — extractedDocuments forwarded + pattern reported as B', async () => {
    const { controller, axiomServiceStub } = makeController();
    const docs = [{ documentId: 'doc-1', documentType: 'urar', extractedData: { propertyAddress: '17 David Dr' } }];
    const req: any = {
      ...AUTH,
      body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0', extractedDocuments: docs },
    };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(axiomServiceStub.submitCriteriaReevaluation).toHaveBeenCalledWith(expect.objectContaining({
      extractedDocuments: docs,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pattern: 'B' }),
    }));
  });

  it('400 when orderId missing', async () => {
    const { controller } = makeController();
    const req: any = { ...AUTH, body: { programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    }));
  });

  it('400 when programId missing', async () => {
    const { controller } = makeController();
    const req: any = { ...AUTH, body: { orderId: ORDER.id, programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when programVersion missing', async () => {
    const { controller } = makeController();
    const req: any = { ...AUTH, body: { orderId: ORDER.id, programId: 'FNMA-1004' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 when extractedDocuments is not an array', async () => {
    const { controller } = makeController();
    const req: any = {
      ...AUTH,
      body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0', extractedDocuments: 'not-an-array' },
    };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('401 when no tenant on request user', async () => {
    const { controller } = makeController();
    const req: any = { user: undefined, body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('404 when order does not exist', async () => {
    const { controller } = makeController({ orderFound: false });
    const req: any = { ...AUTH, body: { orderId: 'nope', programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'ORDER_NOT_FOUND' }),
    }));
  });

  it('409 when service returns NO_PRIOR_EXTRACTION (Pattern A with no prior eval)', async () => {
    const { controller } = makeController({
      submitResult: null,
      lastError: { code: 'NO_PRIOR_EXTRACTION', message: 'no prior extraction available' },
    });
    const req: any = { ...AUTH, body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'NO_PRIOR_EXTRACTION' }),
    }));
  });

  it('502 when service returns generic submission failure', async () => {
    const { controller } = makeController({
      submitResult: null,
      lastError: { code: 'AXIOM_SUBMISSION_FAILED', message: 'upstream 503' },
    });
    const req: any = { ...AUTH, body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0' } };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('forwards forceResubmit=true through to the service', async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = {
      ...AUTH,
      body: { orderId: ORDER.id, programId: 'FNMA-1004', programVersion: '1.0.0', forceResubmit: true },
    };
    const res = makeRes();
    await controller.evaluateCriteria(req, res);
    expect(axiomServiceStub.submitCriteriaReevaluation).toHaveBeenCalledWith(expect.objectContaining({ forceResubmit: true }));
  });
});
