/**
 * Supervision Timeout Watcher Job
 *
 * Monitors orders that require supervisory co-sign but have not been co-signed
 * within the configured `supervisorTimeoutHours` window (default: 8 hours).
 *
 * When a timeout is detected:
 *   1. Sets `requiresHumanIntervention: true` on the order (idempotency guard)
 *   2. Publishes `supervision.timeout` so:
 *        - CommunicationEventHandler emails the supervisor and escalation recipients
 *
 * Note: This job does NOT auto-reassign the supervisor because supervisory
 * co-sign is a compliance step — escalation to a human manager is the correct
 * response. The `requiresHumanIntervention` flag surfaces the order in the
 * "Needs Attention" queue UI.
 *
 * Interval: 15 minutes
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { TenantAutomationConfigService } from '../services/tenant-automation-config.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { SupervisionTimedOutEvent } from '../types/events.js';

export class SupervisionTimeoutWatcherJob {
  private readonly logger = new Logger('SupervisionTimeoutWatcherJob');
  private readonly cosmosService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly tenantConfigService: TenantAutomationConfigService;

  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  constructor(dbService?: CosmosDbService) {
    this.cosmosService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.tenantConfigService = new TenantAutomationConfigService();
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('SupervisionTimeoutWatcherJob already running');
      return;
    }

    this.firewallBlocked = false;
    this.logger.info('Starting SupervisionTimeoutWatcherJob', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
    });

    this.isRunning = true;

    this.checkTimeouts().catch(err =>
      this.logger.error('Error in initial supervision timeout check', { error: err }),
    );
    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch(err =>
        this.logger.error('Error in supervision timeout check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      delete this.intervalId;
    }
    this.isRunning = false;
    this.logger.info('SupervisionTimeoutWatcherJob stopped');
  }

  private async checkTimeouts(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      const container = this.cosmosService.getContainer('orders');

      // Find orders that:
      //   - require supervisory review
      //   - have NOT been co-signed yet
      //   - have NOT already been flagged for human intervention
      //   - have a supervisorId (so the job knows who to notify)
      const { resources: candidates } = await container.items.query({
        query: `
          SELECT * FROM c
          WHERE c.type = 'order'
            AND c.requiresSupervisoryReview = true
            AND (NOT IS_DEFINED(c.supervisoryCosignedAt) OR c.supervisoryCosignedAt = null)
            AND (NOT IS_DEFINED(c.requiresHumanIntervention) OR c.requiresHumanIntervention != true)
            AND IS_DEFINED(c.supervisorId)
        `,
      }).fetchAll();

      if (candidates.length === 0) {
        this.logger.debug('Supervision timeout check: no candidates found');
        return;
      }

      this.logger.info(`Supervision timeout check: evaluating ${candidates.length} candidate(s)`);

      for (const order of candidates) {
        await this.processCandidate(order);
      }
    } catch (err: any) {
      if (err?.code === 403 || err?.statusCode === 403) {
        this.firewallBlocked = true;
        this.logger.warn('SupervisionTimeoutWatcherJob blocked by Cosmos firewall — suspending checks');
      } else {
        this.logger.error('Supervision timeout check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async processCandidate(order: any): Promise<void> {
    try {
      // Determine when supervision was requested — fall back to order update time.
      const requestedAtRaw: string | undefined =
        order.supervisionRequestedAt ?? order.updatedAt;

      if (!requestedAtRaw) {
        this.logger.warn('Supervision timeout: cannot determine requestedAt', {
          orderId: order.id,
        });
        return;
      }

      const tenantConfig = await this.tenantConfigService.getConfig(order.tenantId);
      const slaHours = tenantConfig.supervisorTimeoutHours;
      const requestedAt = new Date(requestedAtRaw);
      const elapsed = Date.now() - requestedAt.getTime();
      const slaMs = slaHours * 3_600_000;

      if (elapsed < slaMs) {
        // Not yet timed out.
        return;
      }

      this.logger.warn('Supervisor co-sign SLA breached — escalating', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        supervisorId: order.supervisorId,
        requestedAt: requestedAt.toISOString(),
        elapsedHours: Math.floor(elapsed / 3_600_000),
        slaHours,
      });

      // Mark as requiring human intervention to prevent repeated escalation emails.
      const container = this.cosmosService.getContainer('orders');
      await container.item(order.id, order.tenantId).patch([
        { op: 'add', path: '/requiresHumanIntervention', value: true },
        { op: 'add', path: '/humanInterventionReason', value: 'supervision_sla_breached' },
        { op: 'add', path: '/supervisionSlaBreachedAt', value: new Date().toISOString() },
        { op: 'add', path: '/updatedAt', value: new Date().toISOString() },
      ]);

      const event: SupervisionTimedOutEvent = {
        id: uuidv4(),
        type: 'supervision.timeout',
        timestamp: new Date(),
        source: 'supervision-timeout-watcher-job',
        version: '1.0',
        category: EventCategory.QC,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tenantId: order.tenantId,
          supervisorId: order.supervisorId,
          requestedAt,
          slaHours,
          priority: EventPriority.HIGH,
        },
      };

      await this.publisher.publish(event);
      this.logger.info('supervision.timeout published', {
        orderId: order.id,
        supervisorId: order.supervisorId,
      });
    } catch (err: any) {
      this.logger.error(`Failed to process supervision timeout for order ${order.id}`, {
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      });
    }
  }
}
