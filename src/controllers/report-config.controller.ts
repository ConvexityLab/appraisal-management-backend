/**
 * Report Config Controller — R-8
 *
 * Routes (all under /api/report-config):
 *   GET  /:orderId                  Return the effective EffectiveReportConfig for an order
 *   POST /:orderId/invalidate-cache Admin: evict the in-process cache for this order
 *
 * The merger service resolves the 5-tier hierarchy
 * (base → client → subClient → product → version) and caches results
 * for 5 minutes keyed on productId + clientId + subClientId + schemaVersion.
 */

import express, { type Request, type Response } from 'express';
import { param, validationResult } from 'express-validator';
import type { SqlQuerySpec } from '@azure/cosmos';

import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ReportConfigMergerService } from '../services/report-config-merger.service.js';
import { VENDOR_ORDER_TYPE_PREDICATE, type VendorOrder } from '../types/vendor-order.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ReportConfigController');

const validateOrderId = [
  param('orderId').isString().notEmpty().withMessage('orderId must be a non-empty string'),
];

export function createReportConfigRouter(dbService: CosmosDbService): express.Router {
  const router = express.Router();
  const mergerService = new ReportConfigMergerService(dbService);

  // ── Load an Order by id ────────────────────────────────────────────────────

  async function loadOrder(orderId: string): Promise<VendorOrder> {
    const ordersContainer = dbService.getContainer('orders');
    const querySpec: SqlQuerySpec = {
      query: `SELECT * FROM c WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.id = @id`,
      parameters: [{ name: '@id', value: orderId }],
    };
    const { resources } = await ordersContainer.items.query<VendorOrder>(querySpec).fetchAll();
    if (!resources || resources.length === 0) {
      throw Object.assign(new Error(`Order not found: ${orderId}`), { status: 404 });
    }
    return resources[0] as VendorOrder;
  }

  // ── GET /:orderId — Return effective config ────────────────────────────────

  router.get(
    '/:orderId',
    ...validateOrderId,
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const orderId = req.params['orderId'] as string;

      try {
        const order = await loadOrder(orderId);
        const config = await mergerService.getEffectiveConfig(order);
        return res.status(200).json(config);
      } catch (error) {
        const err = error as Error & { status?: number };
        if (err.status === 404) {
          return res.status(404).json({ success: false, error: err.message });
        }
        logger.error('Error resolving effective report config', { orderId, error });
        return res.status(500).json({ success: false, error: 'Failed to resolve report configuration.' });
      }
    },
  );

  // ── POST /:orderId/invalidate-cache — Admin cache eviction ────────────────

  router.post(
    '/:orderId/invalidate-cache',
    ...validateOrderId,
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const orderId = req.params['orderId'] as string;

      try {
        const order = await loadOrder(orderId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = order as any;
        const productId    = String(o.productType ?? o.orderType ?? '');
        const clientId     = String(o.clientId ?? '');
        const subClientId  = o.subClientId  ? String(o.subClientId)  : undefined;
        const schemaVersion = o.schemaVersion ? String(o.schemaVersion) : undefined;
        if (schemaVersion !== undefined) {
          mergerService.invalidateCache(productId, clientId, subClientId, schemaVersion);
        } else {
          mergerService.invalidateCache(productId, clientId, subClientId);
        }
        logger.info('Report config cache invalidated via API', { orderId });
        return res.status(204).send();
      } catch (error) {
        const err = error as Error & { status?: number };
        if (err.status === 404) {
          return res.status(404).json({ success: false, error: err.message });
        }
        logger.error('Error invalidating report config cache', { orderId, error });
        return res.status(500).json({ success: false, error: 'Failed to invalidate cache.' });
      }
    },
  );

  return router;
}
