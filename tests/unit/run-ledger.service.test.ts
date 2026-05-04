import { describe, expect, it, vi } from 'vitest';
import { RunLedgerService } from '../../src/services/run-ledger.service.js';

describe('RunLedgerService source identity propagation', () => {
  it('persists source identity on extraction and criteria runs', async () => {
    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const queryItems = vi.fn().mockResolvedValue({ success: true, data: [] });
    const service = new RunLedgerService({ queryItems, upsertItem } as any);

    const extractionRun = await service.createExtractionRun({
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      documentId: 'doc-1',
      schemaKey: {
        clientId: 'client-1',
        subClientId: 'sub-1',
        documentType: 'APPRAISAL_REPORT',
        version: '1.0.0',
      },
      runReason: 'test extraction',
      engineTarget: 'AXIOM',
      sourceIdentity: {
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-1',
        orderId: 'order-1',
        sourceArtifactRefs: [{ artifactType: 'order-intake-draft', artifactId: 'draft-1' }],
      },
    });

    const criteriaRun = await service.createCriteriaRun({
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-2',
      idempotencyKey: 'idem-2',
      snapshotId: 'snapshot-1',
      programKey: {
        clientId: 'client-1',
        subClientId: 'sub-1',
        programId: 'program-1',
        version: '1.0.0',
      },
      runMode: 'FULL',
      engineTarget: 'MOP_PRIO',
      sourceIdentity: {
        sourceKind: 'bulk-item',
        orderId: 'order-1',
        bulkJobId: 'job-1',
        bulkItemId: 'item-1',
        sourceArtifactRefs: [
          { artifactType: 'bulk-ingestion-job', artifactId: 'job-1' },
          { artifactType: 'bulk-ingestion-item', artifactId: 'item-1' },
        ],
      },
    });

    expect(extractionRun.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-1',
      }),
    );
    expect(criteriaRun.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'bulk-item',
        bulkJobId: 'job-1',
        bulkItemId: 'item-1',
      }),
    );
    expect(upsertItem).toHaveBeenCalledTimes(2);
  });

  it('inherits parent source identity when creating criteria step runs', async () => {
    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const queryItems = vi.fn().mockImplementation(async (_container: string, query: string) => {
      if (query.includes('c.id = @id')) {
        return {
          success: true,
          data: [
            {
              id: 'criteria-run-1',
              type: 'run-ledger-entry',
              runType: 'criteria',
              status: 'running',
              tenantId: 'tenant-1',
              createdAt: '2026-04-30T10:00:00.000Z',
              updatedAt: '2026-04-30T10:00:00.000Z',
              initiatedBy: 'user-1',
              correlationId: 'corr-1',
              idempotencyKey: 'idem-1',
              engine: 'AXIOM',
              engineVersion: 'v1',
              engineRunRef: 'engine-run-1',
              engineRequestRef: 'engine-request-1',
              engineResponseRef: 'engine-response-1',
              engineSelectionMode: 'EXPLICIT',
              snapshotId: 'snapshot-1',
              canonicalSnapshotId: 'snapshot-1',
              programKey: {
                clientId: 'client-1',
                subClientId: 'sub-1',
                programId: 'program-1',
                version: '1.0.0',
              },
              runMode: 'FULL',
              sourceIdentity: {
                sourceKind: 'api-order',
                orderId: 'order-1',
                sourceArtifactRefs: [{ artifactType: 'order', artifactId: 'order-1' }],
              },
            },
          ],
        };
      }

      return { success: true, data: [] };
    });
    const service = new RunLedgerService({ queryItems, upsertItem } as any);

    const stepRun = await service.createCriteriaStepRun({
      tenantId: 'tenant-1',
      initiatedBy: 'user-1',
      correlationId: 'corr-step',
      idempotencyKey: 'idem-step',
      parentCriteriaRunId: 'criteria-run-1',
      stepKey: 'overall-criteria',
      engineTarget: 'AXIOM',
    });

    expect(stepRun.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'api-order',
        orderId: 'order-1',
      }),
    );
  });
});