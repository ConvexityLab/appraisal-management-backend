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
 *   Stage 5 — initiateReviewAssignment (service-layer direct call)
 *     AutoAssignmentOrchestratorService.initiateReviewAssignment(order, tenantId, priority)
 *       → qcQueueService.addToQueue  → qc-reviews doc created
 *       → no reviewers seeded → escalateReviewAssignment
 *       → order.autoReviewAssignment.status = 'EXHAUSTED'
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
import { AutoAssignmentOrchestratorService } from '../../src/services/auto-assignment-orchestrator.service.js';
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
      let vendorOrderId: string;
      let engagementId: string;

      it('POST /api/engagements creates engagement and a VendorOrder appears in Cosmos', async () => {
        const res = await request(app)
          .post('/api/engagements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            client: { clientId: TEST_CLIENT, clientName: TEST_CLIENT },
            loans: [
              {
                loanNumber: `STAGE3-LN-${Date.now()}`,
                borrowerName: 'Stage Three Borrower',
                borrowerEmail: 'stage3@test.com',
                property: {
                  address: '123 Pipeline Ave',
                  city: 'Austin',
                  state: 'TX',
                  zipCode: '78701',
                },
                clientOrders: [{ productType: 'FULL_APPRAISAL' }],
              },
            ],
          });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(201);
        engagementId = res.body.data.id;
        expect(engagementId).toBeTruthy();
        console.log(`Stage 3 — engagementId=${engagementId}`);
      });

      it('VendorOrder appears in orders container within 20s', async () => {
        const vendorOrder = await poll<VendorOrder>(async () => {
          const result = await dbService.queryItems<VendorOrder>(
            'orders',
            'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId',
            [
              { name: '@engagementId', value: engagementId },
              { name: '@tenantId', value: TEST_TENANT },
            ],
          );
          return result.success && result.data?.length ? result.data[0]! : null;
        });

        vendorOrderId = vendorOrder.id;
        cleanupDocs.push({ container: 'orders', id: vendorOrderId, partitionKey: TEST_TENANT });
        console.log(`Stage 3 — vendorOrderId=${vendorOrderId}`);
        expect(vendorOrderId).toBeTruthy();
      }, 30_000);

      it('POST /api/orders/:id/trigger-auto-assignment returns 200', async () => {
        const res = await request(app)
          .post(`/api/orders/${vendorOrderId}/trigger-auto-assignment`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send();

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(200);
      });

      it('order.autoVendorAssignment.status = EXHAUSTED and requiresHumanVendorAssignment = true', async () => {
        // Poll until autoVendorAssignment is written (the controller awaits synchronously, but
        // give a short poll in case of any async path).
        const order = await poll<VendorOrder>(async () => {
          const result = await dbService.getItem('orders', vendorOrderId, TEST_TENANT);
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
       * This stage is self-contained: seeds its own VendorOrder in PENDING_BID
       * state plus a matching vendor-bid document so the accept endpoint has
       * something to act on.  It does NOT depend on Stage 3's EXHAUSTED order
       * (which is in the wrong final state to accept a bid).
       */
      let orderId: string;
      let bidId: string;
      const VENDOR_ID = `test-vendor-${Date.now()}`;
      const VENDOR_NAME = 'Test Vendor Co.';

      beforeAll(async () => {
        // Seed the VendorOrder directly so we control its state precisely.
        bidId = `bid-${Date.now()}-${uuidv4().slice(0, 8)}`;
        orderId = `orders-stg4-${Date.now()}`;

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const vendorOrder = {
          id: orderId,
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
            rankedVendors: [
              { vendorId: VENDOR_ID, vendorName: VENDOR_NAME, score: 90 },
            ],
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
        await dbService.createItem('vendor-bids', bidDoc);

        cleanupDocs.push({ container: 'orders', id: orderId, partitionKey: TEST_TENANT });
        cleanupDocs.push({ container: 'vendor-bids', id: bidId, partitionKey: TEST_TENANT });

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

    describe('Stage 5 — initiateReviewAssignment adds to qc-reviews container', () => {
      /**
       * Stage 5 exercises the review assignment FSM directly at the
       * service layer.  The event-bus subscriber is NOT started in test
       * mode (only initDb() is called, not start()), so we cannot drive
       * this path via HTTP + event consumption.  Instead we instantiate
       * AutoAssignmentOrchestratorService directly and call the private
       * method via a type cast — this is acceptable for live-fire integration
       * tests where we are validating real Cosmos I/O rather than the
       * event wiring.
       *
       * With no QC analysts seeded, qcQueueService.getAllAnalystWorkloads()
       * returns an empty list → escalateReviewAssignment is called.
       * We assert:
       *   1. A qc-reviews doc with the correct orderId was created.
       *   2. The order's autoReviewAssignment has a qcReviewId.
       */
      let orderId: string;
      let qcReviewId: string;

      beforeAll(async () => {
        orderId = `orders-stg5-${Date.now()}`;

        const vendorOrder = {
          id: orderId,
          type: 'vendor-order',
          tenantId: TEST_TENANT,
          clientId: TEST_CLIENT,
          engagementId: `eng-stg5-${Date.now()}`,
          orderNumber: `STG5-${Date.now()}`,
          productType: 'FULL_APPRAISAL',
          status: 'ASSIGNED',
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
        console.log(`Stage 5 — seeded orderId=${orderId}`);
      });

      it('initiateReviewAssignment creates a qc-reviews document', async () => {
        const endpoint =
          process.env.COSMOS_ENDPOINT ??
          process.env.AZURE_COSMOS_ENDPOINT ??
          'https://localhost:8081';

        // The orchestrator uses its own CosmosDbService internally.
        // Pass an explicit endpoint so emulator TLS flags are consistent.
        const orch = new AutoAssignmentOrchestratorService(
          new CosmosDbService(endpoint),
        );

        // Load the seeded order
        const orderResult = await dbService.getItem('orders', orderId, TEST_TENANT);
        const order: any = (orderResult as any)?.data ?? orderResult;
        expect(order).toBeTruthy();

        // Call the private method directly — safe for integration test context.
        await (orch as any).initiateReviewAssignment(order, TEST_TENANT, 'HIGH');

        // Poll until the qc-reviews doc appears.
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
      }, 30_000);

      it('order.autoReviewAssignment.qcReviewId is set after escalation', async () => {
        // Poll until the orchestrator writes autoReviewAssignment back to the order.
        const order = await poll<any>(async () => {
          const res = await dbService.getItem('orders', orderId, TEST_TENANT);
          const doc: any = (res as any)?.data ?? res;
          return doc?.autoReviewAssignment?.qcReviewId ? doc : null;
        }, 10_000);

        expect(order.autoReviewAssignment.qcReviewId).toBeTruthy();
        console.log(
          `Stage 5 — autoReviewAssignment.qcReviewId=${order.autoReviewAssignment.qcReviewId}`,
          `status=${order.autoReviewAssignment.status} ✅`,
        );
      }, 15_000);
    });
  },
);
