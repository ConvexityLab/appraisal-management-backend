/**
 * Axiom Extraction → AMP Canonical Mapper
 *
 * Projects Axiom's raw extracted-fields shape onto the AMP canonical schema
 * (UAD 3.6 / URAR / MISMO 3.4 aligned). The canonical schema in
 * src/types/canonical-schema.ts is the single source of truth for review
 * data shape across both repos; Axiom's extraction output is one source
 * that needs adapting to it.
 *
 * Without this mapper, criterion `requiredDataPoints` authored against
 * the canonical (e.g. `subject.address.streetAddress`, `subject.condition`)
 * cannot resolve, because the canonical-snapshot's `extraction` source
 * carries Axiom's raw flat shape (`propertyAddress.street.value`,
 * `overallConditionRating.value`).
 *
 * Axiom's extraction value envelope:
 *   Each scalar field is wrapped as
 *     { value: ..., confidence: number, sourceBatch: string, sourcePages: number[] }
 *   This mapper unwraps `.value` everywhere.
 *
 * Comparables in Axiom are emitted as `comparable1`, `comparable2`,
 * `comparable3` (each an object). They get flattened to a `comps[]` array
 * in canonical order (slot 1, 2, 3).
 *
 * Output shape: a partial `CanonicalReportDocument`. Fields not present in
 * the extraction are simply omitted; downstream consumers handle missing
 * paths as missing.
 */

import type {
    CanonicalAddress,
    CanonicalComp,
    CanonicalReportDocument,
    CanonicalSubject,
} from '../types/canonical-schema.js';

// ─── Value-envelope helpers ────────────────────────────────────────────────────

interface AxiomValueWrapper {
    value?: unknown;
}

/**
 * Unwrap Axiom's `{value, confidence, ...}` envelope. Returns the raw `.value`
 * if present, the value itself if it's already a primitive, or null otherwise.
 */
function unwrap(field: unknown): unknown {
    if (field == null) return null;
    if (typeof field !== 'object') return field;
    if (Array.isArray(field)) return field;
    if ('value' in (field as object)) {
        const v = (field as AxiomValueWrapper).value;
        return v == null ? null : v;
    }
    return field;
}

function asString(field: unknown): string | null {
    const v = unwrap(field);
    if (v == null) return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}

function asNumber(field: unknown): number | null {
    const v = unwrap(field);
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).replace(/[^\d.\-eE]/g, '');
    if (s.length === 0) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/** Extract leading numeric portion from a string like "10197 sf" → 10197, "0.82 miles N" → 0.82. */
function asNumberWithUnit(field: unknown): number | null {
    const v = unwrap(field);
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const m = String(v).match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
}

function obj(value: unknown): Record<string, unknown> | null {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

// ─── Address parsing ──────────────────────────────────────────────────────────

function mapAddressFromBlock(block: unknown): CanonicalAddress | null {
    const b = obj(block);
    if (!b) return null;
    const streetAddress = asString(b['street']) ?? asString(b['streetAddress']);
    const city = asString(b['city']);
    const state = asString(b['state']);
    const zipCode = (() => {
        const raw = unwrap(b['zipCode'] ?? b['zip']);
        if (raw == null) return null;
        // Axiom sometimes returns ZIP as a number — normalize to a 5-char string,
        // padding short ZIPs that lost a leading zero (e.g. 2919 → "02919").
        if (typeof raw === 'number') return String(raw).padStart(5, '0');
        const s = String(raw).trim();
        return s.length > 0 ? s : null;
    })();

    if (streetAddress == null && city == null && state == null && zipCode == null) {
        return null;
    }

    return {
        streetAddress: streetAddress ?? '',
        unit: asString(b['unit']),
        city: city ?? '',
        state: state ?? '',
        zipCode: zipCode ?? '',
        county: asString(b['county']) ?? '',
    };
}

/** Parse a comp's free-text address ("29 Camille Dr, Johnston, RI 02919") into structured fields. */
function parseFreeTextAddress(text: string): CanonicalAddress | null {
    if (!text) return null;
    const parts = text.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length === 0) return null;
    // Last part: "RI 02919" or "RI" — split off ZIP if present.
    const last = parts[parts.length - 1] ?? '';
    const stateZip = last.match(/^([A-Z]{2})\s+(\d{4,5})$/);
    let state = '';
    let zipCode = '';
    let cityIdx = parts.length - 1;
    if (stateZip) {
        state = stateZip[1] ?? '';
        zipCode = (stateZip[2] ?? '').padStart(5, '0');
        cityIdx = parts.length - 2;
    } else {
        // Try "STATE" alone in last segment.
        const stateOnly = last.match(/^([A-Z]{2})$/);
        if (stateOnly) {
            state = stateOnly[1] ?? '';
            cityIdx = parts.length - 2;
        }
    }
    const city = cityIdx >= 0 ? parts[cityIdx] ?? '' : '';
    const streetParts = cityIdx > 0 ? parts.slice(0, cityIdx) : [];
    const streetAddress = streetParts.join(', ');
    return {
        streetAddress,
        unit: null,
        city,
        state,
        zipCode,
        county: '',
    };
}

// ─── Subject mapping ──────────────────────────────────────────────────────────

/**
 * Project Axiom's flat neighborhood-* fields onto the nested
 * CanonicalSubject.neighborhood (CanonicalNeighborhood).
 *
 * Axiom emits:    neighborhoodLocation, neighborhoodGrowth, neighborhoodPropertyValues,
 *                 neighborhoodDemandSupply, neighborhoodMarketingTime
 * AMP canonical:  subject.neighborhood.{locationType, growth, propertyValues,
 *                                       demandSupply, marketingTime}
 *
 * Returns undefined if no neighborhood fields are present so the caller can
 * skip emitting an empty subject.neighborhood block.
 */
function mapNeighborhood(extraction: Record<string, unknown>): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const location = asString(extraction['neighborhoodLocation']);
    if (location) out['locationType'] = location;
    const growth = asString(extraction['neighborhoodGrowth']);
    if (growth) out['growth'] = growth;
    const propertyValues = asString(extraction['neighborhoodPropertyValues']);
    if (propertyValues) out['propertyValues'] = propertyValues;
    const demandSupply = asString(extraction['neighborhoodDemandSupply']);
    if (demandSupply) out['demandSupply'] = demandSupply;
    const marketingTime = asString(extraction['neighborhoodMarketingTime']);
    if (marketingTime) out['marketingTime'] = marketingTime;
    return Object.keys(out).length > 0 ? out : undefined;
}

function mapSubject(extraction: Record<string, unknown>): Partial<CanonicalSubject> {
    const out: Partial<CanonicalSubject> = {};

    const address = mapAddressFromBlock(extraction['propertyAddress']);
    if (address) {
        out.address = address;
    }

    const apn = asString(extraction['assessorsParcelNumber']);
    if (apn) out.parcelNumber = apn;

    const legal = asString(extraction['legalDescription']);
    if (legal) out.legalDescription = legal;

    const yearBuilt = asNumber(extraction['yearBuilt']);
    if (yearBuilt != null) out.yearBuilt = yearBuilt;

    const gla = asNumber(extraction['grossLivingArea']);
    if (gla != null) out.grossLivingArea = gla;

    const totalBedrooms = asNumber(extraction['totalBedrooms']);
    if (totalBedrooms != null) out.bedrooms = totalBedrooms;

    const totalBathrooms = asNumber(extraction['totalBathrooms']);
    if (totalBathrooms != null) out.bathrooms = totalBathrooms;

    const totalRooms = asNumber(extraction['totalRooms']);
    if (totalRooms != null) out.totalRooms = totalRooms;

    const lotSize = asNumberWithUnit(extraction['siteSize']);
    if (lotSize != null) out.lotSizeSqFt = lotSize;

    const heating = asString(extraction['heatingType']);
    if (heating) out.heating = heating;

    const cooling = asString(extraction['coolingType']);
    if (cooling) out.cooling = cooling;

    const condition = asString(extraction['overallConditionRating']);
    if (condition) out.condition = condition;

    const conditionDesc = asString(extraction['defectsDescription']);
    if (conditionDesc) out.conditionDescription = conditionDesc;

    const quality = asString(extraction['overallQualityRating']);
    if (quality) out.quality = quality;

    const constructionType = asString(extraction['constructionType']);
    if (constructionType) out.design = constructionType;

    const zoning = asString(extraction['zoning']);
    if (zoning) out.zoning = zoning;

    const occupancy = asString(extraction['occupancyType']);
    if (occupancy) {
        // Axiom emits "N;Res;" style — best-effort map; unknown values fall through.
        const lower = occupancy.toLowerCase();
        if (lower.includes('owner')) out.occupant = 'Owner';
        else if (lower.includes('tenant')) out.occupant = 'Tenant';
        else if (lower.includes('vacant')) out.occupant = 'Vacant';
    }

    const taxYear = asNumber(extraction['taxYear']);
    if (taxYear != null) out.taxYear = taxYear;

    const annualTaxes = asNumber(extraction['realEstateTaxes']);
    if (annualTaxes != null) out.annualTaxes = annualTaxes;

    // Highest & best use — Axiom returns a flag (boolean-ish) indicating
    // whether the appraiser concluded "present use" is the highest and best
    // use. Map to the legacy `highestAndBestUse` enum on CanonicalSubject:
    // truthy → 'Present', falsy-but-defined → 'Other'.
    const hbuRaw = unwrap(extraction['highestBestUseIsPresent']);
    if (hbuRaw != null) {
        const truthy = hbuRaw === true
            || (typeof hbuRaw === 'string' && /^(true|yes|y|present)$/i.test(hbuRaw.trim()))
            || (typeof hbuRaw === 'number' && hbuRaw !== 0);
        out.highestAndBestUse = truthy ? 'Present' : 'Other';
    }

    // Neighborhood — flat fields → nested CanonicalNeighborhood.
    const neighborhood = mapNeighborhood(extraction);
    if (neighborhood) {
        out.neighborhood = neighborhood as unknown as NonNullable<CanonicalSubject['neighborhood']>;
    }

    return out;
}

// ─── Comp mapping ─────────────────────────────────────────────────────────────

function mapComp(rawComp: unknown, slot: number): Partial<CanonicalComp> | null {
    const c = obj(rawComp);
    if (!c) return null;

    const out: Partial<CanonicalComp> & {
        compId: string;
        slotIndex: number;
    } = {
        compId: `axiom-comp-${slot}`,
        slotIndex: slot,
    };

    // Address: comparables in Axiom emit address as a single free-text string
    // (e.g. "29 Camille Dr, Johnston, RI 02919"), not a structured block.
    const rawAddress = unwrap(c['address']);
    if (typeof rawAddress === 'string') {
        const parsed = parseFreeTextAddress(rawAddress);
        if (parsed) out.address = parsed;
    } else if (obj(rawAddress)) {
        const block = mapAddressFromBlock(rawAddress);
        if (block) out.address = block;
    }

    const salePrice = asNumber(c['salePrice']);
    if (salePrice != null) out.salePrice = salePrice;

    const saleDate = asString(c['saleDate']);
    if (saleDate) out.saleDate = saleDate;

    const distance = asNumberWithUnit(c['proximity']);
    if (distance != null) out.distanceFromSubjectMiles = distance;

    const proximityText = asString(c['proximity']);
    if (proximityText) out.proximityToSubject = proximityText;

    const gla = asNumber(c['gla'] ?? c['grossLivingArea']);
    if (gla != null) out.grossLivingArea = gla;

    const yearBuilt = asNumber(c['yearBuilt']);
    if (yearBuilt != null) out.yearBuilt = yearBuilt;

    const propertyType = asString(c['propertyType']);
    if (propertyType) out.propertyType = propertyType;

    return out;
}

function mapComps(extraction: Record<string, unknown>): Partial<CanonicalComp>[] {
    const out: Partial<CanonicalComp>[] = [];
    for (let i = 1; i <= 6; i++) {
        const raw = extraction[`comparable${i}`];
        const mapped = mapComp(raw, i);
        if (mapped) out.push(mapped);
    }
    return out;
}

// ─── Appraiser-info mapping ───────────────────────────────────────────────────

function mapAppraiserInfo(extraction: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const name = asString(extraction['appraiserName']);
    if (name) out['name'] = name;
    const license = asString(extraction['appraiserLicenseNumber']);
    if (license) out['licenseNumber'] = license;
    const company = asString(extraction['appraiserCompanyName']);
    if (company) out['companyName'] = company;
    const sigDate = asString(extraction['dateOfReport']) ?? asString(extraction['effectiveDateOfAppraisal']);
    if (sigDate) out['signatureDate'] = sigDate;
    return out;
}

// ─── Reconciliation / valuation mapping ───────────────────────────────────────

function mapReconciliation(extraction: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const finalValue = asNumber(extraction['opinionOfMarketValue']);
    if (finalValue != null) out['finalOpinionOfValue'] = finalValue;

    const salesComp = asNumber(extraction['indicatedValueBySalesComparison']);
    if (salesComp != null) out['salesCompApproachValue'] = salesComp;

    const cost = asNumber(extraction['indicatedValueByCostApproach']);
    if (cost != null) out['costApproachValue'] = cost;

    const income = asNumber(extraction['indicatedValueByIncomeApproach']);
    if (income != null) out['incomeApproachValue'] = income;

    const effectiveDate = asString(extraction['effectiveDateOfAppraisal']);
    if (effectiveDate) out['effectiveDate'] = effectiveDate;

    return out;
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

/**
 * Project an Axiom raw-extraction document onto AMP canonical-schema shape.
 *
 * Returns a partial `CanonicalReportDocument` (only the populated branches).
 * Missing extraction fields produce missing canonical fields — consumers
 * handle missing paths as missing during requirement resolution.
 */
export function mapAxiomExtractionToCanonical(
    rawExtraction: unknown,
): Partial<CanonicalReportDocument> {
    const ex = obj(rawExtraction);
    if (!ex) return {};

    const out: Partial<CanonicalReportDocument> = {};

    const subject = mapSubject(ex);
    if (Object.keys(subject).length > 0) {
        out.subject = subject as CanonicalSubject;
    }

    const comps = mapComps(ex);
    if (comps.length > 0) {
        out.comps = comps as CanonicalComp[];
    }

    const appraiserInfo = mapAppraiserInfo(ex);
    if (Object.keys(appraiserInfo).length > 0) {
        // Cast through unknown — we're emitting a partial so we don't satisfy
        // every required field in CanonicalAppraiserInfo. NonNullable to placate
        // exactOptionalPropertyTypes; the conditional above guarantees defined.
        out.appraiserInfo = appraiserInfo as unknown as NonNullable<CanonicalReportDocument['appraiserInfo']>;
    }

    const reconciliation = mapReconciliation(ex);
    if (Object.keys(reconciliation).length > 0) {
        out.reconciliation = reconciliation as unknown as NonNullable<CanonicalReportDocument['reconciliation']>;
    }

    return out;
}
