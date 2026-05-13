/**
 * Unit tests for the pure helpers exported from VendorMatchingEngine —
 *   - computeEffectiveWeights (toggle + renormalization)
 *   - inferNoMatchReason (sanitized reason inference)
 *
 * These intentionally exercise the helpers directly (no engine + no DB)
 * because they encode the David/Doug overlay semantics and the "why no
 * match" categorization Doug asked for.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEffectiveWeights,
  inferNoMatchReason,
} from '../vendor-matching-engine.service';
import type { VendorMatchingCriteriaProfile } from '../../types/vendor-marketplace.types';

const baselineCriteria: VendorMatchingCriteriaProfile['criteria'] = {
  performance: { enabled: true, weight: 0.30, mode: 'SCORED' },
  availability: { enabled: true, weight: 0.25, mode: 'SCORED' },
  proximity: {
    enabled: true,
    weight: 0.20,
    mode: 'SCORED',
    primaryRadiusMiles: 50,
    expansionRadiusMiles: 100,
  },
  experience: { enabled: true, weight: 0.15, mode: 'SCORED' },
  cost: { enabled: true, weight: 0.10, mode: 'SCORED' },
  licensure: { enabled: false, weight: 0, mode: 'HARD_GATE' },
};

describe('computeEffectiveWeights', () => {
  it('returns weights identical to input when every SCORED criterion is enabled and sum is 1', () => {
    const w = computeEffectiveWeights(baselineCriteria);
    expect(w.performance).toBeCloseTo(0.30, 5);
    expect(w.availability).toBeCloseTo(0.25, 5);
    expect(w.proximity).toBeCloseTo(0.20, 5);
    expect(w.experience).toBeCloseTo(0.15, 5);
    expect(w.cost).toBeCloseTo(0.10, 5);
  });

  it('zeros out a disabled criterion and renormalizes the rest', () => {
    const proximityOff: VendorMatchingCriteriaProfile['criteria'] = {
      ...baselineCriteria,
      proximity: { ...baselineCriteria.proximity, enabled: false },
    };
    const w = computeEffectiveWeights(proximityOff);
    expect(w.proximity).toBe(0);
    // Remaining weights (0.30 + 0.25 + 0.15 + 0.10 = 0.80) renormalized to 1.0
    const sum = w.performance + w.availability + w.experience + w.cost;
    expect(sum).toBeCloseTo(1.0, 5);
    expect(w.performance).toBeCloseTo(0.30 / 0.80, 5); // 0.375
    expect(w.cost).toBeCloseTo(0.10 / 0.80, 5); // 0.125
  });

  it('treats proximity as zero-weight when mode = HARD_GATE (even if enabled)', () => {
    const proximityHardGate: VendorMatchingCriteriaProfile['criteria'] = {
      ...baselineCriteria,
      proximity: { ...baselineCriteria.proximity, mode: 'HARD_GATE' },
    };
    const w = computeEffectiveWeights(proximityHardGate);
    expect(w.proximity).toBe(0);
    const sum = w.performance + w.availability + w.experience + w.cost;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('falls back to legacy weights when no SCORED criterion remains', () => {
    const allDisabled: VendorMatchingCriteriaProfile['criteria'] = {
      performance: { enabled: false, weight: 0, mode: 'SCORED' },
      availability: { enabled: false, weight: 0, mode: 'SCORED' },
      proximity: { enabled: false, weight: 0, mode: 'SCORED', primaryRadiusMiles: 50 },
      experience: { enabled: false, weight: 0, mode: 'SCORED' },
      cost: { enabled: false, weight: 0, mode: 'SCORED' },
      licensure: { enabled: false, weight: 0, mode: 'HARD_GATE' },
    };
    const w = computeEffectiveWeights(allDisabled);
    expect(w).toEqual({
      performance: 0.30,
      availability: 0.25,
      proximity: 0.20,
      experience: 0.15,
      cost: 0.10,
    });
  });

  it('handles non-normalized input weights — renormalizes correctly', () => {
    const doubled: VendorMatchingCriteriaProfile['criteria'] = {
      performance: { enabled: true, weight: 0.60, mode: 'SCORED' },
      availability: { enabled: true, weight: 0.50, mode: 'SCORED' },
      proximity: {
        enabled: true,
        weight: 0.40,
        mode: 'SCORED',
        primaryRadiusMiles: 50,
      },
      experience: { enabled: true, weight: 0.30, mode: 'SCORED' },
      cost: { enabled: true, weight: 0.20, mode: 'SCORED' },
      licensure: { enabled: false, weight: 0, mode: 'HARD_GATE' },
    };
    const w = computeEffectiveWeights(doubled);
    const sum = w.performance + w.availability + w.proximity + w.experience + w.cost;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe('inferNoMatchReason', () => {
  it('returns NO_VENDOR_WITHIN_RADIUS with hints when the denied list is empty', () => {
    const reason = inferNoMatchReason([], { radiusUsed: 50 });
    expect(reason.code).toBe('NO_VENDOR_WITHIN_RADIUS');
    expect(reason.message).toMatch(/50 miles/);
    expect(reason.hints?.length).toBeGreaterThan(0);
  });

  it('categorizes licensure denials', () => {
    const reason = inferNoMatchReason(
      [{ vendorId: 'v-1', denyReasons: ['Not licensed in target state'] }],
      { radiusUsed: 50, productState: 'FL' },
    );
    expect(reason.code).toBe('NO_LICENSED_VENDOR_IN_STATE');
    expect(reason.message).toMatch(/FL/);
  });

  it('categorizes proximity denials', () => {
    const reason = inferNoMatchReason(
      [
        { vendorId: 'v-1', denyReasons: ['too far — 200 miles from property'] },
        { vendorId: 'v-2', denyReasons: ['distance threshold exceeded'] },
      ],
      { radiusUsed: 100 },
    );
    expect(reason.code).toBe('NO_VENDOR_WITHIN_RADIUS');
    expect(reason.message).toMatch(/100 miles/);
  });

  it('categorizes capacity denials', () => {
    const reason = inferNoMatchReason(
      [{ vendorId: 'v-1', denyReasons: ['at capacity'] }],
      { radiusUsed: 50 },
    );
    expect(reason.code).toBe('NO_VENDOR_WITH_CAPACITY');
  });

  it('categorizes tier denials', () => {
    const reason = inferNoMatchReason(
      [{ vendorId: 'v-1', denyReasons: ['tier below minimum'] }],
      { radiusUsed: 50 },
    );
    expect(reason.code).toBe('NO_VENDOR_MEETS_TIER');
  });

  it('falls back to ALL_VENDORS_EXCLUDED_BY_RULES for unrecognized reasons', () => {
    const reason = inferNoMatchReason(
      [{ vendorId: 'v-1', denyReasons: ['something custom'] }],
      { radiusUsed: 50 },
    );
    expect(reason.code).toBe('ALL_VENDORS_EXCLUDED_BY_RULES');
  });

  it('picks the dominant category when multiple are present', () => {
    const reason = inferNoMatchReason(
      [
        { vendorId: 'v-1', denyReasons: ['at capacity'] },
        { vendorId: 'v-2', denyReasons: ['at capacity'] },
        { vendorId: 'v-3', denyReasons: ['licensure missing'] },
      ],
      { radiusUsed: 50 },
    );
    expect(reason.code).toBe('NO_VENDOR_WITH_CAPACITY');
  });

  it('omits hints on inferred categories (only the empty-denied path adds them)', () => {
    const reason = inferNoMatchReason(
      [{ vendorId: 'v-1', denyReasons: ['licensure missing'] }],
      { radiusUsed: 50 },
    );
    expect(reason.hints).toBeUndefined();
  });
});
