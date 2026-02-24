/**
 * RFB (Request-for-Bid) Service
 *
 * Manages the full lifecycle of broadcast RFB rounds:
 *   DRAFT → BROADCAST → BIDS_RECEIVED → AWARDED | EXPIRED | CANCELLED
 *
 * This service handles persistence and state transitions.
 * Matching logic lives in matching-engine.service.ts (pure functions).
 * All Cosmos writes use the orderId partition key for the rfb-requests container.
 */

import type { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { matchProviders } from './matching-engine.service.js';
import type {
  RfbRequest,
  RfbBid,
  RfbStatus,
  BidStatus,
  MatchResult,
  MatchingCriteriaSet,
  CreateRfbRequest,
  SubmitBidRequest,
  ProviderType,
} from '../types/matching.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

// ─── ID helpers ───────────────────────────────────────────────────────────────

function generateRfbId(): string {
  return `rfb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateBidId(): string {
  return `bid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Minimal provider shape understood by matchProviders ─────────────────────

interface MatchableProvider {
  id: string;
  name: string;
  providerType?: ProviderType;
  serviceAreas?: Array<{
    state?: string;
    counties?: string[];
    zipCodes?: string[];
    maxDistance?: number;
    geoLocation?: { lat: number; lng: number };
  }>;
  [key: string]: unknown;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class RfbService {
  private readonly container: Container;

  constructor(private readonly dbService: CosmosDbService) {
    this.container = dbService.getRfbRequestsContainer();
  }

  // ── Matching preview (no DB write) ──────────────────────────────────────────

  /**
   * Runs the matching engine against the given criteria sets and providers
   * and returns a ranked shortlist — no database write.
   *
   * @param providers        Full provider records from Cosmos (vendors, appraisers, etc.)
   * @param criteriaSets     Criteria set documents fetched from Cosmos by ID
   * @param subjectCoords    Subject-property lat/lng for geo-fence operators
   * @param subjectAddress   Subject-property address fields for fallback matching
   */
  runPreview(
    providers: MatchableProvider[],
    criteriaSets: MatchingCriteriaSet[],
    subjectCoords?: { lat: number; lng: number } | null,
    subjectAddress?: { state?: string; county?: string; zipCode?: string },
  ): MatchResult[] {
    return matchProviders(
      providers as unknown as Record<string, unknown>[],
      criteriaSets,
      subjectCoords ?? null,
      subjectAddress,
      (p) => (p as MatchableProvider).providerType,
    );
  }

  // ── Create draft ─────────────────────────────────────────────────────────────

  /**
   * Runs the matching engine, then persists a DRAFT RFB to Cosmos.
   * The match snapshot is stored for audit; the caller decides when to broadcast.
   */
  async createRfb(params: {
    request: CreateRfbRequest;
    tenantId: string;
    createdBy: string;
    providers: MatchableProvider[];
    criteriaSets: MatchingCriteriaSet[];
    subjectCoords?: { lat: number; lng: number } | null;
    subjectAddress?: { state?: string; county?: string; zipCode?: string };
  }): Promise<RfbRequest> {
    const { request, tenantId, createdBy, providers, criteriaSets, subjectCoords, subjectAddress } = params;

    const matchSnapshot: MatchResult[] = matchProviders(
      providers as unknown as Record<string, unknown>[],
      criteriaSets,
      subjectCoords ?? null,
      subjectAddress,
      (p) => (p as MatchableProvider).providerType,
    );

    const matchedProviderIds = matchSnapshot.map((r) => r.providerId);

    const rfb: RfbRequest = {
      id: generateRfbId(),
      tenantId,
      orderId: request.orderId,
      productId: request.productId,
      criteriaSetIds: request.criteriaSetIds,
      matchedProviderIds,
      matchSnapshot,
      deadlineAt: request.deadlineAt,
      status: 'DRAFT',
      autoAward: request.autoAward ?? false,
      bids: [],
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(rfb);
    if (!resource) {
      throw new Error(`Failed to persist RFB for order ${request.orderId}`);
    }

    logger.info('RFB draft created', { rfbId: rfb.id, orderId: rfb.orderId, matchedCount: matchedProviderIds.length });
    return resource as RfbRequest;
  }

  // ── Get single RFB by ID ──────────────────────────────────────────────────

  /**
   * Fetches one RFB document. Partition key is orderId.
   */
  async getById(rfbId: string, orderId: string): Promise<RfbRequest | null> {
    const { resource } = await this.container.item(rfbId, orderId).read<RfbRequest>();
    return resource ?? null;
  }

  // ── Get active RFB for an order ───────────────────────────────────────────

  /**
   * Returns the most recently updated non-CANCELLED / non-EXPIRED RFB for an order.
   * Returns null when none exists.
   */
  async getActiveForOrder(orderId: string): Promise<RfbRequest | null> {
    const { resources } = await this.container.items
      .query<RfbRequest>({
        query: `SELECT * FROM c
                WHERE c.orderId = @orderId
                  AND c.status NOT IN ('CANCELLED', 'EXPIRED')
                ORDER BY c.updatedAt DESC
                OFFSET 0 LIMIT 1`,
        parameters: [{ name: '@orderId', value: orderId }],
      })
      .fetchAll();
    return resources[0] ?? null;
  }

  // ── List all RFBs for an order ─────────────────────────────────────────────

  async listForOrder(orderId: string): Promise<RfbRequest[]> {
    const { resources } = await this.container.items
      .query<RfbRequest>({
        query: 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@orderId', value: orderId }],
      })
      .fetchAll();
    return resources;
  }

  // ── List RFBs for a tenant ─────────────────────────────────────────────────

  async listForTenant(
    tenantId: string,
    filters?: { status?: RfbStatus; orderId?: string },
  ): Promise<RfbRequest[]> {
    let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId';
    const parameters: import('@azure/cosmos').SqlParameter[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters?.status) {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: filters.status });
    }
    if (filters?.orderId) {
      query += ' AND c.orderId = @orderId';
      parameters.push({ name: '@orderId', value: filters.orderId });
    }

    query += ' ORDER BY c.createdAt DESC';

    const { resources } = await this.container.items
      .query<RfbRequest>({ query, parameters })
      .fetchAll();
    return resources;
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────

  /**
   * Transitions a DRAFT RFB to BROADCAST status.
   * Persists broadcastAt timestamp and updated status.
   */
  async broadcastRfb(rfbId: string, orderId: string, tenantId: string): Promise<RfbRequest> {
    const rfb = await this.getById(rfbId, orderId);
    if (!rfb) {
      throw new Error(`RFB ${rfbId} not found for order ${orderId}`);
    }
    if (rfb.tenantId !== tenantId) {
      throw new Error(`RFB ${rfbId} does not belong to tenant ${tenantId}`);
    }
    if (rfb.status !== 'DRAFT') {
      throw new Error(`RFB ${rfbId} is in status '${rfb.status}' — only DRAFT RFBs can be broadcast`);
    }

    const updated: RfbRequest = {
      ...rfb,
      status: 'BROADCAST',
      broadcastAt: now(),
      updatedAt: now(),
    };

    const { resource } = await this.container.item(rfbId, orderId).replace(updated);
    if (!resource) {
      throw new Error(`Failed to broadcast RFB ${rfbId}`);
    }

    logger.info('RFB broadcast', { rfbId, orderId, matchedProviders: rfb.matchedProviderIds.length });
    return resource as RfbRequest;
  }

  // ── Submit bid ────────────────────────────────────────────────────────────

  /**
   * Appends a new PENDING bid to the RFB.
   * When autoAward is true and the submitted bid status is 'ACCEPTED', immediately awards.
   *
   * NOTE: Bid status defaults to PENDING on submission. The 'ACCEPTED' autoAward
   *       path is for cases where the provider proactively accepts within the bid body.
   */
  async submitBid(
    rfbId: string,
    orderId: string,
    bid: SubmitBidRequest,
    tenantId: string,
  ): Promise<RfbRequest> {
    const rfb = await this.getById(rfbId, orderId);
    if (!rfb) {
      throw new Error(`RFB ${rfbId} not found for order ${orderId}`);
    }
    if (rfb.tenantId !== tenantId) {
      throw new Error(`RFB ${rfbId} does not belong to tenant ${tenantId}`);
    }
    if (rfb.status !== 'BROADCAST') {
      throw new Error(`RFB ${rfbId} is in status '${rfb.status}' — bids can only be submitted to BROADCAST RFBs`);
    }

    const newBid: RfbBid = {
      id: generateBidId(),
      providerId: bid.providerId,
      providerName: bid.providerName,
      providerType: bid.providerType,
      proposedFee: bid.proposedFee,
      proposedTurnaroundDays: bid.proposedTurnaroundDays,
      ...(bid.notes !== undefined && { notes: bid.notes }),
      status: 'PENDING',
      respondedAt: now(),
    };

    const updatedBids = [...rfb.bids, newBid];
    const updatedRfb: RfbRequest = {
      ...rfb,
      bids: updatedBids,
      status: 'BIDS_RECEIVED',
      updatedAt: now(),
    };

    const { resource } = await this.container.item(rfbId, orderId).replace(updatedRfb);
    if (!resource) {
      throw new Error(`Failed to persist bid for RFB ${rfbId}`);
    }

    logger.info('Bid submitted', { rfbId, bidId: newBid.id, providerId: bid.providerId });

    // Auto-award: if the product set autoAward=true, award the first bid received
    if (rfb.autoAward) {
      return this.awardBid(rfbId, orderId, newBid.id, tenantId);
    }

    return resource as RfbRequest;
  }

  // ── Award bid ─────────────────────────────────────────────────────────────

  /**
   * Awards the specified bid:
   *   - winning bid → ACCEPTED
   *   - all other PENDING bids → EXPIRED
   *   - RFB status → AWARDED
   *   - awardedBidId set
   */
  async awardBid(rfbId: string, orderId: string, bidId: string, tenantId: string): Promise<RfbRequest> {
    const rfb = await this.getById(rfbId, orderId);
    if (!rfb) {
      throw new Error(`RFB ${rfbId} not found for order ${orderId}`);
    }
    if (rfb.tenantId !== tenantId) {
      throw new Error(`RFB ${rfbId} does not belong to tenant ${tenantId}`);
    }
    if (!['BIDS_RECEIVED', 'BROADCAST'].includes(rfb.status)) {
      throw new Error(
        `RFB ${rfbId} is in status '${rfb.status}' — can only award from BIDS_RECEIVED or BROADCAST`,
      );
    }

    const bid = rfb.bids.find((b) => b.id === bidId);
    if (!bid) {
      throw new Error(`Bid ${bidId} not found on RFB ${rfbId}`);
    }

    const updatedBids: RfbBid[] = rfb.bids.map((b) => {
      if (b.id === bidId) {
        return { ...b, status: 'ACCEPTED' as BidStatus };
      }
      if (b.status === 'PENDING') {
        return { ...b, status: 'EXPIRED' as BidStatus };
      }
      return b;
    });

    const updatedRfb: RfbRequest = {
      ...rfb,
      bids: updatedBids,
      awardedBidId: bidId,
      status: 'AWARDED',
      updatedAt: now(),
    };

    const { resource } = await this.container.item(rfbId, orderId).replace(updatedRfb);
    if (!resource) {
      throw new Error(`Failed to award bid ${bidId} on RFB ${rfbId}`);
    }

    logger.info('RFB awarded', { rfbId, awardedBidId: bidId, providerId: bid.providerId });
    return resource as RfbRequest;
  }

  // ── Cancel RFB ────────────────────────────────────────────────────────────

  async cancelRfb(rfbId: string, orderId: string, tenantId: string): Promise<RfbRequest> {
    const rfb = await this.getById(rfbId, orderId);
    if (!rfb) {
      throw new Error(`RFB ${rfbId} not found for order ${orderId}`);
    }
    if (rfb.tenantId !== tenantId) {
      throw new Error(`RFB ${rfbId} does not belong to tenant ${tenantId}`);
    }
    if (rfb.status === 'AWARDED') {
      throw new Error(`RFB ${rfbId} is already AWARDED and cannot be cancelled`);
    }
    if (rfb.status === 'CANCELLED') {
      throw new Error(`RFB ${rfbId} is already CANCELLED`);
    }

    const updated: RfbRequest = {
      ...rfb,
      status: 'CANCELLED',
      updatedAt: now(),
    };

    const { resource } = await this.container.item(rfbId, orderId).replace(updated);
    if (!resource) {
      throw new Error(`Failed to cancel RFB ${rfbId}`);
    }

    logger.info('RFB cancelled', { rfbId, orderId });
    return resource as RfbRequest;
  }

  // ── Expire stale broadcasts ───────────────────────────────────────────────

  /**
   * Finds all BROADCAST RFBs past their deadline and transitions them to EXPIRED.
   * Intended to be called by a scheduled job.
   * Note: cross-partition query — may be slow on very large containers.
   */
  async expireStaleRfbs(tenantId: string): Promise<{ expiredCount: number }> {
    const cutoff = new Date().toISOString();
    const { resources } = await this.container.items
      .query<RfbRequest>({
        query: `SELECT * FROM c
                WHERE c.tenantId = @tenantId
                  AND c.status = 'BROADCAST'
                  AND c.deadlineAt < @cutoff`,
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@cutoff', value: cutoff },
        ],
      })
      .fetchAll();

    let expiredCount = 0;
    for (const rfb of resources) {
      const updated: RfbRequest = {
        ...rfb,
        status: 'EXPIRED',
        updatedAt: now(),
      };
      await this.container.item(rfb.id, rfb.orderId).replace(updated);
      expiredCount++;
    }

    if (expiredCount > 0) {
      logger.info('Expired stale RFBs', { tenantId, expiredCount });
    }
    return { expiredCount };
  }
}
