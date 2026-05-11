/**
 * DecisionEngineOpsController — cross-category operational endpoints for the
 * Decision Engine surface.
 *
 * Phase I (kill-switch BE wiring) of
 * docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Mounted at /api/decision-engine/ops. Distinct from the rules CRUD
 * controller (mounted at /api/decision-engine/rules/:category) because ops
 * concerns are tenant-scoped and cross-category — they don't fit the
 * `:category` URL pattern.
 *
 * Endpoints:
 *   GET   /kill-switches              — all kill-switch flags for the tenant
 *                                        (Record<categoryId, boolean>)
 *   PATCH /kill-switches/:category    — toggle one flag; body {enabled: boolean}
 */

import { Router, type Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { DecisionEngineKillSwitchService } from '../services/decision-engine/kill-switch/kill-switch.service.js';
import type { CategoryRegistry } from '../services/decision-engine/category-definition.js';

export class DecisionEngineOpsController {
  public readonly router: Router;

  constructor(
    private readonly killSwitches: DecisionEngineKillSwitchService,
    private readonly registry: CategoryRegistry,
  ) {
    this.router = Router({ mergeParams: true });
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/kill-switches', this.getKillSwitches.bind(this));
    this.router.patch('/kill-switches/:category', this.setKillSwitch.bind(this));
  }

  private requireTenant(req: UnifiedAuthRequest, res: Response): string | null {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return null;
    }
    return tenantId;
  }

  // ── GET /kill-switches ───────────────────────────────────────────────────
  private async getKillSwitches(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    try {
      const flags = await this.killSwitches.getFlags(tenantId);
      res.json({ success: true, data: { tenantId, flags } });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── PATCH /kill-switches/:category ───────────────────────────────────────
  private async setKillSwitch(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category'];
    if (!category) {
      res.status(400).json({ success: false, error: 'category path param is required' });
      return;
    }
    if (!this.registry.has(category)) {
      res.status(404).json({
        success: false,
        error: `Unknown decision-engine category '${category}'. Known: ${this.registry.ids().join(', ')}.`,
      });
      return;
    }

    const body = req.body as { enabled?: unknown };
    if (typeof body?.enabled !== 'boolean') {
      res.status(400).json({ success: false, error: '`enabled` (boolean) is required' });
      return;
    }

    try {
      const flags = await this.killSwitches.setFlag(
        tenantId,
        category,
        body.enabled,
        req.user?.id ?? 'unknown',
      );
      res.json({ success: true, data: { tenantId, flags } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(/required/i.test(msg) ? 400 : 500).json({ success: false, error: msg });
    }
  }
}
