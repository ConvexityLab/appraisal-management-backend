/**
 * Photo Controller
 * REST API for inspection photo uploads and management
 */

import { Response, Router } from 'express';
import multer from 'multer';
import { PhotoService } from '../services/photo.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { PhotoUploadRequest } from '../types/photo.types.js';

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
    this.router.post('/upload', upload.single('photo'), this.uploadPhoto.bind(this));
    this.router.get('/inspection/:inspectionId', this.getPhotosByInspection.bind(this));
    this.router.get('/:id', this.getPhoto.bind(this));
    this.router.delete('/:id', this.deletePhoto.bind(this));
  }

  /**
   * POST /api/photos/upload
   * Upload photo for inspection
   */
  private async uploadPhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const uploadRequest: PhotoUploadRequest = {
        inspectionId: req.body.inspectionId,
        orderId: req.body.orderId,
        category: req.body.category,
        caption: req.body.caption,
        ...(req.body.sequenceNumber && { sequenceNumber: parseInt(req.body.sequenceNumber) })
      };

      if (!uploadRequest.inspectionId || !uploadRequest.orderId) {
        res.status(400).json({
          success: false,
          error: 'inspectionId and orderId are required'
        });
        return;
      }

      const photo = await this.photoService.uploadPhoto(
        uploadRequest,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(201).json({
        success: true,
        data: photo
      });
    } catch (error) {
      this.logger.error('Error uploading photo', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to upload photo'
      });
    }
  }

  /**
   * GET /api/photos/inspection/:inspectionId
   * Get all photos for an inspection
   */
  private async getPhotosByInspection(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const inspectionId = req.params.inspectionId!;
      
      const photos = await this.photoService.getPhotosByInspection(inspectionId);
      
      res.json({
        success: true,
        data: photos,
        count: photos.length,
        inspectionId
      });
    } catch (error) {
      this.logger.error('Error getting photos', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve photos'
      });
    }
  }

  /**
   * GET /api/photos/:id
   * Get specific photo
   */
  private async getPhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      
      const photo = await this.photoService.getPhotoById(id);
      
      if (!photo) {
        res.status(404).json({
          success: false,
          error: 'Photo not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: photo
      });
    } catch (error) {
      this.logger.error('Error getting photo', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve photo'
      });
    }
  }

  /**
   * DELETE /api/photos/:id
   * Delete photo
   */
  private async deletePhoto(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      
      await this.photoService.deletePhoto(id);
      
      res.json({
        success: true,
        message: 'Photo deleted successfully'
      });
    } catch (error) {
      this.logger.error('Error deleting photo', { 
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete photo'
      });
    }
  }
}
