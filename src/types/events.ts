/**
 * Event Types and Interfaces for Real-time Notifications System
 * Defines all event schemas for the appraisal management platform
 */

// Base event interface that all events must implement
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  version: string;
  correlationId?: string;
}

// Event priority levels for intelligent routing
export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Event categories for filtering and routing
export enum EventCategory {
  ORDER = 'order',
  QC = 'qc',
  VENDOR = 'vendor',
  SYSTEM = 'system',
  NOTIFICATION = 'notification'
}

// Order-related events
export interface OrderCreatedEvent extends BaseEvent {
  type: 'order.created';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    clientId: string;
    propertyAddress: string;
    appraisalType: string;
    priority: EventPriority;
    dueDate: Date;
    estimatedValue?: number;
  };
}

export interface OrderStatusChangedEvent extends BaseEvent {
  type: 'order.status.changed';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    reason?: string;
    priority: EventPriority;
  };
}

export interface OrderAssignedEvent extends BaseEvent {
  type: 'order.assigned';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    vendorId: string;
    vendorName: string;
    assignedBy: string;
    dueDate: Date;
    priority: EventPriority;
  };
}

export interface OrderCompletedEvent extends BaseEvent {
  type: 'order.completed';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    vendorId: string;
    completedDate: Date;
    deliveryMethod: string;
    priority: EventPriority;
    finalValue?: number;
  };
}

// QC-related events
export interface QCStartedEvent extends BaseEvent {
  type: 'qc.started';
  category: EventCategory.QC;
  data: {
    orderId: string;
    qcId: string;
    qcType: string[];
    startedBy: string;
    priority: EventPriority;
  };
}

export interface QCCompletedEvent extends BaseEvent {
  type: 'qc.completed';
  category: EventCategory.QC;
  data: {
    orderId: string;
    qcId: string;
    result: 'passed' | 'failed' | 'requires_review';
    score: number;
    issues: string[];
    completedBy: string;
    priority: EventPriority;
  };
}

export interface QCIssueDetectedEvent extends BaseEvent {
  type: 'qc.issue.detected';
  category: EventCategory.QC;
  data: {
    orderId: string;
    qcId: string;
    issueType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    requiresAction: boolean;
    priority: EventPriority;
  };
}

// Vendor-related events
export interface VendorPerformanceUpdatedEvent extends BaseEvent {
  type: 'vendor.performance.updated';
  category: EventCategory.VENDOR;
  data: {
    vendorId: string;
    vendorName: string;
    previousScore: number;
    newScore: number;
    ordersCompleted: number;
    averageDeliveryTime: number;
    priority: EventPriority;
  };
}

export interface VendorAvailabilityChangedEvent extends BaseEvent {
  type: 'vendor.availability.changed';
  category: EventCategory.VENDOR;
  data: {
    vendorId: string;
    vendorName: string;
    isAvailable: boolean;
    availableUntil?: Date;
    workloadCapacity: number;
    priority: EventPriority;
  };
}

// System events
export interface SystemAlertEvent extends BaseEvent {
  type: 'system.alert';
  category: EventCategory.SYSTEM;
  data: {
    alertType: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    source: string;
    priority: EventPriority;
    requiresAction: boolean;
  };
}

// Union type of all possible events
export type AppEvent = 
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | QCStartedEvent
  | QCCompletedEvent
  | QCIssueDetectedEvent
  | VendorPerformanceUpdatedEvent
  | VendorAvailabilityChangedEvent
  | SystemAlertEvent;

// Event handler interface
export interface EventHandler<T extends BaseEvent = BaseEvent> {
  handle(event: T): Promise<void>;
}

// Event publisher interface
export interface EventPublisher {
  publish(event: AppEvent): Promise<void>;
  publishBatch(events: AppEvent[]): Promise<void>;
}

// Event subscriber interface
export interface EventSubscriber {
  subscribe<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<void>;
  unsubscribe(eventType: string): Promise<void>;
}

// Notification target types
export enum NotificationChannel {
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  PUSH = 'push'
}

export interface NotificationTarget {
  channel: NotificationChannel;
  address: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// Notification message structure
export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  priority: EventPriority;
  category: EventCategory;
  targets: NotificationTarget[];
  data?: Record<string, any>;
  retryCount?: number;
  scheduledFor?: Date;
}