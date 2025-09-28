/**
 * Notification Rule Repository
 * Handles persistence and querying of notification rules
 * In-memory implementation for demonstration - would use Cosmos DB in production
 */

import { CosmosDbService } from './cosmos-db.service';
import { PersistedNotificationRule, NotificationContext, RuleMetrics, RuleExecutionLog } from '../types/persistent-notifications';
import { Logger } from '../utils/logger';

export class NotificationRuleRepository {
  private cosmosDb: CosmosDbService;
  private logger: Logger;
  
  // In-memory storage for demonstration
  private rules: Map<string, PersistedNotificationRule> = new Map();
  private logs: Map<string, RuleExecutionLog> = new Map();

  constructor(cosmosDbService: CosmosDbService) {
    this.cosmosDb = cosmosDbService;
    this.logger = new Logger('NotificationRuleRepository');
  }

  // Initialize the repository
  async initialize(): Promise<void> {
    try {
      // Initialize with some sample rules for demonstration
      this.logger.info('Notification rule repository initialized');
    } catch (error) {
      this.logger.error('Failed to initialize notification repository', { error });
      throw error;
    }
  }

  // Create a new rule
  async createRule(rule: PersistedNotificationRule): Promise<string> {
    try {
      this.rules.set(rule.id, { ...rule });
      this.logger.info('Notification rule created', { ruleId: rule.id, tenantId: rule.tenantId });
      
      return rule.id;
    } catch (error) {
      this.logger.error('Failed to create notification rule', { error, ruleId: rule.id });
      throw error;
    }
  }

  // Get rule by ID
  async getRuleById(ruleId: string): Promise<PersistedNotificationRule | null> {
    try {
      const rule = this.rules.get(ruleId);
      return rule || null;
    } catch (error) {
      this.logger.error('Failed to get rule by ID', { error, ruleId });
      throw error;
    }
  }

  // Find rules based on query criteria
  async findRules(query: Partial<PersistedNotificationRule & { eventType: string }>): Promise<PersistedNotificationRule[]> {
    try {
      const allRules = Array.from(this.rules.values());
      const filteredRules = allRules.filter(rule => {
        // Check if rule is active
        if (!rule.isActive) return false;

        // Check event type
        if (query.eventType && rule.eventType !== query.eventType) return false;

        // Check tenant match (include rules with null tenantId for global rules)
        if (query.tenantId && rule.tenantId && rule.tenantId !== query.tenantId) return false;

        // Check user match (include rules with null userId for role-based rules)
        if (query.userId && rule.userId && rule.userId !== query.userId) return false;

        // Check role match (include rules with null roleId for global rules)
        if (query.roleId && rule.roleId && rule.roleId !== query.roleId) return false;

        // Check department match (include rules with null departmentId)
        if (query.departmentId && rule.departmentId && rule.departmentId !== query.departmentId) return false;

        // Check time validity
        const now = new Date();
        if (rule.validFrom && rule.validFrom > now) return false;
        if (rule.validUntil && rule.validUntil < now) return false;

        return true;
      });

      return this.sortRulesByPriority(filteredRules);
    } catch (error) {
      this.logger.error('Failed to find rules', { error, query });
      throw error;
    }
  }

  // Update an existing rule
  async updateRule(ruleId: string, updates: Partial<PersistedNotificationRule>, updatedBy: string): Promise<void> {
    try {
      const existingRule = await this.getRuleById(ruleId);
      if (!existingRule) {
        throw new Error(`Rule not found: ${ruleId}`);
      }

      const updatedRule = {
        ...existingRule,
        ...updates,
        updatedBy,
        updatedAt: new Date(),
        version: existingRule.version + 1
      };

      this.rules.set(ruleId, updatedRule);
      this.logger.info('Notification rule updated', { ruleId, updatedBy, version: updatedRule.version });
    } catch (error) {
      this.logger.error('Failed to update notification rule', { error, ruleId });
      throw error;
    }
  }

  // Soft delete a rule
  async deleteRule(ruleId: string, deletedBy: string): Promise<void> {
    try {
      await this.updateRule(ruleId, { 
        isActive: false, 
        updatedBy: deletedBy,
        updatedAt: new Date()
      }, deletedBy);
      
      this.logger.info('Notification rule deleted (soft delete)', { ruleId, deletedBy });
    } catch (error) {
      this.logger.error('Failed to delete notification rule', { error, ruleId });
      throw error;
    }
  }

  // Get rules for a specific context with inheritance
  async getRulesForContext(context: NotificationContext, eventType: string): Promise<PersistedNotificationRule[]> {
    try {
      // Find matching rules based on context
      const queryParams: Partial<PersistedNotificationRule & { eventType: string }> = {
        eventType,
        tenantId: context.tenantId,
        userId: context.userId,
        roleId: context.userRole
      };

      // Only add departmentId if it exists
      if (context.departmentId) {
        queryParams.departmentId = context.departmentId;
      }

      const baseRules = await this.findRules(queryParams);

      // Apply inheritance and overrides
      const resolvedRules: PersistedNotificationRule[] = [];

      for (const rule of baseRules) {
        if (rule.parentRuleId && rule.overrides) {
          // This is an override rule - merge with parent
          const parentRule = baseRules.find(r => r.id === rule.parentRuleId);
          if (parentRule) {
            const mergedRule = this.mergeRuleOverrides(parentRule, rule);
            resolvedRules.push(mergedRule);
          }
        } else if (!rule.parentRuleId) {
          // This is a base rule
          resolvedRules.push(rule);
        }
      }

      // Remove duplicates and sort by priority
      const uniqueRules = this.deduplicateRules(resolvedRules);
      return this.sortRulesByPriority(uniqueRules);
    } catch (error) {
      this.logger.error('Failed to get rules for context', { error, context, eventType });
      throw error;
    }
  }

  // Log rule execution
  async logExecution(log: RuleExecutionLog): Promise<void> {
    try {
      this.logs.set(log.id, { ...log });
      this.logger.debug('Rule execution logged', { logId: log.id, ruleId: log.ruleId });
    } catch (error) {
      this.logger.error('Failed to log rule execution', { error, logId: log.id });
      // Don't throw - logging failures shouldn't break rule execution
    }
  }

  // Get rule metrics
  async getRuleMetrics(ruleId: string, fromDate?: Date, toDate?: Date): Promise<RuleMetrics> {
    try {
      const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const to = toDate || new Date();

      const allLogs = Array.from(this.logs.values());
      const ruleLogs = allLogs.filter(log => 
        log.ruleId === ruleId &&
        log.executedAt >= from &&
        log.executedAt <= to
      );

      if (ruleLogs.length === 0) {
        return this.createEmptyMetrics(ruleId);
      }

      const executionCount = ruleLogs.length;
      const successCount = ruleLogs.filter(log => log.executionResult === 'success').length;
      const conditionMatches = ruleLogs.filter(log => log.conditionMatched).length;
      const totalNotificationsSent = ruleLogs.reduce((sum, log) => sum + log.notificationsSent, 0);
      const avgExecutionTime = ruleLogs.reduce((sum, log) => sum + log.executionTimeMs, 0) / executionCount;
      const lastExecuted = Math.max(...ruleLogs.map(log => log.executedAt.getTime()));

      // Get context breakdown
      const contextBreakdown = this.calculateContextBreakdown(ruleLogs);

      return {
        ruleId,
        executionCount,
        successRate: (successCount / executionCount) * 100,
        averageExecutionTime: avgExecutionTime,
        conditionMatchRate: (conditionMatches / executionCount) * 100,
        notificationsSent: totalNotificationsSent,
        lastExecuted: new Date(lastExecuted),
        contextBreakdown
      };
    } catch (error) {
      this.logger.error('Failed to get rule metrics', { error, ruleId });
      return this.createEmptyMetrics(ruleId);
    }
  }

  // Get all rules for a tenant
  async getTenantRules(tenantId: string): Promise<PersistedNotificationRule[]> {
    return this.findRules({ tenantId });
  }

  // Get all rules for a user
  async getUserRules(userId: string): Promise<PersistedNotificationRule[]> {
    return this.findRules({ userId });
  }

  // Get all rules for a role
  async getRoleRules(roleId: string): Promise<PersistedNotificationRule[]> {
    return this.findRules({ roleId });
  }

  // Private helper methods
  private mergeRuleOverrides(parentRule: PersistedNotificationRule, overrideRule: PersistedNotificationRule): PersistedNotificationRule {
    return {
      ...parentRule,
      ...overrideRule.overrides,
      id: overrideRule.id,
      parentRuleId: parentRule.id,
      version: overrideRule.version,
      updatedAt: overrideRule.updatedAt,
      updatedBy: overrideRule.updatedBy
    };
  }

  private deduplicateRules(rules: PersistedNotificationRule[]): PersistedNotificationRule[] {
    const seen = new Set<string>();
    return rules.filter(rule => {
      if (seen.has(rule.id)) {
        return false;
      }
      seen.add(rule.id);
      return true;
    });
  }

  private sortRulesByPriority(rules: PersistedNotificationRule[]): PersistedNotificationRule[] {
    const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
    
    return rules.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return a.createdAt.getTime() - b.createdAt.getTime(); // Earlier created first
    });
  }

  private calculateContextBreakdown(logs: RuleExecutionLog[]): {
    byTenant: Record<string, number>;
    byRole: Record<string, number>;
    byChannel: Record<string, number>;
  } {
    const breakdown = {
      byTenant: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byChannel: {} as Record<string, number>
    };

    logs.forEach(log => {
      // Tenant breakdown
      const tenantId = log.context?.tenantId || 'unknown';
      breakdown.byTenant[tenantId] = (breakdown.byTenant[tenantId] || 0) + 1;

      // Role breakdown
      const role = log.context?.userRole || 'unknown';
      breakdown.byRole[role] = (breakdown.byRole[role] || 0) + 1;

      // Channel breakdown - for now just use a sample channel
      const defaultChannel = 'websocket';
      breakdown.byChannel[defaultChannel] = (breakdown.byChannel[defaultChannel] || 0) + 1;
    });

    return breakdown;
  }

  private createEmptyMetrics(ruleId: string): RuleMetrics {
    return {
      ruleId,
      executionCount: 0,
      successRate: 0,
      averageExecutionTime: 0,
      conditionMatchRate: 0,
      notificationsSent: 0,
      lastExecuted: new Date(0),
      contextBreakdown: {
        byTenant: {},
        byRole: {},
        byChannel: {}
      }
    };
  }
}