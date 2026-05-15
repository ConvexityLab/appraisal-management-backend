#!/usr/bin/env tsx

import { getJson, loadLiveFireContext, loadPollOptions, sleep } from './_axiom-live-fire-common.js';

interface AimPortAckResponse {
  client_id?: string;
  success?: string;
  order_id?: string;
  message?: string;
  fee?: number;
}

interface OrderRecord {
  id?: string;
  tenantId?: string;
  clientId?: string;
  metadata?: {
    vendorIntegration?: {
      vendorOrderId?: string;
      vendorType?: string;
      connectionId?: string;
    };
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function logSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function assertAck(payload: AimPortAckResponse, expectedClientId: string): string {
  if (payload.client_id !== expectedClientId) {
    throw new Error(`AIM-Port ack client_id mismatch. Expected '${expectedClientId}', got '${payload.client_id ?? 'undefined'}'.`);
  }
  if (payload.success !== 'true') {
    throw new Error(`AIM-Port ack success must be 'true'. Got ${JSON.stringify(payload.success)}.`);
  }
  if (!payload.order_id || !payload.order_id.trim()) {
    throw new Error(`AIM-Port ack must include the internal order id in order_id. Got ${JSON.stringify(payload.order_id)}.`);
  }

  return payload.order_id;
}

async function waitForOrderCreation(params: {
  baseUrl: string;
  authHeader: Record<string, string>;
  internalOrderId: string;
  vendorOrderId: string;
  tenantId: string;
  expectedClientId?: string;
  attempts: number;
  intervalMs: number;
}): Promise<OrderRecord> {
  let lastStatus = 0;
  let lastBody: unknown;

  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    const response = await getJson<OrderRecord | { error?: string; code?: string }>(
      `${params.baseUrl}/api/orders/${encodeURIComponent(params.internalOrderId)}`,
      params.authHeader,
    );
    lastStatus = response.status;
    lastBody = response.data;

    if (response.status === 200) {
      const order = response.data as OrderRecord;
      if (order.id !== params.internalOrderId) {
        throw new Error(
          `Fetched order id mismatch. Expected '${params.internalOrderId}', got '${order.id ?? 'undefined'}'.`,
        );
      }
      if (order.tenantId !== params.tenantId) {
        throw new Error(`Fetched order tenantId mismatch. Expected '${params.tenantId}', got '${order.tenantId ?? 'undefined'}'.`);
      }
      if (params.expectedClientId && order.clientId !== params.expectedClientId) {
        throw new Error(`Fetched order clientId mismatch. Expected '${params.expectedClientId}', got '${order.clientId ?? 'undefined'}'.`);
      }
      if (order.metadata?.vendorIntegration?.vendorType !== 'aim-port') {
        throw new Error(
          `Fetched order vendorType mismatch. Expected 'aim-port', got '${order.metadata?.vendorIntegration?.vendorType ?? 'undefined'}'.`,
        );
      }
      if (order.metadata?.vendorIntegration?.vendorOrderId !== params.vendorOrderId) {
        throw new Error(
          `Fetched order vendorOrderId mismatch. Expected '${params.vendorOrderId}', got '${order.metadata?.vendorIntegration?.vendorOrderId ?? 'undefined'}'.`,
        );
      }
      return order;
    }

    if (response.status !== 404) {
      throw new Error(
        `Fetching created order returned HTTP ${response.status}. Body=${JSON.stringify(response.data)}`,
      );
    }

    await sleep(params.intervalMs);
  }

  throw new Error(
    `Created order '${params.internalOrderId}' was not readable after ${params.attempts} attempts. ` +
    `Last status=${lastStatus}. Last body=${JSON.stringify(lastBody)}`,
  );
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const poll = loadPollOptions();
  const baseUrl = context.baseUrl;
  const clientId = requiredEnv('INTEGRATION_LIVE_AIMPORT_CLIENT_ID');
  const apiKey = requiredEnv('INTEGRATION_LIVE_AIMPORT_API_KEY');
  const vendorOrderId = optionalEnv('INTEGRATION_LIVE_AIMPORT_ORDER_ID') ?? `AP-LIVE-${Date.now()}`;
  const address = optionalEnv('INTEGRATION_LIVE_AIMPORT_ADDRESS') ?? '123 Live Fire St';
  const city = optionalEnv('INTEGRATION_LIVE_AIMPORT_CITY') ?? 'Dallas';
  const state = optionalEnv('INTEGRATION_LIVE_AIMPORT_STATE') ?? 'TX';
  const zipCode = optionalEnv('INTEGRATION_LIVE_AIMPORT_ZIP') ?? '75001';
  const borrowerName = optionalEnv('INTEGRATION_LIVE_AIMPORT_BORROWER') ?? 'Live Fire Borrower';
  const dueDate = optionalEnv('INTEGRATION_LIVE_AIMPORT_DUE_DATE') ?? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const disclosedFee = Number(optionalEnv('INTEGRATION_LIVE_AIMPORT_DISCLOSED_FEE') ?? '550');
  const expectedLenderId = optionalEnv('INTEGRATION_LIVE_AIMPORT_EXPECT_LENDER_ID');

  if (!Number.isFinite(disclosedFee) || disclosedFee < 0) {
    throw new Error(`INTEGRATION_LIVE_AIMPORT_DISCLOSED_FEE must be a non-negative number. Got '${process.env['INTEGRATION_LIVE_AIMPORT_DISCLOSED_FEE'] ?? ''}'.`);
  }

  const payload = {
    OrderRequest: {
      login: {
        client_id: clientId,
        api_key: apiKey,
        order_id: vendorOrderId,
      },
      order: {
        order_id: vendorOrderId,
        order_type: 'residential',
        address,
        city,
        state,
        zip_code: zipCode,
        property_type: 'sfr',
        borrower: { name: borrowerName },
        due_date: dueDate,
        disclosed_fee: disclosedFee,
        reports: [{ id: 49079, name: '1004' }],
      },
    },
  };

  logSection('Config');
  console.log(JSON.stringify({
    baseUrl,
    authTenantId: context.tenantId,
    authClientId: context.clientId,
    vendorClientId: clientId,
    vendorOrderId,
    dueDate,
    disclosedFee,
    address,
    city,
    state,
    zipCode,
  }, null, 2));

  logSection('POST /api/v1/integrations/aim-port/inbound');
  const response = await fetch(`${baseUrl}/api/v1/integrations/aim-port/inbound`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsed: AimPortAckResponse | { success?: boolean; error?: { code?: string; message?: string } } | string = rawText;
  try {
    parsed = JSON.parse(rawText) as AimPortAckResponse;
  } catch {
    // keep raw text for diagnostics
  }

  if (response.status !== 200) {
    throw new Error(
      `AIM-Port inbound returned HTTP ${response.status}. ` +
      `Headers=${JSON.stringify({
        vendorType: response.headers.get('x-vendor-type'),
        connectionId: response.headers.get('x-vendor-connection-id'),
        normalizedEventCount: response.headers.get('x-normalized-event-count'),
      })}. ` +
      `Body=${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
    );
  }

  if (typeof parsed === 'string') {
    throw new Error(`AIM-Port inbound returned non-JSON body: ${parsed}`);
  }

  const internalOrderId = assertAck(parsed as AimPortAckResponse, clientId);

  const vendorType = response.headers.get('x-vendor-type');
  if (vendorType !== 'aim-port') {
    throw new Error(`Expected x-vendor-type='aim-port'. Got '${vendorType ?? 'null'}'.`);
  }
  const connectionId = response.headers.get('x-vendor-connection-id');
  if (!connectionId) {
    throw new Error('AIM-Port inbound response is missing x-vendor-connection-id.');
  }
  const normalizedEventCount = response.headers.get('x-normalized-event-count');
  if (!normalizedEventCount || Number(normalizedEventCount) <= 0) {
    throw new Error(`Expected x-normalized-event-count > 0. Got '${normalizedEventCount ?? 'null'}'.`);
  }

  logSection('GET /api/orders/:orderId');
  const createdOrder = await waitForOrderCreation({
    baseUrl,
    authHeader: context.authHeader,
    internalOrderId,
    vendorOrderId,
    tenantId: context.tenantId,
    expectedClientId: expectedLenderId,
    attempts: poll.attempts,
    intervalMs: poll.intervalMs,
  });

  logSection('Result');
  console.log(JSON.stringify({
    ack: parsed,
    headers: {
      vendorType,
      connectionId,
      normalizedEventCount,
    },
    createdOrder: {
      id: createdOrder.id,
      tenantId: createdOrder.tenantId,
      clientId: createdOrder.clientId,
      vendorIntegration: createdOrder.metadata?.vendorIntegration,
    },
  }, null, 2));
  console.log('\n✅ AIM-Port live-fire endpoint passed end-to-end through order creation.');
}

main().catch((error) => {
  console.error(`\n❌ AIM-Port live-fire endpoint failed: ${(error as Error).message}`);
  process.exit(1);
});
