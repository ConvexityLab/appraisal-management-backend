/**
 * Unit tests for Urar1025Mapper  (R-11)
 *
 * Verifies that the multi-family mapper:
 *  1. Returns all base urar-1004 keys (subject, comps, reconciliation …)
 *  2. Adds `rentalSchedule` / `hasRentalSchedule` / `totalMonthlyRent` from rentalInformation
 *  3. Adds `incomeApproach` / `hasIncomeApproach` / GRM from incomeApproach
 *  4. Adds `rentComps` / `hasRentComps` from incomeApproach.rentComps
 *  5. Gracefully handles docs with no income / rental data
 */

import { describe, it, expect } from 'vitest';
import { Urar1025Mapper } from '../../src/services/report-engine/field-mappers/urar-1025.mapper.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import { SCHEMA_VERSION } from '@l1/shared-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<CanonicalReportDocument> = {}): CanonicalReportDocument {
  return {
    id: 'rpt-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: 'MULTI_FAMILY_1025' as any,
    status: 'draft' as any,
    schemaVersion: SCHEMA_VERSION,
    metadata: { orderId: 'order-1' } as any,
    subject: {
      address: {
        streetAddress: '42 Oak Ave',
        city: 'Charlotte',
        state: 'NC',
        zipCode: '28201',
      },
      parcelNumber: 'CHAR-1001',
    } as any,
    comps: [],
    ...overrides,
  } as CanonicalReportDocument;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Urar1025Mapper', () => {
  const mapper = new Urar1025Mapper();

  it('has the correct mapperKey', () => {
    expect(mapper.mapperKey).toBe('urar-1025');
  });

  it('returns base urar-1004 keys (subject, comps, reconciliation)', () => {
    const ctx = mapper.mapToFieldMap(makeDoc());
    expect(ctx).toHaveProperty('subject');
    expect(ctx).toHaveProperty('primaryComps');
    expect(ctx).toHaveProperty('reconciliation');
  });

  it('returns empty rental schedule and no income approach when data absent', () => {
    const ctx = mapper.mapToFieldMap(makeDoc()) as any;
    expect(ctx.hasRentalSchedule).toBe(false);
    expect(ctx.rentalSchedule).toEqual([]);
    expect(ctx.hasIncomeApproach).toBe(false);
    expect(ctx.incomeApproach).toBeNull();
    expect(ctx.hasRentComps).toBe(false);
    expect(ctx.rentComps).toEqual([]);
  });

  it('populates rentalSchedule from rentalInformation', () => {
    const doc = makeDoc({
      rentalInformation: {
        rentSchedule: [
          {
            unitIdentifier: 'Unit 1',
            currentlyRented: true,
            occupancy: 'Rented',
            monthlyRent: 1200,
            monthToMonth: false,
            leaseStart: '2025-01-01',
            rentControl: false,
          },
          {
            unitIdentifier: 'Unit 2',
            currentlyRented: false,
            occupancy: 'Vacant',
            monthlyRent: 1100,
            monthToMonth: false,
            leaseStart: null,
            rentControl: false,
          },
        ],
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasRentalSchedule).toBe(true);
    expect(ctx.rentalSchedule).toHaveLength(2);
    expect(ctx.rentalSchedule[0].unitIdentifier).toBe('Unit 1');
    expect(ctx.rentalSchedule[0].monthlyRent).toBe('$1,200');
    expect(ctx.rentalSchedule[0].currentlyRented).toBe('Yes');
    expect(ctx.totalMonthlyRentRaw).toBe(2300);
    expect(ctx.totalMonthlyRent).toBe('$2,300');
  });

  it('populates incomeApproach context from incomeApproach data', () => {
    const doc = makeDoc({
      incomeApproach: {
        estimatedMonthlyMarketRent: 2300,
        grossRentMultiplier: 12.5,
        potentialGrossIncome: 27600,
        vacancyRate: 0.05,
        effectiveGrossIncome: 26220,
        operatingExpenses: 8000,
        replacementReserves: 1000,
        netOperatingIncome: 17220,
        capRate: 0.055,
        capRateSource: 'Market data',
        indicatedValueByIncomeApproach: 313000,
        comments: 'Cap rate derived from three comparable sales.',
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasIncomeApproach).toBe(true);
    expect(ctx.incomeApproach.grossRentMultiplier).toBe('12.50');
    expect(ctx.incomeApproach.estimatedMonthlyMarketRent).toBe('$2,300');
    expect(ctx.incomeApproach.vacancyRate).toBe('5.0%');
    expect(ctx.incomeApproach.capRate).toBe('5.5%');
    expect(ctx.incomeApproach.indicatedValueByIncomeApproach).toBe('$313,000');
    expect(ctx.incomeApproach.comments).toBe('Cap rate derived from three comparable sales.');
  });

  it('populates up to 5 rent comps from incomeApproach.rentComps', () => {
    const rentComps = Array.from({ length: 6 }, (_, i) => ({
      address: `${i + 1} Rental Lane`,
      proximityToSubject: '0.5 miles',
      monthlyRent: 1000 + i * 50,
      dataSource: 'MLS',
      propertyDescription: `${4 - (i % 2)} units`,
    }));
    const doc = makeDoc({
      incomeApproach: { rentComps } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    // capped at 5
    expect(ctx.hasRentComps).toBe(true);
    expect(ctx.rentComps).toHaveLength(5);
    expect(ctx.rentComps[0].label).toBe('Comparable Rental 1');
    expect(ctx.rentComps[0].address).toBe('1 Rental Lane');
    expect(ctx.rentComps[0].monthlyRent).toBe('$1,000');
  });

  it('returns hasRentComps=false when rentComps is empty', () => {
    const doc = makeDoc({
      incomeApproach: {
        estimatedMonthlyMarketRent: 1800,
        grossRentMultiplier: 10,
        rentComps: [],
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasRentComps).toBe(false);
    expect(ctx.rentComps).toHaveLength(0);
  });
});
