/**
 * Risk-flags → Canonical mapper
 *
 * Aggregates boolean / categorical risk indicators from multiple sources
 * onto CanonicalRiskFlags. Each flag is independent — a missing source
 * leaves only the flags it would have populated as null.
 *
 * Sources (in priority order when multiple agree):
 *   1. RiskTapeItem (loan-tape) — chainOfTitleRedFlags, cashOutRefi (already
 *      surfaced on canonical.loan), highRiskGeographyFlag, ucdpSsrScore,
 *      collateralRiskRating, appraiserGeoCompetency, unusualAppreciationFlag,
 *      dscrFlag, nonPublicCompsFlag.
 *   2. Provider data (title report, geography service) — when plumbed.
 *
 * Today only RiskTapeItem is wired in; the function signature accepts an
 * optional `providerData` block for forward-compat.
 */

import type { RiskTapeItem } from '../types/review-tape.types.js';
import type { CanonicalRiskFlags } from '@l1/shared-types';

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
        if (['true', 'yes', 'y', '1', 'flag', 'flagged'].includes(t)) return true;
        if (['false', 'no', 'n', '0', 'clear', 'ok'].includes(t)) return false;
    }
    return null;
}

/**
 * Map RiskTapeItem flag fields + optional provider data onto
 * CanonicalRiskFlags. Returns null only when no flag-relevant input is
 * present; otherwise emits a populated record with nulls for absent flags.
 */
export function mapRiskFlagsFromTape(args: {
    tape: Partial<RiskTapeItem> | null | undefined;
    providerData?: {
        chainOfTitleRedFlags?: boolean | null;
        highRiskGeography?: boolean | null;
        ucdpSsrScore?: string | null;
        collateralRiskRating?: string | null;
    } | null;
    notes?: string | null;
}): CanonicalRiskFlags | null {
    const { tape, providerData, notes } = args;

    if (!tape && !providerData && !notes) return null;

    const chainOfTitle =
        providerData?.chainOfTitleRedFlags != null
            ? providerData.chainOfTitleRedFlags
            : b(tape?.chainOfTitleRedFlags);

    const highRiskGeo =
        providerData?.highRiskGeography != null
            ? providerData.highRiskGeography
            : b(tape?.highRiskGeographyFlag);

    return {
        chainOfTitleRedFlags: chainOfTitle,
        ucdpSsrScore: s(providerData?.ucdpSsrScore) ?? s(tape?.ucdpSsrScore),
        collateralRiskRating: s(providerData?.collateralRiskRating) ?? s(tape?.collateralRiskRating),
        appraiserGeoCompetency: b(tape?.appraiserGeoCompetency),
        highRiskGeography: highRiskGeo,
        unusualAppreciation: b(tape?.unusualAppreciationFlag),
        dscrBelowMinimum: b(tape?.dscrFlag),
        nonPublicCompsFlag: b(tape?.nonPublicCompsFlag),
        notes: s(notes),
    };
}
