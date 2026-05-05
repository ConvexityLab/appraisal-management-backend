/**
 * assignCompTier — boundary tests
 */

import { describe, expect, it } from 'vitest';

import { assignCompTier } from '../../src/config/comp-tiering.config';

const subject = { gla: 2000, bedrooms: 3, bathrooms: 2 };

function todayMinusDaysISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('assignCompTier', () => {
  it('returns tier 1 for exact-match candidate within tight thresholds', () => {
    const tier = assignCompTier(
      subject,
      { gla: 2000, bedrooms: 3, bathrooms: 2, lastSaleDate: todayMinusDaysISO(30) },
      0.25,
    );
    expect(tier).toBe(1);
  });

  it('returns tier 2 when bath diff hits exactly 1 (tier 1 is strict <)', () => {
    const tier = assignCompTier(
      subject,
      { gla: 2000, bedrooms: 3, bathrooms: 3, lastSaleDate: todayMinusDaysISO(30) },
      0.25,
    );
    expect(tier).toBe(2);
  });

  it('returns tier 5 (catch-all) when nothing matches but distance is known', () => {
    const tier = assignCompTier(
      subject,
      { gla: 1000, bedrooms: 8, bathrooms: 9, lastSaleDate: todayMinusDaysISO(2000) },
      50,
    );
    expect(tier).toBe(5);
  });

  it('returns null when distance is null', () => {
    const tier = assignCompTier(
      subject,
      { gla: 2000, bedrooms: 3, bathrooms: 2, lastSaleDate: todayMinusDaysISO(30) },
      null,
    );
    expect(tier).toBeNull();
  });

  it('throws when subject.gla is 0', () => {
    expect(() =>
      assignCompTier(
        { gla: 0, bedrooms: 3, bathrooms: 2 },
        { gla: 2000, bedrooms: 3, bathrooms: 2, lastSaleDate: todayMinusDaysISO(30) },
        0.25,
      ),
    ).toThrow(/subject\.gla/);
  });

  it('treats missing lastSaleDate as Infinity (drops out of tiers 1–4)', () => {
    const tier = assignCompTier(
      subject,
      { gla: 2000, bedrooms: 3, bathrooms: 2, lastSaleDate: null },
      0.25,
    );
    expect(tier).toBe(5);
  });
});
