#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import path from 'path';
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
  resolveLiveFirePath,
  sleep,
} from './_axiom-live-fire-common.js';

type EvaluationMode = 'EXTRACTION' | 'CRITERIA_EVALUATION' | 'COMPLETE_EVALUATION';
type SubmissionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type StreamStatus = 'queued' | 'streaming' | 'completed' | 'failed';
type Verdict = 'pass' | 'fail' | 'needs_review' | 'cannot_evaluate' | 'not_applicable';

interface SubmitEnvelope {
  success: boolean;
  data?: {
    submissionId: string;
    analysisType: 'DOCUMENT_ANALYZE';
    status: SubmissionStatus;
    provider: 'AXIOM';
    evaluationId?: string;
    pipelineJobId?: string;
  };
  error?: { message?: string; code?: string };
}

interface SubmissionGetEnvelope extends SubmitEnvelope {}

interface OrderEnvelope {
  success?: boolean;
  data?: {
    id?: string;
    orderId?: string;
    axiomProgramId?: string;
    axiomProgramVersion?: string;
    clientId?: string;
    tenantId?: string;
  };
}

interface LatestResultDoc {
  resultId?: string;
  evaluationRunId?: string;
  criterionId?: string;
  criterionName?: string;
  evaluation?: string;
  confidence?: number;
  reasoning?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  manualOverride?: boolean;
  criterionSnapshot?: unknown;
  dataConsulted?: unknown;
}

interface LatestResultsEnvelope {
  success?: boolean;
  data?: {
    scopeId?: string;
    programId?: string;
    results?: LatestResultDoc[];
    asOf?: string;
  };
}

interface CriterionHistoryEnvelope {
  success?: boolean;
  data?: {
    scopeId?: string;
    criterionId?: string;
    history?: LatestResultDoc[];
  };
}

interface StreamObservation {
  label: string;
  status: StreamStatus;
  payload: unknown;
  receivedAt: string;
}

interface SuiteSummary {
  submissionId: string;
  evaluationId: string;
  pipelineJobId?: string;
  evaluationMode: EvaluationMode;
  streamId: string;
  streamEventCount: number;
  finalSubmissionStatus: SubmissionStatus;
  latestResultsCount?: number;
  criterionHistoryCount?: number;
  artifactDir: string;
}

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

function requestHeaders(tag: string): Record<string, string> {
  const key = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${key}`,
    'X-Correlation-Id': `ui-${tag}:${key}`,
  };
}

function parseEvaluationMode(): EvaluationMode {
  const raw = (optionalEnv('AXIOM_LIVE_EVALUATION_MODE') ?? 'COMPLETE_EVALUATION').trim().toUpperCase();
  if (raw === 'EXTRACTION' || raw === 'CRITERIA_EVALUATION' || raw === 'COMPLETE_EVALUATION') {
    return raw;
  }
  throw new Error(
    `Invalid AXIOM_LIVE_EVALUATION_MODE '${raw}'. Expected EXTRACTION, CRITERIA_EVALUATION, or COMPLETE_EVALUATION.`,
  );
}

function normalizePollAttempts(baseAttempts: number, evaluationMode: EvaluationMode): number {
  const minimumAttempts =
    evaluationMode === 'COMPLETE_EVALUATION'
      ? 50
      : evaluationMode === 'CRITERIA_EVALUATION'
        ? 35
        : 20;

  return Math.max(baseAttempts, minimumAttempts);
}

function streamTimeoutMs(): number {
  const raw = optionalEnv('AXIOM_LIVE_SSE_TIMEOUT_MS');
  if (!raw) return 120_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`AXIOM_LIVE_SSE_TIMEOUT_MS must be a positive number. Got: ${raw}`);
  }
  return parsed;
}

function artifactDirFor(orderId: string): string {
  const configured = optionalEnv('AXIOM_LIVE_ARTIFACT_DIR');
  if (configured) {
    return resolveLiveFirePath(configured, 'AXIOM_LIVE_ARTIFACT_DIR');
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(process.cwd(), 'test-artifacts/live-fire/axiom-canonical-suite', `${stamp}-${orderId}`);
}

function formatStreamEventLabel(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'stream-event';
  const rec = payload as Record<string, unknown>;
  const stage = typeof rec.stage === 'string' ? rec.stage : undefined;
  const eventType = typeof rec.eventType === 'string' ? rec.eventType : undefined;
  const status = typeof rec.status === 'string' ? rec.status : undefined;
  const message = typeof rec.message === 'string' ? rec.message : undefined;

  if (stage && eventType) return `${stage}: ${eventType}`;
  if (stage && status) return `${stage}: ${status}`;
  if (eventType) return eventType;
  if (status) return status;
  if (message) return message;
  return 'stream-event';
}

function parseStreamStatus(payload: unknown): { status: StreamStatus; message: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const raw = String(
    record.status ??
    record.state ??
    record.eventType ??
    record.type ??
    '',
  ).toLowerCase();

  if (!raw) return null;
  if (raw.includes('fail') || raw.includes('error') || raw.includes('cancel')) {
    return { status: 'failed', message: raw };
  }
  if (raw.includes('complete') || raw.includes('succeed') || raw.includes('finished')) {
    return { status: 'completed', message: raw };
  }
  if (raw.includes('queue')) {
    return { status: 'queued', message: raw };
  }
  return { status: 'streaming', message: raw };
}

function assertVerdict(value: unknown, field: string): Verdict {
  if (value === 'warning' || value === 'info') {
    throw new Error(`${field} returned legacy verdict '${String(value)}'. Expected v2 verdicts only.`);
  }
  if (
    value !== 'pass' &&
    value !== 'fail' &&
    value !== 'needs_review' &&
    value !== 'cannot_evaluate' &&
    value !== 'not_applicable'
  ) {
    throw new Error(`${field} must be one of pass|fail|needs_review|cannot_evaluate|not_applicable. Got ${JSON.stringify(value)}`);
  }
  return value;
}

function assertLatestResultDoc(doc: LatestResultDoc, fieldPrefix: string): void {
  if (!doc.resultId || typeof doc.resultId !== 'string') {
    throw new Error(`${fieldPrefix}.resultId is required.`);
  }
  if (!doc.evaluationRunId || typeof doc.evaluationRunId !== 'string') {
    throw new Error(`${fieldPrefix}.evaluationRunId is required.`);
  }
  if (!doc.criterionId || typeof doc.criterionId !== 'string') {
    throw new Error(`${fieldPrefix}.criterionId is required.`);
  }
  if (!doc.criterionName || typeof doc.criterionName !== 'string') {
    throw new Error(`${fieldPrefix}.criterionName is required.`);
  }
  assertVerdict(doc.evaluation, `${fieldPrefix}.evaluation`);
  if (typeof doc.confidence !== 'number' || !Number.isFinite(doc.confidence)) {
    throw new Error(`${fieldPrefix}.confidence must be a finite number.`);
  }
  if (typeof doc.reasoning !== 'string' || doc.reasoning.trim().length === 0) {
    throw new Error(`${fieldPrefix}.reasoning is required.`);
  }
  if (typeof doc.evaluatedAt !== 'string' || doc.evaluatedAt.trim().length === 0) {
    throw new Error(`${fieldPrefix}.evaluatedAt is required.`);
  }
  if (typeof doc.manualOverride !== 'boolean') {
    throw new Error(`${fieldPrefix}.manualOverride must be boolean.`);
  }
  if (!isRecord(doc.criterionSnapshot)) {
    throw new Error(`${fieldPrefix}.criterionSnapshot must be an object.`);
  }
  if (!isRecord(doc.dataConsulted)) {
    throw new Error(`${fieldPrefix}.dataConsulted must be an object.`);
  }
}

async function openDocumentStream(
  url: string,
  authHeader: Record<string, string>,
  timeoutMs: number,
): Promise<StreamObservation[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events: StreamObservation[] = [];

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...authHeader,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const body = await response.text();
      throw new Error(`Document stream failed with HTTP ${response.status}: ${body}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n');
      buffer = chunks.pop() ?? '';

      for (const line of chunks) {
        if (!line.startsWith('data:')) continue;
        const rawData = line.slice(5).trim();
        if (!rawData || rawData === '[DONE]') continue;

        let parsed: unknown = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          parsed = rawData;
        }

        const parsedStatus = parseStreamStatus(parsed);
        const observation: StreamObservation = {
          label: formatStreamEventLabel(parsed),
          status: parsedStatus?.status ?? 'streaming',
          payload: parsed,
          receivedAt: new Date().toISOString(),
        };
        events.push(observation);
        console.log(`… stream ${observation.status}: ${observation.label}`);

        if (observation.status === 'completed' || observation.status === 'failed') {
          controller.abort();
          break;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('abort')) {
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }

  return events;
}

async function writeArtifact(artifactDir: string, fileName: string, payload: unknown): Promise<void> {
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

async function resolveProgramFromOrder(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
): Promise<{ programId: string; programVersion: string }> {
  const res = await getJson<OrderEnvelope>(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`, authHeader);
  assertStatus(res.status, [200], 'get order for program resolution', res.data);

  const order = isRecord(res.data) && isRecord(res.data.data)
    ? (res.data.data as NonNullable<OrderEnvelope['data']>)
    : undefined;
  const programId = order?.axiomProgramId?.trim();
  const programVersion = order?.axiomProgramVersion?.trim();

  if (!programId || !programVersion) {
    throw new Error(
      `Order '${orderId}' is missing axiomProgramId/axiomProgramVersion. ` +
      'Set them on the order or override the suite to avoid blind latest-results calls.',
    );
  }

  return { programId, programVersion };
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const basePoll = loadPollOptions();

  const documentId = requiredEnv('AXIOM_LIVE_DOCUMENT_ID');
  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const documentType = optionalEnv('AXIOM_LIVE_DOCUMENT_TYPE') ?? 'appraisal-report';
  const evaluationMode = parseEvaluationMode();
  const poll = {
    ...basePoll,
    attempts: normalizePollAttempts(basePoll.attempts, evaluationMode),
  };
  const artifactDir = artifactDirFor(orderId);
  const sseTimeout = streamTimeoutMs();

  logConfig(context, {
    orderId,
    documentId,
    documentType,
    evaluationMode,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
    sseTimeoutMs: sseTimeout,
  });

  await fs.mkdir(artifactDir, { recursive: true });

  logSection('Step 1 — Submit like the UI (POST /api/analysis/submissions)');
  const submitResponse = await postJson<SubmitEnvelope>(
    `${context.baseUrl}/api/analysis/submissions`,
    {
      analysisType: 'DOCUMENT_ANALYZE',
      orderId,
      documentId,
      documentType,
      evaluationMode,
    },
    context.authHeader,
    requestHeaders('livefire-canonical-submit'),
  );

  await writeArtifact(artifactDir, '01-submit-response.json', submitResponse.data);
  assertStatus(submitResponse.status, [202], 'submit analysis', submitResponse.data);
  if (!submitResponse.data?.success || !submitResponse.data.data?.submissionId || !submitResponse.data.data?.evaluationId) {
    throw new Error(`Submission response missing identifiers: ${JSON.stringify(submitResponse.data)}`);
  }

  const submissionId = submitResponse.data.data.submissionId;
  const evaluationId = submitResponse.data.data.evaluationId;
  const pipelineJobId = submitResponse.data.data.pipelineJobId;
  const streamId = pipelineJobId ?? evaluationId;
  console.log(`✓ submissionId=${submissionId}`);
  console.log(`✓ evaluationId=${evaluationId}`);
  console.log(`✓ pipelineJobId=${pipelineJobId ?? 'n/a'}`);
  console.log(`✓ streamId=${streamId}`);

  logSection('Step 2 — Monitor like the upload UI (/api/documents/stream/:executionId)');
  const streamEvents = await openDocumentStream(
    `${context.baseUrl}/api/documents/stream/${encodeURIComponent(streamId)}`,
    context.authHeader,
    sseTimeout,
  );
  await writeArtifact(artifactDir, '02-document-stream-events.json', streamEvents);
  if (streamEvents.length === 0) {
    throw new Error('Document stream produced zero SSE payloads — the UI live tracker would have shown nothing.');
  }
  const terminalStreamEvent = [...streamEvents].reverse().find((event) => event.status === 'completed' || event.status === 'failed');
  if (!terminalStreamEvent) {
    throw new Error('Document stream never emitted a terminal status.');
  }
  if (terminalStreamEvent.status !== 'completed') {
    throw new Error(`Document stream ended in '${terminalStreamEvent.status}' instead of completed.`);
  }
  console.log(`✓ streamEventCount=${streamEvents.length}`);

  logSection('Step 3 — Poll submission status until terminal');
  let terminalSubmission: SubmissionGetEnvelope['data'] | undefined;
  for (let attempt = 1; attempt <= poll.attempts; attempt += 1) {
    const statusRes = await getJson<SubmissionGetEnvelope>(
      `${context.baseUrl}/api/analysis/submissions/${encodeURIComponent(submissionId)}?analysisType=DOCUMENT_ANALYZE`,
      context.authHeader,
    );
    assertStatus(statusRes.status, [200], 'get submission status', statusRes.data);
    terminalSubmission = statusRes.data.data;
    await writeArtifact(artifactDir, '03-submission-status.json', statusRes.data);

    const status = terminalSubmission?.status;
    console.log(`… submission status=${status ?? 'unknown'} (attempt ${attempt}/${poll.attempts})`);
    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Submission '${submissionId}' ended in ${status}.`);
    }
    if (status === 'completed') {
      break;
    }
    await sleep(poll.intervalMs);
  }

  if (!terminalSubmission || terminalSubmission.status !== 'completed') {
    throw new Error(`Submission '${submissionId}' did not reach completed state inside the poll window.`);
  }
  console.log(`✓ submissionTerminalStatus=${terminalSubmission.status}`);

  // Legacy `GET /api/axiom/evaluations/:id` + `GET /api/axiom/evaluations/order/:orderId`
  // steps were retired in the 2026-05-07 v2 migration. The substantive
  // evaluation payload now lives at the v2 `/scopes/:scopeId/results` and
  // `/scopes/:scopeId/runs/:runId` surfaces, which Step 4 below covers.

  let latestResultsCount: number | undefined;
  let criterionHistoryCount: number | undefined;

  if (evaluationMode !== 'EXTRACTION') {
    logSection('Step 4 — Verify the v2 results surface that AxiomInsightsPanel consumes');
    const { programId } = await resolveProgramFromOrder(context.baseUrl, context.authHeader, orderId);
    const latestResultsRes = await getJson<LatestResultsEnvelope>(
      `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/results?programId=${encodeURIComponent(programId)}`,
      context.authHeader,
    );
    assertStatus(latestResultsRes.status, [200], 'get latest results', latestResultsRes.data);
    await writeArtifact(artifactDir, '04-latest-results.json', latestResultsRes.data);

    const latestResults = latestResultsRes.data?.data?.results ?? [];
    if (!Array.isArray(latestResults) || latestResults.length === 0) {
      throw new Error('Latest-results response returned zero criteria for a criteria-bearing evaluation mode.');
    }

    latestResults.forEach((doc, index) => assertLatestResultDoc(doc, `latestResults[${index}]`));
    latestResultsCount = latestResults.length;
    console.log(`✓ latestResultsCount=${latestResultsCount}`);

    const firstCriterion = latestResults[0];
    const criterionId = firstCriterion?.criterionId;
    if (!criterionId) {
      throw new Error('Latest-results response returned a criterion without criterionId.');
    }

    const historyRes = await getJson<CriterionHistoryEnvelope>(
      `${context.baseUrl}/api/axiom/scopes/${encodeURIComponent(orderId)}/criteria/${encodeURIComponent(criterionId)}/history`,
      context.authHeader,
    );
    assertStatus(historyRes.status, [200], 'get criterion history', historyRes.data);
    await writeArtifact(artifactDir, '05-criterion-history.json', historyRes.data);

    const history = historyRes.data?.data?.history ?? [];
    if (!Array.isArray(history) || history.length === 0) {
      throw new Error(`Criterion history for '${criterionId}' returned no rows.`);
    }
    history.forEach((doc, index) => assertLatestResultDoc(doc, `criterionHistory[${index}]`));
    criterionHistoryCount = history.length;
    console.log(`✓ criterionHistoryCount=${criterionHistoryCount}`);
  }

  const summary: SuiteSummary = {
    submissionId,
    evaluationId,
    pipelineJobId,
    evaluationMode,
    streamId,
    streamEventCount: streamEvents.length,
    finalSubmissionStatus: terminalSubmission.status,
    latestResultsCount,
    criterionHistoryCount,
    artifactDir,
  };
  await writeArtifact(artifactDir, '00-summary.json', summary);

  console.log('\n✅ Canonical live-fire suite passed.');
  console.log(`Artifacts: ${artifactDir}`);
}

main().catch((error) => {
  console.error(`\n❌ Canonical live-fire suite failed: ${(error as Error).message}`);
  if ((error as Error).stack) {
    console.error((error as Error).stack);
  }
  process.exit(1);
});
