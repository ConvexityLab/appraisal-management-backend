/**
 * Axiom Timeout Watcher Job
 *
 * Monitors orders that have been submitted to Axiom but have not received a
 * webhook callback within the configured `axiomTimeoutMinutes` window.
 *
 * When a timeout is detected:
 *   1. Sets `axiomTimedOut: true` on the order (idempotency guard)
 *   2. Publishes `axiom.evaluation.timeout` so:
 *        - CommunicationEventHandler sends an escalation email
 *        - AutoAssignmentOrchestrator routes the order to human QC
 *
 * Interval: 5 minutes
 * Query scope: orders with `axiomSubmittedAt` set and `axiomEvaluationCompletedAt` unset
 *              and `axiomTimedOut` not already true.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { TenantAutomationConfigService } from '../services/tenant-automation-config.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { AxiomEvaluationTimedOutEvent } from '../types/events.js';

export class AxiomTimeoutWatcherJob {
  private readonly logger = new Logger('AxiomTimeoutWatcherJob');
  private readonly cosmosService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly tenantConfigService: TenantAutomationConfigService;

  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  // Circuit-breaker state for Cosmos 403 (firewall) errors.
  // Opens after 3 consecutive failures; half-opens after 5 min; closes on first success.
  private cbFailureCount = 0;
  private cbOpenedAt: number | null = null;
  private readonly CB_FAILURE_THRESHOLD = 3;
  private readonly CB_HALF_OPEN_MS = 5 * 60 * 1000; // 5 minutes

  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(dbService?: CosmosDbService) {
    this.cosmosService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.tenantConfigService = new TenantAutomationConfigService();
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('AxiomTimeoutWatcherJob already running');
      return;
    }

    this.cbFailureCount = 0;
    this.cbOpenedAt = null;
    this.logger.info('Starting AxiomTimeoutWatcherJob', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
    });

    this.isRunning = true;

    // Run immediately, then on interval
    this.checkTimeouts().catch(err =>
      this.logger.error('Error in initial Axiom timeout check', { error: err }),
    );
    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch(err =>
        this.logger.error('Error in Axiom timeout check', { error: err }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      delete this.intervalId;
    }
    this.isRunning = false;
    this.logger.info('AxiomTimeoutWatcherJob stopped');
  }

  /** P6-A: Returns circuit-breaker state string for the health endpoint. */
  public getCircuitState(): 'closed' | 'open' | 'half-open' {
    if (this.cbOpenedAt === null) return 'closed';
    const elapsed = Date.now() - this.cbOpenedAt;
    if (elapsed >= this.CB_HALF_OPEN_MS) return 'half-open';
    return 'open';
  }

  /** Returns true when the circuit-breaker is open (Cosmos unreachable). */
  private isCircuitOpen(): boolean {
    if (this.cbOpenedAt === null) return false; // closed
    const elapsed = Date.now() - this.cbOpenedAt;
    if (elapsed >= this.CB_HALF_OPEN_MS) return false; // half-open — allow one probe
    return true; // open
  }

  private recordCbSuccess(): void {
    if (this.cbOpenedAt !== null) {
      this.logger.info('AxiomTimeoutWatcherJob: circuit-breaker closed after successful probe');
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
          `AxiomTimeoutWatcherJob: circuit-breaker OPEN after ${this.cbFailureCount} consecutive 403 errors — will retry in ${this.CB_HALF_OPEN_MS / 60_000} min`,
        );
      } else {
        // Already open; reset the half-open timer
        this.cbOpenedAt = Date.now();
      }
    }
  }

  private async checkTimeouts(): Promise<void> {
    if (this.isCircuitOpen()) {
      this.logger.debug('AxiomTimeoutWatcherJob: circuit-breaker open — skipping check');
      return;
    }

    try {
      const container = this.cosmosService.getContainer('orders');

      // Find orders submitted to Axiom but with no completion record and not yet
      // flagged as timed out. We filter by a conservatively recent cutoff in the
      // query and check the per-tenant window in code to avoid a cross-tenant
      // config lookup in the query itself.
      const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

      const { resources: candidates } = await container.items.query({
        query: `
          SELECT * FROM c
          WHERE c.type = 'order'
            AND IS_DEFINED(c.axiomSubmittedAt)
            AND (NOT IS_DEFINED(c.axiomCompletedAt) OR IS_NULL(c.axiomCompletedAt))
            AND (NOT IS_DEFINED(c.axiomStatus) OR (c.axiomStatus != 'completed' AND c.axiomStatus != 'failed'))
            AND (NOT IS_DEFINED(c.axiomTimedOut) OR c.axiomTimedOut != true)
            AND c.axiomSubmittedAt > @cutoff
        `,
        parameters: [{ name: '@cutoff', value: thirtyDaysAgoIso }],
      }).fetchAll();

      this.recordCbSuccess();

      if (candidates.length === 0) {
        this.logger.debug('Axiom timeout check: no candidates found');
        return;
      }

      this.logger.info(`Axiom timeout check: evaluating ${candidates.length} candidate(s)`);

      for (const order of candidates) {
        await this.processCandidate(order);
      }
    } catch (err: any) {
      if (err?.code === 403 || err?.statusCode === 403) {
        this.recordCbFailure();
      } else {
        this.logger.error('Axiom timeout check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async processCandidate(order: any): Promise<void> {
    // P3-E: skip records with no tenantId — cannot use as partition key
    if (!order.tenantId) {
      this.logger.warn('Axiom timeout watcher: order has no tenantId — skipping', { orderId: order.id });
      return;
    }
    // Defense-in-depth: skip orders already completed or failed (the query should exclude them
    // via axiomCompletedAt, but axiomStatus is an additional safety net).
    if (order.axiomStatus === 'completed' || order.axiomStatus === 'failed') {
      this.logger.debug('Axiom timeout watcher: order already in terminal axiomStatus — skipping', {
        orderId: order.id, axiomStatus: order.axiomStatus,
      });
      return;
    }

    try {
      const tenantConfig = await this.tenantConfigService.getConfig(order.clientId);
      if (!tenantConfig.axiomAutoTrigger) {
        // This tenant doesn't use Axiom — skip.
        return;
      }

      const timeoutMs = tenantConfig.axiomTimeoutMinutes * 60_000;
      const submittedAt = new Date(order.axiomSubmittedAt);
      const elapsed = Date.now() - submittedAt.getTime();

      if (elapsed < timeoutMs) {
        // Not yet timed out.
        return;
      }

      this.logger.warn('Axiom evaluation timed out — escalating', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        submittedAt: submittedAt.toISOString(),
        elapsedMinutes: Math.floor(elapsed / 60_000),
        timeoutMinutes: tenantConfig.axiomTimeoutMinutes,
      });

      // Mark as timed out to prevent re-processing.
      const container = this.cosmosService.getContainer('orders');
      await container.item(order.id, order.tenantId).patch([
        { op: 'add', path: '/axiomTimedOut', value: true },
        { op: 'add', path: '/axiomTimedOutAt', value: new Date().toISOString() },
        // Clear any prior acknowledgement so this re-flags in the Needs Attention panel.
        { op: 'add', path: '/attentionAcknowledgedAt', value: null },
        { op: 'add', path: '/attentionAcknowledgedBy', value: null },
        { op: 'add', path: '/updatedAt', value: new Date().toISOString() },
      ]);

      const event: AxiomEvaluationTimedOutEvent = {
        id: uuidv4(),
        type: 'axiom.evaluation.timeout',
        timestamp: new Date(),
        source: 'axiom-timeout-watcher-job',
        version: '1.0',
        category: EventCategory.AXIOM,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tenantId: order.tenantId,
          clientId: order.clientId,
          submittedAt,
          timeoutMinutes: tenantConfig.axiomTimeoutMinutes,
          priority: EventPriority.HIGH,
        },
      };

      await this.publisher.publish(event);
      this.logger.info('axiom.evaluation.timeout published', { orderId: order.id });
    } catch (err: any) {
      // Skip per-order errors — the job continues with remaining orders.
      this.logger.error(`Failed to process Axiom timeout for order ${order.id}`, {
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      });
    }
  }
}
