/**
 * Chat Controller - REST API endpoints for real-time chat
 */

import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { ChatService } from '../services/chat.service';
import { Logger } from '../utils/logger';

const logger = new Logger();
const chatService = new ChatService();

export const createChatRouter = () => {
  const router = express.Router();

  /**
   * POST /api/chat/threads
   * Create new chat thread for order
   */
  router.post(
    '/threads',
    [
      body('topic').isString().notEmpty().withMessage('topic is required'),
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      body('participants').isArray().withMessage('participants must be an array'),
      body('participants.*.id').isString().notEmpty(),
      body('participants.*.displayName').isString().notEmpty(),
      body('participants.*.role').isIn(['vendor', 'amc', 'client', 'system']),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { topic, orderId, participants, tenantId } = req.body;
        const userId = (req as any).user?.id || 'system';
        const result = await chatService.createChatThread(topic, orderId, participants, userId, tenantId);
        res.json(result);
        return;
      } catch (error) {
        logger.error('Error creating chat thread', { error });
        res.status(500).json({ error: 'Failed to create chat thread' });
        return;
      }
    }
  );

  /**
   * GET /api/chat/threads/:orderId
   * Get chat thread for order
   */
  router.get('/threads/:orderId', async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = req.params.orderId as string;
      const tenantIdParam = req.query.tenantId;

      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }

      if (!tenantIdParam || typeof tenantIdParam !== 'string') {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      // Extract the validated string value
      const validatedTenantId = String(tenantIdParam);
      const result = await chatService.getOrderThread(orderId, validatedTenantId);
      res.json(result);
      return;
    } catch (error) {
      logger.error('Error getting chat thread', { error });
      res.status(500).json({ error: 'Failed to get chat thread' });
      return;
    }
  });

  /**
   * POST /api/chat/threads/:threadId/messages
   * Send message to thread
   */
  router.post(
    '/threads/:threadId/messages',
    [
      body('senderId').isString().notEmpty().withMessage('senderId is required'),
      body('senderDisplayName').isString().notEmpty().withMessage('senderDisplayName is required'),
      body('content').isString().notEmpty().withMessage('content is required'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { threadId } = req.params;
        const { senderId, senderDisplayName, content, tenantId } = req.body;

        if (!threadId) {
          res.status(400).json({ error: 'threadId is required' });
          return;
        }

        const result = await chatService.sendMessage(
          threadId,
          senderId,
          senderDisplayName,
          content,
          tenantId
        );

        res.json(result);
        return;
      } catch (error) {
        logger.error('Error sending message', { error });
        res.status(500).json({ error: 'Failed to send message' });
        return;
      }
    }
  );

  /**
   * GET /api/chat/threads/:threadId/messages
   * Get messages for thread
   */
  router.get(
    '/threads/:threadId/messages',
    [
      query('tenantId').isString().notEmpty().withMessage('tenantId is required'),
      query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { threadId } = req.params;
        const { tenantId, limit } = req.query;

        if (!threadId || !tenantId || typeof tenantId !== 'string') {
          res.status(400).json({ error: 'threadId and tenantId are required' });
          return;
        }

        const result = await chatService.getThreadMessages(
          threadId,
          tenantId,
          limit ? parseInt(limit as string) : 50
        );

        res.json(result);
        return;
      } catch (error) {
        logger.error('Error getting messages', { error });
        res.status(500).json({ error: 'Failed to get messages' });
      }
    }
  );

  /**
   * POST /api/chat/threads/:threadId/typing
   * Send typing indicator
   */
  router.post(
    '/threads/:threadId/typing',
    [
      body('senderId').isString().notEmpty().withMessage('senderId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { threadId } = req.params;
        const { senderId } = req.body;

        if (!threadId) {
          res.status(400).json({ error: 'threadId is required' });
          return;
        }

        await chatService.sendTypingIndicator(threadId, senderId);
        res.json({ success: true });
        return;
      } catch (error) {
        logger.error('Error sending typing indicator', { error });
        res.status(500).json({ error: 'Failed to send typing indicator' });
      }
    }
  );

  /**
   * POST /api/chat/messages/:messageId/read
   * Mark message as read
   */
  router.post(
    '/messages/:messageId/read',
    [
      body('threadId').isString().notEmpty().withMessage('threadId is required'),
      body('userId').isString().notEmpty().withMessage('userId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { messageId } = req.params;
        const { threadId, userId } = req.body;

        if (!messageId || !threadId) {
          res.status(400).json({ error: 'messageId and threadId are required' });
          return;
        }

        await chatService.markMessageRead(threadId, messageId, userId);
        res.json({ success: true });
        return;
      } catch (error) {
        logger.error('Error marking message read', { error });
        res.status(500).json({ error: 'Failed to mark message read' });
      }
    }
  );

  /**
   * POST /api/chat/threads/:threadId/participants
   * Add participant to thread
   */
  router.post(
    '/threads/:threadId/participants',
    [
      body('participant.id').isString().notEmpty().withMessage('participant.id is required'),
      body('participant.displayName').isString().notEmpty().withMessage('participant.displayName is required'),
      body('participant.role').isIn(['vendor', 'amc', 'client', 'system']).withMessage('Invalid role'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { threadId } = req.params;
        const { participant, tenantId } = req.body;
        const userId = (req as any).user?.id || 'system';

        if (!threadId) {
          res.status(400).json({ error: 'threadId is required' });
          return;
        }

        await chatService.addParticipant(threadId, participant, userId, tenantId);
        res.json({ success: true });
        return;
      } catch (error) {
        logger.error('Error adding participant', { error });
        res.status(500).json({ error: 'Failed to add participant' });
      }
    }
  );

  /**
   * POST /api/chat/threads/:threadId/subscribe
   * Subscribe to real-time notifications for thread (WebSocket endpoint would handle this better)
   * This is placeholder for REST polling fallback
   */
  router.post('/threads/:threadId/subscribe', async (req: Request, res: Response): Promise<void> => {
    res.json({ 
      success: true, 
      message: 'Use WebSocket connection for real-time updates. REST polling available via GET /threads/:threadId/messages'
    });
  });

  return router;
};
