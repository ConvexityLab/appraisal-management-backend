#!/usr/bin/env tsx

import { randomUUID } from 'crypto';
import {
  assertStatus,
  getJson,
  hasMeaningfulContent,
  loadLiveFireContext,
  loadPollOptions,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

type Mode = 'extraction' | 'criteria' | 'full';
type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface RunLedgerRecord {
  id: string;
  runType: 'extraction' | 'criteria' | 'criteria-step';
  status: RunStatus;
  canonicalSnapshotId?: string;
  snapshotId?: string;
  criteriaStepRunIds?: string[];
}

interface RunEnvelope {
  success: boolean;
  data?: RunLedgerRecord;
  error?: { message?: string; code?: string };
}

interface CriteriaCreateEnvelope {
  success: boolean;
  data?: {
    run: RunLedgerRecord;
    stepRuns: RunLedgerRecord[];
  };
  error?: { message?: string; code?: string };
}

interface SnapshotEnvelope {
  success: boolean;
  data?: {
    id: string;
    normalizedDataRef?: string;
    normalizedData?: {
      subjectProperty?: Record<string, unknown>;
      extraction?: Record<string, unknown>;
      providerData?: Record<string, unknown>;
      provenance?: Record<string, unknown>;
    };
    sourceRefs?: unknown[];
  };
}

interface StepInputEnvelope {
  success: boolean;
  data?: {
    id: string;
    stepKey: string;
    payloadRef: string;
    payload: Record<string, unknown>;
    evidenceRefs?: unknown[];
  };
}

interface AnalyzeEnvelope {
  success: boolean;
  data?: { evaluationId: string; pipelineJobId?: string };
  error?: { message?: string; code?: string };
}

interface OrderEvaluationsEnvelope {
  success: boolean;
  data?: Array<{ evaluationId: string; status?: string }>;
}

interface EvaluationCriterion {
  criterionId?: string;
  criterionName?: string;
  evaluation?: string;
  reasoning?: string;
  documentReferences?: unknown[];
}

interface EvaluationEnvelope {
  success: boolean;
  data?: {
    evaluationId: string;
    status?: string;
    overallRiskScore?: number;
    criteria?: EvaluationCriterion[];
    extractedData?: Record<string, unknown>;
    axiomExtractionResult?: unknown;
    axiomCriteriaResult?: unknown;
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function parseModeFromArgsOrEnv(): Mode {
  const modeArgIndex = process.argv.findIndex((arg) => arg === '--mode');
  const argMode = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : undefined;
  const envMode = optionalEnv('AXIOM_LIVE_PARITY_MODE');
  const raw = (argMode ?? envMode)?.trim().toLowerCase();

  if (!raw) {
    throw new Error('Missing mode. Set --mode <extraction|criteria|full> or AXIOM_LIVE_PARITY_MODE.');
  }
  if (raw !== 'extraction' && raw !== 'criteria' && raw !== 'full') {
    throw new Error(`Invalid mode '${raw}'. Expected one of: extraction, criteria, full.`);
  }
  return raw;
}

function parseStepKeys(): string[] {
  const raw = optionalEnv('AXIOM_LIVE_CRITERIA_STEP_KEYS') ?? 'overall-criteria';
  const keys = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error('AXIOM_LIVE_CRITERIA_STEP_KEYS must include at least one non-empty step key.');
  }
  return keys;
}

function requestHeaders(tag: string): Record<string, string> {
  const key = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${key}`,
    'X-Correlation-Id': `${tag}:${key}`,
  };
}

function resolveEngineSelection(): { engineTarget: 'AXIOM' | 'MOP_PRIO' } | { enginePolicyRef: string } {
  const enginePolicyRef = optionalEnv('AXIOM_LIVE_ENGINE_POLICY_REF');
  if (enginePolicyRef) {
    return { enginePolicyRef };
  }

  const engineTarget = optionalEnv('AXIOM_LIVE_ENGINE_TARGET');
  if (engineTarget === 'MOP_PRIO') {
    return { engineTarget: 'MOP_PRIO' };
  }

  return { engineTarget: 'AXIOM' };
}

function assertSubstantiveSnapshot(snapshot: SnapshotEnvelope['data']): void {
  if (!snapshot) {
    throw new Error('Snapshot payload was empty.');
  }

  const hasSubjectProperty = hasMeaningfulContent(snapshot.normalizedData?.subjectProperty);
  const hasExtraction = hasMeaningfulContent(snapshot.normalizedData?.extraction);
  const hasProviderData = hasMeaningfulContent(snapshot.normalizedData?.providerData);
  const hasProvenance = hasMeaningfulContent(snapshot.normalizedData?.provenance);
  const sourceRefCount = Array.isArray(snapshot.sourceRefs) ? snapshot.sourceRefs.length : 0;

  if (!snapshot.normalizedDataRef || snapshot.normalizedDataRef.trim().length === 0) {
    throw new Error(`Snapshot '${snapshot.id}' is missing normalizedDataRef.`);
  }

  if (!hasSubjectProperty && !hasExtraction && !hasProviderData && !hasProvenance && sourceRefCount === 0) {
    throw new Error(
      `Snapshot '${snapshot.id}' did not contain substantive normalized data, provenance, or source references.`,
    );
  }

  console.log(`✓ snapshotId=${snapshot.id}`);
  console.log(`✓ normalizedDataRef=${snapshot.normalizedDataRef}`);
  console.log(`✓ hasSubjectProperty=${hasSubjectProperty}`);
  console.log(`✓ hasExtractionData=${hasExtraction}`);
  console.log(`✓ hasProviderData=${hasProviderData}`);
  console.log(`✓ hasProvenance=${hasProvenance}`);
  console.log(`✓ sourceRefCount=${sourceRefCount}`);
}

function assertSubstantiveStepInput(stepInput: StepInputEnvelope['data']): void {
  if (!stepInput) {
    throw new Error('Step input payload was empty.');
  }

  const payload = stepInput.payload ?? {};
  const payloadSnapshotId = typeof payload['snapshotId'] === 'string' ? payload['snapshotId'] : undefined;
  const hasSubjectProperty = hasMeaningfulContent(payload['subjectProperty']);
  const hasExtraction = hasMeaningfulContent(payload['extraction']);
  const hasProviderData = hasMeaningfulContent(payload['providerData']);
  const hasProvenance = hasMeaningfulContent(payload['provenance']);
  const evidenceRefCount = Array.isArray(stepInput.evidenceRefs) ? stepInput.evidenceRefs.length : 0;

  if (!payloadSnapshotId) {
    throw new Error(`Step input '${stepInput.id}' is missing payload.snapshotId.`);
  }

  if (!hasSubjectProperty && !hasExtraction && !hasProviderData && !hasProvenance) {
    throw new Error(`Step input '${stepInput.id}' for step '${stepInput.stepKey}' had no substantive payload content.`);
  }

  console.log(`✓ stepInputSliceId=${stepInput.id} stepKey=${stepInput.stepKey}`);
  console.log(`✓ stepInputPayloadRef=${stepInput.payloadRef}`);
  console.log(`✓ payloadSnapshotId=${payloadSnapshotId}`);
  console.log(`✓ hasSubjectProperty=${hasSubjectProperty}`);
  console.log(`✓ hasExtractionData=${hasExtraction}`);
  console.log(`✓ hasProviderData=${hasProviderData}`);
  console.log(`✓ hasProvenance=${hasProvenance}`);
  console.log(`✓ evidenceRefCount=${evidenceRefCount}`);
}

function assertSubstantiveEvaluation(evaluation: EvaluationEnvelope['data']): void {
  if (!evaluation) {
    throw new Error('Evaluation payload was empty.');
  }

  if (evaluation.status !== 'completed') {
    throw new Error(`Evaluation '${evaluation.evaluationId}' did not complete successfully. Status='${evaluation.status ?? 'unknown'}'.`);
  }

  if (typeof evaluation.overallRiskScore !== 'number' || !Number.isFinite(evaluation.overallRiskScore)) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' is missing a numeric overallRiskScore.`);
  }

  const informativeCriteria = (evaluation.criteria ?? []).filter((criterion) => {
    const hasIdentity = Boolean(criterion.criterionId || criterion.criterionName);
    const hasReasoning = typeof criterion.reasoning === 'string' && criterion.reasoning.trim().length > 0;
    const hasDecision = typeof criterion.evaluation === 'string' && criterion.evaluation.trim().length > 0;
    const hasRefs = Array.isArray(criterion.documentReferences) && criterion.documentReferences.length > 0;
    return hasIdentity && (hasReasoning || hasDecision || hasRefs);
  }).length;
  const hasExtraction = hasMeaningfulContent(evaluation.extractedData) || hasMeaningfulContent(evaluation.axiomExtractionResult);
  const hasCriteriaAggregate = hasMeaningfulContent(evaluation.axiomCriteriaResult);

  if (informativeCriteria === 0 && !hasExtraction && !hasCriteriaAggregate) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' completed without substantive extraction or criteria results.`);
  }

  console.log(`✓ overallRiskScore=${evaluation.overallRiskScore}`);
  console.log(`✓ informativeCriteriaCount=${informativeCriteria}`);
  console.log(`✓ hasExtractionOutput=${hasExtraction}`);
  console.log(`✓ hasCriteriaAggregate=${hasCriteriaAggregate}`);
}

async function pollRunToTerminal(
  baseUrl: string,
  authHeader: Record<string, string>,
  runId: string,
  attempts: number,
  intervalMs: number,
): Promise<RunLedgerRecord> {
  let last: RunLedgerRecord | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const refreshRes = await postJson<RunEnvelope>(
      `${baseUrl}/api/runs/${encodeURIComponent(runId)}/refresh-status`,
      {},
      authHeader,
    );
    assertStatus(refreshRes.status, [200], `refresh run status (${runId})`, refreshRes.data);

    const getRes = await getJson<RunEnvelope>(`${baseUrl}/api/runs/${encodeURIComponent(runId)}`, authHeader);
    assertStatus(getRes.status, [200], `get run (${runId})`, getRes.data);

    last = getRes.data.data;
    if (!last) {
      throw new Error(`Run '${runId}' returned no data payload.`);
    }

    console.log(`… run ${runId} status=${last.status} (attempt ${attempt}/${attempts})`);

    if (last.status === 'completed' || last.status === 'failed' || last.status === 'cancelled') {
      return last;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Run '${runId}' did not reach a terminal status within ${attempts} attempts.`);
}

async function runExtractionMode(
  baseUrl: string,
  authHeader: Record<string, string>,
  attempts: number,
  intervalMs: number,
): Promise<RunLedgerRecord> {
  const documentId = requiredEnv('AXIOM_LIVE_DOCUMENT_ID');
  const schemaClientId = optionalEnv('AXIOM_LIVE_SCHEMA_CLIENT_ID') ?? requiredEnv('AXIOM_LIVE_CLIENT_ID');
  const schemaSubClientId = optionalEnv('AXIOM_LIVE_SCHEMA_SUB_CLIENT_ID') ?? 'default-sub-client';
  const schemaDocumentType = optionalEnv('AXIOM_LIVE_SCHEMA_DOCUMENT_TYPE') ?? optionalEnv('AXIOM_LIVE_DOCUMENT_TYPE') ?? 'APPRAISAL';
  const schemaVersion = optionalEnv('AXIOM_LIVE_SCHEMA_VERSION') ?? '1.0.0';
  const runReason = optionalEnv('AXIOM_LIVE_RUN_REASON') ?? 'LIVE_FIRE_EXTRACTION_ONLY';
  const engagementId = optionalEnv('AXIOM_LIVE_ENGAGEMENT_ID');
  const loanPropertyContextId = optionalEnv('AXIOM_LIVE_ORDER_ID');

  logSection('Mode: extraction (POST /api/runs/extraction)');
  const createRes = await postJson<RunEnvelope>(
    `${baseUrl}/api/runs/extraction`,
    {
      documentId,
      runReason,
      schemaKey: {
        clientId: schemaClientId,
        subClientId: schemaSubClientId,
        documentType: schemaDocumentType,
        version: schemaVersion,
      },
      ...resolveEngineSelection(),
      ...(engagementId ? { engagementId } : {}),
      ...(loanPropertyContextId ? { loanPropertyContextId } : {}),
    },
    authHeader,
    requestHeaders('livefire-ui-parity-extraction'),
  );
  assertStatus(createRes.status, [202], 'create extraction run', createRes.data);
  if (!createRes.data?.success || !createRes.data?.data?.id) {
    throw new Error(`Extraction run response missing run id: ${JSON.stringify(createRes.data)}`);
  }

  const extractionRun = await pollRunToTerminal(baseUrl, authHeader, createRes.data.data.id, attempts, intervalMs);
  console.log(`✓ extractionRunId=${extractionRun.id} status=${extractionRun.status}`);

  const snapshotRes = await getJson<SnapshotEnvelope>(
    `${baseUrl}/api/runs/${encodeURIComponent(extractionRun.id)}/snapshot`,
    authHeader,
  );

  if (snapshotRes.status === 200 && snapshotRes.data?.success && snapshotRes.data.data?.id) {
    assertSubstantiveSnapshot(snapshotRes.data.data);
  } else {
    throw new Error(`Extraction run completed but snapshot retrieval failed: ${JSON.stringify(snapshotRes.data)}`);
  }

  return extractionRun;
}

async function resolveCriteriaSnapshotId(
  baseUrl: string,
  authHeader: Record<string, string>,
): Promise<string> {
  const explicitSnapshotId = optionalEnv('AXIOM_LIVE_SNAPSHOT_ID');
  if (explicitSnapshotId) {
    return explicitSnapshotId;
  }

  const extractionRunId = optionalEnv('AXIOM_LIVE_EXTRACTION_RUN_ID');
  if (!extractionRunId) {
    const bootstrapDocumentId = optionalEnv('AXIOM_LIVE_DOCUMENT_ID');
    if (!bootstrapDocumentId) {
      throw new Error('Criteria mode requires AXIOM_LIVE_SNAPSHOT_ID or AXIOM_LIVE_EXTRACTION_RUN_ID.');
    }

    console.log('… criteria mode bootstrapping snapshot via extraction run');
    const extractionRun = await runExtractionMode(baseUrl, authHeader, 20, 3000);
    const snapshotId = extractionRun.canonicalSnapshotId ?? extractionRun.snapshotId;
    if (!snapshotId) {
      throw new Error(`Bootstrapped extraction run '${extractionRun.id}' has no linked snapshot.`);
    }
    return snapshotId;
  }

  const extractionRunRes = await getJson<RunEnvelope>(
    `${baseUrl}/api/runs/${encodeURIComponent(extractionRunId)}`,
    authHeader,
  );
  assertStatus(extractionRunRes.status, [200], 'get extraction run for criteria mode', extractionRunRes.data);

  const run = extractionRunRes.data.data;
  if (!run) {
    throw new Error(`Extraction run '${extractionRunId}' returned no data.`);
  }

  const snapshotId = run.canonicalSnapshotId ?? run.snapshotId;
  if (!snapshotId) {
    throw new Error(`Extraction run '${extractionRunId}' has no linked snapshot.`);
  }

  return snapshotId;
}

async function runCriteriaMode(
  baseUrl: string,
  authHeader: Record<string, string>,
  attempts: number,
  intervalMs: number,
): Promise<void> {
  const snapshotId = await resolveCriteriaSnapshotId(baseUrl, authHeader);
  const programClientId = optionalEnv('AXIOM_LIVE_PROGRAM_CLIENT_ID') ?? requiredEnv('AXIOM_LIVE_CLIENT_ID');
  const programSubClientId = optionalEnv('AXIOM_LIVE_PROGRAM_SUB_CLIENT_ID') ?? 'default-sub-client';
  const programId = optionalEnv('AXIOM_LIVE_PROGRAM_ID') ?? 'FNMA-URAR';
  const programVersion = optionalEnv('AXIOM_LIVE_PROGRAM_VERSION') ?? '1.0.0';
  const runModeRaw = optionalEnv('AXIOM_LIVE_CRITERIA_RUN_MODE') ?? 'FULL';
  const runMode = runModeRaw === 'FULL' || runModeRaw === 'STEP_ONLY' ? runModeRaw : undefined;
  if (!runMode) {
    throw new Error(`AXIOM_LIVE_CRITERIA_RUN_MODE must be FULL or STEP_ONLY. Received: ${runModeRaw}`);
  }

  const rerunReason = optionalEnv('AXIOM_LIVE_RERUN_REASON') ?? 'LIVE_FIRE_CRITERIA_ONLY';
  const engagementId = optionalEnv('AXIOM_LIVE_ENGAGEMENT_ID');
  const loanPropertyContextId = optionalEnv('AXIOM_LIVE_ORDER_ID');
  const criteriaStepKeys = parseStepKeys();

  logSection('Mode: criteria (POST /api/runs/criteria)');
  const createRes = await postJson<CriteriaCreateEnvelope>(
    `${baseUrl}/api/runs/criteria`,
    {
      snapshotId,
      programKey: {
        clientId: programClientId,
        subClientId: programSubClientId,
        programId,
        version: programVersion,
      },
      runMode,
      criteriaStepKeys,
      rerunReason,
      ...resolveEngineSelection(),
      ...(engagementId ? { engagementId } : {}),
      ...(loanPropertyContextId ? { loanPropertyContextId } : {}),
    },
    authHeader,
    requestHeaders('livefire-ui-parity-criteria'),
  );
  assertStatus(createRes.status, [202], 'create criteria run', createRes.data);
  if (!createRes.data?.success || !createRes.data?.data?.run?.id) {
    throw new Error(`Criteria run response missing run id: ${JSON.stringify(createRes.data)}`);
  }

  const criteriaRun = await pollRunToTerminal(baseUrl, authHeader, createRes.data.data.run.id, attempts, intervalMs);
  console.log(`✓ criteriaRunId=${criteriaRun.id} status=${criteriaRun.status}`);

  const stepRuns = createRes.data.data.stepRuns ?? [];
  for (const step of stepRuns) {
    const terminal = await pollRunToTerminal(baseUrl, authHeader, step.id, attempts, intervalMs);
    console.log(`✓ stepRunId=${terminal.id} stepStatus=${terminal.status}`);

    const stepInputRes = await getJson<StepInputEnvelope>(
      `${baseUrl}/api/runs/${encodeURIComponent(step.id)}/step-input`,
      authHeader,
    );

    if (stepInputRes.status === 200 && stepInputRes.data?.success && stepInputRes.data.data) {
      assertSubstantiveStepInput(stepInputRes.data.data);
    } else {
      throw new Error(`Step input retrieval failed for run '${step.id}': ${JSON.stringify(stepInputRes.data)}`);
    }
  }
}

async function runFullMode(
  baseUrl: string,
  authHeader: Record<string, string>,
  attempts: number,
  intervalMs: number,
): Promise<void> {
  const documentId = requiredEnv('AXIOM_LIVE_DOCUMENT_ID');
  const orderId = requiredEnv('AXIOM_LIVE_ORDER_ID');
  const documentType = optionalEnv('AXIOM_LIVE_DOCUMENT_TYPE') ?? 'appraisal';

  logSection('Mode: full (POST /api/axiom/analyze, UI parity)');
  const analyzeRes = await postJson<AnalyzeEnvelope>(
    `${baseUrl}/api/axiom/analyze`,
    {
      documentId,
      orderId,
      documentType,
      forceResubmit: true,
    },
    authHeader,
  );
  assertStatus(analyzeRes.status, [202], 'analyze document', analyzeRes.data);
  if (!analyzeRes.data?.success || !analyzeRes.data?.data?.evaluationId) {
    throw new Error(`Analyze response missing evaluationId: ${JSON.stringify(analyzeRes.data)}`);
  }

  const evaluationId = analyzeRes.data.data.evaluationId;
  console.log(`✓ evaluationId=${evaluationId}`);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const orderEvalRes = await getJson<OrderEvaluationsEnvelope>(
      `${baseUrl}/api/axiom/evaluations/order/${encodeURIComponent(orderId)}`,
      authHeader,
    );

    if (orderEvalRes.status === 200 && orderEvalRes.data?.success && Array.isArray(orderEvalRes.data?.data)) {
      const match = orderEvalRes.data.data.find((item) => item.evaluationId === evaluationId);
      if (match) {
        console.log(`✓ evaluation surfaced for order on attempt ${attempt} (status=${match.status ?? 'unknown'})`);
        break;
      }
    } else if (orderEvalRes.status !== 404) {
      throw new Error(`Unexpected order evaluations status ${orderEvalRes.status}: ${JSON.stringify(orderEvalRes.data)}`);
    }

    console.log(`… evaluation not yet visible for order (attempt ${attempt}/${attempts})`);
    await sleep(intervalMs);
  }

  logSection('Mode: full (GET /api/axiom/evaluations/:evaluationId)');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const evaluationRes = await getJson<EvaluationEnvelope>(
      `${baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`,
      authHeader,
    );

    assertStatus(evaluationRes.status, [200, 404], 'get evaluation by id', evaluationRes.data);
    if (evaluationRes.status === 404) {
      console.log(`… evaluation payload pending (attempt ${attempt}/${attempts})`);
      await sleep(intervalMs);
      continue;
    }

    assertSubstantiveEvaluation(evaluationRes.data?.data);
    return;
  }

  throw new Error(`Evaluation '${evaluationId}' did not produce a substantive completed payload within the poll window.`);
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const mode = parseModeFromArgsOrEnv();
  const poll = loadPollOptions();

  logConfig(context, {
    mode,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
    documentId: optionalEnv('AXIOM_LIVE_DOCUMENT_ID'),
    orderId: optionalEnv('AXIOM_LIVE_ORDER_ID'),
    snapshotId: optionalEnv('AXIOM_LIVE_SNAPSHOT_ID'),
    extractionRunId: optionalEnv('AXIOM_LIVE_EXTRACTION_RUN_ID'),
  });

  if (mode === 'extraction') {
    await runExtractionMode(context.baseUrl, context.authHeader, poll.attempts, poll.intervalMs);
  } else if (mode === 'criteria') {
    await runCriteriaMode(context.baseUrl, context.authHeader, poll.attempts, poll.intervalMs);
  } else {
    await runFullMode(context.baseUrl, context.authHeader, poll.attempts, poll.intervalMs);
  }

  console.log(`\n✅ UI parity harness passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`\n❌ UI parity harness failed: ${(error as Error).message}`);
  process.exit(1);
});
