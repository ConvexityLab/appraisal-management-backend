/**
 * QC Checklist Override Controller (Q-08)
 *
 * POST /api/qc-reviews/:reviewId/questions/:questionId/override
 *   Analyst overrides the AI/system verdict for a single checklist question
 *   with their own value + reason. Writes a `user`-sourced QCAnswer and
 *   appends an entry to `auditTrail` on the QC review record so the override
 *   is visible in the timeline.
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

export function createQCOverrideRouter(
  dbService: CosmosDbService,
  authzMiddleware?: AuthorizationMiddleware,
): Router {
  const router = Router();
  const logger = new Logger('QCOverrideController');
  const publisher = new ServiceBusEventPublisher();

  const write = authzMiddleware
    ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('qc_review', 'update')]
    : [];

  router.post('/:reviewId/questions/:questionId/override', ...write, async (req: Request, res: Response) => {
    const { reviewId, questionId } = req.params;
    const { value, reason } = req.body as { value: unknown; reason?: string };
    const user = (req as any).user;
    const userId = user?.id ?? 'unknown';
    const userName = user?.displayName ?? user?.email ?? userId;
    const tenantId = user?.tenantId;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'value is required' },
      });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'reason is required for overrides' },
      });
    }

    try {
      const reviewResp = (await dbService.getItem<any>('qc-reviews', reviewId!, tenantId)) as any;
      const review = reviewResp?.data;
      if (!review) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `QC review ${reviewId} not found` },
        });
      }

      const now = new Date();
      const newAnswer = {
        questionId,
        value,
        source: 'user' as const,
        timestamp: now,
        reviewedBy: userId,
        reviewedAt: now,
        reviewComments: reason,
      };

      // Record the override on a dedicated `overrides` array so we retain the
      // full history (not just the latest). The execution engine reads `answers`
      // — we mirror the latest override there so subsequent reads see the
      // overridden value.
      const overrides = Array.isArray(review.overrides) ? review.overrides : [];
      const priorAnswer = Array.isArray(review.answers)
        ? review.answers.find((a: any) => a.questionId === questionId)
        : undefined;
      const updatedReview = {
        ...review,
        overrides: [
          ...overrides,
          {
            questionId,
            priorValue: priorAnswer?.value,
            priorSource: priorAnswer?.source,
            newValue: value,
            reason,
            userId,
            userName,
            at: now.toISOString(),
          },
        ],
        answers: [
          ...((review.answers ?? []) as any[]).filter((a: any) => a.questionId !== questionId),
          newAnswer,
        ],
        auditTrail: [
          ...((review.auditTrail ?? []) as any[]),
          {
            timestamp: now,
            action: 'question.override',
            userId,
            details: { questionId, reason, newValue: value },
          },
        ],
        updatedAt: now.toISOString(),
      };

      await dbService.updateItem('qc-reviews', reviewId!, updatedReview, tenantId);

      // Publish human.intervention so the override shows up on the engagement stream.
      try {
        await publisher.publish({
          id: `override-${reviewId}-${questionId}-${Date.now()}`,
          type: 'human.intervention',
          timestamp: now,
          source: 'qc-override-controller',
          version: '1.0',
          category: EventCategory.QC,
          data: {
            action: 'qc.checklist.override',
            reviewId,
            questionId,
            orderId: review.orderId,
            tenantId,
            userId,
            userName,
            reason,
            priority: EventPriority.NORMAL,
          },
        } as any);
      } catch (err) {
        logger.warn('QC override: event publish failed — non-fatal', {
          reviewId,
          questionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return res.status(200).json({ success: true, data: { answer: newAnswer } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('QC override failed', { reviewId, questionId, error: msg });
      return res.status(500).json({ success: false, error: { code: 'OVERRIDE_FAILED', message: msg } });
    }
  });

  return router;
}
