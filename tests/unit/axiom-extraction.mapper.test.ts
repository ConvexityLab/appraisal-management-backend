import { describe, expect, it } from 'vitest';
import { mapAxiomExtractionToCanonical } from '../../src/mappers/axiom-extraction.mapper.js';

/**
 * Wrapper helpers to build Axiom-shape inputs concisely. Real Axiom
 * extraction wraps every scalar in `{value, confidence, sourceBatch, sourcePages}`.
 * Confidence/source fields are noise for these tests.
 */
function v(value: unknown) {
  return { value, confidence: 0.84, sourceBatch: 'b1', sourcePages: [] };
}

describe('mapAxiomExtractionToCanonical', () => {
  describe('empty / null input', () => {
    it('returns empty object for null/undefined', () => {
      expect(mapAxiomExtractionToCanonical(null)).toEqual({});
      expect(mapAxiomExtractionToCanonical(undefined)).toEqual({});
    });

    it('returns empty object for non-object input', () => {
      expect(mapAxiomExtractionToCanonical(42)).toEqual({});
      expect(mapAxiomExtractionToCanonical('hello')).toEqual({});
      expect(mapAxiomExtractionToCanonical([])).toEqual({});
    });
  });

  describe('subject.address', () => {
    it('maps propertyAddress block to subject.address with UAD field names', () => {
      const out = mapAxiomExtractionToCanonical({
        propertyAddress: {
          street: v('17 David Dr'),
          city: v('Johnston'),
          state: v('RI'),
          zipCode: v(2919),
        },
      });
      expect(out.subject?.address).toEqual({
        streetAddress: '17 David Dr',
        unit: null,
        city: 'Johnston',
        state: 'RI',
        zipCode: '02919',  // ZIP padded to 5 chars from numeric 2919
        county: '',
      });
    });

    it('omits subject.address entirely when no address fields are present', () => {
      const out = mapAxiomExtractionToCanonical({
        propertyAddress: { street: null, city: null, state: null, zipCode: null },
      });
      expect(out.subject).toBeUndefined();
    });

    it('handles partial address (street only)', () => {
      const out = mapAxiomExtractionToCanonical({
        propertyAddress: { street: v('17 David Dr'), city: null, state: null, zipCode: null },
      });
      expect(out.subject?.address?.streetAddress).toBe('17 David Dr');
      expect(out.subject?.address?.city).toBe('');
    });
  });

  describe('subject scalar fields', () => {
    it('maps yearBuilt, GLA, beds/baths, parcelNumber, condition, quality, design', () => {
      const out = mapAxiomExtractionToCanonical({
        yearBuilt: v(54),
        grossLivingArea: v(1440),
        totalBedrooms: v(3),
        totalBathrooms: v(1),
        assessorsParcelNumber: v(9810147749),
        legalDescription: v('Lot 14 Block 3 of subdivision X'),
        overallConditionRating: v('Average'),
        overallQualityRating: v('Average'),
        constructionType: v('DT1;Raised Ranch'),
        zoning: v('R-1'),
        siteSize: v('10197 sf'),
        heatingType: v('FHW'),
        coolingType: v('None'),
      });
      expect(out.subject?.yearBuilt).toBe(54);
      expect(out.subject?.grossLivingArea).toBe(1440);
      expect(out.subject?.bedrooms).toBe(3);
      expect(out.subject?.bathrooms).toBe(1);
      expect(out.subject?.parcelNumber).toBe('9810147749');
      expect(out.subject?.legalDescription).toBe('Lot 14 Block 3 of subdivision X');
      expect(out.subject?.condition).toBe('Average');
      expect(out.subject?.quality).toBe('Average');
      expect(out.subject?.design).toBe('DT1;Raised Ranch');
      expect(out.subject?.zoning).toBe('R-1');
      expect(out.subject?.lotSizeSqFt).toBe(10197);  // parsed leading number from "10197 sf"
      expect(out.subject?.heating).toBe('FHW');
      expect(out.subject?.cooling).toBe('None');
    });

    it('maps occupancyType strings to UAD enum values', () => {
      expect(mapAxiomExtractionToCanonical({ occupancyType: v('Owner Occupied') }).subject?.occupant).toBe('Owner');
      expect(mapAxiomExtractionToCanonical({ occupancyType: v('tenant') }).subject?.occupant).toBe('Tenant');
      expect(mapAxiomExtractionToCanonical({ occupancyType: v('VACANT') }).subject?.occupant).toBe('Vacant');
    });
  });

  describe('comps', () => {
    it('flattens comparable1/2/3 into a comps[] array with slot indices', () => {
      const out = mapAxiomExtractionToCanonical({
        comparable1: { address: v('29 Camille Dr, Johnston, RI 02919'), salePrice: v(480029), proximity: v('0.82 miles N') },
        comparable2: { address: v('423 George Waterman Rd, Johnston, RI 02919'), salePrice: v(400000) },
        comparable3: { address: v('19 Contillo Dr, Johnston, RI 02919'), salePrice: v(460000) },
      });
      expect(out.comps).toHaveLength(3);
      expect(out.comps?.[0]?.compId).toBe('axiom-comp-1');
      expect(out.comps?.[0]?.salePrice).toBe(480029);
      expect(out.comps?.[0]?.distanceFromSubjectMiles).toBe(0.82);  // parsed leading number from "0.82 miles N"
      expect(out.comps?.[1]?.salePrice).toBe(400000);
    });

    it('parses free-text comp address into structured CanonicalAddress', () => {
      const out = mapAxiomExtractionToCanonical({
        comparable1: { address: v('29 Camille Dr, Johnston, RI 02919') },
      });
      expect(out.comps?.[0]?.address).toEqual({
        streetAddress: '29 Camille Dr',
        unit: null,
        city: 'Johnston',
        state: 'RI',
        zipCode: '02919',
        county: '',
      });
    });

    it('skips a comparable slot when it is null or empty', () => {
      const out = mapAxiomExtractionToCanonical({
        comparable1: { address: v('29 Camille Dr, Johnston, RI 02919') },
        comparable2: null,
        comparable3: { address: v('19 Contillo Dr, Johnston, RI 02919') },
      });
      expect(out.comps).toHaveLength(2);
      expect(out.comps?.[0]?.compId).toBe('axiom-comp-1');
      expect(out.comps?.[1]?.compId).toBe('axiom-comp-3');  // slotIndex preserves the original slot
    });
  });

  describe('appraiserInfo', () => {
    it('maps appraiserName/license/company → CanonicalAppraiserInfo fields', () => {
      const out = mapAxiomExtractionToCanonical({
        appraiserName: v('Margaret M. Demopulos'),
        appraiserLicenseNumber: v('CRA.0A00902'),
        appraiserCompanyName: v('Demopulos Appraisals'),
        dateOfReport: v('10/23/2025'),
      });
      expect(out.appraiserInfo).toMatchObject({
        name: 'Margaret M. Demopulos',
        licenseNumber: 'CRA.0A00902',
        companyName: 'Demopulos Appraisals',
        signatureDate: '10/23/2025',
      });
    });

    it('falls back to effectiveDateOfAppraisal when dateOfReport is missing', () => {
      const out = mapAxiomExtractionToCanonical({
        appraiserName: v('A B'),
        effectiveDateOfAppraisal: v('03/04/2026'),
      });
      expect((out.appraiserInfo as Record<string, unknown> | undefined)?.signatureDate).toBe('03/04/2026');
    });

    it('omits appraiserInfo entirely when no appraiser fields are present', () => {
      const out = mapAxiomExtractionToCanonical({ propertyAddress: { street: v('a') } });
      expect(out.appraiserInfo).toBeUndefined();
    });
  });

  describe('reconciliation', () => {
    it('maps opinionOfMarketValue and approach values → CanonicalReconciliation', () => {
      const out = mapAxiomExtractionToCanonical({
        opinionOfMarketValue: v(450000),
        indicatedValueBySalesComparison: v(450000),
        indicatedValueByCostApproach: v(440000),
        indicatedValueByIncomeApproach: null,
        effectiveDateOfAppraisal: v('10/21/2025'),
      });
      expect(out.reconciliation).toMatchObject({
        finalOpinionOfValue: 450000,
        salesCompApproachValue: 450000,
        costApproachValue: 440000,
        effectiveDate: '10/21/2025',
      });
      // Income approach not present → field omitted (not 0)
      expect((out.reconciliation as Record<string, unknown>).incomeApproachValue).toBeUndefined();
    });
  });

  describe('end-to-end with realistic seed-order-003 extraction', () => {
    it('produces all the fields the appraisal-qc criteria need', () => {
      const out = mapAxiomExtractionToCanonical({
        propertyAddress: {
          street: v('17 David Dr'),
          city: v('Johnston'),
          state: v('RI'),
          zipCode: v(2919),
        },
        assessorsParcelNumber: v(9810147749),
        legalDescription: v('Lot 14 Block 3'),
        yearBuilt: v(54),
        grossLivingArea: v(1440),
        overallConditionRating: v('Average'),
        zoning: v('R-1'),
        appraiserName: v('Margaret M. Demopulos'),
        appraiserLicenseNumber: v('CRA.0A00902'),
        dateOfReport: v('10/23/2025'),
        opinionOfMarketValue: v(450000),
        indicatedValueBySalesComparison: v(450000),
        comparable1: { address: v('29 Camille Dr, Johnston, RI 02919'), salePrice: v(480029), proximity: v('0.82 miles N') },
        comparable2: { address: v('423 George Waterman Rd, Johnston, RI 02919'), salePrice: v(400000), proximity: v('0.59 miles NE') },
        comparable3: { address: v('19 Contillo Dr, Johnston, RI 02919'), salePrice: v(460000), proximity: v('0.16 miles SW') },
      });

      // Criterion 1: PROPERTY_ADDRESS_COMPLETE
      expect(out.subject?.address?.streetAddress).toBe('17 David Dr');
      expect(out.subject?.address?.city).toBe('Johnston');
      expect(out.subject?.address?.state).toBe('RI');
      expect(out.subject?.address?.zipCode).toBe('02919');

      // Criterion 2: PARCEL_ID_MATCHES_TITLE
      expect(out.subject?.parcelNumber).toBe('9810147749');
      expect(out.subject?.legalDescription).toBe('Lot 14 Block 3');

      // Criterion 3: NO_UNACCEPTABLE_APPRAISAL_PRACTICES (appraiser cert)
      expect((out.appraiserInfo as Record<string, unknown>)?.signatureDate).toBe('10/23/2025');
      expect((out.appraiserInfo as Record<string, unknown>)?.licenseNumber).toBe('CRA.0A00902');
      expect((out.appraiserInfo as Record<string, unknown>)?.name).toBe('Margaret M. Demopulos');

      // Criterion 4: PROPERTY_CONDITION_DOCUMENTED
      expect(out.subject?.condition).toBe('Average');

      // Criterion 6: PROPERTY_HIGHEST_BEST_USE
      expect(out.subject?.zoning).toBe('R-1');

      // Criterion 8: THREE_CLOSED_COMPS_USED — comps array length is 3
      expect(out.comps).toHaveLength(3);

      // Criterion 9: COMPS_ARE_SUITABLE_SUBSTITUTES (subject GLA + comps)
      expect(out.subject?.grossLivingArea).toBe(1440);
      expect(out.subject?.yearBuilt).toBe(54);
      expect(out.comps?.[0]?.distanceFromSubjectMiles).toBe(0.82);

      // Criterion 11: VALUE_SUPPORTED_BY_COMPS (reconciliation)
      expect((out.reconciliation as Record<string, unknown>)?.finalOpinionOfValue).toBe(450000);
      expect((out.reconciliation as Record<string, unknown>)?.salesCompApproachValue).toBe(450000);
    });
  });
});
