import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReviewProgramsRouter } from '../../src/controllers/review-programs.controller.js';
import { ReviewPreparationService } from '../../src/services/review-preparation.service.js';

function buildApp() {
  const reviewPrograms = [
    {
      id: 'prog-ready',
      name: 'Ready Program',
      version: '1.0',
      programType: 'QC',
      status: 'ACTIVE',
      clientId: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      aiCriteriaRefs: [{ programId: 'axiom-ready', programVersion: '1.0' }],
      rulesetRefs: [{ programId: 'mop-ready', programVersion: '1.0' }],
    },
    {
      id: 'prog-blocked',
      name: 'Blocked Program',
      version: '1.0',
      programType: 'QC',
      status: 'ACTIVE',
      clientId: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      aiCriteriaRefs: [{ programId: 'axiom-doc', programVersion: '1.0' }],
    },
  ];

  const queryItems = vi.fn().mockImplementation(async (containerName: string, _query: string, parameters: Array<{ name: string; value: unknown }> = []) => {
    const typeParam = parameters.find((parameter) => parameter.name === '@type')?.value;

    if (containerName === 'documents') {
      return {
        success: true,
        data: [
          {
            id: 'doc-1',
            name: 'Appraisal Report',
            orderId: 'order-1',
            tenantId: 'tenant-1',
            category: 'report',
            documentType: 'appraisal',
            extractionStatus: 'completed',
            uploadedAt: '2026-04-28T23:00:00.000Z',
          },
        ],
      };
    }

    if (containerName === 'property-enrichments') {
      return {
        success: true,
        data: [
          {
            id: 'enrich-1',
            type: 'property-enrichment',
            orderId: 'order-1',
            tenantId: 'tenant-1',
            status: 'completed',
            dataResult: { core: { occupancyType: 'OwnerOccupied' } },
            createdAt: '2026-04-28T22:00:00.000Z',
          },
        ],
      };
    }

    if (containerName === 'aiInsights' && typeParam === 'run-ledger-entry') {
      return {
        success: true,
        data: [
          {
            id: 'run-1',
            type: 'run-ledger-entry',
            runType: 'extraction',
            status: 'completed',
            tenantId: 'tenant-1',
            createdAt: '2026-04-29T00:00:00.000Z',
            updatedAt: '2026-04-29T00:01:00.000Z',
            initiatedBy: 'user-1',
            correlationId: 'corr-1',
            idempotencyKey: 'idem-1',
            engine: 'AXIOM',
            engineVersion: '1.0.0',
            engineRunRef: 'job-1',
            engineRequestRef: 'req-1',
            engineResponseRef: 'res-1',
            engineSelectionMode: 'EXPLICIT',
            canonicalSnapshotId: 'snapshot-1',
            loanPropertyContextId: 'order-1',
          },
        ],
      };
    }

    if (containerName === 'aiInsights' && typeParam === 'canonical-snapshot') {
      return {
        success: true,
        data: [
          {
            id: 'snapshot-1',
            type: 'canonical-snapshot',
            tenantId: 'tenant-1',
            createdAt: '2026-04-29T00:00:30.000Z',
            createdBy: 'user-1',
            status: 'ready',
            sourceRefs: [],
            normalizedDataRef: 'canonical://tenant-1/run-1',
            createdByRunIds: ['run-1'],
            normalizedData: {
              extraction: {
                propertyAddress: '123 Main St',
              },
              subjectProperty: {
                occupancyType: 'OwnerOccupied',
              },
            },
          },
        ],
      };
    }

    return { success: true, data: [] };
  });

  const db = {
    findOrderById: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'order-1',
        clientId: 'client-1',
        loanAmount: 550000,
        propertyAddress: '123 Main St',
        clientInformation: {
          subClientId: 'sub-1',
        },
      },
    }),
    queryItems,
    upsertItem: vi.fn().mockResolvedValue({
      success: true,
      data: {},
    }),
    getReviewProgramsContainer: vi.fn().mockReturnValue({
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: reviewPrograms }),
        }),
      },
    }),
  };

  const prepareService = new ReviewPreparationService(db as any, {
    axiomCriteriaService: {
      getCompiledCriteria: vi.fn().mockImplementation(async (_clientId, _tenantId, programId: string) => {
        if (programId === 'axiom-doc') {
          return {
            criteria: [
              {
                id: 'node-doc',
                nodeId: 'node-doc',
                tier: 'canonical',
                owner: 'platform',
                version: '1.0',
                canonNodeId: 'canon-doc',
                canonPath: 'documents.form',
                taxonomyCategory: 'documents',
                concept: 'FORM_1004_PRESENT',
                title: '1004 form present',
                description: '1004 document must be present',
                evaluation: { mode: 'manual' },
                dataRequirements: [],
                documentRequirements: [{ documentType: '1004', required: true }],
                priority: 'high',
                required: true,
                programId,
                compiledAt: '2026-04-29T00:00:00.000Z',
              },
            ],
            cached: false,
            metadata: {
              programId,
              programVersion: '1.0',
              fullProgramId: `${programId}:1.0`,
              criteriaCount: 1,
              categories: ['documents'],
              compiledAt: '2026-04-29T00:00:00.000Z',
            },
          };
        }

        return {
          criteria: [
            {
              id: 'node-ready',
              nodeId: 'node-ready',
              tier: 'canonical',
              owner: 'platform',
              version: '1.0',
              canonNodeId: 'canon-ready',
              canonPath: 'property.address',
              taxonomyCategory: 'property',
              concept: 'PROPERTY_ADDRESS_COMPLETE',
              title: 'Property address complete',
              description: 'Property address is available',
              evaluation: { mode: 'manual' },
              dataRequirements: [{ path: 'propertyAddress', required: true }],
              documentRequirements: [{ documentType: 'appraisal', required: true }],
              priority: 'high',
              required: true,
              programId,
              compiledAt: '2026-04-29T00:00:00.000Z',
            },
          ],
          cached: false,
          metadata: {
            programId,
            programVersion: '1.0',
            fullProgramId: `${programId}:1.0`,
            criteriaCount: 1,
            categories: ['property'],
            compiledAt: '2026-04-29T00:00:00.000Z',
          },
        };
      }),
    },
    mopCriteriaService: {
      getCompiledCriteria: vi.fn().mockResolvedValue({
        criteria: {
          id: 'canonical-mop-ready-1.0',
          programId: 'mop-ready',
          programVersion: '1.0',
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
          programId: 'mop-ready',
          programVersion: '1.0',
          clientId: 'client-1',
          tenantId: 'tenant-1',
          compiledAt: '2026-04-29T00:00:00.000Z',
          hasClientOverride: false,
        },
      }),
    },
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      tenantId: 'tenant-1',
      id: 'user-1',
    };
    next();
  });
  app.use('/api/review-programs', createReviewProgramsRouter(db as any, {
    preparationFactory: () => prepareService,
  }));

  return app;
}

describe('POST /api/review-programs/prepare integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mixed ready and blocked preparation details with resolved bindings', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/review-programs/prepare')
      .send({
        orderId: 'order-1',
        reviewProgramIds: ['prog-ready', 'prog-blocked'],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.preparedContextId).toEqual(expect.any(String));
    expect(response.body.data.preparedContextVersion).toMatch(/^review-context:order-1:/);
    expect(response.body.data.plannedEngineDispatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engine: 'AXIOM',
          reviewProgramId: 'prog-ready',
          payloadContractType: 'axiom-review-dispatch',
        }),
        expect.objectContaining({
          engine: 'MOP_PRIO',
          reviewProgramId: 'prog-ready',
          payloadContractType: 'mop-prio-review-dispatch',
        }),
      ]),
    );
    expect(response.body.data.programs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewProgramId: 'prog-ready',
          readiness: 'ready',
          canDispatch: true,
          criterionResolutions: expect.arrayContaining([
            expect.objectContaining({
              criterionId: 'PROPERTY_ADDRESS_COMPLETE',
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
        expect.objectContaining({
          reviewProgramId: 'prog-blocked',
          readiness: 'requires_documents',
          canDispatch: false,
          criterionResolutions: expect.arrayContaining([
            expect.objectContaining({
              criterionId: 'FORM_1004_PRESENT',
              missingDocumentTypes: ['1004'],
              readiness: 'requires_documents',
            }),
          ]),
        }),
      ]),
    );
    expect(response.body.data.context.latestSnapshot).toEqual(
      expect.objectContaining({
        id: 'snapshot-1',
        availableDataPathsBySource: expect.objectContaining({
          extraction: expect.arrayContaining(['extraction.propertyAddress']),
        }),
      }),
    );
  });
});
