/**
 * Assignment Traces Controller — read-only access to per-assignment evaluation
 * traces persisted by the orchestrator's recordAssignmentTrace() (Phase 5 T37).
 *
 * Phase 5 T38 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.6. Mounted at
 * /api/auto-assignment/traces. tenantId comes from auth (req.user.tenantId);
 * cross-tenant access prevented at the controller level.
 *
 * Routes:
 *   GET /:orderId   — all traces for an order, newest first
 *   GET /           — recent traces for the tenant (defaults to 50, capped 200)
 */

import { Router, type Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AssignmentTraceRecorder } from '../services/assignment-trace-recorder.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';

export class AssignmentTracesController {
  public readonly router: Router;
  private readonly recorder: AssignmentTraceRecorder;

  constructor(dbService: CosmosDbService) {
    this.router = Router();
    this.recorder = new AssignmentTraceRecorder(dbService);
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/',           this.listRecent.bind(this));
    this.router.get('/:orderId',   this.listForOrder.bind(this));
  }

  private requireTenant(req: UnifiedAuthRequest, res: Response): string | null {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return null;
    }
    return tenantId;
  }

  private async listForOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const orderId = req.params.orderId!;
    const traces = await this.recorder.listForOrder(tenantId, orderId);
    res.json({ success: true, data: traces, count: traces.length });
  }

  private async listRecent(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const tenantId = this.requireTenant(req, res);
    if (!tenantId) return;
    const limitRaw = Number.parseInt((req.query.limit as string) ?? '50', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const summaries = await this.recorder.listRecent(tenantId, limit);
    res.json({ success: true, data: summaries, count: summaries.length });
  }
}
