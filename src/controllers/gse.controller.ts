/**
 * GSE (Government-Sponsored Enterprise) Submission Controller (Phase 5)
 *
 * Routes (mounted at /api/gse):
 *   POST /ucdp/submit/:orderId        — submit appraisal to Fannie Mae UCDP
 *   GET  /ucdp/status/:submissionId   — get UCDP submission status + SSR findings
 *   GET  /ucdp/order/:orderId         — list all UCDP submissions for an order
 *   POST /ead/submit/:orderId         — submit appraisal to FHA EAD
 *   GET  /ead/status/:submissionId    — get EAD submission status + findings
 *   GET  /ead/order/:orderId          — list all EAD submissions for an order
 *
 * Delegates to the existing UCDPEADSubmissionService (ucdp-ead-submission.service.ts).
 * Provider is injected via createGseProvider() factory (env-var driven).
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { UCDPEADSubmissionService } from '../services/ucdp-ead-submission.service.js';
import type { SubmissionRequest } from '../services/ucdp-ead-submission.service.js';
import { createGseProvider } from '../services/gse-providers/factory.js';

export function createGseRouter(db: CosmosDbService): Router {
  const router  = Router();
  const logger  = new Logger('GseController');
  const service = new UCDPEADSubmissionService(db, createGseProvider());

  // ─── POST /ucdp/submit/:orderId ─────────────────────────────────────────────
  router.post('/ucdp/submit/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const orderId = req.params['orderId'] as string;
    const body = req.body as Partial<SubmissionRequest>;

    if (!body.xmlContent || typeof body.xmlContent !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'xmlContent (MISMO 3.4 XML string) is required' } });
      return;
    }

    try {
      const result = await service.submit({
        orderId,
        tenantId,
        portal: 'UCDP',
        xmlContent: body.xmlContent,
        ...(typeof body.loanNumber === 'string' ? { loanNumber: body.loanNumber } : {}),
        ...(typeof body.lenderId === 'string' ? { lenderId: body.lenderId } : {}),
      });

      logger.info('UCDP submit complete', { orderId, status: result.submission.status, hardStops: result.hardStopCount });
      res.status(result.submission.status === 'ERROR' ? 502 : 200).json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('UCDP submit route error', { orderId, error: message });
      res.status(500).json({ success: false, error: { code: 'GSE_SUBMIT_ERROR', message } });
    }
  });

  // ─── GET /ucdp/status/:submissionId ─────────────────────────────────────────
  router.get('/ucdp/status/:submissionId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const submissionId = req.params['submissionId'] as string;

    try {
      const result = await service.checkSubmissionStatus(submissionId, tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const notFound = message.toLowerCase().includes('not found');
      res.status(notFound ? 404 : 500).json({ success: false, error: { code: notFound ? 'NOT_FOUND' : 'GSE_STATUS_ERROR', message } });
    }
  });

  // ─── GET /ucdp/order/:orderId ────────────────────────────────────────────────
  router.get('/ucdp/order/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const orderId = req.params['orderId'] as string;

    try {
      const submissions = await service.getSubmissionsForOrder(orderId, tenantId);
      res.json({ success: true, data: submissions });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: { code: 'GSE_LIST_ERROR', message } });
    }
  });

  // ─── POST /ead/submit/:orderId ──────────────────────────────────────────────
  router.post('/ead/submit/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const orderId = req.params['orderId'] as string;
    const body = req.body as Partial<SubmissionRequest>;

    if (!body.xmlContent || typeof body.xmlContent !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'xmlContent (MISMO 3.4 XML string) is required' } });
      return;
    }

    try {
      const result = await service.submit({
        orderId,
        tenantId,
        portal: 'EAD',
        xmlContent: body.xmlContent,
        ...(typeof body.loanNumber === 'string' ? { loanNumber: body.loanNumber } : {}),
        ...(typeof body.lenderId === 'string' ? { lenderId: body.lenderId } : {}),
      });

      logger.info('EAD submit complete', { orderId, status: result.submission.status, hardStops: result.hardStopCount });
      res.status(result.submission.status === 'ERROR' ? 502 : 200).json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('EAD submit route error', { orderId, error: message });
      res.status(500).json({ success: false, error: { code: 'GSE_SUBMIT_ERROR', message } });
    }
  });

  // ─── GET /ead/status/:submissionId ───────────────────────────────────────────
  router.get('/ead/status/:submissionId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const submissionId = req.params['submissionId'] as string;

    try {
      const result = await service.checkSubmissionStatus(submissionId, tenantId);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const notFound = message.toLowerCase().includes('not found');
      res.status(notFound ? 404 : 500).json({ success: false, error: { code: notFound ? 'NOT_FOUND' : 'GSE_STATUS_ERROR', message } });
    }
  });

  // ─── GET /ead/order/:orderId ─────────────────────────────────────────────────
  router.get('/ead/order/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const orderId = req.params['orderId'] as string;

    try {
      const submissions = await service.getSubmissionsForOrder(orderId, tenantId);
      res.json({ success: true, data: submissions });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: { code: 'GSE_LIST_ERROR', message } });
    }
  });

  return router;
}
