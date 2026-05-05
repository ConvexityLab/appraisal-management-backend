/**
 * Axiom inbound webhook — wire schema (Zod)
 *
 * Anti-corruption layer for the Axiom → AMP webhook. Validates the
 * envelope shape that arrives on POST /api/axiom/webhook before the
 * controller acts on it. Without this, the handler reads ~600 lines of
 * `body['x'] as string | undefined` and trusts whatever shape Axiom
 * (or a misbehaving partner) sends.
 *
 * Four correlationType branches Axiom may send:
 *   EXECUTION  — single pipeline-execution status update
 *   TAPE_LOAN  — per-loan completion inside a bulk tape job
 *   DOCUMENT   — single-document extraction completion
 *   ORDER      — per-order pipeline completion (correlationId is the orderId,
 *                with optional `~r<timestamp>` resubmit suffix)
 *
 * Common fields:
 *   correlationId    — opaque id we sent on submit; format depends on type
 *   correlationType  — one of EXECUTION | TAPE_LOAN | DOCUMENT
 *   pipelineJobId    — Axiom's internal pipeline run id (sometimes called executionId)
 *   timestamp        — ISO datetime, optional
 *   payload          — Axiom nests status/result/error here in current API; older
 *                      mock/dev shapes carry status/result/error at the root.
 *                      This schema accepts BOTH and we let the adapter normalise.
 *
 * Result/error payloads are intentionally schema-loose (`unknown`):
 *   - The Axiom result envelope's deep shape (`stages.extractStructuredData[]`,
 *     `aggregateResults[0]`, etc.) is parsed downstream by the
 *     axiom-extraction.mapper / criteria projection — not at the webhook door.
 *     Validating those shapes here would couple the receiver to extraction
 *     internals; we instead validate "is this a well-formed webhook envelope"
 *     and leave the result body to its dedicated mappers.
 */

import { z } from 'zod';

// ─── Common primitives ────────────────────────────────────────────────────────

/** Axiom's status field — accepts the canonical values plus a bare-string escape hatch
 *  for legacy/mock webhooks. The adapter normalises to a strict enum. */
const StatusFieldSchema = z.union([
    z.literal('completed'),
    z.literal('failed'),
    z.literal('cancelled'),
    z.literal('running'),
    z.string().min(1),
]);

/**
 * Inner payload Axiom nests under `body.payload`. Newer API versions wrap
 * status/result/error here; legacy/mock shapes put them at the root.
 * All fields are optional — controller falls back to root-level when absent.
 */
const PayloadEnvelopeSchema = z
    .object({
        status: StatusFieldSchema.optional(),
        result: z.unknown().optional(),
        error: z.string().optional(),
    })
    .passthrough();

// ─── Variant schemas ──────────────────────────────────────────────────────────

const ExecutionWebhookSchema = z.object({
    correlationType: z.literal('EXECUTION'),
    correlationId: z.string().min(1, 'correlationId is required for EXECUTION webhooks'),
    pipelineJobId: z.string().optional(),
    executionId: z.string().optional(),
    timestamp: z.string().optional(),
    payload: PayloadEnvelopeSchema.optional(),
    status: StatusFieldSchema.optional(),
    result: z.unknown().optional(),
    error: z.string().optional(),
});

const TapeLoanWebhookSchema = z.object({
    correlationType: z.literal('TAPE_LOAN'),
    correlationId: z
        .string()
        .min(1, 'correlationId is required for TAPE_LOAN webhooks')
        .refine(
            (v) => v.includes('::'),
            'TAPE_LOAN correlationId must be "<jobId>::<loanNumber>"',
        ),
    pipelineJobId: z.string().optional(),
    executionId: z.string().optional(),
    timestamp: z.string().optional(),
    payload: PayloadEnvelopeSchema.optional(),
    status: StatusFieldSchema.optional(),
});

const DocumentWebhookSchema = z.object({
    correlationType: z.literal('DOCUMENT'),
    correlationId: z.string().min(1, 'correlationId is required for DOCUMENT webhooks'),
    pipelineJobId: z.string().optional(),
    executionId: z.string().optional(),
    timestamp: z.string().optional(),
    payload: PayloadEnvelopeSchema.optional(),
    status: StatusFieldSchema.optional(),
    result: z.unknown().optional(),
    output: z.unknown().optional(),
    data: z.unknown().optional(),
    error: z.string().optional(),
});

const OrderWebhookSchema = z.object({
    correlationType: z.literal('ORDER'),
    correlationId: z.string().min(1, 'correlationId is required for ORDER webhooks'),
    pipelineJobId: z.string().optional(),
    executionId: z.string().optional(),
    timestamp: z.string().optional(),
    payload: PayloadEnvelopeSchema.optional(),
    status: StatusFieldSchema.optional(),
    result: z.unknown().optional(),
    error: z.string().optional(),
});

/**
 * Discriminated union over the four correlation types. Anything else is
 * either the legacy { evaluationId, orderId, status } shape (handled
 * separately by the controller) or invalid.
 */
export const AxiomInboundWebhookSchema = z.discriminatedUnion('correlationType', [
    ExecutionWebhookSchema,
    TapeLoanWebhookSchema,
    DocumentWebhookSchema,
    OrderWebhookSchema,
]);

/**
 * Legacy / mock-harness shape — no correlationType, just the original
 * { evaluationId, orderId, status, timestamp } envelope. Kept around because
 * dev tools and some test fixtures still send it. The adapter dispatches to
 * the legacy branch when no correlationType is present.
 */
export const AxiomLegacyWebhookSchema = z.object({
    evaluationId: z.string().min(1).optional(),
    orderId: z.string().optional(),
    status: StatusFieldSchema.optional(),
    timestamp: z.string().optional(),
});

// ─── Inferred TS types ────────────────────────────────────────────────────────

export type AxiomExecutionWebhook = z.infer<typeof ExecutionWebhookSchema>;
export type AxiomTapeLoanWebhook = z.infer<typeof TapeLoanWebhookSchema>;
export type AxiomDocumentWebhook = z.infer<typeof DocumentWebhookSchema>;
export type AxiomOrderWebhook = z.infer<typeof OrderWebhookSchema>;
export type AxiomInboundWebhook = z.infer<typeof AxiomInboundWebhookSchema>;
export type AxiomLegacyWebhook = z.infer<typeof AxiomLegacyWebhookSchema>;
