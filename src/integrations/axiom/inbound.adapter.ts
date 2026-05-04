/**
 * Axiom inbound webhook — adapter
 *
 * Single entry point for parsing webhook bodies into a typed event.
 * Replaces the controller's hand-rolled `body['x'] as string | undefined`
 * casting at the top of `handleWebhook` with strict Zod validation.
 *
 * Returned event is one of:
 *   - { kind: 'execution',  ... }
 *   - { kind: 'tape-loan',  ... }
 *   - { kind: 'document',   ... }
 *   - { kind: 'legacy',     ... }   (mock/dev shape: { evaluationId, ... })
 *
 * On invalid input the adapter throws `AxiomWebhookValidationError` carrying
 * the Zod issue list; the controller maps that to HTTP 400. We do NOT silently
 * coerce or default — bad webhooks must fail loudly so the partner (or
 * misconfigured caller) sees the rejection and stops retrying.
 *
 * Status normalisation: Axiom may send either the canonical literals
 * ('completed' | 'failed' | 'cancelled' | 'running') OR a free-form string in
 * legacy paths. The adapter normalises to a strict union, mapping anything
 * unrecognised to 'failed' so downstream code doesn't silently treat a
 * mystery status as success.
 */

import { ZodError } from 'zod';
import {
    AxiomInboundWebhookSchema,
    AxiomLegacyWebhookSchema,
    type AxiomDocumentWebhook,
    type AxiomExecutionWebhook,
    type AxiomLegacyWebhook,
    type AxiomOrderWebhook,
    type AxiomTapeLoanWebhook,
} from './inbound.schema.js';

export type AxiomNormalisedStatus = 'completed' | 'failed' | 'cancelled' | 'running';

interface PayloadEnvelope {
    status?: unknown;
    result?: unknown;
    error?: unknown;
}

interface ExecutionEvent {
    kind: 'execution';
    correlationId: string;
    pipelineJobId: string | null;
    executionId: string | null;
    status: AxiomNormalisedStatus;
    result: Record<string, unknown> | null;
    error: string | null;
    raw: AxiomExecutionWebhook;
}

interface TapeLoanEvent {
    kind: 'tape-loan';
    correlationId: string;
    jobId: string;
    loanNumber: string;
    pipelineJobId: string | null;
    executionId: string | null;
    status: AxiomNormalisedStatus;
    raw: AxiomTapeLoanWebhook;
}

interface DocumentEvent {
    kind: 'document';
    correlationId: string;
    documentId: string;
    pipelineJobId: string | null;
    executionId: string | null;
    status: AxiomNormalisedStatus;
    /** Inline result body Axiom may send under `payload.result | result | output | data`. */
    inlineResult: Record<string, unknown> | null;
    raw: AxiomDocumentWebhook;
}

interface OrderEvent {
    kind: 'order';
    /** Original correlationId as Axiom sent it (may include `~r<timestamp>` resubmit suffix). */
    correlationId: string;
    /** Resubmit suffix stripped — this is the real orderId for DB lookups. */
    orderId: string;
    pipelineJobId: string | null;
    executionId: string | null;
    status: AxiomNormalisedStatus;
    result: Record<string, unknown> | null;
    error: string | null;
    raw: AxiomOrderWebhook;
}

interface LegacyEvent {
    kind: 'legacy';
    evaluationId: string | null;
    orderId: string | null;
    status: AxiomNormalisedStatus;
    raw: AxiomLegacyWebhook;
}

export type AxiomWebhookEvent =
    | ExecutionEvent
    | TapeLoanEvent
    | DocumentEvent
    | OrderEvent
    | LegacyEvent;

export class AxiomWebhookValidationError extends Error {
    constructor(public readonly issues: ZodError) {
        super(`Axiom webhook payload failed validation: ${issues.message}`);
        this.name = 'AxiomWebhookValidationError';
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseStatus(raw: unknown): AxiomNormalisedStatus {
    if (raw === 'completed' || raw === 'failed' || raw === 'cancelled' || raw === 'running') {
        return raw;
    }
    // Legacy / unknown values default to 'failed' rather than 'completed' so
    // downstream code doesn't act on a successful-completion path with
    // garbage status. The controller logs the original value for diagnostics.
    return 'failed';
}

function asRecordOrNull(v: unknown): Record<string, unknown> | null {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

function asStringOrNull(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
}

/** Resolve the status from `payload.status` (preferred) → `body.status` → undefined. */
function resolveStatus(payload: PayloadEnvelope | undefined, root: { status?: unknown }): AxiomNormalisedStatus {
    return normaliseStatus(payload?.status ?? root.status ?? 'completed');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a raw webhook body into a typed AxiomWebhookEvent.
 *
 * Dispatch order:
 *   1. If `correlationType` is one of the four KNOWN values
 *      (EXECUTION/TAPE_LOAN/DOCUMENT/ORDER), strict-parse via the discriminated
 *      union — throws AxiomWebhookValidationError on shape mismatch.
 *   2. Otherwise (no correlationType, or an unknown future value) treat as
 *      legacy mock shape ({ evaluationId, orderId, status }) — permissive
 *      parse. This preserves forward-compat: if Axiom adds a new correlation
 *      type, we log and pass it through rather than hard-rejecting traffic.
 *
 * @throws AxiomWebhookValidationError when the body matches neither shape.
 */
const KNOWN_CORRELATION_TYPES = new Set(['EXECUTION', 'TAPE_LOAN', 'DOCUMENT', 'ORDER']);

export function parseAxiomWebhook(body: unknown): AxiomWebhookEvent {
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
        const fakeIssue = new ZodError([
            {
                code: 'invalid_type',
                expected: 'object',
                received: body === null ? 'null' : Array.isArray(body) ? 'array' : typeof body,
                path: [],
                message: 'Webhook body must be a JSON object',
            },
        ]);
        throw new AxiomWebhookValidationError(fakeIssue);
    }

    const root = body as Record<string, unknown>;

    // Branch 1 — modern pipeline webhook (correlationType is a known value).
    const ct = root['correlationType'];
    if (typeof ct === 'string' && KNOWN_CORRELATION_TYPES.has(ct)) {
        const parsed = AxiomInboundWebhookSchema.safeParse(root);
        if (!parsed.success) {
            throw new AxiomWebhookValidationError(parsed.error);
        }

        const event = parsed.data;
        switch (event.correlationType) {
            case 'EXECUTION': {
                const status = resolveStatus(event.payload, event);
                const result = asRecordOrNull(event.payload?.result ?? event.result);
                const error = asStringOrNull(event.payload?.error ?? event.error);
                return {
                    kind: 'execution',
                    correlationId: event.correlationId,
                    pipelineJobId: asStringOrNull(event.pipelineJobId),
                    executionId: asStringOrNull(event.executionId),
                    status,
                    result,
                    error,
                    raw: event,
                };
            }
            case 'TAPE_LOAN': {
                const sep = event.correlationId.indexOf('::');
                // Schema's refine() guarantees '::' is present; assertion guards regression.
                if (sep === -1) {
                    throw new AxiomWebhookValidationError(
                        new ZodError([
                            {
                                code: 'custom',
                                path: ['correlationId'],
                                message: 'TAPE_LOAN correlationId must contain "::"',
                            },
                        ]),
                    );
                }
                const status = resolveStatus(event.payload, event);
                return {
                    kind: 'tape-loan',
                    correlationId: event.correlationId,
                    jobId: event.correlationId.slice(0, sep),
                    loanNumber: event.correlationId.slice(sep + 2),
                    pipelineJobId: asStringOrNull(event.pipelineJobId),
                    executionId: asStringOrNull(event.executionId),
                    status,
                    raw: event,
                };
            }
            case 'DOCUMENT': {
                const status = resolveStatus(event.payload, event);
                // Axiom may put the result body under `payload.result`, `result`,
                // `output`, or `data` — try each in order, prefer the first
                // non-empty one.
                const candidates: Array<unknown> = [
                    event.payload?.result,
                    event.result,
                    event.output,
                    event.data,
                ];
                let inlineResult: Record<string, unknown> | null = null;
                for (const c of candidates) {
                    const rec = asRecordOrNull(c);
                    if (rec && Object.keys(rec).length > 0) {
                        inlineResult = rec;
                        break;
                    }
                }
                return {
                    kind: 'document',
                    correlationId: event.correlationId,
                    documentId: event.correlationId,
                    pipelineJobId: asStringOrNull(event.pipelineJobId),
                    executionId: asStringOrNull(event.executionId),
                    status,
                    inlineResult,
                    raw: event,
                };
            }
            case 'ORDER': {
                const status = resolveStatus(event.payload, event);
                const result = asRecordOrNull(event.payload?.result ?? event.result);
                const error = asStringOrNull(event.payload?.error ?? event.error);
                // Resubmit suffix `~r<timestamp>` is appended on forced resubmits to
                // bypass Axiom's idempotency guard. Strip it to recover the real orderId.
                const resubmitIdx = event.correlationId.indexOf('~r');
                const orderId = resubmitIdx >= 0
                    ? event.correlationId.slice(0, resubmitIdx)
                    : event.correlationId;
                return {
                    kind: 'order',
                    correlationId: event.correlationId,
                    orderId,
                    pipelineJobId: asStringOrNull(event.pipelineJobId),
                    executionId: asStringOrNull(event.executionId),
                    status,
                    result,
                    error,
                    raw: event,
                };
            }
        }
    }

    // Branch 2 — legacy mock shape (no correlationType).
    const legacy = AxiomLegacyWebhookSchema.safeParse(root);
    if (!legacy.success) {
        throw new AxiomWebhookValidationError(legacy.error);
    }
    return {
        kind: 'legacy',
        evaluationId: asStringOrNull(legacy.data.evaluationId),
        orderId: asStringOrNull(legacy.data.orderId),
        status: normaliseStatus(legacy.data.status ?? 'completed'),
        raw: legacy.data,
    };
}
