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
import { verifyAxiomWebhook } from '../middleware/verify-axiom-webhook.middleware.js';
import type { TapeExtractionWebhookPayload } from '../types/review-tape.types.js';
import type { AppraisalOrder } from '../types/index.js';

export class AxiomController {
  private axiomService: AxiomService;
  private dbService: CosmosDbService;
  private bulkPortfolioService: BulkPortfolioService;
  private static readonly APP_TENANT_ID = 'test-tenant-123';

  /**
   * Build structured Axiom pipeline fields from an order.
   * Only includes fields with a non-empty / non-zero value.
   */
  private static buildOrderFields(
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

      // Load order for structured pipeline fields (A-2)
      const orderResult = await this.dbService.findOrderById(notification.orderId);
      const order: AppraisalOrder | null = orderResult.success ? orderResult.data ?? null : null;
      const fields = order ? AxiomController.buildOrderFields(order) : [];
      const documents = [{
        documentName: (notification.metadata as any)?.fileName ?? notification.orderId,
        documentReference: notification.documentUrl,
      }];

      const pipelineResult = await this.axiomService.submitOrderEvaluation(
        notification.orderId,
        fields,
        documents,
      );

      if (!pipelineResult) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: 'Failed to submit document to Axiom pipeline',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: pipelineResult.evaluationId,
          pipelineJobId: pipelineResult.pipelineJobId,
          orderId: notification.orderId,
          message: 'Document submitted to Axiom pipeline - evaluation in progress'
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

      // Look up the order to build structured fields for the Axiom pipeline
      const orderResult = await this.dbService.findOrderById(orderId);
      const order: AppraisalOrder | null = orderResult.success ? orderResult.data ?? null : null;

      const fields = order ? AxiomController.buildOrderFields(order) : [];
      const documents = [{
        documentName: doc.name || doc.fileName || documentId,
        documentReference: doc.blobUrl,
      }];

      const pipelineResult = await this.axiomService.submitOrderEvaluation(
        orderId,
        fields,
        documents
      );

      if (!pipelineResult) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: 'Failed to submit document to Axiom pipeline'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: pipelineResult.evaluationId,
          pipelineJobId: pipelineResult.pipelineJobId,
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
   * Receive Axiom pipeline webhook for single-order evaluations.
   * POST /api/axiom/webhook
   *
   * Accepts either the new pipeline payload:
   *   { correlationId, correlationType, pipelineJobId, status, timestamp, result? }
   * or the legacy shape (mock/dev):
   *   { evaluationId, orderId, status, timestamp }
   *
   * Protected by HMAC signature verification via verifyAxiomWebhook middleware.
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    // Acknowledge immediately so Axiom doesn't retry
    res.status(200).json({ success: true, message: 'Webhook received' });

    const body = req.body as Record<string, unknown>;

    // ── New pipeline shape ────────────────────────────────────────────────
    if (body['correlationId'] && body['correlationType'] === 'ORDER') {
      const correlationId = body['correlationId'] as string;
      const pipelineJobId = body['pipelineJobId'] as string | undefined;
      const status = (body['status'] as string) ?? 'completed';
      const result = body['result'] as Record<string, unknown> | undefined;

      const updateData: Partial<AppraisalOrder> = {};
      // Narrow the status string so exactOptionalPropertyTypes is satisfied
      const axiomStatusValue = status as AppraisalOrder['axiomStatus'];
      if (axiomStatusValue !== undefined) updateData.axiomStatus = axiomStatusValue;
      if (pipelineJobId) updateData.axiomPipelineJobId = pipelineJobId;
      if (result) {
        if (typeof result['overallRiskScore'] === 'number') updateData.axiomRiskScore = result['overallRiskScore'];
        const dec = result['overallDecision'] as AppraisalOrder['axiomDecision'] | undefined;
        if (dec !== undefined) updateData.axiomDecision = dec;
        if (Array.isArray(result['flags'])) updateData.axiomFlags = result['flags'] as string[];
        updateData.axiomCompletedAt = new Date().toISOString();
      }

      this.dbService.updateOrder(correlationId, updateData)
        .then((r) => {
          if (!r.success) {
            console.error('❌ Axiom webhook: failed to stamp order', { orderId: correlationId, error: r.error });
          }
        })
        .catch((err: unknown) => {
          console.error('❌ Axiom webhook: updateOrder threw', { orderId: correlationId, error: (err as Error).message });
        });

      // For completed pipelines, fetch full criteria results and store them in aiInsights.
      // This is the authoritative path — it fires even when the SSE stream was not open
      // (e.g. server restarted between submit and completion).
      if (status === 'completed' && pipelineJobId) {
        this.axiomService.fetchAndStorePipelineResults(correlationId, pipelineJobId)
          .catch((err: unknown) => {
            console.error('❌ Axiom webhook: fetchAndStorePipelineResults failed', {
              orderId: correlationId,
              pipelineJobId,
              error: (err as Error).message,
            });
          });
      }

      return;
    }

    // ── Legacy shape (mock / dev tests) ──────────────────────────────────
    const legacyPayload = body as unknown as AxiomWebhookPayload;
    if (legacyPayload.evaluationId && legacyPayload.orderId) {
      this.axiomService.handleWebhook(legacyPayload).catch((error: unknown) => {
        console.error('❌ Background legacy webhook processing failed:', error);
      });
      return;
    }

    console.warn('⚠️  Axiom webhook received with unrecognised payload shape', { keys: Object.keys(body) });
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

  /**
   * Receive Axiom pipeline webhook for bulk tape jobs.
   * POST /api/axiom/webhook/bulk
   *
   * Payload: { correlationId, correlationType: 'BULK_JOB', pipelineJobId, status, timestamp, results[] }
   *
   * Protected by HMAC signature verification.
   */
  handleBulkWebhook = async (req: Request, res: Response): Promise<void> => {
    // Acknowledge immediately — Axiom must not wait on our processing
    res.status(200).json({ success: true, message: 'Bulk webhook received' });

    const body = req.body as Record<string, unknown>;
    const jobId = body['correlationId'] as string | undefined;
    const pipelineJobId = body['pipelineJobId'] as string | undefined;
    const status = (body['status'] as string) ?? 'completed';
    const rawResults = body['results'] as Array<Record<string, unknown>> | undefined;

    if (!jobId) {
      console.warn('⚠️  Bulk webhook missing correlationId', { keys: Object.keys(body) });
      return;
    }

    console.log(`📨 Axiom bulk webhook — jobId=${jobId} pipelineJobId=${pipelineJobId} status=${status} loans=${rawResults?.length ?? 0}`);

    if (!rawResults || rawResults.length === 0) {
      // No per-loan results: just broadcast the job-level status change
      this.axiomService.broadcastBatchJobUpdate(jobId).catch(() => undefined);
      return;
    }

    // Map raw Axiom payload rows → typed loanResults
    // exactOptionalPropertyTypes: omit optional fields entirely when value is not present
    type LoanResult = Parameters<typeof this.bulkPortfolioService.stampBatchEvaluationResults>[1][number];
    const loanResults: LoanResult[] = rawResults
      .filter((r) => typeof r['loanNumber'] === 'string')
      .map((r) => {
        const loanStatus: 'completed' | 'failed' = status === 'completed' ? 'completed' : 'failed';
        const entry: LoanResult = { loanNumber: r['loanNumber'] as string, status: loanStatus };
        if (typeof r['riskScore'] === 'number') entry.riskScore = r['riskScore'];
        const dec = r['decision'];
        if (dec === 'ACCEPT' || dec === 'CONDITIONAL' || dec === 'REJECT') entry.decision = dec;
        return entry;
      });

    try {
      const updatedJob = await this.bulkPortfolioService.stampBatchEvaluationResults(jobId, loanResults);
      const completedLoans = (updatedJob.items as Array<{ axiomStatus?: string }>)
        .filter((r) => r.axiomStatus === 'completed').length;
      const totalLoans = updatedJob.items?.length ?? loanResults.length;

      this.axiomService.broadcastBatchJobUpdate(jobId, completedLoans, totalLoans)
        .catch(() => undefined);
    } catch (err) {
      console.error('❌ Bulk webhook: stampBatchEvaluationResults failed', {
        jobId,
        pipelineJobId,
        error: (err as Error).message,
      });
      // Still broadcast so the frontend knows to refresh (it will see any partial stamps)
      this.axiomService.broadcastBatchJobUpdate(jobId).catch(() => undefined);
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

  // Webhooks — HMAC verification applied before handlers
  router.post('/webhook', verifyAxiomWebhook, controller.handleWebhook);
  router.post('/webhook/bulk', verifyAxiomWebhook, controller.handleBulkWebhook);
  router.post('/webhook/extraction', verifyAxiomWebhook, controller.handleExtractionWebhook);

  // Document comparison
  router.post('/documents/compare', controller.compareDocuments);

  return router;
}
