/**
 * Scorecard Event Recorder
 *
 * Subscribes to `vendor-scorecard.created` (published by
 * VendorOrderScorecardService.appendScorecard) and writes a denormalized
 * row to the `scorecard-events` Cosmos container with FULL context at the
 * moment of scoring:
 *
 *   - Raw 5-category scores + computed overall
 *   - Order context (productType, clientId, programId, dueDate, deliveredAt)
 *   - Vendor context at scoring time (prior tier, prior overallScore)
 *   - Reviewer context (userId)
 *   - Derived signals at scoring time (revisionCount, daysLate)
 *   - The rollup-profile id chain that would apply (so future ML can join
 *     against the algorithm version in force at scoring time)
 *
 * Why a separate stream from order.scorecards[]: that array is the live
 * operational source of truth (active rating + supersedes chain). This
 * stream is a flat append-only log optimized for ML training joins —
 * separate concern, separate container, separate lifecycle.
 *
 * Best-effort: write failures log a warning but don't retry or fail the
 * upstream scorecard-create. ML data is forward-looking; a missing row
 * isn't operationally critical.
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { Logger } from '../utils/logger.js';
import { ScorecardRollupProfileService } from './scorecard-rollup-profile.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import type { BaseEvent, EventHandler, VendorScorecardCreatedEvent } from '../types/events.js';
import type { Order } from '../types/index.js';
import type { VendorOrderScorecardEntry } from '../types/vendor-order.types.js';

const CONTAINER = 'scorecard-events';

interface ScorecardEventRow {
  /** Synthetic id: `${orderId}__${scorecardId}` — makes retries idempotent. */
  id: string;
  tenantId: string;
  vendorId: string;
  orderId: string;
  scorecardId: string;
  /** Same shape as VendorOrderScorecardEntry.scores. */
  scores: VendorOrderScorecardEntry['scores'];
  overallScore: number;
  productType?: string;
  clientId?: string;
  programId?: string;
  dueDate?: string;
  deliveredAt?: string;
  reviewedBy: string;
  reviewedAt: string;
  /** Total revisions on the order at the time of scoring. */
  revisionCount?: number;
  /** Positive = delivered late by this many days; negative = early. */
  daysLate?: number;
  /** The vendor's tier on file at scoring time (before this row's recompute). */
  vendorPriorTier?: string;
  /** The vendor's overallScore on file at scoring time (before this row's recompute). */
  vendorPriorOverallScore?: number;
  /** Rollup-profile ids the active resolver would apply for this (tenant, client, product). */
  appliedProfileIds: string[];
  /** ISO timestamp this event row was persisted. */
  recordedAt: string;
}

export class ScorecardEventRecorderService {
  private readonly logger = new Logger('ScorecardEventRecorderService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly rollupProfileService: ScorecardRollupProfileService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'scorecard-event-recorder-service',
    );
    this.rollupProfileService = new ScorecardRollupProfileService(
      this.dbService,
      new AuditTrailService(this.dbService),
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('ScorecardEventRecorderService already started');
      return;
    }
    await this.subscriber.subscribe<VendorScorecardCreatedEvent>(
      'vendor-scorecard.created',
      this.makeHandler('vendor-scorecard.created', this.onScorecardCreated.bind(this)),
    );
    this.isStarted = true;
    this.logger.info('ScorecardEventRecorderService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('vendor-scorecard.created').catch(() => {});
    this.isStarted = false;
    this.logger.info('ScorecardEventRecorderService stopped');
  }

  // ─── Handler ───────────────────────────────────────────────────────────────

  private async onScorecardCreated(event: VendorScorecardCreatedEvent): Promise<void> {
    const { orderId, scorecardId } = event.data;

    // Load the order to harvest context. If the order can't be loaded, log
    // and move on — the operational scorecard write already succeeded.
    const orderResp = await this.dbService.findOrderById(orderId);
    if (!orderResp.success || !orderResp.data) {
      this.logger.warn('ScorecardEventRecorder: order not found', { orderId, scorecardId });
      return;
    }
    const order = orderResp.data as Order;

    // Find the actual scorecard entry on the order to copy the scores.
    const scorecards = order.scorecards ?? [];
    const scorecard = scorecards.find((s) => s.id === scorecardId);
    if (!scorecard) {
      this.logger.warn('ScorecardEventRecorder: scorecard not found on order', {
        orderId,
        scorecardId,
      });
      return;
    }

    const vendorId =
      event.data.vendorId ??
      (order as { assignedVendorId?: string }).assignedVendorId ??
      (order as { vendorId?: string }).vendorId;
    const tenantId = order.tenantId;
    if (!vendorId || !tenantId) {
      this.logger.warn('ScorecardEventRecorder: missing vendorId or tenantId', {
        orderId,
        scorecardId,
      });
      return;
    }

    // Resolve the rollup profile chain that would apply at the time of
    // scoring. ML can later join against this to know which algorithm
    // version was in force.
    let appliedProfileIds: string[] = [];
    try {
      const resolved = await this.rollupProfileService.resolveProfile({
        tenantId,
        ...(order.clientId ? { clientId: order.clientId } : {}),
        ...(order.productType ? { productType: String(order.productType) } : {}),
      });
      appliedProfileIds = resolved.appliedProfileIds;
    } catch (err) {
      this.logger.warn('ScorecardEventRecorder: rollup profile resolve failed', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Vendor prior tier / score — load from the vendors container.
    let vendorPriorTier: string | undefined;
    let vendorPriorOverallScore: number | undefined;
    try {
      const vendorContainer = this.dbService.getContainer('vendors');
      const { resources } = await vendorContainer.items
        .query<{ tier?: string; overallScore?: number }>({
          query: 'SELECT c.tier, c.overallScore FROM c WHERE c.id = @id AND c.tenantId = @tid',
          parameters: [
            { name: '@id', value: vendorId },
            { name: '@tid', value: tenantId },
          ],
        })
        .fetchAll();
      vendorPriorTier = resources[0]?.tier;
      vendorPriorOverallScore = resources[0]?.overallScore;
    } catch (err) {
      this.logger.warn('ScorecardEventRecorder: vendor lookup failed (continuing)', {
        vendorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Derived signals — copied verbatim from the order doc; these inform
    // the ML feature set without separate joins later.
    const due = (order as { dueDate?: string | Date }).dueDate;
    const delivered = (order as { deliveredDate?: string | Date }).deliveredDate;
    const revisionCount =
      typeof (order as unknown as { revisionCount?: number }).revisionCount === 'number'
        ? (order as unknown as { revisionCount: number }).revisionCount
        : 0;
    let daysLate: number | undefined;
    if (due && delivered) {
      const dueMs = typeof due === 'string' ? new Date(due).getTime() : due.getTime();
      const delMs =
        typeof delivered === 'string' ? new Date(delivered).getTime() : delivered.getTime();
      daysLate = Math.round((delMs - dueMs) / (1000 * 60 * 60 * 24));
    }

    const row: ScorecardEventRow = {
      id: `${orderId}__${scorecardId}`,
      tenantId,
      vendorId,
      orderId,
      scorecardId,
      scores: scorecard.scores,
      overallScore: scorecard.overallScore,
      ...(order.productType ? { productType: String(order.productType) } : {}),
      ...(order.clientId ? { clientId: order.clientId } : {}),
      ...((order as unknown as { programId?: string }).programId
        ? { programId: (order as unknown as { programId: string }).programId }
        : {}),
      ...(due
        ? { dueDate: typeof due === 'string' ? due : due.toISOString() }
        : {}),
      ...(delivered
        ? { deliveredAt: typeof delivered === 'string' ? delivered : delivered.toISOString() }
        : {}),
      reviewedBy: scorecard.reviewedBy,
      reviewedAt: scorecard.reviewedAt,
      revisionCount,
      ...(typeof daysLate === 'number' ? { daysLate } : {}),
      ...(vendorPriorTier ? { vendorPriorTier } : {}),
      ...(typeof vendorPriorOverallScore === 'number'
        ? { vendorPriorOverallScore }
        : {}),
      appliedProfileIds,
      recordedAt: new Date().toISOString(),
    };

    try {
      await this.dbService.createItem(CONTAINER, row as unknown as Record<string, unknown>);
      this.logger.info('Scorecard event recorded', {
        orderId,
        scorecardId,
        vendorId,
        overallScore: scorecard.overallScore,
      });
    } catch (err) {
      // 409 (idempotent retry) is expected; log everything else as a warning.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409') || message.includes('Conflict')) {
        this.logger.info('Scorecard event already recorded (idempotent retry)', {
          orderId,
          scorecardId,
        });
      } else {
        this.logger.warn('ScorecardEventRecorder: failed to write event row', {
          orderId,
          scorecardId,
          error: message,
        });
      }
    }
  }

  // ─── Subscriber bookkeeping helper ────────────────────────────────────────

  private makeHandler<T extends BaseEvent>(
    label: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    const self = this;
    return {
      async handle(event: T) {
        try {
          await fn(event);
        } catch (err) {
          self.logger.error(`ScorecardEventRecorder ${label} handler crashed`, {
            eventId: event.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    };
  }
}

export const SCORECARD_EVENTS_CONTAINER = CONTAINER;
