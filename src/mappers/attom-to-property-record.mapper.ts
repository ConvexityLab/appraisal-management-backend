/**
 * attomToPropertyRecord — pure mapper from `AttomDataDocument` (third-party
 * row in the `attom-data` Cosmos container) to the canonical `PropertyRecord`
 * shape used by the comp-collection pipeline.
 *
 * The mapper has two non-negotiable rules:
 *
 *   1. NO SILENT DEFAULTS. Where the source row lacks a value for a required
 *      `PropertyRecord` field, a typed placeholder is written (`0`, `''`,
 *      `PropertyRecordType.SINGLE_FAMILY`) AND the field path is added to
 *      `dataCompleteness.missingRequiredFields`. The caller decides what to
 *      do with incomplete records.
 *
 *   2. PURE FUNCTION. No I/O, no clock — `createdAt`/`updatedAt` are seeded
 *      from `doc.ingestedAt` so the same input always yields the same output
 *      (test reproducibility, deterministic candidate ids).
 *
 * IDs are stable: `attom-{attomId}`. The same ATTOM property mapped from
 * different orders produces an identical embedded record (so embedded comps
 * are byte-equal across orders, easing diffs and dedup).
 */

import type { AttomDataDocument } from '../types/attom-data.types.js';
import {
  PropertyRecordType,
  type CanonicalAddress,
  type PropertyRecord,
  type PropertyVersionEntry,
  type TaxAssessmentRecord,
} from '../types/property-record.types.js';
import { extractAttomPhotos } from './attom-photos.js';

/** Per-record completeness summary returned alongside the mapped record. */
export interface AttomMappingCompleteness {
  /**
   * Field paths (e.g. `'building.gla'`, `'address.latitude'`) for which the
   * source row had no usable value and a placeholder was written. Empty
   * array means the record is fully populated against the required schema.
   */
  missingRequiredFields: string[];
  /**
   * Completeness score in `[0, 1]`: `1 - (missingRequiredFields.length / TOTAL_REQUIRED)`.
   * Provided so callers can rank candidates without recomputing.
   */
  score: number;
}

export interface AttomMappingResult {
  record: PropertyRecord;
  dataCompleteness: AttomMappingCompleteness;
}

/**
 * The set of `PropertyRecord` paths the mapper polices. Adding a path here
 * makes it tracked by `dataCompleteness`. Keep this list small and focused
 * on fields downstream comp-selection actually needs — adding a path that
 * downstream doesn't use just produces noisy "missing" reports.
 */
const REQUIRED_PATHS = [
  'address.latitude',
  'address.longitude',
  'building.gla',
  'building.yearBuilt',
  'building.bedrooms',
  'building.bathrooms',
  'propertyType',
] as const;

/**
 * Maps an `AttomDataDocument` (as stored in the `attom-data` Cosmos
 * container) onto the canonical `PropertyRecord` shape.
 *
 * @param doc       The ATTOM row.
 * @param tenantId  Tenant scope to stamp on the resulting record.
 *                  Required — the canonical record is tenant-partitioned.
 */
export function attomToPropertyRecord(
  doc: AttomDataDocument,
  tenantId: string,
): AttomMappingResult {
  if (!tenantId) {
    throw new Error('attomToPropertyRecord: tenantId is required');
  }

  const missing: string[] = [];

  // ── Address ─────────────────────────────────────────────────────────────
  const street = pickStreet(doc);
  const { latitude, longitude } = pickCoordinates(doc);
  if (latitude === undefined) missing.push('address.latitude');
  if (longitude === undefined) missing.push('address.longitude');

  const address: CanonicalAddress = {
    street,
    city: doc.address.city ?? '',
    state: doc.address.state ?? '',
    zip: doc.address.zip ?? '',
    ...(doc.address.zip4 ? { zipPlus4: doc.address.zip4 } : {}),
    ...(doc.address.county ? { county: doc.address.county } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  };

  // ── Property type ───────────────────────────────────────────────────────
  const mappedType = mapPropertyType(doc.propertyDetail.attomPropertyType);
  // mapPropertyType returns null when it can't map; we still need a valid
  // enum value so we use SINGLE_FAMILY as the placeholder AND flag it.
  const propertyType = mappedType ?? PropertyRecordType.SINGLE_FAMILY;
  if (mappedType === null) missing.push('propertyType');

  // ── Building ────────────────────────────────────────────────────────────
  const d = doc.propertyDetail;

  const gla = d.livingAreaSqft ?? 0;
  if (d.livingAreaSqft == null) missing.push('building.gla');

  const yearBuilt = d.yearBuilt ?? 0;
  if (d.yearBuilt == null) missing.push('building.yearBuilt');

  const bedrooms = d.bedroomsTotal ?? 0;
  if (d.bedroomsTotal == null) missing.push('building.bedrooms');

  const fullBaths = d.bathroomsFull ?? 0;
  const halfBaths = d.bathroomsHalf ?? 0;
  const bathrooms = fullBaths + halfBaths * 0.5;
  if (d.bathroomsFull == null && d.bathroomsHalf == null) {
    missing.push('building.bathrooms');
  }

  const stories = parseStories(d.stories);

  const building: PropertyRecord['building'] = {
    gla,
    yearBuilt,
    bedrooms,
    bathrooms,
    ...(d.bathroomsFull != null ? { fullBathrooms: fullBaths } : {}),
    ...(d.bathroomsHalf != null ? { halfBathrooms: halfBaths } : {}),
    ...(stories !== undefined ? { stories } : {}),
    ...(d.garageSpaces != null ? { garageSpaces: d.garageSpaces } : {}),
    pool: Boolean(d.poolPrivate),
  };

  // ── Photos ───────────────────────────────────────────────────────────
  // ATTOM rows carry photos via three CSV columns: PHOTOSCOUNT (count),
  // PHOTOKEY (path segment), and PHOTOURLPREFIX (URL prefix). URLs are
  // constructed as `${prefix}${key}/photo_${i}.jpg` for i = 1..count.
  // Returns empty array when count is zero/missing/unparseable.
  const photos = extractAttomPhotos(doc);

  // ── Tax assessments ─────────────────────────────────────────────────────
  // Only emit an entry when there's an actual value. ATTOM rows commonly
  // have an empty assessment block — we don't fabricate one.
  const taxAssessments: TaxAssessmentRecord[] = [];
  const a = doc.assessment;
  if (a.assessedValueTotal != null) {
    const taxYear = parseTaxYear(a.taxYear);
    if (taxYear !== undefined) {
      taxAssessments.push({
        taxYear,
        totalAssessedValue: a.assessedValueTotal,
        ...(a.marketValue != null ? { marketValue: a.marketValue } : {}),
        ...(a.taxAmount != null ? { annualTaxAmount: a.taxAmount } : {}),
        ...(a.marketValueDate ? { assessedAt: a.marketValueDate } : {}),
      });
    }
  }

  // ── Version stamp ───────────────────────────────────────────────────────
  // The mapper synthesises a v1 record sourced from the ATTOM cache. We
  // record the source verbatim so downstream audits know exactly where the
  // data came from. Pure: timestamps come from the source doc, not Date.now().
  const stamp = doc.ingestedAt || doc.sourcedAt || '';
  const versionEntry: PropertyVersionEntry = {
    version: 1,
    createdAt: stamp,
    createdBy: 'SYSTEM:attom-mapper',
    reason: 'Synthesised from attom-data cache for comp-collection',
    source: 'PUBLIC_RECORDS_API',
    sourceProvider: 'ATTOM Data Solutions (Cosmos cache)',
    changedFields: [],
    previousValues: {},
  };

  const record: PropertyRecord = {
    id: `attom-${doc.attomId}`,
    tenantId,
    ...(doc.apnFormatted ? { apn: doc.apnFormatted } : {}),
    address,
    propertyType,
    ...(d.lotSizeSqft != null ? { lotSizeSqFt: d.lotSizeSqft } : {}),
    ...(d.lotSizeAcres != null ? { lotSizeAcres: d.lotSizeAcres } : {}),
    building,
    photos,
    taxAssessments,
    permits: [],
    recordVersion: 1,
    versionHistory: [versionEntry],
    dataSource: 'PUBLIC_RECORDS_API',
    dataSourceRecordId: doc.attomId,
    ...(stamp ? { lastVerifiedAt: stamp } : {}),
    lastVerifiedSource: 'ATTOM Data Solutions (Cosmos cache)',
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: 'SYSTEM:attom-mapper',
  };

  const totalRequired = REQUIRED_PATHS.length as number;
  const score = totalRequired === 0 ? 1 : 1 - missing.length / totalRequired;

  return {
    record,
    dataCompleteness: {
      missingRequiredFields: missing,
      score,
    },
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Prefer the pre-formatted `address.full` if present; otherwise compose from
 * the structured house/direction/name/suffix/postdir fields. Returns '' when
 * neither is available.
 */
function pickStreet(doc: AttomDataDocument): string {
  const full = doc.address.full?.trim();
  if (full) return full;

  const a = doc.address;
  return [
    a.houseNumber,
    a.streetDirection,
    a.streetName,
    a.streetSuffix,
    a.streetPostDirection,
  ]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(' ');
}

/**
 * Extracts lat/lon from the GeoJSON `[longitude, latitude]` point. Returns
 * `undefined` for either coordinate when the point is missing or zero-zero
 * (zero-zero in GeoJSON is "Null Island" — a documented sentinel for "no
 * coordinates"; treat it as missing rather than as a real location).
 */
function pickCoordinates(
  doc: AttomDataDocument,
): { latitude: number | undefined; longitude: number | undefined } {
  const coords = doc.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return { latitude: undefined, longitude: undefined };
  }
  const [lon, lat] = coords;
  if (lon === 0 && lat === 0) {
    return { latitude: undefined, longitude: undefined };
  }
  return {
    latitude: typeof lat === 'number' ? lat : undefined,
    longitude: typeof lon === 'number' ? lon : undefined,
  };
}

/**
 * Maps an ATTOM property-type string to the canonical `PropertyRecordType`
 * enum. Returns `null` when no confident mapping exists — caller is
 * responsible for substituting a placeholder and flagging the field.
 *
 * Match strategy: case-insensitive substring against well-known tokens.
 * Order matters — more specific tokens first (e.g. "townhome" before "home").
 */
function mapPropertyType(raw: string | null | undefined): PropertyRecordType | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (s === 'sfr' || s.includes('single family') || s.includes('single-family')) {
    return PropertyRecordType.SINGLE_FAMILY;
  }
  if (s.includes('condo')) return PropertyRecordType.CONDO;
  if (s.includes('townhome') || s.includes('townhouse') || s.includes('town home')) {
    return PropertyRecordType.TOWNHOME;
  }
  if (
    s.includes('multi-family') ||
    s.includes('multi family') ||
    s.includes('multifamily') ||
    s.includes('duplex') ||
    s.includes('triplex') ||
    s.includes('fourplex') ||
    s.includes('quadplex')
  ) {
    return PropertyRecordType.MULTI_FAMILY;
  }
  if (s.includes('commercial')) return PropertyRecordType.COMMERCIAL;
  if (s.includes('land') || s.includes('vacant')) return PropertyRecordType.LAND;
  if (s.includes('manufactured') || s.includes('mobile')) {
    return PropertyRecordType.MANUFACTURED;
  }
  if (s.includes('mixed use') || s.includes('mixed-use')) {
    return PropertyRecordType.MIXED_USE;
  }
  return null;
}

/** ATTOM stories field is a string ('1', '2', '1.5'); coerce or drop. */
function parseStories(s: string | null | undefined): number | undefined {
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** ATTOM taxYear is a string ('2025'); coerce or drop. */
function parseTaxYear(s: string | null | undefined): number | undefined {
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 1800 && n < 3000 ? n : undefined;
}
