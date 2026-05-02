import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewRequirementResolutionService } from '../../src/services/review-requirement-resolution.service.js';
import type { ReviewContext } from '../../src/types/review-context.types.js';
import type { ReviewProgram } from '../../src/types/review-tape.types.js';

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
    reviewPrograms: [],
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

function buildProgram(): ReviewProgram {
  return {
    id: 'prog-1',
    name: 'Hybrid Review',
    version: '1.0',
    programType: 'QC',
    status: 'ACTIVE',
    clientId: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    aiCriteriaRefs: [{ programId: 'axiom-qc', programVersion: '1.0' }],
    rulesetRefs: [{ programId: 'mop-qc', programVersion: '2.0' }],
  } as ReviewProgram;
}

describe('ReviewRequirementResolutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Axiom and MOP program requirements into criterion readiness details', async () => {
    const getCompiledCriteria = vi.fn().mockResolvedValue({
      programId: 'axiom-qc',
      programVersion: '1.0',
      clientId: 'client-1',
      subClientId: 'sub-1',
      criteria: [
        {
          id: 'node-1',
          code: 'PROPERTY_ADDRESS_COMPLETE',
          category: 'property',
          statement: 'Property address complete',
          description: 'Address must be present',
          severity: 'high',
          dataRequirements: [{ path: 'propertyAddress', required: true }],
          documentRequirements: [{ oneOf: ['appraisal'] }],
          evaluation: { type: 'presence-check', parameters: {} },
        },
      ],
      metadata: {
        compiledAt: '2026-04-29T00:00:00.000Z',
        cached: false,
        sourceCanonicals: [{ name: 'axiom-qc', version: '1.0' }],
        criteriaCount: 1,
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

    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: { getCompiledCriteria },
      mopCriteriaService: { getCompiledCriteria: getCompiledMopCriteria },
    });

    const result = await service.resolveProgramRequirements(
      buildProgram(),
      buildContext(),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result).toEqual(
      expect.arrayContaining([
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
          resolvedDocumentTypes: ['appraisal'],
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
    );
  });

  it('returns blocked configuration details when compiled requirements cannot be loaded', async () => {
    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: {
        getCompiledCriteria: vi.fn().mockRejectedValue(new Error('Axiom: program not found')),
      },
      mopCriteriaService: {
        getCompiledCriteria: vi.fn(),
      },
    });

    const result = await service.resolveProgramRequirements(
      {
        ...buildProgram(),
        rulesetRefs: [],
        aiCriteriaRefs: [{ programId: 'missing-program', programVersion: '9.9' }],
      } as ReviewProgram,
      buildContext(),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        engine: 'AXIOM',
        readiness: 'blocked_by_configuration',
        recommendedAction: 'update_review_program_mapping',
        blockingReason: 'Axiom: program not found',
      }),
    ]);
  });

  describe('documentRequirements (AND-of-OR semantics)', () => {
    function buildResponseWithDocReqs(documentRequirements: Array<{ oneOf: string[] }>) {
      return {
        programId: 'axiom-qc',
        programVersion: '1.0',
        clientId: 'client-1',
        subClientId: 'sub-1',
        criteria: [
          {
            id: 'c1',
            code: 'CHECK',
            category: 'cat',
            statement: 'Stmt',
            description: 'Desc',
            severity: 'high' as const,
            dataRequirements: [],
            documentRequirements,
            evaluation: { type: 'presence-check', parameters: {} },
          },
        ],
        metadata: {
          compiledAt: '2026-04-29T00:00:00.000Z',
          cached: false,
          sourceCanonicals: [],
          criteriaCount: 1,
        },
      };
    }

    function programWithoutMop(): ReviewProgram {
      return { ...buildProgram(), rulesetRefs: [] } as ReviewProgram;
    }

    async function resolveOnce(documentRequirements: Array<{ oneOf: string[] }>, contextDocs: Array<{ id: string; documentType: string; name?: string }>) {
      const getCompiledCriteria = vi.fn().mockResolvedValue(buildResponseWithDocReqs(documentRequirements));
      const service = new ReviewRequirementResolutionService({} as any, {
        axiomCriteriaService: { getCompiledCriteria },
        mopCriteriaService: { getCompiledCriteria: vi.fn() },
      });
      const result = await service.resolveProgramRequirements(
        programWithoutMop(),
        buildContext({ documents: contextDocs as any }),
        { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-1', idempotencyKey: 'idem-1' },
      );
      return result[0];
    }

    it('OR group satisfied when ANY ONE acceptable type is present', async () => {
      const r = await resolveOnce(
        [{ oneOf: ['form-1004', 'form-1073', 'form-1025'] }],
        [{ id: 'd1', documentType: 'form-1073' }],
      );
      expect(r?.missingDocumentTypes).toEqual([]);
      expect(r?.resolvedDocumentTypes).toContain('form-1073');
    });

    it('OR group blocked when NONE of the acceptable types are present', async () => {
      const r = await resolveOnce(
        [{ oneOf: ['form-1004', 'form-1073'] }],
        [{ id: 'd1', documentType: 'avm-report' }],
      );
      expect(r?.missingDocumentTypes?.sort()).toEqual(['form-1004', 'form-1073']);
      expect(r?.resolvedDocumentTypes).toEqual([]);
    });

    it('AND across groups: satisfied only when EVERY group has at least one match', async () => {
      const r = await resolveOnce(
        [{ oneOf: ['form-1004'] }, { oneOf: ['title-report'] }],
        [{ id: 'd1', documentType: 'form-1004' }, { id: 'd2', documentType: 'title-report' }],
      );
      expect(r?.missingDocumentTypes).toEqual([]);
      expect(r?.resolvedDocumentTypes?.sort()).toEqual(['form-1004', 'title-report']);
    });

    it('AND across groups: blocked when ONE group is unsatisfied (compound case)', async () => {
      // Compound: (1004 OR 1073) AND avm-report — has 1004 but missing avm
      const r = await resolveOnce(
        [{ oneOf: ['form-1004', 'form-1073'] }, { oneOf: ['avm-report'] }],
        [{ id: 'd1', documentType: 'form-1004' }],
      );
      expect(r?.missingDocumentTypes).toEqual(['avm-report']);
      expect(r?.resolvedDocumentTypes).toEqual(['form-1004']);
    });

    it('empty documentRequirements applies no document gating', async () => {
      const r = await resolveOnce([], []);
      expect(r?.missingDocumentTypes).toEqual([]);
      expect(r?.resolvedDocumentTypes).toEqual([]);
    });
  });

  it('resolves provider data paths when provider data is the best available source', async () => {
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
            id: 'property-type-check',
            label: 'Property type populated',
            description: 'Property type must be available',
            severity: 'LOW',
            weight: 1,
            condition: {
              operator: 'AND',
              rules: [{ field: 'propertyType', op: 'NOT_NULL' }],
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

    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: { getCompiledCriteria: vi.fn() },
      mopCriteriaService: { getCompiledCriteria: getCompiledMopCriteria },
    });

    const result = await service.resolveProgramRequirements(
      {
        ...buildProgram(),
        aiCriteriaRefs: [],
        rulesetRefs: [{ programId: 'mop-qc', programVersion: '2.0' }],
      } as ReviewProgram,
      buildContext({
        latestSnapshot: {
          id: 'snapshot-1',
          createdAt: '2026-04-29T00:00:00.000Z',
          hasNormalizedData: true,
          availableDataPaths: ['providerData.propertyType'],
          availableDataPathsBySource: {
            subjectProperty: [],
            extraction: [],
            providerData: ['providerData.propertyType'],
            provenance: [],
          },
        },
        canonicalData: {
          providerData: { propertyType: 'Condo' },
        },
      }),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        criterionId: 'property-type-check',
        engine: 'MOP_PRIO',
        readiness: 'ready',
        missingDataPaths: [],
        resolvedDataBindings: [
          expect.objectContaining({
            requirementPath: 'propertyType',
            resolvedPath: 'providerData.propertyType',
            sourceType: 'providerData',
          }),
        ],
      }),
    ]);
  });

  // The explicit per-data-requirement category feature was removed when the
  // CompiledCriteriaResponse wire contract was adopted (engine-agnostic shape
  // does not carry comp/adjustment classification). Comp/adjustment routing
  // is now driven by keyword detection on the path itself; that fallback is
  // covered in tests/unit/data-requirement-category.test.ts.

  it('threads competingMatches into resolvedDataBindings when multiple sources have the same path', async () => {
    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: {
        getCompiledCriteria: vi.fn().mockResolvedValue({
          programId: 'axiom-qc',
          programVersion: '1.0',
          clientId: 'client-1',
          subClientId: 'sub-1',
          criteria: [
            {
              id: 'node-amb',
              code: 'PROPERTY_ADDRESS_AMBIGUOUS',
              category: 'property',
              statement: 'Property address sourcing is ambiguous',
              description: '',
              severity: 'high',
              dataRequirements: [{ path: 'propertyAddress', required: true }],
              documentRequirements: [],
              evaluation: { type: 'presence-check', parameters: {} },
            },
          ],
          metadata: {
            compiledAt: '2026-04-29T00:00:00.000Z',
            cached: false,
            sourceCanonicals: [{ name: 'axiom-qc', version: '1.0' }],
            criteriaCount: 1,
          },
        }),
      },
      mopCriteriaService: {
        getCompiledCriteria: vi.fn(),
      },
    });

    const result = await service.resolveProgramRequirements(
      {
        ...buildProgram(),
        rulesetRefs: [],
      } as ReviewProgram,
      buildContext({
        order: { id: 'order-1' } as any,
        latestSnapshot: {
          id: 'snapshot-1',
          createdAt: '2026-04-29T00:00:00.000Z',
          hasNormalizedData: true,
          availableDataPaths: ['subjectProperty.propertyAddress', 'extraction.propertyAddress'],
          availableDataPathsBySource: {
            subjectProperty: ['subjectProperty.propertyAddress'],
            extraction: ['extraction.propertyAddress'],
            providerData: [],
            provenance: [],
          },
        },
      }),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        criterionId: 'PROPERTY_ADDRESS_AMBIGUOUS',
        readiness: 'ready',
        resolvedDataBindings: [
          expect.objectContaining({
            requirementPath: 'propertyAddress',
            resolvedPath: 'subjectProperty.propertyAddress',
            sourceType: 'subjectProperty',
            competingMatches: [
              { sourceType: 'extraction', resolvedPath: 'extraction.propertyAddress' },
            ],
          }),
        ],
      }),
    ]);
  });

  it('marks extraction-backed missing fields as requiring extraction when documents exist but no snapshot has been generated', async () => {
    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: {
        getCompiledCriteria: vi.fn().mockResolvedValue({
          programId: 'axiom-qc',
          programVersion: '1.0',
          clientId: 'client-1',
          subClientId: 'sub-1',
          criteria: [
            {
              id: 'node-5',
              code: 'BORROWER_NAME_PRESENT',
              category: 'borrower',
              statement: 'Borrower name present',
              description: '',
              severity: 'high',
              dataRequirements: [{ path: 'borrowerName', required: true }],
              documentRequirements: [],
              evaluation: { type: 'presence-check', parameters: {} },
            },
          ],
          metadata: {
            compiledAt: '2026-04-29T00:00:00.000Z',
            cached: false,
            sourceCanonicals: [{ name: 'axiom-qc', version: '1.0' }],
            criteriaCount: 1,
          },
        }),
      },
      mopCriteriaService: {
        getCompiledCriteria: vi.fn(),
      },
    });

    const result = await service.resolveProgramRequirements(
      {
        ...buildProgram(),
        rulesetRefs: [],
      } as ReviewProgram,
      buildContext({
        latestSnapshot: undefined,
        runSummary: {
          totalRuns: 0,
          extractionRuns: 0,
          criteriaRuns: 0,
        },
      }),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        criterionId: 'BORROWER_NAME_PRESENT',
        engine: 'AXIOM',
        readiness: 'requires_extraction',
        recommendedAction: 'run_extraction',
        blockingReason: 'Missing required extracted data paths: borrowerName',
      }),
    ]);
  });
});
