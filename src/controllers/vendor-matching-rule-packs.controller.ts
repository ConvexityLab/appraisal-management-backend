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
