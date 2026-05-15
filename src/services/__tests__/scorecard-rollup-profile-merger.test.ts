/**
 * Tests for the overlay-merging core + validation of the scorecard rollup
 * resolver. The resolver walks BASE → CLIENT → PRODUCT → CLIENT_PRODUCT and
 * calls applyOverlay() for each layer. These tests fix the merge semantics:
 *
 *   - categoryWeights is REPLACED WHOLE (preserves sum-to-1 invariant)
 *   - other fields override field-by-field (window, timeDecay, gates,
 *     penalties, tierThresholds, derivedSignalBlendWeight, customFormulaOverride)
 *   - renormalizeWeights is a safety net for hand-edited rows that drifted
 *   - validateProfilePayload enforces required shape + tier monotonicity
 */

import { describe, it, expect } from 'vitest';
import {
  applyOverlay,
  renormalizeWeights,
  validateProfilePayload,
  DEFAULT_BASE_PROFILE,
} from '../scorecard-rollup-profile.service';
import type {
  ResolvedScorecardRollupProfile,
  ScorecardRollupProfile,
} from '../../types/vendor-marketplace.types';

function baseline(): ResolvedScorecardRollupProfile {
  return {
    categoryWeights: { ...DEFAULT_BASE_PROFILE.categoryWeights },
    window: { ...DEFAULT_BASE_PROFILE.window },
    timeDecay: { ...DEFAULT_BASE_PROFILE.timeDecay },
    derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
    gates: [...DEFAULT_BASE_PROFILE.gates],
    penalties: [...DEFAULT_BASE_PROFILE.penalties],
    tierThresholds: { ...DEFAULT_BASE_PROFILE.tierThresholds },
    appliedProfileIds: [],
  };
}

function overlay(
  partial: Partial<ScorecardRollupProfile>,
): ScorecardRollupProfile {
  return {
    id: 'p-overlay',
    tenantId: 't1',
    type: 'scorecard-rollup-profile',
    scope: { kind: 'CLIENT', clientId: 'c1' },
    phase: 'ORIGINAL',
    version: 1,
    active: true,
    categoryWeights: DEFAULT_BASE_PROFILE.categoryWeights,
    window: DEFAULT_BASE_PROFILE.window,
    timeDecay: DEFAULT_BASE_PROFILE.timeDecay,
    derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
    gates: [],
    penalties: [],
    tierThresholds: DEFAULT_BASE_PROFILE.tierThresholds,
    createdAt: '2026-05-13T00:00:00Z',
    createdBy: 'tester',
    ...partial,
  } as ScorecardRollupProfile;
}

describe('applyOverlay', () => {
  it('replaces categoryWeights as a whole object (preserves sum-to-1)', () => {
    const base = baseline();
    const o = overlay({
      categoryWeights: {
        report: 0.4,
        quality: 0.3,
        communication: 0.1,
        turnTime: 0.1,
        professionalism: 0.1,
      },
    });
    const merged = applyOverlay(base, o);
    expect(merged.categoryWeights.report).toBe(0.4);
    expect(merged.categoryWeights.quality).toBe(0.3);
    // Ensures no partial-merge leak from the prior layer.
    const sum =
      merged.categoryWeights.report +
      merged.categoryWeights.quality +
      merged.categoryWeights.communication +
      merged.categoryWeights.turnTime +
      merged.categoryWeights.professionalism;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('overrides window when overlay supplies one, otherwise keeps base', () => {
    const base = baseline();
    const o = overlay({
      window: { mode: 'TRAILING_ORDERS', size: 50, minSampleSize: 5 },
    });
    const merged = applyOverlay(base, o);
    expect(merged.window.size).toBe(50);
    expect(merged.window.minSampleSize).toBe(5);
  });

  it('replaces gates wholesale (later overlay wins)', () => {
    const base = baseline();
    const o = overlay({
      gates: [
        {
          type: 'min_in_category',
          category: 'quality',
          minScore: 3,
          clampToTier: 'BRONZE',
        },
      ],
    });
    const merged = applyOverlay(base, o);
    expect(merged.gates).toHaveLength(1);
    expect(merged.gates[0]!.category).toBe('quality');
    expect(merged.gates[0]!.clampToTier).toBe('BRONZE');
  });

  it('replaces penalties wholesale', () => {
    const base = baseline();
    const o = overlay({
      penalties: [{ signal: 'revision_count', perUnit: 2, cap: 10 }],
    });
    const merged = applyOverlay(base, o);
    expect(merged.penalties).toHaveLength(1);
    expect(merged.penalties[0]!.perUnit).toBe(2);
  });

  it('replaces tierThresholds wholesale', () => {
    const base = baseline();
    const o = overlay({
      tierThresholds: { PLATINUM: 95, GOLD: 80, SILVER: 65, BRONZE: 50 },
    });
    const merged = applyOverlay(base, o);
    expect(merged.tierThresholds.PLATINUM).toBe(95);
    expect(merged.tierThresholds.BRONZE).toBe(50);
  });

  it('clamps derivedSignalBlendWeight into [0,1]', () => {
    const base = baseline();
    const high = applyOverlay(base, overlay({ derivedSignalBlendWeight: 1.5 }));
    const low = applyOverlay(base, overlay({ derivedSignalBlendWeight: -0.2 }));
    expect(high.derivedSignalBlendWeight).toBe(1);
    expect(low.derivedSignalBlendWeight).toBe(0);
  });

  it('carries customFormulaOverride through when overlay sets it', () => {
    const base = baseline();
    const o = overlay({
      customFormulaOverride: { '+': [{ var: 'quality.avg' }, 1] },
    });
    const merged = applyOverlay(base, o);
    expect(merged.customFormulaOverride).toEqual({
      '+': [{ var: 'quality.avg' }, 1],
    });
  });
});

describe('renormalizeWeights', () => {
  it('rescales weights to sum to 1', () => {
    const out = renormalizeWeights({
      report: 2,
      quality: 1,
      communication: 1,
      turnTime: 1,
      professionalism: 1,
    });
    const sum =
      out.report + out.quality + out.communication + out.turnTime + out.professionalism;
    expect(sum).toBeCloseTo(1, 5);
    expect(out.report).toBeCloseTo(0.333, 2);
    expect(out.quality).toBeCloseTo(0.167, 2);
  });

  it('falls back to equal-weight when sum <= 0', () => {
    const out = renormalizeWeights({
      report: 0,
      quality: 0,
      communication: 0,
      turnTime: 0,
      professionalism: 0,
    });
    expect(out.report).toBe(0.2);
    expect(out.professionalism).toBe(0.2);
  });
});

describe('validateProfilePayload', () => {
  function valid() {
    return {
      scope: { kind: 'BASE' as const },
      phase: 'ANY' as const,
      categoryWeights: { ...DEFAULT_BASE_PROFILE.categoryWeights },
      window: { ...DEFAULT_BASE_PROFILE.window },
      timeDecay: { ...DEFAULT_BASE_PROFILE.timeDecay },
      derivedSignalBlendWeight: 0.5,
      gates: [],
      penalties: [],
      tierThresholds: { ...DEFAULT_BASE_PROFILE.tierThresholds },
    };
  }

  it('accepts a default BASE payload', () => {
    const errors = validateProfilePayload(valid());
    expect(errors).toEqual([]);
  });

  it('rejects CLIENT scope without clientId', () => {
    const errors = validateProfilePayload({ ...valid(), scope: { kind: 'CLIENT' } });
    expect(errors.some((e) => e.includes('clientId'))).toBe(true);
  });

  it('rejects PRODUCT scope without productType', () => {
    const errors = validateProfilePayload({ ...valid(), scope: { kind: 'PRODUCT' } });
    expect(errors.some((e) => e.includes('productType'))).toBe(true);
  });

  it('rejects non-strictly-descending tier thresholds (GOLD == SILVER)', () => {
    const errors = validateProfilePayload({
      ...valid(),
      tierThresholds: { PLATINUM: 90, GOLD: 70, SILVER: 70, BRONZE: 40 },
    });
    expect(errors.some((e) => e.includes('strictly descending'))).toBe(true);
  });

  it('rejects negative category weights', () => {
    const errors = validateProfilePayload({
      ...valid(),
      categoryWeights: {
        report: -0.1,
        quality: 0.3,
        communication: 0.3,
        turnTime: 0.3,
        professionalism: 0.2,
      },
    });
    expect(errors.some((e) => e.includes('categoryWeights.report'))).toBe(true);
  });

  it('rejects window.size < 1', () => {
    const errors = validateProfilePayload({
      ...valid(),
      window: { mode: 'TRAILING_ORDERS', size: 0, minSampleSize: 3 },
    });
    expect(errors.some((e) => e.includes('window.size'))).toBe(true);
  });
});
