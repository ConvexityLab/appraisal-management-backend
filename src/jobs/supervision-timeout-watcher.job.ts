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
  // Circuit-breaker: opens after 3 consecutive 403 errors, half-opens after 5 min.
  private cbFailureCount = 0;
  private cbOpenedAt: number | null = null;
  private readonly CB_FAILURE_THRESHOLD = 3;
  private readonly CB_HALF_OPEN_MS = 5 * 60 * 1000; // 5 minutes
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

    this.cbFailureCount = 0;
    this.cbOpenedAt = null;
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

  private isCircuitOpen(): boolean {
    if (this.cbOpenedAt === null) return false;
    return (Date.now() - this.cbOpenedAt) < this.CB_HALF_OPEN_MS;
  }

  private recordCbSuccess(): void {
    if (this.cbOpenedAt !== null) {
      this.logger.info('SupervisionTimeoutWatcherJob: circuit-breaker closed after successful probe');
    }
    this.cbFailureCount = 0;
    this.cbOpenedAt = null;
  }

  private recordCbFailure(): void {
    this.cbFailureCount++;
    if (this.cbFailureCount >= this.CB_FAILURE_THRESHOLD) {
      if (this.cbOpenedAt === null) {
        this.cbOpenedAt = Date.now();
        this.logger.warn(
          `SupervisionTimeoutWatcherJob: circuit-breaker OPEN after ${this.cbFailureCount} consecutive 403 errors — will retry in ${this.CB_HALF_OPEN_MS / 60_000} min`,
        );
      } else {
        this.cbOpenedAt = Date.now(); // reset the half-open timer
      }
    }
  }

  private async checkTimeouts(): Promise<void> {
    if (this.isCircuitOpen()) {
      this.logger.debug('SupervisionTimeoutWatcherJob: circuit-breaker open — skipping check');
      return;
    }

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
            AND (NOT IS_DEFINED(c.supervisoryCosignedAt) OR IS_NULL(c.supervisoryCosignedAt))
            AND (NOT IS_DEFINED(c.requiresHumanIntervention) OR c.requiresHumanIntervention != true)
            AND IS_DEFINED(c.supervisorId)
        `,
      }).fetchAll();

      this.recordCbSuccess();

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
        this.recordCbFailure();
      } else {
        this.logger.error('Supervision timeout check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async processCandidate(order: any): Promise<void> {
    // Guard: skip records with no tenantId — cannot use as partition key and getConfig would throw.
    if (!order.tenantId) {
      this.logger.warn('Supervision timeout watcher: order has no tenantId — skipping', { orderId: order.id });
      return;
    }
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

      const tenantConfig = await this.tenantConfigService.getConfig(order.clientId);
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
        // Clear any prior acknowledgement so this re-flags in the Needs Attention panel.
        { op: 'add', path: '/attentionAcknowledgedAt', value: null },
        { op: 'add', path: '/attentionAcknowledgedBy', value: null },
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
          clientId: order.clientId,
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
