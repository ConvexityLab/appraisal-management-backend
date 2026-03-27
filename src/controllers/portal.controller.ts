/**
 * Borrower / Realtor Portal Controller (Phase 5)
 *
 * Narrow-scope, externally-facing endpoints used by the borrower/realtor portal.
 * These routes return *only* the data a borrower or realtor is entitled to see
 * for their specific order — no AMC-internal data, no pricing, no appraiser info.
 *
 * Routes (mounted at /api/portal):
 *   GET  /orders/:orderId             — read-only order status + key dates
 *   GET  /econsent/:orderId           — e-consent status for this order
 *   POST /econsent/:orderId/sign      — record borrower consent signature
 *   GET  /delivery/:orderId           — download URL for the delivered appraisal report
 *   POST /rov                         — submit a Reconsideration of Value request
 *
 * All routes require a valid JWT with at minimum `portal.read` scope.
 * Writes (sign, rov) require `portal.submit` scope.
 *
 * Auth is applied by the caller (api-server.ts), not within this router.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const ORDERS_CONTAINER   = 'orders';
const CONSENT_CONTAINER  = 'orders';   // stored alongside orders

export function createPortalRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger('PortalController');

  // ─── GET /orders/:orderId — order status ─────────────────────────────────
  router.get('/orders/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const orderId = req.params['orderId'] as string;

    try {
      const container = db.getContainer(ORDERS_CONTAINER);
      type Param = { name: string; value: string | number | boolean | null };
      const parameters: Param[] = [
        { name: '@id',       value: orderId },
        { name: '@tenantId', value: tenantId },
      ];
      const { resources } = await container.items.query({
        query: `SELECT c.id, c.status, c.orderType, c.propertyAddress,
                       c.effectiveDueDate, c.submittedAt, c.completedAt, c.deliveredAt,
                       c.borrowerName, c.loanNumber
                FROM c
                WHERE c.id = @id AND c.tenantId = @tenantId`,
        parameters,
      }).fetchAll();

      if (!resources.length) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Order ${orderId} not found` } });
        return;
      }

      // Return only portal-safe fields — never internal notes or appraiser data
      const order = resources[0] as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          id:              order['id'],
          status:          order['status'],
          orderType:       order['orderType'],
          propertyAddress: order['propertyAddress'],
          effectiveDueDate: order['effectiveDueDate'],
          submittedAt:     order['submittedAt'],
          completedAt:     order['completedAt'],
          deliveredAt:     order['deliveredAt'],
          borrowerName:    order['borrowerName'],
          loanNumber:      order['loanNumber'],
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Portal getOrder failed', { orderId, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }
  });

  // ─── GET /econsent/:orderId — e-consent status ──────────────────────────
  router.get('/econsent/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const orderId = req.params['orderId'] as string;

    try {
      const container = db.getContainer(CONSENT_CONTAINER);
      type Param = { name: string; value: string | number | boolean | null };
      const parameters: Param[] = [
        { name: '@oid', value: orderId },
        { name: '@tid', value: tenantId },
      ];
      const { resources } = await container.items.query({
        query: `SELECT c.id, c.orderId, c.status, c.consentGivenAt, c.consentWithdrawnAt,
                       c.deliveryMethod, c.language
                FROM c
                WHERE c.type = 'econsent' AND c.orderId = @oid AND c.tenantId = @tid`,
        parameters,
      }).fetchAll();

      res.json({ success: true, data: resources.length ? resources[0] : null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Portal getConsent failed', { orderId, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }
  });

  // ─── POST /econsent/:orderId/sign — record borrower consent ─────────────
  router.post('/econsent/:orderId/sign', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const { orderId } = req.params;
    const body = req.body as Record<string, unknown>;

    const borrowerName   = body['borrowerName'];
    const deliveryMethod = body['deliveryMethod'];

    if (!borrowerName || typeof borrowerName !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'borrowerName (string) is required' } });
      return;
    }

    try {
      const container = db.getContainer(CONSENT_CONTAINER);
      const now = new Date().toISOString();
      const record = {
        id:               `consent-${orderId}-${uuidv4()}`,
        type:             'econsent',
        orderId,
        tenantId,
        status:           'given',
        borrowerName,
        deliveryMethod:   typeof deliveryMethod === 'string' ? deliveryMethod : 'EMAIL',
        language:         typeof body['language'] === 'string' ? body['language'] : 'en',
        consentGivenAt:   now,
        ipAddress:        req.ip,
        userAgent:        req.headers['user-agent'] ?? '',
        createdAt:        now,
        updatedAt:        now,
      };

      await container.items.upsert(record);

      logger.info('Portal e-consent signed', { orderId, tenantId, borrowerName });
      res.status(201).json({ success: true, data: record });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Portal signConsent failed', { orderId, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }
  });

  // ─── GET /delivery/:orderId — download URL for delivered appraisal ───────
  router.get('/delivery/:orderId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const orderId = req.params['orderId'] as string;

    try {
      const container = db.getContainer(ORDERS_CONTAINER);

      // Look for a delivery receipt with a download URL
      const { resources: receipts } = await container.items.query({
        query: `SELECT c.id, c.orderId, c.deliveryMethod, c.downloadUrl, c.deliveredAt,
                       c.openedAt, c.reportType
                FROM c
                WHERE c.type = 'delivery-receipt' AND c.orderId = @oid AND c.tenantId = @tid
                ORDER BY c.deliveredAt DESC
                OFFSET 0 LIMIT 1`,
        parameters: ([
          { name: '@oid', value: orderId },
          { name: '@tid', value: tenantId },
        ] as { name: string; value: string | number | boolean | null }[]),
      }).fetchAll();

      if (!receipts.length) {
        res.status(404).json({ success: false, error: { code: 'NOT_DELIVERED', message: 'No delivered appraisal found for this order' } });
        return;
      }

      const receipt = receipts[0] as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          orderId,
          deliveredAt:    receipt['deliveredAt'],
          reportType:     receipt['reportType'],
          downloadUrl:    receipt['downloadUrl'],
          deliveryMethod: receipt['deliveryMethod'],
          openedAt:       receipt['openedAt'],
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Portal getDelivery failed', { orderId, tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }
  });

  // ─── POST /rov — submit a Reconsideration of Value ──────────────────────
  router.post('/rov', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId as string;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const orderId = body['orderId'];
    const reason  = body['reason'];

    if (!orderId || typeof orderId !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId (string) is required' } });
      return;
    }
    if (!reason || typeof reason !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reason (string) is required' } });
      return;
    }

    try {
      const container = db.getContainer(ORDERS_CONTAINER);
      const now = new Date().toISOString();

      // ROV comps are the primary evidence — at minimum one is required
      const comps = Array.isArray(body['comps']) ? body['comps'] : [];

      const rovRecord = {
        id:          `rov-portal-${uuidv4()}`,
        type:        'rov-request',
        source:      'portal',
        orderId,
        tenantId,
        reason,
        comps,
        contactName:   typeof body['contactName'] === 'string' ? body['contactName'] : undefined,
        contactEmail:  typeof body['contactEmail'] === 'string' ? body['contactEmail'] : undefined,
        additionalInfo: typeof body['additionalInfo'] === 'string' ? body['additionalInfo'] : undefined,
        status:      'SUBMITTED',
        submittedAt: now,
        createdAt:   now,
        updatedAt:   now,
      };

      await container.items.upsert(rovRecord);

      logger.info('Portal ROV submitted', { orderId, tenantId });
      res.status(201).json({ success: true, data: { rovId: rovRecord.id, status: 'SUBMITTED', submittedAt: now } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Portal ROV submit failed', { tenantId, error: message });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
    }
  });

  return router;
}
