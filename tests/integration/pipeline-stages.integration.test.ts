/**
 * Pipeline Stages — Live-Fire Integration Tests
 *
 * Exercises the post-placement pipeline stages end-to-end against real Cosmos DB:
 *
 *   Stage 3 — trigger-auto-assignment
 *     POST /api/orders/:orderId/trigger-auto-assignment
 *       → VendorMatchingEngine.findMatchingVendorsAndDenied (no seeded vendors)
 *       → escalateVendorAssignment
 *       → order.autoVendorAssignment.status = 'EXHAUSTED', requiresHumanVendorAssignment = true
 *
 *   Stage 4 — acceptVendorBid
 *     Seed vendor-bid doc + patch order autoVendorAssignment to PENDING_BID
 *     POST /api/orders/:orderId/vendor-bid/:bidId/accept
 *       → order.status = 'ASSIGNED', assignedVendorId set
 *       → autoVendorAssignment.status = 'ACCEPTED'
 *
 *   Stage 5 — updateOrderStatus → SUBMITTED (HTTP)
 *     PUT /api/orders/:orderId/status { status: 'SUBMITTED' }
 *       → controller calls qcQueueService.addToQueue() directly (fire-and-forget)
 *       → controller auto-advances order to QC_REVIEW
 *       → qc-reviews doc created with orderId
 *
 * Run with:
 *   VITEST_INTEGRATION=true pnpm vitest run tests/integration/pipeline-stages.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import type { VendorOrder } from '../../src/types/vendor-order.types.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Poll every 250 ms until predicate returns truthy or deadline passes. */
async function poll<T>(
  fn: () => Promise<T | null | undefined | false>,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`poll: timed out after ${timeoutMs}ms`);
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe.skipIf(process.env.VITEST_INTEGRATION !== 'true')(
  'Pipeline Stages — live-fire integration',
  () => {
    const TEST_TENANT = `integ-pipeline-${Date.now()}`;
    const TEST_CLIENT = `integ-pipeline-client-${Date.now()}`;

    let serverInstance: AppraisalManagementAPIServer;
    let app: Application;
    let adminToken: string;
    let dbService: CosmosDbService;

    // Resources created during tests — cleaned up in afterAll.
    const cleanupDocs: Array<{ container: string; id: string; partitionKey: string }> = [];

    beforeAll(async () => {
      const endpoint =
        process.env.COSMOS_ENDPOINT ??
        process.env.AZURE_COSMOS_ENDPOINT ??
        'https://localhost:8081';

      if (endpoint.includes('localhost')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }

      serverInstance = new AppraisalManagementAPIServer(0);
      app = serverInstance.getExpressApp();
      await serverInstance.initDb();

      const tokenGen = new TestTokenGenerator();
      adminToken = tokenGen.generateToken({
        id: 'pipeline-test-admin',
        email: 'pipeline@test.com',
        name: 'Pipeline Test Admin',
        role: 'admin' as const,
        tenantId: TEST_TENANT,
      });

      dbService = new CosmosDbService(endpoint);
      await dbService.initialize();

      console.log(`✅ Ready — tenant=${TEST_TENANT}, client=${TEST_CLIENT}`);
    }, 90_000);

    afterAll(async () => {
      if (dbService) {
        for (const { container, id, partitionKey } of cleanupDocs) {
          await dbService.deleteDocument(container, id, partitionKey).catch(() => {});
        }
        if (dbService.isDbConnected()) {
          await dbService.disconnect().catch(() => {});
        }
      }
    });

    // ── Stage 3 ───────────────────────────────────────────────────────────────

    describe('Stage 3 — trigger-auto-assignment (EXHAUSTED when no vendors seeded)', () => {
      /**
       * Self-contained: seeds a VendorOrder directly so we are not dependent on
       * the engagement pipeline's decomposition rules (which produce 0 VendorOrders
       * when no matching templates exist).  The trigger-auto-assignment controller
       * runs VendorMatchingEngine against an empty vendor pool, exhausts all
       * candidates, and stamps autoVendorAssignment.status = 'EXHAUSTED'.
       */
      let orderId: string;

      beforeAll(async () => {
        orderId = `orders-stg3-${Date.now()}`;
        const vendorOrder = {
          id: orderId,
          // type must match VENDOR_ORDER_TYPE_PREDICATE so findOrderById can locate it
          type: 'vendor-order',
          tenantId: TEST_TENANT,
          clientId: TEST_CLIENT,
          engagementId: `eng-stg3-${Date.now()}`,
          orderNumber: `STG3-${Date.now()}`,
          productType: 'FULL_APPRAISAL',
          status: 'PENDING',
          priority: 'STANDARD',
          propertyAddress: '123 Pipeline Ave',
          propertyState: 'TX',
          loanAmount: 300_000,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await dbService.createItem('orders', vendorOrder);
        cleanupDocs.push({ container: 'orders', id: orderId, partitionKey: TEST_TENANT });
        console.log(`Stage 3 — seeded orderId=${orderId}`);
      });

      it('POST /api/orders/:id/trigger-auto-assignment returns 200', async () => {
        const res = await request(app)
          .post(`/api/orders/${orderId}/trigger-auto-assignment`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send();

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(200);
      });

      it('order.autoVendorAssignment.status = EXHAUSTED and requiresHumanVendorAssignment = true', async () => {
        // triggerAutoAssignment is synchronous, but poll briefly to allow
        // any async write paths to flush.
        const order = await poll<VendorOrder>(async () => {
          const result = await dbService.getItem('orders', orderId, TEST_TENANT);
          const doc = (result as any)?.data ?? result;
          const avs = (doc as any)?.autoVendorAssignment;
          return avs?.status ? (doc as VendorOrder) : null;
        }, 10_000);

        const avs = (order as any).autoVendorAssignment;
        expect(avs.status).toBe('EXHAUSTED');
        expect((order as any).requiresHumanVendorAssignment).toBe(true);
        console.log(`Stage 3 — autoVendorAssignment.status=${avs.status} ✅`);
      }, 15_000);
    });

    // ── Stage 4 ───────────────────────────────────────────────────────────────

    describe('Stage 4 — acceptVendorBid transitions order to ASSIGNED', () => {
      /**
       * Self-contained: seeds a VendorOrder (PENDING_BID) + a vendor-bid doc.
       * Requires the 'vendor-bids' Cosmos container to be deployed —
       * wired as cosmosVendorMarketplaceContainers in main.bicep.
       * beforeAll throws (failing the suite) if the container is absent.
       */
      let orderId: string;
      let bidId: string;
      const VENDOR_ID = `test-vendor-${Date.now()}`;
      const VENDOR_NAME = 'Test Vendor Co.';

      beforeAll(async () => {
        bidId = `bid-${Date.now()}-${uuidv4().slice(0, 8)}`;
        orderId = `orders-stg4-${Date.now()}`;

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const vendorOrder = {
          id: orderId,
          // type must match VENDOR_ORDER_TYPE_PREDICATE so findOrderById can locate it
          type: 'vendor-order',
          tenantId: TEST_TENANT,
          clientId: TEST_CLIENT,
          engagementId: `eng-stg4-${Date.now()}`,
          orderNumber: `STG4-${Date.now()}`,
          productType: 'FULL_APPRAISAL',
          status: 'PENDING',
          priority: 'STANDARD',
          propertyAddress: '456 Stage Four Blvd',
          propertyState: 'TX',
          loanAmount: 350_000,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          autoVendorAssignment: {
            status: 'PENDING_BID',
            currentBidId: bidId,
            currentBidExpiresAt: expiresAt,
            rankedVendors: [{ vendorId: VENDOR_ID, vendorName: VENDOR_NAME, score: 90 }],
            currentAttempt: 0,
            initiatedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const bidDoc = {
          id: bidId,
          orderId,
          orderNumber: `STG4-${Date.now()}`,
          tenantId: TEST_TENANT,
          vendorId: VENDOR_ID,
          vendorName: VENDOR_NAME,
          status: 'PENDING',
          entityType: 'vendor-bid-invitation',
          isAutoAssignment: true,
          invitedAt: new Date().toISOString(),
          expiresAt,
          attemptNumber: 1,
        };

        await dbService.createItem('orders', vendorOrder);
        cleanupDocs.push({ container: 'orders', id: orderId, partitionKey: TEST_TENANT });

        const bidCreateResult = await dbService.createItem('vendor-bids', bidDoc);
        if (!bidCreateResult.success) {
          throw new Error(
            `Stage 4 setup failed — 'vendor-bids' container not available. ` +
              `Error: ${JSON.stringify((bidCreateResult as any).error?.code ?? 'unknown')}. ` +
              `Ensure vendor-marketplace-containers.bicep is deployed (cosmosVendorMarketplaceContainers in main.bicep).`,
          );
        }

        // vendor-bids is partitioned by /orderId
        cleanupDocs.push({ container: 'vendor-bids', id: bidId, partitionKey: orderId });
        console.log(`Stage 4 — seeded orderId=${orderId}, bidId=${bidId}`);
      });

      it('POST /api/orders/:orderId/vendor-bid/:bidId/accept returns 200', async () => {
        const res = await request(app)
          .post(`/api/orders/${orderId}/vendor-bid/${bidId}/accept`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send();

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(200);
      });

      it('order.status = ASSIGNED and assignedVendorId is set', async () => {
        const result = await dbService.getItem('orders', orderId, TEST_TENANT);
        const order: any = (result as any)?.data ?? result;

        expect(order.status).toBe('ASSIGNED');
        expect(order.assignedVendorId).toBe(VENDOR_ID);
        expect(order.assignedVendorName).toBe(VENDOR_NAME);
        console.log(`Stage 4 — status=${order.status}, assignedVendorId=${order.assignedVendorId} ✅`);
      });

      it('order.autoVendorAssignment.status = ACCEPTED', async () => {
        const result = await dbService.getItem('orders', orderId, TEST_TENANT);
        const order: any = (result as any)?.data ?? result;

        expect(order.autoVendorAssignment?.status).toBe('ACCEPTED');
        console.log(`Stage 4 — autoVendorAssignment.status=ACCEPTED ✅`);
      });
    });

    // ── Stage 5 ───────────────────────────────────────────────────────────────

    describe('Stage 5 — PUT /status SUBMITTED auto-routes order to qc-reviews', () => {
      /**
       * Fully HTTP-driven.  The order controller handles SUBMITTED directly:
       * it calls qcQueueService.addToQueue() (fire-and-forget) and
       * auto-advances the order to QC_REVIEW.  No event-bus subscriber
       * or private method access needed.
       *
       * FSM: IN_PROGRESS → SUBMITTED is a valid transition.
       * We seed the order as IN_PROGRESS so a single PUT reaches SUBMITTED.
       *
       * Assert:
       *   1. PUT returns 200.
       *   2. A qc-reviews doc with the correct orderId appears in Cosmos.
       *   3. The order status auto-advances to QC_REVIEW.
       */
      let orderId: string;
      let qcReviewId: string;

      beforeAll(async () => {
        orderId = `orders-stg5-${Date.now()}`;

        const vendorOrder = {
          id: orderId,
          // type must match VENDOR_ORDER_TYPE_PREDICATE so findOrderById can locate it
          type: 'vendor-order',
          tenantId: TEST_TENANT,
          clientId: TEST_CLIENT,
          engagementId: `eng-stg5-${Date.now()}`,
          orderNumber: `STG5-${Date.now()}`,
          productType: 'FULL_APPRAISAL',
          // IN_PROGRESS → SUBMITTED is a valid FSM transition
          status: 'IN_PROGRESS',
          priority: 'STANDARD',
          propertyAddress: '789 Stage Five Way',
          propertyState: 'TX',
          assignedVendorId: `stg5-vendor-${Date.now()}`,
          assignedVendorName: 'Stage Five Vendor',
          loanAmount: 420_000,
          appraisedValue: 415_000,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await dbService.createItem('orders', vendorOrder);
        cleanupDocs.push({ container: 'orders', id: orderId, partitionKey: TEST_TENANT });
        console.log(`Stage 5 — seeded orderId=${orderId} (status=IN_PROGRESS)`);
      });

      it('PUT /api/orders/:id/status SUBMITTED returns 200', async () => {
        const res = await request(app)
          .put(`/api/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'SUBMITTED' });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(200);
      });

      it('qc-reviews doc appears in Cosmos for this orderId', async () => {
        // The controller calls qcQueueService.addToQueue() fire-and-forget,
        // so poll until the write lands.
        const qcItem = await poll<Record<string, unknown>>(async () => {
          const res = await dbService.queryItems<Record<string, unknown>>(
            'qc-reviews',
            'SELECT * FROM c WHERE c.orderId = @orderId',
            [{ name: '@orderId', value: orderId }],
          );
          return res.success && res.data?.length ? res.data[0]! : null;
        }, 15_000);

        expect(qcItem.orderId).toBe(orderId);
        qcReviewId = qcItem.id as string;
        // qc-reviews partition key is /orderId
        cleanupDocs.push({ container: 'qc-reviews', id: qcReviewId, partitionKey: orderId });
        console.log(`Stage 5 — qcReviewId=${qcReviewId} ✅`);
      }, 20_000);

      it('order auto-advances to QC_REVIEW status', async () => {
        // The controller sets status=QC_REVIEW fire-and-forget after SUBMITTED.
        const order = await poll<any>(async () => {
          const res = await dbService.getItem('orders', orderId, TEST_TENANT);
          const doc: any = (res as any)?.data ?? res;
          return doc?.status === 'QC_REVIEW' ? doc : null;
        }, 10_000);

        expect(order.status).toBe('QC_REVIEW');
        console.log(`Stage 5 — order status=${order.status} ✅`);
      }, 15_000);
    });

    // ── Stage 6 ─────────────────────────────────────────────────────────────
    //  Seed a SUBMITTED review → POST /api/reviews/:id/assign → status=ASSIGNED

    describe('Stage 6 — POST /api/reviews/:id/assign assigns reviewer', () => {
      let reviewId: string;

      beforeAll(async () => {
        const ts = Date.now();

        // Seed via the API so the document lands with the correct partition key (orderId).
        const createRes = await request(app)
          .post('/api/reviews')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            orderId: `orders-stg6-ref-${ts}`,
            originalAppraisalId: `appraisal-stg6-ref-${ts}`,
            reviewType: 'TECHNICAL',
            priority: 'STANDARD',
            requestReason: 'Integration test Stage 6 seed',
          });

        if (createRes.status !== 201) {
          throw new Error(
            `Stage 6 setup failed — POST /api/reviews returned ${createRes.status}: ${JSON.stringify(createRes.body)}`,
          );
        }

        reviewId = createRes.body.data.id;
        const orderId = createRes.body.data.orderId;
        cleanupDocs.push({ container: 'revisions', id: reviewId, partitionKey: orderId });

        console.log(`Stage 6 — seeded reviewId=${reviewId} (orderId=${orderId})`);
      }, 30_000);

      it('POST /api/reviews/:id/assign returns 200', async () => {
        const res = await request(app)
          .post(`/api/reviews/${reviewId}/assign`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            reviewerId: 'stg6-reviewer-001',
            reviewerName: 'Stage Six Reviewer',
            reviewerEmail: 'stg6@test.com',
          });

        expect(res.status).toBe(200);
        console.log(`Stage 6 — assign returned ${res.status} ✅`);
      }, 20_000);

      it('review.status = ASSIGNED after assignment', async () => {
        const res = await request(app)
          .get(`/api/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ASSIGNED');
        console.log(`Stage 6 — review status=${res.body.data.status} ✅`);
      }, 20_000);
    });
  },
);
