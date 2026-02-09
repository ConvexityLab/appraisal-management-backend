/**
 * QC Workflow Automation Types
 * 
 * Type definitions for QC review queue, revision management, escalation, and SLA tracking
 */

// ===========================
// QC REVIEW MASTER RECORD
// ===========================

export enum QCReviewStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}

export enum QCPriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum QCChecklistStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum ReviewerRole {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  SUPERVISOR = 'SUPERVISOR'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum QCDecision {
  APPROVED = 'APPROVED',
  APPROVED_WITH_CONDITIONS = 'APPROVED_WITH_CONDITIONS',
  REJECTED = 'REJECTED',
  REVISION_REQUIRED = 'REVISION_REQUIRED'
}

/**
 * Master QC Review Record
 * Stored in qc-reviews container
 */
export interface QCReview {
  id: string;
  orderId: string;
  orderNumber?: string;
  appraisalId?: string;
  
  // Status & Priority
  status: QCReviewStatus;
  priorityLevel: QCPriorityLevel;
  priorityScore?: number; // Calculated 0-100
  
  // Checklists - references to criteria container
  checklists: QCReviewChecklist[];
  
  // Reviewers - assigned analysts
  reviewers: QCReviewer[];
  
  // Results summary (detailed results in results container)
  results?: QCReviewResults;
  
  // SLA Tracking
  sla: QCReviewSLA;
  
  // Revisions
  revisions?: QCRevision[];
  
  // Workload tracking
  startedAt?: string; // ISO date
  completedAt?: string; // ISO date
  timeSpentMinutes?: number;
  
  // Order context
  propertyAddress?: string;
  appraisedValue?: number;
  clientId?: string;
  clientName?: string;
  vendorId?: string;
  vendorName?: string;
  
  // Audit
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  createdBy?: string;
}

export interface QCReviewChecklist {
  checklistId: string; // Reference to criteria container
  checklistName: string;
  checklistType?: string;
  status: QCChecklistStatus;
  score?: number;
  maxScore?: number;
  completedAt?: string; // ISO date
  completedBy?: string;
}

export interface QCReviewer {
  userId: string; // Reference to users/personnel
  userName?: string;
  userEmail?: string;
  role: ReviewerRole;
  assignedAt: string; // ISO date
  assignedBy?: string;
  startedAt?: string; // ISO date
  completedAt?: string; // ISO date
  timeSpentMinutes?: number;
}

export interface QCReviewResults {
  resultId?: string; // Optional reference to results container for detailed results
  overallScore: number;
  maxScore: number;
  percentScore: number;
  riskLevel: RiskLevel;
  decision: QCDecision;
  summary?: string;
  issuesCount?: number;
  criticalIssuesCount?: number;
  completedAt?: string; // ISO date
}

export interface QCReviewSLA {
  dueDate: string; // ISO date
  targetResponseTime?: number; // minutes
  actualResponseTime?: number; // minutes
  breached: boolean;
  breachedAt?: string; // ISO date
  escalated: boolean;
  escalatedAt?: string; // ISO date
  escalationReason?: string;
}

export interface QCRevision {
  revisionId: string;
  requestedAt: string; // ISO date
  requestedBy: string;
  reason: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  submittedAt?: string; // ISO date
  reviewedAt?: string; // ISO date
  reviewedBy?: string;
  notes?: string;
}

// ===========================
// QC REVIEW QUEUE TYPES (Legacy - for compatibility)
// ===========================

export interface QCReviewQueueItem {
  id: string;
  orderId: string;
  orderNumber: string;
  appraisalId: string;
  
  // Priority factors
  priorityLevel: QCPriorityLevel;
  priorityScore: number; // 0-100 calculated score
  
  // Assignment
  assignedAnalystId?: string;
  assignedAnalystName?: string;
  assignedAt?: Date;
  
  // Status
  status: QCReviewStatus;
  submittedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Order details for context
  propertyAddress: string;
  appraisedValue: number;
  orderPriority: string; // ROUTINE, RUSH, etc.
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  
  // SLA tracking
  slaTargetDate: Date;
  slaBreached: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface QCAnalystWorkload {
  analystId: string;
  analystName: string;
  analystEmail: string;
  
  // Current workload
  pendingReviews: number;
  inProgressReviews: number;
  totalActiveReviews: number;
  
  // Capacity
  maxConcurrentReviews: number;
  capacityUtilization: number; // percentage
  
  // Performance
  averageReviewTime: number; // minutes
  completedToday: number;
  completedThisWeek: number;
  
  // Availability
  isAvailable: boolean;
  outOfOfficeUntil?: Date;
}

export interface QCPriorityScoreFactors {
  orderAge: number; // 0-25 points
  orderValue: number; // 0-20 points
  orderPriority: number; // 0-30 points
  clientTier: number; // 0-15 points
  vendorRiskScore: number; // 0-10 points
}

export interface QCReviewQueueSearchCriteria {
  status?: QCReviewStatus[];
  priorityLevel?: QCPriorityLevel[];
  assignedAnalystId?: string;
  clientId?: string;
  vendorId?: string;
  slaBreached?: boolean;
  submittedAfter?: Date;
  submittedBefore?: Date;
  minPriorityScore?: number;
  limit?: number;
  offset?: number;
}

// ===========================
// REVISION MANAGEMENT TYPES
// ===========================

export enum RevisionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum RevisionSeverity {
  MINOR = 'MINOR', // Typos, formatting
  MODERATE = 'MODERATE', // Missing data, calculation errors
  MAJOR = 'MAJOR', // Incorrect comps, value issues
  CRITICAL = 'CRITICAL' // Compliance violations, fraudulent activity
}

export interface RevisionRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  appraisalId: string;
  qcReportId: string;
  
  // Revision details
  version: number; // 1, 2, 3...
  revisionNumber: string; // "REV-1", "REV-2"
  severity: RevisionSeverity;
  status: RevisionStatus;
  
  // Issues to fix
  issues: RevisionIssue[];
  
  // Parties involved
  requestedBy: string;
  requestedByName: string;
  assignedTo: string; // Vendor ID
  assignedToName: string;
  
  // Dates
  requestedAt: Date;
  dueDate: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  completedAt?: Date;
  
  // Communication
  requestNotes: string;
  responseNotes?: string;
  internalNotes?: string;
  
  // Tracking
  notificationsSent: RevisionNotification[];
  remindersSent: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionIssue {
  id: string;
  category: string; // 'property_details', 'comps', 'valuation', 'documentation', 'compliance'
  issueType: string; // 'missing_data', 'incorrect_value', 'calculation_error', etc.
  severity: RevisionSeverity;
  description: string;
  fieldName?: string;
  currentValue?: string;
  expectedValue?: string;
  pageNumber?: number;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface RevisionNotification {
  id: string;
  notificationType: 'REQUEST' | 'REMINDER' | 'ESCALATION' | 'COMPLETION';
  sentTo: string; // email or user ID
  sentAt: Date;
  channel: 'EMAIL' | 'SMS' | 'IN_APP';
  delivered: boolean;
}

export interface RevisionHistory {
  orderId: string;
  orderNumber: string;
  revisions: RevisionRequest[];
  totalRevisions: number;
  currentVersion: number;
  lastRevisionDate?: Date;
}

// ===========================
// ESCALATION WORKFLOW TYPES
// ===========================

export enum EscalationType {
  QC_DISPUTE = 'QC_DISPUTE', // Vendor disputes QC findings
  SLA_BREACH = 'SLA_BREACH', // Review taking too long
  COMPLEX_CASE = 'COMPLEX_CASE', // Needs senior review
  REVISION_FAILURE = 'REVISION_FAILURE', // Multiple revision cycles
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED', // Potential fraud
  COMPLIANCE_ISSUE = 'COMPLIANCE_ISSUE', // Regulatory concern
  CLIENT_COMPLAINT = 'CLIENT_COMPLAINT' // Client escalation
}

export enum EscalationStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

export enum EscalationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface EscalationCase {
  id: string;
  escalationType: EscalationType;
  priority: EscalationPriority;
  status: EscalationStatus;
  
  // Related entities
  orderId: string;
  orderNumber: string;
  appraisalId?: string;
  qcReportId?: string;
  revisionId?: string;
  
  // Escalation details
  title: string;
  description: string;
  raisedBy: string;
  raisedByName: string;
  raisedByRole: string;
  raisedAt: Date;
  
  // Assignment
  assignedTo?: string; // QC Manager ID
  assignedToName?: string;
  assignedAt?: Date;
  
  // Resolution
  resolution?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: Date;
  
  // Actions taken
  actions: EscalationAction[];
  
  // Communication
  comments: EscalationComment[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationAction {
  id: string;
  actionType: 'OVERRIDE' | 'REASSIGN' | 'EXTEND_SLA' | 'WAIVE_ISSUE' | 'REQUEST_REVIEW' | 'CLOSE_ORDER';
  actionBy: string;
  actionByName: string;
  actionAt: Date;
  description: string;
  outcome?: string;
}

export interface EscalationComment {
  id: string;
  commentBy: string;
  commentByName: string;
  commentAt: Date;
  comment: string;
  visibility: 'INTERNAL' | 'VENDOR' | 'CLIENT';
}

export interface DisputeResolution {
  escalationId: string;
  resolution: 'UPHOLD_QC' | 'OVERTURN_QC' | 'COMPROMISE' | 'SECOND_OPINION';
  reasoning: string;
  resolvedBy: string;
  resolvedAt: Date;
  finalDecision: string;
}

// ===========================
// SLA TRACKING TYPES
// ===========================

export enum SLAStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK', // 80% of time elapsed
  BREACHED = 'BREACHED',
  WAIVED = 'WAIVED',
  EXTENDED = 'EXTENDED'
}

export interface SLAConfiguration {
  id: string;
  name: string;
  description: string;
  
  // Target times in minutes
  qcReviewTime: number; // Default: 4 hours = 240 minutes
  revisionTurnaround: number; // Default: 24 hours = 1440 minutes
  escalationResponse: number; // Default: 2 hours = 120 minutes
  
  // Priority-based overrides
  rushOrderMultiplier: number; // 0.5 = half the time
  routineOrderMultiplier: number; // 1.0 = standard time
  
  // Client-specific
  clientId?: string;
  orderType?: string;
  
  // Breach handling
  autoEscalateOnBreach: boolean;
  notifyOnAtRisk: boolean;
  
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLATracking {
  id: string;
  entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION';
  entityId: string; // ID of the tracked entity
  
  orderId: string;
  orderNumber: string;
  
  // SLA details
  slaConfigId: string;
  targetMinutes: number;
  targetDate: Date;
  
  // Status
  status: SLAStatus;
  startTime: Date;
  endTime?: Date;
  
  // Tracking
  elapsedMinutes: number;
  remainingMinutes: number;
  percentComplete: number;
  
  // Breach info
  breachedAt?: Date;
  breachDuration?: number; // minutes over SLA
  
  // Extensions
  extended: boolean;
  extensionReason?: string;
  extensionBy?: string;
  extensionMinutes?: number;
  
  // Waiver
  waived: boolean;
  waiverReason?: string;
  waiverBy?: string;
  
  // Alerts sent
  atRiskAlertSent: boolean;
  breachAlertSent: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAMetrics {
  period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  startDate: Date;
  endDate: Date;
  
  // Overall metrics
  totalTracked: number;
  onTrack: number;
  atRisk: number;
  breached: number;
  waived: number;
  
  // Performance
  averageCompletionTime: number; // minutes
  onTimePercentage: number;
  breachRate: number;
  
  // By category
  byEntityType: {
    [key: string]: {
      total: number;
      breached: number;
      averageTime: number;
    };
  };
  
  // By priority
  byPriority: {
    [key: string]: {
      total: number;
      breached: number;
      averageTime: number;
    };
  };
}

export interface SLAAlert {
  id: string;
  alertType: 'AT_RISK' | 'BREACHED' | 'EXTENDED';
  slaTrackingId: string;
  
  orderId: string;
  orderNumber: string;
  entityType: string;
  
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  
  notifiedUsers: string[];
  createdAt: Date;
}

// ===========================
// API REQUEST/RESPONSE TYPES
// ===========================

export interface AssignQCReviewRequest {
  queueItemId: string;
  analystId: string;
  notes?: string;
}

export interface CreateRevisionRequest {
  orderId: string;
  appraisalId: string;
  qcReportId: string;
  severity: RevisionSeverity;
  dueDate: Date;
  issues: Omit<RevisionIssue, 'id' | 'resolved' | 'resolvedAt' | 'resolvedBy'>[];
  requestNotes: string;
  requestedBy: string;
}

export interface SubmitRevisionRequest {
  revisionId: string;
  responseNotes: string;
  submittedBy: string;
  resolvedIssues: string[]; // Array of issue IDs
}

export interface CreateEscalationRequest {
  orderId: string;
  escalationType: EscalationType;
  priority: EscalationPriority;
  title: string;
  description: string;
  raisedBy: string;
  appraisalId?: string;
  qcReportId?: string;
  revisionId?: string;
}

export interface ResolveEscalationRequest {
  escalationId: string;
  resolution: string;
  resolvedBy: string;
  actions: Omit<EscalationAction, 'id' | 'actionAt'>[];
}

export interface ExtendSLARequest {
  slaTrackingId: string;
  extensionMinutes: number;
  reason: string;
  extendedBy: string;
}

export interface WaiveSLARequest {
  slaTrackingId: string;
  reason: string;
  waivedBy: string;
}
