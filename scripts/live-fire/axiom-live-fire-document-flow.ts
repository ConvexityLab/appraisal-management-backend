#!/usr/bin/env tsx

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

async function main(): Promise<void> {
  const context = loadLiveFireContext();
  const orderId = required('AXIOM_LIVE_ORDER_ID');
  const documentUrl = required('AXIOM_LIVE_DOCUMENT_URL');
  const revisedDocumentUrl = required('AXIOM_LIVE_REVISED_DOCUMENT_URL');
  const pollAttempts = Number(process.env['AXIOM_LIVE_POLL_ATTEMPTS'] ?? '20');
  const pollIntervalMs = Number(process.env['AXIOM_LIVE_POLL_INTERVAL_MS'] ?? '3000');

  logConfig(context, { orderId, pollAttempts, pollIntervalMs });

  logSection('Step 1: POST /api/axiom/documents');
  const notifyRes = await postJson<{
    success: boolean;
    data?: { evaluationId: string; pipelineJobId?: string };
    error?: { message: string };
  }>(
    `${context.baseUrl}/api/axiom/documents`,
    {
      orderId,
      documentType: 'appraisal',
      documentUrl,
      metadata: {
        fileName: `live-fire-${Date.now()}.pdf`,
        uploadedBy: 'live-fire-script',
        propertyAddress: process.env['AXIOM_LIVE_PROPERTY_ADDRESS'] ?? 'Unknown',
      },
    },
    context.authHeader,
  );
  assertStatus(notifyRes.status, [202], 'document notify', notifyRes.data);
  if (!notifyRes.data?.success || !notifyRes.data?.data?.evaluationId) {
    throw new Error(`document notify missing evaluationId: ${JSON.stringify(notifyRes.data)}`);
  }
  const evaluationId = notifyRes.data.data.evaluationId;
  console.log(`✓ evaluationId=${evaluationId}`);

  logSection('Step 2: GET /api/axiom/evaluations/:evaluationId');
  const evalByIdRes = await getJson<{ success: boolean; data?: { evaluationId: string; status: string } }>(
    `${context.baseUrl}/api/axiom/evaluations/${evaluationId}`,
    context.authHeader,
  );
  assertStatus(evalByIdRes.status, [200, 404], 'evaluation by id', evalByIdRes.data);
  if (evalByIdRes.status === 200) {
    console.log(`✓ evaluation lookup returned status=${evalByIdRes.data.data?.status}`);
  } else {
    console.log('… evaluation-by-id not yet available (404), continuing to order polling');
  }

  logSection('Step 3: GET /api/axiom/evaluations/order/:orderId (poll)');
  let foundOrderEvaluation = false;
  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const orderEvalRes = await getJson<{ success: boolean; data?: Array<{ evaluationId: string; status?: string }> }>(
      `${context.baseUrl}/api/axiom/evaluations/order/${orderId}`,
      context.authHeader,
    );

    if (orderEvalRes.status === 200 && orderEvalRes.data?.success && Array.isArray(orderEvalRes.data?.data)) {
      const found = orderEvalRes.data.data.find((item) => item.evaluationId === evaluationId);
      if (found) {
        foundOrderEvaluation = true;
        console.log(`✓ evaluation surfaced in order list on attempt ${attempt} (status=${found.status ?? 'n/a'})`);
        break;
      }
    } else if (orderEvalRes.status !== 404) {
      throw new Error(`unexpected order evaluation status ${orderEvalRes.status}: ${JSON.stringify(orderEvalRes.data)}`);
    }

    console.log(`… evaluation not yet visible for order (attempt ${attempt}/${pollAttempts})`);
    await sleep(pollIntervalMs);
  }

  if (!foundOrderEvaluation) {
    throw new Error(`evaluationId=${evaluationId} did not appear under orderId=${orderId} within poll window`);
  }

  logSection('Step 4: POST /api/axiom/documents/compare');
  const compareRes = await postJson<{
    success: boolean;
    data?: { comparisonId?: string; status?: string };
  }>(
    `${context.baseUrl}/api/axiom/documents/compare`,
    {
      orderId,
      originalDocumentUrl: documentUrl,
      revisedDocumentUrl,
      metadata: {
        reason: 'live-fire regression comparison',
      },
    },
    context.authHeader,
  );
  assertStatus(compareRes.status, [202], 'document compare', compareRes.data);
  if (!compareRes.data?.success) {
    throw new Error(`document comparison did not return success: ${JSON.stringify(compareRes.data)}`);
  }
  const comparisonId = compareRes.data?.data?.comparisonId;
  console.log(`✓ comparison queued${comparisonId ? ` (comparisonId=${comparisonId})` : ''}`);

  if (comparisonId) {
    logSection('Step 5: GET /api/axiom/comparisons/:comparisonId');
    const getComparisonRes = await getJson<{ success: boolean; data?: { comparisonId: string; status?: string } }>(
      `${context.baseUrl}/api/axiom/comparisons/${comparisonId}`,
      context.authHeader,
    );
    assertStatus(getComparisonRes.status, [200, 404], 'get comparison', getComparisonRes.data);
    if (getComparisonRes.status === 200 && getComparisonRes.data?.success) {
      console.log(`✓ comparison retrieval returned status=${getComparisonRes.data.data?.status}`);
    } else {
      console.log('… comparison retrieval returned 404 (accepted for async upstream timing)');
    }
  }

  console.log('\n✅ Document flow live-fire passed.');
}

main().catch((error) => {
  console.error(`\n❌ Document flow live-fire failed: ${(error as Error).message}`);
  process.exit(1);
});
