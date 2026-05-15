#!/usr/bin/env tsx
/**
 * Axiom full-pipeline live-fire suite.
 *
 * The single, atomic "did the v2 contract still produce real, grounded
 * verdicts after every change in the chain?" regression gate. Runs the
 * complete extraction → envelope → criteria → render → timeline path
 * end-to-end against deployed staging, with cross-step assertions that
 * catch the failure modes the component suites miss.
 *
 * Why this exists
 * ───────────────
 * The component suites (v2-flow, canonical-suite, review-program-suite,
 * ui-parity) each prove one slice. They don't share state and don't
 * assert that "the criteria we just evaluated were grounded in the
 * extraction we just ran." That gap let us ship a v2 contract that
 * round-tripped cleanly but produced 33 × cannot_evaluate verdicts on
 * every run — technically correct, materially useless.
 *
 * This suite chains the steps with explicit data-flow assertions:
 *   1. POST /api/runs/extraction         → fresh extraction run
 *   2. Poll until status=completed
 *   3. GET /api/runs/:runId/snapshot     → canonical snapshot
 *   4. ASSERT normalizedData.canonical (or .extraction) is non-empty
 *   5. POST /api/axiom/scopes/:scopeId/evaluate
 *   6. ASSERT v2 response shape + at least one non-cannot_evaluate verdict
 *   7. ASSERT dataConsulted on at least one criterion is non-empty
 *      (i.e. the envelope assembler DID flow extraction data through)
 *   8. GET /api/orders/:scopeId          → ASSERT axiomStatus=completed
 *      + axiomCompletedAt is set
 *   9. GET /api/orders/:scopeId/timeline → ASSERT AXIOM_COMPLETED audit
 *      event landed
 *  10. GET /api/axiom/scopes/:scopeId/results → ASSERT same criteria set
 *  11. GET /api/axiom/scopes/:scopeId/criteria/:cid/history → non-empty
 *
 * Required env (in addition to the base set in _axiom-live-fire-common.ts):
 *   AXIOM_LIVE_BASE_URL
 *   AXIOM_LIVE_TENANT_ID
 *   AXIOM_LIVE_CLIENT_ID
 *   AXIOM_LIVE_ORDER_ID                  scopeId / orderId
 *   AXIOM_LIVE_DOCUMENT_ID               document to extract
 *
 * Optional env:
 *   AXIOM_LIVE_V2_PROGRAM_ID             else falls back to order.axiomProgramId
 *   AXIOM_LIVE_V2_PROGRAM_VERSION        else falls back to order.axiomProgramVersion
 *   AXIOM_LIVE_V2_SCHEMA_ID              defaults to programId
 *   AXIOM_LIVE_SCHEMA_CLIENT_ID          defaults to AXIOM_LIVE_CLIENT_ID
 *   AXIOM_LIVE_SCHEMA_SUB_CLIENT_ID      defaults to 'default-sub-client'
 *   AXIOM_LIVE_SCHEMA_DOCUMENT_TYPE      defaults to 'APPRAISAL'
 *   AXIOM_LIVE_SCHEMA_VERSION            defaults to '1.0.0'
 *   AXIOM_LIVE_POLL_ATTEMPTS             default 60 (extractions can take minutes)
 *   AXIOM_LIVE_POLL_INTERVAL_MS          default 5000
 *
 * Auth: same as other live-fire scripts.
 *
 * Run: `pnpm axiom:livefire:full-pipeline`
 */

import { randomUUID } from 'crypto';
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

// ─── Types (mirror just what we touch — keep loose for forward-compat) ─────

type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface RunLedgerRecord {
  id: string;
  runType: 'extraction' | 'criteria' | 'criteria-step';
  status: RunStatus;
  canonicalSnapshotId?: string;
  snapshotId?: string;
  statusDetails?: Record<string, unknown>;
}

interface RunEnvelope {
  success: boolean;
  data?: RunLedgerRecord;
  error?: { message?: string; code?: string };
}

interface SnapshotEnvelope {
  success: boolean;
  data?: {
    id: string;
    normalizedDataRef?: string;
    normalizedData?: {
      canonical?: Record<string, unknown>;
      subjectProperty?: Record<string, unknown>;
      extraction?: Record<string, unknown>;
      providerData?: Record<string, unknown>;
      provenance?: Record<string, unknown>;
    };
    sourceRefs?: unknown[];
  };
}

interface OrderEnvelope {
  success?: boolean;
  data?: {
    id?: string;
    axiomStatus?: string;
    axiomCompletedAt?: string;
    axiomProgramId?: string;
    axiomProgramVersion?: string;
    axiomRiskScore?: number;
    axiomDecision?: string;
  };
}

interface V2EvaluateEnvelope {
  success: boolean;
  data?: {
    evaluationRunId: string;
    scopeId: string;
    programId: string;
    programVersion: string;
    status: 'processing' | 'completed' | 'failed' | 'timed_out';
    evaluatedAt: string;
    results: V2ResultDoc[];
    totalCriteria?: number;
    passed?: number;
    failed?: number;
    needsReview?: number;
    cannotEvaluate?: number;
    notApplicable?: number;
  };
  error?: { code?: string; message?: string };
}

interface V2ResultDoc {
  resultId?: string;
  evaluationRunId?: string;
  criterionId?: string;
  criterionName?: string;
  evaluation?: string;
  confidence?: number;
  reasoning?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  manualOverride?: boolean;
  criterionSnapshot?: unknown;
  dataConsulted?: Record<string, unknown>;
}

interface LatestResultsEnvelope {
  success?: boolean;
  data?: { scopeId?: string; programId?: string; results?: V2ResultDoc[]; asOf?: string };
}

interface CriterionHistoryEnvelope {
  success?: boolean;
  data?: { scopeId?: string; criterionId?: string; history?: V2ResultDoc[] };
}

interface OrderTimelineEnvelope {
  orderId?: string;
  events?: Array<{ timestamp?: string; eventType?: string; actor?: string; details?: Record<string, unknown> }>;
}

// ─── Env helpers ───────────────────────────────────────────────────────────

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function requiredEnv(name: string): string {
  const v = optionalEnv(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function requestHeaders(tag: string): Record<string, string> {
  const key = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${key}`,
    'X-Correlation-Id': `livefire-fullpipe:${tag}:${key}`,
  };
}

function basePollAttempts(): number {
  // Extraction can take several minutes when the pipeline is cold.
  // 60 attempts × 5s = 5 min ceiling — enough for normal completions
  // without making "stuck" runs invisible for hours.
  return Number(optionalEnv('AXIOM_LIVE_POLL_ATTEMPTS') ?? '60');
}

function basePollIntervalMs(): number {
  return Number(optionalEnv('AXIOM_LIVE_POLL_INTERVAL_MS') ?? '5000');
}

// ─── Cross-step assertions ────────────────────────────────────────────────

/**
 * The single most important assertion in this suite. After extraction
 * completes, the snapshot's `normalizedData` MUST have substantive content
 * in at least one of its projections — otherwise everything downstream
 * (envelope assembler, criteria evaluator) is operating on empty inputs.
 *
 * "Substantive" = ≥1 key in canonical/extraction/subjectProperty, OR ≥1
 * source ref attached. An all-empty snapshot indicates the extraction
 * pipeline returned 200 but produced no actual output — the most insidious
 * silent-failure mode of the chain.
 */
function assertSubstantiveSnapshot(snap: NonNullable<SnapshotEnvelope['data']>): void {
  const nd = snap.normalizedData ?? {};
  const canonicalKeys = nd.canonical ? Object.keys(nd.canonical).length : 0;
  const extractionKeys = nd.extraction ? Object.keys(nd.extraction).length : 0;
  const subjectKeys = nd.subjectProperty ? Object.keys(nd.subjectProperty).length : 0;
  const sourceRefs = Array.isArray(snap.sourceRefs) ? snap.sourceRefs.length : 0;

  console.log(`  → snapshot.normalizedData.canonical keys = ${canonicalKeys}`);
  console.log(`  → snapshot.normalizedData.extraction keys = ${extractionKeys}`);
  console.log(`  → snapshot.normalizedData.subjectProperty keys = ${subjectKeys}`);
  console.log(`  → snapshot.sourceRefs count = ${sourceRefs}`);

  if (canonicalKeys + extractionKeys + subjectKeys + sourceRefs === 0) {
    throw new Error(
      `Snapshot ${snap.id} is empty across canonical/extraction/subjectProperty/sourceRefs. ` +
      'The extraction pipeline reported success but produced no usable data — ' +
      'downstream criteria evaluation would see an empty envelope.',
    );
  }
}

/**
 * Strict v2 response shape (mirrors what the FE's `normalizeEvaluationResponse`
 * enforces — keep these aligned). Fails loudly on the contract gaps that
 * cost us four round-trips with the Axiom AI to fix earlier in the week.
 */
function assertV2ResultDoc(doc: V2ResultDoc, where: string): void {
  if (!doc.resultId || typeof doc.resultId !== 'string') throw new Error(`${where}.resultId required`);
  if (!doc.evaluationRunId || typeof doc.evaluationRunId !== 'string') throw new Error(`${where}.evaluationRunId required`);
  if (!doc.criterionId || typeof doc.criterionId !== 'string') throw new Error(`${where}.criterionId required`);
  if (!doc.criterionName || typeof doc.criterionName !== 'string') throw new Error(`${where}.criterionName required`);
  const validVerdicts = ['pass', 'fail', 'needs_review', 'cannot_evaluate', 'not_applicable'];
  if (!validVerdicts.includes(String(doc.evaluation))) {
    throw new Error(`${where}.evaluation must be a v2 enum value; got ${JSON.stringify(doc.evaluation)}`);
  }
  if (typeof doc.confidence !== 'number' || !Number.isFinite(doc.confidence)) {
    throw new Error(`${where}.confidence must be a finite number`);
  }
  if (typeof doc.reasoning !== 'string') throw new Error(`${where}.reasoning required`);
  if (typeof doc.manualOverride !== 'boolean') throw new Error(`${where}.manualOverride must be boolean`);
  if (!isRecord(doc.criterionSnapshot)) throw new Error(`${where}.criterionSnapshot must be an object`);
  if (!isRecord(doc.dataConsulted)) throw new Error(`${where}.dataConsulted must be a path-keyed object`);
}

/**
 * The MATERIAL assertion: did the envelope assembler actually flow the
 * extraction data through to the criteria evaluator?
 *
 * If every criterion reports `cannot_evaluate`, the envelope was empty
 * (or all criteria's `dataRequirements` aren't satisfied by what's in the
 * snapshot). Either way it means the chain is technically working but
 * producing useless output. Surface that loudly rather than silently
 * passing.
 */
function assertGroundedVerdicts(results: V2ResultDoc[], summary: NonNullable<V2EvaluateEnvelope['data']>): void {
  const groundedCount = results.filter((r) =>
    r.evaluation === 'pass' || r.evaluation === 'fail' || r.evaluation === 'needs_review',
  ).length;
  const cannotEvaluateCount = results.filter((r) => r.evaluation === 'cannot_evaluate').length;
  const dataConsultedNonEmpty = results.filter((r) => isRecord(r.dataConsulted) && Object.keys(r.dataConsulted).length > 0).length;

  console.log(`  → grounded verdicts (pass/fail/needs_review): ${groundedCount} / ${results.length}`);
  console.log(`  → cannot_evaluate verdicts: ${cannotEvaluateCount} / ${results.length}`);
  console.log(`  → criteria with non-empty dataConsulted: ${dataConsultedNonEmpty} / ${results.length}`);
  console.log(`  → summary counts: pass=${summary.passed} fail=${summary.failed} needs_review=${summary.needsReview} cannot_evaluate=${summary.cannotEvaluate}`);

  if (groundedCount === 0) {
    throw new Error(
      `All ${results.length} criteria resolved to cannot_evaluate or not_applicable. ` +
      'The envelope assembler did not flow extraction data through — the chain is ' +
      'round-tripping but produces no usable output. Check (a) snapshot has data and ' +
      '(b) the envelope path-keys match what the criteria dataRequirements reference.',
    );
  }
  if (dataConsultedNonEmpty === 0) {
    throw new Error(
      `No criterion has any entry in its dataConsulted map. Axiom did not read any ` +
      'paths from the envelope — either the envelope was empty or the criteria ' +
      'reference paths the envelope does not provide.',
    );
  }
}

// ─── Main pipeline ─────────────────────────────────────────────────────────

async function pollRunToTerminal(
  baseUrl: string,
  authHeader: Record<string, string>,
  runId: string,
  attempts: number,
  intervalMs: number,
): Promise<RunLedgerRecord> {
  let last: RunLedgerRecord | undefined;
  for (let i = 1; i <= attempts; i += 1) {
    // Trigger a status refresh first — extraction-runs in the run-ledger
    // may not auto-poll Axiom for status; the refresh endpoint forces a
    // sync.
    await postJson<RunEnvelope>(
      `${baseUrl}/api/runs/${encodeURIComponent(runId)}/refresh-status`,
      {},
      authHeader,
    ).catch(() => undefined); // refresh is best-effort

    const res = await getJson<RunEnvelope>(`${baseUrl}/api/runs/${encodeURIComponent(runId)}`, authHeader);
    assertStatus(res.status, [200], `poll run ${runId}`, res.data);
    last = res.data.data;
    if (!last) throw new Error(`Run ${runId} returned no data payload`);

    console.log(`  … run ${runId} status=${last.status} (attempt ${i}/${attempts})`);
    if (last.status === 'completed' || last.status === 'failed' || last.status === 'cancelled') {
      return last;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Run ${runId} did not reach a terminal status within ${attempts} attempts`);
}

async function resolveProgramFromOrder(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
): Promise<{ programId: string; programVersion: string }> {
  const overrideId = optionalEnv('AXIOM_LIVE_V2_PROGRAM_ID');
  const overrideVer = optionalEnv('AXIOM_LIVE_V2_PROGRAM_VERSION');
  if (overrideId && overrideVer) return { programId: overrideId, programVersion: overrideVer };

  const res = await getJson<OrderEnvelope>(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`, authHeader);
  assertStatus(res.status, [200], 'fetch order for programId resolution', res.data);
  const order = res.data?.data;
  const programId = overrideId ?? order?.axiomProgramId;
  const programVersion = overrideVer ?? order?.axiomProgramVersion;
  if (!programId || !programVersion) {
    throw new Error(
      `Cannot resolve programId/programVersion. ` +
      `Set AXIOM_LIVE_V2_PROGRAM_ID + AXIOM_LIVE_V2_PROGRAM_VERSION, or set them on the order.`,
    );
  }
  return { programId, programVersion };
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const _base = loadPollOptions();
  const pollAttempts = Math.max(_base.attempts, basePollAttempts());
  const pollIntervalMs = Math.max(_base.intervalMs, basePollIntervalMs());

  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const documentId = requiredEnv('AXIOM_LIVE_DOCUMENT_ID');
  const { programId, programVersion } = await resolveProgramFromOrder(context.baseUrl, context.authHeader, orderId);
  const schemaId = optionalEnv('AXIOM_LIVE_V2_SCHEMA_ID') ?? programId;

  logConfig(context, {
    orderId,
    documentId,
    programId,
    programVersion,
    schemaId,
    pollAttempts,
    pollIntervalMs,
  });

  // ── Step 1 — kick off extraction ───────────────────────────────────────
  logSection('Step 1 — POST /api/runs/extraction');
  // Defaults match Axiom's `document-types` registry seed on staging
  // (see axiom/seed-data/document-types/*-registry.json — every entry uses
  // clientId=test-client / subClientId=test-tenant / kebab-case documentType).
  // Sending the platform-side clientId here would fail with
  // [missing-document-types] because Axiom's registry does NOT key on the
  // platform's customer ids — it keys on its own seeded test-client /
  // test-tenant pair until real per-tenant registries are stood up.
  const schemaClientId = optionalEnv('AXIOM_LIVE_SCHEMA_CLIENT_ID') ?? 'test-client';
  const schemaSubClientId = optionalEnv('AXIOM_LIVE_SCHEMA_SUB_CLIENT_ID') ?? 'test-tenant';
  const schemaDocumentType = optionalEnv('AXIOM_LIVE_SCHEMA_DOCUMENT_TYPE') ?? 'uniform-residential-appraisal-report';
  const schemaVersion = optionalEnv('AXIOM_LIVE_SCHEMA_VERSION') ?? '1.0.0';

  const createRes = await postJson<RunEnvelope>(
    `${context.baseUrl}/api/runs/extraction`,
    {
      documentId,
      runReason: 'LIVE_FIRE_FULL_PIPELINE',
      schemaKey: {
        clientId: schemaClientId,
        subClientId: schemaSubClientId,
        documentType: schemaDocumentType,
        version: schemaVersion,
      },
      engineTarget: 'AXIOM',
      loanPropertyContextId: orderId,
    },
    context.authHeader,
    requestHeaders('extraction'),
  );
  assertStatus(createRes.status, [202], 'create extraction run', createRes.data);
  const extractionRunId = createRes.data?.data?.id;
  if (!extractionRunId) throw new Error(`Extraction submission response missing run id: ${JSON.stringify(createRes.data)}`);
  console.log(`✓ extractionRunId=${extractionRunId}`);

  // ── Step 2 — poll to completed ─────────────────────────────────────────
  logSection('Step 2 — poll extraction run until terminal');
  const extractionRun = await pollRunToTerminal(context.baseUrl, context.authHeader, extractionRunId, pollAttempts, pollIntervalMs);
  if (extractionRun.status !== 'completed') {
    throw new Error(`Extraction ended in ${extractionRun.status}, not completed. ` +
      `statusDetails=${JSON.stringify(extractionRun.statusDetails ?? {})}`);
  }
  console.log(`✓ extraction completed, canonicalSnapshotId=${extractionRun.canonicalSnapshotId ?? extractionRun.snapshotId ?? '(none)'}`);

  // ── Step 3-4 — snapshot must carry substantive data ────────────────────
  logSection('Step 3 — GET /api/runs/:runId/snapshot + assert substantive');
  const snapRes = await getJson<SnapshotEnvelope>(
    `${context.baseUrl}/api/runs/${encodeURIComponent(extractionRunId)}/snapshot`,
    context.authHeader,
  );
  assertStatus(snapRes.status, [200], 'fetch extraction snapshot', snapRes.data);
  if (!snapRes.data?.success || !snapRes.data?.data) {
    throw new Error(`Snapshot endpoint returned success=false: ${JSON.stringify(snapRes.data)}`);
  }
  assertSubstantiveSnapshot(snapRes.data.data);
  console.log(`✓ snapshot ${snapRes.data.data.id} carries substantive normalizedData`);

  // ── Step 5 — v2 evaluate ───────────────────────────────────────────────
  logSection('Step 5 — POST /api/axiom/scopes/:scopeId/evaluate');
  const evalRes = await postJson<V2EvaluateEnvelope>(
    `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/evaluate`,
    { programId, programVersion, schemaId },
    context.authHeader,
    requestHeaders('evaluate'),
  );
  assertStatus(evalRes.status, [200, 201, 202], 'v2 evaluate', evalRes.data);
  if (!evalRes.data?.success || !evalRes.data?.data) {
    throw new Error(`v2 evaluate returned success=false: ${JSON.stringify(evalRes.data)}`);
  }
  const summary = evalRes.data.data;
  console.log(`✓ evaluationRunId=${summary.evaluationRunId} status=${summary.status} totalCriteria=${summary.totalCriteria ?? summary.results.length}`);

  // ── Step 6 — v2 contract shape ─────────────────────────────────────────
  logSection('Step 6 — assert v2 contract shape on every result');
  if (summary.results.length === 0) {
    throw new Error('v2 evaluate returned zero criteria — program has no criteria, or extraction snapshot is unreachable');
  }
  summary.results.forEach((r, i) => assertV2ResultDoc(r, `results[${i}]`));
  console.log(`✓ all ${summary.results.length} result docs match v2 contract`);

  // ── Step 7-8 — grounded verdicts + dataConsulted non-empty ─────────────
  logSection('Step 7 — assert at least one grounded verdict + dataConsulted non-empty');
  assertGroundedVerdicts(summary.results, summary);
  console.log(`✓ envelope-flow assertion passed`);

  // ── Step 9 — order is stamped ──────────────────────────────────────────
  logSection('Step 9 — GET /api/orders/:scopeId — assert axiomStatus stamping');
  const orderRes = await getJson<OrderEnvelope>(`${context.baseUrl}/api/orders/${encodeURIComponent(orderId)}`, context.authHeader);
  assertStatus(orderRes.status, [200], 'fetch order to verify stamping', orderRes.data);
  const order = orderRes.data?.data;
  if (order?.axiomStatus !== 'completed') {
    throw new Error(`Expected order.axiomStatus = 'completed' after v2 evaluate, got ${JSON.stringify(order?.axiomStatus)}`);
  }
  if (!order?.axiomCompletedAt) {
    throw new Error(`Expected order.axiomCompletedAt to be stamped, got ${JSON.stringify(order?.axiomCompletedAt)}`);
  }
  console.log(`✓ order stamped: axiomStatus=${order.axiomStatus} axiomCompletedAt=${order.axiomCompletedAt}`);

  // ── Step 10 — AXIOM_COMPLETED lifecycle event landed ───────────────────
  logSection('Step 10 — GET /api/orders/:id/timeline — assert AXIOM_COMPLETED audit event');
  const timelineRes = await getJson<OrderTimelineEnvelope>(`${context.baseUrl}/api/orders/${encodeURIComponent(orderId)}/timeline`, context.authHeader);
  assertStatus(timelineRes.status, [200], 'fetch order timeline', timelineRes.data);
  const events = timelineRes.data?.events ?? [];
  const axiomCompletedEvents = events.filter((e) => e.eventType === 'AXIOM_COMPLETED');
  if (axiomCompletedEvents.length === 0) {
    throw new Error(
      `Order timeline does not contain any AXIOM_COMPLETED audit event after v2 evaluate. ` +
      `Either the audit-trail write was skipped or AuditTrailService is mis-wired. ` +
      `Timeline contained ${events.length} events; types: ${[...new Set(events.map((e) => e.eventType))].join(', ')}`,
    );
  }
  console.log(`✓ timeline contains ${axiomCompletedEvents.length} AXIOM_COMPLETED event(s)`);

  // ── Step 11 — latest-results returns same criteria ─────────────────────
  logSection('Step 11 — GET /api/axiom/scopes/:scopeId/results — assert same criteria set');
  const latestRes = await getJson<LatestResultsEnvelope>(
    `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/results?programId=${encodeURIComponent(programId)}`,
    context.authHeader,
  );
  assertStatus(latestRes.status, [200], 'fetch latest results', latestRes.data);
  const latest = latestRes.data?.data?.results ?? [];
  if (latest.length === 0) {
    throw new Error('Latest-results returned zero criteria after v2 evaluate just produced results');
  }
  latest.forEach((r, i) => assertV2ResultDoc(r, `latestResults[${i}]`));
  console.log(`✓ latest-results returns ${latest.length} criteria, all v2-shape`);

  // ── Step 12 — criterion history sanity check ───────────────────────────
  logSection('Step 12 — GET /api/axiom/scopes/:scopeId/criteria/:cid/history');
  const probeCriterionId = latest[0]?.criterionId;
  if (!probeCriterionId) throw new Error('Latest-results returned a criterion without criterionId');
  const historyRes = await getJson<CriterionHistoryEnvelope>(
    `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/criteria/${encodeURIComponent(probeCriterionId)}/history`,
    context.authHeader,
  );
  assertStatus(historyRes.status, [200], 'fetch criterion history', historyRes.data);
  const history = historyRes.data?.data?.history ?? [];
  if (history.length === 0) throw new Error(`Criterion history for '${probeCriterionId}' returned no rows`);
  history.forEach((r, i) => assertV2ResultDoc(r, `history[${i}]`));
  console.log(`✓ criterion history returns ${history.length} row(s), all v2-shape`);

  // ── Done ───────────────────────────────────────────────────────────────
  console.log('\n✅ Full-pipeline live-fire suite PASSED');
  console.log(`   extractionRunId=${extractionRunId}`);
  console.log(`   evaluationRunId=${summary.evaluationRunId}`);
  console.log(`   orderId=${orderId} axiomStatus=${order.axiomStatus}`);
  console.log(`   grounded verdicts in summary: pass=${summary.passed ?? '?'} fail=${summary.failed ?? '?'} needs_review=${summary.needsReview ?? '?'}`);
}

main().catch((error) => {
  console.error(`\n❌ Full-pipeline live-fire suite FAILED: ${(error as Error).message}`);
  if ((error as Error).stack) console.error((error as Error).stack);
  process.exit(1);
});
