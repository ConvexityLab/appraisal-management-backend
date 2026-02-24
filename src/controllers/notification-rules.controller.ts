/**
 * Notification Rules Controller
 *
 * REST API for event alert configuration.
 *
 * Routes (all mounted under /api/notification-rules):
 *   GET    /           List rules (query: enabledOnly=true|false)
 *   GET    /:id        Get single rule
 *   POST   /           Create rule
 *   PUT    /:id        Update rule
 *   DELETE /:id        Delete rule
 *   PATCH  /:id/toggle Toggle enabled/disabled
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { NotificationRulesService } from '../services/notification-rules.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('NotificationRulesController');
const rulesService = new NotificationRulesService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

/** Resolve tenantId from JWT claims or header for development. */
const getTenantId = (req: Request): string => {
  const fromClaims = (req as any).user?.tenantId;
  return fromClaims || req.headers['x-tenant-id'] as string || 'default-tenant';
};

const getUserId = (req: Request): string =>
  (req as any).user?.id || 'system';

// ─── GET / — list ─────────────────────────────────────────────────────────────

router.get(
  '/',
  [query('enabledOnly').optional().isBoolean()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId   = getTenantId(req);
      const enabledOnly = req.query.enabledOnly === 'true';
      const rules = await rulesService.listRules(tenantId, enabledOnly);
      res.json({ success: true, data: rules });
    } catch (error: any) {
      logger.error('listRules failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─── GET /:id — get single ────────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.getRule(req.params.id!, tenantId);
      if (!rule) {
        res.status(404).json({ success: false, error: `Notification rule '${req.params.id}' not found` });
        return;
      }
      res.json({ success: true, data: rule });
    } catch (error: any) {
      logger.error('getRule failed', { id: req.params.id, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─── POST / — create ─────────────────────────────────────────────────────────

router.post(
  '/',
  [
    body('eventType').notEmpty().withMessage('eventType is required'),
    body('name').notEmpty().withMessage('name is required'),
    body('channels').isArray({ min: 1 }).withMessage('channels must be a non-empty array'),
    body('titleTemplate').notEmpty().withMessage('titleTemplate is required'),
    body('messageTemplate').notEmpty().withMessage('messageTemplate is required'),
    body('throttleMs').optional().isInt({ min: 0 }).withMessage('throttleMs must be a non-negative integer'),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId = getTenantId(req);
      const userId   = getUserId(req);
      const rule = await rulesService.createRule(req.body, tenantId, userId);
      res.status(201).json({ success: true, data: rule });
    } catch (error: any) {
      logger.error('createRule failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─── PUT /:id — update ────────────────────────────────────────────────────────

router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('id is required'),
    body('channels').optional().isArray({ min: 1 }),
    body('throttleMs').optional().isInt({ min: 0 }),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.updateRule(req.params.id!, req.body, tenantId);
      res.json({ success: true, data: rule });
    } catch (error: any) {
      const isNotFound = error.message?.includes('not found');
      logger.error('updateRule failed', { id: req.params.id, error: error.message });
      res.status(isNotFound ? 404 : 500).json({ success: false, error: error.message });
    }
  }
);

// ─── DELETE /:id — delete ────────────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId = getTenantId(req);
      await rulesService.deleteRule(req.params.id!, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      const isNotFound = error.message?.includes('not found');
      logger.error('deleteRule failed', { id: req.params.id, error: error.message });
      res.status(isNotFound ? 404 : 500).json({ success: false, error: error.message });
    }
  }
);

// ─── PATCH /:id/toggle — toggle ──────────────────────────────────────────────

router.patch(
  '/:id/toggle',
  [param('id').notEmpty().withMessage('id is required')],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.toggleRule(req.params.id!, tenantId);
      res.json({ success: true, data: rule });
    } catch (error: any) {
      const isNotFound = error.message?.includes('not found');
      logger.error('toggleRule failed', { id: req.params.id, error: error.message });
      res.status(isNotFound ? 404 : 500).json({ success: false, error: error.message });
    }
  }
);

export { router as notificationRulesRouter };
