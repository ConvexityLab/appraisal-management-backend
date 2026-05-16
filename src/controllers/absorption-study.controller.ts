/**
 * Absorption Study Controller
 *
 * Routes (tenant-authenticated, mounted at /api/absorption-study):
 *
 *   GET    /                   → list orders (optional ?status=)
 *   POST   /                   → create order
 *   GET    /:orderId            → get one order
 *   PUT    /:orderId            → update order fields
 *   POST   /:orderId/analyze    → pull MLS comps and derive absorption scenarios
 *   POST   /:orderId/complete   → mark COMPLETE
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { getAbsorptionStudyService } from '../services/absorption-study.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  CreateAbsorptionStudyRequest,
  UpdateAbsorptionStudyRequest,
  AbsorptionStudyStatus,
  ProjectStage,
} from '../types/absorption-study.types.js';

const logger = new Logger('AbsorptionStudyController');

// ── Tenant helper ─────────────────────────────────────────────────────────────

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tid = req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);
  if (!tid) {
    throw new Error(
      'Tenant ID is required but was not found in the auth token or x-tenant-id header',
    );
  }
  return tid;
}

// ── Validators ────────────────────────────────────────────────────────────────

const STUDY_STATUSES: AbsorptionStudyStatus[] = [
  'DRAFT', 'DATA_COLLECTION', 'ANALYST_REVIEW', 'COMPLETE', 'CANCELLED',
];

const PROJECT_STAGES: ProjectStage[] = [
  'PRE_CONSTRUCTION', 'UNDER_CONSTRUCTION', 'NEAR_COMPLETION', 'COMPLETE',
];

const validateCreate = [
  body('subjectAddress').isString().notEmpty().withMessage('subjectAddress is required'),
  body('subjectCity').isString().notEmpty().withMessage('subjectCity is required'),
  body('subjectState')
    .isString()
    .isLength({ min: 2, max: 2 })
    .withMessage('subjectState must be a 2-character state abbreviation'),
  body('subjectPostalCode')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('subjectPostalCode must be 5 or 9 digits'),
  body('projectStage')
    .isIn(PROJECT_STAGES)
    .withMessage(`projectStage must be one of: ${PROJECT_STAGES.join(', ')}`),
  body('totalUnits').isInt({ min: 1 }).withMessage('totalUnits must be a positive integer'),
  body('unitMix').isArray({ min: 1 }).withMessage('unitMix must be a non-empty array'),
  body('unitMix.*.squareFeet').isInt({ min: 1 }).withMessage('Each unit mix entry must have squareFeet'),
  body('unitMix.*.unitCount').isInt({ min: 1 }).withMessage('Each unit mix entry must have unitCount'),
  body('compSearchRadiusMiles').optional().isFloat({ min: 0.1, max: 25 }),
  body('compSoldWithinDays').optional().isInt({ min: 30, max: 730 }),
];

const validateUpdate = [
  param('orderId').isString().notEmpty(),
  body('status').optional().isIn(STUDY_STATUSES),
  body('comparables').optional().isArray(),
  body('scenarios').optional().isArray(),
  body('submarketDescription').optional().isString(),
  body('supplyDemandSummary').optional().isString(),
  body('extraordinaryAssumptions').optional().isArray(),
  body('limitingConditions').optional().isArray(),
  body('completedByName').optional().isString(),
  body('completedByFirmName').optional().isString(),
];

// ── Router factory ────────────────────────────────────────────────────────────

export function createAbsorptionStudyRouter(dbService: CosmosDbService) {
  const router = express.Router();

  /**
   * GET /
   * Optional ?status= filter
   */
  router.get(
    '/',
    [query('status').optional().isIn(STUDY_STATUSES)],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const statusQ = req.query['status'] as AbsorptionStudyStatus | undefined;
        const service = getAbsorptionStudyService(dbService);
        const orders = await service.listOrders(tenantId, statusQ);
        res.json({ orders, count: orders.length });
      } catch (err) {
        logger.error('listOrders failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /
   * Body: CreateAbsorptionStudyRequest
   */
  router.post(
    '/',
    ...validateCreate,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
        const service = getAbsorptionStudyService(dbService);
        const order = await service.createOrder(
          req.body as CreateAbsorptionStudyRequest,
          tenantId,
          createdBy,
        );
        res.status(201).json(order);
      } catch (err) {
        logger.error('createOrder failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /:orderId
   */
  router.get(
    '/:orderId',
    [param('orderId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getAbsorptionStudyService(dbService);
        const order = await service.getOrder(orderId, tenantId);
        if (!order) {
          res.status(404).json({ error: `Absorption study order ${orderId} not found` });
          return;
        }
        res.json(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('getOrder failed', { error: err });
        res.status(msg.includes('not belong') ? 403 : 500).json({ error: msg });
      }
    },
  );

  /**
   * PUT /:orderId
   * Body: UpdateAbsorptionStudyRequest
   */
  router.put(
    '/:orderId',
    ...validateUpdate,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getAbsorptionStudyService(dbService);
        const order = await service.updateOrder(orderId, tenantId, req.body as UpdateAbsorptionStudyRequest);
        res.json(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('updateOrder failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * POST /:orderId/analyze
   * Pulls Bridge Interactive MLS comps and derives base/upside/downside scenarios.
   * Requires subjectLatitude and subjectLongitude to be set on the order.
   */
  router.post(
    '/:orderId/analyze',
    [param('orderId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getAbsorptionStudyService(dbService);
        const order = await service.analyze(orderId, tenantId);
        res.json(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('analyze failed', { error: err });
        const status = msg.includes('not found') ? 404 :
                       msg.includes('not belong') ? 403 :
                       msg.includes('subjectLatitude') ? 422 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * POST /:orderId/complete
   * Marks the order COMPLETE.
   */
  router.post(
    '/:orderId/complete',
    [param('orderId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getAbsorptionStudyService(dbService);
        const updates: UpdateAbsorptionStudyRequest = { status: 'COMPLETE' };
        if (req.body?.completedByName) updates.completedByName = req.body.completedByName as string;
        if (req.body?.completedByFirmName) updates.completedByFirmName = req.body.completedByFirmName as string;
        const order = await service.updateOrder(orderId, tenantId, updates);
        res.json(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('completeOrder failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  return router;
}
