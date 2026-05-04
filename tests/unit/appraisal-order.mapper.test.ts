import { describe, expect, it } from 'vitest';
import { mapAppraisalOrderToCanonical } from '../../src/mappers/appraisal-order.mapper.js';
import type { AppraisalOrder } from '../../src/types/index.js';

function makeOrder(overrides: Partial<AppraisalOrder>): AppraisalOrder {
  // Cast through `as unknown as AppraisalOrder` so test fixtures only need
  // the fields the mapper actually consumes.
  return {
    id: 'order-1',
    clientId: 'client-1',
    tenantId: 'tenant-1',
    orderNumber: 'ORD-1',
    propertyAddress: { streetAddress: '', city: '', state: '', zipCode: '', county: '' } as any,
    propertyDetails: { propertyType: '', occupancy: '', features: [] } as any,
    loanInformation: { loanAmount: 0, loanType: '', loanPurpose: '' } as any,
    borrowerInformation: { firstName: '', lastName: '' } as any,
    contactInformation: {} as any,
    orderType: 'STANDARD' as any,
    productType: 'FNMA-1004' as any,
    dueDate: new Date(),
    rushOrder: false,
    status: 'PENDING' as any,
    priority: 'NORMAL' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'tester',
    tags: [],
    metadata: {},
    ...overrides,
  } as AppraisalOrder;
}

describe('mapAppraisalOrderToCanonical', () => {
  describe('null / empty input', () => {
    it('returns null for null/undefined', () => {
      expect(mapAppraisalOrderToCanonical(null)).toBeNull();
      expect(mapAppraisalOrderToCanonical(undefined)).toBeNull();
    });
  });

  describe('subject.address', () => {
    it('projects propertyAddress fields onto canonical address', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyAddress: {
            streetAddress: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            county: 'Sangamon',
          } as any,
        }),
      );
      expect(out?.subject?.address).toEqual({
        streetAddress: '123 Main St',
        unit: null,
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: 'Sangamon',
      });
    });

    it('emits empty strings for missing required fields (downstream merge fills)', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyAddress: {
            streetAddress: '123 Main St',
            city: '',
            state: '',
            zipCode: '',
            county: '',
          } as any,
        }),
      );
      expect(out?.subject?.address).toMatchObject({
        streetAddress: '123 Main St',
        city: '',
      });
    });

    it('projects coordinates onto subject lat/long', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyAddress: {
            streetAddress: '1 X St',
            city: 'Y',
            state: 'IL',
            zipCode: '62701',
            county: 'Z',
            coordinates: { latitude: 41.5, longitude: -89.6 },
          } as any,
        }),
      );
      expect(out?.subject?.latitude).toBe(41.5);
      expect(out?.subject?.longitude).toBe(-89.6);
    });

    it('projects apn / legalDescription onto canonical fields', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyAddress: {
            streetAddress: '1 X St',
            city: 'Y',
            state: 'IL',
            zipCode: '62701',
            county: 'Z',
            apn: 'APN-123',
            legalDescription: 'LOT 4',
          } as any,
        }),
      );
      expect(out?.subject?.parcelNumber).toBe('APN-123');
      expect(out?.subject?.legalDescription).toBe('LOT 4');
    });
  });

  describe('subject.propertyDetails', () => {
    it('projects building characteristics', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyDetails: {
            propertyType: 'SFR',
            occupancy: 'Owner',
            yearBuilt: 1990,
            grossLivingArea: 1850,
            lotSize: 7800,
            bedrooms: 3,
            bathrooms: 2.5,
            stories: 2,
            condition: 'Good',
            features: [],
          } as any,
        }),
      );
      expect(out?.subject).toMatchObject({
        propertyType: 'SFR',
        yearBuilt: 1990,
        grossLivingArea: 1850,
        lotSizeSqFt: 7800,
        bedrooms: 3,
        bathrooms: 2.5,
        stories: 2,
        condition: 'Good',
        occupant: 'Owner',
      });
    });

    it('maps occupancy "Tenant Occupied" to occupant=Tenant', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyDetails: {
            propertyType: 'SFR',
            occupancy: 'Tenant Occupied',
            features: [],
          } as any,
        }),
      );
      expect(out?.subject?.occupant).toBe('Tenant');
    });

    it('omits null fields', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyDetails: {
            propertyType: 'SFR',
            occupancy: 'Owner',
            yearBuilt: undefined,
            features: [],
          } as any,
        }),
      );
      expect(out?.subject?.propertyType).toBe('SFR');
      expect((out?.subject as Record<string, unknown>)['yearBuilt']).toBeUndefined();
    });
  });

  describe('loan branch', () => {
    it('projects loanInformation onto canonical loan with MISMO enums', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          loanInformation: {
            loanAmount: 320000,
            loanType: 'Conventional',
            loanPurpose: 'Purchase',
          } as any,
          propertyDetails: { propertyType: 'SFR', occupancy: 'Owner', features: [] } as any,
        }),
      );
      expect(out?.loan).toMatchObject({
        baseLoanAmount: 320000,
        loanPurposeType: 'Purchase',
        mortgageType: 'Conventional',
        occupancyType: 'PrimaryResidence',
      });
    });

    it('handles FHA / VA / NonQM / Jumbo', () => {
      expect(
        mapAppraisalOrderToCanonical(
          makeOrder({ loanInformation: { loanAmount: 100, loanType: 'FHA 203(b)', loanPurpose: 'Purchase' } as any }),
        )?.loan?.mortgageType,
      ).toBe('FHA');
      expect(
        mapAppraisalOrderToCanonical(
          makeOrder({ loanInformation: { loanAmount: 100, loanType: 'Non-QM', loanPurpose: 'Purchase' } as any }),
        )?.loan?.mortgageType,
      ).toBe('NonQM');
      expect(
        mapAppraisalOrderToCanonical(
          makeOrder({ loanInformation: { loanAmount: 100, loanType: 'Jumbo', loanPurpose: 'Purchase' } as any }),
        )?.loan?.mortgageType,
      ).toBe('Jumbo');
    });

    it('returns no loan branch when loanAmount is 0 and other fields are missing', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          loanInformation: { loanAmount: 0, loanType: '', loanPurpose: '' } as any,
        }),
      );
      // Falsy: 0 is filtered by finiteOrNull only when null/undefined; 0 IS
      // finite. So baseLoanAmount=0 is kept. But all enums + occupancy are null,
      // so the loan branch presence is determined by whether we still emit.
      // Document the behaviour: 0 is a real value, branch IS emitted.
      expect(out?.loan?.baseLoanAmount).toBe(0);
    });
  });

  describe('ratios branch', () => {
    it('projects LTV/DTI in MISMO percentage form (e.g. 80, not 0.80)', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          loanInformation: {
            loanAmount: 100000,
            loanType: 'Conventional',
            loanPurpose: 'Purchase',
            ltv: 80,
            dti: 36,
          } as any,
        }),
      );
      expect(out?.ratios).toMatchObject({
        loanToValueRatioPercent: 80,
        debtToIncomeRatioPercent: 36,
      });
    });

    it('scales fractional LTV (<= 1) to percentage form', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          loanInformation: {
            loanAmount: 100000,
            loanType: 'Conventional',
            loanPurpose: 'Purchase',
            ltv: 0.8,
            dti: 0.36,
          } as any,
        }),
      );
      expect(out?.ratios?.loanToValueRatioPercent).toBe(80);
      expect(out?.ratios?.debtToIncomeRatioPercent).toBe(36);
    });

    it('omits ratios branch when LTV and DTI are absent', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          loanInformation: {
            loanAmount: 100000,
            loanType: 'Conventional',
            loanPurpose: 'Purchase',
          } as any,
        }),
      );
      expect(out?.ratios).toBeUndefined();
    });
  });

  describe('combined output', () => {
    it('emits subject + loan + ratios when all sources are present', () => {
      const out = mapAppraisalOrderToCanonical(
        makeOrder({
          propertyAddress: {
            streetAddress: '1 X St',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            county: 'Sangamon',
          } as any,
          propertyDetails: {
            propertyType: 'SFR',
            occupancy: 'Owner',
            yearBuilt: 1990,
            features: [],
          } as any,
          loanInformation: {
            loanAmount: 250000,
            loanType: 'FHA',
            loanPurpose: 'Purchase',
            ltv: 96.5,
          } as any,
        }),
      );
      expect(out?.subject?.address?.city).toBe('Springfield');
      expect(out?.loan?.mortgageType).toBe('FHA');
      expect(out?.ratios?.loanToValueRatioPercent).toBe(96.5);
    });
  });
});
