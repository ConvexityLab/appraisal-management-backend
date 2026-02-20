/**
 * Document Management Types
 * Simple REST API approach for document upload and management
 */

export interface DocumentMetadata {
  id: string;
  tenantId: string;
  orderId?: string;  // Optional — entity-scoped docs (vendor, appraiser) may not have an order
  name: string;
  blobUrl: string;
  blobName: string;
  fileSize: number;
  mimeType: string;
  category?: string; // e.g., 'appraisal_report', 'photo', 'invoice', 'contract', 'license', 'certification', 'other'
  tags?: string[];
  version?: number;
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
  // Entity association — allows querying documents by vendor, appraiser, client, etc.
  entityType?: string;  // 'order' | 'vendor' | 'appraiser' | 'client' | 'property'
  entityId?: string;    // The ID of the associated entity
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
  entityType?: string;   // Filter by entity type: 'vendor', 'appraiser', 'order', etc.
  entityId?: string;     // Filter by entity ID (requires entityType)
  limit?: number;
  offset?: number;
}
