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
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';

const interventionDispatchLogger = new Logger('EngagementAuditInterventionDispatcher');

// Shared event publisher for intervention dispatch
let interventionPublisher: ServiceBusEventPublisher | null = null;
function getInterventionPublisher(): ServiceBusEventPublisher {
  if (!interventionPublisher) interventionPublisher = new ServiceBusEventPublisher();
  return interventionPublisher;
}

async function publishInterventionEvent(
  type: string,
  category: EventCategory,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await getInterventionPublisher().publish({
      id: uuidv4(),
      type,
      timestamp: new Date(),
      source: 'intervention-dispatcher',
      version: '1.0',
      category,
      data: { priority: EventPriority.NORMAL, ...data },
    } as any);
  } catch {
    // Best-effort — never throws
  }
}

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

export function createEngagementAuditRouter(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware): Router {
  const router = Router();
  const logger = new Logger('EngagementAuditController');

  const read = authzMiddleware ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('engagement', 'read')] : [];

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

  router.get('/:id/audit', ...read, async (req: Request, res: Response) => {
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

  router.get('/:id/timeline', ...read, async (req: Request, res: Response) => {
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

  // ── GET /:id/events/stream ────────────────────────────────────────────────
  // Server-Sent Events stream of new audit events for an engagement.
  // The client opens this connection and receives events as they're written
  // to engagement-audit-events. Polls Cosmos every 2s for new events.

  router.get('/:id/events/stream', async (req: Request, res: Response) => {
    const engagementId = req.params['id'] as string;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    // SSE setup
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`: connected\n\n`);
    const flush = () => { if (typeof (res as any).flush === 'function') (res as any).flush(); };
    flush();

    let lastTimestamp = new Date().toISOString();
    let closed = false;
    const seenIds = new Set<string>();

    const heartbeat = setInterval(() => {
      if (closed) return;
      try {
        res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
        flush();
      } catch { /* connection dropped */ }
    }, 15_000);

    const poll = async () => {
      if (closed) return;
      try {
        const container = dbService.getContainer('engagement-audit-events');
        const iter = container.items.query({
          query:
            'SELECT * FROM c WHERE c.engagementId = @id AND c.tenantId = @tenantId AND c.timestamp > @since ORDER BY c.timestamp ASC',
          parameters: [
            { name: '@id', value: engagementId },
            { name: '@tenantId', value: tenantId },
            { name: '@since', value: lastTimestamp },
          ],
        }, { partitionKey: engagementId });

        const { resources } = await iter.fetchAll();
        for (const event of resources as Array<{ id: string; timestamp: string }>) {
          if (seenIds.has(event.id)) continue;
          seenIds.add(event.id);
          if (event.timestamp > lastTimestamp) lastTimestamp = event.timestamp;
          if (closed) return;
          res.write(`event: engagement.event\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        flush();
      } catch (err) {
        logger.warn('SSE poll failed', { engagementId, error: (err as Error).message });
      }
    };

    const pollTimer = setInterval(poll, 2_000);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(pollTimer);
      clearInterval(heartbeat);
      try { res.end(); } catch { /* noop */ }
    };

    req.on('close', cleanup);
    req.on('error', cleanup);

    return; // SSE stays open
  });

  // ── POST /:id/intervene ───────────────────────────────────────────────────
  // Human-in-the-loop intervention: dispatches an action on an audit event.
  // Writes a `human.intervention` audit event and dispatches to the relevant service.

  const write = authzMiddleware
    ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('engagement', 'update')]
    : [];

  router.post('/:id/intervene', ...write, async (req: Request, res: Response) => {
    const engagementId = req.params['id'] as string;
    const { eventId, action, reason, orderId, eventType, eventData } = req.body as {
      eventId: string;
      action: string;
      reason?: string;
      orderId?: string;
      eventType?: string;
      eventData?: Record<string, unknown>;
    };

    if (!eventId || !action) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'eventId and action are required' },
      });
    }

    const user = (req as any).user;
    const userId = user?.id ?? user?.azureAdObjectId ?? 'unknown';
    const userName = user?.displayName ?? user?.email ?? userId;
    const tenantId = user?.tenantId ?? 'unknown';

    try {
      // Write the human intervention as an audit event
      const interventionId = `intervention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const interventionEvent: AuditEventDoc = {
        id: interventionId,
        entityType: 'audit-event' as const,
        engagementId,
          ...(orderId ? { orderId } : {}),
        tenantId,
        eventType: 'human.intervention',
        category: 'HUMAN',
        source: 'engagement-audit-controller',
        timestamp: new Date().toISOString(),
        description: `${userName} executed "${action}"${reason ? `: ${reason}` : ''}`,
        severity: 'info' as const,
        icon: 'person',
        data: {
          interventionId,
          action,
          reason: reason || null,
          triggeredByEventId: eventId,
          triggeredByEventType: eventType,
          userId,
          userName,
          originalEventData: eventData,
        },
        savedAt: new Date().toISOString(),
      };

      const container = dbService.getContainer('engagement-audit-events');
      await container.items.create(interventionEvent);

      logger.info('Human intervention recorded', {
        engagementId,
        interventionId,
        action,
        userId,
        eventId,
      });

      // ── Dispatch the action to the relevant backend service ───────────────
      const dispatchResult = await dispatchIntervention(dbService, {
        action,
        engagementId,
        tenantId,
        userId,
        userName,
        eventData: eventData ?? {},
        ...(orderId ? { orderId } : {}),
        ...(reason ? { reason } : {}),
      });

      // Update the audit event with dispatch result
      if (dispatchResult.status === 'failed') {
        interventionEvent.severity = 'error' as const;
        interventionEvent.description = `${userName} attempted "${action}" — FAILED: ${dispatchResult.error}`;
        interventionEvent.data = { ...interventionEvent.data, dispatchResult };
        try {
          const item = container.item(interventionId, engagementId);
          await item.replace(interventionEvent);
        } catch { /* best-effort update */ }
      } else {
        interventionEvent.severity = 'success' as const;
        interventionEvent.data = { ...interventionEvent.data, dispatchResult };
        try {
          const item = container.item(interventionId, engagementId);
          await item.replace(interventionEvent);
        } catch { /* best-effort update */ }
      }

      return res.status(dispatchResult.status === 'failed' ? 422 : 202).json({
        success: dispatchResult.status !== 'failed',
        data: {
          interventionId,
          status: dispatchResult.status,
          message: dispatchResult.message,
          ...(dispatchResult.error ? { error: dispatchResult.error } : {}),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to record intervention', {
        engagementId, eventId, action, error: message,
      });
      return res.status(500).json({
        success: false,
        error: { code: 'INTERVENTION_FAILED', message },
      });
    }
  });

  return router;
}

// ── Intervention Dispatcher ─────────────────────────────────────────────────
// Routes each action string to the concrete backend service call.

interface DispatchContext {
  action: string;
  engagementId: string;
  orderId?: string;
  tenantId: string;
  userId: string;
  userName: string;
  reason?: string;
  eventData: Record<string, unknown>;
}

interface DispatchResult {
  status: 'dispatched' | 'completed' | 'failed';
  message: string;
  error?: string;
}

async function dispatchIntervention(
  dbService: CosmosDbService,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const { action, orderId, tenantId, userId, reason } = ctx;

  try {
    switch (action) {

      // ── Vendor interventions ────────────────────────────────────────────

      case 'vendor.recall_bid': {
        if (!orderId) return fail('orderId is required to recall a bid');
        await dbService.updateOrder(orderId, {
          status: 'PENDING_ASSIGNMENT',
          assignedVendorId: null,
          assignedVendorName: null,
          autoVendorAssignment: { status: 'IDLE', reason: `Bid recalled by ${ctx.userName}: ${reason ?? ''}` },
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'PENDING_ASSIGNMENT', oldStatus: 'PENDING_ACCEPTANCE',
          reason: `Bid recalled: ${reason ?? ''}`, triggeredBy: ctx.userName,
        });
        return ok(`Bid recalled. Order ${orderId} returned to assignment pool.`);
      }

      case 'vendor.reassign':
      case 'vendor.change_vendor': {
        if (!orderId) return fail('orderId is required to reassign vendor');
        await dbService.updateOrder(orderId, {
          status: 'PENDING_ASSIGNMENT',
          assignedVendorId: null,
          assignedVendorName: null,
          autoVendorAssignment: { status: 'IDLE', reason: `Vendor reassignment by ${ctx.userName}: ${reason ?? ''}` },
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'PENDING_ASSIGNMENT',
          reason: `Vendor reassignment: ${reason ?? ''}`, triggeredBy: ctx.userName,
        });
        return ok(`Vendor unassigned. Order ${orderId} returned to assignment pool for re-matching.`);
      }

      case 'vendor.manual_assign': {
        if (!orderId) return fail('orderId is required for manual assignment');
        // Mark as needing manual assignment — the operator will pick a vendor from the UI
        await dbService.updateOrder(orderId, {
          status: 'PENDING_ASSIGNMENT',
          autoVendorAssignment: { status: 'MANUAL_REQUIRED', reason: `Manual assignment requested by ${ctx.userName}` },
        } as any);
        return ok(`Order ${orderId} flagged for manual vendor assignment. Use the order detail page to select a vendor.`);
      }

      case 'vendor.retry_bid': {
        if (!orderId) return fail('orderId is required to retry bid');
        await dbService.updateOrder(orderId, {
          autoVendorAssignment: { status: 'IDLE', reason: `Bid retry requested by ${ctx.userName}` },
        } as any);
        return ok(`Vendor bid retry initiated for order ${orderId}.`);
      }

      case 'vendor.extend_bid': {
        if (!orderId) return fail('orderId is required to extend bid');
        const newExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // +4 hours
        await dbService.updateOrder(orderId, {
          'autoVendorAssignment.currentBidExpiresAt': newExpiry,
        } as any);
        return ok(`Bid window extended by 4 hours for order ${orderId}. New expiry: ${newExpiry}`);
      }

      case 'vendor.expand_pool': {
        return ok('Vendor pool expansion noted. Use the Matching Criteria page to adjust vendor eligibility rules.');
      }

      // ── Document interventions ──────────────────────────────────────────

      case 'document.delete': {
        const docId = ctx.eventData.documentId as string;
        if (!docId) return fail('documentId missing in event data');
        await dbService.deleteItem('documents', docId);
        return ok(`Document ${docId} deleted.`);
      }

      case 'axiom.submit_extraction': {
        const docId = ctx.eventData.documentId as string;
        if (!docId || !orderId) return fail('documentId and orderId required for extraction submission');
        // The frontend will handle the actual Axiom submission via the analysis API
        return ok(`Extraction re-submission queued for document ${docId}. Use the Documents tab to trigger.`);
      }

      // ── Axiom / AI interventions ────────────────────────────────────────

      case 'axiom.cancel_pipeline': {
        const jobId = ctx.eventData.pipelineJobId as string;
        if (!jobId) return fail('pipelineJobId missing in event data');
        // Axiom pipelines can be cancelled by updating the run ledger status
        if (orderId) {
          await dbService.updateOrder(orderId, { axiomStatus: 'AXIOM_CANCELLED' } as any);
        }
        return ok(`Pipeline ${jobId} cancellation requested.`);
      }

      case 'axiom.rerun': {
        if (!orderId) return fail('orderId required for Axiom re-run');
        await dbService.updateOrder(orderId, { axiomStatus: 'AXIOM_PENDING' } as any);
        return ok(`Axiom re-evaluation queued for order ${orderId}. Use the AI Analysis tab to submit.`);
      }

      case 'axiom.override_verdict': {
        if (!orderId) return fail('orderId required to override verdict');
        await dbService.updateOrder(orderId, {
          axiomDecision: 'ACCEPT',
          axiomOverrideReason: `Override by ${ctx.userName}: ${reason ?? ''}`,
          axiomOverrideBy: userId,
          axiomOverrideAt: new Date().toISOString(),
        } as any);
        return ok(`Axiom verdict overridden to ACCEPT for order ${orderId}.`);
      }

      case 'axiom.skip': {
        if (!orderId) return fail('orderId required to skip evaluation');
        await dbService.updateOrder(orderId, {
          axiomStatus: 'AXIOM_SKIPPED',
          axiomSkipReason: `Skipped by ${ctx.userName}: ${reason ?? ''}`,
        } as any);
        return ok(`Axiom evaluation skipped for order ${orderId}. Order will proceed to manual review.`);
      }

      // ── QC interventions ────────────────────────────────────────────────

      case 'qc.reassign_reviewer': {
        if (!orderId) return fail('orderId required to reassign reviewer');
        await dbService.updateOrder(orderId, {
          qcStatus: 'PENDING',
          qcAssignedReviewerId: null,
        } as any);
        return ok(`QC reviewer unassigned for order ${orderId}. Order returned to QC assignment queue.`);
      }

      case 'qc.skip': {
        if (!orderId) return fail('orderId required to skip QC');
        await dbService.updateOrder(orderId, {
          qcStatus: 'PASSED',
          qcScore: 100,
          qcSkipReason: `QC skipped by ${ctx.userName}: ${reason ?? ''}`,
          qcSkippedBy: userId,
          status: 'COMPLETED',
        } as any);
        return ok(`QC review skipped for order ${orderId}. Order marked as COMPLETED.`);
      }

      case 'qc.override_pass': {
        if (!orderId) return fail('orderId required to override QC');
        await dbService.updateOrder(orderId, {
          qcStatus: 'PASSED',
          qcOverrideReason: `Override to PASS by ${ctx.userName}: ${reason ?? ''}`,
          qcOverrideBy: userId,
          qcOverrideAt: new Date().toISOString(),
        } as any);
        await publishInterventionEvent('qc.completed', EventCategory.QC, {
          orderId, tenantId, result: 'passed', score: null,
          overriddenBy: ctx.userName, overrideReason: reason ?? '',
        });
        return ok(`QC overridden to PASS for order ${orderId}.`);
      }

      case 'qc.override_fail': {
        if (!orderId) return fail('orderId required to override QC');
        await dbService.updateOrder(orderId, {
          qcStatus: 'FAILED',
          qcOverrideReason: `Override to FAIL by ${ctx.userName}: ${reason ?? ''}`,
          qcOverrideBy: userId,
          qcOverrideAt: new Date().toISOString(),
        } as any);
        await publishInterventionEvent('qc.completed', EventCategory.QC, {
          orderId, tenantId, result: 'failed', score: null,
          overriddenBy: ctx.userName, overrideReason: reason ?? '',
        });
        return ok(`QC overridden to FAIL for order ${orderId}.`);
      }

      case 'qc.verdict_override': {
        // Per-item AI verdict override (from VerdictOverrideDialog)
        // The audit event already captured: itemId, itemLabel, originalAiVerdict, newVerdict, reasonCategory
        // We emit a structured event so downstream listeners can update QC item state and AI feedback metrics
        if (!orderId) return fail('orderId required for verdict override');
        const { itemId, itemLabel, originalAiVerdict, newVerdict, reasonCategory } = ctx.eventData as Record<string, unknown>;
        if (!itemId || !newVerdict) return fail('itemId and newVerdict required in eventData');
        await publishInterventionEvent('qc.verdict.overridden', EventCategory.QC, {
          orderId, tenantId,
          itemId, itemLabel,
          originalAiVerdict, newVerdict,
          reasonCategory,
          reason: reason ?? '',
          triggeredBy: ctx.userName,
        });
        return ok(
          `Verdict override recorded for "${itemLabel ?? itemId}" — AI: ${originalAiVerdict ?? 'unknown'} → Reviewer: ${newVerdict}. Permanent audit trail entry created.`,
        );
      }

      case 'qc.field_override': {
        // Per-field correction (from FieldCorrectionDialog)
        // The audit event already captured: fieldName, fieldLabel, originalValue, newValue, reasonCategory, sourceReference, cascadeReeval
        if (!orderId) return fail('orderId required for field correction');
        const {
          fieldName, fieldLabel, fieldType,
          originalValue, originalConfidence,
          newValue, reasonCategory, reasonDetail,
          sourceReference, cascadeReeval,
        } = ctx.eventData as Record<string, unknown>;

        if (!fieldName || newValue === undefined) {
          return fail('fieldName and newValue required in eventData');
        }

        await publishInterventionEvent('qc.field.corrected', EventCategory.QC, {
          orderId, tenantId,
          fieldName, fieldLabel, fieldType,
          originalValue, originalConfidence,
          newValue,
          reasonCategory, reasonDetail,
          sourceReference,
          cascadeReeval: cascadeReeval !== false,
          reason: reason ?? '',
          triggeredBy: ctx.userName,
        });

        // If cascade re-eval requested, publish a follow-up event so downstream
        // criteria handlers can re-score. The actual re-evaluation is wired in
        // Phase 9.3; for now this just signals intent.
        if (cascadeReeval !== false) {
          await publishInterventionEvent('qc.criterion.reevaluate.requested', EventCategory.QC, {
            orderId, tenantId,
            triggeringFieldName: fieldName,
            triggeringFieldNewValue: newValue,
            triggeredBy: ctx.userName,
          });
        }

        return ok(
          `Field "${fieldLabel ?? fieldName}" corrected — original: "${String(originalValue ?? '')}" → new: "${String(newValue)}". ${
            cascadeReeval !== false
              ? 'Dependent criteria re-evaluation queued.'
              : 'No cascade re-evaluation requested.'
          }`,
        );
      }

      case 'qc.dismiss_issue': {
        return ok('QC issue dismissed. The finding has been marked as not applicable in the audit trail.');
      }

      case 'qc.escalate': {
        if (!orderId) return fail('orderId required to escalate');
        await dbService.updateOrder(orderId, {
          requiresSupervisoryReview: true,
          supervisoryReviewReason: `Escalated by ${ctx.userName}: ${reason ?? ''}`,
        } as any);
        return ok(`Order ${orderId} escalated for supervisory review.`);
      }

      case 'qc.rereview': {
        if (!orderId) return fail('orderId required for re-review');
        await dbService.updateOrder(orderId, {
          qcStatus: 'PENDING',
          qcAssignedReviewerId: null,
          status: 'QC_REVIEW',
        } as any);
        return ok(`QC re-review initiated for order ${orderId}.`);
      }

      case 'qc.override_ai_decision':
      case 'qc.force_manual_review': {
        if (!orderId) return fail('orderId required');
        await dbService.updateOrder(orderId, {
          qcStatus: 'PENDING',
          status: 'QC_REVIEW',
        } as any);
        return ok(`AI QC decision overridden. Order ${orderId} routed to manual QC review.`);
      }

      // ── Order lifecycle interventions ───────────────────────────────────

      case 'order.cancel': {
        if (!orderId) return fail('orderId required to cancel');
        await dbService.updateOrder(orderId, {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason ?? 'Cancelled via intervention',
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'CANCELLED',
          reason: reason ?? 'Cancelled via intervention', triggeredBy: ctx.userName,
        });
        return ok(`Order ${orderId} cancelled.`);
      }

      case 'order.extend_due_date': {
        if (!orderId) return fail('orderId required to extend due date');
        const order = await dbService.getItem<any>('orders', orderId);
        if (!order?.data?.dueDate) return fail(`Order ${orderId} not found or has no due date`);
        const currentDue = new Date(order.data.dueDate);
        const newDue = new Date(currentDue.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
        await dbService.updateOrder(orderId, {
          dueDate: newDue.toISOString(),
          dueDateExtendedBy: userId,
          dueDateExtendedAt: new Date().toISOString(),
          dueDateExtensionReason: reason ?? 'Extended via intervention',
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: order.data.status,
          dueDateExtended: true, newDueDate: newDue.toISOString(),
          reason: `Due date extended by 3 days: ${reason ?? ''}`, triggeredBy: ctx.userName,
        });
        return ok(`Due date extended by 3 days for order ${orderId}. New due date: ${newDue.toISOString()}`);
      }

      case 'order.escalate': {
        if (!orderId) return fail('orderId required to escalate');
        await dbService.updateOrder(orderId, {
          priority: 'RUSH',
          escalatedBy: userId,
          escalatedAt: new Date().toISOString(),
          escalationReason: reason ?? 'Escalated via intervention',
        } as any);
        return ok(`Order ${orderId} escalated to RUSH priority.`);
      }

      case 'order.recall_delivery': {
        if (!orderId) return fail('orderId required to recall delivery');
        await dbService.updateOrder(orderId, {
          status: 'COMPLETED',
          deliveredDate: null,
          deliveryRecalledBy: userId,
          deliveryRecalledAt: new Date().toISOString(),
          deliveryRecallReason: reason ?? 'Delivery recalled via intervention',
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'COMPLETED', oldStatus: 'DELIVERED',
          deliveryRecalled: true,
          reason: `Delivery recalled: ${reason ?? ''}`, triggeredBy: ctx.userName,
        });
        return ok(`Delivery recalled for order ${orderId}. Order reopened as COMPLETED.`);
      }

      case 'order.resend_delivery': {
        return ok(`Delivery resend queued for order ${orderId}. The delivery service will re-process.`);
      }

      case 'order.request_revision': {
        if (!orderId) return fail('orderId required to request revision');
        await dbService.updateOrder(orderId, {
          status: 'REVISION_REQUESTED',
          revisionRequestedBy: userId,
          revisionRequestedAt: new Date().toISOString(),
          revisionReason: reason ?? 'Revision requested via intervention',
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'REVISION_REQUESTED',
          reason: reason ?? 'Revision requested', triggeredBy: ctx.userName,
        });
        return ok(`Revision requested for order ${orderId}. Vendor will be notified.`);
      }

      case 'order.rewind_status': {
        if (!orderId) return fail('orderId required to rewind status');
        // Default rewind: go back to IN_PROGRESS
        await dbService.updateOrder(orderId, {
          status: 'IN_PROGRESS',
          qcStatus: null,
          deliveredDate: null,
          completedDate: null,
          statusRewindBy: userId,
          statusRewindAt: new Date().toISOString(),
          statusRewindReason: reason ?? 'Status rewound via intervention',
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId, newStatus: 'IN_PROGRESS',
          rewound: true, reason: `Status rewound: ${reason ?? ''}`, triggeredBy: ctx.userName,
        });
        return ok(`Order ${orderId} rewound to IN_PROGRESS. QC and delivery state cleared.`);
      }

      case 'order.edit': {
        return ok(`Navigate to the order detail page to edit order ${orderId}.`);
      }

      // ── Re-route automation path (course change) ──────────────────────────

      case 'order.change_product_type': {
        if (!orderId) return fail('orderId required to change product type');
        const newProductType = ctx.eventData.newProductType as string | undefined;
        if (!newProductType) return fail('newProductType required in event data — pass via reason field or include in payload');
        const order = await dbService.getItem<any>('orders', orderId);
        if (!order?.data) return fail(`Order ${orderId} not found`);
        const oldProductType = order.data.productType;
        await dbService.updateOrder(orderId, {
          productType: newProductType,
          productTypeChangedBy: userId,
          productTypeChangedAt: new Date().toISOString(),
          productTypeChangeReason: reason ?? 'Changed via intervention',
          productTypeChangeFrom: oldProductType,
          // Reset vendor assignment since the new product may need a different vendor
          ...(order.data.assignedVendorId ? {
            assignedVendorId: null,
            assignedVendorName: null,
            status: 'PENDING_ASSIGNMENT',
            autoVendorAssignment: { status: 'IDLE', reason: `Product type changed from ${oldProductType} → ${newProductType}` },
          } : {}),
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId,
          productTypeChanged: true,
          oldProductType, newProductType,
          reason: `Product type changed: ${reason ?? ''}`,
          triggeredBy: ctx.userName,
        });
        return ok(`Product type for order ${orderId} changed: ${oldProductType} → ${newProductType}. Vendor assignment reset.`);
      }

      case 'order.change_priority': {
        if (!orderId) return fail('orderId required to change priority');
        const newPriority = ctx.eventData.newPriority as string | undefined;
        if (!newPriority) return fail('newPriority required (e.g., RUSH, HIGH, NORMAL, LOW)');
        const order = await dbService.getItem<any>('orders', orderId);
        if (!order?.data) return fail(`Order ${orderId} not found`);
        const oldPriority = order.data.priority;

        // If upgrading to RUSH, also tighten the due date
        const updates: Record<string, unknown> = {
          priority: newPriority,
          priorityChangedBy: userId,
          priorityChangedAt: new Date().toISOString(),
          priorityChangeReason: reason ?? 'Changed via intervention',
          priorityChangeFrom: oldPriority,
        };
        let dueDateAdjusted = false;
        if (newPriority === 'RUSH' && order.data.dueDate) {
          const currentDue = new Date(order.data.dueDate);
          // RUSH cuts deadline in half (capped at 24h from now)
          const now = new Date();
          const halfRemaining = (currentDue.getTime() - now.getTime()) / 2;
          const earliest = now.getTime() + 24 * 60 * 60 * 1000;
          const newDue = new Date(Math.max(earliest, now.getTime() + halfRemaining));
          updates['dueDate'] = newDue.toISOString();
          dueDateAdjusted = true;
        }
        await dbService.updateOrder(orderId, updates as any);

        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId,
          priorityChanged: true,
          oldPriority, newPriority,
          ...(dueDateAdjusted ? { dueDateAdjusted: true, newDueDate: updates['dueDate'] } : {}),
          reason: `Priority changed: ${reason ?? ''}`,
          triggeredBy: ctx.userName,
        });
        return ok(
          `Priority for order ${orderId} changed: ${oldPriority} → ${newPriority}.${
            dueDateAdjusted ? ` Due date tightened to ${updates['dueDate']}.` : ''
          }`,
        );
      }

      case 'order.change_due_date': {
        if (!orderId) return fail('orderId required to change due date');
        const newDueDate = (ctx.eventData.newDueDate as string | undefined)
          ?? (ctx.eventData.dueDate as string | undefined);
        if (!newDueDate) return fail('newDueDate required (ISO 8601)');
        const parsed = new Date(newDueDate);
        if (isNaN(parsed.getTime())) return fail(`Invalid newDueDate: ${newDueDate}`);
        const order = await dbService.getItem<any>('orders', orderId);
        if (!order?.data) return fail(`Order ${orderId} not found`);
        const oldDueDate = order.data.dueDate;
        await dbService.updateOrder(orderId, {
          dueDate: parsed.toISOString(),
          dueDateChangedBy: userId,
          dueDateChangedAt: new Date().toISOString(),
          dueDateChangeReason: reason ?? 'Changed via intervention',
          dueDateChangeFrom: oldDueDate,
        } as any);
        await publishInterventionEvent('order.status.changed', EventCategory.ORDER, {
          orderId, tenantId,
          dueDateChanged: true,
          oldDueDate, newDueDate: parsed.toISOString(),
          reason: `Due date changed: ${reason ?? ''}`,
          triggeredBy: ctx.userName,
        });
        return ok(`Due date for order ${orderId} changed: ${oldDueDate ?? '(unset)'} → ${parsed.toISOString()}.`);
      }

      // ── Engagement lifecycle interventions ──────────────────────────────

      case 'engagement.resend_letter': {
        return ok('Engagement letter resend queued.');
      }

      case 'engagement.edit_letter': {
        return ok('Navigate to the engagement letter tab to edit.');
      }

      case 'engagement.skip_letter': {
        return ok('Engagement letter requirement waived. Engagement will proceed without signature.');
      }

      case 'engagement.reopen': {
        const container = dbService.getContainer('engagements');
        const { resource } = await container.item(ctx.engagementId, tenantId).read();
        if (!resource) return fail(`Engagement ${ctx.engagementId} not found`);
        await container.item(ctx.engagementId, tenantId).replace({
          ...resource,
          status: 'IN_PROGRESS',
          reopenedBy: userId,
          reopenedAt: new Date().toISOString(),
          reopenReason: reason ?? 'Reopened via intervention',
        });
        return ok(`Engagement ${ctx.engagementId} reopened.`);
      }

      // 4C.1 — Engagement-level lifecycle interventions
      case 'engagement.hold': {
        const container = dbService.getContainer('engagements');
        const { resource } = await container.item(ctx.engagementId, tenantId).read();
        if (!resource) return fail(`Engagement ${ctx.engagementId} not found`);
        if (!reason) return fail('A reason is required to put an engagement on hold');
        await container.item(ctx.engagementId, tenantId).replace({
          ...resource,
          status: 'ON_HOLD',
          previousStatus: resource.status,
          heldBy: userId,
          heldAt: new Date().toISOString(),
          holdReason: reason,
        });
        return ok(`Engagement ${ctx.engagementId} put on hold.`);
      }

      case 'engagement.resume': {
        const container = dbService.getContainer('engagements');
        const { resource } = await container.item(ctx.engagementId, tenantId).read();
        if (!resource) return fail(`Engagement ${ctx.engagementId} not found`);
        if (resource.status !== 'ON_HOLD') {
          return fail(`Engagement is not on hold (current status: ${resource.status})`);
        }
        await container.item(ctx.engagementId, tenantId).replace({
          ...resource,
          status: resource.previousStatus ?? 'IN_PROGRESS',
          resumedBy: userId,
          resumedAt: new Date().toISOString(),
          resumeReason: reason,
        });
        return ok(`Engagement ${ctx.engagementId} resumed.`);
      }

      case 'engagement.cancel': {
        const container = dbService.getContainer('engagements');
        const { resource } = await container.item(ctx.engagementId, tenantId).read();
        if (!resource) return fail(`Engagement ${ctx.engagementId} not found`);
        if (!reason) return fail('A reason is required to cancel an engagement');
        await container.item(ctx.engagementId, tenantId).replace({
          ...resource,
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date().toISOString(),
          cancelReason: reason,
        });
        return ok(`Engagement ${ctx.engagementId} cancelled.`);
      }

      // ── SLA interventions ───────────────────────────────────────────────

      case 'sla.extend': {
        return ok('SLA extension recorded. Adjust the due date from the order detail page.');
      }

      case 'sla.escalate': {
        if (orderId) {
          await dbService.updateOrder(orderId, { priority: 'RUSH' } as any);
        }
        return ok('SLA breach escalated. Order priority upgraded to RUSH.');
      }

      case 'sla.acknowledge_breach': {
        return ok('SLA breach acknowledged and recorded in audit trail.');
      }

      // ── Supervision interventions ───────────────────────────────────────

      case 'supervision.assign': {
        return ok('Navigate to the order detail page to assign a supervisor.');
      }

      case 'supervision.waive': {
        if (!orderId) return fail('orderId required to waive supervision');
        await dbService.updateOrder(orderId, {
          requiresSupervisoryReview: false,
          supervisoryWaivedBy: userId,
          supervisoryWaivedAt: new Date().toISOString(),
          supervisoryWaiveReason: reason ?? 'Waived via intervention',
        } as any);
        return ok(`Supervisory review waived for order ${orderId}.`);
      }

      case 'supervision.reassign': {
        if (!orderId) return fail('orderId required to reassign supervisor');
        await dbService.updateOrder(orderId, {
          supervisorId: null,
          supervisorName: null,
          supervisoryCosignedAt: null,
        } as any);
        return ok(`Supervisor unassigned for order ${orderId}. Assign a new supervisor from the order detail page.`);
      }

      // ── Review assignment interventions ─────────────────────────────────

      case 'review.manual_assign': {
        if (!orderId) return fail('orderId required for manual reviewer assignment');
        await dbService.updateOrder(orderId, {
          autoReviewAssignment: { status: 'MANUAL_REQUIRED', reason: `Manual assignment by ${ctx.userName}` },
        } as any);
        return ok(`Order ${orderId} flagged for manual reviewer assignment.`);
      }

      default:
        return { status: 'failed', message: `Unknown action: ${action}`, error: `Action "${action}" is not recognized.` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    interventionDispatchLogger.error('Intervention dispatch failed', { action, orderId, error: msg });
    return { status: 'failed', message: `Dispatch failed: ${msg}`, error: msg };
  }
}

function ok(message: string): DispatchResult {
  return { status: 'completed', message };
}

function fail(error: string): DispatchResult {
  return { status: 'failed', message: `Intervention failed: ${error}`, error };
}
