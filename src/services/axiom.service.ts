/**
 * Axiom AI Platform Integration Service
 * 
 * Axiom is our centralized AI intelligence platform that powers:
 * - Document analysis (semantic chunking, parsing, knowledge graphs)
 * - Contextual information extraction (property details, comps, USPAP elements)
 * - Structured criteria evaluation with AI-powered reasoning
 * - Risk scoring and quality assessment
 * 
 * Integration Points:
 * - Phase 1.2: Property data enrichment and complexity scoring
 * - Phase 4.1: Real-time USPAP compliance scanning during report creation
 * - Phase 5.2: QC checklist auto-population (70%+ automation target)
 * - Phase 5A: Revision comparison and change detection
 * - Phase 6: ROV comp analysis and value impact assessment
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventSource } from 'eventsource';
import { CosmosDbService } from './cosmos-db.service';
import { WebPubSubService } from './web-pubsub.service';
import { EventPriority, EventCategory } from '../types/events.js';
import type { RiskTapeItem, TapeExtractionRequest } from '../types/review-tape.types.js';
import type { CompileResponse, CompiledProgramNode } from '../types/axiom.types.js';

// ============================================================================
// Type Definitions
// ============================================================================

export type DocumentType = 'appraisal' | 'revision' | 'rov' | 'supporting' | 'property-record';

export type EvaluationStatus = 'pass' | 'fail' | 'warning' | 'info';

export interface AxiomDocumentNotification {
  orderId: string;
  documentType: DocumentType;
  documentUrl: string; // Azure Blob Storage SAS URL
  metadata?: {
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    uploadedBy?: string;
    propertyAddress?: string;
    appraiserId?: string;
    [key: string]: any;
  };
}

export interface DocumentReference {
  /** Page number in the source document (1-indexed) */
  page: number;
  /** Section name, e.g. "Sales Comparison Approach" */
  section: string;
  /** Verbatim excerpt from the document supporting this evaluation (required — every reference must cite the source text) */
  quote: string;
  /** Confidence of the reference extraction (0.0–1.0) */
  confidence?: number;
  /** Bounding box coordinates for PDF viewer highlighting */
  coordinates?: { x: number; y: number; width: number; height: number };
  // Resolved by service layer after Cosmos read (not from Axiom):
  /** Internal document ID from the documents Cosmos container */
  documentId?: string;
  /** Human-readable file name, e.g. "Appraisal Report.pdf" */
  documentName?: string;
  /** Azure Blob Storage URL for the PDF viewer */
  blobUrl?: string;
}

export interface CriterionEvaluation {
  criterionId: string;
  /** Human-readable criterion label, e.g. "Comparable Selection" */
  criterionName: string;
  /** @deprecated use criterionName */
  description: string;
  evaluation: EvaluationStatus;
  /** Confidence 0.0–1.0 (multiply by 100 for percentage display) */
  confidence: number;
  reasoning: string;
  /** Suggested corrective action when evaluation is fail or warning */
  remediation?: string;
  supportingData?: any[];
  /** Evidence citations — every criterion evaluation must reference the document sections it used */
  documentReferences: DocumentReference[];
}

export interface AxiomEvaluationResult {
  orderId: string;
  evaluationId: string;
  documentType: DocumentType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  criteria: CriterionEvaluation[];
  overallRiskScore: number; // 0-100
  extractedData?: {
    propertyDetails?: any;
    comparables?: any[];
    adjustments?: any[];
    narrative?: any;
    uspapElements?: any;
    [key: string]: any;
  };
  processingTime?: number; // milliseconds
  timestamp: string; // ISO8601
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface AxiomWebhookPayload {
  evaluationId: string;
  orderId: string;
  status: 'completed' | 'failed';
  timestamp: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Cosmos record stored in aiInsights when a TAPE_EXTRACTION job is in flight.
 * Retrieved by BulkPortfolioService.checkExtractionProgress() in mock/dev mode,
 * or mapped directly from the webhook payload in production.
 */
export interface ExtractionRecord {
  id: string;                       // = evaluationId
  evaluationId: string;
  requestType: 'TAPE_EXTRACTION';
  jobId: string;
  loanNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
  extractedFields?: Partial<RiskTapeItem>;
  extractionConfidence?: number;
  error?: string;
}

/** Inline Loom stage definition — matches the Axiom POST /api/pipelines stages array schema. */
interface LoomStage {
  name: string;
  actor: string;
  mode: 'single' | 'scatter' | 'gather';
  /** Loom path expressions: string values are literals; use { path: "trigger.field" } for dynamic refs. */
  input?: Record<string, string | { path: string }>;
  timeout?: number;
}

/** Inline Loom pipeline definition — sent as the `pipeline` field in POST /api/pipelines. */
interface LoomPipelineDefinition {
  name: string;
  version: string;
  stages: LoomStage[];
}

// ============================================================================
// Axiom Service
// ============================================================================

export class AxiomService {
  private client: AxiosInstance;
  private dbService: CosmosDbService;
  private webPubSubService: WebPubSubService | null = null;
  private containerName = 'aiInsights';
  private enabled: boolean;
  private mockDelayMs: number;

  // ── Axiom Cosmos pipeline-template IDs (seeded via standard-templates.ts) ──
  // These are the human-readable string IDs registered in the `pipeline-templates`
  // Cosmos container. Pass directly as `pipelineId` in POST /api/pipelines.
  // Override via AXIOM_PIPELINE_ID_* env vars if you register custom templates.

  /** Full PDF→extraction→classification→schema-extract→criteria-eval pipeline. */
  private static readonly TEMPLATE_RISK_EVAL   = 'complete-document-criteria-evaluation';
  /** Adaptive PDF processing — auto-detects text vs image and routes accordingly. */
  private static readonly TEMPLATE_DOC_EXTRACT = 'adaptive-document-processing';

  // ── Inline Loom definition for BULK_EVAL ──────────────────────────────────
  // No registered template exists for bulk/batch jobs. Used as-is until the
  // Axiom team seeds a bulk pipeline template.

  private static readonly PIPELINE_BULK_EVAL: LoomPipelineDefinition = {
    name: 'bulk-risk-evaluation',
    version: '1.0.0',
    stages: [
      {
        name: 'load-criteria',
        actor: 'CriteriaLoader',
        mode: 'single',
        input: {
          programId: { path: 'trigger.programId' },
          tenantId:  { path: 'trigger.tenantId' },
          clientId:  { path: 'trigger.clientId' },
        },
      },
      {
        name: 'evaluate-loans',
        actor: 'CriterionEvaluator',
        mode: 'single',
        input: {
          criteria: { path: 'stages.load-criteria.criteria' },
          loans:    { path: 'trigger.loans' },
        },
      },
      {
        name: 'aggregate-results',
        actor: 'ResultsAggregator',
        mode: 'single',
        input: { results: { path: 'stages.evaluate-loans' } },
      },
    ],
  };

  /**
   * Returns the `pipelineId` (registered Cosmos template) or `pipeline`
   * (inline definition) param for POST /api/pipelines.
   *
   * RISK_EVAL and DOC_EXTRACT use known registered template IDs by default.
   * BULK_EVAL falls back to an inline definition — no registered template exists yet.
   * Set AXIOM_PIPELINE_ID_<TYPE> env var to override any default.
   */
  private buildPipelineParam(
    type: 'RISK_EVAL' | 'DOC_EXTRACT' | 'BULK_EVAL',
  ): { pipelineId: string } | { pipeline: LoomPipelineDefinition } {
    const envOverride = process.env[`AXIOM_PIPELINE_ID_${type}`];
    if (envOverride) return { pipelineId: envOverride };

    if (type === 'RISK_EVAL')   return { pipelineId: AxiomService.TEMPLATE_RISK_EVAL };
    if (type === 'DOC_EXTRACT') return { pipelineId: AxiomService.TEMPLATE_DOC_EXTRACT };
    // BULK_EVAL: no registered template — send inline definition
    return { pipeline: AxiomService.PIPELINE_BULK_EVAL };
  }

  constructor(dbService?: CosmosDbService) {
    const baseURL = process.env.AXIOM_API_BASE_URL;
    const apiKey  = process.env.AXIOM_API_KEY;

    // Live mode requires only a base URL — API key is optional (server may be open in dev).
    this.enabled = !!baseURL;
    this.mockDelayMs = parseInt(process.env.AXIOM_MOCK_DELAY_MS || '8000', 10);

    if (!this.enabled) {
      console.warn('⚠️  Axiom AI Platform not configured — AI features will use mock mode');
      console.warn(`   Mock delay: ${this.mockDelayMs}ms (set AXIOM_MOCK_DELAY_MS to change)`);
      console.warn('   Set AXIOM_API_BASE_URL to enable real Axiom (AXIOM_API_KEY is optional)');
    } else {
      console.log(`✅ Axiom live mode — ${baseURL}${apiKey ? ' (authenticated)' : ' (no auth — dev server)'}`);
    }

    // Build request headers; only attach Authorization when a key is actually set
    const axiomHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AppraisalManagementPlatform/1.0',
    };
    if (apiKey) {
      axiomHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // Initialize Axiom API client
    this.client = axios.create({
      baseURL: baseURL || 'https://axiom-api.placeholder.com',
      timeout: 30000, // 30 seconds
      headers: axiomHeaders,
    });

    // Initialize Cosmos DB service for storing results
    this.dbService = dbService || new CosmosDbService();

    // Initialize WebPubSub for real-time push (best-effort — if not configured, skip)
    try {
      this.webPubSubService = new WebPubSubService({ enableLocalEmulation: true });
    } catch {
      console.warn('⚠️  WebPubSub not available for Axiom push notifications — updates will be poll-only');
    }
  }

  /**
   * Check if Axiom integration is configured and enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Broadcast an axiom.batch.updated event via WebPubSub so the frontend
   * invalidates the BulkPortfolioJob cache tags and refreshes the grid.
   * Best-effort — logs a warning on failure but never throws.
   */
  async broadcastBatchJobUpdate(
    jobId: string,
    completedLoans?: number,
    totalLoans?: number,
  ): Promise<void> {
    if (!this.webPubSubService) return;
    try {
      await this.webPubSubService.broadcastNotification({
        id: `axiom-batch-${jobId}-${Date.now()}`,
        title: 'Axiom AI Batch Update',
        message: `Axiom batch evaluation completed for job ${jobId}`,
        priority: EventPriority.NORMAL,
        category: EventCategory.QC,
        targets: [],
        data: {
          eventType: 'axiom.batch.updated',
          jobId,
          ...(completedLoans !== undefined ? { completedLoans } : {}),
          ...(totalLoans !== undefined ? { totalLoans } : {}),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('⚠️  Failed to broadcast Axiom batch status via WebPubSub', {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Broadcast Axiom evaluation status update via WebPubSub.
   * Best-effort — logs a warning on failure but never throws.
   */
  private async broadcastAxiomStatus(
    orderId: string,
    evaluationId: string,
    status: string,
    riskScore?: number,
  ): Promise<void> {
    if (!this.webPubSubService) return;
    try {
      await this.webPubSubService.broadcastNotification({
        id: `axiom-${evaluationId}-${status}`,
        title: 'Axiom AI Analysis Update',
        message: `Axiom evaluation for order ${orderId} is now ${status}`,
        priority: EventPriority.NORMAL,
        category: EventCategory.QC,
        targets: [],
        data: {
          eventType: 'axiom.evaluation.updated',
          orderId,
          evaluationId,
          status,
          riskScore: riskScore ?? null,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('⚠️  Failed to broadcast Axiom status via WebPubSub', {
        evaluationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Notify Axiom of a new document for analysis
   * 
   * @param notification Document notification with Azure Blob SAS URL
   * @returns Evaluation ID for tracking
   */
  async notifyDocumentUpload(notification: AxiomDocumentNotification): Promise<{
    success: boolean;
    evaluationId?: string;
    error?: string;
  }> {
    if (!this.enabled) {
      const mockEvalId = `mock-eval-${notification.orderId}-${Date.now()}`;
      console.log(`🧪 [MOCK] Axiom mock mode — creating pending evaluation ${mockEvalId} for order ${notification.orderId}`);

      // Store a PENDING record in Cosmos — frontend will see "Processing"
      const pendingRecord: AxiomEvaluationResult = {
        orderId: notification.orderId,
        evaluationId: mockEvalId,
        documentType: notification.documentType,
        status: 'pending',
        criteria: [],
        overallRiskScore: 0,
        timestamp: new Date().toISOString()
      };
      const cosmosRecord = {
        id: mockEvalId,
        ...pendingRecord,
        _metadata: {
          documentId: notification.metadata?.documentId,
          documentName: notification.metadata?.fileName,
          blobUrl: notification.documentUrl,
          fileName: notification.metadata?.fileName,
          notificationSent: new Date().toISOString()
        }
      };
      await this.storeEvaluationRecord(cosmosRecord);

      // Transition to "processing" after 1 second
      setTimeout(async () => {
        try {
          const processingRecord = { ...cosmosRecord, status: 'processing' as const, timestamp: new Date().toISOString() };
          await this.storeEvaluationRecord(processingRecord);
          console.log(`🧪 [MOCK] Axiom evaluation ${mockEvalId} → processing`);
          await this.broadcastAxiomStatus(notification.orderId, mockEvalId, 'processing');
        } catch (err) {
          console.error(`🧪 [MOCK] Failed to transition ${mockEvalId} to processing`, err);
        }
      }, 1000);

      // Transition to "completed" with full mock results after configured delay
      setTimeout(async () => {
        try {
          const completedRecord = this.buildMockEvaluation(notification.orderId, mockEvalId);
          await this.storeEvaluationRecord({ id: mockEvalId, ...completedRecord, _metadata: cosmosRecord._metadata });
          console.log(`✅ [MOCK] Axiom evaluation ${mockEvalId} → completed (risk score: ${completedRecord.overallRiskScore})`);
          await this.broadcastAxiomStatus(notification.orderId, mockEvalId, 'completed', completedRecord.overallRiskScore);
        } catch (err) {
          console.error(`🧪 [MOCK] Failed to transition ${mockEvalId} to completed`, err);
        }
      }, this.mockDelayMs);

      return {
        success: true,
        evaluationId: mockEvalId
      };
    }

    try {
      const response = await this.client.post<{ evaluationId: string }>('/documents', {
        orderId: notification.orderId,
        documentType: notification.documentType,
        documentUrl: notification.documentUrl,
        metadata: notification.metadata || {},
        timestamp: new Date().toISOString()
      });

      const evaluationId = response.data.evaluationId;

      // Store initial pending record in Cosmos
      await this.storeEvaluationRecord({
        id: evaluationId,
        orderId: notification.orderId,
        evaluationId,
        documentType: notification.documentType,
        status: 'pending',
        criteria: [],
        overallRiskScore: 0,
        timestamp: new Date().toISOString(),
        _metadata: {
          documentId: notification.metadata?.documentId,
          documentName: notification.metadata?.fileName,
          blobUrl: notification.documentUrl,
          notificationSent: new Date().toISOString(),
          documentUrl: notification.documentUrl,
          fileName: notification.metadata?.fileName
        }
      });

      console.log(`✅ Axiom notified of document upload`, {
        orderId: notification.orderId,
        evaluationId,
        documentType: notification.documentType
      });

      return {
        success: true,
        evaluationId
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data || axiosError.message;
      
      console.error('❌ Failed to notify Axiom of document upload', {
        orderId: notification.orderId,
        error: errorMessage
      });

      return {
        success: false,
        error: `Axiom API error: ${errorMessage}`
      };
    }
  }

  /**
   * Retrieve evaluation results for an order
   * 
   * @param orderId Order ID to retrieve evaluation for
   * @returns Evaluation results or null if not found
   */
  async getEvaluation(orderId: string): Promise<AxiomEvaluationResult | null> {
    try {
      // First try to get from Cosmos DB cache
      const cachedResult = await this.getEvaluationFromCache(orderId);
      
      if (cachedResult && cachedResult.status === 'completed') {
        return cachedResult;
      }

      // If not in cache or still processing, fetch from Axiom API
      if (this.enabled) {
        const response = await this.client.get<AxiomEvaluationResult>(`/evaluations/${orderId}`);
        const evaluation = response.data;

        // Store/update in Cosmos DB
        if (evaluation.status === 'completed' || evaluation.status === 'failed') {
          await this.storeEvaluationRecord({
            id: evaluation.evaluationId,
            ...evaluation
          });
        }

        return evaluation;
      }

      // In mock mode, return cached record (which may be pending/processing/completed)
      // or null if no submission has been made for this order yet
      if (cachedResult) {
        return cachedResult;
      }
      console.log(`🧪 [MOCK] No Axiom evaluation found for order ${orderId} — document not yet submitted`);
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 404) {
        console.log(`ℹ️  No Axiom evaluation found for order ${orderId}`);
        return null;
      }

      console.error('❌ Failed to retrieve Axiom evaluation', {
        orderId,
        error: axiosError.message
      });

      // Fall back to cached result even if stale
      return await this.getEvaluationFromCache(orderId);
    }
  }

  /**
   * Inject documentId/documentName/blobUrl from Cosmos _metadata into every
   * DocumentReference in a completed evaluation.
   *
   * Axiom returns references without document-identity fields; those are known
   * only to our service layer (stored in _metadata at submission time). Stamping
   * them here means the frontend can navigate directly to the correct PDF page.
   */
  private enrichCriteriaRefs(
    criteria: CriterionEvaluation[],
    meta: Record<string, any>
  ): CriterionEvaluation[] {
    if (!meta || (!meta.documentId && !meta.blobUrl && !meta.documentUrl)) {
      return criteria;
    }
    return criteria.map(c => ({
      ...c,
      documentReferences: c.documentReferences.map(r => ({
        ...r,
        documentId: r.documentId ?? meta.documentId,
        documentName: r.documentName ?? meta.documentName ?? meta.fileName,
        blobUrl: r.blobUrl ?? meta.blobUrl ?? meta.documentUrl,
      })),
    }));
  }

  /**
   * Retrieve evaluation results by evaluation ID
   * 
   * @param evaluationId Evaluation ID
   * @returns Evaluation results or null if not found
   */
  async getEvaluationById(evaluationId: string): Promise<AxiomEvaluationResult | null> {
    try {
      // Try Cosmos DB first
      const cachedResponse = await this.dbService.getItem<AxiomEvaluationResult>(
        this.containerName,
        evaluationId
      );

      const cached = cachedResponse.success && cachedResponse.data ? cachedResponse.data : null;

      if (cached && cached.status === 'completed') {
        const meta = (cached as any)._metadata ?? {};
        cached.criteria = this.enrichCriteriaRefs(cached.criteria, meta);
        return cached;
      }

      // Fetch from Axiom API if enabled
      if (this.enabled) {
        const response = await this.client.get<AxiomEvaluationResult>(`/evaluations/by-id/${evaluationId}`);
        const evaluation = response.data;

        // Store/update in Cosmos DB
        if (evaluation.status === 'completed' || evaluation.status === 'failed') {
          await this.storeEvaluationRecord({
            id: evaluation.evaluationId,
            ...evaluation
          });
        }

        return evaluation;
      }

      // In mock mode, return cached record (which may be pending/processing/completed)
      // or null if no submission has been made yet
      if (cached) {
        const meta = (cached as any)._metadata ?? {};
        cached.criteria = this.enrichCriteriaRefs(cached.criteria, meta);
        return cached;
      }
      console.log(`🧪 [MOCK] No Axiom evaluation found for evaluationId ${evaluationId}`);
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 404) {
        return null;
      }

      console.error('❌ Failed to retrieve Axiom evaluation by ID', {
        evaluationId,
        error: axiosError.message
      });

      return null;
    }
  }

  /**
   * Handle webhook notification from Axiom when evaluation completes
   * 
   * @param payload Webhook payload from Axiom
   */
  async handleWebhook(payload: AxiomWebhookPayload): Promise<void> {
    console.log(`📨 Axiom webhook received`, {
      evaluationId: payload.evaluationId,
      orderId: payload.orderId,
      status: payload.status
    });

    try {
      // Fetch full evaluation results from Axiom
      const rawEvaluation = await this.getEvaluationById(payload.evaluationId);

      if (!rawEvaluation) {
        console.error('❌ Failed to retrieve evaluation after webhook notification', {
          evaluationId: payload.evaluationId
        });
        return;
      }

      // getEvaluationById enriches criteria from _metadata for cached records,
      // but the live API path does not carry _metadata.  Re-read the pending
      // record so we can enrich the references before persisting the completion.
      const pendingRecord = await this.dbService.getItem<any>(this.containerName, payload.evaluationId);
      const meta = pendingRecord?.data?._metadata ?? {};
      const evaluation: AxiomEvaluationResult = {
        ...rawEvaluation,
        criteria: this.enrichCriteriaRefs(rawEvaluation.criteria, meta),
      };

      // Update evaluation record with completion status
      await this.storeEvaluationRecord({
        id: evaluation.evaluationId,
        ...evaluation,
        _metadata: {
          webhookReceived: new Date().toISOString(),
          webhookStatus: payload.status
        }
      });

      console.log(`✅ Axiom evaluation completed and stored`, {
        evaluationId: payload.evaluationId,
        orderId: payload.orderId,
        riskScore: evaluation.overallRiskScore,
        criteriaCount: evaluation.criteria.length
      });

      // Push real-time status update via WebPubSub
      await this.broadcastAxiomStatus(
        payload.orderId,
        payload.evaluationId,
        payload.status,
        evaluation.overallRiskScore,
      );

      // TODO: Trigger follow-up actions based on risk score
      // - Auto-route high-risk orders (>70) to senior QC analysts
      // - Auto-approve low-risk orders (<30) with minimal review
      // - Update QC checklist with pre-filled criteria

    } catch (error) {
      console.error('❌ Failed to handle Axiom webhook', {
        evaluationId: payload.evaluationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Compare two document versions and identify changes
   * Used for revision workflows
   * 
   * @param orderId Order ID
   * @param originalDocumentUrl Original appraisal document URL
   * @param revisedDocumentUrl Revised appraisal document URL
   * @returns Change detection results
   */
  async compareDocuments(
    orderId: string,
    originalDocumentUrl: string,
    revisedDocumentUrl: string
  ): Promise<{
    success: boolean;
    evaluationId?: string;
    changes?: {
      section: string;
      changeType: 'added' | 'removed' | 'modified';
      original?: string;
      revised?: string;
      significance: 'minor' | 'moderate' | 'major';
    }[];
    error?: string;
  }> {
    if (!this.enabled) {
      console.log(`🧪 [MOCK] Axiom not configured — returning mock comparison for order ${orderId}`);
      return this.buildMockComparison(orderId);
    }

    try {
      const response = await this.client.post<{
        evaluationId: string;
        changes: any[];
      }>('/documents/compare', {
        orderId,
        originalDocumentUrl,
        revisedDocumentUrl,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Axiom document comparison initiated`, {
        orderId,
        evaluationId: response.data.evaluationId
      });

      return {
        success: true,
        evaluationId: response.data.evaluationId,
        changes: response.data.changes
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data || axiosError.message;
      
      console.error('❌ Failed to compare documents via Axiom', {
        orderId,
        error: errorMessage
      });

      return {
        success: false,
        error: `Axiom API error: ${errorMessage}`
      };
    }
  }

  // ============================================================================
  // Document Extraction (Sprint 4 — DOCUMENT_EXTRACTION mode)
  // ============================================================================

  /**
   * Submit an appraisal PDF to Axiom for structured 73-field extraction.
   *
   * Axiom resolves the DocumentSchema from request.programId and the hardcoded
   * requestType 'TAPE_EXTRACTION'.
   *
   * Mock mode: follows the same pending → processing → completed lifecycle as
   * notifyDocumentUpload().  The mock result is persisted to Cosmos (aiInsights)
   * so BulkPortfolioService.checkExtractionProgress() can poll it in dev.
   */
  async submitForExtraction(request: TapeExtractionRequest): Promise<{
    success: boolean;
    evaluationId?: string;
    error?: string;
  }> {
    if (!this.enabled) {
      const mockEvalId = `mock-extract-${request.loanNumber}-${Date.now()}`;
      console.log(
        `🧪 [MOCK] Axiom extraction mock — creating pending record ${mockEvalId} for loan ${request.loanNumber}`,
      );

      const pendingRecord: ExtractionRecord = {
        id: mockEvalId,
        evaluationId: mockEvalId,
        requestType: 'TAPE_EXTRACTION',
        jobId: request.jobId,
        loanNumber: request.loanNumber,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
      await this.storeEvaluationRecord(pendingRecord);

      // → processing after 1 second
      setTimeout(async () => {
        try {
          await this.storeEvaluationRecord({
            ...pendingRecord,
            status: 'processing',
            timestamp: new Date().toISOString(),
          });
          console.log(`🧪 [MOCK] Extraction ${mockEvalId} → processing`);
        } catch (err) {
          console.error(`🧪 [MOCK] Failed to transition ${mockEvalId} to processing`, err);
        }
      }, 1000);

      // → completed with mock extracted fields after configured delay
      setTimeout(async () => {
        try {
          const completedRecord: ExtractionRecord = {
            ...pendingRecord,
            status: 'completed',
            timestamp: new Date().toISOString(),
            extractedFields: this.buildMockExtractedFields(request.loanNumber),
            extractionConfidence: 0.87,
          };
          await this.storeEvaluationRecord(completedRecord);
          console.log(`✅ [MOCK] Extraction ${mockEvalId} → completed`);
        } catch (err) {
          console.error(`🧪 [MOCK] Failed to transition ${mockEvalId} to completed`, err);
        }
      }, this.mockDelayMs);

      return { success: true, evaluationId: mockEvalId };
    }

    // ── Production path ────────────────────────────────────────────────────
    // Axiom POST /documents/extract — finalized contract v1.0
    try {
      const response = await this.client.post<{ evaluationId: string }>(
        '/documents/extract',
        {
          requestType: 'TAPE_EXTRACTION',
          jobId: request.jobId,
          loanNumber: request.loanNumber,
          document: {
            url: request.documentUrl,
            mimeType: 'application/pdf',
          },
          schema: {
            programId: request.programId,
            fieldSet: 'RISK_TAPE_73',
          },
          delivery: {
            webhookUrl: request.webhookUrl,
            includeFieldConfidence: true,
          },
          submittedAt: new Date().toISOString(),
        },
      );

      const evaluationId = response.data.evaluationId;

      // Cache a pending record so polling works even before the webhook fires
      const pendingRecord: ExtractionRecord = {
        id: evaluationId,
        evaluationId,
        requestType: 'TAPE_EXTRACTION',
        jobId: request.jobId,
        loanNumber: request.loanNumber,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
      await this.storeEvaluationRecord(pendingRecord);

      console.log(`✅ Axiom extraction submitted`, {
        jobId: request.jobId,
        loanNumber: request.loanNumber,
        evaluationId,
      });

      return { success: true, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as any)?.message ?? axiosError.message;
      console.error('❌ Failed to submit document for extraction via Axiom', {
        jobId: request.jobId,
        loanNumber: request.loanNumber,
        error: errorMessage,
      });
      return { success: false, error: `Axiom API error: ${errorMessage}` };
    }
  }

  /**
   * Retrieve a tape extraction record from the aiInsights Cosmos cache.
   * Returns null if the evaluationId does not exist or has not been stored yet.
   */
  async getExtractionRecord(evaluationId: string): Promise<ExtractionRecord | null> {
    try {
      const response = await this.dbService.queryItems<ExtractionRecord>(
        this.containerName,
        'SELECT * FROM c WHERE c.id = @id AND c.requestType = @rt',
        [
          { name: '@id', value: evaluationId },
          { name: '@rt', value: 'TAPE_EXTRACTION' },
        ],
      );
      if (response.success && response.data && response.data.length > 0) {
        return response.data[0] ?? null;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to retrieve extraction record from Cosmos', {
        evaluationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ============================================================================
  // Pipeline-based Evaluation (POST /api/pipelines — Axiom real API)
  // ============================================================================

  /**
   * Submit a single order to the Axiom Loom pipeline for AI risk evaluation.
   *
   * Axiom returns a `jobId` (202 response); we open an SSE stream on `/observe`
   * to track progress via named events (pipeline_completed, pipeline_failed, etc.)
   * and also expect a webhook POST to /api/axiom/webhook when complete.
   *
   * Returns { pipelineJobId, evaluationId } on success, null on failure.
   */
  async submitOrderEvaluation(
    orderId: string,
    fields: Array<{ fieldName: string; fieldType: string; value: unknown }>,
    documents?: Array<{ documentName: string; documentReference: string }>,
    programId?: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string } | null> {
    if (!this.enabled) {
      return this.mockPipelineSubmit(orderId, 'ORDER', orderId, programId);
    }

    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error('API_BASE_URL is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const webhookSecret = process.env['AXIOM_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      throw new Error('AXIOM_WEBHOOK_SECRET is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const tenantId = process.env['AXIOM_TENANT_ID'];
    if (!tenantId) {
      throw new Error('AXIOM_TENANT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const clientId = process.env['AXIOM_CLIENT_ID'];
    if (!clientId) {
      throw new Error('AXIOM_CLIENT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }

    try {
      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        ...this.buildPipelineParam('RISK_EVAL'),
        input: {
          tenantId,
          clientId,
          correlationId: orderId,
          correlationType: 'ORDER',
          webhookUrl: `${apiBaseUrl}/api/axiom/webhook`,
          webhookSecret,
          fields,
          documents: documents ?? [],
          schemaMode: 'RISK_EVALUATION',
          ...(programId ? { programId } : {}),
        },
      });

      const pipelineJobId = response.data.jobId;
      const evaluationId = `eval-${orderId}-${pipelineJobId}`;

      await this.storeEvaluationRecord({
        id: evaluationId,
        orderId,
        evaluationId,
        pipelineJobId,
        correlationType: 'ORDER',
        documentType: 'appraisal' as DocumentType,
        status: 'pending',
        criteria: [],
        overallRiskScore: 0,
        timestamp: new Date().toISOString(),
      });

      this.watchPipelineStream(pipelineJobId, orderId, 'ORDER').catch((err) => {
        console.error('⚠️  Axiom SSE stream error for order', { orderId, pipelineJobId, error: (err as Error).message });
      });

      return { pipelineJobId, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
      console.error('❌ Failed to submit order evaluation to Axiom pipeline', { orderId, error: errorMessage });
      return null;
    }
  }

  /**
   * Submit a bulk tape job (multiple loans) to the Axiom Loom pipeline.
   *
   * Each loan provides its own fields and optional documents. Axiom evaluates
   * them in parallel and posts a single webhook back when all are complete.
   */
  async submitBatchEvaluation(
    jobId: string,
    loans: Array<{
      loanNumber: string;
      fields: Array<{ fieldName: string; fieldType: string; value: unknown }>;
      documents?: Array<{ documentName: string; documentReference: string }>;
    }>,
    programId?: string,
  ): Promise<{ pipelineJobId: string; batchId: string } | null> {
    if (!this.enabled) {
      const mock = await this.mockPipelineSubmit(jobId, 'BULK_JOB', jobId, programId);
      if (!mock) return null;
      return { pipelineJobId: mock.pipelineJobId, batchId: mock.evaluationId };
    }

    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error('API_BASE_URL is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const webhookSecret = process.env['AXIOM_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      throw new Error('AXIOM_WEBHOOK_SECRET is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const tenantId = process.env['AXIOM_TENANT_ID'];
    if (!tenantId) {
      throw new Error('AXIOM_TENANT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const clientId = process.env['AXIOM_CLIENT_ID'];
    if (!clientId) {
      throw new Error('AXIOM_CLIENT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }

    try {
      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        ...this.buildPipelineParam('BULK_EVAL'),
        input: {
          tenantId,
          clientId,
          correlationId: jobId,
          correlationType: 'BULK_JOB',
          webhookUrl: `${apiBaseUrl}/api/axiom/webhook/bulk`,
          webhookSecret,
          loans,
          schemaMode: 'RISK_EVALUATION',
          ...(programId ? { programId } : {}),
        },
      });

      const pipelineJobId = response.data.jobId;
      const batchId = `batch-${jobId}-${pipelineJobId}`;

      await this.storeEvaluationRecord({
        id: batchId,
        jobId,
        batchId,
        pipelineJobId,
        correlationType: 'BULK_JOB',
        status: 'pending',
        timestamp: new Date().toISOString(),
      });

      this.watchPipelineStream(pipelineJobId, jobId, 'BULK_JOB').catch((err) => {
        console.error('⚠️  Axiom SSE stream error for bulk job', { jobId, pipelineJobId, error: (err as Error).message });
      });

      return { pipelineJobId, batchId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
      console.error('❌ Failed to submit batch evaluation to Axiom pipeline', { jobId, error: errorMessage });
      return null;
    }
  }

  /**
   * Submit a document for structured field extraction via the Axiom pipeline.
   *
   * This replaces the old `submitForExtraction` path which used the legacy
   * `/documents/extract` endpoint (no longer supported).  Results are delivered
   * via SSE and a webhook POST to /api/axiom/webhook.
   */
  async submitDocumentExtractionPipeline(
    jobId: string,
    loanNumber: string,
    documents: Array<{ documentName: string; documentReference: string }>,
    programId?: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string } | null> {
    if (!this.enabled) {
      return this.mockPipelineSubmit(`${jobId}-${loanNumber}`, 'ORDER', jobId, programId);
    }

    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error('API_BASE_URL is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const webhookSecret = process.env['AXIOM_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      throw new Error('AXIOM_WEBHOOK_SECRET is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const tenantId = process.env['AXIOM_TENANT_ID'];
    if (!tenantId) {
      throw new Error('AXIOM_TENANT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const clientId = process.env['AXIOM_CLIENT_ID'];
    if (!clientId) {
      throw new Error('AXIOM_CLIENT_ID is required for Axiom pipeline submissions — configure it in environment settings');
    }

    try {
      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        ...this.buildPipelineParam('DOC_EXTRACT'),
        input: {
          tenantId,
          clientId,
          correlationId: `${jobId}:${loanNumber}`,
          correlationType: 'ORDER',
          webhookUrl: `${apiBaseUrl}/api/axiom/webhook`,
          webhookSecret,
          documents,
          schemaMode: 'DOCUMENT_EXTRACTION',
          ...(programId ? { programId } : {}),
        },
      });

      const pipelineJobId = response.data.jobId;
      const evaluationId = `extract-${jobId}-${loanNumber}-${pipelineJobId}`;

      const pendingRecord: ExtractionRecord = {
        id: evaluationId,
        evaluationId,
        requestType: 'TAPE_EXTRACTION',
        jobId,
        loanNumber,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
      await this.storeEvaluationRecord({ ...pendingRecord, pipelineJobId });

      this.watchPipelineStream(pipelineJobId, `${jobId}:${loanNumber}`, 'ORDER').catch((err) => {
        console.error('⚠️  Axiom SSE stream error for extraction', { jobId, loanNumber, error: (err as Error).message });
      });

      return { pipelineJobId, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
      console.error('❌ Failed to submit document extraction to Axiom pipeline', { jobId, loanNumber, error: errorMessage });
      return null;
    }
  }

  /**
   * Fetch final results from a completed Axiom pipeline job.
   *
   * Called internally after SSE signals completion (or by the webhook handler
   * to hydrate the full result set).
   */
  async fetchPipelineResults(pipelineJobId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get<Record<string, unknown>>(`/api/pipelines/${pipelineJobId}/results`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('❌ Failed to fetch Axiom pipeline results', {
        pipelineJobId,
        status: axiosError.response?.status,
        error: axiosError.message,
      });
      return null;
    }
  }

  /**
   * Map the raw Axiom /api/pipelines/:id/results payload into our AxiomEvaluationResult shape.
   *
   * Axiom wraps stage outputs under `results`; we fall through to the root object if absent.
   * All field reads are defensive — a missing field never throws, it gets a safe default.
   */
  private mapPipelineResultsToEvaluation(
    raw: Record<string, unknown>,
    orderId: string,
    evaluationId: string,
    pipelineJobId: string,
  ): Omit<AxiomEvaluationResult, 'documentType'> & { pipelineJobId: string } {
    // Axiom may nest the domain output under a `results` key
    const inner = (raw['results'] as Record<string, unknown> | undefined) ?? raw;
    const rawCriteria: unknown[] = Array.isArray(inner['criteria'])
      ? inner['criteria']
      : Array.isArray(raw['criteria'])
      ? raw['criteria'] as unknown[]
      : [];

    const criteria: CriterionEvaluation[] = (rawCriteria as any[]).map(
      (c: any): CriterionEvaluation => ({
        criterionId: c.criterionId ?? c.id ?? '',
        criterionName: c.criterionName ?? c.name ?? c.title ?? c.criterionId ?? '',
        description: c.description ?? '',
        evaluation: (c.evaluation ?? c.status ?? 'warning') as EvaluationStatus,
        confidence: typeof c.confidence === 'number' ? c.confidence : 0,
        reasoning: c.reasoning ?? '',
        remediation: c.remediation,
        supportingData: c.supportingData ?? c.dataUsed,
        documentReferences: Array.isArray(c.documentReferences)
          ? (c.documentReferences as any[]).map(
              (r: any): DocumentReference => ({
                page: r.page ?? 0,
                section: r.section ?? '',
                quote: r.quote ?? r.text ?? '',
                confidence: r.confidence,
                coordinates: r.coordinates,
                documentId: r.documentId,
                documentName: r.documentName,
                blobUrl: r.blobUrl,
              }),
            )
          : [],
      }),
    );

    const overallRiskScore =
      typeof inner['overallRiskScore'] === 'number' ? inner['overallRiskScore'] :
      typeof inner['riskScore'] === 'number' ? inner['riskScore'] :
      typeof raw['overallRiskScore'] === 'number' ? raw['overallRiskScore'] as number : 0;

    const execMeta = raw['executionMetadata'] as Record<string, unknown> | undefined;
    const processingTime = typeof execMeta?.['duration'] === 'number'
      ? (execMeta['duration'] as number)
      : undefined;
    const extractedData = (inner['extractedData'] as AxiomEvaluationResult['extractedData']) ?? undefined;

    return {
      orderId,
      evaluationId,
      pipelineJobId,
      status: 'completed' as const,
      criteria,
      overallRiskScore,
      timestamp: new Date().toISOString(),
      // Conditionally include optional fields so exactOptionalPropertyTypes is satisfied
      ...(processingTime !== undefined ? { processingTime } : {}),
      ...(extractedData !== undefined ? { extractedData } : {}),
    };
  }

  /**
   * Fetch the full results for a completed pipeline from Axiom, map them to
   * AxiomEvaluationResult format, enrich document-reference metadata from the
   * pending Cosmos record, persist to aiInsights, and broadcast via WebPubSub.
   *
   * Called both from the SSE stream completion handler and from the webhook
   * controller so results always land in Cosmos regardless of which path fires
   * first (SSE stream is best-effort; webhook is authoritative).
   */
  async fetchAndStorePipelineResults(
    orderId: string,
    pipelineJobId: string,
    evaluationId?: string,
    fallbackRiskScore?: number,
  ): Promise<void> {
    const evalId = evaluationId ?? `eval-${orderId}-${pipelineJobId}`;

    // Read the pending record we stored at submit time — we need its _metadata
    // (documentId, documentName, blobUrl) to enrich document references.
    const pendingResponse = await this.dbService.getItem<any>(this.containerName, evalId);
    const meta: Record<string, any> = pendingResponse?.data?._metadata ?? {};

    const rawResults = await this.fetchPipelineResults(pipelineJobId);

    if (rawResults) {
      const mapped = this.mapPipelineResultsToEvaluation(rawResults, orderId, evalId, pipelineJobId);
      const enriched = {
        id: evalId,
        ...mapped,
        documentType: (pendingResponse?.data?.documentType ?? 'appraisal') as DocumentType,
        criteria: this.enrichCriteriaRefs(mapped.criteria, meta),
        _metadata: { ...meta, completedAt: new Date().toISOString() },
      };
      await this.storeEvaluationRecord(enriched);
      console.log(`✅ Axiom pipeline results stored`, {
        orderId, pipelineJobId, evalId, criteriaCount: mapped.criteria.length, riskScore: mapped.overallRiskScore,
      });
      await this.broadcastAxiomStatus(orderId, evalId, 'completed', mapped.overallRiskScore);
    } else {
      // Axiom results not available yet (409 still running, or transient error).
      // Still broadcast so frontend knows to refetch via polling.
      console.warn('⚠️  fetchAndStorePipelineResults: no results returned from Axiom', { orderId, pipelineJobId, evalId });
      await this.broadcastAxiomStatus(orderId, evalId, 'completed', fallbackRiskScore);
    }
  }

  /**
   * Open a server-to-server SSE stream to the Axiom pipeline and relay each
   * progress event to the frontend via WebPubSub.
   *
   * The stream is resumable: if we reconnect, we pass the last received event
   * id as `?from=<cursor>` so Axiom replays missed events.
   *
   * This method runs until the stream closes (completed / failed) or until
   * a 30-minute timeout guard fires.
   */
  private async watchPipelineStream(
    pipelineJobId: string,
    correlationId: string,
    correlationType: 'ORDER' | 'BULK_JOB',
  ): Promise<void> {
    const baseURL = process.env['AXIOM_API_BASE_URL'];
    if (!baseURL) return; // should never reach here in production, but guard anyway

    const apiKey = process.env['AXIOM_API_KEY'];
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes hard limit

    return new Promise<void>((resolve, reject) => {
      let lastEventId: string | undefined;
      let settled = false;

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        if (err) reject(err);
        else resolve();
      };

      const openStream = () => {
        const url = lastEventId
          ? `${baseURL}/api/pipelines/${pipelineJobId}/observe?from=${encodeURIComponent(lastEventId)}`
          : `${baseURL}/api/pipelines/${pipelineJobId}/observe`;

        // eventsource v4 passes auth via a custom fetch wrapper
        const fetchWithAuth: typeof globalThis.fetch = (input, init) => {
          const headers = new Headers((init?.headers as HeadersInit | undefined) ?? {});
          if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
          return fetch(input, { ...init, headers });
        };

        const es = new EventSource(url, { fetch: fetchWithAuth });

        // Helper: track SSE cursor and parse event data safely
        const extractPayload = (event: MessageEvent): Record<string, unknown> => {
          if (event.lastEventId) lastEventId = event.lastEventId;
          try { return JSON.parse(event.data as string) as Record<string, unknown>; } catch { return {}; }
        };

        // Terminal: pipeline completed — fetch full results and store them in aiInsights
        es.addEventListener('pipeline_completed', (event) => {
          const payload = extractPayload(event);
          const riskScore = payload['riskScore'] as number | undefined;
          const evaluationId = `eval-${correlationId}-${pipelineJobId}`;
          // Fire-and-forget: settle the stream immediately; result storage runs concurrently
          this.fetchAndStorePipelineResults(correlationId, pipelineJobId, evaluationId, riskScore)
            .catch((err) => {
              console.error('⚠️  SSE pipeline_completed: failed to store Axiom results', {
                pipelineJobId, correlationId, error: (err as Error).message,
              });
              // Best-effort broadcast even if result fetch failed
              this.broadcastAxiomStatus(correlationId, evaluationId, 'completed', riskScore).catch(() => {/* logged inside */});
            });
          es.close();
          settle();
        });

        // Terminal: pipeline failed — mark stored record as failed, broadcast to frontend
        es.addEventListener('pipeline_failed', (event) => {
          const payload = extractPayload(event);
          const errorMsg = (payload['error'] as string | undefined) ?? 'Pipeline execution failed';
          const evaluationId = `eval-${correlationId}-${pipelineJobId}`;
          this.dbService.getItem<any>(this.containerName, evaluationId)
            .then((r) => {
              const existing = (r.success && r.data) ? r.data : {};
              return this.storeEvaluationRecord({
                ...existing,
                id: evaluationId,
                status: 'failed',
                error: { code: 'PIPELINE_FAILED', message: errorMsg },
                timestamp: new Date().toISOString(),
              });
            })
            .catch((err) => {
              console.error('⚠️  SSE pipeline_failed: could not mark record as failed', {
                evaluationId, error: (err as Error).message,
              });
            });
          this.broadcastAxiomStatus(correlationId, evaluationId, 'failed').catch(() => {/* logged inside */});
          es.close();
          settle();
        });

        // Progress: stage lifecycle — relay 'running' status to frontend
        es.addEventListener('stage_started', (event) => {
          extractPayload(event);
          this.broadcastAxiomStatus(correlationId, pipelineJobId, 'running').catch(() => {/* logged inside */});
        });

        es.addEventListener('stage_completed', (event) => {
          extractPayload(event);
          this.broadcastAxiomStatus(correlationId, pipelineJobId, 'running').catch(() => {/* logged inside */});
        });

        // Snapshot: full pipeline state at connection time — relay if not already terminal
        es.addEventListener('snapshot', (event) => {
          const payload = extractPayload(event);
          const snapshotStatus = (payload['status'] as string | undefined) ?? 'running';
          if (snapshotStatus !== 'completed' && snapshotStatus !== 'failed') {
            this.broadcastAxiomStatus(correlationId, pipelineJobId, snapshotStatus).catch(() => {/* logged inside */});
          }
        });

        es.addEventListener('error', (event) => {
          const code = (event as { code?: number }).code;
          // Reconnectable errors (code 200/503 etc.) — EventSource will retry automatically.
          // We only reject on irrecoverable errors (no code = network gone).
          if (code === undefined || code === 401 || code === 404) {
            es.close();
            settle(new Error(`SSE stream error for pipeline ${pipelineJobId} (code=${code})`));
          }
        });
      };

      const timeoutHandle = setTimeout(() => {
        settle(new Error(`SSE stream timed out after 30 minutes for pipeline ${pipelineJobId}`));
      }, TIMEOUT_MS);

      openStream();
    });
  }

  /**
   * Internal helper: run a full mock pending→processing→completed lifecycle for
   * any pipeline submission in non-production mode.
   */
  private async mockPipelineSubmit(
    correlationId: string,
    correlationType: 'ORDER' | 'BULK_JOB',
    storageKey: string,
    _programId?: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string }> {
    const pipelineJobId = `mock-pipeline-${storageKey}-${Date.now()}`;
    const evaluationId = `mock-eval-${storageKey}-${Date.now()}`;

    console.log(
      `🧪 [MOCK] Axiom pipeline submit — correlationId=${correlationId} correlationType=${correlationType} pipelineJobId=${pipelineJobId}`,
    );

    const pendingRecord = {
      id: evaluationId,
      evaluationId,
      pipelineJobId,
      correlationId,
      correlationType,
      orderId: correlationType === 'ORDER' ? correlationId : undefined,
      documentType: 'appraisal' as DocumentType,
      status: 'pending' as const,
      criteria: [],
      overallRiskScore: 0,
      timestamp: new Date().toISOString(),
    };
    await this.storeEvaluationRecord(pendingRecord);

    setTimeout(async () => {
      try {
        await this.storeEvaluationRecord({ ...pendingRecord, status: 'processing', timestamp: new Date().toISOString() });
        console.log(`🧪 [MOCK] Pipeline ${pipelineJobId} → processing`);
        await this.broadcastAxiomStatus(correlationId, evaluationId, 'processing');
      } catch (err) { console.error('🧪 [MOCK] Failed transition to processing', err); }
    }, 1000);

    setTimeout(async () => {
      try {
        const completed = correlationType === 'ORDER'
          ? this.buildMockEvaluation(correlationId, evaluationId)
          : { ...pendingRecord, status: 'completed' as const, overallRiskScore: 35, timestamp: new Date().toISOString() };
        await this.storeEvaluationRecord({ id: evaluationId, ...completed });
        console.log(`✅ [MOCK] Pipeline ${pipelineJobId} → completed`);
        await this.broadcastAxiomStatus(correlationId, evaluationId, 'completed', 35);
      } catch (err) { console.error('🧪 [MOCK] Failed transition to completed', err); }
    }, this.mockDelayMs);

    return { pipelineJobId, evaluationId };
  }

  // ============================================================================
  // Criteria Compilation
  // ============================================================================

  /**
   * In-memory cache for compiled criteria programs.
   * Key: `${clientId}:${tenantId}:${programId}:${programVersion}`
   * Entries expire after AXIOM_COMPILE_CACHE_TTL_MS (default 1 hour).
   */
  private compileCache = new Map<string, { response: CompileResponse; expiresAt: number }>();

  private compileCacheKey(
    clientId: string, tenantId: string, programId: string, programVersion: string,
  ): string {
    return `${clientId}:${tenantId}:${programId}:${programVersion}`;
  }

  private compileCacheTtlMs(): number {
    return parseInt(process.env.AXIOM_COMPILE_CACHE_TTL_MS || String(60 * 60 * 1000), 10);
  }

  /**
   * GET compiled criteria for a program (cache-first).
   *
   * Real mode  : GET {AXIOM_API_BASE_URL}/api/programs/{programId}/{version}/compiled
   *              with clientId + tenantId as query params.
   * Mock mode  : returns a fixed mock CompileResponse.
   *
   * Cache is bypassed when force=true or on a cache miss.
   *
   * @throws Error with `statusCode: 404` when Axiom returns 404
   *   (delta or referenced canonical does not exist yet).
   */
  async getCompiledCriteria(
    clientId: string,
    tenantId: string,
    programId: string,
    programVersion: string,
    force = false,
  ): Promise<CompileResponse> {
    const key = this.compileCacheKey(clientId, tenantId, programId, programVersion);

    // Cache hit
    if (!force) {
      const cached = this.compileCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.response;
      }
    }

    // Mock mode
    if (!this.enabled) {
      const mock = this.buildMockCompileResponse(programId, programVersion);
      this.compileCache.set(key, { response: mock, expiresAt: Date.now() + this.compileCacheTtlMs() });
      return mock;
    }

    // Real Axiom API
    try {
      const { data } = await this.client.get<CompileResponse>(
        `/api/programs/${encodeURIComponent(programId)}/${encodeURIComponent(programVersion)}/compiled`,
        { params: { clientId, tenantId } },
      );
      const response: CompileResponse = { ...data, cached: true };
      this.compileCache.set(key, { response, expiresAt: Date.now() + this.compileCacheTtlMs() });
      return response;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        const notFound = new Error(
          `Axiom: program '${programId}' version '${programVersion}' not found — ` +
          `delta or referenced canonical does not exist yet`,
        ) as Error & { statusCode: number };
        notFound.statusCode = 404;
        throw notFound;
      }
      throw err;
    }
  }

  /**
   * POST force-recompile a program (always fresh, never cached).
   *
   * Real mode  : POST {AXIOM_API_BASE_URL}/api/programs/{programId}/{version}/compile
   *              Body: { clientId, tenantId, userId? }
   * Mock mode  : returns a fresh mock CompileResponse.
   *
   * @throws Error with `statusCode: 404` when Axiom returns 404.
   */
  async compileCriteria(
    clientId: string,
    tenantId: string,
    programId: string,
    programVersion: string,
    userId?: string,
  ): Promise<CompileResponse> {
    // Mock mode
    if (!this.enabled) {
      const mock = this.buildMockCompileResponse(programId, programVersion);
      // Populate cache so a subsequent GET picks up the fresh result
      const key = this.compileCacheKey(clientId, tenantId, programId, programVersion);
      this.compileCache.set(key, { response: mock, expiresAt: Date.now() + this.compileCacheTtlMs() });
      return mock;
    }

    // Real Axiom API
    try {
      const { data } = await this.client.post<CompileResponse>(
        `/api/programs/${encodeURIComponent(programId)}/${encodeURIComponent(programVersion)}/compile`,
        { clientId, tenantId, ...(userId ? { userId } : {}) },
      );
      const response: CompileResponse = { ...data, cached: false };
      // Warm the cache with the fresh result
      const key = this.compileCacheKey(clientId, tenantId, programId, programVersion);
      this.compileCache.set(key, { response, expiresAt: Date.now() + this.compileCacheTtlMs() });
      return response;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        const notFound = new Error(
          `Axiom: program '${programId}' version '${programVersion}' not found — ` +
          `delta or referenced canonical does not exist yet`,
        ) as Error & { statusCode: number };
        notFound.statusCode = 404;
        throw notFound;
      }
      throw err;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a realistic mock evaluation result for development/demo purposes.
   * Used when AXIOM_API_BASE_URL / AXIOM_API_KEY are not configured.
   *
   * PROVISIONAL CRITERION IDs — READ BEFORE UPDATING
   * The `criterionId` values below use the concept codes from Axiom's
   * criteria-definitions for programId: canonical-fnma-1033-v1.0.0.
   *
   * These match the `concept` field returned by:
   *   GET /api/criteria/.../programs/canonical-fnma-1033/v1.0.0/compiled
   *
   * The QC execution engine matches on concept code, not the full nodeId,
   * so these values are stable across recompilation.
   */
  private buildMockEvaluation(orderId: string, evaluationId?: string): AxiomEvaluationResult {
    const evalId = evaluationId || `mock-eval-${orderId}-${Date.now()}`;
    return {
      orderId,
      evaluationId: evalId,
      documentType: 'appraisal',
      status: 'completed',
      overallRiskScore: 32,
      processingTime: 4820,
      timestamp: new Date().toISOString(),
      criteria: [
        // Provisional: code field values from CertoDb.criteria-definitions (not compiled nodeIds)
        {
          criterionId: 'NO_UNACCEPTABLE_APPRAISAL_PRACTICES', // APPR-1033-011
          criterionName: 'USPAP Standards Compliance',
          description: 'USPAP Standards Rule compliance — Standards 1 & 2',
          evaluation: 'pass',
          confidence: 0.94,
          reasoning: 'Report contains all required USPAP elements including scope of work, certifications, assumptions & limiting conditions, and signed certification statement.',
          documentReferences: [
            { section: 'Certification', page: 28, quote: 'I certify that, to the best of my knowledge and belief…' },
            { section: 'Scope of Work', page: 3, quote: 'The scope of work for this appraisal includes…' }
          ]
        },
        {
          criterionId: 'THREE_CLOSED_COMPS_USED', // APPR-1033-070
          criterionName: 'Comparable Count',
          description: 'Minimum three closed comparable sales used',
          evaluation: 'pass',
          confidence: 0.99,
          reasoning: 'Three closed comparable sales are presented in the Sales Comparison grid.',
          supportingData: [
            { comp: 1, address: '142 Oak Ridge Dr', distance: '0.4 mi', saleDate: '2025-11-15', salePrice: 425000, gla: 2180 },
            { comp: 2, address: '309 Maple Ln', distance: '0.8 mi', saleDate: '2025-09-28', salePrice: 438000, gla: 2240 },
            { comp: 3, address: '87 Birch Ct', distance: '1.1 mi', saleDate: '2025-10-03', salePrice: 415000, gla: 2050 }
          ],
          documentReferences: [
            { section: 'Sales Comparison Approach', page: 12, quote: 'Three closed sales are presented as comparable sales.' }
          ]
        },
        {
          criterionId: 'COMPS_ARE_SUITABLE_SUBSTITUTES', // APPR-1033-071
          criterionName: 'Comparable Selection Quality',
          description: 'Comparable selection appropriateness — proximity, recency, similarity',
          evaluation: 'pass',
          confidence: 0.88,
          reasoning: 'Three comparable sales within 1.2 miles, sold within 6 months, similar GLA (±15%), same neighborhood.',
          documentReferences: [
            { section: 'Sales Comparison Approach', page: 12, quote: 'Comparable 1 is located 0.4 miles southeast of the subject…' }
          ]
        },
        {
          criterionId: 'ADJUSTMENTS_ARE_REASONABLE', // APPR-1033-074
          criterionName: 'Adjustment Reasonableness',
          description: 'Mathematical accuracy and reasonableness of adjustments',
          evaluation: 'pass',
          confidence: 0.97,
          reasoning: 'All net and gross adjustments are within acceptable thresholds. Net adjustments range from 4.2% to 8.7% (threshold: 15%). Gross adjustments range from 11.3% to 16.1% (threshold: 25%).',
          documentReferences: [
            { section: 'Adjustment Grid', page: 14, quote: 'Net Adj: 4.2% | Gross Adj: 11.3%' }
          ]
        },
        {
          criterionId: 'PROPERTY_ADDRESS_COMPLETE', // APPR-1033-001
          criterionName: 'Property Address Complete',
          description: 'Subject property address is complete and present',
          evaluation: 'pass',
          confidence: 0.91,
          reasoning: 'Property address is complete and matches public records.',
          documentReferences: [
            { section: 'Subject', page: 1, quote: '1847 Willowbrook Lane, Riverton, FL 32789' }
          ]
        },
        {
          criterionId: 'PARCEL_ID_MATCHES_TITLE', // APPR-1033-002
          criterionName: 'Legal Description',
          description: 'Parcel ID / legal description matches title documentation',
          evaluation: 'pass',
          confidence: 0.91,
          reasoning: 'Legal description and parcel ID are present and consistent with title documentation.',
          documentReferences: [
            { section: 'Subject', page: 1, quote: 'Parcel ID: 12-34-56-7890, Lot 14, Block 3, Willowbrook Estates…' }
          ]
        },
        {
          criterionId: 'MARKET_TRENDS_IDENTIFIED', // APPR-1033-051
          criterionName: 'Market Conditions Analysis',
          description: 'Market conditions analysis and trend support',
          evaluation: 'warning',
          remediation: 'Add 12-month appreciation trend data from MLS to support the market conditions conclusion.',
          confidence: 0.78,
          reasoning: 'Market conditions are described as "stable" but recent MLS data shows a 3.2% appreciation trend over the past 12 months.',
          documentReferences: [
            { section: 'Neighborhood', page: 2, quote: 'Property values have been stable over the past 12 months.' }
          ]
        },
        {
          criterionId: 'PROPERTY_HIGHEST_BEST_USE', // APPR-1033-022
          criterionName: 'Highest & Best Use',
          description: 'Highest and best use analysis',
          evaluation: 'pass',
          confidence: 0.86,
          reasoning: 'Highest and best use identified as continued residential use, consistent with zoning (R-1) and market demand. All four tests addressed.',
          documentReferences: [
            { section: 'Highest & Best Use', page: 6, quote: 'The highest and best use of the subject, as improved, is continued use as a single-family residence.' }
          ]
        },
        {
          criterionId: 'PROPERTY_CONDITION_DOCUMENTED', // APPR-1033-030
          criterionName: 'Property Condition Documented',
          description: 'Property condition rating is present and supported',
          evaluation: 'pass',
          confidence: 0.90,
          reasoning: 'Condition rating C3 is documented with supporting narrative and photographic evidence.',
          documentReferences: [
            { section: 'Improvements', page: 5, quote: 'Condition: C3 — The improvements are well maintained with limited physical depreciation.' }
          ]
        },
        {
          criterionId: 'REQUIRED_PHOTOS_INCLUDED', // APPR-1033-061
          criterionName: 'Required Photos Included',
          description: 'All required exterior and interior photographs are present',
          evaluation: 'pass',
          confidence: 0.95,
          reasoning: 'Front, rear, and street scene exterior photos present. Interior photos include kitchen, main living area, and bathrooms.',
          documentReferences: [
            { section: 'Addenda — Photographs', page: 25, quote: 'Subject Front, Subject Rear, Subject Street Scene, Interior Kitchen, Interior Living Room' }
          ]
        },
        {
          criterionId: 'VALUE_SUPPORTED_BY_COMPS', // APPR-1033-076
          criterionName: 'Value Supported by Comparables',
          description: 'Final value opinion is supported within the comparable sales range',
          evaluation: 'pass',
          confidence: 0.85,
          reasoning: 'Final opinion of $432,000 is within the adjusted range of comparables ($421,500 – $441,200). Reconciliation provides adequate reasoning.',
          documentReferences: [
            { section: 'Reconciliation', page: 22, quote: 'Greatest weight given to the Sales Comparison Approach due to sufficient reliable comparable sales data.' }
          ]
        }
      ],
      extractedData: {
        propertyDetails: {
          address: '1847 Willowbrook Lane, Riverton, FL 32789',
          propertyType: 'Single Family Residential',
          gla: 2150,
          bedrooms: 4,
          bathrooms: 2.5,
          yearBuilt: 2008,
          lotSize: 0.28,
          garage: '2-car attached',
          condition: 'C3 — Good',
          quality: 'Q3 — Good'
        },
        comparables: [
          { address: '142 Oak Ridge Dr', salePrice: 425000, adjustedPrice: 431500, distance: 0.4 },
          { address: '309 Maple Ln', salePrice: 438000, adjustedPrice: 441200, distance: 0.8 },
          { address: '87 Birch Ct', salePrice: 415000, adjustedPrice: 421500, distance: 1.1 }
        ],
        adjustments: [
          { comp: 1, netAdj: 6500, netAdjPct: 1.5, grossAdj: 18500, grossAdjPct: 4.4 },
          { comp: 2, netAdj: 3200, netAdjPct: 0.7, grossAdj: 22400, grossAdjPct: 5.1 },
          { comp: 3, netAdj: 6500, netAdjPct: 1.6, grossAdj: 19800, grossAdjPct: 4.8 }
        ],
        uspapElements: {
          scopeOfWork: true,
          certifications: true,
          assumptions: true,
          limitingConditions: true,
          signedCertification: true,
          effectiveDate: '2026-01-15',
          reportDate: '2026-01-22'
        }
      }
    };
  }

  /**
   * Build a realistic mock Partial<RiskTapeItem> to simulate the extracted fields
   * Axiom would return from a typical appraisal PDF.
   *
   * Values are plausible but fictional — used only in mock mode
   * (AXIOM_API_BASE_URL not configured).  The loanNumber is seeded into the
   * result so individual loans are distinguishable in the mock portfolio.
   */
  private buildMockExtractedFields(loanNumber: string): Partial<RiskTapeItem> {
    // Vary values slightly per loan so the mock portfolio isn't uniform
    const seed = loanNumber.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
    const vary = (base: number, pct = 0.1) =>
      Math.round(base * (1 + ((seed % 100) / 100 - 0.5) * pct * 2) * 100) / 100;

    const appraisedValue = vary(432_000);
    const loanAmount = Math.round(appraisedValue * 0.8);

    return {
      // ── A. Loan Details ──────────────────────────────────────────────────
      loanNumber,
      loanAmount,
      firstLienBalance: loanAmount,
      secondLienBalance: 0,
      loanPurpose: 'Purchase',
      loanType: 'Conventional',
      occupancyType: 'Primary',
      ltv: vary(80),
      cltv: vary(80),
      dscr: vary(1.25, 0.2),
      cashOutRefi: false,
      // ── B. Property ──────────────────────────────────────────────────────
      propertyAddress: `${1800 + (seed % 200)} Willowbrook Lane`,
      city: 'Riverton',
      county: 'Orange County',
      state: 'FL',
      zip: '32789',
      censusTract: `12095${String(seed % 9999).padStart(4, '0')}.00`,
      propertyType: 'SFR',
      // ── C. Physical Characteristics ──────────────────────────────────────
      units: 1,
      yearBuilt: 2005 + (seed % 15),
      gla: vary(2150, 0.15),
      basementSf: 0,
      lotSize: vary(0.28, 0.2),
      bedrooms: 3 + (seed % 2),
      bathsFull: 2,
      bathsHalf: 1,
      conditionRating: 'C3',
      qualityRating: 'Q3',
      parking: '2-car attached garage',
      // ── D. Appraisal Details ─────────────────────────────────────────────
      appraisedValue,
      contractPrice: vary(appraisedValue, 0.05),
      appraisalEffectiveDate: '2025-10-15',
      appraiserLicense: `FL-CG-${String(10000 + (seed % 90000))}`,
      formType: '1004',
      ucdpSsrScore: `${(2 + (seed % 3)).toFixed(1)}`,
      collateralRiskRating: 'Low',
      reconciliationNotes: 'Greatest weight given to Sales Comparison Approach.',
      // ── E. Prior Sales ───────────────────────────────────────────────────
      priorPurchaseDate: '2018-06-01',
      priorPurchasePrice: vary(310_000),
      chainOfTitleRedFlags: false,
      // ── F. Market / Comp Data ────────────────────────────────────────────
      numComps: 3,
      compPriceRangeLow: vary(410_000, 0.05),
      compPriceRangeHigh: vary(445_000, 0.05),
      avgPricePerSf: vary(198, 0.1),
      avgDistanceMi: vary(0.8, 0.3),
      maxDistanceMi: vary(1.2, 0.2),
      compsDateRangeMonths: 6,
      nonMlsCount: seed % 3,
      nonMlsPct: seed % 3 === 0 ? 0 : vary(15, 0.5),
      avgNetAdjPct: vary(5.2, 0.3),
      avgGrossAdjPct: vary(12.8, 0.3),
      avgDom: vary(22, 0.4),
      monthsInventory: vary(3.1, 0.3),
      marketTrend: 'Stable',
      highRiskGeographyFlag: false,
      appraiserGeoCompetency: true,
      // ── G. Flags ─────────────────────────────────────────────────────────
      highNetGrossFlag: 'No',
      unusualAppreciationFlag: 'No',
      dscrFlag: 'No',
      nonPublicCompsFlag: seed % 3 === 0 ? 'No' : 'No',
    };
  }

  /**
   * Build a realistic mock document-comparison result for development/demo.
   */
  private buildMockComparison(orderId: string): {
    success: boolean;
    evaluationId?: string;
    changes?: {
      section: string;
      changeType: 'added' | 'removed' | 'modified';
      original?: string;
      revised?: string;
      significance: 'minor' | 'moderate' | 'major';
    }[];
    error?: string;
  } {
    return {
      success: true,
      evaluationId: `mock-compare-${orderId}-${Date.now()}`,
      changes: [
        {
          section: 'Sales Comparison Approach — Comparable 2',
          changeType: 'modified',
          original: 'Sale Price: $438,000 | Sale Date: 09/28/2025',
          revised: 'Sale Price: $442,000 | Sale Date: 09/28/2025 (verified with buyer agent)',
          significance: 'moderate'
        },
        {
          section: 'Subject Property — Condition',
          changeType: 'modified',
          original: 'Overall condition rated C3 (Good)',
          revised: 'Overall condition rated C3 (Good) — updated interior photos added',
          significance: 'minor'
        },
        {
          section: 'Reconciliation',
          changeType: 'modified',
          original: 'Indicated Value: $430,000',
          revised: 'Indicated Value: $432,000',
          significance: 'major'
        },
        {
          section: 'Market Conditions Addendum',
          changeType: 'added',
          revised: 'Added 12-month trend data showing 3.2% annual appreciation in zip code 32789, supporting stable-to-increasing market conclusion.',
          significance: 'moderate'
        },
        {
          section: 'Certifications',
          changeType: 'modified',
          original: 'Certification date: 01/15/2026',
          revised: 'Certification date: 01/22/2026',
          significance: 'minor'
        }
      ]
    };
  }

  /**
   * Store evaluation record in Cosmos DB aiInsights container
   */
  private async storeEvaluationRecord(record: any): Promise<void> {
    try {
      await this.dbService.upsertItem(this.containerName, record);
    } catch (error) {
      console.error('❌ Failed to store Axiom evaluation in Cosmos DB', {
        evaluationId: record.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - this is a caching issue, not critical
    }
  }

  /**
   * Get ALL evaluations for an order (for the order-level list view)
   */
  async getEvaluationsForOrder(orderId: string): Promise<AxiomEvaluationResult[]> {
    try {
      const query = `SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.timestamp DESC`;
      const response = await this.dbService.queryItems<AxiomEvaluationResult>(
        this.containerName,
        query,
        [{ name: '@orderId', value: orderId }]
      );

      if (response.success && response.data) {
        return response.data.map(evaluation => {
          const meta = (evaluation as any)._metadata ?? {};
          return {
            ...evaluation,
            criteria: this.enrichCriteriaRefs(evaluation.criteria, meta),
          };
        });
      }

      return [];
    } catch (error) {
      console.error('❌ Failed to retrieve evaluations for order', {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get evaluation from Cosmos DB cache
   */
  private async getEvaluationFromCache(orderId: string): Promise<AxiomEvaluationResult | null> {
    try {
      const query = `SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.timestamp DESC`;
      const response = await this.dbService.queryItems<AxiomEvaluationResult>(
        this.containerName,
        query,
        [{ name: '@orderId', value: orderId }]
      );

      if (response.success && response.data && response.data.length > 0) {
        return response.data[0] || null;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to retrieve evaluation from cache', {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Build a mock CompileResponse for development / when Axiom is not configured.
   * Uses the known 1033 criterion codes confirmed from Axiom's criteria-definitions.
   */
  private buildMockCompileResponse(programId: string, programVersion: string): CompileResponse {
    const fullProgramId = `${programId}-v${programVersion}`;
    const now = new Date().toISOString();

    const defs: Array<{ concept: string; title: string; description: string; category: string; priority: string }> = [
      { concept: 'PROPERTY_ADDRESS_COMPLETE',           title: 'Property Address Complete',           description: 'Subject property address is complete and present',                                              category: 'propertyIdentification',   priority: 'critical'  },
      { concept: 'PARCEL_ID_MATCHES_TITLE',             title: 'Legal Description / Parcel ID',       description: 'Parcel ID / legal description matches title documentation',                                    category: 'propertyIdentification',   priority: 'critical'  },
      { concept: 'NO_UNACCEPTABLE_APPRAISAL_PRACTICES', title: 'USPAP Standards Compliance',          description: 'Report complies with USPAP Standards Rules 1 & 2',                                            category: 'uspap',                    priority: 'critical'  },
      { concept: 'PROPERTY_CONDITION_DOCUMENTED',       title: 'Property Condition Documented',       description: 'Condition rating (C1–C6) is present and supported by photos',                                 category: 'subjectPropertyDescription', priority: 'critical'},
      { concept: 'MARKET_TRENDS_IDENTIFIED',            title: 'Market Trends Identified',            description: 'Market conditions identified and consistent with third-party data',                           category: 'neighborhoodAnalysis',     priority: 'required' },
      { concept: 'PROPERTY_HIGHEST_BEST_USE',           title: 'Highest & Best Use',                  description: 'Highest and best use analysis is present and supportable',                                    category: 'siteAnalysis',             priority: 'required' },
      { concept: 'REQUIRED_PHOTOS_INCLUDED',            title: 'Required Photos Included',            description: 'Front, rear, street, and all comparable photos are present and labeled',                     category: 'requiredExhibits',         priority: 'required' },
      { concept: 'THREE_CLOSED_COMPS_USED',             title: 'Three Closed Comparables Used',       description: 'At least three closed arm\'s-length comparable sales used in the sales comparison approach',  category: 'comparableSalesAnalysis',  priority: 'critical'  },
      { concept: 'COMPS_ARE_SUITABLE_SUBSTITUTES',      title: 'Comparable Selection Quality',        description: 'Comparables are suitable substitutes — similar style, size, age, condition, and location',    category: 'comparableSalesAnalysis',  priority: 'critical'  },
      { concept: 'ADJUSTMENTS_ARE_REASONABLE',          title: 'Adjustment Reasonableness',           description: 'All adjustments are reasonable and supported by market data',                                  category: 'comparableSalesAnalysis',  priority: 'critical'  },
      { concept: 'VALUE_SUPPORTED_BY_COMPS',            title: 'Value Supported by Comparables',      description: 'Final value opinion is supported by the adjusted comparable sales',                           category: 'comparableSalesAnalysis',  priority: 'critical'  },
    ];

    const criteria: CompiledProgramNode[] = defs.map((d, i) => {
      const seq = String(i + 1).padStart(3, '0');
      const nodeId = `program:${fullProgramId}:${d.category}.${d.concept}:${seq}`;
      return {
        id: nodeId,
        nodeId,
        tier: 'program',
        owner: fullProgramId,
        version: programVersion,
        canonNodeId: `canon:axiom:${d.category}.${d.concept}`,
        canonPath: `${d.category}.${d.concept}`,
        taxonomyCategory: d.category,
        concept: d.concept,
        title: d.title,
        description: d.description,
        evaluation: { mode: 'ai-assisted' },
        dataRequirements: [],
        documentRequirements: [],
        priority: d.priority,
        required: d.priority === 'critical',
        programId: fullProgramId,
        compiledAt: now,
      };
    });

    const categories = [...new Set(defs.map((d) => d.category))];

    return {
      criteria,
      cached: false,
      metadata: {
        programId,
        programVersion,
        fullProgramId,
        criteriaCount: criteria.length,
        categories,
        compiledAt: now,
      },
    };
  }
}
