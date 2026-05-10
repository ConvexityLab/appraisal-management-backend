/**
 * DecisionEngineRulesController — generic, category-parameterized CRUD over
 * the immutable, versioned rule packs that drive every decision-engine
 * evaluator on the platform.
 *
 * Phase A of docs/DECISION_ENGINE_RULES_SURFACE.md (initial mount) +
 * Phase B (registry-backed dispatch). Mounted at
 * `/api/decision-engine/rules/:category`. Tenant comes from auth context;
 * category comes from the URL.
 *
 * Routes (all relative to the mount path):
 *   POST   /                       — create a new version of a pack
 *   POST   /preview                — stateless rule-pack test against samples
 *   GET    /seed                   — read upstream evaluator's seed pack
 *   POST   /seed-from-default      — fork upstream seed as v1 of tenant pack
 *   GET    /:packId                — get the active version of a pack
 *   GET    /:packId/versions       — list all versions, newest first
 *   GET    /:packId/versions/:v    — get a specific version
 *   GET    /:packId/audit          — append-only audit log for a pack
 *   DELETE /:packId                — drop the tenant's pack on the evaluator
 *
 * Push-on-write happens via the service's `onNewActivePack` hook (registered
 * per category at startup by wireRegistryHooks). This controller dispatches
 * preview / seed / drop to the registered category's optional methods —
 * categories that don't implement those return 501.
 */

import { Router, type Response, type NextFunction } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { DecisionRulePackService } from '../services/decision-rule-pack.service.js';
import type {
  CreateRulePackInput,
  DecisionRuleCategory,
} from '../types/decision-rule-pack.types.js';
import type { CategoryDefinition, CategoryRegistry } from '../services/decision-engine/category-definition.js';

export class DecisionEngineRulesController {
  public readonly router: Router;

  constructor(
    private readonly packs: DecisionRulePackService,
    private readonly registry: CategoryRegistry,
  ) {
    this.router = Router({ mergeParams: true });
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.use(this.requireKnownCategory.bind(this));

    // Route order matters: /preview, /seed, /seed-from-default before /:packId.
    this.router.post('/preview',                  this.preview.bind(this));
    this.router.get('/seed',                      this.getSeed.bind(this));
    this.router.post('/seed-from-default',        this.seedFromDefault.bind(this));
    this.router.post('/',                         this.createVersion.bind(this));
    this.router.get('/:packId',                   this.getActive.bind(this));
    this.router.get('/:packId/versions',          this.listVersions.bind(this));
    this.router.get('/:packId/versions/:version', this.getVersion.bind(this));
    this.router.get('/:packId/audit',             this.getAudit.bind(this));
    this.router.delete('/:packId',                this.dropPack.bind(this));
  }

  // ── Auth + category guards ────────────────────────────────────────────────
  private requireTenant(req: UnifiedAuthRequest, res: Response): string | null {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return null;
    }
    return tenantId;
  }

  private requireKnownCategory(
    req: UnifiedAuthRequest,
    res: Response,
    next: NextFunction,
  ): void {
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
    next();
  }

  /** Resolve the registered definition for the route's category. */
  private resolveCategory(category: DecisionRuleCategory): CategoryDefinition {
    // requireKnownCategory ran first, so this is always defined.
    return this.registry.get(category)!;
  }

  /** Send a uniform 501 for category methods that aren't implemented. */
  private notImplemented(
    res: Response,
    category: DecisionRuleCategory,
    method: 'push' | 'preview' | 'getSeed' | 'drop' | 'replay',
  ): void {
    res.status(501).json({
      success: false,
      error: `Category '${category}' does not implement ${method}(). The corresponding endpoint is unavailable for this category.`,
    });
  }

  // ── POST / — create a new version ────────────────────────────────────────
  private async createVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const def = this.resolveCategory(category);

    const body = req.body as Partial<CreateRulePackInput<unknown>>;
    if (!body.packId || typeof body.packId !== 'string') {
      res.status(400).json({ success: false, error: '`packId` (string) is required' });
      return;
    }
    if (!Array.isArray(body.rules)) {
      res.status(400).json({ success: false, error: '`rules` (array) is required' });
      return;
    }

    // Run the category's pre-write validation. Errors block the write; warnings
    // are returned alongside the success response so the FE can surface them.
    const validation = def.validateRules(body.rules);
    if (validation.errors.length > 0) {
      res.status(400).json({
        success: false,
        error: validation.errors[0],
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
      });
      return;
    }

    const input: CreateRulePackInput<unknown> = {
      category,
      tenantId,
      packId: body.packId,
      rules: body.rules,
      ...(body.metadata ? { metadata: body.metadata } : {}),
      createdBy: req.user?.id ?? 'unknown',
      ...(body.reason ? { reason: body.reason } : {}),
    };

    try {
      const pack = await this.packs.createVersion(input);
      const responsePayload: Record<string, unknown> = { success: true, data: pack };
      if (validation.warnings.length > 0) {
        responsePayload['validationWarnings'] = validation.warnings;
      }
      res.status(201).json(responsePayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fallback for service-level invariants the category validator doesn't cover
      // (e.g. tenant/category empty checks deep in the service).
      if (/duplicate|required|empty|must (be|contain)/i.test(msg)) {
        res.status(400).json({ success: false, error: msg });
      } else {
        res.status(500).json({ success: false, error: msg });
      }
    }
  }

  // ── GET /:packId — active version ────────────────────────────────────────
  private async getActive(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const packId = req.params['packId']!;
    const pack = await this.packs.getActive(category, tenantId, packId);
    if (!pack) {
      res.status(404).json({ success: false, error: `No active pack '${packId}' for tenant in category '${category}'` });
      return;
    }
    res.json({ success: true, data: pack });
  }

  // ── GET /:packId/versions — all versions ─────────────────────────────────
  private async listVersions(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const packId = req.params['packId']!;
    const versions = await this.packs.listVersions(category, tenantId, packId);
    res.json({ success: true, data: versions, count: versions.length });
  }

  // ── GET /:packId/versions/:version ───────────────────────────────────────
  private async getVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const packId = req.params['packId']!;
    const version = Number.parseInt(req.params['version'] ?? '', 10);
    if (!Number.isFinite(version) || version <= 0) {
      res.status(400).json({ success: false, error: '`version` must be a positive integer' });
      return;
    }
    const pack = await this.packs.getVersion(category, tenantId, packId, version);
    if (!pack) {
      res.status(404).json({ success: false, error: `Pack '${packId}' v${version} not found in category '${category}'` });
      return;
    }
    res.json({ success: true, data: pack });
  }

  // ── GET /:packId/audit ───────────────────────────────────────────────────
  private async getAudit(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const packId = req.params['packId']!;
    const entries = await this.packs.listAudit(category, tenantId, packId);
    res.json({ success: true, data: entries, count: entries.length });
  }

  // ── GET /seed — read evaluator's inherited-default rule pack ─────────────
  private async getSeed(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const def = this.resolveCategory(category);
    if (!def.getSeed) {
      this.notImplemented(res, category, 'getSeed');
      return;
    }
    try {
      const seed = await def.getSeed();
      res.json({ success: true, data: seed });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── POST /seed-from-default — copy upstream seed into AMS as v1 ──────────
  private async seedFromDefault(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const def = this.resolveCategory(category);
    if (!def.getSeed) {
      this.notImplemented(res, category, 'getSeed');
      return;
    }

    const body = (req.body ?? {}) as { packId?: string; reason?: string };
    const packId = body.packId ?? 'default';

    const existing = await this.packs.getActive(category, tenantId, packId);
    if (existing) {
      res.status(409).json({
        success: false,
        error: `Pack '${packId}' already exists for this tenant in category '${category}' at v${existing.version}. Use POST / to create a new version, or DELETE /:packId first if you want to drop it.`,
      });
      return;
    }

    let seed: { program: Record<string, unknown>; rules: unknown[] };
    try {
      seed = await def.getSeed();
    } catch (err) {
      res.status(502).json({
        success: false,
        error: `Failed to fetch upstream seed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    try {
      const pack = await this.packs.createVersion({
        category,
        tenantId,
        packId,
        rules: seed.rules,
        metadata: {
          name: `Seeded from upstream default`,
          description:
            `Created by copying ${def.label}'s default seed pack (${seed.rules.length} rule${seed.rules.length === 1 ? '' : 's'}). ` +
            `Edit + publish a new version to customize.`,
        },
        createdBy: req.user?.id ?? 'system',
        reason: body.reason ?? 'Seeded from upstream default',
      });
      res.status(201).json({ success: true, data: pack });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── POST /preview — stateless rule-pack test against sample evaluations ──
  private async preview(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const def = this.resolveCategory(category);
    if (!def.preview) {
      this.notImplemented(res, category, 'preview');
      return;
    }

    const body = req.body as {
      rules?: unknown[];
      evaluations?: Array<Record<string, unknown>>;
      packId?: string;
    };
    if (!Array.isArray(body.rules)) {
      res.status(400).json({ success: false, error: '`rules` (array) is required' });
      return;
    }
    if (!Array.isArray(body.evaluations) || body.evaluations.length === 0) {
      res.status(400).json({ success: false, error: '`evaluations` (non-empty array) is required' });
      return;
    }

    try {
      const results = await def.preview({
        rules: body.rules,
        evaluations: body.evaluations,
        ...(body.packId ? { packId: body.packId } : {}),
      });
      // Wrap in `{ results: [...] }` to match the FE's existing shape, which
      // the original MOP /preview response also used.
      res.json({ success: true, data: { results } });
      // suppress unused tenantId
      void tenantId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = /^MOP preview returned 400/.test(msg) ? 400 : 502;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // ── DELETE /:packId — drop tenant pack on the evaluator ──────────────────
  private async dropPack(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;
    const def = this.resolveCategory(category);
    if (!def.drop) {
      this.notImplemented(res, category, 'drop');
      return;
    }
    try {
      await def.drop(tenantId);
      res.json({ success: true, data: { tenantId, category, dropped: true } });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: `Upstream drop failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
