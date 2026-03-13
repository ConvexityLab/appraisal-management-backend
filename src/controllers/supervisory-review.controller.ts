/**
 * Supervisory Review Controller
 *
 * Endpoints:
 *   GET  /api/supervisory-review/:orderId           — get supervision status
 *   GET  /api/supervisory-review/pending            — list all orders pending my co-sign
 *   POST /api/supervisory-review/:orderId/request   — request supervision (operator/system)
 *   POST /api/supervisory-review/:orderId/cosign    — supervisor co-signs the order
 */

import express, { Response, Router } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { SupervisoryReviewService } from '../services/supervisory-review.service.js';
import { Logger } from '../utils/logger.js';

const router: Router = express.Router();
/** Convenience alias — all routes are protected by unifiedAuth so req is always UnifiedAuthRequest */
type Req = UnifiedAuthRequest;
const service = new SupervisoryReviewService();
const logger = new Logger('SupervisoryReviewController');

/**
 * Extract tenantId from the JWT (req.user, via unifiedAuth) with x-tenant-id header as fallback.
 * Callers must validate that the returned value is non-empty before use.
 */
function resolveTenantId(req: Req): string {
  return (req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined) ?? '') as string;
}

// ── GET /api/supervisory-review/pending ──────────────────────────────────────

router.get('/pending', async (req: Req, res: Response) => {
  try {
    const tenantId = resolveTenantId(req);
    const supervisorId = req.query.supervisorId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required (provide via auth token or x-tenant-id header)' });
    }

    const pending = await (supervisorId
      ? service.getPendingCosigns(tenantId, supervisorId)
      : service.getPendingCosigns(tenantId));
    return res.json({ success: true, data: pending, count: pending.length });
  } catch (err: any) {
    logger.error('GET /pending failed', { error: err });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/supervisory-review/:orderId ─────────────────────────────────────

router.get('/:orderId', async (req: Req, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required (provide via auth token or x-tenant-id header)' });
    }

    const status = await service.getStatus(orderId, tenantId);
    return res.json({ success: true, data: status });
  } catch (err: any) {
    logger.error('GET supervisory status failed', { error: err });
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/supervisory-review/:orderId/request ────────────────────────────

router.post('/:orderId/request', async (req: Req, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = resolveTenantId(req);
    const { supervisorId, supervisorName, reason, requestedBy, priority } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required (provide via auth token or x-tenant-id header)' });
    }
    if (!supervisorId) {
      return res.status(400).json({ error: 'supervisorId is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const status = await service.requestSupervision({
      orderId,
      tenantId,
      supervisorId,
      supervisorName,
      reason,
      requestedBy: requestedBy ?? 'system',
      priority,
    });

    return res.status(200).json({ success: true, data: status });
  } catch (err: any) {
    logger.error('POST request supervision failed', { error: err });
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/supervisory-review/:orderId/cosign ─────────────────────────────

router.post('/:orderId/cosign', async (req: Req, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = resolveTenantId(req);
    const { supervisorId, supervisorName, notes } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required (provide via auth token or x-tenant-id header)' });
    }
    if (!supervisorId) {
      return res.status(400).json({ error: 'supervisorId is required' });
    }
    if (!supervisorName) {
      return res.status(400).json({ error: 'supervisorName is required' });
    }

    const status = await service.cosignOrder({
      orderId,
      tenantId,
      supervisorId,
      supervisorName,
      notes,
    });

    return res.status(200).json({ success: true, data: status });
  } catch (err: any) {
    logger.error('POST cosign failed', { error: err });
    if (err.message?.includes('not found')) {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err.message?.includes('mismatch') || err.message?.includes('does not require')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
