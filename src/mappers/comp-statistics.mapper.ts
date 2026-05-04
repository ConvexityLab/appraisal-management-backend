/**
 * Comp-statistics → Canonical mapper
 *
 * Pure derivation: takes the canonical.comps array (already projected onto
 * UAD-aligned shape by upstream mappers) and computes the aggregate
 * statistics review-program rules need.
 *
 * No external data source — purely mechanical aggregation.
 */

import type { CanonicalComp, CanonicalCompStatistics } from '../types/canonical-schema.js';

function isFinite(n: number | null | undefined): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

function avg(values: number[]): number | null {
    if (values.length === 0) return null;
    const total = values.reduce((sum, v) => sum + v, 0);
    return total / values.length;
}

function max(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.max(...values);
}

function min(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.min(...values);
}

/** Months between two ISO dates, rounded to nearest integer. */
function monthsBetween(earlier: string, later: string): number | null {
    const a = Date.parse(earlier);
    const b = Date.parse(later);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const days = Math.abs(b - a) / (1000 * 60 * 60 * 24);
    return Math.round(days / 30.4375);
}

/**
 * Compute aggregate statistics across the SELECTED comps. Returns null when
 * there are no selected comps (or no comps array). When called with the
 * full comp list (selected + candidates), the SELECTED filter still applies
 * — selectedCompCount reflects only those in the actual sales-comparison
 * grid.
 */
export function computeCompStatistics(comps: Partial<CanonicalComp>[] | null | undefined): CanonicalCompStatistics | null {
    if (!Array.isArray(comps) || comps.length === 0) {
        return null;
    }

    // Some upstream sources don't set `selected` reliably. Treat all comps
    // present as in-scope when no comp is explicitly marked selected — the
    // canonical has a `selected: boolean` on CanonicalComp but partial
    // mappers may leave it undefined.
    const explicitlySelected = comps.filter((c) => c?.selected === true);
    const inScope = explicitlySelected.length > 0 ? explicitlySelected : comps;
    if (inScope.length === 0) return null;

    const netPcts: number[] = [];
    const grossPcts: number[] = [];
    const distances: number[] = [];
    const saleDates: string[] = [];
    const pricesPerSqFt: number[] = [];
    const salePrices: number[] = [];
    let nonMlsCount = 0;

    for (const comp of inScope) {
        const adj = comp.adjustments ?? null;
        if (adj && isFinite(adj.netAdjustmentPct)) netPcts.push(adj.netAdjustmentPct);
        if (adj && isFinite(adj.grossAdjustmentPct)) grossPcts.push(adj.grossAdjustmentPct);

        const distance = (comp as { distanceFromSubjectMiles?: number | null }).distanceFromSubjectMiles;
        if (isFinite(distance)) distances.push(distance);

        if (typeof comp.saleDate === 'string' && comp.saleDate.length > 0) {
            saleDates.push(comp.saleDate);
        }

        if (isFinite(comp.salePrice)) {
            salePrices.push(comp.salePrice);
            const gla = comp.grossLivingArea;
            if (isFinite(gla) && gla > 0) {
                pricesPerSqFt.push(comp.salePrice / gla);
            }
        }

        if (comp.dataSource && comp.dataSource !== 'mls') {
            nonMlsCount++;
        }
    }

    let saleDateRangeMonths: number | null = null;
    if (saleDates.length >= 2) {
        const sorted = [...saleDates].sort();
        saleDateRangeMonths = monthsBetween(sorted[0]!, sorted[sorted.length - 1]!);
    }

    const selectedCompCount = inScope.length;
    const nonMlsPercent = selectedCompCount > 0 ? (nonMlsCount / selectedCompCount) * 100 : null;

    return {
        selectedCompCount,
        averageNetAdjustmentPercent: avg(netPcts),
        averageGrossAdjustmentPercent: avg(grossPcts),
        maxNetAdjustmentPercent: max(netPcts.map(Math.abs)),
        maxGrossAdjustmentPercent: max(grossPcts),
        averageDistanceMiles: avg(distances),
        maxDistanceMiles: max(distances),
        saleDateRangeMonths,
        nonMlsCompCount: nonMlsCount,
        nonMlsCompPercent: nonMlsPercent,
        averagePricePerSqFt: avg(pricesPerSqFt),
        comparablePriceRangeLow: min(salePrices),
        comparablePriceRangeHigh: max(salePrices),
    };
}
