/**
 * Overdue Order Detection Job
 *
 * Periodically scans orders with non-final status whose dueDate has passed.
 *   - Flags the order with isOverdue: true
 *   - Writes an audit trail event
 *   - Publishes an event for downstream notification
 *
 * Interval: 30 minutes (configurable)
 *
 * Uses the same pattern as VendorTimeoutCheckerJob.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import { OrderEventService } from '../services/order-event.service.js';

const FINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'CANCELLED'];

export class OverdueOrderDetectionJob {
  private logger: Logger;
  private cosmosService: CosmosDbService;
  private auditService: AuditTrailService;
  private eventService: OrderEventService;
  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger('OverdueOrderDetection');
    this.cosmosService = dbService || new CosmosDbService();
    this.auditService = new AuditTrailService();
    this.eventService = new OrderEventService();
  }

  /**
   * Start the overdue detection job
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Overdue order detection job already running');
      return;
    }

    this.firewallBlocked = false;

    this.logger.info('Starting overdue order detection job', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60000,
    });

    this.isRunning = true;

    // Run immediately on start
    this.detectOverdue().catch((err) =>
      this.logger.error('Error in initial overdue check', { error: err })
    );

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.detectOverdue().catch((err) =>
        this.logger.error('Error in overdue check', { error: err })
      );
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('Overdue order detection job stopped');
  }

  /**
   * Core detection — scan for orders past dueDate that aren't already flagged
   */
  private async detectOverdue(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      const container = this.cosmosService.getContainer('orders');
      const now = new Date().toISOString();

      // Find orders that are:
      //   - type = 'order' (not assignments or other doc types)
      //   - have a dueDate in the past
      //   - are NOT in a final status
      //   - are NOT already flagged as overdue
      const query = `
        SELECT * FROM c
        WHERE c.type = 'order'
          AND IS_DEFINED(c.dueDate)
          AND c.dueDate < @now
          AND NOT ARRAY_CONTAINS(@finalStatuses, c.status)
          AND (NOT IS_DEFINED(c.isOverdue) OR c.isOverdue != true)
      `;
      const { resources: overdueOrders } = await container.items.query({
        query,
        parameters: [
          { name: '@now', value: now },
          { name: '@finalStatuses', value: FINAL_STATUSES },
        ],
      }).fetchAll();

      if (overdueOrders.length === 0) {
        this.logger.info('Overdue check: no new overdue orders found');
        return;
      }

      this.logger.info(`Overdue check: found ${overdueOrders.length} newly overdue orders`);

      let flagged = 0;

      for (const order of overdueOrders) {
        try {
          // Flag the order
          await container.item(order.id, order.tenantId).replace({
            ...order,
            isOverdue: true,
            overdueDetectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          flagged++;

          this.logger.info(`Order flagged as overdue`, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            dueDate: order.dueDate,
            status: order.status,
          });

          // Write audit event
          try {
            await this.auditService.log({
              actor: { userId: 'system', role: 'system' },
              action: 'ORDER_OVERDUE',
              resource: {
                type: 'order',
                id: order.id,
                name: order.orderNumber || order.id,
              },
              metadata: {
                dueDate: order.dueDate,
                currentStatus: order.status,
                daysPastDue: Math.floor(
                  (Date.now() - new Date(order.dueDate).getTime()) / 86400000
                ),
              },
            });
          } catch {
            // Non-fatal
          }

          // Publish event
          try {
            await this.eventService.publishOrderStatusChanged(
              order.id,
              order.status,
              order.status, // status doesn't change, but we publish the overdue event
              'system'
            );
          } catch {
            // Non-fatal
          }
        } catch (err) {
          this.logger.error(`Failed to flag order ${order.id} as overdue`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info('Overdue check complete', { flagged });
    } catch (err: any) {
      if (err?.code === 'Forbidden' || err?.statusCode === 403) {
        this.firewallBlocked = true;
        this.logger.warn('Overdue detection blocked by firewall — will retry on next start');
      } else {
        this.logger.error('Overdue detection failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
