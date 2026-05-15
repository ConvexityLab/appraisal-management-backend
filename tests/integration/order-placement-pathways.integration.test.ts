/**
 * Order Placement Pathways — Live-Fire Integration Tests
 *
 * Exercises all three pathways through which a ClientOrder + VendorOrder
 * can be created, end-to-end against a real Cosmos DB instance.
 *
 * Pathway 1 — createEngagement (fire-and-forget):
 *   POST /api/engagements  →  enrichAndPlaceClientOrders (fire-and-forget)
 *     →  orchestrator.orchestrateClientOrder
 *     →  ClientOrderService.placeClientOrder  →  client-orders doc
 *
 * Pathway 2 — addClientOrderToLoan (awaited):
 *   POST /api/engagements/:id/loans/:loanId/client-orders
 *     →  orchestrator.orchestrateClientOrder
 *     →  ClientOrderService.placeClientOrder  →  client-orders doc
 *
 * Pathway 3 — bulk ingestion (direct service layer):
 *   EngagementService.createEngagement({ skipClientOrderPlacement:true })
 *     → bare Engagement (embedded clientOrder id, no standalone doc)
 *   ClientOrderService.placeClientOrder (no specs)
 *     → bare client-orders doc
 *   Orchestrator.addDecomposedVendorOrders (fallback spec)
 *     → VendorOrder docs in orders container
 *
 * Pathway 4 — decomposition rule smoke test (overlay on Pathway 1):
 *   Seed DecompositionRule with autoApply:true + 2 templates
 *   POST /api/engagements (scoped to the seeded tenant+client)
 *   Poll for VendorOrders — assert count and vendorWorkTypes match templates
 *
 * Run with:
 *   VITEST_INTEGRATION=true pnpm vitest run tests/integration/order-placement-pathways.integration.test.ts
 *
 * Requires:
 *   AZURE_COSMOS_ENDPOINT (or local emulator on https://localhost:8081)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import { PropertyRecordService } from '../../src/services/property-record.service.js';
import { PropertyEnrichmentService } from '../../src/services/property-enrichment.service.js';
import { EngagementService } from '../../src/services/engagement.service.js';
import {
  OrderPlacementOrchestrator,
} from '../../src/services/order-placement-orchestrator.service.js';
import type { PlaceClientOrderInput } from '../../src/services/client-order.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import {
  DECOMPOSITION_RULE_DOC_TYPE,
  DECOMPOSITION_RULES_CONTAINER,
  type DecompositionRule,
} from '../../src/types/decomposition-rule.types.js';
import type { ClientOrder } from '../../src/types/client-order.types.js';
import type { VendorOrder } from '../../src/types/vendor-order.types.js';
import { ProductType } from '../../src/types/product-catalog.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Poll every 250 ms until predicate returns a truthy value or deadline passes. */
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
  'Order Placement Pathways — live-fire integration',
  () => {
    const TEST_TENANT = `integ-pathways-${Date.now()}`;
    const TEST_CLIENT = `integ-pathways-client-${Date.now()}`;

    let serverInstance: AppraisalManagementAPIServer;
    let app: Application;
    let adminToken: string;

    // Direct service layer (bypasses HTTP for service-level pathway tests)
    let dbService: CosmosDbService;
    let engagementService: EngagementService;
    let orchestrator: OrderPlacementOrchestrator;

    // Decomposition rules to clean up after all tests.
    const seededRules: Array<{ id: string; tenantId: string }> = [];

    beforeAll(async () => {
      const endpoint =
        process.env.COSMOS_ENDPOINT ??
        process.env.AZURE_COSMOS_ENDPOINT ??
        'https://localhost:8081';

      if (endpoint.includes('localhost')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }

      // ── In-process API server (pathways 1, 2, decomposition smoke test) ──
      serverInstance = new AppraisalManagementAPIServer(0);
      app = serverInstance.getExpressApp();
      await serverInstance.initDb();

      const tokenGen = new TestTokenGenerator();
      adminToken = tokenGen.generateToken({
        id: 'pathways-test-admin',
        email: 'pathways@test.com',
        name: 'Pathways Test Admin',
        role: 'admin' as const,
        tenantId: TEST_TENANT,
      });

      // ── Direct services (pathway 3 — bulk service layer) ──
      dbService = new CosmosDbService(endpoint);
      await dbService.initialize();
      const propertyRecordService = new PropertyRecordService(dbService);
      const stubGeocoder = { geocode: async () => null };
      const enrichmentService = new PropertyEnrichmentService(
        dbService,
        propertyRecordService,
        undefined,
        stubGeocoder,
      );
      engagementService = new EngagementService(
        dbService,
        propertyRecordService,
        enrichmentService,
      );
      orchestrator = OrderPlacementOrchestrator.fromDb(dbService);

      console.log(`✅ Ready — tenant=${TEST_TENANT}, client=${TEST_CLIENT}`);
    }, 90_000);

    afterAll(async () => {
      // Remove any seeded decomposition rules so they don't pollute other suites.
      if (dbService && seededRules.length > 0) {
        for (const { id, tenantId } of seededRules) {
          await dbService.deleteDocument(DECOMPOSITION_RULES_CONTAINER, id, tenantId).catch(() => {});
        }
      }
      if (dbService?.isDbConnected()) {
        await dbService.disconnect().catch(() => {});
      }
    });

    // ── Pathway 1 ────────────────────────────────────────────────────────────

    describe('Pathway 1 — createEngagement (fire-and-forget placement)', () => {
      let engagementId: string;
      let loanId: string;
      let clientOrderId: string;

      it('POST /api/engagements returns 201 with embedded clientOrder id', async () => {
        const res = await request(app)
          .post('/api/engagements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            client: { clientId: TEST_CLIENT, clientName: TEST_CLIENT },
            loans: [
              {
                loanNumber: `P1-LN-${Date.now()}`,
                borrowerName: 'Pathway One Borrower',
                borrowerEmail: 'p1@test.com',
                property: {
                  address: '1600 Amphitheatre Parkway',
                  city: 'Mountain View',
                  state: 'CA',
                  zipCode: '94043',
                },
                clientOrders: [{ productType: 'FULL_APPRAISAL' }],
              },
            ],
          });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(201);
        const eng = res.body.data;
        engagementId = eng.id;
        loanId = eng.properties[0].id;
        clientOrderId = eng.properties[0].clientOrders[0].id;

        expect(engagementId).toBeTruthy();
        expect(loanId).toBeTruthy();
        expect(clientOrderId).toBeTruthy();
        console.log(`P1 engagement=${engagementId} loanId=${loanId} clientOrderId=${clientOrderId}`);
      });

      it('standalone client-orders doc appears in Cosmos (async pipeline completes within 20s)', async () => {
        const co = await poll<ClientOrder>(async () => {
          const res = await request(app)
            .get(`/api/client-orders/${clientOrderId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          return res.status === 200 ? (res.body as ClientOrder) : null;
        });

        expect(co.id).toBe(clientOrderId);
        expect(co.engagementId).toBe(engagementId);
        expect(co.engagementPropertyId).toBe(loanId);
        expect(co.productType).toBe('FULL_APPRAISAL');
        console.log(`P1 ✅ client-orders doc found — status=${co.status}`);
      }, 30_000);

      it('no VendorOrders are created (no decomposition rule seeded for this scope)', async () => {
        // Give a short additional window for any background work to settle.
        await new Promise((r) => setTimeout(r, 2_000));

        const result = await dbService.queryItems<VendorOrder>(
          'orders',
          'SELECT * FROM c WHERE c.clientOrderId = @id AND c.tenantId = @t',
          [
            { name: '@id', value: clientOrderId },
            { name: '@t', value: TEST_TENANT },
          ],
        );
        const vendorOrders = (result.data as VendorOrder[]) ?? [];
        expect(vendorOrders).toHaveLength(0);
        console.log(`P1 ✅ confirmed zero VendorOrders (bare ClientOrder, no decomposition rule)`);
      }, 15_000);
    });

    // ── Pathway 2 ────────────────────────────────────────────────────────────

    describe('Pathway 2 — addClientOrderToLoan (awaited placement)', () => {
      let engagementId: string;
      let loanId: string;
      let newClientOrderId: string;

      it('creates engagement with no client orders on the first loan', async () => {
        // Use products[] = [] to create a loan with no embedded clientOrders initially.
        // The engagement controller normalises `clientOrders: []` to no client orders.
        const res = await request(app)
          .post('/api/engagements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            client: { clientId: TEST_CLIENT, clientName: TEST_CLIENT },
            loans: [
              {
                loanNumber: `P2-LN-${Date.now()}`,
                borrowerName: 'Pathway Two Borrower',
                borrowerEmail: 'p2@test.com',
                property: {
                  address: '555 California Street',
                  city: 'San Francisco',
                  state: 'CA',
                  zipCode: '94104',
                },
                clientOrders: [{ productType: 'BPO_EXTERIOR' }],
              },
            ],
          });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(201);
        const eng = res.body.data;
        engagementId = eng.id;
        loanId = eng.properties[0].id;
        // Grab first clientOrderId — we'll add a SECOND one via the endpoint
        const firstClientOrderId = eng.properties[0].clientOrders[0]?.id;

        // Wait for the first ClientOrder to land before testing addClientOrderToLoan.
        if (firstClientOrderId) {
          await poll(async () => {
            const probe = await request(app)
              .get(`/api/client-orders/${firstClientOrderId}`)
              .set('Authorization', `Bearer ${adminToken}`);
            return probe.status === 200 ? true : null;
          }).catch(() => {
            // non-fatal if poll times out — the add test is independent
          });
        }

        console.log(`P2 engagement=${engagementId} loanId=${loanId}`);
      });

      it('POST /api/engagements/:id/loans/:loanId/client-orders returns 201', async () => {
        const res = await request(app)
          .post(`/api/engagements/${engagementId}/loans/${loanId}/client-orders`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ productType: 'AVM' });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(201);
        const eng = res.body.data;
        // The updated engagement should have a new clientOrder for AVM
        const avmOrder = eng.properties[0].clientOrders.find(
          (co: any) => co.productType === 'AVM',
        );
        expect(avmOrder).toBeTruthy();
        newClientOrderId = avmOrder.id;
        console.log(`P2 addClientOrderToLoan => newClientOrderId=${newClientOrderId}`);
      });

      it('standalone client-orders doc for the added order appears in Cosmos (awaited, should be fast)', async () => {
        // addClientOrderToLoan AWAITS orchestrateClientOrder, so the doc should
        // already exist or appear within a very short window.
        const co = await poll<ClientOrder>(async () => {
          const res = await request(app)
            .get(`/api/client-orders/${newClientOrderId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          return res.status === 200 ? (res.body as ClientOrder) : null;
        }, 10_000);

        expect(co.id).toBe(newClientOrderId);
        expect(co.engagementId).toBe(engagementId);
        expect(co.engagementPropertyId).toBe(loanId);
        expect(co.productType).toBe('AVM');
        console.log(`P2 ✅ client-orders doc found — status=${co.status}`);
      }, 20_000);

      it('engagement returned from addClientOrderToLoan contains the new clientOrder id', async () => {
        const res = await request(app)
          .get(`/api/engagements/${engagementId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        const eng = res.body.data;
        const ids: string[] = eng.properties[0].clientOrders.map((co: any) => co.id);
        expect(ids).toContain(newClientOrderId);
      });
    });

    // ── Pathway 3 ────────────────────────────────────────────────────────────

    describe('Pathway 3 — bulk path (direct service layer: skipClientOrderPlacement + addDecomposedVendorOrders)', () => {
      let engagementId: string;
      let embeddedClientOrderId: string;
      let loanId: string;

      it('createEngagement with skipClientOrderPlacement:true creates Engagement but NO standalone client-orders doc', async () => {
        const engagement = await engagementService.createEngagement(
          {
            tenantId: TEST_TENANT,
            createdBy: 'pathways-integ-test',
            client: { clientId: TEST_CLIENT, clientName: TEST_CLIENT },
            properties: [
              {
                loanNumber: `P3-LN-${Date.now()}`,
                borrowerName: 'Pathway Three Borrower',
                property: {
                  address: '100 Main Street',
                  city: 'Denver',
                  state: 'CO',
                  zipCode: '80203',
                },
                clientOrders: [{ productType: ProductType.FULL_APPRAISAL }],
              },
            ],
          },
          { skipClientOrderPlacement: true },
        );

        engagementId = engagement.id;
        loanId = engagement.properties[0]!.id;
        embeddedClientOrderId = engagement.properties[0]!.clientOrders[0]!.id;

        expect(engagementId).toBeTruthy();
        expect(embeddedClientOrderId).toBeTruthy();
        console.log(`P3 engagement=${engagementId}, embeddedClientOrderId=${embeddedClientOrderId}`);

        // Give a short window — a fire-and-forget pipeline should NOT run with skipClientOrderPlacement:true.
        await new Promise((r) => setTimeout(r, 2_000));

        const result = await dbService.queryItems<ClientOrder>(
          'client-orders',
          'SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @t',
          [
            { name: '@id', value: embeddedClientOrderId },
            { name: '@t', value: TEST_TENANT },
          ],
        );
        const docs = (result.data as ClientOrder[]) ?? [];
        expect(docs).toHaveLength(0);
        console.log(`P3 ✅ confirmed no standalone client-orders doc (skipClientOrderPlacement worked)`);
      }, 30_000);

      it('orchestrator.orchestrateClientOrder (no-specs path) creates the bare client-orders doc the bulk worker requires', async () => {
        // The bulk worker is responsible for creating the bare ClientOrder before
        // calling addDecomposedVendorOrders. orchestrateClientOrder with no
        // matching autoApply rule resolves to [] specs → creates a bare ClientOrder.
        const input: PlaceClientOrderInput = {
          tenantId: TEST_TENANT,
          createdBy: 'pathways-integ-test',
          engagementId,
          engagementPropertyId: loanId,
          clientId: TEST_CLIENT,
          productType: ProductType.FULL_APPRAISAL,
          clientOrderId: embeddedClientOrderId,
          propertyDetails: {
            address: '100 Main Street',
            city: 'Denver',
            state: 'CO',
            zipCode: '80203',
          },
        };
        await orchestrator.orchestrateClientOrder(input);

        // Verify the doc landed.
        const result = await dbService.queryItems<ClientOrder>(
          'client-orders',
          'SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @t',
          [
            { name: '@id', value: embeddedClientOrderId },
            { name: '@t', value: TEST_TENANT },
          ],
        );
        const docs = (result.data as ClientOrder[]) ?? [];
        expect(docs).toHaveLength(1);
        expect(docs[0]!.id).toBe(embeddedClientOrderId);
        console.log(`P3 ✅ bare client-orders doc created: id=${embeddedClientOrderId}`);
      }, 30_000);

      it('orchestrator.addDecomposedVendorOrders with fallback spec creates VendorOrders in orders container', async () => {
        const vendorOrders = await orchestrator.addDecomposedVendorOrders(
          embeddedClientOrderId,
          TEST_TENANT,
          TEST_CLIENT,
          ProductType.FULL_APPRAISAL,
          [{ vendorWorkType: ProductType.FULL_APPRAISAL }],  // fallback spec
          {
            orderNumber: `BULK-P3-${Date.now()}`,
            createdBy: 'pathways-integ-test',
            loanInformation: { loanNumber: `P3-LN-${Date.now()}`, loanAmount: 500_000 },
          },
        );

        expect(vendorOrders.length).toBeGreaterThan(0);
        expect(vendorOrders[0]!.vendorWorkType).toBe(ProductType.FULL_APPRAISAL);
        expect(vendorOrders[0]!.clientOrderId).toBe(embeddedClientOrderId);
        expect(vendorOrders[0]!.engagementId).toBe(engagementId);
        console.log(`P3 ✅ ${vendorOrders.length} VendorOrder(s) created: ids=${vendorOrders.map((v) => v.id).join(', ')}`);
      }, 30_000);

      it('VendorOrder is queryable in the orders container by clientOrderId', async () => {
        const result = await dbService.queryItems<VendorOrder>(
          'orders',
          'SELECT * FROM c WHERE c.clientOrderId = @id AND c.tenantId = @t',
          [
            { name: '@id', value: embeddedClientOrderId },
            { name: '@t', value: TEST_TENANT },
          ],
        );
        const rows = (result.data as VendorOrder[]) ?? [];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]!.engagementId).toBe(engagementId);
        console.log(`P3 ✅ VendorOrder found in orders container`);
      }, 15_000);
    });

    // ── Pathway 4 (decomposition smoke test) ─────────────────────────────────

    describe('Pathway 4 — decomposition rule smoke test (autoApply:true → VendorOrders via Pathway 1)', () => {
      let ruleId: string;
      let engagementId: string;
      let clientOrderId: string;

      beforeAll(async () => {
        // Seed a tier-1 decomposition rule (tenant + client + productType) with
        // autoApply:true and two templates so we can assert both are created.
        // Uses the same TEST_TENANT/TEST_CLIENT as the rest of the suite.
        // This beforeAll runs AFTER Pathways 1-3 have completed, so seeding
        // here cannot affect the "zero VendorOrders" assertions in Pathway 1.
        const rule: DecompositionRule = {
          id: `integ-rule-${Date.now()}`,
          tenantId: TEST_TENANT,
          clientId: TEST_CLIENT,
          type: DECOMPOSITION_RULE_DOC_TYPE,
          productType: ProductType.FULL_APPRAISAL,
          autoApply: true,
          vendorOrders: [
            { vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal' },
            { vendorWorkType: ProductType.AVM, templateKey: 'avm' },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          description: 'Integration test — auto-deleted in afterAll',
        };
        await dbService.createDocument(DECOMPOSITION_RULES_CONTAINER, rule);
        ruleId = rule.id;
        seededRules.push({ id: ruleId, tenantId: TEST_TENANT });
        console.log(`Decomp seed: rule=${ruleId}, tenant=${TEST_TENANT}`);
      });

      it('POST /api/engagements creates engagement (autoApply rule now active for this tenant+client)', async () => {
        const res = await request(app)
          .post('/api/engagements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            client: { clientId: TEST_CLIENT, clientName: TEST_CLIENT },
            loans: [
              {
                loanNumber: `P4-LN-${Date.now()}`,
                borrowerName: 'Decomp Borrower',
                borrowerEmail: 'decomp@test.com',
                property: {
                  address: '742 Evergreen Terrace',
                  city: 'Springfield',
                  state: 'IL',
                  zipCode: '62701',
                },
                clientOrders: [{ productType: 'FULL_APPRAISAL' }],
              },
            ],
          });

        expect(res.status, `body: ${JSON.stringify(res.body)}`).toBe(201);
        const eng = res.body.data;
        engagementId = eng.id;
        clientOrderId = eng.properties[0].clientOrders[0].id;
        console.log(`P4 engagement=${engagementId}, clientOrderId=${clientOrderId}`);
      });

      it('ClientOrder appears in client-orders container', async () => {
        await poll(async () => {
          const result = await dbService.queryItems<ClientOrder>(
            'client-orders',
            'SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @t',
            [
              { name: '@id', value: clientOrderId },
              { name: '@t', value: TEST_TENANT },
            ],
          );
          const docs = (result.data as ClientOrder[]) ?? [];
          return docs.length > 0 ? docs[0] : null;
        });
        console.log(`P4 ✅ client-orders doc found`);
      }, 30_000);

      it('two VendorOrders are created matching the rule templates (FULL_APPRAISAL + AVM)', async () => {
        // VendorOrders are created by orchestrateClientOrder synchronously
        // inside enrichAndPlaceClientOrders, which is fire-and-forget — poll.
        const vendorOrders = await poll<VendorOrder[]>(async () => {
          const result = await dbService.queryItems<VendorOrder>(
            'orders',
            'SELECT * FROM c WHERE c.clientOrderId = @id AND c.tenantId = @t',
            [
              { name: '@id', value: clientOrderId },
              { name: '@t', value: TEST_TENANT },
            ],
          );
          const rows = (result.data as VendorOrder[]) ?? [];
          return rows.length >= 2 ? rows : null;
        }, 30_000);

        expect(vendorOrders).toHaveLength(2);
        const types = vendorOrders.map((v) => v.vendorWorkType ?? v.productType).sort();
        expect(types).toContain(ProductType.FULL_APPRAISAL);
        expect(types).toContain(ProductType.AVM);
        console.log(`P4 ✅ 2 VendorOrders created: ${types.join(', ')}`);
      }, 35_000);
    });
  },
);
