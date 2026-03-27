/**
 * Review Assignment Timeout Checker Job
 *
 * Runs on a fixed interval and scans for QC review queue items where:
 *   - status is IN_REVIEW (an analyst was assigned)
 *   - the analyst has not acted and the acceptance window has expired
 *
 * When detected it publishes a `review.assignment.timeout` event which
 * the AutoAssignmentOrchestratorService handles to try the next reviewer
 * in the ranked list (or escalate to a human if the list is exhausted).
 *
 * Interval: 10 minutes (matches SLA monitoring cadence)
 * Timeout window: controlled by order.autoReviewAssignment.currentAssignmentExpiresAt
 *                 Falls back to REVIEW_ACCEPT_TIMEOUT_HOURS env var (default 8 hours)
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';

/** Default hours a reviewer has to accept before the job fires a timeout event. */
const DEFAULT_REVIEW_ACCEPT_TIMEOUT_HOURS = 8;

export class ReviewAssignmentTimeoutJob {
  private readonly logger = new Logger('ReviewAssignmentTimeoutJob');
  private readonly cosmosService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;
  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly TIMEOUT_HOURS: number;

  constructor(dbService?: CosmosDbService) {
    this.cosmosService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();

    const envHours = process.env.REVIEW_ACCEPT_TIMEOUT_HOURS;
    this.TIMEOUT_HOURS = envHours ? parseInt(envHours, 10) : DEFAULT_REVIEW_ACCEPT_TIMEOUT_HOURS;

    if (isNaN(this.TIMEOUT_HOURS) || this.TIMEOUT_HOURS <= 0) {
      throw new Error(
        `REVIEW_ACCEPT_TIMEOUT_HOURS must be a positive integer, got: "${envHours}"`,
      );
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) {
      this.logger.warn('ReviewAssignmentTimeoutJob already running');
      return;
    }

    this.firewallBlocked = false;

    this.logger.info('Starting ReviewAssignmentTimeoutJob', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
      timeoutHours: this.TIMEOUT_HOURS,
    });

    this.isRunning = true;

    // Run once immediately
    this.checkTimeouts().catch((err) =>
      this.logger.error('Error in initial review timeout check', { error: err }),
    );

    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch((err) =>
        this.logger.error('Error in review timeout check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('ReviewAssignmentTimeoutJob stopped');
  }

  getStatus(): { running: boolean; intervalMs: number; timeoutHours: number } {
    return {
      running: this.isRunning,
      intervalMs: this.CHECK_INTERVAL_MS,
      timeoutHours: this.TIMEOUT_HOURS,
    };
  }

  // ── Core scan ─────────────────────────────────────────────────────────────

  private async checkTimeouts(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      this.logger.info('Checking for review assignment timeouts...');

      const container = this.cosmosService.getContainer('qc-reviews');

      // Find queue items that are actively assigned (IN_REVIEW) and have auto-assignment state
      const { resources: items } = await container.items
        .query({
          query: `
            SELECT * FROM c
            WHERE c.status = 'IN_REVIEW'
              AND IS_DEFINED(c.assignedAt)
              AND IS_DEFINED(c.assignedAnalystId)
          `,
        })
        .fetchAll();

      if (items.length === 0) {
        this.logger.info('No active review assignments found');
        return;
      }

      this.logger.info(`Found ${items.length} active review assignment(s) to check`);

      const now = new Date();
      // Fallback threshold based on configured timeout hours
      const fallbackThreshold = new Date(now.getTime() - this.TIMEOUT_HOURS * 60 * 60 * 1000);

      for (const item of items) {
        await this.checkItemTimeout(item, now, fallbackThreshold);
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        this.logger.warn(
          'ReviewAssignmentTimeoutJob disabled due to Cosmos DB firewall restriction.',
          { error },
        );
        return;
      }
      this.logger.error('Error checking review assignment timeouts', { error });
    }
  }

  private async checkItemTimeout(
    item: any,
    now: Date,
    fallbackThreshold: Date,
  ): Promise<void> {
    try {
      // Prefer the explicit expiry stored by the orchestrator on the ORDER document;
      // fall back to assignedAt + TIMEOUT_HOURS from the queue item itself.
      let expiresAt: Date;

      if (item.autoAssignmentExpiresAt) {
        expiresAt = new Date(item.autoAssignmentExpiresAt);
      } else {
        const assignedAt = new Date(item.assignedAt);
        if (isNaN(assignedAt.getTime())) {
          this.logger.warn('Skipping item with invalid assignedAt', { itemId: item.id });
          return;
        }
        expiresAt = new Date(assignedAt.getTime() + this.TIMEOUT_HOURS * 60 * 60 * 1000);
      }

      if (now < expiresAt) return; // Not yet expired

      this.logger.warn('Review assignment timeout detected', {
        qcReviewId: item.id,
        orderId: item.orderId,
        reviewerId: item.assignedAnalystId,
        expiresAt: expiresAt.toISOString(),
      });

      // Determine attempt number and total from order's autoReviewAssignment (if available)
      let attemptNumber = 1;
      let totalAttempts = 1;
      try {
        const ordersContainer = this.cosmosService.getContainer('orders');
        const orderQuery = {
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: item.orderId }],
        };
        const { resources: orders } = await ordersContainer.items.query(orderQuery).fetchAll();
        const order = orders[0];
        if (order?.autoReviewAssignment) {
          const state = order.autoReviewAssignment;
          attemptNumber = (state.currentAttempt ?? 0) + 1;
          totalAttempts = state.rankedReviewers?.length ?? 1;
        }
      } catch {
        // Non-fatal: use defaults
      }

      // Publish event — the orchestrator will handle advancing the assignment
      await this.publisher.publish({
        id: uuidv4(),
        type: 'review.assignment.timeout',
        timestamp: new Date(),
        source: 'review-assignment-timeout-job',
        version: '1.0',
        category: EventCategory.QC,
        data: {
          orderId: item.orderId,
          orderNumber: item.orderNumber ?? '',
          tenantId: item.tenantId ?? '',
          qcReviewId: item.id,
          reviewerId: item.assignedAnalystId,
          attemptNumber,
          totalAttempts,
          priority: this.mapOrderPriority(item.orderPriority),
        },
      });

      this.logger.info('Published review.assignment.timeout event', {
        qcReviewId: item.id,
        orderId: item.orderId,
      });
    } catch (error) {
      this.logger.error('Error checking review item timeout', { itemId: item.id, error });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private isCosmosFirewallError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as any;
    return (
      (e.code === 403 || e.statusCode === 403) &&
      typeof e.body?.message === 'string' &&
      (e.body.message as string).includes('blocked by your Cosmos DB account firewall')
    );
  }

  private mapOrderPriority(priority: string | undefined): EventPriority {
    switch ((priority ?? '').toUpperCase()) {
      case 'EMERGENCY':
      case 'SUPER_RUSH':
        return EventPriority.CRITICAL;
      case 'RUSH':
        return EventPriority.HIGH;
      default:
        return EventPriority.NORMAL;
    }
  }
}
