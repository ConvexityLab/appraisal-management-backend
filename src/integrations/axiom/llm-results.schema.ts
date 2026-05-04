/**
 * Axiom pipeline LLM response — wire schema (Zod)
 *
 * Validates the result body Axiom returns from
 *   GET /api/pipelines/{id}/results
 * AND emits inline in DOCUMENT-correlation webhooks. This is the LLM-generated
 * structured JSON we project onto canonical via axiom-extraction.mapper.
 *
 * Top-level shape (observed in production):
 *   {
 *     results: {
 *       extractStructuredData: Array<{ extractedData: Record<string, unknown>, ... }>,
 *       consolidate: Array<{ consolidatedData: Record<string, unknown>, ... }>,
 *       aggregateResults: Array<AggregateResult>,
 *       overallDecision?: 'ACCEPT' | 'CONDITIONAL' | 'REJECT',
 *       overallRiskScore?: number,
 *     },
 *     ...
 *   }
 *   — or — the same fields hoisted to the root (legacy Axiom variants).
 *
 * Validation posture: PERMISSIVE. The receiver wants to extract whatever
 * structured data is present even when shape drifts. We use `passthrough()`
 * everywhere so unknown fields survive (Axiom adds new pipeline outputs
 * without changing existing ones), and per-stage schemas are loose at the
 * deep extracted-fields level — that deep shape is the appraisal-fields
 * grab bag (UAD-aligned but evolving), and constraining it here would
 * fight the canonical mapper.
 *
 * The schema's job: confirm the *containers* are arrays-of-objects with the
 * expected stage names. The mapper's job: project the contents.
 */

import { z } from 'zod';

// ─── Inner-stage shapes (containers, not deep field constraints) ──────────────

/** Per-page extraction stage entry. `extractedData` is the LLM's grab-bag. */
const ExtractStructuredDataEntrySchema = z
    .object({
        extractedData: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough();

/** Consolidate stage entry — Axiom's pipeline merges per-page extractedData. */
const ConsolidateEntrySchema = z
    .object({
        consolidatedData: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough();

/** Single criterion result inside aggregateResults[0].criteria. */
export const AggregateCriterionSchema = z
    .object({
        criterionId: z.string().optional(),
        criterion: z.string().optional(),
        category: z.string().optional(),
        severity: z.string().optional(),
        decision: z.string().optional(),
        score: z.number().optional(),
        riskScore: z.number().optional(),
        explanation: z.string().optional(),
        evidence: z.array(z.unknown()).optional(),
    })
    .passthrough();

/** aggregateResults[0] entry — the criteria evaluation summary. */
const AggregateResultsEntrySchema = z
    .object({
        criteria: z.array(AggregateCriterionSchema).optional(),
        overallRiskScore: z.number().optional(),
        overallDecision: z.union([
            z.literal('ACCEPT'),
            z.literal('CONDITIONAL'),
            z.literal('REJECT'),
            z.string(),
        ]).optional(),
    })
    .passthrough();

// ─── Inner block (the contents of `results`) ──────────────────────────────────

const PipelineResultsInnerSchema = z
    .object({
        extractStructuredData: z.array(ExtractStructuredDataEntrySchema).optional(),
        consolidate: z.array(ConsolidateEntrySchema).optional(),
        aggregateResults: z.array(AggregateResultsEntrySchema).optional(),
        extractedData: z.record(z.string(), z.unknown()).optional(),
        criteriaResults: z.unknown().optional(),
        overallDecision: z.union([
            z.literal('ACCEPT'),
            z.literal('CONDITIONAL'),
            z.literal('REJECT'),
            z.string(),
        ]).optional(),
        overallRiskScore: z.number().optional(),
    })
    .passthrough();

// ─── Outer envelope (top-level rawResults) ────────────────────────────────────
//
// Axiom may put everything under `results` or hoist to the root. The schema
// accepts either; the adapter normalises to the inner shape.

export const AxiomPipelineResultsSchema = z
    .object({
        results: PipelineResultsInnerSchema.optional(),
        // Hoisted variants — when results.X is absent, the same field MAY appear here.
        extractStructuredData: z.array(ExtractStructuredDataEntrySchema).optional(),
        consolidate: z.array(ConsolidateEntrySchema).optional(),
        aggregateResults: z.array(AggregateResultsEntrySchema).optional(),
        extractedData: z.record(z.string(), z.unknown()).optional(),
        overallDecision: z.union([
            z.literal('ACCEPT'),
            z.literal('CONDITIONAL'),
            z.literal('REJECT'),
            z.string(),
        ]).optional(),
        overallRiskScore: z.number().optional(),
    })
    .passthrough();

// ─── Inferred TS types ────────────────────────────────────────────────────────

export type AxiomPipelineResults = z.infer<typeof AxiomPipelineResultsSchema>;
export type AxiomPipelineResultsInner = z.infer<typeof PipelineResultsInnerSchema>;
export type ExtractStructuredDataEntry = z.infer<typeof ExtractStructuredDataEntrySchema>;
export type ConsolidateEntry = z.infer<typeof ConsolidateEntrySchema>;
export type AggregateResultsEntry = z.infer<typeof AggregateResultsEntrySchema>;
export type AggregateCriterion = z.infer<typeof AggregateCriterionSchema>;
