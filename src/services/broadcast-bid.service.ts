/**
 * Broadcast Bid Service
 *
 * Implements broadcast (auction) bidding mode where `broadcastCount` vendors
 * are contacted simultaneously.  The first vendor to accept wins; all others
 * have their pending bids cancelled.
 *
 * When all bids in a round expire without acceptance, the orchestrator
 * receives a VendorBidRoundExhaustedEvent and may start a new round with
 * the next N candidates (or escalate to human intervention).
 *
 * Used by: AutoAssignmentOrchestratorService when bidMode='broadcast'.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import type {
  VendorBidSentEvent,
  VendorBidRoundStartedEvent,
  VendorBidRoundExhaustedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export interface RankedVendor {
  vendorId: string;
  vendorName: string;
  score: number;
  staffType?: string;
}

export interface BroadcastRoundResult {
  roundNumber: number;
  bidIds: string[];
  vendorIds: string[];
  expiresAt: Date;
}

export class BroadcastBidService {
  private readonly logger = new Logger('BroadcastBidService');
  private readonly publisher: ServiceBusEventPublisher;

  constructor(private readonly dbService: CosmosDbService) {
    this.publisher = new ServiceBusEventPublisher();
  }

  /**
   * Start a broadcast round — contact `broadcastCount` vendors simultaneously.
   * Returns metadata about the round so the orchestrator can persist it.
   */
  async startRound(
    order: Record<string, unknown>,
    vendors: RankedVendor[],
    roundNumber: number,
    broadcastCount: number,
    bidExpiryHours: number,
    tenantId: string,
    priority: EventPriority,
  ): Promise<BroadcastRoundResult> {
    const orderId = order['id'] as string;
    const orderNumber = (order['orderNumber'] as string | undefined) ?? orderId;
    const expiresAt = new Date(Date.now() + bidExpiryHours * 60 * 60 * 1000);

    // Slice the candidates for this round (skip internal staff — they go direct-assign)
    const candidates = vendors
      .filter((v) => v.staffType !== 'internal')
      .slice(0, broadcastCount);

    if (candidates.length === 0) {
      throw new Error(`No external vendor candidates available for broadcast round ${roundNumber}`);
    }

    const bidIds: string[] = [];
    const vendorIds: string[] = [];

    for (const vendor of candidates) {
      const bidId = `bid-${orderId}-${vendor.vendorId}-${Date.now()}`;
      const bidInvitation = {
        id: bidId,
        orderId,
        orderNumber,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        tenantId,
        propertyAddress: order['propertyAddress'] ?? order['propertyDetails'],
        propertyType: order['productType'] ?? order['orderType'],
        dueDate: order['dueDate'],
        urgency: order['priority'],
        status: 'PENDING',
        invitedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        attemptNumber: roundNumber,
        broadcastRound: roundNumber,
        entityType: 'vendor-bid-invitation',
        isAutoAssignment: true,
        isBroadcast: true,
      };

      await this.dbService.createItem('vendor-bids', bidInvitation);
      bidIds.push(bidId);
      vendorIds.push(vendor.vendorId);

      // Publish individual bid.sent event so email/notification flows are triggered
      const bidSentEvent: VendorBidSentEvent = {
        id: uuidv4(),
        type: 'vendor.bid.sent',
        timestamp: new Date(),
        source: 'broadcast-bid-service',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: {
          orderId,
          orderNumber,
          tenantId,
          clientId: (order['clientId'] as string | undefined) ?? '',
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          bidId,
          expiresAt,
          attemptNumber: roundNumber,
          priority,
        },
      };
      await this.publisher.publish(bidSentEvent).catch((err) =>
        this.logger.warn('Failed to publish vendor.bid.sent for broadcast', {
          orderId,
          vendorId: vendor.vendorId,
          error: (err as Error).message,
        }),
      );
    }

    // Publish round started event
    const roundStartedEvent: VendorBidRoundStartedEvent = {
      id: uuidv4(),
      type: 'vendor.bid.round.started',
      timestamp: new Date(),
      source: 'broadcast-bid-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId,
        orderNumber,
        tenantId,
        clientId: (order['clientId'] as string | undefined) ?? '',
        roundNumber,
        vendorIds,
        expiresAt,
        priority,
      },
    };
    await this.publisher.publish(roundStartedEvent).catch((err) =>
      this.logger.warn('Failed to publish vendor.bid.round.started', {
        orderId,
        error: (err as Error).message,
      }),
    );

    this.logger.info('Broadcast bid round started', {
      orderId,
      roundNumber,
      vendorCount: candidates.length,
      expiresAt,
    });

    return { roundNumber, bidIds, vendorIds, expiresAt };
  }

  /**
   * Cancel all PENDING bid invitations for an order except the accepted one.
   * Called immediately when a vendor accepts in broadcast mode.
   */
  async cancelPendingBids(orderId: string, tenantId: string, exceptBidId: string): Promise<number> {
    const container = this.dbService.getContainer('vendor-bids');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tid AND c.status = 'PENDING' AND c.id != @exceptId`,
      parameters: [
        { name: '@orderId', value: orderId },
        { name: '@tid', value: tenantId },
        { name: '@exceptId', value: exceptBidId },
      ],
    }).fetchAll();

    let cancelledCount = 0;
    for (const bid of resources as Array<{ id: string; tenantId: string; [key: string]: unknown }>) {
      await container.items.upsert({ ...bid, status: 'CANCELLED', cancelledAt: new Date().toISOString() });
      cancelledCount++;
    }

    if (cancelledCount > 0) {
      this.logger.info('Cancelled competing broadcast bids', { orderId, cancelledCount, exceptBidId });
    }
    return cancelledCount;
  }

  /**
   * Check whether all bids in the current broadcast round have expired/declined
   * without acceptance.  Returns true if the round is exhausted.
   */
  async isRoundExhausted(orderId: string, tenantId: string, roundNumber: number): Promise<boolean> {
    const container = this.dbService.getContainer('vendor-bids');
    const { resources } = await container.items.query({
      query: `SELECT c.status FROM c WHERE c.orderId = @orderId AND c.tenantId = @tid AND c.broadcastRound = @round`,
      parameters: [
        { name: '@orderId', value: orderId },
        { name: '@tid', value: tenantId },
        { name: '@round', value: roundNumber },
      ],
    }).fetchAll();

    if (resources.length === 0) return false;

    // Round is exhausted when no bids remain in PENDING or ACCEPTED status
    const anyActiveOrAccepted = (resources as Array<{ status: string }>).some(
      (b) => b.status === 'PENDING' || b.status === 'ACCEPTED',
    );
    return !anyActiveOrAccepted;
  }

  /**
   * Publish a round exhausted event — called by the orchestrator after isRoundExhausted.
   */
  async publishRoundExhausted(
    orderId: string,
    orderNumber: string,
    tenantId: string,
    clientId: string,
    roundNumber: number,
    vendorIds: string[],
    priority: EventPriority,
  ): Promise<void> {
    const event: VendorBidRoundExhaustedEvent = {
      id: uuidv4(),
      type: 'vendor.bid.round.exhausted',
      timestamp: new Date(),
      source: 'broadcast-bid-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: { orderId, orderNumber, tenantId, clientId, roundNumber, vendorIds, priority },
    };
    await this.publisher.publish(event);
    this.logger.info('Broadcast bid round exhausted', { orderId, roundNumber });
  }
}
