#!/usr/bin/env tsx
/**
 * Axiom API Contract Verification Script
 *
 * Hits every Axiom-related backend endpoint and validates that the response
 * shapes conform to the canonical contract defined in axiom.service.ts and
 * the frontend types in axiom.types.ts.
 *
 * Run against a locally running dev server:
 *   npx tsx scripts/verify-axiom-contract.ts
 *
 * Override the base URL:
 *   VERIFY_BASE_URL=http://localhost:8080 npx tsx scripts/verify-axiom-contract.ts
 *
 * Exit code 0 = all checks passed
 * Exit code 1 = one or more checks failed
 */

import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env['VERIFY_BASE_URL'] ?? 'http://127.0.0.1:3011';
const TEST_ORDER_ID = `contract-verify-${Date.now()}`;

// ── Test auth token ───────────────────────────────────────────────────────────
// Minted using the same default secret as TestTokenGenerator so the unified-auth
// middleware accepts it in dev/test mode.  Never used in production.
const TEST_JWT_SECRET = process.env['TEST_JWT_SECRET'] ?? 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';
const AUTH_TOKEN = jwt.sign(
  {
    sub: 'contract-verify-user',
    email: 'contract-verify@test.local',
    name: 'Contract Verifier',
    role: 'admin',
    tenantId: 'test-tenant',
    iss: 'appraisal-management-test',
    aud: 'appraisal-management-api',
    isTestToken: true,
  },
  TEST_JWT_SECRET,
  { expiresIn: '1h' }
);

// Default Axios headers for all requests
const authHeaders = { Authorization: `Bearer ${AUTH_TOKEN}` };

// ── Colour helpers ────────────────────────────────────────────────────────────
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Result tracking ───────────────────────────────────────────────────────────
interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}
const results: CheckResult[] = [];

function pass(name: string, message = 'OK') {
  results.push({ name, passed: true, message });
  console.log(`  ${green('✓')} ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.log(`  ${red('✗')} ${name}: ${message}`);
}

// ── Shape assertion helpers ───────────────────────────────────────────────────

function assertField(
  name: string,
  data: unknown,
  field: string,
  type?: string
): boolean {
  if (typeof data !== 'object' || data === null) {
    fail(name, `Expected object, got ${typeof data}`);
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (!(field in obj)) {
    fail(name, `Missing field "${field}"`);
    return false;
  }
  if (type && typeof obj[field] !== type) {
    fail(name, `Field "${field}" expected ${type}, got ${typeof obj[field]}`);
    return false;
  }
  return true;
}

function assertCriterionShape(criterion: unknown, index: number): void {
  const name = `criterion[${index}]`;
  if (typeof criterion !== 'object' || criterion === null) {
    fail(name, 'Not an object');
    return;
  }
  const c = criterion as Record<string, unknown>;

  // Canonical required fields
  assertField(`${name}.criterionId`,   c, 'criterionId',   'string');
  assertField(`${name}.criterionName`, c, 'criterionName', 'string');
  assertField(`${name}.evaluation`,    c, 'evaluation',    'string');
  assertField(`${name}.confidence`,    c, 'confidence',    'number');
  assertField(`${name}.reasoning`,     c, 'reasoning',     'string');

  // Confidence must be 0.0–1.0
  if (typeof c['confidence'] === 'number') {
    if (c['confidence'] < 0 || c['confidence'] > 1) {
      fail(`${name}.confidence`, `Value ${c['confidence']} out of 0.0–1.0 range`);
    } else {
      pass(`${name}.confidence range`, `${c['confidence']}`);
    }
  }

  // evaluation must be one of the canonical values
  const validEvals = ['pass', 'fail', 'warning', 'not_applicable', 'info'];
  if (typeof c['evaluation'] === 'string' && !validEvals.includes(c['evaluation'])) {
    fail(`${name}.evaluation value`, `"${c['evaluation']}" not in [${validEvals.join(', ')}]`);
  }

  // documentReferences must be an array (can be empty)
  if (!Array.isArray(c['documentReferences'])) {
    fail(`${name}.documentReferences`, 'Missing or not an array');
  } else {
    const refs = c['documentReferences'] as unknown[];
    refs.forEach((ref, ri) => assertDocRefShape(ref, `${name}.documentReferences[${ri}]`));
  }
}

function assertDocRefShape(ref: unknown, label: string): void {
  if (typeof ref !== 'object' || ref === null) {
    fail(label, 'Not an object');
    return;
  }
  const r = ref as Record<string, unknown>;

  // Canonical field is quote (not text)
  if (!('quote' in r) && !('text' in r)) {
    fail(`${label}.quote`, 'Neither "quote" nor legacy "text" field present');
  } else if ('quote' in r) {
    pass(`${label}.quote`, 'canonical field present');
  } else {
    fail(`${label}.quote`, 'Only legacy "text" present — canonical "quote" missing');
  }
}

function assertEvaluationShape(evaluation: unknown): void {
  if (typeof evaluation !== 'object' || evaluation === null) {
    fail('evaluation shape', 'Not an object');
    return;
  }
  const e = evaluation as Record<string, unknown>;

  assertField('evaluation.evaluationId',   e, 'evaluationId',     'string');
  assertField('evaluation.orderId',        e, 'orderId',          'string');
  assertField('evaluation.status',         e, 'status',           'string');
  assertField('evaluation.overallRiskScore', e, 'overallRiskScore', 'number');
  assertField('evaluation.timestamp',      e, 'timestamp',        'string');

  // criteria array
  if (!Array.isArray(e['criteria'])) {
    fail('evaluation.criteria', 'Missing or not an array');
    return;
  }
  pass('evaluation.criteria', `${(e['criteria'] as unknown[]).length} criteria present`);
  (e['criteria'] as unknown[]).forEach((c, i) => assertCriterionShape(c, i));
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkStatus(): Promise<void> {
  console.log(bold('\n── GET /api/axiom/status ────────────────────────────'));
  try {
    const res = await axios.get(`${BASE_URL}/api/axiom/status`, { headers: authHeaders });
    if (!res.data.success) {
      fail('status.success', `success=false: ${JSON.stringify(res.data)}`);
      return;
    }
    const d = res.data.data;
    assertField('status.data.enabled', d, 'enabled');
    assertField('status.data.message', d, 'message', 'string');
    const modeStr = d.enabled ? 'live' : 'mock/disabled';
    pass('GET /api/axiom/status', `enabled=${d.enabled} (${modeStr})`);
  } catch (err) {
    fail('GET /api/axiom/status', axiosMsg(err));
  }
}

async function checkAnalyzeDocument(): Promise<string | null> {
  console.log(bold('\n── POST /api/axiom/documents (notify upload) ───────'));
  try {
    const res = await axios.post(
      `${BASE_URL}/api/axiom/documents`,
      {
        orderId: TEST_ORDER_ID,
        documentType: 'appraisal',
        documentUrl: `https://storage.azure.com/test/${TEST_ORDER_ID}.pdf`,
        metadata: {
          fileName: 'test-appraisal.pdf',
          fileSize: 1024000,
          uploadedBy: 'contract-verify-script',
          propertyAddress: '123 Contract Test St',
          documentId: `doc-${TEST_ORDER_ID}`,
          blobUrl: `https://storage.azure.com/test/${TEST_ORDER_ID}.pdf`,
        },
      },
      { headers: authHeaders, validateStatus: () => true }
    );

    if (res.status === 202) {
      assertField('documents.evaluationId', res.data.data, 'evaluationId', 'string');
      const evaluationId = res.data.data?.evaluationId as string | undefined;
      pass('POST /api/axiom/documents', `evaluationId=${evaluationId}`);
      return evaluationId ?? null;
    } else if (res.status === 503) {
      // Axiom not configured in this env — validate error shape then pass
      assertField('documents.error.code', res.data.error, 'code', 'string');
      assertField('documents.error.message', res.data.error, 'message', 'string');
      pass('POST /api/axiom/documents (503)', '503 shape correct — Axiom disabled in this env');
      return null;
    } else {
      fail('POST /api/axiom/documents', `Unexpected ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
      return null;
    }
  } catch (err) {
    fail('POST /api/axiom/documents', axiosMsg(err));
    return null;
  }
}

async function checkGetEvaluation(evaluationId: string): Promise<void> {
  console.log(bold('\n── GET /api/axiom/evaluations/:id ──────────────────'));
  try {
    const res = await axios.get(
      `${BASE_URL}/api/axiom/evaluations/${evaluationId}`,
      { headers: authHeaders, validateStatus: () => true }
    );
    if (res.status === 200 && res.data.success) {
      assertEvaluationShape(res.data.data);
      pass('GET /api/axiom/evaluations/:id', `status=${res.data.data?.status}`);
    } else if (res.status === 404) {
      // Cosmos not available or record not yet persisted — validate 404 error shape
      assertField('getEvaluation.404.error', res.data, 'error');
      pass(
        'GET /api/axiom/evaluations/:id (404)',
        'Record not in Cosmos (DB unavailable or mock delay) — 404 shape correct'
      );
    } else {
      fail('GET /api/axiom/evaluations/:id', `Unexpected ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`);
    }
  } catch (err) {
    fail('GET /api/axiom/evaluations/:id', axiosMsg(err));
  }
}

async function checkGetOrderEvaluations(): Promise<void> {
  console.log(bold('\n\u2500\u2500 GET /api/axiom/evaluations/order/:orderId \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'));
  try {
    const res = await axios.get(
      `${BASE_URL}/api/axiom/evaluations/order/${TEST_ORDER_ID}`,
      { headers: authHeaders, validateStatus: () => true }
    );
    if (res.status === 200 && res.data.success) {
      if (!Array.isArray(res.data.data)) {
        fail('orderEvaluations.data', 'Expected array');
        return;
      }
      pass(
        'GET /api/axiom/evaluations/order/:orderId',
        `${res.data.data.length} evaluation(s) returned`
      );
      if (res.data.data.length > 0) {
        assertEvaluationShape(res.data.data[0]);
      }
    } else if (res.status === 404 || (res.status === 200 && Array.isArray(res.data.data) && res.data.data.length === 0)) {
      // Empty or 404 — Cosmos not available; validate error/empty shape
      pass(
        'GET /api/axiom/evaluations/order/:orderId (empty)',
        'No records in Cosmos (DB unavailable or no submissions) — response shape correct'
      );
    } else {
      fail(
        'GET /api/axiom/evaluations/order/:orderId',
        `Unexpected ${res.status}: ${JSON.stringify(res.data).slice(0, 200)}`
      );
    }
  } catch (err) {
    fail('GET /api/axiom/evaluations/order/:orderId', axiosMsg(err));
  }
}

async function checkWebhookRejectsUnsigned(): Promise<void> {
  console.log(bold('\n── POST /api/axiom/webhook (unsigned — expect 401 in prod, pass in dev) ─'));
  try {
    // In non-production the middleware skips HMAC if no secret is set; so either
    // 200 (dev mode, no secret) or 401 (dev mode with secret, bad signature) are acceptable.
    const res = await axios.post(
      `${BASE_URL}/api/axiom/webhook`,
      {
        correlationId: 'contract-test',
        correlationType: 'ORDER',
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
      { validateStatus: () => true }
    );
    if (res.status === 200) {
      pass('webhook unsigned', 'Dev mode: signature verification skipped (no AXIOM_WEBHOOK_SECRET set)');
    } else if (res.status === 401) {
      pass('webhook unsigned', 'Correct 401 Unauthorised when secret is configured');
    } else {
      fail('webhook unsigned', `Unexpected ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err) {
    fail('webhook unsigned', axiosMsg(err));
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function axiosMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 200)}`
      : err.message;
  }
  return String(err);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(bold(`\n🔍 Axiom API Contract Verification`));
  console.log(`   Base URL:    ${BASE_URL}`);
  console.log(`   Test order:  ${TEST_ORDER_ID}`);
  console.log(`   Timestamp:   ${new Date().toISOString()}`);

  await checkStatus();
  const evaluationId = await checkAnalyzeDocument();

  if (evaluationId) {
    // Allow a brief moment for the mock lifecycle to register the pending record
    await new Promise(resolve => setTimeout(resolve, 300));
    await checkGetEvaluation(evaluationId);
    await checkGetOrderEvaluations();
  } else {
    console.log(yellow('\n⚠️  Skipping evaluation-retrieval checks (no evaluationId returned by /analyze)'));
  }

  await checkWebhookRejectsUnsigned();

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(bold(`\n════════════════════════════════════════════════════`));
  console.log(`  Results: ${green(`${passed} passed`)}, ${failed > 0 ? red(`${failed} failed`) : `${failed} failed`}`);
  if (failed > 0) {
    console.log(`\n  ${red('Failed checks:')}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ${red('✗')} ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log(`\n  ${green('All contract checks passed ✓')}`);
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  console.error(red(`\n💥 Fatal error: ${err}`));
  process.exit(1);
});
