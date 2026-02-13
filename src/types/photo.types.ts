/**
 * Photo Management Types
 * Types for inspection photo uploads and management
 */

export interface InspectionPhoto {
  id: string;
  type: 'photo';
  tenantId: string;
  inspectionId: string;
  orderId: string;
  blobUrl: string;
  blobName: string;
  containerName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category?: 'exterior' | 'interior' | 'damage' | 'amenity' | 'other';
  caption?: string;
  sequenceNumber?: number;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, string>;
}

export interface PhotoUploadRequest {
  inspectionId: string;
  orderId: string;
  category?: 'exterior' | 'interior' | 'damage' | 'amenity' | 'other';
  caption?: string;
  sequenceNumber?: number;
}
