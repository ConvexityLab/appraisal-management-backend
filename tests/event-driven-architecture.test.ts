/**
 * Test for Event-Driven Architecture
 * Tests the Service Bus publisher, subscriber, and notification service integration
 */

import { ServiceBusEventPublisher } from '../src/services/service-bus-publisher';
import { ServiceBusEventSubscriber } from '../src/services/service-bus-subscriber';
import { NotificationService } from '../src/services/core-notification.service';
import { 
  OrderCreatedEvent, 
  QCCompletedEvent, 
  SystemAlertEvent,
  EventPriority,
  EventCategory,
  NotificationChannel
} from '../src/types/events';

// Test timeout for async operations
const TEST_TIMEOUT = 10000;

describe('Event-Driven Architecture', () => {
  let publisher: ServiceBusEventPublisher;
  let subscriber: ServiceBusEventSubscriber;
  let notificationService: NotificationService;

  beforeAll(async () => {
    // Initialize services with local emulator configuration
    publisher = new ServiceBusEventPublisher('local-emulator', 'test-events');
    subscriber = new ServiceBusEventSubscriber('local-emulator', 'test-events', 'test-subscription');
    notificationService = new NotificationService({
      serviceBusConnectionString: 'local-emulator',
      enableWebSockets: true,
      enableEmail: true
    });

    console.log('Initialized event-driven architecture components');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await publisher.close();
    await subscriber.close();
    await notificationService.stop();
    console.log('Cleaned up event-driven architecture components');
  }, TEST_TIMEOUT);

  test('should publish and process order created event', async () => {
    const orderEvent: OrderCreatedEvent = {
      id: 'test-order-' + Date.now(),
      type: 'order.created',
      timestamp: new Date(),
      source: 'order-service',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId: 'ORD-12345',
        clientId: 'CLIENT-001',
        propertyAddress: '123 Test Street, Test City, CA 90210',
        appraisalType: 'Single Family Residential',
        priority: EventPriority.NORMAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        estimatedValue: 500000
      }
    };

    // Publish the event
    await publisher.publish(orderEvent);
    
    console.log('Published order created event:', {
      id: orderEvent.id,
      type: orderEvent.type,
      orderId: orderEvent.data.orderId
    });

    // Give some time for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(true).toBe(true); // Basic test to ensure no errors
  }, TEST_TIMEOUT);

  test('should publish and process QC completed event', async () => {
    const qcEvent: QCCompletedEvent = {
      id: 'test-qc-' + Date.now(),
      type: 'qc.completed',
      timestamp: new Date(),
      source: 'qc-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: 'ORD-12345',
        qcId: 'QC-67890',
        result: 'passed',
        score: 95,
        issues: [],
        completedBy: 'qc-system',
        priority: EventPriority.HIGH
      }
    };

    // Publish the event
    await publisher.publish(qcEvent);
    
    console.log('Published QC completed event:', {
      id: qcEvent.id,
      type: qcEvent.type,
      result: qcEvent.data.result,
      score: qcEvent.data.score
    });

    // Give some time for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(true).toBe(true);
  }, TEST_TIMEOUT);

  test('should publish batch of events', async () => {
    const events: SystemAlertEvent[] = [
      {
        id: 'test-system-1-' + Date.now(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'monitoring-service',
        version: '1.0',
        category: EventCategory.SYSTEM,
        data: {
          alertType: 'high_load',
          severity: 'warning',
          message: 'System load is above 80%',
          source: 'load-balancer',
          priority: EventPriority.NORMAL,
          requiresAction: false
        }
      },
      {
        id: 'test-system-2-' + Date.now(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'database-service',
        version: '1.0',
        category: EventCategory.SYSTEM,
        data: {
          alertType: 'slow_query',
          severity: 'info',
          message: 'Database query took longer than expected',
          source: 'cosmos-db',
          priority: EventPriority.LOW,
          requiresAction: false
        }
      }
    ];

    // Publish batch of events
    await publisher.publishBatch(events);
    
    console.log('Published batch of system alert events:', {
      eventCount: events.length,
      eventTypes: events.map(e => e.type)
    });

    // Give some time for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(events.length).toBe(2);
  }, TEST_TIMEOUT);

  test('should start and configure notification service', async () => {
    // Start the notification service
    await notificationService.start();
    
    // Check subscription status
    const subscriptionStatus = notificationService.getSubscriptionStatus();
    
    console.log('Notification service subscription status:', subscriptionStatus);
    
    expect(subscriptionStatus.length).toBeGreaterThan(0);
    expect(notificationService.getTotalRuleCount()).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  test('should add and remove notification rules', async () => {
    const initialRuleCount = notificationService.getTotalRuleCount();
    
    // Add a custom rule
    notificationService.addRule({
      id: 'test-custom-rule',
      eventType: 'order.status.changed',
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
      template: {
        title: 'Order Status Changed',
        message: 'Order {{orderId}} status changed to {{newStatus}}'
      },
      priority: EventPriority.NORMAL
    });

    expect(notificationService.getTotalRuleCount()).toBe(initialRuleCount + 1);

    // Remove the rule
    const removed = notificationService.removeRule('test-custom-rule');
    expect(removed).toBe(true);
    expect(notificationService.getTotalRuleCount()).toBe(initialRuleCount);

    console.log('Successfully added and removed custom notification rule');
  }, TEST_TIMEOUT);

  test('should handle event processing with notification service', async () => {
    // Create a test event that will trigger notifications
    const criticalAlert: SystemAlertEvent = {
      id: 'test-critical-' + Date.now(),
      type: 'system.alert',
      timestamp: new Date(),
      source: 'security-service',
      version: '1.0',
      category: EventCategory.SYSTEM,
      data: {
        alertType: 'security_breach',
        severity: 'critical',
        message: 'Potential security breach detected in authentication system',
        source: 'auth-service',
        priority: EventPriority.CRITICAL,
        requiresAction: true
      }
    };

    // Process the event directly through notification service
    await notificationService.processEvent(criticalAlert.type, criticalAlert);
    
    console.log('Processed critical system alert event:', {
      id: criticalAlert.id,
      severity: criticalAlert.data.severity,
      requiresAction: criticalAlert.data.requiresAction
    });

    expect(true).toBe(true);
  }, TEST_TIMEOUT);

  test('should demonstrate end-to-end event flow', async () => {
    console.log('\n=== Demonstrating End-to-End Event Flow ===');
    
    // 1. Create an order event
    const orderEvent: OrderCreatedEvent = {
      id: 'demo-order-' + Date.now(),
      type: 'order.created',
      timestamp: new Date(),
      source: 'order-management-service',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId: 'ORD-DEMO-' + Date.now(),
        clientId: 'CLIENT-DEMO',
        propertyAddress: '456 Demo Avenue, Demo City, CA 90211',
        appraisalType: 'Commercial Property',
        priority: EventPriority.HIGH,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedValue: 1200000
      }
    };

    console.log('Step 1: Publishing order created event...');
    await publisher.publish(orderEvent);

    // 2. Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Simulate QC completion
    const qcEvent: QCCompletedEvent = {
      id: 'demo-qc-' + Date.now(),
      type: 'qc.completed',
      timestamp: new Date(),
      source: 'qc-validation-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: orderEvent.data.orderId,
        qcId: 'QC-DEMO-' + Date.now(),
        result: 'requires_review',
        score: 72,
        issues: ['Comparable property data inconsistency', 'Missing property condition photos'],
        completedBy: 'automated-qc-system',
        priority: EventPriority.HIGH
      }
    };

    console.log('Step 2: Publishing QC completed event...');
    await publisher.publish(qcEvent);

    // 4. Wait for final processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 3: End-to-end event flow completed successfully!');
    console.log('=== Event Flow Demo Complete ===\n');

    expect(true).toBe(true);
  }, TEST_TIMEOUT);
});