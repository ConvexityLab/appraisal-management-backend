import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { VendorDomainEvent, VendorOutboxDocument } from '../../types/vendor-integration.types.js';

const VENDOR_EVENT_OUTBOX_CONTAINER = 'vendor-event-outbox';

/**
 * Durable outbound outbox: enqueues a VendorDomainEvent as a PENDING
 * outbound document in the vendor-event-outbox Cosmos container.
 *
 * Implements the OutboundVendorDispatcher interface structurally so it can be
 * swapped in wherever VendorOutboundDispatcher was used.  The actual HTTP
 * delivery is performed by VendorOutboundWorkerService polling the container.
 */
export class VendorOutboundOutboxService {
  private readonly logger = new Logger('VendorOutboundOutboxService');
  private readonly db: Pick<CosmosDbService, 'upsertItem'>;

  constructor(db?: Pick<CosmosDbService, 'upsertItem'>) {
    this.db = db ?? new CosmosDbService();
  }

  /**
   * Persists the event to the durable outbox.  Throws if the Cosmos write
   * fails — the caller's `.catch()` will surface this as a warning without
   * losing the event completely (the caller's retry loop handles retries).
   *
   * The document id is deterministic (`vendor-outbound:<event.id>`) so
   * duplicate calls for the same event are idempotent via upsert.
   */
  async dispatch(event: VendorDomainEvent, connectionId: string): Promise<void> {
    const now = new Date().toISOString();

    const document: VendorOutboxDocument = {
      id: `vendor-outbound:${event.id}`,
      tenantId: event.tenantId,
      type: 'vendor-event-outbox',
      direction: 'outbound',
      status: 'PENDING',
      vendorType: event.vendorType,
      connectionId,
      lenderId: event.lenderId,
      vendorOrderId: event.vendorOrderId,
      ourOrderId: event.ourOrderId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      receivedAt: now,
      availableAt: now,
      attemptCount: 0,
      payload: event.payload,
      // Stored so VendorOutboundWorkerService can replay the exact call without
      // reconstituting the VendorDomainEvent from the flat fields.
      outboundEvent: event,
      metadata: { transport: 'sync-post' },
    };

    const result = await this.db.upsertItem<VendorOutboxDocument>(VENDOR_EVENT_OUTBOX_CONTAINER, document);

    if (!result.success || !result.data) {
      throw new Error(
        `Failed to enqueue outbound vendor event ${event.id}: ${result.error?.message ?? 'unknown error'}`,
      );
    }

    this.logger.info('Outbound vendor event enqueued to durable outbox', {
      outboxId: result.data.id,
      eventType: event.eventType,
      vendorType: event.vendorType,
      vendorOrderId: event.vendorOrderId,
      connectionId,
    });
  }
}
