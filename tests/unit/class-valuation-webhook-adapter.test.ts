import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ClassValuationWebhookAdapter } from '../../src/services/vendor-integrations/ClassValuationWebhookAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

const connection: VendorConnection = {
  id: 'vc-class-1',
  tenantId: 'tenant-1',
  vendorType: 'class-valuation',
  lenderId: 'lender-1',
  lenderName: 'Sample Lender',
  inboundIdentifier: 'acct-42',
  credentials: {
    inboundHmacSecretName: 'class-valuation-inbound-hmac',
    outboundHmacSecretName: 'class-valuation-outbound-hmac',
  },
  outboundEndpointUrl: 'https://class-valuation.example.com/webhooks/orders',
  active: true,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
};

describe('ClassValuationWebhookAdapter', () => {
  it('verifies inbound HMAC and normalizes completed order webhooks', async () => {
    const adapter = new ClassValuationWebhookAdapter();
    const body = {
      accountId: 'acct-42',
      event: 'order.completed',
      occurredAt: '2026-04-23T00:00:00.000Z',
      data: {
        externalOrderId: 'CV-1001',
        orderId: 'order-123',
        files: [
          {
            id: 'file-1',
            filename: 'report.pdf',
            category: 'appraisal',
            content: 'YmFzZTY0',
          },
        ],
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', 'inbound-secret').update(rawBody).digest('hex')}`;

    await expect(adapter.authenticateInbound(body, {
      'x-class-valuation-account-id': 'acct-42',
      'x-class-valuation-signature': signature,
    }, connection, {
      rawBody,
      resolveSecret: async () => 'inbound-secret',
    })).resolves.toBeUndefined();

    const result = await adapter.handleInbound(body, {
      'x-class-valuation-account-id': 'acct-42',
    }, connection, {
      rawBody,
      resolveSecret: async () => 'inbound-secret',
    });

    expect(result.ack.statusCode).toBe(202);
    expect(result.domainEvents).toHaveLength(1);
    expect(result.domainEvents[0]).toMatchObject({
      eventType: 'vendor.order.completed',
      vendorOrderId: 'CV-1001',
      ourOrderId: 'order-123',
    });
  });

  it('builds outbound webhook payloads with an HMAC signature header', async () => {
    const adapter = new ClassValuationWebhookAdapter();
    const call = await adapter.buildOutboundCall({
      id: 'evt-1',
      eventType: 'vendor.message.received',
      vendorType: 'class-valuation',
      vendorOrderId: 'CV-1001',
      ourOrderId: 'order-123',
      lenderId: 'lender-1',
      tenantId: 'tenant-1',
      occurredAt: '2026-04-23T00:00:00.000Z',
      payload: {
        subject: 'Need updated docs',
        content: 'Please upload the revised report.',
      },
    }, connection, {
      resolveSecret: async () => 'outbound-secret',
    });

    expect(call).not.toBeNull();
    expect(call?.rawBody).toBeDefined();
    expect(call?.headers['x-class-valuation-signature']).toBe(
      `sha256=${createHmac('sha256', 'outbound-secret').update(call?.rawBody ?? '').digest('hex')}`,
    );
    expect(call?.body).toMatchObject({
      accountId: 'acct-42',
      event: 'message.created',
    });
  });
});
