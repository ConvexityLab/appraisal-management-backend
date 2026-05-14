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
import {
  UadComplianceEvaluatorService,
  type UadRuleConfig,
  type UadRuleConfigMap,
} from '../services/uad-compliance-evaluator.service.js';
import { DecisionRulePackService } from '../services/decision-rule-pack.service.js';
import {
  UAD_COMPLIANCE_CATEGORY_ID,
  buildUadComplianceConfigMap,
} from '../services/decision-engine/index.js';
import { Logger } from '../utils/logger.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('UadComplianceController');

const BASE_PACK_ID = 'BASE';

export class UadComplianceController {
  public router: Router;
  private snapshotService: CanonicalSnapshotService;
  private evaluator: UadComplianceEvaluatorService;
  private packs: DecisionRulePackService;

  constructor(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.evaluator = new UadComplianceEvaluatorService();
    this.packs = new DecisionRulePackService(dbService);

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

      const [snapshot, configMap, appliedPackIds] = await Promise.all([
        this.snapshotService.getLatestSnapshotByOrderId(orderId, tenantId),
        this.resolveBaseConfigMap(tenantId),
        Promise.resolve<string[]>([]), // placeholder for Increment 3 (CLIENT overlay)
      ]);

      // The canonical projection is built by AxiomExtractionMapper and is
      // shaped per CanonicalReportDocument. Cast at the boundary — the
      // evaluator uses optional chaining on every field so a partial
      // document (e.g., extraction done but valuation pending) just fails
      // the rules that depend on the missing sections.
      const doc = (snapshot?.normalizedData?.canonical ?? null) as CanonicalReportDocument | null;
      const report = this.evaluator.evaluate(orderId, doc, configMap.map);

      res.json({
        success: true,
        data: {
          ...report,
          // Surface which packs shaped this report so the FE can show
          // "running BASE v3 (+ CLIENT v1)" once Increment 3 lands.
          appliedPackIds: configMap.appliedPackIds.length > 0
            ? configMap.appliedPackIds
            : appliedPackIds,
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
   * Resolve the active BASE pack for this tenant into a UadRuleConfigMap.
   * Returns an empty map (no overrides) when no pack has been authored —
   * the evaluator falls back to the code-side defaults in that case.
   *
   * Increment 3 will extend this to layer a CLIENT-scoped pack on top
   * via packId convention `client:<clientId>`.
   */
  private async resolveBaseConfigMap(
    tenantId: string,
  ): Promise<{ map: UadRuleConfigMap; appliedPackIds: string[] }> {
    const basePack = await this.packs.getActive<UadRuleConfig>(
      UAD_COMPLIANCE_CATEGORY_ID,
      tenantId,
      BASE_PACK_ID,
    ).catch((err) => {
      logger.warn('UAD compliance: BASE pack lookup failed; using code defaults', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    if (!basePack || !Array.isArray(basePack.rules)) {
      return { map: {}, appliedPackIds: [] };
    }
    return {
      map: buildUadComplianceConfigMap(basePack.rules),
      appliedPackIds: [basePack.id],
    };
  }
}
