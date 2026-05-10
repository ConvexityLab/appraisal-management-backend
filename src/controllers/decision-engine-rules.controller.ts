/**
 * DecisionEngineRulesController — generic, category-parameterized CRUD over
 * the immutable, versioned rule packs that drive every decision-engine
 * evaluator on the platform.
 *
 * Phase A of docs/DECISION_ENGINE_RULES_SURFACE.md. Replaces
 * VendorMatchingRulePacksController; mounted at
 * `/api/decision-engine/rules/:category`. Tenant comes from auth context;
 * the category comes from the URL.
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
 * per category at startup in api-server.ts). This controller doesn't call
 * push targets directly except for the preview / seed / drop endpoints, which
 * proxy to the per-category push client (today only `MopRulePackPusher` for
 * vendor-matching). Phase B replaces this with a CategoryDefinition lookup.
 */

import { Router, type Response, type NextFunction } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { DecisionRulePackService } from '../services/decision-rule-pack.service.js';
import type {
  CreateRulePackInput,
  DecisionRuleCategory,
} from '../types/decision-rule-pack.types.js';
import type { MopRulePackPusher } from '../services/mop-rule-pack-pusher.service.js';

/**
 * Per-category push client wiring. Phase B replaces this with the
 * `CategoryDefinition` registry; for Phase A we hard-wire vendor-matching →
 * MopRulePackPusher and return 501 for any other category that tries to
 * use the push-backed endpoints (preview / seed / drop).
 */
export interface CategoryPushClients {
  /** Vendor-matching's MOP pusher; null when MOP isn't configured. */
  vendorMatching: MopRulePackPusher | null;
}

const KNOWN_CATEGORIES: ReadonlySet<DecisionRuleCategory> = new Set([
  'vendor-matching',
]);

export class DecisionEngineRulesController {
  public readonly router: Router;

  constructor(
    private readonly packs: DecisionRulePackService,
    private readonly pushers: CategoryPushClients,
  ) {
    this.router = Router({ mergeParams: true });
    this.initRoutes();
  }

  private initRoutes(): void {
    // Validate :category once at the top of the router so every handler can
    // assume req.params.category is registered.
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
    if (!KNOWN_CATEGORIES.has(category)) {
      res.status(404).json({
        success: false,
        error: `Unknown decision-engine category '${category}'. Known: ${Array.from(KNOWN_CATEGORIES).join(', ')}.`,
      });
      return;
    }
    next();
  }

  /** Resolve the push client for the route's category. Returns null when
   *  the category has no push client wired (e.g. MOP not configured for
   *  vendor-matching). */
  private resolvePusher(category: DecisionRuleCategory): MopRulePackPusher | null {
    if (category === 'vendor-matching') return this.pushers.vendorMatching;
    return null;
  }

  // ── POST / — create a new version ────────────────────────────────────────
  private async createVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const category = req.params['category']!;

    const body = req.body as Partial<CreateRulePackInput<unknown>>;
    if (!body.packId || typeof body.packId !== 'string') {
      res.status(400).json({ success: false, error: '`packId` (string) is required' });
      return;
    }
    if (!Array.isArray(body.rules)) {
      res.status(400).json({ success: false, error: '`rules` (array) is required' });
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
      res.status(201).json({ success: true, data: pack });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Validation errors raise plain Error — 400; only true infra errors → 500.
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
    const pusher = this.resolvePusher(category);
    if (!pusher) {
      res.status(category === 'vendor-matching' ? 503 : 501).json({
        success: false,
        error: category === 'vendor-matching'
          ? 'MOP push not configured (no pusher)'
          : `Category '${category}' has no upstream seed source wired (will land in Phase B).`,
      });
      return;
    }
    try {
      const seed = await pusher.getSeed();
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
    const pusher = this.resolvePusher(category);
    if (!pusher) {
      res.status(category === 'vendor-matching' ? 503 : 501).json({
        success: false,
        error: category === 'vendor-matching'
          ? 'MOP push not configured (no pusher)'
          : `Category '${category}' has no seed-from-default source wired (will land in Phase B).`,
      });
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
      seed = await pusher.getSeed();
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
            `Created by copying upstream evaluator's default seed pack (${seed.rules.length} rule${seed.rules.length === 1 ? '' : 's'}). ` +
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
    const pusher = this.resolvePusher(category);
    if (!pusher) {
      res.status(category === 'vendor-matching' ? 503 : 501).json({
        success: false,
        error: category === 'vendor-matching'
          ? 'MOP push not configured (no pusher)'
          : `Category '${category}' has no preview backend wired (will land in Phase B).`,
      });
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
      const result = await pusher.preview({
        rulePack: {
          program: {
            name: `Preview for tenant ${tenantId} (${category})`,
            programId: 'vendor-matching',
            version: 'preview',
            description: `Preview from FE rules workspace (category=${category}, pack=${body.packId ?? 'default'})`,
          },
          rules: body.rules,
        },
        evaluations: body.evaluations,
      });
      res.json({ success: true, data: result });
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
    const pusher = this.resolvePusher(category);
    if (!pusher) {
      res.status(category === 'vendor-matching' ? 503 : 501).json({
        success: false,
        error: category === 'vendor-matching'
          ? 'MOP push not configured (no pusher)'
          : `Category '${category}' has no drop endpoint wired (will land in Phase B).`,
      });
      return;
    }
    try {
      await pusher.drop(tenantId);
      res.json({ success: true, data: { tenantId, category, dropped: true } });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: `Upstream drop failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
