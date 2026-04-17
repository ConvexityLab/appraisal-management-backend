export type EngineTarget = 'AXIOM' | 'MOP_PRIO';

export type EngineSelectionMode = 'EXPLICIT' | 'POLICY';

export type RunType = 'extraction' | 'criteria' | 'criteria-step';

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SchemaKey {
  clientId: string;
  subClientId: string;
  documentType: string;
  version: string;
}

export interface ProgramKey {
  clientId: string;
  subClientId: string;
  programId: string;
  version: string;
}

export interface RunLedgerRecord {
  id: string;
  type: 'run-ledger-entry';
  runType: RunType;
  status: RunStatus;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
  engine: EngineTarget;
  engineVersion: string;
  engineRunRef: string;
  engineRequestRef: string;
  engineResponseRef: string;
  engineSelectionMode: EngineSelectionMode;
  enginePolicyRef?: string;
  parentRunId?: string;
  rerunReason?: string;
  documentId?: string;
  snapshotId?: string;
  criteriaRunId?: string;
  stepKey?: string;
  schemaKey?: SchemaKey;
  programKey?: ProgramKey;
  runMode?: 'FULL' | 'STEP_ONLY';
  runReason?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  pipelineId?: string;
  canonicalSnapshotId?: string;
  criteriaStepKeys?: string[];
  criteriaStepRunIds?: string[];
  statusDetails?: Record<string, unknown>;
}

export interface CanonicalSnapshotRecord {
  id: string;
  type: 'canonical-snapshot';
  tenantId: string;
  createdAt: string;
  createdBy: string;
  status: 'ready' | 'processing' | 'failed';
  engagementId?: string;
  loanPropertyContextId?: string;
  sourceRefs: Array<{ sourceType: string; sourceId: string; sourceRunId?: string }>;
  normalizedDataRef: string;
  createdByRunIds: string[];
  normalizedData?: {
    subjectProperty?: Record<string, unknown>;
    extraction?: Record<string, unknown>;
    providerData?: Record<string, unknown>;
    provenance?: Record<string, unknown>;
  };
}

export interface CriteriaStepEvidenceRef {
  sourceType: 'canonical-snapshot' | 'property-enrichment' | 'document-extraction';
  sourceId: string;
  sourceRunId?: string;
  fieldPath?: string;
}

export interface CriteriaStepInputSliceRecord {
  id: string;
  type: 'criteria-step-input-slice';
  tenantId: string;
  createdAt: string;
  createdBy: string;
  snapshotId: string;
  criteriaRunId: string;
  stepRunId: string;
  stepKey: string;
  payloadRef: string;
  payload: Record<string, unknown>;
  evidenceRefs: CriteriaStepEvidenceRef[];
}

export interface EngineDispatchResult {
  status: RunStatus;
  engineRunRef: string;
  engineVersion: string;
  engineRequestRef: string;
  engineResponseRef: string;
  statusDetails?: Record<string, unknown>;
}

export interface CreateExtractionRunInput {
  tenantId: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
  documentId: string;
  schemaKey: SchemaKey;
  runReason: string;
  pipelineId?: string;
  engineTarget?: EngineTarget;
  enginePolicyRef?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
}

export interface CreateCriteriaRunInput {
  tenantId: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
  snapshotId: string;
  programKey: ProgramKey;
  runMode: 'FULL' | 'STEP_ONLY';
  pipelineId?: string;
  engineTarget?: EngineTarget;
  enginePolicyRef?: string;
  rerunReason?: string;
  parentRunId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
}

export interface RerunCriteriaStepInput {
  tenantId: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
  criteriaRunId: string;
  stepKey: string;
  rerunReason: string;
  engineTarget?: EngineTarget;
  enginePolicyRef?: string;
}
