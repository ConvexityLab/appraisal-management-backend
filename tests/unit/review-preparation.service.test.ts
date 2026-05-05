import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPreparationService } from '../../src/services/review-preparation.service.js';
import type { ReviewContext } from '../../src/types/review-context.types.js';

function buildContext(overrides: Partial<ReviewContext> = {}): ReviewContext {
  return {
    identity: {
      orderId: 'order-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      subClientId: 'sub-1',
    },
    order: {
      id: 'order-1',
      loanAmount: 550000,
      propertyAddress: '123 Main St',
      occupancyType: 'OwnerOccupied',
    } as any,
    reviewPrograms: [
      {
        id: 'prog-1',
        name: 'Hybrid Review',
        version: '1.0',
        programType: 'QC',
        status: 'ACTIVE',
        clientId: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        aiCriteriaRefs: [{ programId: 'axiom-qc', programVersion: '1.0' }],
        rulesetRefs: [{ programId: 'mop-qc', programVersion: '2.0' }],
      },
    ],
    documents: [
      {
        id: 'doc-1',
        name: 'Appraisal Report',
        documentType: 'appraisal',
      },
    ],
    latestSnapshot: {
      id: 'snapshot-1',
      createdAt: '2026-04-29T00:00:00.000Z',
      hasNormalizedData: true,
      availableDataPaths: ['propertyAddress', 'loanAmount', 'occupancyType'],
      availableDataPathsBySource: {
        subjectProperty: ['subjectProperty.occupancyType'],
        extraction: ['extraction.propertyAddress'],
        providerData: [],
        provenance: [],
      },
    },
    latestEnrichment: {
      id: 'enrich-1',
      hasDataResult: true,
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
    ...overrides,
  };
}

describe('ReviewPreparationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Axiom and MOP requirements into criterion resolutions', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext());
    const getCompiledCriteria = vi.fn().mockResolvedValue({
      criteria: [
        {
          id: 'node-1',
          nodeId: 'node-1',
          tier: 'canonical',
          owner: 'platform',
          version: '1.0',
          canonNodeId: 'canon-1',
          canonPath: 'property.address',
          taxonomyCategory: 'property',
          code: 'PROPERTY_ADDRESS_COMPLETE',
          concept: 'PROPERTY_ADDRESS_COMPLETE',
          title: 'Property address complete',
          description: 'Address must be present',
          evaluation: { mode: 'manual' },
          dataRequirements: [{ path: 'propertyAddress', required: true }],
          documentRequirements: [{ documentType: 'appraisal', required: true }],
          priority: 'high',
          required: true,
          programId: 'axiom-qc',
          compiledAt: '2026-04-29T00:00:00.000Z',
        },
      ],
      cached: false,
      metadata: {
        programId: 'axiom-qc',
        programVersion: '1.0',
        fullProgramId: 'axiom-qc:1.0',
        criteriaCount: 1,
        categories: ['property'],
        compiledAt: '2026-04-29T00:00:00.000Z',
      },
    });
    const getCompiledMopCriteria = vi.fn().mockResolvedValue({
      criteria: {
        id: 'canonical-mop-qc-2.0',
        programId: 'mop-qc',
        programVersion: '2.0',
        tier: 'canonical',
        clientId: null,
        status: 'ACTIVE',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
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
        autoFlags: [
          {
            id: 'loan-amount-check',
            label: 'Loan amount populated',
            description: 'Loan amount must be available',
            severity: 'LOW',
            weight: 1,
            condition: {
              operator: 'AND',
              rules: [{ field: 'loanAmount', op: 'NOT_NULL' }],
            },
          },
        ],
        manualFlags: [],
        decisionRules: {
          reject: { minScore: 70 },
          conditional: { minScore: 40 },
          accept: { maxScore: 39 },
        },
      },
      cached: false,
      metadata: {
        programId: 'mop-qc',
        programVersion: '2.0',
        clientId: 'client-1',
        tenantId: 'tenant-1',
        compiledAt: '2026-04-29T00:00:00.000Z',
        hasClientOverride: false,
      },
    });

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: getCompiledMopCriteria },
    });

    const result = await service.prepare(
      {
        orderId: 'order-1',
        reviewProgramIds: ['prog-1'],
      },
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toEqual(
      expect.objectContaining({
        readiness: 'ready',
        canDispatch: true,
        criterionResolutions: expect.arrayContaining([
          expect.objectContaining({
            criterionId: 'PROPERTY_ADDRESS_COMPLETE',
            engine: 'AXIOM',
            readiness: 'ready',
            missingDataPaths: [],
            missingDocumentTypes: [],
            resolvedDataBindings: expect.arrayContaining([
              expect.objectContaining({
                requirementPath: 'propertyAddress',
                resolvedPath: 'extraction.propertyAddress',
                sourceType: 'extraction',
              }),
            ]),
          }),
          expect.objectContaining({
            criterionId: 'loan-amount-check',
            engine: 'MOP_PRIO',
            readiness: 'ready',
            missingDataPaths: [],
            resolvedDataBindings: expect.arrayContaining([
              expect.objectContaining({
                requirementPath: 'loanAmount',
                resolvedPath: 'order.loanAmount',
                sourceType: 'order',
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('returns blocked criterion resolution when engine requirements cannot be compiled', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext({
      identity: {
        orderId: 'order-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        subClientId: 'sub-1',
      },
      reviewPrograms: [
        {
          id: 'prog-1',
          name: 'Axiom Only',
          version: '1.0',
          programType: 'QC',
          status: 'ACTIVE',
          clientId: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          aiCriteriaRefs: [{ programId: 'missing-program', programVersion: '9.9' }],
          rulesetRefs: [],
        },
      ],
    }));

    const getCompiledCriteria = vi.fn().mockRejectedValue(new Error('Axiom: program not found'));

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: vi.fn() },
    });

    const result = await service.prepare(
      {
        orderId: 'order-1',
        reviewProgramIds: ['prog-1'],
      },
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result.programs[0].readiness).toBe('blocked_by_configuration');
    expect(result.programs[0].canDispatch).toBe(false);
    expect(result.programs[0].criterionResolutions).toEqual([
      expect.objectContaining({
        engine: 'AXIOM',
        readiness: 'blocked_by_configuration',
        recommendedAction: 'update_review_program_mapping',
        blockingReason: 'Axiom: program not found',
      }),
    ]);
  });

  it('marks comp-driven requirements as requiring comp selection when no selected comps exist', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext({
      latestReport: {
        reportId: 'report-1',
        subjectPresent: true,
        totalComps: 2,
        selectedCompCount: 0,
        adjustedCompCount: 0,
      },
      compSummary: {
        totalComps: 2,
        selectedCompCount: 0,
        candidateCompCount: 2,
        adjustedCompCount: 0,
        selectedCompIds: [],
        compIdsWithAdjustments: [],
        hasCompSelection: false,
        hasAdjustments: false,
      },
    }));

    const getCompiledCriteria = vi.fn().mockResolvedValue({
      criteria: [
        {
          id: 'node-2',
          nodeId: 'node-2',
          code: 'COMPARABLE_SUPPORT_PRESENT',
          concept: 'COMPARABLE_SUPPORT_PRESENT',
          title: 'Comparable support present',
          dataRequirements: [{ path: 'comparables.selected', required: true }],
          documentRequirements: [],
        },
      ],
      cached: false,
      metadata: {
        programId: 'axiom-qc',
        programVersion: '1.0',
        fullProgramId: 'axiom-qc:1.0',
        criteriaCount: 1,
        categories: ['comparables'],
        compiledAt: '2026-04-29T00:00:00.000Z',
      },
    });

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: vi.fn().mockResolvedValue({ criteria: { autoFlags: [], manualFlags: [] }, metadata: { programId: 'mop-qc', programVersion: '2.0', clientId: 'client-1', tenantId: 'tenant-1', compiledAt: '2026-04-29T00:00:00.000Z', hasClientOverride: false } }) },
    });

    const result = await service.prepare(
      { orderId: 'order-1', reviewProgramIds: ['prog-1'] },
      { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-1', idempotencyKey: 'idem-1' },
    );

    expect(result.programs[0]).toEqual(expect.objectContaining({
      readiness: 'requires_comp_selection',
      canDispatch: false,
      recommendedActions: expect.arrayContaining(['select_comps']),
      blockers: expect.arrayContaining([
        expect.stringContaining('Comparable selection is required'),
      ]),
    }));
    expect(result.programs[0].criterionResolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterionId: 'COMPARABLE_SUPPORT_PRESENT',
        readiness: 'requires_comp_selection',
        recommendedAction: 'select_comps',
      }),
    ]));
  });

  it('marks adjustment-driven requirements as requiring comp selection when adjustments are missing', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext({
      latestReport: {
        reportId: 'report-1',
        subjectPresent: true,
        totalComps: 2,
        selectedCompCount: 2,
        adjustedCompCount: 0,
      },
      compSummary: {
        totalComps: 2,
        selectedCompCount: 2,
        candidateCompCount: 0,
        adjustedCompCount: 0,
        selectedCompIds: ['comp-1', 'comp-2'],
        compIdsWithAdjustments: [],
        hasCompSelection: true,
        hasAdjustments: false,
      },
    }));

    const getCompiledCriteria = vi.fn().mockResolvedValue({
      criteria: [
        {
          id: 'node-3',
          nodeId: 'node-3',
          code: 'GROSS_ADJUSTMENT_SUPPORT',
          concept: 'GROSS_ADJUSTMENT_SUPPORT',
          title: 'Gross adjustment support',
          dataRequirements: [{ path: 'comparables.adjustments.grossAdjustmentPct', required: true }],
          documentRequirements: [],
        },
      ],
      cached: false,
      metadata: {
        programId: 'axiom-qc',
        programVersion: '1.0',
        fullProgramId: 'axiom-qc:1.0',
        criteriaCount: 1,
        categories: ['comparables'],
        compiledAt: '2026-04-29T00:00:00.000Z',
      },
    });

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: vi.fn().mockResolvedValue({ criteria: { autoFlags: [], manualFlags: [] }, metadata: { programId: 'mop-qc', programVersion: '2.0', clientId: 'client-1', tenantId: 'tenant-1', compiledAt: '2026-04-29T00:00:00.000Z', hasClientOverride: false } }) },
    });

    const result = await service.prepare(
      { orderId: 'order-1', reviewProgramIds: ['prog-1'] },
      { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-1', idempotencyKey: 'idem-1' },
    );

    expect(result.programs[0].criterionResolutions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterionId: 'GROSS_ADJUSTMENT_SUPPORT',
        readiness: 'requires_comp_selection',
        blockingReason: expect.stringContaining('Comparable adjustments are required'),
      }),
    ]));
  });

  it('keeps Axiom-only programs dispatchable without a snapshot when canonical order data satisfies requirements', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext({
      reviewPrograms: [
        {
          id: 'prog-axiom',
          name: 'Axiom Only',
          version: '1.0',
          programType: 'QC',
          status: 'ACTIVE',
          clientId: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          aiCriteriaRefs: [{ programId: 'axiom-qc', programVersion: '1.0' }],
          rulesetRefs: [],
        },
      ],
      latestSnapshot: undefined,
      runSummary: {
        totalRuns: 0,
        extractionRuns: 0,
        criteriaRuns: 0,
      },
    }));

    const getCompiledCriteria = vi.fn().mockResolvedValue({
      criteria: [
        {
          id: 'node-4',
          nodeId: 'node-4',
          concept: 'LOAN_AMOUNT_PRESENT',
          title: 'Loan amount present',
          dataRequirements: [{ path: 'loanAmount', required: true }],
          documentRequirements: [],
        },
      ],
      cached: false,
      metadata: {
        programId: 'axiom-qc',
        programVersion: '1.0',
        fullProgramId: 'axiom-qc:1.0',
        criteriaCount: 1,
        categories: ['loan'],
        compiledAt: '2026-04-29T00:00:00.000Z',
      },
    });

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: vi.fn() },
    });

    const result = await service.prepare(
      { orderId: 'order-1', reviewProgramIds: ['prog-axiom'] },
      { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-1', idempotencyKey: 'idem-1' },
    );

    expect(result.programs[0]).toEqual(expect.objectContaining({
      reviewProgramId: 'prog-axiom',
      readiness: 'ready_with_warnings',
      canDispatch: true,
      warnings: expect.arrayContaining(['No extraction snapshot exists yet.']),
    }));
  });

  it('marks programs as partially ready when some criteria are ready and others remain blocked', async () => {
    const assemble = vi.fn().mockResolvedValue(buildContext({
      reviewPrograms: [
        {
          id: 'prog-partial',
          name: 'Partial Review',
          version: '1.0',
          programType: 'QC',
          status: 'ACTIVE',
          clientId: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          aiCriteriaRefs: [{ programId: 'axiom-qc', programVersion: '1.0' }],
          rulesetRefs: [],
        },
      ],
    }));
    const resolveProgramRequirements = vi.fn().mockResolvedValue([
      {
        criterionId: 'ready-criterion',
        criterionTitle: 'Ready criterion',
        engine: 'AXIOM',
        readiness: 'ready',
        resolvedDataBindings: [],
        requiredDataPaths: [],
        missingDataPaths: [],
        resolvedDocumentTypes: [],
        requiredDocumentTypes: [],
        missingDocumentTypes: [],
        warnings: [],
      },
      {
        criterionId: 'blocked-criterion',
        criterionTitle: 'Blocked criterion',
        engine: 'AXIOM',
        readiness: 'requires_manual_resolution',
        blockingReason: 'Missing required data paths: borrowerName',
        recommendedAction: 'resolve_source_conflict',
        resolvedDataBindings: [],
        requiredDataPaths: ['borrowerName'],
        missingDataPaths: ['borrowerName'],
        resolvedDocumentTypes: [],
        requiredDocumentTypes: [],
        missingDocumentTypes: [],
        warnings: [],
      },
    ]);

    const service = new ReviewPreparationService({} as any, {
      assemblyService: { assemble },
      requirementResolutionService: { resolveProgramRequirements },
    });

    const result = await service.prepare(
      { orderId: 'order-1', reviewProgramIds: ['prog-partial'] },
      { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-1', idempotencyKey: 'idem-1' },
    );

    expect(result.programs[0]).toEqual(expect.objectContaining({
      reviewProgramId: 'prog-partial',
      readiness: 'partially_ready',
      canDispatch: false,
      blockers: expect.arrayContaining(['Blocked criterion: Missing required data paths: borrowerName']),
      recommendedActions: expect.arrayContaining(['resolve_source_conflict']),
    }));
  });
});
