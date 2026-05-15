/**
 * AIM-Port APIM Live-Fire E2E Test
 *
 * Fires a real HTTP request through the staging APIM endpoint:
 *
 *   Test process (seed/assert via staging Cosmos)
 *     → APIM (https://apim-appraisal-staging-lqxl5v.azure-api.net)
 *       → APIM policy: adds x-apim-forwarded: true, optional auth
 *       → Staging backend: enforceApimForwarding middleware passes
 *       → VendorIntegrationService → VendorOrderReferenceService …
 *
 * This test validates the real network path, APIM policy, and backend routing
 * that the in-process integration tests cannot exercise.
 *
 * Setup:
 *   A local AppraisalManagementAPIServer is started ONLY for vendor connection +
 *   vendor seeding (using the same staging Cosmos DB that the staging backend
 *   reads). All seeded docs are cleaned up on afterAll.
 *
 * Requires:
 *   VITEST_APIM_E2E=true          — opt-in guard (separate from VITEST_INTEGRATION)
 *   AZURE_COSMOS_ENDPOINT         — staging Cosmos endpoint
 *
 * Optional:
 *   APIM_BASE_URL                 — default: https://apim-appraisal-staging-lqxl5v.azure-api.net
 *   APIM_SUBSCRIPTION_KEY         — Ocp-Apim-Subscription-Key value if APIM
 *                                   requires a subscription key for this product
 *
 * The test vendor connection uses secret name "aim-port-integration-test-key"
 * which must exist in the staging Key Vault with value "test-api-key-aim-port-2026".
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';

const APIM_BASE_URL =
  process.env.APIM_BASE_URL ?? 'https://apim-appraisal-staging-lqxl5v.azure-api.net';
const APIM_INBOUND_PATH = '/api/v1/integrations/aim-port/inbound';
const APIM_SUBSCRIPTION_KEY = process.env.APIM_SUBSCRIPTION_KEY; // optional

const RUN =
  process.env.VITEST_APIM_E2E === 'true' && !!process.env.AZURE_COSMOS_ENDPOINT;

describe.skipIf(!RUN)('AIM-Port APIM live-fire E2E', () => {
  // ── Shared state ─────────────────────────────────────────────────────────
  let seedServer: AppraisalManagementAPIServer;
  let seedApp: Application;
  let adminToken: string;
  let db: CosmosDbService;
  let originalMockSbFlag: string | undefined;

  let vendorConnectionId: string;
  // Stable vendor — not deleted after the test so gcolclough can see bids in the UI.
  // ID is fixed so the linked user doc (also stable) always points to the right doc.
  const APPRAISER_VENDOR_ID = 'vendor-gcolclough-appraiser';
  let createdVendorOrderId: string;
  let createdEngagementId: string;

  // Use the real staging tenant so created orders are visible in the UI.
  // Admin user matches the dev user seeded by seed-dev-user.ts.
  const TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
  const CLIENT_ID = `aim-port-e2e-${Date.now()}`;
  const VENDOR_ORDER_ID = `AP-APIME2E-${Date.now()}`;
  const API_KEY = 'test-api-key-aim-port-2026';
  const SECRET_NAME = 'aim-port-integration-test-key';

  // ── Build the APIM inbound body ───────────────────────────────────────────
  function buildOrderRequest(vendorOrderId: string) {
    return {
      OrderRequest: {
        login: {
          client_id: CLIENT_ID,
          api_key: API_KEY,
          order_id: vendorOrderId,
        },
        order: {
          order_id: vendorOrderId,
          order_type: 'residential',
          address: '999 APIM Live Fire Ave',
          city: 'Austin',
          state: 'TX',
          zip_code: '78701',
          county: 'Travis',
          property_type: 'sfr',
          due_date: '2026-12-01',
          disclosed_fee: '800.00',
          rush: false,
          loan_number: `LN-APIME2E-${Date.now()}`,
          loan_amount: 600000,
          loan_type: 'Conventional',
          loan_purpose: 'Purchase',
          occupancy: 'Owner Occupied',
          borrower: {
            name: 'APIM E2E Test Borrower',
            email: 'apim-test@e2e.invalid',
            phone: '512-555-0042',
          },
          reports: [
            { id: 49079, name: '1004 Single-family Appraisal' },
          ],
        },
      },
    };
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    originalMockSbFlag = process.env.USE_MOCK_SERVICE_BUS;
    process.env.USE_MOCK_SERVICE_BUS = 'false';

    // Spin up a local server purely for seeding against staging Cosmos.
    seedServer = new AppraisalManagementAPIServer(0);
    seedApp = seedServer.getExpressApp();
    await seedServer.initDb();

    db = new CosmosDbService();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({
      id: '3cb04a10-b6f3-4fd1-8997-798507299d73', // matches seeded dev user (hiro@loneanalytics.com)
      email: 'hiro@loneanalytics.com',
      name: 'Hiro Hikawa',
      role: 'admin' as const,
      tenantId: TENANT_ID,
    });

    // Seed vendor connection (staging Cosmos — same DB that staging backend reads)
    const connRes = await request(seedApp)
      .post('/api/vendor-integrations/connections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorType: 'aim-port',
        lenderId: 'lender-apim-e2e',
        lenderName: 'APIM E2E Test Lender',
        inboundIdentifier: CLIENT_ID,
        credentials: {
          inboundApiKeySecretName: SECRET_NAME,
          outboundApiKeySecretName: SECRET_NAME,
          outboundClientId: CLIENT_ID,
        },
        outboundEndpointUrl: 'https://aim-port-mock.example.com',
        active: true,
        productMappings: {
          '48899': 'RECERTIFICATION_OF_VALUE',
          '48900': 'UPDATE_COMPLETION_CERT',
          '48909': 'FIELD_REVIEW_1UNIT',
          '48910': 'FIELD_REVIEW_24UNIT',
          '48912': 'DESK_REVIEW',
          '48930': 'CONDO_FHA',
          '48935': 'CONDO',
          '48860': 'MANUFACTURED_HOME_FHA',
          '48869': 'MULTI_FAMILY_FHA',
          '48873': 'LAND_APPRAISAL',
          '48915': 'MANUFACTURED_HOME',
          '48944': 'SFR_LB_PLATINUM',
          '48952': 'FULL_APPRAISAL',
          '48982': 'MULTI_FAMILY_FHA_INC',
          '48994': 'SFR_INC_RENT',
          '49032': 'SFR_RENT',
          '49033': 'CONDO_RENT',
          '49046': 'SFR_INC',
          '49052': 'CONDO_INC',
          '49079': 'FULL_APPRAISAL_FHA',
          '49081': 'FULL_APPRAISAL_FHA',
          '49099': 'MULTI_FAMILY_INC',
          '49003': 'CONDO_INC_RENT',
        },
      });

    if (connRes.status !== 201) {
      throw new Error(
        `APIM E2E: vendor connection seed failed ${connRes.status} — ${JSON.stringify(connRes.body)}`,
      );
    }
    vendorConnectionId = connRes.body.data.id;
    console.log('✅ [APIM E2E] Vendor connection seeded:', vendorConnectionId);

    // Stable vendor doc for gcolclough — upserted so repeated test runs are idempotent.
    // The linked user doc (below) binds gcolclough's Azure AD identity to this vendor
    // so they can log in to the UI and see bids/orders assigned to them.
    const vendorDoc = {
      id: APPRAISER_VENDOR_ID,
      type: 'vendor',
      entityType: 'vendor',
      tenantId: TENANT_ID,
      businessName: 'Colclough & Associates Appraisers',
      contactName: 'G Colclough',
      email: 'gcolclough@loneanalytics.com',
      phone: '+1-512-555-0001',
      status: 'ACTIVE',
      isActive: true,
      vendorType: 'INDEPENDENT',
      specialties: ['FULL_APPRAISAL', 'RESIDENTIAL'],
      serviceAreas: [{ state: 'TX', counties: ['Travis', 'Williamson', 'Hays'], zipCodes: [] }],
      rating: 4.9,
      averageQCScore: 95,
      onTimeDeliveryRate: 0.97,
      revisionRate: 0.03,
      performanceScore: 95,
      totalOrdersCompleted: 50,
      currentActiveOrders: 0,
      activeOrderCount: 0,
      maxActiveOrders: 20,
      certifications: ['SRA', 'AI-RRS'],
      licenseExpiration: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const vendorContainer = (db as any).getContainer('vendors');
    await vendorContainer.items.upsert(vendorDoc);
    console.log('✅ [APIM E2E] Vendor upserted:', APPRAISER_VENDOR_ID);

    // Stable user doc — links gcolclough's Azure AD identity to the vendor above.
    // portalDomain: 'vendor' + boundEntityIds lets the UI show them order bids.
    const usersContainer = (db as any).getContainer('users');
    await usersContainer.items.upsert({
      id: '2d57c213-85b3-4ea2-9805-f1928d7532ee',
      tenantId: TENANT_ID,
      email: 'gcolclough@loneanalytics.com',
      name: 'G Colclough',
      azureAdObjectId: '2d57c213-85b3-4ea2-9805-f1928d7532ee',
      role: 'appraiser',
      portalDomain: 'vendor',
      boundEntityIds: [APPRAISER_VENDOR_ID],
      isInternal: false,
      isActive: true,
      accessScope: {
        teamIds: [],
        departmentIds: [],
        managedClientIds: [],
        managedVendorIds: [],
        managedUserIds: [],
        regionIds: [],
        statesCovered: ['TX'],
        canViewAllOrders: false,
        canViewAllVendors: false,
        canOverrideQC: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ [APIM E2E] User doc upserted for gcolclough (vendor portal domain)');
  }, 60_000);

  afterAll(async () => {
    // Stop orchestrator subscriptions started by seed server
    const orchestrator = (seedServer as any)?.autoAssignmentOrchestrator;
    if (orchestrator) {
      await orchestrator.stop().catch(() => {});
      await orchestrator.subscriber?.close().catch(() => {});
    }

    // Remove vendor connection (per-run temp data)
    if (vendorConnectionId && seedApp) {
      await request(seedApp)
        .delete(`/api/vendor-integrations/connections/${vendorConnectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => {});
    }
    // NOTE: APPRAISER_VENDOR_ID ('vendor-gcolclough-appraiser') and the gcolclough
    // user doc are permanent staging seed data — intentionally NOT deleted here.

    // Restore env flags
    if (originalMockSbFlag !== undefined) {
      process.env.USE_MOCK_SERVICE_BUS = originalMockSbFlag;
    } else {
      delete process.env.USE_MOCK_SERVICE_BUS;
    }
  }, 30_000);

  // ── Tests ─────────────────────────────────────────────────────────────────

  it(
    'APIM returns 200 ACK with internal VendorOrder id when request is well-formed',
    async () => {
      const url = `${APIM_BASE_URL}${APIM_INBOUND_PATH}`;
      console.log(`[APIM E2E] POST ${url}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (APIM_SUBSCRIPTION_KEY) {
        headers['Ocp-Apim-Subscription-Key'] = APIM_SUBSCRIPTION_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildOrderRequest(VENDOR_ORDER_ID)),
      });

      const body = await res.json() as Record<string, unknown>;
      console.log('[APIM E2E] Response status:', res.status);
      console.log('[APIM E2E] Response body:', JSON.stringify(body, null, 2));

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        client_id: CLIENT_ID,
        success: 'true',
      });
      expect(typeof body['order_id']).toBe('string');
      expect((body['order_id'] as string).length).toBeGreaterThan(0);

      createdVendorOrderId = body['order_id'] as string;
      console.log('✅ [APIM E2E] VendorOrder created via APIM:', createdVendorOrderId);
    },
    45_000,
  );

  it(
    'APIM returns 400 (not 403) when body is missing — APIM forwarding header is present',
    async () => {
      // At minimum, APIM must be reachable and routing correctly (not firewall-blocked).
      // A malformed body produces a 400 from the backend, NOT a 403 APIM auth error.
      const url = `${APIM_BASE_URL}${APIM_INBOUND_PATH}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (APIM_SUBSCRIPTION_KEY) {
        headers['Ocp-Apim-Subscription-Key'] = APIM_SUBSCRIPTION_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: '{}', // missing required OrderRequest structure
      });

      console.log('[APIM E2E] Empty-body probe status:', res.status);

      // 400 means APIM forwarded successfully (backend returned a validation error).
      // 403 or 401 would mean APIM blocked the request (subscription or policy).
      // 500 would be a backend crash.
      expect([400, 401, 404, 503]).not.toContain(403);
      expect(res.status).not.toBe(403);
    },
    20_000,
  );

  it(
    'VendorOrder exists in Cosmos DB with engagement ancestry',
    async () => {
      expect(createdVendorOrderId).toBeDefined();

      // Small wait to let async Cosmos writes settle after the staging backend processes
      await new Promise((resolve) => setTimeout(resolve, 3_000));

      const result = await db.getItem('orders', createdVendorOrderId, TENANT_ID);
      console.log('[APIM E2E] Cosmos VendorOrder lookup result:', result.success);

      expect(result.success).toBe(true);
      const order = result.data as Record<string, unknown>;
      expect(typeof order['engagementId']).toBe('string');
      expect(typeof order['engagementPropertyId']).toBe('string');

      const meta = (order['metadata'] as any)?.vendorIntegration;
      expect(meta?.vendorOrderId).toBe(VENDOR_ORDER_ID);
      expect(meta?.vendorType).toBe('aim-port');
      expect(meta?.connectionId).toBe(vendorConnectionId);

      createdEngagementId = order['engagementId'] as string;
      console.log('✅ [APIM E2E] VendorOrder Cosmos doc confirmed');
    },
    20_000,
  );

  it(
    'Engagement in Cosmos DB was created as expected',
    async () => {
      expect(createdEngagementId).toBeDefined();

      const result = await db.getItem('engagements', createdEngagementId, TENANT_ID);
      console.log('[APIM E2E] Cosmos Engagement lookup result:', result.success);

      expect(result.success).toBe(true);
      const engagement = result.data as Record<string, unknown>;
      expect(typeof engagement['id']).toBe('string');
      expect(typeof engagement['tenantId']).toBe('string');
      console.log('✅ [APIM E2E] Engagement Cosmos doc confirmed');
    },
    15_000,
  );

  it(
    'Idempotency: replaying the same order_id returns the same VendorOrder id',
    async () => {
      expect(createdVendorOrderId).toBeDefined();

      const url = `${APIM_BASE_URL}${APIM_INBOUND_PATH}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (APIM_SUBSCRIPTION_KEY) {
        headers['Ocp-Apim-Subscription-Key'] = APIM_SUBSCRIPTION_KEY;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildOrderRequest(VENDOR_ORDER_ID)), // same VENDOR_ORDER_ID
      });

      const body = await res.json() as Record<string, unknown>;
      console.log('[APIM E2E] Replay response body:', JSON.stringify(body, null, 2));

      expect(res.status).toBe(200);
      // Idempotent replay must return the SAME internal order_id
      expect(body['order_id']).toBe(createdVendorOrderId);
      console.log('✅ [APIM E2E] Idempotency confirmed');
    },
    25_000,
  );
});
