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
import { CosmosDbService } from './cosmos-db.service';
import { WebPubSubService } from './web-pubsub.service';
import { EventPriority, EventCategory } from '../types/events.js';
import type { RiskTapeItem, TapeExtractionRequest } from '../types/review-tape.types.js';

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
  section?: string;
  page?: number;
  quote?: string;
  confidence?: number;
}

export interface CriterionEvaluation {
  criterionId: string;
  description: string;
  evaluation: EvaluationStatus;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  supportingData?: any[];
  documentReferences?: DocumentReference[];
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

  constructor(dbService?: CosmosDbService) {
    const baseURL = process.env.AXIOM_API_BASE_URL;
    const apiKey = process.env.AXIOM_API_KEY;

    this.enabled = !!(baseURL && apiKey);
    this.mockDelayMs = parseInt(process.env.AXIOM_MOCK_DELAY_MS || '8000', 10);

    if (!this.enabled) {
      console.warn('⚠️  Axiom AI Platform not configured - AI features will use mock mode');
      console.warn(`   Mock delay: ${this.mockDelayMs}ms (set AXIOM_MOCK_DELAY_MS to change)`);
      console.warn('   Set AXIOM_API_BASE_URL and AXIOM_API_KEY to enable real Axiom');
    }

    // Initialize Axiom API client
    this.client = axios.create({
      baseURL: baseURL || 'https://axiom-api.placeholder.com',
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || 'not-configured'}`,
        'User-Agent': 'AppraisalManagementPlatform/1.0'
      }
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
      const evaluation = await this.getEvaluationById(payload.evaluationId);

      if (!evaluation) {
        console.error('❌ Failed to retrieve evaluation after webhook notification', {
          evaluationId: payload.evaluationId
        });
        return;
      }

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
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a realistic mock evaluation result for development/demo purposes.
   * Used when AXIOM_API_BASE_URL / AXIOM_API_KEY are not configured.
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
        {
          criterionId: 'USPAP_COMPLIANCE',
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
          criterionId: 'COMP_SELECTION',
          description: 'Comparable selection appropriateness — proximity, recency, similarity',
          evaluation: 'pass',
          confidence: 0.88,
          reasoning: 'Three comparable sales within 1.2 miles, sold within 6 months, similar GLA (±15%), same neighborhood. Adjustments are within acceptable ranges.',
          supportingData: [
            { comp: 1, address: '142 Oak Ridge Dr', distance: '0.4 mi', saleDate: '2025-11-15', salePrice: 425000, gla: 2180 },
            { comp: 2, address: '309 Maple Ln', distance: '0.8 mi', saleDate: '2025-09-28', salePrice: 438000, gla: 2240 },
            { comp: 3, address: '87 Birch Ct', distance: '1.1 mi', saleDate: '2025-10-03', salePrice: 415000, gla: 2050 }
          ],
          documentReferences: [
            { section: 'Sales Comparison Approach', page: 12, quote: 'Comparable 1 is located 0.4 miles southeast of the subject…' }
          ]
        },
        {
          criterionId: 'MATH_ACCURACY',
          description: 'Mathematical accuracy of adjustments and value calculations',
          evaluation: 'pass',
          confidence: 0.97,
          reasoning: 'All net and gross adjustments are within acceptable thresholds. Net adjustments range from 4.2% to 8.7% (threshold: 15%). Gross adjustments range from 11.3% to 16.1% (threshold: 25%).',
          documentReferences: [
            { section: 'Adjustment Grid', page: 14, quote: 'Net Adj: 4.2% | Gross Adj: 11.3%' }
          ]
        },
        {
          criterionId: 'PROPERTY_DESCRIPTION',
          description: 'Subject property description completeness and consistency',
          evaluation: 'pass',
          confidence: 0.91,
          reasoning: 'Subject property details are complete: address, legal description, tax ID, site dimensions, zoning, improvements, utilities, and neighborhood description all present and internally consistent.',
          documentReferences: [
            { section: 'Subject', page: 1, quote: '2,150 SF single-family residence, 4 BR / 2.5 BA, built 2008' }
          ]
        },
        {
          criterionId: 'MARKET_CONDITIONS',
          description: 'Market conditions analysis and trend support',
          evaluation: 'warning',
          confidence: 0.78,
          reasoning: 'Market conditions are described as "stable" but recent MLS data shows a 3.2% appreciation trend over the past 12 months. Report could benefit from additional trend data to support the market conditions conclusion.',
          documentReferences: [
            { section: 'Neighborhood', page: 2, quote: 'Property values have been stable over the past 12 months.' }
          ]
        },
        {
          criterionId: 'HIGHEST_BEST_USE',
          description: 'Highest and best use analysis — legally permissible, physically possible, financially feasible, maximally productive',
          evaluation: 'pass',
          confidence: 0.86,
          reasoning: 'Highest and best use is identified as continued residential use, consistent with zoning (R-1), surrounding development, and market demand. All four tests addressed.',
          documentReferences: [
            { section: 'Highest & Best Use', page: 6, quote: 'The highest and best use of the subject, as improved, is continued use as a single-family residence.' }
          ]
        },
        {
          criterionId: 'SITE_ANALYSIS',
          description: 'Site characteristics, zoning, and environmental considerations',
          evaluation: 'pass',
          confidence: 0.90,
          reasoning: 'Site analysis includes lot dimensions, topography, utilities, flood zone determination (Zone X — no special hazard), zoning compliance, and easements. FEMA panel referenced.',
          documentReferences: [
            { section: 'Site', page: 4, quote: 'Lot size: 0.28 acres, generally level, public water & sewer, Zone X per FEMA panel 12345C0100J, effective 01/01/2024.' }
          ]
        },
        {
          criterionId: 'RECONCILIATION',
          description: 'Value reconciliation logic and final opinion support',
          evaluation: 'pass',
          confidence: 0.85,
          reasoning: 'Reconciliation provides adequate reasoning for weighting the Sales Comparison Approach most heavily. Final opinion of $432,000 is within the adjusted range of comparables ($421,500 – $441,200).',
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
        return response.data;
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
}
