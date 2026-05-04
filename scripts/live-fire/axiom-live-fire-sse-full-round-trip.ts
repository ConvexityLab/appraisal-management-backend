#!/usr/bin/env tsx
/**
 * axiom-live-fire-sse-full-round-trip.ts
 *
 * Full end-to-end live-fire test that mirrors the EXACT UI submission flow:
 *
 *   Step 1 — POST /api/axiom/analyze                       (UI path — submit document for analysis)
 *   Step 2 — GET  /api/axiom/evaluations/order/:id/stream  (SSE — sole completion signal; waits for terminal event)
 *   Step 3 — GET  /api/axiom/evaluations/:evaluationId     (single fetch after SSE terminal; retries only for Cosmos lag)
 *   Step 4 — POST /api/axiom/webhook                       (unsigned reject + signed accept)
 *
 * Every HTTP request and response is printed in full.
 * Every SSE event is printed in full (event name + complete JSON payload).
 * SSE is the sole completion signal — no polling. Step 3 is a single GET after the SSE terminal event.
 *
 * ── Required env vars ────────────────────────────────────────────────────────
 *   AXIOM_LIVE_BASE_URL         Backend base URL, e.g. http://localhost:3001
 *   AXIOM_LIVE_TENANT_ID        Tenant ID used for auth header minting
 *   AXIOM_LIVE_CLIENT_ID        Client ID used for auth header minting
 *   AXIOM_LIVE_ORDER_ID         Existing order ID
 *   AXIOM_LIVE_DOCUMENT_ID      Document ID to analyze (must belong to the order)
 *
 * ── Auth (choose one) ────────────────────────────────────────────────────────
 *   AXIOM_LIVE_BEARER_TOKEN     Use this token directly
 *   AXIOM_LIVE_TEST_JWT_SECRET  Mint a local test JWT (dev/mock environments)
 *   AXIOM_LIVE_USE_DEVICE_CODE=true  + AXIOM_LIVE_DEVICE_CODE_CLIENT_ID
 *   AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true
 *
 * ── Optional ─────────────────────────────────────────────────────────────────
 *   AXIOM_LIVE_DOCUMENT_TYPE    Default: appraisal-report
 *   AXIOM_LIVE_EVALUATION_MODE  EXTRACTION | CRITERIA_EVALUATION | COMPLETE_EVALUATION  (default: COMPLETE_EVALUATION)
 *   AXIOM_LIVE_POLL_ATTEMPTS    Default: 60
 *   AXIOM_LIVE_POLL_INTERVAL_MS Default: 3000
 *   AXIOM_LIVE_SSE_TIMEOUT_MS   SSE stream timeout ms  (default: 120000)
 *   AXIOM_LIVE_WEBHOOK_SECRET   When set, also tests signed webhook delivery
 */

import crypto from 'crypto';
import { randomUUID } from 'crypto';
import {
  assertStatus,
  getJson,
  hasMeaningfulContent,
  isRecord,
  loadLiveFireContext,
  loadPollOptions,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmitEnvelope {
  success: boolean;
  data?: {
    evaluationId: string;
    pipelineJobId?: string;
    orderId?: string;
    documentId?: string;
    message?: string;
  };
  error?: { message?: string; code?: string };
}

interface EvaluationCriterion {
  criterionId?: string;
  criterionName?: string;
  evaluation?: string;
  reasoning?: string;
  documentReferences?: unknown[];
  supportingData?: unknown[];
}

interface EvaluationRecord {
  evaluationId: string;
  status?: string;
  overallRiskScore?: number;
  criteria?: EvaluationCriterion[];
  extractedData?: Record<string, unknown>;
  axiomExtractionResult?: unknown;
  axiomCriteriaResult?: unknown;
  [key: string]: unknown;
}

interface EvaluationEnvelope {
  success: boolean;
  data?: EvaluationRecord;
  error?: { message?: string; code?: string };
}

interface SseEvent {
  index: number;
  id?: string;
  event: string;
  data: string;
  parsedData?: unknown;
  receivedAt: string;
}

// ─── Env helpers ──────────────────────────────────────────────────────────────

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer. Got: ${raw}`);
  }
  return parsed;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function fullLog(label: string, payload: unknown): void {
  console.log(`\n${label}`);
  console.log(JSON.stringify(payload, null, 2));
}

function logRequest(method: string, url: string, body?: unknown): void {
  console.log(`\n→ ${method} ${url}`);
  if (body !== undefined) {
    console.log('  body:', JSON.stringify(body, null, 2).replace(/\n/g, '\n  '));
  }
}

function logResponse(status: number, data: unknown): void {
  console.log(`\n← HTTP ${status}`);
  console.log(JSON.stringify(data, null, 2));
}

function logSseEvent(evt: SseEvent): void {
  console.log(`\n  [SSE #${evt.index}]  ${evt.receivedAt}  event=${evt.event}${evt.id ? `  id=${evt.id}` : ''}`);
  if (evt.parsedData !== undefined) {
    console.log('  ' + JSON.stringify(evt.parsedData, null, 2).replace(/\n/g, '\n  '));
  } else {
    console.log(`  raw: ${evt.data}`);
  }
}

// ─── Request helpers ──────────────────────────────────────────────────────────

function idempotencyHeaders(tag: string): Record<string, string> {
  const key = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${key}`,
    'X-Correlation-Id': key,
  };
}

function signBody(body: string, secret: string): string {
  return `hmac-sha256=${crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('hex')}`;
}

// ─── SSE stream consumer ──────────────────────────────────────────────────────

const TERMINAL_SSE_EVENTS = new Set([
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_cancelled',
  'pipeline_partial_complete',
  'COMPLETE',
  'FAILED',
  'CANCELLED',
  'error',
  'done',
  'timeout',
]);

function isSseTerminal(evt: SseEvent): boolean {
  if (TERMINAL_SSE_EVENTS.has(evt.event)) return true;
  if (isRecord(evt.parsedData)) {
    const type = evt.parsedData['type'] as string | undefined;
    const status = evt.parsedData['status'] as string | undefined;
    if (type && TERMINAL_SSE_EVENTS.has(type)) return true;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') return true;
  }
  return false;
}

async function* openSseStream(
  url: string,
  authHeader: Record<string, string>,
  timeoutMs: number,
): AsyncGenerator<SseEvent, void, undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.log(`\n  [SSE] timeout after ${timeoutMs}ms — aborting stream`);
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        ...authHeader,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === 'AbortError') {
      console.log('  [SSE] connection aborted (timeout)');
      return;
    }
    throw new Error(`SSE fetch error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`  [SSE] connected — HTTP ${res.status} ${res.statusText}`);

  if (!res.ok) {
    clearTimeout(timer);
    const body = await res.text();
    throw new Error(`SSE connection rejected HTTP ${res.status}: ${body}`);
  }

  if (!res.body) {
    clearTimeout(timer);
    throw new Error('SSE response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventId: string | undefined;
  let eventName = 'message';
  let dataLines: string[] = [];
  let index = 0;

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // Aborted (timeout or external cancellation)
        break;
      }

      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith(':')) {
          // SSE comment / heartbeat — log but don't dispatch
          console.log(`  [SSE] heartbeat: ${line}`);
          continue;
        }

        if (line === '') {
          // Blank line = dispatch event
          if (dataLines.length > 0) {
            const data = dataLines.join('\n');
            let parsedData: unknown;
            try {
              parsedData = JSON.parse(data);
            } catch {
              parsedData = undefined;
            }
            index++;
            const evt: SseEvent = {
              index,
              id: eventId,
              event: eventName,
              data,
              parsedData,
              receivedAt: new Date().toISOString(),
            };
            yield evt;
            if (isSseTerminal(evt)) {
              clearTimeout(timer);
              return;
            }
          }
          eventId = undefined;
          eventName = 'message';
          dataLines = [];
          continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
          if (line === 'data') dataLines.push('');
          continue;
        }

        const field = line.slice(0, colonIdx);
        const value = line.slice(colonIdx + 1).replace(/^ /, '');
        if (field === 'id') eventId = value;
        else if (field === 'event') eventName = value;
        else if (field === 'data') dataLines.push(value);
      }
    }
  } finally {
    clearTimeout(timer);
    try {
      reader.cancel();
    } catch {
      // ignore — reader may already be closed
    }
  }
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

function assertSubstantiveEvaluation(evaluation: EvaluationRecord): void {
  if (evaluation.status !== 'completed') {
    throw new Error(
      `Evaluation '${evaluation.evaluationId}' status='${evaluation.status ?? 'unknown'}' — expected 'completed'.`,
    );
  }

  if (typeof evaluation.overallRiskScore !== 'number' || !Number.isFinite(evaluation.overallRiskScore)) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' is missing a numeric overallRiskScore.`);
  }

  const informativeCriteria = (evaluation.criteria ?? []).filter((c) => {
    const hasId = typeof c.criterionId === 'string' || typeof c.criterionName === 'string';
    const hasContent =
      (typeof c.reasoning === 'string' && c.reasoning.trim().length > 0) ||
      (typeof c.evaluation === 'string' && c.evaluation.trim().length > 0) ||
      (Array.isArray(c.documentReferences) && c.documentReferences.length > 0) ||
      (Array.isArray(c.supportingData) && c.supportingData.length > 0);
    return hasId && hasContent;
  }).length;

  const hasExtraction =
    hasMeaningfulContent(evaluation.extractedData) || hasMeaningfulContent(evaluation.axiomExtractionResult);
  const hasCriteriaData =
    informativeCriteria > 0 || hasMeaningfulContent(evaluation.axiomCriteriaResult);

  if (!hasExtraction && !hasCriteriaData) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' completed but produced no substantive output.`);
  }

  console.log(`✓ overallRiskScore         = ${evaluation.overallRiskScore}`);
  console.log(`✓ informativeCriteriaCount = ${informativeCriteria}`);
  console.log(`✓ hasExtractionOutput      = ${hasExtraction}`);
  console.log(`✓ hasCriteriaData          = ${hasCriteriaData}`);
}

// ─── Step implementations ────────────────────────────────────────────────────

async function step1SubmitAnalysis(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
  documentId: string,
  documentType: string,
  evaluationMode: string,
  programId: string | undefined,
  programVersion: string | undefined,
): Promise<{ evaluationId: string; pipelineJobId?: string }> {
  logSection('Step 1 — POST /api/axiom/analyze  [UI path]');

  const url = `${baseUrl}/api/axiom/analyze`;
  const body = {
    documentId,
    orderId,
    documentType,
    evaluationMode,
    // Always force a fresh Axiom pipeline run — bypasses the Cosmos idempotency guard
    // so live-fire tests test actual submission, not cached results.
    forceResubmit: true,
    ...(programId ? { programId } : {}),
    ...(programVersion ? { programVersion } : {}),
  };

  logRequest('POST', url, body);

  const res = await postJson<SubmitEnvelope>(url, body, authHeader, idempotencyHeaders('livefire-sse-rtrip'));

  logResponse(res.status, res.data);
  assertStatus(res.status, [202], 'POST /api/axiom/analyze', res.data);

  if (!res.data?.success || !res.data?.data?.evaluationId) {
    throw new Error(`Submit response missing evaluationId: ${JSON.stringify(res.data)}`);
  }

  const { evaluationId, pipelineJobId } = res.data.data;
  console.log(`\n✓ evaluationId  = ${evaluationId}`);
  if (pipelineJobId) console.log(`✓ pipelineJobId = ${pipelineJobId}`);

  return { evaluationId, pipelineJobId };
}

async function step2MonitorSseStream(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
  sseTimeoutMs: number,
): Promise<{ eventCount: number; hadTerminalEvent: boolean; events: SseEvent[] }> {
  logSection(
    `Step 2 — GET /api/axiom/evaluations/order/:orderId/stream  [SSE — ${sseTimeoutMs / 1000}s window]`,
  );

  const url = `${baseUrl}/api/axiom/evaluations/order/${encodeURIComponent(orderId)}/stream`;
  logRequest('GET', url);

  const events: SseEvent[] = [];
  let hadTerminalEvent = false;

  for await (const evt of openSseStream(url, authHeader, sseTimeoutMs)) {
    events.push(evt);
    logSseEvent(evt);

    if (isSseTerminal(evt)) {
      hadTerminalEvent = true;
      console.log(`\n  ✓ terminal SSE event — stopping stream`);
      break;
    }
  }

  console.log(`\n✓ SSE stream closed`);
  console.log(`✓ total SSE events     = ${events.length}`);
  console.log(`✓ had terminal event   = ${hadTerminalEvent}`);

  return { eventCount: events.length, hadTerminalEvent, events };
}

async function step3FetchEvaluation(
  baseUrl: string,
  authHeader: Record<string, string>,
  evaluationId: string,
): Promise<EvaluationRecord> {
  logSection(`Step 3 — GET /api/axiom/evaluations/${evaluationId}  [full result — single fetch after SSE terminal]`);
  // SSE already confirmed completion. This retry loop only absorbs Cosmos propagation lag
  // (the webhook handler writes to Cosmos, then fires the SSE event; the write may not be
  // visible to a GET for up to ~2s). 10 attempts at 1s = 10s ceiling before we give up.
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 1_000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // bypassCache=true forces a live Axiom fetch — ensures we see the real result, not stale Cosmos data.
    const url = `${baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`;
    const res = await getJson<EvaluationEnvelope>(url, authHeader);

    assertStatus(res.status, [200, 404], `GET /api/axiom/evaluations/${evaluationId}`, res.data);

    if (res.status === 404) {
      console.log(`  attempt ${attempt}/${MAX_ATTEMPTS} — 404, waiting for Cosmos propagation…`);
      await sleep(INTERVAL_MS);
      continue;
    }

    // Full payload log — no truncation
    fullLog(`← evaluation payload (HTTP ${res.status}):`, res.data);

    const evaluation = res.data?.data;
    if (!evaluation) {
      throw new Error(
        `GET /api/axiom/evaluations/${evaluationId} returned success:true but data is absent.`,
      );
    }

    assertSubstantiveEvaluation(evaluation);
    return evaluation;
  }

  throw new Error(
    `Evaluation '${evaluationId}' not visible in Cosmos after ${MAX_ATTEMPTS}s post-SSE terminal. ` +
    `The webhook handler may not have completed its Cosmos write.`,
  );
}

async function step4WebhookRoundTrip(
  baseUrl: string,
  orderId: string,
  evaluationId: string,
  webhookSecret: string | undefined,
): Promise<void> {
  logSection('Step 4 — POST /api/axiom/webhook  [unsigned + signed]');

  // ── 5a: unsigned ──────────────────────────────────────────────────────────
  const unsignedUrl = `${baseUrl}/api/axiom/webhook`;
  const unsignedPayload = {
    correlationId: orderId,
    correlationType: 'ORDER',
    status: 'completed',
    timestamp: new Date().toISOString(),
  };

  logRequest('POST', unsignedUrl, unsignedPayload);
  const unsignedRes = await postJson<Record<string, unknown>>(unsignedUrl, unsignedPayload, {});
  logResponse(unsignedRes.status, unsignedRes.data);

  if (webhookSecret) {
    assertStatus(unsignedRes.status, [401], 'unsigned webhook (secret configured)', unsignedRes.data);
    console.log('✓ unsigned webhook correctly rejected with 401');
  } else {
    console.log(
      `… no webhook secret configured — unsigned returned ${unsignedRes.status} (expected when no secret in env)`,
    );
  }

  // ── 5b: signed ────────────────────────────────────────────────────────────
  if (!webhookSecret) {
    console.log('\n… AXIOM_LIVE_WEBHOOK_SECRET not set — skipping signed webhook round-trip');
    return;
  }

  const signedPayloadObject = {
    correlationId: orderId,
    correlationType: 'ORDER',
    status: 'completed',
    timestamp: new Date().toISOString(),
    result: {
      evaluationId,
      overallRiskScore: 72,
      criteria: [
        {
          criterionId: 'LIVE_FIRE_SSE_ROUND_TRIP_CRITERION',
          evaluation: 'PASS',
          reasoning: 'Live-fire SSE round-trip signed webhook test.',
        },
      ],
    },
  };

  const signedBody = JSON.stringify(signedPayloadObject);
  const signature = signBody(signedBody, webhookSecret);

  console.log(`\n→ X-Axiom-Signature: ${signature}`);
  logRequest('POST', unsignedUrl, signedPayloadObject);

  const signedRes = await postJson<Record<string, unknown>>(
    unsignedUrl,
    signedPayloadObject,
    { 'content-type': 'application/json' },
    { 'x-axiom-signature': signature },
  );

  logResponse(signedRes.status, signedRes.data);
  assertStatus(signedRes.status, [200], 'signed webhook', signedRes.data);
  console.log('✓ signed webhook accepted (200)');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const poll = loadPollOptions();

  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const documentId = requiredEnv('AXIOM_LIVE_DOCUMENT_ID');
  const documentType = optionalEnv('AXIOM_LIVE_DOCUMENT_TYPE') ?? 'appraisal-report';
  const evaluationMode = (optionalEnv('AXIOM_LIVE_EVALUATION_MODE') ?? 'COMPLETE_EVALUATION').toUpperCase();
  // Default to FNMA-URAR v1.0.0 — a confirmed working program on the Axiom dev cluster.
  // Without a programId+programVersion, Axiom skips criteria evaluation and returns pipeline.partial_complete.
  const programId = optionalEnv('AXIOM_LIVE_PROGRAM_ID') ?? 'FNMA-URAR';
  const programVersion = optionalEnv('AXIOM_LIVE_PROGRAM_VERSION') ?? '1.0.0';
  const sseTimeoutMs = envInt('AXIOM_LIVE_SSE_TIMEOUT_MS', 120_000);
  const webhookSecret = optionalEnv('AXIOM_LIVE_WEBHOOK_SECRET');

  logConfig(context, {
    orderId,
    documentId,
    documentType,
    evaluationMode,
    programId,
    programVersion,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
    sseTimeoutSec: sseTimeoutMs / 1000,
    webhookSecretConfigured: webhookSecret ? 'yes' : 'no',
  });

  // ── Step 1: submit ────────────────────────────────────────────────────────
  const { evaluationId } = await step1SubmitAnalysis(
    context.baseUrl,
    context.authHeader,
    orderId,
    documentId,
    documentType,
    evaluationMode,
    programId,
    programVersion,
  );

  // ── Step 2: SSE stream — sole completion signal ─────────────────────────
  // The webhook drives Cosmos storage and then broadcasts the SSE terminal event.
  // We do NOT poll — the SSE terminal event IS the signal that the pipeline is done.
  const sseResult = await step2MonitorSseStream(context.baseUrl, context.authHeader, orderId, sseTimeoutMs);

  if (!sseResult.hadTerminalEvent) {
    throw new Error(
      `SSE stream closed without a terminal event after ${sseTimeoutMs / 1000}s. ` +
      `The pipeline may still be running — increase AXIOM_LIVE_SSE_TIMEOUT_MS or check Axiom status.`,
    );
  }

  console.log(`\n✓ SSE events received  = ${sseResult.eventCount}`);
  console.log(`✓ SSE terminal event   = ${sseResult.hadTerminalEvent}`);
  console.log(`✓ evaluationId         = ${evaluationId}`);

  // ── Step 3: single fetch after SSE terminal ───────────────────────────────
  // Small retry loop only to absorb Cosmos propagation lag (SSE fires from the
  // webhook handler; the Cosmos write may not be visible to a GET for ~1-2s).
  const evaluation = await step3FetchEvaluation(
    context.baseUrl,
    context.authHeader,
    evaluationId,
  );

  // ── Step 4: webhook round-trip ────────────────────────────────────────────
  await step4WebhookRoundTrip(context.baseUrl, orderId, evaluationId, webhookSecret);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('✅  SSE full round-trip live-fire PASSED');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`   evaluationId        : ${evaluationId}`);
  console.log(`   overallRiskScore    : ${evaluation.overallRiskScore ?? 'n/a'}`);
  console.log(`   SSE events received : ${sseResult.eventCount}`);
  console.log(`   SSE terminal event  : ${sseResult.hadTerminalEvent}`);
  console.log(`   webhookTested       : ${webhookSecret ? 'yes (signed+unsigned)' : 'unsigned only'}`)
}

main().catch((error) => {
  console.error(`\n❌  SSE full round-trip live-fire FAILED: ${(error as Error).message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
