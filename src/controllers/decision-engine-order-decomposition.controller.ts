/**
 * DecisionEngineOrderDecompositionController — CRUD over the existing
 * `decomposition-rules` Cosmos container, exposed under the Decision Engine
 * surface.
 *
 * Phase N3 of docs/DECISION_ENGINE_RULES_SURFACE.md. The Decision Engine's
 * generic CRUD endpoints don't fit decomposition rules (they're singletons
 * per (tenantId, clientId?, productType) — not immutable versioned packs).
 * This controller proxies through `OrderDecompositionService` so the
 * workspace can author rules without bypassing the existing service.
 *
 * Endpoints (mounted at /api/decision-engine/order-decomposition):
 *   GET    /rules                         — list every rule for the tenant
 *   GET    /rules/:ruleId                 — fetch one
 *   PUT    /rules/:ruleId                 — upsert
 *   DELETE /rules/:ruleId                 — drop
 *   POST   /preview                       — run findRule + compose against
 *                                            operator-supplied context
 *
 * Audit rows land in `decision-rule-audit` for consistency with the other
 * categories' audit-hub feed.
 */

import { Router, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { OrderDecompositionService } from '../services/order-decomposition.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { DecompositionRule, DecompositionContext } from '../types/decomposition-rule.types.js';
import type { DecisionEngineKillSwitchService } from '../services/decision-engine/kill-switch/kill-switch.service.js';

const CATEGORY_ID = 'order-decomposition';

export class DecisionEngineOrderDecompositionController {
  public readonly router: Router;

  constructor(
    private readonly decomposition: OrderDecompositionService,
    private readonly db: CosmosDbService,
    private readonly killSwitches: DecisionEngineKillSwitchService | null = null,
  ) {
    this.router = Router({ mergeParams: true });
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/rules',           this.listRules.bind(this));
    this.router.get('/rules/:ruleId',   this.getRule.bind(this));
    this.router.put('/rules/:ruleId',   this.upsertRule.bind(this));
    this.router.delete('/rules/:ruleId', this.deleteRule.bind(this));
    this.router.post('/preview',        this.preview.bind(this));
  }

  private requireTenant(req: UnifiedAuthRequest, res: Response): string | null {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return null;
    }
    return tenantId;
  }

  private async refuseIfKilled(tenantId: string, res: Response): Promise<boolean> {
    if (!this.killSwitches) return false;
    const killed = await this.killSwitches.isKilled(tenantId, CATEGORY_ID);
    if (!killed) return false;
    res.status(503).json({
      success: false,
      error: `Decision Engine kill switch is ON for tenant=${tenantId} category=${CATEGORY_ID}.`,
      kind: 'kill-switch-active',
    });
    return true;
  }

  private async listRules(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    try {
      const rules = await this.decomposition.listRules(tenantId);
      res.json({ success: true, data: rules, count: rules.length });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async getRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const ruleId = req.params['ruleId']!;
    try {
      const rule = await this.decomposition.getRule(tenantId, ruleId);
      if (!rule) {
        res.status(404).json({ success: false, error: `Decomposition rule '${ruleId}' not found` });
        return;
      }
      res.json({ success: true, data: rule });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async upsertRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (await this.refuseIfKilled(tenantId, res)) return;
    const ruleId = req.params['ruleId']!;
    const body = req.body as Partial<DecompositionRule>;

    // Cross-tenant write guard. Operators can ONLY write rules into their
    // own tenant; the platform-default __global__ namespace requires
    // explicit platform-admin role (deferred — block for now).
    if (body.tenantId && body.tenantId !== tenantId && body.tenantId !== '__global__') {
      res.status(403).json({ success: false, error: 'Cross-tenant decomposition writes are not allowed' });
      return;
    }
    if (body.tenantId === '__global__') {
      res.status(403).json({ success: false, error: 'Writing to __global__ requires platform-admin role (pending)' });
      return;
    }

    if (!body.productType || typeof body.productType !== 'string') {
      res.status(400).json({ success: false, error: '`productType` (string) is required' });
      return;
    }
    if (!Array.isArray(body.vendorOrders) || body.vendorOrders.length === 0) {
      res.status(400).json({ success: false, error: '`vendorOrders` (non-empty array) is required' });
      return;
    }

    const rule: DecompositionRule = {
      ...(body as DecompositionRule),
      id: ruleId,
      tenantId,
      type: 'decomposition-rule' as const,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as DecompositionRule;

    try {
      const previous = await this.decomposition.getRule(tenantId, ruleId);
      const saved = await this.decomposition.upsertRule(rule, req.user?.id ?? 'unknown');
      await this.db.createDocument('decision-rule-audit', {
        id: uuidv4(),
        type: 'decision-rule-audit',
        category: CATEGORY_ID,
        tenantId,
        packId: ruleId,
        fromVersion: null,
        toVersion: null,
        action: previous ? 'update' : 'create',
        actor: req.user?.id ?? 'unknown',
        reason: (body as { reason?: string }).reason ?? null,
        timestamp: new Date().toISOString(),
      } as never);
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async deleteRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (await this.refuseIfKilled(tenantId, res)) return;
    const ruleId = req.params['ruleId']!;
    try {
      const deleted = await this.decomposition.deleteRule(tenantId, ruleId);
      if (!deleted) {
        res.status(404).json({ success: false, error: `Decomposition rule '${ruleId}' not found` });
        return;
      }
      await this.db.createDocument('decision-rule-audit', {
        id: uuidv4(),
        type: 'decision-rule-audit',
        category: CATEGORY_ID,
        tenantId,
        packId: ruleId,
        fromVersion: null,
        toVersion: null,
        action: 'drop',
        actor: req.user?.id ?? 'unknown',
        timestamp: new Date().toISOString(),
      } as never);
      res.json({ success: true, data: { ruleId, deleted: true } });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async preview(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const body = req.body as {
      clientId?: string;
      productType?: string;
      context?: DecompositionContext;
    };
    if (!body.clientId || !body.productType) {
      res.status(400).json({ success: false, error: '`clientId` and `productType` are required' });
      return;
    }
    try {
      const rule = await this.decomposition.findRule(
        tenantId,
        body.clientId,
        body.productType as DecompositionRule['productType'],
      );
      const templates = await this.decomposition.compose(
        tenantId,
        body.clientId,
        body.productType as DecompositionRule['productType'],
        body.context ?? {} as DecompositionContext,
      );
      res.json({ success: true, data: { matchedRuleId: rule?.id ?? null, templates } });
    } catch (err) {
      res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
}
