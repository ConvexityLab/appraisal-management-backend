/**
 * Loan-tape → Canonical mapper
 *
 * Projects a RiskTapeItem (the legacy bulk-tape row shape — see
 * src/types/review-tape.types.ts) onto the canonical loan + ratios branches
 * (MISMO 3.4 / URLA aligned). Same pattern as axiom-extraction.mapper —
 * canonical is the destination; vendor / legacy shapes are the source.
 *
 * Single-order callers can construct a partial RiskTapeItem from the
 * Order + canonical valuation if a real loan tape isn't available;
 * fields not present default to null and downstream consumers handle missing
 * paths as missing (rather than silently defaulting).
 */

import type { RiskTapeItem } from '../types/review-tape.types.js';
import type { CanonicalLoan, CanonicalLoanRatios } from '@l1/shared-types';

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

function b(v: unknown): boolean | null {
    if (v == null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
        const t = v.trim().toLowerCase();
        if (['true', 'yes', 'y', '1'].includes(t)) return true;
        if (['false', 'no', 'n', '0'].includes(t)) return false;
    }
    return null;
}

/**
 * Map RiskTapeItem.loanType / loanPurpose to the typed enums on CanonicalLoan.
 * RiskTapeItem keeps these as free strings; we normalize defensively and fall
 * back to null (not a default) when the input doesn't match a known value.
 */
function mapLoanPurpose(raw: unknown): CanonicalLoan['loanPurposeType'] {
    const v = s(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('purchase')) return 'Purchase';
    if (v.includes('refi')) return 'Refinance';
    if (v.includes('construction') && v.includes('perm')) return 'ConstructionPermanent';
    if (v.includes('construction')) return 'Construction';
    return 'Other';
}

function mapMortgageType(raw: unknown): CanonicalLoan['mortgageType'] {
    const v = s(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('fha')) return 'FHA';
    if (v.includes('va')) return 'VA';
    if (v.includes('usda')) return 'USDA';
    if (v.includes('jumbo')) return 'Jumbo';
    if (v.includes('non-qm') || v.includes('nonqm')) return 'NonQM';
    if (v.includes('conventional') || v.includes('conv')) return 'Conventional';
    return 'Other';
}

function mapOccupancy(raw: unknown): CanonicalLoan['occupancyType'] {
    const v = s(raw)?.toLowerCase();
    if (!v) return null;
    if (v.includes('owner') || v.includes('primary')) return 'PrimaryResidence';
    if (v.includes('second') || v.includes('vacation')) return 'SecondHome';
    if (v.includes('investment') || v.includes('rental') || v.includes('investor')) return 'Investment';
    return 'Other';
}

function mapCashOutDetermination(
    raw: unknown,
    fallback: boolean | null,
): CanonicalLoan['refinanceCashOutDeterminationType'] {
    const v = s(raw)?.toLowerCase();
    if (v) {
        if (v.includes('cashout') || v === 'cash-out' || v === 'cash out') return 'CashOut';
        if (v.includes('limited')) return 'LimitedCashOut';
        if (v.includes('nocash') || v === 'no cash-out' || v === 'no-cash-out' || v === 'no cash out') return 'NoCashOut';
        return 'Unknown';
    }
    if (fallback === true) return 'CashOut';
    if (fallback === false) return 'NoCashOut';
    return null;
}

// ─── Public mapper functions ──────────────────────────────────────────────────

/**
 * Project a RiskTapeItem onto the CanonicalLoan branch.
 *
 * Source coverage: RiskTapeItem covers most loan-economics fields (loanAmount,
 * lien balances, occupancyType, cashOutRefi, loanType, loanPurpose). Items not
 * carried by RiskTapeItem (interest rate, term in months, lien-priority enum)
 * are mapped null until a richer source is plumbed.
 *
 * Returns null if the input is null/undefined.
 */
export function mapLoanFromTape(tape: Partial<RiskTapeItem> | null | undefined): CanonicalLoan | null {
    if (!tape) return null;

    const baseLoanAmount = n(tape.loanAmount);
    const firstLien = n(tape.firstLienBalance);
    const secondLien = n(tape.secondLienBalance);
    const totalLien =
        firstLien != null || secondLien != null
            ? (firstLien ?? 0) + (secondLien ?? 0)
            : null;

    const cashOutBool = b(tape.cashOutRefi);
    const cashOutDetermination = mapCashOutDetermination(tape.cashOutRefi, cashOutBool);

    return {
        baseLoanAmount,
        loanPurposeType: mapLoanPurpose(tape.loanPurpose),
        mortgageType: mapMortgageType(tape.loanType),
        // RiskTapeItem doesn't carry lien priority of the subject loan; we default
        // to FirstLien when there's a baseLoanAmount and no explicit indicator
        // (most appraisal review traffic is first-lien purchase / refi). When the
        // tape supplies it directly we'll use that path; for now this is null.
        lienPriorityType: null,
        firstLienBalance: firstLien,
        secondLienBalance: secondLien,
        totalLienBalance: totalLien,
        refinanceCashOutDeterminationType: cashOutDetermination,
        // RiskTapeItem doesn't carry the cash-out amount; null until plumbed.
        refinanceCashOutAmount: null,
        isCashOutRefinance: cashOutBool,
        occupancyType: mapOccupancy(tape.occupancyType),
        // Interest rate and term are not on RiskTapeItem; need a richer
        // loan-tape source to populate.
        interestRatePercent: null,
        loanTermMonths: null,
        loanNumber: s(tape.loanNumber),
    };
}

/**
 * Compute CanonicalLoanRatios from canonical loan + an appraised value.
 *
 * Pure calculation — given canonical inputs, deterministically produces the
 * ratio values. Returns null only when there's no loan present (no ratios to
 * compute).
 *
 * @param loan - the canonical loan branch
 * @param appraisedValue - the subject's appraised value (e.g. canonical.valuation.estimatedValue)
 * @param tape - optional tape input for fields not on the canonical loan (DSCR, DTI)
 */
export function computeLoanRatios(
    loan: CanonicalLoan | null,
    appraisedValue: number | null,
    tape?: Partial<RiskTapeItem> | null,
): CanonicalLoanRatios | null {
    if (!loan) return null;

    const ltvBase = appraisedValue != null && appraisedValue > 0 && loan.baseLoanAmount != null
        ? (loan.baseLoanAmount / appraisedValue) * 100
        : null;

    const cltvNumerator = loan.totalLienBalance ?? loan.baseLoanAmount;
    const cltv = appraisedValue != null && appraisedValue > 0 && cltvNumerator != null
        ? (cltvNumerator / appraisedValue) * 100
        : null;

    const dscr = n(tape?.dscr);

    return {
        loanToValueRatioPercent: ltvBase,
        combinedLoanToValueRatioPercent: cltv,
        // HCLTV requires HELOC max-line data; not on RiskTapeItem.
        highCombinedLoanToValueRatioPercent: null,
        debtServiceCoverageRatio: dscr,
        // DTI not on RiskTapeItem; null until plumbed.
        debtToIncomeRatioPercent: null,
    };
}
