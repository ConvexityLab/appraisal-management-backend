import { describe, expect, it, vi } from 'vitest';
import { AssignmentTraceRecorder } from '../../src/services/assignment-trace-recorder.service.js';
import type { AssignmentTraceDocument } from '../../src/types/assignment-trace.types.js';

function makeTrace(overrides: Partial<AssignmentTraceDocument> = {}): AssignmentTraceDocument {
  const tenantId = overrides.tenantId ?? 't-acme';
  const orderId = overrides.orderId ?? 'order-1';
  const initiatedAt = overrides.initiatedAt ?? '2026-05-09T17:00:00.000Z';
  return {
    id: AssignmentTraceRecorder.composeId(tenantId, orderId, initiatedAt),
    type: 'assignment-trace',
    tenantId,
    orderId,
    initiatedAt,
    rulesProviderName: 'mop-with-fallback',
    matchRequest: {
      propertyAddress: '123 Test St, Fairfax, VA',
      propertyType: 'FULL_APPRAISAL',
      dueDate: '2026-05-16T00:00:00.000Z',
      urgency: 'STANDARD',
    },
    rankedVendors: [
      { vendorId: 'v1', vendorName: 'Acme', score: 91 },
    ],
    deniedVendors: [],
    outcome: 'pending_bid',
    selectedVendorId: 'v1',
    rankingLatencyMs: 42,
    ...overrides,
  };
}

function makeFakeDb() {
  const traces: AssignmentTraceDocument[] = [];
  return {
    _traces: traces,
    createDocument: vi.fn(async (_cn: string, doc: AssignmentTraceDocument) => {
      if (traces.find(t => t.id === doc.id)) {
        const e: any = new Error('Conflict');
        e.code = 409;
        throw e;
      }
      traces.push(doc);
    }),
    queryDocuments: vi.fn(async <T>(_cn: string, query: string, params: { name: string; value: any }[]) => {
      const p: Record<string, any> = {};
      for (const param of params) p[param.name] = param.value;
      let filtered = traces.filter(t => t.tenantId === p['@tenantId']);
      if (p['@orderId']) filtered = filtered.filter(t => t.orderId === p['@orderId']);
      filtered.sort((a, b) =>
        new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime(),
      );
      // honor SELECT TOP @limit
      if (query.includes('TOP @limit') && p['@limit']) {
        filtered = filtered.slice(0, p['@limit']);
      }
      return filtered as T[];
    }),
  };
}

describe('AssignmentTraceRecorder.composeId', () => {
  it('is deterministic for the same inputs (idempotent retries)', () => {
    const a = AssignmentTraceRecorder.composeId('t', 'o', '2026-05-09T00:00:00Z');
    const b = AssignmentTraceRecorder.composeId('t', 'o', '2026-05-09T00:00:00Z');
    expect(a).toBe(b);
  });

  it('differs across timestamps so re-triggers preserve history', () => {
    const a = AssignmentTraceRecorder.composeId('t', 'o', '2026-05-09T00:00:00Z');
    const b = AssignmentTraceRecorder.composeId('t', 'o', '2026-05-09T00:01:00Z');
    expect(a).not.toBe(b);
  });
});

describe('AssignmentTraceRecorder.record', () => {
  it('persists the trace on success', async () => {
    const db = makeFakeDb();
    const recorder = new AssignmentTraceRecorder(db as any);
    await recorder.record(makeTrace());
    expect(db._traces).toHaveLength(1);
    expect(db._traces[0]!.outcome).toBe('pending_bid');
  });

  it('treats 409 conflict as success (idempotent retry)', async () => {
    const db = makeFakeDb();
    const recorder = new AssignmentTraceRecorder(db as any);
    const trace = makeTrace();
    await recorder.record(trace);
    // Second call with same id — should not throw.
    await expect(recorder.record(trace)).resolves.toBeUndefined();
    expect(db._traces).toHaveLength(1);
  });

  it('swallows storage errors so an assignment never fails because of trace I/O', async () => {
    const db = makeFakeDb();
    db.createDocument = vi.fn(async () => { throw new Error('Cosmos timeout'); }) as any;
    const recorder = new AssignmentTraceRecorder(db as any);
    await expect(recorder.record(makeTrace())).resolves.toBeUndefined();
  });
});

describe('AssignmentTraceRecorder.listForOrder', () => {
  it('returns all traces for the order, newest first', async () => {
    const db = makeFakeDb();
    const recorder = new AssignmentTraceRecorder(db as any);
    await recorder.record(makeTrace({ orderId: 'o1', initiatedAt: '2026-05-09T10:00:00.000Z' }));
    await recorder.record(makeTrace({ orderId: 'o1', initiatedAt: '2026-05-09T12:00:00.000Z' }));
    await recorder.record(makeTrace({ orderId: 'o1', initiatedAt: '2026-05-09T11:00:00.000Z' }));

    const traces = await recorder.listForOrder('t-acme', 'o1');
    expect(traces).toHaveLength(3);
    expect(traces.map(t => t.initiatedAt)).toEqual([
      '2026-05-09T12:00:00.000Z',
      '2026-05-09T11:00:00.000Z',
      '2026-05-09T10:00:00.000Z',
    ]);
  });

  it('isolates per tenant', async () => {
    const db = makeFakeDb();
    const recorder = new AssignmentTraceRecorder(db as any);
    await recorder.record(makeTrace({ tenantId: 'tA', orderId: 'o1' }));
    await recorder.record(makeTrace({ tenantId: 'tB', orderId: 'o1' }));

    expect(await recorder.listForOrder('tA', 'o1')).toHaveLength(1);
    expect(await recorder.listForOrder('tB', 'o1')).toHaveLength(1);
    expect(await recorder.listForOrder('tC', 'o1')).toHaveLength(0);
  });

  it('returns [] (not throws) when storage fails', async () => {
    const db = makeFakeDb();
    db.queryDocuments = vi.fn(async () => { throw new Error('Cosmos down'); }) as any;
    const recorder = new AssignmentTraceRecorder(db as any);
    expect(await recorder.listForOrder('t', 'o')).toEqual([]);
  });
});

describe('AssignmentTraceRecorder.listRecent', () => {
  it('returns slim summaries (no big rules/explanations) capped at limit', async () => {
    const db = makeFakeDb();
    const recorder = new AssignmentTraceRecorder(db as any);
    for (let i = 0; i < 10; i++) {
      await recorder.record(makeTrace({
        orderId: `o${i}`,
        initiatedAt: `2026-05-09T${10 + i}:00:00.000Z`,
      }));
    }
    const summaries = await recorder.listRecent('t-acme', 5);
    expect(summaries).toHaveLength(5);
    // Newest first.
    expect(summaries[0]!.orderId).toBe('o9');
    // Summary shape (no full rankedVendors / deniedVendors arrays).
    expect(summaries[0]).toMatchObject({
      orderId: 'o9',
      outcome: 'pending_bid',
      rankedCount: 1,
      deniedCount: 0,
      rulesProviderName: 'mop-with-fallback',
    });
    expect((summaries[0] as any).rankedVendors).toBeUndefined();
  });
});
