/**
 * Enhanced Notification Service with Persistent Rules
 * Integrates all notification components with advanced conditional logic and multi-tenant support
 */

import { EventEmitter } from 'events';
import { NotificationRuleRepository } from './notification-rule-repository.service';
import { NotificationConditionBuilder } from './condition-builder.service';
import { WebPubSubService } from './web-pubsub.service';
import { NotificationService, NotificationRule } from './core-notification.service';
import { 
  AppEvent,
  BaseEvent, 
  NotificationChannel,
  EventPriority
} from '../types/events';
import { 
  PersistedNotificationRule, 
  NotificationContext, 
  RuleExecutionLog, 
  ConditionalFunction 
} from '../types/persistent-notifications';
import { Logger } from '../utils/logger';

export interface PersistentNotificationServiceConfig {
  enableRealtime: boolean;
  enablePersistence: boolean;
  defaultTimeoutMs: number;
  maxRetries: number;
  enableMetrics: boolean;
}

export class PersistentNotificationService extends EventEmitter {
  private logger: Logger;
  private ruleRepository: NotificationRuleRepository;
  private conditionBuilder: NotificationConditionBuilder;
  private webPubSubService: WebPubSubService;
  private coreNotificationService: CoreNotificationService;
  private config: PersistentNotificationServiceConfig;

  constructor(
    ruleRepository: NotificationRuleRepository,
    conditionBuilder: NotificationConditionBuilder,
    webPubSubService: WebPubSubService,
    coreNotificationService: CoreNotificationService,
    config: Partial<PersistentNotificationServiceConfig> = {}
  ) {
    super();
    
    this.logger = new Logger('PersistentNotificationService');
    this.ruleRepository = ruleRepository;
    this.conditionBuilder = conditionBuilder;
    this.webPubSubService = webPubSubService;
    this.coreNotificationService = coreNotificationService;
    
    this.config = {
      enableRealtime: true,
      enablePersistence: true,
      defaultTimeoutMs: 5000,
      maxRetries: 3,
      enableMetrics: true,
      ...config
    };
  }

  // Initialize the service
  async initialize(): Promise<void> {
    try {
      // Initialize repository
      await this.ruleRepository.initialize();
      
      // Initialize WebSocket service if enabled
      if (this.config.enableRealtime) {
        await this.webPubSubService.initialize();
      }

      this.logger.info('Persistent notification service initialized', { config: this.config });
    } catch (error) {
      this.logger.error('Failed to initialize persistent notification service', { error });
      throw error;
    }
  }

  // Process event with persistent rules
  async processEvent(event: NotificationEvent, context: NotificationContext): Promise<void> {
    const startTime = Date.now();
    const logId = this.generateId();

    try {
      this.logger.info('Processing event with persistent rules', { 
        eventType: event.eventType, 
        eventId: event.eventId,
        context: { tenantId: context.tenantId, userId: context.userId }
      });

      // Get applicable rules from repository
      const rules = await this.ruleRepository.getRulesForContext(context, event.eventType);
      
      if (rules.length === 0) {
        this.logger.debug('No rules found for event', { eventType: event.eventType, context });
        return;
      }

      // Process each rule
      const results: Array<{ rule: PersistedNotificationRule; success: boolean; error?: any }> = [];
      
      for (const persistedRule of rules) {
        const ruleResult = await this.processRuleForEvent(persistedRule, event, context);
        results.push(ruleResult);
        
        // Log rule execution
        if (this.config.enableMetrics) {
          await this.logRuleExecution({
            id: `${logId}-${persistedRule.id}`,
            ruleId: persistedRule.id,
            eventId: event.eventId,
            context,
            executedAt: new Date(),
            executionResult: ruleResult.success ? 'success' : 'failure',
            executionTimeMs: Date.now() - startTime,
            conditionMatched: ruleResult.success,
            notificationsSent: ruleResult.success ? 1 : 0,
            error: ruleResult.error
          });
        }
      }

      // Emit processing complete event
      this.emit('eventProcessed', {
        event,
        context,
        rulesProcessed: rules.length,
        successCount: results.filter(r => r.success).length,
        totalExecutionTime: Date.now() - startTime
      });

    } catch (error) {
      this.logger.error('Failed to process event', { error, eventType: event.eventType, eventId: event.eventId });
      throw error;
    }
  }

  // Create a new persistent rule with conditional logic
  async createRule(
    name: string,
    eventType: EventType,
    conditionBuilder: (builder: NotificationConditionBuilder) => ConditionalFunction,
    template: {
      title: string;
      body: string;
      data?: Record<string, any>;
    },
    options: {
      tenantId?: string;
      userId?: string;
      roleId?: string;
      departmentId?: string;
      priority?: NotificationPriority;
      channels?: NotificationChannel[];
      validFrom?: Date;
      validUntil?: Date;
    } = {}
  ): Promise<string> {
    try {
      // Build the condition function
      const condition = conditionBuilder(this.conditionBuilder);
      
      // Create the persistent rule
      const rule: PersistedNotificationRule = {
        id: this.generateId(),
        name,
        eventType,
        condition,
        template,
        channels: options.channels || ['websocket'],
        priority: options.priority || 'normal',
        isActive: true,
        tenantId: options.tenantId,
        userId: options.userId,
        roleId: options.roleId,
        departmentId: options.departmentId,
        validFrom: options.validFrom,
        validUntil: options.validUntil,
        version: 1,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
      };

      const ruleId = await this.ruleRepository.createRule(rule);
      
      this.logger.info('Persistent notification rule created', { 
        ruleId, 
        name, 
        eventType, 
        tenantId: options.tenantId 
      });
      
      return ruleId;
    } catch (error) {
      this.logger.error('Failed to create persistent rule', { error, name, eventType });
      throw error;
    }
  }

  // Create a rule override for multi-tenant scenarios
  async createRuleOverride(
    parentRuleId: string,
    overrides: Partial<PersistedNotificationRule>,
    context: {
      tenantId?: string;
      userId?: string;
      roleId?: string;
      departmentId?: string;
    }
  ): Promise<string> {
    try {
      // Get parent rule
      const parentRule = await this.ruleRepository.getRuleById(parentRuleId);
      if (!parentRule) {
        throw new Error(`Parent rule not found: ${parentRuleId}`);
      }

      // Create override rule
      const overrideRule: PersistedNotificationRule = {
        ...parentRule,
        id: this.generateId(),
        parentRuleId,
        overrides,
        tenantId: context.tenantId,
        userId: context.userId,
        roleId: context.roleId,
        departmentId: context.departmentId,
        version: 1,
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
        updatedBy: 'system'
      };

      const ruleId = await this.ruleRepository.createRule(overrideRule);
      
      this.logger.info('Rule override created', { 
        ruleId, 
        parentRuleId, 
        context 
      });
      
      return ruleId;
    } catch (error) {
      this.logger.error('Failed to create rule override', { error, parentRuleId, context });
      throw error;
    }
  }

  // Update an existing rule
  async updateRule(
    ruleId: string,
    updates: Partial<PersistedNotificationRule>,
    updatedBy: string
  ): Promise<void> {
    try {
      await this.ruleRepository.updateRule(ruleId, updates, updatedBy);
      this.logger.info('Rule updated', { ruleId, updatedBy });
    } catch (error) {
      this.logger.error('Failed to update rule', { error, ruleId });
      throw error;
    }
  }

  // Delete (deactivate) a rule
  async deleteRule(ruleId: string, deletedBy: string): Promise<void> {
    try {
      await this.ruleRepository.deleteRule(ruleId, deletedBy);
      this.logger.info('Rule deleted', { ruleId, deletedBy });
    } catch (error) {
      this.logger.error('Failed to delete rule', { error, ruleId });
      throw error;
    }
  }

  // Get rules for management interface
  async getRules(filters: {
    tenantId?: string;
    userId?: string;
    roleId?: string;
    eventType?: string;
    isActive?: boolean;
  } = {}): Promise<PersistedNotificationRule[]> {
    try {
      return await this.ruleRepository.findRules(filters);
    } catch (error) {
      this.logger.error('Failed to get rules', { error, filters });
      throw error;
    }
  }

  // Get rule metrics and analytics
  async getRuleMetrics(ruleId: string, fromDate?: Date, toDate?: Date) {
    try {
      return await this.ruleRepository.getRuleMetrics(ruleId, fromDate, toDate);
    } catch (error) {
      this.logger.error('Failed to get rule metrics', { error, ruleId });
      throw error;
    }
  }

  // Send direct notification (bypassing rules)
  async sendDirectNotification(
    notification: Omit<NotificationDelivery, 'id' | 'timestamp'>,
    context: NotificationContext
  ): Promise<void> {
    try {
      const delivery: NotificationDelivery = {
        id: this.generateId(),
        timestamp: new Date(),
        ...notification
      };

      // Use existing core notification service
      const rule: NotificationRule = {
        eventType: 'direct' as EventType,
        condition: () => true,
        template: notification.template,
        channels: notification.channels || ['websocket'],
        priority: notification.priority || 'normal'
      };

      await this.coreNotificationService.processNotification(delivery, rule, context);
      
    } catch (error) {
      this.logger.error('Failed to send direct notification', { error, notification });
      throw error;
    }
  }

  // Private helper methods
  private async processRuleForEvent(
    rule: PersistedNotificationRule,
    event: NotificationEvent,
    context: NotificationContext
  ): Promise<{ rule: PersistedNotificationRule; success: boolean; error?: any }> {
    try {
      // Evaluate rule condition
      const conditionMet = await this.evaluateRuleCondition(rule, event, context);
      
      if (!conditionMet) {
        this.logger.debug('Rule condition not met', { ruleId: rule.id, eventType: event.eventType });
        return { rule, success: false };
      }

      // Create notification delivery
      const delivery: NotificationDelivery = {
        id: this.generateId(),
        eventId: event.eventId,
        timestamp: new Date(),
        template: this.processTemplate(rule.template, event, context),
        channels: rule.channels,
        priority: rule.priority,
        userId: context.userId,
        userRole: context.userRole,
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          tenantId: context.tenantId,
          departmentId: context.departmentId
        }
      };

      // Convert to core notification rule format
      const coreRule: NotificationRule = {
        eventType: rule.eventType,
        condition: () => true, // Already evaluated
        template: rule.template,
        channels: rule.channels,
        priority: rule.priority
      };

      // Process notification
      await this.coreNotificationService.processNotification(delivery, coreRule, context);

      return { rule, success: true };

    } catch (error) {
      this.logger.error('Failed to process rule for event', { error, ruleId: rule.id, eventType: event.eventType });
      return { rule, success: false, error };
    }
  }

  private async evaluateRuleCondition(
    rule: PersistedNotificationRule,
    event: NotificationEvent,
    context: NotificationContext
  ): Promise<boolean> {
    try {
      if (!rule.condition) return true;
      
      // Create evaluation context
      const evalContext = {
        event,
        context,
        rule,
        timestamp: new Date()
      };

      return await rule.condition(evalContext);
    } catch (error) {
      this.logger.error('Rule condition evaluation failed', { error, ruleId: rule.id });
      return false;
    }
  }

  private processTemplate(
    template: { title: string; body: string; data?: Record<string, any> },
    event: NotificationEvent,
    context: NotificationContext
  ): { title: string; body: string; data?: Record<string, any> } {
    try {
      // Simple template processing - replace variables
      const variables = {
        ...event.data,
        eventId: event.eventId,
        eventType: event.eventType,
        userId: context.userId,
        tenantId: context.tenantId,
        timestamp: new Date().toISOString()
      };

      const processText = (text: string): string => {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return variables[key as keyof typeof variables]?.toString() || match;
        });
      };

      return {
        title: processText(template.title),
        body: processText(template.body),
        data: { ...template.data, ...variables }
      };
    } catch (error) {
      this.logger.error('Template processing failed', { error, template });
      return template;
    }
  }

  private async logRuleExecution(log: RuleExecutionLog): Promise<void> {
    try {
      if (this.config.enableMetrics) {
        await this.ruleRepository.logExecution(log);
      }
    } catch (error) {
      this.logger.error('Failed to log rule execution', { error, logId: log.id });
      // Don't throw - logging failures shouldn't break notification processing
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}