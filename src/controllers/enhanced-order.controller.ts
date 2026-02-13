/**
 * Enhanced Order Management Controller
 * REST API for comprehensive order lifecycle management
 */

import { Response, Router } from 'express';
import { DatabaseService } from '../services/database.service.js';
import { VendorManagementService } from '../services/vendor-management.service.js';
import { NotificationService } from '../services/notification.service.js';
import { AuditService } from '../services/audit.service.js';
import { OrderManagementService } from '../services/order-management.service.js';
import { EnhancedOrderManagementService } from '../services/enhanced-order-management.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

export class EnhancedOrderController {
  public router: Router;
  private enhancedOrderService: EnhancedOrderManagementService;
  private logger: Logger;

  constructor(dbService: any) {
    this.router = Router();
    this.logger = new Logger('EnhancedOrderController');
    
    // Create all dependencies for OrderManagementService
    const db = new DatabaseService();
    const vendorService = new VendorManagementService();
    const notificationService = new NotificationService();
    const auditService = new AuditService();
    const orderLogger = new Logger('OrderManagement');
    
    // Create base order service with all dependencies
    const baseOrderService = new OrderManagementService(
      db,
      vendorService,
      notificationService,
      auditService,
      orderLogger
    );
    
    // Create enhanced order service
    this.enhancedOrderService = new EnhancedOrderManagementService(baseOrderService);
    
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Enhanced order creation with property intelligence
    this.router.post('/create-with-intelligence', this.createOrderWithIntelligence.bind(this));
    
    // Analytics
    this.router.get('/dashboard', this.getDashboard.bind(this));
  }

  /**
   * POST /api/enhanced-orders/create-with-intelligence
   * Create order with property intelligence analysis
   */
  private async createOrderWithIntelligence(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || 'test-user';
      const enablePreQualification = req.body.enablePreQualification !== false;

      const result = await this.enhancedOrderService.createOrderWithIntelligence(
        req.body,
        userId,
        enablePreQualification
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      this.logger.error('Error creating order with intelligence', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create order'
      });
    }
  }

  /**
   * GET /api/enhanced-orders/dashboard
   * Get dashboard metrics
   */
  private async getDashboard(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || 'test-user';
      
      const result = await this.enhancedOrderService.getOrderDashboard(
        {},
        userId
      );
      res.json(result);
    } catch (error) {
      this.logger.error('Error getting dashboard', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard'
      });
    }
  }
}
