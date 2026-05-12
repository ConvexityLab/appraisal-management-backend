/**
 * Vendor Order Stuck Checker Job
 *
 * Scans orders whose status has not advanced beyond an expected post-assignment
 * milestone within a configurable time window.  AIM-Port drives status
 * progression via push callbacks; if those callbacks stop arriving (silent
 * failure, network partition, etc.) orders stall invisibly.  This job closes
 * that gap by publishing a `vendor.order.stalled` alert event so operators
 * can intervene.
 *
 * Three sweeps — each isolated so one failure never blocks the others:
 *
 *   (1) awaiting_schedule  — order in ASSIGNED or ACCEPTED status with no
 *       inspection scheduled after STUCK_ASSIGNED_HOURS (default 24 h).
 *
 *   (2) awaiting_completion — order in IN_PROGRESS or INSPECTION_SCHEDULED
 *       status where the inspection date has passed and the order has not
 *       advanced to INSPECTION_COMPLETED after STUCK_INSPECTION_OVERDUE_HOURS
 *       (default 4 h) of grace time.
 *
 *   (3) awaiting_report — order in INSPECTION_COMPLETED status with no
 *       SUBMITTED transition after STUCK_REPORT_HOURS (default 48 h).
 *
 * Only **one** alert per order per phase is dispatched.  Idempotency is
 * enforced by stamping `vendorIntegration.stuckAlertSentAt.<phase>` on
 * the order document BEFORE publishing, so a restart never double-alerts.
 *
 * State transitions remain the responsibility of the orchestrator / human ops.
 * This job never advances order status — it only raises the alert.
 *
 * Interval: 10 minutes
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';

export type StuckPhase =
  | 'awaiting_schedule'
  | 'awaiting_completion'
  | 'awaiting_report';

export class VendorOrderStuckCheckerJob {
  private readonly logger = new Logger('VendorOrderStuckCheckerJob');
  private readonly cosmosService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;
  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  /** Hours after ASSIGNED / ACCEPTED before we alert on no inspection schedule. */
  private readonly STUCK_ASSIGNED_HOURS: number =
    parseFloat(process.env.STUCK_ASSIGNED_HOURS ?? '24');

  /** Grace hours past the inspection date before alerting on no INSPECTION_COMPLETED. */
  private readonly STUCK_INSPECTION_OVERDUE_HOURS: number =
    parseFloat(process.env.STUCK_INSPECTION_OVERDUE_HOURS ?? '4');

  /** Hours after INSPECTION_COMPLETED before alerting on no SUBMITTED. */
  private readonly STUCK_REPORT_HOURS: number =
    parseFloat(process.env.STUCK_REPORT_HOURS ?? '48');

  constructor(dbService?: CosmosDbService) {
    this.cosmosService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) {
      this.logger.warn('VendorOrderStuckCheckerJob already running');
      return;
    }

    this.firewallBlocked = false;

    this.logger.info('Starting VendorOrderStuckCheckerJob', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
      stuckAssignedHours: this.STUCK_ASSIGNED_HOURS,
      stuckInspectionOverdueHours: this.STUCK_INSPECTION_OVERDUE_HOURS,
      stuckReportHours: this.STUCK_REPORT_HOURS,
    });

    this.isRunning = true;

    this.runSweep().catch((err) =>
      this.logger.error('Error in initial vendor order stuck check', { error: err }),
    );

    this.intervalId = setInterval(() => {
      this.runSweep().catch((err) =>
        this.logger.error('Error in vendor order stuck check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('VendorOrderStuckCheckerJob stopped');
  }

  getStatus(): { running: boolean; intervalMs: number } {
    return { running: this.isRunning, intervalMs: this.CHECK_INTERVAL_MS };
  }

  // ── Sweep coordinator ─────────────────────────────────────────────────────

  /** Run all three sweeps sequentially; one failure must not block the others. */
  private async runSweep(): Promise<void> {
    await this.sweepAwaitingSchedule().catch((err) =>
      this.logger.error('sweepAwaitingSchedule failed', { error: err }),
    );
    await this.sweepAwaitingCompletion().catch((err) =>
      this.logger.error('sweepAwaitingCompletion failed', { error: err }),
    );
    await this.sweepAwaitingReport().catch((err) =>
      this.logger.error('sweepAwaitingReport failed', { error: err }),
    );
  }

  // ── Sweep 1 — awaiting_schedule ───────────────────────────────────────────

  /**
   * Orders in ASSIGNED / ACCEPTED that have not progressed after
   * STUCK_ASSIGNED_HOURS.  Means the vendor was assigned but AIM-Port never
   * pushed an inspection-scheduled update.
   */
  async sweepAwaitingSchedule(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      this.logger.info('STUCK sweep 1/3 — awaiting_schedule');

      const threshold = new Date(
        Date.now() - this.STUCK_ASSIGNED_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const orders = await this.cosmosService.queryDocuments<any>(
        'orders',
        `SELECT c.id, c.orderNumber, c.tenantId, c.clientId, c.status,
                c.priority, c.updatedAt, c.autoVendorAssignment, c.vendorIntegration
         FROM c
         WHERE c.status IN ('ASSIGNED', 'ACCEPTED')
           AND IS_STRING(c.updatedAt)
           AND c.updatedAt <= @threshold
           AND (NOT IS_DEFINED(c.vendorIntegration.stuckAlertSentAt.awaiting_schedule)
                OR c.vendorIntegration.stuckAlertSentAt.awaiting_schedule = null)`,
        [{ name: '@threshold', value: threshold }],
      );

      if (orders.length === 0) {
        this.logger.info('STUCK sweep 1/3 — no stalled orders found');
        return;
      }

      this.logger.warn(`STUCK sweep 1/3 — found ${orders.length} order(s) awaiting inspection schedule`, {
        stuckAfterHours: this.STUCK_ASSIGNED_HOURS,
      });

      for (const order of orders) {
        await this.alertStuck(order, 'awaiting_schedule').catch((err) =>
          this.logger.error('alertStuck failed for order', { orderId: order.id, error: err }),
        );
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        this.logger.warn('VendorOrderStuckCheckerJob disabled: Cosmos DB firewall restriction', { error });
        return;
      }
      this.logger.error('Error in sweepAwaitingSchedule', { error });
    }
  }

  // ── Sweep 2 — awaiting_completion ─────────────────────────────────────────

  /**
   * Orders in IN_PROGRESS / INSPECTION_SCHEDULED where the updatedAt timestamp
   * indicates the status hasn't changed for longer than STUCK_INSPECTION_OVERDUE_HOURS.
   * Means the inspection may have happened but AIM-Port never pushed a completion.
   */
  async sweepAwaitingCompletion(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      this.logger.info('STUCK sweep 2/3 — awaiting_completion');

      const threshold = new Date(
        Date.now() - this.STUCK_INSPECTION_OVERDUE_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const orders = await this.cosmosService.queryDocuments<any>(
        'orders',
        `SELECT c.id, c.orderNumber, c.tenantId, c.clientId, c.status,
                c.priority, c.updatedAt, c.autoVendorAssignment, c.vendorIntegration
         FROM c
         WHERE c.status IN ('IN_PROGRESS', 'INSPECTION_SCHEDULED')
           AND IS_STRING(c.updatedAt)
           AND c.updatedAt <= @threshold
           AND (NOT IS_DEFINED(c.vendorIntegration.stuckAlertSentAt.awaiting_completion)
                OR c.vendorIntegration.stuckAlertSentAt.awaiting_completion = null)`,
        [{ name: '@threshold', value: threshold }],
      );

      if (orders.length === 0) {
        this.logger.info('STUCK sweep 2/3 — no stalled orders found');
        return;
      }

      this.logger.warn(`STUCK sweep 2/3 — found ${orders.length} order(s) awaiting inspection completion`, {
        stuckAfterHours: this.STUCK_INSPECTION_OVERDUE_HOURS,
      });

      for (const order of orders) {
        await this.alertStuck(order, 'awaiting_completion').catch((err) =>
          this.logger.error('alertStuck failed for order', { orderId: order.id, error: err }),
        );
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        return;
      }
      this.logger.error('Error in sweepAwaitingCompletion', { error });
    }
  }

  // ── Sweep 3 — awaiting_report ─────────────────────────────────────────────

  /**
   * Orders in INSPECTION_COMPLETED that have not advanced to SUBMITTED after
   * STUCK_REPORT_HOURS.  Means the appraiser completed the inspection but the
   * report was never submitted.
   */
  async sweepAwaitingReport(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      this.logger.info('STUCK sweep 3/3 — awaiting_report');

      const threshold = new Date(
        Date.now() - this.STUCK_REPORT_HOURS * 60 * 60 * 1000,
      ).toISOString();

      const orders = await this.cosmosService.queryDocuments<any>(
        'orders',
        `SELECT c.id, c.orderNumber, c.tenantId, c.clientId, c.status,
                c.priority, c.updatedAt, c.autoVendorAssignment, c.vendorIntegration
         FROM c
         WHERE c.status = 'INSPECTION_COMPLETED'
           AND IS_STRING(c.updatedAt)
           AND c.updatedAt <= @threshold
           AND (NOT IS_DEFINED(c.vendorIntegration.stuckAlertSentAt.awaiting_report)
                OR c.vendorIntegration.stuckAlertSentAt.awaiting_report = null)`,
        [{ name: '@threshold', value: threshold }],
      );

      if (orders.length === 0) {
        this.logger.info('STUCK sweep 3/3 — no stalled orders found');
        return;
      }

      this.logger.warn(`STUCK sweep 3/3 — found ${orders.length} order(s) awaiting report submission`, {
        stuckAfterHours: this.STUCK_REPORT_HOURS,
      });

      for (const order of orders) {
        await this.alertStuck(order, 'awaiting_report').catch((err) =>
          this.logger.error('alertStuck failed for order', { orderId: order.id, error: err }),
        );
      }
    } catch (error) {
      if (this.isCosmosFirewallError(error)) {
        this.firewallBlocked = true;
        return;
      }
      this.logger.error('Error in sweepAwaitingReport', { error });
    }
  }

  // ── Alert dispatch ─────────────────────────────────────────────────────────

  private async alertStuck(order: any, phase: StuckPhase): Promise<void> {
    const now = new Date();

    // Stamp the de-dup marker BEFORE publishing (missed alert < double alert).
    const existingStuck = order.vendorIntegration?.stuckAlertSentAt ?? {};
    const updatedVendorIntegration = {
      ...(order.vendorIntegration ?? {}),
      stuckAlertSentAt: {
        ...existingStuck,
        [phase]: now.toISOString(),
      },
    };

    await this.cosmosService.updateItem(
      'orders',
      order.id,
      { ...order, vendorIntegration: updatedVendorIntegration, updatedAt: now.toISOString() },
      order.tenantId,
    );

    const assignedVendorId: string | undefined =
      order.autoVendorAssignment?.rankedVendors?.[order.autoVendorAssignment?.currentAttempt ?? 0]
        ?.vendorId;

    const priority =
      order.priority === 'RUSH' || order.priority === 'EMERGENCY'
        ? EventPriority.HIGH
        : EventPriority.NORMAL;

    await this.publisher.publish({
      id: uuidv4(),
      type: 'vendor.order.stalled',
      timestamp: now,
      source: 'vendor-order-stuck-checker-job',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber ?? '',
        tenantId: order.tenantId ?? '',
        clientId: order.clientId ?? '',
        currentStatus: order.status,
        stuckPhase: phase,
        lastUpdatedAt: order.updatedAt,
        vendorId: assignedVendorId ?? null,
        priority,
        alertSentAt: now.toISOString(),
      },
    } as any);

    this.logger.warn('Published vendor.order.stalled', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      stuckPhase: phase,
      lastUpdatedAt: order.updatedAt,
      vendorId: assignedVendorId ?? 'unknown',
    });
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
