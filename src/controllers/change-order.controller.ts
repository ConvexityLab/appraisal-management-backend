/**
 * Construction Finance Module — Change Order Controller
 *
 * Routes (all protected by unifiedAuth, mounted at /api/construction/change-orders):
 *   POST   /              → submitChangeOrder
 *   GET    /              → listChangeOrders  (optional ?loanId= filter)
 *   GET    /:coId         → getChangeOrderById
 *   PUT    /:coId/review  → reviewChangeOrder
 *   PUT    /:coId/approve → approveChangeOrder
 *   PUT    /:coId/reject  → rejectChangeOrder
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ChangeOrderService } from '../services/change-order.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('ChangeOrderController');

export class ChangeOrderController {
  public router: Router;
  private readonly service: ChangeOrderService;

  constructor(private readonly dbService: CosmosDbService) {
    this.service = new ChangeOrderService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post(
      '/',
      [
        body('constructionLoanId').notEmpty().withMessage('constructionLoanId is required'),
        body('budgetId').notEmpty().withMessage('budgetId is required'),
        body('reason').notEmpty().withMessage('reason is required'),
        body('requestedBy').notEmpty().withMessage('requestedBy is required'),
        body('lineItemChanges').isArray({ min: 1 }).withMessage('lineItemChanges must be a non-empty array'),
        body('lineItemChanges.*.budgetLineItemId')
          .notEmpty()
          .withMessage('each lineItemChange must have a budgetLineItemId'),
        body('lineItemChanges.*.delta')
          .isNumeric()
          .withMessage('each lineItemChange.delta must be numeric'),
        body('lineItemChanges.*.justification')
          .notEmpty()
          .withMessage('each lineItemChange must have a justification'),
        body('lineItemChanges.*.originalAmount')
          .isFloat({ min: 0 })
          .withMessage('each lineItemChange.originalAmount must be ≥ 0'),
        body('lineItemChanges.*.proposedAmount')
          .isFloat({ min: 0 })
          .withMessage('each lineItemChange.proposedAmount must be ≥ 0'),
      ],
      this.submitChangeOrder.bind(this)
    );

    this.router.get(
      '/',
      [
        query('loanId').optional().isString(),
      ],
      this.listChangeOrders.bind(this)
    );

    this.router.get(
      '/:coId',
      [param('coId').notEmpty()],
      this.getChangeOrderById.bind(this)
    );

    this.router.put(
      '/:coId/review',
      [
        param('coId').notEmpty(),
        body('reviewedBy').notEmpty().withMessage('reviewedBy is required'),
      ],
      this.reviewChangeOrder.bind(this)
    );

    this.router.put(
      '/:coId/approve',
      [
        param('coId').notEmpty(),
        body('approverId').notEmpty().withMessage('approverId is required'),
      ],
      this.approveChangeOrder.bind(this)
    );

    this.router.put(
      '/:coId/reject',
      [
        param('coId').notEmpty(),
        body('reason').notEmpty().withMessage('reason is required'),
        body('rejectedBy').notEmpty().withMessage('rejectedBy is required'),
      ],
      this.rejectChangeOrder.bind(this)
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tenantId = req.user?.tenantId ?? req.body?.tenantId ?? req.query?.['tenantId'];
    if (!tenantId) {
      throw new Error('tenantId could not be resolved from request context');
    }
    return tenantId as string;
  }

  public async submitChangeOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const co = await this.service.submitChangeOrder({
        constructionLoanId: req.body.constructionLoanId,
        tenantId,
        budgetId: req.body.budgetId,
        reason: req.body.reason,
        requestedBy: req.body.requestedBy,
        lineItemChanges: req.body.lineItemChanges,
      });
      res.status(201).json(co);
    } catch (err) {
      logger.error('submitChangeOrder error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({ error: msg });
    }
  }

  public async listChangeOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const loanId = typeof req.query['loanId'] === 'string' ? req.query['loanId'] : undefined;
      const results = await this.service.listChangeOrders(
        tenantId,
        loanId !== undefined ? { constructionLoanId: loanId } : {}
      );
      res.json(results);
    } catch (err) {
      logger.error('listChangeOrders error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: msg });
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
      const coId = req.params['coId']!;
      const co = await this.service.getChangeOrderById(coId, tenantId);
      res.json(co);
    } catch (err) {
      logger.error('getChangeOrderById error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      res.status(msg.includes('not found') ? 404 : 500).json({ error: msg });
    }
  }

  public async reviewChangeOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const coId = req.params['coId']!;
      const co = await this.service.reviewChangeOrder(coId, tenantId, req.body.reviewedBy);
      res.json(co);
    } catch (err) {
      logger.error('reviewChangeOrder error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('invalid transition') ? 409 : 500;
      res.status(status).json({ error: msg });
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
      const coId = req.params['coId']!;
      const co = await this.service.approveChangeOrder(coId, tenantId, req.body.approverId);
      res.json(co);
    } catch (err) {
      logger.error('approveChangeOrder error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('invalid transition') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }

  public async rejectChangeOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const coId = req.params['coId']!;
      const co = await this.service.rejectChangeOrder(coId, tenantId, req.body.reason, req.body.rejectedBy);
      res.json(co);
    } catch (err) {
      logger.error('rejectChangeOrder error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('invalid transition') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }
}
