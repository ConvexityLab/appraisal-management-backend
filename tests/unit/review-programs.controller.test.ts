import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createReviewProgramsRouter } from '../../src/controllers/review-programs.controller.js';

function makeContainer(options?: {
  queryResources?: unknown[];
  createImpl?: (doc: unknown) => Promise<unknown>;
  replaceImpl?: (doc: unknown) => Promise<unknown>;
}) {
  const query = vi.fn().mockReturnValue({
    fetchAll: vi.fn().mockResolvedValue({ resources: options?.queryResources ?? [] }),
  });
  const create = vi.fn().mockImplementation(async (doc: unknown) => {
    if (options?.createImpl) {
      return options.createImpl(doc);
    }
    return { resource: doc };
  });
  const replace = vi.fn().mockImplementation(async (doc: unknown) => {
    if (options?.replaceImpl) {
      return options.replaceImpl(doc);
    }
    return { resource: doc };
  });
  const item = vi.fn().mockReturnValue({ replace });

  return {
    container: {
      items: {
        query,
        create,
      },
      item,
    },
    query,
    create,
    item,
    replace,
  };
}

function buildApp(
  container: ReturnType<typeof makeContainer>['container'],
  dependencies?: Parameters<typeof createReviewProgramsRouter>[1],
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      tenantId: 'tenant-test',
      id: 'user-test',
    };
    next();
  });
  app.use(
    '/api/review-programs',
    createReviewProgramsRouter(
      {
        getReviewProgramsContainer: () => container,
      } as any,
      dependencies,
    ),
  );
  return app;
}

describe('ReviewProgramsController create/update validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a ref-only review program without requiring inline rules', async () => {
    const mock = makeContainer({ queryResources: [] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .post('/api/review-programs')
      .send({
        name: 'Vision Hybrid Program',
        version: '1.0',
        programType: 'FRAUD',
        status: 'DRAFT',
        clientId: null,
        aiCriteriaRefs: [{ programId: 'vision-ai', programVersion: '1.0' }],
        rulesetRefs: [{ programId: 'vision-mop', programVersion: '1.0' }],
      });

    expect(res.status).toBe(201);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'vision-hybrid-program-v1.0',
        aiCriteriaRefs: [{ programId: 'vision-ai', programVersion: '1.0' }],
        rulesetRefs: [{ programId: 'vision-mop', programVersion: '1.0' }],
        clientId: '__global__',
      }),
    );
    expect(mock.create.mock.calls[0]?.[0]).not.toHaveProperty('thresholds');
    expect(mock.create.mock.calls[0]?.[0]).not.toHaveProperty('decisionRules');
  });

  it('rejects create when neither engine refs nor inline rules are supplied', async () => {
    const mock = makeContainer({ queryResources: [] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .post('/api/review-programs')
      .send({
        name: 'Invalid Program',
        version: '1.0',
        programType: 'QC',
        status: 'DRAFT',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must define either engine refs');
    expect(mock.create).not.toHaveBeenCalled();
  });

  it('rejects create when inline mode is missing decisionRules', async () => {
    const mock = makeContainer({ queryResources: [] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .post('/api/review-programs')
      .send({
        name: 'Inline Invalid',
        version: '1.0',
        programType: 'QC',
        status: 'DRAFT',
        thresholds: {
          ltv: 80,
          cltv: 85,
          dscrMinimum: 1,
          appreciation24mPct: 20,
          appreciation36mPct: 30,
          netAdjustmentPct: 15,
          grossAdjustmentPct: 25,
          nonMlsPct: 30,
          avmGapPct: 10,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must include both thresholds and decisionRules');
    expect(mock.create).not.toHaveBeenCalled();
  });

  it('updates an existing program to ref-only configuration', async () => {
    const existing = {
      id: 'legacy-prog-v1.0',
      name: 'Legacy Program',
      version: '1.0',
      programType: 'FRAUD',
      status: 'ACTIVE',
      clientId: '__global__',
      createdAt: '2026-01-01T00:00:00.000Z',
      thresholds: {
        ltv: 80,
        cltv: 85,
        dscrMinimum: 1,
        appreciation24mPct: 20,
        appreciation36mPct: 30,
        netAdjustmentPct: 15,
        grossAdjustmentPct: 25,
        nonMlsPct: 30,
        avmGapPct: 10,
      },
      decisionRules: {
        reject: { minScore: 70 },
        conditional: { minScore: 40 },
        accept: { maxScore: 39 },
      },
      autoFlags: [],
      manualFlags: [],
    };
    const mock = makeContainer({ queryResources: [existing] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .put('/api/review-programs/legacy-prog-v1.0')
      .send({
        aiCriteriaRefs: [{ programId: 'vision-ai', programVersion: '2.0' }],
        rulesetRefs: [{ programId: 'vision-mop', programVersion: '2.0' }],
        thresholds: undefined,
        decisionRules: undefined,
        autoFlags: [],
        manualFlags: [],
      });

    expect(res.status).toBe(200);
    expect(mock.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        aiCriteriaRefs: [{ programId: 'vision-ai', programVersion: '2.0' }],
        rulesetRefs: [{ programId: 'vision-mop', programVersion: '2.0' }],
        clientId: '__global__',
      }),
    );
  });

  it('rejects update when all refs are removed and no inline rules remain', async () => {
    const existing = {
      id: 'ref-prog-v1.0',
      name: 'Ref Program',
      version: '1.0',
      programType: 'FRAUD',
      status: 'ACTIVE',
      clientId: '__global__',
      createdAt: '2026-01-01T00:00:00.000Z',
      aiCriteriaRefs: [{ programId: 'vision-ai', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'vision-mop', programVersion: '1.0' }],
    };
    const mock = makeContainer({ queryResources: [existing] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .put('/api/review-programs/ref-prog-v1.0')
      .send({
        aiCriteriaRefs: [],
        rulesetRefs: [],
        thresholds: undefined,
        decisionRules: undefined,
        autoFlags: [],
        manualFlags: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must define either engine refs');
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it('rejects the retired legacy submit route with migration guidance', async () => {
    const mock = makeContainer({ queryResources: [] });
    const app = buildApp(mock.container);

    const res = await request(app)
      .post('/api/review-programs/prog-1/submit')
      .send({
        snapshotId: 'snapshot-1',
        clientId: 'client-1',
        subClientId: 'sub-1',
        engagementId: 'eng-1',
        loanPropertyContextId: 'order-1',
      });

    expect(res.status).toBe(410);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('POST /api/review-programs/prepare'),
      }),
    );
  });

  it('prepares review programs without dispatching them', async () => {
    const mock = makeContainer({ queryResources: [] });
    const publishBatch = vi.fn().mockResolvedValue(undefined);
    const prepare = vi.fn().mockResolvedValue({
      orderId: 'order-1',
      preparedAt: '2026-03-01T00:00:00.000Z',
      contextSummary: {
        clientId: 'client-1',
        subClientId: 'sub-1',
        documentCount: 1,
        hasDocuments: true,
        hasEnrichment: false,
        extractionRunCount: 0,
        criteriaRunCount: 0,
        reviewProgramsRequested: 1,
        reviewProgramsResolved: 1,
      },
      programs: [
        {
          reviewProgramId: 'prog-1',
          reviewProgramName: 'Vision Hybrid Program',
          reviewProgramVersion: '1.0',
          readiness: 'requires_extraction',
          canDispatch: false,
          axiomRefCount: 1,
          mopRefCount: 1,
          blockers: ['No extraction snapshot exists yet.'],
          warnings: [],
          recommendedActions: ['run_extraction'],
          criterionResolutions: [],
        },
      ],
      warnings: [],
      recommendedActions: ['run_extraction'],
      context: {
        identity: {
          orderId: 'order-1',
          tenantId: 'tenant-test',
          clientId: 'client-1',
          subClientId: 'sub-1',
        },
        order: { id: 'order-1' },
        reviewPrograms: [],
        documents: [],
        runs: [],
        runSummary: {
          totalRuns: 0,
          extractionRuns: 0,
          criteriaRuns: 0,
        },
        evidenceRefs: [],
        warnings: [],
        assembledAt: '2026-03-01T00:00:00.000Z',
        assembledBy: 'user-test',
        contextVersion: 'review-context:order-1:1',
      },
    });
    const persistPreparation = vi.fn().mockImplementation(async (response) => ({
      ...response,
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      plannedEngineDispatches: [],
    }));

    const app = buildApp(mock.container, {
      preparationFactory: () => ({ prepare }),
      preparedContextFactory: () => ({
        persistPreparation,
        getPreparedContext: vi.fn(),
        listPreparedContextsForOrder: vi.fn(),
      }),
      eventPublisher: { publishBatch },
    });

    const res = await request(app)
      .post('/api/review-programs/prepare')
      .set('X-Correlation-Id', 'corr-prepare-123')
      .send({
        orderId: 'order-1',
        reviewProgramIds: ['prog-1'],
        clientId: 'client-1',
        subClientId: 'sub-1',
      });

    expect(res.status).toBe(200);
    expect(prepare).toHaveBeenCalledWith(
      {
        orderId: 'order-1',
        reviewProgramIds: ['prog-1'],
        clientId: 'client-1',
        subClientId: 'sub-1',
      },
      expect.objectContaining({
        tenantId: 'tenant-test',
        initiatedBy: 'user-test',
        correlationId: 'corr-prepare-123',
      }),
    );
    expect(persistPreparation).toHaveBeenCalledTimes(1);
    expect(publishBatch).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          type: 'review-program.prepare.started',
          correlationId: 'corr-prepare-123',
          data: expect.objectContaining({
            orderId: 'order-1',
            reviewProgramIds: ['prog-1'],
          }),
        }),
      ],
    );
    expect(publishBatch).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          type: 'review-program.prepare.completed',
          correlationId: 'corr-prepare-123',
          data: expect.objectContaining({
            orderId: 'order-1',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            readyProgramCount: 0,
            blockedProgramCount: 1,
          }),
        }),
      ],
    );
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        orderId: 'order-1',
        preparedContextId: 'prepared-1',
        programs: expect.any(Array),
      }),
    });
  });

  it('dispatches review programs from a prepared context', async () => {
    const mock = makeContainer({ queryResources: [] });
    const publishBatch = vi.fn().mockResolvedValue(undefined);
    const getPreparedContext = vi.fn().mockResolvedValue({
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      orderId: 'order-1',
      engagementId: 'eng-1',
      context: {
        identity: {
          orderId: 'order-1',
          tenantId: 'tenant-test',
          clientId: 'client-1',
          subClientId: 'sub-1',
        },
        runSummary: {
          latestSnapshotId: 'snapshot-1',
        },
      },
      plannedEngineDispatches: [
        {
          reviewProgramId: 'prog-1',
          engine: 'AXIOM',
          engineProgramId: 'axiom-qc',
          engineProgramVersion: '1.0',
          payloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-qc:1.0',
          payloadContractType: 'axiom-review-dispatch',
          payloadContractVersion: '1.0',
        },
      ],
    });
    const dispatch = vi.fn().mockResolvedValue({
      dispatchId: 'dispatch-1',
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      orderId: 'order-1',
      engagementId: 'eng-1',
      dispatchedAt: '2026-04-29T00:00:00.000Z',
      dispatchMode: 'all_ready_only',
      submittedPrograms: [
        {
          reviewProgramId: 'prog-1',
          reviewProgramName: 'Vision Hybrid Program',
          reviewProgramVersion: '1.0',
          overallStatus: 'all_submitted',
          axiomLegs: [
            { engine: 'AXIOM', programId: 'axiom-qc', programVersion: '1.0', status: 'submitted', runId: 'run-1' },
          ],
          mopLegs: [],
        },
      ],
      skippedPrograms: [],
      warnings: [],
    });

    const app = buildApp(mock.container, {
      preparedContextFactory: () => ({
        persistPreparation: vi.fn(),
        getPreparedContext,
        listPreparedContextsForOrder: vi.fn(),
      }),
      dispatchFactory: () => ({ dispatch }),
      eventPublisher: { publishBatch },
    });

    const res = await request(app)
      .post('/api/review-programs/dispatch')
      .set('X-Correlation-Id', 'corr-dispatch-123')
      .send({
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-1'],
        dispatchMode: 'all_ready_only',
        confirmWarnings: true,
      });

    expect(res.status).toBe(202);
    expect(dispatch).toHaveBeenCalledWith(
      {
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-1'],
        dispatchMode: 'all_ready_only',
        confirmWarnings: true,
      },
      expect.objectContaining({
        tenantId: 'tenant-test',
        correlationId: 'corr-dispatch-123',
      }),
    );
    expect(publishBatch).toHaveBeenCalled();
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        dispatchId: 'dispatch-1',
        submittedPrograms: expect.any(Array),
      }),
    });
  });

  it('dispatches review programs from the nested prepared-context route', async () => {
    const mock = makeContainer({ queryResources: [] });
    const getPreparedContext = vi.fn().mockResolvedValue({
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      orderId: 'order-1',
      engagementId: 'eng-1',
      context: {
        identity: {
          orderId: 'order-1',
          tenantId: 'tenant-test',
          clientId: 'client-1',
          subClientId: 'sub-1',
        },
        runSummary: {
          latestSnapshotId: 'snapshot-1',
        },
      },
      plannedEngineDispatches: [],
    });
    const dispatch = vi.fn().mockResolvedValue({
      dispatchId: 'dispatch-2',
      preparedContextId: 'prepared-1',
      preparedContextVersion: 'review-context:order-1:1',
      orderId: 'order-1',
      engagementId: 'eng-1',
      dispatchedAt: '2026-04-29T00:00:00.000Z',
      dispatchMode: 'all_ready_only',
      submittedPrograms: [],
      skippedPrograms: [
        {
          reviewProgramId: 'prog-1',
          reason: 'Program is not dispatchable from the prepared context.',
        },
      ],
      warnings: [],
    });

    const app = buildApp(mock.container, {
      preparedContextFactory: () => ({
        persistPreparation: vi.fn(),
        getPreparedContext,
        listPreparedContextsForOrder: vi.fn(),
      }),
      dispatchFactory: () => ({ dispatch }),
      eventPublisher: { publishBatch: vi.fn().mockResolvedValue(undefined) },
    });

    const res = await request(app)
      .post('/api/review-programs/prepared/prepared-1/dispatch')
      .send({
        reviewProgramIds: ['prog-1'],
      });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-1'],
      }),
      expect.objectContaining({
        tenantId: 'tenant-test',
      }),
    );
    expect(res.status).toBe(422);
  });

  it('retrieves a prepared review context artifact by id', async () => {
    const mock = makeContainer({ queryResources: [] });
    const getPreparedContext = vi.fn().mockResolvedValue({
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
      plannedEngineDispatches: [],
      context: {
        identity: { orderId: 'order-1', tenantId: 'tenant-test' },
        order: { id: 'order-1' },
        reviewPrograms: [],
        documents: [],
        runs: [],
        runSummary: { totalRuns: 1, extractionRuns: 1, criteriaRuns: 0 },
        evidenceRefs: [],
        warnings: [],
        assembledAt: '2026-04-29T00:00:00.000Z',
        assembledBy: 'user-test',
        contextVersion: 'review-context:order-1:1',
      },
    });

    const app = buildApp(mock.container, {
      preparedContextFactory: () => ({
        persistPreparation: vi.fn(),
        getPreparedContext,
        listPreparedContextsForOrder: vi.fn(),
      }),
    });

    const res = await request(app).get('/api/review-programs/prepared/prepared-1');

    expect(res.status).toBe(200);
    expect(getPreparedContext).toHaveBeenCalledWith('prepared-1', 'tenant-test');
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        preparedContextId: 'prepared-1',
        orderId: 'order-1',
      }),
    });
  });

  it('lists prepared review context artifacts for an order', async () => {
    const mock = makeContainer({ queryResources: [] });
    const listPreparedContextsForOrder = vi.fn().mockResolvedValue([
      {
        preparedContextId: 'prepared-2',
        preparedContextVersion: 'review-context:order-1:2',
        orderId: 'order-1',
        engagementId: 'eng-1',
        createdAt: '2026-04-29T01:00:00.000Z',
        createdBy: 'user-test',
        preparedAt: '2026-04-29T01:00:00.000Z',
        reviewProgramCount: 2,
        dispatchCount: 3,
        warningCount: 1,
        recommendedActionCount: 2,
        readyProgramCount: 1,
        blockedProgramCount: 1,
        latestSnapshotId: 'snapshot-2',
      },
      {
        preparedContextId: 'prepared-1',
        preparedContextVersion: 'review-context:order-1:1',
        orderId: 'order-1',
        createdAt: '2026-04-29T00:00:00.000Z',
        createdBy: 'user-test',
        preparedAt: '2026-04-29T00:00:00.000Z',
        reviewProgramCount: 1,
        dispatchCount: 2,
        warningCount: 0,
        recommendedActionCount: 1,
        readyProgramCount: 1,
        blockedProgramCount: 0,
      },
    ]);

    const app = buildApp(mock.container, {
      preparedContextFactory: () => ({
        persistPreparation: vi.fn(),
        getPreparedContext: vi.fn(),
        listPreparedContextsForOrder,
      }),
    });

    const res = await request(app).get('/api/review-programs/prepared?orderId=order-1&limit=5');

    expect(res.status).toBe(200);
    expect(listPreparedContextsForOrder).toHaveBeenCalledWith('order-1', 'tenant-test', 5);
    expect(res.body).toEqual({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ preparedContextId: 'prepared-2', dispatchCount: 3 }),
        expect.objectContaining({ preparedContextId: 'prepared-1', reviewProgramCount: 1 }),
      ]),
    });
  });

  it('diffs two prepared review context artifacts', async () => {
    const mock = makeContainer({ queryResources: [] });
    const getPreparedContext = vi.fn()
      .mockResolvedValueOnce({
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
        programs: [
          {
            reviewProgramId: 'prog-1',
            reviewProgramName: 'Vision Hybrid Program',
            reviewProgramVersion: '1.0',
            readiness: 'requires_documents',
            canDispatch: false,
            axiomRefCount: 1,
            mopRefCount: 1,
            blockers: ['Missing appraisal document'],
            warnings: [],
            recommendedActions: ['upload_required_documents'],
            criterionResolutions: [],
          },
        ],
        warnings: [],
        recommendedActions: [],
        plannedEngineDispatches: [
          {
            reviewProgramId: 'prog-1',
            engine: 'MOP_PRIO',
            engineProgramId: 'mop-qc',
            engineProgramVersion: '1.0',
            canDispatch: false,
            blockedReasons: ['Missing appraisal document'],
          },
        ],
        context: {
          identity: { orderId: 'order-1', tenantId: 'tenant-test' },
          order: { id: 'order-1' },
          reviewPrograms: [],
          documents: [],
          compSummary: { totalComps: 0, selectedCompCount: 0, candidateCompCount: 0, adjustedCompCount: 0, selectedCompIds: [], compIdsWithAdjustments: [], hasCompSelection: false, hasAdjustments: false },
          runs: [],
          runSummary: { totalRuns: 1, extractionRuns: 1, criteriaRuns: 0 },
          evidenceRefs: [],
          warnings: [],
          assembledAt: '2026-04-29T00:00:00.000Z',
          assembledBy: 'user-test',
          contextVersion: 'review-context:order-1:1',
        },
      })
      .mockResolvedValueOnce({
        preparedContextId: 'prepared-2',
        preparedContextVersion: 'review-context:order-1:2',
        orderId: 'order-1',
        preparedAt: '2026-04-29T01:00:00.000Z',
        contextSummary: {
          documentCount: 2,
          hasDocuments: true,
          hasEnrichment: true,
          extractionRunCount: 1,
          criteriaRunCount: 0,
          reviewProgramsRequested: 1,
          reviewProgramsResolved: 1,
        },
        programs: [
          {
            reviewProgramId: 'prog-1',
            reviewProgramName: 'Vision Hybrid Program',
            reviewProgramVersion: '1.0',
            readiness: 'ready',
            canDispatch: true,
            axiomRefCount: 1,
            mopRefCount: 1,
            blockers: [],
            warnings: ['Using enrichment fallback'],
            recommendedActions: [],
            criterionResolutions: [],
          },
        ],
        warnings: [],
        recommendedActions: [],
        plannedEngineDispatches: [
          {
            reviewProgramId: 'prog-1',
            engine: 'MOP_PRIO',
            engineProgramId: 'mop-qc',
            engineProgramVersion: '1.0',
            canDispatch: true,
            blockedReasons: [],
          },
        ],
        context: {
          identity: { orderId: 'order-1', tenantId: 'tenant-test' },
          order: { id: 'order-1' },
          reviewPrograms: [],
          documents: [],
          compSummary: { totalComps: 3, selectedCompCount: 3, candidateCompCount: 0, adjustedCompCount: 2, selectedCompIds: ['comp-1', 'comp-2', 'comp-3'], compIdsWithAdjustments: ['comp-1', 'comp-2'], hasCompSelection: true, hasAdjustments: true },
          adjustmentSummary: { adjustedCompCount: 2, maxGrossAdjustmentPct: 15 },
          runs: [],
          runSummary: { totalRuns: 1, extractionRuns: 1, criteriaRuns: 0 },
          evidenceRefs: [],
          warnings: [],
          assembledAt: '2026-04-29T01:00:00.000Z',
          assembledBy: 'user-test',
          contextVersion: 'review-context:order-1:2',
        },
      });

    const app = buildApp(mock.container, {
      preparedContextFactory: () => ({
        persistPreparation: vi.fn(),
        getPreparedContext,
        listPreparedContextsForOrder: vi.fn(),
      }),
    });

    const res = await request(app).get('/api/review-programs/prepared/prepared-1/diff/prepared-2');

    expect(res.status).toBe(200);
    expect(getPreparedContext).toHaveBeenNthCalledWith(1, 'prepared-1', 'tenant-test');
    expect(getPreparedContext).toHaveBeenNthCalledWith(2, 'prepared-2', 'tenant-test');
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        leftPreparedContextId: 'prepared-1',
        rightPreparedContextId: 'prepared-2',
        orderId: 'order-1',
        valueChanges: expect.arrayContaining([
          expect.objectContaining({ field: 'contextSummary.documentCount', left: 1, right: 2 }),
        ]),
        programDiffs: expect.arrayContaining([
          expect.objectContaining({ reviewProgramId: 'prog-1', leftCanDispatch: false, rightCanDispatch: true }),
        ]),
        dispatchDiffs: expect.arrayContaining([
          expect.objectContaining({ reviewProgramId: 'prog-1', leftCanDispatch: false, rightCanDispatch: true }),
        ]),
      }),
    );
  });

  it('repairs stale global seeded programs during list responses', async () => {
    const staleSeededProgram = {
      id: 'vision-appraisal-v1.0',
      name: 'VisionAppraisal Risk Program',
      version: '1.0',
      programType: 'FRAUD',
      status: 'ACTIVE',
      clientId: '__global__',
      createdAt: '2026-02-23T00:00:00.000Z',
      thresholds: {
        ltv: 0.8,
        cltv: 0.9,
        dscrMinimum: 1,
        appreciation24mPct: 0.25,
        appreciation36mPct: 0.35,
        netAdjustmentPct: 0.15,
        grossAdjustmentPct: 0.25,
        nonMlsPct: 0.2,
        avmGapPct: 0.1,
      },
      decisionRules: {
        reject: { minScore: 70 },
        conditional: { minScore: 35 },
        accept: { maxScore: 34 },
      },
    };
    const mock = makeContainer({ queryResources: [staleSeededProgram] });
    const app = buildApp(mock.container);

    const res = await request(app).get('/api/review-programs');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: 'vision-appraisal-v1.0',
      clientId: null,
      aiCriteriaRefs: [{ programId: 'appraisal-qc', programVersion: '1.0.0' }],
      rulesetRefs: [{ programId: 'vision-appraisal', programVersion: '1.0' }],
    });
  });
});
