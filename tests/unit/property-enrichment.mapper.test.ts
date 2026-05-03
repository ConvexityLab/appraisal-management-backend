import { describe, expect, it } from 'vitest';
import { mapPropertyEnrichmentToCanonical } from '../../src/mappers/property-enrichment.mapper.js';
import type { PropertyDataResult } from '../../src/types/property-data.types.js';

const FETCHED_AT = '2026-04-01T12:00:00.000Z';

function makeResult(partial: Partial<PropertyDataResult>): PropertyDataResult {
  return {
    source: 'test-provider',
    fetchedAt: FETCHED_AT,
    ...partial,
  };
}

describe('mapPropertyEnrichmentToCanonical', () => {
  describe('null / empty input', () => {
    it('returns null for null/undefined', () => {
      expect(mapPropertyEnrichmentToCanonical(null)).toBeNull();
      expect(mapPropertyEnrichmentToCanonical(undefined)).toBeNull();
    });

    it('returns null when result has only metadata (no core/publicRecord/flood)', () => {
      expect(mapPropertyEnrichmentToCanonical(makeResult({}))).toBeNull();
    });

    it('returns null when all sections are present but empty objects', () => {
      expect(
        mapPropertyEnrichmentToCanonical(
          makeResult({ core: {}, publicRecord: {}, flood: {} }),
        ),
      ).toBeNull();
    });
  });

  describe('core mapping', () => {
    it('maps building characteristics onto subject', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({
          core: {
            grossLivingArea: 1850,
            totalRooms: 7,
            bedrooms: 3,
            bathsFull: 2,
            bathsHalf: 1,
            yearBuilt: 1985,
            effectiveAge: 12,
            lotSizeSqFt: 7800,
            propertyType: 'Single Family Residential',
            stories: 2,
            garage: '2-car attached',
            basement: 'Full',
            parcelNumber: 'APN-123-456-789',
            latitude: 41.8201,
            longitude: -71.5012,
          },
        }),
      );
      expect(out?.subject).toMatchObject({
        grossLivingArea: 1850,
        totalRooms: 7,
        bedrooms: 3,
        bathsFull: 2,
        bathsHalf: 1,
        bathrooms: 2.5,
        yearBuilt: 1985,
        effectiveAge: 12,
        lotSizeSqFt: 7800,
        propertyType: 'Single Family Residential',
        stories: 2,
        garageType: '2-car attached',
        basement: 'Full',
        parcelNumber: 'APN-123-456-789',
        latitude: 41.8201,
        longitude: -71.5012,
      });
    });

    it('maps county into subject.address as a partial address patch', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({ core: { county: 'Providence' } }),
      );
      expect(out?.subject?.address).toEqual({ county: 'Providence' });
    });

    it('omits null fields from output', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({
          core: {
            grossLivingArea: 1850,
            yearBuilt: null,
            bedrooms: null,
            propertyType: null,
          },
        }),
      );
      const subject = out?.subject as Record<string, unknown>;
      expect(subject['grossLivingArea']).toBe(1850);
      expect(subject).not.toHaveProperty('yearBuilt');
      expect(subject).not.toHaveProperty('bedrooms');
      expect(subject).not.toHaveProperty('propertyType');
    });

    it('computes bathrooms aggregate from full only when half is missing', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({ core: { bathsFull: 2 } }),
      );
      expect(out?.subject?.bathsFull).toBe(2);
      expect(out?.subject?.bathrooms).toBe(2);
    });

    it('omits bathrooms when neither full nor half is present', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({ core: { yearBuilt: 1985 } }),
      );
      const subject = out?.subject as Record<string, unknown>;
      expect(subject).not.toHaveProperty('bathrooms');
    });
  });

  describe('public-record mapping', () => {
    it('maps public-record fields onto subject', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({
          publicRecord: {
            taxAssessedValue: 450000,
            taxYear: 2025,
            annualTaxAmount: 6200,
            legalDescription: 'LOT 17 BLK 4 PLAT 12',
            zoning: 'R-7',
            ownerName: 'JANE DOE',
          },
        }),
      );
      expect(out?.subject).toMatchObject({
        taxYear: 2025,
        annualTaxes: 6200,
        legalDescription: 'LOT 17 BLK 4 PLAT 12',
        zoning: 'R-7',
        currentOwner: 'JANE DOE',
      });
    });

    it('does NOT emit taxAssessedValue (lives on PropertyRecord time series)', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({ publicRecord: { taxAssessedValue: 450000 } }),
      );
      // taxAssessedValue is the only field — and we don't emit it — so output is null.
      expect(out).toBeNull();
    });
  });

  describe('flood mapping', () => {
    it('maps FEMA flood fields onto subject', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({
          flood: {
            femaFloodZone: 'X',
            femaMapNumber: '44007C0123H',
            femaMapDate: '2014-09-29',
          },
        }),
      );
      expect(out?.subject).toMatchObject({
        floodZone: 'X',
        floodMapNumber: '44007C0123H',
        floodMapDate: '2014-09-29',
      });
    });
  });

  describe('combined mapping', () => {
    it('merges core + publicRecord + flood into a single subject partial', () => {
      const out = mapPropertyEnrichmentToCanonical(
        makeResult({
          core: { grossLivingArea: 1850, parcelNumber: 'APN-1', county: 'Providence' },
          publicRecord: { zoning: 'R-7' },
          flood: { femaFloodZone: 'X' },
        }),
      );
      expect(out?.subject).toMatchObject({
        grossLivingArea: 1850,
        parcelNumber: 'APN-1',
        zoning: 'R-7',
        floodZone: 'X',
      });
      expect(out?.subject?.address).toEqual({ county: 'Providence' });
    });
  });
});
