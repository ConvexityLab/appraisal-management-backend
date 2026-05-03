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
    const snapshot = await service.createFromExtractionRun(buildExtractionRun({
      sourceIdentity: {
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-123',
        orderId: 'order-001',
        sourceArtifactRefs: [{ artifactType: 'order-intake-draft', artifactId: 'draft-123' }],
      },
    }));

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
      sourceIdentity: expect.objectContaining({
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-123',
      }),
    });
    expect(snapshot.sourceIdentity).toEqual(
      expect.objectContaining({
        sourceKind: 'manual-draft',
        intakeDraftId: 'draft-123',
        documentId: 'doc-001',
      }),
    );

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

  // Slice: feat/property-enrichment-mapper. Verifies the property-enrichment
  // mapper is wired into normalizedData.canonical and that merge order is
  // "enrichment first, extraction wins on overlap" — and that enrichment-only
  // fields (parcelNumber, floodZone, county) survive when extraction also
  // produces a subject.
  it('projects enrichment data onto normalizedData.canonical.subject and lets extraction win on overlap', async () => {
    const queryItems = vi.fn().mockImplementation(async (container: string) => {
      if (container === 'documents') {
        return {
          success: true,
          data: [
            {
              id: 'doc-001',
              tenantId: 'tenant-001',
              orderId: 'order-001',
              extractedData: {
                propertyAddress: {
                  street: { value: '17 David Dr' },
                  city: { value: 'Johnston' },
                  state: { value: 'RI' },
                  zipCode: { value: '02919' },
                },
                grossLivingArea: { value: 1900 },  // extraction differs from enrichment 1850
                yearBuilt: { value: 1985 },
              },
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
                source: 'Bridge',
                fetchedAt: '2026-04-04T00:00:00.000Z',
                core: {
                  grossLivingArea: 1850,
                  parcelNumber: 'APN-123',
                  county: 'Providence',
                  latitude: 41.82,
                },
                publicRecord: { zoning: 'R-7' },
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
    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);

    const snapshot = await service.createFromExtractionRun(buildExtractionRun());

    const canonical = snapshot.normalizedData?.canonical as { subject?: Record<string, unknown> } | undefined;
    expect(canonical?.subject).toBeTruthy();

    // Extraction wins on the overlapping field (grossLivingArea).
    expect(canonical?.subject?.['grossLivingArea']).toBe(1900);
    // Enrichment-only fields survive.
    expect(canonical?.subject?.['parcelNumber']).toBe('APN-123');
    expect(canonical?.subject?.['zoning']).toBe('R-7');
    expect(canonical?.subject?.['floodZone']).toBe('X');
    expect(canonical?.subject?.['latitude']).toBe(41.82);
    // Address merged field-by-field: extraction supplies streetAddress, enrichment
    // supplies county.
    expect(canonical?.subject?.['address']).toMatchObject({
      streetAddress: '17 David Dr',
      city: 'Johnston',
      county: 'Providence',
    });
  });
});

// ── refreshFromExtractionRun (P-19 / A-13 — post-Axiom snapshot refresh) ────
// Closes the gap flagged in the extraction-journey audit: createFromExtractionRun
// was tested above, but refreshFromExtractionRun (called from
// axiom.service.ts#fetchAndStorePipelineResults after the extracted-data
// writeback) had ZERO coverage.
describe('CanonicalSnapshotService.refreshFromExtractionRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildExistingSnapshot(overrides: any = {}) {
    return {
      id: 'snap-001',
      type: 'canonical-snapshot',
      tenantId: 'tenant-001',
      orderId: 'order-001',
      documentId: 'doc-001',
      extractionRunId: 'ext_run_001',
      status: 'pending',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      normalizedData: { extraction: { appraisalValue: 500000 } },
      sourceRefs: [],
      ...overrides,
    };
  }

  it('skips silently and returns null when the run is not an extraction run', async () => {
    const upsertItem = vi.fn();
    const queryItems = vi.fn();
    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);

    const evaluationRun = buildExtractionRun({ runType: 'evaluation' as any });
    const result = await service.refreshFromExtractionRun(evaluationRun);

    expect(result).toBeNull();
    expect(queryItems).not.toHaveBeenCalled();
    expect(upsertItem).not.toHaveBeenCalled();
  });

  it('returns null without writing when the run has no canonicalSnapshotId', async () => {
    const upsertItem = vi.fn();
    const queryItems = vi.fn();
    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);

    const result = await service.refreshFromExtractionRun(buildExtractionRun({ canonicalSnapshotId: undefined }));

    expect(result).toBeNull();
    expect(queryItems).not.toHaveBeenCalled();
    expect(upsertItem).not.toHaveBeenCalled();
  });

  it('returns null when the linked snapshot has been deleted (idempotent no-op)', async () => {
    const queryItems = vi.fn().mockResolvedValue({ success: true, data: [] });
    const upsertItem = vi.fn();
    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);

    const result = await service.refreshFromExtractionRun(
      buildExtractionRun({ canonicalSnapshotId: 'snap-missing' }),
    );

    expect(result).toBeNull();
    expect(upsertItem).not.toHaveBeenCalled();
  });

  it('rebuilds normalizedData from the post-Axiom document and stamps refreshedAt + status=ready', async () => {
    const existing = buildExistingSnapshot();
    const queryItems = vi.fn().mockImplementation(async (container: string, query: string) => {
      if (container === 'aiInsights' || query.includes('canonical-snapshot')) {
        // First query: getSnapshotById
        return { success: true, data: [existing] };
      }
      if (container === 'documents') {
        // Second query: getDocumentById — return doc with the freshly-written
        // extractedData (post-Axiom)
        return {
          success: true,
          data: [{
            id: 'doc-001',
            tenantId: 'tenant-001',
            orderId: 'order-001',
            extractedData: { appraisalValue: 525000, qualityScore: 'A+', updatedField: 'post-axiom' },
          }],
        };
      }
      if (container === 'property-enrichments') {
        return { success: true, data: [] };
      }
      return { success: true, data: [] };
    });
    const upsertItem = vi.fn().mockResolvedValue({ success: true });

    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);
    const before = Date.now();
    const result = await service.refreshFromExtractionRun(
      buildExtractionRun({ canonicalSnapshotId: 'snap-001' }),
    );

    expect(result).not.toBeNull();
    expect(result!.id).toBe('snap-001');
    expect(result!.status).toBe('ready');
    expect(typeof (result as any).refreshedAt).toBe('string');
    expect(Date.parse((result as any).refreshedAt)).toBeGreaterThanOrEqual(before);
    // normalizedData should reflect the POST-Axiom document state, not the
    // pre-Axiom snapshot we started with
    expect(result!.normalizedData?.extraction).toMatchObject({
      appraisalValue: 525000,
      qualityScore: 'A+',
      updatedField: 'post-axiom',
    });
    expect(upsertItem).toHaveBeenCalledTimes(1);
    expect(upsertItem.mock.calls[0][1]).toMatchObject({
      id: 'snap-001',
      status: 'ready',
    });
  });

  it('returns null and logs (no throw) when the upsert fails — caller in axiom.service.ts must not see a hard error', async () => {
    const existing = buildExistingSnapshot();
    const queryItems = vi.fn().mockImplementation(async (container: string) => {
      // getSnapshotById queries the aiInsights container (runContainerName)
      if (container === 'aiInsights') return { success: true, data: [existing] };
      if (container === 'documents') return { success: true, data: [{ id: 'doc-001', tenantId: 'tenant-001' }] };
      return { success: true, data: [] };
    });
    const upsertItem = vi.fn().mockResolvedValue({ success: false, error: { message: 'Cosmos throttle' } });

    const service = new CanonicalSnapshotService({ queryItems, upsertItem } as any);
    const result = await service.refreshFromExtractionRun(
      buildExtractionRun({ canonicalSnapshotId: 'snap-001' }),
    );

    expect(result).toBeNull();
    expect(upsertItem).toHaveBeenCalledTimes(1);
  });
});
