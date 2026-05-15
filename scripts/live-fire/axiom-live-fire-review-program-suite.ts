#!/usr/bin/env tsx

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { AnalysisSubmissionResponse } from '../../src/types/analysis-submission.types.js';
import type {
  AxiomPreparedPayload,
  DispatchPreparedReviewProgramsResponse,
  PrepareReviewProgramsResponse,
  PreparedEngineDispatch,
  PreparedReviewContextArtifact,
  PrepareReviewProgramsRequest,
} from '../../src/types/review-preparation.types.js';
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

type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type DispatchMode = 'all_ready_only' | 'include_partial';
type Verdict = 'pass' | 'fail' | 'needs_review' | 'cannot_evaluate' | 'not_applicable';

interface EnvelopeError {
  message?: string;
  code?: string;
}

interface ReviewPrepareEnvelope {
  success?: boolean;
  data?: PrepareReviewProgramsResponse;
  error?: string | EnvelopeError;
}

interface ReviewPreparedContextEnvelope {
  success?: boolean;
  data?: PreparedReviewContextArtifact;
  error?: string | EnvelopeError;
}

interface ReviewDispatchEnvelope {
  success?: boolean;
  data?: DispatchPreparedReviewProgramsResponse;
  error?: string | EnvelopeError;
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
  error?: string | EnvelopeError;
}

interface CriterionHistoryEnvelope {
  success?: boolean;
  data?: {
    scopeId?: string;
    criterionId?: string;
    history?: LatestResultDoc[];
  };
  error?: string | EnvelopeError;
}

interface AxiomLegSummary {
  reviewProgramId: string;
  reviewProgramName: string;
  engineProgramId: string;
  engineProgramVersion: string;
  submissionId: string;
  finalStatus: RunStatus;
  latestResultsCount: number;
  criterionHistoryCount: number;
  firstCriterionId: string;
}

interface SuiteSummary {
  orderId: string;
  reviewProgramIds: string[];
  preparedContextId: string;
  preparedContextVersion: string;
  dispatchId: string;
  dispatchMode: DispatchMode;
  confirmWarnings: boolean;
  axiomLegs: AxiomLegSummary[];
  artifactDir: string;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function booleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = optionalEnv(name);
  if (!raw) {
    return defaultValue;
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  throw new Error(`${name} must be true/false. Got: ${raw}`);
}

function requestHeaders(tag: string): Record<string, string> {
  const nonce = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${nonce}`,
    'X-Correlation-Id': `${tag}:${nonce}`,
  };
}

function parseReviewProgramIds(): string[] {
  const raw = requiredEnv('AXIOM_LIVE_REVIEW_PROGRAM_IDS');
  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (ids.length === 0) {
    throw new Error('AXIOM_LIVE_REVIEW_PROGRAM_IDS must contain at least one review program id.');
  }

  return [...new Set(ids)];
}

function parseDispatchMode(): DispatchMode {
  const raw = optionalEnv('AXIOM_LIVE_REVIEW_DISPATCH_MODE') ?? 'all_ready_only';
  if (raw === 'all_ready_only' || raw === 'include_partial') {
    return raw;
  }
  throw new Error(
    `AXIOM_LIVE_REVIEW_DISPATCH_MODE must be all_ready_only or include_partial. Got: ${raw}`,
  );
}

function artifactDirFor(orderId: string): string {
  const configured = optionalEnv('AXIOM_LIVE_REVIEW_ARTIFACT_DIR');
  if (configured) {
    return resolveLiveFirePath(configured, 'AXIOM_LIVE_REVIEW_ARTIFACT_DIR');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(
    process.cwd(),
    'test-artifacts/live-fire/axiom-review-program-suite',
    `${stamp}-${orderId}`,
  );
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-');
}

async function writeArtifact(artifactDir: string, fileName: string, payload: unknown): Promise<void> {
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

function describeEnvelopeError(value: string | EnvelopeError | undefined): string {
  if (!value) return 'unknown error';
  if (typeof value === 'string') return value;
  return value.message ?? value.code ?? 'unknown error';
}

function assertVerdict(value: unknown, field: string): Verdict {
  if (
    value !== 'pass' &&
    value !== 'fail' &&
    value !== 'needs_review' &&
    value !== 'cannot_evaluate' &&
    value !== 'not_applicable'
  ) {
    throw new Error(
      `${field} must be one of pass|fail|needs_review|cannot_evaluate|not_applicable. Got ${JSON.stringify(value)}`,
    );
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

function summarizePrograms(data: PrepareReviewProgramsResponse): string {
  return data.programs
    .map((program) => {
      const blockers = program.blockers.length > 0 ? ` blockers=${program.blockers.join('; ')}` : '';
      const warnings = program.warnings.length > 0 ? ` warnings=${program.warnings.join('; ')}` : '';
      return `${program.reviewProgramId}[${program.readiness}|canDispatch=${program.canDispatch}]${blockers}${warnings}`;
    })
    .join(' | ');
}

function getAxiomDispatches(dispatches: PreparedEngineDispatch[]): PreparedEngineDispatch[] {
  return dispatches.filter(
    (dispatch): dispatch is PreparedEngineDispatch & { payload: AxiomPreparedPayload } =>
      dispatch.engine === 'AXIOM' && dispatch.payloadContractType === 'axiom-review-dispatch',
  );
}

function assertAxiomPreparedPayload(dispatch: PreparedEngineDispatch): asserts dispatch is PreparedEngineDispatch & { payload: AxiomPreparedPayload } {
  if (dispatch.engine !== 'AXIOM') {
    throw new Error(`Expected AXIOM dispatch, received ${dispatch.engine}.`);
  }
  if (dispatch.payloadContractType !== 'axiom-review-dispatch') {
    throw new Error(`Unexpected payload contract type '${dispatch.payloadContractType}' for AXIOM dispatch.`);
  }

  const payload = dispatch.payload;
  if (payload.contractType !== 'axiom-review-dispatch') {
    throw new Error(`Payload contractType mismatch for ${dispatch.id}.`);
  }
  if (payload.dispatchMode !== 'prepared-context') {
    throw new Error(`Payload dispatchMode mismatch for ${dispatch.id}.`);
  }
  if (payload.reviewProgramId !== dispatch.reviewProgramId || payload.reviewProgramVersion !== dispatch.reviewProgramVersion) {
    throw new Error(`Payload review program mismatch for ${dispatch.id}.`);
  }
  if (payload.engineProgramId !== dispatch.engineProgramId || payload.engineProgramVersion !== dispatch.engineProgramVersion) {
    throw new Error(`Payload engine program mismatch for ${dispatch.id}.`);
  }
  if (!Array.isArray(payload.criteria)) {
    throw new Error(`Payload criteria must be an array for ${dispatch.id}.`);
  }
  if (!Array.isArray(payload.documentInventory)) {
    throw new Error(`Payload documentInventory must be an array for ${dispatch.id}.`);
  }
  if (!Array.isArray(payload.evidenceRefs)) {
    throw new Error(`Payload evidenceRefs must be an array for ${dispatch.id}.`);
  }

  if (dispatch.canDispatch && payload.criteria.length === 0) {
    throw new Error(`Dispatch ${dispatch.id} is marked dispatchable but has zero criteria.`);
  }

  const criteriaSummary = payload.criteriaSummary;
  if (criteriaSummary) {
    const totalCount =
      criteriaSummary.readyCriteriaCount
      + criteriaSummary.warningCriteriaCount
      + criteriaSummary.blockedCriteriaCount;
    if (criteriaSummary.totalCriteria !== totalCount) {
      throw new Error(`criteriaSummary totals do not reconcile for ${dispatch.id}.`);
    }
  }
}

async function waitForCriteriaSubmission(params: {
  baseUrl: string;
  authHeader: Record<string, string>;
  submissionId: string;
  attempts: number;
  intervalMs: number;
  artifactDir: string;
  artifactFile: string;
}): Promise<AnalysisSubmissionResponse> {
  let latest: AnalysisSubmissionResponse | undefined;

  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    const res = await getJson<{ success?: boolean; data?: AnalysisSubmissionResponse; error?: EnvelopeError }>(
      `${params.baseUrl}/api/analysis/submissions/${encodeURIComponent(params.submissionId)}?analysisType=CRITERIA`,
      params.authHeader,
    );
    assertStatus(res.status, [200], 'get criteria submission status', res.data);
    await writeArtifact(params.artifactDir, params.artifactFile, res.data);

    if (!res.data?.success || !res.data.data) {
      throw new Error(`Criteria submission '${params.submissionId}' returned no data.`);
    }

    latest = res.data.data;
    console.log(
      `… criteria submission ${params.submissionId} status=${latest.status} (attempt ${attempt}/${params.attempts})`,
    );

    if (latest.status === 'failed' || latest.status === 'cancelled') {
      throw new Error(`Criteria submission '${params.submissionId}' ended in ${latest.status}.`);
    }

    if (latest.status === 'completed') {
      return latest;
    }

    await sleep(params.intervalMs);
  }

  throw new Error(`Criteria submission '${params.submissionId}' did not complete inside the poll window.`);
}

async function waitForLatestResults(params: {
  baseUrl: string;
  authHeader: Record<string, string>;
  orderId: string;
  programId: string;
  attempts: number;
  intervalMs: number;
  artifactDir: string;
  artifactFile: string;
}): Promise<LatestResultDoc[]> {
  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    const res = await getJson<LatestResultsEnvelope>(
      `${params.baseUrl}/api/axiom/scopes/${encodeURIComponent(params.orderId)}/results?programId=${encodeURIComponent(params.programId)}`,
      params.authHeader,
    );
    assertStatus(res.status, [200], 'get latest review-program results', res.data);
    await writeArtifact(params.artifactDir, params.artifactFile, res.data);

    const results = res.data?.data?.results ?? [];
    if (Array.isArray(results) && results.length > 0) {
      results.forEach((doc, index) => assertLatestResultDoc(doc, `latestResults[${index}]`));
      return results;
    }

    console.log(
      `… latest results for program ${params.programId} not ready yet (attempt ${attempt}/${params.attempts})`,
    );
    await sleep(params.intervalMs);
  }

  throw new Error(`No latest results appeared for program '${params.programId}' inside the poll window.`);
}

async function waitForCriterionHistory(params: {
  baseUrl: string;
  authHeader: Record<string, string>;
  orderId: string;
  criterionId: string;
  attempts: number;
  intervalMs: number;
  artifactDir: string;
  artifactFile: string;
}): Promise<LatestResultDoc[]> {
  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    const res = await getJson<CriterionHistoryEnvelope>(
      `${params.baseUrl}/api/axiom/scopes/${encodeURIComponent(params.orderId)}/criteria/${encodeURIComponent(params.criterionId)}/history`,
      params.authHeader,
    );
    assertStatus(res.status, [200], 'get criterion history', res.data);
    await writeArtifact(params.artifactDir, params.artifactFile, res.data);

    const history = res.data?.data?.history ?? [];
    if (Array.isArray(history) && history.length > 0) {
      history.forEach((doc, index) => assertLatestResultDoc(doc, `criterionHistory[${index}]`));
      return history;
    }

    console.log(
      `… criterion history for ${params.criterionId} not ready yet (attempt ${attempt}/${params.attempts})`,
    );
    await sleep(params.intervalMs);
  }

  throw new Error(`Criterion history for '${params.criterionId}' did not appear inside the poll window.`);
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const poll = loadPollOptions();

  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const reviewProgramIds = parseReviewProgramIds();
  const dispatchMode = parseDispatchMode();
  const confirmWarnings = booleanEnv('AXIOM_LIVE_REVIEW_CONFIRM_WARNINGS', false);
  const artifactDir = artifactDirFor(orderId);

  logConfig(context, {
    orderId,
    reviewPrograms: reviewProgramIds.join(','),
    dispatchMode,
    confirmWarnings,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
  });

  await fs.mkdir(artifactDir, { recursive: true });

  const prepareRequest: PrepareReviewProgramsRequest = {
    orderId,
    reviewProgramIds,
    ...(optionalEnv('AXIOM_LIVE_REVIEW_CLIENT_ID')
      ? { clientId: optionalEnv('AXIOM_LIVE_REVIEW_CLIENT_ID') as string }
      : {}),
    ...(optionalEnv('AXIOM_LIVE_REVIEW_SUB_CLIENT_ID')
      ? { subClientId: optionalEnv('AXIOM_LIVE_REVIEW_SUB_CLIENT_ID') as string }
      : {}),
    ...(optionalEnv('AXIOM_LIVE_REVIEW_ENGAGEMENT_ID')
      ? { engagementId: optionalEnv('AXIOM_LIVE_REVIEW_ENGAGEMENT_ID') as string }
      : {}),
  };

  const includeCompContext = optionalEnv('AXIOM_LIVE_REVIEW_INCLUDE_COMP_CONTEXT');
  const includeDocumentInventory = optionalEnv('AXIOM_LIVE_REVIEW_INCLUDE_DOCUMENT_INVENTORY');
  const autoResolveDerived = optionalEnv('AXIOM_LIVE_REVIEW_AUTO_RESOLVE_DERIVED_FIELDS');
  const autoPlanExtraction = optionalEnv('AXIOM_LIVE_REVIEW_AUTO_PLAN_EXTRACTION');
  if (includeCompContext || includeDocumentInventory || autoResolveDerived || autoPlanExtraction) {
    prepareRequest.options = {
      ...(includeCompContext ? { includeCompContext: booleanEnv('AXIOM_LIVE_REVIEW_INCLUDE_COMP_CONTEXT', false) } : {}),
      ...(includeDocumentInventory ? { includeDocumentInventory: booleanEnv('AXIOM_LIVE_REVIEW_INCLUDE_DOCUMENT_INVENTORY', false) } : {}),
      ...(autoResolveDerived ? { attemptAutoResolveDerivedFields: booleanEnv('AXIOM_LIVE_REVIEW_AUTO_RESOLVE_DERIVED_FIELDS', false) } : {}),
      ...(autoPlanExtraction ? { attemptAutoPlanExtraction: booleanEnv('AXIOM_LIVE_REVIEW_AUTO_PLAN_EXTRACTION', false) } : {}),
    };
  }

  logSection('Step 1 — Prepare review programs like the order workspace');
  const prepareResponse = await postJson<ReviewPrepareEnvelope>(
    `${context.baseUrl}/api/review-programs/prepare`,
    prepareRequest,
    context.authHeader,
    requestHeaders('livefire-review-prepare'),
  );
  await writeArtifact(artifactDir, '01-prepare-response.json', prepareResponse.data);
  assertStatus(prepareResponse.status, [200], 'prepare review programs', prepareResponse.data);

  if (!prepareResponse.data?.success || !prepareResponse.data.data) {
    throw new Error(`Prepare request failed: ${describeEnvelopeError(prepareResponse.data?.error)}`);
  }

  const prepared = prepareResponse.data.data;
  if (!prepared.preparedContextId || !prepared.preparedContextVersion) {
    throw new Error('Prepare response did not return preparedContextId/preparedContextVersion.');
  }
  if (!prepared.plannedEngineDispatches || prepared.plannedEngineDispatches.length === 0) {
    throw new Error(`Prepare response produced zero planned engine dispatches. ${summarizePrograms(prepared)}`);
  }

  console.log(`✓ preparedContextId=${prepared.preparedContextId}`);
  console.log(`✓ preparedContextVersion=${prepared.preparedContextVersion}`);
  console.log(`✓ plannedEngineDispatches=${prepared.plannedEngineDispatches.length}`);

  logSection('Step 2 — Retrieve the persisted prepared context artifact');
  const preparedContextResponse = await getJson<ReviewPreparedContextEnvelope>(
    `${context.baseUrl}/api/review-programs/prepared/${encodeURIComponent(prepared.preparedContextId)}`,
    context.authHeader,
  );
  await writeArtifact(artifactDir, '02-prepared-context.json', preparedContextResponse.data);
  assertStatus(preparedContextResponse.status, [200], 'get prepared review context', preparedContextResponse.data);

  if (!preparedContextResponse.data?.success || !preparedContextResponse.data.data) {
    throw new Error(`Prepared context retrieval failed: ${describeEnvelopeError(preparedContextResponse.data?.error)}`);
  }

  const preparedContext = preparedContextResponse.data.data;
  if (preparedContext.preparedContextId !== prepared.preparedContextId) {
    throw new Error('Persisted prepared context id does not match the prepare response id.');
  }

  const axiomDispatches = getAxiomDispatches(preparedContext.plannedEngineDispatches);
  if (axiomDispatches.length === 0) {
    throw new Error(`Prepared context contains no AXIOM engine dispatches. ${summarizePrograms(prepared)}`);
  }

  axiomDispatches.forEach((dispatch) => assertAxiomPreparedPayload(dispatch));
  const dispatchableAxiomDispatches = axiomDispatches.filter((dispatch) => dispatch.canDispatch);
  if (dispatchableAxiomDispatches.length === 0) {
    const blockers = axiomDispatches
      .map((dispatch) => `${dispatch.reviewProgramId}:${dispatch.blockedReasons.join('; ') || 'not dispatchable'}`)
      .join(' | ');
    throw new Error(`No AXIOM prepared dispatch is currently dispatchable. ${blockers}`);
  }
  console.log(`✓ axiomDispatches=${axiomDispatches.length}`);
  console.log(`✓ dispatchableAxiomDispatches=${dispatchableAxiomDispatches.length}`);

  logSection('Step 3 — Dispatch from the prepared context');
  const dispatchResponse = await postJson<ReviewDispatchEnvelope>(
    `${context.baseUrl}/api/review-programs/prepared/${encodeURIComponent(prepared.preparedContextId)}/dispatch`,
    {
      preparedContextId: prepared.preparedContextId,
      reviewProgramIds,
      dispatchMode,
      confirmWarnings,
    },
    context.authHeader,
    requestHeaders('livefire-review-dispatch'),
  );
  await writeArtifact(artifactDir, '03-dispatch-response.json', dispatchResponse.data);
  assertStatus(dispatchResponse.status, [202, 207], 'dispatch prepared review programs', dispatchResponse.data);

  if (!dispatchResponse.data?.success || !dispatchResponse.data.data) {
    throw new Error(`Dispatch failed: ${describeEnvelopeError(dispatchResponse.data?.error)}`);
  }

  const dispatched = dispatchResponse.data.data;
  if (dispatched.submittedPrograms.length === 0) {
    const skipped = dispatched.skippedPrograms.map((item) => `${item.reviewProgramId}:${item.reason}`).join(' | ');
    throw new Error(`Dispatch submitted zero programs. ${skipped || 'No skipped reason was returned.'}`);
  }

  const submittedAxiomLegs = dispatched.submittedPrograms.flatMap((program) =>
    program.axiomLegs
      .filter((leg) => leg.status === 'submitted' && typeof leg.runId === 'string' && leg.runId.length > 0)
      .map((leg) => ({
        reviewProgramId: program.reviewProgramId,
        reviewProgramName: program.reviewProgramName,
        reviewProgramVersion: program.reviewProgramVersion,
        engineProgramId: leg.programId,
        engineProgramVersion: leg.programVersion,
        submissionId: leg.runId as string,
      })),
  );

  if (submittedAxiomLegs.length === 0) {
    const warnings = dispatched.warnings.join(' | ');
    const skipped = dispatched.skippedPrograms.map((item) => `${item.reviewProgramId}:${item.reason}`).join(' | ');
    throw new Error(`Dispatch returned no submitted AXIOM legs. ${warnings || skipped || 'No additional detail returned.'}`);
  }

  console.log(`✓ dispatchId=${dispatched.dispatchId}`);
  console.log(`✓ submittedPrograms=${dispatched.submittedPrograms.length}`);
  console.log(`✓ submittedAxiomLegs=${submittedAxiomLegs.length}`);

  logSection('Step 4 — Monitor Axiom-backed criteria runs and verify result surfaces');
  const axiomLegSummaries: AxiomLegSummary[] = [];

  for (const leg of submittedAxiomLegs) {
    const fileSafeBase = `${sanitizeSegment(leg.reviewProgramId)}-${sanitizeSegment(leg.engineProgramId)}`;
    const submission = await waitForCriteriaSubmission({
      baseUrl: context.baseUrl,
      authHeader: context.authHeader,
      submissionId: leg.submissionId,
      attempts: poll.attempts,
      intervalMs: poll.intervalMs,
      artifactDir,
      artifactFile: `04-criteria-submission-${fileSafeBase}.json`,
    });

    if (submission.status !== 'completed') {
      throw new Error(`Criteria submission '${leg.submissionId}' did not complete.`);
    }
    if (!submission.run) {
      throw new Error(`Criteria submission '${leg.submissionId}' is missing run metadata.`);
    }
    if (submission.run.preparedContextId !== prepared.preparedContextId) {
      throw new Error(`Run '${leg.submissionId}' is not linked back to preparedContextId '${prepared.preparedContextId}'.`);
    }
    if (submission.run.preparedDispatchId !== dispatched.dispatchId) {
      throw new Error(`Run '${leg.submissionId}' is not linked back to dispatchId '${dispatched.dispatchId}'.`);
    }
    if (submission.run.programKey?.programId !== leg.engineProgramId) {
      throw new Error(`Run '${leg.submissionId}' programId mismatch.`);
    }
    if (submission.run.programKey?.version !== leg.engineProgramVersion) {
      throw new Error(`Run '${leg.submissionId}' programVersion mismatch.`);
    }

    const latestResults = await waitForLatestResults({
      baseUrl: context.baseUrl,
      authHeader: context.authHeader,
      orderId,
      programId: leg.engineProgramId,
      attempts: poll.attempts,
      intervalMs: poll.intervalMs,
      artifactDir,
      artifactFile: `05-latest-results-${fileSafeBase}.json`,
    });

    const firstCriterionId = latestResults[0]?.criterionId;
    if (!firstCriterionId) {
      throw new Error(`Latest results for program '${leg.engineProgramId}' did not include a criterionId.`);
    }

    const history = await waitForCriterionHistory({
      baseUrl: context.baseUrl,
      authHeader: context.authHeader,
      orderId,
      criterionId: firstCriterionId,
      attempts: poll.attempts,
      intervalMs: poll.intervalMs,
      artifactDir,
      artifactFile: `06-criterion-history-${fileSafeBase}-${sanitizeSegment(firstCriterionId)}.json`,
    });

    axiomLegSummaries.push({
      reviewProgramId: leg.reviewProgramId,
      reviewProgramName: leg.reviewProgramName,
      engineProgramId: leg.engineProgramId,
      engineProgramVersion: leg.engineProgramVersion,
      submissionId: leg.submissionId,
      finalStatus: submission.status,
      latestResultsCount: latestResults.length,
      criterionHistoryCount: history.length,
      firstCriterionId,
    });

    console.log(
      `✓ ${leg.reviewProgramId}/${leg.engineProgramId}: results=${latestResults.length}, history=${history.length}`,
    );
  }

  const summary: SuiteSummary = {
    orderId,
    reviewProgramIds,
    preparedContextId: prepared.preparedContextId,
    preparedContextVersion: prepared.preparedContextVersion,
    dispatchId: dispatched.dispatchId,
    dispatchMode,
    confirmWarnings,
    axiomLegs: axiomLegSummaries,
    artifactDir,
  };
  await writeArtifact(artifactDir, '00-summary.json', summary);

  console.log('\n✅ Review-program live-fire suite passed.');
  console.log(`Artifacts: ${artifactDir}`);
}

main().catch((error) => {
  console.error(`\n❌ Review-program live-fire suite failed: ${(error as Error).message}`);
  if ((error as Error).stack) {
    console.error((error as Error).stack);
  }
  process.exit(1);
});