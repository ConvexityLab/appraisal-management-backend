/**
 * Engagement Audit Controller
 *
 * Provides two read-only endpoints on top of the engagement-audit-events
 * Cosmos container written by AuditEventSinkService:
 *
 *   GET /api/engagements/:id/audit
 *     Returns paginated, filterable raw audit events for the engagement.
 *     Query params: page, pageSize, category, severity, eventType, search
 *
 *   GET /api/engagements/:id/timeline
 *     Returns computed lifecycle milestone stages derived from the audit log.
 *     Each stage carries status, timestamps, and the events that belong to it.
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import type { AuditEventDoc } from '../services/audit-event-sink.service.js';

// ── Timeline types (mirrored in the frontend types file) ─────────────────────

export interface TimelineStage {
  key: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending' | 'error' | 'skipped';
  isOptional: boolean;
  /** ISO timestamp when this stage began — undefined if not yet reached. */
  startedAt: string | undefined;
  /** ISO timestamp when this stage completed — undefined if not yet completed. */
  completedAt: string | undefined;
  /** Summary events that drove this stage forward — subset of full audit log. */
  events: AuditEventDoc[];
}

// ── Timeline computation ──────────────────────────────────────────────────────

function computeTimeline(events: AuditEventDoc[]): TimelineStage[] {
  // Index by event type for O(1) lookups
  const byType = new Map<string, AuditEventDoc[]>();
  for (const e of events) {
    const list = byType.get(e.eventType) ?? [];
    list.push(e);
    byType.set(e.eventType, list);
  }

  const hasAny = (...types: string[]): boolean =>
    types.some((t) => (byType.get(t)?.length ?? 0) > 0);

  const firstOf = (...types: string[]): AuditEventDoc | undefined =>
    types
      .flatMap((t) => byType.get(t) ?? [])
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

  const eventsFor = (...types: string[]): AuditEventDoc[] =>
    types
      .flatMap((t) => byType.get(t) ?? [])
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // ── Stage 1: Order Created ─────────────────────────────────────────────────
  const orderCreated = firstOf('engagement.order.created', 'order.created');
  const stageOrderCreated: TimelineStage = {
    key: 'order_created',
    label: 'Order Created',
    description: 'Engagement order placed and pipeline initialized',
    status: orderCreated ? 'completed' : 'pending',
    isOptional: false,
    startedAt: orderCreated?.timestamp,
    completedAt: orderCreated?.timestamp,
    events: eventsFor('engagement.order.created', 'order.created'),
  };

  // ── Stage 2: Vendor Assignment ─────────────────────────────────────────────
  const bidSentFirst = firstOf('vendor.bid.sent', 'vendor.bid.round.started');
  const vendorAssigned = firstOf('vendor.bid.accepted', 'vendor.staff.assigned');
  const vendorExhausted = hasAny('vendor.assignment.exhausted');
  const stageVendorAssignment: TimelineStage = {
    key: 'vendor_assignment',
    label: 'Vendor Assignment',
    description: 'Vendor matching, bid dispatch, and acceptance',
    status: vendorExhausted
      ? 'error'
      : vendorAssigned
      ? 'completed'
      : bidSentFirst
      ? 'active'
      : stageOrderCreated.status === 'completed'
      ? 'pending'
      : 'pending',
    isOptional: false,
    startedAt: bidSentFirst?.timestamp,
    completedAt: vendorAssigned?.timestamp,
    events: eventsFor(
      'vendor.bid.sent',
      'vendor.bid.round.started',
      'vendor.bid.accepted',
      'vendor.bid.declined',
      'vendor.bid.timeout',
      'vendor.bid.round.exhausted',
      'vendor.staff.assigned',
      'vendor.assignment.exhausted',
    ),
  };

  // ── Stage 3: Engagement Letter (optional) ─────────────────────────────────
  const letterSent = firstOf('engagement.letter.sent');
  const letterSigned = firstOf('engagement.letter.signed');
  const letterDeclined = hasAny('engagement.letter.declined');
  const stageEngagementLetter: TimelineStage = {
    key: 'engagement_letter',
    label: 'Engagement Letter',
    description: 'Vendor engagement letter sent, awaiting signature',
    status: !letterSent
      ? 'skipped'
      : letterDeclined
      ? 'error'
      : letterSigned
      ? 'completed'
      : 'active',
    isOptional: true,
    startedAt: letterSent?.timestamp,
    completedAt: letterSigned?.timestamp,
    events: eventsFor('engagement.letter.sent', 'engagement.letter.signed', 'engagement.letter.declined'),
  };

  // ── Stage 4: Axiom Evaluation (optional) ──────────────────────────────────
  const axiomSubmitted = firstOf('axiom.evaluation.submitted');
  const axiomCompleted = firstOf('axiom.evaluation.completed');
  const axiomFailed = axiomCompleted && (axiomCompleted.data as any)?.status === 'failed';
  const stageAxiom: TimelineStage = {
    key: 'axiom_evaluation',
    label: 'Axiom Evaluation',
    description: 'Automated appraisal quality pre-screen',
    status: !axiomSubmitted
      ? 'skipped'
      : axiomFailed
      ? 'error'
      : axiomCompleted
      ? 'completed'
      : 'active',
    isOptional: true,
    startedAt: axiomSubmitted?.timestamp,
    completedAt: axiomCompleted?.timestamp,
    events: eventsFor('axiom.evaluation.submitted', 'axiom.evaluation.completed'),
  };

  // ── Stage 5: Report Submitted ──────────────────────────────────────────────
  const submittedEvent = (byType.get('order.status.changed') ?? []).find(
    (e) => (e.data as any)?.newStatus === 'SUBMITTED',
  );
  const stageReportSubmitted: TimelineStage = {
    key: 'report_submitted',
    label: 'Report Submitted',
    description: 'Vendor submitted the completed appraisal report',
    status: submittedEvent
      ? 'completed'
      : stageVendorAssignment.status === 'completed'
      ? 'active'
      : 'pending',
    isOptional: false,
    startedAt: vendorAssigned?.timestamp,
    completedAt: submittedEvent?.timestamp,
    events: submittedEvent ? [submittedEvent] : [],
  };

  // ── Stage 6: QC Review ─────────────────────────────────────────────────────
  const reviewStarted = firstOf('review.assignment.requested', 'review.assigned');
  const qcDone = firstOf('qc.completed', 'qc.ai.scored');
  const qcFailed =
    (qcDone?.eventType === 'qc.completed' && (qcDone.data as any)?.result === 'failed') ||
    hasAny('review.sla.breached');
  const reviewExhausted = hasAny('review.assignment.exhausted');
  const stageQc: TimelineStage = {
    key: 'qc_review',
    label: 'QC Review',
    description: 'Quality control review by analyst or AI gateway',
    status: reviewExhausted
      ? 'error'
      : qcFailed
      ? 'error'
      : qcDone
      ? 'completed'
      : reviewStarted
      ? 'active'
      : stageReportSubmitted.status === 'completed'
      ? 'pending'
      : 'pending',
    isOptional: false,
    startedAt: reviewStarted?.timestamp,
    completedAt: qcDone?.timestamp,
    events: eventsFor(
      'review.assignment.requested',
      'review.assigned',
      'review.assignment.timeout',
      'review.assignment.exhausted',
      'review.sla.warning',
      'review.sla.breached',
      'qc.started',
      'qc.completed',
      'qc.issue.detected',
      'qc.ai.scored',
      'supervision.required',
      'supervision.cosigned',
    ),
  };

  // ── Stage 7: Delivered ─────────────────────────────────────────────────────
  const deliveredEvent = firstOf('order.delivered');
  const stageDelivered: TimelineStage = {
    key: 'delivered',
    label: 'Delivered',
    description: 'Appraisal report delivered to client portal',
    status: deliveredEvent
      ? 'completed'
      : stageQc.status === 'completed'
      ? 'active'
      : 'pending',
    isOptional: false,
    startedAt: deliveredEvent?.timestamp,
    completedAt: deliveredEvent?.timestamp,
    events: eventsFor('order.delivered'),
  };

  return [
    stageOrderCreated,
    stageVendorAssignment,
    stageEngagementLetter,
    stageAxiom,
    stageReportSubmitted,
    stageQc,
    stageDelivered,
  ];
}

// ── Controller ────────────────────────────────────────────────────────────────

export function createEngagementAuditRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger('EngagementAuditController');

  // ── Helper: query all events for an engagement ────────────────────────────

  async function queryAuditEvents(
    engagementId: string,
    opts: {
      page?: number;
      pageSize?: number;
      category?: string;
      severity?: string;
      eventType?: string;
      search?: string;
      maxItems?: number;
    } = {},
  ): Promise<{ events: AuditEventDoc[]; totalCount: number }> {
    const {
      page = 1,
      pageSize = 50,
      category,
      severity,
      eventType,
      search,
      maxItems,
    } = opts;

    const conditions: string[] = ['c.engagementId = @engagementId'];
    const parameters: Array<{ name: string; value: string | number | boolean | null }> = [
      { name: '@engagementId', value: engagementId },
    ];

    if (category) {
      conditions.push('c.category = @category');
      parameters.push({ name: '@category', value: category as string });
    }
    if (severity) {
      conditions.push('c.severity = @severity');
      parameters.push({ name: '@severity', value: severity as string });
    }
    if (eventType) {
      conditions.push('c.eventType = @eventType');
      parameters.push({ name: '@eventType', value: eventType as string });
    }
    if (search) {
      conditions.push('CONTAINS(LOWER(c.description), @search)');
      parameters.push({ name: '@search', value: (search as string).toLowerCase() });
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;
    const limit = maxItems ?? pageSize;

    const container = dbService.getContainer('engagement-audit-events');

    // Total count
    const countQuery = `SELECT VALUE COUNT(1) FROM c WHERE ${where}`;
    const countResult = await container.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query<number>({ query: countQuery, parameters: parameters as any })
      .fetchAll();
    const totalCount = countResult.resources[0] ?? 0;

    // Data query
    const dataQuery = `SELECT * FROM c WHERE ${where} ORDER BY c.timestamp DESC OFFSET ${offset} LIMIT ${limit}`;
    const dataResult = await container.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query<AuditEventDoc>({ query: dataQuery, parameters: parameters as any })
      .fetchAll();

    return { events: dataResult.resources, totalCount };
  }

  // ── GET /:id/audit ────────────────────────────────────────────────────────

  router.get('/:id/audit', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const { page, pageSize, category, severity, eventType, search } = req.query as Record<string, string>;

    try {
      const { events, totalCount } = await queryAuditEvents(id, {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 200) : 50,
        ...(category  ? { category }  : {}),
        ...(severity  ? { severity }  : {}),
        ...(eventType ? { eventType } : {}),
        ...(search    ? { search }    : {}),
      });

      return res.json({
        success: true,
        data: events,
        totalCount,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 200) : 50,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to query audit events — container may not exist yet', {
        engagementId: id,
        error: message,
      });

      // Return empty list rather than 500 — the container may not exist yet
      // if the sink service has not started writing.
      return res.json({
        success: true,
        data: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        _note: 'No audit events found. The engagement-audit-events container may not be provisioned yet.',
      });
    }
  });

  // ── GET /:id/timeline ─────────────────────────────────────────────────────

  router.get('/:id/timeline', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;

    try {
      // Fetch up to 1000 events (no practical engagement will exceed this)
      const { events } = await queryAuditEvents(id, { maxItems: 1000 });
      const stages = computeTimeline(events);
      const totalEvents = events.length;
      const latestEvent = events[0]; // already sorted DESC

      return res.json({
        success: true,
        data: {
          engagementId: id,
          stages,
          totalEvents,
          latestEventAt: latestEvent?.timestamp,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to compute timeline — returning pending stages', {
        engagementId: id,
        error: message,
      });

      // Return all-pending timeline when the container isn't ready
      return res.json({
        success: true,
        data: {
          engagementId: id,
          stages: computeTimeline([]),
          totalEvents: 0,
          latestEventAt: null,
        },
      });
    }
  });

  return router;
}
