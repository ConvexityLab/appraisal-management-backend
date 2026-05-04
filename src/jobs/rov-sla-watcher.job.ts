/**
 * ROV SLA Watcher Job
 *
 * Periodically scans ROV requests in active states
 * (SUBMITTED, UNDER_REVIEW, RESEARCHING, PENDING_RESPONSE) and checks if the
 * SLA deadline (slaTracking.dueDate) has been breached.
 *
 * When a breach is detected:
 *   1. Stamps slaTracking.isOverdue=true on the ROV document (idempotency guard)
 *   2. Appends a SLA_BREACHED timeline entry
 *   3. Publishes escalation.created so the CommunicationEventHandler can alert the team
 *
 * Interval: 10 minutes.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority, EscalationCreatedEvent } from '../types/events.js';
import { ROVStatus } from '../types/rov.types.js';

export class ROVSLAWatcherJob {
  private readonly logger = new Logger('ROVSLAWatcherJob');
  private readonly dbService: CosmosDbService;
  private readonly eventPublisher: ServiceBusEventPublisher;

  private isRunning = false;
  // Circuit-breaker: opens after 3 consecutive errors, half-opens after 5 min.
  private cbFailureCount = 0;
  private cbOpenedAt: number | null = null;
  private readonly CB_FAILURE_THRESHOLD = 3;
  private readonly CB_HALF_OPEN_MS = 5 * 60 * 1000; // 5 minutes
  private intervalId?: NodeJS.Timeout;

  private readonly checkIntervalMs = 10 * 60 * 1000; // 10 minutes

  private readonly ACTIVE_STATUSES = [
    ROVStatus.SUBMITTED,
    ROVStatus.UNDER_REVIEW,
    ROVStatus.RESEARCHING,
    ROVStatus.PENDING_RESPONSE,
  ] as const;

  constructor() {
    this.dbService = new CosmosDbService();
    this.eventPublisher = new ServiceBusEventPublisher();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.cbFailureCount = 0;
    this.cbOpenedAt = null;
    this.logger.info('Starting ROVSLAWatcherJob', { intervalMinutes: this.checkIntervalMs / 60_000 });

    this.run().catch((err) =>
      this.logger.error('ROVSLAWatcherJob: initial run failed', { error: (err as Error).message }),
    );
    this.intervalId = setInterval(() => {
      this.run().catch((err) =>
        this.logger.error('ROVSLAWatcherJob: periodic run failed', { error: (err as Error).message }),
      );
    }, this.checkIntervalMs);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      delete this.intervalId;
    }
    this.logger.info('Stopped ROVSLAWatcherJob');
  }

  // ── Circuit-breaker helpers ────────────────────────────────────────────────

  private isCircuitOpen(): boolean {
    if (this.cbOpenedAt === null) return false;
    return (Date.now() - this.cbOpenedAt) < this.CB_HALF_OPEN_MS;
  }

  private recordCbSuccess(): void {
    if (this.cbOpenedAt !== null) {
      this.logger.info('ROVSLAWatcherJob: circuit-breaker closed after successful probe');
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
          `ROVSLAWatcherJob: circuit-breaker OPEN after ${this.cbFailureCount} consecutive errors — will retry in ${this.CB_HALF_OPEN_MS / 60_000} min`,
        );
      } else {
        this.cbOpenedAt = Date.now(); // reset the half-open timer
      }
    }
  }

  // ── Core scan ──────────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    if (this.isCircuitOpen()) {
      this.logger.debug('ROVSLAWatcherJob: circuit-breaker open — skipping check');
      return;
    }

    let processed = 0;
    let breached = 0;

    try {
      // findROVRequests uses the properly-initialized rovRequestsContainer ('rov-requests').
      const result = await this.dbService.findROVRequests(
        { status: [...this.ACTIVE_STATUSES] },
        0,
        1000, // ROV volumes are low relative to orders; 1000 is a safe upper bound.
      );

      if (!result.success) {
        this.logger.warn('ROVSLAWatcherJob: findROVRequests returned success=false');
        this.recordCbFailure();
        return;
      }

      this.recordCbSuccess();

      const now = new Date();
      processed = result.data.length;

      for (const rov of result.data) {
        // Skip records already marked overdue (idempotency).
        if (rov.slaTracking?.isOverdue) continue;
        if (!rov.slaTracking?.dueDate) continue;

        const dueDate = new Date(rov.slaTracking.dueDate);
        if (now > dueDate) {
          breached++;
          await this.markBreached(rov, now);
        }
      }

      if (processed > 0 || breached > 0) {
        this.logger.info('ROVSLAWatcherJob: check complete', { processed, breached });
      } else {
        this.logger.debug('ROVSLAWatcherJob: no active ROVs found');
      }
    } catch (err: any) {
      if (err?.code === 403 || err?.statusCode === 403 ||
          (err as Error).message?.includes('ECONNREFUSED') ||
          (err as Error).message?.includes('TIMEOUT')) {
        this.recordCbFailure();
      } else {
        this.logger.error('ROVSLAWatcherJob: error during SLA check', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async markBreached(rov: any, now: Date): Promise<void> {
    try {
      const updated = {
        ...rov,
        updatedAt: now,
        slaTracking: {
          ...(rov.slaTracking ?? {}),
          isOverdue: true,
          escalationWarnings: [
            ...(rov.slaTracking?.escalationWarnings ?? []),
            { level: 'CRITICAL', message: 'SLA deadline exceeded', triggeredAt: now },
          ],
        },
        timeline: [
          ...(rov.timeline ?? []),
          {
            id: uuidv4(),
            timestamp: now,
            action: 'SLA_BREACHED',
            performedBy: 'system',
            details: `SLA deadline exceeded on ${now.toISOString()}`,
          },
        ],
      };

      await this.dbService.updateROVRequest(rov.id, updated);

      const event: EscalationCreatedEvent = {
        id: uuidv4(),
        version: '1.0',
        type: 'escalation.created',
        category: EventCategory.ESCALATION,
        timestamp: now,
        source: 'rov-sla-watcher',
        data: {
          escalationId: `esc-${rov.id}`,
          tenantId: rov.tenantId,
          clientId: rov.clientId ?? '',
          orderId: rov.orderId,
          reason: 'ROV SLA deadline breached',
          priority: EventPriority.CRITICAL,
          escalatedBy: 'system',
        },
      };

      await this.eventPublisher.publish(event);
      this.logger.warn('ROV SLA breached — escalation published', {
        rovId: rov.id,
        orderId: rov.orderId,
      });
    } catch (error) {
      this.logger.error('ROVSLAWatcherJob: failed to process breached ROV', {
        rovId: rov.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
