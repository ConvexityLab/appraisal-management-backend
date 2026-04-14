/**
 * Construction Finance Module — Draw Inspection Controller
 *
 * Routes (all protected by unifiedAuth, mounted at /api/construction/draw-inspections
 *         and aliased at /api/construction/inspections):
 *   GET    /                      → listInspectionQueue  (?page=, ?pageSize=, ?status=)
 *   POST   /                      → scheduleInspection
 *   GET    /:inspectionId         → getInspectionById  (requires ?constructionLoanId=)
 *   GET    /by-draw/:drawRequestId → listByDraw         (requires ?constructionLoanId=)
 *   PUT    /:inspectionId/submit  → submitInspectionReport
 *   PUT    /:inspectionId/accept  → acceptInspection
 *   PUT    /:inspectionId/dispute → disputeInspection
 */

import { Router, Response, RequestHandler } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { DrawInspectionService } from '../services/draw-inspection.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { DrawInspectionType } from '../types/index.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('DrawInspectionController');

const VALID_INSPECTION_TYPES: DrawInspectionType[] = ['FIELD', 'DESKTOP', 'DRIVE_BY', 'FINAL'];

export class DrawInspectionController {
  public router: Router;
  private readonly service: DrawInspectionService;

  constructor(
    private readonly dbService: CosmosDbService,
    private readonly authzMiddleware?: AuthorizationMiddleware
  ) {
    this.service = new DrawInspectionService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const read:   RequestHandler[] = this.authzMiddleware ? [this.authzMiddleware.loadUserProfile(), this.authzMiddleware.authorize('inspection', 'read')]   : [];
    const create: RequestHandler[] = this.authzMiddleware ? [this.authzMiddleware.loadUserProfile(), this.authzMiddleware.authorize('inspection', 'create')] : [];
    const update: RequestHandler[] = this.authzMiddleware ? [this.authzMiddleware.loadUserProfile(), this.authzMiddleware.authorize('inspection', 'update')] : [];
    // GET / — inspection queue (all inspections for the tenant, paginated)
    // Must be registered before /:inspectionId to avoid route collision
    this.router.get(
      '/',
      ...read,
      [
        query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
        query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be 1–100'),
        query('status').optional().isString(),
      ],
      this.listInspectionQueue.bind(this)
    );

    // List by draw — must be before /:inspectionId to avoid route collision
    this.router.get(
      '/by-draw/:drawRequestId',
      ...read,
      [
        param('drawRequestId').notEmpty().withMessage('drawRequestId is required'),
        query('constructionLoanId').notEmpty().withMessage('constructionLoanId query param is required'),
      ],
      this.listByDraw.bind(this)
    );

    this.router.post(
      '/',
      ...create,
      [
        body('drawRequestId').notEmpty().withMessage('drawRequestId is required'),
        body('constructionLoanId').notEmpty().withMessage('constructionLoanId is required'),
        body('inspectionType')
          .isIn(VALID_INSPECTION_TYPES)
          .withMessage(`inspectionType must be one of: ${VALID_INSPECTION_TYPES.join(', ')}`),
        body('inspectorId').notEmpty().withMessage('inspectorId is required'),
        body('inspectorName').notEmpty().withMessage('inspectorName is required'),
        body('scheduledDate').isISO8601().withMessage('scheduledDate must be a valid ISO date'),
      ],
      this.scheduleInspection.bind(this)
    );

    this.router.get(
      '/:inspectionId',
      ...read,
      [
        param('inspectionId').notEmpty(),
        query('constructionLoanId').notEmpty().withMessage('constructionLoanId query param is required'),
      ],
      this.getInspectionById.bind(this)
    );

    this.router.put(
      '/:inspectionId/submit',
      ...update,
      [
        param('inspectionId').notEmpty(),
        body('constructionLoanId').notEmpty().withMessage('constructionLoanId is required'),
        body('overallPercentComplete')
          .isFloat({ min: 0, max: 100 })
          .withMessage('overallPercentComplete must be 0–100'),
        body('previousOverallPercent')
          .isFloat({ min: 0, max: 100 })
          .withMessage('previousOverallPercent must be 0–100'),
        body('lineItemFindings').isArray().withMessage('lineItemFindings must be an array'),
        body('concerns').isArray().withMessage('concerns must be an array'),
        body('recommendations').isArray().withMessage('recommendations must be an array'),
        body('completedDate').isISO8601().withMessage('completedDate must be a valid ISO date'),
      ],
      this.submitReport.bind(this)
    );

    this.router.put(
      '/:inspectionId/accept',
      ...update,
      [
        param('inspectionId').notEmpty(),
        body('constructionLoanId').notEmpty().withMessage('constructionLoanId is required'),
      ],
      this.acceptInspection.bind(this)
    );

    this.router.put(
      '/:inspectionId/dispute',
      ...update,
      [
        param('inspectionId').notEmpty(),
        body('constructionLoanId').notEmpty().withMessage('constructionLoanId is required'),
        body('reason').notEmpty().withMessage('reason is required'),
      ],
      this.disputeInspection.bind(this)
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tenantId = req.user?.tenantId ?? req.body?.tenantId ?? req.query?.['tenantId'];
    if (!tenantId) {
      throw new Error('tenantId could not be resolved from request context');
    }
    return tenantId as string;
  }

  public async listInspectionQueue(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const pageSize = req.query['pageSize'] ? parseInt(req.query['pageSize'] as string, 10) : 25;
      const status = req.query['status'] as string | undefined;

      const result = await this.service.listInspectionQueue(tenantId, {
        page,
        pageSize,
        ...(status !== undefined && { status }),
      });
      res.json(result);
    } catch (err) {
      logger.error('listInspectionQueue error', { error: err });
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  public async scheduleInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const report = await this.service.scheduleInspection({
        drawRequestId: req.body.drawRequestId,
        constructionLoanId: req.body.constructionLoanId,
        tenantId,
        inspectionType: req.body.inspectionType,
        inspectorId: req.body.inspectorId,
        inspectorName: req.body.inspectorName,
        inspectorLicense: req.body.inspectorLicense,
        scheduledDate: req.body.scheduledDate,
      });
      res.status(201).json(report);
    } catch (err) {
      logger.error('scheduleInspection error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('must be in') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }

  public async getInspectionById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const inspectionId = req.params['inspectionId']!;
      const constructionLoanId = req.query['constructionLoanId'] as string;
      const report = await this.service.getInspectionById(inspectionId, constructionLoanId);
      res.json(report);
    } catch (err) {
      logger.error('getInspectionById error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      res.status(msg.includes('not found') ? 404 : 500).json({ error: msg });
    }
  }

  public async listByDraw(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const drawRequestId = req.params['drawRequestId']!;
      const constructionLoanId = req.query['constructionLoanId'] as string;
      const reports = await this.service.listInspectionsByDraw(drawRequestId, constructionLoanId);
      res.json(reports);
    } catch (err) {
      logger.error('listByDraw error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ error: msg });
    }
  }

  public async submitReport(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const inspectionId = req.params['inspectionId']!;
      const { constructionLoanId, ...reportInput } = req.body;
      const report = await this.service.submitInspectionReport(
        inspectionId,
        constructionLoanId,
        reportInput
      );
      res.json(report);
    } catch (err) {
      logger.error('submitReport error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('must be in') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }

  public async acceptInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const inspectionId = req.params['inspectionId']!;
      const { constructionLoanId } = req.body;
      const acceptedBy = this.resolveTenantId(req); // use auth user as acceptedBy
      const userId = (req.user as Record<string, unknown> | undefined)?.['id'] as string | undefined
        ?? req.body.acceptedBy
        ?? acceptedBy;
      const report = await this.service.acceptInspection(inspectionId, constructionLoanId, userId);
      res.json(report);
    } catch (err) {
      logger.error('acceptInspection error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('must be in') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }

  public async disputeInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const inspectionId = req.params['inspectionId']!;
      const { constructionLoanId, reason } = req.body;
      const report = await this.service.disputeInspection(inspectionId, constructionLoanId, reason);
      res.json(report);
    } catch (err) {
      logger.error('disputeInspection error', { error: err });
      const msg = err instanceof Error ? err.message : 'Internal server error';
      const status = msg.includes('not found') ? 404 : msg.includes('must be in') ? 409 : 500;
      res.status(status).json({ error: msg });
    }
  }
}
