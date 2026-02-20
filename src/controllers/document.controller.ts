import { Router, Response } from 'express';
import multer from 'multer';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BlobStorageService } from '../services/blob-storage.service';
import { DocumentService } from '../services/document.service';
import { DocumentUploadRequest, DocumentUpdateRequest, DocumentListQuery, DocumentMetadata } from '../types/document.types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

/**
 * Maps a backend DocumentMetadata record to the shape the frontend expects.
 * Field renames: name→fileName, blobName→blobPath, category→documentType, uploadedBy string→object.
 * Adds default status ('pending') and version (1) when absent.
 */
function toFrontendDocument(doc: DocumentMetadata): Record<string, unknown> {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    orderId: doc.orderId,
    entityType: doc.entityType,
    entityId: doc.entityId,
    documentType: doc.category || 'other',
    fileName: doc.name,
    blobUrl: doc.blobUrl,
    blobPath: doc.blobName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    status: 'pending',
    uploadedBy: { userId: doc.uploadedBy, name: doc.uploadedBy },
    uploadedAt: doc.uploadedAt,
    modifiedAt: doc.updatedAt,
    version: doc.version ?? 1,
    metadata: doc.metadata ? { tags: doc.tags, ...doc.metadata as Record<string, unknown> } : (doc.tags ? { tags: doc.tags } : undefined)
  };
}

export class DocumentController {
  public router: Router;
  private documentService: DocumentService;
  private blobService: BlobStorageService;

  // Azure AD tid claim is a directory GUID, not our app tenant.
  // All seed data uses this value, so we hard-code it until tenant resolution middleware is built.
  private static readonly APP_TENANT_ID = 'test-tenant-123';

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
    this.blobService = new BlobStorageService();
    this.documentService = new DocumentService(dbService, this.blobService);

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

      const body = req.body as DocumentUploadRequest & {
        documentType?: string;
        tags?: string | string[];
        metadata?: string | Record<string, unknown>;
        entityType?: string;
        entityId?: string;
      };

      const orderId = body.orderId;
      // Frontend sends 'documentType', backend schema uses 'category' — accept both
      const category = body.documentType || body.category;
      const { tags, metadata, entityType, entityId } = body;

      // Require either orderId OR (entityType + entityId) — vendor/appraiser docs have no order
      if (!orderId && !(entityType && entityId)) {
        res.status(400).json({
          success: false,
          error: 'Either orderId or both entityType and entityId are required'
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

      const tenantId = DocumentController.APP_TENANT_ID;
      const userId = req.user?.id || 'unknown';

      const result = await this.documentService.uploadDocument(
        orderId,
        tenantId,
        req.file,
        userId,
        category,
        parsedTags,
        parsedMetadata,
        entityType,
        entityId
      );

      if (!result.success || !result.data) {
        res.status(500).json(result);
        return;
      }

      // Map to frontend shape: { success, document }
      res.status(201).json({
        success: true,
        document: toFrontendDocument(result.data)
      });
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
      const tenantId = DocumentController.APP_TENANT_ID;
      
      const query: DocumentListQuery = {};
      if (req.query.orderId) query.orderId = req.query.orderId as string;
      // Frontend sends 'documentType', backend schema uses 'category' — accept both
      if (req.query.documentType || req.query.category) query.category = (req.query.documentType || req.query.category) as string;
      if (req.query.entityType) query.entityType = req.query.entityType as string;
      if (req.query.entityId) query.entityId = req.query.entityId as string;
      if (req.query.limit) query.limit = parseInt(req.query.limit as string, 10);
      if (req.query.offset) query.offset = parseInt(req.query.offset as string, 10);

      const result = await this.documentService.listDocuments(tenantId, query);

      if (!result.success) {
        res.status(500).json(result);
        return;
      }

      const docs = result.data || [];
      const mapped = docs.map(toFrontendDocument);

      // Return frontend-expected shape: { success, documents, count, totalSize }
      res.json({
        success: true,
        documents: mapped,
        count: mapped.length,
        totalSize: docs.reduce((sum, d) => sum + (d.fileSize || 0), 0)
      });
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
      const tenantId = DocumentController.APP_TENANT_ID;

      const result = await this.documentService.getDocument(id, tenantId);

      if (!result.success || !result.data) {
        res.status(404).json(result);
        return;
      }

      res.json({
        success: true,
        document: toFrontendDocument(result.data)
      });
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
   * Stream blob content through the backend using Managed Identity.
   * No SAS URLs — the backend authenticates via DefaultAzureCredential.
   */
  private async downloadDocument(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const tenantId = DocumentController.APP_TENANT_ID;

      // Look up document metadata to get the blobName
      const result = await this.documentService.getDocument(id, tenantId);

      if (!result.success || !result.data) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const doc = result.data;

      // Stream the blob through the backend
      const { readableStream, contentType, contentLength } = await this.blobService.downloadBlob('documents', doc.blobName);

      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}"`);

      readableStream.pipe(res);
    } catch (error) {
      console.error('Error in downloadDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download document'
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
      const tenantId = DocumentController.APP_TENANT_ID;
      const updates: DocumentUpdateRequest = req.body;

      const result = await this.documentService.updateDocument(id, tenantId, updates);

      if (!result.success || !result.data) {
        res.status(404).json(result);
        return;
      }

      res.json({
        success: true,
        document: toFrontendDocument(result.data)
      });
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
      const tenantId = DocumentController.APP_TENANT_ID;

      const result = await this.documentService.deleteDocument(id, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      // Frontend expects { success, deletedDocumentId }
      res.json({
        success: true,
        deletedDocumentId: id
      });
    } catch (error) {
      console.error('Error in deleteDocument:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document'
      });
    }
  }
}
