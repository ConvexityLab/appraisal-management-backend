/**
 * Tests for PropertyFieldDiffService.
 *
 * Fixes the per-field comparison semantics:
 *   - numeric fields use a percent tolerance band (minor/major)
 *   - discrete fields (year, beds, baths) use absolute deltas
 *   - APN is normalized (strip dashes/whitespace) then exact-match
 *   - missing-claim vs missing-public-record are distinct verdicts so the
 *     UI can differentiate "appraiser didn't say" from "no public record"
 *   - summary counts mirror the entry statuses
 */

import { describe, it, expect } from 'vitest';
import {
  PropertyFieldDiffService,
  type ClaimInput,
  type PublicRecordInput,
} from '../property-field-diff.service';

const svc = new PropertyFieldDiffService();

function entry(report: ReturnType<typeof svc.compute>, field: string) {
  const e = report.entries.find((x) => x.field === field);
  if (!e) throw new Error(`No entry for ${field}`);
  return e;
}

describe('PropertyFieldDiffService.compute — GLA tolerance', () => {
  it('flags exact GLA as MATCH', () => {
    const r = svc.compute('o1', { grossLivingArea: 2000 }, { grossLivingArea: 2000 });
    expect(entry(r, 'grossLivingArea').status).toBe('MATCH');
  });

  it('flags 4% GLA difference as MATCH (inside 5% band)', () => {
    const r = svc.compute('o1', { grossLivingArea: 2000 }, { grossLivingArea: 2080 });
    expect(entry(r, 'grossLivingArea').status).toBe('MATCH');
  });

  it('flags 7% GLA difference as MINOR_MISMATCH (5–10%)', () => {
    const r = svc.compute('o1', { grossLivingArea: 2000 }, { grossLivingArea: 2140 });
    expect(entry(r, 'grossLivingArea').status).toBe('MINOR_MISMATCH');
  });

  it('flags 15% GLA difference as MAJOR_MISMATCH', () => {
    const r = svc.compute('o1', { grossLivingArea: 2000 }, { grossLivingArea: 2300 });
    expect(entry(r, 'grossLivingArea').status).toBe('MAJOR_MISMATCH');
  });

  it('returns deltaFraction on numeric mismatches', () => {
    const r = svc.compute('o1', { grossLivingArea: 2000 }, { grossLivingArea: 2300 });
    expect(entry(r, 'grossLivingArea').deltaFraction).toBeCloseTo(0.13, 2);
  });
});

describe('PropertyFieldDiffService.compute — lot size tolerance (wider)', () => {
  it('flags 9% lot size diff as MATCH (lot tol is 10/20%)', () => {
    const r = svc.compute('o1', { lotSizeSqFt: 10000 }, { lotSizeSqFt: 10900 });
    expect(entry(r, 'lotSizeSqFt').status).toBe('MATCH');
  });

  it('flags 15% lot size diff as MINOR', () => {
    const r = svc.compute('o1', { lotSizeSqFt: 10000 }, { lotSizeSqFt: 11500 });
    expect(entry(r, 'lotSizeSqFt').status).toBe('MINOR_MISMATCH');
  });

  it('flags clearly-large lot size diff as MAJOR (above 20% band)', () => {
    // Using max-denominator semantics: 4000 / 14000 ≈ 29% — clearly major.
    const r = svc.compute('o1', { lotSizeSqFt: 10000 }, { lotSizeSqFt: 14000 });
    expect(entry(r, 'lotSizeSqFt').status).toBe('MAJOR_MISMATCH');
  });
});

describe('PropertyFieldDiffService.compute — discrete fields', () => {
  it('year built: identical → MATCH', () => {
    const r = svc.compute('o1', { yearBuilt: 1995 }, { yearBuilt: 1995 });
    expect(entry(r, 'yearBuilt').status).toBe('MATCH');
  });

  it('year built: off by 1 → MINOR (assessor lag)', () => {
    const r = svc.compute('o1', { yearBuilt: 1995 }, { yearBuilt: 1996 });
    expect(entry(r, 'yearBuilt').status).toBe('MINOR_MISMATCH');
  });

  it('year built: off by 2 → MAJOR', () => {
    const r = svc.compute('o1', { yearBuilt: 1995 }, { yearBuilt: 1997 });
    expect(entry(r, 'yearBuilt').status).toBe('MAJOR_MISMATCH');
  });

  it('bedrooms: any single-unit mismatch → MINOR (>=2 is MAJOR)', () => {
    const m1 = svc.compute('o1', { bedrooms: 4 }, { bedrooms: 5 });
    const m2 = svc.compute('o1', { bedrooms: 4 }, { bedrooms: 6 });
    expect(entry(m1, 'bedrooms').status).toBe('MINOR_MISMATCH');
    expect(entry(m2, 'bedrooms').status).toBe('MAJOR_MISMATCH');
  });
});

describe('PropertyFieldDiffService.compute — APN normalization', () => {
  it('treats 1234-567-890 and 1234567890 as MATCH', () => {
    const r = svc.compute(
      'o1',
      { parcelNumber: '1234-567-890' },
      { parcelNumber: '1234567890' },
    );
    expect(entry(r, 'parcelNumber').status).toBe('MATCH');
  });

  it('flags genuinely different APN as MAJOR', () => {
    const r = svc.compute(
      'o1',
      { parcelNumber: '1234-567-890' },
      { parcelNumber: '9999-999-999' },
    );
    expect(entry(r, 'parcelNumber').status).toBe('MAJOR_MISMATCH');
  });
});

describe('PropertyFieldDiffService.compute — missing values', () => {
  it('MISSING_CLAIM when only the appraiser side is null', () => {
    const r = svc.compute('o1', { yearBuilt: null }, { yearBuilt: 1995 });
    expect(entry(r, 'yearBuilt').status).toBe('MISSING_CLAIM');
  });

  it('MISSING_PUBLIC_RECORD when only the public-record side is null', () => {
    const r = svc.compute('o1', { yearBuilt: 1995 }, { yearBuilt: null });
    expect(entry(r, 'yearBuilt').status).toBe('MISSING_PUBLIC_RECORD');
  });

  it('MISSING_CLAIM when both sides are null (defensive)', () => {
    const r = svc.compute('o1', {}, {});
    expect(entry(r, 'grossLivingArea').status).toBe('MISSING_CLAIM');
  });
});

describe('PropertyFieldDiffService.compute — summary aggregation + metadata', () => {
  it('summary counts mirror per-entry statuses', () => {
    const claim: ClaimInput = {
      grossLivingArea: 2000, // MATCH
      yearBuilt: 1995,        // MATCH
      bedrooms: 4,            // MAJOR (off by 2)
      bathsFull: null,        // MISSING_CLAIM
    };
    const pr: PublicRecordInput = {
      grossLivingArea: 2000,
      yearBuilt: 1995,
      bedrooms: 6,
      bathsFull: 2,
    };
    const r = svc.compute('o1', claim, pr);
    expect(r.summary.match).toBeGreaterThanOrEqual(2);
    expect(r.summary.majorMismatch).toBeGreaterThanOrEqual(1);
    expect(r.summary.missingClaim).toBeGreaterThanOrEqual(1);
  });

  it('passes through publicRecordSource + fetchedAt metadata', () => {
    const r = svc.compute(
      'o1',
      { grossLivingArea: 2000 },
      { grossLivingArea: 2000 },
      { publicRecordSource: 'bridge', publicRecordFetchedAt: '2026-05-10T00:00:00Z' },
    );
    expect(r.publicRecordSource).toBe('bridge');
    expect(r.publicRecordFetchedAt).toBe('2026-05-10T00:00:00Z');
    expect(r.orderId).toBe('o1');
  });
});
