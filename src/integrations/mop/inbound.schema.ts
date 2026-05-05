/**
 * MOP / Prio inbound responses — wire schema (Zod)
 *
 * Validates the response bodies AMP receives from the MOP / Prio engine:
 *   1. Dispatch     — POST /api/runs/{extraction|criteria|criteria-step}
 *   2. Status       — GET  /api/runs/{runId}
 *   3. Prio eval    — POST {PRIO_ENGINE_URL}  (rules-evaluation endpoint)
 *
 * Replaces the engine-dispatch service's hand-rolled
 * `readObjectResponse / readRequiredString / readOptionalString` helpers and
 * the inline `actions_fired?.filter(...).map(...)` parsing in
 * PrioEvaluationClient with strict typed schemas.
 *
 * Posture: STRICT on required fields, PERMISSIVE on additional fields
 * (passthrough) — MOP is internal infra we control, so we want hard rejection
 * on missing-runId / missing-status, but adding a new response field
 * shouldn't break ingestion.
 */

import { z } from 'zod';

// ─── Status normalisation ─────────────────────────────────────────────────────

/** Provider-side status values MOP/Prio sends. Mapped downstream to AMP's run-status enum. */
const ProviderStatusSchema = z.union([
    z.literal('completed'),
    z.literal('success'),
    z.literal('failed'),
    z.literal('error'),
    z.literal('queued'),
    z.literal('pending'),
    z.literal('running'),
    z.literal('processing'),
    // Permit unknown statuses too — we map to 'running' by default. Loud
    // logging happens in the adapter when this happens.
    z.string().min(1),
]);

// ─── Dispatch response ────────────────────────────────────────────────────────
//
// Returned by POST /api/runs/extraction, /criteria, /criteria-steps.
// Required: runId or jobId, status. Optional: engineVersion + arbitrary extras.

export const MopDispatchResponseSchema = z
    .object({
        runId: z.string().optional(),
        jobId: z.string().optional(),
        status: ProviderStatusSchema,
        engineVersion: z.string().optional(),
    })
    .passthrough()
    .refine(
        (v) => (typeof v.runId === 'string' && v.runId.trim().length > 0)
            || (typeof v.jobId === 'string' && v.jobId.trim().length > 0),
        {
            message: 'Dispatch response must include runId or jobId',
            path: ['runId'],
        },
    );

// ─── Refresh response ─────────────────────────────────────────────────────────
//
// Returned by GET /api/runs/{runId}. Required: status. Optional: engineVersion.

export const MopRefreshResponseSchema = z
    .object({
        status: ProviderStatusSchema,
        engineVersion: z.string().optional(),
    })
    .passthrough();

// ─── Prio evaluation response ─────────────────────────────────────────────────
//
// Returned by POST {PRIO_ENGINE_URL}. The Prio engine emits a generic
// "actions_fired" stream; AMP filters for `fact_id === 'compliance_violation'`
// and maps the inner `data` payload to RuleViolation.

const PrioActionDataSchema = z
    .object({
        severity: z.string().optional(),
        reason: z.string().optional(),
        violation_code: z.string().optional(),
    })
    .passthrough();

const PrioActionFiredSchema = z
    .object({
        fact_id: z.string(),
        source: z.string().optional(),
        data: PrioActionDataSchema.optional(),
    })
    .passthrough();

export const PrioEvaluationResponseSchema = z
    .object({
        actions_fired: z.array(PrioActionFiredSchema).optional(),
        processing_time_ms: z.number().optional(),
    })
    .passthrough();

// ─── Inferred TS types ────────────────────────────────────────────────────────

export type MopDispatchResponse = z.infer<typeof MopDispatchResponseSchema>;
export type MopRefreshResponse = z.infer<typeof MopRefreshResponseSchema>;
export type PrioEvaluationResponseRaw = z.infer<typeof PrioEvaluationResponseSchema>;
export type PrioActionFired = z.infer<typeof PrioActionFiredSchema>;
