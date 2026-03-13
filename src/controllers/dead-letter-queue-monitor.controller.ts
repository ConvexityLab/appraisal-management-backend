/**
 * Dead Letter Queue Monitor Controller
 *
 * Endpoints:
 *   GET    /api/dlq-monitor/stats                        — per-subscription message counts
 *   GET    /api/dlq-monitor/messages?subscription=...    — peek DLQ messages
 *   POST   /api/dlq-monitor/messages/:messageId/reprocess — requeue onto main topic
 *   DELETE /api/dlq-monitor/messages/:messageId          — permanently discard
 */

import express, { Request, Response, Router } from 'express';
import { DeadLetterQueueMonitorService } from '../services/dead-letter-queue-monitor.service.js';
import { Logger } from '../utils/logger.js';

const router: Router = express.Router();
const service = new DeadLetterQueueMonitorService();
const logger = new Logger('DLQMonitorController');

// ── GET /api/dlq-monitor/stats ───────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await service.getDeadLetterStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    logger.error('GET DLQ stats failed', { error: err });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/dlq-monitor/messages ────────────────────────────────────────────

router.get('/messages', async (req: Request, res: Response) => {
  try {
    const subscription = req.query.subscription as string | undefined;
    const maxMessages = req.query.maxMessages ? parseInt(req.query.maxMessages as string, 10) : 50;

    if (isNaN(maxMessages) || maxMessages < 1 || maxMessages > 500) {
      return res.status(400).json({
        error: `Invalid maxMessages value '${req.query.maxMessages}'; must be a number between 1 and 500`,
      });
    }

    const messages = await service.getDeadLetterMessages(subscription, maxMessages);
    return res.json({ success: true, data: messages, count: messages.length });
  } catch (err: any) {
    logger.error('GET DLQ messages failed', { error: err });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/dlq-monitor/messages/:messageId/reprocess ──────────────────────

router.post('/messages/:messageId/reprocess', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({ error: 'subscription is required in request body' });
    }

    await service.reprocessMessage(messageId, subscription);
    return res.json({ success: true, message: `Message ${messageId} requeued onto topic` });
  } catch (err: any) {
    logger.error('POST reprocess DLQ message failed', { error: err });
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/dlq-monitor/messages/:messageId ──────────────────────────────

router.delete('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({ error: 'subscription is required in request body' });
    }

    await service.discardMessage(messageId, subscription);
    return res.json({ success: true, message: `Message ${messageId} permanently discarded` });
  } catch (err: any) {
    logger.error('DELETE DLQ message failed', { error: err });
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
