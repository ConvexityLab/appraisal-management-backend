/**
 * MOP / Prio inbound responses — adapter
 *
 * Single entry point for parsing MOP/Prio response bodies into typed events.
 * Wraps the Zod schemas with status normalisation + violation projection so
 * the consumer code is simple straight-through reads.
 *
 * Throws AdapterValidationError on schema mismatch. MOP/Prio is internal
 * infra we control — bad shape there is a code/contract bug we want loud,
 * not silent.
 */

import { ZodError } from 'zod';
import {
    MopDispatchResponseSchema,
    MopRefreshResponseSchema,
    PrioEvaluationResponseSchema,
    type PrioActionFired,
} from './inbound.schema.js';

export type MopRunStatus = 'completed' | 'failed' | 'queued' | 'running';

export class MopResponseValidationError extends Error {
    constructor(public readonly issues: ZodError, label: string) {
        super(`${label} failed validation: ${issues.message}`);
        this.name = 'MopResponseValidationError';
    }
}

/** Map provider-side status string → AMP's run-status enum. Unknown defaults to 'running'. */
export function normaliseMopStatus(providerStatus: string): MopRunStatus {
    const v = providerStatus.toLowerCase();
    if (v === 'completed' || v === 'success') return 'completed';
    if (v === 'failed' || v === 'error') return 'failed';
    if (v === 'queued' || v === 'pending') return 'queued';
    return 'running';
}

export interface ParsedMopDispatchResponse {
    /** Engine-side run/job id — readRequiredString equivalent over (runId|jobId). */
    engineRunRef: string;
    /** Lowercased provider status (raw). */
    providerStatus: string;
    /** Mapped AMP run status. */
    runStatus: MopRunStatus;
    engineVersion: string;
}

export interface ParsedMopRefreshResponse {
    providerStatus: string;
    runStatus: MopRunStatus;
    engineVersion: string | null;
}

export interface PrioRuleViolation {
    rule_id: string;
    severity: string;
    reason: string;
    violation_code: string;
}

export interface ParsedPrioEvaluationResponse {
    violations: PrioRuleViolation[];
    processingTimeMs: number | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseMopDispatchResponse(
    raw: unknown,
    fallbackEngineVersion: string,
): ParsedMopDispatchResponse {
    const parsed = MopDispatchResponseSchema.safeParse(raw);
    if (!parsed.success) {
        throw new MopResponseValidationError(parsed.error, 'MOP dispatch response');
    }

    const engineRunRef =
        (parsed.data.runId && parsed.data.runId.trim())
        || (parsed.data.jobId && parsed.data.jobId.trim())
        || '';
    if (!engineRunRef) {
        // refine() guarantees one of the two is present — this is a regression
        // guard.
        throw new Error('MOP dispatch response missing runId/jobId despite refine()');
    }

    const providerStatus = String(parsed.data.status).toLowerCase();
    return {
        engineRunRef,
        providerStatus,
        runStatus: normaliseMopStatus(providerStatus),
        engineVersion: parsed.data.engineVersion ?? fallbackEngineVersion,
    };
}

export function parseMopRefreshResponse(
    raw: unknown,
): ParsedMopRefreshResponse {
    const parsed = MopRefreshResponseSchema.safeParse(raw);
    if (!parsed.success) {
        throw new MopResponseValidationError(parsed.error, 'MOP status refresh response');
    }

    const providerStatus = String(parsed.data.status).toLowerCase();
    return {
        providerStatus,
        runStatus: normaliseMopStatus(providerStatus),
        engineVersion: parsed.data.engineVersion ?? null,
    };
}

/**
 * Parse the Prio rule-evaluation response and project the firing actions onto
 * the RuleViolation domain model.
 *
 * Prio emits a generic actions_fired stream; we filter for compliance
 * violations and read severity/reason/violation_code out of the inner data
 * payload. Defaults match the original PrioEvaluationClient inline values.
 */
export function parsePrioEvaluationResponse(
    raw: unknown,
): ParsedPrioEvaluationResponse {
    const parsed = PrioEvaluationResponseSchema.safeParse(raw);
    if (!parsed.success) {
        throw new MopResponseValidationError(parsed.error, 'Prio evaluation response');
    }

    const fired: PrioActionFired[] = parsed.data.actions_fired ?? [];
    const violations: PrioRuleViolation[] = fired
        .filter((a) => a.fact_id === 'compliance_violation')
        .map((a) => ({
            rule_id: a.source ?? 'UNKNOWN_RULE',
            severity: a.data?.severity ?? 'Warning',
            reason: a.data?.reason ?? 'Unknown violation occurred',
            violation_code: a.data?.violation_code ?? 'UNKNOWN_CODE',
        }));

    return {
        violations,
        processingTimeMs:
            typeof parsed.data.processing_time_ms === 'number' && Number.isFinite(parsed.data.processing_time_ms)
                ? parsed.data.processing_time_ms
                : null,
    };
}
