/**
 * Photo Management Types
 * Types for inspection photo uploads and management
 */

export type PhotoCategory = 'exterior' | 'interior' | 'damage' | 'amenity' | 'street' | 'other';

export interface PhotoExifData {
  /** ISO 8601 date from EXIF DateTimeOriginal */
  dateTaken?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  cameraMake?: string;
  cameraModel?: string;
  /** EXIF orientation tag value (1–8) */
  orientation?: number;
  /** Original width in pixels before any rotation */
  originalWidth?: number;
  /** Original height in pixels before any rotation */
  originalHeight?: number;
}

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
  category?: PhotoCategory;
  caption?: string;
  sequenceNumber?: number;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, string>;

  // --- Phase 7 enriched fields ---
  /** URL to 400×300 gallery thumbnail stored in Blob Storage */
  thumbnailUrl?: string;
  /** URL to 120×120 small thumbnail stored in Blob Storage */
  thumbnailSmallUrl?: string;
  /** Final width after auto-rotation (pixels) */
  width?: number;
  /** Final height after auto-rotation (pixels) */
  height?: number;
  /** Normalised image format: 'jpeg' | 'png' | 'webp' | 'heif' */
  format?: string;
  /** Format prior to any HEIC→JPEG conversion */
  originalFormat?: string;
  /** Whether the image was auto-rotated based on EXIF orientation */
  isAutoRotated?: boolean;
  /** Parsed EXIF metadata */
  exifData?: PhotoExifData;
  /** 16-char hex perceptual (average) hash for duplicate detection */
  pHash?: string;
  /** Dominant colour(s) as CSS hex strings */
  dominantColors?: string[];
  /** 0–100 quality score based on resolution and file size */
  qualityScore?: number;

  // --- Geo / timestamp verification ---
  /** true if GPS coordinates are within 500 m of the order property */
  geoVerified?: boolean;
  /** Distance in metres from photo GPS to property address */
  geoDistanceMeters?: number;
  /** true if EXIF timestamp falls within the inspection appointment window */
  timestampVerified?: boolean;
}

export interface PhotoUploadRequest {
  inspectionId: string;
  orderId: string;
  category?: PhotoCategory;
  caption?: string;
  sequenceNumber?: number;
  /** Property latitude for geo-verification (decimal degrees) */
  propertyLat?: number;
  /** Property longitude for geo-verification (decimal degrees) */
  propertyLon?: number;
  /** ISO 8601 inspection appointment start time for timestamp verification */
  inspectionDate?: string;
}

export interface PhotoCoverageRequirement {
  category: PhotoCategory;
  minCount: number;
  required: boolean;
  description?: string;
}

export interface PhotoCoverageConfig {
  productType: string;
  requirements: PhotoCoverageRequirement[];
}

export interface PhotoCoverageResult {
  orderId: string;
  inspectionId: string;
  totalPhotos: number;
  coverageByCategory: Record<PhotoCategory, { count: number; required: number; met: boolean }>;
  overallMet: boolean;
  missingCategories: PhotoCategory[];
}

export interface PhotoQualityReport {
  inspectionId: string;
  orderId: string;
  totalPhotos: number;
  averageQualityScore: number;
  geoVerifiedCount: number;
  timestampVerifiedCount: number;
  duplicateCount: number;
  belowMinResolutionCount: number;
  categoryBreakdown: Record<PhotoCategory, number>;
  photos: Array<{ id: string; qualityScore: number; issues: string[] }>;
}

export interface PhotoComparisonResult {
  photo1Id: string;
  photo2Id: string;
  pHashDistance: number;
  isDuplicate: boolean;
  /** 0–1 similarity score (1 = identical) */
  similarity: number;
}
