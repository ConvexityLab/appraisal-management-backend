/**
 * Tests for the overlay-merging core of the criteria resolver.
 *
 * The resolver itself walks BASE → CLIENT → PRODUCT → CLIENT_PRODUCT and
 * calls `mergeCriteria` for each layer that exists. This test fixes the
 * merge semantics: per-criterion override, with proximity treated atomically
 * (so partial proximity overlays don't accidentally drop the radius config).
 */

import { describe, it, expect } from 'vitest';
import { mergeCriteria } from '../vendor-matching-criteria.service';
import type { VendorMatchingCriteriaProfile } from '../../types/vendor-marketplace.types';

function baseline(): VendorMatchingCriteriaProfile['criteria'] {
  return {
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
}

describe('mergeCriteria', () => {
  it('overrides only the keys present in the overlay', () => {
    const base = baseline();
    mergeCriteria(base, {
      performance: { enabled: true, weight: 0.50, mode: 'SCORED' },
    } as never);
    expect(base.performance.weight).toBe(0.50);
    // Untouched keys keep baseline values.
    expect(base.availability.weight).toBe(0.25);
    expect(base.proximity.primaryRadiusMiles).toBe(50);
  });

  it('replaces proximity atomically (override carries its own radii)', () => {
    const base = baseline();
    mergeCriteria(base, {
      proximity: {
        enabled: true,
        weight: 0.05,
        mode: 'SCORED',
        primaryRadiusMiles: 30,
        expansionRadiusMiles: 50,
      },
    } as never);
    expect(base.proximity.primaryRadiusMiles).toBe(30);
    expect(base.proximity.expansionRadiusMiles).toBe(50);
    expect(base.proximity.weight).toBe(0.05);
  });

  it('respects an overlay that disables a criterion (proximity off for DVR)', () => {
    const base = baseline();
    mergeCriteria(base, {
      proximity: {
        enabled: false,
        weight: 0,
        mode: 'SCORED',
        primaryRadiusMiles: 0,
      },
    } as never);
    expect(base.proximity.enabled).toBe(false);
  });

  it('lets an overlay flip licensure to HARD_GATE (Doug: license required for desktop review)', () => {
    const base = baseline();
    mergeCriteria(base, {
      licensure: { enabled: true, weight: 0, mode: 'HARD_GATE' },
    } as never);
    expect(base.licensure.enabled).toBe(true);
    expect(base.licensure.mode).toBe('HARD_GATE');
  });

  it('applies multiple overlays in sequence (BASE → CLIENT → PRODUCT semantics)', () => {
    const base = baseline();
    // CLIENT overlay
    mergeCriteria(base, {
      performance: { enabled: true, weight: 0.40, mode: 'SCORED' },
    } as never);
    // PRODUCT overlay
    mergeCriteria(base, {
      proximity: {
        enabled: false,
        weight: 0,
        mode: 'SCORED',
        primaryRadiusMiles: 0,
      },
    } as never);
    expect(base.performance.weight).toBe(0.40); // from CLIENT
    expect(base.proximity.enabled).toBe(false); // from PRODUCT
    expect(base.availability.weight).toBe(0.25); // untouched
  });
});
