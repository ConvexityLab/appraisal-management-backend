/**
 * Tests for VendorMatchingReplayService — Phase D of
 * DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Pins the replay diff invariants the Sandbox tab depends on:
 *   - sinceDays clamps + sub-sampling work correctly
 *   - traces with no current vendor data are SKIPPED (not silently treated
 *     as unchanged) so operators see why they were left out
 *   - changed rows are computed from "vendor was originally ranked but new
 *     rules deny it" or vice versa — pure flip detection
 *   - skipped/unchanged/changed counts add up to totalEvaluated
 *   - explicit ids[] list path bypasses sinceDays
 *   - tenantId is required (replay never crosses tenants)
 */

import { describe, expect, it, vi } from 'vitest';
import { VendorMatchingReplayService } from '../../src/services/decision-engine/replay/vendor-matching-replay.service.js';
import type { AssignmentTraceDocument } from '../../src/types/assignment-trace.types.js';

function trace(
  partial: Partial<AssignmentTraceDocument> & {
    rankedVendorIds?: string[];
    deniedVendorIds?: string[];
    initiatedAt?: string;
  } = {},
): AssignmentTraceDocument {
  const tenantId = partial.tenantId ?? 't1';
  const orderId = partial.orderId ?? 'order-1';
  const initiatedAt = partial.initiatedAt ?? '2026-05-09T17:00:00.000Z';
  return {
    id: `${tenantId}__${orderId}__${initiatedAt}`,
    type: 'assignment-trace',
    tenantId,
    orderId,
    initiatedAt,
    rulesProviderName: 'mop',
    matchRequest: {
      propertyAddress: '123 Test St',
      propertyType: 'FULL_APPRAISAL',
      dueDate: '2026-05-16T00:00:00.000Z',
      urgency: 'STANDARD',
    },
    rankedVendors: (partial.rankedVendorIds ?? ['v-good']).map((id, i) => ({
      vendorId: id,
      vendorName: id,
      score: 90 - i,
    })),
    deniedVendors: (partial.deniedVendorIds ?? []).map((id) => ({
      vendorId: id,
      vendorName: id,
      reason: 'denied',
    } as never)),
    outcome: 'pending_bid',
    selectedVendorId: partial.rankedVendorIds?.[0] ?? null,
    rankingLatencyMs: 50,
    ...partial,
  };
}

function vendor(id: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    tenantId: 't1',
    capabilities: ['fha_approved'],
    serviceAreas: [{ state: 'CA' }],
    overallScore: 85,
    licenseType: 'state',
    ...extras,
  };
}

interface FakeDeps {
  db: {
    queryDocuments: ReturnType<typeof vi.fn>;
  };
  pusher: {
    preview: ReturnType<typeof vi.fn>;
  };
}

function makeFakeDeps(opts: {
  traces?: AssignmentTraceDocument[];
  vendors?: Array<ReturnType<typeof vendor>>;
  /** Per-evaluation eligibility decided by the proposed rules. */
  rulesDeny?: (vendorId: string) => boolean;
}): FakeDeps {
  const traces = opts.traces ?? [];
  const vendors = opts.vendors ?? [];
  const denyFn = opts.rulesDeny ?? (() => false);

  return {
    db: {
      queryDocuments: vi.fn(async (container: string, _query: string, params: { name: string; value: any }[]) => {
        const p: Record<string, any> = {};
        for (const param of params) p[param.name] = param.value;
        if (container === 'assignment-traces') {
          if (p['@orderId']) {
            return traces.filter(t => t.orderId === p['@orderId'] && t.tenantId === p['@tenantId']);
          }
          const sinceIso = p['@sinceIso'] as string | undefined;
          let docs = traces.filter(t => t.tenantId === p['@tenantId']);
          if (sinceIso) docs = docs.filter(t => t.initiatedAt >= sinceIso);
          return docs.sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
        }
        if (container === 'vendors') {
          const ids: string[] = p['@ids'] ?? [];
          return vendors.filter(v => ids.includes(v.id));
        }
        return [];
      }),
    },
    pusher: {
      preview: vi.fn(async (input: { evaluations: Array<{ vendor: { id: string } }> }) => {
        return {
          results: input.evaluations.map((e) => ({
            eligible: !denyFn(e.vendor.id),
            scoreAdjustment: 0,
            appliedRuleIds: [],
            denyReasons: denyFn(e.vendor.id) ? ['proposed-deny'] : [],
          })),
        };
      }),
    },
  };
}

describe('VendorMatchingReplayService', () => {
  it('requires tenantId', async () => {
    const { db, pusher } = makeFakeDeps({});
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    await expect(svc.replay({ tenantId: '', rules: [{}] })).rejects.toThrow(/tenantId is required/);
  });

  it('returns empty diff when no traces are in the window', async () => {
    const { db, pusher } = makeFakeDeps({ traces: [] });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }], sinceDays: 7 });
    expect(diff).toEqual({
      windowSize: 0,
      totalEvaluated: 0,
      changedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
      newDenialsCount: 0,
      newAcceptancesCount: 0,
      perDecision: [],
    });
  });

  it('marks a decision changed when proposed rules newly deny a previously-ranked vendor', async () => {
    const t = trace({ rankedVendorIds: ['v-good', 'v-meh'] });
    const { db, pusher } = makeFakeDeps({
      traces: [t],
      vendors: [vendor('v-good'), vendor('v-meh')],
      rulesDeny: (id) => id === 'v-meh',
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }] });

    expect(diff.totalEvaluated).toBe(1);
    expect(diff.changedCount).toBe(1);
    expect(diff.unchangedCount).toBe(0);
    expect(diff.newDenialsCount).toBe(1);
    expect(diff.perDecision[0]!.changed).toBe(true);
    expect(diff.perDecision[0]!.summary).toMatch(/1 new denial/);
  });

  it('marks a decision changed when proposed rules newly allow a previously-denied vendor', async () => {
    const t = trace({ rankedVendorIds: ['v-good'], deniedVendorIds: ['v-was-denied'] });
    const { db, pusher } = makeFakeDeps({
      traces: [t],
      vendors: [vendor('v-good'), vendor('v-was-denied')],
      rulesDeny: () => false, // proposed rules allow everything
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }] });

    expect(diff.changedCount).toBe(1);
    expect(diff.newAcceptancesCount).toBe(1);
    expect(diff.perDecision[0]!.summary).toMatch(/1 new acceptance/);
  });

  it('marks a decision unchanged when proposed rules produce the same outcome', async () => {
    const t = trace({ rankedVendorIds: ['v-good'] });
    const { db, pusher } = makeFakeDeps({
      traces: [t],
      vendors: [vendor('v-good')],
      rulesDeny: () => false,
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }] });

    expect(diff.changedCount).toBe(0);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.perDecision[0]!.summary).toMatch(/No outcome change/);
  });

  it('skips traces whose vendors are no longer in the current dataset', async () => {
    const t = trace({ rankedVendorIds: ['v-deleted'] });
    const { db, pusher } = makeFakeDeps({
      traces: [t],
      vendors: [], // None of the trace's vendors exist in current data
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }] });

    expect(diff.skippedCount).toBe(1);
    expect(diff.changedCount).toBe(0);
    expect(diff.unchangedCount).toBe(0);
    expect(diff.perDecision[0]!.skippedReason).toBe('no-current-vendor-data');
    expect(pusher.preview).not.toHaveBeenCalled();
  });

  it('counts add up to totalEvaluated regardless of mix', async () => {
    const traces = [
      trace({ orderId: 'o-changed',   rankedVendorIds: ['v-flip'] }),
      trace({ orderId: 'o-unchanged', rankedVendorIds: ['v-good'], initiatedAt: '2026-05-08T00:00:00.000Z' }),
      trace({ orderId: 'o-skipped',   rankedVendorIds: ['v-deleted'], initiatedAt: '2026-05-07T00:00:00.000Z' }),
    ];
    const { db, pusher } = makeFakeDeps({
      traces,
      vendors: [vendor('v-flip'), vendor('v-good')],
      rulesDeny: (id) => id === 'v-flip',
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    // sinceDays: 14 so all three hard-coded traces fall inside the window
    // regardless of when the test runs. This test is about the count invariant,
    // not the date-filter logic (which is tested separately).
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }], sinceDays: 14 });

    expect(diff.windowSize).toBe(3);
    expect(diff.totalEvaluated).toBe(3);
    expect(diff.changedCount + diff.unchangedCount + diff.skippedCount).toBe(diff.totalEvaluated);
    expect(diff.changedCount).toBe(1);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.skippedCount).toBe(1);
  });

  it('explicit ids[] path bypasses sinceDays and looks up by orderId', async () => {
    const t = trace({ orderId: 'specific-order', rankedVendorIds: ['v-good'] });
    const { db, pusher } = makeFakeDeps({
      traces: [t],
      vendors: [vendor('v-good')],
      rulesDeny: () => false,
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }], ids: ['specific-order'] });

    expect(diff.totalEvaluated).toBe(1);
    expect(diff.perDecision[0]!.subjectId).toBe('specific-order');
  });

  it('sub-samples deterministically when samplePercent < 100', async () => {
    // Use timestamps just before "now" so all 10 are inside any reasonable
    // sinceDays window. We're verifying sampling math here, not date filtering.
    const baseTs = Date.now();
    const traces = Array.from({ length: 10 }, (_, i) =>
      trace({
        orderId: `o-${i}`,
        initiatedAt: new Date(baseTs - i * 1_000).toISOString(),
      }),
    );
    const { db, pusher } = makeFakeDeps({
      traces,
      vendors: [vendor('v-good')],
      rulesDeny: () => false,
    });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);

    // 50% sample of 10 items → 5 evaluated.
    const diff = await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }], samplePercent: 50 });
    expect(diff.windowSize).toBe(10);
    expect(diff.totalEvaluated).toBe(5);
  });

  it('clamps sinceDays > 30 to 30', async () => {
    const { db, pusher } = makeFakeDeps({ traces: [] });
    const svc = new VendorMatchingReplayService(db as never, pusher as never);
    await svc.replay({ tenantId: 't1', rules: [{ name: 'r' }], sinceDays: 99999 });

    // Inspect the @sinceIso param — should correspond to ~30 days ago.
    const queryArgs = (db.queryDocuments as any).mock.calls[0];
    const params = queryArgs[2] as Array<{ name: string; value: string }>;
    const sinceIso = params.find(p => p.name === '@sinceIso')!.value;
    const daysBack = (Date.now() - new Date(sinceIso).getTime()) / (24 * 60 * 60 * 1000);
    expect(daysBack).toBeGreaterThan(29);
    expect(daysBack).toBeLessThan(31);
  });
});
