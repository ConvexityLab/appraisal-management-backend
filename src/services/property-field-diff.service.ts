/**
 * Property Field Diff Service
 *
 * Compares a report's claimed subject-property values against the
 * public-records data we fetched at order creation. Pure-function diff —
 * no new storage, no event publish — just compares two already-loaded
 * objects and returns per-field status.
 *
 * Inputs
 *   - claim:        the CanonicalPropertyCore-shaped values from the
 *                   review-context canonicalData.canonical projection
 *                   (built from Axiom extraction).
 *   - publicRecord: PropertyDataResult.core + PropertyDataResult.publicRecord
 *                   from the latest PropertyEnrichmentRecord (Bridge/ATTOM).
 *
 * Output: PropertyFieldDiffReport — one row per compared field with
 * status MATCH / MINOR / MAJOR / MISSING_CLAIM / MISSING_PUBLIC_RECORD.
 *
 * Why "stateless compute" instead of persisting: the inputs are already
 * stored elsewhere (canonical snapshot + property-enrichments container).
 * Recomputing on demand keeps the diff in sync with whichever extraction
 * + enrichment is current, and avoids a third copy of the same data.
 */

export type FieldDiffStatus =
  | 'MATCH'
  | 'MINOR_MISMATCH'
  | 'MAJOR_MISMATCH'
  | 'MISSING_CLAIM'
  | 'MISSING_PUBLIC_RECORD';

export interface PropertyFieldDiffEntry {
  /** Canonical field path on CanonicalPropertyCore (e.g., "grossLivingArea"). */
  field: string;
  /** Human-readable label. */
  label: string;
  /** Value claimed by the appraiser (extracted from the report). */
  claimedValue: number | string | null;
  /** Value found in public records (Bridge / ATTOM). */
  publicRecordValue: number | string | null;
  status: FieldDiffStatus;
  /**
   * Magnitude of the disagreement for numeric fields, as a fraction of the
   * public-record value. Undefined when not applicable (missing data, or
   * non-numeric field).
   */
  deltaFraction?: number;
  /**
   * The tolerance band used to classify MINOR vs MAJOR. For documentation
   * — also returned so the UI can show "tolerance: ±10%".
   */
  tolerance?: { minorFraction: number; majorFraction: number };
  /**
   * Why this field's verdict came out the way it did. One short sentence
   * the UI can show in a tooltip.
   */
  rationale: string;
}

export interface PropertyFieldDiffReport {
  orderId: string;
  generatedAt: string;
  /** Source identifier for the public-record side (e.g., "bridge", "attom-local"). */
  publicRecordSource: string | null;
  /** ISO timestamp of when the enrichment was fetched. */
  publicRecordFetchedAt: string | null;
  entries: PropertyFieldDiffEntry[];
  summary: {
    match: number;
    minorMismatch: number;
    majorMismatch: number;
    missingClaim: number;
    missingPublicRecord: number;
  };
}

// ─── Inputs the service accepts ───────────────────────────────────────────────

/**
 * Minimal claim shape — pulls from the canonical projection. Every field
 * is optional; the diff handles missing values explicitly with
 * MISSING_CLAIM status rather than guessing.
 */
export interface ClaimInput {
  grossLivingArea?: number | null;
  bedrooms?: number | null;
  bathsFull?: number | null;
  bathsHalf?: number | null;
  yearBuilt?: number | null;
  lotSizeSqFt?: number | null;
  stories?: number | null;
  parcelNumber?: string | null;
}

/** Minimal public-record shape — subset of PropertyDataResult.core/publicRecord. */
export interface PublicRecordInput {
  grossLivingArea?: number | null;
  bedrooms?: number | null;
  bathsFull?: number | null;
  bathsHalf?: number | null;
  yearBuilt?: number | null;
  lotSizeSqFt?: number | null;
  stories?: number | null;
  parcelNumber?: string | null;
}

// ─── Field config ─────────────────────────────────────────────────────────────

interface NumericFieldConfig {
  key: keyof ClaimInput & keyof PublicRecordInput;
  label: string;
  /** A delta below this fraction is MATCH. */
  minorFraction: number;
  /** Between minorFraction and majorFraction is MINOR_MISMATCH; above is MAJOR. */
  majorFraction: number;
}

interface ExactFieldConfig {
  key: keyof ClaimInput & keyof PublicRecordInput;
  label: string;
  /**
   * Discrete (integer) fields like bedrooms: a difference of `minorDelta`
   * units is MINOR, anything above is MAJOR.
   */
  minorDelta: number;
  /**
   * Anything strictly greater than this delta is MAJOR.
   */
  majorDelta: number;
}

const NUMERIC_FIELDS: NumericFieldConfig[] = [
  // GLA: ±5% is normal measurement variance; >10% is a real disagreement.
  { key: 'grossLivingArea', label: 'Gross Living Area (sq ft)', minorFraction: 0.05, majorFraction: 0.1 },
  // Lot size: public records often round; ±10% acceptable, >20% suspicious.
  { key: 'lotSizeSqFt', label: 'Lot Size (sq ft)', minorFraction: 0.1, majorFraction: 0.2 },
];

const DISCRETE_FIELDS: ExactFieldConfig[] = [
  // Year built: identical or off by one is MINOR (assessor lag), >1 year is MAJOR.
  { key: 'yearBuilt', label: 'Year Built', minorDelta: 1, majorDelta: 1 },
  // Bedroom count: any mismatch is at least MINOR; >1 is MAJOR.
  { key: 'bedrooms', label: 'Bedrooms', minorDelta: 0, majorDelta: 1 },
  { key: 'bathsFull', label: 'Full Baths', minorDelta: 0, majorDelta: 1 },
  { key: 'bathsHalf', label: 'Half Baths', minorDelta: 0, majorDelta: 1 },
  { key: 'stories', label: 'Stories', minorDelta: 0, majorDelta: 1 },
];

const STRING_FIELDS: Array<{ key: keyof ClaimInput & keyof PublicRecordInput; label: string }> = [
  // APN: any mismatch is MAJOR — APNs are stable identifiers.
  { key: 'parcelNumber', label: 'Parcel Number (APN)' },
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class PropertyFieldDiffService {
  /**
   * Compute the field-by-field diff. Pure function: same inputs always
   * produce the same output, no side effects.
   */
  compute(
    orderId: string,
    claim: ClaimInput,
    publicRecord: PublicRecordInput,
    meta: { publicRecordSource?: string | null; publicRecordFetchedAt?: string | null } = {},
  ): PropertyFieldDiffReport {
    const entries: PropertyFieldDiffEntry[] = [];

    for (const f of NUMERIC_FIELDS) {
      entries.push(this.compareNumeric(f, claim, publicRecord));
    }
    for (const f of DISCRETE_FIELDS) {
      entries.push(this.compareDiscrete(f, claim, publicRecord));
    }
    for (const f of STRING_FIELDS) {
      entries.push(this.compareString(f, claim, publicRecord));
    }

    const summary = entries.reduce(
      (acc, e) => {
        if (e.status === 'MATCH') acc.match++;
        else if (e.status === 'MINOR_MISMATCH') acc.minorMismatch++;
        else if (e.status === 'MAJOR_MISMATCH') acc.majorMismatch++;
        else if (e.status === 'MISSING_CLAIM') acc.missingClaim++;
        else if (e.status === 'MISSING_PUBLIC_RECORD') acc.missingPublicRecord++;
        return acc;
      },
      { match: 0, minorMismatch: 0, majorMismatch: 0, missingClaim: 0, missingPublicRecord: 0 },
    );

    return {
      orderId,
      generatedAt: new Date().toISOString(),
      publicRecordSource: meta.publicRecordSource ?? null,
      publicRecordFetchedAt: meta.publicRecordFetchedAt ?? null,
      entries,
      summary,
    };
  }

  // ─── Per-field comparators ───────────────────────────────────────────────────

  private compareNumeric(
    f: NumericFieldConfig,
    claim: ClaimInput,
    publicRecord: PublicRecordInput,
  ): PropertyFieldDiffEntry {
    const claimedRaw = claim[f.key];
    const prRaw = publicRecord[f.key];
    const claimed = typeof claimedRaw === 'number' ? claimedRaw : null;
    const pr = typeof prRaw === 'number' ? prRaw : null;
    const base: Omit<PropertyFieldDiffEntry, 'status' | 'rationale'> = {
      field: f.key,
      label: f.label,
      claimedValue: claimed,
      publicRecordValue: pr,
      tolerance: { minorFraction: f.minorFraction, majorFraction: f.majorFraction },
    };
    if (claimed === null && pr === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Neither side reported this field.' };
    }
    if (claimed === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Report did not state this value.' };
    }
    if (pr === null) {
      return { ...base, status: 'MISSING_PUBLIC_RECORD', rationale: 'Public records did not include this value.' };
    }
    // Use the larger of the two as denominator so swapped order doesn't change verdict.
    const denom = Math.max(Math.abs(claimed), Math.abs(pr), 1);
    const deltaFraction = Math.abs(claimed - pr) / denom;
    if (deltaFraction <= f.minorFraction) {
      return {
        ...base,
        deltaFraction,
        status: 'MATCH',
        rationale: `Within ${Math.round(f.minorFraction * 100)}% tolerance.`,
      };
    }
    if (deltaFraction <= f.majorFraction) {
      return {
        ...base,
        deltaFraction,
        status: 'MINOR_MISMATCH',
        rationale: `Off by ${Math.round(deltaFraction * 100)}% — within escalation band.`,
      };
    }
    return {
      ...base,
      deltaFraction,
      status: 'MAJOR_MISMATCH',
      rationale: `Off by ${Math.round(deltaFraction * 100)}% — beyond the ${Math.round(f.majorFraction * 100)}% threshold.`,
    };
  }

  private compareDiscrete(
    f: ExactFieldConfig,
    claim: ClaimInput,
    publicRecord: PublicRecordInput,
  ): PropertyFieldDiffEntry {
    const claimedRaw = claim[f.key];
    const prRaw = publicRecord[f.key];
    const claimed = typeof claimedRaw === 'number' ? claimedRaw : null;
    const pr = typeof prRaw === 'number' ? prRaw : null;
    const base: Omit<PropertyFieldDiffEntry, 'status' | 'rationale'> = {
      field: f.key,
      label: f.label,
      claimedValue: claimed,
      publicRecordValue: pr,
    };
    if (claimed === null && pr === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Neither side reported this field.' };
    }
    if (claimed === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Report did not state this value.' };
    }
    if (pr === null) {
      return { ...base, status: 'MISSING_PUBLIC_RECORD', rationale: 'Public records did not include this value.' };
    }
    const delta = Math.abs(claimed - pr);
    if (delta === 0) {
      return { ...base, status: 'MATCH', rationale: 'Exact match.' };
    }
    if (delta <= f.minorDelta) {
      return { ...base, status: 'MINOR_MISMATCH', rationale: `Off by ${delta} — within typical assessor-lag range.` };
    }
    if (delta <= f.majorDelta) {
      return { ...base, status: 'MINOR_MISMATCH', rationale: `Off by ${delta}.` };
    }
    return { ...base, status: 'MAJOR_MISMATCH', rationale: `Off by ${delta} — investigate.` };
  }

  private compareString(
    f: { key: keyof ClaimInput & keyof PublicRecordInput; label: string },
    claim: ClaimInput,
    publicRecord: PublicRecordInput,
  ): PropertyFieldDiffEntry {
    const claimedRaw = claim[f.key];
    const prRaw = publicRecord[f.key];
    const claimed = typeof claimedRaw === 'string' && claimedRaw.length > 0 ? claimedRaw : null;
    const pr = typeof prRaw === 'string' && prRaw.length > 0 ? prRaw : null;
    const base: Omit<PropertyFieldDiffEntry, 'status' | 'rationale'> = {
      field: f.key,
      label: f.label,
      claimedValue: claimed,
      publicRecordValue: pr,
    };
    if (claimed === null && pr === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Neither side reported this field.' };
    }
    if (claimed === null) {
      return { ...base, status: 'MISSING_CLAIM', rationale: 'Report did not state this value.' };
    }
    if (pr === null) {
      return { ...base, status: 'MISSING_PUBLIC_RECORD', rationale: 'Public records did not include this value.' };
    }
    // Normalize: strip whitespace + dashes for APN comparison (assessors format inconsistently).
    const normalize = (s: string): string => s.replace(/[\s\-_]/g, '').toUpperCase();
    if (normalize(claimed) === normalize(pr)) {
      return { ...base, status: 'MATCH', rationale: 'Identical after normalization.' };
    }
    return {
      ...base,
      status: 'MAJOR_MISMATCH',
      rationale: 'Identifier does not match — verify with assessor.',
    };
  }
}
