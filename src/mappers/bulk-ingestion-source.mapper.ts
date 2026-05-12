/**
 * Bulk-ingestion CSV row → AMP canonical mapper
 *
 * Projects a `BulkIngestionItemInput` (the typed CSV/XLSX row shape produced
 * by the spreadsheet parser) onto the AMP canonical schema (UAD 3.6 / URAR /
 * MISMO 3.4 aligned). Same pattern as axiom-extraction.mapper / loan-tape.mapper
 * — canonical is the destination shape; the row format is the source.
 *
 * Without this mapper, bulk-ingestion produces a flat
 * `BulkIngestionCanonicalRecord.canonicalData: Record<string, unknown>` that
 * is shaped per the resolved adapter definition — NOT per the canonical
 * schema. So criteria authored against canonical paths
 * (`subject.address.streetAddress`, `loan.baseLoanAmount`, etc.) cannot
 * resolve when the upstream is a bulk-tape job.
 *
 * Coverage: rows carry minimal fields (loan, address, borrower, property
 * type). The mapper emits a `Partial<CanonicalReportDocument>` covering:
 *   - `subject.address` (street, city, state, zip, county)
 *   - `subject.propertyType` when supplied
 *   - `loan` branch with whatever loan-economics fields the row has
 *
 * Items not present in the row (year built, GLA, comparables, valuation, etc.)
 * are simply omitted from the canonical projection. Downstream consumers
 * handle missing paths as missing — no defaults, no silent fallbacks.
 *
 * Address parsing: rows may carry a comma-delimited `propertyAddress`
 * ("123 Main St, Springfield, IL 62701") AND/OR explicit `city/state/zipCode`
 * columns. The explicit columns win. Street/unit are extracted from the
 * `propertyAddress` field's comma-delimited prefix.
 */

import type { BulkIngestionItemInput } from '../types/bulk-ingestion.types.js';
import type {
    CanonicalAddress,
    CanonicalLoan,
    CanonicalReportDocument,
    CanonicalSubject,
} from '@l1/shared-types';

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

/**
 * Parse a comma-delimited propertyAddress string into structured parts.
 * Returns the leading street component as `street`, and best-effort city/
 * state/zip when the row didn't supply explicit columns. Caller decides
 * which to use (explicit row columns win over parsed values).
 *
 * Examples:
 *   "123 Main St"                       → { street: '123 Main St' }
 *   "123 Main St, Springfield"          → { street: '123 Main St', city: 'Springfield' }
 *   "123 Main St, Springfield, IL"      → { street: '...', city: '...', state: 'IL' }
 *   "123 Main St, Springfield, IL 62701" → { street: '...', city: '...', state: 'IL', zipCode: '62701' }
 */
function parseCommaDelimitedAddress(raw: string | null | undefined): {
    street: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
} {
    const out = { street: null, city: null, state: null, zipCode: null } as ReturnType<typeof parseCommaDelimitedAddress>;
    const t = trimOrNull(raw);
    if (!t) return out;

    const parts = t.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length === 0) return out;

    out.street = parts[0] ?? null;

    // Last segment may be "STATE ZIP" or just "STATE" or just "ZIP".
    if (parts.length >= 3) {
        out.city = parts[1] ?? null;
        const tail = parts[parts.length - 1] ?? '';
        const m = tail.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (m) {
            out.state = m[1] ?? null;
            out.zipCode = m[2] ?? null;
        } else if (/^[A-Za-z]{2}$/.test(tail)) {
            out.state = tail;
        } else if (/^\d{5}(-\d{4})?$/.test(tail)) {
            out.zipCode = tail;
        }
    } else if (parts.length === 2) {
        out.city = parts[1] ?? null;
    }

    return out;
}

// ─── Loan-purpose / mortgage / occupancy normalisation ────────────────────────
//
// Same vocabulary as loan-tape.mapper. Duplicated here rather than imported
// because the source field names differ (BulkIngestionItemInput has free
// strings) and we don't want a transitive dep on RiskTapeItem.

function mapLoanPurpose(raw: string | null | undefined): CanonicalLoan['loanPurposeType'] {
    const v = trimOrNull(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('purchase')) return 'Purchase';
    if (v.includes('refi')) return 'Refinance';
    if (v.includes('construction') && v.includes('perm')) return 'ConstructionPermanent';
    if (v.includes('construction')) return 'Construction';
    return 'Other';
}

function mapMortgageType(raw: string | null | undefined): CanonicalLoan['mortgageType'] {
    const v = trimOrNull(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('fha')) return 'FHA';
    if (v.includes('va')) return 'VA';
    if (v.includes('usda')) return 'USDA';
    if (v.includes('jumbo')) return 'Jumbo';
    if (v.includes('non-qm') || v.includes('nonqm')) return 'NonQM';
    if (v.includes('conventional') || v.includes('conv')) return 'Conventional';
    return 'Other';
}

function mapOccupancy(raw: string | null | undefined): CanonicalLoan['occupancyType'] {
    const v = trimOrNull(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('owner') || v.includes('primary')) return 'PrimaryResidence';
    if (v.includes('second') || v.includes('vacation')) return 'SecondHome';
    if (v.includes('investment') || v.includes('rental') || v.includes('investor')) return 'Investment';
    return 'Other';
}

// ─── Section builders ─────────────────────────────────────────────────────────

/**
 * Build a `CanonicalAddress` from row fields. Explicit columns (city/state/
 * zipCode/county) take precedence over values parsed out of `propertyAddress`.
 * Returns null when no address content is supplied.
 *
 * The returned shape includes empty strings for required address fields the
 * row didn't supply, matching the convention in axiom-extraction.mapper.
 * Downstream merge layers can fill these in from other sources (e.g.
 * property-enrichment supplies county/lat-lng).
 */
function buildAddress(item: BulkIngestionItemInput): CanonicalAddress | null {
    const parsed = parseCommaDelimitedAddress(item.propertyAddress);
    const street = parsed.street ?? null;
    const city = trimOrNull(item.city) ?? parsed.city;
    const state = trimOrNull(item.state) ?? parsed.state;
    const zipCode = trimOrNull(item.zipCode) ?? parsed.zipCode;
    const county = trimOrNull(item.county);

    if (!street && !city && !state && !zipCode && !county) {
        return null;
    }

    return {
        streetAddress: street ?? '',
        unit: null,
        city: city ?? '',
        state: state ?? '',
        zipCode: zipCode ?? '',
        county: county ?? '',
    };
}

/**
 * Build a CanonicalSubject partial from row fields. Carries only what the row
 * supplies — everything else is omitted, not defaulted.
 */
function buildSubject(item: BulkIngestionItemInput): Partial<CanonicalSubject> | null {
    const out: Partial<CanonicalSubject> = {};

    const address = buildAddress(item);
    if (address) {
        out.address = address;
    }

    const propertyType = trimOrNull(item.propertyType);
    if (propertyType) {
        out.propertyType = propertyType;
    }

    return Object.keys(out).length > 0 ? out : null;
}

/**
 * Build a CanonicalLoan from row fields. Returns null if the row carries
 * no loan information at all.
 */
function buildLoan(item: BulkIngestionItemInput): CanonicalLoan | null {
    const baseLoanAmount = finiteOrNull(item.loanAmount);
    const loanPurposeType = mapLoanPurpose(item.loanPurpose);
    const mortgageType = mapMortgageType(item.loanType);
    const occupancyType = mapOccupancy(item.occupancyType);
    const loanNumber = trimOrNull(item.loanNumber);

    if (
        baseLoanAmount == null
        && loanPurposeType == null
        && mortgageType == null
        && occupancyType == null
        && !loanNumber
    ) {
        return null;
    }

    return {
        baseLoanAmount,
        loanPurposeType,
        mortgageType,
        // CSV rows don't carry lien priority; null until plumbed.
        lienPriorityType: null,
        firstLienBalance: null,
        secondLienBalance: null,
        totalLienBalance: null,
        refinanceCashOutDeterminationType: null,
        refinanceCashOutAmount: null,
        isCashOutRefinance: null,
        occupancyType,
        interestRatePercent: null,
        loanTermMonths: null,
        loanNumber,
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Project a single bulk-ingestion row onto a partial CanonicalReportDocument.
 *
 * Returns null when the row has no canonical-relevant content (no address,
 * loan, or property fields) so callers can skip emitting an empty branch.
 *
 * The returned `subject` and `loan` are partials; downstream merge layers
 * (canonical-snapshot.service) combine them with subject/loan fragments
 * from other sources (property-enrichment, axiom extraction).
 */
export function mapBulkIngestionSourceToCanonical(
    item: BulkIngestionItemInput | null | undefined,
): Partial<CanonicalReportDocument> | null {
    if (!item) return null;

    const out: Partial<CanonicalReportDocument> = {};

    const subject = buildSubject(item);
    if (subject) {
        out.subject = subject as CanonicalSubject;
    }

    const loan = buildLoan(item);
    if (loan) {
        out.loan = loan;
    }

    return Object.keys(out).length > 0 ? out : null;
}
