/**
 * Template Types for Appraisal Management Platform
 * Supports ROV responses, appraisal reports (1033, 1004, etc.), and custom documents
 */

import { AccessControl } from './authorization.types';

/**
 * Template categories
 */
export enum TemplateCategory {
  ROV_RESPONSE = 'ROV_RESPONSE',
  APPRAISAL_REPORT = 'APPRAISAL_REPORT',
  ENGAGEMENT_LETTER = 'ENGAGEMENT_LETTER',
  COMPLETION_CERTIFICATE = 'COMPLETION_CERTIFICATE',
  INVOICE = 'INVOICE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  CUSTOM = 'CUSTOM'
}

/**
 * Appraisal form types (FNMA/FHLMC standard forms)
 */
export enum AppraisalFormType {
  FORM_1004 = 'FORM_1004',           // Uniform Residential Appraisal Report (URAR)
  FORM_1004C = 'FORM_1004C',         // Manufactured Home Appraisal Report
  FORM_1004D = 'FORM_1004D',         // Appraisal Update/Completion Report
  FORM_1025 = 'FORM_1025',           // Small Residential Income Property
  FORM_1073 = 'FORM_1073',           // Individual Condominium Unit Appraisal Report (older)
  FORM_1033 = 'FORM_1033',           // Individual Condominium Unit Appraisal Report
  FORM_2055 = 'FORM_2055',           // Exterior-Only Inspection
  FORM_1075 = 'FORM_1075',           // Desktop Appraisal
  FORM_1004_MC = 'FORM_1004_MC',     // Market Conditions Addendum
  FORM_1007 = 'FORM_1007',           // Single-Family Comparable Rent Schedule
  FORM_216 = 'FORM_216',             // Operating Income Statement
  CUSTOM_FORM = 'CUSTOM_FORM'
}

/**
 * Template format/output type
 */
export enum TemplateFormat {
  HTML = 'HTML',
  MARKDOWN = 'MARKDOWN',
  PDF = 'PDF',
  DOCX = 'DOCX',
  JSON = 'JSON'
}

/**
 * Template status
 */
export enum TemplateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Placeholder definition
 */
export interface TemplatePlaceholder {
  key: string;                    // {{borrowerName}}
  label: string;                  // "Borrower Name"
  description?: string;           // "Full name of the borrower"
  type: 'text' | 'number' | 'date' | 'currency' | 'address' | 'list' | 'table';
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;             // Regex pattern
    min?: number;
    max?: number;
    enum?: string[];
  };
}

/**
 * Template section (for structured documents)
 */
export interface TemplateSection {
  id: string;
  name: string;
  order: number;
  content: string;                // Template content with placeholders
  required: boolean;
  conditional?: {
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
    value: any;
  };
}

/**
 * Main template document
 */
export interface Template {
  id: string;
  tenantId: string;
  
  // Identification
  name: string;
  description: string;
  category: TemplateCategory;
  formType?: AppraisalFormType;   // For appraisal reports
  
  // Content
  content: string;                // Main template body with placeholders
  sections?: TemplateSection[];   // Optional structured sections
  format: TemplateFormat;
  
  // Metadata
  version: string;                // Semantic versioning (1.0.0)
  status: TemplateStatus;
  isDefault: boolean;             // Is this the default template for its category?
  
  // Placeholders
  placeholders: TemplatePlaceholder[];
  
  // Styling
  styles?: {
    css?: string;                 // Custom CSS for HTML/PDF
    headerImage?: string;         // Logo/header image URL
    footerText?: string;          // Footer text
    pageSize?: 'letter' | 'legal' | 'a4';
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  
  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;
  
  // Approval workflow
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Access control
  accessControl: AccessControl;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  
  // Tags for search/filtering
  tags: string[];
}

/**
 * Template rendering request
 */
export interface RenderTemplateRequest {
  templateId: string;
  data: Record<string, any>;      // Placeholder values
  format?: TemplateFormat;        // Override template's default format
  options?: {
    includeMetadata?: boolean;
    watermark?: string;
    customStyles?: string;
  };
}

/**
 * Template rendering result
 */
export interface RenderTemplateResult {
  success: boolean;
  content?: string;               // Rendered content (HTML, Markdown, etc.)
  file?: {
    filename: string;
    mimeType: string;
    size: number;
    url?: string;                 // URL to download the file
    buffer?: Buffer;              // File buffer (for immediate download)
  };
  error?: string;
  metadata?: {
    templateId: string;
    templateName: string;
    version: string;
    renderedAt: Date;
    placeholdersFilled: number;
    placeholdersTotal: number;
  };
}

/**
 * Template library item (lightweight listing)
 */
export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  formType?: AppraisalFormType;
  format: TemplateFormat;
  version: string;
  status: TemplateStatus;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt?: Date;
  updatedAt: Date;
  tags: string[];
}

/**
 * Template filters for queries
 */
export interface TemplateFilters {
  category?: TemplateCategory[];
  formType?: AppraisalFormType[];
  format?: TemplateFormat[];
  status?: TemplateStatus[];
  isDefault?: boolean;
  tags?: string[];
  search?: string;                // Search in name/description
  createdBy?: string;
}

/**
 * Create template input
 */
export interface CreateTemplateInput {
  name: string;
  description: string;
  category: TemplateCategory;
  formType?: AppraisalFormType;
  content: string;
  sections?: TemplateSection[];
  format: TemplateFormat;
  placeholders: TemplatePlaceholder[];
  styles?: Template['styles'];
  requiresApproval?: boolean;
  tags?: string[];
}

/**
 * Update template input
 */
export interface UpdateTemplateInput {
  templateId: string;
  name?: string;
  description?: string;
  content?: string;
  sections?: TemplateSection[];
  status?: TemplateStatus;
  placeholders?: TemplatePlaceholder[];
  styles?: Template['styles'];
  tags?: string[];
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
  warnings: {
    field: string;
    message: string;
  }[];
  unusedPlaceholders: string[];  // Defined but not used in content
  undefinedPlaceholders: string[]; // Used in content but not defined
}

/**
 * Template usage statistics
 */
export interface TemplateUsageStats {
  templateId: string;
  templateName: string;
  totalUsages: number;
  usagesByMonth: {
    month: string;              // YYYY-MM
    count: number;
  }[];
  usagesByUser: {
    userId: string;
    userName: string;
    count: number;
  }[];
  averageRenderTime: number;      // milliseconds
  errorRate: number;              // percentage
}
