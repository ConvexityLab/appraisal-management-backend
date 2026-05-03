import { describe, expect, it } from 'vitest';
import { PreparedDispatchPayloadAssemblyService } from '../../src/services/prepared-dispatch-payload-assembly.service.js';
import type { ReviewContext } from '../../src/types/review-context.types.js';
import type { CriterionResolution, PreparedDocumentInventoryItem } from '../../src/types/review-preparation.types.js';

function buildContext(): ReviewContext {
  return {
    identity: {
      orderId: 'order-1',
      tenantId: 'tenant-1',
    },
    order: {
      id: 'order-1',
      loanAmount: 550000,
      occupancyType: 'OwnerOccupied',
    } as any,
    canonicalData: {
      extraction: {
        propertyAddress: '123 Main St',
      },
      providerData: {
        propertyType: 'Condo',
      },
      provenance: {
        sourceSystem: 'provider-feed',
      },
    },
    reviewPrograms: [],
    documents: [],
    runs: [],
    runSummary: {
      totalRuns: 1,
      extractionRuns: 1,
      criteriaRuns: 0,
      latestSnapshotId: 'snapshot-1',
    },
    evidenceRefs: [
      { sourceType: 'property-enrichment', sourceId: 'provider-1' },
      { sourceType: 'document-extraction', sourceId: 'extract-1' },
    ],
    warnings: [],
    assembledAt: '2026-04-30T00:00:00.000Z',
    assembledBy: 'user-1',
    contextVersion: 'review-context:order-1:1',
  };
}

describe('PreparedDispatchPayloadAssemblyService', () => {
  it('builds unmet-input and provenance summaries for prepared dispatch payloads', () => {
    const service = new PreparedDispatchPayloadAssemblyService();
    const criteria: CriterionResolution[] = [
      {
        criterionId: 'crit-provider',
        criterionTitle: 'Provider data criterion',
        engine: 'MOP_PRIO',
        readiness: 'ready',
        resolvedDataBindings: [
          {
            requirementPath: 'propertyType',
            resolvedPath: 'providerData.propertyType',
            sourceType: 'providerData',
          },
          {
            requirementPath: 'propertyAddress',
            resolvedPath: 'extraction.propertyAddress',
            sourceType: 'extraction',
          },
        ],
        requiredDataPaths: ['propertyType', 'propertyAddress'],
        missingDataPaths: [],
        resolvedDocumentTypes: ['appraisal'],
        requiredDocumentTypes: ['appraisal'],
        missingDocumentTypes: [],
        warnings: [],
      },
      {
        criterionId: 'crit-missing',
        criterionTitle: 'Missing input criterion',
        engine: 'AXIOM',
        readiness: 'requires_manual_resolution',
        blockingReason: 'Missing required data paths: occupancyType',
        recommendedAction: 'resolve_source_conflict',
        resolvedDataBindings: [],
        requiredDataPaths: ['occupancyType'],
        missingDataPaths: ['occupancyType'],
        resolvedDocumentTypes: [],
        requiredDocumentTypes: ['1004'],
        missingDocumentTypes: ['1004'],
        warnings: [],
      },
    ];
    const documentInventory: PreparedDocumentInventoryItem[] = [
      {
        documentId: 'doc-1',
        name: 'Appraisal Report',
        documentType: 'appraisal',
      },
    ];

    const result = service.buildDispatchPayloadData(criteria, buildContext(), documentInventory, 'snapshot-1');

    expect(result.criteriaSummary).toEqual({
      totalCriteria: 2,
      readyCriteriaCount: 1,
      warningCriteriaCount: 0,
      blockedCriteriaCount: 1,
      criteriaWithUnmetRequiredInputsCount: 1,
    });
    expect(result.unmetRequiredInputs).toEqual([
      expect.objectContaining({
        criterionId: 'crit-missing',
        inputType: 'data',
        requirement: 'occupancyType',
      }),
      expect.objectContaining({
        criterionId: 'crit-missing',
        inputType: 'document',
        requirement: '1004',
      }),
    ]);
    expect(result.provenanceSummary).toEqual(expect.objectContaining({
      sourceTypesUsed: expect.arrayContaining(['providerData', 'extraction']),
      matchedDocumentIds: ['doc-1'],
      matchedDocumentTypes: ['appraisal'],
      evidenceSourceTypes: expect.arrayContaining(['property-enrichment', 'document-extraction']),
      snapshotLinked: true,
      snapshotId: 'snapshot-1',
      resolvedBindingsBySource: expect.objectContaining({
        providerData: [
          expect.objectContaining({
            requirementPath: 'propertyType',
            resolvedPath: 'providerData.propertyType',
          }),
        ],
        extraction: [
          expect.objectContaining({
            requirementPath: 'propertyAddress',
            resolvedPath: 'extraction.propertyAddress',
          }),
        ],
      }),
    }));
    expect(result.criteria[1]?.unmetRequiredInputs).toHaveLength(2);
  });
});