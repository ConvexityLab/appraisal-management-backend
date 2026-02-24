/**
 * Photo Service
 * Business logic for inspection photo management with Phase 7 intelligence:
 *   - Auto-rotation, thumbnail generation, EXIF extraction
 *   - Geo-verification against property address
 *   - Timestamp verification against inspection appointment
 *   - Coverage analysis
 *   - Duplicate detection via perceptual hashing
 *   - Batch quality reports
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import { Logger } from '../utils/logger.js';
import {
  processUploadedPhoto,
  generateThumbnails,
  haversineDistanceMeters,
  GEO_VERIFY_THRESHOLD_METERS,
  pHashDistance,
  DUPLICATE_HASH_THRESHOLD,
  ImageResolutionError
} from '../utils/image-processing.js';
import type {
  InspectionPhoto,
  PhotoUploadRequest,
  PhotoCoverageConfig,
  PhotoCoverageResult,
  PhotoQualityReport,
  PhotoComparisonResult,
  PhotoCategory
} from '../types/photo.types.js';

export class PhotoService {
  private cosmosService: CosmosDbService;
  private blobService: BlobStorageService;
  private logger: Logger;

  constructor(cosmosService: CosmosDbService) {
    this.cosmosService = cosmosService;
    this.blobService = new BlobStorageService();
    this.logger = new Logger('PhotoService');
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  /**
   * Upload a photo, process it (auto-rotate, thumbnail, EXIF, hash), and persist.
   * Throws ImageResolutionError if the image is below minimum resolution.
   */
  async uploadPhoto(
    request: PhotoUploadRequest,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string = 'test-tenant-123',
    userId: string = 'test-user'
  ): Promise<InspectionPhoto> {
    // Process the image — rotates, converts HEIC, generates hash, scores quality
    const processed = await processUploadedPhoto(fileBuffer, mimeType);
    const thumbnails = await generateThumbnails(processed.buffer);

    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const containerName = 'inspection-photos';
    const basePath = `inspections/${request.inspectionId}/${photoId}`;
    const baseName = fileName.replace(/\.[^.]+$/, '');

    // Upload processed image + thumbnails in parallel
    const [uploadResult, thumbGalleryResult, thumbSmallResult] = await Promise.all([
      this.blobService.uploadBlob({
        containerName,
        blobName: `${basePath}-${baseName}.jpg`,
        data: processed.buffer,
        contentType: 'image/jpeg',
        metadata: {
          inspectionId: request.inspectionId,
          orderId: request.orderId,
          uploadedBy: userId,
          category: request.category ?? 'other'
        }
      }),
      this.blobService.uploadBlob({
        containerName,
        blobName: `${basePath}-thumb-gallery.jpg`,
        data: thumbnails.gallery,
        contentType: 'image/jpeg',
        metadata: { type: 'thumbnail-gallery' }
      }),
      this.blobService.uploadBlob({
        containerName,
        blobName: `${basePath}-thumb-small.jpg`,
        data: thumbnails.small,
        contentType: 'image/jpeg',
        metadata: { type: 'thumbnail-small' }
      })
    ]);

    // Geo-verification (optional — requires property coords on the request)
    let geoVerified: boolean | undefined;
    let geoDistanceMeters: number | undefined;
    if (
      request.propertyLat !== undefined &&
      request.propertyLon !== undefined &&
      processed.exifData.gpsLatitude !== undefined &&
      processed.exifData.gpsLongitude !== undefined
    ) {
      geoDistanceMeters = haversineDistanceMeters(
        processed.exifData.gpsLatitude,
        processed.exifData.gpsLongitude,
        request.propertyLat,
        request.propertyLon
      );
      geoVerified = geoDistanceMeters <= GEO_VERIFY_THRESHOLD_METERS;
    }

    // Timestamp verification (optional — requires inspection date on the request)
    let timestampVerified: boolean | undefined;
    if (request.inspectionDate && processed.exifData.dateTaken) {
      const photoDate = new Date(processed.exifData.dateTaken);
      const inspDate = new Date(request.inspectionDate);
      // Allow ± 24 h window around the inspection date
      const diffHours = Math.abs(photoDate.getTime() - inspDate.getTime()) / 3_600_000;
      timestampVerified = diffHours <= 24;
    }

    const photo: InspectionPhoto = {
      id: photoId,
      type: 'photo',
      tenantId,
      inspectionId: request.inspectionId,
      orderId: request.orderId,
      blobUrl: uploadResult.url,
      blobName: uploadResult.blobName,
      containerName: uploadResult.containerName,
      thumbnailUrl: thumbGalleryResult.url,
      thumbnailSmallUrl: thumbSmallResult.url,
      fileName,
      fileSize: fileBuffer.length,
      mimeType: 'image/jpeg',
      format: 'jpeg',
      originalFormat: processed.originalFormat,
      isAutoRotated: processed.isAutoRotated,
      width: processed.width,
      height: processed.height,
      exifData: processed.exifData,
      pHash: processed.pHash,
      dominantColors: processed.dominantColors,
      qualityScore: processed.qualityScore,
      ...(request.category && { category: request.category }),
      ...(request.caption && { caption: request.caption }),
      ...(request.sequenceNumber !== undefined && { sequenceNumber: request.sequenceNumber }),
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      ...(geoVerified !== undefined && { geoVerified }),
      ...(geoDistanceMeters !== undefined && { geoDistanceMeters }),
      ...(timestampVerified !== undefined && { timestampVerified })
    };

    const container = this.cosmosService.getContainer('orders');
    await container.items.create(photo);

    this.logger.info('Photo uploaded and processed', {
      photoId,
      inspectionId: request.inspectionId,
      quality: processed.qualityScore,
      geoVerified,
      isAutoRotated: processed.isAutoRotated
    });

    return photo;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async getPhotosByInspection(
    inspectionId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<InspectionPhoto[]> {
    const container = this.cosmosService.getContainer('orders');
    const { resources } = await container.items
      .query<InspectionPhoto>({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.inspectionId = @inspectionId AND c.tenantId = @tenantId ORDER BY c.sequenceNumber, c.uploadedAt',
        parameters: [
          { name: '@type', value: 'photo' },
          { name: '@inspectionId', value: inspectionId },
          { name: '@tenantId', value: tenantId }
        ]
      })
      .fetchAll();
    return resources;
  }

  async getPhotosByOrder(
    orderId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<InspectionPhoto[]> {
    const container = this.cosmosService.getContainer('orders');
    const { resources } = await container.items
      .query<InspectionPhoto>({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.sequenceNumber, c.uploadedAt',
        parameters: [
          { name: '@type', value: 'photo' },
          { name: '@orderId', value: orderId },
          { name: '@tenantId', value: tenantId }
        ]
      })
      .fetchAll();
    return resources;
  }

  async getPhotoById(
    photoId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<InspectionPhoto | null> {
    const container = this.cosmosService.getContainer('orders');
    const { resource } = await container.item(photoId, tenantId).read<InspectionPhoto>();
    return resource ?? null;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  /**
   * Patch mutable fields on a photo: caption, category, sequenceNumber.
   */
  async updatePhoto(
    photoId: string,
    updates: { caption?: string; category?: PhotoCategory; sequenceNumber?: number },
    tenantId: string = 'test-tenant-123'
  ): Promise<InspectionPhoto> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: existing } = await container.item(photoId, tenantId).read<InspectionPhoto>();

    if (!existing) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    const updated: InspectionPhoto = {
      ...existing,
      ...(updates.caption !== undefined && { caption: updates.caption }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.sequenceNumber !== undefined && { sequenceNumber: updates.sequenceNumber })
    };

    const { resource } = await container.item(photoId, tenantId).replace(updated);
    return resource!;
  }

  /**
   * Reorder photos by setting sequenceNumber for each { id, sequenceNumber } pair.
   */
  async reorderPhotos(
    items: Array<{ id: string; sequenceNumber: number }>,
    tenantId: string = 'test-tenant-123'
  ): Promise<void> {
    const container = this.cosmosService.getContainer('orders');
    await Promise.all(
      items.map(async ({ id, sequenceNumber }) => {
        const { resource: photo } = await container.item(id, tenantId).read<InspectionPhoto>();
        if (photo) {
          await container.item(id, tenantId).replace({ ...photo, sequenceNumber });
        }
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async deletePhoto(
    photoId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<void> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: photo } = await container.item(photoId, tenantId).read<InspectionPhoto>();

    if (!photo) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    // Delete blobs: main image + thumbnails (thumbnail deletes are best-effort)
    await Promise.all([
      this.blobService.deleteBlob(photo.containerName, photo.blobName),
      photo.thumbnailUrl
        ? this.blobService
            .deleteBlob(photo.containerName, photo.blobName.replace(/\.jpg$/, '-thumb-gallery.jpg'))
            .catch(() => {})
        : Promise.resolve(),
      photo.thumbnailSmallUrl
        ? this.blobService
            .deleteBlob(photo.containerName, photo.blobName.replace(/\.jpg$/, '-thumb-small.jpg'))
            .catch(() => {})
        : Promise.resolve()
    ]);

    await container.item(photoId, tenantId).delete();
    this.logger.info('Photo deleted', { photoId });
  }

  // ---------------------------------------------------------------------------
  // Coverage analysis
  // ---------------------------------------------------------------------------

  /**
   * Evaluate photo coverage against a configuration for a given inspection.
   */
  async getCoverage(
    inspectionId: string,
    orderId: string,
    config: PhotoCoverageConfig,
    tenantId: string = 'test-tenant-123'
  ): Promise<PhotoCoverageResult> {
    const photos = await this.getPhotosByInspection(inspectionId, tenantId);

    const countByCategory = photos.reduce<Record<string, number>>((acc, p) => {
      const cat = p.category ?? 'other';
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    }, {});

    const coverageByCategory = {} as PhotoCoverageResult['coverageByCategory'];
    const missingCategories: PhotoCategory[] = [];

    for (const req of config.requirements) {
      const count = countByCategory[req.category] ?? 0;
      const met = count >= req.minCount;
      coverageByCategory[req.category] = { count, required: req.minCount, met };
      if (req.required && !met) {
        missingCategories.push(req.category);
      }
    }

    return {
      orderId,
      inspectionId,
      totalPhotos: photos.length,
      coverageByCategory,
      overallMet: missingCategories.length === 0,
      missingCategories
    };
  }

  // ---------------------------------------------------------------------------
  // Quality report
  // ---------------------------------------------------------------------------

  async getQualityReport(
    inspectionId: string,
    orderId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<PhotoQualityReport> {
    const photos = await this.getPhotosByInspection(inspectionId, tenantId);

    const photoReports = photos.map((p) => {
      const issues: string[] = [];
      if ((p.qualityScore ?? 0) < 50) issues.push('low_quality_score');
      if (p.geoVerified === false) issues.push('geo_not_verified');
      if (p.timestampVerified === false) issues.push('timestamp_not_verified');
      if (!p.width || !p.height || p.width < 800 || p.height < 600)
        issues.push('below_min_resolution');
      return { id: p.id, qualityScore: p.qualityScore ?? 0, issues };
    });

    const totalQuality = photoReports.reduce((sum, p) => sum + p.qualityScore, 0);

    return {
      inspectionId,
      orderId,
      totalPhotos: photos.length,
      averageQualityScore:
        photos.length > 0 ? Math.round(totalQuality / photos.length) : 0,
      geoVerifiedCount: photos.filter((p) => p.geoVerified === true).length,
      timestampVerifiedCount: photos.filter((p) => p.timestampVerified === true).length,
      duplicateCount: await this._countDuplicates(photos),
      belowMinResolutionCount: photos.filter(
        (p) => !p.width || !p.height || p.width < 800 || p.height < 600
      ).length,
      categoryBreakdown: photos.reduce<Record<PhotoCategory, number>>((acc, p) => {
        const cat = p.category ?? 'other';
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
      }, {} as Record<PhotoCategory, number>),
      photos: photoReports
    };
  }

  // ---------------------------------------------------------------------------
  // Duplicate detection
  // ---------------------------------------------------------------------------

  private async _countDuplicates(photos: InspectionPhoto[]): Promise<number> {
    const withHash = photos.filter((p) => p.pHash);
    const duplicateIds = new Set<string>();

    for (let i = 0; i < withHash.length; i++) {
      for (let j = i + 1; j < withHash.length; j++) {
        if (pHashDistance(withHash[i]!.pHash!, withHash[j]!.pHash!) <= DUPLICATE_HASH_THRESHOLD) {
          duplicateIds.add(withHash[i]!.id);
          duplicateIds.add(withHash[j]!.id);
        }
      }
    }

    return duplicateIds.size;
  }

  /**
   * Find all duplicate pairs within a single order (across all inspections).
   */
  async getDuplicatesForOrder(
    orderId: string,
    tenantId: string = 'test-tenant-123'
  ): Promise<PhotoComparisonResult[]> {
    const photos = await this.getPhotosByOrder(orderId, tenantId);
    const withHash = photos.filter((p) => p.pHash);
    const results: PhotoComparisonResult[] = [];

    for (let i = 0; i < withHash.length; i++) {
      for (let j = i + 1; j < withHash.length; j++) {
        const dist = pHashDistance(withHash[i]!.pHash!, withHash[j]!.pHash!);
        if (dist <= DUPLICATE_HASH_THRESHOLD) {
          results.push({
            photo1Id: withHash[i]!.id,
            photo2Id: withHash[j]!.id,
            pHashDistance: dist,
            isDuplicate: true,
            similarity: Math.round((1 - dist / 64) * 100) / 100
          });
        }
      }
    }

    return results;
  }
}

export { ImageResolutionError };
