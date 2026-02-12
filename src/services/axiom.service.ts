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

// ============================================================================
// Axiom Service
// ============================================================================

export class AxiomService {
  private client: AxiosInstance;
  private dbService: CosmosDbService;
  private containerName = 'aiInsights';
  private enabled: boolean;

  constructor(dbService?: CosmosDbService) {
    const baseURL = process.env.AXIOM_API_BASE_URL;
    const apiKey = process.env.AXIOM_API_KEY;

    this.enabled = !!(baseURL && apiKey);

    if (!this.enabled) {
      console.warn('⚠️  Axiom AI Platform not configured - AI features will be disabled');
      console.warn('   Set AXIOM_API_BASE_URL and AXIOM_API_KEY environment variables');
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
  }

  /**
   * Check if Axiom integration is configured and enabled
   */
  isEnabled(): boolean {
    return this.enabled;
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
      return {
        success: false,
        error: 'Axiom integration not configured'
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

      return cachedResult;
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

      return cached;
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
      return {
        success: false,
        error: 'Axiom integration not configured'
      };
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
  // Private Helper Methods
  // ============================================================================

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
