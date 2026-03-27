/**
 * Review SLA Watcher Job
 *
 * Periodically scans QC reviews with status IN_REVIEW and checks if the
 * review SLA is approaching breach (warning at configurable %) or has been
 * breached.
 *
 * Fires two Service Bus events:
 *   - review.sla.warning  — at slaWarningPctThreshold % elapsed (default 80)
 *   - review.sla.breached — when past dueDate
 *
 * Both events carry enough context for the CommunicationEventHandler to send
 * an escalation email without an additional DB lookup.
 *
 * Interval: 5 minutes.
 * Pattern follows SLAMonitoringJob (same style as qc-specific watcher).
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import type {
  ReviewSLAWarningEvent,
  ReviewSLABreachedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

interface QCReviewDoc {
  id: string;
  tenantId?: string;
  orderId?: string;
  orderNumber?: string;
  status?: string;
  sla?: {
    dueDate?: string;
    startedAt?: string;
  };
  reviewers?: Array<{ id?: string; analystId?: string; assignedAt?: string }>;
  slaDueDate?: string;
  /** Track which alerts have already been sent so we don't re-fire on every tick. */
  slaWarningFired?: boolean;
  slaBreachFired?: boolean;
  [key: string]: unknown;
}

export class ReviewSLAWatcherJob {
  private readonly logger = new Logger('ReviewSLAWatcherJob');
  private readonly publisher: ServiceBusEventPublisher;
  private isRunning = false;
  // Circuit-breaker: opens after 3 consecutive DB errors, half-opens after 5 min.
  private cbFailureCount = 0;
  private cbOpenedAt: number | null = null;
  private readonly CB_FAILURE_THRESHOLD = 3;
  private readonly CB_HALF_OPEN_MS = 5 * 60 * 1000;
  private intervalId: NodeJS.Timeout | undefined = undefined;

  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly WARNING_PCT_THRESHOLD = 80;

  constructor(private readonly dbService: CosmosDbService) {
    this.publisher = new ServiceBusEventPublisher();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) {
      this.logger.warn('ReviewSLAWatcherJob already running');
      return;
    }
    this.cbFailureCount = 0;
    this.cbOpenedAt = null;
    this.isRunning = true;
    this.logger.info('ReviewSLAWatcherJob started', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
      warningPct: this.WARNING_PCT_THRESHOLD,
    });

    // Run immediately
    this.checkReviewSLAs().catch((err) =>
      this.logger.error('Error in initial SLA check', { error: (err as Error).message }),
    );

    this.intervalId = setInterval(() => {
      this.checkReviewSLAs().catch((err) =>
        this.logger.error('Error in periodic SLA check', { error: (err as Error).message }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    this.logger.info('ReviewSLAWatcherJob stopped');
  }

  private isCircuitOpen(): boolean {
    if (this.cbOpenedAt === null) return false;
    return (Date.now() - this.cbOpenedAt) < this.CB_HALF_OPEN_MS;
  }

  private recordCbSuccess(): void {
    if (this.cbOpenedAt !== null) {
      this.logger.info('ReviewSLAWatcherJob: circuit-breaker closed after successful probe');
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
          `ReviewSLAWatcherJob: circuit-breaker OPEN after ${this.cbFailureCount} consecutive errors — will retry in ${this.CB_HALF_OPEN_MS / 60_000} min`,
        );
      } else {
        this.cbOpenedAt = Date.now();
      }
    }
  }

  // ── Core check ──────────────────────────────────────────────────────────────────────────

  private async checkReviewSLAs(): Promise<void> {
    if (this.isCircuitOpen()) {
      this.logger.debug('ReviewSLAWatcherJob: circuit-breaker open — skipping check');
      return;
    }

    try {
      const container = this.dbService.getContainer('qc-reviews');
      const now = new Date();

      // Fetch all IN_REVIEW items that have an SLA dueDate and haven't had both alerts fired
      const { resources } = await container.items.query({
        query: `
          SELECT * FROM c
          WHERE (c.status = 'IN_REVIEW' OR c.status = 'IN_PROGRESS')
            AND (c.slaBreachFired != true OR c.slaWarningFired != true)
        `,
      }).fetchAll();

      this.recordCbSuccess();

      let warnCount = 0;
      let breachCount = 0;

      for (const raw of resources as QCReviewDoc[]) {
        const dueDate = this.resolveDueDate(raw);
        if (!dueDate) continue;

        const assignedAt = this.resolveAssignedAt(raw);
        if (!assignedAt) continue;

        const totalMs = dueDate.getTime() - assignedAt.getTime();
        const elapsedMs = now.getTime() - assignedAt.getTime();
        const pctElapsed = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 100;
        const minutesOverdue = Math.round((now.getTime() - dueDate.getTime()) / 60_000);
        const remainingMinutes = Math.round((dueDate.getTime() - now.getTime()) / 60_000);

        const reviewerId = raw.reviewers?.[0]?.id ?? raw.reviewers?.[0]?.analystId ?? 'unknown';
        const orderId = raw.orderId ?? raw.id;
        const orderNumber = raw.orderNumber ?? orderId;
        const tenantId = raw.tenantId ?? '';

        // Breach check (takes priority)
        if (now > dueDate && !raw.slaBreachFired) {
          await this.fireBreachEvent(raw, orderId, orderNumber, tenantId, reviewerId, dueDate, minutesOverdue);
          await this.markAlertFired(container, raw, true, true);
          breachCount++;
          continue;
        }

        // Warning check
        if (pctElapsed >= this.WARNING_PCT_THRESHOLD && !raw.slaWarningFired && !raw.slaBreachFired) {
          await this.fireWarningEvent(raw, orderId, orderNumber, tenantId, reviewerId, pctElapsed, dueDate, remainingMinutes);
          await this.markAlertFired(container, raw, true, false);
          warnCount++;
        }
      }

      if (warnCount > 0 || breachCount > 0) {
        this.logger.info('Review SLA alerts fired', { warnCount, breachCount });
      }
    } catch (err) {
      if ((err as Error).message?.includes('ECONNREFUSED') || (err as Error).message?.includes('TIMEOUT') ||
          (err as any)?.code === 403 || (err as any)?.statusCode === 403) {
        this.recordCbFailure();
      } else {
        this.logger.error('ReviewSLAWatcherJob: error during SLA check', { error: (err as Error).message });
      }
    }
  }

  private async fireWarningEvent(
    review: QCReviewDoc,
    orderId: string,
    orderNumber: string,
    tenantId: string,
    reviewerId: string,
    percentElapsed: number,
    targetDate: Date,
    remainingMinutes: number,
  ): Promise<void> {
    const event: ReviewSLAWarningEvent = {
      id: uuidv4(),
      type: 'review.sla.warning',
      timestamp: new Date(),
      source: 'review-sla-watcher-job',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber,
        tenantId,
        qcReviewId: review.id,
        reviewerId,
        percentElapsed,
        targetDate,
        remainingMinutes,
        priority: EventPriority.HIGH,
      },
    };
    await this.publisher.publish(event).catch((err) =>
      this.logger.warn('Failed to publish review.sla.warning', { orderId, error: (err as Error).message }),
    );
  }

  private async fireBreachEvent(
    review: QCReviewDoc,
    orderId: string,
    orderNumber: string,
    tenantId: string,
    reviewerId: string,
    targetDate: Date,
    minutesOverdue: number,
  ): Promise<void> {
    const event: ReviewSLABreachedEvent = {
      id: uuidv4(),
      type: 'review.sla.breached',
      timestamp: new Date(),
      source: 'review-sla-watcher-job',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber,
        tenantId,
        qcReviewId: review.id,
        reviewerId,
        targetDate,
        minutesOverdue,
        priority: EventPriority.CRITICAL,
      },
    };
    await this.publisher.publish(event).catch((err) =>
      this.logger.warn('Failed to publish review.sla.breached', { orderId, error: (err as Error).message }),
    );
  }

  private async markAlertFired(
    container: ReturnType<CosmosDbService['getContainer']>,
    review: QCReviewDoc,
    warning: boolean,
    breach: boolean,
  ): Promise<void> {
    const updated = { ...review };
    if (warning) updated.slaWarningFired = true;
    if (breach) updated.slaBreachFired = true;
    await container.items.upsert(updated).catch((err) =>
      this.logger.warn('Failed to mark SLA alert fired', { id: review.id, error: (err as Error).message }),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveAssignedAt(review: QCReviewDoc): Date | null {
    const raw =
      review.reviewers?.[0]?.assignedAt ??
      (review.sla?.startedAt as string | undefined) ??
      (review['assignedAt'] as string | undefined);
    return raw ? new Date(raw) : null;
  }

  private resolveDueDate(review: QCReviewDoc): Date | null {
    const raw =
      (review.sla?.dueDate as string | undefined) ??
      review.slaDueDate ??
      (review['dueDate'] as string | undefined);
    return raw ? new Date(raw) : null;
  }
}
