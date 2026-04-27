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
  PAYMENT = 'payment',
  SUBMISSION = 'submission',
  ESCALATION = 'escalation',
  ROV = 'rov',
  DELIVERY = 'delivery',
  CONSENT = 'consent',
  NEGOTIATION = 'negotiation',
  DOCUMENT = 'document',
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

/**
 * Fired when a ClientOrder is placed via ClientOrderService.placeClientOrder.
 *
 * Consumed by the comp-collection listener (`comp-collection-listener.job.ts`)
 * to kick off comp-collection for product types in
 * COMP_COLLECTION_TRIGGER_PRODUCT_TYPES. Other consumers may subscribe
 * independently — this event is intentionally generic and not coupled to
 * comp collection.
 */
export interface ClientOrderCreatedEvent extends BaseEvent {
  type: 'client-order.created';
  category: EventCategory.ORDER;
  data: {
    clientOrderId: string;
    tenantId: string;
    /** Optional canonical PropertyRecord id; absent when caller didn't supply one. */
    propertyId?: string;
    /** ProductType value as a string (avoids cross-module enum import in the events module). */
    productType: string;
    /** ISO timestamp when the order was placed. */
    placedAt: string;
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

/** Fired when a completed tape-evaluation job should be submitted to Axiom in the background. */
export interface AxiomBulkEvaluationRequestedEvent extends BaseEvent {
  type: 'axiom.bulk-evaluation.requested';
  category: EventCategory.QC;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    reviewProgramId?: string;
    priority: EventPriority;
  };
}

/** Fired when a bulk data+document package has been staged and is ready for async processing. */
export interface BulkIngestionRequestedEvent extends BaseEvent {
  type: 'bulk.ingestion.requested';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    ingestionMode: 'MULTIPART' | 'SHARED_STORAGE';
    adapterKey: string;
    dataFileName: string;
    dataFileBlobName?: string;
    documentFileNames: string[];
    sharedStorage?: {
      storageAccountName: string;
      containerName: string;
      dataFileBlobName: string;
      documentBlobNames: string[];
      pathPrefix?: string;
    };
    priority: EventPriority;
  };
}

/** Fired when a bulk ingestion job has completed processing (completed/partial/failed). */
export interface BulkIngestionProcessedEvent extends BaseEvent {
  type: 'bulk.ingestion.processed';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    ingestionMode: 'MULTIPART' | 'SHARED_STORAGE';
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    adapterKey: string;
    totalItems: number;
    successItems: number;
    failedItems: number;
    completedAt: string;
    lastError?: string;
    priority: EventPriority;
  };
}

/** Fired when canonical validation + persistence finishes for a processed bulk ingestion job. */
export interface BulkIngestionCanonicalizedEvent extends BaseEvent {
  type: 'bulk.ingestion.canonicalized';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    adapterKey: string;
    totalCandidateItems: number;
    persistedCount: number;
    failedCount: number;
    processedAt: string;
    priority: EventPriority;
  };
}

/** Fired after canonicalization when the pipeline should create engagement + orders. */
export interface BulkIngestionOrderingRequestedEvent extends BaseEvent {
  type: 'bulk.ingestion.ordering.requested';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    adapterKey: string;
    totalCandidateItems: number;
    persistedCount: number;
    failedCount: number;
    processedAt: string;
    priority: EventPriority;
  };
}

/** Fired after engagement/order creation completes for a bulk-ingestion job. */
export interface BulkIngestionOrdersCreatedEvent extends BaseEvent {
  type: 'bulk.ingestion.orders.created';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    adapterKey: string;
    engagementId?: string;
    totalCandidateItems: number;
    createdOrderCount: number;
    failedOrderCount: number;
    completedAt: string;
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
    priority: EventPriority;
  };
}

/** Fired when an item's Axiom extraction lifecycle reaches a terminal webhook result. */
export interface BulkIngestionExtractionCompletedEvent extends BaseEvent {
  type: 'bulk.ingestion.extraction.completed';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    itemId: string;
    rowIndex: number;
    correlationId: string;
    pipelineJobId?: string;
    status: 'completed' | 'failed';
    completedAt: string;
    error?: string;
    result?: Record<string, unknown>;
    priority: EventPriority;
  };
}

/** Fired when criteria evaluation (or explicit criteria bypass) reaches a terminal state for an item. */
export interface BulkIngestionCriteriaCompletedEvent extends BaseEvent {
  type: 'bulk.ingestion.criteria.completed';
  category: EventCategory.DOCUMENT;
  data: {
    jobId: string;
    tenantId: string;
    clientId: string;
    itemId: string;
    rowIndex: number;
    status: 'completed' | 'failed';
    criteriaStatus: 'completed' | 'skipped' | 'failed';
    completedAt: string;
    reason?: string;
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

/**
 * Fired when an order's due date has passed without being delivered.
 * Published by OverdueOrderDetectionJob in addition to setting isOverdue: true.
 */
export interface OrderOverdueEvent extends BaseEvent {
  type: 'order.overdue';
  category: EventCategory.ORDER;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    /** ISO string of the original due date. */
    dueDate: string;
    /** How many hours past due. */
    hoursOverdue: number;
    currentStatus: string;
    priority: EventPriority;
  };
}

/**
 * Fired when Axiom does not return an evaluation within the configured timeout window.
 * Published by AxiomTimeoutWatcherJob.
 */
export interface AxiomEvaluationTimedOutEvent extends BaseEvent {
  type: 'axiom.evaluation.timeout';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    /** When the evaluation was originally submitted to Axiom. */
    submittedAt: Date;
    /** Configured timeout window in minutes. */
    timeoutMinutes: number;
    priority: EventPriority;
  };
}

export interface AxiomExecutionCompletedEvent extends BaseEvent {
  type: 'axiom.execution.completed';
  category: EventCategory.SYSTEM;
  data: {
    executionId: string;
    status: 'COMPLETED' | 'FAILED';
    pipelineJobId?: string;
  };
}

/**
 * Fired when a supervisor has not co-signed an order within the configured SLA window.
 * Published by SupervisionTimeoutWatcherJob.
 */
export interface SupervisionTimedOutEvent extends BaseEvent {
  type: 'supervision.timeout';
  category: EventCategory.QC;
  data: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    supervisorId: string;
    /** When supervision was first requested. */
    requestedAt: Date;
    /** Configured SLA in hours. */
    slaHours: number;
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

// ── Payment Events ────────────────────────────────────────────────────────

export interface PaymentInitiatedEvent extends BaseEvent {
  type: 'payment.initiated';
  category: EventCategory.PAYMENT;
  data: {
    paymentId: string;
    orderId: string;
    tenantId: string;
    amountCents: number;
    currency: string;
    paymentMethod: string;
    payee: string;  // 'vendor' | 'borrower' | 'client'
    priority: EventPriority;
  };
}

export interface PaymentCompletedEvent extends BaseEvent {
  type: 'payment.completed';
  category: EventCategory.PAYMENT;
  data: {
    paymentId: string;
    orderId: string;
    tenantId: string;
    amountCents: number;
    providerTransactionId: string;
    priority: EventPriority;
  };
}

export interface PaymentFailedEvent extends BaseEvent {
  type: 'payment.failed';
  category: EventCategory.PAYMENT;
  data: {
    paymentId: string;
    orderId: string;
    tenantId: string;
    amountCents: number;
    failureReason: string;
    priority: EventPriority;
  };
}

// ── Submission Events ─────────────────────────────────────────────────────

export interface SubmissionUploadedEvent extends BaseEvent {
  type: 'submission.uploaded';
  category: EventCategory.SUBMISSION;
  data: {
    submissionId: string;
    orderId: string;
    tenantId: string;
    vendorId: string;
    documentCount: number;
    priority: EventPriority;
  };
}

export interface SubmissionApprovedEvent extends BaseEvent {
  type: 'submission.approved';
  category: EventCategory.SUBMISSION;
  data: {
    submissionId: string;
    orderId: string;
    tenantId: string;
    approvedBy: string;
    priority: EventPriority;
  };
}

export interface SubmissionRejectedEvent extends BaseEvent {
  type: 'submission.rejected';
  category: EventCategory.SUBMISSION;
  data: {
    submissionId: string;
    orderId: string;
    tenantId: string;
    rejectedBy: string;
    reason: string;
    priority: EventPriority;
  };
}

export interface SubmissionRevisionRequestedEvent extends BaseEvent {
  type: 'submission.revision.requested';
  category: EventCategory.SUBMISSION;
  data: {
    submissionId: string;
    orderId: string;
    tenantId: string;
    requestedBy: string;
    revisionNotes: string;
    priority: EventPriority;
  };
}

// ── Escalation Events ─────────────────────────────────────────────────────

export interface EscalationCreatedEvent extends BaseEvent {
  type: 'escalation.created';
  category: EventCategory.ESCALATION;
  data: {
    escalationId: string;
    orderId: string;
    tenantId: string;
    reason: string;
    escalatedBy: string;
    assignedTo?: string;
    priority: EventPriority;
  };
}

export interface EscalationResolvedEvent extends BaseEvent {
  type: 'escalation.resolved';
  category: EventCategory.ESCALATION;
  data: {
    escalationId: string;
    orderId: string;
    tenantId: string;
    resolvedBy: string;
    resolution: string;
    priority: EventPriority;
  };
}

// ── ROV Events ────────────────────────────────────────────────────────────

export interface RovCreatedEvent extends BaseEvent {
  type: 'rov.created';
  category: EventCategory.ROV;
  data: {
    rovId: string;
    orderId: string;
    tenantId: string;
    requestorType: string;
    challengeReason: string;
    originalValue: number;
    requestedValue?: number;
    priority: EventPriority;
  };
}

export interface RovAssignedEvent extends BaseEvent {
  type: 'rov.assigned';
  category: EventCategory.ROV;
  data: {
    rovId: string;
    orderId: string;
    tenantId: string;
    assignedTo: string;
    priority: EventPriority;
  };
}

export interface RovDecisionIssuedEvent extends BaseEvent {
  type: 'rov.decision.issued';
  category: EventCategory.ROV;
  data: {
    rovId: string;
    orderId: string;
    tenantId: string;
    decision: 'upheld' | 'value_changed' | 'withdrawn';
    updatedValue?: number;
    decidedBy: string;
    priority: EventPriority;
  };
}

// ── Delivery Events ───────────────────────────────────────────────────────

export interface DeliveryReceiptConfirmedEvent extends BaseEvent {
  type: 'delivery.receipt.confirmed';
  category: EventCategory.DELIVERY;
  data: {
    packageId: string;
    orderId: string;
    tenantId: string;
    confirmedBy: string;
    channel: 'portal' | 'email' | 'api';
    priority: EventPriority;
  };
}

export interface DeliveryReceiptOpenedEvent extends BaseEvent {
  type: 'delivery.receipt.opened';
  category: EventCategory.DELIVERY;
  data: {
    packageId: string;
    orderId: string;
    tenantId: string;
    openedBy: string;
    priority: EventPriority;
  };
}

// ── Consent Events ────────────────────────────────────────────────────────

export interface ConsentGivenEvent extends BaseEvent {
  type: 'consent.given';
  category: EventCategory.CONSENT;
  data: {
    consentId: string;
    orderId: string;
    tenantId: string;
    borrowerEmail: string;
    disclosureVersion: string;
    method: 'portal' | 'email_link' | 'esign';
    priority: EventPriority;
  };
}

export interface ConsentDeniedEvent extends BaseEvent {
  type: 'consent.denied';
  category: EventCategory.CONSENT;
  data: {
    consentId: string;
    orderId: string;
    tenantId: string;
    borrowerEmail: string;
    priority: EventPriority;
  };
}

export interface ConsentWithdrawnEvent extends BaseEvent {
  type: 'consent.withdrawn';
  category: EventCategory.CONSENT;
  data: {
    consentId: string;
    orderId: string;
    tenantId: string;
    borrowerEmail: string;
    withdrawnAt: string;
    priority: EventPriority;
  };
}

// ── Negotiation Events ────────────────────────────────────────────────────

export interface NegotiationCounterOfferSubmittedEvent extends BaseEvent {
  type: 'negotiation.counter_offer.submitted';
  category: EventCategory.NEGOTIATION;
  data: {
    negotiationId: string;
    orderId: string;
    tenantId: string;
    originalFee: number;
    counterFee: number;
    submittedBy: string;  // vendor ID
    priority: EventPriority;
  };
}

export interface NegotiationAcceptedEvent extends BaseEvent {
  type: 'negotiation.accepted';
  category: EventCategory.NEGOTIATION;
  data: {
    negotiationId: string;
    orderId: string;
    tenantId: string;
    agreedFee: number;
    acceptedBy: string;
    priority: EventPriority;
  };
}

export interface NegotiationRejectedEvent extends BaseEvent {
  type: 'negotiation.rejected';
  category: EventCategory.NEGOTIATION;
  data: {
    negotiationId: string;
    orderId: string;
    tenantId: string;
    rejectedBy: string;
    reason?: string;
    priority: EventPriority;
  };
}

export type AppEvent =
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderAssignedEvent
  | OrderCompletedEvent
  | OrderDeliveredEvent
  | OrderOverdueEvent
  | ClientOrderCreatedEvent
  | EngagementStatusChangedEvent
  | QCStartedEvent
  | QCCompletedEvent
  | QCIssueDetectedEvent
  | QCAIScoredEvent
  | VendorPerformanceUpdatedEvent
  | VendorAvailabilityChangedEvent
  | SystemAlertEvent
  | AxiomExecutionCompletedEvent
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
  | SupervisionTimedOutEvent
  // Engagement letter events
  | EngagementLetterSentEvent
  | EngagementLetterSignedEvent
  | EngagementLetterDeclinedEvent
  // Axiom evaluation events
  | AxiomEvaluationSubmittedEvent
  | AxiomBulkEvaluationRequestedEvent
  | BulkIngestionRequestedEvent
  | BulkIngestionProcessedEvent
  | BulkIngestionCanonicalizedEvent
  | BulkIngestionOrderingRequestedEvent
  | BulkIngestionOrdersCreatedEvent
  | BulkIngestionExtractionCompletedEvent
  | BulkIngestionCriteriaCompletedEvent
  | AxiomEvaluationCompletedEvent
  | AxiomEvaluationTimedOutEvent
  // Review SLA events
  | ReviewSLAWarningEvent
  | ReviewSLABreachedEvent
  // Broadcast bidding events
  | VendorBidRoundStartedEvent
  | VendorBidRoundExhaustedEvent
  // Payment events
  | PaymentInitiatedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  // Submission events
  | SubmissionUploadedEvent
  | SubmissionApprovedEvent
  | SubmissionRejectedEvent
  | SubmissionRevisionRequestedEvent
  // Escalation events
  | EscalationCreatedEvent
  | EscalationResolvedEvent
  // ROV events
  | RovCreatedEvent
  | RovAssignedEvent
  | RovDecisionIssuedEvent
  // Delivery events
  | DeliveryReceiptConfirmedEvent
  | DeliveryReceiptOpenedEvent
  // Consent events
  | ConsentGivenEvent
  | ConsentDeniedEvent
  | ConsentWithdrawnEvent
  // Negotiation events
  | NegotiationCounterOfferSubmittedEvent
  | NegotiationAcceptedEvent
  | NegotiationRejectedEvent
  // Document events
  | DocumentUploadedEvent;

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

// ── Document events ────────────────────────────────────────────────────────────

/** Fired by DocumentService.uploadDocument() after the blob and Cosmos record are created. */
export interface DocumentUploadedEvent extends BaseEvent {
  type: 'document.uploaded';
  category: EventCategory.DOCUMENT;
  data: {
    documentId: string;
    orderId?: string;
    tenantId: string;
    category?: string;
    documentType?: string;
    blobName: string;
    mimeType: string;
    uploadedBy: string;
  };
}
