/**
 * Construction Finance Module — Servicing Controller (Phase 4c)
 *
 * Mounted at: /api/construction/servicing
 *
 * Routes:
 *   GET  /:loanId/status              — interest reserve + maturity risk status
 *   GET  /:loanId/monthly-interest    — estimated monthly interest draw amount
 *   GET  /:loanId/reports             — all status reports for the loan (newest first)
 *   POST /:loanId/reports             — generate an on-demand status report
 *   GET  /:loanId/reports/:reportId   — retrieve a single status report
 *   GET  /:loanId/conversion-readiness— conversion readiness checklist (GROUND_UP only)
 *   GET  /:loanId/cpp                 — current CPP status
 *   POST /:loanId/cpp                 — create CPP workout plan
 *   PUT  /:loanId/cpp/resolve         — resolve an active CPP workout
 *
 * All tenantId values come from the authenticated request (req.tenantId).
 */

import { Router, Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionServicingAiService } from '../services/ai/construction-servicing-ai.service.js';
import { ConstructionReportGeneratorService } from '../services/ai/construction-report-generator.service.js';
import { ConstructionCppService } from '../services/ai/construction-cpp.service.js';
import type { ConstructionStatusReport } from '../types/construction-status-report.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ConstructionServicingController');

export class ConstructionServicingController {
  readonly router: Router;
  private readonly servicingService: ConstructionServicingAiService;
  private readonly reportGeneratorService: ConstructionReportGeneratorService;
  private readonly cppService: ConstructionCppService;
  private readonly dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService              = dbService;
    this.servicingService      = new ConstructionServicingAiService(dbService);
    this.reportGeneratorService = new ConstructionReportGeneratorService(dbService);
    this.cppService             = new ConstructionCppService(dbService);
    this.router                 = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // ── CPP sub-routes must be registered before /:loanId/reports/:reportId
    //    to avoid Express treating 'cpp' as a reportId segment
    this.router.get('/:loanId/cpp',          this.getCppStatus.bind(this));
    this.router.post('/:loanId/cpp',         this.createCppWorkoutPlan.bind(this));
    this.router.put('/:loanId/cpp/resolve',  this.resolveCpp.bind(this));

    // ── Interest reserve & maturity
    this.router.get('/:loanId/status',           this.getServicingStatus.bind(this));
    this.router.get('/:loanId/monthly-interest', this.getMonthlyInterest.bind(this));

    // ── Conversion readiness (GROUND_UP only)
    this.router.get('/:loanId/conversion-readiness', this.getConversionReadiness.bind(this));

    // ── Status reports — note: per-report route must come AFTER the list route
    this.router.get('/:loanId/reports',              this.listReports.bind(this));
    this.router.post('/:loanId/reports',             this.generateReport.bind(this));
    this.router.get('/:loanId/reports/:reportId',    this.getReport.bind(this));
  }

  // ── GET /:loanId/status ───────────────────────────────────────────────────────

  private async getServicingStatus(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const [reserveStatus, maturityAtRisk] = await Promise.all([
        this.servicingService.computeInterestReserveStatus(loanId!, tenantId),
        this.servicingService.checkMaturityRisk(loanId!, tenantId),
      ]);
      res.status(200).json({ reserveStatus, maturityAtRisk });
    } catch (err) {
      logger.error('getServicingStatus error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('aiServicingEnabled')) {
        res.status(409).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to compute servicing status' });
      }
    }
  }

  // ── GET /:loanId/monthly-interest ─────────────────────────────────────────────

  private async getMonthlyInterest(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const amount = await this.servicingService.autoComputeMonthlyInterestDraw(loanId!, tenantId);
      res.status(200).json({ loanId, monthlyInterestDraw: amount });
    } catch (err) {
      logger.error('getMonthlyInterest error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to compute monthly interest draw amount' });
      }
    }
  }

  // ── GET /:loanId/conversion-readiness ─────────────────────────────────────────

  private async getConversionReadiness(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const checklist = await this.servicingService.generateConversionReadinessChecklist(
        loanId!,
        tenantId
      );
      res.status(200).json(checklist);
    } catch (err) {
      logger.error('getConversionReadiness error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('GROUND_UP')) {
        res.status(400).json({ error: message });
      } else if (message.includes('aiServicingEnabled')) {
        res.status(409).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to compute conversion readiness checklist' });
      }
    }
  }

  // ── GET /:loanId/reports ──────────────────────────────────────────────────────

  private async listReports(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const reports = await this.reportGeneratorService.getReports(loanId!, tenantId);
      res.status(200).json(reports);
    } catch (err) {
      logger.error('listReports error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve status reports' });
    }
  }

  // ── POST /:loanId/reports ─────────────────────────────────────────────────────

  private async generateReport(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;
    const { reportType = 'ON_DEMAND' } = req.body as {
      reportType?: ConstructionStatusReport['reportType'];
    };

    const validTypes: ConstructionStatusReport['reportType'][] = [
      'SCHEDULED', 'ON_DEMAND', 'CPP', 'MATURITY_ALERT',
    ];
    if (!validTypes.includes(reportType)) {
      res.status(400).json({
        error: `reportType must be one of: ${validTypes.join(', ')}. Received: "${reportType}"`,
      });
      return;
    }

    try {
      const report = await this.reportGeneratorService.generateStatusReport(
        loanId!,
        reportType,
        tenantId
      );
      res.status(201).json(report);
    } catch (err) {
      logger.error('generateReport error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('aiServicingEnabled')) {
        res.status(409).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to generate status report' });
      }
    }
  }

  // ── GET /:loanId/reports/:reportId ────────────────────────────────────────────

  private async getReport(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId, reportId } = req.params;

    try {
      const report = await this.dbService.getDocument<ConstructionStatusReport>(
        'construction-loans',
        reportId!,
        tenantId
      );

      if (!report) {
        res.status(404).json({
          error: `Status report "${reportId}" not found for loan "${loanId}" (tenant: ${tenantId})`,
        });
        return;
      }

      // Verify the report belongs to the requested loan
      if (report.constructionLoanId !== loanId) {
        res.status(404).json({
          error: `Status report "${reportId}" does not belong to loan "${loanId}"`,
        });
        return;
      }

      res.status(200).json(report);
    } catch (err) {
      logger.error('getReport error', { error: err });
      res.status(500).json({ error: 'Failed to retrieve status report' });
    }
  }

  // ── GET /:loanId/cpp ──────────────────────────────────────────────────────────

  private async getCppStatus(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const cpp = await this.cppService.getCppStatus(loanId!, tenantId);
      if (!cpp) {
        res.status(404).json({ error: `No CPP record found for loan "${loanId}"` });
        return;
      }
      res.status(200).json(cpp);
    } catch (err) {
      logger.error('getCppStatus error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to retrieve CPP status' });
      }
    }
  }

  // ── POST /:loanId/cpp ─────────────────────────────────────────────────────────

  private async createCppWorkoutPlan(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;

    try {
      const cppRecord = await this.cppService.createCppWorkoutPlan(loanId!, tenantId);
      res.status(201).json(cppRecord);
    } catch (err) {
      logger.error('createCppWorkoutPlan error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to create CPP workout plan' });
      }
    }
  }

  // ── PUT /:loanId/cpp/resolve ──────────────────────────────────────────────────

  private async resolveCpp(req: Request, res: Response): Promise<void> {
    const tenantId = this.extractTenantId(req, res);
    if (!tenantId) return;

    const { loanId } = req.params;
    const { resolution, resolvedBy, resolutionNotes } = req.body as {
      resolution?: string;
      resolvedBy?: string;
      resolutionNotes?: string;
    };

    const validResolutions = ['CURED', 'MODIFIED', 'FORECLOSURE_INITIATED', 'SOLD', 'OTHER'];

    if (!resolution || !validResolutions.includes(resolution)) {
      res.status(400).json({
        error: `resolution is required and must be one of: ${validResolutions.join(', ')}. ` +
               `Received: "${resolution ?? ''}"`,
      });
      return;
    }
    if (!resolvedBy || resolvedBy.trim().length === 0) {
      res.status(400).json({ error: 'resolvedBy is required' });
      return;
    }

    try {
      const cppRecord = await this.cppService.resolveCpp(
        loanId!,
        resolution as 'CURED' | 'MODIFIED' | 'FORECLOSURE_INITIATED' | 'SOLD' | 'OTHER',
        resolvedBy,
        tenantId,
        resolutionNotes
      );
      res.status(200).json(cppRecord);
    } catch (err) {
      logger.error('resolveCpp error', { error: err });
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('already resolved') || message.includes('No CPP')) {
        res.status(409).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to resolve CPP workout' });
      }
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  private extractTenantId(req: Request, res: Response): string | null {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: tenantId not found on request' });
      return null;
    }
    return tenantId;
  }
}
