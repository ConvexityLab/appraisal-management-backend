/**
 * Product Controller — G8/G9
 *
 * REST endpoints for Product / Fee configuration management.
 *
 * Routes:
 *   GET    /              → listProducts
 *   POST   /              → createProduct
 *   GET    /:productId    → getProduct
 *   PUT    /:productId    → updateProduct
 *   DELETE /:productId    → deleteProduct  (soft — sets status=INACTIVE)
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { CreateProductRequest, UpdateProductRequest } from '../types/index.js';

const logger = new Logger('ProductController');

export class ProductController {
  public router: Router;

  constructor(private dbService: CosmosDbService) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.listProducts.bind(this));

    this.router.post(
      '/',
      [
        body('name').notEmpty().withMessage('name is required'),
        body('productType').notEmpty().withMessage('productType is required'),
        body('defaultFee').isFloat({ min: 0 }).withMessage('defaultFee must be a non-negative number'),
        body('turnTimeDays').isInt({ min: 1 }).withMessage('turnTimeDays must be a positive integer'),
        body('rushFeeMultiplier').optional().isFloat({ min: 1 }).withMessage('rushFeeMultiplier must be >= 1'),
      ],
      this.createProduct.bind(this)
    );

    this.router.get('/:productId', [param('productId').notEmpty()], this.getProduct.bind(this));

    this.router.put(
      '/:productId',
      [
        param('productId').notEmpty(),
        body('defaultFee').optional().isFloat({ min: 0 }),
        body('rushFeeMultiplier').optional().isFloat({ min: 1 }),
        body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
      ],
      this.updateProduct.bind(this)
    );

    this.router.delete('/:productId', [param('productId').notEmpty()], this.deleteProduct.bind(this));
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  public async listProducts(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.dbService.findProducts(tenantId);
      if (!result.success) {
        res.status(500).json({ error: 'Failed to retrieve products', details: result.error });
        return;
      }
      res.json({ products: result.data, count: result.data?.length ?? 0 });
    } catch (error) {
      logger.error('listProducts failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async createProduct(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = this.resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const body = req.body as CreateProductRequest;
      const result = await this.dbService.createProduct({ ...body, tenantId, createdBy });
      if (!result.success) {
        res.status(500).json({ error: 'Failed to create product', details: result.error });
        return;
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error('createProduct failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getProduct(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: 'Validation failed', details: errors.array() }); return; }
    try {
      const tenantId = this.resolveTenantId(req);
      const { productId } = req.params as { productId: string };
      const result = await this.dbService.findProductById(productId, tenantId);
      if (!result.success) { res.status(500).json({ error: 'Failed to retrieve product' }); return; }
      if (!result.data) { res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Product ${productId} not found` }); return; }
      res.json(result.data);
    } catch (error) {
      logger.error('getProduct failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateProduct(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: 'Validation failed', details: errors.array() }); return; }
    try {
      const tenantId = this.resolveTenantId(req);
      const { productId } = req.params as { productId: string };
      const updates = req.body as UpdateProductRequest;
      if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No fields to update provided' }); return; }
      const result = await this.dbService.updateProduct(productId, tenantId, updates);
      if (!result.success) {
        const isNotFound = (result.error as any)?.code === 'PRODUCT_NOT_FOUND';
        res.status(isNotFound ? 404 : 500).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (error) {
      logger.error('updateProduct failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async deleteProduct(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: 'Validation failed', details: errors.array() }); return; }
    try {
      const tenantId = this.resolveTenantId(req);
      const { productId } = req.params as { productId: string };
      const result = await this.dbService.deleteProduct(productId, tenantId);
      if (!result.success) {
        const isNotFound = (result.error as any)?.code === 'PRODUCT_NOT_FOUND';
        res.status(isNotFound ? 404 : 500).json({ error: result.error });
        return;
      }
      res.status(204).send();
    } catch (error) {
      logger.error('deleteProduct failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tid = req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);
    if (!tid) {
      throw new Error('tenant ID is required but was not found in the auth token or x-tenant-id header');
    }
    return tid;
  }
}
