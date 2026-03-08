/**
 * Construction Finance Module — Tenant Configuration Controller
 *
 * Routes (all protected by unifiedAuth):
 *   GET    /          → getConfig     (reads config for the authenticated tenant)
 *   POST   /          → createConfig  (tenant onboarding — initialises config with defaults)
 *   PATCH  /          → updateConfig  (partial update to tenant construction config)
 *
 * All routes are tenant-scoped: the tenantId comes from the auth token, never from the URL.
 */

import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionConfigService } from '../services/construction-config.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('ConstructionConfigController');

export class ConstructionConfigController {
  public router: Router;
  private readonly configService: ConstructionConfigService;

  constructor(private readonly dbService: CosmosDbService) {
    this.configService = new ConstructionConfigService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.getConfig.bind(this));

    this.router.post(
      '/',
      [
        // No required body fields — createConfig uses defaults for everything.
        // Optional override validation:
        body('defaultRetainagePercent')
          .optional()
          .isFloat({ min: 0, max: 100 })
          .withMessage('defaultRetainagePercent must be 0–100'),
        body('feasibilityMinScore')
          .optional()
          .isFloat({ min: 0, max: 100 })
          .withMessage('feasibilityMinScore must be 0–100'),
        body('overBudgetThresholdPct')
          .optional()
          .isFloat({ min: 0 })
          .withMessage('overBudgetThresholdPct must be ≥ 0'),
        body('lowArvCoverageThreshold')
          .optional()
          .isFloat({ min: 0, max: 1 })
          .withMessage('lowArvCoverageThreshold must be between 0 and 1'),
      ],
      this.createConfig.bind(this)
    );

    this.router.patch(
      '/',
      [
        body('defaultRetainagePercent')
          .optional()
          .isFloat({ min: 0, max: 100 })
          .withMessage('defaultRetainagePercent must be 0–100'),
        body('feasibilityMinScore')
          .optional()
          .isFloat({ min: 0, max: 100 })
          .withMessage('feasibilityMinScore must be 0–100'),
        body('overBudgetThresholdPct')
          .optional()
          .isFloat({ min: 0 })
          .withMessage('overBudgetThresholdPct must be ≥ 0'),
        body('lowArvCoverageThreshold')
          .optional()
          .isFloat({ min: 0, max: 1 })
          .withMessage('lowArvCoverageThreshold must be between 0 and 1'),
      ],
      this.updateConfig.bind(this)
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  public async getConfig(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const config = await this.configService.getConfig(tenantId);
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: `No construction finance configuration found for this tenant. Use POST /construction-config to initialise.`,
        });
        return;
      }
      logger.error('getConfig failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async createConfig(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const overrides = Object.keys(req.body).length > 0 ? req.body : undefined;

      const config = await this.configService.createConfig(tenantId, createdBy, overrides);
      res.status(201).json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        res.status(409).json({
          error: 'CONFIG_ALREADY_EXISTS',
          message: msg,
        });
        return;
      }
      logger.error('createConfig failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateConfig(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ error: 'No fields to update provided' });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const updatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const config = await this.configService.updateConfig(tenantId, req.body, updatedBy);
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({
          error: 'CONFIG_NOT_FOUND',
          message: msg,
        });
        return;
      }
      logger.error('updateConfig failed', { error });
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
