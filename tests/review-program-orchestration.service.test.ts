/**
 * Unit tests for ReviewProgramOrchestrationService
 *
 * Strategy: vi.mock is used for AnalysisSubmissionService and
 * CanonicalSnapshotService (both instantiated inside the constructor). The
 * CosmosDbService is stubbed with a minimal spy so fetchProgram can return
 * controlled values without touching a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { ReviewProgramOrchestrationService } from '../src/services/review-program-orchestration.service.js';

// ── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('../src/services/analysis-submission.service.js', () => ({
  AnalysisSubmissionService: vi.fn().mockImplementation(() => ({
    submit: vi.fn(),
  })),
}));

vi.mock('../src/services/canonical-snapshot.service.js', () => ({
  CanonicalSnapshotService: vi.fn().mockImplementation(() => ({
    getSnapshotById: vi.fn(),
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProgram(overrides: Partial<{
  id: string;
  name: string;
  version: string;
  aiCriteriaRefs: { programId: string; programVersion: string }[];
  rulesetRefs: { programId: string; programVersion: string }[];
}> = {}) {
  return {
    id: 'prog-1',
    name: 'Vision Appraisal Program',
    version: '1.0',
    status: 'ACTIVE',
    aiCriteriaRefs: [],
    rulesetRefs: [],
    ...overrides,
  };
}

function makeDbService(program: unknown) {
  const queryResult = { resources: program ? [program] : [] };
  const mockFetchAll = vi.fn().mockResolvedValue(queryResult);
  const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll });
  const mockContainer = { items: { query: mockQuery } };
  return {
    getReviewProgramsContainer: vi.fn().mockReturnValue(mockContainer),
    _mockFetchAll: mockFetchAll,
  };
}

function makeActor() {
  return {
    tenantId: 'tenant-abc',
    initiatedBy: 'user-123',
    correlationId: 'corr-001',
    idempotencyKey: 'idem-001',
  };
}

function makeRequest(overrides: Partial<{
  snapshotId: string;
  clientId: string;
  subClientId: string;
}> = {}) {
  return {
    snapshotId: 'snap-xyz',
    clientId: 'client-1',
    subClientId: 'sub-1',
    ...overrides,
  };
}

/** Access the private submissionService and snapshotService through any-cast. */
function getInternals(svc: ReviewProgramOrchestrationService) {
  const anySvc = svc as any;
  return {
    submissionService: anySvc.submissionService as { submit: Mock },
    snapshotService: anySvc.snapshotService as { getSnapshotById: Mock },
  };
}

const MINIMAL_SNAPSHOT = { id: 'snap-xyz', tenantId: 'tenant-abc' };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewProgramOrchestrationService.orchestrate()', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when reviewProgramId is empty', async () => {
    const dbService = makeDbService(null) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    await expect(svc.orchestrate('', makeRequest(), makeActor()))
      .rejects.toThrow('reviewProgramId is required');
  });

  it('throws when reviewProgramId is whitespace only', async () => {
    const dbService = makeDbService(null) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    await expect(svc.orchestrate('   ', makeRequest(), makeActor()))
      .rejects.toThrow('reviewProgramId is required');
  });

  it('throws when program is not found', async () => {
    const dbService = makeDbService(null) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);

    await expect(svc.orchestrate('missing-prog', makeRequest(), makeActor()))
      .rejects.toThrow("Review program 'missing-prog' not found");
  });

  it('throws when snapshot is not found', async () => {
    const program = makeProgram();
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(null);

    await expect(svc.orchestrate('prog-1', makeRequest(), makeActor()))
      .rejects.toThrow("Snapshot 'snap-xyz' not found");
  });

  it('submits both engine legs from prepared dispatch when no snapshot is linked', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', 'http://mop-prio.local');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit
      .mockResolvedValueOnce({ submissionId: 'run-004a' })
      .mockResolvedValueOnce({ submissionId: 'run-005' });

    const result = await svc.orchestrate('prog-1', {
      clientId: 'client-1',
      subClientId: 'sub-1',
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      preparedDispatchId: 'dispatch-1',
      preparedEngineDispatches: [
        {
          id: 'pd-1',
          reviewProgramId: 'prog-1',
          reviewProgramVersion: '1.0',
          engine: 'AXIOM',
          engineProgramId: 'vision-appraisal-ai',
          engineProgramVersion: '1.0',
          payloadContractType: 'axiom-review-dispatch',
          payloadContractVersion: '1.0',
          payloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/vision-appraisal-ai:1.0',
          canDispatch: true,
          blockedReasons: [],
          payload: {
            contractType: 'axiom-review-dispatch',
            contractVersion: '1.0',
            dispatchMode: 'prepared-context',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            tenantId: 'tenant-abc',
            reviewProgramId: 'prog-1',
            reviewProgramVersion: '1.0',
            engineProgramId: 'vision-appraisal-ai',
            engineProgramVersion: '1.0',
            criteria: [],
            documentInventory: [],
            evidenceRefs: [],
          },
        },
        {
          id: 'pd-2',
          reviewProgramId: 'prog-1',
          reviewProgramVersion: '1.0',
          engine: 'MOP_PRIO',
          engineProgramId: 'vision-appraisal',
          engineProgramVersion: '1.0',
          payloadContractType: 'mop-prio-review-dispatch',
          payloadContractVersion: '1.0',
          payloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/vision-appraisal:1.0',
          canDispatch: true,
          blockedReasons: [],
          payload: {
            contractType: 'mop-prio-review-dispatch',
            contractVersion: '1.0',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            tenantId: 'tenant-abc',
            reviewProgramId: 'prog-1',
            reviewProgramVersion: '1.0',
            engineProgramId: 'vision-appraisal',
            engineProgramVersion: '1.0',
            dispatchMode: 'prepared-context',
            criteria: [],
            documentInventory: [],
            evidenceRefs: [],
          },
        },
      ],
    }, makeActor());

    expect(result.overallStatus).toBe('all_submitted');
    expect(result.axiomLegs[0]).toMatchObject({ status: 'submitted', runId: 'run-004a' });
    expect(result.mopLegs[0]).toMatchObject({ status: 'submitted', runId: 'run-005' });
    expect(submissionService.submit).toHaveBeenCalledTimes(2);
  });

  it('returns none_submitted with skippedReason when program has no refs', async () => {
    const program = makeProgram({ aiCriteriaRefs: [], rulesetRefs: [] });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('none_submitted');
    expect(result.skippedReason).toBeDefined();
    expect(result.axiomLegs).toHaveLength(0);
    expect(result.mopLegs).toHaveLength(0);
  });

  it('returns all_submitted when both Axiom and MOP legs succeed', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', 'http://mop-prio.local');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit.mockResolvedValue({ submissionId: 'run-001' });

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('all_submitted');
    expect(result.axiomLegs).toHaveLength(1);
    expect(result.axiomLegs[0]).toMatchObject({
      engine: 'AXIOM',
      programId: 'vision-appraisal-ai',
      programVersion: '1.0',
      status: 'submitted',
      runId: 'run-001',
    });
    expect(result.mopLegs).toHaveLength(1);
    expect(result.mopLegs[0]).toMatchObject({
      engine: 'MOP_PRIO',
      programId: 'vision-appraisal',
      programVersion: '1.0',
      status: 'submitted',
      runId: 'run-001',
    });
  });

  it('repairs stale seeded global programs before orchestration', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', 'http://mop-prio.local');

    const staleGlobalProgram = makeProgram({
      id: 'vision-appraisal-v1.0',
      name: 'VisionAppraisal Risk Program',
      aiCriteriaRefs: [],
      rulesetRefs: [],
    });
    const dbService = makeDbService({
      ...staleGlobalProgram,
      clientId: '__global__',
      createdAt: '2026-02-23T00:00:00.000Z',
      thresholds: { ltv: 0.8 },
      decisionRules: { reject: { minScore: 70 }, conditional: { minScore: 35 }, accept: { maxScore: 34 } },
    }) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit.mockResolvedValue({ submissionId: 'run-004' });

    const result = await svc.orchestrate('vision-appraisal-v1.0', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('all_submitted');
    expect(result.axiomLegs[0]).toMatchObject({ programId: 'vision-appraisal-ai', status: 'submitted' });
    expect(result.mopLegs[0]).toMatchObject({ programId: 'vision-appraisal', status: 'submitted' });
  });

  it('marks MOP leg as skipped when MOP_PRIO_API_BASE_URL is absent in non-production environments', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit.mockResolvedValue({ submissionId: 'run-002' });

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('partial');
    expect(result.axiomLegs[0]?.status).toBe('submitted');
    expect(result.mopLegs[0]?.status).toBe('skipped');
    expect(result.mopLegs[0]?.error).toMatch(/MOP_PRIO_API_BASE_URL/);
  });

  it('fails the MOP leg loudly when MOP_PRIO_API_BASE_URL is absent in production', async () => {
    // Production-time guard: a missing engine URL is a deployment defect, not a
    // business outcome. The leg must FAIL (not skip) so the broken deploy is
    // visible in run-ledger and overall status, instead of being masked as a
    // partial success.
    vi.stubEnv('MOP_PRIO_API_BASE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit.mockResolvedValue({ submissionId: 'run-002' });

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.mopLegs[0]?.status).toBe('failed');
    expect(result.mopLegs[0]?.error).toMatch(/MOP_PRIO_API_BASE_URL/);
    expect(result.mopLegs[0]?.error).toMatch(/production/i);
    // Submission must not have been attempted on the MOP leg.
    expect(submissionService.submit).toHaveBeenCalledTimes(1); // axiom only
  });

  it('returns partial when Axiom leg fails but MOP leg succeeds', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', 'http://mop-prio.local');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    // First call (Axiom leg) throws; second call (MOP leg) succeeds
    submissionService.submit
      .mockRejectedValueOnce(new Error('Axiom timeout'))
      .mockResolvedValueOnce({ submissionId: 'run-003' });

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('partial');
    expect(result.axiomLegs[0]?.status).toBe('failed');
    expect(result.axiomLegs[0]?.error).toBe('Axiom timeout');
    expect(result.mopLegs[0]?.status).toBe('submitted');
  });

  it('returns none_submitted when all legs fail', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', 'http://mop-prio.local');

    const program = makeProgram({
      aiCriteriaRefs: [{ programId: 'vision-appraisal-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit.mockRejectedValue(new Error('engine down'));

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.overallStatus).toBe('none_submitted');
    expect(result.axiomLegs[0]?.status).toBe('failed');
    expect(result.mopLegs[0]?.status).toBe('failed');
  });

  it('fans out multiple aiCriteriaRefs to separate Axiom legs', async () => {
    vi.stubEnv('MOP_PRIO_API_BASE_URL', '');

    const program = makeProgram({
      aiCriteriaRefs: [
        { programId: 'prog-a', programVersion: '1.0' },
        { programId: 'prog-b', programVersion: '2.0' },
      ],
      rulesetRefs: [],
    });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { submissionService, snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);
    submissionService.submit
      .mockResolvedValueOnce({ submissionId: 'run-a' })
      .mockResolvedValueOnce({ submissionId: 'run-b' });

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.axiomLegs).toHaveLength(2);
    expect(result.axiomLegs[0]).toMatchObject({ programId: 'prog-a', status: 'submitted', runId: 'run-a' });
    expect(result.axiomLegs[1]).toMatchObject({ programId: 'prog-b', status: 'submitted', runId: 'run-b' });
    expect(result.overallStatus).toBe('all_submitted');
  });

  it('includes reviewProgramName in the result', async () => {
    const program = makeProgram({ name: 'My Custom Program', aiCriteriaRefs: [], rulesetRefs: [] });
    const dbService = makeDbService(program) as any;
    const svc = new ReviewProgramOrchestrationService(dbService);
    const { snapshotService } = getInternals(svc);
    snapshotService.getSnapshotById.mockResolvedValue(MINIMAL_SNAPSHOT);

    const result = await svc.orchestrate('prog-1', makeRequest(), makeActor());

    expect(result.reviewProgramName).toBe('My Custom Program');
    expect(result.reviewProgramId).toBe('prog-1');
  });
});
