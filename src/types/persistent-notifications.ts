/**
 * Enhanced Notification Types with Persistence and Multi-tenant Support
 */

import { AppEvent, BaseEvent, NotificationMessage, NotificationChannel, EventPriority } from './events';

// Extended notification rule with persistence and multi-tenant support
export interface PersistedNotificationRule {
  // Core rule properties
  id: string;
  eventType: string;
  condition?: string | ConditionalFunction;
  channels: NotificationChannel[];
  template: {
    title: string;
    message: string;
  };
  priority?: EventPriority;
  throttleMs?: number;

  // Multi-tenant identifiers
  tenantId?: string;          // Client organization
  userId?: string;            // Specific user
  roleId?: string;            // User role
  departmentId?: string;      // Department/team
  
  // Rule metadata
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  isActive: boolean;
  version: number;
  
  // Inheritance and overrides
  parentRuleId?: string;      // Inherits from parent rule
  overrides?: Partial<PersistedNotificationRule>; // Override specific properties
  
  // Scheduling and validity
  validFrom?: Date;
  validUntil?: Date;
  schedule?: string;          // Cron expression for when rule is active
}

// Notification context for multi-tenant processing
export interface NotificationContext {
  tenantId: string;           // Client organization
  userId: string;             // Current user
  userRole: string;           // User role
  departmentId?: string;      // Department
  timezone?: string;          // User timezone
  preferences?: UserPreferences; // User notification preferences
  metadata?: Record<string, any>; // Additional context
}

// User notification preferences
export interface UserPreferences {
  channels: {
    websocket: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  schedules: {
    businessHoursOnly: boolean;
    quietHours: { start: string; end: string; };
    weekendsEnabled: boolean;
  };
  priorities: {
    low: boolean;
    normal: boolean;
    high: boolean;
    critical: boolean;
  };
}

// Conditional function type with context
export type ConditionalFunction = (event: AppEvent, context?: NotificationContext) => boolean;

// Rule execution log entry
export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  eventId: string;
  executedAt: Date;
  executionResult: 'success' | 'failed' | 'skipped';
  conditionMatched: boolean;
  notificationsSent: number;
  executionTimeMs: number;
  errorMessage?: string;
  context?: NotificationContext;
}

// Rule creation request
export interface CreateRuleRequest {
  eventType: string;
  condition?: string;
  channels: NotificationChannel[];
  template: {
    title: string;
    message: string;
  };
  priority?: EventPriority;
  throttleMs?: number;
  validFrom?: Date;
  validUntil?: Date;
  schedule?: string;
}

// Rule metrics
export interface RuleMetrics {
  ruleId: string;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  conditionMatchRate: number;
  notificationsSent: number;
  lastExecuted: Date;
  contextBreakdown: {
    byTenant: Record<string, number>;
    byRole: Record<string, number>;
    byChannel: Record<string, number>;
  };
}

// Conditional logic builder interfaces
export interface FieldCondition {
  equals(value: any): ConditionalFunction;
  notEquals(value: any): ConditionalFunction;
  greaterThan(value: number): ConditionalFunction;
  lessThan(value: number): ConditionalFunction;
  contains(value: string): ConditionalFunction;
  matches(pattern: string): ConditionalFunction;
  in(values: any[]): ConditionalFunction;
  exists(): ConditionalFunction;
}

export interface ConditionalLogicBuilder {
  field(path: string): FieldCondition;
  and(...conditions: ConditionalFunction[]): ConditionalFunction;
  or(...conditions: ConditionalFunction[]): ConditionalFunction;
  not(condition: ConditionalFunction): ConditionalFunction;
  custom(fn: ConditionalFunction): ConditionalFunction;
  
  // Time-based conditions
  inTimeRange(startHour: number, endHour: number): ConditionalFunction;
  onWeekdays(): ConditionalFunction;
  onWeekends(): ConditionalFunction;
  
  // Context-based conditions
  forTenant(tenantId: string): ConditionalFunction;
  forRole(role: string): ConditionalFunction;
  forUser(userId: string): ConditionalFunction;
}