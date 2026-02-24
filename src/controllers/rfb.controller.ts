/**
 * RFB (Request-for-Bid) Controller
 *
 * Handles the full RFB lifecycle for an order.
 *
 * Routes mounted at /api/orders/:orderId/rfb  (order-scoped):
 *   POST   /api/orders/:orderId/rfb/preview   → run matching; return shortlist (no DB write)
 *   POST   /api/orders/:orderId/rfb            → create + persist DRAFT RFB
 *   GET    /api/orders/:orderId/rfb            → list all RFBs for this order
 *   GET    /api/orders/:orderId/rfb/active     → get the current non-cancelled/non-expired RFB
 *
 * Routes mounted at /api/rfb  (RFB-scoped actions):
 *   POST   /api/rfb/:rfbId/broadcast           → DRAFT → BROADCAST
 *   POST   /api/rfb/:rfbId/bids                → submit a bid (provider endpoint)
 *   PUT    /api/rfb/:rfbId/bids/:bidId/award   → award a specific bid (coordinator)
 *   PUT    /api/rfb/:rfbId/cancel              → cancel the RFB
 */

import express, { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { RfbService } from '../services/rfb.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  MatchingCriteriaSet,
  CreateRfbRequest,
  SubmitBidRequest,
  ProviderType,
} from '../types/matching.types.js';

const logger = new Logger('RfbController');

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

const validateCreateRfb = [
  body('productId').isString().notEmpty().withMessage('productId is required'),
  body('criteriaSetIds').isArray({ min: 1 }).withMessage('criteriaSetIds must be a non-empty array'),
  body('deadlineAt').isISO8601().withMessage('deadlineAt must be an ISO-8601 date-time'),
  body('autoAward').optional().isBoolean(),
  body('subjectCoords').optional().isObject(),
  body('subjectAddress').optional().isObject(),
];

const validateSubmitBid = [
  body('providerId').isString().notEmpty().withMessage('providerId is required'),
  body('providerName').isString().notEmpty().withMessage('providerName is required'),
  body('providerType')
    .isIn(['APPRAISER', 'AMC', 'INSPECTOR', 'INSPECTION_CO', 'NOTARY'])
    .withMessage('providerType must be a valid ProviderType'),
  body('proposedFee')
    .isFloat({ min: 0 })
    .withMessage('proposedFee must be a non-negative number'),
  body('proposedTurnaroundDays')
    .isInt({ min: 1 })
    .withMessage('proposedTurnaroundDays must be a positive integer'),
  body('notes').optional().isString(),
];

// ─── Helper: fetch criteria sets by IDs ──────────────────────────────────────

async function fetchCriteriaSets(
  dbService: CosmosDbService,
  ids: string[],
  tenantId: string,
): Promise<MatchingCriteriaSet[]> {
  if (!ids.length) return [];
  const container = dbService.getMatchingCriteriaSetsContainer();
  const placeholders = ids.map((_, i) => `@id${i}`).join(', ');
  const { resources } = await container.items
    .query<MatchingCriteriaSet>({
      query: `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.id IN (${placeholders})`,
      parameters: [
        { name: '@tenantId', value: tenantId },
        ...ids.map((id, i) => ({ name: `@id${i}`, value: id })),
      ],
    })
    .fetchAll();
  return resources;
}

// ─── Helper: fetch vendors for this tenant (matching candidates) ──────────────

async function fetchVendors(dbService: CosmosDbService, tenantId: string): Promise<unknown[]> {
  // getDatabase() gives direct access to the Cosmos database so we can query
  // the vendors container without depending on a dedicated accessor for this shape.
  const db = (dbService as unknown as { database: import('@azure/cosmos').Database }).database;
  if (!db) throw new Error('Cosmos database not initialized');

  const { resources } = await db
    .container('vendors')
    .items.query({
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId',
      parameters: [{ name: '@tenantId', value: tenantId }],
    })
    .fetchAll();
  return resources;
}

// ─── Service singleton (lazy, one per process) ────────────────────────────────

let _rfbService: RfbService | null = null;

function getRfbService(dbService: CosmosDbService): RfbService {
  if (!_rfbService) {
    _rfbService = new RfbService(dbService);
  }
  return _rfbService;
}

// ─── Order-scoped router (/api/orders/:orderId/rfb) ───────────────────────────

export function createOrderRfbRouter(dbService: CosmosDbService) {
  const router = express.Router({ mergeParams: true }); // inherit :orderId from parent

  /**
   * POST /preview
   * Body: { criteriaSetIds: string[], subjectCoords?, subjectAddress? }
   * Returns: ranked MatchResult[] without persisting anything.
   */
  router.post(
    '/preview',
    [
      body('criteriaSetIds').isArray({ min: 1 }).withMessage('criteriaSetIds required'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const { criteriaSetIds, subjectCoords, subjectAddress } = req.body as {
          criteriaSetIds: string[];
          subjectCoords?: { lat: number; lng: number };
          subjectAddress?: { state?: string; county?: string; zipCode?: string };
        };

        const [criteriaSets, vendors] = await Promise.all([
          fetchCriteriaSets(dbService, criteriaSetIds, tenantId),
          fetchVendors(dbService, tenantId),
        ]);

        const missingIds = criteriaSetIds.filter(
          (id) => !criteriaSets.find((cs) => cs.id === id),
        );
        if (missingIds.length) {
          res.status(400).json({
            error: `Criteria sets not found for tenant: ${missingIds.join(', ')}`,
          });
          return;
        }

        const service = getRfbService(dbService);
        const shortlist = service.runPreview(
          vendors as never,
          criteriaSets,
          subjectCoords ?? null,
          subjectAddress,
        );

        res.json({ shortlist, matchedCount: shortlist.length });
      } catch (err) {
        logger.error('rfb preview failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /
   * Body: CreateRfbRequest fields (minus orderId, which comes from the route param)
   * Returns: the created DRAFT RfbRequest document.
   */
  router.post(
    '/',
    ...validateCreateRfb,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
        const orderId = req.params['orderId'] as string;

        const { productId, criteriaSetIds, deadlineAt, autoAward, subjectCoords, subjectAddress } =
          req.body as CreateRfbRequest & {
            subjectCoords?: { lat: number; lng: number };
            subjectAddress?: { state?: string; county?: string; zipCode?: string };
          };

        const [criteriaSets, vendors] = await Promise.all([
          fetchCriteriaSets(dbService, criteriaSetIds, tenantId),
          fetchVendors(dbService, tenantId),
        ]);

        const missingIds = criteriaSetIds.filter(
          (id) => !criteriaSets.find((cs) => cs.id === id),
        );
        if (missingIds.length) {
          res.status(400).json({
            error: `Criteria sets not found for tenant: ${missingIds.join(', ')}`,
          });
          return;
        }

        const service = getRfbService(dbService);
        const rfb = await service.createRfb({
          request: {
            orderId,
            productId,
            criteriaSetIds,
            deadlineAt,
            ...(autoAward !== undefined && { autoAward }),
          },
          tenantId,
          createdBy,
          providers: vendors as never,
          criteriaSets,
          ...(subjectCoords !== undefined && { subjectCoords: subjectCoords ?? null }),
          ...(subjectAddress !== undefined && { subjectAddress }),
        });

        res.status(201).json(rfb);
      } catch (err) {
        logger.error('createRfb failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /
   * Returns: all RFB documents for this order.
   */
  router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const orderId = req.params['orderId'] as string;
      const service = getRfbService(dbService);
      const rfbs = await service.listForOrder(orderId);

      // Tenant guard — rfb-requests partition key is orderId, so filter manually
      const tenantRfbs = rfbs.filter((r) => r.tenantId === tenantId);
      res.json({ rfbs: tenantRfbs, count: tenantRfbs.length });
    } catch (err) {
      logger.error('listRfbs failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /active
   * Returns: the most recent non-terminal RFB for this order, or 404.
   */
  router.get('/active', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const orderId = req.params['orderId'] as string;
      const service = getRfbService(dbService);
      const rfb = await service.getActiveForOrder(orderId);

      if (!rfb) {
        res.status(404).json({ error: 'No active RFB found for this order' });
        return;
      }
      if (rfb.tenantId !== tenantId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      res.json(rfb);
    } catch (err) {
      logger.error('getActiveRfb failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// ─── RFB-action router (/api/rfb/:rfbId/...) ─────────────────────────────────

export function createRfbActionRouter(dbService: CosmosDbService) {
  const router = express.Router();

  /**
   * POST /:rfbId/broadcast
   * Body: { orderId: string }
   * Transitions DRAFT → BROADCAST.
   */
  router.post(
    '/:rfbId/broadcast',
    [
      param('rfbId').isString().notEmpty(),
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const rfbId = req.params['rfbId'] as string;
        const { orderId } = req.body as { orderId: string };
        const service = getRfbService(dbService);
        const rfb = await service.broadcastRfb(rfbId, orderId, tenantId);
        res.json(rfb);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('broadcastRfb failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes("not belong") ? 403 : 400;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * POST /:rfbId/bids
   * Body: SubmitBidRequest + { orderId: string }
   * Vendor submits a bid.
   */
  router.post(
    '/:rfbId/bids',
    [
      param('rfbId').isString().notEmpty(),
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      ...validateSubmitBid,
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const rfbId = req.params['rfbId'] as string;
        const { orderId, ...bidBody } = req.body as SubmitBidRequest & { orderId: string };
        const service = getRfbService(dbService);
        const rfb = await service.submitBid(rfbId, orderId, bidBody, tenantId);
        res.status(201).json(rfb);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('submitBid failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes("not belong") ? 403 : 400;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * PUT /:rfbId/bids/:bidId/award
   * Body: { orderId: string }
   * Coordinator awards a specific bid.
   */
  router.put(
    '/:rfbId/bids/:bidId/award',
    [
      param('rfbId').isString().notEmpty(),
      param('bidId').isString().notEmpty(),
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const rfbId = req.params['rfbId'] as string;
        const bidId = req.params['bidId'] as string;
        const { orderId } = req.body as { orderId: string };
        const service = getRfbService(dbService);
        const rfb = await service.awardBid(rfbId, orderId, bidId, tenantId);
        res.json(rfb);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('awardBid failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes("not belong") ? 403 : 400;
        res.status(status).json({ error: msg });
      }
    },
  );

  /**
   * PUT /:rfbId/cancel
   * Body: { orderId: string }
   */
  router.put(
    '/:rfbId/cancel',
    [
      param('rfbId').isString().notEmpty(),
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const rfbId = req.params['rfbId'] as string;
        const { orderId } = req.body as { orderId: string };
        const service = getRfbService(dbService);
        const rfb = await service.cancelRfb(rfbId, orderId, tenantId);
        res.json(rfb);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        logger.error('cancelRfb failed', { error: err });
        const status = msg.includes('not found') ? 404 : msg.includes("not belong") ? 403 : 400;
        res.status(status).json({ error: msg });
      }
    },
  );

  return router;
}
