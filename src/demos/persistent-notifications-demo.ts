/**
 * Persistent Notifications Demo
 * Demonstrates the complete persistent notification system with rule-based processing
 */

import { CosmosDbService } from '../services/cosmos-db.service.js';
import { NotificationRuleRepository } from '../services/notification-rule-repository.service.js';
import { NotificationConditionBuilder } from '../services/condition-builder.service.js';
import { NotificationService } from '../services/core-notification.service.js';
import { PersistedNotificationRule, NotificationContext } from '../types/persistent-notifications.js';
import { AppEvent, NotificationChannel, EventPriority } from '../types/events.js';
import { Logger } from '../utils/logger.js';

export class PersistentNotificationDemo {
  private logger: Logger;
  private cosmosDb: CosmosDbService;
  private repository: NotificationRuleRepository;
  private conditionBuilder: NotificationConditionBuilder;
  private notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('PersistentNotificationDemo');
    this.cosmosDb = new CosmosDbService();
    this.repository = new NotificationRuleRepository(this.cosmosDb);
    this.conditionBuilder = new NotificationConditionBuilder();
    this.notificationService = new NotificationService({});
  }

  async runDemo(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Persistent Notification System Demo');

      // Initialize services
      await this.initializeServices();

      // Create sample rules
      await this.createSampleRules();

      // Test rule processing
      await this.testRuleProcessing();

      // Demonstrate multi-tenant scenarios
      await this.demonstrateMultiTenant();

      // Show metrics and analytics
      await this.showMetrics();

      this.logger.info('✅ Persistent Notification Demo completed successfully');

    } catch (error) {
      this.logger.error('❌ Demo failed', { error });
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    this.logger.info('📋 Initializing services...');

    try {
      // Initialize repository
      await this.repository.initialize();
      this.logger.info('  ✓ Repository initialized');

    } catch (error) {
      this.logger.error('Failed to initialize services', { error });
      throw error;
    }
  }

  private async createSampleRules(): Promise<void> {
    this.logger.info('📝 Creating sample notification rules...');

    // Rule 1: Critical appraisal order events
    const criticalOrderRule: PersistedNotificationRule = {
      id: 'rule-critical-orders',
      ruleName: 'Critical Order Notifications',
      eventType: 'appraisal-order-created',
      condition: this.conditionBuilder
        .field('priority').equals('high')
        .and()
        .field('value').greaterThan(500000)
        .build(),
      template: {
        title: 'Critical Appraisal Order - {{orderId}}',
        message: 'High priority order created for ${{value}} - requires immediate attention'
      },
      channels: ['websocket' as NotificationChannel, 'email' as NotificationChannel],
      priority: 'critical' as EventPriority,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'system',
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    await this.repository.createRule(criticalOrderRule);
    this.logger.info('  ✓ Critical order rule created');

    // Rule 2: Vendor assignment notifications (tenant-specific)
    const vendorAssignmentRule: PersistedNotificationRule = {
      id: 'rule-vendor-assignment',
      ruleName: 'Vendor Assignment Notifications',
      eventType: 'vendor-assigned',
      tenantId: 'tenant-bank-a',
      condition: this.conditionBuilder
        .field('vendorType').equals('appraiser')
        .and()
        .field('urgency').notEquals('low')
        .build(),
      template: {
        title: 'Vendor Assigned - {{orderId}}',
        message: 'Appraiser {{vendorName}} assigned to order {{orderId}}'
      },
      channels: ['websocket' as NotificationChannel],
      priority: 'normal' as EventPriority,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'tenant-admin',
      updatedAt: new Date(),
      updatedBy: 'tenant-admin'
    };

    await this.repository.createRule(vendorAssignmentRule);
    this.logger.info('  ✓ Vendor assignment rule created');

    // Rule 3: Quality control alerts (role-based)
    const qcAlertRule: PersistedNotificationRule = {
      id: 'rule-qc-alerts',
      ruleName: 'Quality Control Alerts',
      eventType: 'qc-review-completed',
      roleId: 'quality-manager',
      condition: this.conditionBuilder
        .field('qcScore').lessThan(85)
        .or()
        .field('hasFlags').equals(true)
        .build(),
      template: {
        title: 'QC Alert - Order {{orderId}}',
        message: 'Quality review completed with score {{qcScore}}% - review required'
      },
      channels: ['websocket' as NotificationChannel, 'email' as NotificationChannel],
      priority: 'high' as EventPriority,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'qc-system',
      updatedAt: new Date(),
      updatedBy: 'qc-system'
    };

    await this.repository.createRule(qcAlertRule);
    this.logger.info('  ✓ QC alert rule created');

    // Rule 4: Time-based deadline warnings
    const deadlineRule: PersistedNotificationRule = {
      id: 'rule-deadline-warnings',
      ruleName: 'Deadline Warnings',
      eventType: 'deadline-approaching',
      condition: this.conditionBuilder
        .timeCondition()
        .hoursUntil('dueDate')
        .lessThanOrEqual(24)
        .and()
        .field('status').notEquals('completed')
        .build(),
      template: {
        title: 'Deadline Alert - {{orderId}}',
        message: 'Order {{orderId}} due in {{hoursRemaining}} hours - status: {{status}}'
      },
      channels: ['websocket' as NotificationChannel, 'sms' as NotificationChannel],
      priority: 'high' as EventPriority,
      isActive: true,
      schedule: '0 */4 * * *', // Every 4 hours
      version: 1,
      createdAt: new Date(),
      createdBy: 'system',
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    await this.repository.createRule(deadlineRule);
    this.logger.info('  ✓ Deadline warning rule created');

    this.logger.info('📝 Sample rules created successfully');
  }

  private async testRuleProcessing(): Promise<void> {
    this.logger.info('🧪 Testing rule processing...');

    // Test event 1: Critical order creation
    const criticalOrderEvent: AppEvent = {
      eventId: 'event-critical-001',
      eventType: 'appraisal-order-created',
      timestamp: new Date(),
      source: 'order-service',
      data: {
        orderId: 'ORD-123456',
        priority: 'high',
        value: 750000,
        propertyType: 'commercial',
        clientId: 'client-bank-a'
      },
      metadata: {
        correlationId: 'corr-001',
        version: '1.0'
      }
    };

    const context: NotificationContext = {
      tenantId: 'tenant-bank-a',
      userId: 'user-manager-001',
      userRole: 'order-manager',
      departmentId: 'dept-operations'
    };

    await this.processEventWithRules(criticalOrderEvent, context);

    // Test event 2: QC review with low score
    const qcEvent: AppEvent = {
      eventId: 'event-qc-002',
      eventType: 'qc-review-completed',
      timestamp: new Date(),
      source: 'qc-service',
      data: {
        orderId: 'ORD-789012',
        qcScore: 72,
        hasFlags: true,
        reviewerId: 'qc-reviewer-001',
        flags: ['incomplete-photos', 'missing-documentation']
      },
      metadata: {
        correlationId: 'corr-002',
        version: '1.0'
      }
    };

    const qcContext: NotificationContext = {
      tenantId: 'tenant-bank-a',
      userId: 'user-qc-manager-001',
      userRole: 'quality-manager',
      departmentId: 'dept-quality'
    };

    await this.processEventWithRules(qcEvent, qcContext);

    this.logger.info('🧪 Rule processing tests completed');
  }

  private async demonstrateMultiTenant(): Promise<void> {
    this.logger.info('🏢 Demonstrating multi-tenant scenarios...');

    // Create tenant-specific override for critical order rule
    const parentRule = await this.repository.getRuleById('rule-critical-orders');
    if (parentRule) {
      const tenantOverrideRule: PersistedNotificationRule = {
        ...parentRule,
        id: 'rule-critical-orders-tenant-b',
        parentRuleId: 'rule-critical-orders',
        tenantId: 'tenant-bank-b',
        overrides: {
          template: {
            title: 'URGENT: Critical Order - {{orderId}}',
            message: 'BANK B PROTOCOL: High priority order ${{value}} requires VP approval'
          },
          channels: ['websocket' as NotificationChannel, 'email' as NotificationChannel, 'sms' as NotificationChannel],
          priority: 'critical' as EventPriority
        },
        version: 1,
        createdAt: new Date(),
        createdBy: 'tenant-b-admin',
        updatedAt: new Date(),
        updatedBy: 'tenant-b-admin'
      };

      await this.repository.createRule(tenantOverrideRule);
      this.logger.info('  ✓ Tenant B override rule created');

      // Test the override
      const tenantBEvent: AppEvent = {
        eventId: 'event-tenant-b-001',
        eventType: 'appraisal-order-created',
        timestamp: new Date(),
        source: 'tenant-b-service',
        data: {
          orderId: 'ORD-BANK-B-001',
          priority: 'high',
          value: 600000,
          propertyType: 'residential'
        },
        metadata: {
          correlationId: 'corr-tenant-b-001',
          version: '1.0'
        }
      };

      const tenantBContext: NotificationContext = {
        tenantId: 'tenant-bank-b',
        userId: 'user-manager-b-001',
        userRole: 'order-manager',
        departmentId: 'dept-operations'
      };

      await this.processEventWithRules(tenantBEvent, tenantBContext);
    }

    this.logger.info('🏢 Multi-tenant demonstration completed');
  }

  private async showMetrics(): Promise<void> {
    this.logger.info('📊 Showing rule metrics and analytics...');

    const ruleIds = [
      'rule-critical-orders',
      'rule-vendor-assignment',
      'rule-qc-alerts',
      'rule-deadline-warnings'
    ];

    for (const ruleId of ruleIds) {
      try {
        const metrics = await this.repository.getRuleMetrics(ruleId);
        this.logger.info(`📈 Metrics for ${ruleId}:`, {
          executionCount: metrics.executionCount,
          successRate: `${metrics.successRate.toFixed(1)}%`,
          avgExecutionTime: `${metrics.averageExecutionTime.toFixed(2)}ms`,
          conditionMatchRate: `${metrics.conditionMatchRate.toFixed(1)}%`,
          notificationsSent: metrics.notificationsSent,
          lastExecuted: metrics.lastExecuted.toISOString()
        });
      } catch (error) {
        this.logger.warn(`Could not get metrics for ${ruleId}: ${error}`);
      }
    }

    // Show tenant rules
    const tenantARules = await this.repository.getTenantRules('tenant-bank-a');
    this.logger.info(`📋 Tenant A has ${tenantARules.length} active rules`);

    const tenantBRules = await this.repository.getTenantRules('tenant-bank-b');
    this.logger.info(`📋 Tenant B has ${tenantBRules.length} active rules`);

    // Show role-based rules
    const qualityManagerRules = await this.repository.getRoleRules('quality-manager');
    this.logger.info(`👤 Quality Manager role has ${qualityManagerRules.length} rules`);

    this.logger.info('📊 Metrics and analytics completed');
  }

  private async processEventWithRules(event: AppEvent, context: NotificationContext): Promise<void> {
    this.logger.info('⚡ Processing event with persistent rules:', {
      eventType: event.eventType,
      eventId: event.eventId,
      tenantId: context.tenantId,
      userRole: context.userRole
    });

    try {
      // Get applicable rules
      const rules = await this.repository.getRulesForContext(context, event.eventType);
      this.logger.info(`Found ${rules.length} applicable rules`);

      // Process each rule
      for (const rule of rules) {
        await this.processRuleForEvent(rule, event, context);
      }

    } catch (error) {
      this.logger.error('Failed to process event with rules', { error, eventId: event.eventId });
    }
  }

  private async processRuleForEvent(
    rule: PersistedNotificationRule,
    event: AppEvent,
    context: NotificationContext
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(`  🔍 Evaluating rule: ${rule.ruleName || rule.id}`);

      // Evaluate condition
      const conditionMet = await this.evaluateCondition(rule, event, context);
      
      if (!conditionMet) {
        this.logger.info(`  ⏭️  Rule condition not met, skipping`);
        return;
      }

      this.logger.info(`  ✅ Rule condition met, sending notification`);

      // Process template
      const processedTemplate = this.processTemplate(rule.template, event, context);

      // Log the notification (in real implementation, this would send via channels)
      this.logger.info(`  📨 Notification sent:`, {
        title: processedTemplate.title,
        message: processedTemplate.message,
        channels: rule.channels,
        priority: rule.priority
      });

      // Log execution
      const executionTime = Date.now() - startTime;
      await this.repository.logExecution({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        eventId: event.eventId,
        context,
        executedAt: new Date(),
        executionResult: 'success',
        executionTimeMs: executionTime,
        conditionMatched: true,
        notificationsSent: rule.channels.length
      });

    } catch (error) {
      this.logger.error('Failed to process rule for event', { 
        error, 
        ruleId: rule.id, 
        eventId: event.eventId 
      });

      // Log failed execution
      await this.repository.logExecution({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        eventId: event.eventId,
        context,
        executedAt: new Date(),
        executionResult: 'failed',
        executionTimeMs: Date.now() - startTime,
        conditionMatched: false,
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async evaluateCondition(
    rule: PersistedNotificationRule,
    event: AppEvent,
    context: NotificationContext
  ): Promise<boolean> {
    try {
      if (!rule.condition || typeof rule.condition === 'string') {
        return true; // No condition or string-based condition (simplified)
      }

      // Create evaluation context
      const evalContext = {
        event,
        context,
        rule,
        timestamp: new Date()
      };

      return await rule.condition(evalContext);
    } catch (error) {
      this.logger.error('Condition evaluation failed', { error, ruleId: rule.id });
      return false;
    }
  }

  private processTemplate(
    template: { title: string; message: string },
    event: AppEvent,
    context: NotificationContext
  ): { title: string; message: string } {
    try {
      const variables = {
        ...event.data,
        eventId: event.eventId,
        eventType: event.eventType,
        userId: context.userId,
        tenantId: context.tenantId,
        userRole: context.userRole,
        timestamp: new Date().toISOString()
      };

      const processText = (text: string): string => {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return variables[key as keyof typeof variables]?.toString() || match;
        });
      };

      return {
        title: processText(template.title),
        message: processText(template.message)
      };
    } catch (error) {
      this.logger.error('Template processing failed', { error, template });
      return template;
    }
  }
}

// Export demo runner function
export async function runPersistentNotificationDemo(): Promise<void> {
  const demo = new PersistentNotificationDemo();
  await demo.runDemo();
}