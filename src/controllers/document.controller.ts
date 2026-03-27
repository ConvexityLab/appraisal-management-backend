import { Router, Response } from 'express';
import multer from 'multer';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BlobStorageService } from '../services/blob-storage.service';
import { DocumentService } from '../services/document.service';
import { AxiomService } from '../services/axiom.service';
import { AxiomExecutionService } from '../services/axiom-execution.service';
import { DocumentUploadRequest, DocumentUpdateRequest, DocumentListQuery, DocumentMetadata } from '../types/document.types';
import type { AppraisalOrder } from '../types/index.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

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
    metadata: doc.metadata ? { tags: doc.tags, ...doc.metadata as Record<string, unknown> } : (doc.tags ? { tags: doc.tags } : undefined)
  };
}

/**
 * Categories that trigger auto-submission to Axiom AI on upload.
 *   appraisal-report : full order-evaluation pipeline (form 1004, 1073, etc.)
 *   bpo-report       : document-extraction pipeline for non-Statebridge BPO orders
 *                      (Statebridge BPOs are handled by the Cosmos Change Feed function;
 *                       uploading a bpo-report on any other order goes here instead)
 */
const AXIOM_AUTO_SUBMIT_CATEGORIES = new Set(['appraisal-report', 'appraisal_report', 'bpo-report']);

/**
 * Build the Axiom fields array from an AppraisalOrder for use in submitOrderEvaluation.
 * Only includes fields with a non-empty / non-zero value.
 */
function buildOrderFields(
  order: AppraisalOrder,
): Array<{ fieldName: string; fieldType: string; value: unknown }> {
  const addr = order.propertyAddress;
  const prop = order.propertyDetails;
  const loan = order.loanInformation;
  const borrower = order.borrowerInformation;
  return [
    { fieldName: 'loanAmount',      fieldType: 'number', value: loan?.loanAmount ?? 0 },
    { fieldName: 'loanType',        fieldType: 'string', value: String(loan?.loanType ?? '') },
    { fieldName: 'propertyAddress', fieldType: 'string', value: addr?.streetAddress ?? '' },
    { fieldName: 'city',            fieldType: 'string', value: addr?.city ?? '' },
    { fieldName: 'state',           fieldType: 'string', value: addr?.state ?? '' },
    { fieldName: 'zipCode',         fieldType: 'string', value: addr?.zipCode ?? '' },
    { fieldName: 'propertyType',    fieldType: 'string', value: String(prop?.propertyType ?? '') },
    { fieldName: 'yearBuilt',       fieldType: 'number', value: prop?.yearBuilt ?? 0 },
    { fieldName: 'gla',             fieldType: 'number', value: prop?.grossLivingArea ?? 0 },
    { fieldName: 'bedrooms',        fieldType: 'number', value: prop?.bedrooms ?? 0 },
    { fieldName: 'bathrooms',       fieldType: 'number', value: prop?.bathrooms ?? 0 },
    { fieldName: 'borrowerName',    fieldType: 'string', value: `${borrower?.firstName ?? ''} ${borrower?.lastName ?? ''}`.trim() },
  ].filter(
    (f) =>
      (typeof f.value === 'string' && f.value !== '') ||
      (typeof f.value === 'number' && f.value !== 0),
  );
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
    this.axiomService = new AxiomService(dbService);
    this.axiomExecutionService = new AxiomExecutionService(dbService);
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * GET /stream/:executionId
     * Proxy SSE stream from Axiom for a document evaluation
     */
    this.router.get(
      '/stream/:executionId',
      this.streamDocumentExecution.bind(this)
    );

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
     * POST /:id/versions
     * Upload a new version of an existing document
     */
    this.router.post(
      '/:id/versions',
      this.upload.single('file'),
      this.uploadNewVersion.bind(this)
    );

    /**
     * GET /:id/versions
     * Get version history for a document
     */
    this.router.get(
      '/:id/versions',
      this.getVersionHistory.bind(this)
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

      // Auto-submit appraisal reports to Axiom AI for risk evaluation (fire-and-forget)
      if (savedDoc.orderId && AXIOM_AUTO_SUBMIT_CATEGORIES.has(category || '')) {
        const orderId = savedDoc.orderId;
        setImmediate(() => {
          this.dbService.findOrderById(orderId).then(async (orderResult) => {
            const order = orderResult.success ? orderResult.data : null;
            if (!order) {
              console.error(`[DocumentController] Cannot auto-submit to Axiom: order ${orderId} not found`);
              return null;
            }
            const clientId = (order as any).clientInformation?.clientId || order.clientId;
            if (!order.tenantId || !clientId) {
              console.error(`[DocumentController] Cannot auto-submit to Axiom: order ${orderId} missing tenantId or clientId`);
              return null;
            }
            // Statebridge BPO orders are processed exclusively by the Cosmos Change Feed function
            // (handleStatebridgeBpoDocument). Auto-submitting here would cause a double Axiom
            // pipeline submission — one for document-extraction (change feed) and one for the
            // full evaluation pipeline (here). Skip this path for Statebridge BPOs.
            if (category === 'bpo-report' && (order as any).source === 'statebridge-sftp') {
              console.log(`[DocumentController] Skipping auto-submit for Statebridge BPO order ${orderId} — handled by Change Feed`);
              return null;
            }
            // BLOB_CONTAINER is already validated at cold-start (throws if env var missing),
            // so reaching this point guarantees a non-empty value.
            const docContainerName = DocumentController.BLOB_CONTAINER;
            const sasUrl = await this.blobService.generateReadSasUrl(docContainerName, savedDoc.blobName);
            const fields = buildOrderFields(order);
            const documents = [
              { documentName: savedDoc.name, documentReference: sasUrl },
            ];
            return this.axiomService.submitOrderEvaluation(orderId, fields, documents, order.tenantId, clientId);
          }).then((axiomResult) => {
            if (axiomResult) {
              console.log(`[DocumentController] Auto-submitted doc ${savedDoc.id} to Axiom pipeline → evaluationId: ${axiomResult.evaluationId}`);
              
              // Create the robust pipeline execution record
              this.axiomExecutionService.createExecution({
                tenantId: savedDoc.tenantId,
                orderId: savedDoc.orderId,
                documentIds: [savedDoc.id],
                axiomJobId: axiomResult.pipelineJobId,
                pipelineMode: 'FULL_PIPELINE',
                initiatedBy: 'SYSTEM-AUTO'
              }).catch((err: Error) => {
                console.error('[DocumentController] Failed to create AxiomExecutionRecord', err.message);
              });

              // Stamp evaluationId and status on the order (best-effort)
              this.dbService.updateOrder(orderId, {
                axiomEvaluationId: axiomResult.evaluationId,
                axiomPipelineJobId: axiomResult.pipelineJobId,
                axiomStatus: 'submitted',
              }).catch((err: Error) => {
                console.error('[DocumentController] Failed to stamp axiomEvaluationId on order', err.message);
              });
            }
          }).catch((err: Error) => {
            console.error(`[DocumentController] Auto-submit to Axiom failed for doc ${savedDoc.id}:`, err.message);
          });
        });
      }

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
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const doc = result.data;

      // Stream the blob through the backend
      const { readableStream, contentType, contentLength } = await this.blobService.downloadBlob(DocumentController.BLOB_CONTAINER, doc.blobName);

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
