/**
 * ClassValuation webhook inbound — full integration test.
 *
 * Uses an in-process AppraisalManagementAPIServer (same pattern as
 * aim-port-inbound.integration.test.ts) against real Azure Cosmos DB staging.
 * Verifies the complete pipeline:
 *
 *   ClassValuation webhook (HTTP)
 *     → vendor-connection lookup (Cosmos vendor-connections)
 *     → HMAC auth via Key Vault secret
 *     → ClassValuationWebhookAdapter.handleInbound
 *     → VendorEventOutboxService.persistInboundEvents (Cosmos vendor-event-outbox)
 *     → 202 ACK returned to caller
 *
 * ─── Required env / KV pre-requisites ────────────────────────────────────────
 *   VITEST_INTEGRATION=true
 *   AZURE_COSMOS_ENDPOINT              — staging Cosmos DB endpoint
 *   Key Vault secret "class-valuation-integration-test-hmac"
 *     value: "test-hmac-class-valuation-2026"
 *
 * The KV secret must be provisioned in staging before running this test:
 *
 *   az keyvault secret set \
 *     --vault-name kvapprmstastanktl4a \
 *     --name class-valuation-integration-test-hmac \
 *     --value test-hmac-class-valuation-2026
 *
 * ─── Run command ────────────────────────────────────────────────────────────
 *   VITEST_INTEGRATION=true \
 *   AZURE_COSMOS_ENDPOINT=https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/ \
 *   pnpm vitest run tests/integration/class-valuation-webhook.integration.test.ts
 */

import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import type { VendorOutboxDocument } from '../../src/types/vendor-integration.types.js';

const RUN = process.env.VITEST_INTEGRATION === 'true' && !!process.env.AZURE_COSMOS_ENDPOINT;

// ─── Test constants ───────────────────────────────────────────────────────────
// HMAC_SECRET must match the value of the KV secret named SECRET_NAME.
const HMAC_SECRET = 'test-hmac-class-valuation-2026';
const SECRET_NAME = 'class-valuation-integration-test-hmac';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSignature(secret: string, body: Record<string, unknown>): string {
  const raw = Buffer.from(JSON.stringify(body));
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

function buildSignatureFromBuffer(secret: string, raw: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

// ─── Suite 1: happy-path + auth failures ─────────────────────────────────────

describe.skipIf(!RUN)('ClassValuation webhook — full integration pipeline', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let adminToken: string;
  let db: CosmosDbService;
  let originalMockSbFlag: string | undefined;

  let vendorConnectionId: string;

  const TS = Date.now();
  const TENANT_ID = `cv-inttest-${TS}`;
  const ACCOUNT_ID = `cv-inttest-acct-${TS}`;
  // Fixed vendor order IDs for inside each test — each test uses its own to
  // avoid outbox replay-key collisions.
  const VENDOR_ORDER_ID_COMPLETED = `CV-COMPLETED-${TS}`;
  const VENDOR_ORDER_ID_MESSAGE = `CV-MESSAGE-${TS}`;

  beforeAll(async () => {
    originalMockSbFlag = process.env.USE_MOCK_SERVICE_BUS;
    process.env.USE_MOCK_SERVICE_BUS = 'false';

    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    db = new CosmosDbService();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({
      id: 'cv-inttest-admin',
      email: 'cv-inttest-admin@appraisal.com',
      name: 'CV Integration Test Admin',
      role: 'admin' as const,
      tenantId: TENANT_ID,
    });

    // ── Seed: create the vendor connection ────────────────────────────────────
    const connRes = await request(app)
      .post('/api/vendor-integrations/connections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorType: 'class-valuation',
        lenderId: 'lender-cv-inttest',
        lenderName: 'CV Integration Test Lender',
        inboundIdentifier: ACCOUNT_ID,
        credentials: {
          inboundHmacSecretName: SECRET_NAME,
          outboundHmacSecretName: SECRET_NAME,
        },
        outboundEndpointUrl: 'https://cv-mock.example.com/webhooks/orders',
        active: true,
      });

    if (connRes.status !== 201) {
      throw new Error(
        `Vendor connection seed failed: ${connRes.status} — ${JSON.stringify(connRes.body)}`,
      );
    }
    vendorConnectionId = connRes.body.data.id;
    console.log('✅ ClassValuation vendor connection created:', vendorConnectionId);
  }, 60_000);

  afterAll(async () => {
    process.env.USE_MOCK_SERVICE_BUS = originalMockSbFlag ?? 'true';

    if (vendorConnectionId && app) {
      await request(app)
        .delete(`/api/vendor-integrations/connections/${vendorConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
  });

  // ── Test 1: order.completed → 202 + outbox entry ──────────────────────────

  it('returns 202 ACK for order.completed webhook and persists outbox event', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.completed',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: VENDOR_ORDER_ID_COMPLETED,
        orderId: `internal-order-${TS}`,
        files: [
          {
            id: 'file-cv-1',
            filename: 'appraisal-report.pdf',
            category: 'appraisal',
            content: Buffer.from('%PDF-1.4 test content').toString('base64'),
          },
        ],
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);

    console.log('ClassValuation inbound response:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ received: true });
  }, 30_000);

  it('vendor-event-outbox has vendor.order.completed entry for the completed order', async () => {
    const deadline = Date.now() + 15_000;
    let outboxDoc: VendorOutboxDocument | null = null;

    while (Date.now() < deadline) {
      const result = await db.queryItems<VendorOutboxDocument>(
        'vendor-event-outbox',
        `SELECT * FROM c
         WHERE c.connectionId = @connectionId
           AND c.eventType = @eventType
           AND c.vendorOrderId = @vendorOrderId`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@eventType', value: 'vendor.order.completed' },
          { name: '@vendorOrderId', value: VENDOR_ORDER_ID_COMPLETED },
        ],
      );
      const docs = result.data ?? [];
      if (docs.length > 0) {
        outboxDoc = docs[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }

    expect(outboxDoc).not.toBeNull();
    console.log('✅ Outbox doc found:', outboxDoc?.id);

    expect(outboxDoc).toMatchObject({
      eventType: 'vendor.order.completed',
      vendorType: 'class-valuation',
      connectionId: vendorConnectionId,
      status: 'PENDING',
      direction: 'inbound',
      vendorOrderId: VENDOR_ORDER_ID_COMPLETED,
    });

    // Payload must carry the file list
    const payload = outboxDoc?.payload as Record<string, unknown>;
    const files = (payload?.files as unknown[]) ?? [];
    expect(files).toHaveLength(1);
  }, 20_000);

  // ── Test 2: message.created → 202 + outbox entry ─────────────────────────

  it('returns 202 ACK for message.created webhook and persists outbox event', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'message.created',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: VENDOR_ORDER_ID_MESSAGE,
        orderId: `internal-order-msg-${TS}`,
        message: {
          subject: 'Additional comps needed',
          content: 'Please provide one more comparable sale within 0.5 miles.',
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ received: true });
  }, 30_000);

  it('vendor-event-outbox has vendor.message.received entry for the message webhook', async () => {
    const deadline = Date.now() + 15_000;
    let outboxDoc: VendorOutboxDocument | null = null;

    while (Date.now() < deadline) {
      const result = await db.queryItems<VendorOutboxDocument>(
        'vendor-event-outbox',
        `SELECT * FROM c
         WHERE c.connectionId = @connectionId
           AND c.eventType = @eventType
           AND c.vendorOrderId = @vendorOrderId`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@eventType', value: 'vendor.message.received' },
          { name: '@vendorOrderId', value: VENDOR_ORDER_ID_MESSAGE },
        ],
      );
      const docs = result.data ?? [];
      if (docs.length > 0) {
        outboxDoc = docs[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }

    expect(outboxDoc).not.toBeNull();
    console.log('✅ Message outbox doc found:', outboxDoc?.id);

    expect(outboxDoc).toMatchObject({
      eventType: 'vendor.message.received',
      vendorType: 'class-valuation',
      connectionId: vendorConnectionId,
      status: 'PENDING',
      direction: 'inbound',
      vendorOrderId: VENDOR_ORDER_ID_MESSAGE,
    });

    const payload = outboxDoc?.payload as Record<string, unknown>;
    expect(typeof payload?.subject).toBe('string');
    expect(typeof payload?.content).toBe('string');
  }, 20_000);

  // ── Test 3: idempotency — duplicate webhook yields same outbox status ──────

  it('idempotent — posting the same order.completed webhook twice does not create duplicate outbox entry', async () => {
    const idempotentVendorOrderId = `CV-IDEM-${TS}`;
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.completed',
      occurredAt: '2026-06-01T10:00:00.000Z', // fixed timestamp for stable replay key
      data: {
        externalOrderId: idempotentVendorOrderId,
        orderId: `internal-idem-${TS}`,
        files: [],
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    // First POST
    const res1 = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);
    expect(res1.status).toBe(202);

    // Second POST — identical body
    const res2 = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);
    expect(res2.status).toBe(202);

    // Poll for outbox entries — should be exactly one (idempotency deduplicated the second)
    const deadline = Date.now() + 10_000;
    let docs: VendorOutboxDocument[] = [];
    while (Date.now() < deadline) {
      const result = await db.queryItems<VendorOutboxDocument>(
        'vendor-event-outbox',
        `SELECT * FROM c
         WHERE c.connectionId = @connectionId
           AND c.eventType = @eventType
           AND c.vendorOrderId = @vendorOrderId`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@eventType', value: 'vendor.order.completed' },
          { name: '@vendorOrderId', value: idempotentVendorOrderId },
        ],
      );
      docs = result.data ?? [];
      if (docs.length >= 1) break;
      await new Promise((r) => setTimeout(r, 1_000));
    }

    expect(docs).toHaveLength(1);
    console.log('✅ Idempotency confirmed — exactly one outbox entry created');
  }, 30_000);

  // ── Test 4: bad HMAC → 4xx ────────────────────────────────────────────────

  it('returns 4xx when HMAC signature is invalid', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.completed',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: `CV-BADHASH-${TS}`,
        orderId: null,
        files: [],
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', 'sha256=invalidhashvalue')
      .send(body);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    console.log('✅ Bad HMAC rejected with status:', res.status);
  }, 15_000);

  // ── Test 5: missing signature header → 4xx ───────────────────────────────

  it('returns 4xx when x-class-valuation-signature header is absent', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.completed',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: `CV-NOSIG-${TS}`,
        orderId: null,
        files: [],
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      // deliberately omitting x-class-valuation-signature
      .send(body);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    console.log('✅ Missing signature rejected with status:', res.status);
  }, 15_000);

  // ── Test 6: unknown account ID → 503 ─────────────────────────────────────

  it('returns 503 when no vendor connection exists for the account ID', async () => {
    const unknownAccountId = `cv-unknown-acct-${TS}`;
    const body = {
      accountId: unknownAccountId,
      event: 'order.completed',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: `CV-UNKNOWN-${TS}`,
        orderId: null,
        files: [],
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', unknownAccountId)
      .set('x-class-valuation-signature', signature)
      .send(body);

    // VendorConnectionConfigurationError → 503
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    console.log('✅ Unknown account ID rejected with 503');
  }, 15_000);

  // ── Test 7: unsupported event type → 4xx ─────────────────────────────────

  it('returns 4xx for an unsupported event type', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.cancelled', // not handled by the adapter
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: `CV-UNSUPPORTED-${TS}`,
        orderId: null,
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    console.log('✅ Unsupported event type rejected with status:', res.status);
  }, 15_000);
});

// ─── Suite 2: deactivated connection ─────────────────────────────────────────

describe.skipIf(!RUN)('ClassValuation webhook — deactivated connection rejects inbound', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let adminToken: string;

  let vendorConnectionId: string;

  const TS = Date.now();
  const TENANT_ID = `cv-deact-inttest-${TS}`;
  const ACCOUNT_ID = `cv-deact-acct-${TS}`;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({
      id: 'cv-deact-admin',
      email: 'cv-deact-admin@appraisal.com',
      name: 'CV Deactivated Admin',
      role: 'admin' as const,
      tenantId: TENANT_ID,
    });

    // Seed connection
    const connRes = await request(app)
      .post('/api/vendor-integrations/connections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorType: 'class-valuation',
        lenderId: 'lender-cv-deact-inttest',
        lenderName: 'CV Deact Integration Test Lender',
        inboundIdentifier: ACCOUNT_ID,
        credentials: {
          inboundHmacSecretName: SECRET_NAME,
          outboundHmacSecretName: SECRET_NAME,
        },
        outboundEndpointUrl: 'https://cv-mock.example.com/webhooks/orders',
        active: true,
      });

    if (connRes.status !== 201) {
      throw new Error(
        `Vendor connection seed failed: ${connRes.status} — ${JSON.stringify(connRes.body)}`,
      );
    }
    vendorConnectionId = connRes.body.data.id;
    console.log('✅ Deact test: vendor connection created:', vendorConnectionId);

    // Immediately deactivate it
    const deactivateRes = await request(app)
      .delete(`/api/vendor-integrations/connections/${vendorConnectionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (deactivateRes.status !== 200 && deactivateRes.status !== 204) {
      console.warn(
        `Deactivation returned unexpected status ${deactivateRes.status}`,
        deactivateRes.body,
      );
    }
  }, 60_000);

  afterAll(async () => {
    // Connection already deactivated in beforeAll; no further cleanup needed.
  });

  it('returns 503 when the vendor connection is deactivated', async () => {
    const body = {
      accountId: ACCOUNT_ID,
      event: 'order.completed',
      occurredAt: new Date().toISOString(),
      data: {
        externalOrderId: `CV-DEACT-${TS}`,
        orderId: null,
        files: [],
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = buildSignatureFromBuffer(HMAC_SECRET, rawBody);

    const res = await request(app)
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('Content-Type', 'application/json')
      .set('x-class-valuation-account-id', ACCOUNT_ID)
      .set('x-class-valuation-signature', signature)
      .send(body);

    // Deactivated connection triggers VendorConnectionConfigurationError → 503
    expect(res.status).toBe(503);
    console.log('✅ Deactivated connection rejected with 503');
  }, 15_000);
});
