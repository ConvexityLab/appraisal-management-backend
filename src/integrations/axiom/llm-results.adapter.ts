/**
 * Axiom pipeline LLM response — adapter
 *
 * Validates and normalises the raw result body Axiom returns. Replaces the
 * hand-rolled `inner = rawResults['results'] ?? rawResults;` + chained
 * `Array.isArray(...) ? ... : undefined` casting in axiom.service so callers
 * receive a typed `ParsedAxiomPipelineResults` with strict access to the
 * stages they care about.
 *
 * Posture (different from inbound webhook adapter): PERMISSIVE on shape.
 * - safeParse, never throws.
 * - On schema mismatch we still emit a partial result (whatever could be
 *   extracted) so the receiver can still write the consolidated extracted
 *   data even if some stage shape drifted.
 * - Issues are returned alongside the parsed result so the caller can log
 *   structured warnings without losing the data.
 *
 * Why permissive: the LLM response is pipeline output we don't author.
 * Axiom regularly extends the response with new stages/fields. Hard-rejecting
 * a body because of a single unexpected field would silently break ingestion
 * for every order. The webhook envelope (slice 2) is strict because that's
 * a small handshake we control with Axiom; the pipeline result is a large
 * grab-bag we adapt to.
 *
 * Normalisation:
 * - Hoists `results.{extractStructuredData|consolidate|aggregateResults}` to
 *   the top level so callers don't have to remember which variant Axiom sent.
 * - Merges `extractStructuredData` per-page extractedData blocks into a
 *   single consolidated object (first-non-null wins, deep-merges nested
 *   objects like propertyAddress) — the same logic axiom.service does
 *   inline today, lifted into the adapter.
 */

import type { ZodIssue } from 'zod';
import {
    AxiomPipelineResultsSchema,
    type AggregateCriterion,
    type AggregateResultsEntry,
} from './llm-results.schema.js';

export interface ParsedAxiomPipelineResults {
    /**
     * Per-page extractedData blocks from the extractStructuredData stage,
     * in original order. Each entry is the raw `extractedData` payload (the
     * envelope wrapping `{value, confidence, sourceBatch, sourcePages}` for
     * each scalar) that axiom-extraction.mapper consumes.
     */
    extractStructuredData: Array<Record<string, unknown>>;

    /**
     * The single consolidatedData block from the consolidate stage when
     * present; null otherwise. Caller prefers this when populated since
     * Axiom has already merged across pages.
     */
    consolidatedData: Record<string, unknown> | null;

    /**
     * Best-effort merged extractedData. Prefers `consolidatedData` when
     * available, else first-non-null merge of `extractStructuredData[*].extractedData`,
     * else the top-level `extractedData` field.
     * Returns null when no extraction content was found.
     */
    mergedExtractedData: Record<string, unknown> | null;

    /**
     * The aggregateResults[0] entry — criteria evaluation summary.
     * Null when the stage didn't run or returned an empty array.
     */
    aggregate: AggregateResultsEntry | null;

    /** The criteria array within aggregate, or empty when unavailable. */
    criteria: AggregateCriterion[];

    /** Top-level decision ('ACCEPT' | 'CONDITIONAL' | 'REJECT' | other). */
    overallDecision: string | null;

    overallRiskScore: number | null;
}

export interface AxiomPipelineResultsParseOutcome {
    /** True iff the body parsed cleanly. False emits issues but result still populated. */
    ok: boolean;
    /** Always populated, even on partial-failure. */
    result: ParsedAxiomPipelineResults;
    /** Empty when ok=true. */
    issues: ZodIssue[];
}

const EMPTY_RESULT: ParsedAxiomPipelineResults = {
    extractStructuredData: [],
    consolidatedData: null,
    mergedExtractedData: null,
    aggregate: null,
    criteria: [],
    overallDecision: null,
    overallRiskScore: null,
};

function asStringOrNull(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
}

function asNumberOrNull(v: unknown): number | null {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return v;
}

function asRecordOrNull(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

/**
 * Merge per-page extractedData blocks. First-non-null wins for scalars; for
 * nested objects we deep-merge (e.g. propertyAddress: {street, city, ...}).
 * Returns null when no merge target was found.
 */
function mergeExtractedDataPages(pages: Array<Record<string, unknown>>): Record<string, unknown> | null {
    if (pages.length === 0) return null;
    const merged: Record<string, unknown> = {};
    for (const page of pages) {
        const data = asRecordOrNull(page['extractedData']);
        if (!data) continue;
        for (const [key, val] of Object.entries(data)) {
            if (val == null) continue;
            const existing = merged[key];
            if (
                existing != null
                && typeof existing === 'object' && !Array.isArray(existing)
                && typeof val === 'object' && !Array.isArray(val)
            ) {
                merged[key] = { ...(existing as Record<string, unknown>), ...(val as Record<string, unknown>) };
            } else if (existing == null) {
                merged[key] = val;
            }
        }
    }
    return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Parse and normalise an Axiom pipeline result body.
 *
 * On success returns `{ ok: true, result, issues: [] }`.
 * On schema mismatch returns `{ ok: false, result: best-effort, issues: [...] }` —
 * caller should log issues but can still consume `result`.
 */
export function parseAxiomPipelineResults(rawResults: unknown): AxiomPipelineResultsParseOutcome {
    if (!rawResults || typeof rawResults !== 'object' || Array.isArray(rawResults)) {
        return {
            ok: false,
            result: EMPTY_RESULT,
            issues: [
                {
                    code: 'invalid_type',
                    expected: 'object',
                    received: rawResults === null ? 'null' : Array.isArray(rawResults) ? 'array' : typeof rawResults,
                    path: [],
                    message: 'Axiom pipeline results must be a JSON object',
                } as ZodIssue,
            ],
        };
    }

    const parsed = AxiomPipelineResultsSchema.safeParse(rawResults);

    // Build the typed view from either the parsed data (preferred) or the raw
    // body (fallback path so a single bad field doesn't lose all the data).
    const root = parsed.success ? parsed.data : (rawResults as Record<string, unknown>);
    const inner = (asRecordOrNull(root['results']) ?? root) as Record<string, unknown>;

    const extractArr = Array.isArray(inner['extractStructuredData'])
        ? (inner['extractStructuredData'] as Array<Record<string, unknown>>)
        : [];

    const consolidateArr = Array.isArray(inner['consolidate'])
        ? (inner['consolidate'] as Array<Record<string, unknown>>)
        : [];
    const consolidatedData =
        consolidateArr.length > 0
            ? asRecordOrNull(consolidateArr[0]?.['consolidatedData'])
            : null;

    const mergedExtractedData = consolidatedData
        ?? mergeExtractedDataPages(extractArr)
        ?? asRecordOrNull(inner['extractedData']);

    const aggregateArr = Array.isArray(inner['aggregateResults'])
        ? (inner['aggregateResults'] as AggregateResultsEntry[])
        : [];
    const aggregate = aggregateArr[0] ?? null;
    const criteria = Array.isArray(aggregate?.criteria) ? aggregate.criteria : [];

    const overallDecision = asStringOrNull(inner['overallDecision']);
    const overallRiskScore = asNumberOrNull(inner['overallRiskScore']);

    return {
        ok: parsed.success,
        result: {
            extractStructuredData: extractArr,
            consolidatedData,
            mergedExtractedData,
            aggregate,
            criteria,
            overallDecision,
            overallRiskScore,
        },
        issues: parsed.success ? [] : parsed.error.issues,
    };
}
