/**
 * Transaction-history → Canonical mapper
 *
 * Builds CanonicalTransactionHistory for the SUBJECT property — prior sales
 * with months-ago and computed appreciation deltas vs the current appraised
 * value.
 *
 * Source coverage:
 *   - RiskTapeItem.priorPurchasePrice / priorPurchaseDate           (most recent)
 *   - RiskTapeItem.priorSale24mPrice / priorSale24mDate / appreciation24m
 *   - RiskTapeItem.priorSale36mPrice / priorSale36mDate / appreciation36m
 *
 * If the tape lacks a precomputed appreciation value but supplies the prior
 * sale price + date, we recompute. If neither is supplied, leaves the
 * relevant field null.
 *
 * Comparable prior sales live on CanonicalComp.priorSalePrice / priorSaleDate
 * already; this mapper is for the subject branch only.
 */

import type { RiskTapeItem } from '../types/review-tape.types.js';
import type {
    CanonicalPriorTransfer,
    CanonicalTransactionHistory,
} from '../types/canonical-schema.js';

function n(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).replace(/[^\d.\-eE]/g, '');
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
}

function s(v: unknown): string | null {
    if (v == null) return null;
    const t = String(v).trim();
    return t.length > 0 ? t : null;
}

/** Months between two ISO dates, rounded to nearest integer. Null on bad input. */
function monthsBetween(earlier: string | null, later: string | null): number | null {
    if (!earlier || !later) return null;
    const a = Date.parse(earlier);
    const b = Date.parse(later);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    const days = (b - a) / (1000 * 60 * 60 * 24);
    return Math.round(days / 30.4375);
}

/** Compute appreciation % from prior sale → current value: (current - prior) / prior * 100. */
function computeAppreciationPercent(priorPrice: number | null, currentValue: number | null): number | null {
    if (priorPrice == null || priorPrice <= 0 || currentValue == null) return null;
    return ((currentValue - priorPrice) / priorPrice) * 100;
}

/**
 * Project tape prior-sale fields + a current effective date / appraised value
 * onto CanonicalTransactionHistory.
 *
 * Returns null if the tape carries no prior-sale data at all.
 */
export function mapTransactionHistoryFromTape(args: {
    tape: Partial<RiskTapeItem> | null | undefined;
    /** Current appraised value — used for appreciation calculations. */
    appraisedValue: number | null;
    /** Effective date of the appraisal (ISO) — used for months-ago. */
    effectiveDate: string | null;
}): CanonicalTransactionHistory | null {
    const { tape, appraisedValue, effectiveDate } = args;
    if (!tape) return null;

    const transfers: CanonicalPriorTransfer[] = [];

    // Most recent prior purchase (no fixed window).
    const purchasePrice = n(tape.priorPurchasePrice);
    const purchaseDate = s(tape.priorPurchaseDate);
    if (purchasePrice != null || purchaseDate != null) {
        transfers.push({
            propertyRole: 'subject',
            transactionDate: purchaseDate,
            salePrice: purchasePrice,
            transferType: 'sale',
            dataSource: null,
            seller: null,
            buyer: null,
            daysOnMarket: null,
            listingId: null,
            isArmsLength: null,
            notes: null,
        });
    }

    // 24-month and 36-month windowed priors.
    const price24m = n(tape.priorSale24mPrice);
    const date24m = s(tape.priorSale24mDate);
    if ((price24m != null || date24m != null) && (price24m !== purchasePrice || date24m !== purchaseDate)) {
        transfers.push({
            propertyRole: 'subject',
            transactionDate: date24m,
            salePrice: price24m,
            transferType: 'sale',
            dataSource: null,
            seller: null,
            buyer: null,
            daysOnMarket: null,
            listingId: null,
            isArmsLength: null,
            notes: '24-month window',
        });
    }
    const price36m = n(tape.priorSale36mPrice);
    const date36m = s(tape.priorSale36mDate);
    if ((price36m != null || date36m != null) && (price36m !== price24m || date36m !== date24m) && (price36m !== purchasePrice || date36m !== purchaseDate)) {
        transfers.push({
            propertyRole: 'subject',
            transactionDate: date36m,
            salePrice: price36m,
            transferType: 'sale',
            dataSource: null,
            seller: null,
            buyer: null,
            daysOnMarket: null,
            listingId: null,
            isArmsLength: null,
            notes: '36-month window',
        });
    }

    // Newest-first.
    transfers.sort((a, b) => {
        if (!a.transactionDate) return 1;
        if (!b.transactionDate) return -1;
        return b.transactionDate.localeCompare(a.transactionDate);
    });

    if (transfers.length === 0 && price24m == null && price36m == null && purchasePrice == null) {
        return null;
    }

    // Appreciation: prefer tape-supplied values, fall back to a recompute.
    // RiskTapeItem stores appreciation as a FRACTION (0.30 for 30%) per
    // legacy bulk-tape convention; canonical uses PERCENTAGE form (30).
    // Multiply tape values by 100; the recompute path already returns
    // percentages.
    const tape24m = n(tape.appreciation24m);
    const tape36m = n(tape.appreciation36m);
    const appreciation24mPercent = tape24m != null
        ? tape24m * 100
        : computeAppreciationPercent(price24m ?? purchasePrice, appraisedValue);
    const appreciation36mPercent = tape36m != null
        ? tape36m * 100
        : computeAppreciationPercent(price36m, appraisedValue);

    return {
        subjectPriorTransfers: transfers,
        priorSalePrice24m: price24m,
        priorSaleDate24m: date24m,
        appreciation24mPercent,
        priorSalePrice36m: price36m,
        priorSaleDate36m: date36m,
        appreciation36mPercent,
    };
    // effectiveDate currently only used downstream by callers that want
    // months-ago annotations on transfers — not yet stored on CanonicalPriorTransfer
    // (no field). Kept in the API in case we add it.
    void effectiveDate;
    void monthsBetween;
}
