/**
 * Axiom E2E Test Script
 *
 * Tests two phases independently:
 *   Phase 1 — Direct Axiom probe:  POST /api/pipelines with the production payload.
 *             Verifies the server returns 202 + { jobId: 'exec-...' }.
 *             Only runs when AXIOM_API_KEY is set (skipped in mock mode).
 *
 *   Phase 2 — Backend round-trip:  PUT /api/orders/:orderId/status → SUBMITTED
 *             Waits for setImmediate to stamp Axiom fields on Cosmos.
 *             Verifies axiomEvaluationId + axiomPipelineJobId are not undefined.
 *             Works in BOTH mock mode (no API key) and live mode.
 *
 * Usage:
 *   node test-axiom-e2e.js                          # both phases; prompts for orderId
 *   TEST_ORDER_ID=<id> node test-axiom-e2e.js        # skip prompt
 *   PHASE=1 node test-axiom-e2e.js                   # Phase 1 only
 *   PHASE=2 TEST_ORDER_ID=<id> node test-axiom-e2e.js # Phase 2 only
 *
 * Required env vars (loaded from .env automatically):
 *   AXIOM_API_BASE_URL  — Axiom server base URL
 *   AXIOM_TENANT_ID     — tenant identifier
 *   AXIOM_CLIENT_ID     — client identifier
 *   AXIOM_API_KEY       — bearer token (Phase 1 only; leave blank for mock-mode Phase 2)
 *   API_BASE_URL        — backend base URL (e.g. http://localhost:3011)
 *   TEST_JWT_ADMIN      — test JWT for authenticating against our backend
 */

require('dotenv').config();
const { createInterface } = require('readline');

// ─── helpers ─────────────────────────────────────────────────────────────────

const AXIOM_BASE  = process.env.AXIOM_API_BASE_URL;
const AXIOM_KEY   = process.env.AXIOM_API_KEY;
const TENANT_ID   = process.env.AXIOM_TENANT_ID;
const CLIENT_ID   = process.env.AXIOM_CLIENT_ID;
const API_BASE    = process.env.API_BASE_URL;
const TEST_JWT    = process.env.TEST_JWT_ADMIN;
const PHASE       = process.env.PHASE;        // '1', '2', or undefined (both)
const ORDER_ID    = process.env.TEST_ORDER_ID;

const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => { console.error(`  ❌  ${msg}`); process.exitCode = 1; };
const info = (msg) => console.log(`  ℹ️   ${msg}`);
const warn = (msg) => console.log(`  ⚠️   ${msg}`);
const head = (msg) => console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`);

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, ok: response.ok, body };
}

// ─── Phase 1: direct Axiom probe ─────────────────────────────────────────────

async function runPhase1() {
  head('PHASE 1 — Direct Axiom API Probe');

  if (!AXIOM_BASE) { fail('AXIOM_API_BASE_URL not set — cannot run Phase 1'); return; }
  if (!TENANT_ID)  { fail('AXIOM_TENANT_ID not set'); return; }
  if (!CLIENT_ID)  { fail('AXIOM_CLIENT_ID not set'); return; }

  info(`Server:    ${AXIOM_BASE}`);
  info(`Tenant:    ${TENANT_ID}`);
  info(`Client:    ${CLIENT_ID}`);
  info(`Auth:      ${AXIOM_KEY ? 'Bearer token set' : 'none (dev server — no auth required)'}`);
  info(`Pipeline: risk-evaluation v1.0.0 (inline — set AXIOM_PIPELINE_ID_RISK_EVAL=<uuid> when registered)`);

  const testOrderId = `e2e-test-${Date.now()}`;
  const payload = {
    // Inline Loom pipeline definition — Axiom's pipelineId requires a UUID for stored
    // templates; use inline until the Axiom team provides registered template UUIDs.
    pipeline: {
      name: 'risk-evaluation',
      version: '1.0.0',
      stages: [
        {
          name: 'process-documents',
          actor: 'DocumentProcessor',
          mode: 'single',
          input: {
            documents: { path: 'trigger.documents' },
            tenantId:  { path: 'trigger.tenantId' },
            clientId:  { path: 'trigger.clientId' },
          },
          timeout: 120000,
        },
        {
          name: 'evaluate-criteria',
          actor: 'CriterionEvaluator',
          mode: 'single',
          input: {
            fields:    { path: 'trigger.fields' },
            programId: { path: 'trigger.programId' },
            documents: { path: 'stages.process-documents' },
            tenantId:  { path: 'trigger.tenantId' },
            clientId:  { path: 'trigger.clientId' },
          },
          timeout: 180000,
        },
      ],
    },
    input: {
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      correlationId: testOrderId,
      correlationType: 'ORDER',
      programId: 'FNMA-SEL-2024',
      webhookUrl: `${API_BASE || 'http://localhost:3011'}/api/axiom/webhook`,
      webhookSecret: process.env.AXIOM_WEBHOOK_SECRET || 'test-secret',
      fields: [
        { fieldName: 'propertyAddress', fieldType: 'string',  value: '123 E2E Test St, Denver CO 80202' },
        { fieldName: 'loanAmount',      fieldType: 'number',  value: 450000 },
        { fieldName: 'propertyType',    fieldType: 'string',  value: 'SINGLE_FAMILY' },
        { fieldName: 'ltvRatio',        fieldType: 'number',  value: 0.78 },
        { fieldName: 'appraisedValue',  fieldType: 'number',  value: 577000 },
        { fieldName: 'occupancyType',   fieldType: 'string',  value: 'PRIMARY_RESIDENCE' },
        { fieldName: 'loanPurpose',     fieldType: 'string',  value: 'PURCHASE' },
      ],
      documents: [
        { documentName: 'Appraisal Report', documentReference: `blob://appraisal-documents/${testOrderId}/report.pdf` },
      ],
    },
  };

  console.log('\n  Payload:');
  console.log(JSON.stringify(payload, null, 4).replace(/^/gm, '    '));
  console.log();

  // Only attach Authorization header when a key is configured
  const phase1Headers = { ...(AXIOM_KEY ? { 'Authorization': `Bearer ${AXIOM_KEY}` } : {}) };

  let result;
  try {
    result = await apiFetch(`${AXIOM_BASE}/api/pipelines`, {
      method: 'POST',
      headers: phase1Headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    fail(`Network error: ${err.message}`);
    return;
  }

  console.log(`  HTTP ${result.status}`);
  console.log('  Response body:', JSON.stringify(result.body, null, 4).replace(/^/gm, '  '));

  if (result.status === 202) {
    pass(`202 Accepted — pipeline job queued`);
    const jobId = result.body?.jobId;
    if (jobId && typeof jobId === 'string' && jobId.startsWith('exec-')) {
      pass(`jobId looks valid: ${jobId}`);
    } else if (jobId) {
      warn(`jobId returned but format unexpected (expected 'exec-...'): ${jobId}`);
    } else {
      fail(`No jobId in response body — response.data.jobId would be undefined in production`);
    }
  } else if (result.status === 400) {
    fail(`400 Bad Request — payload rejected by Axiom`);
    info(`Error: ${JSON.stringify(result.body)}`);
  } else if (result.status === 401) {
    fail(`401 Unauthorized — check AXIOM_API_KEY value`);
  } else {
    fail(`Unexpected status ${result.status}`);
  }
}

// ─── Phase 2: backend round-trip ─────────────────────────────────────────────

async function runPhase2(orderId) {
  head('PHASE 2 — Backend Round-Trip (Cosmos Stamping)');

  if (!API_BASE) { fail('API_BASE_URL not set (need to know where our backend is)'); return; }
  if (!TEST_JWT) { fail('TEST_JWT_ADMIN not set — cannot authenticate against backend'); return; }

  const authHeader = { 'Authorization': `Bearer ${TEST_JWT}` };
  const isLiveMode = !!AXIOM_BASE;
  info(`Mode:          ${isLiveMode ? `LIVE — ${AXIOM_BASE}${AXIOM_KEY ? ' (authenticated)' : ' (no auth — dev)'}` : 'MOCK (AXIOM_API_BASE_URL not set)'}`);
  info(`Backend:       ${API_BASE}`);
  info(`Order ID:      ${orderId}`);

  // ── 2a. Fetch the order's current status ──────────────────────────────────
  console.log('\n  [2a] GET /api/orders/:id — checking current state...');
  let orderBefore;
  try {
    const r = await apiFetch(`${API_BASE}/api/orders/${orderId}`, { headers: authHeader });
    if (!r.ok) {
      fail(`Failed to fetch order: HTTP ${r.status} — ${JSON.stringify(r.body)}`);
      return;
    }
    orderBefore = r.body?.data || r.body;
    pass(`Fetched order — current status: ${orderBefore?.status}`);
  } catch (err) {
    fail(`Network error fetching order: ${err.message}`);
    return;
  }

  if (!orderBefore) { fail('No order data in response'); return; }

  const currentStatus = orderBefore.status;
  const alreadySubmitted = currentStatus === 'SUBMITTED' || currentStatus === 'submitted';

  if (alreadySubmitted) {
    // Order is already SUBMITTED — check if Axiom fields already landed
    const hasAxiomId = orderBefore.axiomEvaluationId && orderBefore.axiomEvaluationId !== 'eval-undefined-undefined';
    const hasJobId   = orderBefore.axiomPipelineJobId && !orderBefore.axiomPipelineJobId.includes('undefined');
    if (hasAxiomId && hasJobId) {
      pass(`Order already SUBMITTED with valid Axiom IDs:`);
      pass(`  axiomEvaluationId:  ${orderBefore.axiomEvaluationId}`);
      pass(`  axiomPipelineJobId: ${orderBefore.axiomPipelineJobId}`);
      pass(`  axiomStatus:        ${orderBefore.axiomStatus}`);
      return;
    }
    warn(`Order already SUBMITTED but Axiom IDs are missing/corrupt — will re-verify`);
  }

  // ── 2b. Transition to SUBMITTED ───────────────────────────────────────────
  if (!alreadySubmitted) {
    console.log(`\n  [2b] PUT /api/orders/${orderId}/status → SUBMITTED...`);
    let transitionResult;
    try {
      transitionResult = await apiFetch(`${API_BASE}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ status: 'SUBMITTED', reason: 'E2E Axiom test' }),
      });
    } catch (err) {
      fail(`Network error during status transition: ${err.message}`);
      return;
    }

    if (transitionResult.ok) {
      pass(`Status transition accepted (HTTP ${transitionResult.status})`);
    } else {
      fail(`Status transition failed: HTTP ${transitionResult.status} — ${JSON.stringify(transitionResult.body)}`);
      info(`Common causes: order is in a terminal state, or auth token lacks 'order_manage' permission`);
      return;
    }
  }

  // ── 2c. Wait for setImmediate to fire and Cosmos to be updated ────────────
  const waitMs = isLiveMode ? 5000 : 1500;
  console.log(`\n  [2c] Waiting ${waitMs}ms for async Axiom submit + Cosmos write...`);
  await new Promise((r) => setTimeout(r, waitMs));

  // ── 2d. Verify Cosmos record ──────────────────────────────────────────────
  console.log(`\n  [2d] GET /api/orders/${orderId} — verifying Axiom fields on Cosmos record...`);
  let orderAfter;
  try {
    const r = await apiFetch(`${API_BASE}/api/orders/${orderId}`, { headers: authHeader });
    orderAfter = r.body?.data || r.body;
  } catch (err) {
    fail(`Network error re-fetching order: ${err.message}`);
    return;
  }

  console.log('\n  Relevant fields after transition:');
  const fields = ['status', 'axiomStatus', 'axiomEvaluationId', 'axiomPipelineJobId'];
  for (const f of fields) {
    const v = orderAfter?.[f];
    console.log(`    ${f.padEnd(24)} = ${v ?? '(not present)'}`);
  }

  // Assertions
  const evalId  = orderAfter?.axiomEvaluationId;
  const jobId   = orderAfter?.axiomPipelineJobId;
  const axStatus = orderAfter?.axiomStatus;

  if (!evalId || evalId.includes('undefined')) {
    fail(`axiomEvaluationId is missing or contains "undefined": ${evalId}`);
  } else {
    pass(`axiomEvaluationId set: ${evalId}`);
  }

  if (!jobId || jobId.includes('undefined')) {
    fail(`axiomPipelineJobId is missing or contains "undefined": ${jobId}`);
  } else {
    pass(`axiomPipelineJobId set: ${jobId}`);
  }

  if (axStatus === 'submitted') {
    pass(`axiomStatus = 'submitted'`);
  } else {
    fail(`axiomStatus is '${axStatus}' — expected 'submitted'`);
  }

  if (isLiveMode && jobId && jobId.startsWith('exec-')) {
    pass(`jobId format matches Axiom pattern (exec-...)`);
  } else if (!isLiveMode && jobId) {
    info(`Mock-mode jobId: ${jobId} — replace AXIOM_API_KEY in .env for live mode`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          AXIOM INTEGRATION E2E TEST                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const runPhase1Flag = !PHASE || PHASE === '1';
  const runPhase2Flag = !PHASE || PHASE === '2';

  if (runPhase1Flag) {
    await runPhase1();
  }

  if (runPhase2Flag) {
    let orderId = ORDER_ID;
    if (!orderId) {
      if (process.stdin.isTTY) {
        orderId = await prompt('\n  Enter the Cosmos order ID to transition to SUBMITTED\n  (must be in IN_PROGRESS state — e.g. demo-order-006)\n  Order ID: ');
      }
      if (!orderId) {
        warn('No TEST_ORDER_ID set and not running interactively — skipping Phase 2');
        warn('Run: TEST_ORDER_ID=<id> node test-axiom-e2e.js');
        return;
      }
    }
    await runPhase2(orderId);
  }

  const exitCode = process.exitCode || 0;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(exitCode === 0 ? '  🎉  ALL CHECKS PASSED' : '  💥  SOME CHECKS FAILED — see ❌ lines above');
  console.log('═'.repeat(60));

  if (!AXIOM_BASE && runPhase2Flag) {
    console.log('\n  To enable live mode, set AXIOM_API_BASE_URL in .env (AXIOM_API_KEY is optional)');
    console.log('  To use a registered Axiom template instead of inline pipeline:');
    console.log('    AXIOM_PIPELINE_ID_RISK_EVAL=<uuid> node test-axiom-e2e.js');
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exitCode = 1;
});
