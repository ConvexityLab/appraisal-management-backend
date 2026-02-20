/**
 * Order Management Types
 * 
 * Complete type definitions for appraisal order management system
 * Supports end-to-end order lifecycle and vendor coordination
 */

// OrderStatus — canonical definition lives in order-status.ts (single source of truth)
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
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  loanNumber?: string;
  borrowerName?: string;
  loanOfficer?: string;
  loanOfficerEmail?: string;
  loanOfficerPhone?: string;
}

// =========================
// ORDER DEFINITIONS
// =========================

export interface AppraisalOrder {
  id: string;
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
  
  // Financial information
  orderValue: number;
  vendorFee?: number;
  additionalFees?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  
  // Special requirements
  specialInstructions?: string;
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
  
  // Metadata
  createdBy: string;
  tags?: string[];
  notes?: string;
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