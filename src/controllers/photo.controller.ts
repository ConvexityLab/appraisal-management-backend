/**
 * Photo Controller
 * REST API for inspection photo uploads and management (Phase 7)
 */

import { Response, Router } from 'express';
import multer from 'multer';
import { PhotoService, ImageResolutionError } from '../services/photo.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { PhotoUploadRequest, PhotoCoverageConfig } from '../types/photo.types.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

export class PhotoController {
  public router: Router;
  private photoService: PhotoService;
  private logger: Logger;

  constructor(dbService: CosmosDbService) {
    this.router = Router();
    this.photoService = new PhotoService(dbService);
    this.logger = new Logger('PhotoController');
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Upload
    this.router.post('/upload', upload.single('photo'), this.uploadPhoto.bind(this));

    // Read
    this.router.get('/inspection/:inspectionId', this.getPhotosByInspection.bind(this));
    this.router.get('/order/:orderId', this.getPhotosByOrder.bind(this));
    this.router.get('/:id', this.getPhoto.bind(this));

    // Update
    this.router.patch('/:id', this.updatePhoto.bind(this));
    this.router.post('/reorder', this.reorderPhotos.bind(this));

    // Delete
    this.router.delete('/:id', this.deletePhoto.bind(this));

    // Analysis
    this.router.get('/inspection/:inspectionId/coverage', this.getCoverage.bind(this));
    this.router.get('/inspection/:inspectionId/quality-report', this.getQualityReport.bind(this));
    this.router.get('/duplicates/:orderId', this.getDuplicates.bind(this));
  }

  /**
   * POST /api/photos/upload
   * Upload and process a photo for an inspection.
   */
  private async uploadPhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const uploadRequest: PhotoUploadRequest = {
        inspectionId: req.body.inspectionId,
        orderId: req.body.orderId,
        category: req.body.category,
        caption: req.body.caption,
        ...(req.body.sequenceNumber && { sequenceNumber: parseInt(req.body.sequenceNumber) }),
        ...(req.body.propertyLat && { propertyLat: parseFloat(req.body.propertyLat) }),
        ...(req.body.propertyLon && { propertyLon: parseFloat(req.body.propertyLon) }),
        ...(req.body.inspectionDate && { inspectionDate: req.body.inspectionDate })
      };

      if (!uploadRequest.inspectionId || !uploadRequest.orderId) {
        res.status(400).json({ success: false, error: 'inspectionId and orderId are required' });
        return;
      }

      const photo = await this.photoService.uploadPhoto(
        uploadRequest,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(201).json({ success: true, data: photo });
    } catch (error) {
      if (error instanceof ImageResolutionError) {
        res.status(422).json({ success: false, error: (error as Error).message });
        return;
      }
      this.logger.error('Error uploading photo', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to upload photo' });
    }
  }

  /**
   * GET /api/photos/inspection/:inspectionId
   * Get all photos for an inspection.
   */
  private async getPhotosByInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { inspectionId } = req.params;
      const photos = await this.photoService.getPhotosByInspection(inspectionId!);
      res.json({ success: true, data: photos, count: photos.length, inspectionId });
    } catch (error) {
      this.logger.error('Error getting photos by inspection', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to retrieve photos' });
    }
  }

  /**
   * GET /api/photos/order/:orderId
   * Get all photos across all inspections for an order.
   */
  private async getPhotosByOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const photos = await this.photoService.getPhotosByOrder(orderId!);
      res.json({ success: true, data: photos, count: photos.length, orderId });
    } catch (error) {
      this.logger.error('Error getting photos by order', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to retrieve photos' });
    }
  }

  /**
   * GET /api/photos/:id
   * Get a specific photo by ID.
   */
  private async getPhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const photo = await this.photoService.getPhotoById(req.params.id!);
      if (!photo) {
        res.status(404).json({ success: false, error: 'Photo not found' });
        return;
      }
      res.json({ success: true, data: photo });
    } catch (error) {
      this.logger.error('Error getting photo', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to retrieve photo' });
    }
  }

  /**
   * PATCH /api/photos/:id
   * Update caption, category, or sequenceNumber on a photo.
   */
  private async updatePhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { caption, category, sequenceNumber } = req.body as {
        caption?: string;
        category?: string;
        sequenceNumber?: number;
      };
      const updated = await this.photoService.updatePhoto(req.params.id!, {
        ...(caption !== undefined && { caption }),
        ...(category !== undefined && { category: category as any }),
        ...(sequenceNumber !== undefined && { sequenceNumber })
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      this.logger.error('Error updating photo', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to update photo' });
    }
  }

  /**
   * POST /api/photos/reorder
   * Body: { items: Array<{ id: string; sequenceNumber: number }> }
   */
  private async reorderPhotos(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { items } = req.body as { items: Array<{ id: string; sequenceNumber: number }> };
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'items array is required' });
        return;
      }
      await this.photoService.reorderPhotos(items);
      res.json({ success: true, message: `Reordered ${items.length} photos` });
    } catch (error) {
      this.logger.error('Error reordering photos', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to reorder photos' });
    }
  }

  /**
   * DELETE /api/photos/:id
   * Delete a photo and its thumbnails.
   */
  private async deletePhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      await this.photoService.deletePhoto(req.params.id!);
      res.json({ success: true, message: 'Photo deleted successfully' });
    } catch (error) {
      this.logger.error('Error deleting photo', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to delete photo' });
    }
  }

  /**
   * GET /api/photos/inspection/:inspectionId/coverage
   * Query params: orderId (required), productType (optional)
   */
  private async getCoverage(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { inspectionId } = req.params;
      const { orderId, productType = 'BPO' } = req.query as { orderId?: string; productType?: string };

      if (!orderId) {
        res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        return;
      }

      const config: PhotoCoverageConfig = (req.body && req.body.requirements)
        ? (req.body as PhotoCoverageConfig)
        : {
            productType,
            requirements: [
              { category: 'exterior', minCount: 4, required: true },
              { category: 'interior', minCount: 3, required: true },
              { category: 'street', minCount: 1, required: true },
              { category: 'damage', minCount: 0, required: false },
              { category: 'amenity', minCount: 0, required: false }
            ]
          };

      const result = await this.photoService.getCoverage(inspectionId!, orderId, config);
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('Error getting coverage', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to compute coverage' });
    }
  }

  /**
   * GET /api/photos/inspection/:inspectionId/quality-report
   * Query params: orderId (required)
   */
  private async getQualityReport(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { inspectionId } = req.params;
      const { orderId } = req.query as { orderId?: string };

      if (!orderId) {
        res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        return;
      }

      const report = await this.photoService.getQualityReport(inspectionId!, orderId);
      res.json({ success: true, data: report });
    } catch (error) {
      this.logger.error('Error getting quality report', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to generate quality report' });
    }
  }

  /**
   * GET /api/photos/duplicates/:orderId
   * Returns all duplicate photo pairs within an order.
   */
  private async getDuplicates(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const duplicates = await this.photoService.getDuplicatesForOrder(orderId!);
      res.json({ success: true, data: duplicates, count: duplicates.length, orderId });
    } catch (error) {
      this.logger.error('Error getting duplicates', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ success: false, error: 'Failed to detect duplicates' });
    }
  }
}
