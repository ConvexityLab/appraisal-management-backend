/**
 * Construction Finance Module — Construction Loan Controller
 *
 * Routes (all protected by unifiedAuth):
 *   GET    /                                          → listLoans      (?status=, ?loanType=)
 *   POST   /                                          → createLoan
 *   GET    /by-order/:orderId                       → getLoansByOrderId
 *   GET    /:loanId/budget                           → getLoanBudget
 *   PUT    /:loanId/budget                           → updateLoanBudget
 *   GET    /:loanId/draws                            → listDraws
 *   GET    /:loanId/draws/:drawId/inspection         → getDrawInspection
 *   GET    /:loanId/draws/:drawId                    → getDrawById
 *   POST   /:loanId/draws                            → submitDraw
 *   POST   /:loanId/draws/:drawId/approve            → approveDrawLineItems
 *   GET    /:loanId/change-orders                    → listChangeOrders
 *   GET    /:loanId/change-orders/:coId              → getChangeOrderById
 *   POST   /:loanId/change-orders                    → submitChangeOrder
 *   POST   /:loanId/change-orders/:coId/approve      → approveChangeOrder
 *   GET    /:loanId                                  → getLoanById
 *   PATCH  /:loanId/status                           → updateLoanStatus
 *   POST   /:loanId/linked-orders                    → linkOrder
 *   DELETE /:loanId/linked-orders/:orderId           → unlinkOrder
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionLoanService } from '../services/construction-loan.service.js';
import { DrawRequestService } from '../services/draw-request.service.js';
import { DrawInspectionService } from '../services/draw-inspection.service.js';
import { ChangeOrderService } from '../services/change-order.service.js';
import { ConstructionConfigService } from '../services/construction-config.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { ConstructionLoanStatus, ConstructionLoanType } from '../types/index.js';
import type { LinkOrderInput } from '../services/construction-loan.service.js';
import type { DrawLineItemResult } from '../types/draw-request.types.js';

const VALID_LINKED_ORDER_ROLES = [
  'ARV_APPRAISAL', 'AS_BUILT_APPRAISAL', 'DRAW_INSPECTION',
  'TITLE_UPDATE', 'ENVIRONMENTAL', 'STRUCTURAL_INSPECTION', 'SURVEY', 'OTHER',
] as const;

const logger = new Logger('ConstructionLoanController');

const VALID_LOAN_TYPES: ConstructionLoanType[] = [
  'GROUND_UP', 'FIX_FLIP', 'REHAB', 'MULTIFAMILY', 'COMMERCIAL',
];

const VALID_LOAN_STATUSES: ConstructionLoanStatus[] = [
  'UNDERWRITING', 'APPROVED', 'ACTIVE', 'SUBSTANTIALLY_COMPLETE',
  'COMPLETED', 'IN_DEFAULT', 'CLOSED',
];

export class ConstructionLoanController {
  public router: Router;
  private readonly loanService: ConstructionLoanService;
  private readonly drawService: DrawRequestService;
  private readonly drawInspectionService: DrawInspectionService;
  private readonly changeOrderService: ChangeOrderService;
  private readonly configService: ConstructionConfigService;

  constructor(private readonly dbService: CosmosDbService) {
    this.loanService = new ConstructionLoanService(dbService);
    this.drawService = new DrawRequestService(dbService);
    this.drawInspectionService = new DrawInspectionService(dbService);
    this.changeOrderService = new ChangeOrderService(dbService);
    this.configService = new ConstructionConfigService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get(
      '/',
      [
        query('status').optional().isIn(VALID_LOAN_STATUSES).withMessage('Invalid status filter'),
        query('loanType').optional().isIn(VALID_LOAN_TYPES).withMessage('Invalid loanType filter'),
      ],
      this.listLoans.bind(this)
    );

    this.router.post(
      '/',
      [
        body('loanNumber').notEmpty().withMessage('loanNumber is required'),
        body('loanType').isIn(VALID_LOAN_TYPES).withMessage('Invalid loanType'),
        body('loanAmount').isFloat({ gt: 0 }).withMessage('loanAmount must be a positive number'),
        body('interestRate').isFloat({ gt: 0 }).withMessage('interestRate must be a positive number'),
        body('maturityDate').isISO8601().withMessage('maturityDate must be a valid ISO date'),
        body('interestReserveAmount').isFloat({ min: 0 }).withMessage('interestReserveAmount must be ≥ 0'),
        body('propertyAddress.street').notEmpty().withMessage('propertyAddress.street is required'),
        body('propertyAddress.city').notEmpty().withMessage('propertyAddress.city is required'),
        body('propertyAddress.state').notEmpty().withMessage('propertyAddress.state is required'),
        body('propertyAddress.zipCode').notEmpty().withMessage('propertyAddress.zipCode is required'),
        body('propertyAddress.county').notEmpty().withMessage('propertyAddress.county is required'),
        body('propertyType').notEmpty().withMessage('propertyType is required'),
        body('borrowerId').notEmpty().withMessage('borrowerId is required'),
        body('borrowerName').notEmpty().withMessage('borrowerName is required'),
        body('expectedCompletionDate').isISO8601().withMessage('expectedCompletionDate must be a valid ISO date'),
        body('retainagePercent').isFloat({ min: 0, max: 100 }).withMessage('retainagePercent must be 0–100'),
      ],
      this.createLoan.bind(this)
    );

    // All /:loanId/sub-routes must be defined BEFORE /:loanId to avoid shadowing
    this.router.get(
      '/:loanId/budget',
      [param('loanId').notEmpty()],
      this.getLoanBudget.bind(this)
    );

    this.router.put(
      '/:loanId/budget',
      [
        param('loanId').notEmpty(),
        body('lineItems').isArray({ min: 1 }).withMessage('lineItems must be a non-empty array'),
      ],
      this.updateLoanBudget.bind(this)
    );

    // ── Draw sub-routes ──────────────────────────────────────────────────────
    this.router.get(
      '/:loanId/draws',
      [param('loanId').notEmpty()],
      this.listDraws.bind(this)
    );

    // draws/:drawId/inspection must be before draws/:drawId to avoid collision
    this.router.get(
      '/:loanId/draws/:drawId/inspection',
      [param('loanId').notEmpty(), param('drawId').notEmpty()],
      this.getDrawInspection.bind(this)
    );

    this.router.get(
      '/:loanId/draws/:drawId',
      [param('loanId').notEmpty(), param('drawId').notEmpty()],
      this.getDrawById.bind(this)
    );

    this.router.post(
      '/:loanId/draws',
      [
        param('loanId').notEmpty(),
        body('budgetId').notEmpty().withMessage('budgetId is required'),
        body('lineItemRequests').isArray({ min: 1 }).withMessage('lineItemRequests must be a non-empty array'),
      ],
      this.submitDraw.bind(this)
    );

    this.router.post(
      '/:loanId/draws/:drawId/approve',
      [
        param('loanId').notEmpty(),
        param('drawId').notEmpty(),
        body('lineItemResults').isArray({ min: 1 }).withMessage('lineItemResults must be a non-empty array'),
        body('reviewedBy').notEmpty().withMessage('reviewedBy is required'),
      ],
      this.approveDrawLineItems.bind(this)
    );

    // ── Change-order sub-routes ──────────────────────────────────────────────
    this.router.get(
      '/:loanId/change-orders',
      [param('loanId').notEmpty()],
      this.listChangeOrders.bind(this)
    );

    // change-orders/:coId/approve must be before change-orders/:coId
    this.router.post(
      '/:loanId/change-orders/:coId/approve',
      [
        param('loanId').notEmpty(),
        param('coId').notEmpty(),
      ],
      this.approveChangeOrder.bind(this)
    );

    this.router.get(
      '/:loanId/change-orders/:coId',
      [param('loanId').notEmpty(), param('coId').notEmpty()],
      this.getChangeOrderById.bind(this)
    );

    this.router.post(
      '/:loanId/change-orders',
      [
        param('loanId').notEmpty(),
        body('budgetId').notEmpty().withMessage('budgetId is required'),
        body('reason').notEmpty().withMessage('reason is required'),
        body('requestedBy').notEmpty().withMessage('requestedBy is required'),
        body('lineItemChanges').isArray({ min: 1 }).withMessage('lineItemChanges must be a non-empty array'),
      ],
      this.submitChangeOrder.bind(this)
    );

    this.router.get(
      '/:loanId',
      [param('loanId').notEmpty()],
      this.getLoanById.bind(this)
    );

    this.router.patch(
      '/:loanId/status',
      [
        param('loanId').notEmpty(),
        body('status').isIn(VALID_LOAN_STATUSES).withMessage('Invalid status'),
      ],
      this.updateLoanStatus.bind(this)
    );

    // GET /by-order/:orderId must be defined BEFORE /:loanId to avoid shadowing
    this.router.get(
      '/by-order/:orderId',
      [param('orderId').notEmpty()],
      this.getLoansByOrderId.bind(this)
    );

    this.router.post(
      '/:loanId/linked-orders',
      [
        param('loanId').notEmpty(),
        body('orderId').notEmpty().withMessage('orderId is required'),
        body('role').isIn(VALID_LINKED_ORDER_ROLES).withMessage('Invalid role'),
        body('orderNumber').optional().isString(),
        body('orderStatus').optional().isString(),
        body('notes').optional().isString(),
      ],
      this.linkOrder.bind(this)
    );

    this.router.delete(
      '/:loanId/linked-orders/:orderId',
      [
        param('loanId').notEmpty(),
        param('orderId').notEmpty(),
      ],
      this.unlinkOrder.bind(this)
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  public async listLoans(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const statusParam = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const loanTypeParam = typeof req.query['loanType'] === 'string' ? req.query['loanType'] : undefined;

      const loans = await this.loanService.listLoans(tenantId, {
        ...(statusParam && { status: statusParam as ConstructionLoanStatus }),
        ...(loanTypeParam && { loanType: loanTypeParam as ConstructionLoanType }),
      });

      res.json({ loans, count: loans.length });
    } catch (error) {
      logger.error('listLoans failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async createLoan(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const loan = await this.loanService.createLoan({ ...req.body, tenantId, createdBy });
      res.status(201).json(loan);
    } catch (error) {
      logger.error('createLoan failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getLoanBudget(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };

      // Budget documents live in construction-loans container with type discriminator.
      // The seed and service use `constructionLoanId` as the foreign-key field name.
      const results = await this.dbService.queryDocuments<Record<string, unknown>>(
        'construction-loans',
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.constructionLoanId = @constructionLoanId AND c.type = @type ORDER BY c.version DESC',
        [
          { name: '@tenantId', value: tenantId },
          { name: '@constructionLoanId', value: loanId },
          { name: '@type', value: 'construction-budget' },
        ]
      );

      if (!results.length) {
        res.status(404).json({
          error: 'BUDGET_NOT_FOUND',
          message: `No budget found for loan ${loanId}`,
        });
        return;
      }

      res.json(results[0]);
    } catch (error) {
      logger.error('getLoanBudget failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateLoanBudget(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const updatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      // Fetch the existing budget document
      const results = await this.dbService.queryDocuments<Record<string, unknown>>(
        'construction-loans',
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.constructionLoanId = @constructionLoanId AND c.type = @type ORDER BY c.version DESC',
        [
          { name: '@tenantId', value: tenantId },
          { name: '@constructionLoanId', value: loanId },
          { name: '@type', value: 'construction-budget' },
        ]
      );

      if (!results.length) {
        res.status(404).json({
          error: 'BUDGET_NOT_FOUND',
          message: `No budget found for loan ${loanId}`,
        });
        return;
      }

      const existing = results[0] as Record<string, unknown>;
      const incomingLineItems = req.body.lineItems as Array<Record<string, unknown>>;

      // Recompute derived totals
      let totalOriginalBudget = 0;
      let totalRevisedBudget = 0;
      let totalDrawnToDate = 0;

      const lineItems = incomingLineItems.map((item) => {
        const original = Number(item['originalAmount'] ?? 0);
        const changeOrder = Number(item['changeOrderAmount'] ?? 0);
        const revised = original + changeOrder;
        const drawn = Number(item['drawnToDate'] ?? 0);
        const remaining = revised - drawn;
        const percentDisbursed = revised > 0 ? (drawn / revised) * 100 : 0;

        totalOriginalBudget += original;
        totalRevisedBudget += revised;
        totalDrawnToDate += drawn;

        return {
          ...item,
          revisedAmount: revised,
          remainingBalance: remaining,
          percentDisbursed: Math.round(percentDisbursed * 100) / 100,
        };
      });

      const updated = {
        ...existing,
        lineItems,
        totalOriginalBudget,
        totalRevisedBudget,
        totalDrawnToDate,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      const saved = await this.dbService.upsertDocument('construction-loans', updated);
      res.json(saved);
    } catch (error) {
      logger.error('updateLoanBudget failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getLoanById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };

      const loan = await this.loanService.getLoanById(loanId, tenantId);
      res.json(loan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'LOAN_NOT_FOUND', message: msg });
        return;
      }
      logger.error('getLoanById failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateLoanStatus(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const updatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const { status } = req.body as { status: ConstructionLoanStatus };

      const loan = await this.loanService.updateLoanStatus(loanId, tenantId, status, updatedBy);
      res.json(loan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'LOAN_NOT_FOUND', message: msg });
        return;
      }
      if (msg.includes('invalid transition')) {
        res.status(422).json({ error: 'INVALID_STATUS_TRANSITION', message: msg });
        return;
      }
      logger.error('updateLoanStatus failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  // ─── linkOrder ────────────────────────────────────────────────────────────────────

  public async linkOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const linkedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const input: LinkOrderInput = {
        orderId:     req.body.orderId,
        role:        req.body.role,
        ...(req.body.orderNumber  !== undefined && { orderNumber:  req.body.orderNumber }),
        ...(req.body.orderStatus  !== undefined && { orderStatus:  req.body.orderStatus }),
        ...(req.body.notes        !== undefined && { notes:        req.body.notes }),
      };

      const loan = await this.loanService.linkOrder(loanId, tenantId, input, linkedBy);
      res.json(loan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'LOAN_NOT_FOUND', message: msg });
        return;
      }
      logger.error('linkOrder failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── unlinkOrder ───────────────────────────────────────────────────────────────────

  public async unlinkOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId, orderId } = req.params as { loanId: string; orderId: string };
      const unlinkedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const loan = await this.loanService.unlinkOrder(loanId, tenantId, orderId, unlinkedBy);
      res.json(loan);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'LOAN_NOT_FOUND', message: msg });
        return;
      }
      logger.error('unlinkOrder failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── getLoansByOrderId ─────────────────────────────────────────────────────────────────

  public async getLoansByOrderId(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { orderId } = req.params as { orderId: string };

      const loans = await this.loanService.getLoansByOrderId(orderId, tenantId);
      res.json({ loans, count: loans.length });
    } catch (error) {
      logger.error('getLoansByOrderId failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  // ─── Draw Handlers ──────────────────────────────────────────────────────────

  public async listDraws(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const draws = await this.drawService.listDrawsForLoan(loanId, tenantId);
      res.json({ draws, count: draws.length });
    } catch (error) {
      logger.error('listDraws failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getDrawById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const { loanId, drawId } = req.params as { loanId: string; drawId: string };
      const draw = await this.drawService.getDrawById(drawId, loanId);
      res.json(draw);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'DRAW_NOT_FOUND', message: msg });
        return;
      }
      logger.error('getDrawById failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getDrawInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const { loanId, drawId } = req.params as { loanId: string; drawId: string };
      const inspections = await this.drawInspectionService.listInspectionsByDraw(drawId, loanId);
      res.json({ inspections, count: inspections.length });
    } catch (error) {
      logger.error('getDrawInspection failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async submitDraw(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const requestedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const config = await this.configService.getConfig(tenantId);
      const draw = await this.drawService.submitDraw(
        {
          constructionLoanId: loanId,
          budgetId: req.body.budgetId,
          tenantId,
          requestedBy,
          lineItemRequests: req.body.lineItemRequests,
          ...(req.body.notes !== undefined && { notes: req.body.notes }),
        },
        config
      );
      res.status(201).json(draw);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('concurrent draw')) {
        res.status(409).json({ error: 'CONCURRENT_DRAW_CONFLICT', message: msg });
        return;
      }
      if (msg.includes('lien waiver')) {
        res.status(422).json({ error: 'LIEN_WAIVER_REQUIRED', message: msg });
        return;
      }
      logger.error('submitDraw failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async approveDrawLineItems(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const { loanId, drawId } = req.params as { loanId: string; drawId: string };
      const { lineItemResults, reviewedBy } = req.body as {
        lineItemResults: DrawLineItemResult[];
        reviewedBy: string;
      };
      const draw = await this.drawService.approveDrawLineItems(drawId, loanId, lineItemResults, reviewedBy);
      res.json(draw);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'DRAW_NOT_FOUND', message: msg });
        return;
      }
      if (msg.includes('must be in UNDER_REVIEW')) {
        res.status(422).json({ error: 'INVALID_DRAW_STATUS', message: msg });
        return;
      }
      logger.error('approveDrawLineItems failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── Change Order Handlers ────────────────────────────────────────────────────

  public async listChangeOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const changeOrders = await this.changeOrderService.listChangeOrders(tenantId, { constructionLoanId: loanId });
      res.json({ changeOrders, count: changeOrders.length });
    } catch (error) {
      logger.error('listChangeOrders failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getChangeOrderById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { coId } = req.params as { coId: string };
      const co = await this.changeOrderService.getChangeOrderById(coId, tenantId);
      res.json(co);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'CHANGE_ORDER_NOT_FOUND', message: msg });
        return;
      }
      logger.error('getChangeOrderById failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async submitChangeOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { loanId } = req.params as { loanId: string };
      const co = await this.changeOrderService.submitChangeOrder({
        constructionLoanId: loanId,
        tenantId,
        budgetId: req.body.budgetId,
        reason: req.body.reason,
        requestedBy: req.body.requestedBy,
        lineItemChanges: req.body.lineItemChanges,
      });
      res.status(201).json(co);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'BUDGET_NOT_FOUND', message: msg });
        return;
      }
      logger.error('submitChangeOrder failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async approveChangeOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const { coId } = req.params as { coId: string };
      const approverId = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const co = await this.changeOrderService.approveChangeOrder(coId, tenantId, approverId);
      res.json(co);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'CHANGE_ORDER_NOT_FOUND', message: msg });
        return;
      }
      if (msg.includes('invalid transition')) {
        res.status(422).json({ error: 'INVALID_STATUS_TRANSITION', message: msg });
        return;
      }
      logger.error('approveChangeOrder failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tid =
      req.user?.tenantId ??
      (req.headers['x-tenant-id'] as string | undefined);
    if (!tid) {
      throw new Error(
        'tenant ID is required but was not found in the auth token or x-tenant-id header'
      );
    }
    return tid;
  }
}
