/**
 * Notification Controller - REST API endpoints
 */

import express, { Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { EmailNotificationService } from '../services/email-notification.service.js';
import { SmsNotificationService } from '../services/sms-notification.service.js';
import { NotificationPreferencesService } from '../services/notification-preferences.service.js';
import { InAppNotificationService, NotificationCategory, NotificationListParams } from '../services/in-app-notification.service.js';
import { WebPubSubService } from '../services/web-pubsub.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();
const emailService = new EmailNotificationService();
const smsService = new SmsNotificationService();
const preferencesService = new NotificationPreferencesService();
const inAppService = new InAppNotificationService();

// WebPubSub — gracefully degrade if not configured
let webPubSubService: WebPubSubService | null = null;
try {
  webPubSubService = new WebPubSubService({ enableLocalEmulation: process.env.NODE_ENV === 'development' });
} catch {
  logger.warn('WebPubSub not available — negotiate endpoint will return 503');
}

export const createNotificationRouter = () => {
  const router = express.Router();

  /**
   * POST /api/notifications/email/send
   * Send email directly
   */
  router.post(
    '/email/send',
    [
      body('to').isArray().withMessage('to must be an array'),
      body('to.*').isEmail().withMessage('Invalid email address'),
      body('subject').isString().notEmpty().withMessage('subject is required'),
      body('htmlBody').isString().notEmpty().withMessage('htmlBody is required'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { to, cc, bcc, replyTo, subject, htmlBody, textBody, priority, tenantId } = req.body;

        const result = await emailService.sendEmail(
          { to, cc, bcc, replyTo, subject, htmlBody, textBody, priority },
          tenantId
        );

        res.json(result);
      } catch (error) {
        logger.error('Error sending email', { error });
        res.status(500).json({ error: 'Failed to send email' });
      }
    }
  );

  /**
   * POST /api/notifications/email/template
   * Send email using template
   */
  router.post(
    '/email/template',
    [
      body('templateName').isString().notEmpty().withMessage('templateName is required'),
      body('to').isEmail().withMessage('Invalid email address'),
      body('variables').isObject().withMessage('variables must be an object'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { templateName, to, variables, cc, bcc, replyTo, priority, tenantId } = req.body;

        const result = await emailService.sendTemplateEmail(
          templateName,
          to,
          variables,
          tenantId,
          { cc, bcc, replyTo, priority }
        );

        res.json(result);
        return;
      } catch (error) {
        logger.error('Error sending template email', { error });
        res.status(500).json({ error: 'Failed to send template email' });
      }
    }
  );

  /**
   * POST /api/notifications/email/templates
   * Create or update email template
   */
  router.post(
    '/email/templates',
    [
      body('name').isString().notEmpty().withMessage('name is required'),
      body('subject').isString().notEmpty().withMessage('subject is required'),
      body('htmlBody').isString().notEmpty().withMessage('htmlBody is required'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { name, category, subject, htmlBody, textBody, variables, tenantId } = req.body;

        const result = await emailService.saveTemplate(
          { name, category, subject, htmlBody, textBody, variables },
          tenantId
        );

        res.json(result);
        return;
      } catch (error) {
        logger.error('Error saving email template', { error });
        res.status(500).json({ error: 'Failed to save template' });
      }
    }
  );

  /**
   * GET /api/notifications/email/templates/:name
   * Get email template
   */
  router.get('/email/templates/:name', async (req: Request, res: Response): Promise<void> => {
    try {
      const name = req.params.name as string;
      const tenantIdParam = req.query.tenantId;

      if (!name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      if (!tenantIdParam || typeof tenantIdParam !== 'string') {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      // Extract the validated string value
      const validatedTenantId = String(tenantIdParam);
      const result = await emailService.getTemplate(name, validatedTenantId);
      res.json(result);
      return;
    } catch (error) {
      logger.error('Error getting email template', { error });
      res.status(500).json({ error: 'Failed to get template' });
    }
  });

  /**
   * POST /api/notifications/sms/send
   * Send SMS
   */
  router.post(
    '/sms/send',
    [
      body('to').custom((value) => {
        if (typeof value === 'string' || Array.isArray(value)) return true;
        throw new Error('to must be string or array');
      }),
      body('message').isString().notEmpty().withMessage('message is required'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { to, message, tenantId } = req.body;
        const result = await smsService.sendSms(to, message, tenantId);
        res.json(result);
        return;
      } catch (error) {
        logger.error('Error sending SMS', { error });
        res.status(500).json({ error: 'Failed to send SMS' });
      }
    }
  );

  /**
   * GET /api/notifications/history/:userId
   * Get notification history for user
   */
  router.get(
    '/history/:userId',
    [
      query('tenantId').isString().notEmpty().withMessage('tenantId is required'),
      query('type').optional().isIn(['email', 'sms', 'push', 'inApp']),
      query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { userId } = req.params;
        const tenantId = req.query.tenantId as string;
        const type = req.query.type as string | undefined;
        const limit = req.query.limit as string | undefined;

        if (!tenantId || typeof tenantId !== 'string') {
          res.status(400).json({ error: 'tenantId is required' });
          return;
        }

        const result = await emailService.getNotificationHistory(
          userId as string,
          tenantId as string,
          { 
            ...(type && { type: type as 'email' | 'sms' | 'push' }),
            ...(limit && { limit: parseInt(limit) })
          }
        );

        res.json(result);
        return;
      } catch (error) {
        logger.error('Error getting notification history', { error });
        res.status(500).json({ error: 'Failed to get notification history' });
      }
    }
  );

  /**
   * GET /api/notifications/preferences/:userId
   * Get user notification preferences
   */
  router.get('/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const tenantId = req.query.tenantId as string;

      if (!tenantId || typeof tenantId !== 'string') {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const result = await preferencesService.getPreferences(userId as string, tenantId as string);
      res.json(result);
      return;
    } catch (error) {
      logger.error('Error getting preferences', { error });
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  });

  /**
   * PUT /api/notifications/preferences/:userId
   * Update user notification preferences
   */
  router.put(
    '/preferences/:userId',
    [
      body('tenantId').isString().notEmpty().withMessage('tenantId is required')
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { userId } = req.params;
        const { tenantId, ...preferences } = req.body;

        if (!tenantId || typeof tenantId !== 'string') {
          res.status(400).json({ error: 'tenantId is required' });
          return;
        }

        const result = await preferencesService.updatePreferences(userId as string, preferences, tenantId as string);
        res.json(result);
        return;
      } catch (error) {
        logger.error('Error updating preferences', { error });
        res.status(500).json({ error: 'Failed to update preferences' });
      }
    }
  );

  // ── In-App Notification Endpoints ────────────────────────────────────

  /**
   * GET /api/notifications/in-app/:userId
   * List in-app notifications for a user (paginated)
   */
  router.get(
    '/in-app/:userId',
    [
      param('userId').isString().notEmpty(),
      query('tenantId').isString().notEmpty().withMessage('tenantId is required'),
      query('unreadOnly').optional().isIn(['true', 'false']),
      query('category').optional().isString(),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('offset').optional().isInt({ min: 0 }),
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const userId = req.params.userId!;
        const tenantId = req.query.tenantId as string;
        const unreadOnly = req.query.unreadOnly === 'true';
        const category = req.query.category as NotificationCategory | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

        const params: NotificationListParams = { tenantId, userId };
        if (unreadOnly) params.unreadOnly = unreadOnly;
        if (category) params.category = category;
        if (limit !== undefined) params.limit = limit;
        if (offset !== undefined) params.offset = offset;

        const result = await inAppService.listNotifications(params);

        res.json(result);
      } catch (error) {
        logger.error('Error listing in-app notifications', { error });
        res.status(500).json({ error: 'Failed to list notifications' });
      }
    }
  );

  /**
   * GET /api/notifications/in-app/:userId/unread-count
   * Get unread notification count
   */
  router.get(
    '/in-app/:userId/unread-count',
    [
      param('userId').isString().notEmpty(),
      query('tenantId').isString().notEmpty().withMessage('tenantId is required'),
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { userId } = req.params;
        const tenantId = req.query.tenantId as string;

        const count = await inAppService.getUnreadCount(tenantId, userId!);
        res.json({ unreadCount: count });
      } catch (error) {
        logger.error('Error getting unread count', { error });
        res.status(500).json({ error: 'Failed to get unread count' });
      }
    }
  );

  /**
   * PATCH /api/notifications/in-app/:notificationId/read
   * Mark a single notification as read
   */
  router.patch(
    '/in-app/:notificationId/read',
    [
      param('notificationId').isString().notEmpty(),
      body('userId').isString().notEmpty().withMessage('userId is required'),
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const notificationId = req.params.notificationId!;
        const userId = req.body.userId as string;

        const updated = await inAppService.markAsRead(userId, notificationId);
        res.json(updated);
      } catch (error) {
        logger.error('Error marking notification as read', { error });
        res.status(500).json({ error: 'Failed to mark notification as read' });
      }
    }
  );

  /**
   * POST /api/notifications/in-app/mark-all-read
   * Mark all notifications as read for a user
   */
  router.post(
    '/in-app/mark-all-read',
    [
      body('userId').isString().notEmpty().withMessage('userId is required'),
      body('tenantId').isString().notEmpty().withMessage('tenantId is required'),
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const { userId, tenantId } = req.body;
        const count = await inAppService.markAllAsRead(tenantId, userId);
        res.json({ markedCount: count });
      } catch (error) {
        logger.error('Error marking all notifications as read', { error });
        res.status(500).json({ error: 'Failed to mark all as read' });
      }
    }
  );

  /**
   * PATCH /api/notifications/in-app/:notificationId/dismiss
   * Dismiss a notification
   */
  router.patch(
    '/in-app/:notificationId/dismiss',
    [
      param('notificationId').isString().notEmpty(),
      body('userId').isString().notEmpty().withMessage('userId is required'),
    ],
    async (req: Request, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      try {
        const notificationId = req.params.notificationId!;
        const userId = req.body.userId as string;

        await inAppService.dismiss(userId, notificationId);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error dismissing notification', { error });
        res.status(500).json({ error: 'Failed to dismiss notification' });
      }
    }
  );

  // ── WebSocket Negotiate ──────────────────────────────────────────────

  /**
   * GET /api/notifications/negotiate
   * Get WebSocket connection URL for real-time notifications
   */
  router.get('/negotiate', async (req: Request, res: Response): Promise<void> => {
    try {
      if (!webPubSubService) {
        res.status(503).json({ error: 'Real-time notifications not available' });
        return;
      }

      const userId = req.query.userId as string;
      const role = req.query.role as string;

      const url = await webPubSubService.generateClientAccessUrl(
        userId || undefined,
        role ? [role] : undefined
      );

      res.json({ url });
    } catch (error) {
      logger.error('Error negotiating WebSocket connection', { error });
      res.status(500).json({ error: 'Failed to negotiate connection' });
    }
  });

  return router;
};
