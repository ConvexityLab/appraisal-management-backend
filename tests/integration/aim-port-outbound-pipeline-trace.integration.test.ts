/**
 * AIM-Port Outbound Pipeline Trace Test
 *
 * WHAT THIS TESTS
 * ───────────────
 * For every domain event that AimPortAdapter is supposed to translate into an
 * outbound HTTP call back to the AIM-Port lender system, this test wires a
 * real local HTTP server as the callback target, runs the full consumer →
 * dispatcher pipeline, and then asserts:
 *
 *   1. EXACTLY which HTTP requests arrived at the local callback URL
 *      (path, AIM-Port requestType envelope, login block, order/files/message)
 *   2. EXACTLY which Service Bus events were published as side-effects
 *
 * This gives us an end-to-end, traceable snapshot of every message fired after
 * a domain event enters the consumer pipeline — no guessing, no mocking of the
 * adapter or dispatcher.
 *
 * ARCHITECTURE
 * ─────────────
 *                  ┌───────────────────────────────┐
 *   domain event → │ VendorIntegrationEventConsumer │
 *                  │   → VendorOutboundDispatcher   │
 *                  │     → AimPortAdapter           │
 *                  │       → real fetch()           │
 *                  └──────────────┬────────────────┘
 *                                 │ HTTP POST
 *                                 ▼
 *                  ┌────────────────────────────────┐
 *                  │  Local callback server          │
 *                  │  (http.createServer on port 0)  │
 *                  │  Records: body, path, type      │
 *                  └────────────────────────────────┘
 *
 * WHAT IS NOT MOCKED
 *   • HTTP transport (real fetch)
 *   • AimPortAdapter (real buildOutboundCall)
 *   • VendorOutboundDispatcher (real retry logic, real HTTP)
 *   • VendorIntegrationEventConsumerService (real onVendorEvent path)
 *
 * WHAT IS STUBBED
 *   • VendorConnectionService  — returns fixed test connection pointing at local server
 *   • CosmosDbService          — in-memory stub (no Azure)
 *   • ServiceBusEventPublisher — in-memory capture
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import http from 'node:http';
import express from 'express';
import { VendorOutboundDispatcher } from '../../src/services/vendor-integrations/VendorOutboundDispatcher.js';
import { VendorIntegrationEventConsumerService } from '../../src/services/vendor-integration-event-consumer.service.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';
import type { VendorConnectionService } from '../../src/services/vendor-integrations/VendorConnectionService.js';
import type { VendorIntegrationEvent } from '../../src/types/events.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_API_KEY = 'trace-test-api-key-xyz789';
const TEST_CLIENT_ID = '495735';
const TEST_VENDOR_ORDER_ID = 'VO-TRACE-001';
const TEST_OUR_ORDER_ID = 'order-trace-001';
const TEST_TENANT_ID = 'tenant-trace';
const TEST_LENDER_ID = 'lender-trace';
const TEST_CONNECTION_ID = 'vc-trace-test';

// ─── Mutable test connection (outboundEndpointUrl patched in beforeAll) ───────

const testConnection: VendorConnection = {
  id: TEST_CONNECTION_ID,
  tenantId: TEST_TENANT_ID,
  vendorType: 'aim-port',
  lenderId: TEST_LENDER_ID,
  lenderName: 'Pipeline Trace Test Lender',
  inboundIdentifier: TEST_CLIENT_ID,
  credentials: {
    inboundApiKeySecretName: 'inbound-secret',
    outboundApiKeySecretName: 'outbound-secret',
    outboundClientId: TEST_CLIENT_ID,
  },
  outboundEndpointUrl: '', // patched in beforeAll
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  productMappings: { '1': 'FULL_APPRAISAL' },
};

const stubConnectionService: VendorConnectionService = {
  getActiveConnectionByInboundIdentifier: async () => testConnection,
  getConnectionById: async () => testConnection,
  resolveSecret: async () => TEST_API_KEY,
} as unknown as VendorConnectionService;

// ─── Trace state ──────────────────────────────────────────────────────────────

/** Every HTTP POST received at the local callback server, in arrival order */
const callbacksReceived: Array<{
  path: string;
  requestType: string;
  body: Record<string, unknown>;
  login: { client_id: string; api_key: string; order_id: string } | undefined;
}> = [];

/** Every Service Bus event published during the test, in publish order */
const publishedEvents: Array<{ type: string; data: unknown }> = [];

function clearTrace(): void {
  callbacksReceived.length = 0;
  publishedEvents.length = 0;
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

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

// ─── Shared infra ─────────────────────────────────────────────────────────────

let callbackServer: http.Server;

beforeAll(async () => {
  process.env.ENVIRONMENT = 'dev';

  // Start local callback server — this is the URL AIM-Port callbacks land on
  const callbackApp = express();
  callbackApp.use(express.json());
  callbackApp.post('*', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const requestType = Object.keys(body)[0] ?? 'unknown';
    const envelope = body[requestType] as Record<string, unknown> | undefined;
    const login = envelope?.['login'] as { client_id: string; api_key: string; order_id: string } | undefined;

    callbacksReceived.push({ path: req.path, requestType, body, login });

    // Standard AIM-Port success ACK
    res.status(200).json({ client_id: TEST_CLIENT_ID, success: 'true', order_id: TEST_VENDOR_ORDER_ID });
  });

  const { server, port } = await startServer(callbackApp);
  callbackServer = server;

  // Point the connection at our local server
  testConnection.outboundEndpointUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await stopServer(callbackServer);
  delete process.env.ENVIRONMENT;
});

beforeEach(() => clearTrace());

// ─── Consumer factory ─────────────────────────────────────────────────────────

function makeConsumer() {
  const dispatcher = new VendorOutboundDispatcher(stubConnectionService);

  const stubDb = {
    getItem: async () => ({ success: true, data: {
      id: TEST_OUR_ORDER_ID,
      status: 'ASSIGNED',
      tenantId: TEST_TENANT_ID,
      metadata: {},
    }}),
    updateItem: async () => ({ success: true, data: {} }),
    queryItems: async () => ({ success: true, data: [] }),
    upsertItem: async () => ({ success: true, data: {} }),
    getContainer: async () => ({}),
  };

  const stubPublisher = {
    publish: async (event: { type: string; data: unknown }) => {
      publishedEvents.push({ type: event.type, data: event.data });
    },
  };

  return new VendorIntegrationEventConsumerService(
    stubDb as any,
    stubPublisher as any,
    async () => {},          // stubFilePersistor
    dispatcher,
  );
}

// ─── Event builder ────────────────────────────────────────────────────────────

function makeVendorEvent(
  type: VendorIntegrationEvent['type'],
  payload: Record<string, unknown> = {},
): VendorIntegrationEvent {
  const id = `trace-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    type,
    timestamp: new Date(),
    source: 'vendor-integration-service',
    version: '1.0',
    correlationId: `corr-${Date.now()}`,
    category: 'VENDOR' as any,
    data: {
      id,
      vendorType: 'aim-port',
      vendorOrderId: TEST_VENDOR_ORDER_ID,
      ourOrderId: TEST_OUR_ORDER_ID,
      lenderId: TEST_LENDER_ID,
      tenantId: TEST_TENANT_ID,
      connectionId: TEST_CONNECTION_ID,
      // 'internal' means our platform raised this event — dispatcher only
      // fires for internal-origin events to prevent inbound-echo loops.
      origin: 'internal' as const,
      occurredAt: new Date().toISOString(),
      payload,
    } as any,
  };
}

async function driveConsumer(event: VendorIntegrationEvent, waitMs = 300): Promise<void> {
  const consumer = makeConsumer();
  await (consumer as any).onVendorEvent(event);
  // Allow the dispatcher's async HTTP call to complete
  await new Promise((r) => setTimeout(r, waitMs));
}

// ─── Helper assertions ────────────────────────────────────────────────────────

function assertSingleCallback(expectedRequestType: string): ReturnType<typeof callbacksReceived[0]['body'][string]> {
  expect(callbacksReceived).toHaveLength(1);
  expect(callbacksReceived[0]!.requestType).toBe(expectedRequestType);
  return callbacksReceived[0]!;
}

function assertLoginBlock(callback: typeof callbacksReceived[0]): void {
  expect(callback.login).toBeDefined();
  expect(callback.login!.client_id).toBe(TEST_CLIENT_ID);
  expect(callback.login!.api_key).toBe(TEST_API_KEY);
  expect(callback.login!.order_id).toBe(TEST_VENDOR_ORDER_ID);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS — one per outbound event type
// ═══════════════════════════════════════════════════════════════════════════════

describe('AIM-Port outbound pipeline trace — callback URL + published events', () => {

  // ── vendor.order.assigned ──────────────────────────────────────────────────

  describe('vendor.order.assigned', () => {
    it('fires exactly one OrderAssignedRequest callback with correct login block', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.assigned' as any));

      const cb = assertSingleCallback('OrderAssignedRequest');
      assertLoginBlock(cb);
      console.log('[TRACE] vendor.order.assigned callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });

    it('published Service Bus events after vendor.order.assigned', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.assigned' as any));

      console.log('[TRACE] vendor.order.assigned published events:', JSON.stringify(publishedEvents, null, 2));
      // vendor.order.assigned only updates Cosmos status — no SB events published
      const types = publishedEvents.map((e) => e.type);
      expect(types).toEqual([]);
    });
  });

  // ── vendor.order.accepted ──────────────────────────────────────────────────

  describe('vendor.order.accepted', () => {
    it('fires exactly one OrderAcceptedRequest callback with vendor info', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.accepted' as any, {
        vendorFirstName: 'John',
        vendorLastName: 'Doe',
        vendorLicenseNumber: 'CA-12345',
        vendorLicenseExpiration: '2027-12-31',
      }));

      const cb = assertSingleCallback('OrderAcceptedRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderAcceptedRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['vendor_first_name']).toBe('John');
      expect(order['vendor_last_name']).toBe('Doe');
      expect(order['vendor_license_number']).toBe('CA-12345');
      console.log('[TRACE] vendor.order.accepted callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.held ─────────────────────────────────────────────────────

  describe('vendor.order.held', () => {
    it('fires exactly one OrderHoldRequest callback with hold_message', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.held' as any, {
        message: 'Waiting for additional property access',
      }));

      const cb = assertSingleCallback('OrderHoldRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderHoldRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['hold_message']).toBe('Waiting for additional property access');
      console.log('[TRACE] vendor.order.held callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.resumed ──────────────────────────────────────────────────

  describe('vendor.order.resumed', () => {
    it('fires exactly one OrderResumeRequest callback with resume_message', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.resumed' as any, {
        message: 'Property access confirmed',
      }));

      const cb = assertSingleCallback('OrderResumeRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderResumeRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['resume_message']).toBe('Property access confirmed');
      console.log('[TRACE] vendor.order.resumed callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.cancelled ────────────────────────────────────────────────

  describe('vendor.order.cancelled', () => {
    it('fires exactly one OrderCancelledRequest callback with cancellation_message', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.cancelled' as any, {
        message: 'Loan fell through',
      }));

      const cb = assertSingleCallback('OrderCancelledRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderCancelledRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['cancellation_message']).toBe('Loan fell through');
      console.log('[TRACE] vendor.order.cancelled callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });

    it('published Service Bus events after vendor.order.cancelled', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.cancelled' as any));

      console.log('[TRACE] vendor.order.cancelled published events:', JSON.stringify(publishedEvents, null, 2));
      // vendor.order.cancelled only updates Cosmos status — no SB events published
      const types = publishedEvents.map((e) => e.type);
      expect(types).toEqual([]);
    });
  });

  // ── vendor.order.completed ────────────────────────────────────────────────

  describe('vendor.order.completed', () => {
    it('fires exactly one OrderFilesRequest callback with file list', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.completed' as any, {
        files: [
          { url: 'https://files.aimport.com/report.pdf', name: 'Final Report', mimeType: 'application/pdf', size: 204800 },
        ],
      }));

      const cb = assertSingleCallback('OrderFilesRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderFilesRequest'] as Record<string, unknown>;
      const files = envelope['files'] as unknown[];
      expect(files).toHaveLength(1);
      console.log('[TRACE] vendor.order.completed callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });

    it('published Service Bus events after vendor.order.completed', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.completed' as any, {
        files: [{ url: 'https://files.aimport.com/report.pdf', name: 'Final Report', mimeType: 'application/pdf', size: 204800 }],
      }));

      console.log('[TRACE] vendor.order.completed published events:', JSON.stringify(publishedEvents, null, 2));
      // vendor.order.completed persists files + updates Cosmos status — no SB events published
      const types = publishedEvents.map((e) => e.type);
      expect(types).toEqual([]);
    });
  });

  // ── vendor.message.received ───────────────────────────────────────────────

  describe('vendor.message.received', () => {
    it('fires exactly one MessageRequest callback with subject and content', async () => {
      await driveConsumer(makeVendorEvent('vendor.message.received' as any, {
        subject: 'Access Scheduled',
        content: 'Inspector will arrive Thursday 2pm',
      }));

      const cb = assertSingleCallback('MessageRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['MessageRequest'] as Record<string, unknown>;
      const message = envelope['message'] as Record<string, unknown>;
      expect(message['subject']).toBe('Access Scheduled');
      expect(message['content']).toBe('Inspector will arrive Thursday 2pm');
      console.log('[TRACE] vendor.message.received callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.due_date_changed ─────────────────────────────────────────

  describe('vendor.order.due_date_changed', () => {
    it('fires exactly one OrderDueDateRequest callback with due_date', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.due_date_changed' as any, {
        dueDate: '2026-06-15',
      }));

      const cb = assertSingleCallback('OrderDueDateRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderDueDateRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['due_date']).toBe('2026-06-15');
      console.log('[TRACE] vendor.order.due_date_changed callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.fee_changed ──────────────────────────────────────────────

  describe('vendor.order.fee_changed', () => {
    it('fires exactly one OrderFeeChangeRequest callback with fee', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.fee_changed' as any, {
        fee: 650,
      }));

      const cb = assertSingleCallback('OrderFeeChangeRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderFeeChangeRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['fee']).toBe(650);
      console.log('[TRACE] vendor.order.fee_changed callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.paid ─────────────────────────────────────────────────────

  describe('vendor.order.paid', () => {
    it('fires exactly one OrderPaidRequest callback with paid_amount', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.paid' as any, {
        paidAmount: 650,
      }));

      const cb = assertSingleCallback('OrderPaidRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['OrderPaidRequest'] as Record<string, unknown>;
      const order = envelope['order'] as Record<string, unknown>;
      expect(order['paid_amount']).toBe(650);
      console.log('[TRACE] vendor.order.paid callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.file.received_no_completion ────────────────────────────────────

  describe('vendor.file.received_no_completion', () => {
    it('fires exactly one DocsNoCompletionRequest callback with file list', async () => {
      await driveConsumer(makeVendorEvent('vendor.file.received_no_completion' as any, {
        files: [
          { url: 'https://files.aimport.com/partial.pdf', name: 'Partial Report', mimeType: 'application/pdf', size: 102400 },
        ],
      }));

      const cb = assertSingleCallback('DocsNoCompletionRequest');
      assertLoginBlock(cb);

      const envelope = cb.body['DocsNoCompletionRequest'] as Record<string, unknown>;
      const files = envelope['files'] as unknown[];
      expect(files).toHaveLength(1);
      console.log('[TRACE] vendor.file.received_no_completion callbacks:', JSON.stringify(callbacksReceived, null, 2));
    });
  });

  // ── vendor.order.received (inbound-only — must NOT callback) ──────────────

  describe('vendor.order.received (inbound-only guard)', () => {
    it('fires ZERO outbound callbacks — inbound events must never echo back to AIM-Port', async () => {
      await driveConsumer(makeVendorEvent('vendor.order.received' as any, {
        orderType: 'residential',
        address: '123 Main St', city: 'LA', state: 'CA', zipCode: '90001',
      }));

      expect(callbacksReceived).toHaveLength(0);
      console.log('[TRACE] vendor.order.received published events:', JSON.stringify(publishedEvents, null, 2));
    });
  });

  // ── Full message trace — entire session summary ────────────────────────────

  describe('full session trace (multiple events in sequence)', () => {
    it('traces correct callbacks and events for assigned → accepted → completed sequence', async () => {
      const consumer = makeConsumer();
      const run = async (event: VendorIntegrationEvent) => {
        await (consumer as any).onVendorEvent(event);
        await new Promise((r) => setTimeout(r, 200));
      };

      await run(makeVendorEvent('vendor.order.assigned' as any));
      await run(makeVendorEvent('vendor.order.accepted' as any, {
        vendorFirstName: 'Jane', vendorLastName: 'Smith',
        vendorLicenseNumber: 'CA-99999', vendorLicenseExpiration: '2028-01-01',
      }));
      await run(makeVendorEvent('vendor.order.completed' as any, {
        files: [{ url: 'https://files.aimport.com/final.pdf', name: 'Final Report', mimeType: 'application/pdf', size: 512000 }],
      }));

      // Exact sequence of HTTP callbacks
      expect(callbacksReceived.map((c) => c.requestType)).toEqual([
        'OrderAssignedRequest',
        'OrderAcceptedRequest',
        'OrderFilesRequest',
      ]);

      // All login blocks carry the same credentials
      for (const cb of callbacksReceived) {
        assertLoginBlock(cb);
      }

      console.log('[TRACE] full session - all callbacks:', JSON.stringify(
        callbacksReceived.map((c) => ({ requestType: c.requestType, path: c.path })),
        null, 2,
      ));
      console.log('[TRACE] full session - all published events:', JSON.stringify(
        publishedEvents.map((e) => e.type),
        null, 2,
      ));
    });
  });

});
