/**
 * Tests for the profile-driven extensions to VendorPerformanceCalculatorService:
 *
 *   - applyGates: hard gates clamp tier DOWN, never UP
 *   - measurePenaltySignal: aggregates revision_count / late_delivery_days /
 *     reassignment_count across the order set
 *   - computeScorecardBlend: per-category weighted means, min-sample-size,
 *     time decay, and the final 0-100 weighted average
 *
 * Private methods are exercised via bracket-access — these are internal
 * algorithm primitives that need targeted coverage independent of the DB
 * fetch path.
 */

import { describe, it, expect } from 'vitest';
import { VendorPerformanceCalculatorService } from '../vendor-performance-calculator.service';
import type {
  ResolvedScorecardRollupProfile,
  ScorecardGate,
} from '../../types/vendor-marketplace.types';
import type { Order } from '../../types';
import { OrderStatus } from '../../types/order-status';

type CalcAny = VendorPerformanceCalculatorService & {
  applyGates: (
    tier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PROBATION',
    gates: ScorecardGate[],
    categoryAverages: Record<string, number | null>,
  ) => 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PROBATION';
  measurePenaltySignal: (
    signal: 'revision_count' | 'late_delivery_days' | 'reassignment_count',
    orders: Order[],
  ) => number;
  computeScorecardBlend: (
    orders: Order[],
    profile?: ResolvedScorecardRollupProfile,
  ) => { overallOnHundredScale: number; sampleCount: number; categoryAverages: Record<string, number | null> } | null;
};

function makeOrderWithScorecard(opts: {
  id: string;
  scores: { report: number; quality: number; communication: number; turnTime: number; professionalism: number };
  reviewedAt: string;
  status?: OrderStatus;
}): Order {
  return {
    id: opts.id,
    tenantId: 't-1',
    orderNumber: `ORD-${opts.id}`,
    status: opts.status ?? OrderStatus.DELIVERED,
    type: 'order',
    completedAt: opts.reviewedAt,
    scorecards: [
      {
        id: `sc-${opts.id}`,
        reviewedBy: 'reviewer-1',
        reviewedAt: opts.reviewedAt,
        overallScore:
          (opts.scores.report +
            opts.scores.quality +
            opts.scores.communication +
            opts.scores.turnTime +
            opts.scores.professionalism) /
          5,
        scores: {
          report: { value: opts.scores.report },
          quality: { value: opts.scores.quality },
          communication: { value: opts.scores.communication },
          turnTime: { value: opts.scores.turnTime },
          professionalism: { value: opts.scores.professionalism },
        },
      },
    ],
  } as unknown as Order;
}

function calc(): CalcAny {
  return new VendorPerformanceCalculatorService() as CalcAny;
}

describe('VendorPerformanceCalculatorService.applyGates', () => {
  const gate = (category: ScorecardGate['category'], minScore: ScorecardGate['minScore'], clampToTier: ScorecardGate['clampToTier']): ScorecardGate => ({
    type: 'min_in_category',
    category,
    minScore,
    clampToTier,
  });

  it('clamps DOWN when category average falls below the minimum', () => {
    const out = calc().applyGates('PLATINUM', [gate('quality', 4, 'BRONZE')], {
      quality: 3.5,
    });
    expect(out).toBe('BRONZE');
  });

  it('does NOT clamp UP when current tier is already lower than clampToTier', () => {
    const out = calc().applyGates('BRONZE', [gate('quality', 4, 'GOLD')], {
      quality: 3.5,
    });
    // Gate would "clamp to GOLD" — but GOLD is higher than BRONZE, so no-op.
    expect(out).toBe('BRONZE');
  });

  it('skips a gate whose category has no signal yet (null average)', () => {
    const out = calc().applyGates('PLATINUM', [gate('quality', 4, 'BRONZE')], {
      quality: null,
    });
    expect(out).toBe('PLATINUM');
  });

  it('applies multiple gates and picks the strictest applicable clamp', () => {
    const out = calc().applyGates(
      'PLATINUM',
      [gate('quality', 4, 'GOLD'), gate('professionalism', 3, 'BRONZE')],
      { quality: 3.5, professionalism: 2 },
    );
    expect(out).toBe('BRONZE');
  });
});

describe('VendorPerformanceCalculatorService.measurePenaltySignal', () => {
  it('sums revision_count across orders', () => {
    const orders = [
      { revisionCount: 2 },
      { revisionCount: 1 },
      { revisionCount: 0 },
      {},
    ] as unknown as Order[];
    expect(calc().measurePenaltySignal('revision_count', orders)).toBe(3);
  });

  it('sums positive late days (early deliveries ignored)', () => {
    const orders = [
      { dueDate: '2026-01-01T00:00:00Z', deliveredDate: '2026-01-04T00:00:00Z' }, // +3
      { dueDate: '2026-01-10T00:00:00Z', deliveredDate: '2026-01-08T00:00:00Z' }, // -2, ignored
      { dueDate: '2026-01-20T00:00:00Z', deliveredDate: '2026-01-25T00:00:00Z' }, // +5
    ] as unknown as Order[];
    expect(calc().measurePenaltySignal('late_delivery_days', orders)).toBe(8);
  });

  it('returns 0 when no late_delivery signal data exists', () => {
    const orders = [{}, { dueDate: '2026-01-01' }] as unknown as Order[];
    expect(calc().measurePenaltySignal('late_delivery_days', orders)).toBe(0);
  });

  it('sums reassignment_count across orders', () => {
    const orders = [
      { reassignmentCount: 1 },
      { reassignmentCount: 2 },
    ] as unknown as Order[];
    expect(calc().measurePenaltySignal('reassignment_count', orders)).toBe(3);
  });
});

describe('VendorPerformanceCalculatorService.computeScorecardBlend', () => {
  function profile(overrides: Partial<ResolvedScorecardRollupProfile> = {}): ResolvedScorecardRollupProfile {
    return {
      categoryWeights: {
        report: 0.2,
        quality: 0.2,
        communication: 0.2,
        turnTime: 0.2,
        professionalism: 0.2,
      },
      window: { mode: 'TRAILING_ORDERS', size: 25, minSampleSize: 1 },
      timeDecay: { enabled: false, halfLifeDays: 180 },
      derivedSignalBlendWeight: 0.5,
      gates: [],
      penalties: [],
      tierThresholds: { PLATINUM: 90, GOLD: 75, SILVER: 60, BRONZE: 40 },
      appliedProfileIds: [],
      ...overrides,
    };
  }

  it('returns null when sample count < minSampleSize', () => {
    const orders = [
      makeOrderWithScorecard({
        id: '1',
        scores: { report: 5, quality: 5, communication: 5, turnTime: 5, professionalism: 5 },
        reviewedAt: '2026-05-01T00:00:00Z',
      }),
    ];
    const out = calc().computeScorecardBlend(orders, profile({ window: { mode: 'TRAILING_ORDERS', size: 25, minSampleSize: 3 } }));
    expect(out).toBeNull();
  });

  it('produces equal-weighted average on a 0-100 scale (5/5 = 100)', () => {
    const orders = Array.from({ length: 3 }).map((_, i) =>
      makeOrderWithScorecard({
        id: String(i),
        scores: { report: 5, quality: 5, communication: 5, turnTime: 5, professionalism: 5 },
        reviewedAt: `2026-0${i + 1}-01T00:00:00Z`,
      }),
    );
    const out = calc().computeScorecardBlend(orders, profile());
    expect(out).not.toBeNull();
    expect(out!.overallOnHundredScale).toBe(100);
    expect(out!.sampleCount).toBe(3);
  });

  it('honors category weights — quality at 1.0 yields quality * 20', () => {
    const orders = [
      makeOrderWithScorecard({
        id: '1',
        scores: { report: 1, quality: 4, communication: 1, turnTime: 1, professionalism: 1 },
        reviewedAt: '2026-05-01T00:00:00Z',
      }),
    ];
    const out = calc().computeScorecardBlend(
      orders,
      profile({
        categoryWeights: { report: 0, quality: 1, communication: 0, turnTime: 0, professionalism: 0 },
      }),
    );
    expect(out!.overallOnHundredScale).toBe(80); // 4 * 1.0 * 20
  });

  it('exposes per-category averages for gate evaluation', () => {
    const orders = [
      makeOrderWithScorecard({
        id: '1',
        scores: { report: 5, quality: 2, communication: 4, turnTime: 4, professionalism: 4 },
        reviewedAt: '2026-05-01T00:00:00Z',
      }),
      makeOrderWithScorecard({
        id: '2',
        scores: { report: 5, quality: 4, communication: 4, turnTime: 4, professionalism: 4 },
        reviewedAt: '2026-05-02T00:00:00Z',
      }),
    ];
    const out = calc().computeScorecardBlend(orders, profile());
    expect(out!.categoryAverages.quality).toBe(3); // (2 + 4) / 2
    expect(out!.categoryAverages.report).toBe(5);
  });

  it('time decay: older samples weigh less when enabled', () => {
    // Same orders, but decay enabled with very short half-life — newest
    // sample (5/5) should dominate over older (1/1) sample.
    const recent = makeOrderWithScorecard({
      id: 'recent',
      scores: { report: 5, quality: 5, communication: 5, turnTime: 5, professionalism: 5 },
      reviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const ancient = makeOrderWithScorecard({
      id: 'ancient',
      scores: { report: 1, quality: 1, communication: 1, turnTime: 1, professionalism: 1 },
      reviewedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const out = calc().computeScorecardBlend(
      [recent, ancient],
      profile({ timeDecay: { enabled: true, halfLifeDays: 7 } }),
    );
    // With 7-day half-life and 1-day vs 365-day samples, the ancient
    // sample's weight is effectively zero — average should be near 5 → 100.
    expect(out!.overallOnHundredScale).toBeGreaterThan(95);
  });
});
