import type { CreateCriteriaRunInput, CreateExtractionRunInput, RunLedgerRecord, RunStatus } from './run-ledger.types.js';

export type AnalysisSubmissionType = 'DOCUMENT_ANALYZE' | 'EXTRACTION' | 'CRITERIA';
export type DocumentAnalyzeEvaluationMode = 'EXTRACTION' | 'CRITERIA_EVALUATION' | 'COMPLETE_EVALUATION';

export interface DocumentAnalyzeSubmissionRequest {
  analysisType: 'DOCUMENT_ANALYZE';
  documentId: string;
  orderId: string;
  documentType?: string;
  evaluationMode?: DocumentAnalyzeEvaluationMode;
  /** Axiom program ID to use for criteria evaluation (e.g. 'FNMA-URAR'). When omitted, Axiom skips criteria and returns partial_complete. */
  programId?: string;
  /** Axiom program version (e.g. '1.0.0'). Required alongside programId for full criteria evaluation. */
  programVersion?: string;
  /** When true, bypasses the Cosmos idempotency guard and always submits a fresh pipeline run to Axiom. */
  forceResubmit?: boolean;
}

export interface ExtractionSubmissionRequest {
  analysisType: 'EXTRACTION';
  documentId: string;
  schemaKey: CreateExtractionRunInput['schemaKey'];
  runReason: string;
  engineTarget?: CreateExtractionRunInput['engineTarget'];
  enginePolicyRef?: CreateExtractionRunInput['enginePolicyRef'];
  engagementId?: string;
  loanPropertyContextId?: string;
}

export interface CriteriaSubmissionRequest {
  analysisType: 'CRITERIA';
  snapshotId?: string;
  programKey: CreateCriteriaRunInput['programKey'];
  runMode: CreateCriteriaRunInput['runMode'];
  criteriaStepKeys?: string[];
  rerunReason?: string;
  parentRunId?: string;
  engineTarget?: CreateCriteriaRunInput['engineTarget'];
  enginePolicyRef?: CreateCriteriaRunInput['enginePolicyRef'];
  engagementId?: string;
  loanPropertyContextId?: string;
  preparedContextId?: CreateCriteriaRunInput['preparedContextId'];
  preparedContextVersion?: CreateCriteriaRunInput['preparedContextVersion'];
  preparedDispatchId?: CreateCriteriaRunInput['preparedDispatchId'];
  preparedPayloadRef?: CreateCriteriaRunInput['preparedPayloadRef'];
  preparedPayloadContractType?: CreateCriteriaRunInput['preparedPayloadContractType'];
  preparedPayloadContractVersion?: CreateCriteriaRunInput['preparedPayloadContractVersion'];
}

export type AnalysisSubmissionRequest =
  | DocumentAnalyzeSubmissionRequest
  | ExtractionSubmissionRequest
  | CriteriaSubmissionRequest;

export interface AnalysisSubmissionActorContext {
  tenantId: string;
  initiatedBy: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface AnalysisSubmissionResponse {
  submissionId: string;
  analysisType: AnalysisSubmissionType;
  status: RunStatus | 'queued';
  provider: 'AXIOM' | 'RUN_LEDGER';
  evaluationId?: string;
  pipelineJobId?: string;
  run?: RunLedgerRecord;
  stepRuns?: RunLedgerRecord[];
}
