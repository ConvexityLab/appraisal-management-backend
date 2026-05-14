/**
 * UAD Compliance Controller
 *
 * Returns the UAD-3.6 compliance report for an order — runs the rule set
 * over the latest canonical extraction snapshot and emits a 0-100 score,
 * pass/fail count, and the list of CRITICAL blockers.
 *
 *   GET /api/orders/:orderId/uad-compliance
 *
 * Returns 200 with an empty report when no snapshot exists yet, so the UI
 * can show "extraction pending" rather than treating it as an error.
 *
 * Auth: order:read.
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { CanonicalSnapshotService } from '../services/canonical-snapshot.service.js';
import { UadComplianceEvaluatorService } from '../services/uad-compliance-evaluator.service.js';
import { DecisionRulePackService } from '../services/decision-rule-pack.service.js';
import { UadCompliancePackResolver } from '../services/decision-engine/categories/uad-compliance-resolver.service.js';
import { Logger } from '../utils/logger.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('UadComplianceController');

export class UadComplianceController {
  public router: Router;
  private snapshotService: CanonicalSnapshotService;
  private evaluator: UadComplianceEvaluatorService;
  private packResolver: UadCompliancePackResolver;

  constructor(private readonly dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.evaluator = new UadComplianceEvaluatorService();
    this.packResolver = new UadCompliancePackResolver(new DecisionRulePackService(dbService));

    const lp = authzMiddleware ? [authzMiddleware.loadUserProfile()] : [];
    const readAuth = authzMiddleware ? [...lp, authzMiddleware.authorize('order', 'read')] : [];

    this.router.get('/:orderId/uad-compliance', ...readAuth, this.getReport.bind(this));
  }

  private async getReport(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const orderId = req.params['orderId'];
    try {
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Authenticated tenant context is required' });
        return;
      }

      // Load order first so we have clientId for the CLIENT-pack overlay.
      // The order load is non-fatal: if it fails we still resolve BASE-only.
      const clientId = await this.loadOrderClientId(orderId).catch((err) => {
        logger.warn('UAD compliance: order load failed; resolving BASE-only', {
          orderId,
          error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
      });

      const [snapshot, resolution] = await Promise.all([
        this.snapshotService.getLatestSnapshotByOrderId(orderId, tenantId),
        this.packResolver.resolve({
          tenantId,
          ...(clientId ? { clientId } : {}),
        }),
      ]);

      // The canonical projection is built by AxiomExtractionMapper and is
      // shaped per CanonicalReportDocument. Cast at the boundary — the
      // evaluator uses optional chaining on every field so a partial
      // document (e.g., extraction done but valuation pending) just fails
      // the rules that depend on the missing sections.
      const doc = (snapshot?.normalizedData?.canonical ?? null) as CanonicalReportDocument | null;
      const report = this.evaluator.evaluate(orderId, doc, resolution.configMap);

      res.json({
        success: true,
        data: {
          ...report,
          // BASE first, then CLIENT — FE can render "BASE v3 + CLIENT acme v1".
          // Empty array means "running code defaults" (no packs authored yet).
          appliedPackIds: resolution.appliedPackIds,
        },
      });
    } catch (err) {
      logger.error('getReport failed', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ success: false, error: 'Failed to compute UAD compliance report' });
    }
  }

  /**
   * Pull the order's clientId for the CLIENT-pack overlay. Returns
   * undefined when the order has no clientId set — the resolver then
   * skips the CLIENT lookup entirely.
   */
  private async loadOrderClientId(orderId: string): Promise<string | undefined> {
    const result = await this.dbService.findOrderById(orderId);
    if (!result.success || !result.data) return undefined;
    const c = (result.data as { clientId?: string }).clientId;
    return typeof c === 'string' && c.trim().length > 0 ? c : undefined;
  }
}
