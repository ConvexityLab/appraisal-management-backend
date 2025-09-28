/**
 * Event-Driven Architecture Demo
 * Simple demonstration of our Service Bus publisher, subscriber, and notification service
 */

import { ServiceBusEventPublisher } from './src/services/service-bus-publisher';
import { ServiceBusEventSubscriber } from './src/services/service-bus-subscriber';
import { NotificationService } from './src/services/core-notification.service';
import { 
  OrderCreatedEvent, 
  QCCompletedEvent, 
  SystemAlertEvent,
  EventPriority,
  EventCategory,
  NotificationChannel
} from './src/types/events';

async function demonstrateEventDrivenArchitecture() {
  console.log('🚀 Starting Event-Driven Architecture Demo\n');

  // Initialize services with local emulator configuration
  const publisher = new ServiceBusEventPublisher('local-emulator', 'demo-events');
  const subscriber = new ServiceBusEventSubscriber('local-emulator', 'demo-events', 'demo-subscription');
  const notificationService = new NotificationService({
    serviceBusConnectionString: 'local-emulator',
    enableWebSockets: true,
    enableEmail: true
  });

  try {
    // Start the notification service
    console.log('📋 Starting notification service...');
    await notificationService.start();
    
    const subscriptionStatus = notificationService.getSubscriptionStatus();
    console.log(`✅ Notification service started with ${subscriptionStatus.length} event subscriptions`);
    console.log(`📊 Total notification rules: ${notificationService.getTotalRuleCount()}\n`);

    // Demo 1: Order Created Event
    console.log('🏠 Demo 1: Publishing Order Created Event');
    const orderEvent: OrderCreatedEvent = {
      id: 'demo-order-' + Date.now(),
      type: 'order.created',
      timestamp: new Date(),
      source: 'order-management-service',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId: 'ORD-DEMO-001',
        clientId: 'CLIENT-ABC',
        propertyAddress: '123 Main Street, Anytown, CA 90210',
        appraisalType: 'Single Family Residential',
        priority: EventPriority.NORMAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedValue: 750000
      }
    };

    await publisher.publish(orderEvent);
    console.log(`📤 Published: ${orderEvent.type} for order ${orderEvent.data.orderId}`);
    
    // Process through notification service
    await notificationService.processEvent(orderEvent.type, orderEvent);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo 2: QC Completed Event
    console.log('\n🔍 Demo 2: Publishing QC Completed Event');
    const qcEvent: QCCompletedEvent = {
      id: 'demo-qc-' + Date.now(),
      type: 'qc.completed',
      timestamp: new Date(),
      source: 'qc-validation-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: orderEvent.data.orderId,
        qcId: 'QC-DEMO-001',
        result: 'passed',
        score: 92,
        issues: [],
        completedBy: 'automated-qc-system',
        priority: EventPriority.HIGH
      }
    };

    await publisher.publish(qcEvent);
    console.log(`📤 Published: ${qcEvent.type} with result ${qcEvent.data.result} (Score: ${qcEvent.data.score}/100)`);
    
    await notificationService.processEvent(qcEvent.type, qcEvent);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo 3: Critical System Alert
    console.log('\n🚨 Demo 3: Publishing Critical System Alert');
    const criticalAlert: SystemAlertEvent = {
      id: 'demo-alert-' + Date.now(),
      type: 'system.alert',
      timestamp: new Date(),
      source: 'monitoring-service',
      version: '1.0',
      category: EventCategory.SYSTEM,
      data: {
        alertType: 'high_cpu_usage',
        severity: 'critical',
        message: 'CPU usage has exceeded 95% for more than 5 minutes',
        source: 'application-server-01',
        priority: EventPriority.CRITICAL,
        requiresAction: true
      }
    };

    await publisher.publish(criticalAlert);
    console.log(`📤 Published: ${criticalAlert.type} - ${criticalAlert.data.severity.toUpperCase()}`);
    
    await notificationService.processEvent(criticalAlert.type, criticalAlert);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo 4: Batch Event Publishing
    console.log('\n📦 Demo 4: Publishing Batch of Events');
    const batchEvents: SystemAlertEvent[] = [
      {
        id: 'batch-1-' + Date.now(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'database-service',
        version: '1.0',
        category: EventCategory.SYSTEM,
        data: {
          alertType: 'slow_query',
          severity: 'warning',
          message: 'Query execution time exceeded threshold',
          source: 'cosmos-db-primary',
          priority: EventPriority.NORMAL,
          requiresAction: false
        }
      },
      {
        id: 'batch-2-' + Date.now(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'storage-service',
        version: '1.0',
        category: EventCategory.SYSTEM,
        data: {
          alertType: 'disk_space',
          severity: 'info',
          message: 'Disk usage is at 75% capacity',
          source: 'storage-cluster-east',
          priority: EventPriority.LOW,
          requiresAction: false
        }
      }
    ];

    await publisher.publishBatch(batchEvents);
    console.log(`📤 Published batch of ${batchEvents.length} system alerts`);
    
    // Process each event through notification service
    for (const event of batchEvents) {
      await notificationService.processEvent(event.type, event);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo 5: Custom Notification Rule
    console.log('\n⚙️  Demo 5: Adding Custom Notification Rule');
    notificationService.addRule({
      id: 'demo-custom-rule',
      eventType: 'qc.issue.detected',
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
      template: {
        title: 'QC Issue Detected',
        message: 'QC issue found in order {{orderId}}: {{description}} (Severity: {{severity}})'
      },
      priority: EventPriority.HIGH,
      condition: (event: any) => {
        const qcEvent = event as any;
        return qcEvent.data?.severity === 'high' || qcEvent.data?.severity === 'critical';
      }
    });

    console.log('✅ Added custom notification rule for QC issues');
    console.log(`📊 Total notification rules: ${notificationService.getTotalRuleCount()}`);

    // Final status
    console.log('\n📈 Event-Driven Architecture Demo Results:');
    console.log('═'.repeat(50));
    
    const finalStatus = notificationService.getSubscriptionStatus();
    finalStatus.forEach((status: any) => {
      console.log(`📋 Event Type: ${status.eventType} | Rules: ${status.ruleCount}`);
    });
    
    console.log('\n✅ Demo completed successfully!');
    console.log('🎯 Key Features Demonstrated:');
    console.log('   • Event publishing (single & batch)');
    console.log('   • Service Bus message routing');
    console.log('   • Notification rule processing');
    console.log('   • Multi-channel notification delivery');
    console.log('   • Custom rule configuration');
    console.log('   • Event-driven architecture patterns');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up services...');
    await publisher.close();
    await subscriber.close();
    await notificationService.stop();
    console.log('✅ All services stopped cleanly');
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateEventDrivenArchitecture()
    .then(() => {
      console.log('\n🎉 Event-Driven Architecture Demo Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demo failed with error:', error);
      process.exit(1);
    });
}