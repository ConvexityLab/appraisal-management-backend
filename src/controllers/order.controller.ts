import express, { Request, Response, NextFunction } from 'express';
import { OrderManagementService } from '\';
import { DatabaseService } from '\';
import { VendorManagementService } from '\';
import { NotificationService } from '\';
import { AuditService } from '\';
import { Logger } from '\';
import { 
  AppraisalOrder, 
  ProductType, 
  Priority, 
  OrderType, 
  PropertyType,
  OrderStatus,
  OrderFilters,
  OrderUpdateData,
  ApiResponse 
} from '\';

/**
 * Order Management API Controller
 * Provides RESTful endpoints for order intake, management, and processing
 */
export class OrderController {
  private orderService: OrderManagementService;
  private logger: Logger;

  constructor() {
    // Initialize service dependencies
    const db = new DatabaseService();
    const vendorService = new VendorManagementService();
    const notificationService = new NotificationService();
    const auditService = new AuditService();
    this.logger = new Logger();

    // Initialize order management service
    this.orderService = new OrderManagementService(
      db,
      vendorService,
      notificationService,
      auditService,
      this.logger
    );

    // Bind methods to preserve 'this' context
    this.createOrder = this.createOrder.bind(this);
    this.getOrder = this.getOrder.bind(this);
    this.updateOrder = this.updateOrder.bind(this);
    this.deleteOrder = this.deleteOrder.bind(this);
    this.getOrders = this.getOrders.bind(this);
    this.assignVendor = this.assignVendor.bind(this);
    this.getOrderHistory = this.getOrderHistory.bind(this);
  }

  /**
   * POST /api/orders - Create a new appraisal order
   */
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Creating new appraisal order', { 
        clientId: req.body.clientId,
        productType: req.body.productType 
      });

      // Validate required fields
      const validation = this.validateOrderData(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid order data provided',
            details: validation.errors,
            timestamp: new Date()
          }
        });
        return;
      }

      // Create order through service
      const result = await this.orderService.createOrder(req.body);

      if (result.success && result.data) {
        this.logger.info('Order created successfully', { orderId: result.data.id });
        res.status(201).json(result);
      } else {
        this.logger.error('Failed to create order', { error: result.error });
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in createOrder endpoint', { error });
      next(error);
    }
  }

  /**
   * GET /api/orders/:id - Get order by ID
   */
  async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.id;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Retrieving order', { orderId });

      const result = await this.orderService.getOrderById(orderId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in getOrder endpoint', { error, orderId: req.params.id });
      next(error);
    }
  }

  /**
   * PUT /api/orders/:id - Update an existing order
   */
  async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.id;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Updating order', { orderId, userId });

      const result = await this.orderService.updateOrder(orderId, req.body, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in updateOrder endpoint', { error, orderId: req.params.id });
      next(error);
    }
  }

  /**
   * DELETE /api/orders/:id - Cancel/delete an order
   */
  async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.id;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      const reason = req.body.reason || 'Order cancelled via API';
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Cancelling order', { orderId, userId, reason });

      const result = await this.orderService.cancelOrder(orderId, reason, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in deleteOrder endpoint', { error, orderId: req.params.id });
      next(error);
    }
  }

  /**
   * GET /api/orders - Get orders with filtering and pagination
   */
  async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: OrderFilters = {};
      
      if (req.query.clientId) filters.clientId = req.query.clientId as string;
      if (req.query.status) filters.status = (req.query.status as string).split(',') as OrderStatus[];
      if (req.query.productType) filters.productType = (req.query.productType as string).split(',') as ProductType[];
      if (req.query.priority) filters.priority = (req.query.priority as string).split(',') as Priority[];
      if (req.query.assignedVendorId) filters.assignedVendorId = req.query.assignedVendorId as string;
      if (req.query.dueDateFrom) filters.dueDateFrom = new Date(req.query.dueDateFrom as string);
      if (req.query.dueDateTo) filters.dueDateTo = new Date(req.query.dueDateTo as string);
      if (req.query.createdFrom) filters.createdFrom = new Date(req.query.createdFrom as string);
      if (req.query.createdTo) filters.createdTo = new Date(req.query.createdTo as string);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      this.logger.info('Retrieving orders with filters', { filters, page, limit });

      const result = await this.orderService.getOrders(filters, page, limit);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in getOrders endpoint', { error });
      next(error);
    }
  }

  /**
   * POST /api/orders/:id/assign - Assign order to vendor
   */
  async assignVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.id;
      const vendorId = req.body.vendorId;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Order ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'vendorId is required',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Assigning vendor to order', { orderId, vendorId, userId });

      const result = await this.orderService.assignOrderToVendor(orderId, vendorId, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'ORDER_NOT_FOUND' || result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in assignVendor endpoint', { error, orderId: req.params.id });
      next(error);
    }
  }

  /**
   * GET /api/orders/:id/history - Get order audit history
   */
  async getOrderHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = req.params.id;
      
      this.logger.info('Retrieving order history', { orderId });

      // This would typically call auditService.getOrderHistory(orderId)
      // For now, return a placeholder response
      const historyResponse: ApiResponse<any[]> = {
        success: true,
        data: [
          {
            id: '1',
            orderId,
            action: 'ORDER_CREATED',
            userId: 'system',
            timestamp: new Date(),
            details: { status: OrderStatus.NEW }
          }
        ]
      };

      res.json(historyResponse);
    } catch (error) {
      this.logger.error('Error in getOrderHistory endpoint', { error, orderId: req.params.id });
      next(error);
    }
  }

  /**
   * Validate order data before creation
   */
  private validateOrderData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!data.clientId) errors.push('clientId is required');
    if (!data.orderNumber) errors.push('orderNumber is required');
    if (!data.propertyAddress) errors.push('propertyAddress is required');
    if (!data.propertyDetails) errors.push('propertyDetails is required');
    if (!data.orderType) errors.push('orderType is required');
    if (!data.productType) errors.push('productType is required');
    if (!data.dueDate) errors.push('dueDate is required');
    if (!data.borrowerInformation) errors.push('borrowerInformation is required');
    if (!data.loanInformation) errors.push('loanInformation is required');
    if (!data.contactInformation) errors.push('contactInformation is required');
    if (!data.createdBy) errors.push('createdBy is required');

    // Property address validation
    if (data.propertyAddress) {
      if (!data.propertyAddress.streetAddress) errors.push('propertyAddress.streetAddress is required');
      if (!data.propertyAddress.city) errors.push('propertyAddress.city is required');
      if (!data.propertyAddress.state) errors.push('propertyAddress.state is required');
      if (!data.propertyAddress.zipCode) errors.push('propertyAddress.zipCode is required');
      if (!data.propertyAddress.county) errors.push('propertyAddress.county is required');
    }

    // Enum validation
    if (data.productType && !Object.values(ProductType).includes(data.productType)) {
      errors.push('Invalid productType value');
    }
    if (data.orderType && !Object.values(OrderType).includes(data.orderType)) {
      errors.push('Invalid orderType value');
    }
    if (data.priority && !Object.values(Priority).includes(data.priority)) {
      errors.push('Invalid priority value');
    }

    // Date validation
    if (data.dueDate && isNaN(Date.parse(data.dueDate))) {
      errors.push('Invalid dueDate format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create Express router with order management endpoints
 */
export function createOrderRouter(): express.Router {
  const router = express.Router();
  const controller = new OrderController();

  // Order CRUD operations
  router.post('/', controller.createOrder);
  router.get('/', controller.getOrders);
  router.get('/:id', controller.getOrder);
  router.put('/:id', controller.updateOrder);
  router.delete('/:id', controller.deleteOrder);

  // Order-specific operations
  router.post('/:id/assign', controller.assignVendor);
  router.get('/:id/history', controller.getOrderHistory);

  return router;
}