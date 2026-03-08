/**
 * Construction Finance Module — Construction Portfolio Controller
 *
 * Routes (all protected by unifiedAuth):
 *   GET    /dashboard         → getPortfolioDashboard
 *   GET    /draw-velocity     → getDrawVelocity       (?windowMonths=)
 *   GET    /geography         → getPortfolioByGeography
 *   GET    /maturing-loans    → getLoansNearingMaturity
 *   GET    /pending-draws     → getLoansWithPendingDraws
 *   GET    /risk-summary      → computePortfolioRiskSummary
 *
 * All collection operations are scoped to req.tenantId (from unifiedAuth).
 */

import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionPortfolioService } from '../services/construction-portfolio.service.js';
import { ConstructionRiskService } from '../services/construction-risk.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('ConstructionPortfolioController');

export class ConstructionPortfolioController {
  public router: Router;
  private readonly portfolioService: ConstructionPortfolioService;
  private readonly riskService: ConstructionRiskService;

  constructor(private readonly dbService: CosmosDbService) {
    this.portfolioService = new ConstructionPortfolioService(dbService);
    this.riskService = new ConstructionRiskService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/dashboard', this.getPortfolioDashboard.bind(this));

    this.router.get(
      '/draw-velocity',
      [
        query('windowMonths')
          .optional()
          .isInt({ min: 1, max: 60 })
          .withMessage('windowMonths must be 1–60'),
      ],
      this.getDrawVelocity.bind(this)
    );

    this.router.get('/geography', this.getPortfolioByGeography.bind(this));
    this.router.get('/maturing-loans', this.getLoansNearingMaturity.bind(this));
    this.router.get('/pending-draws', this.getLoansWithPendingDraws.bind(this));
    this.router.get('/risk-summary', this.getPortfolioRiskSummary.bind(this));
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  private async getPortfolioDashboard(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const dashboard = await this.portfolioService.getPortfolioDashboard(req.tenantId!);
      res.json(dashboard);
    } catch (err) {
      logger.error('getPortfolioDashboard error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve portfolio dashboard' });
    }
  }

  private async getDrawVelocity(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const windowMonths = req.query.windowMonths
        ? parseInt(req.query.windowMonths as string, 10)
        : 12;

      const velocity = await this.portfolioService.getDrawVelocity(req.tenantId!, windowMonths);
      res.json(velocity);
    } catch (err) {
      logger.error('getDrawVelocity error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve draw velocity' });
    }
  }

  private async getPortfolioByGeography(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const geography = await this.portfolioService.getPortfolioByGeography(req.tenantId!);
      res.json(geography);
    } catch (err) {
      logger.error('getPortfolioByGeography error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve portfolio geography' });
    }
  }

  private async getLoansNearingMaturity(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const loans = await this.portfolioService.getLoansNearingMaturity(req.tenantId!);
      res.json(loans);
    } catch (err) {
      logger.error('getLoansNearingMaturity error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve loans nearing maturity' });
    }
  }

  private async getLoansWithPendingDraws(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const loans = await this.portfolioService.getLoansWithPendingDraws(req.tenantId!);
      res.json(loans);
    } catch (err) {
      logger.error('getLoansWithPendingDraws error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve loans with pending draws' });
    }
  }

  private async getPortfolioRiskSummary(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const summary = await this.riskService.computePortfolioRiskSummary(req.tenantId!);
      res.json(summary);
    } catch (err) {
      logger.error('getPortfolioRiskSummary error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve portfolio risk summary' });
    }
  }
}
