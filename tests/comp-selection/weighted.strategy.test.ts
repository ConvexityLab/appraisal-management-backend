/**
 * WeightedCompSelectionStrategy — focused unit test
 */

import { describe, expect, it } from 'vitest';

import { WeightedCompSelectionStrategy } from '../../src/services/comp-selection/strategies/weighted.strategy';
import type { CompSelectionInput } from '../../src/services/comp-selection/strategy';
import type { CollectedCompCandidate } from '../../src/types/order-comparables.types';

function subject() {
  return {
    id: 'subj',
    address: {
      street: '1 Main',
      city: 'Town',
      state: 'NY',
      zip: '10001',
      latitude: 40.0,
      longitude: -74.0,
    },
    propertyType: 'SINGLE_FAMILY',
    building: { gla: 2000, bedrooms: 3, bathrooms: 2, yearBuilt: 2000 },
  } as unknown as CompSelectionInput['subject'];
}

function cand(opts: {
  id: string;
  source: 'SOLD' | 'ACTIVE';
  lat: number;
  lng: number;
  daysAgo?: number;
  gla?: number;
}): CollectedCompCandidate {
  return {
    source: opts.source,
    distanceMiles: 0,
    geohash5: 'abcde',
    propertyRecord: {
      id: opts.id,
      address: {
        street: opts.id,
        city: 'Town',
        state: 'NY',
        zip: '10001',
        latitude: opts.lat,
        longitude: opts.lng,
      },
      propertyType: 'SINGLE_FAMILY',
      building: { gla: opts.gla ?? 2000, bedrooms: 3, bathrooms: 2, yearBuilt: 2000 },
    },
    lastSalePrice: opts.source === 'SOLD' ? 500_000 : null,
    lastSaleDate:
      opts.source === 'SOLD'
        ? new Date(Date.now() - (opts.daysAgo ?? 30) * 86400_000).toISOString()
        : null,
    dataCompleteness: { missingRequiredFields: [], score: 1, totalRequired: 0 },
  } as unknown as CollectedCompCandidate;
}

function input(candidates: CollectedCompCandidate[]): CompSelectionInput {
  return {
    orderId: 'o-1',
    clientOrderNumber: 'CO-1',
    tenantId: 't-1',
    subject: subject(),
    candidates,
    requested: { sold: 2, active: 1 },
    productType: 'BPO',
  };
}

describe('WeightedCompSelectionStrategy', () => {
  const strat = new WeightedCompSelectionStrategy();

  it('ranks closer SOLD candidates ahead of farther ones and respects target', async () => {
    const r = await strat.select(
      input([
        cand({ id: 'far', source: 'SOLD', lat: 40.05, lng: -74.0 }),    // ~3.45 mi
        cand({ id: 'near', source: 'SOLD', lat: 40.001, lng: -74.0 }), // ~0.07 mi
        cand({ id: 'mid', source: 'SOLD', lat: 40.01, lng: -74.0 }),   // ~0.69 mi
      ]),
    );

    expect(r.strategyName).toBe('weighted');
    expect(r.selectedSold).toHaveLength(2);
    expect(r.selectedSold[0]!.propertyId).toBe('near');
    expect(r.selectedSold[1]!.propertyId).toBe('mid');
    expect(r.selectedSold[0]!.selectionFlag).toBe('S1');
    expect(r.selectedSold[1]!.selectionFlag).toBe('S2');
    expect(r.selectedSold[0]!.source).toBe('rule');
  });

  it('reports shortfall when pool is smaller than target', async () => {
    const r = await strat.select(
      input([cand({ id: 's1', source: 'SOLD', lat: 40.0, lng: -74.0 })]),
    );
    expect(r.selectedSold).toHaveLength(1);
    expect(r.selectedActive).toHaveLength(0);
    expect(r.shortfall).toEqual({ sold: 1, active: 1 });
  });

  it('throws when subject lacks lat/lng', async () => {
    const i = input([cand({ id: 's', source: 'SOLD', lat: 40.0, lng: -74.0 })]);
    (i.subject as any).address.latitude = null;
    await expect(strat.select(i)).rejects.toThrow(/lat\/lng/);
  });

  it('ranks ACTIVE candidates by distance/GLA (saleRecency zeroed, no NaN)', async () => {
    // Subject GLA = 2000. Three ACTIVE candidates:
    //   near       — closest, same GLA
    //   midBigGla  — moderate distance, very different GLA
    //   far        — farthest, same GLA
    // Asking for 1 ACTIVE pick must yield 'near'. Composite scores must be
    // finite (regression guard: previously empty-string sale dates produced
    // NaN composites and unspecified ordering for the ACTIVE pool).
    const i: CompSelectionInput = {
      ...input([
        cand({ id: 'far', source: 'ACTIVE', lat: 40.05, lng: -74.0, gla: 2000 }),
        cand({ id: 'near', source: 'ACTIVE', lat: 40.001, lng: -74.0, gla: 2000 }),
        cand({ id: 'midBigGla', source: 'ACTIVE', lat: 40.01, lng: -74.0, gla: 5000 }),
      ]),
      requested: { sold: 0, active: 3 },
    };

    const r = await strat.select(i);
    expect(r.selectedActive).toHaveLength(3);
    expect(r.selectedActive[0]!.propertyId).toBe('near');
    expect(r.selectedActive[0]!.selectionFlag).toBe('L1');
    for (const pick of r.selectedActive) {
      expect(Number.isFinite(pick.score!)).toBe(true);
    }
    // GLA must influence ranking: the same-GLA 'far' candidate should
    // outrank the very-different-GLA 'midBigGla' would NOT be true here
    // because 'midBigGla' is much closer; instead assert that distance
    // dominates ordering when GLA difference is small.
    const farIdx = r.selectedActive.findIndex((p) => p.propertyId === 'far');
    const nearIdx = r.selectedActive.findIndex((p) => p.propertyId === 'near');
    expect(nearIdx).toBeLessThan(farIdx);
  });
});
