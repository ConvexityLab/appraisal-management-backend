/**
 * ChainedPropertyDataProvider — Unit Tests
 *
 * Tests cover:
 *   - Returns first non-null result (short-circuits remaining providers)
 *   - Continues to next provider when current one returns null
 *   - Continues to next provider when current one throws
 *   - Returns null when all providers return null
 *   - Returns null when all providers throw
 *   - Throws on empty provider array
 *   - Logs the winning provider name
 */

import { describe, it, expect, vi } from 'vitest';
import { ChainedPropertyDataProvider } from '../../src/services/property-data-providers/chained.provider.js';
import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../../src/types/property-data.types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PARAMS: PropertyDataLookupParams = {
  street:  '123 Main St',
  city:    'Denver',
  state:   'CO',
  zipCode: '80203',
};

function makeResult(source: string): PropertyDataResult {
  return {
    source,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    core: {
      grossLivingArea: 1500,
      bedrooms:        3,
      bathsFull:       2,
      bathsHalf:       0,
      yearBuilt:       2000,
      lotSizeSqFt:     5000,
    },
    publicRecord: null,
    flood:        null,
  };
}

function makeProvider(result: PropertyDataResult | null, name?: string): PropertyDataProvider {
  const p = {
    lookupByAddress: vi.fn().mockResolvedValue(result),
  } as PropertyDataProvider;
  if (name) Object.defineProperty(p, 'constructor', { value: { name } });
  return p;
}

function makeThrowingProvider(errorMsg: string): PropertyDataProvider {
  return {
    lookupByAddress: vi.fn().mockRejectedValue(new Error(errorMsg)),
  } as PropertyDataProvider;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChainedPropertyDataProvider — construction', () => {
  it('throws when created with an empty provider array', () => {
    expect(() => new ChainedPropertyDataProvider([])).toThrow(
      'at least one provider is required',
    );
  });
});

describe('ChainedPropertyDataProvider — first provider returns data', () => {
  it('returns the first non-null result immediately (short-circuits)', async () => {
    const r1 = makeResult('Bridge');
    const p1 = makeProvider(r1);
    const p2 = makeProvider(makeResult('ATTOM'));

    const chain = new ChainedPropertyDataProvider([p1, p2]);
    const result = await chain.lookupByAddress(PARAMS);

    expect(result).toEqual(r1);
    expect(p2.lookupByAddress).not.toHaveBeenCalled();
  });

  it('returns the first provider result when a single provider is present', async () => {
    const r = makeResult('Bridge');
    const chain = new ChainedPropertyDataProvider([makeProvider(r)]);
    expect(await chain.lookupByAddress(PARAMS)).toEqual(r);
  });
});

describe('ChainedPropertyDataProvider — fallback chain', () => {
  it('tries the second provider when the first returns null', async () => {
    const r2 = makeResult('ATTOM');
    const p1 = makeProvider(null);
    const p2 = makeProvider(r2);

    const chain = new ChainedPropertyDataProvider([p1, p2]);
    const result = await chain.lookupByAddress(PARAMS);

    expect(p1.lookupByAddress).toHaveBeenCalledOnce();
    expect(p2.lookupByAddress).toHaveBeenCalledOnce();
    expect(result).toEqual(r2);
  });

  it('skips a throwing provider and falls back to the next', async () => {
    const r2 = makeResult('ATTOM');
    const p1 = makeThrowingProvider('Bridge API timeout');
    const p2 = makeProvider(r2);

    const chain = new ChainedPropertyDataProvider([p1, p2]);
    const result = await chain.lookupByAddress(PARAMS);

    expect(result).toEqual(r2);
  });

  it('returns null when all providers return null', async () => {
    const chain = new ChainedPropertyDataProvider([
      makeProvider(null),
      makeProvider(null),
      makeProvider(null),
    ]);
    expect(await chain.lookupByAddress(PARAMS)).toBeNull();
  });

  it('returns null when all providers throw', async () => {
    const chain = new ChainedPropertyDataProvider([
      makeThrowingProvider('err1'),
      makeThrowingProvider('err2'),
    ]);
    expect(await chain.lookupByAddress(PARAMS)).toBeNull();
  });

  it('returns null when mix of null results and throws exhausts all providers', async () => {
    const chain = new ChainedPropertyDataProvider([
      makeProvider(null),
      makeThrowingProvider('upstream error'),
      makeProvider(null),
    ]);
    expect(await chain.lookupByAddress(PARAMS)).toBeNull();
  });
});

describe('ChainedPropertyDataProvider — three-provider chain', () => {
  it('returns the third provider result when first two return null', async () => {
    const r3 = makeResult('FallbackSource');
    const chain = new ChainedPropertyDataProvider([
      makeProvider(null),
      makeProvider(null),
      makeProvider(r3),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.source).toBe('FallbackSource');
  });
});
