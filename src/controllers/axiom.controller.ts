/**
 * Axiom AI Platform Controller
 * 
 * REST API endpoints for Axiom AI integration:
 * - Document notification (upload documents for analysis)
 * - Evaluation retrieval (get AI analysis results)
 * - Webhook handling (receive completion notifications)
 * - Document comparison (revision change detection)
 */

import { Request, Response, Router } from 'express';
import { AxiomService, AxiomDocumentNotification, AxiomWebhookPayload, DocumentType } from '../services/axiom.service';
import { CosmosDbService } from '../services/cosmos-db.service';
import { BulkPortfolioService } from '../services/bulk-portfolio.service';
import type { TapeExtractionWebhookPayload } from '../types/review-tape.types.js';

export class AxiomController {
  private axiomService: AxiomService;
  private dbService: CosmosDbService;
  private bulkPortfolioService: BulkPortfolioService;
  private static readonly APP_TENANT_ID = 'test-tenant-123';

  constructor(dbService: CosmosDbService, axiomService?: AxiomService) {
    this.dbService = dbService;
    this.axiomService = axiomService || new AxiomService(dbService);
    this.bulkPortfolioService = new BulkPortfolioService(dbService);
  }

  /**
   * Check if Axiom integration is enabled
   * GET /api/axiom/status
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const enabled = this.axiomService.isEnabled();

      res.json({
        success: true,
        data: {
          enabled,
          message: enabled 
            ? 'Axiom AI Platform integration is active'
            : 'Axiom AI Platform not configured - AI features disabled'
        }
      });
    } catch (error) {
      console.error('Error checking Axiom status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_STATUS_ERROR',
          message: 'Failed to check Axiom status',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Notify Axiom of a new document upload
   * POST /api/axiom/documents
   * 
   * Body: {
   *   orderId: string,
   *   documentType: 'appraisal' | 'revision' | 'rov' | 'supporting',
   *   documentUrl: string, // Azure Blob Storage SAS URL
   *   metadata?: { ... }
   * }
   */
  notifyDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const notification: AxiomDocumentNotification = req.body;

      // Validate required fields
      if (!notification.orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!notification.documentType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentType is required'
          }
        });
        return;
      }

      if (!notification.documentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentUrl is required (Azure Blob Storage SAS URL)'
          }
        });
        return;
      }

      // Notify Axiom
      const result = await this.axiomService.notifyDocumentUpload(notification);

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to notify Axiom',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: result.evaluationId,
          orderId: notification.orderId,
          message: 'Document notification sent to Axiom - evaluation in progress'
        }
      });
    } catch (error) {
      console.error('Error notifying Axiom of document:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process document notification',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Analyze a document via Axiom (frontend-friendly route)
   * POST /api/axiom/analyze
   * 
   * Accepts the frontend AxiomAnalyzeDocumentRequest shape, looks up the
   * document's blob URL from Cosmos, and delegates to notifyDocumentUpload().
   * 
   * Body: {
   *   documentId: string,
   *   orderId: string,
   *   documentType?: string
   * }
   */
  analyzeDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId, orderId, documentType } = req.body;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'documentId is required' }
        });
        return;
      }

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId is required' }
        });
        return;
      }

      // Look up the document from Cosmos to get its blob URL
      const queryResult = await this.dbService.queryItems<any>(
        'documents',
        'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
        [
          { name: '@id', value: documentId },
          { name: '@tenantId', value: AxiomController.APP_TENANT_ID }
        ]
      );

      const doc = queryResult.success && queryResult.data && queryResult.data.length > 0
        ? queryResult.data[0]
        : null;

      if (!doc) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Document ${documentId} not found`
          }
        });
        return;
      }

      const resolvedDocType = (documentType || 'appraisal') as DocumentType;

      const notification: AxiomDocumentNotification = {
        orderId,
        documentType: resolvedDocType,
        documentUrl: doc.blobUrl,
        metadata: {
          fileName: doc.name || doc.fileName,
          fileSize: doc.fileSize,
          uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : String(doc.uploadedAt),
          uploadedBy: typeof doc.uploadedBy === 'string' ? doc.uploadedBy : doc.uploadedBy?.name || 'unknown',
          documentId
        }
      };

      const result = await this.axiomService.notifyDocumentUpload(notification);

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to submit document for analysis'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: result.evaluationId,
          orderId,
          documentId,
          message: 'Document submitted for AI analysis'
        }
      });
    } catch (error) {
      console.error('Error analyzing document via Axiom:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit document for analysis',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Retrieve ALL evaluation results for an order
   * GET /api/axiom/evaluations/order/:orderId
   * 
   * Returns an array of all evaluations (pending, processing, completed, failed).
   * Frontend uses this to show Axiom status badges on each document.
   */
  getEvaluationByOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId parameter is required'
          }
        });
        return;
      }

      const evaluations = await this.axiomService.getEvaluationsForOrder(orderId);

      res.json({
        success: true,
        data: evaluations
      });
    } catch (error) {
      console.error('Error retrieving Axiom evaluations:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluations',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Retrieve evaluation results by evaluation ID
   * GET /api/axiom/evaluations/:evaluationId
   */
  getEvaluationById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { evaluationId } = req.params;

      if (!evaluationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'evaluationId parameter is required'
          }
        });
        return;
      }

      const evaluation = await this.axiomService.getEvaluationById(evaluationId);

      if (!evaluation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Evaluation ${evaluationId} not found`
          }
        });
        return;
      }

      res.json({
        success: true,
        data: evaluation
      });
    } catch (error) {
      console.error('Error retrieving Axiom evaluation by ID:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluation',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Webhook endpoint for Axiom completion notifications
   * POST /api/axiom/webhook
   * 
   * Body: {
   *   evaluationId: string,
   *   orderId: string,
   *   status: 'completed' | 'failed',
   *   timestamp: string,
   *   error?: { code, message }
   * }
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: AxiomWebhookPayload = req.body;

      // Validate required fields
      if (!payload.evaluationId || !payload.orderId || !payload.status) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'evaluationId, orderId, and status are required'
          }
        });
        return;
      }

      // Process webhook asynchronously
      this.axiomService.handleWebhook(payload)
        .catch(error => {
          console.error('Background webhook processing failed:', error);
        });

      // Respond immediately to webhook
      res.status(200).json({
        success: true,
        message: 'Webhook received and processing'
      });
    } catch (error) {
      console.error('Error handling Axiom webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Compare two document versions (for revision workflows)
   * POST /api/axiom/documents/compare
   * 
   * Body: {
   *   orderId: string,
   *   originalDocumentUrl: string,
   *   revisedDocumentUrl: string
   * }
   */
  compareDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, originalDocumentUrl, revisedDocumentUrl } = req.body;

      // Validate required fields
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!originalDocumentUrl || !revisedDocumentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'originalDocumentUrl and revisedDocumentUrl are required'
          }
        });
        return;
      }

      // Initiate document comparison
      const result = await this.axiomService.compareDocuments(
        orderId,
        originalDocumentUrl,
        revisedDocumentUrl
      );

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to compare documents',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: result.evaluationId,
          orderId,
          changes: result.changes,
          message: 'Document comparison initiated - results will be available shortly'
        }
      });
    } catch (error) {
      console.error('Error comparing documents via Axiom:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compare documents',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Receive Axiom TAPE_EXTRACTION webhook
   * POST /api/axiom/webhook/extraction
   *
   * Axiom calls this endpoint when a structured field extraction job finishes.
   * The payload contains extractedFields (Partial<RiskTapeItem>) which are
   * mapped to a RiskTapeItem, evaluated against the ReviewProgram, and stored
   * as a ReviewTapeResult on the originating BulkPortfolioJob.
   *
   * Always returns 200 immediately — processing is fire-and-log so Axiom
   * does not need to retry on our behalf.
   */
  handleExtractionWebhook = async (req: Request, res: Response): Promise<void> => {
    // Acknowledge immediately — Axiom should not wait on our processing
    res.status(200).json({ success: true, message: 'Extraction webhook received' });

    const payload = req.body as TapeExtractionWebhookPayload;

    if (!payload.evaluationId || !payload.jobId || !payload.loanNumber) {
      console.error('❌ Extraction webhook missing required fields', {
        hasEvaluationId: !!payload.evaluationId,
        hasJobId: !!payload.jobId,
        hasLoanNumber: !!payload.loanNumber,
      });
      return;
    }

    try {
      await this.bulkPortfolioService.processExtractionCompletion(payload);
    } catch (error) {
      console.error('❌ Failed to process extraction webhook', {
        evaluationId: payload.evaluationId,
        jobId: payload.jobId,
        loanNumber: payload.loanNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Create Axiom router with all endpoints
 */
export function createAxiomRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const controller = new AxiomController(dbService);

  // Status check
  router.get('/status', controller.getStatus);

  // Document notification (raw, used by backend-to-backend calls)
  router.post('/documents', controller.notifyDocument);

  // Document analysis (frontend-friendly, looks up blob URL by documentId)
  router.post('/analyze', controller.analyzeDocument);

  // Evaluation retrieval
  router.get('/evaluations/order/:orderId', controller.getEvaluationByOrder);
  router.get('/evaluations/:evaluationId', controller.getEvaluationById);

  // Webhook
  router.post('/webhook', controller.handleWebhook);

  // Extraction webhook (TAPE_EXTRACTION completion from Axiom)
  router.post('/webhook/extraction', controller.handleExtractionWebhook);

  // Document comparison
  router.post('/documents/compare', controller.compareDocuments);

  return router;
}
