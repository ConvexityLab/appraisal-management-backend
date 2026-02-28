/**
 * QC Bridge Live End-to-End Test
 *
 * Hits the running dev server (port 3011) using real HTTP calls:
 *   1. POST /api/axiom/documents  — triggers the Axiom mock pipeline
 *   2. Poll GET /api/axiom/evaluations/order/:orderId until completed
 *   3. POST /api/qc/execution/execute — full controller → bridge → engine path
 *
 * Prints the bridge metrics log and per-question breakdown from the live response.
 *
 * Usage:
 *   npx tsx scripts/run-qc-live-test.ts
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';

const BASE_URL  = process.env['VERIFY_BASE_URL'] ?? 'http://127.0.0.1:3011';
const SECRET    = process.env['TEST_JWT_SECRET'] ?? 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';
const ORDER_ID  = `live-qc-test-${Date.now()}`;
const CHECKLIST = 'checklist-uad-standard-2026';
const POLL_MAX  = 20;   // attempts
const POLL_MS   = 2000; // ms between polls

// ── Auth ───────────────────────────────────────────────────────────────────

function makeToken(): string {
  return jwt.sign(
    {
      sub: 'live-test-qc-analyst',
      email: 'qc.analyst@test.local',
      name: 'Live Test QC Analyst',
      role: 'qc_analyst',
      clientId: 'default-client',   // must match checklist.clientId for hasChecklistExecuteAccess
      tenantId: 'test-tenant',
      permissions: ['qc_execute', 'qc_validate', 'qc_metrics', 'order_view'],
      accessScope: {
        teamIds: ['team-qc'],
        departmentIds: ['dept-quality'],
        regionIds: ['region-west'],
        statesCovered: ['CA', 'NV'],
        canViewAllOrders: false,
        canViewAllVendors: false,
        canOverrideQC: false,
      },
      iss: 'appraisal-management-test',
      aud: 'appraisal-management-api',
      iat: Math.floor(Date.now() / 1000),
      isTestToken: true,
    },
    SECRET,
    { expiresIn: '1h' }
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function hr(label: string): void {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = makeToken();
  const auth  = { Authorization: `Bearer ${token}` };

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  QC Bridge Live End-to-End Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Server    : ${BASE_URL}`);
  console.log(`  Order ID  : ${ORDER_ID}`);
  console.log(`  Checklist : ${CHECKLIST}`);

  // ── Step 0: health check ─────────────────────────────────────────────────
  hr('Step 0 — health check');
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
    console.log('  ✓ Server is up');
  } catch {
    console.error('  ✗ Server not responding at', BASE_URL);
    console.error('    Start it with:  npm run dev');
    process.exit(1);
  }

  // ── Step 1: trigger Axiom mock pipeline ───────────────────────────────────
  hr('Step 1 — POST /api/axiom/documents  (trigger mock pipeline)');
  const notifyRes = await axios.post(
    `${BASE_URL}/api/axiom/documents`,
    {
      orderId:      ORDER_ID,
      documentId:   `doc-${ORDER_ID}`,
      documentName: 'test-appraisal.pdf',
      documentType: 'appraisal',
      documentUrl:  'https://apprstaginglqxl5vst.blob.core.windows.net/appraisal-documents/test-appraisal.pdf',
      blobUrl:      'https://apprstaginglqxl5vst.blob.core.windows.net/appraisal-documents/test-appraisal.pdf',
    },
    { headers: auth, validateStatus: () => true }
  );
  console.log(`  Status: ${notifyRes.status}`);
  if (notifyRes.status !== 202 && notifyRes.status !== 200) {
    console.error('  ✗ Unexpected status:', notifyRes.data);
    process.exit(1);
  }
  const evaluationId: string = notifyRes.data?.data?.evaluationId ?? notifyRes.data?.evaluationId;
  console.log(`  ✓ Pipeline started — evaluationId: ${evaluationId}`);

  // ── Step 2: poll until Axiom evaluation is completed ─────────────────────
  hr('Step 2 — polling until Axiom evaluation completed');
  let axiomEval: any = null;
  for (let i = 1; i <= POLL_MAX; i++) {
    await sleep(POLL_MS);
    const pollRes = await axios.get(
      `${BASE_URL}/api/axiom/evaluations/order/${ORDER_ID}`,
      { headers: auth, validateStatus: () => true }
    );
    const items: any[] = pollRes.data?.data ?? pollRes.data ?? [];
    const found = Array.isArray(items) ? items.find((e: any) => e.status === 'completed') : null;
    if (found) {
      axiomEval = found;
      console.log(`  ✓ Completed after ${i * (POLL_MS / 1000)}s`);
      console.log(`    evaluationId : ${found.evaluationId}`);
      console.log(`    riskScore    : ${found.overallRiskScore}`);
      console.log(`    criteria     : ${found.criteria?.length ?? 0}`);
      break;
    }
    const status = Array.isArray(items) && items.length ? items[0]?.status : 'none';
    console.log(`  … attempt ${i}/${POLL_MAX} — status: ${status}`);
  }

  if (!axiomEval) {
    console.error(`  ✗ Axiom evaluation did not complete within ${POLL_MAX * POLL_MS / 1000}s`);
    process.exit(1);
  }

  // ── Step 3: execute QC ────────────────────────────────────────────────────
  hr('Step 3 — POST /api/qc/execution/execute');
  console.log('  Sending checklistId + targetId to controller…');
  const qcRes = await axios.post(
    `${BASE_URL}/api/qc/execution/execute`,
    {
      checklistId: CHECKLIST,
      targetId:    ORDER_ID,
      documentData: {
        orderId:                ORDER_ID,
        propertyAddress:        '1847 Willowbrook Lane, Riverton, FL 32789',
        legalDescription:       'Lot 14, Block 3, Willowbrook Estates',
        conditionRating:        'C3',
        finalValue:             432000,
        reconciliationNarrative:'Greatest weight given to Sales Comparison. Final $432,000 within comp range $421,500–$441,200.',
      },
      executionMode: 'standard',
    },
    { headers: auth, validateStatus: () => true }
  );

  console.log(`  Status: ${qcRes.status}`);
  if (qcRes.status !== 200) {
    console.error('  ✗ QC execution failed:', JSON.stringify(qcRes.data, null, 2));
    process.exit(1);
  }

  const qcResult = qcRes.data?.data?.results?.data ?? qcRes.data?.results?.data ?? qcRes.data;

  // ── Question-level breakdown ───────────────────────────────────────────────
  hr('Question Results');
  let axiomCount = 0, llmCount = 0, skippedCount = 0, total = 0;
  for (const cat of qcResult?.categoryResults ?? []) {
    for (const sub of cat.subcategoryResults ?? []) {
      for (const q of sub.questionResults ?? []) {
        total++;
        const axiomCriterion: string | undefined = q.answer?.supportingData?.axiomCriterionId;
        let source: string;
        if (axiomCriterion) {
          source = `axiom(${axiomCriterion})`;
          axiomCount++;
        } else if (q.answer?.source === 'ai') {
          source = 'llm';
          llmCount++;
        } else {
          source = 'unanswered';
          skippedCount++;
        }
        const pass = q.passed ? '✓' : '✗';
        const conf = q.answer?.confidence != null ? ` conf=${Number(q.answer.confidence).toFixed(2)}` : '';
        const val  = q.answer?.value ?? '—';
        console.log(`  ${pass} [${source.padEnd(32)}] ${String(q.questionId).padEnd(32)} → ${val}${conf}`);
      }
    }
  }

  // ── Bridge metrics summary ────────────────────────────────────────────────
  hr('Bridge Metrics (live)');
  const pct = total > 0 ? Math.round((axiomCount / total) * 100) : 0;
  console.log(`  total questions   : ${total}`);
  console.log(`  axiom pre-answered: ${axiomCount}  (${pct}% pre-answer rate)`);
  console.log(`  llm answered      : ${llmCount}`);
  console.log(`  unanswered/skipped: ${skippedCount}`);
  console.log('');
  console.log(`  overall score     : ${qcResult?.overallScore ?? '?'}`);
  console.log(`  passed            : ${qcResult?.passed ?? '?'}`);
  console.log(`  critical issues   : ${qcResult?.criticalIssues?.length ?? 0}`);
  console.log('');
  console.log('  (The server log above also contains the Axiom bridge pre-answer rate from AxiomBridgeRunMetrics)');
  console.log('');
}

main().catch((err) => {
  console.error('\nFatal:', err.message ?? err);
  process.exit(1);
});
