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
import { Logger } from '../utils/logger.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('UadComplianceController');

export class UadComplianceController {
  public router: Router;
  private snapshotService: CanonicalSnapshotService;
  private evaluator: UadComplianceEvaluatorService;

  constructor(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.evaluator = new UadComplianceEvaluatorService();

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

      const snapshot = await this.snapshotService.getLatestSnapshotByOrderId(orderId, tenantId);
      // The canonical projection is built by AxiomExtractionMapper and is
      // shaped per CanonicalReportDocument. Cast at the boundary — the
      // evaluator uses optional chaining on every field so a partial
      // document (e.g., extraction done but valuation pending) just fails
      // the rules that depend on the missing sections.
      const doc = (snapshot?.normalizedData?.canonical ?? null) as CanonicalReportDocument | null;
      const report = this.evaluator.evaluate(orderId, doc);

      res.json({ success: true, data: report });
    } catch (err) {
      logger.error('getReport failed', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ success: false, error: 'Failed to compute UAD compliance report' });
    }
  }
}
