/**
 * Property Enrichment → AMP Canonical Mapper
 *
 * Projects a `PropertyDataResult` (output of any third-party
 * PropertyDataProvider — Bridge Interactive, ATTOM, BatchData, etc.) onto
 * the AMP canonical schema (UAD 3.6 / URAR / MISMO 3.4 aligned).
 *
 * Without this mapper, third-party enrichment data only reaches the
 * `PropertyRecord` entity and the legacy flat `subjectProperty` shim —
 * but not `normalizedData.canonical`, which is what the criteria resolver
 * walks. Criteria authored against canonical paths (e.g.
 * `subject.lotSizeSqFt`, `subject.parcelNumber`, `subject.floodZone`)
 * therefore can't see enrichment data, only Axiom extraction values.
 *
 * Output shape: a partial `CanonicalReportDocument`. Only fields the
 * provider returned are emitted — missing fields are omitted, not
 * defaulted, so the resolver still treats them as "not present" and the
 * extraction (or another source) can fill them in.
 *
 * Merge semantics with extraction (see canonical-snapshot.service.ts):
 *   - Axiom extraction is the authoritative source for the appraisal-
 *     report-of-record; it ran on the document the appraiser produced.
 *   - Public-records enrichment is independent reference data.
 *   - The snapshot merges enrichment first, then extraction on top —
 *     so extraction wins for any field both sources carry. This matches
 *     the QC posture: trust the appraisal report, use enrichment to fill
 *     gaps and to cross-check (cross-checks are emitted as separate
 *     branches like `avmCrossCheck`, not by overwriting subject fields).
 */

import type {
    CanonicalAddress,
    CanonicalReportDocument,
    CanonicalSubject,
} from '@l1/shared-types';
import type {
    PropertyDataCore,
    PropertyDataFlood,
    PropertyDataPublicRecord,
    PropertyDataResult,
} from '../types/property-data.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trimOrNull(v: string | null | undefined): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t.length > 0 ? t : null;
}

function finiteOrNull(v: number | null | undefined): number | null {
    if (v == null) return null;
    return Number.isFinite(v) ? v : null;
}

// ─── Section mappers ──────────────────────────────────────────────────────────

/**
 * Map provider's PropertyDataCore → CanonicalSubject fields.
 *
 * Notes:
 *   - `garage` is a free-text descriptor in PropertyDataCore (e.g. "2-car attached")
 *     and we emit it on `subject.garageType` to preserve the descriptor. Spaces
 *     count is left null because providers don't generally surface it.
 *   - `effectiveAge` from the provider is in years; CanonicalPropertyCore has both
 *     `effectiveAge` (years) and `effectiveYearBuilt` slots. We emit `effectiveAge`
 *     directly per UAD; year-built derivation is not the mapper's job.
 *   - `bathsFull` + `bathsHalf` are emitted as MISMO-aligned discrete counts; the
 *     legacy `bathrooms` aggregate is computed when both halves are present so the
 *     deprecated field stays in sync.
 */
function mapCoreToSubject(core: PropertyDataCore | undefined): Partial<CanonicalSubject> {
    if (!core) return {};
    const out: Partial<CanonicalSubject> = {};

    const gla = finiteOrNull(core.grossLivingArea);
    if (gla != null) out.grossLivingArea = gla;

    const totalRooms = finiteOrNull(core.totalRooms);
    if (totalRooms != null) out.totalRooms = totalRooms;

    const beds = finiteOrNull(core.bedrooms);
    if (beds != null) out.bedrooms = beds;

    const bf = finiteOrNull(core.bathsFull);
    const bh = finiteOrNull(core.bathsHalf);
    if (bf != null) out.bathsFull = bf;
    if (bh != null) out.bathsHalf = bh;
    if (bf != null && bh != null) {
        out.bathrooms = bf + bh * 0.5;
    } else if (bf != null) {
        out.bathrooms = bf;
    }

    const yearBuilt = finiteOrNull(core.yearBuilt);
    if (yearBuilt != null) out.yearBuilt = yearBuilt;

    const effectiveAge = finiteOrNull(core.effectiveAge);
    if (effectiveAge != null) out.effectiveAge = effectiveAge;

    const lot = finiteOrNull(core.lotSizeSqFt);
    if (lot != null) out.lotSizeSqFt = lot;

    const propertyType = trimOrNull(core.propertyType ?? null);
    if (propertyType) out.propertyType = propertyType;

    const stories = finiteOrNull(core.stories);
    if (stories != null) out.stories = stories;

    const garage = trimOrNull(core.garage ?? null);
    if (garage) out.garageType = garage;

    const basement = trimOrNull(core.basement ?? null);
    if (basement) out.basement = basement;

    const apn = trimOrNull(core.parcelNumber ?? null);
    if (apn) out.parcelNumber = apn;

    const lat = finiteOrNull(core.latitude);
    if (lat != null) out.latitude = lat;

    const lng = finiteOrNull(core.longitude);
    if (lng != null) out.longitude = lng;

    return out;
}

/** Build a partial CanonicalAddress carrying only the geocoded fields enrichment supplies. */
function mapCoreToAddressPatch(core: PropertyDataCore | undefined): Partial<CanonicalAddress> {
    if (!core) return {};
    const patch: Partial<CanonicalAddress> = {};
    const county = trimOrNull(core.county ?? null);
    if (county) patch.county = county;
    return patch;
}

/**
 * Map provider's PropertyDataPublicRecord → CanonicalSubject fields.
 *
 * `taxAssessedValue` does not have a direct subject slot in canonical
 * (it lives on PropertyRecord.taxAssessments as a time series). It is
 * intentionally omitted here.
 */
function mapPublicRecordToSubject(pr: PropertyDataPublicRecord | undefined): Partial<CanonicalSubject> {
    if (!pr) return {};
    const out: Partial<CanonicalSubject> = {};

    const taxYear = finiteOrNull(pr.taxYear);
    if (taxYear != null) out.taxYear = taxYear;

    const annualTax = finiteOrNull(pr.annualTaxAmount);
    if (annualTax != null) out.annualTaxes = annualTax;

    const legal = trimOrNull(pr.legalDescription ?? null);
    if (legal) out.legalDescription = legal;

    const zoning = trimOrNull(pr.zoning ?? null);
    if (zoning) out.zoning = zoning;

    const owner = trimOrNull(pr.ownerName ?? null);
    if (owner) out.currentOwner = owner;

    return out;
}

/** Map provider's PropertyDataFlood → CanonicalSubject flood fields. */
function mapFloodToSubject(flood: PropertyDataFlood | undefined): Partial<CanonicalSubject> {
    if (!flood) return {};
    const out: Partial<CanonicalSubject> = {};

    const zone = trimOrNull(flood.femaFloodZone ?? null);
    if (zone) out.floodZone = zone;

    const mapNumber = trimOrNull(flood.femaMapNumber ?? null);
    if (mapNumber) out.floodMapNumber = mapNumber;

    const mapDate = trimOrNull(flood.femaMapDate ?? null);
    if (mapDate) out.floodMapDate = mapDate;

    return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Project a single PropertyDataResult onto a partial CanonicalReportDocument.
 *
 * Returns null when the input has no subject-relevant content so callers
 * (canonical-snapshot.service) can skip emitting an empty branch.
 *
 * The returned `subject` is a Partial<CanonicalSubject>; the caller is
 * expected to merge it with subject fragments from other sources
 * (e.g. axiom extraction). The snapshot pattern is "merge enrichment
 * first, then extraction on top" — see file header.
 *
 * Address merge: when enrichment supplies geocoded fields (county) we
 * emit `subject.address` as a partial address patch. The downstream merge
 * step is responsible for combining this with the appraisal-report
 * address; this mapper does not own the full address.
 */
export function mapPropertyEnrichmentToCanonical(
    result: PropertyDataResult | null | undefined,
): Partial<CanonicalReportDocument> | null {
    if (!result) return null;

    const subject: Partial<CanonicalSubject> = {
        ...mapCoreToSubject(result.core),
        ...mapPublicRecordToSubject(result.publicRecord),
        ...mapFloodToSubject(result.flood),
    };

    const addressPatch = mapCoreToAddressPatch(result.core);
    if (Object.keys(addressPatch).length > 0) {
        // Cast: emitting a partial address. The snapshot merge layer combines
        // this with the extraction-side address into a full CanonicalAddress.
        subject.address = addressPatch as CanonicalAddress;
    }

    if (Object.keys(subject).length === 0) {
        return null;
    }

    return { subject: subject as CanonicalSubject };
}
