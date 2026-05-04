/**
 * Vendor Bid Timeout Checker Job
 *
 * Runs on a fixed interval and does two sweeps over open vendor bids:
 *
 *   (1) Expired-bid sweep — publishes `vendor.bid.timeout` for any bid whose
 *       window has passed without an accept/decline. The orchestrator then
 *       advances to the next vendor or escalates to a human.
 *
 *   (2) V-02 Expiring-soon sweep — publishes `vendor.bid.expiring` for any
 *       bid whose expiry is within BID_EXPIRY_REMINDER_HOURS and that has
 *       not yet had a reminder dispatched. CommunicationEventHandler sends
 *       the reminder email. Idempotency is enforced by stamping
 *       `autoVendorAssignment.expiringReminderSentAt` on the order BEFORE
 *       the event is published; on each new bid the orchestrator resets
 *       this flag to null.
 *
 * State transitions (status changes) remain the orchestrator's responsibility.
 * The operational de-dup marker (expiringReminderSentAt) is owned here because
 * it is specific to this job's reminder sweep.
 *
 * Interval: 5 minutes
 * Timeout window: controlled by order.autoVendorAssignment.currentBidExpiresAt
 * Reminder threshold: BID_EXPIRY_REMINDER_HOURS env var (default 1h)
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

  /**
   * V-02: Dispatch a reminder email this many hours before a bid expires.
   * Env-overridable to support per-environment tuning.
   */
  private readonly REMINDER_THRESHOLD_MS: number =
    parseFloat(process.env.BID_EXPIRY_REMINDER_HOURS ?? '1') * 60 * 60 * 1000;

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
    this.runSweep().catch((err) =>
      this.logger.error('Error in initial vendor timeout check', { error: err }),
    );

    this.intervalId = setInterval(() => {
      this.runSweep().catch((err) =>
        this.logger.error('Error in vendor timeout check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  /** Run both sweeps sequentially; one failing must not block the other. */
  private async runSweep(): Promise<void> {
    await this.checkTimeouts().catch((err) =>
      this.logger.error('checkTimeouts sweep failed', { error: err }),
    );
    await this.checkExpiringSoon().catch((err) =>
      this.logger.error('checkExpiringSoon sweep failed', { error: err }),
    );
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

  // ── V-02 Expiring-soon sweep ──────────────────────────────────────────────

  /**
   * Scan for bids whose expiry is within REMINDER_THRESHOLD_MS and that have
   * not yet had a reminder dispatched. Publish `vendor.bid.expiring` for each
   * and stamp `expiringReminderSentAt` on the order so we do not double-send.
   */
  async checkExpiringSoon(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      const now = new Date();
      const reminderWindowEnd = new Date(now.getTime() + this.REMINDER_THRESHOLD_MS);

      const orders = await this.cosmosService.queryDocuments<any>(
        'orders',
        `SELECT c.id, c.orderNumber, c.tenantId, c.clientId, c.priority, c.autoVendorAssignment
         FROM c
         WHERE c.autoVendorAssignment.status = 'PENDING_BID'
           AND IS_STRING(c.autoVendorAssignment.currentBidExpiresAt)
           AND c.autoVendorAssignment.currentBidExpiresAt > @now
           AND c.autoVendorAssignment.currentBidExpiresAt <= @threshold
           AND (NOT IS_DEFINED(c.autoVendorAssignment.expiringReminderSentAt)
                OR c.autoVendorAssignment.expiringReminderSentAt = null)`,
        [
          { name: '@now', value: now.toISOString() },
          { name: '@threshold', value: reminderWindowEnd.toISOString() },
        ],
      );

      if (orders.length === 0) return;

      this.logger.info(`V-02: found ${orders.length} bid(s) expiring within reminder window`, {
        reminderWindowHours: this.REMINDER_THRESHOLD_MS / (60 * 60 * 1000),
      });

      for (const order of orders) {
        await this.dispatchExpiringReminder(order, now);
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        return;
      }
      this.logger.error('Error scanning for expiring vendor bids', { error });
    }
  }

  private async dispatchExpiringReminder(order: any, now: Date): Promise<void> {
    const state = order.autoVendorAssignment as AutoVendorAssignmentState;
    if (!state?.currentBidId || !state.currentBidExpiresAt) return;

    const currentVendor = state.rankedVendors[state.currentAttempt];
    if (!currentVendor) {
      this.logger.warn('expiring-reminder: order has no current vendor entry — skipping', {
        orderId: order.id,
        currentAttempt: state.currentAttempt,
      });
      return;
    }

    // Stamp the de-dup marker FIRST. If the publish fails we still prefer a
    // missed reminder over a double-send — ops will see the error and replay.
    const updatedState: AutoVendorAssignmentState = {
      ...state,
      expiringReminderSentAt: now.toISOString(),
    };
    await this.cosmosService.updateItem(
      'orders',
      order.id,
      { ...order, autoVendorAssignment: updatedState, updatedAt: now.toISOString() },
      order.tenantId,
    );

    const expiresAt = new Date(state.currentBidExpiresAt);
    const minutesRemaining = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60_000));
    const priority =
      order.priority === 'RUSH' || order.priority === 'EMERGENCY'
        ? EventPriority.HIGH
        : EventPriority.NORMAL;

    await this.publisher.publish({
      id: uuidv4(),
      type: 'vendor.bid.expiring',
      timestamp: new Date(),
      source: 'vendor-timeout-checker-job',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber ?? '',
        tenantId: order.tenantId ?? '',
        clientId: order.clientId ?? '',
        vendorId: currentVendor.vendorId,
        vendorName: currentVendor.vendorName,
        bidId: state.currentBidId,
        expiresAt: state.currentBidExpiresAt,
        minutesRemaining,
        attemptNumber: state.currentAttempt + 1,
        priority,
      },
    } as any);

    this.logger.info('V-02: published vendor.bid.expiring', {
      orderId: order.id,
      vendorId: currentVendor.vendorId,
      bidId: state.currentBidId,
      minutesRemaining,
    });
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
          clientId: order.clientId ?? '',
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
