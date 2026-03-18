/**
 * LOS (Loan Origination System) Integration Controller (Phase 5)
 *
 * Routes (mounted at /api/los):
 *   POST /orders/import              — import an appraisal order from the LOS by loan number
 *   POST /orders/:orderId/push       — push appraisal status / completion data back to the LOS
 *   GET  /loans/:loanNumber          — read-only loan lookup (does not create an order)
 *
 * Provider is selected via LOS_PROVIDER env var (encompass|black_knight|mock).
 * All auth happens via the unified middleware mounted by api-server.ts.
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { createLosProvider } from '../services/los-providers/factory.js';
import type { LosPushRequest } from '../services/los-providers/los-provider.interface.js';

export function createLosRouter(_db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger('LosController');
  const provider = createLosProvider();

  // ─── POST /orders/import ────────────────────────────────────────────────────
  router.post('/orders/import', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const loanNumber = (req.body as Record<string, unknown>).loanNumber;
    const losFileId  = (req.body as Record<string, unknown>).losFileId;

    if (!loanNumber || typeof loanNumber !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loanNumber (string) is required' } });
      return;
    }

    try {
      const result = await provider.importOrder({
        loanNumber,
        tenantId,
        ...(typeof losFileId === 'string' ? { losFileId } : {}),
      });

      logger.info('LOS order imported', { loanNumber, orderId: result.orderId, tenantId });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('LOS importOrder failed', { loanNumber, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'LOS_IMPORT_ERROR', message } });
    }
  });

  // ─── POST /orders/:orderId/push ─────────────────────────────────────────────
  router.post('/orders/:orderId/push', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const orderId = req.params['orderId'] as string;
    const body = req.body as Partial<LosPushRequest>;

    if (!body.loanNumber || typeof body.loanNumber !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loanNumber (string) is required' } });
      return;
    }
    if (!body.statusCode || typeof body.statusCode !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'statusCode (string) is required' } });
      return;
    }

    try {
      const result = await provider.pushOrder({
        orderId,
        loanNumber: body.loanNumber,
        statusCode: body.statusCode,
        ...(typeof body.appraisedValueCents === 'number' ? { appraisedValueCents: body.appraisedValueCents } : {}),
        ...(typeof body.appraisalEffectiveDate === 'string' ? { appraisalEffectiveDate: body.appraisalEffectiveDate } : {}),
        ...(typeof body.note === 'string' ? { note: body.note } : {}),
        ...(typeof body.reportPdfBase64 === 'string' ? { reportPdfBase64: body.reportPdfBase64 } : {}),
      });

      logger.info('LOS push completed', { orderId, loanNumber: body.loanNumber, success: result.success });
      res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('LOS pushOrder failed', { orderId, error: message });
      res.status(500).json({ success: false, error: { code: 'LOS_PUSH_ERROR', message } });
    }
  });

  // ─── GET /loans/:loanNumber ─────────────────────────────────────────────────
  router.get('/loans/:loanNumber', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const loanNumber = req.params['loanNumber'] as string;

    try {
      const loan = await provider.getLoan(loanNumber, tenantId);
      if (!loan) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Loan ${loanNumber} not found in ${provider.name}` } });
        return;
      }

      res.json({ success: true, data: loan });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('LOS getLoan failed', { loanNumber, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'LOS_LOOKUP_ERROR', message } });
    }
  });

  return router;
}
