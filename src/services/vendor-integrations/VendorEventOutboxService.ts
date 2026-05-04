import { createHash } from 'node:crypto';
import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type {
  VendorConnection,
  VendorDomainEvent,
  VendorEventReceiptDocument,
  VendorOutboxDocument,
} from '../../types/vendor-integration.types.js';
import type { VendorAdapter } from './VendorAdapter.js';

const VENDOR_EVENT_OUTBOX_CONTAINER = 'vendor-event-outbox';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildPayloadHash(event: VendorDomainEvent): string {
  return createHash('sha256')
    .update(stableStringify({
      eventType: event.eventType,
      vendorOrderId: event.vendorOrderId,
      ourOrderId: event.ourOrderId,
      occurredAt: event.occurredAt,
      payload: event.payload,
    }))
    .digest('hex');
}

export class VendorEventOutboxService {
  private readonly logger = new Logger('VendorEventOutboxService');
  private readonly db: Pick<CosmosDbService, 'createItem' | 'queryItems' | 'upsertItem'>;

  constructor(db?: Pick<CosmosDbService, 'createItem' | 'queryItems' | 'upsertItem'>) {
    this.db = db ?? new CosmosDbService();
  }

  async persistInboundEvents(
    connection: VendorConnection,
    adapter: VendorAdapter,
    events: VendorDomainEvent[],
  ): Promise<VendorOutboxDocument[]> {
    const receivedAt = new Date().toISOString();
    const persisted: VendorOutboxDocument[] = [];
    const skippedReplayKeys: string[] = [];

    for (const event of events) {
      const payloadHash = buildPayloadHash(event);
      const replayKey = `${connection.id}:${event.eventType}:${event.vendorOrderId}:${payloadHash}`;
      const receiptRegistered = await this.registerInboundReceipt(
        connection,
        event,
        replayKey,
        payloadHash,
        receivedAt,
      );

      if (!receiptRegistered) {
        skippedReplayKeys.push(replayKey);
        continue;
      }

      const document: VendorOutboxDocument = {
        id: `vendor-outbox:${event.id}`,
        tenantId: event.tenantId,
        type: 'vendor-event-outbox',
        direction: 'inbound',
        status: 'PENDING',
        vendorType: event.vendorType,
        connectionId: connection.id,
        lenderId: event.lenderId,
        vendorOrderId: event.vendorOrderId,
        ourOrderId: event.ourOrderId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        receivedAt,
        availableAt: receivedAt,
        attemptCount: 0,
        payload: event.payload,
        metadata: {
          transport: adapter.inboundTransport,
          replayKey,
        },
      };

      const result = await this.db.upsertItem<VendorOutboxDocument>(
        VENDOR_EVENT_OUTBOX_CONTAINER,
        document,
      );

      if (!result.success || !result.data) {
        throw new Error(
          result.error?.message ??
            `Failed to persist vendor outbox event ${event.id} for vendorOrderId=${event.vendorOrderId}`,
        );
      }

      persisted.push(result.data);
    }

    this.logger.info('Persisted inbound vendor events to durable outbox', {
      connectionId: connection.id,
      vendorType: connection.vendorType,
      eventCount: persisted.length,
      outboxIds: persisted.map((item) => item.id),
      skippedReplayCount: skippedReplayKeys.length,
      skippedReplayKeys,
    });

    return persisted;
  }

  private async registerInboundReceipt(
    connection: VendorConnection,
    event: VendorDomainEvent,
    replayKey: string,
    payloadHash: string,
    receivedAt: string,
  ): Promise<boolean> {
    const receiptId = `vendor-receipt:${replayKey}`;
    const receipt: VendorEventReceiptDocument = {
      id: receiptId,
      tenantId: event.tenantId,
      type: 'vendor-event-receipt',
      connectionId: connection.id,
      vendorType: connection.vendorType,
      vendorOrderId: event.vendorOrderId,
      eventType: event.eventType,
      replayKey,
      payloadHash,
      firstSeenAt: receivedAt,
    };

    const createResult = await this.db.createItem<VendorEventReceiptDocument>(
      VENDOR_EVENT_OUTBOX_CONTAINER,
      receipt,
    );

    if (createResult.success) {
      return true;
    }

    const existing = await this.db.queryItems<Pick<VendorEventReceiptDocument, 'id'>>(
      VENDOR_EVENT_OUTBOX_CONTAINER,
      'SELECT TOP 1 c.id FROM c WHERE c.id = @id',
      [{ name: '@id', value: receiptId }],
    );

    if (!existing.success) {
      throw new Error(
        existing.error?.message ??
          `Failed to verify vendor replay receipt ${receiptId} for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    if ((existing.data?.length ?? 0) > 0) {
      this.logger.info('Skipping replayed vendor inbound event', {
        connectionId: connection.id,
        vendorType: connection.vendorType,
        vendorOrderId: event.vendorOrderId,
        eventType: event.eventType,
        replayKey,
      });
      return false;
    }

    throw new Error(
      createResult.error?.message ??
        `Failed to create vendor replay receipt ${receiptId} for vendorOrderId=${event.vendorOrderId}`,
    );
  }
}
