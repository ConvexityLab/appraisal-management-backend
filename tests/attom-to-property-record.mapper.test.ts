/**
 * attomToPropertyRecord — unit tests
 *
 * Pure-function mapper from `AttomDataDocument` (third-party row) to the
 * canonical `PropertyRecord` shape used downstream by the comp pipeline.
 *
 * The mapper MUST NOT silently invent data: when a required PropertyRecord
 * field is absent on the source row, a safe placeholder is written AND the
 * field name is recorded in `dataCompleteness.missingRequiredFields` so the
 * caller can decide how strict to be.
 */
import { describe, it, expect } from 'vitest';
import { attomToPropertyRecord } from '../src/mappers/attom-to-property-record.mapper';
import { PropertyRecordType } from '@l1/shared-types';
import type { AttomDataDocument } from '../src/types/attom-data.types';

// ── helpers ────────────────────────────────────────────────────────────────

function makeAttomDoc(overrides: Partial<AttomDataDocument> = {}): AttomDataDocument {
  const base: AttomDataDocument = {
    id: '12345',
    type: 'attom-data',
    geohash5: '9vk1q',
    attomId: '12345',
    apnFormatted: 'APN-001',
    ingestedAt: '2026-04-01T00:00:00.000Z',
    sourcedAt: '2026-03-15T00:00:00.000Z',
    address: {
      full: '123 N MAIN ST',
      houseNumber: '123',
      streetDirection: 'N',
      streetName: 'MAIN',
      streetSuffix: 'ST',
      streetPostDirection: '',
      unitPrefix: '',
      unitValue: '',
      city: 'DALLAS',
      state: 'TX',
      zip: '75225',
      zip4: '1234',
      county: 'DALLAS',
    },
    location: { type: 'Point', coordinates: [-96.78, 32.85] }, // [lon, lat]
    propertyDetail: {
      attomPropertyType: 'SFR',
      attomPropertySubtype: '',
      mlsPropertyType: '',
      mlsPropertySubtype: '',
      yearBuilt: 1995,
      livingAreaSqft: 2200,
      lotSizeAcres: 0.25,
      lotSizeSqft: 10890,
      bedroomsTotal: 4,
      bathroomsFull: 2,
      bathroomsHalf: 1,
      stories: '2',
      garageSpaces: 2,
      poolPrivate: false,
    },
    assessment: {
      taxYear: '2025',
      assessedValueTotal: 350000,
      marketValue: 420000,
      marketValueDate: '2025-01-01',
      taxAmount: 8200,
    },
    salesHistory: { lastSaleDate: '2024-08-15', lastSaleAmount: 410000 },
    mlsData: {
      mlsListingId: '',
      mlsRecordId: '',
      mlsNumber: '',
      mlsSource: '',
      listingStatus: '',
      currentStatus: '',
      listingDate: '',
      latestListingPrice: null,
      previousListingPrice: null,
      soldDate: '',
      soldPrice: null,
      daysOnMarket: null,
      pendingDate: '',
      originalListingDate: '',
      originalListingPrice: null,
    },
    rawData: {},
  };
  return { ...base, ...overrides };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('attomToPropertyRecord', () => {
  it('maps a fully-populated ATTOM doc to a complete PropertyRecord', () => {
    const { record, dataCompleteness } = attomToPropertyRecord(
      makeAttomDoc(),
      'tenant-a',
    );

    expect(record.id).toBe('attom-12345');
    expect(record.tenantId).toBe('tenant-a');
    expect(record.apn).toBe('APN-001');
    expect(record.propertyType).toBe(PropertyRecordType.SINGLE_FAMILY);

    expect(record.address.street).toBe('123 N MAIN ST');
    expect(record.address.city).toBe('DALLAS');
    expect(record.address.state).toBe('TX');
    expect(record.address.zip).toBe('75225');
    expect(record.address.zipPlus4).toBe('1234');
    expect(record.address.county).toBe('DALLAS');
    expect(record.address.latitude).toBe(32.85);
    expect(record.address.longitude).toBe(-96.78);

    expect(record.building.gla).toBe(2200);
    expect(record.building.yearBuilt).toBe(1995);
    expect(record.building.bedrooms).toBe(4);
    expect(record.building.bathrooms).toBe(2.5); // 2 full + 0.5 * 1 half
    expect(record.building.fullBathrooms).toBe(2);
    expect(record.building.halfBathrooms).toBe(1);
    expect(record.building.stories).toBe(2);
    expect(record.building.garageSpaces).toBe(2);
    expect(record.building.pool).toBe(false);

    expect(record.lotSizeSqFt).toBe(10890);
    expect(record.lotSizeAcres).toBe(0.25);

    expect(record.taxAssessments).toHaveLength(1);
    expect(record.taxAssessments[0]!.taxYear).toBe(2025);
    expect(record.taxAssessments[0]!.totalAssessedValue).toBe(350000);
    expect(record.taxAssessments[0]!.annualTaxAmount).toBe(8200);

    expect(record.permits).toEqual([]);
    expect(record.recordVersion).toBe(1);
    expect(record.versionHistory).toHaveLength(1);
    expect(record.versionHistory[0]!.source).toBe('PUBLIC_RECORDS_API');
    expect(record.dataSource).toBe('PUBLIC_RECORDS_API');
    expect(record.dataSourceRecordId).toBe('12345');
    expect(record.createdBy).toBe('SYSTEM:attom-mapper');

    expect(dataCompleteness.missingRequiredFields).toEqual([]);
    expect(dataCompleteness.score).toBe(1);
  });

  it('flags missing required building fields without inventing values', () => {
    const doc = makeAttomDoc({
      propertyDetail: {
        ...makeAttomDoc().propertyDetail,
        livingAreaSqft: null,
        yearBuilt: null,
        bedroomsTotal: null,
        bathroomsFull: null,
        bathroomsHalf: null,
      },
    });

    const { record, dataCompleteness } = attomToPropertyRecord(doc, 'tenant-a');

    expect(record.building.gla).toBe(0);
    expect(record.building.yearBuilt).toBe(0);
    expect(record.building.bedrooms).toBe(0);
    expect(record.building.bathrooms).toBe(0);

    expect(dataCompleteness.missingRequiredFields).toEqual(
      expect.arrayContaining([
        'building.gla',
        'building.yearBuilt',
        'building.bedrooms',
        'building.bathrooms',
      ]),
    );
    expect(dataCompleteness.score).toBeLessThan(1);
    expect(dataCompleteness.score).toBeGreaterThanOrEqual(0);
  });

  it('flags missing coordinates when location is absent', () => {
    // location is required on AttomDataDocument, but defensively the mapper
    // should still tolerate a malformed/empty point and report missing coords.
    const doc = makeAttomDoc({
      location: { type: 'Point', coordinates: [0, 0] },
    });

    const { record, dataCompleteness } = attomToPropertyRecord(doc, 'tenant-a');

    expect(record.address.latitude).toBeUndefined();
    expect(record.address.longitude).toBeUndefined();
    expect(dataCompleteness.missingRequiredFields).toEqual(
      expect.arrayContaining(['address.latitude', 'address.longitude']),
    );
  });

  it('flags propertyType when ATTOM type cannot be mapped', () => {
    const doc = makeAttomDoc({
      propertyDetail: {
        ...makeAttomDoc().propertyDetail,
        attomPropertyType: 'WIDGET-FACTORY',
      },
    });

    const { record, dataCompleteness } = attomToPropertyRecord(doc, 'tenant-a');

    // No silent default: when we cannot map, we still need a valid enum value
    // (PropertyRecord.propertyType is non-optional), so we use SINGLE_FAMILY
    // as the placeholder and LOUDLY flag it.
    expect(record.propertyType).toBe(PropertyRecordType.SINGLE_FAMILY);
    expect(dataCompleteness.missingRequiredFields).toContain('propertyType');
  });

  it('maps known ATTOM property types case-insensitively', () => {
    const cases: Array<[string, PropertyRecordType]> = [
      ['SFR', PropertyRecordType.SINGLE_FAMILY],
      ['single family residential', PropertyRecordType.SINGLE_FAMILY],
      ['Condominium', PropertyRecordType.CONDO],
      ['CONDO', PropertyRecordType.CONDO],
      ['Townhouse', PropertyRecordType.TOWNHOME],
      ['TOWNHOME', PropertyRecordType.TOWNHOME],
      ['Multi-Family', PropertyRecordType.MULTI_FAMILY],
      ['DUPLEX', PropertyRecordType.MULTI_FAMILY],
      ['Commercial', PropertyRecordType.COMMERCIAL],
      ['Vacant Land', PropertyRecordType.LAND],
      ['Manufactured Home', PropertyRecordType.MANUFACTURED],
    ];
    for (const [input, expected] of cases) {
      const { record, dataCompleteness } = attomToPropertyRecord(
        makeAttomDoc({
          propertyDetail: { ...makeAttomDoc().propertyDetail, attomPropertyType: input },
        }),
        'tenant-a',
      );
      expect(record.propertyType, `input="${input}"`).toBe(expected);
      expect(dataCompleteness.missingRequiredFields).not.toContain('propertyType');
    }
  });

  it('omits the tax assessment entry when assessedValueTotal is null', () => {
    const doc = makeAttomDoc({
      assessment: {
        ...makeAttomDoc().assessment,
        assessedValueTotal: null,
      },
    });
    const { record } = attomToPropertyRecord(doc, 'tenant-a');
    expect(record.taxAssessments).toEqual([]);
  });

  it('produces a stable id derived from attomId so the same comp is identical across runs', () => {
    const a = attomToPropertyRecord(makeAttomDoc({ attomId: '99999' }), 'tenant-a').record;
    const b = attomToPropertyRecord(makeAttomDoc({ attomId: '99999' }), 'tenant-a').record;
    expect(a.id).toBe(b.id);
    expect(a.id).toBe('attom-99999');
  });

  it('composes street from house/direction/name/suffix when address.full is empty', () => {
    const doc = makeAttomDoc({
      address: {
        ...makeAttomDoc().address,
        full: '',
      },
    });
    const { record } = attomToPropertyRecord(doc, 'tenant-a');
    expect(record.address.street).toBe('123 N MAIN ST');
  });

  describe('photos (PHOTOSCOUNT / PHOTOKEY / PHOTOURLPREFIX)', () => {
    it('builds N URLs with the documented pattern when PHOTOSCOUNT > 0', () => {
      const doc = makeAttomDoc({
        rawData: {
          PHOTOSCOUNT: '3',
          PHOTOKEY: 'abc123',
          PHOTOURLPREFIX: 'https://photos.example.com/',
        },
      });
      const { record } = attomToPropertyRecord(doc, 'tenant-a');
      expect(record.photos).toEqual([
        { url: 'https://photos.example.com/abc123/photo_1.jpg', source: 'vendor', type: null },
        { url: 'https://photos.example.com/abc123/photo_2.jpg', source: 'vendor', type: null },
        { url: 'https://photos.example.com/abc123/photo_3.jpg', source: 'vendor', type: null },
      ]);
    });

    it('returns an empty array when PHOTOSCOUNT is "0"', () => {
      const doc = makeAttomDoc({
        rawData: {
          PHOTOSCOUNT: '0',
          PHOTOKEY: 'abc123',
          PHOTOURLPREFIX: 'https://photos.example.com/',
        },
      });
      const { record } = attomToPropertyRecord(doc, 'tenant-a');
      expect(record.photos).toEqual([]);
    });

    it('returns an empty array when PHOTOSCOUNT is missing', () => {
      const doc = makeAttomDoc({ rawData: {} });
      const { record } = attomToPropertyRecord(doc, 'tenant-a');
      expect(record.photos).toEqual([]);
    });

    it('returns an empty array when PHOTOKEY or PHOTOURLPREFIX is missing', () => {
      const noKey = attomToPropertyRecord(
        makeAttomDoc({
          rawData: { PHOTOSCOUNT: '2', PHOTOURLPREFIX: 'https://x/' },
        }),
        'tenant-a',
      ).record;
      expect(noKey.photos).toEqual([]);

      const noPrefix = attomToPropertyRecord(
        makeAttomDoc({
          rawData: { PHOTOSCOUNT: '2', PHOTOKEY: 'abc' },
        }),
        'tenant-a',
      ).record;
      expect(noPrefix.photos).toEqual([]);
    });

    it('returns an empty array when PHOTOSCOUNT is unparseable', () => {
      const doc = makeAttomDoc({
        rawData: {
          PHOTOSCOUNT: 'NaN-ish',
          PHOTOKEY: 'abc',
          PHOTOURLPREFIX: 'https://x/',
        },
      });
      const { record } = attomToPropertyRecord(doc, 'tenant-a');
      expect(record.photos).toEqual([]);
    });
  });
});
