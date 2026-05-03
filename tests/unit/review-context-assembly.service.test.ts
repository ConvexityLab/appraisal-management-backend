import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewContextAssemblyService } from '../../src/services/review-context-assembly.service.js';
import type { IntakeSourceIdentity } from '../../src/types/intake-source.types.js';
import type { RunLedgerRecord } from '../../src/types/run-ledger.types.js';

function buildRun(overrides: Partial<RunLedgerRecord> = {}): RunLedgerRecord {
  return {
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
    ...overrides,
  };
}

function buildQueryItemsWithSourceIdentity(sourceIdentity: IntakeSourceIdentity) {
  return vi.fn().mockImplementation(async (containerName: string, _query: string, parameters: Array<{ name: string; value: unknown }> = []) => {
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
      return { success: true, data: [] };
    }

    if (containerName === 'reporting') {
      return { success: true, data: [] };
    }

    if (containerName === 'aiInsights' && typeParam === 'run-ledger-entry') {
      return {
        success: true,
        data: [
          buildRun({
            sourceIdentity,
            engagementId: 'eng-1',
            loanPropertyContextId: 'loan-context-1',
          }),
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
            sourceIdentity,
            sourceRefs: [],
            normalizedDataRef: 'canonical://tenant-1/run-1',
            createdByRunIds: ['run-1'],
            normalizedData: {},
          },
        ],
      };
    }

    return { success: true, data: [] };
  });
}

function buildDbWithSourceIdentity(sourceIdentity: IntakeSourceIdentity) {
  const queryItems = buildQueryItemsWithSourceIdentity(sourceIdentity);
  const fetchAll = vi.fn().mockResolvedValue({ resources: [] });

  return {
    findOrderById: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'order-1',
        clientId: 'client-1',
        engagementId: 'eng-1',
        metadata: {
          sourceIdentity,
        },
        clientInformation: {
          subClientId: 'sub-1',
        },
      },
    }),
    queryItems,
    getReviewProgramsContainer: vi.fn().mockReturnValue({
      items: {
        query: vi.fn().mockReturnValue({ fetchAll }),
      },
    }),
  };
}

function projectSharedIdentityContract(context: Awaited<ReturnType<ReviewContextAssemblyService['assemble']>>) {
  return {
    orderId: context.identity.orderId,
    engagementId: context.identity.engagementId,
    clientId: context.identity.clientId,
    subClientId: context.identity.subClientId,
    sourceOrderId: context.identity.sourceIdentity?.orderId,
    sourceEngagementId: context.identity.sourceIdentity?.engagementId,
    sourceLoanPropertyContextId: context.identity.sourceIdentity?.loanPropertyContextId,
    snapshotSourceOrderId: context.latestSnapshot?.sourceIdentity?.orderId,
    runSourceOrderId: context.runs[0]?.sourceIdentity?.orderId,
  };
}

describe('ReviewContextAssemblyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces document query failures instead of silently downgrading to empty context', async () => {
    const fetchAll = vi.fn().mockResolvedValue({ resources: [] });
    const db = {
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          clientId: 'client-1',
          engagementId: 'eng-1',
          clientInformation: { subClientId: 'sub-1' },
        },
      }),
      queryItems: vi.fn().mockImplementation(async (containerName: string) => {
        if (containerName === 'documents') {
          return {
            success: false,
            error: { message: 'cosmos unavailable' },
          };
        }

        return { success: true, data: [] };
      }),
      getReviewProgramsContainer: vi.fn().mockReturnValue({
        items: {
          query: vi.fn().mockReturnValue({ fetchAll }),
        },
      }),
    };

    const service = new ReviewContextAssemblyService(db as any);

    await expect(
      service.assemble(
        {
          orderId: 'order-1',
          reviewProgramIds: [],
        },
        {
          tenantId: 'tenant-1',
          initiatedBy: 'user-1',
        } as any,
      ),
    ).rejects.toThrow("Failed to load review-context documents for order 'order-1' and tenant 'tenant-1': cosmos unavailable");
  });

  it('assembles order, documents, runs, and latest snapshot context', async () => {
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
              entityType: 'order-intake-draft',
              entityId: 'draft-123',
              orderLinkedAt: '2026-04-29T00:00:15.000Z',
              orderLinkedBy: 'user-1',
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
              dataResult: { core: { yearBuilt: 1999 } },
              createdAt: '2026-04-28T22:00:00.000Z',
            },
          ],
        };
      }

      if (containerName === 'reporting') {
        return {
          success: true,
          data: [
            {
              id: 'report-1',
              reportId: 'report-1',
              orderId: 'order-1',
              reportType: '1004',
              status: 'draft',
              schemaVersion: '1.1.0',
              updatedAt: '2026-04-29T00:00:10.000Z',
              metadata: {},
              subject: { grossLivingArea: 2000 },
              comps: [
                {
                  compId: 'comp-1',
                  selected: true,
                  slotIndex: 1,
                  adjustments: {
                    netAdjustmentTotal: 10000,
                    grossAdjustmentTotal: 20000,
                    adjustedSalePrice: 410000,
                    netAdjustmentPct: 2.5,
                    grossAdjustmentPct: 5,
                  },
                },
                {
                  compId: 'comp-2',
                  selected: false,
                  slotIndex: null,
                  adjustments: null,
                },
              ],
              valuation: null,
            },
          ],
        };
      }

      if (containerName === 'aiInsights' && typeParam === 'run-ledger-entry') {
        return {
          success: true,
          data: [buildRun()],
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
                  comparables: [{ saleDate: '2026-01-01' }],
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

    const fetchAll = vi.fn().mockResolvedValue({
      resources: [
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
    });

    const db = {
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          clientId: 'client-1',
          engagementId: 'eng-1',
          metadata: {
            sourceIdentity: {
              sourceKind: 'manual-draft',
              intakeDraftId: 'draft-123',
              sourceArtifactRefs: [
                {
                  artifactType: 'order-intake-draft',
                  artifactId: 'draft-123',
                },
              ],
            },
          },
          clientInformation: {
            subClientId: 'sub-1',
          },
        },
      }),
      queryItems,
      getReviewProgramsContainer: vi.fn().mockReturnValue({
        items: {
          query: vi.fn().mockReturnValue({ fetchAll }),
        },
      }),
    };

    const service = new ReviewContextAssemblyService(db as any);
    const context = await service.assemble(
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

    expect(context.identity).toEqual({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      engagementId: 'eng-1',
      clientId: 'client-1',
      subClientId: 'sub-1',
      sourceIdentity: {
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-123',
        sourceArtifactRefs: [
          {
            artifactType: 'order-intake-draft',
            artifactId: 'draft-123',
          },
        ],
      },
    });
    expect(context.documents).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        documentType: 'appraisal',
        originEntityType: 'order-intake-draft',
        originEntityId: 'draft-123',
        orderLinkedBy: 'user-1',
      }),
    ]);
    expect(context.latestSnapshot).toEqual(
      expect.objectContaining({
        id: 'snapshot-1',
        hasNormalizedData: true,
        availableDataPaths: expect.arrayContaining(['propertyAddress', 'comparables.saleDate', 'occupancyType']),
        availableDataPathsBySource: expect.objectContaining({
          extraction: expect.arrayContaining(['extraction.propertyAddress', 'extraction.comparables.saleDate']),
          subjectProperty: expect.arrayContaining(['subjectProperty.occupancyType']),
        }),
      }),
    );
    expect(context.runSummary.latestSnapshotId).toBe('snapshot-1');
    expect(context.reviewPrograms).toHaveLength(1);
    expect(context.latestReport).toEqual(
      expect.objectContaining({
        reportId: 'report-1',
        totalComps: 2,
        selectedCompCount: 1,
        adjustedCompCount: 1,
      }),
    );
    expect(context.compSummary).toEqual(
      expect.objectContaining({
        totalComps: 2,
        selectedCompIds: ['comp-1'],
        compIdsWithAdjustments: ['comp-1'],
        hasCompSelection: true,
        hasAdjustments: true,
      }),
    );
    expect(context.adjustmentSummary).toEqual(
      expect.objectContaining({
        adjustedCompCount: 1,
        maxGrossAdjustmentPct: 5,
        averageNetAdjustmentPct: 2.5,
      }),
    );
    expect(context.evidenceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'report', sourceId: 'report-1' }),
        expect.objectContaining({ sourceType: 'report-comp', sourceId: 'comp-1' }),
        expect.objectContaining({ sourceType: 'report-adjustment', sourceId: 'comp-1-adjustments' }),
      ]),
    );
    expect(context.warnings).toEqual([]);
  });

  it('converges manual and bulk orders to the same shared context identity contract', async () => {
    const manualSourceIdentity: IntakeSourceIdentity = {
      sourceKind: 'manual-draft',
      intakeDraftId: 'draft-123',
      orderId: 'order-1',
      engagementId: 'eng-1',
      loanPropertyContextId: 'loan-context-1',
      sourceArtifactRefs: [
        { artifactType: 'order-intake-draft', artifactId: 'draft-123' },
        { artifactType: 'order', artifactId: 'order-1' },
      ],
    };
    const bulkSourceIdentity: IntakeSourceIdentity = {
      sourceKind: 'bulk-item',
      bulkJobId: 'bulk-job-7',
      bulkItemId: 'bulk-item-9',
      orderId: 'order-1',
      engagementId: 'eng-1',
      loanPropertyContextId: 'loan-context-1',
      sourceArtifactRefs: [
        { artifactType: 'bulk-ingestion-job', artifactId: 'bulk-job-7' },
        { artifactType: 'bulk-ingestion-item', artifactId: 'bulk-item-9' },
        { artifactType: 'order', artifactId: 'order-1' },
      ],
    };

    const manualService = new ReviewContextAssemblyService(buildDbWithSourceIdentity(manualSourceIdentity) as any);
    const bulkService = new ReviewContextAssemblyService(buildDbWithSourceIdentity(bulkSourceIdentity) as any);

    const [manualContext, bulkContext] = await Promise.all([
      manualService.assemble(
        { orderId: 'order-1', reviewProgramIds: [] },
        { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-manual', idempotencyKey: 'idem-manual' },
      ),
      bulkService.assemble(
        { orderId: 'order-1', reviewProgramIds: [] },
        { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-bulk', idempotencyKey: 'idem-bulk' },
      ),
    ]);

    expect(projectSharedIdentityContract(manualContext)).toEqual(projectSharedIdentityContract(bulkContext));
    expect(manualContext.identity.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-123',
        orderId: 'order-1',
        engagementId: 'eng-1',
        loanPropertyContextId: 'loan-context-1',
      }),
    );
    expect(bulkContext.identity.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'bulk-item',
        bulkJobId: 'bulk-job-7',
        bulkItemId: 'bulk-item-9',
        orderId: 'order-1',
        engagementId: 'eng-1',
        loanPropertyContextId: 'loan-context-1',
      }),
    );
    expect(manualContext.latestSnapshot?.sourceIdentity).toEqual(expect.objectContaining({ sourceKind: 'manual-draft' }));
    expect(bulkContext.latestSnapshot?.sourceIdentity).toEqual(expect.objectContaining({ sourceKind: 'bulk-item' }));
    expect(manualContext.runs[0]?.sourceIdentity).toEqual(expect.objectContaining({ sourceKind: 'manual-draft' }));
    expect(bulkContext.runs[0]?.sourceIdentity).toEqual(expect.objectContaining({ sourceKind: 'bulk-item' }));
  });

  it('preserves bulk row canonical identity through shared review context assembly', async () => {
    const bulkCanonicalSourceIdentity: IntakeSourceIdentity = {
      sourceKind: 'bulk-item',
      bulkJobId: 'bulk-job-42',
      bulkItemId: 'bulk-item-42',
      orderId: 'order-1',
      engagementId: 'eng-1',
      loanPropertyContextId: 'loan-context-1',
      sourceArtifactRefs: [
        { artifactType: 'bulk-ingestion-job', artifactId: 'bulk-job-42' },
        { artifactType: 'bulk-ingestion-item', artifactId: 'bulk-item-42' },
        { artifactType: 'order', artifactId: 'order-1' },
      ],
    };

    const service = new ReviewContextAssemblyService(buildDbWithSourceIdentity(bulkCanonicalSourceIdentity) as any);

    const context = await service.assemble(
      { orderId: 'order-1', reviewProgramIds: [] },
      { tenantId: 'tenant-1', initiatedBy: 'user-1', correlationId: 'corr-bulk-canonical', idempotencyKey: 'idem-bulk-canonical' },
    );

    expect(context.identity.sourceIdentity).toEqual(bulkCanonicalSourceIdentity);
    expect(context.latestSnapshot?.sourceIdentity).toEqual(bulkCanonicalSourceIdentity);
    expect(context.runs[0]?.sourceIdentity).toEqual(bulkCanonicalSourceIdentity);
    expect(context.identity.sourceIdentity?.sourceArtifactRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifactType: 'bulk-ingestion-job', artifactId: 'bulk-job-42' }),
        expect.objectContaining({ artifactType: 'bulk-ingestion-item', artifactId: 'bulk-item-42' }),
        expect.objectContaining({ artifactType: 'order', artifactId: 'order-1' }),
      ]),
    );
  });
});
