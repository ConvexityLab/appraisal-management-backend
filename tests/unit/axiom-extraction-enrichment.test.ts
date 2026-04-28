/**
 * T1.3 — enrichExtractionResultRefs: stamps OUR documentId / blobUrl / docName
 * onto each Axiom extraction result item so the frontend can resolve PDF chip
 * clicks back to a real document in our Cosmos store.
 *
 * Tested via the same private-method-via-cast pattern other axiom tests use.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({ publish: vi.fn() })),
}));
vi.mock('../../src/services/cosmos-db.service', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../src/services/web-pubsub.service', () => ({
  WebPubSubService: vi.fn().mockImplementation(() => ({})),
}));

import { AxiomService } from '../../src/services/axiom.service';

const META = {
  documentId: 'seed-doc-report-003',
  blobUrl: 'https://blob.example.com/seed-order-003/report.pdf',
  documentName: 'SEED-2026-00103_Rush_1004_Report.pdf',
};

function callEnricher(svc: AxiomService, extraction: unknown, meta: Record<string, unknown>): unknown {
  return (svc as unknown as { enrichExtractionResultRefs: (e: unknown, m: Record<string, unknown>) => unknown })
    .enrichExtractionResultRefs(extraction, meta);
}

describe('enrichExtractionResultRefs (T1.3)', () => {
  let svc: AxiomService;
  beforeEach(() => {
    process.env.AXIOM_API_BASE_URL = 'https://test.axiom';
    svc = new AxiomService();
  });

  it('stamps resolvedDocumentId on every entry of an extraction array', () => {
    const input = [
      { documentId: 'fs-axiom-001-urar', documentType: 'urar', extractedData: {} },
      { documentId: 'fs-axiom-001-other', documentType: 'other', extractedData: {} },
    ];
    const out = callEnricher(svc, input, META) as Array<Record<string, unknown>>;
    expect(out).toHaveLength(2);
    expect(out[0].resolvedDocumentId).toBe('seed-doc-report-003');
    expect(out[1].resolvedDocumentId).toBe('seed-doc-report-003');
    // Original Axiom documentId preserved for traceability
    expect(out[0].documentId).toBe('fs-axiom-001-urar');
    expect(out[1].documentId).toBe('fs-axiom-001-other');
  });

  it('stamps resolvedBlobUrl + resolvedDocumentName from meta', () => {
    const input = [{ documentId: 'fs-axiom-001-urar', extractedData: {} }];
    const out = callEnricher(svc, input, META) as Array<Record<string, unknown>>;
    expect(out[0].resolvedBlobUrl).toBe(META.blobUrl);
    expect(out[0].resolvedDocumentName).toBe(META.documentName);
  });

  it('does not overwrite resolved* if already present (idempotent on re-run)', () => {
    const input = [
      {
        documentId: 'fs-axiom-001-urar',
        resolvedDocumentId: 'pre-existing-value',
        extractedData: {},
      },
    ];
    const out = callEnricher(svc, input, META) as Array<Record<string, unknown>>;
    expect(out[0].resolvedDocumentId).toBe('pre-existing-value');
  });

  it('falls back to meta.documentUrl when meta.blobUrl is absent', () => {
    const input = [{ documentId: 'fs-axiom-001-urar', extractedData: {} }];
    const out = callEnricher(svc, input, {
      documentId: 'seed-doc-1',
      documentUrl: 'https://blob.example.com/alt.pdf',
    }) as Array<Record<string, unknown>>;
    expect(out[0].resolvedBlobUrl).toBe('https://blob.example.com/alt.pdf');
  });

  it('falls back to meta.fileName when meta.documentName is absent', () => {
    const input = [{ documentId: 'fs-axiom-001-urar', extractedData: {} }];
    const out = callEnricher(svc, input, {
      documentId: 'seed-doc-1',
      blobUrl: 'https://x',
      fileName: 'fallback-name.pdf',
    }) as Array<Record<string, unknown>>;
    expect(out[0].resolvedDocumentName).toBe('fallback-name.pdf');
  });

  it('returns raw extraction unchanged when meta has neither documentId nor blobUrl', () => {
    const input = [{ documentId: 'fs-axiom-001-urar', extractedData: {} }];
    const out = callEnricher(svc, input, {});
    expect(out).toBe(input);
  });

  it('returns non-array extraction unchanged (no shape it can enrich)', () => {
    expect(callEnricher(svc, undefined, META)).toBeUndefined();
    expect(callEnricher(svc, null, META)).toBeNull();
    expect(callEnricher(svc, { not: 'an array' }, META)).toEqual({ not: 'an array' });
  });

  it('skips items that are not objects (defensive)', () => {
    const input = [null, 'string-item', 42, { documentId: 'fs-1' }];
    const out = callEnricher(svc, input, META) as unknown[];
    expect(out[0]).toBeNull();
    expect(out[1]).toBe('string-item');
    expect(out[2]).toBe(42);
    expect((out[3] as Record<string, unknown>).resolvedDocumentId).toBe('seed-doc-report-003');
  });
});
