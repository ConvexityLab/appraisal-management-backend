import { Router, Response } from 'express';
import multer from 'multer';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BlobStorageService } from '../services/blob-storage.service';
import { DocumentService } from '../services/document.service';
import { DocumentUploadRequest, DocumentUpdateRequest, DocumentListQuery } from '../types/document.types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

export class DocumentController {
  public router: Router;
  private documentService: DocumentService;

  // Multer configuration for file uploads
  private upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB limit
    }
  });

  constructor(private dbService: CosmosDbService) {
    this.router = Router();
    
    // Initialize services
    const blobService = new BlobStorageService();
    this.documentService = new DocumentService(dbService, blobService);

    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * POST /upload
     * Upload a document file
     */
    this.router.post(
      '/upload',
      this.upload.single('file'),
      this.uploadDocument.bind(this)
    );

    /**
     * GET /
     * List documents with optional filtering
     */
    this.router.get(
      '/',
      this.listDocuments.bind(this)
    );

    /**
     * GET /:id
     * Get a single document by ID
     */
    this.router.get(
      '/:id',
      this.getDocument.bind(this)
    );

    /**
     * GET /:id/download
     * Get document download URL
     */
    this.router.get(
      '/:id/download',
      this.downloadDocument.bind(this)
    );

    /**
     * PUT /:id
     * Update document metadata
     */
    this.router.put(
      '/:id',
      this.updateDocument.bind(this)
    );

    /**
     * DELETE /:id
     * Delete a document
     */
    this.router.delete(
      '/:id',
      this.deleteDocument.bind(this)
    );
  }

  /**
   * POST /upload
   * Upload a document file
   */
  private async uploadDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const { orderId, category, tags, metadata } = req.body as DocumentUploadRequest & {
        tags?: string | string[];
        metadata?: string | Record<string, unknown>;
      };

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: 'orderId is required'
        });
        return;
      }

      // Parse tags if it's a JSON string
      let parsedTags: string[] | undefined;
      if (tags) {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      }

      // Parse metadata if it's a JSON string
      let parsedMetadata: Record<string, unknown> | undefined;
      if (metadata) {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      }

      const tenantId = req.user?.tenantId!;
      const userId = req.user?.id!;

      const result = await this.documentService.uploadDocument(
        orderId,
        tenantId,
        req.file,
        userId,
        category,
        parsedTags,
        parsedMetadata
      );

      if (!result.success) {
        res.status(500).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error in uploadDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload document'
      });
    }
  }

  /**
   * GET /
   * List documents with optional filtering
   */
  private async listDocuments(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId!;
      
      const query: DocumentListQuery = {};
      if (req.query.orderId) query.orderId = req.query.orderId as string;
      if (req.query.category) query.category = req.query.category as string;
      if (req.query.limit) query.limit = parseInt(req.query.limit as string, 10);
      if (req.query.offset) query.offset = parseInt(req.query.offset as string, 10);

      const result = await this.documentService.listDocuments(tenantId, query);

      if (!result.success) {
        res.status(500).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in listDocuments:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list documents'
      });
    }
  }

  /**
   * GET /:id
   * Get a single document by ID
   */
  private async getDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const tenantId = req.user?.tenantId!;

      const result = await this.documentService.getDocument(id, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in getDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document'
      });
    }
  }

  /**
   * GET /:id/download
   * Get document download URL
   */
  private async downloadDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const tenantId = req.user?.tenantId!;

      const result = await this.documentService.getDocumentDownloadUrl(id, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in downloadDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get download URL'
      });
    }
  }

  /**
   * PUT /:id
   * Update document metadata
   */
  private async updateDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const tenantId = req.user?.tenantId!;
      const updates: DocumentUpdateRequest = req.body;

      const result = await this.documentService.updateDocument(id, tenantId, updates);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in updateDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document'
      });
    }
  }

  /**
   * DELETE /:id
   * Delete a document
   */
  private async deleteDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const tenantId = req.user?.tenantId!;

      const result = await this.documentService.deleteDocument(id, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in deleteDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      });
    }
  }
}
