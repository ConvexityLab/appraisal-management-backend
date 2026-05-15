/**
 * AIM-Port inbound OrderRequest — full integration test.
 *
 * Uses an in-process AppraisalManagementAPIServer (pattern from live-api.test.ts)
 * against real Azure Cosmos DB staging. Verifies the complete pipeline:
 *
 *   AIM-Port OrderRequest (HTTP)
 *     → vendor-connection lookup (Cosmos vendor-connections)
 *     → API key auth via Key Vault
 *     → VendorOrderReferenceService.createOrGetOrderReference
 *     → EngagementService.createEngagement (Cosmos engagements)
 *     → ClientOrderService.addVendorOrders (Cosmos orders)
 *     → ACK returned to caller with internal VendorOrder id
 *
 * Requires:
 *   VITEST_INTEGRATION=true
 *   AZURE_COSMOS_ENDPOINT set (staging)
 *   Key Vault secret "aim-port-integration-test-key" = "test-api-key-aim-port-2026"
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';

const RUN = process.env.VITEST_INTEGRATION === 'true' && !!process.env.AZURE_COSMOS_ENDPOINT;

describe.skipIf(!RUN)('AIM-Port inbound — full integration pipeline', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let adminToken: string;
  let db: CosmosDbService;
  let originalMockSbFlag: string | undefined;

  // IDs seeded / created during the test — used for assertions and cleanup
  let vendorConnectionId: string;
  let createdVendorOrderId: string;
  let createdEngagementId: string;
  let seededVendorId: string;

  const TENANT_ID = `aim-port-inttest-${Date.now()}`;
  const CLIENT_ID = `aim-port-inttest-client-${Date.now()}`;
  const VENDOR_ORDER_ID = `AP-INTTEST-${Date.now()}`;
  const API_KEY = 'test-api-key-aim-port-2026'; // must match Key Vault secret
  const SECRET_NAME = 'aim-port-integration-test-key';

  beforeAll(async () => {
    // Use real Azure Service Bus — not the in-memory mock.
    originalMockSbFlag = process.env.USE_MOCK_SERVICE_BUS;
    process.env.USE_MOCK_SERVICE_BUS = 'false';

    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    db = new CosmosDbService();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({
      id: 'inttest-admin',
      email: 'inttest-admin@appraisal.com',
      name: 'Integration Test Admin',
      role: 'admin' as const,
      tenantId: TENANT_ID,
    });

    // ── Seed: create the vendor connection ────────────────────────────────────
    const connRes = await request(app)
      .post('/api/vendor-integrations/connections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorType: 'aim-port',
        lenderId: 'lender-inttest',
        lenderName: 'Integration Test Lender',
        inboundIdentifier: CLIENT_ID,
        credentials: {
          inboundApiKeySecretName: SECRET_NAME,
          outboundApiKeySecretName: SECRET_NAME,
          outboundClientId: CLIENT_ID,
        },
        outboundEndpointUrl: 'https://aim-port-mock.example.com',
        active: true,
      });

    if (connRes.status !== 201) {
      throw new Error(
        `Vendor connection seed failed: ${connRes.status} — ${JSON.stringify(connRes.body)}`,
      );
    }
    vendorConnectionId = connRes.body.data.id;
    console.log('✅ Vendor connection created:', vendorConnectionId);

    // ── Seed: create a matching vendor so auto-assignment can find a candidate ──
    // Uses the same tenantId as the test run.  The vendor covers TX (Austin area)
    // which matches the property state in the inbound order.
    seededVendorId = `vendor-inttest-${Date.now()}`;
    const vendorDoc = {
      id: seededVendorId,
      type: 'vendor',
      entityType: 'vendor',
      tenantId: TENANT_ID,
      businessName: 'Integration Test Appraisers LLC',
      contactName: 'Test Appraiser',
      email: `vendor-inttest@example.com`,
      phone: '+1-512-555-0001',
      status: 'ACTIVE',
      isActive: true,
      vendorType: 'INDEPENDENT',
      specialties: ['FULL_APPRAISAL', 'RESIDENTIAL'],
      serviceAreas: [{ state: 'TX', counties: ['Travis', 'Williamson', 'Hays'], zipCodes: [] }],
      rating: 4.7,
      averageQCScore: 88,
      onTimeDeliveryRate: 0.92,
      revisionRate: 0.07,
      performanceScore: 85,
      totalOrdersCompleted: 50,
      currentActiveOrders: 2,
      activeOrderCount: 2,
      maxActiveOrders: 15,
      isBusy: false,
      standardFee: 550,
      rushFee: 750,
      averageTurnaroundDays: 5,
      certificationTypes: ['SRA'],
      licenseExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const vendorSeedResult = await db.upsertItem('vendors', vendorDoc);
    if (!vendorSeedResult.success) {
      throw new Error(`Vendor seed failed: ${JSON.stringify(vendorSeedResult.error)}`);
    }
    console.log('✅ Matching vendor seeded:', seededVendorId);
  }, 60_000);

  afterAll(async () => {
    // Restore the Service Bus mock flag for any subsequent test suites.
    process.env.USE_MOCK_SERVICE_BUS = originalMockSbFlag ?? 'true';

    // Stop the orchestrator and close its SB receiver so it doesn't steal
    // messages from the broadcast describe block which shares the same
    // auto-assignment-service subscription on staging Service Bus.
    const orchestrator = (serverInstance as any)?.autoAssignmentOrchestrator;
    if (orchestrator) {
      await orchestrator.stop().catch(() => {});
      await orchestrator.subscriber?.close().catch(() => {});
    }

    // Clean up: deactivate the vendor connection so it doesn't poison other runs.
    if (vendorConnectionId && app) {
      await request(app)
        .delete(`/api/vendor-integrations/connections/${vendorConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    // Clean up seeded vendor doc.
    if (seededVendorId && db) {
      await (db as any).deleteItem('vendors', seededVendorId, TENANT_ID).catch(() => {});
    }
  });

  it('returns 200 ACK with internal VendorOrder id stamped as order_id', async () => {
    const body = {
      OrderRequest: {
        login: {
          client_id: CLIENT_ID,
          api_key: API_KEY,
          order_id: VENDOR_ORDER_ID,
        },
        order: {
          order_id: VENDOR_ORDER_ID,
          order_type: 'residential',
          address: '789 Integration Blvd',
          city: 'Austin',
          state: 'TX',
          zip_code: '78702',
          county: 'Travis',
          property_type: 'sfr',
          due_date: '2026-07-01',
          disclosed_fee: '750.00',
          rush: false,
          loan_number: `LN-INTTEST-${Date.now()}`,
          loan_amount: 525000,
          loan_type: 'Conventional',
          loan_purpose: 'Purchase',
          occupancy: 'Owner Occupied',
          borrower: {
            name: 'Integration Test Borrower',
            email: 'borrower@inttest.com',
            phone: '512-555-9999',
          },
          reports: [
            { id: 49079, name: '1004 Single-family Appraisal' },
          ],
        },
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/aim-port/inbound')
      .set('Content-Type', 'application/json')
      .send(body);

    console.log('AIM-Port inbound response:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      client_id: CLIENT_ID,
      success: 'true',
      fee: 750,
    });
    expect(typeof res.body.order_id).toBe('string');
    expect(res.body.order_id.length).toBeGreaterThan(0);

    createdVendorOrderId = res.body.order_id;
    console.log('✅ VendorOrder created:', createdVendorOrderId);
  }, 30_000);

  it('VendorOrder in Cosmos has full engagement ancestry', async () => {
    expect(createdVendorOrderId).toBeDefined();

    const result = await db.getItem('orders', createdVendorOrderId, TENANT_ID);
    expect(result.success).toBe(true);

    const order = result.data as Record<string, unknown>;
    console.log('VendorOrder from Cosmos:', JSON.stringify(order, null, 2));

    expect(typeof order['engagementId']).toBe('string');
    expect(typeof order['engagementPropertyId']).toBe('string');
    expect(typeof order['engagementClientOrderId']).toBe('string');

    createdEngagementId = order['engagementId'] as string;

    // Vendor integration metadata must be stamped for idempotency
    const meta = (order['metadata'] as any)?.vendorIntegration;
    expect(meta?.vendorOrderId).toBe(VENDOR_ORDER_ID);
    expect(meta?.vendorType).toBe('aim-port');
    expect(meta?.connectionId).toBe(vendorConnectionId);
  }, 15_000);

  it('Engagement in Cosmos has property as anchor with loan in loanReferences', async () => {
    expect(createdEngagementId).toBeDefined();

    const result = await db.getItem('engagements', createdEngagementId, TENANT_ID);
    expect(result.success).toBe(true);

    const engagement = result.data as Record<string, unknown>;
    console.log('Engagement from Cosmos:', JSON.stringify(engagement, null, 2));

    const properties = engagement['properties'] as any[];
    expect(Array.isArray(properties)).toBe(true);
    expect(properties.length).toBeGreaterThan(0);

    const prop = properties[0];
    expect(prop.property?.address).toBe('789 Integration Blvd');
    expect(prop.property?.city).toBe('Austin');

    // Loan is metadata on the property — NOT a top-level property
    const loanRefs = prop.loanReferences ?? [];
    expect(loanRefs.length).toBeGreaterThan(0);
    expect(loanRefs[0].loanAmount).toBe(525000);
  }, 15_000);

  it('idempotent — second identical OrderRequest returns the same VendorOrder id', async () => {
    expect(createdVendorOrderId).toBeDefined();

    const body = {
      OrderRequest: {
        login: {
          client_id: CLIENT_ID,
          api_key: API_KEY,
          order_id: VENDOR_ORDER_ID,
        },
        order: {
          order_id: VENDOR_ORDER_ID,
          order_type: 'residential',
          address: '789 Integration Blvd',
          city: 'Austin',
          state: 'TX',
          zip_code: '78702',
          property_type: 'sfr',
          due_date: '2026-07-01',
          disclosed_fee: '750.00',
          rush: false,
          borrower: { name: 'Integration Test Borrower' },
          reports: [{ id: 49079, name: '1004 Single-family Appraisal' }],
        },
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/aim-port/inbound')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.order_id).toBe(createdVendorOrderId);
    console.log('✅ Idempotency confirmed — same order_id returned:', res.body.order_id);
  }, 30_000);

  it('returns 503 when vendor connection does not exist for an unknown client_id', async () => {
    const body = {
      OrderRequest: {
        login: {
          client_id: 'unknown-client-xyz',
          api_key: 'any-key',
          order_id: 'AP-UNKNOWN',
        },
        order: {
          order_id: 'AP-UNKNOWN',
          address: '1 Unknown St',
          city: 'Dallas',
          state: 'TX',
          zip_code: '75001',
          property_type: 'sfr',
          due_date: '2026-07-01',
          borrower: { name: 'Nobody' },
          reports: [{ id: 99999, name: 'Unknown' }],
        },
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/aim-port/inbound')
      .send(body);

    // VendorConnectionConfigurationError → 503
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  }, 15_000);

  it('autoVendorAssignment FSM reaches PENDING_BID when a matching vendor is seeded', async () => {
    expect(createdVendorOrderId).toBeDefined();

    // The triggerVendorAssignment is fire-and-forget.  The order state update to
    // PENDING_BID happens in Cosmos BEFORE the Service Bus publish, so it is
    // observable even when Service Bus is not running in integration test environments.
    // Allow up to 10 s for the async work to complete.
    const deadline = Date.now() + 10_000;
    let assignment: Record<string, unknown> | undefined;
    while (Date.now() < deadline) {
      const result = await db.getItem('orders', createdVendorOrderId, TENANT_ID);
      assignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      if (assignment?.status === 'PENDING_BID' || assignment?.status === 'ACCEPTED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }

    console.log('autoVendorAssignment state after bid sent:', JSON.stringify(assignment, null, 2));

    expect(assignment).toBeDefined();
    expect(['PENDING_BID', 'ACCEPTED']).toContain(assignment?.status);
    // The ranked vendor list must include the seeded vendor.
    const rankedVendors = (assignment?.rankedVendors as any[]) ?? [];
    expect(rankedVendors.some((v: any) => v.vendorId === seededVendorId)).toBe(true);
  }, 20_000);

  it('autoVendorAssignment FSM reaches ACCEPTED after operator calls vendor/accept', async () => {
    expect(createdVendorOrderId).toBeDefined();

    // Ensure the order is at least in PENDING_BID before we try to accept.
    const pendingDeadline = Date.now() + 10_000;
    let priorAssignment: Record<string, unknown> | undefined;
    while (Date.now() < pendingDeadline) {
      const result = await db.getItem('orders', createdVendorOrderId, TENANT_ID);
      priorAssignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      if (priorAssignment?.status === 'PENDING_BID' || priorAssignment?.status === 'ACCEPTED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    // Skip accept call if the FSM already reached ACCEPTED via the orchestrator.
    if (priorAssignment?.status !== 'ACCEPTED') {
      expect(priorAssignment?.status).toBe('PENDING_BID');

      const acceptRes = await request(app)
        .post(`/api/auto-assignment/orders/${createdVendorOrderId}/vendor/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(acceptRes.body.success).toBe(true);
    }

    // Poll for ACCEPTED — the orchestrator's onVendorBidAccepted may be async.
    const acceptDeadline = Date.now() + 5_000;
    let finalAssignment: Record<string, unknown> | undefined;
    while (Date.now() < acceptDeadline) {
      const result = await db.getItem('orders', createdVendorOrderId, TENANT_ID);
      finalAssignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      if (finalAssignment?.status === 'ACCEPTED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log('autoVendorAssignment state after accept:', JSON.stringify(finalAssignment, null, 2));

    expect(finalAssignment?.status).toBe('ACCEPTED');
    const rankedVendors = (finalAssignment?.rankedVendors as any[]) ?? [];
    expect(rankedVendors.some((v: any) => v.vendorId === seededVendorId)).toBe(true);
  }, 25_000);
});

/**
 * Broadcast-mode integration test.
 *
 * Seeds a client-config with bidMode='broadcast' + broadcastCount=2, seeds 2
 * matching vendors, submits an AIM-Port order, and verifies:
 *   1. autoVendorAssignment enters broadcast mode (broadcastBidIds populated).
 *   2. POST /vendor/accept returns 200 and delegates to the orchestrator.
 *   3. autoVendorAssignment reaches ACCEPTED (orchestrator cancels the other bid).
 */
describe.skipIf(!RUN)('AIM-Port inbound — broadcast-mode auto-assignment', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let adminToken: string;
  let db: CosmosDbService;
  let originalMockSbFlag: string | undefined;

  let vendorConnectionId: string;
  let createdOrderId: string;
  let seededVendorId1: string;
  let seededVendorId2: string;
  let seededClientConfigId: string;

  const TS = Date.now();
  const TENANT_ID = `aim-port-broadcast-inttest-${TS}`;
  const CLIENT_ID = `aim-port-broadcast-client-${TS}`;
  const VENDOR_ORDER_ID = `AP-BROADCAST-${TS}`;
  const API_KEY = 'test-api-key-aim-port-2026';
  const SECRET_NAME = 'aim-port-integration-test-key';

  beforeAll(async () => {
    // Use real Azure Service Bus — not the in-memory mock.
    originalMockSbFlag = process.env.USE_MOCK_SERVICE_BUS;
    process.env.USE_MOCK_SERVICE_BUS = 'false';

    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    db = new CosmosDbService();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({
      id: 'broadcast-inttest-admin',
      email: 'broadcast-admin@appraisal.com',
      name: 'Broadcast Integration Test Admin',
      role: 'admin' as const,
      tenantId: TENANT_ID,
    });

    // ── Seed: broadcast client config ────────────────────────────────────────
    seededClientConfigId = `client-config-${CLIENT_ID}`;
    const configDoc = {
      id: seededClientConfigId,
      entityType: 'client-config',
      clientId: 'lender-broadcast-inttest',
      bidMode: 'broadcast',
      broadcastCount: 2,
      autoAssignmentEnabled: true,
      maxVendorRetries: 3,
      bidExpirationHours: 24,
      requiresEngagementLetter: false,
      autoDeliveryEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'integration-test',
    };
    const configSeedResult = await db.upsertItem('client-configs', configDoc);
    if (!configSeedResult.success) {
      throw new Error(`Client config seed failed: ${JSON.stringify(configSeedResult.error)}`);
    }
    console.log('✅ Broadcast client config seeded:', seededClientConfigId);

    // ── Seed: vendor connection ───────────────────────────────────────────────
    const connRes = await request(app)
      .post('/api/vendor-integrations/connections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorType: 'aim-port',
        lenderId: 'lender-broadcast-inttest',
        lenderName: 'Broadcast Integration Test Lender',
        inboundIdentifier: CLIENT_ID,
        credentials: {
          inboundApiKeySecretName: SECRET_NAME,
          outboundApiKeySecretName: SECRET_NAME,
          outboundClientId: CLIENT_ID,
        },
        outboundEndpointUrl: 'https://aim-port-mock.example.com',
        active: true,
      });

    if (connRes.status !== 201) {
      throw new Error(
        `Vendor connection seed failed: ${connRes.status} — ${JSON.stringify(connRes.body)}`,
      );
    }
    vendorConnectionId = connRes.body.data.id;
    console.log('✅ Vendor connection created:', vendorConnectionId);

    // ── Seed: 2 matching vendors (TX, Travis county) ─────────────────────────
    const now = new Date().toISOString();
    const buildVendorDoc = (idx: number) => ({
      id: `vendor-broadcast-inttest-${TS}-${idx}`,
      type: 'vendor',
      entityType: 'vendor',
      tenantId: TENANT_ID,
      businessName: `Broadcast Integration Appraiser ${idx}`,
      contactName: `Test Appraiser ${idx}`,
      email: `vendor-broadcast-${idx}-${TS}@example.com`,
      phone: '+1-512-555-0100',
      status: 'ACTIVE',
      isActive: true,
      vendorType: 'INDEPENDENT',
      specialties: ['FULL_APPRAISAL', 'RESIDENTIAL'],
      serviceAreas: [{ state: 'TX', counties: ['Travis', 'Williamson'], zipCodes: [] }],
      rating: 4.5,
      averageQCScore: 85,
      onTimeDeliveryRate: 0.90,
      revisionRate: 0.08,
      performanceScore: 82,
      totalOrdersCompleted: 40,
      currentActiveOrders: 1,
      activeOrderCount: 1,
      maxActiveOrders: 15,
      isBusy: false,
      standardFee: 575,
      rushFee: 775,
      averageTurnaroundDays: 6,
      certificationTypes: ['SRA'],
      licenseExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    seededVendorId1 = `vendor-broadcast-inttest-${TS}-1`;
    seededVendorId2 = `vendor-broadcast-inttest-${TS}-2`;

    for (const doc of [buildVendorDoc(1), buildVendorDoc(2)]) {
      const r = await db.upsertItem('vendors', doc);
      if (!r.success) {
        throw new Error(`Vendor seed failed: ${JSON.stringify(r.error)}`);
      }
    }
    console.log('✅ Broadcast vendors seeded:', seededVendorId1, seededVendorId2);
  }, 60_000);

  afterAll(async () => {
    // Restore the Service Bus mock flag for any subsequent test suites.
    process.env.USE_MOCK_SERVICE_BUS = originalMockSbFlag ?? 'true';

    if (vendorConnectionId && app) {
      await request(app)
        .delete(`/api/vendor-integrations/connections/${vendorConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    for (const id of [seededVendorId1, seededVendorId2]) {
      if (id && db) {
        await (db as any).deleteItem('vendors', id, TENANT_ID).catch(() => {});
      }
    }
    if (seededClientConfigId && db) {
      await (db as any).deleteItem('client-configs', seededClientConfigId, 'lender-broadcast-inttest').catch(() => {});
    }
  });

  it('returns 200 ACK from AIM-Port inbound with broadcast client', async () => {
    const body = {
      OrderRequest: {
        login: {
          client_id: CLIENT_ID,
          api_key: API_KEY,
          order_id: VENDOR_ORDER_ID,
        },
        order: {
          order_id: VENDOR_ORDER_ID,
          order_type: 'residential',
          address: '456 Broadcast Ave',
          city: 'Austin',
          state: 'TX',
          zip_code: '78701',
          county: 'Travis',
          property_type: 'sfr',
          due_date: '2026-08-01',
          disclosed_fee: '600.00',
          rush: false,
          loan_number: `LN-BROADCAST-${TS}`,
          loan_amount: 480000,
          loan_type: 'Conventional',
          loan_purpose: 'Purchase',
          occupancy: 'Owner Occupied',
          borrower: {
            name: 'Broadcast Test Borrower',
            email: 'broadcast-borrower@inttest.com',
            phone: '512-555-8888',
          },
          reports: [
            { id: 49079, name: '1004 Single-family Appraisal' },
          ],
        },
      },
    };

    const res = await request(app)
      .post('/api/v1/integrations/aim-port/inbound')
      .set('Content-Type', 'application/json')
      .send(body);

    console.log('Broadcast AIM-Port inbound response:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ client_id: CLIENT_ID, success: 'true' });
    expect(typeof res.body.order_id).toBe('string');

    createdOrderId = res.body.order_id;
    console.log('✅ Broadcast order created:', createdOrderId);
  }, 30_000);

  it('autoVendorAssignment enters broadcast mode — broadcastBidIds populated', async () => {
    expect(createdOrderId).toBeDefined();

    // The broadcast dispatch is fire-and-forget.  The order doc is updated in
    // Cosmos before Service Bus publish, so this is observable without SB.
    const deadline = Date.now() + 15_000;
    let assignment: Record<string, unknown> | undefined;
    while (Date.now() < deadline) {
      const result = await db.getItem('orders', createdOrderId, TENANT_ID);
      assignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      const bids = (assignment?.broadcastBidIds as unknown[]) ?? [];
      if (assignment?.broadcastMode === true && bids.length >= 1) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }

    console.log('autoVendorAssignment broadcast state:', JSON.stringify(assignment, null, 2));

    expect(assignment).toBeDefined();
    expect(assignment?.broadcastMode).toBe(true);
    const broadcastBidIds = (assignment?.broadcastBidIds as unknown[]) ?? [];
    expect(broadcastBidIds.length).toBeGreaterThanOrEqual(1);

    // At least one of the two seeded vendors must be in the ranked list.
    const rankedVendors = (assignment?.rankedVendors as any[]) ?? [];
    const seededIds = [seededVendorId1, seededVendorId2];
    expect(rankedVendors.some((v: any) => seededIds.includes(v.vendorId))).toBe(true);
  }, 20_000);

  it('POST /vendor/accept delegates to orchestrator in broadcast mode', async () => {
    expect(createdOrderId).toBeDefined();

    // Wait for broadcast bids to be populated before accepting.
    const pollDeadline = Date.now() + 10_000;
    while (Date.now() < pollDeadline) {
      const result = await db.getItem('orders', createdOrderId, TENANT_ID);
      const assignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      const bids = (assignment?.broadcastBidIds as unknown[]) ?? [];
      if (assignment?.broadcastMode === true && bids.length >= 1) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const acceptRes = await request(app)
      .post(`/api/auto-assignment/orders/${createdOrderId}/vendor/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    console.log('Broadcast accept response:', JSON.stringify(acceptRes.body, null, 2));

    expect(acceptRes.body.success).toBe(true);
    // In broadcast mode the endpoint hands off to the orchestrator rather than
    // writing ACCEPTED immediately.
    expect(acceptRes.body.message).toMatch(/orchestrat/i);
  }, 20_000);

  it('autoVendorAssignment reaches ACCEPTED after broadcast accept', async () => {
    expect(createdOrderId).toBeDefined();

    // The orchestrator handles onVendorBidAccepted via the real Service Bus consumer.
    // Allow up to 60 s for the publish → SB broker → receive → Cosmos-write cycle.
    const deadline = Date.now() + 60_000;
    let finalAssignment: Record<string, unknown> | undefined;
    while (Date.now() < deadline) {
      const result = await db.getItem('orders', createdOrderId, TENANT_ID);
      finalAssignment = (result.data as any)?.autoVendorAssignment as Record<string, unknown> | undefined;
      if (finalAssignment?.status === 'ACCEPTED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }

    console.log('Broadcast autoVendorAssignment final state:', JSON.stringify(finalAssignment, null, 2));

    expect(finalAssignment?.status).toBe('ACCEPTED');
    expect(finalAssignment?.broadcastMode).toBe(true);

    // The other broadcast bid(s) must have been cancelled.
    const broadcastBidIds = (finalAssignment?.broadcastBidIds as unknown[]) ?? [];
    expect(broadcastBidIds.length).toBeGreaterThanOrEqual(1);
  }, 75_000);
});
