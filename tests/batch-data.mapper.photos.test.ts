/**
 * BatchData Mapper — Photos field on CanonicalPropertyCore
 *
 * Verifies that the canonical `photos` field on CanonicalSubject and
 * CanonicalComp is populated correctly from the legacy BatchData vendor shape.
 *
 * Run: pnpm vitest run tests/batch-data.mapper.photos.test.ts
 */

import { describe, it, expect } from 'vitest';
import { mapBatchDataReport } from '../src/mappers/batch-data.mapper';

function legacyDoc(opts: { compImageUrls?: string[] | undefined; includeListing?: boolean }): Record<string, unknown> {
  return {
    id: 'rep-1',
    reportRecordId: 'rep-1',
    orderRecordId: 'order-1',
    propertyData: {
      address: { street: '1 Subject St', city: 'Springfield', state: 'IL', zip: '62701' },
      ids: { apn: 'APN-1' },
    },
    compsData: [
      {
        propertyRecordId: 'comp-1',
        address: { street: '2 Comp Ave', city: 'Springfield', state: 'IL', zip: '62701' },
        ...(opts.compImageUrls !== undefined && { images: { imageUrls: opts.compImageUrls } }),
        ...(opts.includeListing && {
          listing: { status: 'Sold', soldPrice: 250000, soldDate: '2026-01-15' },
        }),
      },
    ],
  };
}

describe('mapBatchDataReport — photos field', () => {
  it('populates comp.photos from MLS images.imageUrls (mls source, first tagged COMP_FRONT)', () => {
    const doc = mapBatchDataReport(
      legacyDoc({
        compImageUrls: ['https://mls.example.com/a.jpg', 'https://mls.example.com/b.jpg'],
        includeListing: true,
      }),
    );

    const comp = doc.comps[0]!;
    expect(comp.photos).toEqual([
      { url: 'https://mls.example.com/a.jpg', source: 'mls', type: 'COMP_FRONT' },
      { url: 'https://mls.example.com/b.jpg', source: 'mls', type: null },
    ]);
  });

  it('keeps MlsExtension.photos in parallel (legacy field unchanged)', () => {
    const doc = mapBatchDataReport(
      legacyDoc({
        compImageUrls: ['https://mls.example.com/a.jpg', 'https://mls.example.com/b.jpg'],
        includeListing: true,
      }),
    );

    const comp = doc.comps[0]!;
    expect(comp.mlsData?.photos).toEqual([
      'https://mls.example.com/a.jpg',
      'https://mls.example.com/b.jpg',
    ]);
  });

  it('comp.photos === null when no images are present', () => {
    const doc = mapBatchDataReport(legacyDoc({ compImageUrls: undefined, includeListing: true }));
    expect(doc.comps[0]!.photos).toBeNull();
  });

  it('comp.photos === null when images.imageUrls is empty', () => {
    const doc = mapBatchDataReport(legacyDoc({ compImageUrls: [], includeListing: true }));
    expect(doc.comps[0]!.photos).toBeNull();
  });

  it('subject.photos === null (BatchData carries no subject photos)', () => {
    const doc = mapBatchDataReport(
      legacyDoc({ compImageUrls: ['https://mls.example.com/a.jpg'], includeListing: true }),
    );
    expect(doc.subject.photos).toBeNull();
  });
});
