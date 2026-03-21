/**
 * Order Management Types
 * 
 * Complete type definitions for appraisal order management system
 * Supports end-to-end order lifecycle and vendor coordination
 */

// OrderStatus — canonical definition lives in order-status.ts (single source of truth)
import { OrderStatus } from './order-status.js';
export { OrderStatus } from './order-status.js';

export enum OrderPriority {
  ROUTINE = 'ROUTINE',
  EXPEDITED = 'EXPEDITED',
  RUSH = 'RUSH',
  EMERGENCY = 'EMERGENCY'
}

export enum OrderType {
  FULL_APPRAISAL = 'FULL_APPRAISAL',
  DRIVE_BY = 'DRIVE_BY',
  EXTERIOR_ONLY = 'EXTERIOR_ONLY',
  DESKTOP = 'DESKTOP',
  BPO = 'BPO', // Broker Price Opinion
  AVB = 'AVB', // Automated Valuation with Broker
  FIELD_REVIEW = 'FIELD_REVIEW',
  DESK_REVIEW = 'DESK_REVIEW'
}

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  BLACKLISTED = 'BLACKLISTED'
}

export enum AssignmentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  REASSIGNED = 'REASSIGNED'
}

export enum DocumentType {
  APPRAISAL_REPORT = 'APPRAISAL_REPORT',
  SUPPORTING_PHOTOS = 'SUPPORTING_PHOTOS',
  COMPARABLE_SHEETS = 'COMPARABLE_SHEETS',
  FLOOD_CERT = 'FLOOD_CERT',
  INVOICE = 'INVOICE',
  REVISION_NOTES = 'REVISION_NOTES',
  QC_REPORT = 'QC_REPORT'
}

export enum NotificationType {
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  ORDER_ACCEPTED = 'ORDER_ACCEPTED',
  ORDER_DECLINED = 'ORDER_DECLINED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  QC_COMPLETED = 'QC_COMPLETED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  REMINDER = 'REMINDER',
  ESCALATION = 'ESCALATION'
}

// =========================
// PROPERTY AND CLIENT DATA
// =========================

export interface PropertyDetails {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  parcelNumber?: string;
  propertyType: 'SINGLE_FAMILY' | 'CONDO' | 'TOWNHOME' | 'MULTI_FAMILY' | 'COMMERCIAL' | 'LAND';
  yearBuilt?: number;
  squareFootage?: number;
    estimatedValue?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  hasBasement?: boolean;
  hasGarage?: boolean;
  accessConcerns?: string;
  specialInstructions?: string;
}

export interface ClientInformation {
  clientId: string;
  clientName: string;
  /** Internal display name — may differ from clientName (used on external-facing docs) */
  clientDisplayName?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  loanNumber?: string;
  loanType?: 'CONVENTIONAL' | 'FHA' | 'VA' | 'USDA' | 'NON_QM';
  /** Client’s own internal reference number (separate from loanNumber) */
  clientReferenceNumber?: string;
  // ── Borrower ────────────────────────────────────────────────────────────
  borrowerName?: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  borrowerCell?: string;
  borrowerWorkPhone?: string;
  // ── Co-Borrower ─────────────────────────────────────────────────────────
  coBorrowerName?: string;
  coBorrowerEmail?: string;
  coBorrowerPhone?: string;
  // ── Origination context ──────────────────────────────────────────────────
  /** Who placed this order within the client organization */
  requester?: string;
  requesterEmail?: string;
  loanOfficer?: string;
  loanOfficerEmail?: string;
  loanOfficerPhone?: string;
  /** Investor / end-buyer name (e.g. FNMA, FHLMC, private) */
  investorName?: string;
  /** Loan Product Advisor key (Freddie Mac LPA) */
  lpaKey?: string;
  /** AMC registration number for the ordering entity */
  amcRegistrationNumber?: string;
}

// =========================
// BPO-SPECIFIC TYPES
// =========================

export type BpoPhotoType =
  | 'FRONT'
  | 'REAR'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'STREET'
  | 'KITCHEN'
  | 'MASTER_BEDROOM'
  | 'LIVING_ROOM'
  | 'BATHROOM'
  | 'COMP_1'
  | 'COMP_2'
  | 'COMP_3'
  | 'COMP_4'
  | 'COMP_5'
  | 'COMP_6'
  | 'DAMAGES'
  | 'ADDITIONAL';

export interface BpoOrderDetails {
  formLength?: 'SHORT' | 'LONG' | 'FULL';
  inspectionType?: 'EXTERIOR' | 'INTERIOR' | 'BOTH';
  poolName?: string;
  lockBoxCode?: string;
  feeCollectedFromClient?: number;
  feePaidToAgent?: number;
  purchaseOrderNumber?: string;
  accountingJobNumber?: string;
  bpoFormTemplateId?: string;
  requiredPhotoTypes?: BpoPhotoType[];
  assetQcManagerId?: string;
  assetQcManagerName?: string;
  bpoCoordinatorId?: string;
  bpoCoordinatorName?: string;
  /** Professional designations required of the performing vendor (e.g. 'MAI', 'SRA', 'AI-RRS') */
  requiredDesignations?: string[];
  /** Industry membership affiliations required (e.g. 'NAR', 'REALTORS', 'NAIFA') */
  requiredMemberships?: string[];
}

export type OrderSource =
  | 'CLIENT_PORTAL' | 'API_INTEGRATION' | 'EMAIL' | 'MANUAL_ENTRY' | 'BULK_IMPORT' | 'ENGAGEMENT';

export type BillingMethod =
  | 'CLIENT_INVOICE' | 'CREDIT_CARD' | 'ACH' | 'CHECK' | 'PURCHASE_ORDER' | 'NET_30' | 'NET_60';

// =========================
// ORDER DEFINITIONS
// =========================

export interface AppraisalOrder {
  id: string;
  tenantId?: string;
  orderNumber: string; // Human-readable order number
  clientInformation: ClientInformation;
  propertyDetails: PropertyDetails;
  orderType: OrderType;
  priority: OrderPriority;
  status: OrderStatus;
  
  // Order requirements
  dueDate: Date;
  createdAt: Date;
  submittedAt?: Date;
  lastUpdated: Date;
  
  // Assignment details
  assignedVendorId?: string;
  assignedAt?: Date;
  acceptedAt?: Date;
  
  // Delivery information
  deliveredAt?: Date;
  completedAt?: Date;

  // Financial information & Integration links
  quickbooksInvoiceId?: string; // Links this order to the QuickBooks Invoice (Accounts Receivable) Pushed from L1
  
  orderValue: number;
  vendorFee?: number;
  additionalFees?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  
  // Special requirements
  specialInstructions?: string;
  engagementInstructions?: string;
  accessInstructions?: string;
  contactInstructions?: string;
  
  // Tracking
  assignmentHistory: OrderAssignment[];
  statusHistory: OrderStatusUpdate[];
  documents: OrderDocument[];
  notifications: OrderNotification[];
  
  // QC integration
  qcReportId?: string;
  qcScore?: number;
  qcStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'REQUIRES_REVISION';
    // Compliance Integration (Phase 1.4)
    complianceStatus?: 'PENDING' | 'PASSED' | 'WARNINGS' | 'HARD_STOP';
    complianceViolations?: Array<{ code: string; reason: string; severity: 'WARNING' | 'STOP' }>;

  // Valuation report link — set when a report is first saved for this order
  reportId?: string;

  // ── Property FK (Phase R0.4) ─────────────────────────────────────────────
  /** FK → PropertyRecord.id — the canonical physical property. Added Phase R0.4. */
  propertyId?: string;

  // ── Engagement linkage (Phase 3 — required on all new VendorOrders) ────────
  /** FK to the parent Engagement that this vendor order fulfills */
  engagementId?: string;
  /** FK to the specific EngagementLoan within the parent Engagement */
  engagementLoanId?: string;
  /** FK to the specific EngagementProduct within the parent Engagement */
  engagementProductId?: string;

  // Metadata
  createdBy: string;
  tags?: string[];
  notes?: string;

  // ── Order provenance ─────────────────────────────────────────────────────
  orderSource?: OrderSource;
  billingMethod?: BillingMethod;
  estimatedClientDeliveryDate?: Date;
  originalAppraisalDate?: Date;
  linkedOrderIds?: string[];

  // ── BPO-specific details (only populated when orderType === OrderType.BPO) ────
  bpoDetails?: BpoOrderDetails;

  // ── Audit trail ──────────────────────────────────────────────────────────
  lastUpdatedByStaffId?: string;
  lastUpdatedByStaffName?: string;
  lastUpdatedByVendorId?: string;
  lastUpdatedByVendorName?: string;

  // ── Flagging ─────────────────────────────────────────────────────────────
  isFlagged?: boolean;
  flagNote?: string;

  // ── Document tracking ─────────────────────────────────────────────────────
  /** Denormalized count of documents uploaded to this order — drives Docs badge. */
  documentCount?: number;

  // ── Supervisory review ────────────────────────────────────────────────────
  /**
   * Set to true when the order requires a supervisor to co-sign before delivery.
   * Driven by tenant automation config or manual escalation.
   */
  requiresSupervisoryReview?: boolean;
  /** The staff member (staffRole: 'supervisor') assigned to co-sign. */
  supervisorId?: string;
  supervisorName?: string;
  /** ISO date when the supervisor co-signed. null = not yet co-signed. */
  supervisoryCosignedAt?: string;
  supervisoryCosignedBy?: string;
  /**
   * Why supervision was triggered.
   * Examples: 'high_value', 'policy_requirement', 'ai_flag', 'manual_request'
   */
  supervisoryReviewReason?: string;
}

export interface OrderAssignment {
  id: string;
  orderId: string;
  vendorId: string;
  assignedAt: Date;
  assignedBy: string;
  status: AssignmentStatus;
  acceptedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  expiresAt: Date;
  autoAssigned: boolean;
  assignmentNotes?: string;
}

export interface OrderStatusUpdate {
  id: string;
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  updatedAt: Date;
  updatedBy: string;
  reason?: string;
  notes?: string;
  systemGenerated: boolean;
}

export interface OrderDocument {
  id: string;
  orderId: string;
  type: DocumentType;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  description?: string;
  version: number;
  isPrimary: boolean; // Main appraisal report
  fileUrl: string;
  checksumMd5: string;
}

export interface OrderNotification {
  id: string;
  orderId: string;
  type: NotificationType;
  recipient: string; // email or user ID
  subject: string;
  message: string;
  sentAt: Date;
  readAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  retryCount: number;
  lastRetryAt?: Date;
}

// =========================
// VENDOR MANAGEMENT
// =========================

export interface VendorProfile {
  id: string;
  vendorCode: string; // Unique vendor identifier
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  alternateEmail?: string;
  alternatePhone?: string;
  
  // Business information
  quickbooksId?: string; // Links this vendor to QuickBooks Vendor record
  address: string;
  city: string;
  state: string;
  zipCode: string;
  businessType: 'INDIVIDUAL' | 'COMPANY' | 'PARTNERSHIP';
  federalTaxId?: string;
  stateLicense: string;
  licenseExpiration: Date;
  
  // Service capabilities
  serviceTypes: OrderType[];
  serviceAreas: VendorServiceArea[];
  maxActiveOrders: number;
  averageTurnaroundDays: number;
  
  // Status and performance
  status: VendorStatus;
  onboardedAt: Date;
  lastActiveAt?: Date;
  currentActiveOrders: number;
  
  // Performance metrics
  totalOrdersCompleted: number;
  averageQCScore: number;
  onTimeDeliveryRate: number; // Percentage
  clientSatisfactionScore: number;
  
  // Financial information
  standardRates: VendorRate[];
  paymentTerms: string;
  w9OnFile: boolean;
  
  // System settings
  autoAcceptOrders: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  maxAssignmentRadius: number; // Miles
  
  notes?: string;
  tags?: string[];

  // ── Staff / Internal assignment ───────────────────────────────────────────
  /**
   * 'internal' = staff member assigned directly (no bid loop).
   * 'external' = fee-panel vendor that goes through the bid loop.
   * Defaults to 'external' when absent for backward compatibility.
   */
  staffType?: 'internal' | 'external';
  /**
   * Specific role — only set when staffType === 'internal'.
   */
  staffRole?: 'appraiser_internal' | 'inspector_internal' | 'reviewer' | 'supervisor';
  /**
   * Capacity cap for internal staff (default: 5).
   */
  maxConcurrentOrders?: number;
  /**
   * Live count updated atomically when orders are assigned / completed.
   */
  activeOrderCount?: number;

  // ── Extended profile (Increment 1) ────────────────────────────────────────
  /** Weekly recurring availability blocks — see WorkScheduleBlock in index.ts */
  workSchedule?: {
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    startTime: string;
    endTime: string;
    timezone?: string;
  }[];
  /**
   * Three-zone geographic coverage: licensed / preferred / extended.
   * The matching engine uses licensed as a hard gate and preferred for a score bonus.
   */
  geographicCoverage?: {
    licensed:  { states: string[]; counties?: string[]; zipCodes?: string[] };
    preferred?: { states: string[]; counties?: string[]; zipCodes?: string[]; radiusMiles?: number };
    extended?:  { states: string[]; counties?: string[]; travelFeePerMile?: number };
  };
  /** Capability flags used as hard gates in the matching engine. */
  capabilities?: string[];
  /** Product catalog IDs this vendor is eligible to be assigned. */
  eligibleProductIds?: string[];
  /** Per-product proficiency grades certified by a supervisor. */
  productGrades?: {
    productId: string;
    grade: 'trainee' | 'proficient' | 'expert' | 'lead';
    certifiedBy: string;
    certifiedAt: string;
    notes?: string;
  }[];
}

export interface VendorServiceArea {
  id: string;
  vendorId: string;
  state: string;
  counties: string[];
  zipCodes?: string[];
  maxDistanceMiles?: number;
  additionalFee?: number;
  notes?: string;
}

export interface VendorRate {
  id: string;
  vendorId: string;
  orderType: OrderType;
  baseRate: number;
  rushFee?: number;
  expeditedFee?: number;
  additionalPropertyFee?: number; // For multi-unit properties
  effectiveDate: Date;
  expirationDate?: Date;
}

// =========================
// WORKFLOW AND AUTOMATION
// =========================

export interface OrderWorkflow {
  id: string;
  name: string;
  description: string;
  orderTypes: OrderType[];
  clientIds?: string[]; // Specific clients, if applicable
  
  // Workflow steps
  steps: WorkflowStep[];
  
  // Assignment rules
  assignmentRules: AssignmentRule[];
  
  // Notification settings
  notificationTemplates: NotificationTemplate[];
  
  // Status
  isActive: boolean;
  createdAt: Date;
  lastModified: Date;
}

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  name: string;
  description: string;
  triggerStatus: OrderStatus;
  targetStatus: OrderStatus;
  autoAdvance: boolean;
  requiredDocuments?: DocumentType[];
  assignedRole?: string;
  timeoutHours?: number;
  escalationRules?: EscalationRule[];
}

export interface AssignmentRule {
  id: string;
  workflowId: string;
  priority: number; // Lower number = higher priority
  name: string;
  conditions: AssignmentCondition[];
  vendorSelection: VendorSelectionStrategy;
  maxAssignmentAttempts: number;
  autoReassignAfterHours?: number;
}

export interface AssignmentCondition {
  field: string; // 'property.state', 'orderType', 'priority', etc.
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'IN' | 'NOT_IN' | 'GREATER_THAN' | 'LESS_THAN';
  value: string | string[] | number;
}

export interface VendorSelectionStrategy {
  type: 'ROUND_ROBIN' | 'LOWEST_WORKLOAD' | 'HIGHEST_RATING' | 'CLOSEST_DISTANCE' | 'CUSTOM';
  parameters?: Record<string, any>;
  fallbackStrategy?: VendorSelectionStrategy;
}

export interface EscalationRule {
  id: string;
  triggerHours: number;
  escalateTo: string; // Role or specific user
  notificationTemplate: string;
  autoReassign: boolean;
}

// =========================
// NOTIFICATION SYSTEM
// =========================

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  bodyTemplate: string; // Handlebars template
  recipientRoles: string[];
  isActive: boolean;
  sendImmediately: boolean;
  scheduleMinutesAfter?: number;
}

// =========================
// REPORTING AND ANALYTICS
// =========================

export interface OrderMetrics {
  orderId: string;
  orderNumber: string;
  
  // Timing metrics
  timeToAssignment?: number; // Hours
  timeToAcceptance?: number; // Hours
  timeToDelivery?: number; // Hours
  totalProcessingTime?: number; // Hours
  
  // Quality metrics
  qcScore?: number;
  revisionCount: number;
  clientSatisfactionScore?: number;
  
  // Business metrics
  orderValue: number;
  vendorCost: number;
  margin: number;
  marginPercentage: number;
}

export interface VendorPerformanceMetrics {
  vendorId: string;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  
  // Volume metrics
  totalOrdersAssigned: number;
  totalOrdersAccepted: number;
  totalOrdersCompleted: number;
  acceptanceRate: number; // Percentage
  completionRate: number; // Percentage
  
  // Quality metrics
  averageQCScore: number;
  qcPassRate: number; // Percentage
  revisionRate: number; // Percentage
  
  // Timing metrics
  averageAcceptanceTime: number; // Hours
  averageDeliveryTime: number; // Hours
  onTimeDeliveryRate: number; // Percentage
  
  // Client satisfaction
  averageClientRating: number;
  clientComplaintCount: number;
  
  // Financial
  totalRevenue: number;
  averageOrderValue: number;
}

// =========================
// SEARCH AND FILTERING
// =========================

export interface OrderSearchCriteria {
  orderNumber?: string;
  clientId?: string;
  vendorId?: string;
  status?: OrderStatus[];
  orderType?: OrderType[];
  priority?: OrderPriority[];
  
  // Date ranges
  createdDateFrom?: Date;
  createdDateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  
  // Property filters
  propertyState?: string;
  propertyCity?: string;
  propertyZipCode?: string;
  
  // Text search
  searchText?: string; // Searches across multiple fields
  
  // Pagination
  page?: number;
  pageSize?: number;
  
  // Sorting
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface OrderSearchResult {
  orders: AppraisalOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =========================
// API RESPONSE TYPES
// =========================

export interface OrderResponse {
  success: boolean;
  data?: AppraisalOrder;
  error?: string;
  message?: string;
}

export interface OrderListResponse {
  success: boolean;
  data?: OrderSearchResult;
  error?: string;
  message?: string;
}

export interface VendorResponse {
  success: boolean;
  data?: VendorProfile;
  error?: string;
  message?: string;
}

export interface OrderOperationResult {
  orderId: string;
  orderNumber: string;
  operation: string;
  success: boolean;
  message: string;
  timestamp: Date;
  performedBy: string;
}


