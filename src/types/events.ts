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

/** Fired when an order report has been delivered to the client portal. */
export interface OrderDeliveredEvent extends BaseEvent {
  type: 'order.delivered';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    orderNumber: string;
    /** Engagement this order belongs to — used for engagement roll-up. */
    engagementId?: string;
    tenantId: string;
    clientId: string;
    deliveredAt: Date;
    deliveryMethod: 'portal' | 'email' | 'manual';
    priority: EventPriority;
  };
}

/** Fired when an engagement's derived status changes (e.g. all orders delivered → COMPLETED). */
export interface EngagementStatusChangedEvent extends BaseEvent {
  type: 'engagement.status.changed';
  category: EventCategory.ORDER;
  data: {
    engagementId: string;
    tenantId: string;
    previousStatus: string;
    newStatus: string;
    /** Human-readable reason for the transition. */
    reason: string;
    priority: EventPriority;
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

/**
 * Fired by the AI QC gate after scoring a submitted order.
 * The 'decision' field drives downstream routing.
 */
export interface QCAIScoredEvent extends BaseEvent {
  type: 'qc.ai.scored';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    score: number;
    /** auto_pass → skip human QC; needs_review → route to analyst; needs_supervision → route + flag supervisor. */
    decision: 'auto_pass' | 'needs_review' | 'needs_supervision';
    findings: Array<{ category: string; severity: string; description: string }>;
    passFailStatus: 'pass' | 'fail' | 'conditional';
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
    /** Product being ordered — forwarded to matching engine eligibility gate */
    productId?: string;
    /** Vendor must support ALL of these capabilities to be eligible */
    requiredCapabilities?: string[];
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

/**
 * Fired when an internal staff member is assigned directly to an order
 * (bypasses the bid loop entirely).
 */
export interface VendorStaffAssignedEvent extends BaseEvent {
  type: 'vendor.staff.assigned';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    vendorName: string;
    staffRole: 'appraiser_internal' | 'inspector_internal' | 'reviewer' | 'supervisor';
    assignedAt: Date;
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
// ── Engagement Letter Events ─────────────────────────────────────────────────

/** Fired when an engagement letter is auto-generated and emailed to the vendor for signing. */
export interface EngagementLetterSentEvent extends BaseEvent {
  type: 'engagement.letter.sent';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    letterId: string;
    signingToken: string;
    expiresAt: Date;
    priority: EventPriority;
  };
}

/** Fired when the vendor accepts the engagement letter via the one-time signed URL. */
export interface EngagementLetterSignedEvent extends BaseEvent {
  type: 'engagement.letter.signed';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    letterId: string;
    signedAt: Date;
    ipAddress?: string;
    priority: EventPriority;
  };
}

/** Fired when the vendor declines the engagement letter. */
export interface EngagementLetterDeclinedEvent extends BaseEvent {
  type: 'engagement.letter.declined';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    vendorId: string;
    letterId: string;
    declinedAt: Date;
    reason?: string;
    priority: EventPriority;
  };
}

// ── Axiom Evaluation Events ──────────────────────────────────────────────────

/** Fired immediately after an order is submitted to the Axiom pipeline. */
export interface AxiomEvaluationSubmittedEvent extends BaseEvent {
  type: 'axiom.evaluation.submitted';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    evaluationId: string;
    pipelineJobId: string;
    priority: EventPriority;
  };
}

/** Fired when Axiom completes the evaluation (published from the webhook handler). */
export interface AxiomEvaluationCompletedEvent extends BaseEvent {
  type: 'axiom.evaluation.completed';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    evaluationId: string;
    pipelineJobId: string;
    overallRiskScore: number;
    overallDecision: 'ACCEPT' | 'CONDITIONAL' | 'REJECT' | 'UNKNOWN';
    status: 'completed' | 'failed';
    priority: EventPriority;
  };
}

// ── Review SLA Events ────────────────────────────────────────────────────────

/** Fired at configurable % threshold (default 80%) of SLA elapsed — early warning. */
export interface ReviewSLAWarningEvent extends BaseEvent {
  type: 'review.sla.warning';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    reviewerId: string;
    /** Percentage of SLA that has elapsed (0-100). */
    percentElapsed: number;
    targetDate: Date;
    remainingMinutes: number;
    priority: EventPriority;
  };
}

/** Fired when the review SLA deadline has been missed. */
export interface ReviewSLABreachedEvent extends BaseEvent {
  type: 'review.sla.breached';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    qcReviewId: string;
    reviewerId: string;
    targetDate: Date;
    minutesOverdue: number;
    priority: EventPriority;
  };
}

// ── Broadcast Bid Round Events ────────────────────────────────────────────────

/** Fired when a broadcast bid round is opened (N vendors contacted simultaneously). */
export interface VendorBidRoundStartedEvent extends BaseEvent {
  type: 'vendor.bid.round.started';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    roundNumber: number;
    vendorIds: string[];
    expiresAt: Date;
    priority: EventPriority;
  };
}

/** Fired when a broadcast round expires with no acceptance. */
export interface VendorBidRoundExhaustedEvent extends BaseEvent {
  type: 'vendor.bid.round.exhausted';
  category: EventCategory.VENDOR;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    roundNumber: number;
    vendorIds: string[];
    priority: EventPriority;
  };
}

/**
 * Fired when an order requires supervisory co-sign before it can be delivered.
 * Published by the supervisory review service or the orchestrator when
 * `tenantAutomationConfig.supervisoryReviewForAllOrders === true`.
 */
export interface SupervisionRequiredEvent extends BaseEvent {
  type: 'supervision.required';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    /** The staff member assigned to co-sign. */
    supervisorId: string;
    /** Why supervision was triggered (e.g. 'high_value', 'policy', 'ai_flag'). */
    reason: string;
    requestedBy: string;
    requestedAt: Date;
    priority: EventPriority;
  };
}

/**
 * Fired when a supervisor co-signs an order, completing the supervisory review.
 */
export interface SupervisionCosignedEvent extends BaseEvent {
  type: 'supervision.cosigned';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    supervisorId: string;
    supervisorName: string;
    cosignedAt: Date;
    notes?: string;
    priority: EventPriority;
  };
}

export type AppEvent = 
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | OrderDeliveredEvent
  | EngagementStatusChangedEvent
  | QCStartedEvent
  | QCCompletedEvent
  | QCIssueDetectedEvent
  | QCAIScoredEvent
  | VendorPerformanceUpdatedEvent
  | VendorAvailabilityChangedEvent
  | SystemAlertEvent
  // Auto-assignment workflow events
  | EngagementOrderCreatedEvent
  | VendorBidSentEvent
  | VendorStaffAssignedEvent
  | VendorBidAcceptedEvent
  | VendorBidTimedOutEvent
  | VendorBidDeclinedEvent
  | VendorAssignmentExhaustedEvent
  | ReviewAssignmentRequestedEvent
  | ReviewAssignedEvent
  | ReviewAssignmentTimedOutEvent
  | ReviewAssignmentExhaustedEvent
  | SupervisionRequiredEvent
  | SupervisionCosignedEvent
  // Engagement letter events
  | EngagementLetterSentEvent
  | EngagementLetterSignedEvent
  | EngagementLetterDeclinedEvent
  // Axiom evaluation events
  | AxiomEvaluationSubmittedEvent
  | AxiomEvaluationCompletedEvent
  // Review SLA events
  | ReviewSLAWarningEvent
  | ReviewSLABreachedEvent
  // Broadcast bidding events
  | VendorBidRoundStartedEvent
  | VendorBidRoundExhaustedEvent;

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