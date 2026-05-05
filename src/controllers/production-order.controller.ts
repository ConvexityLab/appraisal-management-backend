/**
 * Production Order Management Controller
 * Streamlined controller using the proven CosmosDbService for order CRUD operations
 */

import { Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { 
  AppraisalOrder, 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType 
} from '../types/index.js';

export class ProductionOrderController {
  private dbService: CosmosDbService;
  private logger: Logger;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger();
  }

  /**
   * POST /api/orders - Create a new appraisal order
   */
  createOrder = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      // Slice 8g: engagement-primacy guard. Every order must be parented by
      // an Engagement; reject orphan creates with 400.
      const requestEngagementId = typeof req.body?.engagementId === 'string'
        ? req.body.engagementId.trim()
        : undefined;
      if (!requestEngagementId) {
        res.status(400).json({
          success: false,
          error: 'engagementId is required when creating an order. Place an Engagement first.',
        });
        return;
      }

      const orderData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: req.body.status || OrderStatus.NEW,
        priority: req.body.priority || Priority.NORMAL
      };

      this.logger.info('Creating new order', { orderData: { id: orderData.id, clientId: orderData.clientId } });

      const result = await this.dbService.createOrder(orderData);

      if (result.success && result.data) {
        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Order created successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Order creation failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to create order', { error });
      res.status(500).json({
        success: false,
        error: 'Order creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/orders/:id - Get order by ID
   */
  getOrder = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
        return;
      }

      this.logger.info('Retrieving order', { orderId: id });

      const result = await this.dbService.findOrderById(id);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data
        });
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to retrieve order'
        });
      }
    } catch (error) {
      this.logger.error('Failed to retrieve order', { error, orderId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve order',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * PUT /api/orders/:id - Update order
   */
  updateOrder = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
        return;
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };

      this.logger.info('Updating order', { orderId: id, updates: Object.keys(updateData) });

      const result = await this.dbService.updateOrder(id, updateData);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data,
          message: 'Order updated successfully'
        });
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Order update failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to update order', { error, orderId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Order update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * DELETE /api/orders/:id - Delete order
   */
  deleteOrder = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      // Prefer auth-context tenantId (partition key); fall back to query param for
      // admin scenarios where the caller explicitly specifies a tenant.
      const tenantId = req.user?.tenantId ?? (req.query['tenantId'] as string | undefined);

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
        return;
      }

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: 'tenantId could not be resolved: ensure the request is authenticated or pass ?tenantId='
        });
        return;
      }

      this.logger.info('Deleting order', { orderId: id, tenantId });

      const result = await this.dbService.deleteOrder(id, tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Order deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Order deletion failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to delete order', { error, orderId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Order deletion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/orders - List orders with optional filters
   */
  getOrders = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { status, priority, clientId, offset = 0, limit = 50 } = req.query;

      const filters: any = {};
      if (status) filters.status = Array.isArray(status) ? status : [status];
      if (priority) filters.priority = priority;
      if (clientId) filters.clientId = clientId;

      // Scope query to the authenticated user's tenant (partition-key filter).
      if (req.user?.tenantId) {
        filters.tenantId = req.user.tenantId;
      }

      this.logger.info('Listing orders', { filters, offset, limit });

      const result = await this.dbService.findOrders(filters, Number(offset), Number(limit));

      if (result.success) {
        res.json({
          success: true,
          data: result.data || [],
          metadata: {
            total: result.data?.length || 0,
            offset: Number(offset),
            limit: Number(limit)
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to retrieve orders'
        });
      }
    } catch (error) {
      this.logger.error('Failed to list orders', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve orders',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}