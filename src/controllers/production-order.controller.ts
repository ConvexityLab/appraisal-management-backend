/**
 * Production Order Management Controller
 * Streamlined controller using the proven CosmosDbService for order CRUD operations
 */

import { Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service';
import { Logger } from '../utils/logger';
import { 
  AppraisalOrder, 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType 
} from '../types/index';

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
  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
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
  getOrder = async (req: Request, res: Response): Promise<void> => {
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
  updateOrder = async (req: Request, res: Response): Promise<void> => {
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
  deleteOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { clientId } = req.query;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Order ID is required'
        });
        return;
      }

      if (!clientId || typeof clientId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Client ID is required for deletion'
        });
        return;
      }

      this.logger.info('Deleting order', { orderId: id, clientId });

      const result = await this.dbService.deleteOrder(id, clientId);

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
  getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, priority, clientId, offset = 0, limit = 50 } = req.query;

      const filters: any = {};
      if (status) filters.status = Array.isArray(status) ? status : [status];
      if (priority) filters.priority = priority;
      if (clientId) filters.clientId = clientId;

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