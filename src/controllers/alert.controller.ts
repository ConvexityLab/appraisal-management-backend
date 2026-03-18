/**
 * Alert System controller (Phase 4.2)
 *
 * Routes (mounted at /api/alerts):
 *   POST /                 — create alert
 *   GET  /                 — list user's alerts
 *   PUT  /:id              — update alert
 *   DELETE /:id            — delete alert
 *   PATCH /:id/toggle      — toggle isActive
 *   POST /:id/test         — fire a test notification via WebPubSub
 *
 * Alert evaluation is performed by the market data ingest job (not implemented here).
 * This controller manages alert CRUD and test-fire only.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { WebPubSubService } from '../services/web-pubsub.service.js';
import { EventPriority, EventCategory } from '../types/events.js';
import type { Alert, CreateAlertRequest } from '../types/market.types.js';

const CONTAINER = 'properties';

export function createAlertRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();
  const webPubSub = (() => {
    try { return new WebPubSubService(); } catch { return null; }
  })();

  // ─── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as CreateAlertRequest;
    if (!body.name) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } }); return; }
    if (!body.triggerType) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'triggerType is required' } }); return; }
    if (!body.channels?.length) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'at least one channel is required' } }); return; }

    const validTriggers = ['new_listing', 'price_reduction', 'new_sold', 'investor_activity', 'market_trend'];
    if (!validTriggers.includes(body.triggerType)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `triggerType must be one of: ${validTriggers.join(', ')}` } }); return;
    }

    const now = new Date().toISOString();
    const alert: Alert = {
      id: uuidv4(),
      tenantId,
      userId,
      type: 'market-alert',
      name: body.name as string,
      triggerType: body.triggerType,
      criteria: body.criteria ?? {},
      channels: body.channels,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...(body.webhookUrl !== undefined ? { webhookUrl: body.webhookUrl } : {}),
    };

    try {
      const container = db.getContainer(CONTAINER);
      await container.items.create(alert);
      res.status(201).json({ success: true, data: alert });
    } catch (error) {
      logger.error('Failed to create alert', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create alert' } });
    }
  });

  // ─── GET / ─────────────────────────────────────────────────────────────────
  router.get('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<Alert>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.userId = @userId ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: 'market-alert' },
          { name: '@tenantId', value: tenantId },
          { name: '@userId', value: userId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to list alerts', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve alerts' } });
    }
  });

  // ─── PUT /:id ──────────────────────────────────────────────────────────────
  router.put('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<Alert>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id AND c.userId = @userId',
        parameters: [
          { name: '@type', value: 'market-alert' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
          { name: '@userId', value: userId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Alert ${id} not found` } }); return; }

      const body = req.body as Partial<Alert>;
      const updated: Alert = {
        ...resources[0],
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.criteria !== undefined ? { criteria: body.criteria } : {}),
        ...(body.channels !== undefined ? { channels: body.channels } : {}),
        ...(body.webhookUrl !== undefined ? { webhookUrl: body.webhookUrl } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update alert', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert' } });
    }
  });

  // ─── DELETE /:id ───────────────────────────────────────────────────────────
  router.delete('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      await db.deleteDocument(CONTAINER, id, tenantId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete alert', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert' } });
    }
  });

  // ─── PATCH /:id/toggle ─────────────────────────────────────────────────────
  router.patch('/:id/toggle', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<Alert>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id AND c.userId = @userId',
        parameters: [
          { name: '@type', value: 'market-alert' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
          { name: '@userId', value: userId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Alert ${id} not found` } }); return; }

      const updated: Alert = {
        ...resources[0],
        isActive: !resources[0].isActive,
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to toggle alert', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle alert' } });
    }
  });

  // ─── POST /:id/test ────────────────────────────────────────────────────────
  router.post('/:id/test', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<Alert>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id AND c.userId = @userId',
        parameters: [
          { name: '@type', value: 'market-alert' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
          { name: '@userId', value: userId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Alert ${id} not found` } }); return; }

      const alert = resources[0];

      if (webPubSub) {
        await webPubSub.sendToGroup(`tenant:${tenantId}`, {
          id: uuidv4(),
          title: `[TEST] Alert: ${alert.name}`,
          message: `This is a test notification for alert "${alert.name}" (${alert.triggerType})`,
          priority: EventPriority.NORMAL,
          category: EventCategory.ORDER,  // closest matching category for market alerts
          targets: [],
          data: { alertId: alert.id, triggerType: alert.triggerType, testFire: true },
        });
      }

      res.json({ success: true, message: 'Test notification sent', alertId: id });
    } catch (error) {
      logger.error('Failed to test alert', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fire test notification' } });
    }
  });

  return router;
}
