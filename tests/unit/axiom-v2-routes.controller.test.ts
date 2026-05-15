/**
 * Axiom v2 controller tests.
 *
 * Covers the endpoints introduced in the Axiom v2 migration:
 *   POST /api/axiom/scopes/:scopeId/evaluate                         (evaluateScopeV2)
 *   GET  /api/axiom/scopes/:scopeId/runs/:runId                      (getEvaluationRunV2)
 *   GET  /api/axiom/scopes/:scopeId/results?programId=...            (getLatestResultsV2)
 *   GET  /api/axiom/scopes/:scopeId/criteria/:criterionId/history    (getCriterionHistoryV2)
 *   POST /api/axiom/scopes/:scopeId/criteria/:criterionId/override   (overrideVerdictV2)
 *
 * Especially focused on:
 *   - Validation errors (missing required fields)
 *   - Override atomicity (Axiom write succeeds, audit publish fails → 500 with explicit message)
 *   - Override stale-supersedes 400 surfacing
 *   - User-overridable verdict subset enforcement
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
import type {
  AxiomEvaluationResultDoc,
  AxiomEvaluationRunResponse,
  AxiomLatestResultsResponse,
  AxiomCriterionHistoryResponse,
} from '../../src/types/axiom.types.js';

function makeRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {} as any;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeResultDoc(overrides: Partial<AxiomEvaluationResultDoc> = {}): AxiomEvaluationResultDoc {
  return {
    resultId: 'order-001:c-1:run-1',
    evaluationRunId: 'run-1',
    scopeId: 'order-001',
    criterionId: 'c-1',
    criterionName: 'Test criterion',
    evaluation: 'pass',
    confidence: 0.9,
    reasoning: '—',
    evaluatedBy: 'api-service',
    evaluatedAt: '2026-05-07T12:00:00Z',
    manualOverride: false,
    criterionSnapshot: { id: 'c-1', title: 'C1', description: 'desc' },
    dataConsulted: {},
    documentReferences: [],
    ...overrides,
  };
}

function makeController(serviceOverrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const dbStub = {
    getItem: vi.fn().mockResolvedValue({ success: false, data: null }),
  };
  const axiomServiceStub: Record<string, ReturnType<typeof vi.fn>> = {
    evaluateScope: vi.fn(),
    getEvaluationRun: vi.fn(),
    getLatestResults: vi.fn(),
    getCriterionHistory: vi.fn(),
    overrideVerdict: vi.fn(),
    ...serviceOverrides,
  };
  const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
  return { controller, dbStub, axiomServiceStub };
}

const SCOPE_ID = 'order-001';
const RUN_ID = 'run-1';
const CRITERION_ID = 'c-credit-score-min';

// ─── evaluateScopeV2 ───────────────────────────────────────────────────────

describe('POST /api/axiom/scopes/:scopeId/evaluate (v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 + summary on happy path', async () => {
    const summary: AxiomEvaluationRunResponse = {
      evaluationRunId: RUN_ID,
      scopeId: SCOPE_ID,
      programId: 'FNMA-SEL-2024',
      programVersion: '1.0.0',
      status: 'completed',
      evaluatedAt: '2026-05-07T12:34:56Z',
      results: [makeResultDoc()],
    };
    const { controller, axiomServiceStub } = makeController({
      evaluateScope: vi.fn().mockResolvedValue(summary),
    });
    const req: any = {
      params: { scopeId: SCOPE_ID },
      body: { programId: 'FNMA-SEL-2024', programVersion: '1.0.0' },
      user: { id: 'u-1', tenantId: 'tenant-1' },
      headers: {},
      header: () => undefined,
    };
    const res = makeRes();
    await controller.evaluateScopeV2(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: summary });
    const call = axiomServiceStub.evaluateScope.mock.calls[0][0];
    expect(call).toMatchObject({
      scopeId: SCOPE_ID,
      programId: 'FNMA-SEL-2024',
      programVersion: '1.0.0',
    });
    expect(call.actor).toMatchObject({
      tenantId: 'tenant-1',
      initiatedBy: 'u-1',
    });
    expect(typeof call.actor.correlationId).toBe('string');
    expect(typeof call.actor.idempotencyKey).toBe('string');
  });

  it('returns 400 when programId/programVersion missing', async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = { params: { scopeId: SCOPE_ID }, body: {} };
    const res = makeRes();
    await controller.evaluateScopeV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(axiomServiceStub.evaluateScope).not.toHaveBeenCalled();
  });

  it('returns 400 when scopeId param missing', async () => {
    const { controller } = makeController();
    const req: any = {
      params: {},
      body: { programId: 'p', programVersion: 'v' },
    };
    const res = makeRes();
    await controller.evaluateScopeV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 with EVALUATION_FAILED code on service error', async () => {
    const { controller } = makeController({
      evaluateScope: vi.fn().mockRejectedValue(new Error('Axiom unreachable')),
    });
    const req: any = {
      params: { scopeId: SCOPE_ID },
      body: { programId: 'p', programVersion: 'v' },
      user: { id: 'u-1', tenantId: 'tenant-1' },
      headers: {},
      header: () => undefined,
    };
    const res = makeRes();
    await controller.evaluateScopeV2(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error.code).toBe('EVALUATION_FAILED');
  });

  it('returns 401 when authenticated user has no tenantId', async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = {
      params: { scopeId: SCOPE_ID },
      body: { programId: 'p', programVersion: 'v' },
      user: { id: 'u-1' },
      headers: {},
    };
    const res = makeRes();
    await controller.evaluateScopeV2(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(axiomServiceStub.evaluateScope).not.toHaveBeenCalled();
  });
});

// ─── getEvaluationRunV2 ────────────────────────────────────────────────────

describe('GET /api/axiom/scopes/:scopeId/runs/:runId (v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 + run on happy path', async () => {
    const run: AxiomEvaluationRunResponse = {
      evaluationRunId: RUN_ID,
      scopeId: SCOPE_ID,
      programId: 'p',
      programVersion: '1.0.0',
      status: 'processing',
      evaluatedAt: '2026-05-07T12:34:56Z',
      results: [],
    };
    const { controller } = makeController({
      getEvaluationRun: vi.fn().mockResolvedValue(run),
    });
    const req: any = { params: { scopeId: SCOPE_ID, runId: RUN_ID } };
    const res = makeRes();
    await controller.getEvaluationRunV2(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: run });
  });

  it('returns 400 when runId missing', async () => {
    const { controller } = makeController();
    const req: any = { params: { scopeId: SCOPE_ID } };
    const res = makeRes();
    await controller.getEvaluationRunV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── getLatestResultsV2 ────────────────────────────────────────────────────

describe('GET /api/axiom/scopes/:scopeId/results (v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 + latest results when programId is supplied', async () => {
    const latest: AxiomLatestResultsResponse = {
      scopeId: SCOPE_ID,
      programId: 'FNMA-SEL-2024',
      count: 1,
      results: [makeResultDoc()],
      asOf: '2026-05-07T12:35:01Z',
    };
    const { controller, axiomServiceStub } = makeController({
      getLatestResults: vi.fn().mockResolvedValue(latest),
    });
    const req: any = {
      params: { scopeId: SCOPE_ID },
      query: { programId: 'FNMA-SEL-2024' },
    };
    const res = makeRes();
    await controller.getLatestResultsV2(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: latest });
    expect(axiomServiceStub.getLatestResults).toHaveBeenCalledWith({
      scopeId: SCOPE_ID,
      programId: 'FNMA-SEL-2024',
    });
  });

  it('returns 400 when programId is missing', async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = { params: { scopeId: SCOPE_ID }, query: {} };
    const res = makeRes();
    await controller.getLatestResultsV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(axiomServiceStub.getLatestResults).not.toHaveBeenCalled();
  });
});

// ─── getCriterionHistoryV2 ─────────────────────────────────────────────────

describe('GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history (v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 + history (newest-first) on happy path', async () => {
    const history: AxiomCriterionHistoryResponse = {
      scopeId: SCOPE_ID,
      criterionId: CRITERION_ID,
      count: 2,
      history: [
        makeResultDoc({
          resultId: `${SCOPE_ID}:${CRITERION_ID}:run-2`,
          evaluationRunId: 'run-2',
          evaluatedAt: '2026-05-07T13:00:00Z',
          evaluatedBy: 'human-override',
          manualOverride: true,
          supersedes: `${SCOPE_ID}:${CRITERION_ID}:run-1`,
        }),
        makeResultDoc({
          resultId: `${SCOPE_ID}:${CRITERION_ID}:run-1`,
          evaluationRunId: 'run-1',
        }),
      ],
    };
    const { controller } = makeController({
      getCriterionHistory: vi.fn().mockResolvedValue(history),
    });
    const req: any = { params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID } };
    const res = makeRes();
    await controller.getCriterionHistoryV2(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: history });
  });

  it('returns 400 when criterionId missing', async () => {
    const { controller } = makeController();
    const req: any = { params: { scopeId: SCOPE_ID } };
    const res = makeRes();
    await controller.getCriterionHistoryV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── overrideVerdictV2 (atomicity) ─────────────────────────────────────────

describe('POST /api/axiom/scopes/:scopeId/criteria/:criterionId/override (v2)', () => {
  beforeEach(() => vi.clearAllMocks());

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      supersedes: `${SCOPE_ID}:${CRITERION_ID}:run-1`,
      verdict: 'pass',
      reasoning: 'Compensating factors apply',
      overriddenBy: 'reviewer@example.com',
      overrideReason: 'Compensating factors',
      engagementId: 'eng-1',
      ...overrides,
    };
  }

  it('happy path — writes Axiom doc, publishes audit event, returns 201', async () => {
    const overrideDoc = makeResultDoc({
      resultId: `${SCOPE_ID}:${CRITERION_ID}:run-2`,
      evaluationRunId: 'run-2',
      evaluatedBy: 'human-override',
      manualOverride: true,
      supersedes: `${SCOPE_ID}:${CRITERION_ID}:run-1`,
      overriddenBy: 'reviewer@example.com',
    });
    const { controller, axiomServiceStub } = makeController({
      overrideVerdict: vi.fn().mockResolvedValue(overrideDoc),
    });
    // Capture eventPublisher.publish via the controller's actual publisher.
    const publishSpy = vi.fn().mockResolvedValue(undefined);
    (controller as any).eventPublisher = { publish: publishSpy };

    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody(),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: overrideDoc });
    expect(axiomServiceStub.overrideVerdict).toHaveBeenCalledOnce();
    expect(publishSpy).toHaveBeenCalledOnce();
    const publishedEvent = publishSpy.mock.calls[0][0];
    expect(publishedEvent.type).toBe('qc.verdict.overridden');
    expect(publishedEvent.data.scopeId).toBe(SCOPE_ID);
    expect(publishedEvent.data.criterionId).toBe(CRITERION_ID);
    expect(publishedEvent.data.resultId).toBe(overrideDoc.resultId);
  });

  it('returns 400 when supersedes is missing', async () => {
    const { controller, axiomServiceStub } = makeController();
    const body = validBody();
    delete (body as any).supersedes;
    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body,
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(axiomServiceStub.overrideVerdict).not.toHaveBeenCalled();
  });

  it("returns 400 when verdict is 'cannot_evaluate' (not user-overridable)", async () => {
    const { controller, axiomServiceStub } = makeController();
    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody({ verdict: 'cannot_evaluate' }),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error.message).toContain('pass | fail | needs_review');
    expect(axiomServiceStub.overrideVerdict).not.toHaveBeenCalled();
  });

  it("returns 400 when verdict is 'not_applicable' (not user-overridable)", async () => {
    const { controller } = makeController();
    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody({ verdict: 'not_applicable' }),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('translates Axiom 400 (stale supersedes) into STALE_SUPERSEDES 400', async () => {
    const axiomErr: any = new Error('Bad request');
    axiomErr.response = { status: 400 };
    const { controller } = makeController({
      overrideVerdict: vi.fn().mockRejectedValue(axiomErr),
    });
    const publishSpy = vi.fn();
    (controller as any).eventPublisher = { publish: publishSpy };

    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody(),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error.code).toBe('STALE_SUPERSEDES');
    expect(call.error.message).toContain('Refresh');
    // No audit event should be published when Axiom rejected.
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('returns 500 AUDIT_PUBLISH_FAILED when Axiom write succeeded but audit publish failed', async () => {
    const overrideDoc = makeResultDoc({
      resultId: `${SCOPE_ID}:${CRITERION_ID}:run-2`,
      evaluationRunId: 'run-2',
      evaluatedBy: 'human-override',
      manualOverride: true,
    });
    const { controller } = makeController({
      overrideVerdict: vi.fn().mockResolvedValue(overrideDoc),
    });
    (controller as any).eventPublisher = {
      publish: vi.fn().mockRejectedValue(new Error('Service Bus down')),
    };

    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody(),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error.code).toBe('AUDIT_PUBLISH_FAILED');
    expect(call.error.message).toContain('Axiom override was recorded');
    expect(call.error.details.axiomResultId).toBe(overrideDoc.resultId);
  });

  it('returns 500 INTERNAL_ERROR on non-400 Axiom failures', async () => {
    const { controller } = makeController({
      overrideVerdict: vi.fn().mockRejectedValue(new Error('Internal Axiom error')),
    });
    (controller as any).eventPublisher = { publish: vi.fn() };

    const req: any = {
      params: { scopeId: SCOPE_ID, criterionId: CRITERION_ID },
      body: validBody(),
    };
    const res = makeRes();
    await controller.overrideVerdictV2(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.error.code).toBe('INTERNAL_ERROR');
  });
});
