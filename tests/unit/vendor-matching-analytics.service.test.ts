/**
 * Tests for VendorMatchingAnalyticsService — Phase E of
 * DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Pins the aggregation invariants the Analytics tab + landing page rely on:
 *   - tenantId required (analytics never crosses tenants)
 *   - per-rule fireCount accumulated from rankedVendors[].explanation.appliedRuleIds
 *   - per-rule denial contributions accumulated from deniedVendors[].appliedRuleIds
 *   - daily[] aligned with windowDates (oldest → newest, length = days)
 *   - outcomeCounts accumulated correctly; escalationCount sums the
 *     escalation-y outcomes
 *   - days clamp to [1, 90]
 *   - perRule sorted by fireCount desc
 */

import { describe, expect, it, vi } from 'vitest';
import {
  VendorMatchingAnalyticsService,
  buildWindowDates,
  dayIndex,
} from '../../src/services/decision-engine/analytics/vendor-matching-analytics.service.js';
import type { AssignmentTraceDocument } from '../../src/types/assignment-trace.types.js';

function trace(partial: Partial<AssignmentTraceDocument> & {
  rankedExplanations?: Array<{ vendorId: string; appliedRuleIds: string[]; scoreAdjustment?: number }>;
  deniedExplanations?: Array<{ vendorId: string; appliedRuleIds: string[]; reason?: string }>;
  initiatedAt?: string;
} = {}): AssignmentTraceDocument {
  const tenantId = partial.tenantId ?? 't1';
  const orderId = partial.orderId ?? 'order-1';
  const initiatedAt = partial.initiatedAt ?? new Date().toISOString();
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
    rankedVendors: (partial.rankedExplanations ?? []).map(e => ({
      vendorId: e.vendorId,
      vendorName: e.vendorId,
      score: 90,
      explanation: {
        vendorId: e.vendorId,
        scoreComponents: { performance: 90, availability: 90, proximity: 90, experience: 90, cost: 90 },
        weightsVersion: 'v1',
        appliedRuleIds: e.appliedRuleIds,
        ...(e.scoreAdjustment !== undefined ? { scoreAdjustment: e.scoreAdjustment } : {}),
      } as never,
    })),
    deniedVendors: (partial.deniedExplanations ?? []).map(e => ({
      vendorId: e.vendorId,
      vendorName: e.vendorId,
      reason: e.reason ?? 'denied',
      appliedRuleIds: e.appliedRuleIds,
    } as never)),
    outcome: partial.outcome ?? 'pending_bid',
    selectedVendorId: partial.selectedVendorId ?? null,
    rankingLatencyMs: 50,
    ...partial,
  };
}

function makeFakeDb(traces: AssignmentTraceDocument[]) {
  return {
    queryDocuments: vi.fn(async (_cn: string, _q: string, params: { name: string; value: any }[]) => {
      const p: Record<string, any> = {};
      for (const param of params) p[param.name] = param.value;
      const sinceIso = p['@sinceIso'] as string;
      return traces
        .filter(t => t.tenantId === p['@tenantId'] && t.initiatedAt >= sinceIso)
        .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
    }),
  };
}

describe('VendorMatchingAnalyticsService', () => {
  it('requires tenantId', async () => {
    const svc = new VendorMatchingAnalyticsService(makeFakeDb([]) as never);
    await expect(svc.summary({ tenantId: '' })).rejects.toThrow(/tenantId is required/);
  });

  it('returns an empty summary when no traces are in the window', async () => {
    const svc = new VendorMatchingAnalyticsService(makeFakeDb([]) as never);
    const out = await svc.summary({ tenantId: 't1', days: 7 });
    expect(out.category).toBe('vendor-matching');
    expect(out.windowDays).toBe(7);
    expect(out.windowDates).toHaveLength(7);
    expect(out.totalDecisions).toBe(0);
    expect(out.totalEvaluations).toBe(0);
    expect(out.escalationCount).toBe(0);
    expect(out.perRule).toEqual([]);
    expect(out.outcomeCounts).toEqual({});
  });

  it('aggregates per-rule fire counts from ranked explanations + denied explanations', async () => {
    const today = new Date().toISOString();
    const traces = [
      trace({
        orderId: 'o-1',
        initiatedAt: today,
        rankedExplanations: [
          { vendorId: 'v1', appliedRuleIds: ['Rule_A', 'Rule_B'], scoreAdjustment: 5 },
          { vendorId: 'v2', appliedRuleIds: ['Rule_A'], scoreAdjustment: 0 },
        ],
        deniedExplanations: [
          { vendorId: 'v3', appliedRuleIds: ['Rule_C'], reason: 'denied by C' },
        ],
        outcome: 'pending_bid',
      }),
      trace({
        orderId: 'o-2',
        initiatedAt: today,
        rankedExplanations: [
          { vendorId: 'v1', appliedRuleIds: ['Rule_A'], scoreAdjustment: 10 },
        ],
        deniedExplanations: [],
        outcome: 'pending_bid',
      }),
    ];

    const svc = new VendorMatchingAnalyticsService(makeFakeDb(traces) as never);
    const out = await svc.summary({ tenantId: 't1', days: 7 });

    expect(out.totalDecisions).toBe(2);
    // 2 ranked + 1 denied + 1 ranked = 4 evaluations
    expect(out.totalEvaluations).toBe(4);

    const byRule = new Map(out.perRule.map(r => [r.ruleId, r]));
    expect(byRule.get('Rule_A')!.fireCount).toBe(3);  // fired in 3 ranked entries
    expect(byRule.get('Rule_A')!.scoreAdjustmentSum).toBe(15);
    expect(byRule.get('Rule_B')!.fireCount).toBe(1);
    expect(byRule.get('Rule_C')!.fireCount).toBe(1);
    expect(byRule.get('Rule_C')!.denialContributionCount).toBe(1);
  });

  it('counts outcomes and rolls up escalations', async () => {
    const today = new Date().toISOString();
    const traces = [
      trace({ orderId: 'o-1', initiatedAt: today, outcome: 'pending_bid' }),
      trace({ orderId: 'o-2', initiatedAt: today, outcome: 'broadcast' }),
      trace({ orderId: 'o-3', initiatedAt: today, outcome: 'escalated' }),
      trace({ orderId: 'o-4', initiatedAt: today, outcome: 'exhausted' }),
    ];
    const svc = new VendorMatchingAnalyticsService(makeFakeDb(traces) as never);
    const out = await svc.summary({ tenantId: 't1', days: 7 });

    expect(out.outcomeCounts).toEqual({
      pending_bid: 1,
      broadcast: 1,
      escalated: 1,
      exhausted: 1,
    });
    expect(out.escalationCount).toBe(2);
  });

  it('perRule is sorted by fireCount descending', async () => {
    const today = new Date().toISOString();
    const traces = [
      trace({
        rankedExplanations: [
          { vendorId: 'v1', appliedRuleIds: ['Rare'] },
          { vendorId: 'v2', appliedRuleIds: ['Common', 'Common2'] },
          { vendorId: 'v3', appliedRuleIds: ['Common'] },
        ],
        initiatedAt: today,
      }),
    ];
    const svc = new VendorMatchingAnalyticsService(makeFakeDb(traces) as never);
    const out = await svc.summary({ tenantId: 't1', days: 7 });
    const ids = out.perRule.map(r => r.ruleId);
    // Common > Common2 == Rare. 'Common' must lead.
    expect(ids[0]).toBe('Common');
  });

  it('clamps days > 90 to 90', async () => {
    const svc = new VendorMatchingAnalyticsService(makeFakeDb([]) as never);
    const out = await svc.summary({ tenantId: 't1', days: 99999 });
    expect(out.windowDays).toBe(90);
    expect(out.windowDates).toHaveLength(90);
  });

  it('builds window dates oldest → newest', () => {
    const w = buildWindowDates(3);
    expect(w).toHaveLength(3);
    expect(new Date(w[0]!).getTime()).toBeLessThan(new Date(w[2]!).getTime());
  });

  it('dayIndex returns correct slot or -1 for outside-window', () => {
    const w = buildWindowDates(5);
    const today = new Date().toISOString();
    expect(dayIndex(today, w)).toBe(w.length - 1); // today is the last slot
    expect(dayIndex('2020-01-01T00:00:00Z', w)).toBe(-1);
  });
});
