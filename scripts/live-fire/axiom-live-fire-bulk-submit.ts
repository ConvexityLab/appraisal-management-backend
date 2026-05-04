#!/usr/bin/env tsx

import {
  assertStatus,
  getJson,
  loadLiveFireContext,
  logConfig,
  logSection,
  sleep,
} from './_axiom-live-fire-common.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number. Received: ${raw}`);
  }
  return parsed;
}

interface SubmitResponse {
  job?: {
    id?: string;
    status?: string;
    totalItems?: number;
  };
  message?: string;
  error?: string;
}

interface JobResponse {
  id?: string;
  status?: string;
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const adapterKey = required('AXIOM_LIVE_BULK_ADAPTER_KEY');
  const analysisType = required('AXIOM_LIVE_ANALYSIS_TYPE');
  const pollAttempts = envNumber('AXIOM_LIVE_POLL_ATTEMPTS', 20);
  const pollIntervalMs = envNumber('AXIOM_LIVE_POLL_INTERVAL_MS', 3000);

  logConfig(context, { adapterKey, analysisType, pollAttempts, pollIntervalMs });

  const timestamp = Date.now();
  const csvName = `live-bulk-${timestamp}.csv`;
  const pdfName = `live-appraisal-${timestamp}.pdf`;
  const loanNumber = `LN-${timestamp}`;
  const externalId = `EXT-${timestamp}`;

  const items = [
    {
      rowIndex: 1,
      loanNumber,
      externalId,
      documentFileName: pdfName,
    },
  ];

  const csvContent = [
    'loanNumber,externalId,documentFileName',
    `${loanNumber},${externalId},${pdfName}`,
  ].join('\n');

  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n';

  const form = new FormData();
  form.set('clientId', context.clientId);
  form.set('adapterKey', adapterKey);
  form.set('analysisType', analysisType);
  form.set('ingestionMode', 'MULTIPART');
  form.set('jobName', `axiom-live-bulk-submit-${timestamp}`);
  form.set('items', JSON.stringify(items));
  form.append('dataFile', new Blob([csvContent], { type: 'text/csv' }), csvName);
  form.append('documents', new Blob([pdfContent], { type: 'application/pdf' }), pdfName);

  logSection('Step 1: POST /api/bulk-ingestion/submit (multipart)');

  const submitRes = await fetch(`${context.baseUrl}/api/bulk-ingestion/submit`, {
    method: 'POST',
    headers: {
      Authorization: context.authHeader.Authorization,
      'x-tenant-id': context.tenantId,
    },
    body: form,
  });

  const submitPayload = (await submitRes.json()) as SubmitResponse;
  assertStatus(submitRes.status, [202], 'bulk ingestion submit', submitPayload);

  const jobId = submitPayload.job?.id;
  if (!jobId) {
    throw new Error(`Submit succeeded but response is missing job.id: ${JSON.stringify(submitPayload)}`);
  }

  console.log(`✓ submit accepted jobId=${jobId}`);

  logSection('Step 2: Poll GET /api/bulk-ingestion/:jobId');

  let lastStatus = 'unknown';
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const jobRes = await getJson<JobResponse>(
      `${context.baseUrl}/api/bulk-ingestion/${encodeURIComponent(jobId)}`,
      {
        Authorization: context.authHeader.Authorization,
        'x-tenant-id': context.tenantId,
      },
    );

    if (jobRes.status === 200) {
      lastStatus = typeof jobRes.data?.status === 'string' ? jobRes.data.status : 'unknown';
      console.log(`✓ job visible attempt ${attempt}/${pollAttempts}: status=${lastStatus}`);

      if (lastStatus === 'COMPLETED' || lastStatus === 'PARTIAL' || lastStatus === 'FAILED' || lastStatus === 'CANCELLED') {
        break;
      }
    } else if (jobRes.status === 404) {
      console.log(`… job not visible yet (attempt ${attempt}/${pollAttempts})`);
    } else {
      throw new Error(`GET /api/bulk-ingestion/${jobId} returned ${jobRes.status}: ${JSON.stringify(jobRes.data)}`);
    }

    await sleep(pollIntervalMs);
  }

  logSection('Result');
  console.log(`✓ bulk submission path is live and persisted (jobId=${jobId}, status=${lastStatus})`);
  console.log('\n✅ Axiom live-fire bulk submit passed.');
}

main().catch((error) => {
  console.error(`\n❌ Axiom live-fire bulk submit failed: ${(error as Error).message}`);
  process.exit(1);
});
