/**
 * extractAttomPhotos — shared photo-URL builder for ATTOM rows.
 *
 * ATTOM CSVs carry photos via three columns preserved verbatim on
 * `AttomDataDocument.rawData`:
 *   - PHOTOSCOUNT      (integer count)
 *   - PHOTOKEY         (path segment)
 *   - PHOTOURLPREFIX   (URL prefix)
 *
 * URLs are constructed as `${prefix}${key}/photo_${i}.jpg` for `i = 1..count`.
 *
 * Returns `[]` when the count is missing/zero/unparseable, or when either
 * `PHOTOKEY` or `PHOTOURLPREFIX` is blank (URLs cannot be built without both).
 *
 * Each photo is tagged `source: 'vendor'` (ATTOM is a data aggregator, not
 * the originating MLS) and `type: null` (ATTOM does not classify which
 * photo is the front, interior, etc.).
 *
 * This helper is shared by every place that needs to derive photos from a
 * raw ATTOM row so the two write paths (comp-collection and subject
 * enrichment) cannot drift.
 */

import type { AttomDataDocument } from '../types/attom-data.types.js';
import type { PropertyPhoto } from '../types/canonical-schema.js';

export function extractAttomPhotos(doc: AttomDataDocument): PropertyPhoto[] {
  const raw = doc.rawData ?? {};
  const countStr = (raw['PHOTOSCOUNT'] ?? '').trim();
  const key = (raw['PHOTOKEY'] ?? '').trim();
  const prefix = (raw['PHOTOURLPREFIX'] ?? '').trim();

  if (!countStr || !key || !prefix) return [];

  const count = Number(countStr);
  if (!Number.isFinite(count) || count <= 0) return [];

  const n = Math.floor(count);
  const photos: PropertyPhoto[] = [];
  for (let i = 1; i <= n; i++) {
    photos.push({
      url: `${prefix}${key}/photo_${i}.jpg`,
      source: 'vendor',
      type: null,
    });
  }
  return photos;
}
