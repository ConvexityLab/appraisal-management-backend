import { ServiceBusClient, ServiceBusSender, ServiceBusReceiver } from '@azure/service-bus';
import { Logger } from '../utils/logger.js';
import { AppraisalOrder, OrderStatus } from '../types/index.js';

/**
 * Azure Service Bus Integration for Order Events
 * Handles event-driven messaging for order lifecycle management
 */
export class OrderEventService {
  private serviceBusClient: ServiceBusClient | null = null;
  private logger: Logger;
  private connectionString: string;
  private orderTopicName: string = 'order-events';
  private vendorTopicName: string = 'vendor-events';
  private qcTopicName: string = 'quality-control-events';

  constructor() {
    this.logger = new Logger();
    this.connectionString = process.env.AZURE_SERVICEBUS_CONNECTION_STRING || '';
    
    if (this.connectionString) {
      this.initializeServiceBus();
    } else {
      this.logger.warn('Azure Service Bus connection string not provided, using mock implementation');
    }
  }

  /**
   * Initialize Azure Service Bus client
   */
  private initializeServiceBus(): void {
    try {
      this.serviceBusClient = new ServiceBusClient(this.connectionString);
      this.logger.info('Azure Service Bus client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Service Bus client', { error });
      this.serviceBusClient = null;
    }
  }

  /**
   * Publish order created event
   */
  async publishOrderCreated(order: AppraisalOrder): Promise<void> {
    const event = {
      eventType: 'ORDER_CREATED',
      orderId: order.id,
      clientId: order.clientId,
      productType: order.productType,
      priority: order.priority,
      dueDate: order.dueDate,
      propertyAddress: order.propertyAddress,
      timestamp: new Date(),
      metadata: {
        orderNumber: order.orderNumber,
        rushOrder: order.rushOrder
      }
    };

    await this.publishEvent(this.orderTopicName, event);
    this.logger.info('Order created event published', { orderId: order.id });
  }

  /**
   * Publish order status changed event
   */
  async publishOrderStatusChanged(orderId: string, oldStatus: OrderStatus, newStatus: OrderStatus, userId: string): Promise<void> {
    const event = {
      eventType: 'ORDER_STATUS_CHANGED',
      orderId,
      oldStatus,
      newStatus,
      userId,
      timestamp: new Date(),
      metadata: {
        statusTransition: `${oldStatus} -> ${newStatus}`
      }
    };

    await this.publishEvent(this.orderTopicName, event);
    this.logger.info('Order status changed event published', { orderId, oldStatus, newStatus });
  }

  /**
   * Publish vendor assigned event
   */
  async publishVendorAssigned(orderId: string, vendorId: string, userId: string): Promise<void> {
    const event = {
      eventType: 'VENDOR_ASSIGNED',
      orderId,
      vendorId,
      userId,
      timestamp: new Date(),
      metadata: {
        assignmentType: 'manual'
      }
    };

    await this.publishEvent(this.vendorTopicName, event);
    this.logger.info('Vendor assigned event published', { orderId, vendorId });
  }

  /**
   * Publish quality control event
   */
  async publishQualityControlEvent(orderId: string, qcResult: any): Promise<void> {
    const event = {
      eventType: 'QUALITY_CONTROL_COMPLETED',
      orderId,
      qcResult,
      timestamp: new Date(),
      metadata: {
        score: qcResult.score,
        passed: qcResult.passed,
        issuesFound: qcResult.issues?.length || 0
      }
    };

    await this.publishEvent(this.qcTopicName, event);
    this.logger.info('Quality control event published', { orderId, score: qcResult.score });
  }

  /**
   * Publish order cancelled event
   */
  async publishOrderCancelled(orderId: string, reason: string, userId: string): Promise<void> {
    const event = {
      eventType: 'ORDER_CANCELLED',
      orderId,
      reason,
      userId,
      timestamp: new Date(),
      metadata: {
        cancellationType: 'user_initiated'
      }
    };

    await this.publishEvent(this.orderTopicName, event);
    this.logger.info('Order cancelled event published', { orderId, reason });
  }

  /**
   * Generic event publishing method
   */
  private async publishEvent(topicName: string, eventData: any): Promise<void> {
    if (!this.serviceBusClient) {
      // Mock implementation for development
      this.logger.info('Mock Service Bus: Event published', {
        topic: topicName,
        eventType: eventData.eventType,
        orderId: eventData.orderId,
        timestamp: eventData.timestamp
      });
      return;
    }

    try {
      const sender = this.serviceBusClient.createSender(topicName);

      const message = {
        body: eventData,
        contentType: 'application/json',
        messageId: `${eventData.eventType}_${eventData.orderId}_${Date.now()}`,
        correlationId: eventData.orderId,
        timeToLive: 24 * 60 * 60 * 1000, // 24 hours
        sessionId: eventData.orderId,
        applicationProperties: {
          eventType: eventData.eventType,
          orderId: eventData.orderId,
          timestamp: eventData.timestamp.toISOString()
        }
      };

      await sender.sendMessages([message]);
      await sender.close();

      this.logger.info('Event published to Service Bus', {
        topic: topicName,
        eventType: eventData.eventType,
        messageId: message.messageId
      });
    } catch (error) {
      this.logger.error('Failed to publish event to Service Bus', {
        topic: topicName,
        eventType: eventData.eventType,
        error
      });
      throw error;
    }
  }

  /**
   * Set up event subscribers for processing incoming events
   */
  async setupEventSubscribers(): Promise<void> {
    if (!this.serviceBusClient) {
      this.logger.info('Service Bus not available, skipping event subscriber setup');
      return;
    }

    try {
      // Order events subscriber
      const orderSubscriber = this.serviceBusClient.createReceiver(
        this.orderTopicName,
        'order-processor-subscription'
      );

      orderSubscriber.subscribe({
        processMessage: async (message) => {
          await this.processOrderEvent(message.body);
          await orderSubscriber.completeMessage(message);
        },
        processError: async (args) => {
          this.logger.error('Error processing order event', { error: args.error });
        }
      });

      // Vendor events subscriber
      const vendorSubscriber = this.serviceBusClient.createReceiver(
        this.vendorTopicName,
        'vendor-processor-subscription'
      );

      vendorSubscriber.subscribe({
        processMessage: async (message) => {
          await this.processVendorEvent(message.body);
          await vendorSubscriber.completeMessage(message);
        },
        processError: async (args) => {
          this.logger.error('Error processing vendor event', { error: args.error });
        }
      });

      this.logger.info('Event subscribers set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up event subscribers', { error });
    }
  }

  /**
   * Process incoming order events
   */
  private async processOrderEvent(eventData: any): Promise<void> {
    this.logger.info('Processing order event', {
      eventType: eventData.eventType,
      orderId: eventData.orderId
    });

    switch (eventData.eventType) {
      case 'ORDER_CREATED':
        await this.handleOrderCreated(eventData);
        break;
      case 'ORDER_STATUS_CHANGED':
        await this.handleOrderStatusChanged(eventData);
        break;
      case 'ORDER_CANCELLED':
        await this.handleOrderCancelled(eventData);
        break;
      default:
        this.logger.warn('Unknown order event type', { eventType: eventData.eventType });
    }
  }

  /**
   * Process incoming vendor events
   */
  private async processVendorEvent(eventData: any): Promise<void> {
    this.logger.info('Processing vendor event', {
      eventType: eventData.eventType,
      orderId: eventData.orderId,
      vendorId: eventData.vendorId
    });

    switch (eventData.eventType) {
      case 'VENDOR_ASSIGNED':
        await this.handleVendorAssigned(eventData);
        break;
      default:
        this.logger.warn('Unknown vendor event type', { eventType: eventData.eventType });
    }
  }

  /**
   * Handle order created event
   */
  private async handleOrderCreated(eventData: any): Promise<void> {
    // Trigger downstream processes like:
    // - Automated compliance checks
    // - Initial risk assessment
    // - Vendor pool filtering
    // - Customer notifications
    
    this.logger.info('Order created event processed', {
      orderId: eventData.orderId,
      actions: ['compliance-check-initiated', 'risk-assessment-started']
    });
  }

  /**
   * Handle order status changed event
   */
  private async handleOrderStatusChanged(eventData: any): Promise<void> {
    // Handle status-specific logic:
    // - Send notifications to relevant parties
    // - Update external systems
    // - Trigger next workflow steps
    
    this.logger.info('Order status changed event processed', {
      orderId: eventData.orderId,
      statusTransition: eventData.metadata?.statusTransition
    });
  }

  /**
   * Handle order cancelled event
   */
  private async handleOrderCancelled(eventData: any): Promise<void> {
    // Handle cancellation logic:
    // - Notify vendors
    // - Update schedules
    // - Process refunds if applicable
    
    this.logger.info('Order cancelled event processed', {
      orderId: eventData.orderId,
      reason: eventData.reason
    });
  }

  /**
   * Handle vendor assigned event
   */
  private async handleVendorAssigned(eventData: any): Promise<void> {
    // Handle vendor assignment logic:
    // - Send assignment notification to vendor
    // - Update vendor workload
    // - Schedule reminders
    
    this.logger.info('Vendor assigned event processed', {
      orderId: eventData.orderId,
      vendorId: eventData.vendorId
    });
  }

  /**
   * Close Service Bus connections
   */
  async close(): Promise<void> {
    if (this.serviceBusClient) {
      await this.serviceBusClient.close();
      this.logger.info('Service Bus client closed');
    }
  }
}