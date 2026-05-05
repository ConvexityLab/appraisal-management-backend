import type { BulkAnalysisType } from './bulk-portfolio.types.js';
import type { IntakeSourceIdentity } from './intake-source.types.js';

export type BulkIngestionJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type BulkIngestionItemStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type BulkIngestionMode = 'MULTIPART' | 'SHARED_STORAGE' | 'TAPE_CONVERSION';

export type BulkIngestionEngagementGranularity = 'PER_BATCH' | 'PER_LOAN';

export interface BulkIngestionSharedStorageRef {
  storageAccountName: string;
  containerName: string;
  dataFileBlobName: string;
  documentBlobNames: string[];
  pathPrefix?: string;
}

export interface BulkIngestionItemInput {
  rowIndex?: number;
  loanNumber?: string;
  externalId?: string;
  /**
   * Raw normalized spreadsheet columns captured during CSV/XLSX parsing.
   * Keys are lower-cased alphanumeric header names (same normalization as parser).
   * Preserved so adapter-specific field mappings can resolve custom columns later.
   */
  rawColumns?: Record<string, string>;

  // Property location — used to supplement or replace comma-delimited propertyAddress parsing
  propertyAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  county?: string;

  // Borrower / loan information — populated from spreadsheet columns when present
  borrowerName?: string;
  borrowerEmail?: string;
  borrowerPhone?: string;
  loanAmount?: number;
  loanType?: string;
  loanPurpose?: string;
  occupancyType?: string;

  // Document correlation
  documentFileName?: string;
  /** Multi-doc: explicit list of PDFs to associate with this row (T3.3). Mutually exclusive with documentFileName. */
  documentFileNames?: string[];
  documentUrl?: string;
}

export interface BulkIngestionSubmitRequest {
  clientId: string;
  subClientId?: string;
  jobName?: string;
  analysisType: BulkAnalysisType;
  ingestionMode: BulkIngestionMode;
  engagementGranularity?: BulkIngestionEngagementGranularity;
  dataFileName: string;
  documentFileNames: string[];
  adapterKey: string;
  items: BulkIngestionItemInput[];
  dataFileBlobUrl?: string;
  dataFileBlobName?: string;
  documentBlobMap?: Record<string, string>;
  sharedStorage?: BulkIngestionSharedStorageRef;
}

export interface BulkIngestionFailure {
  code: string;
  stage: string;
  message: string;
  retryable: boolean;
  occurredAt: string;
}

export interface BulkIngestionItem {
  id: string;
  jobId?: string;
  tenantId?: string;
  clientId?: string;
  rowIndex: number;
  correlationKey: string;
  status: BulkIngestionItemStatus;
  source: BulkIngestionItemInput;
  canonicalRecord?: Record<string, unknown>;
  matchedDocumentFileNames: string[];
  failures: BulkIngestionFailure[];
  /** Per-item criteria outcome persisted by the criteria stage. */
  criteriaStatus?: 'PASSED' | 'FAILED' | 'REVIEW';
  /** Set by criteria evaluation stage. */
  criteriaDecision?: 'PASSED' | 'FAILED' | 'REVIEW';
  sourceIdentity?: IntakeSourceIdentity;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkIngestionJob {
  id: string;
  type: 'bulk-ingestion-job';
  tenantId: string;
  clientId: string;
  subClientId?: string;
  jobName?: string;
  analysisType: BulkAnalysisType;
  ingestionMode: BulkIngestionMode;
  engagementGranularity: BulkIngestionEngagementGranularity;
  status: BulkIngestionJobStatus;
  adapterKey: string;
  dataFileName: string;
  dataFileBlobUrl?: string;
  dataFileBlobName?: string;
  documentFileNames: string[];
  documentBlobMap?: Record<string, string>;
  sharedStorage?: BulkIngestionSharedStorageRef;
  submittedBy: string;
  submittedAt: string;
  completedAt?: string;
  totalItems: number;
  successItems: number;
  failedItems: number;
  pendingItems: number;
  lastError?: string;
  sourceIdentity?: IntakeSourceIdentity;
  items: BulkIngestionItem[];
}

export interface BulkIngestionCanonicalFailure {
  itemId: string;
  rowIndex: number;
  code: string;
  message: string;
  stage?: string;
  severity?: 'warning' | 'error';
  diagnostics?: Record<string, unknown>;
}

export interface BulkIngestionManualReviewItem {
  id: string;
  type: 'bulk-ingestion-manual-review-item';
  tenantId: string;
  clientId: string;
  jobId: string;
  itemId: string;
  rowIndex: number;
  adapterKey: string;
  status: 'QUEUED' | 'RESOLVED';
  reasonCode: 'DOCUMENT_NOT_FOUND' | 'DOCUMENT_ASSOCIATION_AMBIGUOUS';
  reason: string;
  requestedDocumentFileName?: string;
  candidateDocumentBlobNames: string[];
  createdAt: string;
  createdBy: string;
}

export interface BulkIngestionCanonicalRecord {
  id: string;
  type: 'bulk-ingestion-canonical-record';
  tenantId: string;
  clientId: string;
  jobId: string;
  itemId: string;
  rowIndex: number;
  adapterKey: string;
  sourceIdentity?: IntakeSourceIdentity;
  /**
   * @deprecated Slice 8j: legacy adapter-specific flat dictionary populated
   * by `BulkAdapterDefinition.canonicalFieldMappings`. Read `canonicalDocument`
   * instead — same data in the canonical-schema shape. The order-creation
   * worker still writes back order-completion metadata (orderId, orderNumber,
   * engagementId) here for back-compat; that responsibility moves to a
   * dedicated `lifecycleMetadata` field in slice 8k along with final removal
   * of this field.
   */
  canonicalData: Record<string, unknown>;
  /**
   * Projection of the source row onto AMP's CanonicalReportDocument
   * (UAD 3.6 / URAR / MISMO 3.4 aligned). Populated by
   * `mapBulkIngestionSourceToCanonical` in the canonical-worker stage so
   * downstream consumers (criteria, dispatch, snapshot) can read the row
   * via canonical paths (e.g. `subject.address.streetAddress`,
   * `loan.baseLoanAmount`) instead of the adapter-specific flat
   * `canonicalData` shape. Slice 8j: this is the CANONICAL form going
   * forward; `canonicalData` is deprecated.
   */
  canonicalDocument?: Partial<import('./canonical-schema.js').CanonicalReportDocument>;
  sourceData: {
    loanNumber?: string;
    externalId?: string;
    propertyAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    propertyType?: string;
    county?: string;
    borrowerName?: string;
    borrowerEmail?: string;
    borrowerPhone?: string;
    loanAmount?: number;
    loanType?: string;
    loanPurpose?: string;
    occupancyType?: string;
    documentFileName?: string;
    /** Set when item specified documentFileNames[]. */
    documentFileNames?: string[];
    documentUrl?: string;
  };
  documentBlobName?: string;
  /** All resolved blob names when item specified documentFileNames[]. First entry mirrors documentBlobName for backward compat. */
  documentBlobNames?: string[];
  persistedAt: string;
}

export interface BulkIngestionCanonicalizationSummary {
  id: string;
  type: 'bulk-ingestion-canonicalization-summary';
  tenantId: string;
  clientId: string;
  jobId: string;
  adapterKey: string;
  totalCandidateItems: number;
  persistedCount: number;
  failedCount: number;
  failures: BulkIngestionCanonicalFailure[];
  processedAt: string;
}

export interface BulkIngestionCanonicalizationResult {
  summary: BulkIngestionCanonicalizationSummary | null;
  records: BulkIngestionCanonicalRecord[];
}

// ---------------------------------------------------------------------------
// Criteria evaluation types
// ---------------------------------------------------------------------------

export type BulkIngestionCriteriaOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'in';

/**
 * A single rule evaluated against the item's canonicalRecord fields.
 * `field` is a dot-separated path into canonicalRecord (e.g. "sourceData.loanAmount").
 * When the rule fails, `failDecision` controls whether the item is FAILED or flagged REVIEW.
 */
export interface BulkIngestionCriteriaRule {
  field: string;
  operator: BulkIngestionCriteriaOperator;
  value?: unknown; // for eq/neq/gt/gte/lt/lte
  values?: unknown[]; // for 'in'
  /** Decision to record when this rule fails. Defaults to 'FAILED'. */
  failDecision?: 'FAILED' | 'REVIEW';
  description?: string;
}

/**
 * Stored in Cosmos 'bulk-portfolio-jobs' container with type='bulk-ingestion-criteria-config'.
 * Scoped to a tenant (and optionally a clientId).
 * When no config exists for a tenant, all items auto-PASSED.
 */
export interface BulkIngestionCriteriaConfig {
  id: string;
  type: 'bulk-ingestion-criteria-config';
  tenantId: string;
  clientId?: string;
  rules: BulkIngestionCriteriaRule[];
  /** Decision to record when all rules pass. */
  defaultDecision: 'PASSED' | 'REVIEW';
  createdAt: string;
  updatedAt: string;
}

export interface BulkIngestionAdapterEngagementFieldMapping {
  borrowerName?: string;
  loanAmount?: string;
  email?: string;
  phone?: string;
}

export type BulkAdapterDefinitionMatchMode = 'EXACT' | 'PREFIX';

export type BulkAdapterDefinitionValueSource =
  | 'job.adapterKey'
  | 'job.analysisType'
  | 'job.dataFileBlobName'
  | 'item.id'
  | 'item.rowIndex'
  | 'item.correlationKey'
  | 'item.source.loanNumber'
  | 'item.source.externalId'
  | 'item.source.propertyAddress'
  | 'item.source.city'
  | 'item.source.state'
  | 'item.source.zipCode'
  | 'item.source.propertyType'
  | 'item.source.county'
  | 'item.source.borrowerName'
  | 'item.source.borrowerEmail'
  | 'item.source.borrowerPhone'
  | 'item.source.loanAmount'
  | 'item.source.loanType'
  | 'item.source.loanPurpose'
  | 'item.source.occupancyType'
  | 'item.source.documentFileName'
  | 'item.source.documentUrl';

export interface BulkAdapterDefinitionFieldRequirement {
  source: BulkAdapterDefinitionValueSource;
  code: string;
  messageTemplate: string;
  trim?: boolean;
}

export interface BulkAdapterDefinitionAnyOfRequirement {
  sources: BulkAdapterDefinitionValueSource[];
  code: string;
  messageTemplate: string;
  trim?: boolean;
}

export interface BulkAdapterDefinitionDocumentRequirement {
  required: boolean;
  code: string;
  messageTemplate: string;
}

export interface BulkAdapterDefinitionCanonicalFieldMapping {
  targetField: string;
  source: BulkAdapterDefinitionValueSource;
  trim?: boolean;
}

export interface BulkAdapterDefinition {
  id: string;
  type: 'bulk-adapter-definition';
  tenantId: string;
  adapterKey: string;
  name: string;
  description?: string;
  matchMode: BulkAdapterDefinitionMatchMode;
  sourceAdapter: string;
  documentRequirement?: BulkAdapterDefinitionDocumentRequirement;
  requiredFields?: BulkAdapterDefinitionFieldRequirement[];
  requiredAnyOf?: BulkAdapterDefinitionAnyOfRequirement[];
  canonicalFieldMappings: BulkAdapterDefinitionCanonicalFieldMapping[];
  staticCanonicalData?: Record<string, unknown>;
  notes?: string[];
  isBuiltIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BulkIngestionAdapterConfig {
  id: string;
  type: 'bulk-ingestion-adapter-config';
  tenantId: string;
  adapterKey: string;
  engagementFieldMapping?: BulkIngestionAdapterEngagementFieldMapping;
  createdAt: string;
  updatedAt: string;
}
