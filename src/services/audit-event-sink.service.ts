/**
 * Audit Event Sink Service
 *
 * Subscribes to ALL events on the Service Bus `appraisal-events` topic via a
 * dedicated `audit-event-sink` subscription.  Every event is persisted to the
 * `engagement-audit-events` Cosmos container, keyed on the resolved
 * `engagementId`.
 *
 * Design rules:
 *   – Never throws / never abandons the Service Bus message due to a write
 *     failure.  Audit persistence is best-effort; it MUST NOT block the main
 *     event pipeline.
 *   – Uses its own dedicated subscription so it doesn't compete with or
 *     deprive any other consumer.
 *   – If the CosmosDB container is unreachable (firewall / misconfiguration),
 *     a single warning is emitted and subsequent writes are suppressed until
 *     the service is restarted.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import type { BaseEvent, EventHandler, AppEvent } from '../types/events.js';

// ── Audit document shape ──────────────────────────────────────────────────────

export interface AuditEventDoc {
  id: string;
  entityType: 'audit-event';
  engagementId: string;   // always set — resolved from orderId lookup if needed
  orderId?: string;
  tenantId: string;
  eventType: string;
  category: string;
  source: string;
  timestamp: string;      // ISO — copied from the original event
  description: string;    // human-readable summary
  severity: 'info' | 'warning' | 'error' | 'success';
  icon: string;           // Material icon name for the UI
  data: Record<string, unknown>;  // full event.data payload
  savedAt: string;        // ISO — when we wrote this record
}

// ── Event-type metadata ───────────────────────────────────────────────────────

type SeverityValue = 'info' | 'warning' | 'error' | 'success';

interface EventMeta {
  describe: (data: any) => string;
  severity: SeverityValue | ((data: any) => SeverityValue);
  icon: string;
}

const EVENT_META: Record<string, EventMeta> = {
  'engagement.order.created':      { describe: d => `Order ${d.orderNumber ?? d.orderId} created for engagement`, severity: 'info', icon: 'add_circle' },
  'order.created':                  { describe: d => `Order ${d.orderNumber ?? d.orderId} created`, severity: 'info', icon: 'add_circle' },
  'order.status.changed':          { describe: d => `Order status changed: ${d.oldStatus ?? '?'} → ${d.newStatus ?? '?'}`, severity: 'info', icon: 'update' },
  'order.assigned':                 { describe: d => `Order assigned to ${d.vendorName ?? d.vendorId ?? 'vendor'}`, severity: 'info', icon: 'assignment_ind' },
  'order.completed':                { describe: d => `Order marked completed`, severity: 'success', icon: 'check_circle' },
  'order.delivered':                { describe: d => `Order ${d.orderNumber ?? d.orderId} delivered to client portal`, severity: 'success', icon: 'local_shipping' },
  'engagement.status.changed':     { describe: d => `Engagement status → ${d.newStatus}`, severity: 'info', icon: 'business_center' },
  'vendor.bid.sent':               { describe: d => `Bid invitation sent to ${d.vendorName ?? d.vendorId} (attempt ${d.attemptNumber ?? 1})`, severity: 'info', icon: 'send' },
  'vendor.bid.accepted':           { describe: d => `${d.vendorName ?? d.vendorId} accepted the bid`, severity: 'success', icon: 'handshake' },
  'vendor.bid.declined':           { describe: d => `${d.vendorName ?? d.vendorId} declined the bid${d.declineReason ? ': ' + d.declineReason : ''}`, severity: 'warning', icon: 'cancel' },
  'vendor.bid.timeout':            { describe: d => `Bid timed out for ${d.vendorName ?? d.vendorId ?? 'vendor'} (attempt ${d.attemptNumber ?? '?'})`, severity: 'warning', icon: 'timer_off' },
  'vendor.bid.round.started':      { describe: d => `Broadcast bid round ${d.roundNumber ?? 1} started — ${d.vendorCount ?? '?'} vendors invited`, severity: 'info', icon: 'campaign' },
  'vendor.bid.round.exhausted':    { describe: d => `Broadcast bid round ${d.roundNumber ?? 1} exhausted — no vendors accepted`, severity: 'warning', icon: 'do_not_disturb' },
  'vendor.staff.assigned':         { describe: d => `Staff ${d.vendorName ?? d.vendorId} assigned directly (${d.staffRole ?? 'appraiser'})`, severity: 'success', icon: 'person_add' },
  'vendor.assignment.exhausted':   { describe: d => `All ${d.attemptsCount ?? '?'} vendor attempts exhausted — manual assignment required`, severity: 'error', icon: 'error' },
  'vendor.performance.updated':    { describe: d => `Vendor performance score updated to ${d.newScore ?? '?'}`, severity: 'info', icon: 'leaderboard' },
  'vendor.availability.changed':   { describe: d => `Vendor availability changed to ${d.available ? 'available' : 'unavailable'}`, severity: 'info', icon: 'event_available' },
  'review.assignment.requested':   { describe: d => `QC review assignment requested (review ${d.qcReviewId ?? '?'})`, severity: 'info', icon: 'rate_review' },
  'review.assigned':               { describe: d => `QC review assigned to ${d.reviewerName ?? d.reviewerId ?? 'reviewer'}`, severity: 'info', icon: 'assignment' },
  'review.assignment.timeout':     { describe: d => `Review assignment timed out for reviewer (attempt ${d.attemptNumber ?? '?'})`, severity: 'warning', icon: 'hourglass_empty' },
  'review.assignment.exhausted':   { describe: d => `All ${d.attemptsCount ?? '?'} reviewer attempts exhausted — manual assignment required`, severity: 'error', icon: 'error' },
  'review.sla.warning':            { describe: d => `QC review SLA warning — ${d.elapsedPct ?? '?'}% of time elapsed`, severity: 'warning', icon: 'warning' },
  'review.sla.breached':           { describe: d => `QC review SLA breached — deadline passed`, severity: 'error', icon: 'alarm_off' },
  'qc.started':                    { describe: _d => `QC review started`, severity: 'info', icon: 'fact_check' },
  'qc.completed':                  { describe: d => `QC review completed — result: ${d.result ?? '?'}${d.score != null ? ` (score ${d.score})` : ''}`, severity: d => d.result === 'passed' ? 'success' : d.result === 'failed' ? 'error' : 'warning', icon: 'verified' },
  'qc.issue.detected':             { describe: d => `QC issue detected: ${d.issueSummary ?? d.issueType ?? 'unknown issue'}`, severity: 'warning', icon: 'report_problem' },
  'qc.ai.scored':                  { describe: d => `AI QC scored order — decision: ${d.decision ?? '?'} (score ${d.score ?? '?'})`, severity: d => d.decision === 'auto_pass' ? 'success' : d.decision === 'needs_supervision' ? 'warning' : 'info', icon: 'smart_toy' },
  'supervision.required':          { describe: d => `Supervisory review required: ${d.reason ?? 'no reason given'}`, severity: 'warning', icon: 'supervisor_account' },
  'supervision.cosigned':          { describe: d => `Supervisor co-signed the review`, severity: 'success', icon: 'verified_user' },
  'engagement.letter.sent':        { describe: d => `Engagement letter sent to vendor ${d.vendorEmail ?? d.vendorId ?? '?'}`, severity: 'info', icon: 'mail' },
  'engagement.letter.signed':      { describe: d => `Engagement letter signed by vendor`, severity: 'success', icon: 'draw' },
  'engagement.letter.declined':    { describe: d => `Engagement letter declined by vendor${d.reason ? ': ' + d.reason : ''}`, severity: 'warning', icon: 'unpublished' },
  'axiom.evaluation.submitted':    { describe: d => `Axiom evaluation submitted (job ${d.jobId ?? '?'})`, severity: 'info', icon: 'science' },
  'axiom.evaluation.completed':    { describe: d => `Axiom evaluation completed — status: ${d.status ?? '?'}${d.score != null ? `, score ${d.score}` : ''}`, severity: d => d.status === 'passed' ? 'success' : d.status === 'failed' ? 'error' : 'info', icon: 'hub' },
  'system.alert':                  { describe: d => `System alert: ${d.message ?? d.alertType ?? 'unknown'}`, severity: 'warning', icon: 'notifications_active' },
};

const DEFAULT_META: EventMeta = {
  describe: d => `Event received`,
  severity: 'info',
  icon: 'radio_button_checked',
};

function resolveSeverity(meta: EventMeta, data: any): SeverityValue {
  if (typeof meta.severity === 'function') return meta.severity(data);
  return meta.severity;
}

// ── All known event types (complete set) ─────────────────────────────────────

const ALL_EVENT_TYPES: string[] = [
  'order.created',
  'order.status.changed',
  'order.assigned',
  'order.completed',
  'order.delivered',
  'engagement.status.changed',
  'qc.started',
  'qc.completed',
  'qc.issue.detected',
  'qc.ai.scored',
  'vendor.performance.updated',
  'vendor.availability.changed',
  'system.alert',
  'engagement.order.created',
  'vendor.bid.sent',
  'vendor.staff.assigned',
  'vendor.bid.accepted',
  'vendor.bid.timeout',
  'vendor.bid.declined',
  'vendor.assignment.exhausted',
  'review.assignment.requested',
  'review.assigned',
  'review.assignment.timeout',
  'review.assignment.exhausted',
  'engagement.letter.sent',
  'engagement.letter.signed',
  'engagement.letter.declined',
  'axiom.evaluation.submitted',
  'axiom.evaluation.completed',
  'review.sla.warning',
  'review.sla.breached',
  'vendor.bid.round.started',
  'vendor.bid.round.exhausted',
  'supervision.required',
  'supervision.cosigned',
];

// ── Service ───────────────────────────────────────────────────────────────────

export class AuditEventSinkService {
  private readonly logger = new Logger('AuditEventSinkService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private isStarted = false;
  /** Set to true after the first Cosmos write failure so we don't spam logs. */
  private firewallBlocked = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'audit-event-sink',
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AuditEventSinkService already started');
      return;
    }

    // Register the same handler for every known event type.
    // All share a single receiver on the dedicated subscription.
    await Promise.all(
      ALL_EVENT_TYPES.map((eventType) =>
        this.subscriber.subscribe(
          eventType,
          this.makeHandler(eventType, this.onAnyEvent.bind(this)),
        ),
      ),
    );

    this.isStarted = true;
    this.logger.info(`AuditEventSinkService started — listening for ${ALL_EVENT_TYPES.length} event types`);
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all(ALL_EVENT_TYPES.map((t) => this.subscriber.unsubscribe(t).catch(() => {})));
    this.isStarted = false;
    this.logger.info('AuditEventSinkService stopped');
  }

  // ── Core handler ──────────────────────────────────────────────────────────

  private async onAnyEvent(event: AppEvent): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      const doc = await this.buildAuditDoc(event);
      await this.dbService.createItem<AuditEventDoc>('engagement-audit-events', doc);
      this.logger.debug('Audit event persisted', { eventType: event.type, engagementId: doc.engagementId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Treat infrastructure errors as firewall-blocked to avoid log spam.
      if (
        message.includes('ECONNREFUSED') ||
        message.includes('NetworkError') ||
        message.includes('ServiceUnavailable') ||
        message.includes('forbidden') ||
        message.includes('Container') ||
        message.includes('NotFound')
      ) {
        this.firewallBlocked = true;
        this.logger.warn(
          'AuditEventSinkService: CosmosDB unreachable — audit writes suppressed until restart',
          { error: message },
        );
      } else {
        // Transient error — log but do not block.
        this.logger.warn('AuditEventSinkService: failed to persist audit event (non-fatal)', {
          eventType: event.type,
          eventId: event.id,
          error: message,
        });
      }
    }
  }

  // ── Document builder ──────────────────────────────────────────────────────

  private async buildAuditDoc(event: AppEvent): Promise<AuditEventDoc> {
    const data = (event as any).data ?? {};
    const tenantId: string = data.tenantId ?? 'unknown';
    const orderId: string | undefined = data.orderId;
    const engagementId: string = await this.resolveEngagementId(event, data, tenantId);

    const meta = EVENT_META[event.type] ?? DEFAULT_META;
    const severity = resolveSeverity(meta, data);
    const description = meta.describe(data);

    return {
      id: `audit-${event.id}-${Date.now()}`,
      entityType: 'audit-event',
      engagementId,
      ...(orderId ? { orderId } : {}),
      tenantId,
      eventType: event.type,
      category: String(event.category ?? 'unknown'),
      source: event.source ?? 'unknown',
      timestamp: (event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp as any)).toISOString(),
      description,
      severity,
      icon: meta.icon,
      data: data as Record<string, unknown>,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolves the engagementId from the event data.
   *
   * Priority:
   *   1. event.data.engagementId  — most events carry this directly
   *   2. DB lookup via orderId     — for events that only have orderId
   *   3. tenantId/eventType fallback — system events with no entity reference
   */
  private async resolveEngagementId(event: AppEvent, data: any, tenantId: string): Promise<string> {
    // 1. Direct
    if (data.engagementId) return String(data.engagementId);

    // 2. Order lookup
    if (data.orderId && tenantId && tenantId !== 'unknown') {
      try {
        const result = await this.dbService.getItem('orders', String(data.orderId), tenantId);
        const order = (result as any)?.data ?? result;
        if (order?.engagementId) return String(order.engagementId);
      } catch {
        // Fall through to the fallback
      }
    }

    // 3. Fallback
    return data.orderId ? `order-${data.orderId}` : `system-${event.type.split('.')[0]}`;
  }

  // ── Handler factory ───────────────────────────────────────────────────────

  private makeHandler<T extends BaseEvent>(
    _eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        // Best-effort: never re-throw so the Service Bus message is acked
        // regardless of audit persistence outcome.
        await fn(event).catch((err) => {
          this.logger.error('AuditEventSinkService handler error (suppressed)', {
            eventType: event.type,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      },
    };
  }
}
