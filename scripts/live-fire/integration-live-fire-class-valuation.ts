#!/usr/bin/env tsx

import { createHmac } from 'node:crypto';

interface ClassValuationAckResponse {
  received?: boolean;
}

interface ClassValuationWebhookBody {
  accountId: string;
  event: 'order.completed';
  occurredAt: string;
  data: {
    externalOrderId: string;
    orderId?: string;
    files: Array<{
      id: string;
      filename: string;
      category: string;
      content: string;
      description?: string;
    }>;
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

function assertAck(payload: ClassValuationAckResponse): void {
  if (payload.received !== true) {
    throw new Error(`Class Valuation ack must contain received=true. Got ${JSON.stringify(payload)}.`);
  }
}

function computeSignature(secret: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

async function main(): Promise<void> {
  const baseUrl = requiredEnv('AXIOM_LIVE_BASE_URL').replace(/\/$/, '');
  const accountId = requiredEnv('INTEGRATION_LIVE_CLASS_VALUATION_ACCOUNT_ID');
  const hmacSecret = requiredEnv('INTEGRATION_LIVE_CLASS_VALUATION_HMAC_SECRET');
  const externalOrderId = requiredEnv('INTEGRATION_LIVE_CLASS_VALUATION_EXTERNAL_ORDER_ID');
  const occurredAt = requiredEnv('INTEGRATION_LIVE_CLASS_VALUATION_OCCURRED_AT');
  const orderId = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_ORDER_ID');
  const fileId = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_FILE_ID');
  const fileName = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_FILE_NAME');
  const fileCategory = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_FILE_CATEGORY');
  const fileContent = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_FILE_CONTENT_BASE64');
  const fileDescription = optionalEnv('INTEGRATION_LIVE_CLASS_VALUATION_FILE_DESCRIPTION');

  const includeFile = Boolean(fileId || fileName || fileCategory || fileContent || fileDescription);
  if (includeFile && (!fileId || !fileName || !fileCategory || !fileContent)) {
    throw new Error(
      'When sending a Class Valuation file payload, INTEGRATION_LIVE_CLASS_VALUATION_FILE_ID, ' +
      'INTEGRATION_LIVE_CLASS_VALUATION_FILE_NAME, INTEGRATION_LIVE_CLASS_VALUATION_FILE_CATEGORY, and ' +
      'INTEGRATION_LIVE_CLASS_VALUATION_FILE_CONTENT_BASE64 are all required.',
    );
  }

  const payload: ClassValuationWebhookBody = {
    accountId,
    event: 'order.completed',
    occurredAt,
    data: {
      externalOrderId,
      ...(orderId ? { orderId } : {}),
      files: includeFile
        ? [{
            id: fileId!,
            filename: fileName!,
            category: fileCategory!,
            content: fileContent!,
            ...(fileDescription ? { description: fileDescription } : {}),
          }]
        : [],
    },
  };

  const rawBody = JSON.stringify(payload);
  const signature = computeSignature(hmacSecret, rawBody);

  logSection('Config');
  console.log(JSON.stringify({
    baseUrl,
    accountId,
    externalOrderId,
    occurredAt,
    orderId: orderId ?? null,
    fileCount: payload.data.files.length,
  }, null, 2));

  logSection('POST /api/v1/integrations/class-valuation/inbound');
  const response = await fetch(`${baseUrl}/api/v1/integrations/class-valuation/inbound`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-class-valuation-account-id': accountId,
      'x-class-valuation-signature': signature,
    },
    body: rawBody,
  });

  const rawText = await response.text();
  let parsed: ClassValuationAckResponse | { success?: boolean; error?: { code?: string; message?: string } } | string = rawText;
  try {
    parsed = JSON.parse(rawText) as ClassValuationAckResponse;
  } catch {
    // keep raw text for diagnostics
  }

  if (response.status !== 202) {
    throw new Error(
      `Class Valuation inbound returned HTTP ${response.status}. ` +
      `Headers=${JSON.stringify({
        vendorType: response.headers.get('x-vendor-type'),
        connectionId: response.headers.get('x-vendor-connection-id'),
        normalizedEventCount: response.headers.get('x-normalized-event-count'),
      })}. ` +
      `Body=${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
    );
  }

  if (typeof parsed === 'string') {
    throw new Error(`Class Valuation inbound returned non-JSON body: ${parsed}`);
  }

  assertAck(parsed as ClassValuationAckResponse);

  const vendorType = response.headers.get('x-vendor-type');
  if (vendorType !== 'class-valuation') {
    throw new Error(`Expected x-vendor-type='class-valuation'. Got '${vendorType ?? 'null'}'.`);
  }
  const connectionId = response.headers.get('x-vendor-connection-id');
  if (!connectionId) {
    throw new Error('Class Valuation inbound response is missing x-vendor-connection-id.');
  }
  const normalizedEventCount = response.headers.get('x-normalized-event-count');
  if (!normalizedEventCount || Number(normalizedEventCount) <= 0) {
    throw new Error(`Expected x-normalized-event-count > 0. Got '${normalizedEventCount ?? 'null'}'.`);
  }

  logSection('Result');
  console.log(JSON.stringify({
    ack: parsed,
    headers: {
      vendorType,
      connectionId,
      normalizedEventCount,
    },
  }, null, 2));
  console.log('\n✅ Class Valuation live-fire endpoint passed.');
}

main().catch((error) => {
  console.error(`\n❌ Class Valuation live-fire endpoint failed: ${(error as Error).message}`);
  process.exit(1);
});
