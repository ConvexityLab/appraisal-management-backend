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
import type { DecisionOverrideService } from '../services/decision-engine/override/decision-override.service.js';
import type { DecisionRulePackService } from '../services/decision-rule-pack.service.js';

export class DecisionEngineOpsController {
  public readonly router: Router;

  constructor(
    private readonly killSwitches: DecisionEngineKillSwitchService,
    private readonly registry: CategoryRegistry,
    private readonly overrideService: DecisionOverrideService | null = null,
    private readonly packs: DecisionRulePackService | null = null,
  ) {
    this.router = Router({ mergeParams: true });
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/kill-switches', this.getKillSwitches.bind(this));
    this.router.patch('/kill-switches/:category', this.setKillSwitch.bind(this));
    this.router.post('/decisions/:category/:decisionId/override', this.overrideDecision.bind(this));
    this.router.get('/audit', this.getAuditFeed.bind(this));
  }

  private async getAuditFeed(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (!this.packs) {
      res.status(501).json({ success: false, error: 'Audit feed not wired on this AMS instance.' });
      return;
    }
    const limit = Number(req.query['limit'] ?? 200);
    const sinceDays = req.query['sinceDays'] !== undefined ? Number(req.query['sinceDays']) : undefined;
    const category = typeof req.query['category'] === 'string' ? (req.query['category'] as string) : undefined;
    const action = typeof req.query['action'] === 'string' ? (req.query['action'] as string) : undefined;
    try {
      const entries = await this.packs.listAuditForTenant(tenantId, {
        limit,
        ...(sinceDays !== undefined ? { sinceDays } : {}),
        ...(category ? { category } : {}),
        ...(action ? { action } : {}),
      });
      res.json({ success: true, data: entries, count: entries.length });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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

  // ── POST /decisions/:category/:decisionId/override ────────────────────────
  // Phase M.1 of DECISION_ENGINE_RULES_SURFACE.md. Operator-facing override
  // for any Decision Engine decision. Body shape:
  //   { overrideOutcome: string; reason: string; overrideData?: Record<string, unknown> }
  // Persists override fields on the trace doc, writes an audit row, and
  // publishes a `decision.overridden` event for downstream re-routing.
  private async overrideDecision(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category'];
    const decisionId = req.params['decisionId'];
    if (!category || !decisionId) {
      res.status(400).json({ success: false, error: 'category and decisionId path params are required' });
      return;
    }
    if (!this.registry.has(category)) {
      res.status(404).json({
        success: false,
        error: `Unknown decision-engine category '${category}'. Known: ${this.registry.ids().join(', ')}.`,
      });
      return;
    }
    if (!this.overrideService) {
      res.status(501).json({
        success: false,
        error: 'Decision override service is not configured on this AMS instance.',
      });
      return;
    }
    if (!this.overrideService.supportsCategory(category)) {
      res.status(501).json({
        success: false,
        error: `Override is not yet wired for category '${category}' (Phase L follow-up for axiom-criteria).`,
      });
      return;
    }

    const body = req.body as {
      overrideOutcome?: unknown;
      reason?: unknown;
      overrideData?: unknown;
    };
    if (typeof body?.overrideOutcome !== 'string' || !body.overrideOutcome.trim()) {
      res.status(400).json({ success: false, error: '`overrideOutcome` (non-empty string) is required' });
      return;
    }
    if (typeof body?.reason !== 'string' || body.reason.trim().length < 4) {
      res.status(400).json({ success: false, error: '`reason` is required and must be at least 4 characters' });
      return;
    }

    try {
      const result = await this.overrideService.override({
        category,
        tenantId,
        decisionId,
        overrideOutcome: body.overrideOutcome.trim(),
        reason: body.reason.trim(),
        overriddenBy: req.user?.id ?? 'unknown',
        ...(body.overrideData && typeof body.overrideData === 'object'
          ? { overrideData: body.overrideData as Record<string, unknown> }
          : {}),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status =
        /not found/i.test(msg) ? 404 :
        /different tenant/i.test(msg) ? 403 :
        /required|must be/i.test(msg) ? 400 :
        500;
      res.status(status).json({ success: false, error: msg });
    }
  }
}
