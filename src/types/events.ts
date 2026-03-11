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
  NOTIFICATION = 'notification',
  ASSIGNMENT = 'assignment',
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
    /** Required so subscribers can perform tenant-scoped DB lookups without a cross-partition query. */
    tenantId: string;
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

// ── Auto-Assignment Workflow Events ──────────────────────────────────────────

/** Fired when an order linked to an engagement is created — triggers auto vendor selection. */
export interface EngagementOrderCreatedEvent extends BaseEvent {
  type: 'engagement.order.created';
  category: EventCategory.ASSIGNMENT;
  data: {
    engagementId: string;
    orderId: string;
    orderNumber: string;
    tenantId: string;
    productType: string;
    propertyAddress: string;
    propertyState: string;
    clientId: string;
    loanAmount: number;
    priority: EventPriority;
    dueDate: Date;
  };
}

/** Fired when a bid request is sent to a specific vendor. */
export interface VendorBidSentEvent extends BaseEvent {
  type: 'vendor.bid.sent';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    vendorName: string;
    bidId: string;
    expiresAt: Date;
    attemptNumber: number;
    priority: EventPriority;
  };
}

/** Fired when a vendor explicitly accepts a bid invitation. */
export interface VendorBidAcceptedEvent extends BaseEvent {
  type: 'vendor.bid.accepted';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    vendorName: string;
    bidId: string;
    acceptedAt: Date;
    priority: EventPriority;
  };
}

/** Fired when a vendor did not respond to a bid within the timeout window. */
export interface VendorBidTimedOutEvent extends BaseEvent {
  type: 'vendor.bid.timeout';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    bidId: string;
    attemptNumber: number;
    totalAttempts: number;
    priority: EventPriority;
  };
}

/** Fired when a vendor explicitly declines a bid. */
export interface VendorBidDeclinedEvent extends BaseEvent {
  type: 'vendor.bid.declined';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    vendorName: string;
    bidId: string;
    declineReason: string;
    attemptNumber: number;
    totalAttempts: number;
    priority: EventPriority;
  };
}

/** Fired when all vendors have timed out or declined — human intervention required. */
export interface VendorAssignmentExhaustedEvent extends BaseEvent {
  type: 'vendor.assignment.exhausted';
  category: EventCategory.ASSIGNMENT;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    attemptsCount: number;
    vendorsContacted: string[];
    priority: EventPriority;
    requiresHumanIntervention: true;
  };
}

/** Fired when an order is delivered and needs to enter the review queue. */
export interface ReviewAssignmentRequestedEvent extends BaseEvent {
  type: 'review.assignment.requested';
  category: EventCategory.ASSIGNMENT;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    priority: EventPriority;
    dueDate: Date;
  };
}

/** Fired when a review is assigned to a specific staff member. */
export interface ReviewAssignedEvent extends BaseEvent {
  type: 'review.assigned';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    reviewerId: string;
    reviewerName: string;
    attemptNumber: number;
    assignedAt: Date;
    expiresAt: Date;
    priority: EventPriority;
  };
}

/** Fired when a staff reviewer did not accept within the timeout window. */
export interface ReviewAssignmentTimedOutEvent extends BaseEvent {
  type: 'review.assignment.timeout';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    reviewerId: string;
    attemptNumber: number;
    totalAttempts: number;
    priority: EventPriority;
  };
}

/** Fired when all reviewers have timed out — human intervention required. */
export interface ReviewAssignmentExhaustedEvent extends BaseEvent {
  type: 'review.assignment.exhausted';
  category: EventCategory.ASSIGNMENT;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    attemptsCount: number;
    reviewersContacted: string[];
    priority: EventPriority;
    requiresHumanIntervention: true;
  };
}


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
  | SystemAlertEvent
  // Auto-assignment workflow events
  | EngagementOrderCreatedEvent
  | VendorBidSentEvent
  | VendorBidAcceptedEvent
  | VendorBidTimedOutEvent
  | VendorBidDeclinedEvent
  | VendorAssignmentExhaustedEvent
  | ReviewAssignmentRequestedEvent
  | ReviewAssignedEvent
  | ReviewAssignmentTimedOutEvent
  | ReviewAssignmentExhaustedEvent;

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