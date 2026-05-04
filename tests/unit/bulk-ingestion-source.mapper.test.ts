import { describe, expect, it } from 'vitest';
import { mapBulkIngestionSourceToCanonical } from '../../src/mappers/bulk-ingestion-source.mapper.js';
import type { BulkIngestionItemInput } from '../../src/types/bulk-ingestion.types.js';

describe('mapBulkIngestionSourceToCanonical', () => {
  describe('null / empty input', () => {
    it('returns null for null/undefined', () => {
      expect(mapBulkIngestionSourceToCanonical(null)).toBeNull();
      expect(mapBulkIngestionSourceToCanonical(undefined)).toBeNull();
    });

    it('returns null when input has no canonical-relevant content', () => {
      const out = mapBulkIngestionSourceToCanonical({
        rowIndex: 1,
        externalId: 'ext-1',
        documentFileName: 'a.pdf',
      } as BulkIngestionItemInput);
      expect(out).toBeNull();
    });
  });

  describe('subject.address', () => {
    it('uses explicit city/state/zip columns when present', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: 'Sangamon',
      });
      expect(out?.subject?.address).toEqual({
        streetAddress: '123 Main St',
        unit: null,
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: 'Sangamon',
      });
    });

    it('parses comma-delimited propertyAddress when explicit columns missing', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St, Springfield, IL 62701',
      });
      expect(out?.subject?.address).toEqual({
        streetAddress: '123 Main St',
        unit: null,
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: '',
      });
    });

    it('explicit columns win over parsed values when both supplied', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St, ParsedCity, ZZ 99999',
        city: 'RealCity',
        state: 'IL',
        zipCode: '62701',
      });
      expect(out?.subject?.address).toMatchObject({
        streetAddress: '123 Main St',
        city: 'RealCity',
        state: 'IL',
        zipCode: '62701',
      });
    });

    it('handles street-only (no commas)', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St',
      });
      expect(out?.subject?.address).toMatchObject({
        streetAddress: '123 Main St',
        city: '',
        state: '',
        zipCode: '',
      });
    });

    it('handles state-only tail', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St, Springfield, IL',
      });
      expect(out?.subject?.address).toMatchObject({
        streetAddress: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '',
      });
    });

    it('handles zip-only tail', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St, Springfield, 62701',
      });
      expect(out?.subject?.address).toMatchObject({
        streetAddress: '123 Main St',
        city: 'Springfield',
        zipCode: '62701',
      });
    });

    it('emits address with county-only when only county is supplied', () => {
      const out = mapBulkIngestionSourceToCanonical({
        county: 'Sangamon',
      });
      expect(out?.subject?.address).toMatchObject({ county: 'Sangamon' });
    });
  });

  describe('subject.propertyType', () => {
    it('passes through propertyType verbatim (no normalisation)', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '1 X St',
        propertyType: 'Single Family Residential',
      });
      expect(out?.subject?.propertyType).toBe('Single Family Residential');
    });

    it('omits propertyType when not supplied', () => {
      const out = mapBulkIngestionSourceToCanonical({ propertyAddress: '1 X St' });
      expect(out?.subject).toBeDefined();
      expect((out?.subject as Record<string, unknown>)['propertyType']).toBeUndefined();
    });
  });

  describe('loan branch', () => {
    it('emits loan when any loan field is present', () => {
      const out = mapBulkIngestionSourceToCanonical({
        loanNumber: 'LN-9988',
        loanAmount: 320000,
        loanPurpose: 'Purchase',
        loanType: 'Conventional',
        occupancyType: 'Owner Occupied',
      });
      expect(out?.loan).toMatchObject({
        loanNumber: 'LN-9988',
        baseLoanAmount: 320000,
        loanPurposeType: 'Purchase',
        mortgageType: 'Conventional',
        occupancyType: 'PrimaryResidence',
      });
    });

    it('normalises loanPurpose tokens', () => {
      expect(
        mapBulkIngestionSourceToCanonical({ loanPurpose: 'refinance' })?.loan?.loanPurposeType,
      ).toBe('Refinance');
      expect(
        mapBulkIngestionSourceToCanonical({ loanPurpose: 'Construction-Perm' })?.loan?.loanPurposeType,
      ).toBe('ConstructionPermanent');
    });

    it('normalises mortgage type tokens', () => {
      expect(
        mapBulkIngestionSourceToCanonical({ loanType: 'FHA 203(b)' })?.loan?.mortgageType,
      ).toBe('FHA');
      expect(
        mapBulkIngestionSourceToCanonical({ loanType: 'Non-QM' })?.loan?.mortgageType,
      ).toBe('NonQM');
      expect(
        mapBulkIngestionSourceToCanonical({ loanType: 'jumbo' })?.loan?.mortgageType,
      ).toBe('Jumbo');
    });

    it('normalises occupancy tokens', () => {
      expect(
        mapBulkIngestionSourceToCanonical({ occupancyType: 'Investor' })?.loan?.occupancyType,
      ).toBe('Investment');
      expect(
        mapBulkIngestionSourceToCanonical({ occupancyType: 'Second Home' })?.loan?.occupancyType,
      ).toBe('SecondHome');
    });

    it('returns null loan when no loan field is present', () => {
      const out = mapBulkIngestionSourceToCanonical({ propertyAddress: '1 X St' });
      expect(out?.loan).toBeUndefined();
    });

    it('omits non-finite loanAmount', () => {
      const out = mapBulkIngestionSourceToCanonical({
        loanNumber: 'LN-1',
        loanAmount: NaN,
      });
      expect(out?.loan?.baseLoanAmount).toBeNull();
    });
  });

  describe('combined output', () => {
    it('emits both subject and loan when present', () => {
      const out = mapBulkIngestionSourceToCanonical({
        propertyAddress: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        propertyType: 'SFR',
        loanNumber: 'LN-1',
        loanAmount: 250000,
        loanPurpose: 'Purchase',
      });
      expect(out?.subject?.address?.streetAddress).toBe('123 Main St');
      expect(out?.subject?.propertyType).toBe('SFR');
      expect(out?.loan?.loanNumber).toBe('LN-1');
      expect(out?.loan?.baseLoanAmount).toBe(250000);
    });
  });
});
