import { describe, expect, it } from 'vitest';
import {
  mergePropertyCanonical,
  pickPropertyCanonical,
} from '../../src/mappers/property-canonical-projection.js';
import type { PropertyCurrentCanonicalView } from '../../src/types/property-record.types.js';

describe('pickPropertyCanonical', () => {
  it('returns null for null/undefined', () => {
    expect(pickPropertyCanonical(null)).toBeNull();
    expect(pickPropertyCanonical(undefined)).toBeNull();
  });

  it('returns null when canonical has no property-scoped branches', () => {
    expect(
      pickPropertyCanonical({
        comps: [{} as any],
        loan: {} as any,
        ratios: {} as any,
        valuation: {} as any,
      }),
    ).toBeNull();
  });

  it('picks property-scoped branches and ignores order-scoped ones', () => {
    const out = pickPropertyCanonical({
      subject: { address: { streetAddress: '1 X St' } } as any,
      comps: [{} as any], // ignored
      loan: {} as any, // ignored
      transactionHistory: { subjectPriorTransfers: [] } as any,
      avmCrossCheck: { avmValue: 100000 } as any,
      riskFlags: { chainOfTitleRedFlags: false } as any,
    });
    expect(out?.subject).toBeDefined();
    expect(out?.transactionHistory).toBeDefined();
    expect(out?.avmCrossCheck).toBeDefined();
    expect(out?.riskFlags).toBeDefined();
    expect((out as Record<string, unknown>)['comps']).toBeUndefined();
    expect((out as Record<string, unknown>)['loan']).toBeUndefined();
  });

  it('attaches snapshot metadata when supplied', () => {
    const out = pickPropertyCanonical(
      { subject: { address: { streetAddress: '1' } } as any },
      { snapshotId: 'snap-1', lastSnapshotAt: '2026-04-01T00:00:00.000Z' },
    );
    expect(out?.lastSnapshotId).toBe('snap-1');
    expect(out?.lastSnapshotAt).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('mergePropertyCanonical', () => {
  describe('subject merge', () => {
    it('returns incoming as-is when no existing view', () => {
      const incoming: PropertyCurrentCanonicalView = {
        subject: { yearBuilt: 1990, address: { streetAddress: '1 X' } } as any,
      };
      expect(mergePropertyCanonical(undefined, incoming)).toEqual(incoming);
    });

    it('overlays incoming subject fields on existing (later wins on overlap)', () => {
      const existing: PropertyCurrentCanonicalView = {
        subject: { yearBuilt: 1990, condition: 'C3', bedrooms: 3 } as any,
      };
      const incoming: PropertyCurrentCanonicalView = {
        subject: { yearBuilt: 1991, bathrooms: 2 } as any, // condition not in incoming
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect((out.subject as any).yearBuilt).toBe(1991); // later wins
      expect((out.subject as any).bedrooms).toBe(3); // existing-only survives
      expect((out.subject as any).condition).toBe('C3'); // existing-only survives
      expect((out.subject as any).bathrooms).toBe(2); // incoming-only added
    });

    it('drops empty-string sentinels from incoming so they do not clobber existing', () => {
      const existing: PropertyCurrentCanonicalView = {
        subject: { address: { streetAddress: '17 David Dr', county: 'Providence' } } as any,
      };
      const incoming: PropertyCurrentCanonicalView = {
        subject: { address: { streetAddress: '17 David Dr', county: '' } } as any,
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect((out.subject as any).address.county).toBe('Providence');
    });

    it('deep-merges address field-by-field', () => {
      const existing: PropertyCurrentCanonicalView = {
        subject: { address: { streetAddress: '1 X St', county: 'Providence' } } as any,
      };
      const incoming: PropertyCurrentCanonicalView = {
        subject: { address: { city: 'Johnston', state: 'RI' } } as any,
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect((out.subject as any).address).toEqual({
        streetAddress: '1 X St',
        county: 'Providence',
        city: 'Johnston',
        state: 'RI',
      });
    });
  });

  describe('transactionHistory accumulation', () => {
    it('unions priorTransfers and dedupes by (date, price)', () => {
      const existing: PropertyCurrentCanonicalView = {
        transactionHistory: {
          subjectPriorTransfers: [
            { transactionDate: '2024-01-01', salePrice: 250000 } as any,
          ],
          priorSalePrice24m: 250000,
          priorSaleDate24m: '2024-01-01',
          appreciation24mPercent: null,
          priorSalePrice36m: null,
          priorSaleDate36m: null,
          appreciation36mPercent: null,
        },
      };
      const incoming: PropertyCurrentCanonicalView = {
        transactionHistory: {
          subjectPriorTransfers: [
            { transactionDate: '2024-01-01', salePrice: 250000 } as any, // dupe
            { transactionDate: '2025-06-01', salePrice: 320000 } as any, // new
          ],
          priorSalePrice24m: 320000,
          priorSaleDate24m: '2025-06-01',
          appreciation24mPercent: 28,
          priorSalePrice36m: null,
          priorSaleDate36m: null,
          appreciation36mPercent: null,
        },
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect(out.transactionHistory?.subjectPriorTransfers).toHaveLength(2);
      // Newest-first sort
      expect(out.transactionHistory?.subjectPriorTransfers[0]?.transactionDate).toBe('2025-06-01');
      expect(out.transactionHistory?.subjectPriorTransfers[1]?.transactionDate).toBe('2024-01-01');
      // Latest scalars win
      expect(out.transactionHistory?.priorSalePrice24m).toBe(320000);
      expect(out.transactionHistory?.appreciation24mPercent).toBe(28);
    });

    it('uses incoming history when no existing exists', () => {
      const incoming: PropertyCurrentCanonicalView = {
        transactionHistory: { subjectPriorTransfers: [{ salePrice: 100 } as any] } as any,
      };
      const out = mergePropertyCanonical({}, incoming);
      expect(out.transactionHistory).toBe(incoming.transactionHistory);
    });
  });

  describe('avmCrossCheck and riskFlags', () => {
    it('latest avmCrossCheck wins (it is a snapshot in time)', () => {
      const existing: PropertyCurrentCanonicalView = {
        avmCrossCheck: { avmValue: 100000, avmAsOfDate: '2024-01-01' } as any,
      };
      const incoming: PropertyCurrentCanonicalView = {
        avmCrossCheck: { avmValue: 130000, avmAsOfDate: '2025-04-01' } as any,
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect((out.avmCrossCheck as any).avmValue).toBe(130000);
      expect((out.avmCrossCheck as any).avmAsOfDate).toBe('2025-04-01');
    });

    it('latest riskFlags win', () => {
      const out = mergePropertyCanonical(
        { riskFlags: { chainOfTitleRedFlags: false } as any },
        { riskFlags: { chainOfTitleRedFlags: true } as any },
      );
      expect((out.riskFlags as any).chainOfTitleRedFlags).toBe(true);
    });
  });

  describe('metadata stamping', () => {
    it('updates lastSnapshotId/At from incoming', () => {
      const existing: PropertyCurrentCanonicalView = {
        lastSnapshotId: 'snap-old',
        lastSnapshotAt: '2024-01-01T00:00:00.000Z',
      };
      const incoming: PropertyCurrentCanonicalView = {
        subject: { yearBuilt: 1990 } as any,
        lastSnapshotId: 'snap-new',
        lastSnapshotAt: '2025-06-01T00:00:00.000Z',
      };
      const out = mergePropertyCanonical(existing, incoming);
      expect(out.lastSnapshotId).toBe('snap-new');
      expect(out.lastSnapshotAt).toBe('2025-06-01T00:00:00.000Z');
    });
  });
});
