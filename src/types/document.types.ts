/**
 * Document Management Types
 * Simple REST API approach for document upload and management
 */

export interface DocumentMetadata {
  id: string;
  tenantId: string;
  orderId: string;
  name: string;
  blobUrl: string;
  blobName: string;
  fileSize: number;
  mimeType: string;
  category?: string; // e.g., 'appraisal_report', 'photo', 'invoice', 'contract', 'other'
  tags?: string[];
  version?: number;
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface DocumentUploadRequest {
  orderId: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentUpdateRequest {
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentListQuery {
  orderId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}
