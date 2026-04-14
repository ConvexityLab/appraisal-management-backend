#!/usr/bin/env tsx
/**
 * axiom-live-fire-analyze-with-sse.ts
 *
 * Exercises the legacy analyze path with live SSE stream monitoring.
 * Mirrors what the UI does when viewing a document analysis in real-time.
 *
 *   Step 1 — POST /api/axiom/analyze                           (trigger analysis)
 *   Step 2 — GET  /api/axiom/evaluations/:evaluationId         (immediate check)
 *   Step 3 — GET  /api/axiom/evaluations/order/:orderId/stream (SSE — runs concurrently with Step 4)
 *   Step 4 — GET  /api/axiom/evaluations/order/:orderId        (poll for evaluation in order list)
 *   Step 5 — GET  /api/axiom/evaluations/:evaluationId         (poll to completed — fully logged)
 *   Step 6 — POST /api/axiom/webhook                           (unsigned + optional signed)
 *
 * All HTTP responses are printed in full.
 * All SSE events are printed in full with timestamps.
 * Steps 3 and 4 run concurrently.
 *
 * ── Required env vars ────────────────────────────────────────────────────────
 *   AXIOM_LIVE_BASE_URL         Backend base URL, e.g. http://localhost:3001
 *   AXIOM_LIVE_TENANT_ID        Tenant ID
 *   AXIOM_LIVE_CLIENT_ID        Client ID
 *   AXIOM_LIVE_ORDER_ID         Existing order ID
 *   AXIOM_LIVE_DOCUMENT_ID      Document ID to analyze
 *
 * ── Auth (choose one) ────────────────────────────────────────────────────────
 *   AXIOM_LIVE_BEARER_TOKEN     Use this token directly
 *   AXIOM_LIVE_TEST_JWT_SECRET  Mint a local test JWT
 *   AXIOM_LIVE_USE_DEVICE_CODE=true  + AXIOM_LIVE_DEVICE_CODE_CLIENT_ID
 *   AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true
 *
 * ── Optional ─────────────────────────────────────────────────────────────────
 *   AXIOM_LIVE_DOCUMENT_TYPE    Default: appraisal
 *   AXIOM_LIVE_POLL_ATTEMPTS    Default: 60
 *   AXIOM_LIVE_POLL_INTERVAL_MS Default: 3000
 *   AXIOM_LIVE_SSE_TIMEOUT_MS   SSE stream timeout ms  (default: 120000)
 *   AXIOM_LIVE_WEBHOOK_SECRET   When set, signed webhook is also tested
 */

import crypto from 'crypto';
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

interface AnalyzeEnvelope {
  success: boolean;
  data?: { evaluationId: string; pipelineJobId?: string };
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

interface OrderEvaluationsEnvelope {
  success: boolean;
  data?: Array<{ evaluationId: string; status?: string; [key: string]: unknown }>;
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
    console.log('  body: ' + JSON.stringify(body, null, 2).replace(/\n/g, '\n  '));
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

// ─── SSE consumer ─────────────────────────────────────────────────────────────

const TERMINAL_SSE_EVENTS = new Set([
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_cancelled',
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
    console.log(`\n  [SSE] ${timeoutMs}ms timeout reached — aborting stream`);
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...authHeader, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === 'AbortError') {
      console.log('  [SSE] fetch aborted (timeout)');
      return;
    }
    throw new Error(`SSE fetch error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`  [SSE] HTTP ${res.status} ${res.statusText}`);

  if (!res.ok) {
    clearTimeout(timer);
    const body = await res.text();
    throw new Error(`SSE endpoint rejected the connection — HTTP ${res.status}: ${body}`);
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
        break;
      }

      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith(':')) {
          console.log(`  [SSE] ♥ ${line}`);
          continue;
        }

        if (line === '') {
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
      // stream already closed — ignore
    }
  }
}

// ─── Assertions ───────────────────────────────────────────────────────────────

function assertSubstantiveEvaluation(evaluation: EvaluationRecord): void {
  if (evaluation.status !== 'completed') {
    throw new Error(
      `Evaluation '${evaluation.evaluationId}' status='${evaluation.status ?? 'unknown'}' — expected 'completed'.`,
    );
  }

  if (typeof evaluation.overallRiskScore !== 'number' || !Number.isFinite(evaluation.overallRiskScore)) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' missing numeric overallRiskScore.`);
  }

  const informativeCriteria = (evaluation.criteria ?? []).filter((c) => {
    const hasId = typeof c.criterionId === 'string' || typeof c.criterionName === 'string';
    const hasContent =
      (typeof c.reasoning === 'string' && c.reasoning.trim().length > 0) ||
      (typeof c.evaluation === 'string' && c.evaluation.trim().length > 0) ||
      (Array.isArray(c.documentReferences) && c.documentReferences.length > 0);
    return hasId && hasContent;
  }).length;

  const hasExtraction =
    hasMeaningfulContent(evaluation.extractedData) || hasMeaningfulContent(evaluation.axiomExtractionResult);
  const hasCriteria = informativeCriteria > 0 || hasMeaningfulContent(evaluation.axiomCriteriaResult);

  if (!hasExtraction && !hasCriteria) {
    throw new Error(`Evaluation completed without substantive extraction or criteria output.`);
  }

  console.log(`✓ overallRiskScore         = ${evaluation.overallRiskScore}`);
  console.log(`✓ informativeCriteriaCount = ${informativeCriteria}`);
  console.log(`✓ hasExtractionOutput      = ${hasExtraction}`);
  console.log(`✓ hasCriteriaData          = ${hasCriteria}`);
}

// ─── Step implementations ─────────────────────────────────────────────────────

async function step1TriggerAnalyze(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
  documentId: string,
  documentType: string,
): Promise<{ evaluationId: string; pipelineJobId?: string }> {
  logSection('Step 1 — POST /api/axiom/analyze  [trigger document analysis]');

  const url = `${baseUrl}/api/axiom/analyze`;
  const body = { orderId, documentId, documentType, forceResubmit: true };

  logRequest('POST', url, body);
  const res = await postJson<AnalyzeEnvelope>(url, body, authHeader);
  logResponse(res.status, res.data);

  assertStatus(res.status, [202], 'POST /api/axiom/analyze', res.data);
  if (!res.data?.success || !res.data?.data?.evaluationId) {
    throw new Error(`Analyze response missing evaluationId: ${JSON.stringify(res.data)}`);
  }

  const { evaluationId, pipelineJobId } = res.data.data;
  console.log(`\n✓ evaluationId  = ${evaluationId}`);
  if (pipelineJobId) console.log(`✓ pipelineJobId = ${pipelineJobId}`);

  return { evaluationId, pipelineJobId };
}

async function step2ImmediateEvalCheck(
  baseUrl: string,
  authHeader: Record<string, string>,
  evaluationId: string,
): Promise<void> {
  logSection(`Step 2 — GET /api/axiom/evaluations/${evaluationId}  [immediate check]`);

  const url = `${baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`;
  logRequest('GET', url);
  const res = await getJson<EvaluationEnvelope>(url, authHeader);
  logResponse(res.status, res.data);

  assertStatus(res.status, [200, 404], 'immediate GET evaluation', res.data);
  if (res.status === 200) {
    console.log(`✓ evaluation already stored — status=${res.data?.data?.status ?? 'unknown'}`);
  } else {
    console.log('… evaluation not yet stored (404) — pipeline running');
  }
}

async function step3MonitorSse(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
  sseTimeoutMs: number,
): Promise<{ eventCount: number; hadTerminalEvent: boolean }> {
  logSection(
    `Step 3 — GET /api/axiom/evaluations/order/:orderId/stream  [SSE — ${sseTimeoutMs / 1000}s window]`,
  );

  const url = `${baseUrl}/api/axiom/evaluations/order/${encodeURIComponent(orderId)}/stream`;
  logRequest('GET', url);

  let eventCount = 0;
  let hadTerminalEvent = false;

  for await (const evt of openSseStream(url, authHeader, sseTimeoutMs)) {
    eventCount++;
    logSseEvent(evt);
    if (isSseTerminal(evt)) {
      hadTerminalEvent = true;
      console.log(`\n  ✓ terminal SSE event received — closing stream`);
      break;
    }
  }

  console.log(`\n✓ SSE stream closed — eventCount=${eventCount}  hadTerminalEvent=${hadTerminalEvent}`);
  return { eventCount, hadTerminalEvent };
}

async function step4PollOrderEvaluations(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
  evaluationId: string,
  pollAttempts: number,
  pollIntervalMs: number,
): Promise<void> {
  logSection('Step 4 — GET /api/axiom/evaluations/order/:orderId  [poll until found]');

  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const url = `${baseUrl}/api/axiom/evaluations/order/${encodeURIComponent(orderId)}`;
    const res = await getJson<OrderEvaluationsEnvelope>(url, authHeader);

    assertStatus(res.status, [200, 404], 'list order evaluations', res.data);

    if (res.status === 200 && res.data?.success && Array.isArray(res.data?.data)) {
      const match = res.data.data.find((item) => item.evaluationId === evaluationId);
      if (match) {
        fullLog(`← evaluation found in order list (attempt ${attempt}):`, match);
        console.log(`✓ evaluation visible in order list — status=${match.status ?? 'unknown'}`);
        return;
      }
    } else if (res.status !== 404) {
      logResponse(res.status, res.data);
      throw new Error(`Unexpected status ${res.status} from order evaluations list.`);
    }

    console.log(`  attempt ${attempt}/${pollAttempts} — evaluation not yet in order list`);
    await sleep(pollIntervalMs);
  }

  throw new Error(`evaluationId=${evaluationId} did not appear under orderId=${orderId} within poll window.`);
}

async function step5PollEvaluationToComplete(
  baseUrl: string,
  authHeader: Record<string, string>,
  evaluationId: string,
  pollAttempts: number,
  pollIntervalMs: number,
): Promise<EvaluationRecord> {
  logSection(`Step 5 — GET /api/axiom/evaluations/${evaluationId}  [poll to completed]`);

  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const url = `${baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`;
    const res = await getJson<EvaluationEnvelope>(url, authHeader);

    assertStatus(res.status, [200, 404], `GET /api/axiom/evaluations/${evaluationId}`, res.data);

    if (res.status === 404) {
      console.log(`  attempt ${attempt}/${pollAttempts} — 404, evaluation not yet stored`);
      await sleep(pollIntervalMs);
      continue;
    }

    const evaluation = res.data?.data;
    const status = evaluation?.status ?? 'unknown';

    console.log(`  attempt ${attempt}/${pollAttempts} — status=${status}`);

    if (status === 'failed') {
      fullLog(`← failed evaluation payload:`, res.data);
      throw new Error(`Evaluation '${evaluationId}' failed.`);
    }

    if (status === 'completed') {
      // Full payload — no truncation
      fullLog(`← completed evaluation payload (attempt ${attempt}):`, res.data);
      if (!evaluation) {
        throw new Error('Response reported success but data was absent.');
      }
      assertSubstantiveEvaluation(evaluation);
      return evaluation;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Evaluation '${evaluationId}' did not complete within ${pollAttempts} poll attempts.`);
}

async function step6WebhookRoundTrip(
  baseUrl: string,
  orderId: string,
  evaluationId: string,
  webhookSecret: string | undefined,
): Promise<void> {
  logSection('Step 6 — POST /api/axiom/webhook  [unsigned + signed]');

  const webhookUrl = `${baseUrl}/api/axiom/webhook`;

  // ── unsigned ──────────────────────────────────────────────────────────────
  const unsignedPayload = {
    correlationId: orderId,
    correlationType: 'ORDER',
    status: 'completed',
    timestamp: new Date().toISOString(),
  };

  logRequest('POST (unsigned)', webhookUrl, unsignedPayload);
  const unsignedRes = await postJson<Record<string, unknown>>(webhookUrl, unsignedPayload, {});
  logResponse(unsignedRes.status, unsignedRes.data);

  if (webhookSecret) {
    assertStatus(unsignedRes.status, [401], 'unsigned webhook (secret configured)', unsignedRes.data);
    console.log('✓ unsigned webhook correctly rejected (401)');
  } else {
    console.log(
      `… unsigned webhook returned ${unsignedRes.status} (no webhook secret set — open mode)`,
    );
  }

  // ── signed ────────────────────────────────────────────────────────────────
  if (!webhookSecret) {
    console.log('\n… AXIOM_LIVE_WEBHOOK_SECRET not set — skipping signed webhook test');
    return;
  }

  const signedPayload = {
    correlationId: orderId,
    correlationType: 'ORDER',
    status: 'completed',
    timestamp: new Date().toISOString(),
    result: {
      evaluationId,
      overallRiskScore: 68,
      criteria: [
        {
          criterionId: 'LIVE_FIRE_ANALYZE_SSE_CRITERION',
          evaluation: 'PASS',
          reasoning: 'Live-fire analyze-with-SSE signed webhook criterion.',
        },
      ],
    },
  };

  const signedBody = JSON.stringify(signedPayload);
  const signature = `hmac-sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(Buffer.from(signedBody, 'utf8'))
    .digest('hex')}`;

  console.log(`\n→ X-Axiom-Signature: ${signature}`);
  logRequest('POST (signed)', webhookUrl, signedPayload);

  const signedRes = await postJson<Record<string, unknown>>(
    webhookUrl,
    signedPayload,
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
  const documentType = optionalEnv('AXIOM_LIVE_DOCUMENT_TYPE') ?? 'appraisal';
  const sseTimeoutMs = envInt('AXIOM_LIVE_SSE_TIMEOUT_MS', 120_000);
  const webhookSecret = optionalEnv('AXIOM_LIVE_WEBHOOK_SECRET');

  logConfig(context, {
    orderId,
    documentId,
    documentType,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
    sseTimeoutSec: sseTimeoutMs / 1000,
    webhookSecretConfigured: webhookSecret ? 'yes' : 'no',
  });

  // Step 1: trigger analysis
  const { evaluationId } = await step1TriggerAnalyze(
    context.baseUrl,
    context.authHeader,
    orderId,
    documentId,
    documentType,
  );

  // Step 2: immediate check (fast, just one call)
  await step2ImmediateEvalCheck(context.baseUrl, context.authHeader, evaluationId);

  // Steps 3 + 4: concurrent SSE monitoring + order evaluation list polling
  logSection('Step 3+4 — SSE stream and order-eval poll running concurrently');
  console.log('  → starting SSE consumer and order-list poller simultaneously');

  const [sseResult] = await Promise.all([
    step3MonitorSse(context.baseUrl, context.authHeader, orderId, sseTimeoutMs),
    step4PollOrderEvaluations(
      context.baseUrl,
      context.authHeader,
      orderId,
      evaluationId,
      poll.attempts,
      poll.intervalMs,
    ),
  ]);

  // Step 5: poll evaluation to completed, print full payload
  const evaluation = await step5PollEvaluationToComplete(
    context.baseUrl,
    context.authHeader,
    evaluationId,
    poll.attempts,
    poll.intervalMs,
  );

  // Step 6: webhook round-trip
  await step6WebhookRoundTrip(context.baseUrl, orderId, evaluationId, webhookSecret);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('✅  Analyze-with-SSE live-fire PASSED');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`   evaluationId        : ${evaluationId}`);
  console.log(`   overallRiskScore    : ${evaluation.overallRiskScore ?? 'n/a'}`);
  console.log(`   SSE events received : ${sseResult.eventCount}`);
  console.log(`   SSE terminal event  : ${sseResult.hadTerminalEvent}`);
  console.log(`   webhookTested       : ${webhookSecret ? 'yes (signed+unsigned)' : 'unsigned only'}`);
}

main().catch((error) => {
  console.error(`\n❌  Analyze-with-SSE live-fire FAILED: ${(error as Error).message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
