/**
 * Construction Finance Module — Feasibility Controller (Phase 4a)
 *
 * Mounted at: /api/construction/feasibility
 *
 * Routes:
 *   POST  /:loanId           — run or re-run feasibility analysis for a loan
 *   GET   /:loanId           — retrieve the stored feasibility report
 *   PUT   /:loanId/override  — apply human override verdict
 *   GET   /rules             — list tenant's custom feasibility rules
 *   PUT   /rules             — update tenant's custom feasibility rules (admin)
 *
 * All tenantId values come from the authenticated request (req.tenantId).
 */

import { Router, Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionFeasibilityService } from '../services/ai/construction-feasibility.service.js';
import { ConstructionConfigService } from '../services/construction-config.service.js';
import { Logger } from '../utils/logger.js';
import type { FeasibilityRule } from '../types/construction-config.types.js';

const logger = new Logger('ConstructionFeasibilityController');

export class ConstructionFeasibilityController {
  readonly router: Router;
  private readonly feasibilityService: ConstructionFeasibilityService;
  private readonly configService: ConstructionConfigService;

  constructor(dbService: CosmosDbService) {
    this.feasibilityService = new ConstructionFeasibilityService(dbService);
    this.configService = new ConstructionConfigService(dbService);
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // ── Rules endpoints must be registered BEFORE /:loanId to avoid route collision
    this.router.get('/rules',  this.listFeasibilityRules.bind(this));
    this.router.put('/rules',  this.updateFeasibilityRules.bind(this));

    // ── Per-loan feasibility endpoints
    this.router.post('/:loanId',           this.runFeasibilityAnalysis.bind(this));
    this.router.get('/:loanId',            this.getFeasibilityReport.bind(this));
    this.router.put('/:loanId/override',   this.overrideFeasibilityVerdict.bind(this));
  }

  // ── POST /:loanId ─────────────────────────────────────────────────────────────

  /**
   * Run or re-run the feasibility analysis for a loan.
   *
   * Body: { budgetId: string }
   */
  private async runFeasibilityAnalysis(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return;
    }

    const { loanId } = req.params;
    const { budgetId } = req.body as { budgetId?: string };

    if (!budgetId) {
      res.status(400).json({ error: 'budgetId is required in the request body' });
      return;
    }

    try {
      const report = await this.feasibilityService.runFeasibilityAnalysis(
        loanId!,
        budgetId,
        tenantId
      );
      res.status(200).json(report);
    } catch (err) {
      logger.error('runFeasibilityAnalysis error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to run feasibility analysis' });
      }
    }
  }

  // ── GET /:loanId ──────────────────────────────────────────────────────────────

  /**
   * Retrieve the stored feasibility report for a loan.
   */
  private async getFeasibilityReport(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return;
    }

    const { loanId } = req.params;

    try {
      const report = await this.feasibilityService.getFeasibilityReport(loanId!, tenantId);
      res.status(200).json(report);
    } catch (err) {
      logger.error('getFeasibilityReport error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('no feasibility report found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to retrieve feasibility report' });
      }
    }
  }

  // ── PUT /:loanId/override ─────────────────────────────────────────────────────

  /**
   * Apply a human override verdict on the feasibility report.
   *
   * Body: { verdict: 'PASS' | 'WARN' | 'FAIL', notes: string, reviewerId: string }
   */
  private async overrideFeasibilityVerdict(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return;
    }

    const { loanId } = req.params;
    const { verdict, notes, reviewerId } = req.body as {
      verdict?: 'PASS' | 'WARN' | 'FAIL';
      notes?: string;
      reviewerId?: string;
    };

    if (!verdict || !['PASS', 'WARN', 'FAIL'].includes(verdict)) {
      res.status(400).json({ error: 'verdict must be one of: PASS, WARN, FAIL' });
      return;
    }
    if (!notes || notes.trim().length === 0) {
      res.status(400).json({ error: 'notes are required when overriding a feasibility verdict' });
      return;
    }
    if (!reviewerId) {
      res.status(400).json({ error: 'reviewerId is required' });
      return;
    }

    try {
      const updated = await this.feasibilityService.overrideFeasibilityVerdict(
        `feasibility-${loanId}`,
        verdict,
        notes,
        reviewerId,
        tenantId
      );
      res.status(200).json(updated);
    } catch (err) {
      logger.error('overrideFeasibilityVerdict error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('required')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to override feasibility verdict' });
      }
    }
  }

  // ── GET /rules ───────────────────────────────────────────────────────────────

  /**
   * Return the tenant's current custom feasibility rules from TenantConstructionConfig.
   */
  private async listFeasibilityRules(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return;
    }

    try {
      const config = await this.configService.getConfig(tenantId);
      res.status(200).json(config.feasibilityCustomRules);
    } catch (err) {
      logger.error('listFeasibilityRules error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found') || message.includes('No construction configuration')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to retrieve feasibility rules' });
      }
    }
  }

  // ── PUT /rules ───────────────────────────────────────────────────────────────

  /**
   * Replace the tenant's custom feasibility rules in TenantConstructionConfig.
   *
   * Body: { rules: FeasibilityRule[], updatedBy: string }
   * Admin-only endpoint — caller should enforce role check at the API gateway level.
   */
  private async updateFeasibilityRules(req: Request, res: Response): Promise<void> {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return;
    }

    const { rules, updatedBy } = req.body as {
      rules?: unknown;
      updatedBy?: string;
    };

    if (!Array.isArray(rules)) {
      res.status(400).json({ error: 'rules must be an array of FeasibilityRule objects' });
      return;
    }
    if (!updatedBy) {
      res.status(400).json({ error: 'updatedBy is required' });
      return;
    }

    try {
      const updated = await this.configService.updateConfig(
        tenantId,
        { feasibilityCustomRules: rules as FeasibilityRule[] },
        updatedBy
      );
      res.status(200).json(updated.feasibilityCustomRules);
    } catch (err) {
      logger.error('updateFeasibilityRules error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found') || message.includes('No construction configuration')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to update feasibility rules' });
      }
    }
  }
}
