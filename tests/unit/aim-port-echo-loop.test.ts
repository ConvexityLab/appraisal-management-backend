/**
 * AIM-Port echo-loop regression test.
 *
 * Problem:
 *   When we send OrderHoldRequest / OrderResumeRequest / OrderCancelledRequest
 *   to AIM-Port, AIM-Port reflects the exact same body back to our inbound
 *   webhook as a receipt confirmation.  Before the fix, our inbound handler
 *   mapped those reflected payloads to domain events (vendor.order.held, etc.),
 *   which triggered further outbound calls, creating an infinite loop:
 *
 *     notifyHold()
 *       → outbox enqueues OrderHoldRequest
 *       → AIM-Port receives it and POSTs it back to our webhook
 *       → handleInbound produces vendor.order.held
 *       → outbox enqueues another OrderHoldRequest
 *       → ... (loops forever)
 *
 * Test strategy — CLOSED LOOP:
 *   For each of the three event types, we:
 *     1. Call buildOutboundCall() to get the exact body we send to AIM-Port.
 *     2. Extract that body (what AIM-Port would echo back to us).
 *     3. Feed it to handleInbound() — exactly as our webhook controller does.
 *     4. Assert domainEvents is EMPTY → no further outbound can be queued.
 *
 *   This test is self-contained (no Azure, no mocks needed) because it only
 *   exercises the adapter methods that the real runtime path uses.
 */

import { describe, expect, it } from 'vitest';
import { AimPortAdapter } from '../../src/services/vendor-integrations/AimPortAdapter.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

// A minimal vendor connection that satisfies every path we exercise.
const connection: VendorConnection = {
  id: 'vc-echo-test',
  tenantId: 'tenant-echo',
  vendorType: 'aim-port',
  lenderId: 'lender-echo',
  lenderName: 'Echo Loop Test Lender',
  inboundIdentifier: '495735',
  credentials: {
    inboundApiKeySecretName: 'inbound-secret',
    outboundApiKeySecretName: 'outbound-secret',
    outboundClientId: '495735',
  },
  outboundEndpointUrl: 'https://aim-port.example.com/webhook',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Resolves secrets without hitting Key Vault — the outbound secret value
// is only used to build the login block, which the echo path never validates.
const fakeContext = {
  resolveSecret: async (_name: string) => 'test-api-key',
};

function buildBaseEvent(eventType: VendorDomainEvent['eventType']): VendorDomainEvent {
  return {
    id: 'evt-echo-1',
    eventType,
    vendorType: 'aim-port',
    vendorOrderId: 'VO-48',
    ourOrderId: 'order-internal-1',
    lenderId: 'lender-echo',
    tenantId: 'tenant-echo',
    occurredAt: '2026-05-14T10:00:00.000Z',
    payload: {},
  };
}

const adapter = new AimPortAdapter();

// ──────────────────────────────────────────────────────────────────────────────
// CLOSED-LOOP TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('AIM-Port echo-loop regression — closed loop via buildOutboundCall → handleInbound', () => {

  it('OrderHoldRequest: outbound body echoed back produces zero domain events', async () => {
    // Step 1: build the body WE send to AIM-Port.
    const holdEvent: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.held'),
      payload: { message: 'On hold pending documents' },
    };
    const call = await adapter.buildOutboundCall(holdEvent, connection, fakeContext);
    expect(call).not.toBeNull();

    // Step 2: that exact body is what AIM-Port POSTs back to us.
    const echoBody = call!.body;

    // Step 3: verify our inbound handler recognises it as an AIM-Port request.
    expect(adapter.canHandleInbound(echoBody, {})).toBe(true);

    // Step 4: process it exactly as our webhook controller does.
    const result = await adapter.handleInbound(echoBody, {}, connection, fakeContext);

    // Step 5: must produce NO domain events → no outbound can be queued.
    expect(result.domainEvents).toHaveLength(0);
    expect(result.ack.statusCode).toBe(200);
  });

  it('OrderResumeRequest: outbound body echoed back produces zero domain events', async () => {
    const resumeEvent: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.resumed'),
      payload: { message: 'Resuming after hold' },
    };
    const call = await adapter.buildOutboundCall(resumeEvent, connection, fakeContext);
    expect(call).not.toBeNull();

    const echoBody = call!.body;
    expect(adapter.canHandleInbound(echoBody, {})).toBe(true);

    const result = await adapter.handleInbound(echoBody, {}, connection, fakeContext);

    expect(result.domainEvents).toHaveLength(0);
    expect(result.ack.statusCode).toBe(200);
  });

  it('OrderCancelledRequest: outbound body echoed back produces zero domain events', async () => {
    const cancelEvent: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.cancelled'),
      payload: { message: 'Client requested cancellation' },
    };
    const call = await adapter.buildOutboundCall(cancelEvent, connection, fakeContext);
    expect(call).not.toBeNull();

    const echoBody = call!.body;
    expect(adapter.canHandleInbound(echoBody, {})).toBe(true);

    const result = await adapter.handleInbound(echoBody, {}, connection, fakeContext);

    expect(result.domainEvents).toHaveLength(0);
    expect(result.ack.statusCode).toBe(200);
  });

  it('OrderHoldRequest: explicitly verifies the echoed body structure is what AIM-Port sends', async () => {
    // Sanity check: confirm the outbound body contains an OrderHoldRequest key,
    // which is the exact key AIM-Port uses when it reflects the call back.
    const holdEvent: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.held'),
      payload: {},
    };
    const call = await adapter.buildOutboundCall(holdEvent, connection, fakeContext);
    const body = call!.body as Record<string, unknown>;

    expect(body).toHaveProperty('OrderHoldRequest');
    const envelope = body['OrderHoldRequest'] as Record<string, unknown>;
    expect(envelope).toHaveProperty('login');
    const login = envelope['login'] as Record<string, unknown>;
    expect(login['client_id']).toBe('495735');
    expect(login['api_key']).toBe('test-api-key');
    expect(login['order_id']).toBe('VO-48');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// FORWARD-PATH TESTS
// Verify the original outbound-send behaviour is unchanged.
// ──────────────────────────────────────────────────────────────────────────────

describe('AIM-Port outbound — hold/resume/cancel still build correct outbound calls', () => {

  it('vendor.order.held builds OrderHoldRequest with hold_message', async () => {
    const event: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.held'),
      payload: { message: 'Documents needed' },
    };
    const call = await adapter.buildOutboundCall(event, connection, fakeContext);
    expect(call).not.toBeNull();
    expect(call!.url).toBe(connection.outboundEndpointUrl);
    const body = call!.body as Record<string, unknown>;
    expect(body).toHaveProperty('OrderHoldRequest');
    const order = ((body['OrderHoldRequest'] as any).order) as Record<string, unknown>;
    expect(order['hold_message']).toBe('Documents needed');
  });

  it('vendor.order.resumed builds OrderResumeRequest with resume_message', async () => {
    const event: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.resumed'),
      payload: { message: 'All good now' },
    };
    const call = await adapter.buildOutboundCall(event, connection, fakeContext);
    expect(call).not.toBeNull();
    const body = call!.body as Record<string, unknown>;
    expect(body).toHaveProperty('OrderResumeRequest');
    const order = ((body['OrderResumeRequest'] as any).order) as Record<string, unknown>;
    expect(order['resume_message']).toBe('All good now');
  });

  it('vendor.order.cancelled builds OrderCancelledRequest with cancellation_message', async () => {
    const event: VendorDomainEvent = {
      ...buildBaseEvent('vendor.order.cancelled'),
      payload: { message: 'Client withdrew.' },
    };
    const call = await adapter.buildOutboundCall(event, connection, fakeContext);
    expect(call).not.toBeNull();
    const body = call!.body as Record<string, unknown>;
    expect(body).toHaveProperty('OrderCancelledRequest');
    const order = ((body['OrderCancelledRequest'] as any).order) as Record<string, unknown>;
    expect(order['cancellation_message']).toBe('Client withdrew.');
  });
});
