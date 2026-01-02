/**
 * Reconsideration of Value (ROV) Types
 * 
 * Federal Interagency Guidance on Reconsiderations of Value (2025)
 * Formal workflow for handling appraisal challenges and disputes
 */

import { AccessControl } from './authorization.types';

/**
 * ROV Request Status
 */
export enum ROVStatus {
  SUBMITTED = 'SUBMITTED',           // Initial submission by borrower/agent
  UNDER_REVIEW = 'UNDER_REVIEW',     // Being evaluated by team
  RESEARCHING = 'RESEARCHING',       // Gathering comps and evidence
  PENDING_RESPONSE = 'PENDING_RESPONSE', // Response drafted, awaiting approval
  RESPONDED = 'RESPONDED',           // Response sent to requestor
  ACCEPTED = 'ACCEPTED',             // Value change accepted
  REJECTED = 'REJECTED',             // Challenge rejected, original value stands
  WITHDRAWN = 'WITHDRAWN',           // Requestor withdrew the challenge
  ESCALATED = 'ESCALATED'            // Escalated to senior management
}

/**
 * Type of ROV requestor
 */
export enum ROVRequestorType {
  BORROWER = 'BORROWER',
  BUYER_AGENT = 'BUYER_AGENT',
  SELLER_AGENT = 'SELLER_AGENT',
  LENDER = 'LENDER',
  LOAN_OFFICER = 'LOAN_OFFICER',
  OTHER = 'OTHER'
}

/**
 * Reason/basis for the ROV challenge
 */
export enum ROVChallengeReason {
  INCORRECT_COMPS = 'INCORRECT_COMPS',           // Comparable properties not appropriate
  BETTER_COMPS_AVAILABLE = 'BETTER_COMPS_AVAILABLE', // More relevant comps exist
  CONDITION_ASSESSMENT = 'CONDITION_ASSESSMENT', // Property condition misjudged
  MARKET_CONDITIONS = 'MARKET_CONDITIONS',       // Market trends not considered
  PROPERTY_FEATURES = 'PROPERTY_FEATURES',       // Features overlooked or misvalued
  RECENT_IMPROVEMENTS = 'RECENT_IMPROVEMENTS',   // Recent upgrades not reflected
  CALCULATION_ERROR = 'CALCULATION_ERROR',       // Mathematical or methodology error
  FACTUAL_ERROR = 'FACTUAL_ERROR',              // Incorrect facts about property
  BIAS_DISCRIMINATION = 'BIAS_DISCRIMINATION',   // Suspected bias or discrimination
  OTHER = 'OTHER'
}

/**
 * Decision outcome for ROV
 */
export enum ROVDecision {
  VALUE_INCREASED = 'VALUE_INCREASED',     // Original value increased
  VALUE_DECREASED = 'VALUE_DECREASED',     // Original value decreased (rare)
  VALUE_UNCHANGED = 'VALUE_UNCHANGED',     // Original value maintained
  REQUIRES_NEW_APPRAISAL = 'REQUIRES_NEW_APPRAISAL', // New appraisal ordered
  PENDING = 'PENDING'                      // Not yet decided
}

/**
 * Supporting evidence type
 */
export interface ROVEvidence {
  id: string;
  type: 'DOCUMENT' | 'PHOTO' | 'COMPARABLE' | 'REPORT' | 'OTHER';
  description: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Comparable property data for ROV research
 */
export interface ROVComparable {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  salePrice: number;
  saleDate: Date;
  distanceFromSubject: number; // miles
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  condition: string;
  adjustments: {
    location?: number;
    size?: number;
    condition?: number;
    features?: number;
    total: number;
  };
  adjustedValue: number;
  source: string; // MLS, public records, etc.
  listingId?: string;
  notes?: string;
  selected: boolean; // Whether this comp is being used in response
}

/**
 * ROV Research workspace data
 */
export interface ROVResearch {
  originalAppraisalValue: number;
  originalAppraisalDate: Date;
  originalAppraiser: string;
  originalAppraisalId: string;
  
  marketAnalysis: {
    averageValue: number;
    medianValue: number;
    valueRange: { min: number; max: number };
    daysSinceAppraisal: number;
    marketTrend: 'INCREASING' | 'STABLE' | 'DECLINING';
    trendPercentage?: number;
  };
  
  comparables: ROVComparable[];
  
  additionalResearch: string;
  internalNotes: string;
  
  researchCompletedBy?: string;
  researchCompletedAt?: Date;
}

/**
 * ROV Response to requestor
 */
export interface ROVResponse {
  decision: ROVDecision;
  newValue?: number;
  valueChangeAmount?: number;
  valueChangePercentage?: number;
  
  explanation: string;
  supportingRationale: string[];
  comparablesUsed: string[]; // IDs of comps from research
  
  responseTemplate?: string; // Template ID used
  responseDate: Date;
  respondedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'PHONE';
  deliveredAt?: Date;
}

/**
 * Timeline entry for ROV audit trail
 */
export interface ROVTimelineEntry {
  id: string;
  timestamp: Date;
  action: string;
  performedBy: string;
  performedByEmail?: string;
  details: string;
  metadata?: Record<string, any>;
}

/**
 * SLA tracking for ROV
 */
export interface ROVSLATracking {
  submittedAt: Date;
  dueDate: Date;
  responseTargetDays: number; // Typically 5-10 business days
  businessDaysElapsed: number;
  isOverdue: boolean;
  daysUntilDue: number;
  escalationWarnings: {
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    triggeredAt: Date;
  }[];
}

/**
 * Main ROV Request document
 */
export interface ROVRequest {
  id: string;
  rovNumber: string; // Human-readable ID (e.g., ROV-2026-00123)
  
  // Related entities
  orderId: string;
  propertyAddress: string;
  loanNumber?: string;
  borrowerName?: string;
  
  // Request details
  status: ROVStatus;
  requestorType: ROVRequestorType;
  requestorName: string;
  requestorEmail: string;
  requestorPhone?: string;
  
  // Challenge details
  challengeReason: ROVChallengeReason;
  challengeDescription: string;
  originalAppraisalValue: number;
  requestedValue?: number;
  supportingEvidence: ROVEvidence[];
  
  // Research and analysis
  research?: ROVResearch;
  
  // Response
  response?: ROVResponse;
  
  // Timeline and audit
  timeline: ROVTimelineEntry[];
  slaTracking: ROVSLATracking;
  
  // Assignment
  assignedTo?: string;
  assignedToEmail?: string;
  assignedAt?: Date;
  reviewedBy?: string[];
  
  // Metadata
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  tags: string[];
  internalNotes: string;
  
  // Compliance flags
  complianceFlags: {
    possibleBias: boolean;
    discriminationClaim: boolean;
    regulatoryEscalation: boolean;
    legalReview: boolean;
  };
  
  // Access control
  accessControl: AccessControl;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date;
  completedAt?: Date;
}

/**
 * ROV Response Template
 */
export interface ROVResponseTemplate {
  id: string;
  name: string;
  description: string;
  decision: ROVDecision;
  template: string; // Markdown or HTML template with placeholders
  placeholders: string[]; // {{borrowerName}}, {{originalValue}}, etc.
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ROV Statistics and Metrics
 */
export interface ROVMetrics {
  totalRequests: number;
  byStatus: Record<ROVStatus, number>;
  byDecision: Record<ROVDecision, number>;
  byRequestorType: Record<ROVRequestorType, number>;
  byChallengeReason: Record<ROVChallengeReason, number>;
  
  averageResolutionTime: number; // days
  averageValueChange: number; // dollars
  valueIncreaseRate: number; // percentage
  valueDecreaseRate: number; // percentage
  valueUnchangedRate: number; // percentage
  
  slaCompliance: number; // percentage
  overdueCount: number;
  escalatedCount: number;
  
  periodStart: Date;
  periodEnd: Date;
}

/**
 * ROV Search/Filter criteria
 */
export interface ROVFilters {
  status?: ROVStatus[];
  requestorType?: ROVRequestorType[];
  challengeReason?: ROVChallengeReason[];
  decision?: ROVDecision[];
  priority?: ('NORMAL' | 'HIGH' | 'URGENT')[];
  assignedTo?: string;
  orderId?: string;
  submittedFrom?: Date;
  submittedTo?: Date;
  isOverdue?: boolean;
  hasComplianceFlags?: boolean;
}

/**
 * API Response types
 */
export interface CreateROVRequestInput {
  orderId: string;
  requestorType: ROVRequestorType;
  requestorName: string;
  requestorEmail: string;
  requestorPhone?: string;
  challengeReason: ROVChallengeReason;
  challengeDescription: string;
  originalAppraisalValue: number;
  requestedValue?: number;
  supportingEvidence?: Omit<ROVEvidence, 'id' | 'uploadedAt'>[];
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface UpdateROVResearchInput {
  rovId: string;
  research: Partial<ROVResearch>;
  internalNotes?: string;
}

export interface SubmitROVResponseInput {
  rovId: string;
  decision: ROVDecision;
  newValue?: number;
  explanation: string;
  supportingRationale: string[];
  comparablesUsed: string[];
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'PHONE';
  responseTemplateId?: string;
}

export interface ROVListResponse {
  data: ROVRequest[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
