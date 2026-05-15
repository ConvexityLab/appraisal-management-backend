import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'http';
import type {
  AdapterInboundResult,
  OutboundCall,
  VendorConnection,
  VendorDomainEvent,
  VendorFile,
} from '../../types/vendor-integration.types.js';
import type { InboundAdapterContext, OutboundAdapterContext, VendorAdapter } from './VendorAdapter.js';

interface ClassValuationFilePayload {
  id: string;
  filename: string;
  category: string;
  content: string;
  description?: string;
}

interface ClassValuationInboundBody {
  accountId?: string;
  event?: string;
  occurredAt?: string;
  data?: {
    externalOrderId?: string;
    orderId?: string;
    message?: {
      subject?: string;
      content?: string;
    };
    files?: ClassValuationFilePayload[];
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getHeader(headers: IncomingHttpHeaders, headerName: string): string | undefined {
  const value = headers[headerName.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function computeSignature(secret: string, rawBody: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, receivedBytes);
}

function toVendorFiles(files: ClassValuationFilePayload[] | undefined): VendorFile[] {
  return (files ?? []).map((file) => ({
    fileId: file.id,
    filename: file.filename,
    category: file.category,
    ...(file.description ? { description: file.description } : {}),
    content: file.content,
  }));
}

export class ClassValuationWebhookAdapter implements VendorAdapter {
  readonly vendorType = 'class-valuation' as const;
  readonly inboundTransport = 'webhook' as const;
  readonly outboundTransport = 'webhook' as const;

  canHandleInbound(body: unknown, headers: IncomingHttpHeaders): boolean {
    const payload = asRecord(body) as ClassValuationInboundBody | null;
    return Boolean(
      getHeader(headers, 'x-class-valuation-account-id') &&
      stringValue(payload?.event) &&
      stringValue(payload?.data?.externalOrderId),
    );
  }

  identifyInboundConnection(body: unknown, headers: IncomingHttpHeaders): string | null {
    const headerAccountId = getHeader(headers, 'x-class-valuation-account-id');
    if (headerAccountId?.trim()) return headerAccountId.trim();

    const payload = asRecord(body) as ClassValuationInboundBody | null;
    return stringValue(payload?.accountId) ?? null;
  }

  async authenticateInbound(
    _body: unknown,
    headers: IncomingHttpHeaders,
    connection: VendorConnection,
    context: InboundAdapterContext,
  ): Promise<void> {
    const signature = getHeader(headers, 'x-class-valuation-signature');
    if (!signature) {
      throw new Error('ClassValuation signature header x-class-valuation-signature is required');
    }

    if (!context.rawBody) {
      throw new Error('Raw request body is required for ClassValuation signature verification');
    }

    const secretName = connection.credentials.inboundHmacSecretName;
    if (!secretName) {
      throw new Error(
        `Vendor connection ${connection.id} is missing credentials.inboundHmacSecretName for ClassValuation`,
      );
    }

    const secret = await context.resolveSecret(secretName);
    const expected = computeSignature(secret, context.rawBody);
    if (!signaturesMatch(expected, signature)) {
      throw new Error(`ClassValuation HMAC authentication failed for accountId=${connection.inboundIdentifier}`);
    }
  }

  async handleInbound(
    body: unknown,
    _headers: IncomingHttpHeaders,
    connection: VendorConnection,
    _context: InboundAdapterContext,
  ): Promise<AdapterInboundResult> {
    const payload = asRecord(body) as ClassValuationInboundBody | null;
    const eventName = stringValue(payload?.event);
    const externalOrderId = stringValue(payload?.data?.externalOrderId);

    if (!eventName || !externalOrderId) {
      throw new Error('ClassValuation webhook payload requires event and data.externalOrderId');
    }

    const baseEvent = {
      id: crypto.randomUUID(),
      vendorType: this.vendorType,
      vendorOrderId: externalOrderId,
      ourOrderId: stringValue(payload?.data?.orderId) ?? null,
      lenderId: connection.lenderId,
      tenantId: connection.tenantId,
      occurredAt: stringValue(payload?.occurredAt) ?? new Date().toISOString(),
      origin: 'inbound' as const,
    };

    switch (eventName) {
      case 'order.completed':
        return {
          domainEvents: [{
            ...baseEvent,
            eventType: 'vendor.order.completed',
            payload: { files: toVendorFiles(payload?.data?.files) },
          }],
          ack: { statusCode: 202, body: { received: true } },
        };
      case 'message.created': {
        const message = payload?.data?.message;
        return {
          domainEvents: [{
            ...baseEvent,
            eventType: 'vendor.message.received',
            payload: {
              subject: stringValue(message?.subject) ?? '',
              content: stringValue(message?.content) ?? '',
            },
          }],
          ack: { statusCode: 202, body: { received: true } },
        };
      }
      default:
        throw new Error(`Unsupported ClassValuation webhook event ${eventName}`);
    }
  }

  async buildOutboundCall(
    event: VendorDomainEvent,
    connection: VendorConnection,
    context: OutboundAdapterContext,
  ): Promise<OutboundCall | null> {
    let payload: Record<string, unknown> | null = null;

    if (event.eventType === 'vendor.order.completed') {
      payload = {
        accountId: connection.inboundIdentifier,
        event: 'order.completed',
        occurredAt: event.occurredAt,
        data: {
          externalOrderId: event.vendorOrderId,
          orderId: event.ourOrderId,
          files: 'files' in event.payload
            ? event.payload.files.map((file) => ({
                id: file.fileId,
                filename: file.filename,
                category: file.category,
                description: file.description,
                content: file.content,
              }))
            : [],
        },
      };
    } else if (event.eventType === 'vendor.message.received') {
      payload = {
        accountId: connection.inboundIdentifier,
        event: 'message.created',
        occurredAt: event.occurredAt,
        data: {
          externalOrderId: event.vendorOrderId,
          orderId: event.ourOrderId,
          message: {
            subject: 'subject' in event.payload ? event.payload.subject : '',
            content: 'content' in event.payload ? event.payload.content : '',
          },
        },
      };
    } else if (event.eventType === 'vendor.order.assigned') {
      payload = {
        accountId: connection.inboundIdentifier,
        event: 'order.assigned',
        occurredAt: event.occurredAt,
        data: {
          externalOrderId: event.vendorOrderId,
          orderId: event.ourOrderId,
        },
      };
    }

    if (!payload) {
      return null;
    }

    const secretName = connection.credentials.outboundHmacSecretName;
    if (!secretName) {
      throw new Error(
        `Vendor connection ${connection.id} is missing credentials.outboundHmacSecretName for ClassValuation`,
      );
    }

    const secret = await context.resolveSecret(secretName);
    const rawBody = JSON.stringify(payload);
    const signature = computeSignature(secret, Buffer.from(rawBody));

    return {
      url: connection.outboundEndpointUrl,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-class-valuation-account-id': connection.inboundIdentifier,
        'x-class-valuation-signature': signature,
      },
      body: payload,
      rawBody,
      eventType: event.eventType,
      vendorOrderId: event.vendorOrderId,
    };
  }
}
