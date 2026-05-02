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

  it('uses the explicit dataRequirement category to classify comp / adjustment paths instead of keyword guessing', async () => {
    // Three criteria:
    //   1. Path "comparables.something" but category 'standard' → must NOT be classified as comp
    //      (keyword matching alone would misclassify this).
    //   2. Path with no comp-ish keyword but category 'comp' → must be classified as comp.
    //   3. Path with no adjustment keyword but category 'adjustment' → must be classified as adjustment.
    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: {
        getCompiledCriteria: vi.fn().mockResolvedValue({
          criteria: [
            {
              id: 'node-misnamed',
              nodeId: 'node-misnamed',
              concept: 'STANDARD_FIELD_WITH_COMP_LIKE_NAME',
              title: 'Path looks comp-y but is standard',
              dataRequirements: [
                { path: 'comparables.placeholderField', required: true, category: 'standard' },
              ],
              documentRequirements: [],
            },
            {
              id: 'node-comp-explicit',
              nodeId: 'node-comp-explicit',
              concept: 'EXPLICIT_COMP_REQUIREMENT',
              title: 'Explicit comp via category',
              dataRequirements: [
                { path: 'subjectProperty.unrelatedKey', required: true, category: 'comp' },
              ],
              documentRequirements: [],
            },
            {
              id: 'node-adj-explicit',
              nodeId: 'node-adj-explicit',
              concept: 'EXPLICIT_ADJUSTMENT_REQUIREMENT',
              title: 'Explicit adjustment via category',
              dataRequirements: [
                { path: 'subjectProperty.unrelatedAdjustmentKey', required: true, category: 'adjustment' },
              ],
              documentRequirements: [],
            },
          ],
          cached: false,
          metadata: {
            programId: 'axiom-qc',
            programVersion: '1.0',
            fullProgramId: 'axiom-qc:1.0',
            criteriaCount: 3,
            categories: ['property'],
            compiledAt: '2026-04-29T00:00:00.000Z',
          },
        }),
      },
      mopCriteriaService: { getCompiledCriteria: vi.fn() },
    });

    const result = await service.resolveProgramRequirements(
      { ...buildProgram(), rulesetRefs: [] } as ReviewProgram,
      buildContext({
        order: { id: 'order-1' } as any,
        documents: [],
        latestSnapshot: undefined,
        runSummary: { totalRuns: 0, extractionRuns: 0, criteriaRuns: 0 },
      }),
      {
        tenantId: 'tenant-1',
        initiatedBy: 'user-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
      },
    );

    const byCriterion = new Map(result.map((r) => [r.criterionId, r]));

    // 1. Path looked comp-y but explicit category 'standard' must NOT trigger
    //    requires_comp_selection — should fall through to other resolution
    //    states (here: requires_manual_resolution since there's no snapshot
    //    or document to back the path).
    expect(byCriterion.get('STANDARD_FIELD_WITH_COMP_LIKE_NAME')?.readiness).not.toBe('requires_comp_selection');
    expect(byCriterion.get('STANDARD_FIELD_WITH_COMP_LIKE_NAME')?.recommendedAction).not.toBe('select_comps');

    // 2. Explicit category 'comp' must trigger requires_comp_selection even
    //    though the path itself contains no comp keyword.
    expect(byCriterion.get('EXPLICIT_COMP_REQUIREMENT')).toMatchObject({
      readiness: 'requires_comp_selection',
      recommendedAction: 'select_comps',
    });

    // 3. Explicit category 'adjustment' must drive comp/adjustment guidance
    //    (also routes through buildCompRequirementBlock).
    expect(byCriterion.get('EXPLICIT_ADJUSTMENT_REQUIREMENT')?.readiness).toBe('requires_comp_selection');
  });

  it('threads competingMatches into resolvedDataBindings when multiple sources have the same path', async () => {
    const service = new ReviewRequirementResolutionService({} as any, {
      axiomCriteriaService: {
        getCompiledCriteria: vi.fn().mockResolvedValue({
          criteria: [
            {
              id: 'node-amb',
              nodeId: 'node-amb',
              concept: 'PROPERTY_ADDRESS_AMBIGUOUS',
              title: 'Property address sourcing is ambiguous',
              dataRequirements: [{ path: 'propertyAddress', required: true }],
              documentRequirements: [],
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
          criteria: [
            {
              id: 'node-5',
              nodeId: 'node-5',
              concept: 'BORROWER_NAME_PRESENT',
              title: 'Borrower name present',
              dataRequirements: [{ path: 'borrowerName', required: true }],
              documentRequirements: [],
            },
          ],
          cached: false,
          metadata: {
            programId: 'axiom-qc',
            programVersion: '1.0',
            fullProgramId: 'axiom-qc:1.0',
            criteriaCount: 1,
            categories: ['borrower'],
            compiledAt: '2026-04-29T00:00:00.000Z',
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
