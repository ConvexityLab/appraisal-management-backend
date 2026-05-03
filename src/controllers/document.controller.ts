import { Router, Response } from 'express';
import multer from 'multer';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BlobStorageService } from '../services/blob-storage.service';
import { DocumentService } from '../services/document.service';
import { AxiomService } from '../services/axiom.service';
import { AxiomExecutionService } from '../services/axiom-execution.service';
import { DocumentUploadRequest, DocumentUpdateRequest, DocumentListQuery, DocumentMetadata } from '../types/document.types';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

/**
 * Maps a backend DocumentMetadata record to the shape the frontend expects.
 * Field renames: name→fileName, blobName→blobPath, category→documentType, uploadedBy string→object.
 * Adds default status ('pending') and version (1) when absent.
 */

/**
 * Normalise a category value stored in Cosmos into the kebab-case enum values
 * the frontend expects (e.g. 'APPRAISAL_REPORT' → 'appraisal-report').
 */
function normaliseCategoryToFrontend(raw: string | undefined): string {
  if (!raw) return 'other';
  return raw.toLowerCase().replace(/_/g, '-');
}

function toFrontendDocument(doc: DocumentMetadata): Record<string, unknown> {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    orderId: doc.orderId,
    entityType: doc.entityType,
    entityId: doc.entityId,
    documentType: normaliseCategoryToFrontend(doc.category),
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
    ...(doc.previousVersionId && { replacesDocumentId: doc.previousVersionId }),
    metadata: doc.metadata
      ? {
          tags: doc.tags,
          orderLinkedAt: doc.orderLinkedAt,
          orderLinkedBy: doc.orderLinkedBy,
          ...doc.metadata as Record<string, unknown>,
        }
      : (
        doc.tags || doc.orderLinkedAt || doc.orderLinkedBy
          ? {
              ...(doc.tags ? { tags: doc.tags } : {}),
              ...(doc.orderLinkedAt ? { orderLinkedAt: doc.orderLinkedAt } : {}),
              ...(doc.orderLinkedBy ? { orderLinkedBy: doc.orderLinkedBy } : {}),
            }
          : undefined
      )
  };
}


export class DocumentController {
  public router: Router;
  private documentService: DocumentService;
  private blobService: BlobStorageService;
  private axiomService: AxiomService;
  private axiomExecutionService: AxiomExecutionService;


  // Blob Storage container for document files (set via STORAGE_CONTAINER_DOCUMENTS env var)
  private static readonly BLOB_CONTAINER = (() => {
    const name = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!name) throw new Error('STORAGE_CONTAINER_DOCUMENTS env var is required');
    return name;
  })();

  // D-02: Per-MIME file size limits enforced BEFORE the payload is fully
  // buffered. The global `fileSize` is the hard ceiling (largest PDF we accept);
  // the fileFilter rejects over-budget uploads for smaller types (e.g. images)
  // with a clear 413-shaped error instead of silently trimming.
  private static readonly MAX_UPLOAD_BYTES: Record<string, number> = {
    'application/pdf': 100 * 1024 * 1024,          // 100MB
    'image/jpeg': 10 * 1024 * 1024,                //  10MB
    'image/png': 10 * 1024 * 1024,
    'image/heic': 10 * 1024 * 1024,
    'image/webp': 10 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024, // 25MB .docx
    'application/msword': 25 * 1024 * 1024,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 25 * 1024 * 1024,
    'application/vnd.ms-excel': 25 * 1024 * 1024,
    'text/csv': 25 * 1024 * 1024,
  };
  private static readonly DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
  private static readonly HARD_CEILING_BYTES = 100 * 1024 * 1024;

  private upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: DocumentController.HARD_CEILING_BYTES,
    },
    fileFilter: (req, file, cb) => {
      const max =
        DocumentController.MAX_UPLOAD_BYTES[file.mimetype] ??
        DocumentController.DEFAULT_MAX_BYTES;
      // `req.headers['content-length']` is a cheap early-reject signal.
      const declared = parseInt((req.headers['content-length'] as string) ?? '0', 10);
      if (declared && declared > max) {
        cb(new Error(`File too large: ${file.mimetype} limit is ${Math.round(max / 1024 / 1024)}MB`));
        return;
      }
      cb(null, true);
    },
  });

  constructor(private dbService: CosmosDbService, private authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    
    // Initialize services
    this.blobService = new BlobStorageService();
    this.documentService = new DocumentService(dbService, this.blobService);
    this.axiomService = new AxiomService(dbService);
    this.axiomExecutionService = new AxiomExecutionService(dbService);
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const authz = this.authzMiddleware;
    const lp     = authz ? [authz.loadUserProfile()] : [];
    const read   = authz ? [...lp, authz.authorize('document', 'read')]   : [];
    const create = authz ? [...lp, authz.authorize('document', 'create')] : [];
    const update = authz ? [...lp, authz.authorize('document', 'update')] : [];
    const del    = authz ? [...lp, authz.authorize('document', 'delete')] : [];

    /**
     * GET /stream/:executionId
     * Proxy SSE stream from Axiom for a document evaluation
     */
    this.router.get(
      '/stream/:executionId',
      ...read,
      this.streamDocumentExecution.bind(this)
    );

    /**
     * POST /upload
     * Upload a document file
     */
    this.router.post(
      '/upload',
      this.upload.single('file'),
      ...create,
      this.uploadDocument.bind(this)
    );

    /**
     * GET /
     * List documents with optional filtering
     */
    this.router.get(
      '/',
      ...read,
      this.listDocuments.bind(this)
    );

    /**
     * POST /:id/versions
     * Upload a new version of an existing document
     */
    this.router.post(
      '/:id/versions',
      this.upload.single('file'),
      ...update,
      this.uploadNewVersion.bind(this)
    );

    /**
     * GET /:id/versions
     * Get version history for a document
     */
    this.router.get(
      '/:id/versions',
      ...read,
      this.getVersionHistory.bind(this)
    );

    /**
     * GET /:id
     * Get a single document by ID
     */
    this.router.get(
      '/:id',
      ...read,
      this.getDocument.bind(this)
    );

    /**
     * GET /:id/download
     * Get document download URL
     */
    this.router.get(
      '/:id/download',
      ...read,
      this.downloadDocument.bind(this)
    );

    /**
     * PUT /:id
     * Update document metadata
     */
    this.router.put(
      '/:id',
      ...update,
      this.updateDocument.bind(this)
    );

    /**
     * DELETE /:id
     * Delete a document
     */
    this.router.delete(
      '/:id',
      ...del,
      this.deleteDocument.bind(this)
    );
  }

  /**
   * GET /stream/:executionId
   * Sets up an SSE connection proxying directly to Axiom's pipeline stream
   */
  private async streamDocumentExecution(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const executionId = req.params.executionId;
      if (!executionId) {
        res.status(400).json({ success: false, error: 'Missing executionId parameter' });
        return;
      }

      // 1. Fetch the execution record to get the actual Axiom jobId
      const execution = await this.axiomExecutionService.getExecutionById(executionId);
      
      // If we don't have an execution record yet, maybe it's the raw jobId directly?
      const jobId = (execution as any)?.axiomJobId || executionId;

      await this.axiomService.proxyPipelineStream(jobId, req, res);
    } catch (error) {
      console.error('[DocumentController] Error streaming document execution:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to establish stream' });
      } else {
        res.end();
      }
    }
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
      // Frontend sends 'documentType', backend schema uses 'category' — accept both.
      // Normalise to kebab-case so Cosmos always stores a consistent format.
      const rawCategory = body.documentType || body.category;
      const category = rawCategory ? rawCategory.toLowerCase().replace(/_/g, '-') : undefined;
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

      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      const userId = req.user!.id;

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

      const savedDoc = result.data;

      // Map to frontend shape: { success, document }
      res.status(201).json({
        success: true,
        document: toFrontendDocument(savedDoc)
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }

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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }

      // Look up document metadata to get the blobName
      const result = await this.documentService.getDocument(id, tenantId);

      if (!result.success || !result.data) {
        res.status(404).json({ success: false, error: `Document not found: ${id}` });
        return;
      }

      const doc = result.data;

      // Guard: blobName is required to locate the file in storage.
      // Seed data or manually-created records missing this field → 404, not 500.
      if (!doc.blobName) {
        res.status(404).json({
          success: false,
          error: `Document '${id}' has no blob path — the file has not been uploaded yet`
        });
        return;
      }

      // Stream the blob through the backend
      let readableStream: NodeJS.ReadableStream;
      let contentType: string;
      let contentLength: number;
      try {
        ({ readableStream, contentType, contentLength } = await this.blobService.downloadBlob(DocumentController.BLOB_CONTAINER, doc.blobName));
      } catch (blobError: any) {
        // BlobNotFound from Azure Storage / Azurite — return 404 not 500
        if (blobError?.statusCode === 404 || blobError?.code === 'BlobNotFound') {
          res.status(404).json({
            success: false,
            error: `Blob file not found for document '${id}' (path: ${doc.blobName})`
          });
          return;
        }
        throw blobError; // re-throw non-404 storage errors
      }

      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Use 'inline' so browsers/viewers can render the content directly.
      // Explicit downloads are handled by the frontend's downloadDocumentAuthenticated() utility.
      const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.name)}"`);

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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }

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

  /**
   * POST /:id/versions
   * Upload a new version of an existing document
   */
  private async uploadNewVersion(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      const existingDocumentId = req.params.id!;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || req.user?.azureAdObjectId || 'unknown';
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } });
        return;
      }

      const result = await this.documentService.uploadNewVersion(
        existingDocumentId,
        tenantId,
        req.file,
        userId
      );

      if (!result.success) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        res.status(statusCode).json(result);
        return;
      }

      const frontendDoc = toFrontendDocument(result.data!);
      // Add versioning fields the FE type expects
      frontendDoc.replacesDocumentId = existingDocumentId;

      res.status(201).json({
        success: true,
        document: frontendDoc
      });
    } catch (error) {
      console.error('Error in uploadNewVersion:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload new version'
      });
    }
  }

  /**
   * GET /:id/versions
   * Get version history for a document (all versions in the chain)
   */
  private async getVersionHistory(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const documentId = req.params.id!;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } });
        return;
      }

      const result = await this.documentService.getVersionHistory(documentId, tenantId);

      if (!result.success) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        res.status(statusCode).json(result);
        return;
      }

      const versions = (result.data || []).map(doc => {
        const fe = toFrontendDocument(doc);
        if (doc.previousVersionId) fe.replacesDocumentId = doc.previousVersionId;
        return fe;
      });

      res.json({
        success: true,
        versions,
        count: versions.length
      });
    } catch (error) {
      console.error('Error in getVersionHistory:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get version history'
      });
    }
  }
}
