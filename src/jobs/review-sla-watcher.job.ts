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
  private firewallBlocked = false;
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
    this.firewallBlocked = false;
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

  // ── Core check ─────────────────────────────────────────────────────────────

  private async checkReviewSLAs(): Promise<void> {
    if (this.firewallBlocked) return;

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
      if ((err as Error).message?.includes('ECONNREFUSED') || (err as Error).message?.includes('TIMEOUT')) {
        this.firewallBlocked = true;
        this.logger.warn('ReviewSLAWatcherJob: DB unreachable — suspending checks');
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
