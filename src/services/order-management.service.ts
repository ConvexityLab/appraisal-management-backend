import { OrderStatus, Priority, ProductType, ApiResponse, PaginationInfo, OrderFilters, OrderUpdateData } from '../types/index.js';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';
import { isValidStatusTransition } from '../types/order-status.js';
import { DatabaseService } from './database.service.js';
import { VendorManagementService } from './vendor-management.service.js';
import { NotificationService } from './notification.service.js';
import { AuditService } from './audit.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';

type AddressLike = {
  streetAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zip?: string;
};

// Simple event emitter implementation
class SimpleEventEmitter {
  private events: Record<string, Function[]> = {};

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args));
    }
  }

  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
}

// Import Perligo agents (will be available once package is installed)
// import { WorkflowAgent, RoutingAgent } from 'perligo-agents';

// Generate UUID replacement
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function formatAddressText(address?: AddressLike): string | undefined {
  if (!address) {
    return undefined;
  }

  const street = address.streetAddress ?? address.street ?? '';
  const locality = [address.city, address.state].filter(Boolean).join(', ');
  const zipCode = address.zipCode ?? address.zip ?? '';
  const trailing = [locality, zipCode].filter(Boolean).join(' ');
  const formatted = [street, trailing].filter(Boolean).join(', ').trim();

  return formatted.length > 0 ? formatted : undefined;
}

function hasEmbeddedPropertyAddress(order: Order): boolean {
  return typeof order.propertyAddress?.streetAddress === 'string'
    && order.propertyAddress.streetAddress.trim().length > 0;
}

export class OrderManagementService extends SimpleEventEmitter {
  private db: DatabaseService;
  private vendorService: VendorManagementService;
  private notificationService: NotificationService;
  private auditService: AuditService;
  private publisher: ServiceBusEventPublisher;
  private tenantConfigService: TenantAutomationConfigService;
  private logger: Logger;
  // private workflowAgent: WorkflowAgent;
  // private routingAgent: RoutingAgent;

  constructor(
    db: DatabaseService,
    vendorService: VendorManagementService,
    notificationService: NotificationService,
    auditService: AuditService,
    logger: Logger
  ) {
    super();
    this.db = db;
    this.vendorService = vendorService;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.publisher = new ServiceBusEventPublisher();
    this.tenantConfigService = new TenantAutomationConfigService();
    this.logger = logger;
  }

  /** Best-effort event publishing — never throws */
  private async publishToBus(
    type: string,
    category: EventCategory,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.publisher.publish({
        id: uuidv4(),
        type,
        timestamp: new Date(),
        source: 'order-management-service',
        version: '1.0',
        category,
        data: { priority: EventPriority.NORMAL, ...data },
      } as any);
    } catch (err) {
      this.logger.warn(`Failed to publish ${type} to Service Bus`, { error: (err as Error).message });
    }
  }

  private async resolveCanonicalPropertyAddress(order: Order): Promise<string | undefined> {
    const propertyId = typeof order.propertyId === 'string' && order.propertyId.trim().length > 0
      ? order.propertyId
      : undefined;

    if (propertyId) {
      try {
        const property = await this.db.properties.findById(propertyId);
        const canonicalAddress = formatAddressText(property?.address);
        if (canonicalAddress) {
          return canonicalAddress;
        }
      } catch (error) {
        this.logger.warn('OrderManagementService could not resolve canonical property address; using embedded order copy', {
          orderId: order.id,
          propertyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return formatAddressText(order.propertyAddress as AddressLike | undefined);
  }

  /**
   * Create a new appraisal order
   */
  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ApiResponse<Order>> {
    try {
      const orderId = generateUUID();
      const now = new Date();

      const order: Order = {
        ...orderData,
        id: orderId,
        status: OrderStatus.NEW,
        createdAt: now,
        updatedAt: now
      };

      // Inherit Axiom program defaults from the per-tenant automation config
      // when the order didn't already carry them. Without these fields the
      // FE's QCReviewContent skips `useGetLatestResultsQuery` entirely —
      // verdicts never reach the UI even though Axiom evaluated them.
      // Best-effort: if the lookup throws or the config has no axiomProgramId,
      // leave the order's value as-is rather than blocking creation.
      if (!(order as any).axiomProgramId && order.clientId) {
        try {
          // Order has no subClientId today, so this resolves to client-level
          // platform defaults inside tenantConfigService (its fallback path
          // when subClientId is undefined).
          const cfg = await this.tenantConfigService.getConfig(order.clientId);
          if (cfg.axiomProgramId) {
            (order as any).axiomProgramId = cfg.axiomProgramId;
            (order as any).axiomProgramVersion = cfg.axiomProgramVersion ?? '1.0.0';
          }
        } catch (cfgErr) {
          this.logger.warn('createOrder: tenant axiom-program lookup failed; leaving order without program defaults', {
            orderId, clientId: order.clientId,
            error: cfgErr instanceof Error ? cfgErr.message : String(cfgErr),
          });
        }
      }

      // Validate order data
      await this.validateOrderData(order);

      // Save to database
      await this.db.orders.create(order);

      // Log audit trail
      await this.auditService.logActivity({
        entityType: 'order',
        entityId: orderId,
        action: 'create',
        userId: order.createdBy,
        details: { orderNumber: order.orderNumber, clientId: order.clientId }
      });

      // Emit event for order created (legacy in-memory emitter)
      this.emit('orderCreated', order);

      // Publish to Service Bus so downstream services (audit sink, assignment, etc.) see it
      await this.publishToBus('order.created', EventCategory.ORDER, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: order.tenantId,
        clientId: order.clientId,
        productType: order.productType,
        propertyAddress: await this.resolveCanonicalPropertyAddress(order),
        createdBy: order.createdBy,
      });

      // Trigger workflow automation with Perligo
      await this.triggerOrderWorkflow(order);

      this.logger.info('Order created successfully', { orderId, orderNumber: order.orderNumber });

      return {
        success: true,
        data: order
      };
    } catch (error) {
      this.logger.error('Error creating order', { error, orderData });
      return {
        success: false,
        error: {
          code: 'ORDER_CREATION_FAILED',
          message: 'Failed to create order',
          details: { error: error instanceof Error ? error.message : String(error) },
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ApiResponse<Order>> {
    try {
      const order = await this.db.orders.findById(orderId);
      
      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
            timestamp: new Date()
          }
        };
      }

      return {
        success: true,
        data: order
      };
    } catch (error) {
      this.logger.error('Error fetching order', { error, orderId });
      return {
        success: false,
        error: {
          code: 'ORDER_FETCH_FAILED',
          message: 'Failed to fetch order',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get orders with filtering and pagination
   */
  async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<Order[]>> {
    try {
      const offset = (page - 1) * limit;
      const { orders, total } = await this.db.orders.findMany(filters, offset, limit);

      const pagination: PaginationInfo = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };

      return {
        success: true,
        data: orders,
        pagination
      };
    } catch (error) {
      this.logger.error('Error fetching orders', { error, filters });
      return {
        success: false,
        error: {
          code: 'ORDERS_FETCH_FAILED',
          message: 'Failed to fetch orders',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update an existing order
   */
  async updateOrder(orderId: string, updateData: OrderUpdateData, userId: string): Promise<ApiResponse<Order>> {
    try {
      const existingOrder = await this.db.orders.findById(orderId);
      if (!existingOrder) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
            timestamp: new Date()
          }
        };
      }

      const updatedOrder = {
        ...existingOrder,
        ...updateData,
        updatedAt: new Date()
      };

      // Validate status transitions
      if (updateData.status && !this.isValidStatusTransition(existingOrder.status, updateData.status)) {
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Invalid status transition from ${existingOrder.status} to ${updateData.status}`,
            timestamp: new Date()
          }
        };
      }

      await this.db.orders.update(orderId, updatedOrder);

      // Log audit trail
      await this.auditService.logActivity({
        entityType: 'order',
        entityId: orderId,
        action: 'update',
        userId,
        details: { changes: updateData }
      });

      // Emit event for order updated (legacy in-memory emitter)
      this.emit('orderUpdated', { previous: existingOrder, current: updatedOrder });

      // Publish order.status.changed to Service Bus when status actually changed
      if (existingOrder.status !== updatedOrder.status) {
        await this.publishToBus('order.status.changed', EventCategory.ORDER, {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          tenantId: updatedOrder.tenantId,
          oldStatus: existingOrder.status,
          newStatus: updatedOrder.status,
          updatedBy: userId,
        });
      }

      // Handle status-specific logic
      await this.handleStatusChange(existingOrder, updatedOrder);

      this.logger.info('Order updated successfully', { orderId, changes: updateData });

      return {
        success: true,
        data: updatedOrder
      };
    } catch (error) {
      this.logger.error('Error updating order', { error, orderId, updateData });
      return {
        success: false,
        error: {
          code: 'ORDER_UPDATE_FAILED',
          message: 'Failed to update order',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Assign order to vendor
   */
  async assignOrderToVendor(orderId: string, vendorId: string, userId: string): Promise<ApiResponse<Order>> {
    try {
      // Check if vendor is available and qualified
      const vendorCheck = await this.vendorService.checkVendorAvailability(vendorId, orderId);
      if (!vendorCheck) {
        return {
          success: false,
          error: {
            code: 'VENDOR_UNAVAILABLE',
            message: 'Vendor not available for assignment',
            timestamp: new Date()
          }
        };
      }

      const updateResult = await this.updateOrder(orderId, {
        assignedVendorId: vendorId,
        status: OrderStatus.ASSIGNED
      }, userId);

      if (updateResult.success && updateResult.data) {
        // Send notification to vendor
        await this.notificationService.notifyVendorAssignment(vendorId, updateResult.data);
        
        // Set acceptance deadline (12 hours as per process)
        await this.scheduleVendorAcceptanceReminder(orderId, vendorId);
      }

      return updateResult;
    } catch (error) {
      this.logger.error('Error assigning order to vendor', { error, orderId, vendorId });
      return {
        success: false,
        error: {
          code: 'VENDOR_ASSIGNMENT_FAILED',
          message: 'Failed to assign order to vendor',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Auto-assign order to best available vendor using AI routing
   */
  async autoAssignOrder(orderId: string, userId: string): Promise<ApiResponse<Order>> {
    try {
      const order = await this.db.orders.findById(orderId);
      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
            timestamp: new Date()
          }
        };
      }

      // Use Perligo routing agent to find best vendor
      // const bestVendor = await this.routingAgent.findBestVendor({
      //   orderType: order.orderType,
      //   productType: order.productType,
      //   propertyAddress: order.propertyAddress,
      //   priority: order.priority,
      //   dueDate: order.dueDate
      // });

      // Temporary fallback until Perligo is integrated.
      // VendorOrder cast: by this point in the create flow, slice 8g guarantees
      // engagementId/propertyId are set; clientOrderId is filled when the order
      // was spawned via ClientOrderService.placeClientOrder.
      const bestVendor = await this.vendorService.findBestVendorForOrder(order as unknown as import('../types/vendor-order.types.js').VendorOrder);
      
      if (!bestVendor) {
        return {
          success: false,
          error: {
            code: 'NO_VENDOR_AVAILABLE',
            message: 'No suitable vendor available for this order',
            timestamp: new Date()
          }
        };
      }

      return await this.assignOrderToVendor(orderId, bestVendor.id, userId);
    } catch (error) {
      this.logger.error('Error auto-assigning order', { error, orderId });
      return {
        success: false,
        error: {
          code: 'AUTO_ASSIGNMENT_FAILED',
          message: 'Failed to auto-assign order',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get orders requiring attention (late, unassigned, etc.)
   */
  async getOrdersRequiringAttention(): Promise<ApiResponse<Order[]>> {
    try {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const filters: OrderFilters = {
        status: [OrderStatus.NEW, OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
        dueDateTo: twentyFourHoursFromNow
      };

      const ordersResult = await this.getOrders(filters, 1, 100);
      
      if (!ordersResult.success || !ordersResult.data) {
        return ordersResult;
      }

      // Filter for orders requiring attention
      const ordersNeedingAttention = ordersResult.data.filter(order => {
        // Unassigned orders older than 12 hours
        if (order.status === OrderStatus.NEW && order.createdAt < twelveHoursAgo) {
          return true;
        }
        
        // Orders due within 24 hours. dueDate is now optional on
        // VendorOrder (lender-side; lives on ClientOrder); rows without it
        // are simply not flagged as due-soon here.
        if (order.dueDate && order.dueDate < twentyFourHoursFromNow) {
          return true;
        }

        // Rush orders not yet assigned
        if (order.priority === Priority.RUSH && order.status === OrderStatus.NEW) {
          return true;
        }

        return false;
      });

      return {
        success: true,
        data: ordersNeedingAttention
      };
    } catch (error) {
      this.logger.error('Error fetching orders requiring attention', { error });
      return {
        success: false,
        error: {
          code: 'ATTENTION_ORDERS_FETCH_FAILED',
          message: 'Failed to fetch orders requiring attention',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason: string, userId: string): Promise<ApiResponse<Order>> {
    try {
      const order = await this.db.orders.findById(orderId);
      if (!order) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
            timestamp: new Date()
          }
        };
      }

      // Check if order can be cancelled
      if ([OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status)) {
        return {
          success: false,
          error: {
            code: 'ORDER_CANNOT_BE_CANCELLED',
            message: 'Order cannot be cancelled in current status',
            timestamp: new Date()
          }
        };
      }

      const updateResult = await this.updateOrder(orderId, {
        status: OrderStatus.CANCELLED,
        metadata: {
          ...order.metadata,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: userId
        }
      }, userId);

      if (updateResult.success && order.assignedVendorId) {
        // Notify vendor of cancellation
        await this.notificationService.notifyVendorCancellation(order.assignedVendorId, order, reason);
      }

      return updateResult;
    } catch (error) {
      this.logger.error('Error cancelling order', { error, orderId, reason });
      return {
        success: false,
        error: {
          code: 'ORDER_CANCELLATION_FAILED',
          message: 'Failed to cancel order',
          timestamp: new Date()
        }
      };
    }
  }

  // Private helper methods

  private async validateOrderData(order: Order): Promise<void> {
    // Validate required fields. propertyAddress / orderType / dueDate are now
    // optional on VendorOrder (Phase 2 of the Order-relocation refactor) —
    // they're populated only on legacy /api/orders POSTs that supplied a
    // full lender intake. The create flow can now also run with canonical
    // `propertyId` only; in that case we require the canonical PropertyRecord
    // to exist instead of forcing a duplicated embedded property address.
    if (!order.clientId) throw new Error('Client ID is required');
    const propertyId = typeof order.propertyId === 'string' && order.propertyId.trim().length > 0
      ? order.propertyId
      : undefined;
    if (!hasEmbeddedPropertyAddress(order) && !propertyId) {
      throw new Error('Property address or propertyId is required');
    }
    if (propertyId) {
      const property = await this.db.properties.findById(propertyId);
      if (!property) {
        throw new Error(`Canonical property '${propertyId}' was not found`);
      }
    }
    if (!order.orderType) throw new Error('Order type is required');
    if (!order.productType) throw new Error('Product type is required');
    if (!order.dueDate) throw new Error('Due date is required');

    // Validate business rules
    if (order.dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }

    // Additional validations can be added here
  }

  private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
    return isValidStatusTransition(currentStatus, newStatus);
  }

  private async handleStatusChange(previousOrder: Order, currentOrder: Order): Promise<void> {
    if (previousOrder.status === currentOrder.status) return;

    switch (currentOrder.status) {
      case OrderStatus.ASSIGNED:
        // Start acceptance timer
        await this.scheduleVendorAcceptanceReminder(currentOrder.id, currentOrder.assignedVendorId!);
        break;
      
      case OrderStatus.SUBMITTED:
        // Move to QC queue
        this.emit('orderReadyForQC', currentOrder);
        break;
      
      case OrderStatus.COMPLETED:
        // Trigger delivery process
        this.emit('orderCompleted', currentOrder);
        break;
      
      case OrderStatus.DELIVERED:
        // Update vendor performance metrics. VendorOrder cast: at DELIVERED
        // status the order is a fully-linked VendorOrder (vendor was assigned
        // to deliver, so all linkage fields are set).
        await this.vendorService.updateVendorPerformance(
          currentOrder.assignedVendorId!,
          currentOrder as unknown as import('../types/vendor-order.types.js').VendorOrder,
        );
        break;
    }
  }

  private async triggerOrderWorkflow(order: Order): Promise<void> {
    try {
      // Use Perligo workflow agent to trigger automation
      // await this.workflowAgent.triggerWorkflow('orderIntake', {
      //   orderId: order.id,
      //   orderType: order.orderType,
      //   priority: order.priority,
      //   dueDate: order.dueDate
      // });

      // Temporary implementation until Perligo is integrated
      this.logger.info('Order workflow triggered', { orderId: order.id });
      
      // Auto-assign if priority is rush
      if (order.priority === Priority.RUSH) {
        // Schedule rush order auto-assignment
        Promise.resolve().then(() => {
          this.autoAssignOrder(order.id, 'system');
        });
      }
    } catch (error) {
      this.logger.error('Error triggering order workflow', { error, orderId: order.id });
    }
  }

  private async scheduleVendorAcceptanceReminder(orderId: string, vendorId: string): Promise<void> {
    // In a real implementation, this would use a job scheduler like Azure Functions with timer triggers
    // For now, we'll just log the scheduling intent
    this.logger.info('Vendor acceptance reminder scheduled', { 
      orderId, 
      vendorId, 
      reminderTime: '12 hours',
      reassignTime: '12.5 hours' 
    });
    
    // Would integrate with Azure Service Bus or Azure Functions for actual scheduling
    await this.notificationService.scheduleVendorReminder(vendorId, orderId, '12h');
  }
}