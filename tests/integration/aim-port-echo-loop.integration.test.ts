/**
 * AIM-Port Echo-Loop Integration Test
 *
 * WHAT THIS TESTS
 * ───────────────
 * AIM-Port echoes our outbound hold/resume/cancel requests right back to our
 * inbound webhook as an acknowledgement.  Before the fix, that echo triggered
 * a new domain event which would enqueue another outbound call — infinite loop.
 *
 * This test uses TWO REAL TCP SERVERS and REAL HTTP calls — nothing is mocked
 * at the network layer.  It proves the fix holds under actual HTTP traffic.
 *
 * TOPOLOGY
 * ─────────
 *
 *  ┌─────────────────────────────────┐        ┌──────────────────────────────┐
 *  │  OUR APP  (ourPort)             │        │  FAKE AIM-PORT  (aimPort)    │
 *  │                                 │  ①     │                              │
 *  │  VendorOutboundDispatcher ──────┼───────▶│  POST /                      │
 *  │    (sends OrderHoldRequest)     │        │   • records body             │
 *  │                                 │  ②     │   • POSTs it back to us ─┐  │
 *  │  POST /api/vendor-integrations/ │◀───────┼──────────────────────────┘  │
 *  │       aim-port/inbound          │        │   • then returns 200         │
 *  │    X-Normalized-Event-Count: 0 ─┼──────▶ ③ (assert no domain events)  │
 *  └─────────────────────────────────┘        └──────────────────────────────┘
 *
 * STEPS
 * ─────
 *   ① Our dispatcher sends an OrderHoldRequest to fake AIM-Port.
 *   ② Fake AIM-Port echoes the exact same body back to our inbound webhook.
 *   ③ Our inbound returns 200 but with zero domain events (the fix).
 *
 * WHAT IS NOT MOCKED
 *   • HTTP transport (VendorHttpClient uses real fetch)
 *   • AimPortAdapter (real canHandleInbound / authenticateInbound / handleInbound)
 *   • VendorOutboundDispatcher (real retry logic, real HTTP call)
 *   • VendorIntegrationService (real dispatch pipeline)
 *   • createVendorIntegrationRouter (real Express router)
 *
 * WHAT IS STUBBED (in-memory, no vi.mock)
 *   • VendorConnectionService  — returns a known VendorConnection, resolves
 *                                secrets to a fixed test API key
 *   • VendorEventOutboxService — swallows Cosmos writes (returns [])
 *   • VendorOrderReferenceService — never called for hold events
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import http from 'node:http';
import express from 'express';
import { VendorOutboundDispatcher } from '../../src/services/vendor-integrations/VendorOutboundDispatcher.js';
import { VendorIntegrationService } from '../../src/services/vendor-integrations/VendorIntegrationService.js';
import { AimPortAdapter } from '../../src/services/vendor-integrations/AimPortAdapter.js';
import { createVendorIntegrationRouter } from '../../src/controllers/vendor-integration.controller.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';
import type { VendorConnectionService } from '../../src/services/vendor-integrations/VendorConnectionService.js';
import type { VendorEventOutboxService } from '../../src/services/vendor-integrations/VendorEventOutboxService.js';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const TEST_API_KEY = 'integration-test-api-key-abc123';
const TEST_CLIENT_ID = '495735';

/** Mutable — outboundEndpointUrl is patched in beforeAll once fakeAimPort is listening */
const testConnection: VendorConnection = {
  id: 'vc-echo-test',
  tenantId: 'tenant-echo',
  vendorType: 'aim-port',
  lenderId: 'lender-echo',
  lenderName: 'Echo Test Lender',
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
};

/** Minimal stub connection service — no Cosmos, no Azure Key Vault */
const stubConnectionService = {
  getActiveConnectionByInboundIdentifier: async (_id: string, _type: string) => testConnection,
  getConnectionById: async (_id: string) => testConnection,
  resolveSecret: async (_secretName: string) => TEST_API_KEY,
} as unknown as VendorConnectionService;

/** Minimal stub outbox service — swallows persistence so no Cosmos needed */
const stubOutboxService = {
  persistInboundEvents: async () => [],
} as unknown as VendorEventOutboxService;

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let ourServer: http.Server;
let fakeAimPortServer: http.Server;
let ourPort: number;
let aimPort: number;

/** POST bodies received by fake AIM-Port, in arrival order */
const aimPortReceivedBodies: unknown[] = [];
/** HTTP responses our echo calls got back from our app, in order */
const echoResponseStatuses: number[] = [];
const echoEventCounts: string[] = [];

function startServer(app: express.Application): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Could not determine server port'));
        return;
      }
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

beforeAll(async () => {
  // ── 1. Start our app ────────────────────────────────────────────────────────
  //
  // ENVIRONMENT must be 'dev' so the APIM-forwarding middleware does not reject
  // our test requests.  We set it here and restore it in afterAll.
  process.env.ENVIRONMENT = 'dev';

  const integrationService = new VendorIntegrationService(
    stubConnectionService,
    [new AimPortAdapter()],
    undefined,       // VendorOrderReferenceService — not needed for hold events
    stubOutboxService,
  );

  const ourApp = express();
  ourApp.use(express.json());
  ourApp.use('/api/vendor-integrations', createVendorIntegrationRouter(integrationService));

  ({ server: ourServer, port: ourPort } = await startServer(ourApp));

  // ── 2. Start fake AIM-Port ──────────────────────────────────────────────────
  //
  // On every POST it:
  //   a) records the raw body
  //   b) echoes that body back to OUR inbound webhook (the loop scenario)
  //   c) captures our inbound's response headers
  //   d) returns 200 { success: 'true' } to our outbound dispatcher
  const fakeAimPortApp = express();
  fakeAimPortApp.use(express.json());

  fakeAimPortApp.post('*', async (req, res) => {
    const body = req.body as unknown;
    aimPortReceivedBodies.push(body);

    // Echo the exact same body back to our inbound webhook
    const ourInboundUrl = `http://127.0.0.1:${ourPort}/api/vendor-integrations/aim-port/inbound`;
    try {
      const echoRes = await fetch(ourInboundUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      echoResponseStatuses.push(echoRes.status);
      echoEventCounts.push(echoRes.headers.get('x-normalized-event-count') ?? 'missing');
    } catch (err) {
      echoResponseStatuses.push(-1);
      echoEventCounts.push('error');
    }

    // Respond to our outbound dispatcher with a valid AIM-Port ACK
    res.status(200).json({ client_id: TEST_CLIENT_ID, success: 'true', order_id: 'VO-48' });
  });

  ({ server: fakeAimPortServer, port: aimPort } = await startServer(fakeAimPortApp));

  // ── 3. Patch connection to point at fake AIM-Port ───────────────────────────
  testConnection.outboundEndpointUrl = `http://127.0.0.1:${aimPort}`;
});

afterAll(async () => {
  await Promise.all([stopServer(ourServer), stopServer(fakeAimPortServer)]);
  delete process.env.ENVIRONMENT;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIM-Port outbound echo-loop prevention (real HTTP)', () => {
  it('OrderHoldRequest: dispatcher sends one call; echo-back produces zero domain events; no second outbound call', async () => {
    aimPortReceivedBodies.length = 0;
    echoResponseStatuses.length = 0;
    echoEventCounts.length = 0;

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

    const holdEvent: VendorDomainEvent = {
      id: 'evt-hold-001',
      eventType: 'vendor.order.held',
      vendorType: 'aim-port',
      vendorOrderId: 'VO-48',
      ourOrderId: 'order-internal-001',
      lenderId: 'lender-echo',
      tenantId: 'tenant-echo',
      occurredAt: new Date().toISOString(),
      payload: { message: 'On hold pending additional documents' },
    };

    // This makes a REAL HTTP POST to fakeAimPort.
    // fakeAimPort echoes it back to our inbound over TCP before returning 200.
    await dispatcher.dispatch(holdEvent, testConnection.id);

    // ① Fake AIM-Port received exactly ONE outbound call from us
    expect(aimPortReceivedBodies).toHaveLength(1);

    const sentBody = aimPortReceivedBodies[0] as Record<string, unknown>;
    expect(sentBody).toHaveProperty('OrderHoldRequest');

    // ② When AIM-Port echoed that body back to our inbound:
    //    - Our webhook returned 200 (not 4xx/5xx)
    expect(echoResponseStatuses[0]).toBe(200);

    //    - Zero domain events were produced (the fix: echo-back is suppressed)
    expect(echoEventCounts[0]).toBe('0');

    // ③ Fake AIM-Port was NOT called a second time (no loop triggered)
    //    If the echo had triggered another outbound, aimPortReceivedBodies would have 2+ entries.
    expect(aimPortReceivedBodies).toHaveLength(1);
  });

  it('OrderResumeRequest: dispatcher sends one call; echo-back produces zero domain events', async () => {
    aimPortReceivedBodies.length = 0;
    echoResponseStatuses.length = 0;
    echoEventCounts.length = 0;

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

    const resumeEvent: VendorDomainEvent = {
      id: 'evt-resume-001',
      eventType: 'vendor.order.resumed',
      vendorType: 'aim-port',
      vendorOrderId: 'VO-49',
      ourOrderId: 'order-internal-002',
      lenderId: 'lender-echo',
      tenantId: 'tenant-echo',
      occurredAt: new Date().toISOString(),
      payload: { message: 'Documents received, resuming' },
    };

    await dispatcher.dispatch(resumeEvent, testConnection.id);

    expect(aimPortReceivedBodies).toHaveLength(1);
    const sentBody = aimPortReceivedBodies[0] as Record<string, unknown>;
    expect(sentBody).toHaveProperty('OrderResumeRequest');
    expect(echoResponseStatuses[0]).toBe(200);
    expect(echoEventCounts[0]).toBe('0');
    expect(aimPortReceivedBodies).toHaveLength(1);
  });

  it('OrderCancelledRequest: dispatcher sends one call; echo-back produces zero domain events', async () => {
    aimPortReceivedBodies.length = 0;
    echoResponseStatuses.length = 0;
    echoEventCounts.length = 0;

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

    const cancelEvent: VendorDomainEvent = {
      id: 'evt-cancel-001',
      eventType: 'vendor.order.cancelled',
      vendorType: 'aim-port',
      vendorOrderId: 'VO-50',
      ourOrderId: 'order-internal-003',
      lenderId: 'lender-echo',
      tenantId: 'tenant-echo',
      occurredAt: new Date().toISOString(),
      payload: { message: 'Order cancelled by lender' },
    };

    await dispatcher.dispatch(cancelEvent, testConnection.id);

    expect(aimPortReceivedBodies).toHaveLength(1);
    const sentBody = aimPortReceivedBodies[0] as Record<string, unknown>;
    expect(sentBody).toHaveProperty('OrderCancelledRequest');
    expect(echoResponseStatuses[0]).toBe(200);
    expect(echoEventCounts[0]).toBe('0');
    expect(aimPortReceivedBodies).toHaveLength(1);
  });

  it('OrderFilesRequest: dispatcher sends one call; echo-back produces a vendor.order.completed domain event (legitimate inbound)', async () => {
    // This verifies that LEGITIMATE AIM-Port inbound events (ones where AIM-Port
    // is genuinely the originator, not echoing us) still produce domain events.
    // OrderFilesRequest arrives when the appraiser submits their report — AIM-Port
    // sends this inbound and we should process it.
    aimPortReceivedBodies.length = 0;
    echoResponseStatuses.length = 0;
    echoEventCounts.length = 0;

    const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

    const completedEvent: VendorDomainEvent = {
      id: 'evt-files-001',
      eventType: 'vendor.order.completed',
      vendorType: 'aim-port',
      vendorOrderId: 'VO-51',
      ourOrderId: 'order-internal-004',
      lenderId: 'lender-echo',
      tenantId: 'tenant-echo',
      occurredAt: new Date().toISOString(),
      payload: {
        files: [{ fileId: 'f1', filename: 'report.pdf', category: '1004', content: 'base64content' }],
      },
    };

    await dispatcher.dispatch(completedEvent, testConnection.id);

    expect(aimPortReceivedBodies).toHaveLength(1);
    const sentBody = aimPortReceivedBodies[0] as Record<string, unknown>;
    expect(sentBody).toHaveProperty('OrderFilesRequest');
    expect(echoResponseStatuses[0]).toBe(200);

    // OrderFilesRequest is a VENDOR-to-CLIENT event — it IS valid inbound.
    // When echoed back, it should produce 1 domain event (vendor.order.completed).
    expect(echoEventCounts[0]).toBe('1');
  });
});
