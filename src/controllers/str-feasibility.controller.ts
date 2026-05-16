/**
 * STR Feasibility Controller
 *
 * Routes (tenant-authenticated, mounted at /api/str-feasibility):
 *
 *   GET    /                   → list orders (optional ?status=)
 *   POST   /                   → create order
 *   GET    /:orderId            → get one order
 *   PUT    /:orderId            → update order fields
 *   POST   /:orderId/analyze    → run data-source orchestration and derive projections/comps
 *   POST   /:orderId/complete   → mark COMPLETE
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { getStrFeasibilityService } from '../services/str-feasibility.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  CreateStrFeasibilityRequest,
  UpdateStrFeasibilityRequest,
  StrFeasibilityStatus,
} from '../types/str-feasibility.types.js';

const logger = new Logger('StrFeasibilityController');

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

const STR_STATUSES: StrFeasibilityStatus[] = [
  'DRAFT', 'DATA_COLLECTION', 'ANALYST_REVIEW', 'COMPLETE', 'CANCELLED',
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
  body('subjectBedrooms').isInt({ min: 0 }).withMessage('subjectBedrooms must be a non-negative integer'),
  body('subjectBathrooms').isFloat({ min: 0 }).withMessage('subjectBathrooms must be a non-negative number'),
  body('subjectSquareFeet').optional().isInt({ min: 1 }),
  body('subjectYearBuilt').optional().isInt({ min: 1800, max: new Date().getFullYear() + 5 }),
  body('subjectPropertyType').optional().isString().notEmpty(),
  body('compSearchRadiusMiles').optional().isFloat({ min: 0.1, max: 25 }),
  body('targetCompCount').optional().isInt({ min: 1, max: 20 }),
];

const validateUpdate = [
  param('orderId').isString().notEmpty(),
  body('status').optional().isIn(STR_STATUSES),
  body('comparables').optional().isArray(),
  body('primarySourceName').optional().isString().notEmpty(),
  body('subjectAndMarketDescription').optional().isString(),
  body('purposeStatement').optional().isString(),
  body('keyAssumptions').optional().isArray(),
  body('justificationForStrIncome').optional().isString(),
  body('completedByName').optional().isString(),
  body('completedByCredentials').optional().isString(),
];

// ── Router factory ────────────────────────────────────────────────────────────

export function createStrFeasibilityRouter(dbService: CosmosDbService) {
  const router = express.Router();

  /**
   * GET /
   * Optional ?status= filter
   */
  router.get(
    '/',
    [query('status').optional().isIn(STR_STATUSES)],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const statusQ = req.query['status'] as StrFeasibilityStatus | undefined;
        const service = getStrFeasibilityService(dbService);
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
   * Body: CreateStrFeasibilityRequest
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
        const service = getStrFeasibilityService(dbService);
        const order = await service.createOrder(req.body as CreateStrFeasibilityRequest, tenantId, createdBy);
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
        const service = getStrFeasibilityService(dbService);
        const order = await service.getOrder(orderId, tenantId);
        if (!order) {
          res.status(404).json({ error: `STR feasibility order ${orderId} not found` });
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
   * Body: UpdateStrFeasibilityRequest
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
        const service = getStrFeasibilityService(dbService);
        const order = await service.updateOrder(orderId, tenantId, req.body as UpdateStrFeasibilityRequest);
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
   * Triggers AirROI + AirDNA + Airbnb comp + regulation lookups.
   * Requires subjectLatitude and subjectLongitude to be set on the order.
   */
  router.post(
    '/:orderId/analyze',
    [param('orderId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getStrFeasibilityService(dbService);
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
   * Marks the order COMPLETE; requires completedByName (set via PUT first).
   */
  router.post(
    '/:orderId/complete',
    [param('orderId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const orderId = req.params['orderId'] as string;
        const service = getStrFeasibilityService(dbService);
        const updates: UpdateStrFeasibilityRequest = { status: 'COMPLETE' };
        if (req.body?.completedByName) updates.completedByName = req.body.completedByName as string;
        if (req.body?.completedByCredentials) updates.completedByCredentials = req.body.completedByCredentials as string;
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
