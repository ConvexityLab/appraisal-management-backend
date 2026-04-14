#!/usr/bin/env tsx

import crypto from 'crypto';
import {
  assertStatus,
  getJson,
  hasMeaningfulContent,
  loadLiveFireContext,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

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

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function signatureForBody(body: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('hex');
  return `hmac-sha256=${digest}`;
}

function assertSubstantiveEvaluation(payload: EvaluationEnvelope['data']): void {
  if (!payload) {
    throw new Error('Evaluation payload was empty.');
  }

  if (payload.status !== 'completed') {
    throw new Error(`Evaluation '${payload.evaluationId}' did not complete successfully. Status='${payload.status ?? 'unknown'}'.`);
  }

  if (typeof payload.overallRiskScore !== 'number' || !Number.isFinite(payload.overallRiskScore)) {
    throw new Error(`Evaluation '${payload.evaluationId}' is missing a numeric overallRiskScore.`);
  }

  const informativeCriteria = (payload.criteria ?? []).filter((criterion) => {
    const hasIdentity = Boolean(criterion.criterionId || criterion.criterionName);
    const hasReasoning = typeof criterion.reasoning === 'string' && criterion.reasoning.trim().length > 0;
    const hasDecision = typeof criterion.evaluation === 'string' && criterion.evaluation.trim().length > 0;
    const hasRefs = Array.isArray(criterion.documentReferences) && criterion.documentReferences.length > 0;
    return hasIdentity && (hasReasoning || hasDecision || hasRefs);
  }).length;

  const hasExtraction = hasMeaningfulContent(payload.extractedData) || hasMeaningfulContent(payload.axiomExtractionResult);
  const hasCriteriaAggregate = hasMeaningfulContent(payload.axiomCriteriaResult);

  if (informativeCriteria === 0 && !hasExtraction && !hasCriteriaAggregate) {
    throw new Error(`Evaluation '${payload.evaluationId}' completed without substantive extracted or criteria data.`);
  }

  console.log(`✓ overallRiskScore=${payload.overallRiskScore}`);
  console.log(`✓ informativeCriteriaCount=${informativeCriteria}`);
  console.log(`✓ hasExtractionOutput=${hasExtraction}`);
  console.log(`✓ hasCriteriaAggregate=${hasCriteriaAggregate}`);
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const orderId = required('AXIOM_LIVE_ORDER_ID');
  const documentId = required('AXIOM_LIVE_DOCUMENT_ID');
  const pollAttempts = Number(process.env['AXIOM_LIVE_POLL_ATTEMPTS'] ?? '20');
  const pollIntervalMs = Number(process.env['AXIOM_LIVE_POLL_INTERVAL_MS'] ?? '3000');
  const webhookSecret = process.env['AXIOM_LIVE_WEBHOOK_SECRET']?.trim();

  logConfig(context, { orderId, documentId, pollAttempts, pollIntervalMs });

  logSection('Step 1: POST /api/axiom/analyze');
  const analyzeRes = await postJson<{
    success: boolean;
    data?: { evaluationId: string; pipelineJobId?: string };
  }>(
    `${context.baseUrl}/api/axiom/analyze`,
    {
      orderId,
      documentId,
      documentType: 'appraisal',
      forceResubmit: true,
    },
    context.authHeader,
  );
  assertStatus(analyzeRes.status, [202], 'analyze document', analyzeRes.data);
  if (!analyzeRes.data?.success || !analyzeRes.data?.data?.evaluationId) {
    throw new Error(`analyze response missing evaluationId: ${JSON.stringify(analyzeRes.data)}`);
  }
  const evaluationId = analyzeRes.data.data.evaluationId;
  console.log(`✓ analyze queued evaluationId=${evaluationId}`);

  logSection('Step 2: Poll GET /api/axiom/evaluations/order/:orderId for analyze evaluation');
  let found = false;
  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const orderEvalRes = await getJson<{ success: boolean; data?: Array<{ evaluationId: string; status?: string }> }>(
      `${context.baseUrl}/api/axiom/evaluations/order/${orderId}`,
      context.authHeader,
    );

    if (orderEvalRes.status === 200 && orderEvalRes.data?.success && Array.isArray(orderEvalRes.data?.data)) {
      const matched = orderEvalRes.data.data.find((item) => item.evaluationId === evaluationId);
      if (matched) {
        found = true;
        console.log(`✓ analyze evaluation appears on attempt ${attempt} (status=${matched.status ?? 'n/a'})`);
        break;
      }
    } else if (orderEvalRes.status !== 404) {
      throw new Error(`unexpected order evaluations status ${orderEvalRes.status}: ${JSON.stringify(orderEvalRes.data)}`);
    }

    console.log(`… analyze evaluation pending (attempt ${attempt}/${pollAttempts})`);
    await sleep(pollIntervalMs);
  }

  if (!found) {
    throw new Error(`analyze evaluationId=${evaluationId} did not appear under orderId=${orderId}`);
  }

  logSection('Step 2b: GET /api/axiom/evaluations/:evaluationId');
  let verifiedEvaluation = false;
  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const evaluationRes = await getJson<EvaluationEnvelope>(
      `${context.baseUrl}/api/axiom/evaluations/${encodeURIComponent(evaluationId)}?bypassCache=true`,
      context.authHeader,
    );

    assertStatus(evaluationRes.status, [200, 404], 'get evaluation by id', evaluationRes.data);
    if (evaluationRes.status === 404) {
      console.log(`… evaluation payload pending (attempt ${attempt}/${pollAttempts})`);
      await sleep(pollIntervalMs);
      continue;
    }

    assertSubstantiveEvaluation(evaluationRes.data?.data);
    verifiedEvaluation = true;
    break;
  }

  if (!verifiedEvaluation) {
    throw new Error(`Evaluation '${evaluationId}' never produced a substantive completed payload.`);
  }

  logSection('Step 3: POST /api/axiom/webhook unsigned');
  const unsignedPayload = {
    correlationId: orderId,
    correlationType: 'ORDER',
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
  const unsignedRes = await postJson<Record<string, unknown>>(
    `${context.baseUrl}/api/axiom/webhook`,
    unsignedPayload,
    {},
  );

  if (webhookSecret) {
    assertStatus(unsignedRes.status, [401], 'unsigned webhook with configured secret', unsignedRes.data);
    console.log('✓ unsigned webhook correctly rejected (401)');
  } else if (unsignedRes.status === 401) {
    console.log('✓ unsigned webhook correctly rejected (401) because the backend requires a signature');
  } else {
    assertStatus(unsignedRes.status, [200], 'unsigned webhook in non-secret mode', unsignedRes.data);
    console.log('✓ unsigned webhook accepted (expected when no secret is configured outside production)');
  }

  if (webhookSecret) {
    logSection('Step 4: POST /api/axiom/webhook signed');
    const signedBodyObject = {
      correlationId: orderId,
      correlationType: 'ORDER',
      status: 'completed',
      timestamp: new Date().toISOString(),
      result: {
        evaluationId,
        overallRiskScore: 55,
        criteria: [],
      },
    };
    const signedBody = JSON.stringify(signedBodyObject);
    const signature = signatureForBody(signedBody, webhookSecret);

    const signedRes = await postJson<Record<string, unknown>>(
      `${context.baseUrl}/api/axiom/webhook`,
      signedBodyObject,
      { 'content-type': 'application/json' },
      { 'x-axiom-signature': signature },
    );
    assertStatus(signedRes.status, [200], 'signed webhook with configured secret', signedRes.data);
    console.log('✓ signed webhook accepted (200)');
  }

  console.log('\n✅ Analyze + webhook live-fire passed.');
}

main().catch((error) => {
  console.error(`\n❌ Analyze + webhook live-fire failed: ${(error as Error).message}`);
  process.exit(1);
});
