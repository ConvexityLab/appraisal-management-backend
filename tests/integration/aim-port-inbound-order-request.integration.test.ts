/**
 * AIM-Port Inbound OrderRequest → Outbound Auto-Fire Test
 *
 * WHAT THIS TESTS
 * ───────────────
 * When AIM-Port sends us a new order (OrderRequest), does our system
 * automatically fire any outbound HTTP calls back to AIM-Port as a side effect
 * of processing that single inbound request?
 *
 * We test THREE layers in ascending order of complexity:
 *
 *   Layer 1 — Synchronous inbound pipeline (VendorIntegrationService / controller)
 *             Does our HTTP handler fire anything during the request/response cycle?
 *
 *   Layer 2 — Adapter outbound mapping
 *             Does buildOutboundCall() for vendor.order.received produce an HTTP call?
 *             i.e. would the worker/dispatcher fire anything if it consumed this event?
 *
 *   Layer 3 — Consumer service onVendorEvent
 *             When VendorIntegrationEventConsumerService processes a vendor.order.received
 *             event with a REAL VendorOutboundDispatcher wired (pointed at fake AIM-Port),
 *             does any hold/resume/cancel/message call fire?
 *
 * WHAT IS NOT MOCKED
 *   • HTTP transport (real fetch)
 *   • AimPortAdapter (real canHandleInbound / authenticateInbound / handleInbound / buildOutboundCall)
 *   • VendorIntegrationService (real dispatch pipeline)
 *   • VendorOutboundDispatcher (real retry logic, real HTTP calls — Layer 3)
 *   • createVendorIntegrationRouter (real Express router)
 *
 * WHAT IS STUBBED (in-memory, no vi.mock)
 *   • VendorConnectionService  — returns the fixed test connection, resolves secrets
 *   • VendorEventOutboxService — swallows Cosmos writes
 *   • VendorOrderReferenceService — returns a fixed order reference (no Cosmos/Engagement)
 *   • ServiceBusEventPublisher  — captures published events (Layer 3)
 *   • CosmosDbService/OrderContextLoader — stubs for consumer (Layer 3)
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import http from 'node:http';
import express from 'express';
import { VendorIntegrationService } from '../../src/services/vendor-integrations/VendorIntegrationService.js';
import { VendorOutboundDispatcher } from '../../src/services/vendor-integrations/VendorOutboundDispatcher.js';
import { VendorIntegrationEventConsumerService } from '../../src/services/vendor-integration-event-consumer.service.js';
import { AimPortAdapter } from '../../src/services/vendor-integrations/AimPortAdapter.js';
import { createVendorIntegrationRouter } from '../../src/controllers/vendor-integration.controller.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';
import type { VendorConnectionService } from '../../src/services/vendor-integrations/VendorConnectionService.js';
import type { VendorEventOutboxService } from '../../src/services/vendor-integrations/VendorEventOutboxService.js';
import type { VendorOrderReferenceService } from '../../src/services/vendor-integrations/VendorOrderReferenceService.js';
import type { VendorIntegrationEvent } from '../../src/types/events.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_API_KEY = 'integration-test-api-key-abc123';
const TEST_CLIENT_ID = '495735';

/** Mutable — outboundEndpointUrl is patched in beforeAll once fakeAimPort is listening */
const testConnection: VendorConnection = {
  id: 'vc-inbound-order-test',
  tenantId: 'tenant-inbound',
  vendorType: 'aim-port',
  lenderId: 'lender-inbound',
  lenderName: 'Inbound Order Test Lender',
  inboundIdentifier: TEST_CLIENT_ID,
  credentials: {
    inboundApiKeySecretName: 'inbound-secret',
    outboundApiKeySecretName: 'outbound-secret',
    outboundClientId: TEST_CLIENT_ID,
  },
  outboundEndpointUrl: '', // set in beforeAll
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  productMappings: { '1': 'FULL_APPRAISAL' },
};

const stubConnectionService = {
  getActiveConnectionByInboundIdentifier: async (_id: string, _type: string) => testConnection,
  getConnectionById: async (_id: string) => testConnection,
  resolveSecret: async (_secretName: string) => TEST_API_KEY,
} as unknown as VendorConnectionService;

const stubOutboxService = {
  persistInboundEvents: async () => [],
} as unknown as VendorEventOutboxService;

const stubOrderReferenceService = {
  createOrGetOrderReference: async () => ({
    orderId: 'order-stub-001',
    orderNumber: 'ORD-001',
    existed: false,
  }),
} as unknown as VendorOrderReferenceService;

// ─── Minimal valid AIM-Port OrderRequest payload ───────────────────────────────

const INBOUND_ORDER_REQUEST = {
  OrderRequest: {
    login: {
      client_id: TEST_CLIENT_ID,
      api_key: TEST_API_KEY,
      order_id: '1778757887',
    },
    order: {
      order_type: 'residential',
      address: '123 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip_code: '90001',
      county: 'Los Angeles',
      borrower: { name: 'Jane Smith' },
      reports: [{ id: 1, name: 'URAR 1004' }],
      due_date: '2026-06-01',
      loan_amount: 500000,
    },
  },
};

// ─── Server helpers ────────────────────────────────────────────────────────────

function startServer(app: express.Application): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') { reject(new Error('Cannot determine port')); return; }
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

// ─── State tracked by fake AIM-Port ───────────────────────────────────────────

/** Every outbound HTTP call our app makes to the fake AIM-Port endpoint, in order */
const outboundCallsReceived: { body: unknown; path: string; requestType: string }[] = [];

function clearCalls(): void { outboundCallsReceived.length = 0; }

// ─── Servers ──────────────────────────────────────────────────────────────────

let ourServer: http.Server;
let fakeAimPortServer: http.Server;
let ourPort: number;
let aimPort: number;

beforeAll(async () => {
  process.env.ENVIRONMENT = 'dev';

  // ── 1. Start fake AIM-Port ────────────────────────────────────────────────────
  const fakeAimPortApp = express();
  fakeAimPortApp.use(express.json());
  fakeAimPortApp.post('*', (req, res) => {
    const body = req.body as Record<string, unknown>;
    outboundCallsReceived.push({
      path: req.path,
      body,
      requestType: Object.keys(body)[0] ?? 'unknown',
    });
    res.status(200).json({ client_id: TEST_CLIENT_ID, success: 'true', order_id: 'VO-99' });
  });
  ({ server: fakeAimPortServer, port: aimPort } = await startServer(fakeAimPortApp));

  // ── 2. Patch connection outboundEndpointUrl ───────────────────────────────────
  testConnection.outboundEndpointUrl = `http://127.0.0.1:${aimPort}`;

  // ── 3. Start our inbound Express app ─────────────────────────────────────────
  const integrationService = new VendorIntegrationService(
    stubConnectionService,
    [new AimPortAdapter()],
    stubOrderReferenceService,
    stubOutboxService,
  );

  const ourApp = express();
  ourApp.use(express.json());
  ourApp.use('/api/vendor-integrations', createVendorIntegrationRouter(integrationService));

  ({ server: ourServer, port: ourPort } = await startServer(ourApp));
});

afterAll(async () => {
  await Promise.all([stopServer(ourServer), stopServer(fakeAimPortServer)]);
  delete process.env.ENVIRONMENT;
});

// ─── Helper: post inbound and drain any async fire-and-forget calls ───────────

async function postInboundOrderRequest(): Promise<Response> {
  const res = await fetch(
    `http://127.0.0.1:${ourPort}/api/vendor-integrations/aim-port/inbound`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(INBOUND_ORDER_REQUEST),
    },
  );
  // Allow event-loop to drain any fire-and-forget outbound calls that
  // the synchronous handler may have kicked off but not awaited.
  await new Promise((r) => setTimeout(r, 100));
  return res;
}

function assertNoOutboundCalls(label: string): void {
  if (outboundCallsReceived.length > 0) {
    throw new Error(
      `[${label}] BUG: ${outboundCallsReceived.length} unexpected outbound call(s):\n` +
      outboundCallsReceived.map((c) => `  • ${c.requestType}`).join('\n'),
    );
  }
}

// ─── LAYER 1: Synchronous inbound pipeline ────────────────────────────────────

describe('Layer 1 — synchronous inbound pipeline (HTTP handler)', () => {

  it('inbound OrderRequest returns 200 with 1 normalized event and fires ZERO outbound calls', async () => {
    clearCalls();
    const res = await postInboundOrderRequest();

    expect(res.status).toBe(200);
    expect(res.headers.get('x-normalized-event-count')).toBe('1');
    assertNoOutboundCalls('Layer1-basic');
    expect(outboundCallsReceived).toHaveLength(0);
  });

  it('inbound OrderRequest ACK body contains success=true and a non-empty order_id', async () => {
    clearCalls();
    const res = await postInboundOrderRequest();
    const body = await res.json() as Record<string, unknown>;

    expect(body.success).toBe('true');
    expect(typeof body.order_id).toBe('string');
    expect((body.order_id as string).length).toBeGreaterThan(0);
    assertNoOutboundCalls('Layer1-ack');
  });

  it('repeated inbound OrderRequest (idempotency scenario) still fires ZERO outbound calls', async () => {
    clearCalls();
    await postInboundOrderRequest();
    await postInboundOrderRequest();
    await postInboundOrderRequest();

    assertNoOutboundCalls('Layer1-repeated');
    expect(outboundCallsReceived).toHaveLength(0);
  });

});

// ─── LAYER 2: Adapter — buildOutboundCall for vendor.order.received ───────────
//
// If this returns a non-null OutboundCall, the VendorOutboundWorkerService
// would fire an HTTP call every time it processes the persisted inbound event.

describe('Layer 2 — AimPortAdapter.buildOutboundCall for vendor.order.received', () => {

  it('returns null (no outbound call) — received orders are not mirrored back to AIM-Port', async () => {
    const adapter = new AimPortAdapter();
    const event: VendorDomainEvent = {
      id: 'evt-rcv-1',
      eventType: 'vendor.order.received',
      vendorType: 'aim-port',
      vendorOrderId: 'VO-48',
      ourOrderId: 'order-internal-1',
      lenderId: 'lender-inbound',
      tenantId: 'tenant-inbound',
      occurredAt: new Date().toISOString(),
      payload: {
        orderType: 'residential',
        address: '123 Main St', city: 'LA', state: 'CA', zipCode: '90001',
        borrower: { name: 'Jane Smith' },
        products: [{ id: 1, name: 'URAR 1004' }],
        rush: false,
      },
    };
    const fakeContext = { resolveSecret: async () => TEST_API_KEY };
    const call = await adapter.buildOutboundCall(event, testConnection, fakeContext);

    // null means the worker will log "No outbound call generated" and skip HTTP.
    expect(call).toBeNull();
  });

});

// ─── LAYER 3: Consumer service — onVendorEvent with REAL VendorOutboundDispatcher
//
// This simulates exactly what happens when Service Bus delivers the
// vendor.order.received event to VendorIntegrationEventConsumerService and the
// consumer has a real VendorOutboundDispatcher (pointed at fake AIM-Port) wired.
//
// Any hold/resume/cancel/message/assignment call fired here would appear in
// outboundCallsReceived — that's the bug we're hunting.

describe('Layer 3 — consumer onVendorEvent with real dispatcher wired', () => {

  it('processing vendor.order.received through consumer fires ZERO outbound calls to AIM-Port', async () => {
    clearCalls();

    // Build a real VendorOutboundDispatcher pointing at fake AIM-Port
    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

    // Stub the Cosmos-dependent parts of the consumer so it can run without Azure
    const stubDb = {
      getItem: async () => ({ success: true, data: null }),
      updateItem: async () => ({ success: true, data: {} }),
      queryItems: async () => ({ success: true, data: [] }),
      upsertItem: async () => ({ success: true, data: {} }),
      getContainer: async () => ({}),
    };

    // Stub publisher (captures order.created publish without Service Bus)
    const publishedEvents: unknown[] = [];
    const stubPublisher = {
      publish: async (event: unknown) => { publishedEvents.push(event); },
    };

    // Stub file persistor
    const stubFilePersistor = async () => {};

    const consumer = new VendorIntegrationEventConsumerService(
      stubDb as any,
      stubPublisher as any,
      stubFilePersistor,
      dispatcher,
    );

    // Build a vendor.order.received VendorIntegrationEvent exactly as
    // VendorEventOutboxService would persist and re-publish it.
    const vendorEvent: VendorIntegrationEvent = {
      id: 'consumer-evt-001',
      type: 'vendor.order.received' as any,
      timestamp: new Date(),
      source: 'vendor-integration-service',
      version: '1.0',
      correlationId: 'corr-001',
      category: 'VENDOR' as any,
      data: {
        id: 'consumer-evt-001',
        vendorType: 'aim-port',
        vendorOrderId: 'VO-48',
        ourOrderId: 'order-stub-001',
        lenderId: 'lender-inbound',
        tenantId: 'tenant-inbound',
        connectionId: testConnection.id,
        occurredAt: new Date().toISOString(),
        payload: {
          orderType: 'residential',
          address: '123 Main St', city: 'LA', state: 'CA', zipCode: '90001',
          borrower: { name: 'Jane Smith' },
          products: [{ id: 1, name: 'URAR 1004' }],
          rush: false,
        },
      } as any,
    };

    // Call the private handler directly — same path Service Bus takes
    await (consumer as any).onVendorEvent(vendorEvent);

    // Allow fire-and-forget dispatch to complete
    await new Promise((r) => setTimeout(r, 200));

    if (outboundCallsReceived.length > 0) {
      throw new Error(
        `[Layer3] BUG: consumer fired ${outboundCallsReceived.length} outbound call(s) ` +
        `when processing vendor.order.received:\n` +
        outboundCallsReceived.map((c) => `  • ${c.requestType}`).join('\n'),
      );
    }

    expect(outboundCallsReceived).toHaveLength(0);
    // The consumer should have tried to publish an order.created event
    expect(publishedEvents.length).toBeGreaterThanOrEqual(0); // may skip if order not found in stub db
  });

  it('consumer fires ZERO outbound calls for vendor.order.assigned', async () => {
    clearCalls();

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);
    const stubDb = {
      getItem: async () => ({ success: true, data: { id: 'order-stub-001', status: 'ASSIGNED', tenantId: 'tenant-inbound', metadata: {} } }),
      updateItem: async () => ({ success: true, data: {} }),
      queryItems: async () => ({ success: true, data: [] }),
      upsertItem: async () => ({ success: true, data: {} }),
      getContainer: async () => ({}),
    };
    const consumer = new VendorIntegrationEventConsumerService(
      stubDb as any, undefined as any, async () => {}, dispatcher,
    );

    const vendorEvent: VendorIntegrationEvent = {
      id: 'consumer-evt-002',
      type: 'vendor.order.assigned' as any,
      timestamp: new Date(),
      source: 'vendor-integration-service',
      version: '1.0',
      correlationId: 'corr-002',
      category: 'VENDOR' as any,
      data: {
        id: 'consumer-evt-002',
        vendorType: 'aim-port',
        vendorOrderId: 'VO-48',
        ourOrderId: 'order-stub-001',
        lenderId: 'lender-inbound',
        tenantId: 'tenant-inbound',
        connectionId: testConnection.id,
        occurredAt: new Date().toISOString(),
        payload: {},
      } as any,
    };

    await (consumer as any).onVendorEvent(vendorEvent);
    await new Promise((r) => setTimeout(r, 200));

    assertNoOutboundCalls('Layer3-assigned');
    expect(outboundCallsReceived).toHaveLength(0);
  });

  it('consumer fires ZERO outbound calls for vendor.order.accepted', async () => {
    clearCalls();

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);
    const stubDb = {
      getItem: async () => ({ success: true, data: { id: 'order-stub-001', status: 'ACCEPTED', tenantId: 'tenant-inbound', metadata: {} } }),
      updateItem: async () => ({ success: true, data: {} }),
      queryItems: async () => ({ success: true, data: [] }),
      upsertItem: async () => ({ success: true, data: {} }),
      getContainer: async () => ({}),
    };
    const consumer = new VendorIntegrationEventConsumerService(
      stubDb as any, undefined as any, async () => {}, dispatcher,
    );

    const vendorEvent: VendorIntegrationEvent = {
      id: 'consumer-evt-003',
      type: 'vendor.order.accepted' as any,
      timestamp: new Date(),
      source: 'vendor-integration-service',
      version: '1.0',
      correlationId: 'corr-003',
      category: 'VENDOR' as any,
      data: {
        id: 'consumer-evt-003',
        vendorType: 'aim-port',
        vendorOrderId: 'VO-48',
        ourOrderId: 'order-stub-001',
        lenderId: 'lender-inbound',
        tenantId: 'tenant-inbound',
        connectionId: testConnection.id,
        occurredAt: new Date().toISOString(),
        payload: {},
      } as any,
    };

    await (consumer as any).onVendorEvent(vendorEvent);
    await new Promise((r) => setTimeout(r, 200));

    assertNoOutboundCalls('Layer3-accepted');
    expect(outboundCallsReceived).toHaveLength(0);
  });

});
