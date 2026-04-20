/**
 * Engagement Controller
 *
 * Routes (all tenant-authenticated):
 *
 *   GET    /api/engagements                                                    → list engagements (search/filter/page)
 *   POST   /api/engagements                                                    → create engagement
 *   GET    /api/engagements/:id                                                → get engagement
 *   PUT    /api/engagements/:id                                                → update engagement
 *   PATCH  /api/engagements/:id/status                                         → change engagement status
 *   DELETE /api/engagements/:id                                                → soft-delete (sets status=CANCELLED)
 *   GET    /api/engagements/:id/vendor-orders                                  → list linked vendor orders
 *   GET    /api/engagements/:id/arv                                            → list linked ARV analyses
 *   GET    /api/engagements/:id/qc                                             → list linked QC reviews
 *   GET    /api/engagements/:id/documents                                      → list linked documents
 *   GET    /api/engagements/:id/communications                                 → list engagement + rolled-up order comms
 *   GET    /api/engagements/:id/loans                                          → list loans in engagement
 *   POST   /api/engagements/:id/loans                                          → add a loan to engagement
 *   GET    /api/engagements/:id/loans/:loanId                                  → get a specific loan
 *   PUT    /api/engagements/:id/loans/:loanId                                  → update loan fields
 *   PATCH  /api/engagements/:id/loans/:loanId/status                           → change loan status
 *   DELETE /api/engagements/:id/loans/:loanId                                  → remove loan (no linked orders)
 *   POST   /api/engagements/:id/loans/:loanId/products                         → add product to loan
 *   POST   /api/engagements/:id/loans/:loanId/products/:productId/vendor-orders → link vendor order to product
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { EngagementService } from '../services/engagement.service.js';
import { PropertyRecordService } from '../services/property-record.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import {
  EngagementStatus,
  EngagementLoanStatus,
  EngagementProductType,
} from '../types/engagement.types.js';
import type {
  CreateEngagementRequest,
  UpdateEngagementRequest,
  CreateEngagementLoanRequest,
  UpdateEngagementLoanRequest,
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
const LOAN_STATUSES = Object.values(EngagementLoanStatus);
const PRIORITIES = Object.values(OrderPriority);

const validateCreate = [
  body('client').isObject().withMessage('client is required'),
  body('client.clientId').isString().notEmpty().withMessage('client.clientId is required'),
  body('client.clientName').isString().notEmpty().withMessage('client.clientName is required'),
  body('loans').isArray({ min: 1 }).withMessage('At least one loan is required'),
  body('loans.*.loanNumber').isString().notEmpty().withMessage('loans[*].loanNumber is required'),
  body('loans.*.borrowerName').isString().notEmpty().withMessage('loans[*].borrowerName is required'),
  body('loans.*.property').isObject().withMessage('loans[*].property is required'),
  body('loans.*.property.address').isString().notEmpty().withMessage('loans[*].property.address is required'),
  body('loans.*.property.state').isString().isLength({ min: 2, max: 2 }).withMessage('loans[*].property.state must be 2-char abbreviation'),
  body('loans.*.property.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('loans[*].property.zipCode must be 5 or 9 digits'),
  body('loans.*.products').isArray({ min: 1 }).withMessage('Each loan must have at least one product'),
  body('loans.*.products.*.productType')
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

const validateAddVendorOrder = [
  param('id').isString().notEmpty().withMessage('engagement id is required'),
  param('loanId').isString().notEmpty().withMessage('loanId is required'),
  param('productId').isString().notEmpty().withMessage('productId is required'),
  body('vendorOrderId').isString().notEmpty().withMessage('vendorOrderId is required'),
];

const validateAddLoan = [
  param('id').isString().notEmpty().withMessage('engagement id is required'),
  body('loanNumber').isString().notEmpty().withMessage('loanNumber is required'),
  body('borrowerName').isString().notEmpty().withMessage('borrowerName is required'),
  body('property').isObject().withMessage('property is required'),
  body('property.address').isString().notEmpty().withMessage('property.address is required'),
  body('property.state').isString().isLength({ min: 2, max: 2 }).withMessage('property.state must be 2-char abbreviation'),
  body('property.zipCode').matches(/^\d{5}(-\d{4})?$/).withMessage('property.zipCode must be 5 or 9 digits'),
  body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('products.*.productType').isIn(PRODUCT_TYPES).withMessage(`productType must be one of: ${PRODUCT_TYPES.join(', ')}`),
];

const validateLoanStatusPatch = [
  param('id').isString().notEmpty().withMessage('engagement id is required'),
  param('loanId').isString().notEmpty().withMessage('loanId is required'),
  body('status')
    .isIn(LOAN_STATUSES)
    .withMessage(`status must be one of: ${LOAN_STATUSES.join(', ')}`),
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
  const service = new EngagementService(dbService, new PropertyRecordService(dbService));

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
          client: req.body.client,
          loans: req.body.loans as CreateEngagementLoanRequest[],
          ...(req.body.priority !== undefined && { priority: req.body.priority }),
          ...(req.body.clientDueDate !== undefined && { clientDueDate: req.body.clientDueDate }),
          ...(req.body.internalDueDate !== undefined && { internalDueDate: req.body.internalDueDate }),
          ...(req.body.totalEngagementFee !== undefined && { totalEngagementFee: req.body.totalEngagementFee }),
          ...(req.body.accessInstructions !== undefined && { accessInstructions: req.body.accessInstructions }),
          ...(req.body.specialInstructions !== undefined && { specialInstructions: req.body.specialInstructions }),
          ...(req.body.engagementInstructions !== undefined && { engagementInstructions: req.body.engagementInstructions }),
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

        // QuickBooks Integration: Auto-generate AP Bill for Vendor on Engagement completion
        if (req.body.status === EngagementStatus.DELIVERED) {
          import('../services/quickbooks.service.js').then(({ QuickBooksService }) => {
            const qbService = new QuickBooksService();
            const vendorId = (engagement as any).vendorId || (engagement as any).vendor?.id || "1";
            qbService.createBill(engagement, vendorId).catch((err: any) => {
              logger.error('Failed to auto-generate QuickBooks Bill on engagement completion', { engagementId: req.params['id'], error: err });
            });
          }).catch((err: any) => {
            logger.error('Failed to load QuickBooksService for auto-bill', { engagementId: req.params['id'], error: err });
          });
        }

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

  // ── DELETE /:id ────────────────────────────────────────────────────────────
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
        return res.json({ success: true, message: 'Engagement deleted' });
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

  // ── GET /:id/communications ────────────────────────────────────────────────
  router.get(
    '/:id/communications',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const records = await service.getCommunications(req.params['id'] as string, tenantId);
        // Map to a consistent CommunicationHistoryItem-shaped response
        const data = records.map((m: any) => ({
          id: m.id,
          type: m.channel,
          direction: m.direction,
          from: m.from?.name ?? m.from ?? '',
          to: Array.isArray(m.to) ? (m.to[0]?.email ?? m.to[0]?.name ?? '') : (m.to ?? ''),
          subject: m.subject,
          body: m.body,
          status: m.status,
          timestamp: m.sentAt ?? m.createdAt,
          primaryEntity: m.primaryEntity,
          metadata: m.metadata,
        }));
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('getCommunications failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get communications' });
      }
    },
  );

  // ── GET /:id/loans ─────────────────────────────────────────────────────────
  router.get(
    '/:id/loans',
    param('id').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const loans = await service.getLoans(req.params['id'] as string, tenantId);
        return res.json({ success: true, data: loans });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('getLoans failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get loans' });
      }
    },
  );

  // ── POST /:id/loans ────────────────────────────────────────────────────────
  router.post(
    '/:id/loans',
    ...validateAddLoan,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.addLoanToEngagement(
          req.params['id'] as string,
          tenantId,
          req.body as CreateEngagementLoanRequest,
          updatedBy,
        );
        return res.status(201).json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        if (msg.includes('not yet supported')) return res.status(400).json({ success: false, error: msg });
        logger.error('addLoanToEngagement failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to add loan' });
      }
    },
  );

  // ── GET /:id/loans/:loanId ─────────────────────────────────────────────────
  router.get(
    '/:id/loans/:loanId',
    param('id').isString().notEmpty(),
    param('loanId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const loans = await service.getLoans(req.params['id'] as string, tenantId);
        const loan = loans.find((l) => l.id === req.params['loanId']);
        if (!loan) {
          return res.status(404).json({ success: false, error: `Loan not found: loanId=${req.params['loanId']}` });
        }
        return res.json({ success: true, data: loan });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        logger.error('getLoan failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to get loan' });
      }
    },
  );

  // ── PUT /:id/loans/:loanId ─────────────────────────────────────────────────
  router.put(
    '/:id/loans/:loanId',
    param('id').isString().notEmpty(),
    param('loanId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.updateLoan(
          req.params['id'] as string,
          tenantId,
          req.params['loanId'] as string,
          req.body as UpdateEngagementLoanRequest,
          updatedBy,
        );
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        logger.error('updateLoan failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to update loan' });
      }
    },
  );

  // ── PATCH /:id/loans/:loanId/status ───────────────────────────────────────
  router.patch(
    '/:id/loans/:loanId/status',
    ...validateLoanStatusPatch,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.changeLoanStatus(
          req.params['id'] as string,
          tenantId,
          req.params['loanId'] as string,
          req.body.status as EngagementLoanStatus,
          updatedBy,
        );
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        if (msg.includes('Invalid loan status')) return res.status(422).json({ success: false, error: msg });
        logger.error('changeLoanStatus failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to change loan status' });
      }
    },
  );

  // ── DELETE /:id/loans/:loanId ─────────────────────────────────────────────
  router.delete(
    '/:id/loans/:loanId',
    param('id').isString().notEmpty(),
    param('loanId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        await service.removeLoan(
          req.params['id'] as string,
          tenantId,
          req.params['loanId'] as string,
          updatedBy,
        );
        return res.json({ success: true, message: 'Loan removed' });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        if (msg.includes('Cannot remove loan')) return res.status(409).json({ success: false, error: msg });
        logger.error('removeLoan failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to remove loan' });
      }
    },
  );

  // ── POST /:id/loans/:loanId/products ──────────────────────────────────────
  router.post(
    '/:id/loans/:loanId/products',
    param('id').isString().notEmpty(),
    param('loanId').isString().notEmpty(),
    body('productType').isIn(PRODUCT_TYPES).withMessage(`productType must be one of: ${PRODUCT_TYPES.join(', ')}`),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.addProductToLoan(
          req.params['id'] as string,
          tenantId,
          req.params['loanId'] as string,
          req.body,
          updatedBy,
        );
        return res.status(201).json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) return res.status(404).json({ success: false, error: msg });
        logger.error('addProductToLoan failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to add product to loan' });
      }
    },
  );

  // ── POST /:id/loans/:loanId/products/:productId/vendor-orders ─────────────
  router.post(
    '/:id/loans/:loanId/products/:productId/vendor-orders',
    ...validateAddVendorOrder,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const updatedBy = resolveUserId(req);
        const engagement = await service.addVendorOrderToProduct(
          req.params['id'] as string,
          tenantId,
          req.params['loanId'] as string,
          req.params['productId'] as string,
          req.body.vendorOrderId as string,
          updatedBy,
        );
        return res.json({ success: true, data: engagement });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('not found')) {
          return res.status(404).json({ success: false, error: msg });
        }
        logger.error('addVendorOrderToProduct failed', { error });
        return res.status(500).json({ success: false, error: 'Failed to link vendor order to product' });
      }
    },
  );

  return router;
}
