/**
 * QC Rules Controller
 *
 * REST API for QC automation rule configuration.
 *
 * Routes (all mounted under /api/qc-rules):
 *   GET    /                    List rules (filter: category, severity, enabled)
 *   GET    /:id                 Get single rule
 *   POST   /                    Create rule
 *   PUT    /:id                 Update rule
 *   DELETE /:id                 Delete rule
 *   PATCH  /:id/toggle          Toggle enabled/disabled
 *   POST   /:id/duplicate       Duplicate rule
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { QCRulesService } from '../services/qc-rules.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('QCRulesController');
const rulesService = new QCRulesService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

/** Resolve tenantId from JWT claims or fall back to header for development. */
const getTenantId = (req: Request): string => {
  const fromClaims = (req as any).user?.tenantId;
  if (fromClaims) return fromClaims;
  const fromHeader = req.headers['x-tenant-id'] as string;
  if (fromHeader) return fromHeader;
  return 'default-tenant';
};

const getUserId = (req: Request): string =>
  (req as any).user?.id ?? (req as any).user?.uid ?? 'system';

// ─── Validation chains ────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['SUBJECT', 'NEIGHBORHOOD', 'COMPARABLES', 'SALES_COMPARISON', 'APPRAISER', 'GENERAL'];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const conditionShape = body('conditions').optional().isArray();
const actionShape = body('actions').optional().isArray();

const createValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('description').optional().isString(),
  body('category').isIn(VALID_CATEGORIES).withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
  body('severity').isIn(VALID_SEVERITIES).withMessage(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`),
  body('enabled').optional().isBoolean(),
  conditionShape,
  actionShape,
];

const updateValidation = [
  param('id').notEmpty(),
  body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
  body('category').optional().isIn(VALID_CATEGORIES),
  body('severity').optional().isIn(VALID_SEVERITIES),
  body('enabled').optional().isBoolean(),
  conditionShape,
  actionShape,
];

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/qc-rules
 * List rules with optional filters.
 */
router.get(
  '/',
  [
    query('category').optional().isIn(VALID_CATEGORIES),
    query('severity').optional().isIn(VALID_SEVERITIES),
    query('enabled').optional().isIn(['true', 'false']),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const filters: Record<string, unknown> = {};

      if (req.query.category) filters.category = req.query.category as string;
      if (req.query.severity) filters.severity = req.query.severity as string;
      if (req.query.enabled !== undefined) filters.enabled = req.query.enabled === 'true';

      const rules = await rulesService.listRules(tenantId, filters as any);
      return res.json({ success: true, data: rules, count: rules.length });
    } catch (error) {
      logger.error('Failed to list QC rules', { error });
      return res.status(500).json({ success: false, error: 'Failed to list QC rules' });
    }
  }
);

/**
 * GET /api/qc-rules/:id
 * Get a single rule.
 */
router.get(
  '/:id',
  [param('id').notEmpty()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.getRule(req.params.id!, tenantId);
      return res.json({ success: true, data: rule });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
      logger.error('Failed to get QC rule', { error, id: req.params.id });
      return res.status(500).json({ success: false, error: 'Failed to retrieve QC rule' });
    }
  }
);

/**
 * POST /api/qc-rules
 * Create a new rule.
 */
router.post(
  '/',
  createValidation,
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      const rule = await rulesService.createRule(req.body, tenantId, userId);
      return res.status(201).json({ success: true, data: rule });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('required') || msg.includes('missing')) {
        return res.status(400).json({ success: false, error: msg });
      }
      logger.error('Failed to create QC rule', { error });
      return res.status(500).json({ success: false, error: 'Failed to create QC rule' });
    }
  }
);

/**
 * PUT /api/qc-rules/:id
 * Update an existing rule.
 */
router.put(
  '/:id',
  updateValidation,
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.updateRule(req.params.id!, req.body, tenantId);
      return res.json({ success: true, data: rule });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
      logger.error('Failed to update QC rule', { error, id: req.params.id });
      return res.status(500).json({ success: false, error: 'Failed to update QC rule' });
    }
  }
);

/**
 * DELETE /api/qc-rules/:id
 * Delete a rule.
 */
router.delete(
  '/:id',
  [param('id').notEmpty()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      await rulesService.deleteRule(req.params.id!, tenantId);
      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
      logger.error('Failed to delete QC rule', { error, id: req.params.id });
      return res.status(500).json({ success: false, error: 'Failed to delete QC rule' });
    }
  }
);

/**
 * PATCH /api/qc-rules/:id/toggle
 * Toggle enabled/disabled state.
 */
router.patch(
  '/:id/toggle',
  [param('id').notEmpty()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const rule = await rulesService.toggleRule(req.params.id!, tenantId);
      return res.json({ success: true, data: rule });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
      logger.error('Failed to toggle QC rule', { error, id: req.params.id });
      return res.status(500).json({ success: false, error: 'Failed to toggle QC rule' });
    }
  }
);

/**
 * POST /api/qc-rules/:id/duplicate
 * Duplicate a rule (creates a disabled copy with "(Copy)" suffix).
 */
router.post(
  '/:id/duplicate',
  [param('id').notEmpty()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;

    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      const rule = await rulesService.duplicateRule(req.params.id!, tenantId, userId);
      return res.status(201).json({ success: true, data: rule });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
      logger.error('Failed to duplicate QC rule', { error, id: req.params.id });
      return res.status(500).json({ success: false, error: 'Failed to duplicate QC rule' });
    }
  }
);

export default router;
