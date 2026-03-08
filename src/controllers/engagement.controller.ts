/**
 * Engagement Controller
 *
 * Routes (all tenant-authenticated):
 *
 *   GET    /api/engagements              → list engagements (search/filter/page)
 *   POST   /api/engagements              → create engagement
 *   GET    /api/engagements/:id          → get engagement
 *   PUT    /api/engagements/:id          → update engagement
 *   PATCH  /api/engagements/:id/status   → change engagement status
 *   DELETE /api/engagements/:id          → soft-delete (sets status=CANCELLED)
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { EngagementService } from '../services/engagement.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import {
  EngagementStatus,
  EngagementProductType,
} from '../types/engagement.types.js';
import type {
  CreateEngagementRequest,
  UpdateEngagementRequest,
  EngagementListRequest,
} from '../types/engagement.types.js';
import { OrderPriority } from '../types/order-management.js';

const logger = new Logger('EngagementController');

// ── Tenant helper ──────────────────────────────────────────────────────────────

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tid =
    req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);
  if (!tid) {
    throw new Error(
      'Tenant ID is required but was not found in the auth token or x-tenant-id header',
    );
  }
  return tid;
}

function resolveUserId(req: UnifiedAuthRequest): string {
  const uid = req.user?.id;
  if (!uid) {
    throw new Error('User ID is required but was not found in the auth token');
  }
  return uid;
}

// ── Validation chains ──────────────────────────────────────────────────────────

const PRODUCT_TYPES = Object.values(EngagementProductType);
const STATUSES = Object.values(EngagementStatus);
const PRIORITIES = Object.values(OrderPriority);

const validateCreate = [
  body('client').isObject().withMessage('client is required'),
  body('client.clientId').isString().notEmpty().withMessage('client.clientId is required'),
  body('client.clientName').isString().notEmpty().withMessage('client.clientName is required'),
  body('client.loanNumber').isString().notEmpty().withMessage('client.loanNumber is required'),
  body('client.borrowerName').isString().notEmpty().withMessage('client.borrowerName is required'),
  body('property').isObject().withMessage('property is required'),
  body('property.address').isString().notEmpty().withMessage('property.address is required'),
  body('property.city').isString().notEmpty().withMessage('property.city is required'),
  body('property.state').isString().isLength({ min: 2, max: 2 }).withMessage('property.state must be 2-char abbreviation'),
  body('property.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('property.zipCode must be 5 or 9 digits'),
  body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('products.*.productType')
    .isIn(PRODUCT_TYPES)
    .withMessage(`productType must be one of: ${PRODUCT_TYPES.join(', ')}`),
  body('priority').optional().isIn(PRIORITIES).withMessage(`priority must be one of: ${PRIORITIES.join(', ')}`),
  body('clientDueDate').optional().isISO8601().withMessage('clientDueDate must be ISO 8601'),
  body('internalDueDate').optional().isISO8601().withMessage('internalDueDate must be ISO 8601'),
  body('totalEngagementFee').optional().isFloat({ min: 0 }).withMessage('totalEngagementFee must be >= 0'),
];

const validateUpdate = [
  param('id').isString().notEmpty(),
  body('status').optional().isIn(STATUSES),
  body('priority').optional().isIn(PRIORITIES),
  body('clientDueDate').optional().isISO8601(),
  body('internalDueDate').optional().isISO8601(),
  body('totalEngagementFee').optional().isFloat({ min: 0 }),
];

const validateStatusPatch = [
  param('id').isString().notEmpty(),
  body('status')
    .isIn(STATUSES)
    .withMessage(`status must be one of: ${STATUSES.join(', ')}`),
];

const validateList = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isString(),
  query('clientId').optional().isString(),
  query('propertyState').optional().isString().isLength({ min: 2, max: 2 }),
  query('propertyZipCode').optional().isString().matches(/^\d{5}(-\d{4})?$/),
  query('search').optional().isString(),
  query('sortBy').optional().isString(),
  query('sortDirection').optional().isIn(['ASC', 'DESC']),
];

// ── Router factory ────────────────────────────────────────────────────────────

export function createEngagementRouter(dbService: CosmosDbService) {
  const router = express.Router();
  const service = new EngagementService(dbService);

  // ── GET /  (list) ──────────────────────────────────────────────────────────
  router.get(
    '/',
    ...validateList,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const q = req.query;

        const listRequest: EngagementListRequest = {
          tenantId,
          ...(q.page !== undefined && { page: q.page as unknown as number }),
          ...(q.pageSize !== undefined && { pageSize: q.pageSize as unknown as number }),
          ...(q.clientId !== undefined && { clientId: q.clientId as string }),
          ...(q.propertyState !== undefined && { propertyState: q.propertyState as string }),
          ...(q.propertyZipCode !== undefined && { propertyZipCode: q.propertyZipCode as string }),
          ...(q.search !== undefined && { searchText: q.search as string }),
          ...(q.sortBy !== undefined && { sortBy: q.sortBy as keyof import('../types/engagement.types.js').Engagement }),
          ...(q.sortDirection !== undefined && { sortDirection: q.sortDirection as 'ASC' | 'DESC' }),
          ...(q.status && {
            status: (q.status as string).split(',') as EngagementStatus[],
          }),
        };

        const result = await service.listEngagements(listRequest);
        return res.json({ success: true, ...result });
      } catch (error) {
        logger.error('listEngagements failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to list engagements' });
      }
    },
  );

  // ── POST /  (create) ───────────────────────────────────────────────────────
  router.post(
    '/',
    ...validateCreate,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const createdBy = resolveUserId(req);

        const createRequest: CreateEngagementRequest = {
          ...req.body,
          tenantId,
          createdBy,
        };

        const engagement = await service.createEngagement(createRequest);
        return res.status(201).json({ success: true, data: engagement });
      } catch (error) {
        logger.error('createEngagement failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to create engagement' });
      }
    },
  );

  // ── GET /:id  (get one) ────────────────────────────────────────────────────
  router.get(
    '/:id',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const engagement = await service.getEngagement(req.params['id'] as string, tenantId);
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('getEngagement failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get engagement' });
      }
    },
  );

  // ── PUT /:id  (update) ─────────────────────────────────────────────────────
  router.put(
    '/:id',
    ...validateUpdate,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);

        const updateRequest: UpdateEngagementRequest = {
          ...req.body,
          updatedBy,
        };

        const engagement = await service.updateEngagement(req.params['id'] as string, tenantId, updateRequest);
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('updateEngagement failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to update engagement' });
      }
    },
  );

  // ── PATCH /:id/status  (change status) ────────────────────────────────────
  router.patch(
    '/:id/status',
    ...validateStatusPatch,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.changeStatus(
          req.params['id'] as string,
          tenantId,
          req.body.status as EngagementStatus,
          updatedBy,
        );
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('changeStatus failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to change engagement status' });
      }
    },
  );

  // ── DELETE /:id  (soft-delete) ─────────────────────────────────────────────
  router.delete(
    '/:id',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const deletedBy = resolveUserId(req);
        await service.deleteEngagement(req.params['id'] as string, tenantId, deletedBy);
        return res.json({ success: true, message: 'Engagement cancelled' });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('deleteEngagement failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to delete engagement' });
      }
    },
  );

  // ── GET /:id/vendor-orders ─────────────────────────────────────────────────
  router.get(
    '/:id/vendor-orders',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const data = await service.getVendorOrders(req.params['id'] as string, tenantId);
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('getVendorOrders failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get vendor orders' });
      }
    },
  );

  // ── GET /:id/arv ───────────────────────────────────────────────────────────
  router.get(
    '/:id/arv',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const data = await service.getArvAnalyses(req.params['id'] as string, tenantId);
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('getArvAnalyses failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get ARV analyses' });
      }
    },
  );

  // ── GET /:id/qc ────────────────────────────────────────────────────────────
  router.get(
    '/:id/qc',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const data = await service.getQcReviews(req.params['id'] as string, tenantId);
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('getQcReviews failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get QC reviews' });
      }
    },
  );

  // ── GET /:id/documents ─────────────────────────────────────────────────────
  router.get(
    '/:id/documents',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const data = await service.getDocuments(req.params['id'] as string, tenantId);
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('getDocuments failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get documents' });
      }
    },
  );

  return router;
}
