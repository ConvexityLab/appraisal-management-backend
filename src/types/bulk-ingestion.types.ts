import type { BulkAnalysisType } from './bulk-portfolio.types.js';

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

export type BulkIngestionMode = 'MULTIPART' | 'SHARED_STORAGE';

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
  propertyAddress?: string;
  documentFileName?: string;
}

export interface BulkIngestionSubmitRequest {
  clientId: string;
  jobName?: string;
  analysisType: BulkAnalysisType;
  ingestionMode: BulkIngestionMode;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkIngestionJob {
  id: string;
  type: 'bulk-ingestion-job';
  tenantId: string;
  clientId: string;
  jobName?: string;
  analysisType: BulkAnalysisType;
  ingestionMode: BulkIngestionMode;
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
  canonicalData: Record<string, unknown>;
  sourceData: {
    loanNumber?: string;
    externalId?: string;
    propertyAddress?: string;
    documentFileName?: string;
  };
  documentBlobName?: string;
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
