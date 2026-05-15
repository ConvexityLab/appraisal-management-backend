/**
 * Vendor Matching Rule Packs Controller — AMS-side CRUD over the immutable,
 * versioned rule packs that drive the MOP vendor-matching evaluator.
 *
 * Phase 3 T21 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.4. Mounted at
 * /api/auto-assignment/rules. Tenant comes from auth context (req.user.tenantId);
 * operators can only see/edit packs for their own tenant.
 *
 * Routes:
 *   POST   /                       — create a new version of a pack
 *   GET    /:packId                — get the active version of a pack
 *   GET    /:packId/versions       — list all versions, newest first
 *   GET    /:packId/versions/:v    — get a specific version
 *   GET    /:packId/audit          — append-only audit log for a pack
 *   DELETE /:packId                — drop the tenant's pack (MOP falls back to default seed)
 *
 * Push to MOP is wired via the rule-pack service's onNewActivePack hook
 * (registered at construction time in api-server.ts) — this controller
 * doesn't call MOP directly. Storage is the source of truth.
 */

import { Router, type Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { VendorMatchingRulePackService } from '../services/vendor-matching-rule-pack.service.js';
import type { CreateRulePackInput } from '../types/vendor-matching-rule-pack.types.js';
import { MopRulePackPusher } from '../services/mop-rule-pack-pusher.service.js';

export class VendorMatchingRulePacksController {
  public readonly router: Router;

  constructor(
    private readonly packs: VendorMatchingRulePackService,
    private readonly pusher: MopRulePackPusher | null = null,
  ) {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes(): void {
    // NOTE: route order matters. Express matches in registration order, so
    // /preview, /seed, /seed-from-default must come before /:packId or
    // they'd be captured by the packId param.
    this.router.post('/preview',                   this.preview.bind(this));
    this.router.get('/seed',                       this.getSeed.bind(this));
    this.router.post('/seed-from-default',         this.seedFromDefault.bind(this));
    this.router.post('/',                          this.createVersion.bind(this));
    this.router.get('/:packId',                    this.getActive.bind(this));
    this.router.get('/:packId/versions',           this.listVersions.bind(this));
    this.router.get('/:packId/versions/:version',  this.getVersion.bind(this));
    this.router.get('/:packId/audit',              this.getAudit.bind(this));
    this.router.delete('/:packId',                 this.dropPack.bind(this));
  }

  // ── Auth helper ──────────────────────────────────────────────────────────
  private requireTenant(req: UnifiedAuthRequest, res: Response): string | null {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return null;
    }
    return tenantId;
  }

  // ── POST / — create a new version ────────────────────────────────────────
  private async createVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;

    const body = req.body as Partial<CreateRulePackInput>;
    if (!body.packId || typeof body.packId !== 'string') {
      res.status(400).json({ success: false, error: '`packId` (string) is required' });
      return;
    }
    if (!Array.isArray(body.rules)) {
      res.status(400).json({ success: false, error: '`rules` (array) is required' });
      return;
    }

    const input: CreateRulePackInput = {
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
      // Validation errors (duplicate name, missing field, etc.) raise plain
      // Error — surface as 400 with the message; only true infra errors
      // (Cosmos down) should 500. We can't distinguish perfectly so we use
      // a heuristic: known validation messages start with the field/constraint.
      const msg = err instanceof Error ? err.message : String(err);
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
    const packId = req.params.packId!;
    const pack = await this.packs.getActive(tenantId, packId);
    if (!pack) {
      res.status(404).json({ success: false, error: `No active pack '${packId}' for tenant` });
      return;
    }
    res.json({ success: true, data: pack });
  }

  // ── GET /:packId/versions — all versions ─────────────────────────────────
  private async listVersions(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const packId = req.params.packId!;
    const versions = await this.packs.listVersions(tenantId, packId);
    res.json({ success: true, data: versions, count: versions.length });
  }

  // ── GET /:packId/versions/:version ──────────────────────────────────────
  private async getVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const packId = req.params.packId!;
    const version = Number.parseInt(req.params.version ?? '', 10);
    if (!Number.isFinite(version) || version <= 0) {
      res.status(400).json({ success: false, error: '`version` must be a positive integer' });
      return;
    }
    const pack = await this.packs.getVersion(tenantId, packId, version);
    if (!pack) {
      res.status(404).json({ success: false, error: `Pack '${packId}' v${version} not found` });
      return;
    }
    res.json({ success: true, data: pack });
  }

  // ── GET /:packId/audit ──────────────────────────────────────────────────
  private async getAudit(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const packId = req.params.packId!;
    const entries = await this.packs.listAudit(tenantId, packId);
    res.json({ success: true, data: entries, count: entries.length });
  }

  // ── GET /seed — read MOP's inherited-default rule pack ─────────────────
  // Operators in the rules workspace see what's currently firing for their
  // tenant when they haven't published an override yet, and use the seed as
  // v1 starting point when forking. Tenant-agnostic — the seed is the same
  // for every tenant — but still gated by auth so we don't leak rule
  // structure to anonymous clients.
  private async getSeed(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (!this.pusher) {
      res.status(503).json({ success: false, error: 'MOP push not configured (no pusher)' });
      return;
    }
    try {
      const seed = await this.pusher.getSeed();
      res.json({ success: true, data: seed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ success: false, error: msg });
    }
  }

  // ── POST /seed-from-default — copy MOP seed into AMS as v1 ──────────────
  // Convenience endpoint for the workspace's "Seed v1 from default" button.
  // Reads MOP's seed pack, then creates v1 of the tenant's pack with those
  // rules. The push hook automatically PUTs the new pack to MOP, so once
  // this returns the tenant has its own override (still identical to the
  // seed) and operators can edit + publish v2 from there.
  //
  // 409 if a pack already exists for this tenant — guards against
  // accidentally overwriting tenant-customized rules.
  private async seedFromDefault(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (!this.pusher) {
      res.status(503).json({ success: false, error: 'MOP push not configured (no pusher)' });
      return;
    }

    const body = (req.body ?? {}) as { packId?: string; reason?: string };
    const packId = body.packId ?? 'default';

    // Refuse to clobber an existing pack — operators must explicitly create
    // a new version via the normal POST / path if they want to overwrite.
    const existing = await this.packs.getActive(tenantId, packId);
    if (existing) {
      res.status(409).json({
        success: false,
        error: `Pack '${packId}' already exists for this tenant at v${existing.version}. Use POST / to create a new version, or DELETE /:packId first if you want to drop it.`,
      });
      return;
    }

    let seed: { program: Record<string, unknown>; rules: unknown[] };
    try {
      seed = await this.pusher.getSeed();
    } catch (err) {
      res.status(502).json({
        success: false,
        error: `Failed to fetch MOP seed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    try {
      const pack = await this.packs.createVersion({
        tenantId,
        packId,
        rules: seed.rules as any,
        metadata: {
          name: `Seeded from MOP default`,
          description:
            `Created by copying MOP's default seed pack (${seed.rules.length} rule${seed.rules.length === 1 ? '' : 's'}). ` +
            `Edit + publish a new version to customize.`,
        },
        createdBy: req.user?.id ?? 'system',
        reason: body.reason ?? 'Seeded from MOP default',
      });
      res.status(201).json({ success: true, data: pack });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  }

  // ── POST /preview — stateless rule-pack test against sample vendors ─────
  // Forwards to MOP's /api/v1/vendor-matching/preview. Wraps the FE's
  // {rules, evaluations} body into the shape MOP expects ({rulePack, evaluations}).
  // Returns MOP's response unchanged on success; bubbles MOP's validation
  // errors verbatim on 400 so the FE shows the same messages the operator
  // would see on save.
  private async preview(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (!this.pusher) {
      res.status(503).json({ success: false, error: 'MOP push not configured (no pusher)' });
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
      const result = await this.pusher.preview({
        rulePack: {
          program: {
            name: `Preview for tenant ${tenantId}`,
            programId: 'vendor-matching',
            version: 'preview',
            description: `Preview from FE rules workspace (pack=${body.packId ?? 'default'})`,
          },
          rules: body.rules,
        },
        evaluations: body.evaluations,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // MOP returns the validator's error list inside the message; surface as 400
      // so the FE can render it inline alongside the editor.
      const status = /^MOP preview returned 400/.test(msg) ? 400 : 502;
      res.status(status).json({ success: false, error: msg });
    }
  }

  // ── DELETE /:packId — drop tenant pack on MOP ────────────────────────────
  // Note: AMS keeps history of past versions for replay (Phase 6); this
  // endpoint only tells MOP to fall back to the default seed for this
  // tenant going forward. The audit log + version history stay intact.
  private async dropPack(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    if (!this.pusher) {
      res.status(503).json({ success: false, error: 'MOP push not configured (no pusher)' });
      return;
    }
    try {
      await this.pusher.drop(tenantId);
      res.json({ success: true, data: { tenantId, dropped: true } });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: `MOP drop failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
