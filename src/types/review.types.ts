/**
 * Appraisal Review Management Types
 * Comprehensive review workflow, comparable analysis, and reporting
 */

import { AppraisalOrder } from './index.js';

// ============================================================================
// Review Assignment & Workflow Types
// ============================================================================

export enum ReviewType {
  DESK_REVIEW = 'DESK_REVIEW',                    // Document-only review
  FIELD_REVIEW = 'FIELD_REVIEW',                  // Includes property inspection
  TECHNICAL_REVIEW = 'TECHNICAL_REVIEW',          // Deep technical analysis
  COMPLIANCE_REVIEW = 'COMPLIANCE_REVIEW',        // USPAP/regulatory compliance
  QUALITY_CONTROL = 'QUALITY_CONTROL',            // Internal QC review
  RECONSIDERATION = 'RECONSIDERATION',            // ROV review
  APPRAISAL_UPDATE = 'APPRAISAL_UPDATE'           // Form 1004D update review
}

export enum ReviewStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_INFORMATION = 'PENDING_INFORMATION',
  COMPLETED = 'COMPLETED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}

export enum ReviewPriority {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
  EXPEDITED = 'EXPEDITED'
}

export enum ReviewOutcome {
  APPROVED = 'APPROVED',                          // Appraisal accepted as-is
  APPROVED_WITH_CONDITIONS = 'APPROVED_WITH_CONDITIONS', // Minor issues noted
  REQUIRES_REVISION = 'REQUIRES_REVISION',        // Needs corrections
  REQUIRES_FIELD_WORK = 'REQUIRES_FIELD_WORK',    // Additional inspection needed
  REJECTED = 'REJECTED',                          // Significant issues, new appraisal required
  VALUE_ADJUSTED = 'VALUE_ADJUSTED',              // Reviewer adjusted value
  INCOMPLETE = 'INCOMPLETE'                       // Missing required information
}

export interface AppraisalReview {
  id: string;
  tenantId: string;
  orderId: string;
  originalAppraisalId: string;                    // Reference to original appraisal document
  
  // Review Request Details
  reviewType: ReviewType;
  priority: ReviewPriority;
  requestedBy: string;                            // User ID who requested review
  requestedAt: Date;
  requestReason: string;
  
  // Assignment
  assignedTo?: string;                            // Reviewer user ID
  assignedAt?: Date;
  assignmentMethod: 'MANUAL' | 'AUTOMATIC' | 'ROUND_ROBIN' | 'SKILL_BASED';
  
  // Status & Workflow
  status: ReviewStatus;
  currentStage: ReviewStage;
  stages: ReviewStage[];
  
  // Review Work
  startedAt?: Date;
  completedAt?: Date;
  turnaroundTime?: number;                        // Minutes
  dueDate?: Date;
  
  // Findings & Results
  outcome?: ReviewOutcome;
  findings: ReviewFinding[];
  checklist?: ReviewChecklist;
  
  // Value & Adjustments
  originalValue: number;
  reviewedValue?: number;
  valueAdjustment?: number;
  valueAdjustmentReason?: string;
  
  // Reports & Documentation
  reviewReportId?: string;                        // Generated report (Form 2000, 2010, etc.)
  supportingDocuments: ReviewDocument[];
  
  // Comparable Analysis
  comparableAnalysis?: ComparableAnalysis;
  
  // Communication
  reviewerNotes: ReviewNote[];
  escalations: ReviewEscalation[];
  supplementalRequests: SupplementalRequest[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface ReviewStage {
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  order: number;
}

export interface ReviewFinding {
  id: string;
  category: FindingCategory;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
  description: string;
  location?: string;                              // Where in appraisal (page, section, field)
  requirement?: string;                           // USPAP standard, UAD field, etc.
  recommendation: string;
  status: 'OPEN' | 'ADDRESSED' | 'ACCEPTED' | 'DISPUTED';
  createdAt: Date;
}

export enum FindingCategory {
  // Valuation
  VALUE_CONCLUSION = 'VALUE_CONCLUSION',
  MARKET_CONDITIONS = 'MARKET_CONDITIONS',
  HIGHEST_BEST_USE = 'HIGHEST_BEST_USE',
  
  // Comparable Sales
  COMPARABLE_SELECTION = 'COMPARABLE_SELECTION',
  COMPARABLE_VERIFICATION = 'COMPARABLE_VERIFICATION',
  ADJUSTMENTS = 'ADJUSTMENTS',
  SALES_COMPARISON_GRID = 'SALES_COMPARISON_GRID',
  
  // Property Analysis
  PROPERTY_DESCRIPTION = 'PROPERTY_DESCRIPTION',
  SITE_ANALYSIS = 'SITE_ANALYSIS',
  IMPROVEMENTS = 'IMPROVEMENTS',
  CONDITION_RATING = 'CONDITION_RATING',
  
  // Approaches to Value
  SALES_COMPARISON_APPROACH = 'SALES_COMPARISON_APPROACH',
  COST_APPROACH = 'COST_APPROACH',
  INCOME_APPROACH = 'INCOME_APPROACH',
  RECONCILIATION = 'RECONCILIATION',
  
  // Compliance & Standards
  USPAP_COMPLIANCE = 'USPAP_COMPLIANCE',
  UAD_COMPLIANCE = 'UAD_COMPLIANCE',
  CLIENT_REQUIREMENTS = 'CLIENT_REQUIREMENTS',
  STATE_REGULATIONS = 'STATE_REGULATIONS',
  
  // Documentation
  PHOTOS = 'PHOTOS',
  SUPPORTING_DATA = 'SUPPORTING_DATA',
  CERTIFICATIONS = 'CERTIFICATIONS',
  EXHIBITS = 'EXHIBITS',
  
  // Other
  SCOPE_OF_WORK = 'SCOPE_OF_WORK',
  ASSUMPTIONS = 'ASSUMPTIONS',
  EXTRAORDINARY_ASSUMPTIONS = 'EXTRAORDINARY_ASSUMPTIONS',
  HYPOTHETICAL_CONDITIONS = 'HYPOTHETICAL_CONDITIONS'
}

export interface ReviewChecklist {
  templateId: string;
  templateName: string;
  items: ReviewChecklistItem[];
  completionPercentage: number;
  totalScore?: number;
  maxScore?: number;
}

export interface ReviewChecklistItem {
  id: string;
  category: string;
  description: string;
  required: boolean;
  weight?: number;                                // For scoring
  status: 'NOT_CHECKED' | 'PASS' | 'FAIL' | 'NA';
  score?: number;
  notes?: string;
  checkedBy?: string;
  checkedAt?: Date;
}

export interface ReviewNote {
  id: string;
  text: string;
  category?: string;
  isPrivate: boolean;                             // Internal notes vs shared with appraiser
  createdBy: string;
  createdAt: Date;
}

export interface ReviewEscalation {
  id: string;
  reason: string;
  escalatedTo: string;                            // User ID or role
  escalatedBy: string;
  escalatedAt: Date;
  resolution?: string;
  resolvedAt?: Date;
}

export interface SupplementalRequest {
  id: string;
  requestType: 'CLARIFICATION' | 'ADDITIONAL_DATA' | 'CORRECTION' | 'FIELD_WORK' | 'DOCUMENTATION';
  description: string;
  items: string[];                                // Specific items requested
  requestedBy: string;
  requestedAt: Date;
  dueDate?: Date;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  response?: string;
  respondedAt?: Date;
}

export interface ReviewDocument {
  id: string;
  type: 'PHOTO' | 'REPORT' | 'ADDENDUM' | 'SUPPORTING_DATA' | 'CORRESPONDENCE' | 'OTHER';
  filename: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  description?: string;
}

// ============================================================================
// Comparable Analysis & Verification Types
// ============================================================================

export interface ComparableAnalysis {
  reviewId: string;
  propertyAddress: string;
  subjectProperty: SubjectPropertySummary;
  comparables: ComparableVerification[];
  summary: ComparableAnalysisSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectPropertySummary {
  address: string;
  propertyType: string;
  gla: number;                                    // Gross living area
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize: number;
  condition: string;
  quality: string;
}

export interface ComparableVerification {
  id: string;
  compNumber: number;                             // Comp #1, #2, #3
  address: string;
  salePrice: number;
  saleDate: Date;
  
  // Verification Status
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'QUESTIONABLE' | 'REJECTED';
  verificationSource?: string;                    // MLS, public records, etc.
  verificationDate?: Date;
  
  // Property Details
  gla: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize: number;
  condition: string;
  quality: string;
  
  // Location Analysis
  distanceToSubject: number;                      // Miles
  neighborhood: string;
  marketArea: string;
  locationRating: 'SUPERIOR' | 'SIMILAR' | 'INFERIOR';
  
  // Adjustments Analysis
  adjustments: AdjustmentAnalysis[];
  totalAdjustment: number;
  totalAdjustmentPercent: number;
  adjustedValue: number;
  
  // Appropriateness Assessment
  appropriatenessScore: number;                   // 0-100
  appropriatenessIssues: string[];
  
  // Data Quality
  dataCompleteness: number;                       // 0-100%
  dataAccuracy: 'HIGH' | 'MEDIUM' | 'LOW';
  dataSource: string;
  
  // Reviewer Assessment
  reviewerComments?: string;
  recommendedAction: 'ACCEPT' | 'MODIFY' | 'REPLACE' | 'REJECT';
}

export interface AdjustmentAnalysis {
  category: string;                               // Location, Size, Condition, etc.
  appraiserAdjustment: number;
  suggestedAdjustment?: number;
  marketSupportedRange?: {
    min: number;
    max: number;
  };
  reasonableness: 'REASONABLE' | 'QUESTIONABLE' | 'UNSUPPORTED';
  comments?: string;
}

export interface ComparableAnalysisSummary {
  totalComparablesReviewed: number;
  comparablesVerified: number;
  comparablesQuestionable: number;
  comparablesRejected: number;
  
  // Adjustment Analysis
  averageTotalAdjustment: number;
  averageNetAdjustment: number;
  largestAdjustment: number;
  adjustmentConcerns: string[];
  
  // Selection Analysis
  selectionQuality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR';
  selectionIssues: string[];
  
  // Recommendations
  recommendedComparables?: AlternativeComparable[];
  overallAssessment: string;
  valueIndicationRange?: {
    low: number;
    high: number;
  };
}

export interface AlternativeComparable {
  address: string;
  salePrice: number;
  saleDate: Date;
  reason: string;                                 // Why this comp is better
  source: string;
}

// ============================================================================
// Review Report Types
// ============================================================================

export enum ReviewReportType {
  FORM_2000 = 'FORM_2000',                        // Appraisal Review - General Purpose
  FORM_2010 = 'FORM_2010',                        // Appraisal Review - Residential
  FORM_1004D = 'FORM_1004D',                      // Appraisal Update and/or Completion
  FORM_2075 = 'FORM_2075',                        // Desktop Underwriter Property Review
  NARRATIVE_REVIEW = 'NARRATIVE_REVIEW',          // Comprehensive narrative report
  LETTER_REVIEW = 'LETTER_REVIEW'                 // Brief letter-form review
}

export interface ReviewReport {
  id: string;
  tenantId: string;
  reviewId: string;
  reportType: ReviewReportType;
  formType?: string;                              // FNMA form number if applicable
  
  // Report Content
  content: string;                                // HTML or structured content
  sections: ReviewReportSection[];
  
  // Report Metadata
  preparedBy: string;                             // Reviewer
  preparedDate: Date;
  reviewDate: Date;
  
  // Files
  pdfUrl?: string;
  xmlUrl?: string;
  
  // Status
  status: 'DRAFT' | 'FINAL' | 'REVISED' | 'ARCHIVED';
  version: string;
  
  // Certification
  certificationStatement: string;
  certifiedBy: string;
  certifiedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewReportSection {
  id: string;
  title: string;
  order: number;
  content: string;
  subsections?: ReviewReportSection[];
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateReviewRequest {
  orderId: string;
  originalAppraisalId: string;
  reviewType: ReviewType;
  priority: ReviewPriority;
  requestReason: string;
  dueDate?: Date;
  assignToReviewer?: string;                      // Optional manual assignment
  checklistTemplateId?: string;
}

export interface AssignReviewRequest {
  reviewerId: string;
  assignmentMethod: 'MANUAL' | 'AUTOMATIC' | 'ROUND_ROBIN' | 'SKILL_BASED';
  notes?: string;
}

export interface UpdateReviewRequest {
  status?: ReviewStatus;
  outcome?: ReviewOutcome;
  reviewedValue?: number;
  valueAdjustmentReason?: string;
  findings?: ReviewFinding[];
  notes?: string;
}

export interface VerifyComparableRequest {
  reviewId: string;
  compNumber: number;
  verificationSource: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'QUESTIONABLE' | 'REJECTED';
  verificationNotes?: string;
  suggestedAdjustments?: AdjustmentAnalysis[];
}

export interface GenerateReviewReportRequest {
  reviewId: string;
  reportType: ReviewReportType;
  includeFindingsDetail: boolean;
  includeComparableAnalysis: boolean;
  includePhotos: boolean;
  certify: boolean;
}

export interface ReviewListFilters {
  status?: ReviewStatus[];
  reviewType?: ReviewType[];
  assignedTo?: string;
  requestedBy?: string;
  priority?: ReviewPriority[];
  outcome?: ReviewOutcome[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface ReviewMetrics {
  totalReviews: number;
  reviewsByStatus: Record<ReviewStatus, number>;
  reviewsByType: Record<ReviewType, number>;
  reviewsByOutcome: Record<ReviewOutcome, number>;
  averageTurnaroundTime: number;                  // Hours
  onTimeCompletion: number;                       // Percentage
  valueAdjustmentRate: number;                    // Percentage
  averageValueAdjustment: number;                 // Dollar amount
}

export interface ReviewerPerformance {
  reviewerId: string;
  reviewerName: string;
  totalReviews: number;
  completedReviews: number;
  averageTurnaroundTime: number;
  onTimeRate: number;
  qualityScore?: number;
  specializations: ReviewType[];
}
