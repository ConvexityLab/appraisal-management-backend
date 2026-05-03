/**
 * AVM → Canonical mapper
 *
 * Builds CanonicalAvmCrossCheck from a tape row + the current appraised
 * value. AVM data lives on RiskTapeItem.avmValue today; richer AVM provider
 * outputs (confidence range, model version, as-of date) come in via property
 * enrichment when those sources are plumbed.
 *
 * The avmGapPercent is computed deterministically from the appraised value
 * and avm value; everything else is passed through (or left null when the
 * source doesn't carry it).
 */

import type { RiskTapeItem } from '../types/review-tape.types.js';
import type { CanonicalAvmCrossCheck } from '../types/canonical-schema.js';

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

/**
 * Project AVM-related tape fields + an appraised value onto
 * CanonicalAvmCrossCheck. Returns null if no AVM data is present.
 *
 * Source coverage today: RiskTapeItem.avmValue and RiskTapeItem.avmGapPct
 * (precomputed by upstream tape pipelines). Confidence range, provider, and
 * model version need a richer AVM source (enrichment service) — left null
 * until plumbed.
 */
export function mapAvmCrossCheckFromTape(args: {
    tape: Partial<RiskTapeItem> | null | undefined;
    /** The current appraised value, used to compute the gap when not precomputed. */
    appraisedValue: number | null;
    /** Optional: AVM provider data block from property enrichment (preferred when present). */
    avmProviderData?: {
        avmValue?: number | null;
        avmLowerBound?: number | null;
        avmUpperBound?: number | null;
        avmConfidenceScore?: number | null;
        avmProvider?: string | null;
        avmModelVersion?: string | null;
        avmAsOfDate?: string | null;
    } | null;
}): CanonicalAvmCrossCheck | null {
    const { tape, appraisedValue, avmProviderData } = args;

    // Prefer richer provider data when present; fall back to tape value.
    const avmValue = n(avmProviderData?.avmValue) ?? n(tape?.avmValue);
    if (avmValue == null) {
        return null;
    }

    // Gap %: use precomputed tape value when present, else derive. RiskTapeItem
    // stores avmGapPct as a FRACTION (0.10 for 10%); canonical uses PERCENTAGE
    // form (10). Multiply tape value by 100; the computed path is already in
    // percentage form.
    const tapeGap = n(tape?.avmGapPct);
    const computedGap =
        appraisedValue != null && avmValue > 0
            ? ((appraisedValue - avmValue) / avmValue) * 100
            : null;
    const avmGapPercent = tapeGap != null ? tapeGap * 100 : computedGap;

    return {
        avmValue,
        avmLowerBound: n(avmProviderData?.avmLowerBound),
        avmUpperBound: n(avmProviderData?.avmUpperBound),
        avmConfidenceScore: n(avmProviderData?.avmConfidenceScore),
        avmProvider: s(avmProviderData?.avmProvider),
        avmModelVersion: s(avmProviderData?.avmModelVersion),
        avmGapPercent,
        avmAsOfDate: s(avmProviderData?.avmAsOfDate),
    };
}
