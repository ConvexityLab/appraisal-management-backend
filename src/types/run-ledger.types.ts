import type { IntakeSourceIdentity } from './intake-source.types.js';

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
  sourceIdentity?: IntakeSourceIdentity;
  pipelineId?: string;
  canonicalSnapshotId?: string;
  preparedContextId?: string;
  preparedContextVersion?: string;
  preparedDispatchId?: string;
  preparedPayloadRef?: string;
  preparedPayloadContractType?: 'axiom-review-dispatch' | 'mop-prio-review-dispatch';
  preparedPayloadContractVersion?: string;
  criteriaStepKeys?: string[];
  criteriaStepRunIds?: string[];
  /**
   * Criterion-level terminal outcome for criteria and criteria-step runs.
   * Set when the engine returns a terminal verdict that explains why the run
   * did not produce a normal pass/fail decision:
   *   - `cannot_evaluate`            – required data was absent; engine could not score
   *   - `skipped_missing_requirements` – run was bypassed by the dispatcher before reaching the engine
   *   - `evaluation_error`           – engine returned an unexpected error verdict
   *
   * For criteria runs this is the worst terminal outcome across all criteria.
   * For criteria-step runs this is the outcome for that specific step.
   */
  terminalOutcome?: 'cannot_evaluate' | 'skipped_missing_requirements' | 'evaluation_error';
  statusDetails?: Record<string, unknown>;
}

export interface CanonicalSnapshotRecord {
  id: string;
  type: 'canonical-snapshot';
  tenantId: string;
  propertyId?: string;
  orderId?: string;
  documentId?: string;
  sourceRunId?: string;
  createdAt: string;
  createdBy: string;
  status: 'ready' | 'processing' | 'failed';
  engagementId?: string;
  loanPropertyContextId?: string;
  projectorVersion: string;
  sourceSchemaVersion?: string;
  sourceIdentity?: IntakeSourceIdentity;
  sourceRefs: Array<{ sourceType: string; sourceId: string; sourceRunId?: string }>;
  normalizedDataRef: string;
  createdByRunIds: string[];
  normalizedData?: {
    /**
     * @deprecated Slice 8j: legacy flat shim that pre-dated the canonical
     * mapper. Read `canonical.subject` instead. Field is still populated by
     * the snapshot service for back-compat; final removal is slice 8k once
     * all readers have migrated.
     */
    subjectProperty?: Record<string, unknown>;
    /**
     * Raw Axiom extraction output, retained for provenance and re-projection
     * if the mapper changes. NOT the canonical view — read `canonical.subject`
     * / `canonical.comps` etc. for the canonical shape.
     */
    extraction?: Record<string, unknown>;
    /**
     * AMP canonical-schema (UAD 3.6 / URAR / MISMO 3.4 aligned) projection of
     * the extraction data. The single source of truth for review-program data
     * shape; preferred over `extraction` by the resolver. Built by the
     * AxiomExtractionMapper at snapshot time. Optional for backward-compat
     * with snapshots produced before the mapper was introduced.
     */
    canonical?: Record<string, unknown>;
    /**
     * @deprecated Slice 8j: raw third-party-provider response. Kept as
     * provenance only; consume `canonical.subject` (enrichment already
     * projected) or fetch the PropertyEnrichmentRecord directly when raw
     * audit data is needed. Final removal is slice 8k.
     */
    providerData?: Record<string, unknown>;
    provenance?: Record<string, unknown>;
  };
  /** A-13: Set when `refreshFromExtractionRun` re-materialises normalizedData post-Axiom. */
  refreshedAt?: string;
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
  sourceIdentity?: IntakeSourceIdentity;
}

export interface CreateCriteriaRunInput {
  tenantId: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
  snapshotId?: string;
  programKey: ProgramKey;
  runMode: 'FULL' | 'STEP_ONLY';
  pipelineId?: string;
  engineTarget?: EngineTarget;
  enginePolicyRef?: string;
  rerunReason?: string;
  parentRunId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  preparedContextId?: string;
  preparedContextVersion?: string;
  preparedDispatchId?: string;
  preparedPayloadRef?: string;
  preparedPayloadContractType?: 'axiom-review-dispatch' | 'mop-prio-review-dispatch';
  preparedPayloadContractVersion?: string;
  sourceIdentity?: IntakeSourceIdentity;
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
