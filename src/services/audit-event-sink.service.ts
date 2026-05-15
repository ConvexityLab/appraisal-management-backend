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
import { recordEventPublishFailure } from '../utils/event-publish-failure-counter.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { WebPubSubService } from './web-pubsub.service.js';
import {
  OrderContextLoader,
  getPropertyAddress,
} from './order-context-loader.service.js';
import type { BaseEvent, EventHandler, AppEvent } from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

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
  'engagement.order.created':      { describe: d => `Order ${d.orderNumber ?? d.orderId} created${d.productType ? ` (${d.productType})` : ''}${d.propertyAddress ? ` — ${d.propertyAddress}` : ''}`, severity: 'info', icon: 'add_circle' },
  'order.created':                  { describe: d => `Order ${d.orderNumber ?? d.orderId} created${d.productType ? ` (${d.productType})` : ''}${d.propertyAddress ? ` — ${d.propertyAddress}` : ''}`, severity: 'info', icon: 'add_circle' },
  'order.status.changed':          { describe: d => `Order ${d.orderNumber ?? d.orderId ?? ''} status changed: ${d.oldStatus ?? '?'} → ${d.newStatus ?? '?'}`, severity: 'info', icon: 'update' },
  'order.assigned':                 { describe: d => `Order assigned to ${d.vendorName ?? d.vendorId ?? 'vendor'}${d.vendorContact ? ` (${d.vendorContact})` : ''}`, severity: 'info', icon: 'assignment_ind' },
  'order.completed':                { describe: d => `Order ${d.orderNumber ?? d.orderId ?? ''} marked completed`, severity: 'success', icon: 'check_circle' },
  'order.delivered':                { describe: d => `Order ${d.orderNumber ?? d.orderId} delivered to client${d.propertyAddress ? ` — ${d.propertyAddress}` : ''}`, severity: 'success', icon: 'local_shipping' },
  'engagement.status.changed':     { describe: d => `Engagement status → ${d.newStatus}`, severity: 'info', icon: 'business_center' },
  'vendor.bid.sent':               { describe: d => `Bid sent to ${d.vendorName ?? d.vendorId}${d.vendorEmail ? ` <${d.vendorEmail}>` : ''} (attempt ${d.attemptNumber ?? 1})`, severity: 'info', icon: 'send' },
  'vendor.bid.accepted':           { describe: d => `${d.vendorName ?? d.vendorId} accepted the bid${d.vendorContact ? ` (contact: ${d.vendorContact})` : ''}`, severity: 'success', icon: 'handshake' },
  'vendor.bid.declined':           { describe: d => `${d.vendorName ?? d.vendorId} declined${d.declineReason ? ': ' + d.declineReason : ''}`, severity: 'warning', icon: 'cancel' },
  'vendor.bid.timeout':            { describe: d => `Bid timed out for ${d.vendorName ?? d.vendorId ?? 'vendor'} (attempt ${d.attemptNumber ?? '?'})`, severity: 'warning', icon: 'timer_off' },
  'vendor.bid.expiring':           { describe: d => `Reminder sent — ${d.vendorName ?? d.vendorId ?? 'vendor'} bid expires in ${d.minutesRemaining ?? '?'}m`, severity: 'info', icon: 'hourglass_bottom' },
  'vendor.bid.round.started':      { describe: d => `Broadcast bid round ${d.roundNumber ?? 1} started — ${d.vendorCount ?? '?'} vendors invited`, severity: 'info', icon: 'campaign' },
  'vendor.bid.round.exhausted':    { describe: d => `Broadcast bid round ${d.roundNumber ?? 1} exhausted — no vendors accepted`, severity: 'warning', icon: 'do_not_disturb' },
  'vendor.staff.assigned':         { describe: d => `${d.vendorName ?? d.vendorId} assigned directly as ${d.staffRole ?? 'appraiser'}${d.vendorContact ? ` (${d.vendorContact})` : ''}`, severity: 'success', icon: 'person_add' },
  'vendor.assignment.exhausted':   { describe: d => `All ${d.attemptsCount ?? '?'} vendor attempts exhausted — manual assignment required`, severity: 'error', icon: 'error' },
  'vendor.performance.updated':    { describe: d => `${d.vendorName ?? 'Vendor'} performance updated to ${d.newScore ?? '?'}`, severity: 'info', icon: 'leaderboard' },
  'vendor.availability.changed':   { describe: d => `${d.vendorName ?? 'Vendor'} is now ${d.available ? 'available' : 'unavailable'}`, severity: 'info', icon: 'event_available' },
  'review.assignment.requested':   { describe: d => `QC review assignment requested for order ${d.orderNumber ?? d.orderId ?? '?'}`, severity: 'info', icon: 'rate_review' },
  'review.assigned':               { describe: d => `QC review assigned to ${d.reviewerName ?? d.reviewerId ?? 'reviewer'}${d.reviewerEmail ? ` <${d.reviewerEmail}>` : ''}`, severity: 'info', icon: 'assignment' },
  'review.assignment.timeout':     { describe: d => `Review assignment timed out for ${d.reviewerName ?? 'reviewer'} (attempt ${d.attemptNumber ?? '?'})`, severity: 'warning', icon: 'hourglass_empty' },
  'review.assignment.exhausted':   { describe: d => `All ${d.attemptsCount ?? '?'} reviewer attempts exhausted — manual assignment required`, severity: 'error', icon: 'error' },
  'review.sla.warning':            { describe: d => `QC review SLA warning — ${d.elapsedPct ?? '?'}% of time elapsed for order ${d.orderNumber ?? d.orderId ?? ''}`, severity: 'warning', icon: 'warning' },
  'review.sla.breached':           { describe: d => `QC review SLA breached for order ${d.orderNumber ?? d.orderId ?? ''} — deadline passed`, severity: 'error', icon: 'alarm_off' },
  'qc.started':                    { describe: d => `QC review started${d.reviewerName ? ` — assigned to ${d.reviewerName}` : ''}`, severity: 'info', icon: 'fact_check' },
  'qc.completed':                  { describe: d => `QC review completed — ${d.result ?? '?'}${d.score != null ? ` (score ${d.score})` : ''}${d.reviewerName ? ` by ${d.reviewerName}` : ''}`, severity: d => d.result === 'passed' ? 'success' : d.result === 'failed' ? 'error' : 'warning', icon: 'verified' },
  'qc.issue.detected':             { describe: d => `QC issue: ${d.issueSummary ?? d.issueType ?? 'unknown'}${d.severity ? ` (${d.severity})` : ''}`, severity: 'warning', icon: 'report_problem' },
  'qc.ai.scored':                  { describe: d => `AI QC: ${d.decision ?? '?'} (score ${d.score ?? '?'})${d.decision === 'auto_pass' ? ' — auto-approved' : d.decision === 'needs_supervision' ? ' — needs supervisor' : ' — needs manual review'}`, severity: d => d.decision === 'auto_pass' ? 'success' : d.decision === 'needs_supervision' ? 'warning' : 'info', icon: 'smart_toy' },
  'supervision.required':          { describe: d => `Supervisory review required: ${d.reason ?? 'policy'}`, severity: 'warning', icon: 'supervisor_account' },
  'supervision.cosigned':          { describe: d => `Supervisor co-signed${d.supervisorName ? ` (${d.supervisorName})` : ''}`, severity: 'success', icon: 'verified_user' },
  'supervision.timeout':           { describe: d => `Supervisor co-sign timed out (${d.slaHours ?? '?'}h) — escalation required`, severity: 'error', icon: 'person_off' },
  'engagement.letter.sent':        { describe: d => `Engagement letter sent to ${d.vendorName ?? 'vendor'}${d.vendorEmail ? ` <${d.vendorEmail}>` : ''}`, severity: 'info', icon: 'mail' },
  'engagement.letter.signed':      { describe: d => `Engagement letter signed by ${d.vendorName ?? 'vendor'}`, severity: 'success', icon: 'draw' },
  'engagement.letter.declined':    { describe: d => `Engagement letter declined by ${d.vendorName ?? 'vendor'}${d.reason ? ': ' + d.reason : ''}`, severity: 'warning', icon: 'unpublished' },
  'axiom.evaluation.submitted':    { describe: d => `Axiom ${d.pipelineName ?? 'pipeline'} submitted${d.documentName ? ` for ${d.documentName}` : ''} (job ${(d.jobId ?? '?').substring(0, 12)}…)`, severity: 'info', icon: 'science' },
  'axiom.evaluation.completed':    { describe: d => `Axiom ${d.pipelineName ?? 'evaluation'} completed${d.fieldsExtracted ? ` — ${d.fieldsExtracted} fields extracted` : ''}${d.confidence ? ` (${Math.round(d.confidence * 100)}% confidence)` : ''}${d.score != null ? `, risk score ${d.score}` : ''}`, severity: d => d.status === 'passed' ? 'success' : d.status === 'failed' ? 'error' : 'info', icon: 'hub' },
  'axiom.evaluation.timeout':      { describe: d => `Axiom evaluation timed out after ${d.timeoutMinutes ?? '?'}min${d.documentName ? ` for ${d.documentName}` : ''} — routed to human QC`, severity: 'error', icon: 'timer_off' },
  'axiom.evaluation.skipped':      { describe: d => `Axiom evaluation skipped (${d.reason ?? 'unknown reason'})${d.productType ? ` — productType: ${d.productType}` : ''}`, severity: 'warning', icon: 'skip_next' },
  'axiom.evaluation.failed':       { describe: d => `Axiom evaluation submission failed${d.reason ? `: ${d.reason}` : ''}${d.error ? ` — ${d.error}` : ''}`, severity: 'error', icon: 'error' },
  'human.intervention':            { describe: d => `${d.userName ?? 'User'} executed "${d.action}"${d.reason ? `: ${d.reason}` : ''}`, severity: 'info', icon: 'person' },
  'submission.revision.requested': { describe: d => `Revision requested on order ${d.orderId}${d.revisionNotes ? `: ${String(d.revisionNotes).slice(0, 80)}` : ''}`, severity: 'warning', icon: 'edit_note' },
  'review-program.prepare.started': { describe: d => `Preparing ${Array.isArray(d.reviewProgramIds) ? d.reviewProgramIds.length : 0} review program(s)${d.orderId ? ` for order ${d.orderId}` : ''}`, severity: 'info', icon: 'playlist_play' },
  'review-program.prepare.completed': { describe: d => `Prepared ${Array.isArray(d.reviewProgramIds) ? d.reviewProgramIds.length : 0} review program(s)${d.readyProgramCount != null ? ` — ${d.readyProgramCount} ready` : ''}${d.blockedProgramCount ? `, ${d.blockedProgramCount} blocked` : ''}`, severity: d => d.blockedProgramCount > 0 ? 'warning' : 'success', icon: 'playlist_add_check_circle' },
  'review-program.prepare.failed': { describe: d => `Review program preparation failed${d.orderId ? ` for order ${d.orderId}` : ''}${d.error ? ` — ${d.error}` : ''}`, severity: 'error', icon: 'playlist_remove' },
  'review-program.submitted':      { describe: d => `Review program ${d.reviewProgramName ?? d.reviewProgramId ?? 'unknown'} submitted${d.orderNumber ? ` for order ${d.orderNumber}` : d.orderId ? ` for order ${d.orderId}` : ''}`, severity: 'info', icon: 'playlist_add_check_circle' },
  'review-program.dispatch.completed': { describe: d => `Review program ${d.reviewProgramName ?? d.reviewProgramId ?? 'unknown'} dispatch ${String(d.overallStatus ?? 'completed').replace(/_/g, ' ')}${d.submittedLegs != null ? ` — ${d.submittedLegs} submitted` : ''}${d.failedLegs ? `, ${d.failedLegs} failed` : ''}${d.skippedLegs ? `, ${d.skippedLegs} skipped` : ''}`, severity: d => d.overallStatus === 'all_submitted' ? 'success' : d.overallStatus === 'partial' ? 'warning' : 'error', icon: 'rule_folder' },
  'order.overdue':                  { describe: d => `Order ${d.orderNumber ?? d.orderId} is ${d.hoursOverdue ?? 0} hours overdue${d.propertyAddress ? ` — ${d.propertyAddress}` : ''}`, severity: 'error', icon: 'alarm_off' },
  'document.uploaded':             { describe: d => `Document uploaded: ${d.documentName ?? d.fileName ?? d.documentId ?? 'unknown'}${d.documentType ? ` (${d.documentType})` : ''}`, severity: 'info', icon: 'upload_file' },
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
  'vendor.bid.expiring',
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
  'supervision.timeout',
  'order.overdue',
  'axiom.evaluation.timeout',
  'axiom.evaluation.skipped',
  'axiom.evaluation.failed',
  'document.uploaded',
  'human.intervention',
  'submission.revision.requested',
  'review-program.prepare.started',
  'review-program.prepare.completed',
  'review-program.prepare.failed',
  'review-program.submitted',
  'review-program.dispatch.completed',
];

// ── Service ───────────────────────────────────────────────────────────────────

export class AuditEventSinkService {
  private readonly logger = new Logger('AuditEventSinkService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly pubsub: WebPubSubService;
  private readonly contextLoader: OrderContextLoader;
  private isStarted = false;
  /** Set to true after the first Cosmos write failure so we don't spam logs. */
  private firewallBlocked = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.pubsub = new WebPubSubService();
    this.contextLoader = new OrderContextLoader(this.dbService);
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

      // Broadcast to engagement-specific group so connected clients see it instantly
      // Best-effort — never throws, never blocks audit persistence
      try {
        const groupName = `engagement-${doc.engagementId}`;
        await this.pubsub.sendToGroup(groupName, {
          id: doc.id,
          title: 'Engagement event',
          message: doc.description,
          priority: doc.severity === 'error' ? EventPriority.HIGH
            : doc.severity === 'warning' ? EventPriority.NORMAL
            : EventPriority.LOW,
          category: EventCategory.SYSTEM,
          targets: [],
          data: {
            auditEvent: doc, // full enriched audit doc
          },
        });
      } catch (pubErr) {
        // Non-fatal — pub-sub broadcast failure should not affect audit persistence.
        // Record on the failure counter so an outage shows up as a queryable
        // signal instead of being lost in debug logs.
        this.logger.warn('WebPubSub broadcast failed (non-fatal)', {
          eventType: event.type,
          error: pubErr instanceof Error ? pubErr.message : String(pubErr),
        });
        recordEventPublishFailure({
          eventType: event.type,
          error: pubErr,
          source: 'audit-event-sink-service',
          context: { engagementId: doc.engagementId },
        });
      }
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

    // ── Enrich event data with human-readable names ────────────────────────
    const enriched = { ...data };
    await this.enrichEventData(enriched, tenantId);

    const meta = EVENT_META[event.type] ?? DEFAULT_META;
    const severity = resolveSeverity(meta, enriched);
    const description = meta.describe(enriched);

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
      data: enriched as Record<string, unknown>,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Best-effort enrichment: resolve IDs to human-readable names.
   * Never throws — if a lookup fails, the raw ID stays.
   */
  private async enrichEventData(data: Record<string, any>, tenantId: string): Promise<void> {
    const lookups: Promise<void>[] = [];

    // Vendor name enrichment
    if (data.vendorId && !data.vendorName) {
      lookups.push(
        this.dbService.getItem<any>('vendors', data.vendorId, tenantId)
          .then(r => {
            const v = r?.data ?? (r as any);
            if (v?.companyName) {
              data.vendorName = v.companyName;
              data.vendorContact = v.primaryContactName ?? v.contactName;
              data.vendorEmail = v.email ?? v.primaryContactEmail;
              data.vendorPhone = v.phone ?? v.primaryContactPhone;
            }
          })
          .catch(() => {}),
      );
    }

    // Reviewer name enrichment
    if (data.reviewerId && !data.reviewerName) {
      lookups.push(
        this.dbService.getItem<any>('users', data.reviewerId, tenantId)
          .then(r => {
            const u = r?.data ?? (r as any);
            if (u?.displayName) {
              data.reviewerName = u.displayName;
              data.reviewerEmail = u.email;
            }
          })
          .catch(() => {}),
      );
    }

    // Document name enrichment
    if (data.documentId && !data.documentName) {
      lookups.push(
        this.dbService.getItem<any>('documents', data.documentId)
          .then(r => {
            const doc = r?.data ?? (r as any);
            if (doc?.name || doc?.fileName) {
              data.documentName = doc.name ?? doc.fileName;
              data.documentType = doc.documentType ?? doc.category;
              data.documentSize = doc.fileSize;
            }
          })
          .catch(() => {}),
      );
    }

    // Order number enrichment. Phase 7 of Order-relocation: load joined
    // OrderContext so propertyAddress resolves from the parent ClientOrder
    // when the VendorOrder doesn't carry it.
    if (data.orderId && !data.orderNumber) {
      lookups.push(
        this.contextLoader.loadByVendorOrderId(data.orderId, { includeProperty: true })
          .then(ctx => {
            const order = ctx.vendorOrder as { orderNumber?: string; productType?: string };
            if (order?.orderNumber) {
              data.orderNumber = order.orderNumber;
              const addr = getPropertyAddress(ctx);
              data.propertyAddress = addr?.streetAddress
                ? `${addr.streetAddress}, ${addr.city ?? ''} ${addr.state ?? ''}`
                : undefined;
              data.productType = order.productType;
            }
          })
          .catch(() => {}),
      );
    }

    // Axiom pipeline enrichment
    if (data.pipelineJobId && !data.pipelineName) {
      data.pipelineName = data.pipelineId ?? 'adaptive-document-processing';
    }

    await Promise.all(lookups);
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
