#!/usr/bin/env tsx
/**
 * Axiom v2 end-to-end live-fire test.
 *
 * Exercises every v2 proxy route the FE depends on, against a real
 * deployed backend talking to a real Axiom instance:
 *
 *   1. POST  /api/axiom/scopes/:scopeId/evaluate
 *   2. GET   /api/axiom/scopes/:scopeId/runs/:runId          (poll → terminal)
 *   3. GET   /api/axiom/scopes/:scopeId/results?programId=…  (latest verdicts)
 *   4. GET   /api/axiom/scopes/:scopeId/criteria/:criterionId/history
 *   5. POST  /api/axiom/scopes/:scopeId/criteria/:criterionId/override
 *      (only when AXIOM_LIVE_V2_RUN_OVERRIDE=true)
 *
 * For each step, asserts:
 *   - HTTP status is in expected range
 *   - Response shape matches what the FE's strict normalizer expects
 *     (evaluationRunId, scopeId, programId, programVersion, status,
 *     evaluatedAt; per-criterion: resultId, evaluationRunId,
 *     evaluationid, criterionId, criterionName, evaluation in v2 enum,
 *     confidence, reasoning, evaluatedBy, evaluatedAt, manualOverride,
 *     criterionSnapshot, dataConsulted)
 *   - v2 verdict enum: pass | fail | needs_review | cannot_evaluate |
 *     not_applicable. Throws if it ever sees the legacy 'warning'/'info'.
 *
 * Required env (in addition to the base set in _axiom-live-fire-common.ts):
 *
 *   AXIOM_LIVE_BASE_URL          deployed backend URL
 *   AXIOM_LIVE_TENANT_ID
 *   AXIOM_LIVE_CLIENT_ID
 *   AXIOM_LIVE_ORDER_ID          existing order id (= scopeId; from preflight)
 *
 * Optional env:
 *
 *   AXIOM_LIVE_V2_PROGRAM_ID         override programId (else fetched from order)
 *   AXIOM_LIVE_V2_PROGRAM_VERSION    override programVersion (else fetched from order)
 *   AXIOM_LIVE_V2_SCHEMA_ID           default = programId
 *   AXIOM_LIVE_V2_RUN_OVERRIDE        'true' to also exercise POST /override
 *   AXIOM_LIVE_V2_OVERRIDE_VERDICT    pass|fail|needs_review (default 'pass')
 *   AXIOM_LIVE_POLL_ATTEMPTS          run-poll attempts (default 20)
 *   AXIOM_LIVE_POLL_INTERVAL_MS       run-poll interval (default 3000)
 *
 * Auth: same as other live-fire scripts — set AXIOM_LIVE_BEARER_TOKEN, or use
 * device-code/default-credential, or AXIOM_LIVE_TEST_JWT_SECRET in dev.
 *
 * Run: `pnpm axiom:livefire:v2-flow`
 */

import {
  assertStatus,
  getJson,
  isRecord,
  loadLiveFireContext,
  loadPollOptions,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

// ── Env helpers ─────────────────────────────────────────────────────────────

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

function isEnvTrue(name: string): boolean {
  const raw = optionalEnv(name);
  return raw === 'true' || raw === '1' || raw?.toLowerCase() === 'yes';
}

// ── v2 contract enums ───────────────────────────────────────────────────────

const V2_RUN_STATUSES = ['processing', 'completed', 'failed', 'timed_out'] as const;
type V2RunStatus = (typeof V2_RUN_STATUSES)[number];
const V2_TERMINAL_STATUSES = new Set<V2RunStatus>(['completed', 'failed', 'timed_out']);

const V2_VERDICTS = ['pass', 'fail', 'needs_review', 'cannot_evaluate', 'not_applicable'] as const;
type V2Verdict = (typeof V2_VERDICTS)[number];

const V2_EVALUATED_BY = [
  'underwriter-actor',
  'pipeline-evaluator',
  'api-service',
  'human-override',
] as const;
type V2EvaluatedBy = (typeof V2_EVALUATED_BY)[number];

const USER_OVERRIDABLE_VERDICTS = ['pass', 'fail', 'needs_review'] as const;
type UserOverridableVerdict = (typeof USER_OVERRIDABLE_VERDICTS)[number];

// ── Response shape types ────────────────────────────────────────────────────

interface V2ResultDoc {
  resultId: unknown;
  evaluationRunId: unknown;
  criterionId: unknown;
  criterionName: unknown;
  evaluation: unknown;
  confidence: unknown;
  reasoning: unknown;
  evaluatedBy: unknown;
  evaluatedAt: unknown;
  manualOverride: unknown;
  criterionSnapshot?: unknown;
  dataConsulted?: unknown;
  cannotEvaluate?: unknown;
  documentReferences?: unknown;
  supersedes?: unknown;
}

interface V2EvaluationRunResponse {
  evaluationRunId: unknown;
  scopeId: unknown;
  programId: unknown;
  programVersion: unknown;
  status: unknown;
  evaluatedAt: unknown;
  results?: unknown;
  pipelineJobId?: unknown;
  error?: unknown;
}

interface V2LatestResultsResponse {
  scopeId: unknown;
  programId: unknown;
  results: unknown;
  asOf?: unknown;
}

interface V2CriterionHistoryResponse {
  scopeId: unknown;
  criterionId: unknown;
  history: unknown;
}

// ── Order summary (for fetching programId/programVersion if not provided) ──

interface OrderSummary {
  id?: string;
  orderId?: string;
  axiomProgramId?: string;
  axiomProgramVersion?: string;
}

interface WrappedOrderResponse {
  success?: boolean;
  data?: OrderSummary;
}

// ── Shape assertions ────────────────────────────────────────────────────────

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Contract violation: ${field} expected non-empty string, got ${JSON.stringify(value)}`);
  }
  return value;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Contract violation: ${field} expected finite number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Contract violation: ${field} expected boolean, got ${JSON.stringify(value)}`);
  }
  return value;
}

function assertRunStatus(value: unknown, field: string): V2RunStatus {
  if (typeof value !== 'string' || !V2_RUN_STATUSES.includes(value as V2RunStatus)) {
    throw new Error(
      `Contract violation: ${field} expected one of [${V2_RUN_STATUSES.join('|')}], got ${JSON.stringify(value)}`,
    );
  }
  return value as V2RunStatus;
}

function assertVerdict(value: unknown, field: string): V2Verdict {
  if (value === 'warning' || value === 'info') {
    throw new Error(
      `Contract violation: ${field} returned legacy verdict '${value}'. v2 enum is [${V2_VERDICTS.join('|')}]; backend must not emit legacy values.`,
    );
  }
  if (typeof value !== 'string' || !V2_VERDICTS.includes(value as V2Verdict)) {
    throw new Error(
      `Contract violation: ${field} expected one of [${V2_VERDICTS.join('|')}], got ${JSON.stringify(value)}`,
    );
  }
  return value as V2Verdict;
}

function assertEvaluatedBy(value: unknown, field: string): V2EvaluatedBy {
  if (typeof value !== 'string' || !V2_EVALUATED_BY.includes(value as V2EvaluatedBy)) {
    throw new Error(
      `Contract violation: ${field} expected one of [${V2_EVALUATED_BY.join('|')}], got ${JSON.stringify(value)}`,
    );
  }
  return value as V2EvaluatedBy;
}

function assertResultDoc(doc: unknown, fieldPrefix: string): V2ResultDoc {
  if (!isRecord(doc)) {
    throw new Error(`Contract violation: ${fieldPrefix} expected object, got ${JSON.stringify(doc)}`);
  }
  const cast = doc as unknown as V2ResultDoc;

  assertString(cast.resultId, `${fieldPrefix}.resultId`);
  assertString(cast.evaluationRunId, `${fieldPrefix}.evaluationRunId`);
  assertString(cast.criterionId, `${fieldPrefix}.criterionId`);
  assertString(cast.criterionName, `${fieldPrefix}.criterionName`);
  assertVerdict(cast.evaluation, `${fieldPrefix}.evaluation`);
  assertNumber(cast.confidence, `${fieldPrefix}.confidence`);
  assertString(cast.reasoning, `${fieldPrefix}.reasoning`);
  assertEvaluatedBy(cast.evaluatedBy, `${fieldPrefix}.evaluatedBy`);
  assertString(cast.evaluatedAt, `${fieldPrefix}.evaluatedAt`);
  assertBoolean(cast.manualOverride, `${fieldPrefix}.manualOverride`);

  if (!isRecord(cast.criterionSnapshot)) {
    throw new Error(`Contract violation: ${fieldPrefix}.criterionSnapshot expected object`);
  }
  if (!isRecord(cast.dataConsulted)) {
    throw new Error(`Contract violation: ${fieldPrefix}.dataConsulted expected object`);
  }

  return cast;
}

function assertEvaluationRunResponse(payload: unknown): V2EvaluationRunResponse {
  if (!isRecord(payload)) {
    throw new Error(`Contract violation: response expected object, got ${JSON.stringify(payload)}`);
  }
  const cast = payload as unknown as V2EvaluationRunResponse;

  assertString(cast.evaluationRunId, 'response.evaluationRunId');
  assertString(cast.scopeId, 'response.scopeId');
  assertString(cast.programId, 'response.programId');
  assertString(cast.programVersion, 'response.programVersion');
  assertRunStatus(cast.status, 'response.status');
  assertString(cast.evaluatedAt, 'response.evaluatedAt');

  // results may be a flat array of result docs (per contract §1) or omitted
  // when the run hasn't completed yet. Validate shape if present.
  if (Array.isArray(cast.results)) {
    cast.results.forEach((doc, i) => assertResultDoc(doc, `response.results[${i}]`));
  } else if (cast.results !== undefined && cast.results !== null) {
    // Tolerate a nested wrapper { criteria: [...] } only if criteria is an array.
    if (isRecord(cast.results) && Array.isArray((cast.results as { criteria?: unknown }).criteria)) {
      const criteria = (cast.results as { criteria: unknown[] }).criteria;
      criteria.forEach((doc, i) => assertResultDoc(doc, `response.results.criteria[${i}]`));
    } else {
      throw new Error(
        `Contract violation: response.results expected array or { criteria: [] }, got ${JSON.stringify(cast.results)}`,
      );
    }
  }

  return cast;
}

function assertLatestResultsResponse(payload: unknown): V2LatestResultsResponse {
  if (!isRecord(payload)) {
    throw new Error(`Contract violation: response expected object, got ${JSON.stringify(payload)}`);
  }
  const cast = payload as unknown as V2LatestResultsResponse;

  assertString(cast.scopeId, 'response.scopeId');
  assertString(cast.programId, 'response.programId');
  if (!Array.isArray(cast.results)) {
    throw new Error(`Contract violation: response.results expected array, got ${JSON.stringify(cast.results)}`);
  }
  cast.results.forEach((doc, i) => assertResultDoc(doc, `response.results[${i}]`));

  // asOf is documented as required in the contract; runtime always sets it
  // server-side, but we tolerate the optional case during transition.
  if (cast.asOf !== undefined && typeof cast.asOf !== 'string') {
    throw new Error(`Contract violation: response.asOf must be string when present`);
  }

  return cast;
}

function assertCriterionHistoryResponse(payload: unknown): V2CriterionHistoryResponse {
  if (!isRecord(payload)) {
    throw new Error(`Contract violation: response expected object, got ${JSON.stringify(payload)}`);
  }
  const cast = payload as unknown as V2CriterionHistoryResponse;

  assertString(cast.scopeId, 'response.scopeId');
  assertString(cast.criterionId, 'response.criterionId');
  if (!Array.isArray(cast.history)) {
    throw new Error(`Contract violation: response.history expected array, got ${JSON.stringify(cast.history)}`);
  }
  cast.history.forEach((doc, i) => assertResultDoc(doc, `response.history[${i}]`));

  return cast;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrapData<T>(payload: unknown): T {
  // Backend wraps most v2 responses in { success, data }. Unwrap if present.
  if (isRecord(payload) && 'data' in payload && payload['data'] !== undefined) {
    return payload['data'] as T;
  }
  return payload as T;
}

function extractCriteriaFromRun(run: V2EvaluationRunResponse): V2ResultDoc[] {
  if (Array.isArray(run.results)) {
    return run.results as V2ResultDoc[];
  }
  if (isRecord(run.results) && Array.isArray((run.results as { criteria?: unknown }).criteria)) {
    return (run.results as { criteria: V2ResultDoc[] }).criteria;
  }
  return [];
}

async function resolveProgramFromOrder(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
): Promise<{ programId: string; programVersion: string }> {
  const res = await getJson<OrderSummary | WrappedOrderResponse>(
    `${baseUrl}/api/orders/${encodeURIComponent(orderId)}`,
    authHeader,
  );
  if (res.status !== 200) {
    throw new Error(
      `GET /api/orders/${orderId} failed (${res.status}). Set AXIOM_LIVE_V2_PROGRAM_ID + AXIOM_LIVE_V2_PROGRAM_VERSION explicitly.`,
    );
  }
  const order: OrderSummary | undefined = isRecord(res.data) && 'data' in res.data
    ? (res.data as WrappedOrderResponse).data
    : (res.data as OrderSummary);

  const programId = order?.axiomProgramId?.trim();
  const programVersion = order?.axiomProgramVersion?.trim();

  if (!programId || !programVersion) {
    throw new Error(
      `Order ${orderId} has no axiomProgramId/axiomProgramVersion. ` +
      `Set AXIOM_LIVE_V2_PROGRAM_ID + AXIOM_LIVE_V2_PROGRAM_VERSION env vars to override.`,
    );
  }
  return { programId, programVersion };
}

// ── Main flow ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const overrideEnabled = isEnvTrue('AXIOM_LIVE_V2_RUN_OVERRIDE');
  const overrideVerdict = (optionalEnv('AXIOM_LIVE_V2_OVERRIDE_VERDICT') ?? 'pass').toLowerCase();

  if (!USER_OVERRIDABLE_VERDICTS.includes(overrideVerdict as UserOverridableVerdict)) {
    throw new Error(
      `AXIOM_LIVE_V2_OVERRIDE_VERDICT must be one of [${USER_OVERRIDABLE_VERDICTS.join('|')}], got '${overrideVerdict}'`,
    );
  }

  // Resolve programId/programVersion. Explicit env vars win; else read from order.
  let programId = optionalEnv('AXIOM_LIVE_V2_PROGRAM_ID');
  let programVersion = optionalEnv('AXIOM_LIVE_V2_PROGRAM_VERSION');
  if (!programId || !programVersion) {
    logSection('Resolving programId/programVersion from order');
    const resolved = await resolveProgramFromOrder(context.baseUrl, context.authHeader, orderId);
    programId = resolved.programId;
    programVersion = resolved.programVersion;
    console.log(`Resolved programId=${programId}, programVersion=${programVersion}`);
  }

  const schemaId = optionalEnv('AXIOM_LIVE_V2_SCHEMA_ID') ?? programId;
  const pollOptions = loadPollOptions();

  logConfig(context, {
    orderId,
    programId,
    programVersion,
    schemaId,
    overrideEnabled,
    overrideVerdict: overrideEnabled ? overrideVerdict : undefined,
    pollAttempts: pollOptions.attempts,
    pollIntervalMs: pollOptions.intervalMs,
  });

  // ── Step 1: POST /api/axiom/scopes/:scopeId/evaluate ─────────────────────
  logSection('Step 1: POST /api/axiom/scopes/:scopeId/evaluate');

  const evaluateUrl = `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/evaluate`;
  const evaluateBody = {
    programId,
    programVersion,
    schemaId,
  };
  console.log(`POST ${evaluateUrl}`);
  console.log(`Body: ${JSON.stringify(evaluateBody)}`);

  const evaluateRes = await postJson<unknown>(evaluateUrl, evaluateBody, context.authHeader);
  assertStatus(evaluateRes.status, [200, 201, 202], 'POST /scopes/:scopeId/evaluate', evaluateRes.data);

  const evaluatePayload = unwrapData<unknown>(evaluateRes.data);
  const evaluateRun = assertEvaluationRunResponse(evaluatePayload);

  const evaluationRunId = String(evaluateRun.evaluationRunId);
  const initialStatus = String(evaluateRun.status) as V2RunStatus;
  console.log(`✓ status=${evaluateRes.status}, evaluationRunId=${evaluationRunId}, runStatus=${initialStatus}`);

  // ── Step 2: GET /api/axiom/scopes/:scopeId/runs/:runId — poll to terminal ─
  logSection('Step 2: GET /api/axiom/scopes/:scopeId/runs/:runId (poll until terminal)');

  const runUrl = `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/runs/${encodeURIComponent(evaluationRunId)}`;
  console.log(`GET ${runUrl}`);

  let lastRun: V2EvaluationRunResponse | undefined;
  let lastStatus: V2RunStatus = initialStatus;

  if (V2_TERMINAL_STATUSES.has(initialStatus)) {
    // Sometimes evaluate returns a terminal status synchronously.
    lastRun = evaluateRun;
    console.log(`✓ Run already terminal at submit (status=${initialStatus}); skipping poll`);
  } else {
    for (let attempt = 1; attempt <= pollOptions.attempts; attempt += 1) {
      const runRes = await getJson<unknown>(runUrl, context.authHeader);
      assertStatus(runRes.status, [200], `GET /scopes/:scopeId/runs/:runId (attempt ${attempt})`, runRes.data);

      const payload = unwrapData<unknown>(runRes.data);
      const run = assertEvaluationRunResponse(payload);
      lastRun = run;
      lastStatus = String(run.status) as V2RunStatus;

      console.log(`  poll #${attempt}: status=${lastStatus}`);

      if (V2_TERMINAL_STATUSES.has(lastStatus)) break;
      await sleep(pollOptions.intervalMs);
    }

    if (!lastRun || !V2_TERMINAL_STATUSES.has(lastStatus)) {
      throw new Error(
        `Run ${evaluationRunId} did not reach terminal state within ${pollOptions.attempts} attempts (last=${lastStatus}). ` +
        `Increase AXIOM_LIVE_POLL_ATTEMPTS or investigate Axiom backlog.`,
      );
    }
  }

  console.log(`✓ Run terminal: status=${lastStatus}`);
  if (lastStatus === 'failed' || lastStatus === 'timed_out') {
    console.log(
      `⚠ Run ended in non-success status. Continuing to verify the rest of the surface but ` +
      `expect empty results below.`,
    );
  }

  const runCriteria = extractCriteriaFromRun(lastRun);
  console.log(`✓ Run carries ${runCriteria.length} result doc(s)`);

  // ── Step 3: GET /api/axiom/scopes/:scopeId/results?programId=… ───────────
  logSection('Step 3: GET /api/axiom/scopes/:scopeId/results?programId=…');

  const latestUrl = `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/results?programId=${encodeURIComponent(programId)}`;
  console.log(`GET ${latestUrl}`);

  const latestRes = await getJson<unknown>(latestUrl, context.authHeader);
  assertStatus(latestRes.status, [200], 'GET /scopes/:scopeId/results', latestRes.data);
  const latestPayload = unwrapData<unknown>(latestRes.data);
  const latest = assertLatestResultsResponse(latestPayload);
  const latestCriteria = (latest.results as V2ResultDoc[]) ?? [];
  console.log(`✓ ${latestCriteria.length} criteria in latest-results`);

  // Pick a criterion to use for history + override. Prefer one whose verdict is
  // user-overridable (pass/fail/needs_review) so we can exercise step 5 cleanly.
  const overrideCandidate =
    latestCriteria.find((c) => USER_OVERRIDABLE_VERDICTS.includes(c.evaluation as UserOverridableVerdict)) ??
    latestCriteria[0];

  if (!overrideCandidate) {
    console.log(
      '⚠ Latest results returned 0 criteria — skipping criterion-history + override checks.',
    );
    logSection('Done (with reduced coverage)');
    console.log('✓ All v2 endpoints reachable; latest-results was empty so steps 4–5 skipped.');
    return;
  }

  const candidateCriterionId = String(overrideCandidate.criterionId);
  const candidateResultId = String(overrideCandidate.resultId);
  const candidateCurrentVerdict = String(overrideCandidate.evaluation);

  console.log(
    `Selected candidate for steps 4–5: criterionId=${candidateCriterionId} ` +
    `(current verdict=${candidateCurrentVerdict}, resultId=${candidateResultId})`,
  );

  // ── Step 4: GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history ─
  logSection('Step 4: GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history');

  const historyUrl = `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/criteria/${encodeURIComponent(candidateCriterionId)}/history`;
  console.log(`GET ${historyUrl}`);

  const historyRes = await getJson<unknown>(historyUrl, context.authHeader);
  assertStatus(historyRes.status, [200], 'GET /scopes/:scopeId/criteria/:criterionId/history', historyRes.data);
  const historyPayload = unwrapData<unknown>(historyRes.data);
  const history = assertCriterionHistoryResponse(historyPayload);
  const historyDocs = history.history as V2ResultDoc[];
  console.log(`✓ ${historyDocs.length} history doc(s) for criterion ${candidateCriterionId}`);

  // ── Step 5 (optional): POST /override ────────────────────────────────────
  if (!overrideEnabled) {
    logSection('Step 5: SKIPPED (set AXIOM_LIVE_V2_RUN_OVERRIDE=true to exercise)');
    console.log(
      'Override step is destructive (writes a new EvaluationResultDoc + audit event). ' +
      'Run with AXIOM_LIVE_V2_RUN_OVERRIDE=true to include.',
    );
    logSection('Done');
    console.log('✅ v2 live-fire flow PASSED (steps 1–4)');
    return;
  }

  // Pick a different verdict to override TO; if env-supplied verdict matches the
  // current verdict, fail loudly because the override would be a no-op.
  if (overrideVerdict === candidateCurrentVerdict) {
    throw new Error(
      `AXIOM_LIVE_V2_OVERRIDE_VERDICT='${overrideVerdict}' matches the candidate's current verdict ('${candidateCurrentVerdict}'). ` +
      `Set AXIOM_LIVE_V2_OVERRIDE_VERDICT to something different (or unset to default 'pass').`,
    );
  }

  logSection('Step 5: POST /api/axiom/scopes/:scopeId/criteria/:criterionId/override');

  const overrideUrl = `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/criteria/${encodeURIComponent(candidateCriterionId)}/override`;
  const overrideBody = {
    supersedes: candidateResultId,
    verdict: overrideVerdict,
    reasoning: `Live-fire test override (${new Date().toISOString()})`,
    overriddenBy: 'axiom-live-fire-v2-flow',
    overrideReason: 'Live-fire smoke test',
    engagementId: `livefire-engagement-${Date.now()}`,
  };
  console.log(`POST ${overrideUrl}`);
  console.log(`Body: ${JSON.stringify(overrideBody)}`);

  const overrideRes = await postJson<unknown>(overrideUrl, overrideBody, context.authHeader);
  assertStatus(
    overrideRes.status,
    [200, 201],
    'POST /scopes/:scopeId/criteria/:criterionId/override',
    overrideRes.data,
  );
  const overridePayload = unwrapData<unknown>(overrideRes.data);
  const overrideDoc = assertResultDoc(overridePayload, 'override.response');

  // The new doc must be a manual override that supersedes the candidate.
  if (overrideDoc.manualOverride !== true) {
    throw new Error(
      `Contract violation: override response must have manualOverride=true (got ${JSON.stringify(overrideDoc.manualOverride)})`,
    );
  }
  if (overrideDoc.evaluatedBy !== 'human-override') {
    throw new Error(
      `Contract violation: override response must have evaluatedBy='human-override' (got ${JSON.stringify(overrideDoc.evaluatedBy)})`,
    );
  }
  if (overrideDoc.supersedes !== candidateResultId) {
    throw new Error(
      `Contract violation: override.supersedes must equal supplied resultId. Sent ${candidateResultId}, got ${JSON.stringify(overrideDoc.supersedes)}`,
    );
  }
  if (overrideDoc.evaluation !== overrideVerdict) {
    throw new Error(
      `Contract violation: override.evaluation must equal supplied verdict. Sent ${overrideVerdict}, got ${JSON.stringify(overrideDoc.evaluation)}`,
    );
  }

  console.log(
    `✓ Override created: resultId=${overrideDoc.resultId}, ` +
    `evaluation=${overrideDoc.evaluation}, manualOverride=true, supersedes=${overrideDoc.supersedes}`,
  );

  // Verify the override appears in the criterion history.
  logSection('Step 5b: Verify override appears in criterion history');

  const historyAfterRes = await getJson<unknown>(historyUrl, context.authHeader);
  assertStatus(historyAfterRes.status, [200], 'GET /history (post-override)', historyAfterRes.data);
  const historyAfterPayload = unwrapData<unknown>(historyAfterRes.data);
  const historyAfter = assertCriterionHistoryResponse(historyAfterPayload);
  const historyAfterDocs = historyAfter.history as V2ResultDoc[];
  const overrideInHistory = historyAfterDocs.find((d) => d.resultId === overrideDoc.resultId);
  if (!overrideInHistory) {
    throw new Error(
      `Contract violation: newly-created override doc (resultId=${overrideDoc.resultId}) ` +
      `not found in criterion history. History has ${historyAfterDocs.length} entries.`,
    );
  }
  console.log(`✓ Override present in history (history now has ${historyAfterDocs.length} entries)`);

  logSection('Done');
  console.log('✅ v2 live-fire flow PASSED (all 5 steps + history-after-override verification)');
}

main().catch((error) => {
  console.error(`\n❌ v2 live-fire flow FAILED: ${(error as Error).message}`);
  if ((error as Error).stack) {
    console.error((error as Error).stack);
  }
  process.exit(1);
});
