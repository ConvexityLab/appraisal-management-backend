/**
 * Scorecard Rollup Profile Controller
 *
 * REST endpoints for managing per-tenant scorecard-rollup profiles (David's
 * algorithm — how individual per-order scorecards aggregate into a vendor's
 * blended overallScore).
 *
 *   GET  /api/scorecard-rollup-profiles
 *   GET  /api/scorecard-rollup-profiles/:profileId
 *   POST /api/scorecard-rollup-profiles
 *   POST /api/scorecard-rollup-profiles/resolve   ← preview helper
 *
 * Update is CRUD-N: POST creates a new version, prior is deactivated.
 * No DELETE — legacy versions stay queryable for replay.
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import {
  ScorecardRollupProfileService,
  RollupProfileError,
} from '../services/scorecard-rollup-profile.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('ScorecardRollupProfileController');

export class ScorecardRollupProfileController {
  public router: Router;
  private service: ScorecardRollupProfileService;

  constructor(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.service = new ScorecardRollupProfileService(
      dbService,
      new AuditTrailService(dbService),
    );

    const lp = authzMiddleware ? [authzMiddleware.loadUserProfile()] : [];
    // Rollup profile editing is admin-equivalent — gate writes on vendor:update.
    // Reads use vendor:read since the calculator + matcher both consume these.
    const readAuth = authzMiddleware ? [...lp, authzMiddleware.authorize('vendor', 'read')] : [];
    const writeAuth = authzMiddleware ? [...lp, authzMiddleware.authorize('vendor', 'update')] : [];

    this.router.get('/', ...readAuth, this.list.bind(this));
    this.router.post('/resolve', ...readAuth, this.resolve.bind(this));
    this.router.get('/:profileId', ...readAuth, this.get.bind(this));
    this.router.post('/', ...writeAuth, this.create.bind(this));
  }

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const t = req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);
    if (!t) throw new RollupProfileError(400, 'tenantId is required (x-tenant-id header).');
    return t;
  }

  private async list(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeOnly = req.query['activeOnly'] === 'true' || req.query['activeOnly'] === '1';
      const profiles = await this.service.listProfiles(tenantId, { activeOnly });
      res.json({ success: true, data: profiles });
    } catch (err) {
      this.handleError(err, res, 'list');
    }
  }

  private async get(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const profileId = req.params['profileId']!;
      const profile = await this.service.getProfile(tenantId, profileId);
      if (!profile) {
        res.status(404).json({ success: false, error: 'Profile not found' });
        return;
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      this.handleError(err, res, 'get');
    }
  }

  private async create(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const userId = req.user?.id ?? 'unknown';
      const profile = await this.service.createProfile(tenantId, req.body, userId);
      res.status(201).json({ success: true, data: profile });
    } catch (err) {
      this.handleError(err, res, 'create');
    }
  }

  private async resolve(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const body = (req.body ?? {}) as {
        clientId?: string;
        productType?: string;
        phase?: 'ORIGINAL' | 'REVIEW';
      };
      const result = await this.service.resolveProfile({
        tenantId,
        ...(body.clientId ? { clientId: body.clientId } : {}),
        ...(body.productType ? { productType: body.productType } : {}),
        ...(body.phase ? { phase: body.phase } : {}),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      this.handleError(err, res, 'resolve');
    }
  }

  private handleError(err: unknown, res: Response, action: string): void {
    if (err instanceof RollupProfileError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
      return;
    }
    logger.error(`${action} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ success: false, error: `${action} failed` });
  }
}
