#!/usr/bin/env tsx

import crypto from 'crypto';
import {
  assertStatus,
  getJson,
  loadLiveFireContext,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

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
