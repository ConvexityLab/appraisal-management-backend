/**
 * Admin Events Controller (E-11)
 *
 * POST /api/admin/events/:eventId/replay
 *   Re-publishes a previously-captured event from `engagement-audit-events`
 *   back to Service Bus so downstream subscribers can re-process it.
 *
 *   Idempotency: replays get a NEW `event.id` so Service Bus duplicate
 *   detection does NOT drop them (dedup would otherwise defeat the replay).
 *   The replay is itself recorded as a `human.intervention` audit event so
 *   operators can see who replayed what, when.
 *
 *   Authz: requires admin role (via authzMiddleware.authorize('admin_panel', 'manage')).
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { AuditEventDoc } from '../services/audit-event-sink.service.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

export function createAdminEventsRouter(
  dbService: CosmosDbService,
  authzMiddleware?: AuthorizationMiddleware,
): Router {
  const router = Router();
  const logger = new Logger('AdminEventsController');
  const publisher = new ServiceBusEventPublisher();

  // Fallback guard only when authz middleware is unavailable in a narrow test
  // harness. Real runtime should always pass authz middleware.
  const ensureAdmin = (req: Request, res: Response): boolean => {
    const role = (req as any).userProfile?.role ?? (req as any).user?.role;
    if (role === 'admin') return true;
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Event replay requires admin role' },
    });
    return false;
  };

  const guard = authzMiddleware
    ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('admin_panel', 'manage')]
    : [];

  router.post('/events/:eventId/replay', ...guard, async (req: Request, res: Response) => {
    if (!authzMiddleware && !ensureAdmin(req, res)) return;

    const { eventId } = req.params;
    const user = (req as any).user;
    const userId = user?.id ?? 'unknown';
    const userName = user?.displayName ?? user?.email ?? userId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    if (!eventId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'eventId is required' } });
    }

    try {
      const container = dbService.getContainer('engagement-audit-events');

      // Cross-partition read by id — the caller does not know the engagementId
      // that partitions the container.
      const { resources } = await container.items
        .query<AuditEventDoc>({
          query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: eventId }],
        })
        .fetchAll();
      const original = resources[0];

      if (!original) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Audit event ${eventId} not found` },
        });
      }

      // Build a fresh event with a new id so Service Bus dedup does NOT drop
      // the replay. Preserve the original's type, category, source, and data.
      const replayEventId = uuidv4();
      const replayEvent = {
        id: replayEventId,
        type: original.eventType,
        timestamp: new Date(),
        source: `${original.source}:replay`,
        version: '1.0',
        category: original.category as EventCategory,
        correlationId: req.headers['x-correlation-id'] as string | undefined,
        data: {
          ...original.data,
          _replayedFromEventId: original.id,
          _replayedAt: new Date().toISOString(),
          _replayedBy: userId,
        },
      };

      await publisher.publish(replayEvent as any);
      logger.info('Replayed event', {
        originalEventId: original.id,
        replayEventId,
        eventType: original.eventType,
        replayedBy: userId,
      });

      // Audit the replay action itself so it is visible in the engagement stream.
      try {
        const interventionEvent = {
          id: uuidv4(),
          type: 'human.intervention',
          timestamp: new Date(),
          source: 'admin-events-controller',
          version: '1.0',
          category: EventCategory.SYSTEM,
          data: {
            action: 'event.replay',
            engagementId: original.engagementId,
            orderId: original.orderId,
            tenantId: original.tenantId,
            userId,
            userName,
            reason: reason ?? undefined,
            triggeredByEventId: original.id,
            triggeredByEventType: original.eventType,
            replayEventId,
            priority: EventPriority.NORMAL,
          },
        };
        await publisher.publish(interventionEvent as any);
      } catch (auditErr) {
        logger.warn('Replay audit publish failed — non-fatal', {
          originalEventId: original.id,
          replayEventId,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          originalEventId: original.id,
          replayEventId,
          eventType: original.eventType,
          replayedAt: new Date().toISOString(),
          replayedBy: userId,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Event replay failed', { eventId, error: msg });
      return res.status(500).json({ success: false, error: { code: 'REPLAY_FAILED', message: msg } });
    }
  });

  return router;
}
