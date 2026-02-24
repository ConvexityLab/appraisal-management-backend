/**
 * Matching Engine Service — pure functions, no I/O
 *
 * Evaluates MatchingCriteriaSet rules against vendor/provider records and
 * returns a ranked shortlist of eligible providers.
 *
 * All exported functions are deterministic and side-effect-free:
 * - No Cosmos reads or writes
 * - No HTTP calls
 * - Safe to unit-test in isolation
 */

import type {
  MatchingCriterion,
  MatchingCriteriaSet,
  MatchResult,
  ProviderType,
  GeoFenceValue,
} from '../types/matching.types.js';

// ─── Geo-math helpers ─────────────────────────────────────────────────────────

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine great-circle distance between two lat/lng points (miles).
 */
export function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Ray-casting algorithm — true when `point` is inside the given polygon ring.
 * The ring need not be closed (first === last) but it must have ≥ 3 vertices.
 */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.lng;
    const yi = polygon[i]!.lat;
    const xj = polygon[j]!.lng;
    const yj = polygon[j]!.lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Axis-aligned bounding-box containment check.
 */
export function isPointInBbox(
  point: { lat: number; lng: number },
  bbox: { north: number; south: number; east: number; west: number },
): boolean {
  return (
    point.lat >= bbox.south &&
    point.lat <= bbox.north &&
    point.lng >= bbox.west &&
    point.lng <= bbox.east
  );
}

// ─── Vendor location helpers ──────────────────────────────────────────────────

/**
 * A minimal shape covering both the legacy `Vendor.ServiceArea` (index.ts) and
 * the frontend `VendorProfile.VendorServiceArea`.  The matching engine only
 * needs the fields below.
 */
export interface ProviderServiceArea {
  state?: string;
  counties?: string[];
  zipCodes?: string[];
  maxDistance?: number;             // miles (legacy Vendor type)
  geoLocation?: { lat: number; lng: number };
}

/**
 * Returns true when at least one of the vendor's service areas covers the
 * given subject-property point, using this priority order:
 *   1. geoLocation + maxDistance (haversine)
 *   2. zipCodes list (string equality)
 *   3. counties list (case-insensitive)
 *   4. state (case-insensitive, 2-char abbreviation or full name)
 *
 * Falls back gracefully when coordinates are absent (skips haversine check).
 */
export function vendorCoversLocation(
  serviceAreas: ProviderServiceArea[],
  subject: { lat: number; lng: number } | null,
  subjectAddress?: { state?: string; county?: string; zipCode?: string },
): boolean {
  for (const area of serviceAreas) {
    // 1 — radius check when both parties have coordinates
    if (subject && area.geoLocation && area.maxDistance !== undefined) {
      const dist = haversineDistanceMiles(area.geoLocation, subject);
      if (dist <= area.maxDistance) return true;
    }

    // 2 — zip code match
    if (subjectAddress?.zipCode && area.zipCodes?.length) {
      if (area.zipCodes.includes(subjectAddress.zipCode)) return true;
    }

    // 3 — county match
    if (subjectAddress?.county && area.counties?.length) {
      const lc = subjectAddress.county.toLowerCase();
      if (area.counties.some((c) => c.toLowerCase() === lc)) return true;
    }

    // 4 — state match
    if (subjectAddress?.state && area.state) {
      if (area.state.toLowerCase() === subjectAddress.state.toLowerCase()) return true;
    }
  }
  return false;
}

// ─── Criterion evaluator ──────────────────────────────────────────────────────

/**
 * Resolve a dot-path value from an arbitrary object.
 * e.g. "serviceAreas.state" on a vendor with serviceAreas[0].state.
 * For array fields only the first element is examined unless the field itself
 * is an array — in that case we return the array so `in` operators work.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      // Descend into first element for dot-path continuation
      current = current[0]?.[part];
    } else {
      current = current[part];
    }
  }
  return current;
}

/**
 * Evaluate a single criterion against a provider record.
 *
 * @param provider  Arbitrary provider object (Vendor, VendorProfile, etc.)
 * @param criterion The criterion to evaluate
 * @param subjectCoords  Lat/lng of the subject property — required for geo_fence operators
 * @param subjectAddress  Address fields for fallback state/county/zip matching
 */
export function evaluateCriterion(
  provider: Record<string, unknown>,
  criterion: MatchingCriterion,
  subjectCoords: { lat: number; lng: number } | null = null,
  subjectAddress?: { state?: string; county?: string; zipCode?: string },
): boolean {
  const { field, operator, value } = criterion;

  // ── Geo-fence operators ──────────────────────────────────────────────────────
  if (
    operator === 'within_radius_miles' ||
    operator === 'within_polygon' ||
    operator === 'within_bbox'
  ) {
    // Requires a GeoFenceValue
    const fence = value as GeoFenceValue;
    // Collect all service-area home-base points from the provider
    const areas: ProviderServiceArea[] = (
      (provider.serviceAreas as ProviderServiceArea[] | undefined) ?? []
    );

    if (operator === 'within_radius_miles') {
      if (!fence.center || fence.radiusMiles === undefined) return false;
      for (const area of areas) {
        if (!area.geoLocation) continue;
        const dist = haversineDistanceMiles(area.geoLocation, fence.center);
        if (dist <= fence.radiusMiles) return true;
      }
      // Also try the vendor's own coordinates if present
      const vendorLat = provider.latitude ?? (provider as Record<string, unknown>).lat;
      const vendorLng = provider.longitude ?? (provider as Record<string, unknown>).lng;
      if (typeof vendorLat === 'number' && typeof vendorLng === 'number') {
        const dist = haversineDistanceMiles(
          { lat: vendorLat as number, lng: vendorLng as number },
          fence.center,
        );
        if (dist <= fence.radiusMiles) return true;
      }
      return false;
    }

    if (operator === 'within_polygon') {
      if (!fence.polygon?.length) return false;
      for (const area of areas) {
        if (!area.geoLocation) continue;
        if (isPointInPolygon(area.geoLocation, fence.polygon)) return true;
      }
      return false;
    }

    if (operator === 'within_bbox') {
      if (!fence.bbox) return false;
      for (const area of areas) {
        if (!area.geoLocation) continue;
        if (isPointInBbox(area.geoLocation, fence.bbox)) return true;
      }
      return false;
    }
  }

  // ── not_expired (date fields) ─────────────────────────────────────────────────
  if (operator === 'not_expired') {
    const raw = resolvePath(provider, field);
    if (raw == null) return false;
    const expiry = new Date(raw as string | Date);
    return expiry > new Date();
  }

  // ── Scalar / collection operators ────────────────────────────────────────────
  const actual = resolvePath(provider, field);

  switch (operator) {
    case 'eq':
      return actual === value;
    case 'neq':
      return actual !== value;
    case 'gt':
      return typeof actual === 'number' && typeof value === 'number' && actual > value;
    case 'gte':
      return typeof actual === 'number' && typeof value === 'number' && actual >= value;
    case 'lt':
      return typeof actual === 'number' && typeof value === 'number' && actual < value;
    case 'lte':
      return typeof actual === 'number' && typeof value === 'number' && actual <= value;
    case 'in':
      return Array.isArray(value) && value.includes(actual as never);
    case 'not_in':
      return Array.isArray(value) && !value.includes(actual as never);
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.includes(value as never);
      }
      if (typeof actual === 'string' && typeof value === 'string') {
        return actual.toLowerCase().includes(value.toLowerCase());
      }
      return false;
    default:
      return false;
  }
}

/**
 * Evaluate a complete MatchingCriteriaSet against a provider.
 * Respects the `combinator` (AND = all must pass; OR = at least one must pass).
 */
export function evaluateCriteriaSet(
  provider: Record<string, unknown>,
  set: MatchingCriteriaSet,
  subjectCoords: { lat: number; lng: number } | null = null,
  subjectAddress?: { state?: string; county?: string; zipCode?: string },
): boolean {
  if (set.criteria.length === 0) return true; // empty set matches all

  if (set.combinator === 'AND') {
    return set.criteria.every((c) =>
      evaluateCriterion(provider, c, subjectCoords, subjectAddress),
    );
  }
  // OR
  return set.criteria.some((c) =>
    evaluateCriterion(provider, c, subjectCoords, subjectAddress),
  );
}

// ─── Provider match scoring ────────────────────────────────────────────────────

/**
 * Compute a 0–100 composite match score for ranking.
 * Higher performanceScore / QC score lifts the score.
 * Busy or at-capacity providers are penalised.
 */
function scoreProvider(provider: Record<string, unknown>): number {
  let score = 50; // baseline

  const perf = provider.performanceScore ?? provider.qualityScore;
  if (typeof perf === 'number') score += (perf / 100) * 30;

  const qc = provider.averageQCScore ?? provider.qualityScore;
  if (typeof qc === 'number') score += (qc / 100) * 20;

  if (provider.isBusy === true) score -= 15;

  const current = provider.currentActiveOrders ?? provider.currentLoad;
  const max = provider.maxActiveOrders ?? provider.maxCapacity;
  if (typeof current === 'number' && typeof max === 'number' && max > 0) {
    const loadPct = current / max;
    if (loadPct >= 1) score -= 25;
    else if (loadPct >= 0.8) score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Top-level: matchProviders ─────────────────────────────────────────────────

/**
 * Filter and rank a pool of providers against one or more criteria sets.
 *
 * A provider passes when it satisfies **all** supplied criteria sets
 * (each set is internally AND/OR as configured, but multiple sets are ANDed
 * together — a provider must satisfy every set to be included).
 *
 * @param providers       Array of provider objects (Vendor, VendorProfile, etc.)
 * @param criteriaSets    Sets to evaluate (must all pass)
 * @param subjectCoords   Subject-property coordinates (for geo-fence operators)
 * @param subjectAddress  Subject-property address fields (for fallback matching)
 * @param getProviderType Function that returns the provider's ProviderType
 */
export function matchProviders(
  providers: Record<string, unknown>[],
  criteriaSets: MatchingCriteriaSet[],
  subjectCoords: { lat: number; lng: number } | null = null,
  subjectAddress?: { state?: string; county?: string; zipCode?: string },
  getProviderType?: (p: Record<string, unknown>) => ProviderType | undefined,
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const provider of providers) {
    // Filter criteria sets to those applicable to this provider's type
    const providerType =
      (getProviderType?.(provider) as ProviderType | undefined) ??
      (provider.providerType as ProviderType | undefined) ??
      (provider.businessType as ProviderType | undefined);

    const applicableSets = criteriaSets.filter(
      (s) => s.providerTypes.length === 0 || (providerType && s.providerTypes.includes(providerType)),
    );

    if (applicableSets.length === 0) continue;

    // Count how many criteria there are in total (for the match ratio)
    const totalCriteria = applicableSets.reduce((n, s) => n + s.criteria.length, 0);

    // Provider must satisfy every applicable set
    const allPass = applicableSets.every((set) =>
      evaluateCriteriaSet(provider, set, subjectCoords, subjectAddress),
    );

    if (!allPass) continue;

    // Count matched criteria for informational display
    let matchedCriteria = 0;
    for (const set of applicableSets) {
      for (const criterion of set.criteria) {
        if (evaluateCriterion(provider, criterion, subjectCoords, subjectAddress)) {
          matchedCriteria++;
        }
      }
    }

    // Compute distance if subject coords available and provider has a home-base
    let distanceMiles: number | undefined;
    if (subjectCoords) {
      const areas = (provider.serviceAreas as ProviderServiceArea[] | undefined) ?? [];
      const firstGeo = areas.find((a) => a.geoLocation);
      if (firstGeo?.geoLocation) {
        distanceMiles = Math.round(
          haversineDistanceMiles(firstGeo.geoLocation, subjectCoords) * 10,
        ) / 10;
      }
    }

    results.push({
      providerId: (provider.id ?? provider.vendorId ?? '') as string,
      providerName: (provider.businessName ?? provider.name ?? '') as string,
      providerType: (providerType ?? 'APPRAISER') as ProviderType,
      score: scoreProvider(provider),
      matchedCriteria,
      totalCriteria,
      ...(distanceMiles !== undefined && { distanceMiles }),
      snapshot: {
        ...(provider.performanceScore !== undefined && { performanceScore: provider.performanceScore as number }),
        ...(provider.averageQCScore !== undefined && { averageQCScore: provider.averageQCScore as number }),
        ...(provider.onTimeDeliveryRate !== undefined && { onTimeDeliveryRate: provider.onTimeDeliveryRate as number }),
        ...((provider.currentActiveOrders !== undefined || provider.currentLoad !== undefined) && { currentActiveOrders: (provider.currentActiveOrders ?? provider.currentLoad) as number }),
        ...((provider.maxActiveOrders !== undefined || provider.maxCapacity !== undefined) && { maxActiveOrders: (provider.maxActiveOrders ?? provider.maxCapacity) as number }),
        ...(provider.standardFee !== undefined && { standardFee: provider.standardFee as number }),
      },
    });
  }

  // Sort descending by score, then ascending by distance
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distanceMiles ?? Infinity;
    const db = b.distanceMiles ?? Infinity;
    return da - db;
  });

  return results;
}
