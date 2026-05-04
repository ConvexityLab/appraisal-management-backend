/**
 * Inspection Vendor Controller
 *
 * Routes (mounted at /api/inspection):
 *   GET  /config                          — provider config (e.g. default survey template ID)
 *   POST /:vendorOrderId/order            — place inspection order with vendor
 *   GET  /:vendorOrderId/status           — poll current status from vendor
 *   POST /:vendorOrderId/retrieve-results — explicitly fetch results & PDFs
 *   POST /:vendorOrderId/attachments      — upload supplementary file to vendor
 *   POST /:vendorOrderId/cancel           — cancel inspection order
 *   POST /:vendorOrderId/message          — send message (501 if provider unsupported)
 *   GET  /:vendorOrderId/reports/:variant — generate short-lived SAS download URL
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { BlobStorageService } from '../services/blob-storage.service.js';
import { InspectionVendorService, UnsupportedOperationError } from '../services/inspection-vendor.service.js';
import { createInspectionProvider } from '../services/inspection-providers/factory.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('InspectionVendorController');

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function missingField(res: Response, field: string): void {
  res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: `Missing required field: ${field}` },
  });
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof UnsupportedOperationError) {
    res.status(501).json({
      success: false,
      error: { code: 'NOT_SUPPORTED', message: (err as Error).message },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Inspection vendor controller error', { error: message });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Router factory
// ──────────────────────────────────────────────────────────────────────────────

export function createInspectionVendorRouter(db: CosmosDbService): Router {
  const router = Router({ mergeParams: true });
  const blob = new BlobStorageService();
  const provider = createInspectionProvider();
  const service = new InspectionVendorService(db, blob, provider);

  // ── GET /config ───────────────────────────────────────────────────────────
  // Must be registered before /:vendorOrderId routes to avoid Express matching
  // 'config' as a vendorOrderId parameter.
  router.get(
    '/config',
    (_req: UnifiedAuthRequest, res: Response): void => {
      const defaultSurveyTemplateId = process.env['IVUEIT_SURVEY_TEMPLATE_ID'] ?? null;
      res.status(200).json({ success: true, data: { defaultSurveyTemplateId } });
    }
  );

  // ── POST /:vendorOrderId/order ─────────────────────────────────────────────
  // Body: CreateInspectionOrderInput (minus vendorOrderId / tenantId — taken from route/auth)
  router.post(
    '/:vendorOrderId/order',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;
      const body = req.body as Record<string, unknown>;

      if (!body['surveyTemplateId']) { missingField(res, 'surveyTemplateId'); return; }
      if (!body['address'])          { missingField(res, 'address'); return; }
      if (!body['schedulingWindow']) { missingField(res, 'schedulingWindow'); return; }

      const address = body['address'] as Record<string, string>;
      if (!address['street'])    { missingField(res, 'address.street'); return; }
      if (!address['city'])      { missingField(res, 'address.city'); return; }
      if (!address['stateCode']) { missingField(res, 'address.stateCode'); return; }
      if (!address['zipCode'])   { missingField(res, 'address.zipCode'); return; }

      const window = body['schedulingWindow'] as Record<string, string>;
      if (!window['startTime']) { missingField(res, 'schedulingWindow.startTime'); return; }
      if (!window['endTime'])   { missingField(res, 'schedulingWindow.endTime'); return; }

      try {
        const result = await service.placeOrder(vendorOrderId!, tenantId, {
          vendorOrderId: vendorOrderId!,
          tenantId,
          surveyTemplateId: body['surveyTemplateId'] as string,
          address: {
            street: address['street']!,
            city: address['city']!,
            stateCode: address['stateCode']!,
            zipCode: address['zipCode']!,
          },
          schedulingWindow: {
            startTime: window['startTime']!,
            endTime: window['endTime']!,
            ...(window['publishAt'] ? { publishAt: window['publishAt'] } : {}),
            ...(window['expiresAt'] ? { expiresAt: window['expiresAt'] } : {}),
          },
          ...(body['isInternal'] !== undefined ? { isInternal: body['isInternal'] as boolean } : {}),
          ...(Array.isArray(body['attachmentFileIds']) ? { attachmentFileIds: body['attachmentFileIds'] as string[] } : {}),
          ...(body['notes'] ? { notes: body['notes'] as string } : {}),
        });

        res.status(201).json({ success: true, data: result });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ── GET /:vendorOrderId/status ─────────────────────────────────────────────
  router.get(
    '/:vendorOrderId/status',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;

      try {
        const result = await service.pollOrderStatus(vendorOrderId!, tenantId);
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        // "no inspectionVendorData" means the order has never been placed with the vendor —
        // return 404 so the UI shows the "Place Order" form rather than an error banner.
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('no inspectionVendorData')) {
          res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: msg } });
          return;
        }
        handleError(res, err);
      }
    }
  );

  // ── POST /:vendorOrderId/retrieve-results ──────────────────────────────────
  router.post(
    '/:vendorOrderId/retrieve-results',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;

      try {
        const result = await service.retrieveResults(vendorOrderId!, tenantId);
        res.status(200).json({ success: true, data: result });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ── POST /:vendorOrderId/attachments ───────────────────────────────────────
  // Body: { filename: string; mimeType: string; data: string } — data is base64
  router.post(
    '/:vendorOrderId/attachments',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;
      const body = req.body as Record<string, unknown>;

      if (!body['filename']) { missingField(res, 'filename'); return; }
      if (!body['mimeType']) { missingField(res, 'mimeType'); return; }
      if (!body['data'])     { missingField(res, 'data'); return; }

      let dataBuffer: Buffer;
      try {
        dataBuffer = Buffer.from(body['data'] as string, 'base64');
      } catch {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'field "data" must be a valid base64 string' },
        });
        return;
      }

      try {
        const externalFileId = await service.uploadAttachment(vendorOrderId!, tenantId, {
          filename: body['filename'] as string,
          mimeType: body['mimeType'] as string,
          data: dataBuffer,
        });

        res.status(201).json({ success: true, data: { externalFileId } });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ── POST /:vendorOrderId/cancel ────────────────────────────────────────────
  // Body: { reason?: string }
  router.post(
    '/:vendorOrderId/cancel',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;
      const reason = (req.body as Record<string, unknown>)['reason'] as string | undefined;

      try {
        await service.cancelOrder(vendorOrderId!, tenantId, reason ?? 'No reason provided');
        res.status(200).json({ success: true });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ── POST /:vendorOrderId/message ───────────────────────────────────────────
  // Body: { message: string }
  // Returns 501 if the active provider does not support messaging.
  router.post(
    '/:vendorOrderId/message',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId } = req.params;
      const body = req.body as Record<string, unknown>;

      if (!body['message']) { missingField(res, 'message'); return; }

      try {
        await service.sendMessage(vendorOrderId!, tenantId, body['message'] as string);
        res.status(200).json({ success: true });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  // ── GET /:vendorOrderId/reports/:variant ──────────────────────────────────
  // Returns a short-lived SAS URL for a stored inspection PDF.
  // variant: 'main' | 'survey' | 'photos' | 'ordered'
  router.get(
    '/:vendorOrderId/reports/:variant',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const tenantId = req.user?.tenantId as string;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No tenantId on token' } });
        return;
      }

      const { vendorOrderId, variant } = req.params;
      const allowed = ['main', 'survey', 'photos', 'ordered'] as const;
      if (!allowed.includes(variant as (typeof allowed)[number])) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `variant must be one of: ${allowed.join(', ')}` },
        });
        return;
      }

      try {
        const url = await service.getReportSasUrl(
          vendorOrderId!,
          tenantId,
          variant as 'main' | 'survey' | 'photos' | 'ordered'
        );
        res.status(200).json({ success: true, data: { url } });
      } catch (err) {
        handleError(res, err);
      }
    }
  );

  return router;
}
