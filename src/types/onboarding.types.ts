/**
 * Vendor Onboarding Types
 * Multi-step vendor onboarding workflow
 */

export enum OnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  INCOMPLETE = 'INCOMPLETE'
}

export enum OnboardingStepType {
  APPLICATION_FORM = 'APPLICATION_FORM',
  BUSINESS_INFORMATION = 'BUSINESS_INFORMATION',
  LICENSE_UPLOAD = 'LICENSE_UPLOAD',
  INSURANCE_UPLOAD = 'INSURANCE_UPLOAD',
  W9_FORM = 'W9_FORM',
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  AGREEMENT_SIGNATURE = 'AGREEMENT_SIGNATURE',
  BANK_INFORMATION = 'BANK_INFORMATION',
  REFERENCE_CHECK = 'REFERENCE_CHECK',
  FINAL_APPROVAL = 'FINAL_APPROVAL'
}

export enum OnboardingStepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED'
}

export interface OnboardingApplication {
  id: string;
  vendorId?: string; // Assigned after approval
  
  // Application details
  applicantInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title?: string;
  };
  
  businessInfo: {
    businessName: string;
    businessType: 'INDIVIDUAL' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';
    taxId: string; // EIN or SSN (encrypted)
    yearsInBusiness: number;
    businessAddress: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
    website?: string;
  };
  
  // Service capabilities
  serviceInfo: {
    licenseStates: string[];
    specialties: string[];
    yearsExperience: number;
    certifications: string[];
    coverageAreas: string[];
    maxOrdersPerDay: number;
  };
  
  // Status
  status: OnboardingStatus;
  currentStep: OnboardingStepType;
  completedSteps: OnboardingStepType[];
  
  // Workflow
  steps: OnboardingStep[];
  
  // Review
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  rejectionReason?: string;
  
  // Metadata
  submittedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingStep {
  type: OnboardingStepType;
  status: OnboardingStepStatus;
  title: string;
  description: string;
  required: boolean;
  order: number;
  
  // Completion tracking
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  
  // Documents
  documentsRequired?: DocumentRequirement[];
  documentsUploaded?: UploadedDocument[];
  
  // Verification
  requiresVerification: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  
  // Data collected
  dataCollected?: Record<string, any>;
}

export interface DocumentRequirement {
  id: string;
  type: string;
  name: string;
  description: string;
  required: boolean;
  acceptedFormats: string[];
  maxSizeMB: number;
  exampleUrl?: string;
}

export interface UploadedDocument {
  id: string;
  requirementId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
  uploadedAt: Date;
  uploadedBy: string;
  
  // Verification
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
}

export interface OnboardingCreateRequest {
  applicantInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title?: string;
  };
  businessInfo: {
    businessName: string;
    businessType: 'INDIVIDUAL' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';
    taxId: string;
    yearsInBusiness: number;
    businessAddress: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
    website?: string;
  };
  serviceInfo: {
    licenseStates: string[];
    specialties: string[];
    yearsExperience: number;
    certifications: string[];
    coverageAreas: string[];
    maxOrdersPerDay: number;
  };
}

export interface OnboardingDocumentUploadRequest {
  applicationId: string;
  stepType: OnboardingStepType;
  requirementId: string;
  fileName: string;
  fileData: Buffer; // Base64 encoded in REST API
  contentType: string;
  uploadedBy: string;
}

export interface OnboardingStepCompleteRequest {
  applicationId: string;
  stepType: OnboardingStepType;
  completedBy: string;
  dataCollected?: Record<string, any>;
  notes?: string;
}

export interface OnboardingReviewRequest {
  applicationId: string;
  approved: boolean;
  reviewedBy: string;
  reviewNotes?: string;
  rejectionReason?: string;
}

export interface OnboardingReviewResult {
  success: boolean;
  applicationId: string;
  status: OnboardingStatus;
  vendorId?: string;
  message: string;
  error?: string;
}

export interface OnboardingSummary {
  total: number;
  byStatus: Record<OnboardingStatus, number>;
  pending: number;
  inProgress: number;
  underReview: number;
  approved: number;
  rejected: number;
  averageCompletionTime: number; // hours
  completionRate: number; // percentage
}

export interface BackgroundCheckRequest {
  applicationId: string;
  applicantInfo: {
    firstName: string;
    lastName: string;
    ssn: string; // Encrypted
    dateOfBirth: Date;
    address: {
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  requestedBy: string;
}

export interface BackgroundCheckResult {
  success: boolean;
  checkId: string;
  status: 'CLEAR' | 'REVIEW_REQUIRED' | 'FAILED';
  completedAt: Date;
  findings?: string[];
  reportUrl?: string;
  error?: string;
}

export interface ReferenceCheckRequest {
  applicationId: string;
  reference: {
    name: string;
    company: string;
    relationship: string;
    email: string;
    phone: string;
  };
  questions: string[];
  requestedBy: string;
}

export interface ReferenceCheckResult {
  success: boolean;
  checkId: string;
  status: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  completedAt: Date;
  responses: Array<{
    question: string;
    answer: string;
    rating?: number;
  }>;
  overallRating: number;
  notes?: string;
}
