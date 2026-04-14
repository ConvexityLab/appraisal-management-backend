#!/usr/bin/env tsx

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

type EvaluationMode = 'EXTRACTION' | 'CRITERIA_EVALUATION' | 'COMPLETE_EVALUATION';

interface SubmitEnvelope {
  success: boolean;
  data?: {
    submissionId: string;
    analysisType: 'DOCUMENT_ANALYZE';
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    provider: 'AXIOM';
    evaluationId?: string;
    pipelineJobId?: string;
  };
  error?: { message?: string; code?: string };
}

interface SubmissionGetEnvelope {
  success: boolean;
  data?: {
    submissionId: string;
    analysisType: 'DOCUMENT_ANALYZE';
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    provider: 'AXIOM';
    evaluationId?: string;
    pipelineJobId?: string;
  };
}

interface LiveCriterion {
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
  criteria?: LiveCriterion[];
  extractedData?: Record<string, unknown>;
  axiomExtractionResult?: unknown;
  axiomCriteriaResult?: unknown;
}

interface EvaluationEnvelope {
  success: boolean;
  data?: EvaluationRecord;
  error?: { message?: string; code?: string };
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

function parseEvaluationMode(): EvaluationMode {
  const raw = (optionalEnv('AXIOM_LIVE_EVALUATION_MODE') ?? 'COMPLETE_EVALUATION').trim().toUpperCase();
  if (raw === 'EXTRACTION' || raw === 'CRITERIA_EVALUATION' || raw === 'COMPLETE_EVALUATION') {
    return raw;
  }
  throw new Error(
    `Invalid AXIOM_LIVE_EVALUATION_MODE '${raw}'. Expected EXTRACTION, CRITERIA_EVALUATION, or COMPLETE_EVALUATION.`,
  );
}

function requestHeaders(tag: string): Record<string, string> {
  const key = randomUUID();
  return {
    'Idempotency-Key': `${tag}:${key}`,
    'X-Correlation-Id': `${tag}:${key}`,
  };
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

function countInformativeCriteria(criteria: LiveCriterion[] | undefined): number {
  return (criteria ?? []).filter((criterion) => {
    const hasIdentity = typeof criterion.criterionId === 'string' || typeof criterion.criterionName === 'string';
    const hasNarrative = typeof criterion.reasoning === 'string' && criterion.reasoning.trim().length > 0;
    const hasDecision = typeof criterion.evaluation === 'string' && criterion.evaluation.trim().length > 0;
    const hasEvidence = Array.isArray(criterion.documentReferences) && criterion.documentReferences.length > 0;
    const hasSupportingData = Array.isArray(criterion.supportingData) && criterion.supportingData.length > 0;
    return hasIdentity && (hasNarrative || hasDecision || hasEvidence || hasSupportingData);
  }).length;
}

function assertSubstantiveEvaluation(evaluation: EvaluationRecord, evaluationMode: EvaluationMode): void {
  if (evaluation.status !== 'completed') {
    throw new Error(
      `Evaluation '${evaluation.evaluationId}' did not complete successfully. Status='${evaluation.status ?? 'unknown'}'.`,
    );
  }

  if (typeof evaluation.overallRiskScore !== 'number' || !Number.isFinite(evaluation.overallRiskScore)) {
    throw new Error(
      `Evaluation '${evaluation.evaluationId}' is missing a numeric overallRiskScore: ${JSON.stringify(evaluation)}`,
    );
  }

  const informativeCriteriaCount = countInformativeCriteria(evaluation.criteria);
  const hasExtraction = hasMeaningfulContent(evaluation.extractedData) || hasMeaningfulContent(evaluation.axiomExtractionResult);
  const hasCriteriaAggregate = hasMeaningfulContent(evaluation.axiomCriteriaResult);

  if (evaluationMode === 'EXTRACTION' && !hasExtraction) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' completed without substantive extraction output.`);
  }

  if (evaluationMode === 'CRITERIA_EVALUATION' && informativeCriteriaCount === 0 && !hasCriteriaAggregate) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' completed without substantive criteria output.`);
  }

  if (evaluationMode === 'COMPLETE_EVALUATION' && informativeCriteriaCount === 0 && !hasExtraction && !hasCriteriaAggregate) {
    throw new Error(`Evaluation '${evaluation.evaluationId}' completed without substantive extraction or criteria output.`);
  }

  console.log(`✓ overallRiskScore=${evaluation.overallRiskScore}`);
  console.log(`✓ informativeCriteriaCount=${informativeCriteriaCount}`);
  console.log(`✓ hasExtractionOutput=${hasExtraction}`);
  console.log(`✓ hasCriteriaAggregate=${hasCriteriaAggregate}`);
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

  logConfig(context, {
    orderId,
    documentId,
    documentType,
    evaluationMode,
    pollAttempts: poll.attempts,
    pollIntervalMs: poll.intervalMs,
  });

  logSection('Submit: UI-equivalent DOCUMENT_ANALYZE (/api/analysis/submissions)');
  const submitRes = await postJson<SubmitEnvelope>(
    `${context.baseUrl}/api/analysis/submissions`,
    {
      analysisType: 'DOCUMENT_ANALYZE',
      orderId,
      documentId,
      documentType,
      evaluationMode,
    },
    context.authHeader,
    requestHeaders('livefire-analysis-submit'),
  );

  assertStatus(submitRes.status, [202], 'submit analysis', submitRes.data);
  if (!submitRes.data?.success || !submitRes.data?.data?.submissionId) {
    throw new Error(`Submission response missing submissionId: ${JSON.stringify(submitRes.data)}`);
  }

  const submissionId = submitRes.data.data.submissionId;
  let evaluationId = submitRes.data.data.evaluationId;
  const pipelineJobId = submitRes.data.data.pipelineJobId;

  console.log(`✓ submissionId=${submissionId}`);
  console.log(`✓ evaluationId=${evaluationId ?? 'n/a'}`);
  console.log(`✓ pipelineJobId=${pipelineJobId ?? 'n/a'}`);

  logSection('Poll: /api/analysis/submissions/:id?analysisType=DOCUMENT_ANALYZE');
  for (let attempt = 1; attempt <= poll.attempts; attempt++) {
    const getRes = await getJson<SubmissionGetEnvelope>(
      `${context.baseUrl}/api/analysis/submissions/${encodeURIComponent(submissionId)}?analysisType=DOCUMENT_ANALYZE`,
      context.authHeader,
      requestHeaders('livefire-analysis-get'),
    );

    assertStatus(getRes.status, [200], 'get submission', getRes.data);
    const status = getRes.data?.data?.status;
    evaluationId = getRes.data?.data?.evaluationId ?? evaluationId;
    console.log(`… status=${status ?? 'unknown'} (attempt ${attempt}/${poll.attempts})`);

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Submission '${submissionId}' reached terminal failure state '${status}'. Payload: ${JSON.stringify(getRes.data)}`);
    }

    if (status === 'completed') {
      console.log(`✓ terminalStatus=${status}`);
      break;
    }

    await sleep(poll.intervalMs);
  }

  if (!evaluationId) {
    throw new Error(`Submission '${submissionId}' completed without returning an evaluationId.`);
  }

  logSection('Inspect: /api/axiom/evaluations/:evaluationId');
  for (let attempt = 1; attempt <= poll.attempts; attempt++) {
    const evaluationRes = await getJson<EvaluationEnvelope>(
      `${context.baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`,
      context.authHeader,
    );

    assertStatus(evaluationRes.status, [200, 404], 'get evaluation by id', evaluationRes.data);
    if (evaluationRes.status === 404) {
      console.log(`… evaluation not yet available (attempt ${attempt}/${poll.attempts})`);
      await sleep(poll.intervalMs);
      continue;
    }

    if (!evaluationRes.data?.success || !evaluationRes.data.data || !isRecord(evaluationRes.data.data)) {
      throw new Error(`Evaluation lookup returned no substantive payload: ${JSON.stringify(evaluationRes.data)}`);
    }

    assertSubstantiveEvaluation(evaluationRes.data.data, evaluationMode);
    return;
  }

  throw new Error(`Evaluation '${evaluationId}' was not retrievable with substantive results inside the poll window.`);
}

main().catch((error) => {
  console.error(`\n❌ Live-fire analysis submission failed: ${(error as Error).message}`);
  process.exit(1);
});
