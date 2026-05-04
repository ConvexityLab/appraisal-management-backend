#!/usr/bin/env tsx
/**
 * Bulk-Upload End-to-End Live-Fire Script
 *
 * Uploads a CSV file and PDFs to the staging storage container, then watches
 * the entire execution pipeline until the bulk-ingestion job reaches a terminal
 * state (COMPLETED or FAILED).
 *
 * Auth: uses InteractiveBrowserCredential (real Azure AD token via the frontend
 * app registration). A browser window will open for login on first run; the
 * token is then used for both BlobServiceClient uploads and API calls.
 *
 * ─── HOW TO RUN (staging) ────────────────────────────────────────────────────
 *
 *   cd C:\source\appraisal-management-backend
 *   $env:BULK_UPLOAD_STORAGE_ACCOUNT_NAME = "apprstaginglqxl5vst"
 *   $env:APPRAISAL_API_BASE_URL           = "https://ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io"
 *   $env:AZURE_API_CLIENT_ID              = "dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a"
 *   $env:AZURE_AUTH_CLIENT_ID             = "ee1cad4a-3049-409d-96e4-70c73fad2139"
 *   $env:AZURE_TENANT_ID                  = "885097ba-35ea-48db-be7a-a0aa7ff451bd"
 *   npx tsx scripts/live-fire/bulk-upload-e2e.ts
 *
 * ─── STAGING RESOURCE REFERENCE ─────────────────────────────────────────────
 *
 *   Azure AD tenant          : 885097ba-35ea-48db-be7a-a0aa7ff451bd
 *   API app registration     : dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a  (audience / AZURE_API_CLIENT_ID)
 *   Frontend app registration: ee1cad4a-3049-409d-96e4-70c73fad2139  (AZURE_AUTH_CLIENT_ID — has native redirect http://localhost)
 *   Storage account          : apprstaginglqxl5vst
 *   Storage container        : bulk-upload
 *   Storage queue            : bulk-upload-events  (Event Grid BlobCreated target)
 *   API container app        : ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io
 *   Resource group           : rg-appraisal-mgmt-staging-eastus
 *   Key Vault                : kvapprmstastanktl4a
 *   API managed identity     : principalId 23e6b738-0bde-4eb7-99c5-f0cd24ea9ee0
 *                              clientId    9b6fa4b8-07f9-4778-bdd8-225edf6ba909
 *
 * ─── BLOB PATH CONVENTION ────────────────────────────────────────────────────
 *
 *   bulk-upload/{tenantId}/{clientId}/{adapterKey}/{filename}
 *   e.g. bulk-upload/test-tenant/test-client/statebridge-{suffix}/loans.csv
 *
 * ─── ENVIRONMENT VARIABLES ───────────────────────────────────────────────────
 *
 * Required:
 *   BULK_UPLOAD_STORAGE_ACCOUNT_NAME — staging storage account name
 *   APPRAISAL_API_BASE_URL           — API base URL (no trailing slash)
 *   AZURE_API_CLIENT_ID              — API app registration client ID (token audience)
 *   AZURE_AUTH_CLIENT_ID             — frontend app registration client ID (browser login)
 *   AZURE_TENANT_ID                  — Azure AD tenant ID
 *
 * Optional:
 *   BULK_UPLOAD_TEST_TENANT_ID   — (default: test-tenant)
 *   BULK_UPLOAD_TEST_CLIENT_ID   — (default: test-client)
 *   BULK_UPLOAD_TEST_ADAPTER_KEY — (default: statebridge)
 *   BULK_UPLOAD_POLL_TIMEOUT_MS  — total timeout waiting for job (default: 300000 = 5 min)
 *   BULK_UPLOAD_POLL_INTERVAL_MS — polling interval (default: 5000 = 5 s)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureCliCredential, InteractiveBrowserCredential } from '@azure/identity';
import axios from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Set it in .env or export it before running this script.`,
    );
  }
  return v.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || !v.trim()) return fallback;
  const n = Number(v.trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number. Got: ${v}`);
  }
  return n;
}

// ─── Test PDF path (relative to repo root) ─────────────────────────────────

const TEST_PDF_PATH = resolve(process.cwd(), 'docs/samples/URAR-Example.pdf');

// ─── Logging helpers ─────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  console.log(`[${ts}] ${msg}`);
}

function printSection(title: string): void {
  console.log('');
  console.log(`${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

// ─── Auth token generation ────────────────────────────────────────────────────

function makeTestToken(tenantId: string, secret: string): string {
  // Must match the shape TestTokenGenerator uses so unified-auth middleware
  // accepts it when ALLOW_TEST_TOKENS=true.  Fields required: isTestToken,
  // iss: 'appraisal-management-test', aud: 'appraisal-management-api'.
  return jwt.sign(
    {
      sub: 'bulk-upload-e2e-script',
      email: 'e2e@bulk-upload-test.internal',
      name: 'Bulk Upload E2E',
      role: 'admin',
      tenantId,
      iss: 'appraisal-management-test',
      aud: 'appraisal-management-api',
      isTestToken: true,
    },
    secret,
    { expiresIn: '1h' },
  );
}

// ─── Blob upload ──────────────────────────────────────────────────────────────

async function uploadBlob(
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  content: Buffer,
  contentType: string,
): Promise<string> {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  return blockBlobClient.url;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

interface ItemCanonicalRecord {
  orderId?: string;
  axiomCorrelationId?: string;
  axiomPipelineJobId?: string;
  axiomExtractionStatus?: string;
  axiomSubmittedAt?: string;
  [key: string]: unknown;
}

interface BulkIngestionItemDetail {
  id: string;
  rowIndex: number;
  status: string;
  source?: {
    loanNumber?: string;
    externalId?: string;
    propertyAddress?: string;
    documentFileName?: string;
  };
  canonicalRecord?: ItemCanonicalRecord;
  failures?: Array<{ stage: string; code: string; message: string }>;
}

interface BulkIngestionJob {
  id: string;
  jobId?: string;
  jobName: string;
  status: string;
  totalItems: number;
  successItems: number;
  failedItems: number;
  pendingItems: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  adapterKey?: string;
  ingestionMode?: string;
  tenantId?: string;
  clientId?: string;
  items?: BulkIngestionItemDetail[];
}

interface BulkIngestionListResponse {
  jobs?: BulkIngestionJob[];
  data?: BulkIngestionJob[];
}

async function listJobs(
  baseUrl: string,
  authHeader: string,
  tenantId: string,
  clientId: string,
): Promise<BulkIngestionJob[]> {
  const resp = await axios.get<BulkIngestionListResponse>(
    `${baseUrl}/api/bulk-ingestion`,
    {
      params: { clientId },
      headers: {
        Authorization: authHeader,
        'x-tenant-id': tenantId,
      },
      validateStatus: () => true,
    },
  );

  if (resp.status !== 200) {
    throw new Error(
      `GET /api/bulk-ingestion returned ${resp.status}: ${JSON.stringify(resp.data)}`,
    );
  }

  // The API returns a plain array — guard against {jobs:[]} or {data:[]} wrappers
  // that legacy callers may have expected.
  const raw = resp.data as unknown;
  if (Array.isArray(raw)) return raw as BulkIngestionJob[];
  const obj = raw as Record<string, unknown>;
  return ((obj['jobs'] ?? obj['data'] ?? []) as BulkIngestionJob[]);
}

async function getJob(
  baseUrl: string,
  authHeader: string,
  tenantId: string,
  jobId: string,
): Promise<BulkIngestionJob | null> {
  const resp = await axios.get<BulkIngestionJob>(
    `${baseUrl}/api/bulk-ingestion/${jobId}`,
    {
      headers: {
        Authorization: authHeader,
        'x-tenant-id': tenantId,
      },
      validateStatus: () => true,
    },
  );

  if (resp.status === 404) return null;
  if (resp.status !== 200) {
    throw new Error(
      `GET /api/bulk-ingestion/${jobId} returned ${resp.status}: ${JSON.stringify(resp.data)}`,
    );
  }

  return resp.data;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toUpperCase());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Load config ────────────────────────────────────────────────────────────
  const storageAccountName = requiredEnv('BULK_UPLOAD_STORAGE_ACCOUNT_NAME');
  const apiBaseUrl = requiredEnv('APPRAISAL_API_BASE_URL').replace(/\/$/, '');
  const apiClientId = requiredEnv('AZURE_API_CLIENT_ID');
  const authClientId = requiredEnv('AZURE_AUTH_CLIENT_ID'); // frontend app registration
  const azureTenantId = requiredEnv('AZURE_TENANT_ID');
  const tenantId = optionalEnv('BULK_UPLOAD_TEST_TENANT_ID', 'test-tenant');
  const clientId = optionalEnv('BULK_UPLOAD_TEST_CLIENT_ID', 'test-client');
  const adapterKey = optionalEnv('BULK_UPLOAD_TEST_ADAPTER_KEY', 'statebridge');
  // analysisType is embedded in the blob path and determines productType on created orders.
  // Dev Cosmos seed is registered for FNMA-URAR criteria — use QUICK_REVIEW unless overridden.
  const analysisType = optionalEnv('BULK_UPLOAD_TEST_ANALYSIS_TYPE', 'QUICK_REVIEW');
  const pollTimeoutMs = envNumber('BULK_UPLOAD_POLL_TIMEOUT_MS', 300_000);
  const pollIntervalMs = envNumber('BULK_UPLOAD_POLL_INTERVAL_MS', 5_000);

  // Unique run suffix prevents collisions between script runs
  const runId = Date.now().toString(36);
  const adapterKeyWithRunId = `${adapterKey}-${runId}`;
  // Path convention: {tenantId}/{clientId}/{adapterKey}/{analysisType}/{filename}
  const prefix = `${tenantId}/${clientId}/${adapterKeyWithRunId}/${analysisType}`;
  const csvBlobName = `${prefix}/loans.csv`;

  const containerName = 'bulk-upload';

  printSection('Bulk Upload E2E — Configuration');
  log(`Storage account : ${storageAccountName}  (BULK_UPLOAD_STORAGE_ACCOUNT_NAME)`);
  log(`API base URL    : ${apiBaseUrl}`);
  log(`Auth client ID  : ${authClientId}  (frontend app reg with user_impersonation)`);
  log(`API client ID   : ${apiClientId}  (audience)`);
  log(`Tenant ID       : ${azureTenantId}`);
  log(`Tenant ID       : ${tenantId}`);
  log(`Client ID       : ${clientId}`);
  log(`Adapter key     : ${adapterKeyWithRunId}`);
  log(`Analysis type   : ${analysisType}  (BULK_UPLOAD_TEST_ANALYSIS_TYPE)`);
  log(`Blob prefix     : ${prefix}  [{tenantId}/{clientId}/{adapterKey}/{analysisType}]`);
  log(`  Server needs  : AXIOM_PROGRAM_ID=FNMA-URAR  AXIOM_PROGRAM_VERSION=1.0.0`);
  log(`Poll timeout    : ${pollTimeoutMs / 1000}s`);
  log(`Poll interval   : ${pollIntervalMs / 1000}s`);

  // Acquire a real Azure AD access token using the same app registration the
  // frontend uses (ee1cad4a...). Opens a browser window for interactive login.
  // NOTE: authCredential cannot be used for BlobServiceClient — the frontend
  // app reg (ee1cad4a) does not have Azure Storage in its permitted resources.
  // blobCredential uses AzureCliCredential (az login on Windows) instead.
  const authCredential = new InteractiveBrowserCredential({
    clientId: authClientId,
    tenantId: azureTenantId,
    redirectUri: 'http://localhost',
  });
  const scope = `api://${apiClientId}/user_impersonation`;
  log(`Acquiring Azure AD token via browser (scope: ${scope}) …`);
  log('  A browser window will open — sign in with your Azure account.');
  let tokenResponse;
  try {
    tokenResponse = await authCredential.getToken(scope);
  } catch (err) {
    throw new Error(
      `Token acquisition failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!tokenResponse?.token) {
    throw new Error('Token acquisition returned empty token.');
  }
  const authHeader = `Bearer ${tokenResponse.token}`;
  log('  ✓ Access token acquired');

  // ── Phase 1: Build payloads ────────────────────────────────────────────────
  printSection('Phase 1 — Building test payloads');

  // Read the real URAR sample PDF from disk — fail fast if missing
  let pdfContent: Buffer;
  try {
    pdfContent = readFileSync(TEST_PDF_PATH);
  } catch {
    throw new Error(
      `Cannot read test PDF at ${TEST_PDF_PATH}\n` +
      `Run this script from the repo root: npx tsx scripts/live-fire/bulk-upload-e2e.ts`,
    );
  }

  // Each row references its own document blob name — the PDF will be uploaded
  // once per row under that exact name so the listener can correlate them.
  const loanRows = [
    { loanNumber: 'LOAN-E2E-001', address: '123 Main St, Test City, TX 75001',   externalId: 'EXT-001', documentFileName: 'appraisal-LOAN-E2E-001.pdf' },
    { loanNumber: 'LOAN-E2E-002', address: '456 Oak Ave, Sample Town, CA 90210', externalId: 'EXT-002', documentFileName: 'appraisal-LOAN-E2E-002.pdf' },
    { loanNumber: 'LOAN-E2E-003', address: '789 Pine Rd, Nowhere, NY 10001',     externalId: 'EXT-003', documentFileName: 'appraisal-LOAN-E2E-003.pdf' },
  ];

  const csvLines = [
    'loan_number,property_address,external_id,document_file_name',
    ...loanRows.map((r) => `${r.loanNumber},"${r.address}",${r.externalId},${r.documentFileName}`),
  ];
  const csvContent = Buffer.from(csvLines.join('\n'), 'utf8');

  log(`CSV content (${csvContent.length} bytes):`);
  csvLines.forEach((line) => log(`  ${line}`));
  log(`Source PDF    : ${TEST_PDF_PATH}  (${pdfContent.length} bytes)`);
  log(`Will upload ${loanRows.length} copies of the PDF, one per loan row.`);

  // ── Phase 2: Upload blobs ─────────────────────────────────────────────────
  printSection('Phase 2 — Uploading blobs to Azure Storage');

  // AzureCliCredential uses `az account get-access-token --resource https://storage.azure.com`
  // which works with any az login session on Windows (no app-reg permissions needed).
  const blobCredential = new AzureCliCredential({ tenantId: azureTenantId });
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    blobCredential,
  );

  // Upload one PDF copy per loan row under the exact name referenced in the CSV.
  // All PDFs must exist before the CSV is uploaded so the listener can resolve them.
  for (const row of loanRows) {
    const blobName = `${prefix}/${row.documentFileName}`;
    log(`Uploading PDF for ${row.loanNumber}: ${blobName}`);
    const url = await uploadBlob(blobServiceClient, containerName, blobName, pdfContent, 'application/pdf');
    log(`  ✓ uploaded → ${url}`);
  }

  // Upload CSV last — this is the trigger file that Event Grid fires on.
  // The job ignores non-CSV blobs for triggering, so PDF must already exist
  // before the listener processes the CSV event so it can list sibling blobs.
  log(`Uploading CSV (trigger file): ${csvBlobName}`);
  const csvUrl = await uploadBlob(blobServiceClient, containerName, csvBlobName, csvContent, 'text/csv');
  log(`  ✓ CSV uploaded  → ${csvUrl}`);
  log(`Both files uploaded. Event Grid will send BlobCreated for the CSV to the bulk-upload-events queue.`);

  // ── Phase 3: Wait for BulkIngestionJob to appear ──────────────────────────
  printSection('Phase 3 — Waiting for BulkIngestionJob to be created');
  log(`Polling GET /api/bulk-ingestion every ${pollIntervalMs / 1000}s …`);

  const csvUploadedAt = new Date();
  let foundJob: BulkIngestionJob | null = null;

  const elapsedMs = (): number => Date.now() - csvUploadedAt.getTime();

  while (elapsedMs() < pollTimeoutMs) {
    await sleep(pollIntervalMs);

    let jobs: BulkIngestionJob[];
    try {
      jobs = await listJobs(apiBaseUrl, authHeader, tenantId, clientId);
    } catch (err) {
      log(`  WARN: list request failed — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Find a job whose name contains our unique prefix (adapter key with runId)
    const match = jobs.find((j) => {
      if (j.jobName && j.jobName.includes(adapterKeyWithRunId)) return true;
      // Fallback: recently submitted job for this clientId
      const submittedAt = new Date((j as any).submittedAt).getTime();
      return !isNaN(submittedAt) && submittedAt >= csvUploadedAt.getTime() - 5_000 && j.clientId === clientId;
    });

    if (match) {
      const jobId = match.id ?? match.jobId ?? '';
      log(`  ✓ Job found after ${Math.round(elapsedMs() / 1000)}s  jobId=${jobId}  name="${match.jobName}"`);
      foundJob = { ...match, id: jobId };
      break;
    }

    log(`  … ${Math.round(elapsedMs() / 1000)}s elapsed — job not yet visible (${jobs.length} jobs listed). Waiting…`);
  }

  if (!foundJob) {
    printSection('TIMEOUT');
    log(`ERROR: No bulk-ingestion job appeared within ${pollTimeoutMs / 1000}s.`);
    log('Possible causes:');
    log('  • Event Grid subscription is not wired up yet (check Azure portal → Event Grid System Topics)');
    log('  • BulkUploadEventListenerJob is not running (check container logs)');
    log('  • BULK_UPLOAD_STORAGE_ACCOUNT_NAME env var not set on the container app');
    log('  • Queue "bulk-upload-events" is not receiving messages (check Storage → Queues)');
    process.exit(1);
  }

  const jobId = foundJob.id;

  // ── Phase 4a: Wait for bulk ingestion job to reach a terminal status ────────
  printSection('Phase 4a — Waiting for bulk ingestion job to complete');
  log(`Polling GET /api/bulk-ingestion/${jobId} every ${pollIntervalMs / 1000}s …`);

  const itemSnapshots = new Map<string, string>(); // itemId → status
  let lastJobStatus = '';
  let terminalJob: BulkIngestionJob | null = null;

  function loanLabel(item: BulkIngestionItemDetail): string {
    const ln = item.source?.loanNumber ?? `row[${item.rowIndex}]`;
    return ln.padEnd(14);
  }

  function printItemRow(item: BulkIngestionItemDetail): void {
    const cr = item.canonicalRecord ?? {};
    const orderId = String(cr['orderId'] ?? '—');
    const axiomJobId = String(cr['axiomPipelineJobId'] ?? '—');
    const axiomStatus = String(cr['axiomExtractionStatus'] ?? '—');
    log(
      `    ${loanLabel(item)}  item=${item.status.padEnd(12)}  ` +
      `order=${orderId.padEnd(38)}  ` +
      `axiomJob=${axiomJobId.padEnd(38)}  axiomStatus=${axiomStatus}`,
    );
    if (item.failures && item.failures.length > 0) {
      for (const f of item.failures) {
        log(`      ↳ FAILURE  stage=${f.stage}  code=${f.code}  msg=${f.message}`);
      }
    }
  }

  while (elapsedMs() < pollTimeoutMs) {
    await sleep(pollIntervalMs);

    let job: BulkIngestionJob | null;
    try {
      job = await getJob(apiBaseUrl, authHeader, tenantId, jobId);
    } catch (err) {
      log(`  WARN: poll request failed — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!job) {
      log(`  WARN: job ${jobId} returned 404 unexpectedly. Retrying…`);
      continue;
    }

    // Job-level status transition
    if (job.status !== lastJobStatus) {
      log(`  ► JOB STATUS: ${lastJobStatus || '(initial)'} → ${job.status}  [${Math.round(elapsedMs() / 1000)}s]`);
      lastJobStatus = job.status;
    }

    // Per-item status transitions
    const items = job.items ?? [];
    let anyItemChanged = false;
    for (const item of items) {
      const prev = itemSnapshots.get(item.id);
      if (prev !== item.status) {
        if (!anyItemChanged) {
          log(`  ── Item updates at ${Math.round(elapsedMs() / 1000)}s ──`);
          anyItemChanged = true;
        }
        printItemRow(item);
        itemSnapshots.set(item.id, item.status);
      }
    }

    const total      = job.totalItems;
    const done       = job.successItems;
    const failed     = job.failedItems;
    const processing = job.pendingItems;
    const pct        = total > 0 ? Math.round((done / total) * 100) : 0;
    log(
      `  … ${Math.round(elapsedMs() / 1000)}s  ` +
      `total=${total}  done=${done}(${pct}%)  pending=${processing}  failed=${failed}`,
    );

    if (isTerminal(job.status)) {
      terminalJob = job;
      log(`  ✓ Bulk ingestion job reached terminal status: ${job.status}`);
      break;
    }
  }

  if (!terminalJob) {
    printSection('TIMEOUT');
    log(`ERROR: Bulk ingestion job did not reach a terminal state within ${pollTimeoutMs / 1000}s.`);
    process.exit(1);
  }

  // ── Phase 4b: Stream Axiom pipeline events per order via SSE ─────────────────
  printSection('Phase 4b — Streaming Axiom pipeline results (SSE)');

  // Collect orderIds from the completed job items
  const orderIds = (terminalJob.items ?? [])
    .map((item) => String(item.canonicalRecord?.['orderId'] ?? '').trim())
    .filter(Boolean);

  if (orderIds.length === 0) {
    log('  WARN: No order IDs found in job items — items may not have been canonicalized yet.');
    log('  Tip: check item canonicalRecord.orderId — it is set when the order is created in Cosmos.');
  } else {
    log(`  Found ${orderIds.length} order(s) to stream:`);
    for (const id of orderIds) log(`    • ${id}`);
    log('');
    log('  Opening parallel SSE connections — events will stream live as Axiom processes each appraisal …');
    log('');

    // Open one SSE stream per order; all run concurrently.
    // consumeOrderStream resolves when the Axiom pipeline terminates or the stream closes.
    await Promise.all(
      orderIds.map((orderId) => consumeOrderStream(apiBaseUrl, authHeader, tenantId, orderId)),
    );

    log('');
    log('  ✓ All Axiom SSE streams closed.');
  }

  // ── Phase 5: Final report ─────────────────────────────────────────────────
  printSection('Phase 5 — Final report');

  if (!terminalJob) {
    log(`ERROR: Job did not reach a terminal state within ${pollTimeoutMs / 1000}s.`);
    log(`Last known status: ${lastJobStatus || '(unknown)'}`);
    process.exit(1);
  }

  const elapsed = elapsedMs();
  log(`Job ID       : ${jobId}`);
  log(`Final status : ${terminalJob.status}`);
  log(`Total items  : ${terminalJob.totalItems}`);
  log(`Completed    : ${terminalJob.successItems}`);
  log(`Failed       : ${terminalJob.failedItems}`);
  log(`Elapsed      : ${Math.round(elapsed / 1000)}s`);
  log('');
  log('Per-item Axiom extraction summary:');
  log(`  ${'LOAN'.padEnd(14)}  ${'ITEM STATUS'.padEnd(12)}  ${'ORDER ID'.padEnd(38)}  ${'AXIOM JOB ID'.padEnd(38)}  AXIOM STATUS`);
  log(`  ${'─'.repeat(14)}  ${'─'.repeat(12)}  ${'─'.repeat(38)}  ${'─'.repeat(38)}  ${'─'.repeat(20)}`);
  for (const item of terminalJob.items ?? []) {
    printItemRow(item);
  }
  log('');

  if (terminalJob.status === 'COMPLETED' && terminalJob.failedItems === 0) {
    log('SUCCESS — all items processed and Axiom extraction dispatched.');
    process.exit(0);
  } else if ((terminalJob.status === 'COMPLETED' || terminalJob.status === 'PARTIAL') && terminalJob.failedItems > 0) {
    log(`PARTIAL — job completed but ${terminalJob.failedItems} item(s) failed.`);
    log(`Inspect failures: GET /api/bulk-ingestion/${jobId}/failures`);
    process.exit(1);
  } else {
    log(`FAILED — job reached status "${terminalJob.status}".`);
    log(`Inspect failures: GET /api/bulk-ingestion/${jobId}/failures`);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

/**
 * Open an SSE connection to /api/axiom/evaluations/order/:orderId/stream and
 * print each event until the stream closes or a terminal event arrives.
 * The server-side handler waits up to 30 s for the Axiom pipeline job ID to
 * appear on the order, then proxies the raw Axiom /observe stream.
 */
async function consumeOrderStream(
  baseUrl: string,
  authHeader: string,
  tenantId: string,
  orderId: string,
): Promise<void> {
  const short = orderId.slice(-16);
  log(`  [SSE:${short}]  opening stream for order ${orderId} …`);

  let stream: import('stream').Readable;
  try {
    const resp = await axios.get(
      `${baseUrl}/api/axiom/evaluations/order/${orderId}/stream`,
      {
        responseType: 'stream',
        headers: {
          Authorization: authHeader,
          'x-tenant-id': tenantId,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        // No axios-level timeout — the server stream is long-lived.
        // The server will 409 after 30 s if Axiom hasn't triggered yet.
        timeout: 0,
      },
    );
    stream = resp.data as import('stream').Readable;
  } catch (err) {
    log(`  [SSE:${short}]  ERROR opening stream: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const TERMINAL_EVENTS = new Set([
    'pipeline_completed', 'pipeline_failed', 'COMPLETE', 'error',
  ]);

  return new Promise<void>((resolve) => {
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let currentEventType = '';
    let done = false;

    const finish = (): void => {
      if (done) return;
      done = true;
      rl.close();
      stream.destroy();
      resolve();
    };

    rl.on('line', (line) => {
      if (line.startsWith('event:')) {
        currentEventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const dataStr = line.slice(5).trim();
        if (!dataStr) return;

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(dataStr) as Record<string, unknown>;
        } catch {
          log(`  [SSE:${short}]  raw=${dataStr}`);
          currentEventType = '';
          return;
        }

        const eventName = currentEventType || (parsed['type'] as string) || 'message';
        const stage   = (parsed['stageName'] ?? parsed['stage'] ?? '') as string;
        const status  = (parsed['status'] ?? '') as string;
        log(
          `  [SSE:${short}]  event=${eventName.padEnd(22)}` +
          (stage  ? `  stage=${stage}`   : '') +
          (status ? `  status=${status}` : '') +
          `  payload=${JSON.stringify(parsed)}`,
        );

        if (TERMINAL_EVENTS.has(eventName) || TERMINAL_EVENTS.has(parsed['type'] as string)) {
          log(`  [SSE:${short}]  ✓ terminal event received — closing stream`);
          finish();
        }
        currentEventType = '';
      }
      // blank lines separate SSE events — no action needed
    });

    rl.on('close', () => {
      log(`  [SSE:${short}]  stream closed`);
      finish();
    });
    stream.on('error', (err) => {
      log(`  [SSE:${short}]  stream error: ${(err as Error).message}`);
      finish();
    });
    stream.on('end', () => finish());
  });
}

main().catch((err) => {
  console.error('');
  console.error('FATAL ERROR:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
