/**
 * Order Progress and Milestone Types
 * Defines milestone tracking, progress updates, and delivery workflow
 */

// OrderStatus — canonical definition lives in order-status.ts (single source of truth)
export { OrderStatus } from './order-status.js';

export type MilestoneType =
  | 'ASSIGNMENT'
  | 'ACCEPTANCE'
  | 'INSPECTION_SCHEDULED'
  | 'INSPECTION_COMPLETE'
  | 'DRAFT_SUBMISSION'
  | 'DRAFT_REVIEW'
  | 'REVISION_REQUEST'
  | 'FINAL_SUBMISSION'
  | 'FINAL_REVIEW'
  | 'APPROVAL'
  | 'DELIVERY'
  | 'COMPLETION';

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface OrderMilestone {
  id: string;
  orderId: string;
  tenantId: string;
  type: MilestoneType;
  status: MilestoneStatus;
  
  // Timing
  scheduledDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
  
  // Actors
  assignedTo?: string;           // User/vendor responsible
  completedBy?: string;
  
  // Details
  notes?: string;
  metadata?: Record<string, any>;
  
  // Dependencies
  dependsOn?: string[];          // Milestone IDs that must complete first
  blockedBy?: string[];          // Issues blocking completion
  
  // Notifications
  notificationsSent?: {
    type: 'EMAIL' | 'SMS' | 'PUSH';
    sentTo: string;
    sentAt: Date;
    status: 'SENT' | 'DELIVERED' | 'FAILED';
  }[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderProgressUpdate {
  id: string;
  orderId: string;
  tenantId: string;
  
  // Status change
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  
  // Milestone
  milestoneType?: MilestoneType;
  milestoneId?: string;
  
  // Update details
  updatedBy: string;
  updateType: 'STATUS_CHANGE' | 'MILESTONE_COMPLETE' | 'NOTE_ADDED' | 'FILE_UPLOADED' | 'REVISION_REQUESTED';
  notes?: string;
  
  // Associated files
  fileIds?: string[];
  
  // Metadata
  metadata?: Record<string, any>;
  
  timestamp: Date;
}

export type DocumentType =
  | 'APPRAISAL_REPORT'
  | 'INSPECTION_PHOTOS'
  | 'COMPS'
  | 'FLOOR_PLAN'
  | 'SUPPORTING_DOCS'
  | 'REVISION_NOTES'
  | 'CLIENT_INSTRUCTIONS'
  | 'OTHER';

export type DocumentStatus = 
  | 'UPLOADED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUIRED'
  | 'ARCHIVED';

export interface OrderDocument {
  id: string;
  orderId: string;
  tenantId: string;
  
  // File details
  fileName: string;
  fileSize: number;            // bytes
  mimeType: string;
  documentType: DocumentType;
  
  // Storage
  blobUrl: string;             // Azure Blob Storage URL
  blobContainer: string;
  blobPath: string;
  
  // Version control
  version: number;
  isLatestVersion: boolean;
  previousVersionId?: string;
  
  // Classification
  status: DocumentStatus;
  isDraft: boolean;
  isFinal: boolean;
  
  // Upload details
  uploadedBy: string;
  uploadedByRole: 'VENDOR' | 'AMC' | 'CLIENT' | 'SYSTEM';
  uploadedAt: Date;
  
  // Review details
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  
  // Metadata
  tags?: string[];
  description?: string;
  metadata?: Record<string, any>;
  
  // Access control
  isClientVisible: boolean;
  isVendorVisible: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryPackage {
  id: string;
  orderId: string;
  tenantId: string;
  
  // Package details
  packageType: 'DRAFT' | 'FINAL' | 'REVISION' | 'ADDENDUM';
  version: number;
  
  // Documents included
  documentIds: string[];
  
  // Delivery status
  status: 'PREPARING' | 'READY' | 'DELIVERED' | 'ACKNOWLEDGED' | 'REJECTED';
  
  // Delivery details
  deliveredTo: string[];       // Client IDs
  deliveredAt?: Date;
  deliveryMethod: 'PORTAL' | 'EMAIL' | 'API' | 'FTP';
  
  // Acknowledgment
  acknowledgedBy?: string[];
  acknowledgedAt?: Date;
  
  // Quality metrics
  completenessScore?: number;  // 0-100
  qualityChecks?: {
    checkName: string;
    passed: boolean;
    notes?: string;
  }[];
  
  // Notes
  submissionNotes?: string;
  rejectionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionRequest {
  id: string;
  orderId: string;
  tenantId: string;
  
  // Request details
  requestedBy: string;
  requestedByRole: 'AMC' | 'CLIENT' | 'UNDERWRITER' | 'SYSTEM';
  requestType: 'TECHNICAL' | 'COMPLIANCE' | 'QUALITY' | 'CONTENT' | 'OTHER';
  
  // Related documents
  documentId?: string;
  packageId?: string;
  
  // Revision details
  issueCategory: string;
  description: string;
  specificPages?: number[];
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  
  // Resolution
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACKNOWLEDGED' | 'DISPUTED';
  assignedTo: string;          // Vendor ID
  dueDate: Date;
  
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  
  // Tracking
  estimatedResolutionTime?: number;  // hours
  actualResolutionTime?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderTimeline {
  orderId: string;
  events: {
    id: string;
    timestamp: Date;
    eventType: 'STATUS_CHANGE' | 'MILESTONE' | 'DOCUMENT_UPLOAD' | 'REVIEW' | 'COMMUNICATION' | 'NOTE';
    actor: string;
    actorRole: string;
    description: string;
    metadata?: Record<string, any>;
  }[];
}

export interface ProgressMetrics {
  orderId: string;
  
  // Overall progress
  overallCompletion: number;   // 0-100%
  currentPhase: string;
  
  // Milestone progress
  totalMilestones: number;
  completedMilestones: number;
  pendingMilestones: number;
  
  // Timing metrics
  daysElapsed: number;
  daysRemaining: number;
  estimatedCompletionDate: Date;
  onTimePercentage: number;
  
  // Quality metrics
  revisionCount: number;
  averageReviewTime: number;   // hours
  documentCompleteness: number; // %
  
  // Status
  isOnTrack: boolean;
  isAtRisk: boolean;
  riskFactors?: string[];
}
