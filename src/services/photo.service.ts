/**
 * Photo Service
 * Business logic for inspection photo management
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import { Logger } from '../utils/logger.js';
import type { InspectionPhoto, PhotoUploadRequest } from '../types/photo.types.js';

export class PhotoService {
  private cosmosService: CosmosDbService;
  private blobService: BlobStorageService;
  private logger: Logger;

  constructor(cosmosService: CosmosDbService) {
    this.cosmosService = cosmosService;
    this.blobService = new BlobStorageService();
    this.logger = new Logger('PhotoService');
  }

  /**
   * Upload photo for inspection
   */
  async uploadPhoto(
    request: PhotoUploadRequest,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    tenantId: string = 'test-tenant-123',
    userId: string = 'test-user'
  ): Promise<InspectionPhoto> {
    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const blobName = `inspections/${request.inspectionId}/${photoId}-${fileName}`;
    const containerName = 'inspection-photos';

    // Upload to blob storage
    const uploadResult = await this.blobService.uploadBlob({
      containerName,
      blobName,
      data: fileBuffer,
      contentType: mimeType,
      metadata: {
        inspectionId: request.inspectionId,
        orderId: request.orderId,
        uploadedBy: userId,
        category: request.category || 'other'
      }
    });

    // Save metadata to Cosmos
    const photo: InspectionPhoto = {
      id: photoId,
      type: 'photo',
      tenantId,
      inspectionId: request.inspectionId,
      orderId: request.orderId,
      blobUrl: uploadResult.url,
      blobName: uploadResult.blobName,
      containerName: uploadResult.containerName,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      ...(request.category && { category: request.category }),
      ...(request.caption && { caption: request.caption }),
      ...(request.sequenceNumber && { sequenceNumber: request.sequenceNumber }),
      uploadedBy: userId,
      uploadedAt: new Date().toISOString()
    };

    const container = this.cosmosService.getContainer('orders');
    await container.items.create(photo);

    this.logger.info('Photo uploaded', { photoId, inspectionId: request.inspectionId });
    return photo;
  }

  /**
   * Get all photos for an inspection
   */
  async getPhotosByInspection(inspectionId: string, tenantId: string = 'test-tenant-123'): Promise<InspectionPhoto[]> {
    const container = this.cosmosService.getContainer('orders');
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.inspectionId = @inspectionId AND c.tenantId = @tenantId ORDER BY c.sequenceNumber, c.uploadedAt',
      parameters: [
        { name: '@type', value: 'photo' },
        { name: '@inspectionId', value: inspectionId },
        { name: '@tenantId', value: tenantId }
      ]
    };

    const { resources } = await container.items.query<InspectionPhoto>(querySpec).fetchAll();
    return resources;
  }

  /**
   * Get specific photo by ID
   */
  async getPhotoById(photoId: string, tenantId: string = 'test-tenant-123'): Promise<InspectionPhoto | null> {
    const container = this.cosmosService.getContainer('orders');
    const { resource } = await container.item(photoId, tenantId).read<InspectionPhoto>();
    return resource || null;
  }

  /**
   * Delete photo
   */
  async deletePhoto(photoId: string, tenantId: string = 'test-tenant-123'): Promise<void> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: photo } = await container.item(photoId, tenantId).read<InspectionPhoto>();

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Delete from blob storage
    await this.blobService.deleteBlob(photo.containerName, photo.blobName);

    // Delete metadata from Cosmos
    await container.item(photoId, tenantId).delete();

    this.logger.info('Photo deleted', { photoId });
  }
}
