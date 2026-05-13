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

/**
 * UAD-aligned photo type used as the blob path segment for report engine resolution.
 * Maps to `orders/{orderId}/photos/{reportPhotoType}/{photoId}.jpg` in Blob Storage.
 */
export type ReportPhotoType =
  | 'SUBJECT_FRONT'
  | 'SUBJECT_REAR'
  | 'SUBJECT_STREET'
  | 'SUBJECT_INTERIOR'
  | 'COMP_FRONT'
  | 'AERIAL'
  | 'FLOOR_PLAN'
  | 'ADDITIONAL';

/** Map from legacy upload category to UAD report photo type. */
export const CATEGORY_TO_REPORT_TYPE: Record<PhotoCategory, ReportPhotoType> = {
  exterior: 'SUBJECT_FRONT',
  street:   'SUBJECT_STREET',
  interior: 'SUBJECT_INTERIOR',
  damage:   'SUBJECT_INTERIOR',
  amenity:  'ADDITIONAL',
  other:    'ADDITIONAL',
};

export interface InspectionPhoto {
  id: string;
  type: 'photo';
  tenantId: string;
  /** Optional — present when photo was taken during a formal inspection sub-workflow. */
  inspectionId?: string;
  orderId: string;
  /**
   * UAD-aligned photo type. Determines the blob path segment used by the report engine:
   *   orders/{orderId}/photos/{reportPhotoType}/{photoId}.jpg
   */
  reportPhotoType: ReportPhotoType;
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
  /** Blob name of the 400×300 gallery thumbnail (needed for deletion). */
  thumbnailBlobName?: string;
  /** URL to 120×120 small thumbnail stored in Blob Storage */
  thumbnailSmallUrl?: string;
  /** Blob name of the 120×120 small thumbnail (needed for deletion). */
  thumbnailSmallBlobName?: string;
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
  /** Optional — only needed when photo is part of an inspection sub-workflow. */
  inspectionId?: string;
  orderId: string;
  category?: PhotoCategory;
  /**
   * UAD-aligned photo type override. If provided, takes precedence over `category`
   * for determining the blob path. If omitted, derived from `category`.
   */
  reportPhotoType?: ReportPhotoType;
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
  /** Only present when coverage was computed for a specific inspection sub-workflow. */
  inspectionId?: string;
  totalPhotos: number;
  coverageByCategory: Record<PhotoCategory, { count: number; required: number; met: boolean }>;
  overallMet: boolean;
  missingCategories: PhotoCategory[];
}

export interface PhotoQualityReport {
  /** Only present when report was computed for a specific inspection sub-workflow. */
  inspectionId?: string;
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
