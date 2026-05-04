/**
 * Vendor Notification Bridge (V-01 / V-03)
 *
 * Bridges the direct-HTTP vendor assignment/broadcast/acceptance paths in
 * `auto-assignment.controller.ts` to the event-driven notification pipeline
 * owned by `CommunicationEventHandler`.
 *
 * The handler already sends ACS email for:
 *   vendor.bid.sent             → vendor
 *   vendor.bid.accepted         → coordinator
 *   vendor.assignment.exhausted → escalation recipients
 *
 * By publishing those events from the controller, direct HTTP callers and the
 * event-driven orchestrator share a single notification pipeline, and audit
 * plus dashboard state stay consistent.
 *
 * This module intentionally owns zero email logic — it publishes events.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { EventPublisher } from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export interface VendorContactContext {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  orderNumber: string;
  clientId: string;
  tenantId: string;
}

const logger = new Logger('VendorNotificationBridge');

export async function loadVendorAndOrderContext(
  dbService: CosmosDbService,
  vendorId: string,
  orderId: string,
): Promise<VendorContactContext | null> {
  try {
    const orderResp = (await dbService.queryItems(
      'orders',
      'SELECT TOP 1 c.id, c.orderNumber, c.tenantId, c.clientId FROM c WHERE c.id = @id',
      [{ name: '@id', value: orderId }],
    )) as any;
    const order = (orderResp?.data ?? orderResp?.resources ?? [])[0];
    if (!order) {
      logger.warn('order not found — skipping event publish', { orderId, vendorId });
      return null;
    }
    const tenantId = order.tenantId;

    const vendorResp = (await dbService.getItem('vendors', vendorId, tenantId)) as any;
    const vendor = vendorResp?.data ?? vendorResp;
    if (!vendor) {
      logger.warn('vendor not found — skipping event publish', { orderId, vendorId, tenantId });
      return null;
    }

    const composedName =
      vendor.name ??
      vendor.displayName ??
      (`${vendor.firstName ?? ''} ${vendor.lastName ?? ''}`.trim() || vendorId);

    return {
      vendorId,
      vendorName: composedName,
      vendorEmail: vendor.email ?? vendor.contactEmail,
      orderNumber: order.orderNumber ?? orderId,
      clientId: order.clientId ?? 'unknown',
      tenantId,
    };
  } catch (err) {
    logger.warn('failed to load vendor/order context', {
      orderId,
      vendorId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function publishVendorBidSent(
  publisher: EventPublisher,
  ctx: VendorContactContext,
  orderId: string,
  expirationHours: number,
  source: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
  await publisher.publish({
    id: uuidv4(),
    type: 'vendor.bid.sent',
    category: EventCategory.VENDOR,
    source,
    timestamp: new Date(),
    data: {
      orderId,
      orderNumber: ctx.orderNumber,
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      vendorId: ctx.vendorId,
      vendorName: ctx.vendorName,
      bidId: `bid-${orderId}-${ctx.vendorId}`,
      expiresAt,
      attemptNumber: 1,
      priority: EventPriority.NORMAL,
    },
  } as any);
}

export async function publishVendorBidAccepted(
  publisher: EventPublisher,
  ctx: VendorContactContext,
  orderId: string,
  source: string,
): Promise<void> {
  await publisher.publish({
    id: uuidv4(),
    type: 'vendor.bid.accepted',
    category: EventCategory.VENDOR,
    source,
    timestamp: new Date(),
    data: {
      orderId,
      orderNumber: ctx.orderNumber,
      tenantId: ctx.tenantId,
      clientId: ctx.clientId,
      vendorId: ctx.vendorId,
      vendorName: ctx.vendorName,
      bidId: `bid-${orderId}-${ctx.vendorId}`,
      acceptedAt: new Date(),
      priority: EventPriority.NORMAL,
    },
  } as any);
}
