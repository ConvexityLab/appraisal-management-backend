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
  const context = await loadLiveFireContext();
  const orderId = required('AXIOM_LIVE_ORDER_ID');
  const pollAttempts = Number(process.env['AXIOM_LIVE_POLL_ATTEMPTS'] ?? '20');
  const pollIntervalMs = Number(process.env['AXIOM_LIVE_POLL_INTERVAL_MS'] ?? '3000');

  const propertyInfo = {
    propertyAddress: required('AXIOM_LIVE_PROPERTY_ADDRESS'),
    propertyCity: required('AXIOM_LIVE_PROPERTY_CITY'),
    propertyState: required('AXIOM_LIVE_PROPERTY_STATE'),
    propertyZip: required('AXIOM_LIVE_PROPERTY_ZIP'),
    propertyType: process.env['AXIOM_LIVE_PROPERTY_TYPE'] ?? 'SFR',
    estimatedValue: Number(process.env['AXIOM_LIVE_ESTIMATED_VALUE'] ?? '550000'),
    loanAmount: Number(process.env['AXIOM_LIVE_LOAN_AMOUNT'] ?? '385000'),
  };

  logConfig(context, { orderId, pollAttempts, pollIntervalMs });

  logSection('Step 1: POST /api/axiom/property/enrich');
  const enrichRes = await postJson<{ success: boolean; data?: { enrichmentId: string; status: string } }>(
    `${context.baseUrl}/api/axiom/property/enrich`,
    {
      orderId,
      clientId: context.clientId,
      propertyInfo,
    },
    context.authHeader,
  );
  assertStatus(enrichRes.status, [202], 'property enrich', enrichRes.data);
  if (!enrichRes.data?.success || !enrichRes.data?.data?.enrichmentId) {
    throw new Error(`property enrich did not return expected success/data: ${JSON.stringify(enrichRes.data)}`);
  }
  console.log(`✓ queued enrichmentId=${enrichRes.data.data.enrichmentId}`);

  logSection('Step 2: GET /api/axiom/property/enrichment/:orderId (poll)');
  let enrichmentFound = false;
  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const getRes = await getJson<{ success: boolean; data?: { id: string; status?: string; orderId: string } }>(
      `${context.baseUrl}/api/axiom/property/enrichment/${orderId}`,
      context.authHeader,
    );

    if (getRes.status === 200 && getRes.data?.success && getRes.data?.data?.orderId === orderId) {
      enrichmentFound = true;
      console.log(`✓ enrichment retrieved on attempt ${attempt} (id=${getRes.data.data.id}, status=${getRes.data.data.status ?? 'n/a'})`);
      break;
    }

    if (getRes.status !== 404) {
      throw new Error(`unexpected enrichment poll status ${getRes.status}: ${JSON.stringify(getRes.data)}`);
    }

    console.log(`… enrichment not yet available (attempt ${attempt}/${pollAttempts})`);
    await sleep(pollIntervalMs);
  }

  if (!enrichmentFound) {
    throw new Error(`No enrichment record found after ${pollAttempts} attempts for orderId=${orderId}`);
  }

  logSection('Step 3: POST /api/axiom/scoring/complexity');
  const complexityRes = await postJson<{ success: boolean; data?: { complexityScore: number } }>(
    `${context.baseUrl}/api/axiom/scoring/complexity`,
    {
      orderId,
      clientId: context.clientId,
      propertyInfo,
    },
    context.authHeader,
  );
  assertStatus(complexityRes.status, [200], 'complexity scoring', complexityRes.data);
  if (!complexityRes.data?.success || typeof complexityRes.data?.data?.complexityScore !== 'number') {
    throw new Error(`complexity response missing score: ${JSON.stringify(complexityRes.data)}`);
  }
  console.log(`✓ complexityScore=${complexityRes.data.data.complexityScore}`);

  logSection('Step 4: GET /api/axiom/scoring/complexity/:orderId');
  const getComplexityRes = await getJson<{ success: boolean; data?: { complexityScore: number; orderId: string } }>(
    `${context.baseUrl}/api/axiom/scoring/complexity/${orderId}`,
    context.authHeader,
  );
  assertStatus(getComplexityRes.status, [200], 'get complexity score', getComplexityRes.data);
  if (!getComplexityRes.data?.success || getComplexityRes.data?.data?.orderId !== orderId) {
    throw new Error(`get complexity response invalid: ${JSON.stringify(getComplexityRes.data)}`);
  }
  console.log(`✓ retrieved stored complexity score for orderId=${orderId}`);

  console.log('\n✅ Property intake live-fire flow passed.');
}

main().catch((error) => {
  console.error(`\n❌ Property intake live-fire failed: ${(error as Error).message}`);
  process.exit(1);
});
