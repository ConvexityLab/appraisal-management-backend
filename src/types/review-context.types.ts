import type { Order } from './index.js';
import type { DocumentMetadata } from './document.types.js';
import type { IntakeSourceIdentity } from './intake-source.types.js';
import type { ReviewProgram } from './review-tape.types.js';
import type { RunLedgerRecord } from './run-ledger.types.js';

export type ReviewReadinessState =
  | 'ready'
  | 'ready_with_warnings'
  | 'partially_ready'
  | 'requires_extraction'
  | 'requires_documents'
  | 'requires_comp_selection'
  | 'requires_manual_resolution'
  | 'blocked_by_configuration'
  | 'blocked_by_data_integrity'
  | 'not_runnable';

export type ReviewRecommendedAction =
  | 'run_extraction'
  | 'upload_required_documents'
  | 'select_comps'
  | 'resolve_source_conflict'
  | 'configure_sub_client'
  | 'update_review_program_mapping'
  | 'contact_admin';

export interface ReviewEvidenceRef {
  sourceType:
    | 'order'
    | 'document'
    | 'document-extraction'
    | 'property-enrichment'
    | 'run-ledger'
    | 'report'
    | 'report-comp'
    | 'report-adjustment';
  sourceId: string;
  fieldPath?: string;
  sourceRunId?: string;
}

export interface ReviewContextReportSummary {
  reportId: string;
  reportType?: string;
  status?: string;
  schemaVersion?: string;
  updatedAt?: string;
  subjectPresent: boolean;
  totalComps: number;
  selectedCompCount: number;
  adjustedCompCount: number;
}

export interface ReviewContextCompSummary {
  totalComps: number;
  selectedCompCount: number;
  candidateCompCount: number;
  adjustedCompCount: number;
  selectedCompIds: string[];
  compIdsWithAdjustments: string[];
  hasCompSelection: boolean;
  hasAdjustments: boolean;
}

export interface ReviewContextAdjustmentSummary {
  adjustedCompCount: number;
  averageNetAdjustmentPct?: number;
  maxNetAdjustmentPct?: number;
  averageGrossAdjustmentPct?: number;
  maxGrossAdjustmentPct?: number;
}

export interface ReviewContextDocumentSummary {
  id: string;
  name: string;
  orderId?: string;
  category?: string;
  documentType?: string;
  extractionStatus?: DocumentMetadata['extractionStatus'];
  uploadedAt?: string;
  originEntityType?: DocumentMetadata['entityType'];
  originEntityId?: DocumentMetadata['entityId'];
  orderLinkedAt?: string;
  orderLinkedBy?: string;
}

export interface ReviewContextEnrichmentSummary {
  id: string;
  status?: string;
  createdAt?: string;
  hasDataResult: boolean;
}

export interface ReviewContextSnapshotSummary {
  id: string;
  createdAt: string;
  refreshedAt?: string;
  hasNormalizedData: boolean;
  sourceIdentity?: IntakeSourceIdentity;
  availableDataPaths: string[];
  availableDataPathsBySource: {
    subjectProperty: string[];
    extraction: string[];
    /** Paths under the AMP canonical (UAD-aligned) projection of extraction data. */
    canonical: string[];
    providerData: string[];
    provenance: string[];
  };
}

export interface ReviewContextRunSummary {
  totalRuns: number;
  extractionRuns: number;
  criteriaRuns: number;
  latestSnapshotId?: string;
}

export interface ReviewContext {
  identity: {
    orderId: string;
    tenantId: string;
    engagementId?: string;
    clientId?: string;
    subClientId?: string;
    sourceIdentity?: IntakeSourceIdentity;
  };
  order: Order;
  canonicalData?: {
    subjectProperty?: Record<string, unknown>;
    extraction?: Record<string, unknown>;
    /** AMP canonical-schema (UAD-aligned) projection of extraction data. */
    canonical?: Record<string, unknown>;
    providerData?: Record<string, unknown>;
    provenance?: Record<string, unknown>;
  };
  reviewPrograms: ReviewProgram[];
  documents: ReviewContextDocumentSummary[];
  latestEnrichment?: ReviewContextEnrichmentSummary;
  latestSnapshot?: ReviewContextSnapshotSummary;
  latestReport?: ReviewContextReportSummary;
  compSummary?: ReviewContextCompSummary;
  adjustmentSummary?: ReviewContextAdjustmentSummary;
  runs: RunLedgerRecord[];
  runSummary: ReviewContextRunSummary;
  evidenceRefs: ReviewEvidenceRef[];
  warnings: string[];
  assembledAt: string;
  assembledBy: string;
  contextVersion: string;
}
