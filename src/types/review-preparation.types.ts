import type {
  ReviewReadinessState,
  ReviewRecommendedAction,
  ReviewContext,
} from './review-context.types.js';

// `canonical` = AMP canonical-schema (UAD 3.6 / URAR / MISMO 3.4) projection of
// extraction data. Authoritative source for review-program criteria.
export type PreparedInputSourceType = 'canonical' | 'order' | 'subjectProperty' | 'extraction' | 'providerData' | 'provenance';

export interface PreparedResolvedBindingSummary {
  requirementPath: string;
  resolvedPath: string;
}

export interface PreparedUnmetRequiredInput {
  criterionId: string;
  criterionTitle: string;
  inputType: 'data' | 'document';
  requirement: string;
  blockingReason?: string;
  recommendedAction?: ReviewRecommendedAction;
}

export interface PreparedDispatchCriteriaSummary {
  totalCriteria: number;
  readyCriteriaCount: number;
  warningCriteriaCount: number;
  blockedCriteriaCount: number;
  criteriaWithUnmetRequiredInputsCount: number;
}

export interface PreparedDispatchProvenanceSummary {
  sourceTypesUsed: PreparedInputSourceType[];
  resolvedBindingsBySource: Record<PreparedInputSourceType, PreparedResolvedBindingSummary[]>;
  matchedDocumentIds: string[];
  matchedDocumentTypes: string[];
  evidenceSourceTypes: ReviewContext['evidenceRefs'][number]['sourceType'][];
  snapshotLinked: boolean;
  snapshotId?: string;
}

export interface PrepareReviewProgramsRequest {
  orderId: string;
  reviewProgramIds: string[];
  engagementId?: string;
  clientId?: string;
  subClientId?: string;
  options?: {
    includeCompContext?: boolean;
    includeDocumentInventory?: boolean;
    attemptAutoResolveDerivedFields?: boolean;
    attemptAutoPlanExtraction?: boolean;
  };
}

export interface CriterionResolution {
  criterionId: string;
  criterionTitle: string;
  engine: 'AXIOM' | 'MOP_PRIO';
  engineProgramId?: string;
  engineProgramVersion?: string;
  readiness: ReviewReadinessState;
  blockingReason?: string;
  recommendedAction?: ReviewRecommendedAction;
  resolvedDataBindings: Array<{
    requirementPath: string;
    resolvedPath: string;
    sourceType: PreparedInputSourceType;
    competingMatches?: Array<{
      resolvedPath: string;
      sourceType: PreparedInputSourceType;
    }>;
  }>;
  requiredDataPaths: string[];
  missingDataPaths: string[];
  resolvedDocumentTypes: string[];
  requiredDocumentTypes: string[];
  missingDocumentTypes: string[];
  warnings: string[];
}

export interface ProgramReadiness {
  reviewProgramId: string;
  reviewProgramName: string;
  reviewProgramVersion: string;
  readiness: ReviewReadinessState;
  canDispatch: boolean;
  axiomRefCount: number;
  mopRefCount: number;
  blockers: string[];
  warnings: string[];
  recommendedActions: ReviewRecommendedAction[];
  criterionResolutions: CriterionResolution[];
}

export interface PreparedDocumentInventoryItem {
  documentId: string;
  name?: string;
  orderId?: string;
  documentType?: string;
  category?: string;
  extractionStatus?: string;
  originEntityType?: string;
  originEntityId?: string;
  orderLinkedAt?: string;
  orderLinkedBy?: string;
}

export interface PreparedCriterionDispatchInput {
  criterionId: string;
  criterionTitle: string;
  readiness: ReviewReadinessState;
  resolvedDataBindings: CriterionResolution['resolvedDataBindings'];
  requiredDataPaths: string[];
  missingDataPaths: string[];
  resolvedDocumentTypes: string[];
  requiredDocumentTypes: string[];
  missingDocumentTypes: string[];
  resolvedDataValues: Array<{
    requirementPath: string;
    resolvedPath: string;
    sourceType: PreparedInputSourceType;
    value: unknown;
  }>;
  matchedDocuments: PreparedDocumentInventoryItem[];
  unmetRequiredInputs?: PreparedUnmetRequiredInput[];
  warnings: string[];
}

export interface AxiomPreparedPayload {
  contractType: 'axiom-review-dispatch';
  contractVersion: '1.0';
  dispatchMode: 'prepared-context';
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  tenantId: string;
  reviewProgramId: string;
  reviewProgramVersion: string;
  engineProgramId: string;
  engineProgramVersion: string;
  snapshotId?: string;
  programKey?: {
    clientId: string;
    subClientId: string;
    programId: string;
    version: string;
  };
  criteria: PreparedCriterionDispatchInput[];
  unmetRequiredInputs?: PreparedUnmetRequiredInput[];
  criteriaSummary?: PreparedDispatchCriteriaSummary;
  provenanceSummary?: PreparedDispatchProvenanceSummary;
  documentInventory: PreparedDocumentInventoryItem[];
  evidenceRefs: ReviewContext['evidenceRefs'];
}

export interface MopPrioPreparedPayload {
  contractType: 'mop-prio-review-dispatch';
  contractVersion: '1.0';
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  tenantId: string;
  reviewProgramId: string;
  reviewProgramVersion: string;
  engineProgramId: string;
  engineProgramVersion: string;
  snapshotId?: string;
  programKey?: {
    clientId: string;
    subClientId: string;
    programId: string;
    version: string;
  };
  dispatchMode: 'prepared-context';
  criteria: PreparedCriterionDispatchInput[];
  unmetRequiredInputs?: PreparedUnmetRequiredInput[];
  criteriaSummary?: PreparedDispatchCriteriaSummary;
  provenanceSummary?: PreparedDispatchProvenanceSummary;
  documentInventory: PreparedDocumentInventoryItem[];
  evidenceRefs: ReviewContext['evidenceRefs'];
}

export interface PreparedEngineDispatch {
  id: string;
  reviewProgramId: string;
  reviewProgramVersion: string;
  engine: 'AXIOM' | 'MOP_PRIO';
  engineProgramId: string;
  engineProgramVersion: string;
  payloadContractType: AxiomPreparedPayload['contractType'] | MopPrioPreparedPayload['contractType'];
  payloadContractVersion: '1.0';
  payloadRef: string;
  canDispatch: boolean;
  blockedReasons: string[];
  payload: AxiomPreparedPayload | MopPrioPreparedPayload;
}

export interface PrepareReviewProgramsResponse {
  preparedContextId?: string;
  preparedContextVersion?: string;
  orderId: string;
  engagementId?: string;
  preparedAt: string;
  contextSummary: {
    clientId?: string;
    subClientId?: string;
    documentCount: number;
    hasDocuments: boolean;
    hasEnrichment: boolean;
    extractionRunCount: number;
    criteriaRunCount: number;
    latestSnapshotId?: string;
    reviewProgramsRequested: number;
    reviewProgramsResolved: number;
  };
  programs: ProgramReadiness[];
  warnings: string[];
  recommendedActions: ReviewRecommendedAction[];
  plannedEngineDispatches?: PreparedEngineDispatch[];
  context: ReviewContext;
}

export interface PreparedReviewContextArtifact extends PrepareReviewProgramsResponse {
  id: string;
  type: 'review-program-prepared-context';
  tenantId: string;
  createdAt: string;
  createdBy: string;
  preparedContextId: string;
  preparedContextVersion: string;
  plannedEngineDispatches: PreparedEngineDispatch[];
}

export interface PreparedReviewContextListItem {
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  createdAt: string;
  createdBy: string;
  preparedAt: string;
  reviewProgramCount: number;
  dispatchCount: number;
  warningCount: number;
  recommendedActionCount: number;
  readyProgramCount: number;
  blockedProgramCount: number;
  latestSnapshotId?: string;
}

export interface DispatchPreparedReviewProgramsRequest {
  preparedContextId: string;
  reviewProgramIds: string[];
  dispatchMode?: 'all_ready_only' | 'include_partial';
  confirmWarnings?: boolean;
}

export interface DispatchPreparedReviewProgramsResponse {
  dispatchId: string;
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  dispatchedAt: string;
  dispatchMode: 'all_ready_only' | 'include_partial';
  submittedPrograms: Array<{
    reviewProgramId: string;
    reviewProgramName: string;
    reviewProgramVersion: string;
    overallStatus: 'all_submitted' | 'partial' | 'none_submitted';
    axiomLegs: Array<{
      engine: 'AXIOM' | 'MOP_PRIO';
      programId: string;
      programVersion: string;
      status: 'submitted' | 'skipped' | 'failed';
      runId?: string;
      error?: string;
    }>;
    mopLegs: Array<{
      engine: 'AXIOM' | 'MOP_PRIO';
      programId: string;
      programVersion: string;
      status: 'submitted' | 'skipped' | 'failed';
      runId?: string;
      error?: string;
    }>;
    skippedReason?: string;
  }>;
  skippedPrograms: Array<{
    reviewProgramId: string;
    reason: string;
  }>;
  warnings: string[];
}

export interface PreparedReviewContextDiffValueChange {
  field: string;
  left: unknown;
  right: unknown;
}

export interface PreparedReviewContextProgramDiff {
  reviewProgramId: string;
  reviewProgramName: string;
  reviewProgramVersion: string;
  leftReadiness?: ReviewReadinessState;
  rightReadiness?: ReviewReadinessState;
  leftCanDispatch: boolean;
  rightCanDispatch: boolean;
  addedBlockers: string[];
  removedBlockers: string[];
  addedWarnings: string[];
  removedWarnings: string[];
}

export interface PreparedReviewContextDispatchDiff {
  reviewProgramId: string;
  engine: 'AXIOM' | 'MOP_PRIO';
  engineProgramId: string;
  engineProgramVersion: string;
  leftCanDispatch: boolean;
  rightCanDispatch: boolean;
  addedBlockedReasons: string[];
  removedBlockedReasons: string[];
}

export interface PreparedReviewContextDiffResponse {
  leftPreparedContextId: string;
  rightPreparedContextId: string;
  orderId: string;
  comparedAt: string;
  valueChanges: PreparedReviewContextDiffValueChange[];
  programDiffs: PreparedReviewContextProgramDiff[];
  dispatchDiffs: PreparedReviewContextDispatchDiff[];
}
