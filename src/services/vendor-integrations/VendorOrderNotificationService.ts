import { v4 as uuidv4 } from 'uuid';
import type { CosmosDbService } from '../cosmos-db.service.js';
import { VendorOutboundOutboxService } from './VendorOutboundOutboxService.js';
import type { VendorDomainEvent, VendorFile, VendorType } from '../../types/vendor-integration.types.js';
import { VENDOR_ORDERS_CONTAINER } from '../../types/vendor-order.types.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('VendorOrderNotificationService');

interface VendorContext {
  connectionId: string;
  vendorOrderId: string;
  vendorType: VendorType;
  lenderId: string;
}

/**
 * Bridges lender-initiated order lifecycle actions (cancel, hold, resume,
 * message-to-vendor) to the durable outbound outbox so AIM-Port (and other
 * adapters) are notified via their outbound call channel.
 *
 * Every public method is a silent no-op when the order has no vendor
 * integration context — i.e. it was created manually and was never linked to
 * an external vendor system.
 *
 * Callers are expected to fire-and-forget via `.catch(logger.error)` so
 * a notification failure never blocks the primary order lifecycle action.
 */
export class VendorOrderNotificationService {
  private readonly db: Pick<CosmosDbService, 'queryItems'>;
  private readonly outbox: VendorOutboundOutboxService;

  constructor(
    db: Pick<CosmosDbService, 'queryItems'>,
    outbox: VendorOutboundOutboxService,
  ) {
    this.db = db;
    this.outbox = outbox;
  }

  // ─── Public notification methods ─────────────────────────────────────────────
  //
  // All methods return `true` when the event was successfully enqueued, `false`
  // when the order has no vendor integration context (no-op, not an error).
  // Callers that require a confirmation (e.g. API endpoint for explicit messaging)
  // must check the return value and respond accordingly.

  async notifyCancel(ourOrderId: string, tenantId: string, message?: string): Promise<boolean> {
    const ctx = await this.resolveVendorContext(ourOrderId, tenantId);
    if (!ctx) return false;

    await this.outbox.dispatch(
      this.buildEvent('vendor.order.cancelled', ctx, ourOrderId, tenantId, message ? { message } : {}),
      ctx.connectionId,
    );
    return true;
  }

  async notifyHold(ourOrderId: string, tenantId: string, message?: string): Promise<boolean> {
    const ctx = await this.resolveVendorContext(ourOrderId, tenantId);
    if (!ctx) return false;

    await this.outbox.dispatch(
      this.buildEvent('vendor.order.held', ctx, ourOrderId, tenantId, message ? { message } : {}),
      ctx.connectionId,
    );
    return true;
  }

  async notifyResume(ourOrderId: string, tenantId: string, message?: string): Promise<boolean> {
    const ctx = await this.resolveVendorContext(ourOrderId, tenantId);
    if (!ctx) return false;

    await this.outbox.dispatch(
      this.buildEvent('vendor.order.resumed', ctx, ourOrderId, tenantId, message ? { message } : {}),
      ctx.connectionId,
    );
    return true;
  }

  /**
   * Returns `true` when the message was enqueued for delivery, `false` when
   * the order has no vendor integration context.
   *
   * Unlike cancel/hold/resume (which are lifecycle operations that succeed
   * regardless of vendor integration state), a caller explicitly asking to
   * "send a message to the vendor" should know if there was no vendor to
   * receive it — use the return value to respond with 422 when appropriate.
   */
  async notifyMessage(ourOrderId: string, tenantId: string, subject: string, content: string): Promise<boolean> {
    const ctx = await this.resolveVendorContext(ourOrderId, tenantId);
    if (!ctx) return false;

    await this.outbox.dispatch(
      this.buildEvent('vendor.message.received', ctx, ourOrderId, tenantId, { subject, content }),
      ctx.connectionId,
    );
    return true;
  }

  /**
   * Notify the vendor system that completed output files are ready.
   * Use `withCompletion=true` (default) for `vendor.order.completed` (OrderFilesRequest).
   * Use `withCompletion=false` for `vendor.file.received_no_completion` (DocsNoCompletionRequest).
   *
   * Returns `true` when enqueued, `false` when no vendor integration context.
   * Callers are responsible for supplying the actual VendorFile objects (with base64
   * content or file references). This method should be called from whichever endpoint
   * receives and persists the completed appraiser documents.
   */
  async notifyFileDelivery(
    ourOrderId: string,
    tenantId: string,
    files: VendorFile[],
    withCompletion = true,
  ): Promise<boolean> {
    const ctx = await this.resolveVendorContext(ourOrderId, tenantId);
    if (!ctx) return false;

    const eventType = withCompletion ? 'vendor.order.completed' : 'vendor.file.received_no_completion';
    await this.outbox.dispatch(
      this.buildEvent(eventType, ctx, ourOrderId, tenantId, { files }),
      ctx.connectionId,
    );
    return true;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async resolveVendorContext(ourOrderId: string, tenantId: string): Promise<VendorContext | null> {
    const result = await this.db.queryItems<{
      metadata?: {
        vendorIntegration?: {
          connectionId?: string;
          vendorOrderId?: string;
          vendorType?: string;
          lenderId?: string;
        };
      };
    }>(
      VENDOR_ORDERS_CONTAINER,
      'SELECT c.metadata FROM c WHERE c.id = @ourOrderId AND c.tenantId = @tenantId',
      [
        { name: '@ourOrderId', value: ourOrderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      logger.debug('Vendor context lookup: order not found', { ourOrderId, tenantId });
      return null;
    }

    const vi = result.data[0]?.metadata?.vendorIntegration;
    if (!vi?.connectionId || !vi.vendorOrderId || !vi.vendorType) {
      logger.debug('Order has no vendor integration context — skipping outbound notification', {
        ourOrderId,
      });
      return null;
    }

    if (!vi.lenderId) {
      logger.warn('Order vendor integration metadata is missing lenderId — outbox document will use empty string', {
        ourOrderId,
      });
    }

    return {
      connectionId: vi.connectionId,
      vendorOrderId: vi.vendorOrderId,
      vendorType: vi.vendorType as VendorType,
      lenderId: vi.lenderId ?? '',
    };
  }

  private buildEvent(
    eventType: VendorDomainEvent['eventType'],
    ctx: VendorContext,
    ourOrderId: string,
    tenantId: string,
    payload: VendorDomainEvent['payload'],
  ): VendorDomainEvent {
    return {
      id: uuidv4(),
      eventType,
      vendorType: ctx.vendorType,
      vendorOrderId: ctx.vendorOrderId,
      ourOrderId,
      lenderId: ctx.lenderId,
      tenantId,
      occurredAt: new Date().toISOString(),
      payload,
    };
  }
}
