/**
 * UAD Compliance Catalogue Controller
 *
 * Exposes the built-in UAD-3.6 rule catalogue so the admin workspace
 * editor can render the per-rule config rows without a hand-maintained
 * FE mirror.
 *
 *   GET /api/uad-compliance/catalogue
 *
 * Returns the static metadata array — one entry per built-in rule
 * (id, label, defaultSeverity, fieldPath?). Doesn't read tenant state;
 * doesn't write anything. Authentication is required (the rule list is
 * not sensitive but it's not public either).
 *
 * Why a tiny standalone controller and not folded into
 * UadComplianceController: that one is mounted under /api/orders and
 * lives in the per-order context; the catalogue is order-independent
 * and benefits from its own clean mount point.
 */

import { Router, Response } from 'express';
import { UAD_COMPLIANCE_RULE_METADATA } from '../services/uad-compliance-evaluator.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('UadComplianceCatalogueController');

export class UadComplianceCatalogueController {
  public router: Router;

  constructor(authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    // No resource-level authz: returning a static rule list to any
    // authenticated principal. loadUserProfile so downstream logging
    // still has the actor identity if needed.
    const lp = authzMiddleware ? [authzMiddleware.loadUserProfile()] : [];

    this.router.get('/catalogue', ...lp, this.getCatalogue.bind(this));
  }

  private async getCatalogue(_req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          rules: UAD_COMPLIANCE_RULE_METADATA,
          // version pinned to the BE module — bump it when the rule set
          // changes so the FE cache knows to refetch.
          version: '1.0',
        },
      });
    } catch (err) {
      logger.error('getCatalogue failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ success: false, error: 'Failed to load UAD compliance catalogue' });
    }
  }
}
