/**
 * CompBasedValueEstimator — unit tests
 */

import { describe, expect, it } from 'vitest';

import { CompBasedValueEstimator } from '../../src/services/value-estimate/comp-based.estimator';
import type { SelectedCompWithPropertyRecord } from '../../src/services/value-estimate/value-estimator';

function makeSubject(gla: number) {
  return {
    building: { gla, bedrooms: 3, bathrooms: 2 },
  } as unknown as Parameters<CompBasedValueEstimator['compute']>[0];
}

function makeComp(gla: number, avmValue: number | undefined, confidence?: number, propertyId = 'p'): SelectedCompWithPropertyRecord {
  return {
    selected: {
      propertyId,
      street: '1 Main',
      city: 'X',
      state: 'NY',
      zip: '10001',
      selectionFlag: 'S1',
      source: 'ai',
    },
    propertyRecord: {
      building: { gla, bedrooms: 3, bathrooms: 2 },
      avm: avmValue !== undefined ? { value: avmValue, confidence } : undefined,
    } as unknown as SelectedCompWithPropertyRecord['propertyRecord'],
  };
}

describe('CompBasedValueEstimator', () => {
  const est = new CompBasedValueEstimator();

  it('computes mean, min, max, perCompPricePerSqft from usable comps', async () => {
    const subject = makeSubject(2000);
    const comps = [
      makeComp(1000, 200_000, 0.9, 'a'), // ppsf = 200
      makeComp(1000, 250_000, 0.8, 'b'), // ppsf = 250
      makeComp(1000, 300_000, 0.7, 'c'), // ppsf = 300
    ];
    const r = await est.compute(subject, comps);
    expect(r.estimatorName).toBe('comp-based');
    expect(r.estimatedValue).toBe(500_000); // mean ppsf 250 * 2000
    expect(r.lowerBound).toBe(400_000);
    expect(r.upperBound).toBe(600_000);
    expect(r.perCompPricePerSqft).toEqual([200, 250, 300]);
    expect(r.confidence).toBeCloseTo(0.8, 5);
    expect(r.computedAt).toMatch(/T/);
  });

  it('omits confidence when no comp had one', async () => {
    const r = await est.compute(makeSubject(1000), [makeComp(1000, 100_000)]);
    expect(r.confidence).toBeUndefined();
  });

  it('throws when subject.gla <= 0', async () => {
    await expect(
      est.compute(makeSubject(0), [makeComp(1000, 100_000)]),
    ).rejects.toThrow(/subject\.building\.gla/);
  });

  it('throws when soldComps is empty', async () => {
    await expect(est.compute(makeSubject(1000), [])).rejects.toThrow(/empty/);
  });

  it('throws when no comp has a usable avm.value', async () => {
    await expect(
      est.compute(makeSubject(1000), [
        makeComp(1000, undefined),
        makeComp(1000, 0),
      ]),
    ).rejects.toThrow(/none of the/);
  });
});
