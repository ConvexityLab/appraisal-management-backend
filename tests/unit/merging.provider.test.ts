/**
 * MergingPropertyDataProvider — Unit Tests
 *
 * Tests cover:
 *   - Throws on empty provider array
 *   - Returns null when all providers return null
 *   - Returns null when all providers throw
 *   - Returns the only non-null result as-is (no unnecessary copying)
 *   - Fires all providers concurrently (does not short-circuit)
 *   - Merges results field-by-field: earlier provider's value wins per field
 *   - Fills in fields from later provider when earlier provider's field is null
 *   - Skips throwing providers and merges the rest
 *   - Combined source name is joined from all contributing providers
 *   - rawProviderData retains all provider payloads
 */

import { describe, it, expect, vi } from 'vitest';
import { MergingPropertyDataProvider } from '../../src/services/property-data-providers/merging.provider.js';
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

/** Bridge-like result: rich MLS building data, no public-record layer */
function makeBridgeResult(): PropertyDataResult {
  return {
    source: 'Bridge Interactive',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    core: {
      grossLivingArea: 1800,
      bedrooms:        3,
      bathsFull:       2,
      bathsHalf:       1,
      yearBuilt:       2005,
      lotSizeSqFt:     null,  // Bridge didn't supply lot size
      parcelNumber:    null,  // Bridge didn't supply APN
      latitude:        null,
      longitude:       null,
    },
    publicRecord: {
      taxAssessedValue: null,  // Bridge has no tax data
      zoning:           null,
      ownerName:        null,
    },
    flood: {
      femaFloodZone: null,
    },
    rawProviderData: { from: 'bridge' },
  };
}

/** ATTOM-like result: public-record data, APN, flood — thin on MLS characteristics */
function makeAttomResult(): PropertyDataResult {
  return {
    source: 'ATTOM Data Solutions',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    core: {
      grossLivingArea: 1750,  // assessor's GLA (different from MLS)
      bedrooms:        null,
      bathsFull:       null,
      bathsHalf:       null,
      yearBuilt:       2005,
      lotSizeSqFt:     6000,
      parcelNumber:    '123-456-789',
      latitude:        39.7392,
      longitude:       -104.9903,
    },
    publicRecord: {
      taxAssessedValue: 420000,
      zoning:           'R-1',
      ownerName:        'Jane Smith',
    },
    flood: {
      femaFloodZone:  'X',
      femaMapNumber:  '08031C0204H',
      femaMapDate:    '2019-08-28',
    },
    rawProviderData: { from: 'attom' },
  };
}

function makeProvider(result: PropertyDataResult | null): PropertyDataProvider {
  return {
    lookupByAddress: vi.fn().mockResolvedValue(result),
  };
}

function makeThrowingProvider(msg: string): PropertyDataProvider {
  return {
    lookupByAddress: vi.fn().mockRejectedValue(new Error(msg)),
  };
}

// ─── Construction ─────────────────────────────────────────────────────────────

describe('MergingPropertyDataProvider — construction', () => {
  it('throws when created with an empty provider array', () => {
    expect(() => new MergingPropertyDataProvider([])).toThrow(
      'at least one provider is required',
    );
  });
});

// ─── All-null / all-throw ─────────────────────────────────────────────────────

describe('MergingPropertyDataProvider — no data', () => {
  it('returns null when all providers return null', async () => {
    const chain = new MergingPropertyDataProvider([
      makeProvider(null),
      makeProvider(null),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });

  it('returns null when all providers throw', async () => {
    const chain = new MergingPropertyDataProvider([
      makeThrowingProvider('Bridge down'),
      makeThrowingProvider('ATTOM down'),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });
});

// ─── Single result ────────────────────────────────────────────────────────────

describe('MergingPropertyDataProvider — single non-null result', () => {
  it('returns the single non-null result directly', async () => {
    const r = makeBridgeResult();
    const chain = new MergingPropertyDataProvider([
      makeProvider(null),
      makeProvider(r),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result).toBe(r); // same reference — no copying
  });
});

// ─── Key behavior: fires ALL providers (no short-circuit) ────────────────────

describe('MergingPropertyDataProvider — fires all providers', () => {
  it('calls every provider regardless of whether earlier ones returned data', async () => {
    const p1 = makeProvider(makeBridgeResult());
    const p2 = makeProvider(makeAttomResult());

    const chain = new MergingPropertyDataProvider([p1, p2]);
    await chain.lookupByAddress(PARAMS);

    expect(p1.lookupByAddress).toHaveBeenCalledOnce();
    expect(p2.lookupByAddress).toHaveBeenCalledOnce();
  });

  it('calls every provider even when the first one returns null', async () => {
    const p1 = makeProvider(null);
    const p2 = makeProvider(makeAttomResult());

    const chain = new MergingPropertyDataProvider([p1, p2]);
    await chain.lookupByAddress(PARAMS);

    expect(p1.lookupByAddress).toHaveBeenCalledOnce();
    expect(p2.lookupByAddress).toHaveBeenCalledOnce();
  });
});

// ─── Field-level merge ────────────────────────────────────────────────────────

describe('MergingPropertyDataProvider — field-level merge', () => {
  it('prefers Bridge GLA over ATTOM assessor GLA (first provider wins per field)', async () => {
    const bridge = makeBridgeResult();
    const attom  = makeAttomResult();
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);

    // Bridge GLA (1800) should win over ATTOM's assessor GLA (1750)
    expect(result?.core?.grossLivingArea).toBe(1800);
  });

  it('fills in ATTOM parcelNumber when Bridge did not supply it', async () => {
    const bridge = makeBridgeResult(); // parcelNumber: null
    const attom  = makeAttomResult(); // parcelNumber: '123-456-789'
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.core?.parcelNumber).toBe('123-456-789');
  });

  it('fills in ATTOM flood data when Bridge flood section is absent', async () => {
    const bridge = makeBridgeResult(); // femaFloodZone: null
    const attom  = makeAttomResult(); // femaFloodZone: 'X'
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.flood?.femaFloodZone).toBe('X');
    expect(result?.flood?.femaMapNumber).toBe('08031C0204H');
  });

  it('fills in ATTOM tax assessment when Bridge publicRecord has none', async () => {
    const bridge = makeBridgeResult(); // taxAssessedValue: null
    const attom  = makeAttomResult(); // taxAssessedValue: 420000
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.publicRecord?.taxAssessedValue).toBe(420000);
    expect(result?.publicRecord?.ownerName).toBe('Jane Smith');
  });

  it('fills in ATTOM lat/lng when Bridge had no coordinates', async () => {
    const bridge = makeBridgeResult(); // latitude: null
    const attom  = makeAttomResult(); // latitude: 39.7392
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.core?.latitude).toBeCloseTo(39.7392);
    expect(result?.core?.longitude).toBeCloseTo(-104.9903);
  });

  it('keeps Bridge bedrooms even when ATTOM has null for the same field', async () => {
    const bridge = makeBridgeResult(); // bedrooms: 3
    const attom  = makeAttomResult(); // bedrooms: null
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.core?.bedrooms).toBe(3);
  });

  it('fills in lotSizeSqFt from ATTOM when Bridge did not supply it', async () => {
    const bridge = makeBridgeResult(); // lotSizeSqFt: null
    const attom  = makeAttomResult(); // lotSizeSqFt: 6000
    const chain  = new MergingPropertyDataProvider([makeProvider(bridge), makeProvider(attom)]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.core?.lotSizeSqFt).toBe(6000);
  });
});

// ─── Combined source / raw data ───────────────────────────────────────────────

describe('MergingPropertyDataProvider — metadata', () => {
  it('sets source to joined provider names', async () => {
    const chain = new MergingPropertyDataProvider([
      makeProvider(makeBridgeResult()),
      makeProvider(makeAttomResult()),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.source).toContain('Bridge Interactive');
    expect(result?.source).toContain('ATTOM Data Solutions');
  });

  it('retains rawProviderData from both providers', async () => {
    const chain = new MergingPropertyDataProvider([
      makeProvider(makeBridgeResult()),
      makeProvider(makeAttomResult()),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(Array.isArray(result?.rawProviderData)).toBe(true);
    const raw = result?.rawProviderData as Array<{ source: string; data: unknown }>;
    expect(raw).toHaveLength(2);
    expect(raw[0]!.source).toBe('Bridge Interactive');
    expect(raw[1]!.source).toBe('ATTOM Data Solutions');
  });
});

// ─── Fault tolerance ──────────────────────────────────────────────────────────

describe('MergingPropertyDataProvider — fault tolerance', () => {
  it('skips a throwing provider and returns the other provider\'s data', async () => {
    const attom = makeAttomResult();
    const chain = new MergingPropertyDataProvider([
      makeThrowingProvider('Bridge API down'),
      makeProvider(attom),
    ]);

    const result = await chain.lookupByAddress(PARAMS);
    expect(result?.source).toBe(attom.source);
    expect(result?.publicRecord?.taxAssessedValue).toBe(420000);
  });

  it('returns null when one provider throws and other returns null', async () => {
    const chain = new MergingPropertyDataProvider([
      makeThrowingProvider('Bridge down'),
      makeProvider(null),
    ]);
    const result = await chain.lookupByAddress(PARAMS);
    expect(result).toBeNull();
  });
});
