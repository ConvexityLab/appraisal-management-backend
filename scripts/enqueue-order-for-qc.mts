/**
 * enqueue-order-for-qc.mts
 *
 * Manually adds an order to the QC review queue via POST /api/qc-workflow/queue.
 * Uses a test JWT (valid in development/test environments where ALLOW_TEST_TOKENS or
 * NODE_ENV=development is set).
 *
 * Usage:
 *   npx tsx scripts/enqueue-order-for-qc.mts [orderId]
 *
 * If no orderId is supplied the default (VO-UKA4XZ51) is used.
 *
 * Required env vars (loaded from .env automatically):
 *   AZURE_TENANT_ID      – used to stamp the test token
 *   AXIOM_CLIENT_ID      – used to scope the test token (default: "vision")
 *   AXIOM_SUB_CLIENT_ID  – used to scope the test token (default: "platform")
 *   PORT                 – backend listen port (default: 3011)
 *   TEST_JWT_SECRET      – override the test-token signing secret if set
 */

import 'dotenv/config';
import jwt from 'jsonwebtoken';

// ─── Configuration ────────────────────────────────────────────────────────────

const ORDER_ID = process.argv[2] ?? 'VO-UKA4XZ51';
const PORT = process.env.PORT ?? '3011';
const BASE_URL = `http://localhost:${PORT}`;

// ─── Mint a test admin JWT (mirrors TestTokenGenerator logic) ─────────────────

function mintAdminToken(): string {
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) {
    throw new Error(
      'AZURE_TENANT_ID is not set. ' +
      'This is required to generate a test token. ' +
      'Check your .env file.'
    );
  }

  const clientId = process.env.AXIOM_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'AXIOM_CLIENT_ID is not set. ' +
      'This is required to generate a test token. ' +
      'Check your .env file.'
    );
  }

  const subClientId = process.env.AXIOM_SUB_CLIENT_ID;
  if (!subClientId) {
    throw new Error(
      'AXIOM_SUB_CLIENT_ID is not set. ' +
      'This is required to generate a test token. ' +
      'Check your .env file.'
    );
  }

  const secret = process.env.TEST_JWT_SECRET ?? 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';

  const payload = {
    sub: 'script-admin',
    email: 'admin@test.local',
    name: 'Script Admin',
    role: 'admin',
    tenantId,
    clientId,
    subClientId,
    permissions: ['*'],
    accessScope: { canViewAllOrders: true, canViewAllVendors: true, canOverrideQC: true },
    iss: 'appraisal-management-test',
    aud: 'appraisal-management-api',
    iat: Math.floor(Date.now() / 1000),
    isTestToken: true,
  };

  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nEnqueuing order ${ORDER_ID} for QC review…`);

  const token = mintAdminToken();

  const body = {
    orderId: ORDER_ID,
    orderNumber: ORDER_ID,
    appraisalId: ORDER_ID,
    propertyAddress: '395 Ahern Street, Atlantic Beach, FL 32233',
    appraisedValue: 0,
    orderPriority: 'STANDARD',
    clientId: 'seed-client-amc-clearpath-004',
    clientName: 'ClearPath AMC',
    vendorId: '',
    vendorName: '',
  };

  const response = await fetch(`${BASE_URL}/api/qc-workflow/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  if (!response.ok) {
    console.error(`\nFailed — HTTP ${response.status}:`);
    console.error(json);
    process.exit(1);
  }

  console.log(`\nSuccess — HTTP ${response.status}:`);
  console.dir(json, { depth: null });

  console.log('\nNext steps:');
  console.log('  1. Go to /qc (QC Queue page) and find the new PENDING entry.');
  console.log('  2. Assign yourself as the analyst → status moves to IN_REVIEW.');
  console.log('  3. Return to the QC Review tab for the order → "Submit Decision" is now enabled.');
}

main().catch((err) => {
  console.error('\nUnhandled error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
