/**
 * ARV (As-Repaired Value) Controller
 *
 * Routes (tenant-authenticated):
 *
 * Mounted at /api/arv:
 *   GET    /                      → list analyses (optional ?dealType= &status= &orderId=)
 *   POST   /                      → create draft analysis
 *   GET    /:analysisId           → get one analysis
 *   PUT    /:analysisId           → update (SOW, comps, deal params, etc.)
 *   DELETE /:analysisId           → delete (DRAFT only)
 *   POST   /:analysisId/calculate → run engine, persist results
 *   POST   /:analysisId/complete  → mark COMPLETE
 *
 * Mounted at /api/orders/:orderId (mergeParams: true):
 *   GET    /arv                   → list analyses for this order
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ArvService } from '../services/arv.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  CreateArvRequest,
  UpdateArvRequest,
  DealType,
  ArvStatus,
  DealMetricsInput,
} from '../types/arv.types.js';

const logger = new Logger('ArvController');

// ─── Tenant helper ────────────────────────────────────────────────────────────

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

// ─── Validators ───────────────────────────────────────────────────────────────

const DEAL_TYPES: DealType[] = ['FIX_FLIP', 'DSCR', 'REHAB', 'BRIDGE', 'HARD_MONEY'];
const ARV_MODES = ['COMPS', 'COST', 'HYBRID'];
const AS_IS_SOURCES = ['AVM', 'APPRAISAL', 'MANUAL'];

const validateCreate = [
  body('dealType').isIn(DEAL_TYPES).withMessage(`dealType must be one of: ${DEAL_TYPES.join(', ')}`),
  body('mode').isIn(ARV_MODES).withMessage(`mode must be one of: ${ARV_MODES.join(', ')}`),
  body('propertyAddress').isObject().withMessage('propertyAddress is required'),
  body('propertyAddress.street').isString().notEmpty().withMessage('propertyAddress.street is required'),
  body('propertyAddress.city').isString().notEmpty().withMessage('propertyAddress.city is required'),
  body('propertyAddress.state').isString().isLength({ min: 2, max: 2 }).withMessage('propertyAddress.state must be 2-char abbreviation'),
  body('propertyAddress.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('propertyAddress.zipCode must be 5 or 9 digits'),
  body('asIsValue').isFloat({ min: 0 }).withMessage('asIsValue must be a non-negative number'),
  body('asIsSource').isIn(AS_IS_SOURCES).withMessage(`asIsSource must be one of: ${AS_IS_SOURCES.join(', ')}`),
  body('orderId').optional().isString().notEmpty(),
  body('notes').optional().isString(),
  body('scopeOfWork').optional().isArray(),
  body('comps').optional().isArray(),
];

const validateUpdate = [
  param('analysisId').isString().notEmpty(),
  body('dealType').optional().isIn(DEAL_TYPES),
  body('mode').optional().isIn(ARV_MODES),
  body('propertyAddress').optional().isObject(),
  body('asIsValue').optional().isFloat({ min: 0 }),
  body('asIsSource').optional().isIn(AS_IS_SOURCES),
  body('scopeOfWork').optional().isArray(),
  body('comps').optional().isArray(),
  body('dealAnalysis').optional().isObject(),
  body('notes').optional().isString(),
  body('status').optional().isIn(['DRAFT', 'COMPLETE', 'REVIEWED']),
];

// ─── Service singleton ────────────────────────────────────────────────────────

let _arvService: ArvService | null = null;

function getArvService(dbService: CosmosDbService): ArvService {
  if (!_arvService) {
    _arvService = new ArvService(dbService);
  }
  return _arvService;
}

// ─── /api/arv router ─────────────────────────────────────────────────────────

export function createArvRouter(dbService: CosmosDbService) {
  const router = express.Router();

  /**
   * GET /
   * Query params: dealType?, status?, orderId?
   */
  router.get(
    '/',
    [
      query('dealType').optional().isIn(DEAL_TYPES),
      query('status').optional().isIn(['DRAFT', 'COMPLETE', 'REVIEWED']),
      query('orderId').optional().isString(),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const service = getArvService(dbService);
        const dealTypeQ = req.query['dealType'] as DealType | undefined;
        const statusQ = req.query['status'] as ArvStatus | undefined;
        const orderIdQ = req.query['orderId'] as string | undefined;
        const analyses = await service.listAnalyses(tenantId, {
          ...(dealTypeQ !== undefined && { dealType: dealTypeQ }),
          ...(statusQ !== undefined && { status: statusQ }),
          ...(orderIdQ !== undefined && { orderId: orderIdQ }),
        });
        res.json({ analyses, count: analyses.length });
      } catch (err) {
        logger.error('listAnalyses failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /
   * Body: CreateArvRequest
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
        const service = getArvService(dbService);
        const analysis = await service.createAnalysis(req.body as CreateArvRequest, tenantId, createdBy);
        res.status(201).json(analysis);
      } catch (err) {
        logger.error('createAnalysis failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /:analysisId
   */
  router.get(
    '/:analysisId',
    [param('analysisId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const analysisId = req.params['analysisId'] as string;
        const service = getArvService(dbService);
        const analysis = await service.getAnalysis(analysisId, tenantId);
        if (!analysis) {
          res.status(404).json({ error: `ARV analysis ${analysisId} not found` });
          return;
        }
        res.json(analysis);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('getAnalysis failed', { error: err });
        res.status(msg.includes('not belong') ? 403 : 500).json({ error: msg });
      }
    },
  );

  /**
   * PUT /:analysisId
   * Body: UpdateArvRequest
   */
  router.put(
    '/:analysisId',
    ...validateUpdate,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const analysisId = req.params['analysisId'] as string;
        const service = getArvService(dbService);
        const analysis = await service.updateAnalysis(analysisId, tenantId, req.body as UpdateArvRequest);
        res.json(analysis);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('updateAnalysis failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * DELETE /:analysisId
   * Only DRAFT analyses may be deleted.
   */
  router.delete(
    '/:analysisId',
    [param('analysisId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const analysisId = req.params['analysisId'] as string;
        const service = getArvService(dbService);
        await service.deleteAnalysis(analysisId, tenantId);
        res.status(204).send();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('deleteAnalysis failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : msg.includes("only DRAFT") ? 409 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * POST /:analysisId/calculate
   * Body: optional DealMetricsInput overrides (dealParams)
   * Runs the ARV engine and persists results.
   */
  router.post(
    '/:analysisId/calculate',
    [param('analysisId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const analysisId = req.params['analysisId'] as string;
        const service = getArvService(dbService);
        const analysis = await service.calculateAndPersist(
          analysisId,
          tenantId,
          req.body as Partial<DealMetricsInput> | undefined,
        );
        res.json(analysis);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('calculateAndPersist failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * POST /:analysisId/complete
   * Marks the analysis as COMPLETE.
   */
  router.post(
    '/:analysisId/complete',
    [param('analysisId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const analysisId = req.params['analysisId'] as string;
        const service = getArvService(dbService);
        const analysis = await service.completeAnalysis(analysisId, tenantId);
        res.json(analysis);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('completeAnalysis failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes('not belong') ? 403 : msg.includes('not been calculated') ? 409 : 500;
        res.status(status).json({ error: msg });
      }
    },
  );

  return router;
}

// ─── /api/orders/:orderId/arv router (mergeParams) ───────────────────────────

export function createOrderArvRouter(dbService: CosmosDbService) {
  const router = express.Router({ mergeParams: true });

  /**
   * GET /arv
   * Returns: all ARV analyses linked to this order.
   */
  router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const orderId = req.params['orderId'] as string;
      const service = getArvService(dbService);
      const analyses = await service.getByOrderId(orderId, tenantId);
      res.json({ analyses, count: analyses.length });
    } catch (err) {
      logger.error('getByOrderId failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
