/**
 * Vendor Bid Timeout Checker Job
 *
 * Runs on a fixed interval and scans for orders where the current
 * vendor bid has expired without an acceptance or decline.
 *
 * When a timeout is detected it publishes `vendor.bid.timeout` to the
 * Service Bus topic.  The AutoAssignmentOrchestratorService subscribes
 * to that event and advances to the next vendor in the ranked list
 * (or escalates to a human if the list is exhausted).
 *
 * This job does NOT mutate any order documents — state transitions are
 * the orchestrator's responsibility.
 *
 * Interval: 5 minutes
 * Timeout window: controlled by order.autoVendorAssignment.currentBidExpiresAt
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { AutoVendorAssignmentState } from '../services/auto-assignment-orchestrator.service.js';

export class VendorTimeoutCheckerJob {
  private readonly logger = new Logger('VendorTimeoutCheckerJob');
  private readonly cosmosService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;
  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(dbService?: CosmosDbService) {
    this.cosmosService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) {
      this.logger.warn('VendorTimeoutCheckerJob already running');
      return;
    }

    this.firewallBlocked = false;

    this.logger.info('Starting VendorTimeoutCheckerJob', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
    });

    this.isRunning = true;

    // Run immediately on start, then on the interval.
    this.checkTimeouts().catch((err) =>
      this.logger.error('Error in initial vendor timeout check', { error: err }),
    );

    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch((err) =>
        this.logger.error('Error in vendor timeout check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('VendorTimeoutCheckerJob stopped');
  }

  getStatus(): { running: boolean; intervalMs: number } {
    return { running: this.isRunning, intervalMs: this.CHECK_INTERVAL_MS };
  }

  // ── Core scan ─────────────────────────────────────────────────────────────

  async checkTimeouts(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      this.logger.info('Scanning for expired vendor bids...');

      const now = new Date().toISOString();

      // Find orders where the orchestrator is waiting for a vendor bid response
      // and the expiry timestamp has passed.
      const orders = await this.cosmosService.queryDocuments<any>(
        'orders',
        `SELECT c.id, c.orderNumber, c.tenantId, c.priority, c.autoVendorAssignment
         FROM c
         WHERE c.autoVendorAssignment.status = 'PENDING_BID'
           AND IS_STRING(c.autoVendorAssignment.currentBidExpiresAt)
           AND c.autoVendorAssignment.currentBidExpiresAt <= @now`,
        [{ name: '@now', value: now }],
      );

      if (orders.length === 0) {
        this.logger.info('No expired vendor bids found');
        return;
      }

      this.logger.info(`Found ${orders.length} expired vendor bid(s)`);

      for (const order of orders) {
        await this.processExpiredBid(order);
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        this.logger.warn(
          'VendorTimeoutCheckerJob disabled due to Cosmos DB firewall restriction.',
          { error },
        );
        return;
      }
      this.logger.error('Error scanning for expired vendor bids', { error });
    }
  }

  // ── Per-order handling ────────────────────────────────────────────────────

  private async processExpiredBid(order: any): Promise<void> {
    try {
      const state = order.autoVendorAssignment as AutoVendorAssignmentState;

      if (!state?.currentBidId) {
        this.logger.warn('Order in PENDING_BID state has no currentBidId — skipping', {
          orderId: order.id,
        });
        return;
      }

      const currentVendor = state.rankedVendors[state.currentAttempt];
      if (!currentVendor) {
        this.logger.warn('Order in PENDING_BID state has no current vendor entry — skipping', {
          orderId: order.id,
          currentAttempt: state.currentAttempt,
        });
        return;
      }

      this.logger.warn('Vendor bid expired — publishing vendor.bid.timeout', {
        orderId: order.id,
        vendorId: currentVendor.vendorId,
        bidId: state.currentBidId,
        expiredAt: state.currentBidExpiresAt,
        attempt: state.currentAttempt + 1,
        of: state.rankedVendors.length,
      });

      const priority =
        order.priority === 'RUSH' || order.priority === 'EMERGENCY'
          ? EventPriority.HIGH
          : EventPriority.NORMAL;

      // Publish the timeout event — the orchestrator handles all state transitions.
      await this.publisher.publish({
        id: uuidv4(),
        type: 'vendor.bid.timeout',
        timestamp: new Date(),
        source: 'vendor-timeout-checker-job',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber ?? '',
          tenantId: order.tenantId ?? '',
          vendorId: currentVendor.vendorId,
          bidId: state.currentBidId,
          attemptNumber: state.currentAttempt + 1,
          totalAttempts: state.rankedVendors.length,
          priority,
        },
      });

      this.logger.info('Published vendor.bid.timeout', {
        orderId: order.id,
        vendorId: currentVendor.vendorId,
        attempt: state.currentAttempt + 1,
      });
    } catch (error) {
      this.logger.error('Error processing expired bid for order', {
        orderId: order.id,
        error,
      });
      // Non-fatal: log and continue to next order.
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private isCosmosFirewallError(error: any): boolean {
    return (
      !!error &&
      (error.code === 403 || error.statusCode === 403) &&
      typeof error.body?.message === 'string' &&
      error.body.message.includes('blocked by your Cosmos DB account firewall')
    );
  }
}
