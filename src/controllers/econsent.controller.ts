/**
 * E-Consent Controller
 *
 * Tracks RESPA/ECOA electronic-consent status per order/borrower.
 *
 * Routes (mounted at /api/consent):
 *   POST  /orders/:orderId/consent            - Record borrower consent (given or denied)
 *   POST  /orders/:orderId/consent/withdraw   - Borrower withdraws previously given consent
 *   GET   /orders/:orderId/consent            - Get current consent record for this order
 *   GET   /orders/:orderId/delivery-receipts  - List delivery receipts for this order
 *   POST  /orders/:orderId/delivery-receipts  - Record a new delivery (internal)
 *   POST  /orders/:orderId/delivery-receipts/:receiptId/opened - Mark receipt as opened
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { WebPubSubService } from '../services/web-pubsub.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import {
  EConsentRecord,
  DeliveryReceipt,
  RecordConsentRequest,
  RecordDeliveryReceiptRequest,
} from '../types/econsent.types.js';

// Store alongside orders — same partition key (/tenantId)
const CONTAINER = 'orders';

export class EConsentController {
  private readonly db: CosmosDbService;
  private readonly logger: Logger;
  private readonly webPubSub: WebPubSubService | null = null;

  constructor(db: CosmosDbService) {
    this.db = db;
    this.logger = new Logger('EConsentController');
    try {
      this.webPubSub = new WebPubSubService();
    } catch {
      this.logger.warn('WebPubSub unavailable — consent notifications disabled');
    }
  }

  /**
   * Best-effort consent/delivery lifecycle broadcast.
   */
  private async broadcastConsentEvent(
    tenantId: string,
    eventType: string,
    title: string,
    message: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.webPubSub) return;
    try {
      await this.webPubSub.sendToGroup(`tenant:${tenantId}`, {
        id: `consent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        message,
        priority: EventPriority.NORMAL,
        category: EventCategory.CONSENT,
        targets: [],
        data: { eventType, tenantId, ...data },
      });
    } catch (err) {
      this.logger.warn('WebPubSub consent broadcast failed', { eventType, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/consent/orders/:orderId/consent
  // ─────────────────────────────────────────────────────────────────────────
  getConsent = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;
    try {
      const record = await this.findConsent(orderId, tenantId);
      if (!record) {
        res.json({ success: true, data: null });
        return;
      }
      res.json({ success: true, data: record });
    } catch (error) {
      this.logger.error('Failed to get consent record', { error, orderId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve consent record' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/consent/orders/:orderId/consent
  //
  // Body: RecordConsentRequest (minus orderId — comes from params)
  // ─────────────────────────────────────────────────────────────────────────
  recordConsent = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;
    const body = req.body as Partial<RecordConsentRequest>;

    if (!body.borrowerEmail) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'borrowerEmail is required' } });
      return;
    }
    if (!body.consentStatus || !['given', 'denied'].includes(body.consentStatus)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'consentStatus must be "given" or "denied"' } });
      return;
    }
    if (!body.disclosureVersion) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'disclosureVersion is required' } });
      return;
    }

    try {
      const now = new Date().toISOString();
      const existing = await this.findConsent(orderId, tenantId);

      if (existing) {
        // Update in place rather than creating a duplicate.
        const updated: EConsentRecord = {
          ...existing,
          consentStatus: body.consentStatus as EConsentRecord['consentStatus'],
          disclosureVersion: body.disclosureVersion as string,
          ...(body.consentStatus === 'given' ? { consentGivenAt: now } : {}),
          ...(body.consentMethod !== undefined ? { consentMethod: body.consentMethod } : {}),
          ...(body.ipAddress !== undefined ? { ipAddress: body.ipAddress } : {}),
          updatedAt: now,
        };
        await this.db.upsertDocument(CONTAINER, updated);
        this.logger.info('Consent record updated', { id: updated.id, orderId, status: body.consentStatus, tenantId });
        res.json({ success: true, data: updated });
        return;
      }

      const record: EConsentRecord = {
        id: uuidv4(),
        tenantId,
        orderId,
        borrowerEmail: body.borrowerEmail as string,
        consentStatus: body.consentStatus as EConsentRecord['consentStatus'],
        ...(body.consentStatus === 'given' ? { consentGivenAt: now } : {}),
        ...(body.consentMethod !== undefined ? { consentMethod: body.consentMethod } : {}),
        disclosureVersion: body.disclosureVersion as string,
        ...(body.ipAddress !== undefined ? { ipAddress: body.ipAddress } : {}),
        createdAt: now,
        updatedAt: now,
        type: 'econsent',
      };

      await this.db.createDocument(CONTAINER, record);
      this.logger.info('Consent record created', { id: record.id, orderId, status: body.consentStatus, tenantId });
      await this.broadcastConsentEvent(tenantId, `consent.${body.consentStatus as string}`, body.consentStatus === 'given' ? 'E-Consent Given' : 'E-Consent Denied', `Borrower ${body.borrowerEmail as string} ${body.consentStatus as string} consent for order ${orderId}`, { orderId, borrowerEmail: body.borrowerEmail, consentStatus: body.consentStatus });
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      this.logger.error('Failed to record consent', { error, orderId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record consent' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/consent/orders/:orderId/consent/withdraw
  // ─────────────────────────────────────────────────────────────────────────
  withdrawConsent = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;

    try {
      const existing = await this.findConsent(orderId, tenantId);
      if (!existing) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No consent record found for order ${orderId}` } });
        return;
      }
      if (existing.consentStatus !== 'given') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Cannot withdraw consent: current status is "${existing.consentStatus}". Only "given" consent can be withdrawn.`,
          },
        });
        return;
      }

      const updated: EConsentRecord = {
        ...existing,
        consentStatus: 'withdrawn',
        updatedAt: new Date().toISOString(),
      };
      await this.db.upsertDocument(CONTAINER, updated);
      this.logger.info('Consent withdrawn', { id: updated.id, orderId, tenantId });
      await this.broadcastConsentEvent(tenantId, 'consent.withdrawn', 'E-Consent Withdrawn', `Borrower withdrew consent for order ${orderId}`, { orderId });
      res.json({ success: true, data: updated });
    } catch (error) {
      this.logger.error('Failed to withdraw consent', { error, orderId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to withdraw consent' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/consent/orders/:orderId/delivery-receipts
  // ─────────────────────────────────────────────────────────────────────────
  listDeliveryReceipts = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;

    try {
      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<DeliveryReceipt>({
        query: `SELECT * FROM c
                WHERE c.tenantId = @tid
                  AND c.orderId = @oid
                  AND c.type = 'delivery-receipt'
                ORDER BY c.deliveredAt DESC`,
        parameters: [
          { name: '@tid', value: tenantId },
          { name: '@oid', value: orderId },
        ],
      }).fetchAll();
      res.json({ success: true, data: resources, total: resources.length });
    } catch (error) {
      this.logger.error('Failed to list delivery receipts', { error, orderId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve delivery receipts' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/consent/orders/:orderId/delivery-receipts
  //
  // Internal endpoint — called by the delivery service after sending.
  // ─────────────────────────────────────────────────────────────────────────
  recordDeliveryReceipt = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const deliveredBy = req.user?.id ?? 'system';
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;
    const body = req.body as Partial<RecordDeliveryReceiptRequest>;

    if (!body.packageId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'packageId is required' } });
      return;
    }
    if (!body.deliveredTo) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'deliveredTo is required' } });
      return;
    }
    if (!body.channel) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'channel is required' } });
      return;
    }
    if (!body.reportVersionId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reportVersionId is required' } });
      return;
    }

    try {
      const now = new Date().toISOString();
      const receipt: DeliveryReceipt = {
        id: uuidv4(),
        orderId,
        tenantId,
        packageId: body.packageId as string,
        deliveredAt: now,
        deliveredTo: body.deliveredTo as string,
        deliveredBy,
        channel: body.channel as DeliveryReceipt['channel'],
        reportVersionId: body.reportVersionId as string,
        ...(body.ipAddress !== undefined ? { ipAddress: body.ipAddress } : {}),
        ...(body.userAgent !== undefined ? { userAgent: body.userAgent } : {}),
        type: 'delivery-receipt',
      };

      await this.db.createDocument(CONTAINER, receipt);
      this.logger.info('Delivery receipt recorded', { id: receipt.id, orderId, deliveredTo: body.deliveredTo, tenantId });
      await this.broadcastConsentEvent(tenantId, 'delivery.confirmed', 'Report Delivered', `Appraisal report for order ${orderId} delivered to ${body.deliveredTo as string} via ${body.channel as string}`, { orderId, deliveredTo: body.deliveredTo, channel: body.channel });
      res.status(201).json({ success: true, data: receipt });
    } catch (error) {
      this.logger.error('Failed to record delivery receipt', { error, orderId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record delivery receipt' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/consent/orders/:orderId/delivery-receipts/:receiptId/opened
  //
  // Called when a client opens/downloads the delivered package.
  // ─────────────────────────────────────────────────────────────────────────
  markOpened = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const orderId = req.params['orderId'] as string;
    const receiptId = req.params['receiptId'] as string;
    const { action } = req.body as { action?: 'opened' | 'downloaded' };

    if (!action || !['opened', 'downloaded'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'action must be "opened" or "downloaded"' } });
      return;
    }

    try {
      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<DeliveryReceipt>({
        query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid AND c.orderId = @oid AND c.type = 'delivery-receipt'`,
        parameters: [
          { name: '@id', value: receiptId },
          { name: '@tid', value: tenantId },
          { name: '@oid', value: orderId },
        ],
      }).fetchAll();

      const receipt = resources[0];
      if (!receipt) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Delivery receipt not found: ${receiptId}` } });
        return;
      }

      const now = new Date().toISOString();
      const updated: DeliveryReceipt = {
        ...receipt,
        ...(action === 'opened' && !receipt.openedAt ? { openedAt: now } : {}),
        ...(action === 'downloaded' && !receipt.downloadedAt ? { downloadedAt: now } : {}),
      };

      await this.db.upsertDocument(CONTAINER, updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      this.logger.error('Failed to mark receipt as opened', { error, receiptId, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update delivery receipt' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async findConsent(orderId: string, tenantId: string): Promise<EConsentRecord | null> {
    const container = this.db.getContainer(CONTAINER);
    const { resources } = await container.items.query<EConsentRecord>({
      query: `SELECT * FROM c WHERE c.tenantId = @tid AND c.orderId = @oid AND c.type = 'econsent'`,
      parameters: [
        { name: '@tid', value: tenantId },
        { name: '@oid', value: orderId },
      ],
    }).fetchAll();
    return resources[0] ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router factory
// ─────────────────────────────────────────────────────────────────────────────
export function createEConsentRouter(db: CosmosDbService): Router {
  const router = Router();
  const ctrl = new EConsentController(db);

  router.get('/orders/:orderId/consent',                                      ctrl.getConsent);
  router.post('/orders/:orderId/consent',                                     ctrl.recordConsent);
  router.post('/orders/:orderId/consent/withdraw',                            ctrl.withdrawConsent);
  router.get('/orders/:orderId/delivery-receipts',                            ctrl.listDeliveryReceipts);
  router.post('/orders/:orderId/delivery-receipts',                           ctrl.recordDeliveryReceipt);
  router.post('/orders/:orderId/delivery-receipts/:receiptId/opened',         ctrl.markOpened);

  return router;
}
