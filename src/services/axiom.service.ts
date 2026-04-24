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

import axios, { AxiosHeaders, AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { CircuitBreaker, CircuitBreakerOpenError, isServerError } from '../utils/circuit-breaker.js';
import { EventSource } from 'eventsource';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { WebPubSubService } from './web-pubsub.service';
import { PropertyEnrichmentService } from './property-enrichment.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventPriority, EventCategory } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';
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
  /** When true, bypasses the Cosmos idempotency guard and always submits a fresh pipeline run. */
  forceResubmit?: boolean;
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
  /** Field paths in the supporting data that this citation produced (e.g. ["salePrice1", "gla1"]) */
  sourceFieldPaths?: string[];
}

/**
 * A single row of supporting data produced by a criterion evaluation.
 * Carries arbitrary extracted key/value fields plus source-linkage metadata
 * that enables the UI to open the source document at the exact page and
 * location where the data was found — providing a full audit trail from
 * extracted value → document origin.
 */
export interface SupportingDataItem {
  /** Arbitrary extracted field name → value */
  [key: string]: unknown;
  /** Name of the document this row was extracted from (e.g. "Appraisal Report.pdf") */
  sourceDocument?: string;
  /** 1-indexed page number in the source document */
  sourcePage?: number;
  /** Bounding box coordinates for PDF viewer highlight overlay */
  sourceCoordinates?: { x: number; y: number; width: number; height: number };
  /** Resolved by enrichCriteriaRefs: internal Cosmos document ID */
  sourceDocumentId?: string;
  /** Resolved by enrichCriteriaRefs: Azure Blob Storage URL */
  sourceBlobUrl?: string;
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
  supportingData?: SupportingDataItem[];
  /** Evidence citations — every criterion evaluation must reference the document sections it used */
  documentReferences: DocumentReference[];
}

export interface AxiomEvaluationResult {
  orderId: string;
  evaluationId: string;
  pipelineJobId?: string;
  correlationType?: string;
  /** Our tenant identifier passed to Axiom for data partitioning and correlation */
  tenantId?: string;
  /** Our client identifier passed to Axiom for data partitioning and correlation */
  clientId?: string;
  /** The evaluation program applied to this submission */
  programId?: string;
  /** The version of the evaluation program */
  programVersion?: string;
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
  private static readonly DEFAULT_AXIOM_API_RESOURCE = 'api://3bc96929-593c-4f35-8997-e341a7e09a69';
  private static readonly PLACEHOLDER_API_KEYS = new Set(['live-fire-testing-key']);
  static readonly DEFAULT_PIPELINE_IDS: Record<string, string> = {
    EXTRACTION_ONLY: 'adaptive-document-processing',
    CRITERIA_ONLY: 'smart-criteria-evaluation',
    FULL_PIPELINE: 'complete-document-criteria-evaluation',
    CLASSIFICATION_ONLY: 'adaptive-document-processing',
  };

  private readonly logger = new Logger('AxiomService');
  private client: AxiosInstance;
  // A-05: Circuit breaker — opens after 5 consecutive 5xx responses from Axiom
  // and blocks outbound calls for 60s before allowing one probe. Prevents a
  // degraded Axiom from dragging every order through a slow failure path.
  private readonly axiomBreaker = new CircuitBreaker({
    name: 'axiom-api',
    failureThreshold: parseInt(process.env.AXIOM_CB_FAILURE_THRESHOLD ?? '5', 10),
    openMs: parseInt(process.env.AXIOM_CB_OPEN_MS ?? '60000', 10),
  });
  private dbService: CosmosDbService;
  private propertyEnrichmentService?: PropertyEnrichmentService;
  private webPubSubService: WebPubSubService | null = null;
  private publisher: ServiceBusEventPublisher = new ServiceBusEventPublisher();
  private containerName = 'aiInsights';
  private enabled: boolean;
  private mockDelayMs: number;
  private axiomStaticBearerToken?: string;
  private axiomCredential?: DefaultAzureCredential;
  private axiomTokenScope?: string;
  private cachedAxiomToken?: { token: string; expiresOnTimestamp?: number };
  private lastPipelineSubmissionError: {
    code: string;
    message: string;
    details?: unknown;
    status?: number;
  } | null = null;

  /**
   * In-memory registry of pipeline terminal events delivered via webhook.
   *
   * Axiom emits `pipeline.completed` ONLY to the webhookBus (HTTP POST to our
   * webhook endpoint) — it is never written to the Cosmos /api/admin/events store.
   * The SSE proxy (`proxyPipelineStream`) polls that store so it would never see
   * pipeline.completed. When the webhook handler confirms completion it calls
   * `signalPipelineTermination`, and the polling loop checks here on every cycle.
   *
   * TTL: 30 minutes. Old entries are pruned lazily on each signal call.
   */
  private readonly pipelineTerminations = new Map<string, { status: 'completed' | 'failed'; timestamp: string; expiresAt: number }>();

  // ── Inline Loom pipeline definitions ───────────────────────────────────────
  // Axiom's POST /api/pipelines accepts either:
  //   • pipelineId: "<uuid>"  — references a stored template in pipeline-templates Cosmos container
  //   • pipeline: { ... }     — inline Loom definition sent with the request
  //
  // The dev server does NOT have our templates registered, so we use inline definitions.
  // When the Axiom team provides registered template UUIDs, set:
  //   AXIOM_PIPELINE_ID_RISK_EVAL=<uuid>
  //   AXIOM_PIPELINE_ID_DOC_EXTRACT=<uuid>
  //   AXIOM_PIPELINE_ID_BULK_EVAL=<uuid>
  // and those UUIDs will be used instead of the inline definitions.

  /** Single-order: document processing + criteria evaluation pipeline. */
  private static readonly PIPELINE_RISK_EVAL: LoomPipelineDefinition = {
    name: 'risk-evaluation',
    version: '1.0.0',
    stages: [
      {
        name: 'process-documents',
        actor: 'DocumentProcessor',
        mode: 'single',
        input: {
          documents:   { path: 'trigger.documents' },
          subClientId: { path: 'trigger.subClientId' },
          clientId:    { path: 'trigger.clientId' },
        },
        timeout: 120000,
      },
      {
        name: 'evaluate-criteria',
        actor: 'CriterionEvaluator',
        mode: 'single',
        input: {
          fields:      { path: 'trigger.fields' },
          programId:   { path: 'trigger.programId' },
          documents:   { path: 'stages.process-documents' },
          subClientId: { path: 'trigger.subClientId' },
          clientId:    { path: 'trigger.clientId' },
        },
        timeout: 180000,
      },
    ],
  };

  /** Document-only extraction pipeline (no criteria eval). */
  private static readonly PIPELINE_DOC_EXTRACT: LoomPipelineDefinition = {
    name: 'document-extraction',
    version: '1.0.0',
    stages: [
      {
        name: 'extract',
        actor: 'DocumentProcessor',
        mode: 'single',
        input: {
          documents:   { path: 'trigger.documents' },
          subClientId: { path: 'trigger.subClientId' },
          clientId:    { path: 'trigger.clientId' },
        },
        timeout: 120000,
      },
    ],
  };

  /** Bulk/batch: multiple loans in one pipeline job. */
  private static readonly PIPELINE_BULK_EVAL: LoomPipelineDefinition = {
    name: 'bulk-risk-evaluation',
    version: '1.0.0',
    stages: [
      {
        name: 'load-criteria',
        actor: 'CriteriaLoader',
        mode: 'single',
        input: {
          programId:   { path: 'trigger.programId' },
          subClientId: { path: 'trigger.subClientId' },
          clientId:    { path: 'trigger.clientId' },
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
   * Returns the `pipelineId` (registered Cosmos template UUID) or `pipeline`
   * (inline Loom definition) param for POST /api/pipelines.
   *
   * All three types default to inline definitions because the Axiom dev server
   * does not have our templates registered. Set AXIOM_PIPELINE_ID_<TYPE> to a
   * valid UUID when the Axiom team provisions registered templates in Cosmos.
   */
  private buildPipelineParam(
    type: 'RISK_EVAL' | 'DOC_EXTRACT' | 'BULK_EVAL',
  ): { pipelineId: string } | { pipeline: LoomPipelineDefinition } {
    const envOverride = process.env[`AXIOM_PIPELINE_ID_${type}`];
    if (envOverride) return { pipelineId: envOverride };

    if (type === 'RISK_EVAL')   return { pipeline: AxiomService.PIPELINE_RISK_EVAL };
    if (type === 'DOC_EXTRACT') return { pipeline: AxiomService.PIPELINE_DOC_EXTRACT };
    return { pipeline: AxiomService.PIPELINE_BULK_EVAL };
  }

  constructor(dbService?: CosmosDbService) {
    const baseURL = process.env.AXIOM_API_BASE_URL;
    const forceMock = String(process.env.AXIOM_FORCE_MOCK || '').toLowerCase() === 'true';
    const rawApiKey = process.env.AXIOM_API_KEY?.trim();
    const useDefaultCredential = this.shouldUseDefaultCredential(rawApiKey);

    // Live mode requires only a base URL — API key is optional (server may be open in dev).
    this.enabled = !!baseURL && !forceMock;
    this.mockDelayMs = parseInt(process.env.AXIOM_MOCK_DELAY_MS || '8000', 10);

    if (useDefaultCredential) {
      this.axiomTokenScope = this.resolveAxiomTokenScope();
      this.axiomCredential = new DefaultAzureCredential();
    } else if (rawApiKey) {
      this.axiomStaticBearerToken = rawApiKey;
    }

    if (!this.enabled) {
      this.logger.warn('Axiom AI Platform not configured — AI features will use mock mode', {
        mockDelayMs: this.mockDelayMs,
        hint: 'Set AXIOM_API_BASE_URL to enable real Axiom (AXIOM_API_KEY is optional)',
      });
    } else {
      this.logger.info('Axiom live mode', {
        baseURL,
        authenticated: !!this.axiomStaticBearerToken || !!this.axiomCredential,
        authMode: this.axiomStaticBearerToken ? 'static-bearer' : this.axiomCredential ? 'default-credential' : 'none',
      });
    }

    const axiomHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AppraisalManagementPlatform/1.0',
    };

    // Initialize Axiom API client
    this.client = axios.create({
      baseURL: baseURL || 'https://axiom-api.placeholder.com',
      timeout: 30000, // 30 seconds
      headers: axiomHeaders,
    });
    this.client.interceptors.request.use(async (config) => this.attachAxiomAuthorization(config));

    // A-05: Gate every request through the circuit breaker. When OPEN we throw
    // a CircuitBreakerOpenError before the network call — callers detect this
    // and route the order to the manual-review queue instead of stalling.
    this.client.interceptors.request.use((config) => {
      const state = this.axiomBreaker.getState();
      if (state === 'OPEN') {
        throw new CircuitBreakerOpenError('axiom-api', 0);
      }
      return config;
    });
    this.client.interceptors.response.use(
      (response) => {
        this.axiomBreaker.recordSuccess();
        return response;
      },
      (error) => {
        if (isServerError(error)) {
          this.axiomBreaker.recordFailure(
            `HTTP ${(error as AxiosError).response?.status} from ${(error as AxiosError).config?.url}`,
          );
        }
        throw error;
      },
    );

    // Initialize Cosmos DB service for storing results
    this.dbService = dbService || new CosmosDbService();

    // Initialize WebPubSub for real-time push (best-effort — if not configured, skip)
    try {
      this.webPubSubService = new WebPubSubService({ enableLocalEmulation: true });
    } catch {
      this.logger.warn('WebPubSub not available for Axiom push notifications — updates will be poll-only');
    }
  }

  /**
   * Check if Axiom integration is configured and enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Returns the platform client ID that identifies this tenant's Axiom partition.
   * Must be configured via AXIOM_CLIENT_ID — no silent fallback.
   */
  private getAxiomClientId(): string {
    const id = process.env['AXIOM_CLIENT_ID'];
    if (!id) throw new Error('AXIOM_CLIENT_ID env var is required for Axiom pipeline submissions — configure it in environment settings');
    return id;
  }

  /**
   * Called by the webhook handler when Axiom delivers pipeline.completed or
   * pipeline.failed via HTTP POST (not via Cosmos event store). The SSE proxy
   * checks this registry on every poll so it can terminate immediately.
   */
  signalPipelineTermination(jobId: string, status: 'completed' | 'failed'): void {
    const now = Date.now();
    const TTL_MS = 30 * 60 * 1_000; // 30 minutes

    // Lazy-prune stale entries
    for (const [key, entry] of this.pipelineTerminations) {
      if (entry.expiresAt < now) this.pipelineTerminations.delete(key);
    }

    this.pipelineTerminations.set(jobId, { status, timestamp: new Date().toISOString(), expiresAt: now + TTL_MS });
    this.logger.info('Pipeline termination signalled to SSE registry', { jobId, status });
  }

  /** @internal — used by proxyPipelineStream only */
  getPipelineTermination(jobId: string): { status: 'completed' | 'failed'; timestamp: string } | undefined {
    const entry = this.pipelineTerminations.get(jobId);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.pipelineTerminations.delete(jobId);
      return undefined;
    }
    return { status: entry.status, timestamp: entry.timestamp };
  }

  private shouldUseDefaultCredential(rawApiKey: string | undefined): boolean {
    const explicit = String(process.env['AXIOM_USE_DEFAULT_CREDENTIAL'] || '').toLowerCase() === 'true';
    if (explicit) {
      return true;
    }

    if (rawApiKey && AxiomService.PLACEHOLDER_API_KEYS.has(rawApiKey)) {
      this.logger.warn('AXIOM_API_KEY is a checked-in placeholder; switching the backend Axiom client to DefaultAzureCredential for live-fire parity.');
      return true;
    }

    return false;
  }

  private resolveAxiomTokenScope(): string {
    const explicitScope = process.env['AXIOM_API_TOKEN_SCOPE']?.trim();
    if (explicitScope) {
      return explicitScope;
    }

    const explicitResource = process.env['AXIOM_API_RESOURCE']?.trim();
    if (explicitResource) {
      return explicitResource.endsWith('/.default') ? explicitResource : `${explicitResource}/.default`;
    }

    return `${AxiomService.DEFAULT_AXIOM_API_RESOURCE}/.default`;
  }

  private async getAxiomAuthorizationHeader(): Promise<string | undefined> {
    if (this.axiomStaticBearerToken) {
      return `Bearer ${this.axiomStaticBearerToken}`;
    }

    if (!this.axiomCredential || !this.axiomTokenScope) {
      return undefined;
    }

    const now = Date.now();
    const cachedExpiry = this.cachedAxiomToken?.expiresOnTimestamp;
    if (this.cachedAxiomToken?.token && (!cachedExpiry || cachedExpiry - now > 120_000)) {
      return `Bearer ${this.cachedAxiomToken.token}`;
    }

    const accessToken = await this.axiomCredential.getToken(this.axiomTokenScope);
    if (!accessToken?.token) {
      throw new Error(
        `DefaultAzureCredential returned no token for Axiom scope '${this.axiomTokenScope}'. Sign in to Azure or set AXIOM_API_KEY with a valid bearer token.`,
      );
    }

    this.cachedAxiomToken = {
      token: accessToken.token,
      expiresOnTimestamp: accessToken.expiresOnTimestamp,
    };

    return `Bearer ${accessToken.token}`;
  }

  private async attachAxiomAuthorization(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const authorization = await this.getAxiomAuthorizationHeader();
    if (!authorization) {
      return config;
    }

    const headers = config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers ?? {});

    headers.set('Authorization', authorization);
    config.headers = headers;
    return config;
  }

  getLastPipelineSubmissionError(): {
    code: string;
    message: string;
    details?: unknown;
    status?: number;
  } | null {
    return this.lastPipelineSubmissionError;
  }

  private getPropertyEnrichmentService(): PropertyEnrichmentService {
    if (!this.propertyEnrichmentService) {
      this.propertyEnrichmentService = new PropertyEnrichmentService(
        this.dbService,
        new PropertyRecordService(this.dbService),
      );
    }

    return this.propertyEnrichmentService;
  }

  private getPropertyInfoString(
    propertyInfo: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = propertyInfo[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private parseCombinedAddress(raw: string): {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } {
    const normalized = raw.trim();
    const commaSeparatedMatch = normalized.match(/^(.+?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (commaSeparatedMatch) {
      const street = commaSeparatedMatch[1]?.trim();
      const city = commaSeparatedMatch[2]?.trim();
      const state = commaSeparatedMatch[3]?.trim().toUpperCase();
      const zipCode = commaSeparatedMatch[4]?.trim();

      return {
        ...(street ? { street } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        ...(zipCode ? { zipCode } : {}),
      };
    }

    return { street: normalized };
  }

  private normalizePropertyEnrichmentAddress(propertyInfo: Record<string, unknown>): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  } {
    const rawAddress = this.getPropertyInfoString(propertyInfo, ['propertyAddress', 'address', 'streetAddress']);
    const parsedAddress = rawAddress ? this.parseCombinedAddress(rawAddress) : {};

    let street = parsedAddress.street;
    const city = this.getPropertyInfoString(propertyInfo, ['propertyCity', 'city']) ?? parsedAddress.city;
    const state = this.getPropertyInfoString(propertyInfo, ['propertyState', 'state']) ?? parsedAddress.state;
    const zipCode = this.getPropertyInfoString(propertyInfo, ['propertyZip', 'zipCode', 'zip']) ?? parsedAddress.zipCode;

    if (street && city && state && zipCode) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedState = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedZip = zipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      street = street
        .replace(new RegExp(`,\\s*${escapedCity},\\s*${escapedState}\\s+${escapedZip}$`, 'i'), '')
        .replace(new RegExp(`\\s*,\\s*${escapedCity}$`, 'i'), '')
        .trim();
    }

    if (!street || !city || !state || !zipCode) {
      throw new Error(
        'Property enrichment requires address components street, city, state, and zipCode. ' +
        `Received propertyInfo=${JSON.stringify(propertyInfo)}`,
      );
    }

    return {
      street,
      city,
      state,
      zipCode,
    };
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
    if (!jobId) {
      this.logger.warn('broadcastBatchJobUpdate: jobId is missing — skipping broadcast');
      return;
    }
    try {
      // Broadcast to bulk-job-scoped group only (not all clients) to prevent cross-tenant data leak.
      await this.webPubSubService.sendToGroup(`bulk-job:${jobId}`, {
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
      this.logger.warn('Failed to broadcast Axiom batch status via WebPubSub', {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Phase 8.3 — Extract top-level identity fields from Axiom consolidated results
   * for denormalization onto the order record.  Keeps the full 50+ field set in
   * the canonical snapshot; this summary is the queryable subset.
   *
   * Each field carries { value, confidence, sourcePage, sourceCoordinates } so
   * the UI can show source refs and click through to the PDF.
   */
  private buildExtractedSummary(rawResults: Record<string, unknown>): Record<string, unknown> | null {
    const inner = (rawResults['results'] as Record<string, unknown> | undefined) ?? rawResults;
    const consolidate = Array.isArray(inner['consolidate']) ? (inner['consolidate'] as any[])[0] : null;
    const data = consolidate?.consolidatedData;
    if (!data || typeof data !== 'object') return null;

    // Fields we consider identity / top-level for the order.
    const FIELDS = [
      'propertyAddress',
      'propertyRightsAppraised',
      'propertyType',
      'siteSize',
      'gla',
      'grossLivingArea',
      'yearBuilt',
      'totalBedrooms',
      'totalBathrooms',
      'salePrice',
      'contractPrice',
      'appraisedValue',
      'finalValue',
      'effectiveDate',
      'appraiserName',
      'appraiserLicense',
    ];

    const summary: Record<string, unknown> = {};
    for (const field of FIELDS) {
      const val = (data as Record<string, unknown>)[field];
      if (val == null) continue;
      // Nested extraction objects (e.g., propertyAddress.street) — flatten one level
      if (typeof val === 'object' && !Array.isArray(val) && !('extractedValue' in val) && !('value' in val)) {
        const flat: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          flat[k] = this.unwrapExtractedField(v);
        }
        summary[field] = flat;
      } else {
        summary[field] = this.unwrapExtractedField(val);
      }
    }

    return Object.keys(summary).length > 0 ? summary : null;
  }

  /**
   * Unwrap an Axiom extraction field to { value, confidence, sourcePage, sourceCoordinates }.
   */
  private unwrapExtractedField(raw: unknown): unknown {
    if (raw == null || typeof raw !== 'object') return raw;
    const obj = raw as Record<string, unknown>;
    if (!('extractedValue' in obj) && !('value' in obj)) return raw;
    return {
      value: obj.extractedValue ?? obj.value,
      confidence: obj.confidence,
      sourcePage: obj.sourcePage,
      sourceCoordinates: obj.coordinates,
      sourceFile: obj.sourceFile,
    };
  }

  /**
   * Broadcast Axiom evaluation status update via WebPubSub.
   * Sends only to the order-scoped group ('order:{orderId}') to prevent cross-tenant data leaks.
   * Best-effort — logs a warning on failure but never throws.
   */
  private async broadcastAxiomStatus(
    orderId: string,
    evaluationId: string,
    status: string,
    riskScore?: number,
  ): Promise<void> {
    if (!this.webPubSubService) return;
    if (!orderId) {
      this.logger.warn('broadcastAxiomStatus: orderId is missing — skipping broadcast to prevent cross-tenant leak');
      return;
    }
    try {
      // Broadcast to order-scoped group only (not all clients) to prevent cross-tenant data leak.
      await this.webPubSubService.sendToGroup(`order:${orderId}`, {
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
      this.logger.warn('Failed to broadcast Axiom status via WebPubSub', {
        evaluationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Broadcast a pipeline stage lifecycle event via WebPubSub.
   * Used to stream live stage progress to the UI so a stage-by-stage timeline
   * can be rendered without polling.
   * Best-effort — logs a warning on failure but never throws.
   */
  private async broadcastPipelineStage(
    orderId: string,
    pipelineJobId: string,
    stage: string,
    event: 'started' | 'completed' | 'failed',
    durationMs?: number,
  ): Promise<void> {
    if (!this.webPubSubService || !orderId) return;
    try {
      await this.webPubSubService.sendToGroup(`order:${orderId}`, {
        id: `axiom-stage-${pipelineJobId}-${stage}-${event}`,
        title: 'Axiom Pipeline Stage',
        message: `Stage ${stage} ${event}`,
        priority: EventPriority.NORMAL,
        category: EventCategory.QC,
        targets: [],
        data: {
          eventType: 'axiom.pipeline.stage',
          orderId,
          pipelineJobId,
          stage,
          event,
          ...(durationMs !== undefined ? { durationMs } : {}),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.warn('Failed to broadcast Axiom pipeline stage via WebPubSub', {
        pipelineJobId, stage, event,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Retrieve evaluation results for an order
   * 
   * @param orderId Order ID to retrieve evaluation for
   * @param tenantId Tenant ID for multi-tenant data isolation
   * @returns Evaluation results or null if not found
   */
  async getEvaluation(orderId: string, tenantId: string): Promise<AxiomEvaluationResult | null> {
    if (!tenantId) {
      throw new Error(
        `getEvaluation: tenantId is required to prevent cross-tenant data access. ` +
        `orderId=${orderId} — ensure req.user.tenantId is populated by the auth middleware.`,
      );
    }
    try {
      // First try to get from Cosmos DB cache
      const cachedResult = await this.getEvaluationFromCache(orderId, tenantId);
      
      if (cachedResult && cachedResult.status === 'completed') {
        return cachedResult;
      }

      // If not in cache or still processing, fetch from Axiom API
      if (this.enabled) {
        const response = await this.client.get<AxiomEvaluationResult>(`/evaluations/${orderId}`);
        const evaluation = response.data;

        // Store/update in Cosmos DB
        if (evaluation.status === 'completed' || evaluation.status === 'failed') {
          // Enrich document references using _metadata from the pending cached record
          // (Axiom does not return documentId/blobUrl on individual citations)
          if (evaluation.status === 'completed') {
            const meta = (cachedResult as any)?._metadata ?? {};
            evaluation.criteria = this.enrichCriteriaRefs(evaluation.criteria, meta);
          }
          await this.storeEvaluationRecord({
            id: evaluation.evaluationId,
            ...evaluation,
            _metadata: (cachedResult as any)?._metadata,
          });
        }

        return evaluation;
      }

      // In mock mode, return cached record (which may be pending/processing/completed)
      // or null if no submission has been made for this order yet
      if (cachedResult) {
        return cachedResult;
      }
      this.logger.debug('[MOCK] No Axiom evaluation found for order — document not yet submitted', { orderId });
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 404) {
        this.logger.info('No Axiom evaluation found for order', { orderId });
        return null;
      }

      this.logger.error('Failed to retrieve Axiom evaluation', {
        orderId,
        error: axiosError.message
      });

      // Fall back to cached result even if stale
      return await this.getEvaluationFromCache(orderId, tenantId);
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
    const metaDocName = meta.documentName ?? meta.fileName; // stays `any` — assignable to string | undefined
    return criteria.map(c => ({
      ...c,
      documentReferences: c.documentReferences.map(r => ({
        ...r,
        documentId: r.documentId ?? meta.documentId,
        documentName: r.documentName ?? metaDocName,
        blobUrl: r.blobUrl ?? meta.blobUrl ?? meta.documentUrl,
      })),
      // Stamp sourceDocumentId/sourceBlobUrl on supporting-data rows that originated
      // from this document. A row matches when its sourceDocument name equals the meta
      // document name, or when no sourceDocument is set but source location data exists.
      ...(c.supportingData != null
        ? {
            supportingData: c.supportingData.map((row: SupportingDataItem): SupportingDataItem => {
              if (row.sourceDocumentId) return row; // already resolved — skip
              const rowDocName = row.sourceDocument;
              const nameMatches = !rowDocName || rowDocName === metaDocName;
              const hasSourceLocation = row.sourceDocument != null || row.sourcePage != null;
              if (hasSourceLocation && nameMatches) {
                return {
                  ...row,
                  sourceDocumentId: meta.documentId,
                  sourceBlobUrl: meta.blobUrl ?? meta.documentUrl,
                };
              }
              return row;
            }),
          }
        : {}),
    }));
  }

  /**
   * Retrieve evaluation results by evaluation ID
   * 
   * @param evaluationId Evaluation ID
   * @returns Evaluation results or null if not found
   */
  
  /**
   * Upload files to Axiom to create a FileSet
   * POST /api/documents
   */
  async createFileSet(
    tenantId: string,
    clientId: string,
    files: Array<{ url: string; filename: string }>,
    metadata?: Record<string, any>
  ): Promise<{ fileSetId: string; status: string; queueJobId?: string } | null> {
    if (!this.enabled) {
      return { fileSetId: `mock-fileset-${Date.now()}`, status: 'processing' };
    }

    try {
      const payload = {
        tenantId,
        clientId,
        metadata,
        presignedUrls: files.map((f) => ({ url: f.url, name: f.filename })),
      };

      const res = await this.client.post('/api/documents', payload);
      return res.data as { fileSetId: string; status: string; queueJobId?: string };
    } catch (error) {
      this.logger.error('Error creating FileSet', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Submit a task pipeline to Axiom for extraction/evaluation
   * POST /api/pipelines
   */
  async submitPipeline(
    tenantId: string,
    clientId: string,
    subClientId: string,
    fileSetId: string,
    pipelineMode: 'FULL_PIPELINE' | 'CLASSIFICATION_ONLY' | 'EXTRACTION_ONLY' | 'CRITERIA_ONLY',
    metadata?: Record<string, any>,
    pipelineIdOverride?: string,
  ): Promise<{ jobId: string; status: string } | null> {
    if (!this.enabled) {
      return { jobId: `mock-job-${Date.now()}`, status: 'submitted' };
    }

    const pipelineId = pipelineIdOverride ?? AxiomService.DEFAULT_PIPELINE_IDS[pipelineMode];
    if (!pipelineId) {
      throw new Error(`No pipeline ID resolved for mode '${pipelineMode}'. Set axiomPipelineId* on the client config or pass pipelineIdOverride.`);
    }

    try {
      const payload = {
        pipelineId,
        input: {
          subClientId,
          clientId,
          fileSetId,
          ...metadata,
        },
      };

      const res = await this.client.post('/api/pipelines', payload);
      return res.data as { jobId: string; status: string };
    } catch (error) {
      this.logger.error('Error submitting pipeline', { error: (error as Error).message });
      return null;
    }
  }



    /**
   * Streams Axiom pipeline events to the client as SSE.
   *
   * Axiom workers run on AKS and write events to Azure Redis Cache — a different
   * Redis instance than the one accessible locally.  The `/api/pipelines/:id/stream`
   * Redis-backed endpoint therefore never surfaces those events in a local-dev setup.
   *
   * Instead we poll Axiom's Cosmos-backed observability endpoint:
   *   GET /api/admin/events?executionId={jobId}&orderBy=timestamp&order=asc
   * which works regardless of where the worker ran, deduplicate by eventId, and
   * forward each event as an SSE frame until a terminal pipeline event arrives.
   *
   * SSE event name: eventType with '.' replaced by '_'  (e.g. pipeline_completed)
   * so that it matches the terminal set in the test client.
   */
  async proxyPipelineStream(
    jobId: string,
    req: import('express').Request,
    res: import('express').Response,
    options: { idleTimeoutMs?: number; pollIntervalMs?: number } = {},
  ): Promise<void> {
    if (!this.enabled) {
      res.write('data: ' + JSON.stringify({ type: 'COMPLETE', status: 'completed' }) + '\n\n');
      res.end();
      return;
    }

    const POLL_INTERVAL_MS = options.pollIntervalMs ?? 3_000;
    // How long to wait with no terminal event before declaring timeout.
    // 10 minutes is generous but the client-side SSE consumer enforces its own
    // AXIOM_LIVE_SSE_TIMEOUT_MS cutoff so this is just a server-side safety net.
    const IDLE_TIMEOUT_MS = options.idleTimeoutMs ?? 10 * 60 * 1_000;

    const TERMINAL_EVENT_TYPES = new Set([
      'pipeline.completed',
      'pipeline.failed',
      'pipeline.cancelled',
      'pipeline.timeout',
      'pipeline.partial_complete',
    ]);

    // Declare all state before touching res so nothing can use an uninitialised binding.
    let done = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    const seenEventIds = new Set<string>();
    let pollCount = 0;
    // How often to fall back to a direct Axiom REST status check.
    // Axiom only delivers pipeline.completed via webhook (not Cosmos), so when the
    // webhook can't reach us (e.g. local dev), this ensures the SSE terminates.
    const STATUS_CHECK_EVERY_N_POLLS = 10; // every ~30 s at 3 s poll interval
    // Offset increases with each confirmed-delivered event so subsequent polls
    // skip already-seen events without relying on timestamp comparisons
    // (which can fail if Cosmos timestamps are not strictly monotonic or the
    // startTime filter has boundary-inclusion bugs).

    const flush = () => {
      // res.flush() is added by the compression middleware; call it if present
      // so partial writes are not buffered by any middleware layer.
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    const stop = () => {
      done = true;
      clearTimeout(pollTimer);
      clearTimeout(idleTimer);
      clearInterval(heartbeatTimer);
    };

    req.on('close', stop);

    // Open the SSE response.
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    // Initial heartbeat so the client knows we're alive; flush forces
    // any compression layer to emit the bytes immediately.
    res.write(': connected\n\n');
    flush();

    // Periodic keep-alive heartbeats — prevents reverse-proxy / load-balancer
    // idle-connection timeouts during long pipelines (every 20 s).
    heartbeatTimer = setInterval(() => {
      if (!done) {
        res.write(': heartbeat\n\n');
        flush();
      } else {
        clearInterval(heartbeatTimer);
      }
    }, 20_000);

    const sendTimeout = () => {
      if (done) return;
      res.write('event: timeout\n');
      res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'Timed out waiting for terminal pipeline event' })}\n\n`);
      stop();
      res.end();
    };

    idleTimer = setTimeout(sendTimeout, IDLE_TIMEOUT_MS);

    const poll = async (): Promise<void> => {
      if (done) return;

      // Check the in-memory webhook registry FIRST.
      // Axiom delivers pipeline.completed only via webhookBus (HTTP POST to our webhook
      // endpoint), never to the Cosmos /api/admin/events store that we poll below.
      // When the webhook handler calls signalPipelineTermination(), this poll cycle
      // synthesises the terminal SSE event so the client can close cleanly.
      const webhookSignal = this.getPipelineTermination(jobId);
      if (webhookSignal) {
        const syntheticEvent = {
          eventId: `synthetic-${jobId}-${webhookSignal.status}`,
          eventType: `pipeline.${webhookSignal.status}`,
          timestamp: webhookSignal.timestamp,
          source: 'webhook-relay',
          data: { deliveredVia: 'webhook' },
        };
        const sseEventName = syntheticEvent.eventType.replace(/\./g, '_');
        res.write(`event: ${sseEventName}\n`);
        res.write(`data: ${JSON.stringify(syntheticEvent)}\n\n`);
        flush();
        this.logger.info('proxyPipelineStream: webhook terminal signal received — closing SSE', { jobId, status: webhookSignal.status });
        stop();
        res.end();
        return;
      }

      try {
        const params = new URLSearchParams({
          executionId: jobId,
          orderBy: 'timestamp',
          order: 'asc',
          limit: '100',
          // Skip events already delivered — offset is the count of unique events seen so far.
          offset: String(seenEventIds.size),
        });

        const response = await this.client.get<{
          events: Array<{ eventId: string; eventType: string; timestamp: string; [key: string]: unknown }>;
          hasMore: boolean;
        }>(`/api/admin/events?${params}`);

        const { events } = response.data;
        let terminal = false;

        for (const event of events) {
          if (seenEventIds.has(event.eventId)) continue;
          seenEventIds.add(event.eventId);

          // Map dots → underscores so 'pipeline.completed' becomes
          // 'pipeline_completed', which the SSE client recognises as terminal.
          const sseEventName = event.eventType.replace(/\./g, '_');
          res.write(`event: ${sseEventName}\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          flush();

          this.logger.debug('SSE event forwarded', { jobId, eventType: event.eventType });

          if (TERMINAL_EVENT_TYPES.has(event.eventType)) {
            terminal = true;
            break;
          }
        }

        if (terminal || done) {
          stop();
          res.end();
          return;
        }
      } catch (err) {
        this.logger.error('proxyPipelineStream poll error', { jobId, error: (err as Error).message });
        // Don't abort — a transient Axiom error shouldn't kill the stream.
        // The idle timeout will fire if the terminal event never arrives.
      }

      pollCount++;

      // Fallback: periodically call GET /api/pipelines/{jobId}/results to detect
      // pipeline completion when the webhook cannot reach this server (e.g. local dev,
      // or any scenario where signalPipelineTermination() was never called).
      // 200 → completed; 409 → still running; other → ignore and keep polling.
      if (!done && pollCount % STATUS_CHECK_EVERY_N_POLLS === 0) {
        try {
          await this.client.get(`/api/pipelines/${jobId}/results`);
          // A 200 response means the pipeline committed its results — treat as completed.
          const syntheticEvent = {
            eventId: `synthetic-${jobId}-completed-status-poll`,
            eventType: 'pipeline.completed',
            timestamp: new Date().toISOString(),
            source: 'status-poll-fallback',
            data: { deliveredVia: 'status-poll' },
          };
          res.write(`event: pipeline_completed\n`);
          res.write(`data: ${JSON.stringify(syntheticEvent)}\n\n`);
          flush();
          this.logger.info('proxyPipelineStream: pipeline completed detected via status poll — closing SSE', { jobId, pollCount });
          stop();
          res.end();
          return;
        } catch (statusErr) {
          const axiosStatusErr = statusErr as import('axios').AxiosError;
          if (axiosStatusErr.response?.status === 409) {
            // 409 = pipeline still running on Axiom's side — normal, keep polling.
            const body = axiosStatusErr.response.data as Record<string, unknown> | undefined;
            this.logger.debug('proxyPipelineStream: status poll — pipeline still running', {
              jobId, currentStatus: body?.['currentStatus'], pollCount,
            });
          } else {
            // Any other error (network, 404, 5xx) is non-fatal — log and continue.
            this.logger.warn('proxyPipelineStream: status poll non-fatal error', {
              jobId, status: axiosStatusErr.response?.status, error: axiosStatusErr.message, pollCount,
            });
          }
        }
      }

      if (!done) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Kick off the first poll immediately so already-completed pipelines
    // (where all events are already in Cosmos) are surfaced without delay.
    void poll();
  }


  async getEvaluationById(evaluationId: string, bypassCache = false): Promise<AxiomEvaluationResult | null> {
    try {
      // Try Cosmos DB first
      const cachedResponse = await this.dbService.getItem<AxiomEvaluationResult>(
        this.containerName,
        evaluationId
      );

      const cached = cachedResponse.success && cachedResponse.data ? cachedResponse.data : null;

      const refreshedCached = await this.refreshPendingEvaluationFromPipelineResults(cached);
      const effectiveCached = refreshedCached ?? cached;

      // Short-circuit on completed/failed — unless bypassCache=true, which forces a
      // live Axiom fetch so callers (e.g. tests) always see the real upstream result.
      if (!bypassCache && effectiveCached && (effectiveCached.status === 'completed' || effectiveCached.status === 'failed')) {
        const meta = (effectiveCached as any)._metadata ?? {};
        effectiveCached.criteria = this.enrichCriteriaRefs(effectiveCached.criteria, meta);
        return effectiveCached;
      }

      // Fetch from Axiom API if enabled
      if (this.enabled) {
        try {
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
        } catch (error) {
          const axiosError = error as AxiosError;

          if (axiosError.response?.status === 404) {
            if (effectiveCached) {
              const meta = (effectiveCached as any)._metadata ?? {};
              effectiveCached.criteria = this.enrichCriteriaRefs(effectiveCached.criteria, meta);
              return effectiveCached;
            }
            return null;
          }

          this.logger.error('Failed to retrieve Axiom evaluation by ID', {
            evaluationId,
            statusCode: axiosError.response?.status,
            error: axiosError.message,
          });
          throw error;
        }
      }

      // In mock mode, return cached record (which may be pending/processing/completed)
      // or null if no submission has been made yet
      if (effectiveCached) {
        const meta = (effectiveCached as any)._metadata ?? {};
        effectiveCached.criteria = this.enrichCriteriaRefs(effectiveCached.criteria, meta);
        return effectiveCached;
      }
      this.logger.debug('[MOCK] No Axiom evaluation found for evaluationId', { evaluationId });
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;

      this.logger.error('Failed to retrieve Axiom evaluation by ID', {
        evaluationId,
        statusCode: axiosError.response?.status,
        error: axiosError.message,
      });
      throw error;
    }
  }

  private async refreshPendingEvaluationFromPipelineResults(
    cached: AxiomEvaluationResult | null,
  ): Promise<AxiomEvaluationResult | null> {
    if (!cached || (cached.status !== 'pending' && cached.status !== 'processing') || !cached.pipelineJobId || !cached.orderId) {
      return cached;
    }

    await this.fetchAndStorePipelineResults(cached.orderId, cached.pipelineJobId, cached.evaluationId, cached.overallRiskScore);

    const refreshedResponse = await this.dbService.getItem<AxiomEvaluationResult>(this.containerName, cached.evaluationId);
    if (!refreshedResponse.success || !refreshedResponse.data) {
      return cached;
    }

    return refreshedResponse.data;
  }

  /**
   * Handle webhook notification from Axiom when evaluation completes
   * 
   * @param payload Webhook payload from Axiom
   */
  async handleWebhook(payload: AxiomWebhookPayload): Promise<void> {
    this.logger.info('Axiom webhook received', {
      evaluationId: payload.evaluationId,
      orderId: payload.orderId,
      status: payload.status
    });

    try {
      // Fetch full evaluation results from Axiom
      const rawEvaluation = await this.getEvaluationById(payload.evaluationId);

      if (!rawEvaluation) {
        this.logger.error('Failed to retrieve evaluation after webhook notification', {
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

      this.logger.info('Axiom evaluation completed and stored', {
        evaluationId: payload.evaluationId,
        orderId: payload.orderId,
        riskScore: evaluation.overallRiskScore,
        criteriaCount: evaluation.criteria.length
      });

      // Stamp axiomProgramId / axiomProgramVersion back onto the order document so the
      // frontend can display which program was applied and pass it to criteria queries.
      // Skip tape-loan ('::' separator) and bulk ('batch-') correlationIds — those do
      // not map 1:1 to a real order document.
      if (
        payload.status === 'completed' &&
        evaluation.programId &&
        !payload.orderId.includes('::') &&
        !payload.orderId.startsWith('batch-')
      ) {
        await this.dbService.updateOrder(payload.orderId, {
          axiomProgramId: evaluation.programId,
          ...(evaluation.programVersion ? { axiomProgramVersion: evaluation.programVersion } : {}),
        }).catch((err) =>
          this.logger.error('Failed to stamp axiomProgramId on order from webhook', {
            orderId: payload.orderId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

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
      this.logger.error('Failed to handle Axiom webhook', {
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
    revisedDocumentUrl: string,
    subClientId: string,
  ): Promise<{
    success: boolean;
    comparisonId?: string;
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
      this.logger.debug('[MOCK] Axiom not configured — returning mock comparison', { orderId });
      const mock = this.buildMockComparison(orderId);
      return {
        ...mock,
        ...(mock.evaluationId ? { comparisonId: mock.evaluationId } : {}),
      };
    }

    try {
      const orderResponse = await this.dbService.findOrderById(orderId);
      const order = orderResponse.success ? orderResponse.data : null;
      if (!order) {
        return {
          success: false,
          error: `Order '${orderId}' not found`,
        };
      }

      const tenantId = order.tenantId;
      const clientId = (order as any).clientInformation?.clientId || order.clientId;
      if (!tenantId || !clientId) {
        return {
          success: false,
          error: `Order '${orderId}' is missing tenantId/clientId required for Axiom comparison`,
        };
      }

      const comparisonId = `cmp-${orderId}-${Date.now().toString(36)}`;
      const originalResults = await this.runSingleDocumentComparisonExtraction(
        orderId,
        tenantId,
        clientId,
        subClientId,
        originalDocumentUrl,
        'original',
      );
      const revisedResults = await this.runSingleDocumentComparisonExtraction(
        orderId,
        tenantId,
        clientId,
        subClientId,
        revisedDocumentUrl,
        'revised',
      );

      const changes = this.buildComparisonChanges(
        this.extractComparablePayload(originalResults),
        this.extractComparablePayload(revisedResults),
      );

      const comparisonRecord = {
        id: comparisonId,
        comparisonId,
        type: 'document-comparison',
        orderId,
        tenantId,
        clientId,
        status: 'completed',
        changes,
        changesSummary: `${changes.length} change${changes.length === 1 ? '' : 's'} detected`,
        comparisonType: 'revision' as const,
        timestamp: new Date().toISOString(),
        originalDocumentUrl,
        revisedDocumentUrl,
      };

      await this.storeEvaluationRecord(comparisonRecord);

      this.logger.info('Axiom document comparison completed via unified pipeline flow', {
        orderId,
        comparisonId,
        changeCount: changes.length,
      });

      return {
        success: true,
        comparisonId,
        evaluationId: comparisonId,
        changes,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data;
      const errorMessage = typeof responseData === 'string'
        ? responseData
        : responseData !== undefined
          ? JSON.stringify(responseData)
          : axiosError.message;
      
      this.logger.error('Failed to compare documents via Axiom', {
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
      this.logger.debug('[MOCK] Axiom extraction mock — creating pending record', { mockEvalId: mockEvalId ?? '', loanNumber: request.loanNumber });

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
          this.logger.debug('[MOCK] Extraction → processing', { evaluationId: pendingRecord.evaluationId });
        } catch (err) {
          this.logger.error('[MOCK] Failed to transition extraction to processing', { evaluationId: pendingRecord.evaluationId, error: (err as Error).message });
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
          this.logger.debug('[MOCK] Extraction → completed', { evaluationId: pendingRecord.evaluationId });
        } catch (err) {
          this.logger.error('[MOCK] Failed to transition extraction to completed', { evaluationId: pendingRecord.evaluationId, error: (err as Error).message });
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

      this.logger.info('Axiom extraction submitted', {
        jobId: request.jobId,
        loanNumber: request.loanNumber,
        evaluationId,
      });

      return { success: true, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as any)?.message ?? axiosError.message;
      this.logger.error('Failed to submit document for extraction via Axiom', {
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
      this.logger.error('Failed to retrieve extraction record from Cosmos', {
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
    documents: Array<{ documentName: string; documentReference: string }> | undefined,
    tenantId: string,
    clientId: string,
    subClientId: string,
    programId?: string,
    programVersion?: string,
    correlationType: 'ORDER' | 'TAPE_LOAN' = 'ORDER',
    evaluationMode: 'EXTRACTION' | 'CRITERIA_EVALUATION' | 'COMPLETE_EVALUATION' = 'COMPLETE_EVALUATION',
    forceResubmit = false,
    pipelineIdOverride?: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string } | null> {
    this.lastPipelineSubmissionError = null;

    if (!this.enabled) {
      return this.mockPipelineSubmit(orderId, correlationType, orderId, programId);
    }

    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error('API_BASE_URL is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const webhookSecret = process.env['AXIOM_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      throw new Error('AXIOM_WEBHOOK_SECRET is required for Axiom pipeline submissions — configure it in environment settings');
    }

    // P3-F: Idempotency guard — if an in-flight evaluation already exists for this
    // order, return the existing run keys (evaluationId + pipelineJobId) rather than
    // submitting again. This prevents double-submission when the auto-trigger service
    // and inline submission path race each other.
    // forceResubmit=true bypasses this guard so callers (e.g. live-fire tests, manual
    // resubmit flows) can always push a fresh pipeline run to Axiom.
    if (forceResubmit) {
      this.logger.info('submitOrderEvaluation: forceResubmit=true — skipping idempotency guard', { orderId });
    }
    if (!forceResubmit) try {
      const existingQuery = `
        SELECT TOP 1 c.evaluationId, c.pipelineJobId FROM c
        WHERE c.orderId = @orderId AND c.tenantId = @tenantId
          AND (c.status = 'pending' OR c.status = 'processing')
        ORDER BY c.timestamp DESC`;
      const existingResult = await this.dbService.queryItems<{ evaluationId: string; pipelineJobId: string }>(
        this.containerName,
        existingQuery,
        [{ name: '@orderId', value: orderId }, { name: '@tenantId', value: tenantId }],
      );
      if (existingResult.success && existingResult.data && existingResult.data.length > 0) {
        const existing = existingResult.data[0]!;
        this.logger.warn('submitOrderEvaluation: in-flight evaluation already exists — skipping duplicate submission', {
          orderId, existingEvaluationId: existing.evaluationId, existingPipelineJobId: existing.pipelineJobId,
        });
        return { pipelineJobId: existing.pipelineJobId, evaluationId: existing.evaluationId };
      }
    } catch (checkErr) {
      // Non-fatal: if the idempotency check fails we proceed and let Axiom deduplicate.
      this.logger.warn('submitOrderEvaluation: idempotency check failed — proceeding with submission', {
        orderId, error: (checkErr as Error).message,
      });
    }

    // Map our document references to the Axiom files[] shape.
    // documentReference is a SAS URL — Axiom fetches via plain HTTPS GET (downloadMethod: 'fetch').
    // storageAccountName/containerName are only required for 'azure-sdk' (Managed Identity) path.
    const axiomFiles = (documents ?? []).map((doc) => ({
      fileName: doc.documentName,
      url: doc.documentReference,
      mediaType: 'application/pdf',
      downloadMethod: 'fetch' as const,
    }));

    // Document types Axiom should expect in this file set.
    // Override via AXIOM_REQUIRED_DOCUMENT_TYPES (comma-separated) for non-default pipelines.
    const requiredDocumentTypes = process.env['AXIOM_REQUIRED_DOCUMENT_TYPES']
      ? process.env['AXIOM_REQUIRED_DOCUMENT_TYPES'].split(',').map((t: string) => t.trim())
      : ['appraisal-report'];

    const modeToKey: Record<string, string> = { EXTRACTION: 'EXTRACTION_ONLY', CRITERIA_EVALUATION: 'CRITERIA_ONLY', COMPLETE_EVALUATION: 'FULL_PIPELINE' };
    const resolvedKey = modeToKey[evaluationMode];
    if (!resolvedKey) {
      throw new Error(`Unknown evaluationMode '${evaluationMode}'. Expected: EXTRACTION, CRITERIA_EVALUATION, or COMPLETE_EVALUATION.`);
    }
    const pipelineId = pipelineIdOverride ?? AxiomService.DEFAULT_PIPELINE_IDS[resolvedKey];
    if (!pipelineId) {
      throw new Error(`No pipeline ID resolved for evaluationMode '${evaluationMode}'. Set axiomPipelineId* on the client config.`);
    }

    try {
      // Axiom uses `correlationId` as the Cosmos document ID for its execution record
      // (executionId = normalizedCorrelationId in PipelineExecutionService.createExecution).
      // Cosmos `.create()` — not `.upsert()` — means a second submission with the same
      // correlationId always 409s.  For forceResubmit we append a `~r{timestamp}` suffix to
      // produce a unique ID so Axiom creates a fresh Cosmos document.  The webhook handler
      // strips this suffix (`rawCorrelationId.split('~r')[0]`) to recover the real orderId.
      const submissionCorrelationId = forceResubmit ? `${orderId}~r${Date.now()}` : orderId;

      // fileSetId is Axiom's BullMQ/Redis dedup key. Make it unique on forceResubmit as a
      // second line of defense (prevents Redis idempotency gate from short-circuiting).
      const fileSetId = forceResubmit ? `fs-${orderId}-r${Date.now()}` : `fs-${orderId}`;

      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        pipelineId,
        input: {
          subClientId,
          clientId,
          fileSetId,
          files: axiomFiles,
          requiredDocuments: requiredDocumentTypes,
          correlationId: submissionCorrelationId,
          correlationType,
          webhookUrl: `${apiBaseUrl}/api/axiom/webhook`,
          webhookSecret,
          // programId + programVersion are both required for criteria evaluation — omitting either causes pipeline.partial_complete.
          // Stage input specs read them as { path: 'trigger.programId' } / { path: 'trigger.programVersion' }.
          ...(programId ? { programId } : {}),
          ...(programVersion ? { programVersion } : {}),
        },
      });

      const pipelineJobId = response.data.jobId;
      const evaluationId = `eval-${orderId}-${pipelineJobId}`;

      await this.storeEvaluationRecord({
        id: evaluationId,
        orderId,
        evaluationId,
        pipelineJobId,
        correlationType,
        tenantId,
        clientId,
        ...(programId ? { programId } : {}),
        documentType: 'appraisal' as DocumentType,
        status: 'pending',
        criteria: [],
        overallRiskScore: 0,
        timestamp: new Date().toISOString(),
      });

      this.watchPipelineStream(pipelineJobId, orderId, 'ORDER').catch((err) => {
        this.logger.error('Axiom SSE stream error for order', { orderId, pipelineJobId, error: (err as Error).message });
      });

      // Stamp axiomPipelineJobId on the order document so the SSE proxy endpoint
      // (GET /api/axiom/evaluations/order/:orderId/stream) connects to this job.
      // Non-fatal: if the update fails, SSE routing may fall back to the previous job.
      if (correlationType === 'ORDER') {
        await this.dbService.updateOrder(orderId, { axiomPipelineJobId: pipelineJobId }).catch((err: Error) =>
          this.logger.warn('submitOrderEvaluation: failed to stamp axiomPipelineJobId on order', {
            orderId, pipelineJobId, error: err.message,
          }),
        );
      }

      return { pipelineJobId, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as Record<string, unknown> | undefined;
      const errorMessage = responseData?.['message'] ?? axiosError.message;
      const normalizedErrorMessage = typeof errorMessage === 'string' ? errorMessage.toLowerCase() : '';

      if (axiosError.response?.status === 409) {
        // When forceResubmit=true we deliberately used a unique correlationId+fileSetId,
        // so a 409 from Axiom is genuinely unexpected — surface it rather than silently reusing.
        if (forceResubmit) {
          throw new Error(
            `Axiom returned 409 on a force-resubmit for order '${orderId}'. ` +
            `This is unexpected with unique correlationId+fileSetId. Axiom error: ${errorMessage}`,
          );
        }
        this.logger.warn('Axiom returned duplicate submission conflict; attempting to reuse latest local evaluation', {
          orderId,
          status: axiosError.response?.status,
          error: errorMessage,
        });

        const latest = await this.tryReuseLatestEvaluationForOrder(orderId, tenantId, 'duplicate submission conflict');
        if (latest) {
          return latest;
        }
      }

      if (normalizedErrorMessage.includes('already exists')) {
        if (forceResubmit) {
          throw new Error(
            `Axiom returned 'already exists' on a force-resubmit for order '${orderId}'. ` +
            `This is unexpected with unique correlationId+fileSetId. Axiom error: ${errorMessage}`,
          );
        }
        this.logger.warn('Axiom returned duplicate already-exists error; attempting to reuse latest local evaluation', {
          orderId,
          status: axiosError.response?.status,
          error: errorMessage,
        });

        const latest = await this.tryReuseLatestEvaluationForOrder(orderId, tenantId, 'duplicate already-exists error');
        if (latest) {
          return latest;
        }
      }

      this.lastPipelineSubmissionError = {
        code: 'AXIOM_PIPELINE_SUBMIT_FAILED',
        message: typeof errorMessage === 'string' ? errorMessage : 'Axiom pipeline submission failed',
        ...(responseData !== undefined ? { details: responseData } : {}),
        ...(axiosError.response?.status !== undefined ? { status: axiosError.response.status } : {}),
      };
      this.logger.error('Failed to submit order evaluation to Axiom pipeline', { orderId, error: errorMessage });
      return null;
    }
  }

  private async tryReuseLatestEvaluationForOrder(
    orderId: string,
    tenantId: string,
    reason: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string } | null> {
    try {
      const latestQuery = `
        SELECT TOP 1 c.evaluationId, c.pipelineJobId FROM c
        WHERE c.orderId = @orderId AND c.tenantId = @tenantId
        ORDER BY c.timestamp DESC`;
      const latestResult = await this.dbService.queryItems<{ evaluationId: string; pipelineJobId: string }>(
        this.containerName,
        latestQuery,
        [{ name: '@orderId', value: orderId }, { name: '@tenantId', value: tenantId }],
      );

      const latest = latestResult.success && latestResult.data && latestResult.data.length > 0
        ? latestResult.data[0]
        : null;

      if (latest?.evaluationId && latest?.pipelineJobId) {
        this.logger.info('Reusing latest evaluation after upstream duplicate rejection', {
          orderId,
          reason,
          evaluationId: latest.evaluationId,
          pipelineJobId: latest.pipelineJobId,
        });
        return { pipelineJobId: latest.pipelineJobId, evaluationId: latest.evaluationId };
      }
    } catch (reuseErr) {
      this.logger.warn('Failed to reuse latest evaluation after upstream duplicate rejection', {
        orderId,
        reason,
        error: reuseErr instanceof Error ? reuseErr.message : String(reuseErr),
      });
    }

    return null;
  }

  /**
   * Submit a bulk tape job to Axiom by fanning out one pipeline job per loan
   * that has an associated document.
   *
   * Uses the same confirmed contract as submitOrderEvaluation:
   *   pipelineId: "complete-document-criteria-evaluation"
   *   input: { files[], downloadMethod: "fetch", correlationType: "BULK_JOB" }
   *   (storageAccountName/containerName omitted — only needed for 'azure-sdk' Managed Identity path)
   *
   * Submissions are throttled to MAX_BULK_CONCURRENCY concurrent calls to avoid
   * overwhelming the Axiom endpoint.  Loans without a documentBlobUrl are logged
   * and skipped — they cannot be evaluated without a document.
   *
   * Returns the first successful pipelineJobId + a caller-generated batchId,
   * or null if every loan failed or no loans had documents.
   */
  async submitBatchEvaluation(
    jobId: string,
    loanSubmissions: Array<{
      loanNumber: string;
      documentBlobUrl?: string;   // SAS URL or direct blob URL
      documentFileName?: string;
    }>,
    tenantId: string,
    clientId: string,
    subClientId: string,
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

    const withDoc = loanSubmissions.filter((s) => !!s.documentBlobUrl);
    if (withDoc.length === 0) {
      this.logger.warn('submitBatchEvaluation: no loans have documentBlobUrl — cannot submit to Axiom', {
        jobId,
        totalLoans: loanSubmissions.length,
      });
      return null;
    }

    if (withDoc.length < loanSubmissions.length) {
      this.logger.warn('submitBatchEvaluation: some loans have no documentBlobUrl and will be skipped', {
        jobId,
        withDoc: withDoc.length,
        skipped: loanSubmissions.length - withDoc.length,
      });
    }

    const requiredDocumentTypes = process.env['AXIOM_REQUIRED_DOCUMENT_TYPES']
      ? process.env['AXIOM_REQUIRED_DOCUMENT_TYPES'].split(',').map((t: string) => t.trim())
      : ['appraisal-report'];

    const MAX_CONCURRENCY = 3;
    const batchId = `batch-${jobId}-${Date.now().toString(36)}`;
    let firstPipelineJobId: string | null = null;
    let submittedCount = 0;
    let failedCount = 0;

    // Process in groups of MAX_CONCURRENCY to throttle Axiom submissions.
    for (let i = 0; i < withDoc.length; i += MAX_CONCURRENCY) {
      const chunk = withDoc.slice(i, i + MAX_CONCURRENCY);

      const settled = await Promise.allSettled(
        chunk.map(async (loan) => {
          const blobUrl = loan.documentBlobUrl!;
          const fileName = loan.documentFileName ?? `${loan.loanNumber}.pdf`;

          // blobUrl is a SAS URL — Axiom fetches via plain HTTPS GET (downloadMethod: 'fetch').
          // storageAccountName/containerName are only for the 'azure-sdk' Managed Identity path.
          const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
            pipelineId: process.env['AXIOM_PIPELINE_ID_RISK_EVAL'] ?? 'complete-document-criteria-evaluation',
            input: {
              subClientId,
              clientId,
              fileSetId: `fs-${jobId}-${loan.loanNumber}`,
              files: [{
                fileName,
                url: blobUrl,
                mediaType: 'application/pdf',
                downloadMethod: 'fetch' as const,
              }],
              requiredDocuments: requiredDocumentTypes,
              // Per-loan correlationId so the TAPE_LOAN webhook branch can parse jobId and loanNumber.
              correlationId: `${jobId}::${loan.loanNumber}`,
              correlationType: 'TAPE_LOAN',
              webhookUrl: `${apiBaseUrl}/api/axiom/webhook`,
              webhookSecret,
              ...(programId ? { programId } : {}),
            },
          });
          return { loanNumber: loan.loanNumber, pipelineJobId: response.data.jobId };
        }),
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          const { loanNumber, pipelineJobId } = result.value;
          submittedCount++;
          if (!firstPipelineJobId) firstPipelineJobId = pipelineJobId;
          // Store a lightweight evaluation record per loan for result stamping.
          this.storeEvaluationRecord({
            id: `${batchId}-${loanNumber}`,
            jobId,
            batchId,
            pipelineJobId,
            correlationType: 'TAPE_LOAN',
            loanNumber,
            tenantId,
            clientId,
            ...(programId ? { programId } : {}),
            status: 'pending',
            timestamp: new Date().toISOString(),
          }).catch((err: Error) =>
            this.logger.warn('submitBatchEvaluation: failed to store evaluation record', {
              jobId, loanNumber, error: err.message,
            }),
          );
          // No SSE stream per loan — opening O(N) persistent connections for a bulk batch is
          // not feasible. The TAPE_LOAN webhook (correlationId: jobId::loanNumber) is the
          // canonical result delivery path.
        } else {
          failedCount++;
          const axiosError = result.reason as AxiosError;
          const msg = (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
          this.logger.error('submitBatchEvaluation: individual loan submission failed', {
            jobId, error: msg,
          });
        }
      }
    }

    this.logger.info('submitBatchEvaluation: fanout complete', {
      jobId, batchId, submittedCount, failedCount, total: withDoc.length,
    });

    if (!firstPipelineJobId) {
      this.logger.error('submitBatchEvaluation: all loan submissions failed', { jobId });
      return null;
    }

    return { pipelineJobId: firstPipelineJobId, batchId };
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
    tenantId: string,
    clientId: string,
    subClientId: string,
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

    try {
      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        ...this.buildPipelineParam('DOC_EXTRACT'),
        input: {
          subClientId,
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
      await this.storeEvaluationRecord({
        ...pendingRecord,
        pipelineJobId,
        tenantId,
        clientId,
        ...(programId ? { programId } : {}),
      });

      this.watchPipelineStream(pipelineJobId, `${jobId}:${loanNumber}`, 'ORDER').catch((err) => {
        this.logger.error('Axiom SSE stream error for extraction', { jobId, loanNumber, error: (err as Error).message });
      });

      return { pipelineJobId, evaluationId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
      this.logger.error('Failed to submit document extraction to Axiom pipeline', { jobId, loanNumber, error: errorMessage });
      return null;
    }
  }

  /**
   * Submit a single PDF document for schema-based extraction.
   *
   * Uses the `pdf-schema-extraction` pipeline (PdfTextExtractor → SchemaBasedExtraction).
   * Axiom resolves the correct schema from Cosmos automatically using the
   * combination of clientId + tenantId + documentType.
   *
   * Set AXIOM_PIPELINE_ID_SCHEMA_EXTRACT=<uuid> when Axiom has a registered
   * template; otherwise an inline two-stage definition is sent.
   */
  async submitDocumentForSchemaExtraction(params: {
    documentId: string;
    orderId?: string;
    blobSasUrl: string;
    fileName: string;
    documentType: string;
    tenantId: string;
    clientId: string;
    subClientId: string;
    programId: string;
    programVersion: string;
  }): Promise<{ pipelineJobId: string } | null> {
    if (!this.enabled) {
      const mockJobId = `mock-schema-extract-${Date.now()}`;
      this.logger.info('Axiom mock mode — skipping submitDocumentForSchemaExtraction', {
        documentId: params.documentId,
        mockJobId,
      });
      return { pipelineJobId: mockJobId };
    }

    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error('API_BASE_URL is required for Axiom pipeline submissions — configure it in environment settings');
    }
    const webhookSecret = process.env['AXIOM_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      throw new Error('AXIOM_WEBHOOK_SECRET is required for Axiom pipeline submissions — configure it in environment settings');
    }

    // Use registered pipeline — Axiom owns the stage definitions, we never maintain them.
    // Override via AXIOM_PIPELINE_ID_SCHEMA_EXTRACT if Axiom publishes a new ID.
    const pipelineId = process.env['AXIOM_PIPELINE_ID_SCHEMA_EXTRACT'] || 'complete-document-criteria-evaluation';

    try {
      const response = await this.client.post<{ jobId: string }>('/api/pipelines', {
        pipelineId,
        input: {
          clientId:       params.clientId,
          subClientId:    params.subClientId,
          programId:      params.programId,
          programVersion: params.programVersion,
          fileSetId:      params.orderId ?? params.documentId,
          documentType:   params.documentType,
          files: [
            {
              fileName:       params.fileName,
              url:            params.blobSasUrl,
              mediaType:      'application/pdf',
              downloadMethod: 'fetch',
            },
          ],
          correlationId:   params.documentId,
          correlationType: 'DOCUMENT',
          webhookUrl:    `${apiBaseUrl}/api/axiom/webhook`,
          webhookSecret,
        },
      });

      this.logger.info('Document submitted to Axiom schema extraction pipeline', {
        documentId: params.documentId,
        pipelineJobId: response.data.jobId,
        documentType: params.documentType,
      });

      return { pipelineJobId: response.data.jobId };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage =
        (axiosError.response?.data as Record<string, unknown>)?.['message'] ?? axiosError.message;
      this.logger.error('Failed to submit document to Axiom schema extraction pipeline', {
        documentId: params.documentId,
        error: errorMessage,
      });
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
    // Retry strategy:
    // Axiom b3f03f9 (observe.ts, live 2026-04-02): pipeline_final only fires after the Cosmos
    // execution record is terminal — results are guaranteed present when we call GET /results.
    // Axiom e3a9b93: server-side 3×600ms retry handles cross-pod Cosmos replication lag.
    // These 3×2s client retries are a last-resort safety net if a pod still reads stale state.
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2_000; // 3 × 2 s = 6 s total

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.get<Record<string, unknown>>(`/api/pipelines/${pipelineJobId}/results`);
        if (attempt > 1) {
          this.logger.info(`fetchPipelineResults: succeeded on attempt ${attempt}`, { pipelineJobId });
        }
        return response.data;
      } catch (error) {
        const axiosError = error as AxiosError;
        const responseBody = axiosError.response?.data as Record<string, unknown> | undefined;

        if (axiosError.response?.status === 409 && responseBody && typeof responseBody === 'object') {
          // Check if the body itself contains result fields (some Axiom versions embed results in 409)
          const hasResultFields = 'stages' in responseBody || 'results' in responseBody
            || 'extractedData' in responseBody || 'criteriaResults' in responseBody
            || 'criteria' in responseBody || 'overallDecision' in responseBody;
          if (hasResultFields) {
            this.logger.info('fetchPipelineResults: 409 body contains result fields — using inline result', {
              pipelineJobId, bodyKeys: Object.keys(responseBody),
            });
            return responseBody;
          }

          // currentStatus='running' means Axiom hasn't committed yet — retry
          const currentStatus = (responseBody as Record<string, unknown>)['currentStatus'] as string | undefined;
          if (attempt < MAX_RETRIES) {
            this.logger.warn(
              `fetchPipelineResults: 409 (currentStatus=${currentStatus ?? 'unknown'}) on attempt ${attempt}/${MAX_RETRIES} — retrying in ${RETRY_DELAY_MS}ms`,
              { pipelineJobId },
            );
            await new Promise<void>((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }

          this.logger.error('fetchPipelineResults: 409 — exhausted retries', {
            pipelineJobId, currentStatus,
            bodyKeys: Object.keys(responseBody),
          });
          return null;
        }

        this.logger.error('Failed to fetch Axiom pipeline results', {
          pipelineJobId,
          status: axiosError.response?.status,
          responseBody: responseBody ? JSON.stringify(responseBody).slice(0, 500) : undefined,
          error: axiosError.message,
        });
        return null;
      }
    }
    return null;
  }

  async getPipelineStatus(pipelineJobId: string): Promise<{ status: string; error?: string; progress?: Record<string, unknown> } | null> {
    if (!this.enabled) return null;
    try {
      const response = await this.client.get<Record<string, unknown>>(`/api/pipelines/${pipelineJobId}`);
      const data = response.data;
      return {
        status: (data['status'] as string) ?? 'unknown',
        ...(data['error'] ? { error: data['error'] as string } : {}),
        ...(data['progress'] ? { progress: data['progress'] as Record<string, unknown> } : {}),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return null;
      this.logger.error('Failed to get pipeline status from Axiom', {
        pipelineJobId,
        status: axiosError.response?.status,
        error: axiosError.message,
      });
      return null;
    }
  }

  // ── Admin API proxies ────────────────────────────────────────────────────────

  async getQueueStats(): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null;
    try {
      const res = await this.client.get('/api/admin/queue/stats');
      return res.data as Record<string, unknown>;
    } catch (error) {
      this.logger.error('Failed to get Axiom queue stats', { error: (error as Error).message });
      return null;
    }
  }

  async getActiveJobs(limit = 20): Promise<unknown[]> {
    if (!this.enabled) return [];
    try {
      const res = await this.client.get(`/api/admin/queue/active?limit=${limit}`);
      return (res.data as { jobs: unknown[] }).jobs ?? [];
    } catch (error) {
      this.logger.error('Failed to get Axiom active jobs', { error: (error as Error).message });
      return [];
    }
  }

  async getRecentPipelines(limit = 20): Promise<unknown[]> {
    if (!this.enabled) return [];
    try {
      const res = await this.client.get(`/api/pipelines?limit=${limit}`);
      const data = res.data as { executions?: unknown[] };
      return data.executions ?? [];
    } catch (error) {
      this.logger.error('Failed to get Axiom recent pipelines', { error: (error as Error).message });
      return [];
    }
  }

  async failStuckJobs(maxAgeMs = 300_000): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null;
    try {
      const res = await this.client.post('/api/admin/queue/fail-stuck', { maxAgeMs });
      return res.data as Record<string, unknown>;
    } catch (error) {
      this.logger.error('Failed to fail stuck Axiom jobs', { error: (error as Error).message });
      return null;
    }
  }

  async cleanFailedJobs(minAgeMs = 1): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null;
    try {
      const res = await this.client.post('/api/admin/queue/clean-failed', { minAgeMs });
      return res.data as Record<string, unknown>;
    } catch (error) {
      this.logger.error('Failed to clean failed Axiom jobs', { error: (error as Error).message });
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
    // A-12: Defensive against null/undefined input — Axiom has returned empty
    // payloads in rare timeout paths. Treat as no-criteria instead of throwing.
    const rawObj: Record<string, unknown> = raw && typeof raw === 'object' ? raw : {};

    // Axiom may nest the domain output under `results`, `output`, or deliver
    // it flat at the top level — accept all three.
    const inner =
      (rawObj['results'] as Record<string, unknown> | undefined) ??
      (rawObj['output'] as Record<string, unknown> | undefined) ??
      rawObj;

    const rawCriteria: unknown[] = Array.isArray(inner['criteria'])
      ? inner['criteria']
      : Array.isArray(rawObj['criteria'])
      ? (rawObj['criteria'] as unknown[])
      : Array.isArray(inner['evaluations'])
      ? (inner['evaluations'] as unknown[])
      : [];

    // Normalise Axiom's varying evaluation status casing into our canonical set
    // ('pass' | 'fail' | 'warning' | 'info'). Handles Axiom-side variants like
    // 'Passed', 'FAIL', 'success', 'skipped', etc.
    const normalizeEvaluation = (v: unknown): EvaluationStatus => {
      const s = String(v ?? '').toLowerCase().trim();
      if (s === 'pass' || s === 'passed' || s === 'ok' || s === 'success') return 'pass';
      if (s === 'fail' || s === 'failed' || s === 'error') return 'fail';
      if (s === 'warn' || s === 'warning') return 'warning';
      if (s === 'info' || s === 'informational') return 'info';
      // 'skip' / 'skipped' / 'n/a' have no dedicated canonical value — treat as
      // info so they surface on the dashboard without blocking anything.
      if (s === 'skip' || s === 'skipped' || s === 'n/a' || s === 'not_applicable') return 'info';
      return 'warning';
    };

    // Clamp confidence into [0, 1]; Axiom sometimes returns 0-100.
    const normalizeConfidence = (v: unknown): number => {
      if (typeof v !== 'number' || Number.isNaN(v)) return 0;
      if (v > 1 && v <= 100) return v / 100;
      if (v < 0) return 0;
      if (v > 1) return 1;
      return v;
    };

    const criteria: CriterionEvaluation[] = (rawCriteria as unknown[])
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map(
        (c): CriterionEvaluation => {
          const obj = c as any;
          return {
            criterionId: obj.criterionId ?? obj.id ?? '',
            criterionName: obj.criterionName ?? obj.name ?? obj.title ?? obj.criterionId ?? '',
            description: obj.description ?? '',
            evaluation: normalizeEvaluation(obj.evaluation ?? obj.status ?? obj.result),
            confidence: normalizeConfidence(obj.confidence),
            reasoning: obj.reasoning ?? obj.explanation ?? '',
            remediation: obj.remediation ?? obj.fix,
            supportingData: obj.supportingData ?? obj.dataUsed ?? obj.evidence,
            documentReferences: Array.isArray(obj.documentReferences)
              ? (obj.documentReferences as unknown[])
                  .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
                  .map(
                    (r): DocumentReference => {
                      const ref = r as any;
                      return {
                        page: typeof ref.page === 'number' ? ref.page : 0,
                        section: ref.section ?? '',
                        quote: ref.quote ?? ref.text ?? ref.excerpt ?? '',
                        confidence: ref.confidence,
                        coordinates: ref.coordinates ?? ref.bbox,
                        documentId: ref.documentId,
                        documentName: ref.documentName,
                        blobUrl: ref.blobUrl,
                        sourceFieldPaths: ref.sourceFieldPaths,
                      };
                    },
                  )
              : [],
          };
        },
      );

    const overallRiskScore =
      typeof inner['overallRiskScore'] === 'number' ? inner['overallRiskScore'] :
      typeof inner['riskScore'] === 'number' ? inner['riskScore'] :
      typeof raw['overallRiskScore'] === 'number' ? raw['overallRiskScore'] as number : 0;

    // Extract programId / programVersion from wherever Axiom puts them
    const programId = (inner['programId'] ?? raw['programId'] ?? (raw['trigger'] as any)?.programId) as string | undefined;
    const programVersion = (inner['programVersion'] ?? raw['programVersion'] ?? (raw['trigger'] as any)?.programVersion) as string | undefined;

    const execMeta = raw['executionMetadata'] as Record<string, unknown> | undefined;
    const processingTime = typeof execMeta?.['duration'] === 'number'
      ? (execMeta['duration'] as number)
      : undefined;
    // Try multiple locations for extracted data:
    // 1. inner.extractedData (criteria pipeline or webhook-stored)
    // 2. consolidate[0].consolidatedData (extraction pipeline)
    const consolidateStage = Array.isArray(inner['consolidate']) ? (inner['consolidate'] as any[])[0] : undefined;
    const extractedData = (inner['extractedData'] as AxiomEvaluationResult['extractedData'])
      ?? (consolidateStage?.consolidatedData as AxiomEvaluationResult['extractedData'])
      ?? undefined;

    // Raw stage outputs for UI visibility
    const axiomExtractionResult = Array.isArray(inner['extract-data']) ? inner['extract-data'] : undefined;
    const axiomCriteriaResult = Array.isArray(inner['aggregateResults'])
      ? (inner['aggregateResults'] as unknown[])[0] : undefined;

    return {
      orderId,
      evaluationId,
      pipelineJobId,
      status: 'completed' as const,
      criteria,
      overallRiskScore,
      timestamp: new Date().toISOString(),
      ...(processingTime !== undefined ? { processingTime } : {}),
      ...(extractedData !== undefined ? { extractedData } : {}),
      ...(programId ? { programId } : {}),
      ...(programVersion ? { programVersion } : {}),
      ...(axiomExtractionResult !== undefined ? { axiomExtractionResult } : {}),
      ...(axiomCriteriaResult !== undefined ? { axiomCriteriaResult } : {}),
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
    stageLog?: Array<{ stage: string; event: 'started' | 'completed' | 'failed'; timestamp: string; durationMs?: number; error?: string }>,
  ): Promise<void> {
    const evalId = evaluationId ?? `eval-${orderId}-${pipelineJobId}`;

    // Read the pending record we stored at submit time — we need its _metadata
    // (documentId, documentName, blobUrl) to enrich document references.
    const pendingResponse = await this.dbService.getItem<any>(this.containerName, evalId);
    const meta: Record<string, any> = pendingResponse?.data?._metadata ?? {};

    const rawResults = await this.fetchPipelineResults(pipelineJobId);

    if (rawResults) {
      const mapped = this.mapPipelineResultsToEvaluation(rawResults, orderId, evalId, pipelineJobId);
      const pending = pendingResponse?.data ?? {};

      // Extract the pipeline's structured outputs for direct UI visibility.
      // Axiom response shape: { results: { extractStructuredData: [...], aggregateResults: [...], ... } }
      const rawStages = (rawResults['results'] as Record<string, unknown> | undefined) ?? {};
      const axiomExtractionResult =
        (Array.isArray(rawStages['extractStructuredData']) && (rawStages['extractStructuredData'] as unknown[]).length > 0
          ? rawStages['extractStructuredData']
          : rawResults['extractedData']) ?? undefined;
      const aggregateStage = rawStages['aggregateResults'];
      const axiomCriteriaResult =
        (Array.isArray(aggregateStage) && (aggregateStage as unknown[]).length > 0
          ? (aggregateStage as unknown[])[0]
          : rawResults['criteriaResults']) ?? undefined;

      const enriched = {
        id: evalId,
        ...mapped,
        documentType: (pending.documentType ?? 'appraisal') as DocumentType,
        // Carry tenantId/clientId/programId forward from the pending record so they
        // survive the overwrite and remain queryable on completed records.
        ...(pending.tenantId ? { tenantId: pending.tenantId } : {}),
        ...(pending.clientId ? { clientId: pending.clientId } : {}),
        ...(pending.programId ? { programId: pending.programId } : {}),
        criteria: this.enrichCriteriaRefs(mapped.criteria, meta),
        // Raw Axiom pipeline outputs — stored for full UI visibility.
        ...(axiomExtractionResult !== undefined ? { axiomExtractionResult } : {}),
        ...(axiomCriteriaResult !== undefined ? { axiomCriteriaResult } : {}),
        // Stage-by-stage execution log — populated from SSE stream events when available.
        ...(stageLog && stageLog.length > 0 ? { pipelineExecutionLog: stageLog } : {}),
        _metadata: { ...meta, completedAt: new Date().toISOString() },
      };
      await this.storeEvaluationRecord(enriched);
      this.logger.info('Axiom pipeline results stored', {
        orderId, pipelineJobId, evalId, criteriaCount: mapped.criteria.length, riskScore: mapped.overallRiskScore,
      });
      // Axiom's completed webhook carries no inline result payload — the caller must GET
      // /api/pipelines/{id}/results (done above). Stamp score/decision back on the order
      // record so it is queryable without joining to aiInsights.
      const resultInner = (rawResults['results'] as Record<string, unknown> | undefined) ?? rawResults;
      const rawDecision = resultInner['overallDecision'];
      const axiomDecision = (rawDecision === 'ACCEPT' || rawDecision === 'CONDITIONAL' || rawDecision === 'REJECT')
        ? (rawDecision as 'ACCEPT' | 'CONDITIONAL' | 'REJECT')
        : undefined;

      // ── Phase 8.3: Denormalize top-level extracted fields onto the order ─────
      // Pulls key identity fields from the consolidated extraction with source refs.
      const extractedSummary = this.buildExtractedSummary(rawResults);

      // ── Phase 8.7: Write extracted data back to the source document ─────
      // This makes the data available to the canonical snapshot layer, report
      // generation, and any other consumer that reads documents.extractedData.
      const consolidateStage = (() => {
        const inner = (rawResults['results'] as Record<string, unknown> | undefined) ?? rawResults;
        return Array.isArray(inner['consolidate']) ? (inner['consolidate'] as any[])[0] : null;
      })();
      if (consolidateStage?.consolidatedData && meta.documentId) {
        try {
          const docResp = await this.dbService.getItem<any>('documents', meta.documentId as string);
          if (docResp?.data) {
            const updatedDoc = {
              ...docResp.data,
              extractedData: consolidateStage.consolidatedData,
              extractedDataSource: 'axiom',
              extractedDataAt: new Date().toISOString(),
              extractedDataPipelineJobId: pipelineJobId,
            };
            await this.dbService.updateItem('documents', meta.documentId as string, updatedDoc);
            this.logger.info('Wrote extracted data back to document', {
              documentId: meta.documentId, fieldCount: Object.keys(consolidateStage.consolidatedData).length,
            });

            // A-13: Refresh the canonical snapshot (created at submit time) so
            // its normalizedData reflects post-Axiom consolidated extraction
            // rather than the pre-Axiom document state. Best-effort; a failure
            // here must not block the evaluation storage flow.
            try {
              const runId = (meta as any).runId as string | undefined;
              const tenantId = (meta as any).tenantId as string | undefined;
              if (runId && tenantId) {
                const runResp = await this.dbService.getItem<any>('aiInsights', runId, tenantId);
                const run = runResp?.data;
                if (run && run.type === 'run-ledger-record' && run.runType === 'extraction') {
                  const { CanonicalSnapshotService } = await import('./canonical-snapshot.service.js');
                  const snapshotService = new CanonicalSnapshotService(this.dbService);
                  await snapshotService.refreshFromExtractionRun(run);
                }
              }
            } catch (refreshErr) {
              this.logger.warn('A-13: canonical snapshot refresh failed — non-fatal', {
                documentId: meta.documentId,
                error: refreshErr instanceof Error ? refreshErr.message : String(refreshErr),
              });
            }
          }
        } catch (err) {
          this.logger.warn('Failed to write extracted data back to document', {
            documentId: meta.documentId, error: (err as Error).message,
          });
        }
      }

      await this.dbService.updateOrder(orderId, {
        axiomRiskScore: mapped.overallRiskScore,
        axiomStatus: 'completed',
        axiomEvaluationId: evalId,
        axiomPipelineJobId: pipelineJobId,
        axiomLastUpdatedAt: new Date().toISOString(),
        ...(axiomDecision ? { axiomDecision } : {}),
        ...(extractedSummary ? { axiomExtractedSummary: extractedSummary } : {}),
      } as any).catch((err: Error) =>
        this.logger.warn('fetchAndStorePipelineResults: could not stamp score/decision on order', {
          orderId, error: err.message,
        }),
      );

      // ── Phase 8.2a: Publish qc.issue.detected for each failed/warning criterion ─────
      for (const criterion of mapped.criteria) {
        if (criterion.evaluation === 'fail' || criterion.evaluation === 'warning') {
          try {
            await this.publisher.publish({
              id: uuidv4(),
              type: 'qc.issue.detected',
              timestamp: new Date(),
              source: 'axiom-service',
              version: '1.0',
              category: EventCategory.QC,
              data: {
                orderId,
                tenantId: (enriched as any).tenantId,
                criterionId: criterion.criterionId,
                issueSummary: criterion.criterionName,
                issueType: 'criterion-fail',
                severity: criterion.evaluation === 'fail' ? 'CRITICAL' : 'MAJOR',
                confidence: criterion.confidence,
                reasoning: criterion.reasoning,
                remediation: criterion.remediation,
                documentReferences: criterion.documentReferences,
                evaluationId: evalId,
                pipelineJobId,
                priority: criterion.evaluation === 'fail' ? EventPriority.HIGH : EventPriority.NORMAL,
              },
            } as any);
          } catch (err) {
            this.logger.warn('Failed to publish qc.issue.detected', {
              orderId, criterionId: criterion.criterionId, error: (err as Error).message,
            });
          }
        }
      }

      // ── Publish axiom.evaluation.completed so the audit trail and dashboard see it ─────
      try {
        const passCount = mapped.criteria.filter(c => c.evaluation === 'pass').length;
        const failCount = mapped.criteria.filter(c => c.evaluation === 'fail').length;
        const warnCount = mapped.criteria.filter(c => c.evaluation === 'warning').length;
        const fieldsExtracted = extractedSummary ? Object.keys(extractedSummary).length : 0;
        await this.publisher.publish({
          id: uuidv4(),
          type: 'axiom.evaluation.completed',
          timestamp: new Date(),
          source: 'axiom-service',
          version: '1.0',
          category: EventCategory.AXIOM,
          data: {
            orderId,
            tenantId: (enriched as any).tenantId,
            evaluationId: evalId,
            pipelineJobId,
            pipelineName: (pending.pipelineId as string) ?? 'adaptive-document-processing',
            status: failCount > 0 ? 'failed' : 'passed',
            score: mapped.overallRiskScore,
            criteriaCount: mapped.criteria.length,
            passCount,
            failCount,
            warnCount,
            fieldsExtracted,
            decision: axiomDecision,
            priority: EventPriority.NORMAL,
          },
        } as any);
      } catch (err) {
        this.logger.warn('Failed to publish axiom.evaluation.completed', {
          orderId, evalId, error: (err as Error).message,
        });
      }

      await this.broadcastAxiomStatus(orderId, evalId, 'completed', mapped.overallRiskScore);
    } else {
      // Axiom results not available (pipeline completed-partial, still running, or transient error).
      // If the SSE stream accumulated stage-log data, write a partial record to aiInsights so the
      // frontend sees the item rather than nothing.  Full extraction/criteria fields will be absent.
      this.logger.warn('fetchAndStorePipelineResults: no results returned from Axiom', {
        orderId, pipelineJobId, evalId, stageLogCount: stageLog?.length ?? 0,
      });
      if (stageLog && stageLog.length > 0) {
        const pendingRec = (pendingResponse?.data ?? {}) as Record<string, unknown>;
        await this.storeEvaluationRecord({
          id: evalId,
          orderId,
          pipelineJobId,
          evaluationId: evalId,
          status: 'completed' as const,
          overallRiskScore: fallbackRiskScore ?? 0,
          criteria: [],
          pipelineExecutionLog: stageLog,
          documentType: (pendingRec['documentType'] ?? 'appraisal') as any,
          ...(pendingRec['tenantId'] ? { tenantId: pendingRec['tenantId'] as string } : {}),
          ...(pendingRec['clientId'] ? { clientId: pendingRec['clientId'] as string } : {}),
          ...(pendingRec['programId'] ? { programId: pendingRec['programId'] as string } : {}),
          timestamp: new Date().toISOString(),
          _metadata: { ...meta, completedAt: new Date().toISOString(), partialResults: true },
        }).catch((err: Error) => {
          this.logger.error('fetchAndStorePipelineResults: failed to write partial record', {
            orderId, pipelineJobId, evalId, error: err.message,
          });
        });
        this.logger.info('fetchAndStorePipelineResults: wrote partial record with stage log', {
          orderId, pipelineJobId, evalId, stageCount: stageLog.length,
        });
      }
      await this.broadcastAxiomStatus(orderId, evalId, 'error');
    }
  }

  /**
   * Public entry-point for watching a pipeline stream for a single order.
   *
   * Callers outside AxiomService (e.g. BulkIngestionExtractionWorkerService) should use
   * this method instead of calling the private `watchPipelineStream` directly.
   * Fire-and-forget: starts the SSE stream and returns immediately; errors are logged.
   */
  watchOrderPipelineStream(pipelineJobId: string, orderId: string): void {
    this.watchPipelineStream(pipelineJobId, orderId, 'ORDER').catch((err: Error) => {
      this.logger.error('watchOrderPipelineStream: SSE stream error', { pipelineJobId, orderId, error: err.message });
    });
  }

  /**
   * Open a server-to-server SSE stream to the Axiom pipeline and relay each
   * progress event to the frontend via WebPubSub.
   *
   * Also accumulates a stage-by-stage execution log that is flushed to the
   * evaluation record in Cosmos when the pipeline reaches a terminal state.
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
    correlationType: 'ORDER' | 'BULK_JOB' | 'TAPE_LOAN',
  ): Promise<void> {
    const baseURL = process.env['AXIOM_API_BASE_URL'];
    if (!baseURL) {
      this.logger.warn('watchPipelineStream: AXIOM_API_BASE_URL not set — cannot open SSE stream', {
        pipelineJobId, correlationId,
      });
      return;
    }

    const apiKey = process.env['AXIOM_API_KEY'];
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes hard limit
    this.logger.info('watchPipelineStream: opening SSE stream', { pipelineJobId, correlationId, correlationType });

    // Stage execution log accumulated across the lifetime of this stream
    type StageLogEntry = { stage: string; event: 'started' | 'completed' | 'failed'; timestamp: string; durationMs?: number; error?: string };
    const stageLog: StageLogEntry[] = [];
    // Track start times so we can compute durationMs for 'started' entries that lack it
    const stageStartTimes = new Map<string, number>();

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
        const fetchWithAuth: typeof globalThis.fetch = async (input, init) => {
          const headers = new Headers((init?.headers as HeadersInit | undefined) ?? {});
          const authorization = await this.getAxiomAuthorizationHeader();
          if (authorization) {
            headers.set('Authorization', authorization);
          }
          return fetch(input, { ...init, headers });
        };

        const es = new EventSource(url, { fetch: fetchWithAuth });

        // Helper: track SSE cursor and parse event data safely
        const extractPayload = (event: MessageEvent): Record<string, unknown> => {
          if (event.lastEventId) lastEventId = event.lastEventId;
          try { return JSON.parse(event.data as string) as Record<string, unknown>; } catch { return {}; }
        };

        // ── Stage lifecycle events — Axiom sends 'stage.started' / 'stage.completed' ──
        // NOTE: event names use dots, not underscores — EventSource addEventListener requires exact match.

        es.addEventListener('stage.started', (event) => {
          const payload = extractPayload(event);
          const data = (payload['data'] as Record<string, unknown> | undefined) ?? {};
          const stage = (data['stage'] as string | undefined) ?? 'unknown';
          const timestamp = (payload['timestamp'] as string | undefined) ?? new Date().toISOString();
          stageLog.push({ stage, event: 'started', timestamp });
          stageStartTimes.set(stage, Date.now());
          this.broadcastPipelineStage(correlationId, pipelineJobId, stage, 'started').catch(() => {});
          this.broadcastAxiomStatus(correlationId, pipelineJobId, 'running').catch(() => {});
        });

        es.addEventListener('stage.completed', (event) => {
          const payload = extractPayload(event);
          const data = (payload['data'] as Record<string, unknown> | undefined) ?? {};
          const stage = (data['stage'] as string | undefined) ?? 'unknown';
          const timestamp = (payload['timestamp'] as string | undefined) ?? new Date().toISOString();
          const durationMs = typeof payload['durationMs'] === 'number'
            ? (payload['durationMs'] as number)
            : stageStartTimes.has(stage) ? Date.now() - stageStartTimes.get(stage)! : undefined;
          stageLog.push({ stage, event: 'completed', timestamp, ...(durationMs !== undefined ? { durationMs } : {}) });
          this.broadcastPipelineStage(correlationId, pipelineJobId, stage, 'completed', durationMs).catch(() => {});
          this.broadcastAxiomStatus(correlationId, pipelineJobId, 'running').catch(() => {});
        });

        es.addEventListener('stage.failed', (event) => {
          const payload = extractPayload(event);
          const data = (payload['data'] as Record<string, unknown> | undefined) ?? {};
          const stage = (data['stage'] as string | undefined) ?? 'unknown';
          const timestamp = (payload['timestamp'] as string | undefined) ?? new Date().toISOString();
          const error = (data['error'] as string | undefined) ?? (payload['error'] as string | undefined);
          stageLog.push({ stage, event: 'failed', timestamp, ...(error ? { error } : {}) });
          this.broadcastPipelineStage(correlationId, pipelineJobId, stage, 'failed').catch(() => {});
        });

        // ── Terminal: pipeline_final carries status='completed'|'failed' ──────────────
        es.addEventListener('pipeline_final', (event) => {
          const payload = extractPayload(event);
          const status = (payload['status'] as string | undefined) ?? 'completed';
          const evaluationId = `eval-${correlationId}-${pipelineJobId}`;

          // executionId (== pipelineJobId) is the correct key for GET /results — it is the
          // Cosmos document id echoed back as jobId in the 202 response.
          // payload['pipelineId'] is Loom's internal idempotency namespace key and must NOT
          // be passed to /results (confirmed by Axiom 2026-04-02).
          this.logger.info('SSE pipeline_final received', {
            pipelineJobId, correlationId, status,
            payloadKeys: Object.keys(payload),
          });

          // Treat 'completed-partial' as a successful terminal state — Axiom uses this when
          // the pipeline finishes but not all optional stages succeeded.  We still attempt
          // to fetch results; if GET /results 409s we fall back to what the stage log has.
          if (status === 'completed' || status === 'completed-partial') {
            const riskScore = payload['riskScore'] as number | undefined;
            // Fire-and-forget: settle the stream immediately; result + log storage runs concurrently
            this.fetchAndStorePipelineResults(correlationId, pipelineJobId, evaluationId, riskScore, stageLog)
              .catch((err) => {
                this.logger.error('SSE pipeline_final: failed to store Axiom results', {
                  pipelineJobId, correlationId, error: (err as Error).message,
                });
                this.broadcastAxiomStatus(correlationId, evaluationId, 'completed', riskScore).catch(() => {});
              });
          } else {
            // Failed — persist the stage log so we know how far it got
            const errorMsg = (payload['error'] as string | undefined) ?? 'Pipeline execution failed';
            this.dbService.getItem<any>(this.containerName, evaluationId)
              .then((r) => {
                const existing = (r.success && r.data) ? r.data : {};
                return this.storeEvaluationRecord({
                  ...existing,
                  id: evaluationId,
                  status: 'failed',
                  error: { code: 'PIPELINE_FAILED', message: errorMsg },
                  ...(stageLog.length > 0 ? { pipelineExecutionLog: stageLog } : {}),
                  timestamp: new Date().toISOString(),
                });
              })
              .catch((err) => {
                this.logger.error('SSE pipeline_final(failed): could not mark record as failed', {
                  evaluationId, error: (err as Error).message,
                });
              });
            this.broadcastAxiomStatus(correlationId, evaluationId, 'failed').catch(() => {});
          }

          es.close();
          settle();
        });

        // Snapshot: full pipeline state at connection time — relay if not already terminal
        es.addEventListener('snapshot', (event) => {
          const payload = extractPayload(event);
          const snapshotStatus = (payload['status'] as string | undefined) ?? 'running';
          if (snapshotStatus !== 'completed' && snapshotStatus !== 'failed') {
            this.broadcastAxiomStatus(correlationId, pipelineJobId, snapshotStatus).catch(() => {});
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
    correlationType: 'ORDER' | 'BULK_JOB' | 'TAPE_LOAN',
    storageKey: string,
    _programId?: string,
  ): Promise<{ pipelineJobId: string; evaluationId: string }> {
    const pipelineJobId = `mock-pipeline-${storageKey}-${Date.now()}`;
    const evaluationId = `mock-eval-${storageKey}-${Date.now()}`;

    this.logger.debug('[MOCK] Axiom pipeline submit', { correlationId, correlationType, pipelineJobId });

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
        this.logger.debug('[MOCK] Pipeline → processing', { pipelineJobId });
        await this.broadcastAxiomStatus(correlationId, evaluationId, 'processing');
      } catch (err) { this.logger.error('[MOCK] Failed transition to processing', { pipelineJobId, error: (err as Error).message }); }
    }, 1000);

    setTimeout(async () => {
      try {
        const completed = correlationType === 'ORDER'
          ? this.buildMockEvaluation(correlationId, evaluationId)
          : { ...pendingRecord, status: 'completed' as const, overallRiskScore: 35, timestamp: new Date().toISOString() };
        await this.storeEvaluationRecord({ id: evaluationId, ...completed });
        this.logger.debug('[MOCK] Pipeline → completed', { pipelineJobId });
        await this.broadcastAxiomStatus(correlationId, evaluationId, 'completed', 35);
      } catch (err) { this.logger.error('[MOCK] Failed transition to completed', { pipelineJobId, error: (err as Error).message }); }
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
    const MAX_RETRIES = 3;
    const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await this.dbService.upsertItem(this.containerName, record);
      if (response.success) return;

      const isLastAttempt = attempt === MAX_RETRIES;
      if (isLastAttempt) {
        const msg = `Failed to store Axiom evaluation after ${MAX_RETRIES} attempts: ${response.error?.message ?? 'unknown'}`;
        this.logger.error('Failed to store Axiom evaluation in Cosmos DB (all retries exhausted)', {
          evaluationId: record.id,
          attempts: MAX_RETRIES,
          error: response.error?.message,
        });
        throw new Error(msg);
      }

      const delay = RETRY_DELAYS_MS[attempt - 1]!;
      this.logger.warn(`storeEvaluationRecord attempt ${attempt} failed, retrying in ${delay}ms`, {
        evaluationId: record.id,
        error: response.error?.message,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Get ALL evaluations for an order (for the order-level list view)
   */
  async getEvaluationsForOrder(orderId: string, tenantId?: string): Promise<AxiomEvaluationResult[]> {
    if (!tenantId) {
      throw new Error(
        `getEvaluationsForOrder: tenantId is required to prevent cross-tenant data access. ` +
        `orderId=${orderId} — ensure req.user.tenantId is populated by the auth middleware.`,
      );
    }

    const results: AxiomEvaluationResult[] = [];

    // Source 1: Evaluation records (excludes run-ledger-entry and qc-issue docs to avoid duplicates)
    try {
      const query = `SELECT TOP 50 * FROM c WHERE c.tenantId = @tenantId AND c.orderId = @orderId AND (NOT IS_DEFINED(c.type) OR (c.type != 'run-ledger-entry' AND c.type != 'qc-issue')) ORDER BY c.timestamp DESC`;
      const params = [{ name: '@orderId', value: orderId }, { name: '@tenantId', value: tenantId }];
      const response = await this.dbService.queryItems<AxiomEvaluationResult>(
        this.containerName,
        query,
        params
      );

      if (response.success && response.data) {
        for (const evaluation of response.data) {
          const meta = (evaluation as any)._metadata ?? {};
          results.push({
            ...evaluation,
            criteria: this.enrichCriteriaRefs(evaluation.criteria, meta),
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to retrieve aiInsights evaluations', {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Source 2: Run Ledger records (same container, different doc type)
    try {
      const runQuerySimple = `SELECT TOP 50 * FROM c WHERE c.tenantId = @tenantId AND c.type = 'run-ledger-entry' AND c.loanPropertyContextId = @orderId ORDER BY c.createdAt DESC`;
      const runParams = [{ name: '@tenantId', value: tenantId }, { name: '@orderId', value: orderId }];
      const runResponse = await this.dbService.queryItems<Record<string, unknown>>(
        this.containerName,
        runQuerySimple,
        runParams
      );

      if (runResponse.success && runResponse.data) {
        for (const run of runResponse.data) {
          const status = run['status'] as string;
          const mapped: AxiomEvaluationResult = {
            orderId,
            evaluationId: run['id'] as string,
            pipelineJobId: (run['engineRunRef'] as string) || undefined,
            tenantId,
            clientId: (run['schemaKey'] as any)?.clientId ?? (run['programKey'] as any)?.clientId,
            programId: (run['programKey'] as any)?.programId,
            programVersion: (run['programKey'] as any)?.version,
            documentType: (run['schemaKey'] as any)?.documentType ?? 'appraisal',
            status: status === 'queued' ? 'pending'
              : status === 'running' ? 'processing'
              : status === 'completed' ? 'completed'
              : status === 'failed' ? 'failed'
              : 'pending',
            criteria: [],
            overallRiskScore: 0,
            timestamp: run['createdAt'] as string,
            processingTime: 0,
            ...(status === 'failed' ? { error: { code: 'PIPELINE_FAILED', message: (run['statusDetails'] as any)?.error ?? 'Pipeline execution failed' } } : {}),
            _source: 'run-ledger',
            _runType: run['runType'],
            _pipelineId: run['pipelineId'],
          } as unknown as AxiomEvaluationResult;
          results.push(mapped);
        }
      }
    } catch (error) {
      this.logger.error('Failed to retrieve run-ledger evaluations', {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  /**
   * Get evaluation from Cosmos DB cache
   */
  private async getEvaluationFromCache(orderId: string, tenantId: string): Promise<AxiomEvaluationResult | null> {
    try {
      const query = `SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.timestamp DESC`;
      const response = await this.dbService.queryItems<AxiomEvaluationResult>(
        this.containerName,
        query,
        [{ name: '@orderId', value: orderId }, { name: '@tenantId', value: tenantId }]
      );

      if (response.success && response.data && response.data.length > 0) {
        return response.data[0] || null;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to retrieve evaluation from cache', {
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

  /**
   * Task 4.4: The Agentic Exception 
   * Synchronous /api/agent/run proxy.
   * P2-E: Returns a mock response when not in live mode instead of throwing.
   */
  public async runAgent(prompt: string, context?: Record<string, unknown>, maxIterations?: number): Promise<any> {
    if (!this.enabled) {
      this.logger.debug('[MOCK] Axiom not configured — returning mock agent response', { promptPreview: prompt.slice(0, 80) });
      return {
        response: `Mock agent response for: ${prompt.slice(0, 120)}`,
        confidence: 0.75,
        sources: [],
        iterations: 1,
        status: 'completed',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await this.client.post('/api/agent/run', {
        goal: prompt,
        context: context,
        options: { maxIterations: maxIterations || 10 }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to run agent', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  // ── P2-B: Get document comparison by ID ─────────────────────────────────────

  /**
   * Retrieve a previously-submitted document comparison by its ID.
   * Returns null on 404; re-throws all other Axiom errors.
   */
  async getComparison(comparisonId: string): Promise<any | null> {
    if (!this.enabled) {
      this.logger.debug('[MOCK] Axiom not configured — returning mock comparison', { comparisonId });
      return {
        comparisonId,
        status: 'completed',
        changes: [],
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await this.dbService.getItem<any>(this.containerName, comparisonId);
      if (!response.success || !response.data || response.data.type !== 'document-comparison') {
        return null;
      }
      return response.data;
    } catch (error) {
      this.logger.error('Failed to retrieve stored comparison', {
        comparisonId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async runSingleDocumentComparisonExtraction(
    orderId: string,
    tenantId: string,
    clientId: string,
    subClientId: string,
    documentUrl: string,
    label: 'original' | 'revised',
  ): Promise<Record<string, unknown>> {
    const pipelineId = AxiomService.DEFAULT_PIPELINE_IDS['EXTRACTION_ONLY']!;
    const requiredDocumentTypes = process.env['AXIOM_REQUIRED_DOCUMENT_TYPES']
      ? process.env['AXIOM_REQUIRED_DOCUMENT_TYPES'].split(',').map((t: string) => t.trim())
      : ['appraisal-report'];

    const submission = await this.client.post<{ jobId: string }>('/api/pipelines', {
      pipelineId,
      input: {
        subClientId,
        clientId,
        fileSetId: `cmp-${orderId}-${label}-${Date.now().toString(36)}`,
        files: [{
          fileName: `${label}-${orderId}.pdf`,
          url: documentUrl,
          mediaType: 'application/pdf',
          downloadMethod: 'fetch' as const,
        }],
        requiredDocuments: requiredDocumentTypes,
        correlationId: `${orderId}:comparison:${label}`,
        correlationType: 'ORDER',
      },
    });

    const pipelineJobId = submission.data.jobId;
    const MAX_ATTEMPTS = 25;
    const INTERVAL_MS = 3000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const results = await this.fetchPipelineResults(pipelineJobId);
      if (results) {
        return results;
      }

      this.logger.info('Comparison extraction still pending', {
        orderId,
        label,
        pipelineJobId,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
    }

    throw new Error(
      `Comparison extraction for ${label} document did not complete within ${MAX_ATTEMPTS} attempts. orderId=${orderId} pipelineJobId=${pipelineJobId}`,
    );
  }

  private extractComparablePayload(raw: Record<string, unknown>): Record<string, unknown> {
    const resultRoot = (raw['results'] as Record<string, unknown> | undefined) ?? raw;
    const extraction = resultRoot['extractStructuredData'];
    const extractedData = resultRoot['extractedData'];

    if (Array.isArray(extraction)) {
      return { extractStructuredData: extraction };
    }
    if (extractedData && typeof extractedData === 'object') {
      return extractedData as Record<string, unknown>;
    }
    return resultRoot;
  }

  private buildComparisonChanges(
    originalPayload: Record<string, unknown>,
    revisedPayload: Record<string, unknown>,
  ): Array<{
    section: string;
    changeType: 'added' | 'removed' | 'modified';
    original?: string;
    revised?: string;
    significance: 'minor' | 'moderate' | 'major';
  }> {
    const originalFlat = new Map<string, unknown>();
    const revisedFlat = new Map<string, unknown>();

    this.flattenComparisonValues(originalPayload, '', originalFlat);
    this.flattenComparisonValues(revisedPayload, '', revisedFlat);

    const allPaths = Array.from(new Set([...originalFlat.keys(), ...revisedFlat.keys()])).sort();
    const changes: Array<{
      section: string;
      changeType: 'added' | 'removed' | 'modified';
      original?: string;
      revised?: string;
      significance: 'minor' | 'moderate' | 'major';
    }> = [];

    for (const path of allPaths) {
      const originalValue = originalFlat.get(path);
      const revisedValue = revisedFlat.get(path);

      if (JSON.stringify(originalValue) === JSON.stringify(revisedValue)) {
        continue;
      }

      const changeType = originalValue === undefined
        ? 'added'
        : revisedValue === undefined
          ? 'removed'
          : 'modified';

      changes.push({
        section: this.humanizeComparisonPath(path),
        changeType,
        ...(originalValue !== undefined ? { original: this.formatComparisonValue(originalValue) } : {}),
        ...(revisedValue !== undefined ? { revised: this.formatComparisonValue(revisedValue) } : {}),
        significance: this.classifyComparisonSignificance(originalValue, revisedValue),
      });

      if (changes.length >= 25) {
        break;
      }
    }

    if (changes.length === 0) {
      changes.push({
        section: 'Document Payload',
        changeType: 'modified',
        original: this.formatComparisonValue(originalPayload),
        revised: this.formatComparisonValue(revisedPayload),
        significance: 'minor',
      });
    }

    return changes;
  }

  private flattenComparisonValues(value: unknown, path: string, out: Map<string, unknown>, depth = 0): void {
    if (depth > 4) {
      out.set(path || 'root', value);
      return;
    }

    if (value === null || value === undefined) {
      out.set(path || 'root', value);
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        out.set(path || 'root', []);
        return;
      }

      value.slice(0, 5).forEach((item, index) => {
        this.flattenComparisonValues(item, path ? `${path}[${index}]` : `[${index}]`, out, depth + 1);
      });
      return;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        out.set(path || 'root', {});
        return;
      }

      entries.slice(0, 20).forEach(([key, child]) => {
        this.flattenComparisonValues(child, path ? `${path}.${key}` : key, out, depth + 1);
      });
      return;
    }

    out.set(path || 'root', value);
  }

  private humanizeComparisonPath(path: string): string {
    const normalized = path.replace(/\[(\d+)\]/g, ' › item $1');
    return normalized
      .split('.')
      .map((segment) => segment.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))
      .join(' › ');
  }

  private formatComparisonValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private classifyComparisonSignificance(
    originalValue: unknown,
    revisedValue: unknown,
  ): 'minor' | 'moderate' | 'major' {
    if (typeof originalValue === 'number' && typeof revisedValue === 'number') {
      const delta = Math.abs(revisedValue - originalValue);
      const base = Math.max(Math.abs(originalValue), 1);
      const ratio = delta / base;
      if (ratio >= 0.1) return 'major';
      if (ratio >= 0.02) return 'moderate';
      return 'minor';
    }

    const originalText = this.formatComparisonValue(originalValue);
    const revisedText = this.formatComparisonValue(revisedValue);
    const lengthDelta = Math.abs(revisedText.length - originalText.length);
    if (lengthDelta > 120) return 'major';
    if (lengthDelta > 40) return 'moderate';
    return 'minor';
  }

  // ── P2-C: Property enrichment ───────────────────────────────────────────────

  /** Submit a property enrichment pipeline and store the pending record. */
  async enrichProperty(
    propertyInfo: Record<string, unknown>,
    orderId: string,
    tenantId: string,
    clientId: string,
  ): Promise<{ enrichmentId: string; status: 'queued' }> {
    const address = this.normalizePropertyEnrichmentAddress(propertyInfo);
    const enrichment = await this.getPropertyEnrichmentService().enrichOrder(orderId, tenantId, address);

    this.logger.info('Completed property enrichment via PropertyEnrichmentService', {
      orderId,
      tenantId,
      clientId,
      enrichmentId: enrichment.enrichmentId,
      propertyId: enrichment.propertyId,
      status: enrichment.status,
    });

    return { enrichmentId: enrichment.enrichmentId, status: 'queued' };
  }

  /** Retrieve the most recent property enrichment record for an order. */
  async getPropertyEnrichment(orderId: string, tenantId: string): Promise<any | null> {
    return this.getPropertyEnrichmentService().getLatestEnrichment(orderId, tenantId);
  }

  // ── P2-D: Complexity scoring ─────────────────────────────────────────────────

  /**
   * Calculate and store a complexity/risk score for an order.
   * Synchronous — calls Axiom and stores result immediately.
   */
  async calculateComplexityScore(
    propertyInfo: Record<string, unknown>,
    orderId: string,
    tenantId: string,
    clientId: string,
  ): Promise<{ complexityScore: number; drivers: string[]; riskFactors: string[] }> {
    if (!this.enabled) {
      this.logger.debug('[MOCK] Axiom not configured — returning mock complexity score', { orderId });
      const mock = { complexityScore: 42, drivers: ['mock-driver-1'], riskFactors: ['mock-risk-1'] };
      await this.storeEvaluationRecord({
        id: `complexity-${orderId}`,
        type: 'complexity-score',
        orderId,
        tenantId,
        clientId,
        ...mock,
        timestamp: new Date().toISOString(),
      });
      return mock;
    }

    let result: { complexityScore: number; drivers: string[]; riskFactors: string[] };
    try {
      const response = await this.client.post('/api/scoring/complexity', { propertyInfo, tenantId, clientId });
      result = response.data as typeof result;
    } catch (error) {
      this.logger.error('Failed to calculate Axiom complexity score', {
        orderId, error: (error as Error).message,
      });
      throw error;
    }

    await this.storeEvaluationRecord({
      id: `complexity-${orderId}`,
      type: 'complexity-score',
      orderId,
      tenantId,
      clientId,
      ...result,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /** Retrieve a stored complexity score for an order. */
  async getComplexityScore(orderId: string, tenantId: string): Promise<any | null> {
    if (!tenantId) {
      throw new Error(`getComplexityScore: tenantId is required. orderId=${orderId}`);
    }
    const query = `SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId AND c.type = 'complexity-score' ORDER BY c.timestamp DESC OFFSET 0 LIMIT 1`;
    const response = await this.dbService.queryItems<any>(this.containerName, query, [
      { name: '@orderId', value: orderId },
      { name: '@tenantId', value: tenantId },
    ]);
    if (!response.success || !response.data || response.data.length === 0) return null;
    return response.data[0];
  }
}
