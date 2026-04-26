/**
 * ClientOrderController — REST surface for the new ClientOrder concept.
 *
 * Routes (mounted at /api/client-orders by api-server.ts):
 *
 *   POST   /                                  → placeClientOrder
 *                                               body: PlaceClientOrderInput fields
 *                                                     + optional `vendorOrders: VendorOrderSpec[]`
 *
 *   GET    /suggestions                       → suggestVendorOrders
 *                                               query: clientId, productType
 *                                               returns: VendorOrderTemplate[] (may be [])
 *
 *   GET    /:clientOrderId                    → getClientOrder
 *
 *   POST   /:clientOrderId/vendor-orders      → addVendorOrders
 *                                               body: { vendorOrders, inheritedFields? }
 *
 * NOTE: This controller is purely additive. The legacy POST /api/orders
 * endpoint (OrderController.createOrder) is unchanged in this PR. Frontends
 * opt into the new shape by switching to /api/client-orders.
 *
 * Authn (req.user) is enforced by the unifiedAuth middleware applied at the
 * mount site in api-server.ts. tenantId and createdBy are taken from
 * req.user — never trusted from the request body.
 */

import { Router, Response } from 'express';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  ClientOrderService,
  InvalidClientOrderInputError,
  ClientOrderNotFoundError,
  ClientOrderConcurrencyError,
  type PlaceClientOrderInput,
  type VendorOrderSpec,
} from '../services/client-order.service.js';
import { OrderDecompositionService } from '../services/order-decomposition.service.js';
import {
  CLIENT_ORDERS_CONTAINER,
  CLIENT_ORDER_DOC_TYPE,
  type ClientOrder,
} from '../types/client-order.types.js';
import type { ProductType } from '../types/product-catalog.js';
import type { AppraisalOrder } from '../types/index.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ClientOrderController');

export class ClientOrderController {
  public router: Router;
  private readonly service: ClientOrderService;
  private readonly decomposer: OrderDecompositionService;

  constructor(private readonly dbService: CosmosDbService) {
    this.router = Router();
    this.service = new ClientOrderService(dbService);
    this.decomposer = new OrderDecompositionService(dbService);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Specific routes first, parameterized last.
    this.router.get('/suggestions', this.getSuggestions.bind(this));
    this.router.post('/', this.placeClientOrder.bind(this));
    this.router.get('/:clientOrderId', this.getClientOrder.bind(this));
    this.router.post('/:clientOrderId/vendor-orders', this.addVendorOrders.bind(this));
  }

  // ─── POST / ──────────────────────────────────────────────────────────────

  public async placeClientOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }

    const { vendorOrders, ...rest } = (req.body ?? {}) as Record<string, unknown> & {
      vendorOrders?: unknown;
    };

    // tenantId and createdBy are always sourced from the authenticated user,
    // never from the body. Anything else on the body is forwarded to the
    // service, which validates required-field presence and rejects
    // unknowns implicitly via the typed PlaceClientOrderInput shape.
    const input: PlaceClientOrderInput = {
      ...(rest as Partial<PlaceClientOrderInput>),
      tenantId: req.user.tenantId,
      createdBy: req.user.id,
    } as PlaceClientOrderInput;

    let specs: VendorOrderSpec[] | undefined;
    if (vendorOrders !== undefined) {
      if (!Array.isArray(vendorOrders)) {
        res.status(400).json({
          error: '`vendorOrders` must be an array of VendorOrderSpec',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      specs = vendorOrders as VendorOrderSpec[];
    }

    try {
      const result = await this.service.placeClientOrder(input, specs);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof InvalidClientOrderInputError) {
        res.status(400).json({
          error: err.message,
          code: 'INVALID_CLIENT_ORDER_INPUT',
          missing: err.missing,
        });
        return;
      }
      logger.error('placeClientOrder failed', { error: err });
      res.status(500).json({
        error: 'ClientOrder placement failed',
        code: 'CLIENT_ORDER_PLACEMENT_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── GET /suggestions ────────────────────────────────────────────────────

  public async getSuggestions(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }

    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';
    const productTypeRaw = typeof req.query.productType === 'string' ? req.query.productType : '';
    if (!clientId || !productTypeRaw) {
      res.status(400).json({
        error: '`clientId` and `productType` query parameters are required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    try {
      const productType = productTypeRaw as ProductType;
      const rule = await this.decomposer.findRule(req.user.tenantId, clientId, productType);
      const vendorOrders = await this.decomposer.suggestVendorOrders(
        req.user.tenantId,
        clientId,
        productType,
      );
      // Surface autoApply so the client knows whether it could place
      // without prompting (Phase 1 always prompts; this is informational).
      res.json({
        vendorOrders,
        autoApply: rule?.autoApply === true,
        ruleId: rule?.id ?? null,
      });
    } catch (err) {
      logger.error('getSuggestions failed', { error: err });
      res.status(500).json({
        error: 'Failed to load decomposition suggestions',
        code: 'SUGGESTIONS_LOOKUP_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── GET /:clientOrderId ─────────────────────────────────────────────────

  public async getClientOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const { clientOrderId } = req.params;
    if (!clientOrderId) {
      res.status(400).json({ error: 'clientOrderId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const container = this.dbService.getContainer(CLIENT_ORDERS_CONTAINER);
      const { resource } = await container
        .item(clientOrderId, req.user.tenantId)
        .read<ClientOrder>();
      if (!resource || resource.type !== CLIENT_ORDER_DOC_TYPE) {
        res.status(404).json({ error: 'ClientOrder not found', code: 'NOT_FOUND' });
        return;
      }
      res.json(resource);
    } catch (err) {
      // Cosmos throws on missing item with code 404.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 404) {
        res.status(404).json({ error: 'ClientOrder not found', code: 'NOT_FOUND' });
        return;
      }
      logger.error('getClientOrder failed', { error: err, clientOrderId });
      res.status(500).json({
        error: 'Failed to load ClientOrder',
        code: 'CLIENT_ORDER_READ_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:clientOrderId/vendor-orders ──────────────────────────────────

  public async addVendorOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const { clientOrderId } = req.params;
    if (!clientOrderId) {
      res.status(400).json({ error: 'clientOrderId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const body = (req.body ?? {}) as {
      vendorOrders?: unknown;
      inheritedFields?: unknown;
    };

    if (!Array.isArray(body.vendorOrders)) {
      res.status(400).json({
        error: '`vendorOrders` must be an array of VendorOrderSpec',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const specs = body.vendorOrders as VendorOrderSpec[];

    let inherited: Partial<AppraisalOrder> = {};
    if (body.inheritedFields !== undefined) {
      if (typeof body.inheritedFields !== 'object' || body.inheritedFields === null) {
        res.status(400).json({
          error: '`inheritedFields` must be an object when provided',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      inherited = body.inheritedFields as Partial<AppraisalOrder>;
    }

    try {
      const created = await this.service.addVendorOrders(
        clientOrderId,
        req.user.tenantId,
        specs,
        inherited,
      );
      res.status(201).json({ vendorOrders: created });
    } catch (err) {
      if (err instanceof ClientOrderNotFoundError) {
        res.status(404).json({ error: err.message, code: 'CLIENT_ORDER_NOT_FOUND' });
        return;
      }
      if (err instanceof ClientOrderConcurrencyError) {
        // 409 Conflict — children were created but the parent link-back patch
        // lost the optimistic-concurrency race. Caller may retry or reconcile.
        res.status(409).json({
          error: err.message,
          code: 'CLIENT_ORDER_CONCURRENCY_CONFLICT',
          createdVendorOrderIds: err.createdVendorOrderIds,
        });
        return;
      }
      logger.error('addVendorOrders failed', { error: err, clientOrderId });
      res.status(500).json({
        error: 'Failed to add vendor orders',
        code: 'ADD_VENDOR_ORDERS_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
}
