/**
 * Construction Finance Module — Construction Risk Controller
 *
 * Routes (all protected by unifiedAuth):
 *   POST  /:loanId/compute          → computeRiskFlags     (re-evaluates all data-driven flags)
 *   GET   /:loanId/flags            → getRiskFlags         (returns stored active flags)
 *   PATCH /:loanId/flags/:flagCode  → resolveFlag          (marks a specific flag as resolved)
 *
 * Param :loanId scoped to req.tenantId via service layer.
 */

import { Router, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionRiskService } from '../services/construction-risk.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('ConstructionRiskController');

export class ConstructionRiskController {
  public router: Router;
  private readonly riskService: ConstructionRiskService;

  constructor(private readonly dbService: CosmosDbService) {
    this.riskService = new ConstructionRiskService(dbService);
    this.router = Router({ mergeParams: true });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // POST /:loanId/compute
    this.router.post(
      '/:loanId/compute',
      [param('loanId').notEmpty().withMessage('loanId is required')],
      this.computeRiskFlags.bind(this)
    );

    // GET /:loanId/flags
    this.router.get(
      '/:loanId/flags',
      [param('loanId').notEmpty().withMessage('loanId is required')],
      this.getRiskFlags.bind(this)
    );

    // PATCH /:loanId/flags/:flagCode/resolve
    this.router.patch(
      '/:loanId/flags/:flagCode/resolve',
      [
        param('loanId').notEmpty().withMessage('loanId is required'),
        param('flagCode').notEmpty().withMessage('flagCode is required'),
        body('resolvedBy').notEmpty().withMessage('resolvedBy is required'),
        body('notes').optional().isString(),
      ],
      this.resolveFlag.bind(this)
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  private async computeRiskFlags(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { loanId } = req.params as { loanId: string };
      const flags = await this.riskService.computeRiskFlags(loanId, req.tenantId!);
      res.status(200).json({ loanId, flags, computedAt: new Date().toISOString() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
      } else {
        logger.error('computeRiskFlags error', { error: err });
        res.status(500).json({ error: 'Failed to compute risk flags' });
      }
    }
  }

  private async getRiskFlags(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { loanId } = req.params as { loanId: string };
      const flags = await this.riskService.getRiskFlags(loanId, req.tenantId!);
      res.json({ loanId, flags });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
      } else {
        logger.error('getRiskFlags error', { error: err });
        res.status(500).json({ error: 'Failed to retrieve risk flags' });
      }
    }
  }

  private async resolveFlag(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { loanId, flagCode } = req.params as { loanId: string; flagCode: string };
      const { resolvedBy, notes = '' } = req.body as { resolvedBy: string; notes?: string };

      await this.riskService.resolveFlag(
        loanId,
        // Cast — the service throws if the code is invalid so no need to validate enum here
        flagCode as Parameters<ConstructionRiskService['resolveFlag']>[1],
        resolvedBy,
        notes,
        req.tenantId!
      );

      res.status(200).json({ loanId, flagCode, resolvedAt: new Date().toISOString() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('no active flag')) {
        res.status(404).json({ error: msg });
      } else if (msg.includes('required')) {
        res.status(400).json({ error: msg });
      } else {
        logger.error('resolveFlag error', { error: err });
        res.status(500).json({ error: 'Failed to resolve risk flag' });
      }
    }
  }
}
