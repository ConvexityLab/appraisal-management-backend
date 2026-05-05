/**
 * AppraisalOrder → AMP canonical mapper
 *
 * Projects an order's intake fields (address, property details, loan info,
 * borrower info) onto the canonical schema. Same pattern as the other
 * vendor mappers — canonical is the destination shape; AppraisalOrder is
 * one source.
 *
 * Without this mapper, canonical only gets populated AFTER an extraction
 * run completes, so review-program criteria authored against canonical
 * paths (`subject.address.streetAddress`, `loan.baseLoanAmount`,
 * `ratios.loanToValueRatioPercent`) couldn't see order-intake values
 * during the pre-extraction window. This mapper fills that gap so the
 * snapshot has at-intake-time values even before Axiom runs, with
 * extraction merging on top once it completes.
 *
 * Coverage:
 *   - subject.address                from order.propertyAddress
 *   - subject.{propertyType, bedrooms, bathrooms, yearBuilt,
 *              grossLivingArea, lotSizeSqFt, condition, stories}
 *                                    from order.propertyDetails
 *   - subject.occupant                from order.propertyDetails.occupancy
 *   - loan.{baseLoanAmount,
 *           loanPurposeType, mortgageType,
 *           loanNumber}              from order.loanInformation
 *   - ratios.{loanToValueRatioPercent,
 *             debtToIncomeRatioPercent}  from order.loanInformation
 *
 * Items not on AppraisalOrder (comparables, neighborhood, valuation,
 * appraiser info) are omitted; downstream merge sources fill those in.
 */

import type {
    CanonicalAddress,
    CanonicalLoan,
    CanonicalLoanRatios,
    CanonicalReportDocument,
    CanonicalSubject,
} from '../types/canonical-schema.js';
import type { AppraisalOrder } from '../types/index.js';

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

// ─── Loan-purpose / mortgage / occupancy normalisation ────────────────────────
//
// AppraisalOrder.LoanInfo carries loanType / loanPurpose as enums (LoanType /
// LoanPurpose) — we normalise them to MISMO-aligned canonical enums. Same
// vocabulary as loan-tape.mapper / bulk-ingestion-source.mapper.

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

function mapOccupancyToOccupant(raw: string | null | undefined): CanonicalSubject['occupant'] {
    const v = trimOrNull(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('owner') || v.includes('primary')) return 'Owner';
    if (v.includes('tenant') || v.includes('rental') || v.includes('investment')) return 'Tenant';
    if (v.includes('vacant')) return 'Vacant';
    return null;
}

function mapOccupancyToCanonicalLoan(raw: string | null | undefined): CanonicalLoan['occupancyType'] {
    const v = trimOrNull(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('owner') || v.includes('primary')) return 'PrimaryResidence';
    if (v.includes('second') || v.includes('vacation')) return 'SecondHome';
    if (v.includes('investment') || v.includes('rental') || v.includes('investor')) return 'Investment';
    return 'Other';
}

/**
 * Normalise a borrower-supplied LTV / DTI value to MISMO percentage form
 * (e.g. 80, not 0.80). Heuristic: values <= 1 are treated as fractions and
 * scaled by 100; values > 1 are assumed percentage-form already. Returns
 * null on missing / non-finite input.
 */
function toPercentValue(raw: number | null | undefined): number | null {
    const v = finiteOrNull(raw);
    if (v == null) return null;
    return v <= 1 ? v * 100 : v;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildAddress(order: AppraisalOrder): CanonicalAddress | null {
    const a = order.propertyAddress;
    if (!a) return null;

    const street = trimOrNull(a.streetAddress);
    const city = trimOrNull(a.city);
    const state = trimOrNull(a.state);
    const zip = trimOrNull(a.zipCode);
    const county = trimOrNull(a.county);

    if (!street && !city && !state && !zip && !county) return null;

    return {
        streetAddress: street ?? '',
        unit: null,
        city: city ?? '',
        state: state ?? '',
        zipCode: zip ?? '',
        county: county ?? '',
    };
}

function buildSubject(order: AppraisalOrder): Partial<CanonicalSubject> | null {
    const out: Partial<CanonicalSubject> = {};

    const address = buildAddress(order);
    if (address) out.address = address;

    const apn = trimOrNull(order.propertyAddress?.apn);
    if (apn) out.parcelNumber = apn;

    const legal = trimOrNull(order.propertyAddress?.legalDescription);
    if (legal) out.legalDescription = legal;

    const coords = order.propertyAddress?.coordinates;
    if (coords?.latitude != null && Number.isFinite(coords.latitude)) {
        out.latitude = coords.latitude;
    }
    if (coords?.longitude != null && Number.isFinite(coords.longitude)) {
        out.longitude = coords.longitude;
    }

    const details = order.propertyDetails;
    if (details) {
        const propertyType = trimOrNull(details.propertyType as unknown as string);
        if (propertyType) out.propertyType = propertyType;

        const yearBuilt = finiteOrNull(details.yearBuilt);
        if (yearBuilt != null) out.yearBuilt = yearBuilt;

        const gla = finiteOrNull(details.grossLivingArea);
        if (gla != null) out.grossLivingArea = gla;

        const lot = finiteOrNull(details.lotSize);
        if (lot != null) out.lotSizeSqFt = lot;

        const beds = finiteOrNull(details.bedrooms);
        if (beds != null) out.bedrooms = beds;

        const baths = finiteOrNull(details.bathrooms);
        if (baths != null) out.bathrooms = baths;

        const stories = finiteOrNull(details.stories);
        if (stories != null) out.stories = stories;

        const condition = trimOrNull(details.condition as unknown as string);
        if (condition) out.condition = condition;

        const occupant = mapOccupancyToOccupant(details.occupancy as unknown as string);
        if (occupant) out.occupant = occupant;
    }

    return Object.keys(out).length > 0 ? out : null;
}

function buildLoan(order: AppraisalOrder): CanonicalLoan | null {
    const li = order.loanInformation;
    if (!li) return null;

    const baseLoanAmount = finiteOrNull(li.loanAmount);
    const loanPurposeType = mapLoanPurpose(li.loanPurpose as unknown as string);
    const mortgageType = mapMortgageType(li.loanType as unknown as string);
    const occupancyType = mapOccupancyToCanonicalLoan(order.propertyDetails?.occupancy as unknown as string);

    if (
        baseLoanAmount == null
        && loanPurposeType == null
        && mortgageType == null
        && occupancyType == null
    ) {
        return null;
    }

    return {
        baseLoanAmount,
        loanPurposeType,
        mortgageType,
        // AppraisalOrder doesn't carry lien priority; null until plumbed.
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
        loanNumber: null,
    };
}

function buildRatios(order: AppraisalOrder): CanonicalLoanRatios | null {
    const li = order.loanInformation;
    if (!li) return null;

    const ltv = toPercentValue(li.ltv);
    const dti = toPercentValue(li.dti);

    if (ltv == null && dti == null) return null;

    return {
        loanToValueRatioPercent: ltv,
        // CLTV / HCLTV / DSCR are not on AppraisalOrder — null until plumbed.
        combinedLoanToValueRatioPercent: null,
        highCombinedLoanToValueRatioPercent: null,
        debtServiceCoverageRatio: null,
        debtToIncomeRatioPercent: dti,
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Project an AppraisalOrder onto a partial CanonicalReportDocument.
 *
 * Returns null when the order has no canonical-relevant content (rare —
 * orders almost always have a property address). The returned partial is
 * suitable for merging with other source-projected canonical fragments
 * (extraction, enrichment, tape) in canonical-snapshot.service.
 */
export function mapAppraisalOrderToCanonical(
    order: AppraisalOrder | null | undefined,
): Partial<CanonicalReportDocument> | null {
    if (!order) return null;

    const out: Partial<CanonicalReportDocument> = {};

    const subject = buildSubject(order);
    if (subject) out.subject = subject as CanonicalSubject;

    const loan = buildLoan(order);
    if (loan) out.loan = loan;

    const ratios = buildRatios(order);
    if (ratios) out.ratios = ratios;

    return Object.keys(out).length > 0 ? out : null;
}
