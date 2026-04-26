/**
 * VendorOrderController — read-only REST surface for VendorOrders.
 *
 * Routes (mounted at /api/vendor-orders by api-server.ts):
 *
 *   GET /                          → listVendorOrders
 *                                    query: clientOrderId (REQUIRED)
 *                                    returns: { vendorOrders: VendorOrder[] }
 *
 *   GET /:vendorOrderId            → getVendorOrder
 *
 * Writes go through ClientOrderController (POST /api/client-orders/:id/vendor-orders)
 * or — for legacy callers — OrderController (POST /api/orders). This
 * controller exists so the new ClientOrder-shaped frontend can fetch
 * children of a parent ClientOrder without going through the legacy
 * `/api/orders/:id` endpoint, which has different semantics.
 *
 * Backward-compatibility: the discriminator in Cosmos is currently
 * `'order'` (LEGACY_VENDOR_ORDER_DOC_TYPE). Phase 4 flips it to
 * `'vendor-order'` (VENDOR_ORDER_DOC_TYPE). Read queries here accept BOTH
 * so they keep working on either side of the migration.
 *
 * authn (req.user) is enforced by the unifiedAuth middleware applied at the
 * mount site in api-server.ts. tenantId is taken from req.user.
 */

import { Router, Response } from 'express';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  VENDOR_ORDERS_CONTAINER,
  VENDOR_ORDER_DOC_TYPE,
  LEGACY_VENDOR_ORDER_DOC_TYPE,
  type VendorOrder,
} from '../types/vendor-order.types.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('VendorOrderController');

/**
 * SQL fragment that matches both the legacy and target discriminator
 * values. Phase 4 simplifies this to `c.type = @t` once the migration
 * is complete.
 */
const TYPE_PREDICATE =
  `(c.type = '${VENDOR_ORDER_DOC_TYPE}' OR c.type = '${LEGACY_VENDOR_ORDER_DOC_TYPE}')`;

export class VendorOrderController {
  public router: Router;

  constructor(private readonly dbService: CosmosDbService) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.listVendorOrders.bind(this));
    this.router.get('/:vendorOrderId', this.getVendorOrder.bind(this));
  }

  // ─── GET / ───────────────────────────────────────────────────────────────

  public async listVendorOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const clientOrderId =
      typeof req.query.clientOrderId === 'string' ? req.query.clientOrderId : '';
    if (!clientOrderId) {
      res.status(400).json({
        error: '`clientOrderId` query parameter is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    try {
      const container = this.dbService.getContainer(VENDOR_ORDERS_CONTAINER);
      const { resources } = await container.items
        .query<VendorOrder>({
          query:
            `SELECT * FROM c WHERE ${TYPE_PREDICATE} ` +
            'AND c.tenantId = @tenantId AND c.clientOrderId = @clientOrderId',
          parameters: [
            { name: '@tenantId', value: req.user.tenantId },
            { name: '@clientOrderId', value: clientOrderId },
          ],
        })
        .fetchAll();
      res.json({ vendorOrders: resources });
    } catch (err) {
      logger.error('listVendorOrders failed', { error: err, clientOrderId });
      res.status(500).json({
        error: 'Failed to list vendor orders',
        code: 'VENDOR_ORDER_LIST_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── GET /:vendorOrderId ─────────────────────────────────────────────────

  public async getVendorOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const { vendorOrderId } = req.params;
    if (!vendorOrderId) {
      res.status(400).json({ error: 'vendorOrderId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const container = this.dbService.getContainer(VENDOR_ORDERS_CONTAINER);
      const { resource } = await container
        .item(vendorOrderId, req.user.tenantId)
        .read<VendorOrder>();
      if (
        !resource ||
        (resource.type !== VENDOR_ORDER_DOC_TYPE &&
          resource.type !== LEGACY_VENDOR_ORDER_DOC_TYPE)
      ) {
        res.status(404).json({ error: 'VendorOrder not found', code: 'NOT_FOUND' });
        return;
      }
      res.json(resource);
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 404) {
        res.status(404).json({ error: 'VendorOrder not found', code: 'NOT_FOUND' });
        return;
      }
      logger.error('getVendorOrder failed', { error: err, vendorOrderId });
      res.status(500).json({
        error: 'Failed to load VendorOrder',
        code: 'VENDOR_ORDER_READ_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
