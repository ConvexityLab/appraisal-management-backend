import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewDispatchService } from '../../src/services/review-dispatch.service.js';
import type { PreparedReviewContextArtifact } from '../../src/types/review-preparation.types.js';

function buildPreparedContext(overrides: Partial<PreparedReviewContextArtifact> = {}): PreparedReviewContextArtifact {
  return {
    id: 'prepared-1',
    type: 'review-program-prepared-context',
    tenantId: 'tenant-1',
    createdAt: '2026-04-29T00:00:00.000Z',
    createdBy: 'user-1',
    preparedContextId: 'prepared-1',
    preparedContextVersion: 'review-context:order-1:1',
    orderId: 'order-1',
    preparedAt: '2026-04-29T00:00:00.000Z',
    contextSummary: {
      clientId: 'client-1',
      subClientId: 'sub-1',
      documentCount: 1,
      hasDocuments: true,
      hasEnrichment: true,
      extractionRunCount: 1,
      criteriaRunCount: 0,
      latestSnapshotId: 'snapshot-1',
      reviewProgramsRequested: 2,
      reviewProgramsResolved: 2,
    },
    programs: [
      {
        reviewProgramId: 'prog-ready',
        reviewProgramName: 'Ready Program',
        reviewProgramVersion: '1.0',
        readiness: 'ready',
        canDispatch: true,
        axiomRefCount: 1,
        mopRefCount: 1,
        blockers: [],
        warnings: [],
        recommendedActions: [],
        criterionResolutions: [],
      },
      {
        reviewProgramId: 'prog-warning',
        reviewProgramName: 'Warning Program',
        reviewProgramVersion: '1.0',
        readiness: 'ready_with_warnings',
        canDispatch: true,
        axiomRefCount: 1,
        mopRefCount: 0,
        blockers: [],
        warnings: ['Needs confirmation'],
        recommendedActions: [],
        criterionResolutions: [],
      },
      {
        reviewProgramId: 'prog-blocked',
        reviewProgramName: 'Blocked Program',
        reviewProgramVersion: '1.0',
        readiness: 'requires_documents',
        canDispatch: false,
        axiomRefCount: 1,
        mopRefCount: 0,
        blockers: ['Missing required document types: 1004'],
        warnings: [],
        recommendedActions: ['upload_required_documents'],
        criterionResolutions: [],
      },
    ],
    warnings: [],
    recommendedActions: [],
    plannedEngineDispatches: [
      {
        id: 'dispatch-ready-axiom',
        reviewProgramId: 'prog-ready',
        reviewProgramVersion: '1.0',
        engine: 'AXIOM',
        engineProgramId: 'axiom-ready',
        engineProgramVersion: '1.0',
        payloadContractType: 'axiom-review-dispatch',
        payloadContractVersion: '1.0',
        payloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-ready:1.0',
        canDispatch: true,
        blockedReasons: [],
        payload: {
          contractType: 'axiom-review-dispatch',
          contractVersion: '1.0',
          dispatchMode: 'prepared-context',
          preparedContextId: 'prepared-1',
          preparedContextVersion: 'review-context:order-1:1',
          orderId: 'order-1',
          tenantId: 'tenant-1',
          reviewProgramId: 'prog-ready',
          reviewProgramVersion: '1.0',
          engineProgramId: 'axiom-ready',
          engineProgramVersion: '1.0',
          snapshotId: 'snapshot-1',
          programKey: {
            clientId: 'client-1',
            subClientId: 'sub-1',
            programId: 'axiom-ready',
            version: '1.0',
          },
          criteria: [],
          documentInventory: [],
          evidenceRefs: [],
        },
      },
      {
        id: 'dispatch-ready-mop',
        reviewProgramId: 'prog-ready',
        reviewProgramVersion: '1.0',
        engine: 'MOP_PRIO',
        engineProgramId: 'mop-ready',
        engineProgramVersion: '1.0',
        payloadContractType: 'mop-prio-review-dispatch',
        payloadContractVersion: '1.0',
        payloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-ready:1.0',
        canDispatch: true,
        blockedReasons: [],
        payload: {
          contractType: 'mop-prio-review-dispatch',
          contractVersion: '1.0',
          preparedContextId: 'prepared-1',
          preparedContextVersion: 'review-context:order-1:1',
          orderId: 'order-1',
          tenantId: 'tenant-1',
          reviewProgramId: 'prog-ready',
          reviewProgramVersion: '1.0',
          engineProgramId: 'mop-ready',
          engineProgramVersion: '1.0',
          snapshotId: 'snapshot-1',
          programKey: {
            clientId: 'client-1',
            subClientId: 'sub-1',
            programId: 'mop-ready',
            version: '1.0',
          },
          dispatchMode: 'prepared-context',
          criteria: [],
          documentInventory: [],
          evidenceRefs: [],
        },
      },
      {
        id: 'dispatch-warning-axiom',
        reviewProgramId: 'prog-warning',
        reviewProgramVersion: '1.0',
        engine: 'AXIOM',
        engineProgramId: 'axiom-warning',
        engineProgramVersion: '1.0',
        payloadContractType: 'axiom-review-dispatch',
        payloadContractVersion: '1.0',
        payloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-warning:1.0',
        canDispatch: true,
        blockedReasons: [],
        payload: {
          contractType: 'axiom-review-dispatch',
          contractVersion: '1.0',
          dispatchMode: 'prepared-context',
          preparedContextId: 'prepared-1',
          preparedContextVersion: 'review-context:order-1:1',
          orderId: 'order-1',
          tenantId: 'tenant-1',
          reviewProgramId: 'prog-warning',
          reviewProgramVersion: '1.0',
          engineProgramId: 'axiom-warning',
          engineProgramVersion: '1.0',
          snapshotId: 'snapshot-1',
          programKey: {
            clientId: 'client-1',
            subClientId: 'sub-1',
            programId: 'axiom-warning',
            version: '1.0',
          },
          criteria: [],
          documentInventory: [],
          evidenceRefs: [],
        },
      },
    ],
    context: {
      identity: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        subClientId: 'sub-1',
      },
      order: { id: 'order-1' } as any,
      reviewPrograms: [],
      documents: [],
      latestSnapshot: {
        id: 'snapshot-1',
        createdAt: '2026-04-29T00:00:00.000Z',
        hasNormalizedData: true,
        availableDataPaths: [],
        availableDataPathsBySource: {
          subjectProperty: [],
          extraction: [],
          providerData: [],
          provenance: [],
        },
      },
      runs: [],
      runSummary: {
        totalRuns: 1,
        extractionRuns: 1,
        criteriaRuns: 0,
        latestSnapshotId: 'snapshot-1',
      },
      evidenceRefs: [],
      warnings: [],
      assembledAt: '2026-04-29T00:00:00.000Z',
      assembledBy: 'user-1',
      contextVersion: 'review-context:order-1:1',
    },
    ...overrides,
  } as PreparedReviewContextArtifact;
}

describe('ReviewDispatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches ready programs from a prepared context and skips blocked ones', async () => {
    const getPreparedContext = vi.fn().mockResolvedValue(buildPreparedContext());
    const orchestrate = vi.fn().mockResolvedValue({
      reviewProgramId: 'prog-ready',
      reviewProgramName: 'Ready Program',
      overallStatus: 'all_submitted',
      axiomLegs: [
        { engine: 'AXIOM', programId: 'axiom-ready', programVersion: '1.0', status: 'submitted', runId: 'run-1' },
      ],
      mopLegs: [
        { engine: 'MOP_PRIO', programId: 'mop-ready', programVersion: '1.0', status: 'submitted', runId: 'run-2' },
      ],
    });

    const service = new ReviewDispatchService({} as any, {
      preparedContextService: { getPreparedContext },
      orchestrationService: { orchestrate },
    });

    const result = await service.dispatch(
      {
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-ready', 'prog-blocked'],
        dispatchMode: 'all_ready_only',
      },
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(orchestrate).toHaveBeenCalledWith(
      'prog-ready',
      expect.objectContaining({
        preparedContextId: 'prepared-1',
        preparedContextVersion: 'review-context:order-1:1',
        snapshotId: 'snapshot-1',
        clientId: 'client-1',
        subClientId: 'sub-1',
      }),
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(result.submittedPrograms).toHaveLength(1);
    expect(result.skippedPrograms).toEqual([
      {
        reviewProgramId: 'prog-blocked',
        reason: 'Missing required document types: 1004',
      },
    ]);
  });

  it('requires explicit warning confirmation before dispatching warning states', async () => {
    const getPreparedContext = vi.fn().mockResolvedValue(buildPreparedContext());
    const orchestrate = vi.fn();

    const service = new ReviewDispatchService({} as any, {
      preparedContextService: { getPreparedContext },
      orchestrationService: { orchestrate },
    });

    const result = await service.dispatch(
      {
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-warning'],
      },
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(orchestrate).not.toHaveBeenCalled();
    expect(result.submittedPrograms).toHaveLength(0);
    expect(result.skippedPrograms).toEqual([
      {
        reviewProgramId: 'prog-warning',
        reason: 'Program has warnings that require confirmWarnings=true before dispatch.',
      },
    ]);
  });

  it('dispatches partial prepared-context programs when include_partial is requested', async () => {
    const getPreparedContext = vi.fn().mockResolvedValue(buildPreparedContext({
      contextSummary: {
        clientId: 'client-1',
        subClientId: 'sub-1',
        documentCount: 0,
        hasDocuments: false,
        hasEnrichment: true,
        extractionRunCount: 0,
        criteriaRunCount: 0,
        reviewProgramsRequested: 1,
        reviewProgramsResolved: 1,
      },
      programs: [
        {
          reviewProgramId: 'prog-ready',
          reviewProgramName: 'Ready Program',
          reviewProgramVersion: '1.0',
          readiness: 'ready_with_warnings',
          canDispatch: false,
          axiomRefCount: 1,
          mopRefCount: 1,
          blockers: ['Missing required document types: 1004'],
          warnings: ['Proceeding with partial engine coverage only.'],
          recommendedActions: [],
          criterionResolutions: [],
        },
      ],
      plannedEngineDispatches: [
        {
          id: 'dispatch-ready-axiom',
          reviewProgramId: 'prog-ready',
          reviewProgramVersion: '1.0',
          engine: 'AXIOM',
          engineProgramId: 'axiom-ready',
          engineProgramVersion: '1.0',
          payloadContractType: 'axiom-review-dispatch',
          payloadContractVersion: '1.0',
          payloadRef: 'prepared-context://prepared-1/dispatch/AXIOM/axiom-ready:1.0',
          canDispatch: false,
          blockedReasons: ['Missing required document types: 1004'],
          payload: {
            contractType: 'axiom-review-dispatch',
            contractVersion: '1.0',
            dispatchMode: 'prepared-context',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            tenantId: 'tenant-1',
            reviewProgramId: 'prog-ready',
            reviewProgramVersion: '1.0',
            engineProgramId: 'axiom-ready',
            engineProgramVersion: '1.0',
            criteria: [],
            documentInventory: [],
            evidenceRefs: [],
          },
        },
        {
          id: 'dispatch-ready-mop',
          reviewProgramId: 'prog-ready',
          reviewProgramVersion: '1.0',
          engine: 'MOP_PRIO',
          engineProgramId: 'mop-ready',
          engineProgramVersion: '1.0',
          payloadContractType: 'mop-prio-review-dispatch',
          payloadContractVersion: '1.0',
          payloadRef: 'prepared-context://prepared-1/dispatch/MOP_PRIO/mop-ready:1.0',
          canDispatch: true,
          blockedReasons: [],
          payload: {
            contractType: 'mop-prio-review-dispatch',
            contractVersion: '1.0',
            preparedContextId: 'prepared-1',
            preparedContextVersion: 'review-context:order-1:1',
            orderId: 'order-1',
            tenantId: 'tenant-1',
            reviewProgramId: 'prog-ready',
            reviewProgramVersion: '1.0',
            engineProgramId: 'mop-ready',
            engineProgramVersion: '1.0',
            dispatchMode: 'prepared-context',
            criteria: [],
            documentInventory: [],
            evidenceRefs: [],
          },
        },
      ],
      context: {
        identity: {
          orderId: 'order-1',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          subClientId: 'sub-1',
        },
        order: { id: 'order-1' } as any,
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
        assembledAt: '2026-04-29T00:00:00.000Z',
        assembledBy: 'user-1',
        contextVersion: 'review-context:order-1:1',
      },
    }));
    const orchestrate = vi.fn().mockResolvedValue({
      reviewProgramId: 'prog-ready',
      reviewProgramName: 'Ready Program',
      overallStatus: 'partial',
      axiomLegs: [
        { engine: 'AXIOM', programId: 'axiom-ready', programVersion: '1.0', status: 'skipped', error: 'Missing required document types: 1004' },
      ],
      mopLegs: [
        { engine: 'MOP_PRIO', programId: 'mop-ready', programVersion: '1.0', status: 'submitted', runId: 'run-2' },
      ],
    });

    const service = new ReviewDispatchService({} as any, {
      preparedContextService: { getPreparedContext },
      orchestrationService: { orchestrate },
    });

    const result = await service.dispatch(
      {
        preparedContextId: 'prepared-1',
        reviewProgramIds: ['prog-ready'],
        dispatchMode: 'include_partial',
        confirmWarnings: true,
      },
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(orchestrate).toHaveBeenCalledWith(
      'prog-ready',
      expect.objectContaining({
        clientId: 'client-1',
        subClientId: 'sub-1',
        preparedContextId: 'prepared-1',
        preparedEngineDispatches: expect.arrayContaining([
          expect.objectContaining({ engine: 'AXIOM', canDispatch: false }),
          expect.objectContaining({ engine: 'MOP_PRIO', canDispatch: true }),
        ]),
      }),
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(result.submittedPrograms).toHaveLength(1);
    expect(result.skippedPrograms).toHaveLength(0);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'Ready Program dispatched with overall status partial.',
      'Ready Program dispatched only the engine legs that were ready in the prepared context.',
    ]));
  });
});
