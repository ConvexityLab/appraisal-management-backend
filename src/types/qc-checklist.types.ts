/**
 * Dynamic QC Checklist System - Type Definitions
 * Comprehensive, flexible QC checklist framework for document review processes
 */

// ============================================================================
// Core QC Checklist Types
// ============================================================================

/**
 * QC Checklist Status Enumeration
 */
export enum QCStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_ATTENTION = 'requires_attention'
}

/**
 * QC Item Priority Levels
 */
export enum QCPriority {
  CRITICAL = 'critical',        // Must pass for approval
  HIGH = 'high',               // Important for quality
  MEDIUM = 'medium',           // Standard review item
  LOW = 'low',                 // Optional/informational
  INFORMATIONAL = 'informational'
}

/**
 * QC Question/Criteria Types
 */
export enum QCQuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  BOOLEAN = 'boolean',
  TEXT = 'text',
  NUMERIC = 'numeric',
  DATE = 'date',
  CONDITIONAL = 'conditional',
  CALCULATION = 'calculation',
  DOCUMENT_REFERENCE = 'document_reference',
  DATA_VALIDATION = 'data_validation',
  AI_ANALYSIS = 'ai_analysis'
}

/**
 * Data Source Types for QC Validation
 */
export enum DataSourceType {
  UAD_SCHEMA = 'uad_schema',
  DOCUMENT_FIELD = 'document_field',
  EXTERNAL_API = 'external_api',
  USER_INPUT = 'user_input',
  CALCULATED = 'calculated',
  AI_EXTRACTED = 'ai_extracted',
  DATABASE_LOOKUP = 'database_lookup'
}

/**
 * Conditional Logic Operators
 */
export enum ConditionalOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  MATCHES_PATTERN = 'matches_pattern'
}

// ============================================================================
// QC Checklist Structure Interfaces
// ============================================================================

/**
 * Conditional Logic Rule
 */
export interface QCConditionalRule {
  field: string;
  operator: ConditionalOperator;
  value: any;
  dataSource?: DataSourceType;
}

/**
 * Conditional Logic Expression
 */
export interface QCConditionalLogic {
  rules: QCConditionalRule[];
  operator: 'AND' | 'OR';
  nested?: QCConditionalLogic[];
}

/**
 * Data Requirement Specification
 */
export interface QCDataRequirement {
  id: string;
  name: string;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  sourceType: DataSourceType;
  sourcePath?: string;           // JSONPath or field reference
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    pattern?: string;            // Regex pattern
    allowedValues?: any[];
    customValidation?: string;   // Custom validation function name
  };
  fallbackValue?: any;
  transformation?: string;       // Data transformation function
}

/**
 * Documentation and Citation Requirements
 */
export interface QCDocumentationRequirement {
  id: string;
  name: string;
  description: string;
  documentType: string;
  required: boolean;
  sectionReference?: string;
  pageReference?: string;
  fieldReference?: string;
  citationFormat?: string;
  regulatoryReference?: {
    regulation: string;
    section: string;
    subsection?: string;
    url?: string;
  };
}

/**
 * AI Analysis Configuration
 */
export interface QCAIAnalysisConfig {
  analysisType: 'text_analysis' | 'image_analysis' | 'document_comparison' | 'compliance_check' | 'risk_assessment';
  model?: string;                // AI model to use
  prompt?: string;              // Custom prompt template
  parameters?: Record<string, any>;
  confidenceThreshold?: number;
  requiresHumanReview?: boolean;
}

/**
 * QC Question/Criteria Definition
 */
export interface QCQuestion {
  id: string;
  question: string;
  description?: string;
  type: QCQuestionType;
  priority: QCPriority;
  tags: string[];
  
  // Answer Configuration
  options?: string[];           // For multiple choice questions
  defaultValue?: any;
  
  // Conditional Logic
  conditionalLogic?: QCConditionalLogic;
  showWhen?: QCConditionalRule[];
  
  // Data Requirements
  dataRequirements: QCDataRequirement[];
  
  // Documentation Requirements
  documentationRequirements?: QCDocumentationRequirement[];
  
  // AI Analysis Configuration
  aiAnalysis?: QCAIAnalysisConfig;
  
  // Scoring and Validation
  scoringWeight?: number;       // Weight in overall score (0-100)
  passingCriteria?: {
    minScore?: number;
    requiredAnswer?: any;
    customValidation?: string;
  };
  
  // Help and Guidance
  helpText?: string;
  examples?: string[];
  references?: Array<{
    title: string;
    url?: string;
    section?: string;
  }>;
}

/**
 * QC Subcategory Definition
 */
export interface QCSubcategory {
  id: string;
  name: string;
  description?: string;
  priority: QCPriority;
  tags: string[];
  
  // Conditional Logic
  conditionalLogic?: QCConditionalLogic;
  
  // Questions/Criteria
  questions: QCQuestion[];
  
  // Scoring Configuration
  scoringMethod?: 'weighted_average' | 'pass_fail' | 'custom';
  passingThreshold?: number;
  
  // Documentation
  documentation?: QCDocumentationRequirement[];
}

/**
 * QC Category Definition
 */
export interface QCCategory {
  id: string;
  name: string;
  description?: string;
  priority: QCPriority;
  tags: string[];
  
  // Conditional Logic
  conditionalLogic?: QCConditionalLogic;
  
  // Subcategories
  subcategories: QCSubcategory[];
  
  // Scoring Configuration
  scoringMethod?: 'weighted_average' | 'pass_fail' | 'custom';
  passingThreshold?: number;
  
  // Documentation
  documentation?: QCDocumentationRequirement[];
}

/**
 * Complete QC Checklist Definition
 */
export interface QCChecklist {
  id: string;
  name: string;
  description?: string | undefined;
  version: string;
  documentType: string;         // e.g., 'appraisal', 'credit_report', 'title_report'
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedBy?: string | undefined;
  updatedAt?: Date | undefined;
  
  // Configuration
  isTemplate: boolean;
  isActive: boolean;
  tags: string[];
  
  // Organization and client context
  clientId?: string;
  organizationId?: string;
  
  // Regulatory and Compliance
  regulatoryFramework?: string; // e.g., 'GSE', 'FHA', 'VA', 'USDA'
  complianceStandards?: string[];
  
  // Categories
  categories: QCCategory[];
  
  // Global Configuration
  globalDataRequirements?: QCDataRequirement[];
  globalDocumentation?: QCDocumentationRequirement[];
  
  // Scoring Configuration
  overallScoringMethod?: 'weighted_average' | 'pass_fail' | 'custom';
  passingScore?: number;
  
  // Workflow Configuration
  workflowSteps?: Array<{
    id: string;
    name: string;
    description?: string;
    categories: string[];       // Category IDs to include in this step
    assignedRole?: string;
    timeoutMinutes?: number;
  }>;
}

// ============================================================================
// QC Execution and Results Types
// ============================================================================

/**
 * QC Answer/Response
 */
export interface QCAnswer {
  questionId: string;
  value: any;
  confidence?: number;          // AI confidence score (0-1)
  source: 'user' | 'ai' | 'system';
  timestamp: Date;
  
  // Supporting Data
  supportingData?: Record<string, any>;
  citations?: Array<{
    documentId?: string;
    pageNumber?: number;
    sectionReference?: string;
    excerpt?: string;
  }>;
  
  // Review Information
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
}

/**
 * QC Execution Context
 */
export interface QCExecutionContext {
  checklistId: string;
  documentId: string;
  documentType: string;
  executionId: string;
  
  // Document Data
  documentData: Record<string, any>;
  
  // User and Client Context
  userId: string;
  clientId?: string;
  organizationId?: string;
  
  // Execution Configuration
  aiProvider?: 'azure' | 'google';
  autoExecute?: boolean;
  requireHumanReview?: boolean;
  
  // Workflow Context
  currentStep?: string;
  workflowState?: Record<string, any>;
}

/**
 * QC Execution Results
 */
export interface QCExecutionResult {
  id: string;
  checklistId: string;
  executionContext: QCExecutionContext;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  
  // Overall Status and Scoring
  status: QCStatus;
  overallScore?: number;
  passed: boolean;
  
  // Category Results
  categoryResults: Array<{
    categoryId: string;
    status: QCStatus;
    score?: number;
    passed: boolean;
    subcategoryResults: Array<{
      subcategoryId: string;
      status: QCStatus;
      score?: number;
      passed: boolean;
      questionResults: Array<{
        questionId: string;
        answer?: QCAnswer;
        status: QCStatus;
        score?: number;
        passed: boolean;
        validationErrors?: string[];
        aiAnalysisResult?: {
          analysisType: string;
          result: any;
          confidence: number;
          processingTime: number;
        };
      }>;
    }>;
  }>;
  
  // Issues and Deficiencies
  criticalIssues: Array<{
    questionId: string;
    issue: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendedAction?: string;
  }>;
  
  // Audit Trail
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    userId?: string;
    details: Record<string, any>;
  }>;
  
  // AI Processing Summary
  aiProcessingSummary?: {
    totalQuestions: number;
    aiProcessedQuestions: number;
    averageConfidence: number;
    processingTimeMs: number;
    modelsUsed: string[];
  };
}

// ============================================================================
// QC Assignment and Management Types
// ============================================================================

/**
 * QC Checklist Assignment
 */
export interface QCChecklistAssignment {
  id: string;
  checklistId: string;
  
  // Assignment Target
  assignmentType: 'user' | 'client' | 'organization' | 'role';
  targetId: string;
  
  // Assignment Configuration
  isDefault: boolean;
  priority: number;             // Higher number = higher priority
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // Conditions
  conditions?: QCConditionalLogic;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
}

/**
 * QC Template Configuration
 */
export interface QCTemplateConfig {
  templateId: string;
  customizations?: {
    categories?: Array<{
      categoryId: string;
      enabled: boolean;
      customQuestions?: QCQuestion[];
      modifiedQuestions?: Array<{
        questionId: string;
        modifications: Partial<QCQuestion>;
      }>;
    }>;
    globalSettings?: {
      passingScore?: number;
      aiProvider?: string;
      requireHumanReview?: boolean;
    };
  };
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Create QC Checklist Request
 */
export interface CreateQCChecklistRequest {
  name: string;
  description?: string;
  documentType: string;
  isTemplate?: boolean;
  basedOnTemplateId?: string;
  categories: Omit<QCCategory, 'id'>[];
  globalConfiguration?: {
    passingScore?: number;
    scoringMethod?: string;
    aiProvider?: string;
  };
}

/**
 * Execute QC Review Request
 */
export interface ExecuteQCReviewRequest {
  checklistId: string;
  documentId: string;
  documentData: Record<string, any>;
  clientId?: string;
  aiProvider?: 'azure' | 'google';
  autoExecute?: boolean;
  stepIds?: string[];           // Execute specific workflow steps only
}

/**
 * QC Results Summary Response
 */
export interface QCResultsSummaryResponse {
  executionId: string;
  checklistName: string;
  documentType: string;
  overallScore: number;
  passed: boolean;
  status: QCStatus;
  
  // Summary Statistics
  totalQuestions: number;
  answeredQuestions: number;
  passedQuestions: number;
  failedQuestions: number;
  criticalIssuesCount: number;
  
  // Category Breakdown
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    score: number;
    passed: boolean;
    issuesCount: number;
  }>;
  
  // Timeline
  startedAt: Date;
  completedAt?: Date;
  processingTimeMs?: number;
}

export default {
  QCStatus,
  QCPriority,
  QCQuestionType,
  DataSourceType,
  ConditionalOperator
};