import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanonicalSnapshotService } from '../../src/services/canonical-snapshot.service.js';
import type { RunLedgerRecord } from '../../src/types/run-ledger.types.js';

function buildExtractionRun(overrides?: Partial<RunLedgerRecord>): RunLedgerRecord {
  const now = new Date().toISOString();
  return {
    id: 'ext_run_001',
    type: 'run-ledger-entry',
    runType: 'extraction',
    status: 'running',
    tenantId: 'tenant-001',
    createdAt: now,
    updatedAt: now,
    initiatedBy: 'user-001',
    correlationId: 'corr-001',
    idempotencyKey: 'idem-001',
    engine: 'AXIOM',
    engineVersion: 'v1',
    engineRunRef: 'job-001',
    engineRequestRef: 'req-001',
    engineResponseRef: 'res-001',
    engineSelectionMode: 'EXPLICIT',
    documentId: 'doc-001',
    runReason: 'INITIAL_INGEST',
    schemaKey: {
      clientId: 'client-001',
      subClientId: 'sub-001',
      documentType: 'APPRAISAL_REPORT',
      version: '1.0.0',
    },
    ...overrides,
  };
}

describe('CanonicalSnapshotService merge behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds snapshot when enrichment is missing', async () => {
    const queryItems = vi.fn().mockImplementation(async (container: string) => {
      if (container === 'documents') {
        return {
          success: true,
          data: [
            {
              id: 'doc-001',
              tenantId: 'tenant-001',
              orderId: 'order-001',
              extractedData: { appraisalValue: 510000, qualityScore: 'A' },
            },
          ],
        };
      }

      if (container === 'property-enrichments') {
        return { success: true, data: [] };
      }

      return { success: true, data: [] };
    });

    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const db = { queryItems, upsertItem };

    const service = new CanonicalSnapshotService(db as any);
    const snapshot = await service.createFromExtractionRun(buildExtractionRun());

    expect(snapshot.sourceRefs).toEqual([
      expect.objectContaining({
        sourceType: 'document-extraction',
        sourceId: 'doc-001',
        sourceRunId: 'ext_run_001',
      }),
    ]);
    expect(snapshot.normalizedData?.extraction).toMatchObject({ appraisalValue: 510000, qualityScore: 'A' });
    expect(snapshot.normalizedData?.providerData).toEqual({});
    expect(snapshot.normalizedData?.subjectProperty).toEqual({});
    expect(snapshot.normalizedData?.provenance).toMatchObject({
      extractionRunId: 'ext_run_001',
      documentId: 'doc-001',
      orderId: 'order-001',
      enrichmentId: undefined,
    });

    expect(upsertItem).toHaveBeenCalledTimes(1);
    expect(upsertItem.mock.calls[0][0]).toBe('aiInsights');
  });

  it('builds snapshot when extraction output is missing', async () => {
    const queryItems = vi.fn().mockImplementation(async (container: string) => {
      if (container === 'documents') {
        return {
          success: true,
          data: [
            {
              id: 'doc-001',
              tenantId: 'tenant-001',
              orderId: 'order-001',
            },
          ],
        };
      }

      if (container === 'property-enrichments') {
        return {
          success: true,
          data: [
            {
              id: 'enrich-001',
              type: 'property-enrichment',
              orderId: 'order-001',
              tenantId: 'tenant-001',
              dataResult: {
                source: 'Bridge Interactive',
                fetchedAt: '2026-04-04T00:00:00.000Z',
                core: { grossLivingArea: 2450, bedrooms: 4 },
                publicRecord: { taxAssessedValue: 420000 },
                flood: { femaFloodZone: 'X' },
              },
              createdAt: '2026-04-04T00:00:00.000Z',
            },
          ],
        };
      }

      return { success: true, data: [] };
    });

    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const db = { queryItems, upsertItem };

    const service = new CanonicalSnapshotService(db as any);
    const snapshot = await service.createFromExtractionRun(buildExtractionRun());

    expect(snapshot.normalizedData?.extraction).toEqual({});
    expect(snapshot.normalizedData?.providerData).toMatchObject({ source: 'Bridge Interactive' });
    expect(snapshot.normalizedData?.subjectProperty).toMatchObject({
      grossLivingArea: 2450,
      bedrooms: 4,
      taxAssessedValue: 420000,
      femaFloodZone: 'X',
    });
    expect(snapshot.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'property-enrichment', sourceId: 'enrich-001' }),
      ]),
    );
  });

  it('records provenance from extraction + enrichment inputs', async () => {
    const queryItems = vi.fn().mockImplementation(async (container: string) => {
      if (container === 'documents') {
        return {
          success: true,
          data: [
            {
              id: 'doc-001',
              tenantId: 'tenant-001',
              orderId: 'order-001',
              extractedData: { appraiserOpinion: 'stable' },
            },
          ],
        };
      }

      if (container === 'property-enrichments') {
        return {
          success: true,
          data: [
            {
              id: 'enrich-999',
              type: 'property-enrichment',
              orderId: 'order-001',
              tenantId: 'tenant-001',
              dataResult: {
                source: 'ATTOM Data Solutions',
                fetchedAt: '2026-04-04T01:00:00.000Z',
                core: { yearBuilt: 1998 },
              },
              createdAt: '2026-04-04T01:00:00.000Z',
            },
          ],
        };
      }

      return { success: true, data: [] };
    });

    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const db = { queryItems, upsertItem };

    const service = new CanonicalSnapshotService(db as any);
    const snapshot = await service.createFromExtractionRun(buildExtractionRun());

    expect(snapshot.normalizedData?.provenance).toEqual({
      extractionRunId: 'ext_run_001',
      documentId: 'doc-001',
      orderId: 'order-001',
      enrichmentId: 'enrich-999',
    });
    expect(snapshot.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'document-extraction', sourceId: 'doc-001' }),
        expect.objectContaining({ sourceType: 'property-enrichment', sourceId: 'enrich-999' }),
      ]),
    );
  });
});
