/**
 * Types for ReviewProgram orchestration — the process of fanning out a single
 * ReviewProgram submission to one or more underlying engine criteria runs
 * (Axiom for aiCriteriaRefs, MOP/Prio for rulesetRefs).
 */

import type { PreparedEngineDispatch } from './review-preparation.types.js';

export type OrchestrationLegStatus = 'submitted' | 'skipped' | 'failed';

/**
 * One dispatched leg — corresponds to a single ref on the ReviewProgram
 * (one aiCriteriaRef slot or one rulesetRef slot).
 */
export interface OrchestrationRunLeg {
  engine: 'AXIOM' | 'MOP_PRIO';
  programId: string;
  programVersion: string;
  /** 'submitted' — run ledger record created and dispatch accepted by engine. */
  status: OrchestrationLegStatus;
  /** The run-ledger run ID (only present when status === 'submitted'). */
  runId?: string;
  /** Human-readable reason for skipped or failed status. */
  error?: string;
}

/**
 * all_submitted — every declared leg was accepted by its engine.
 * partial       — at least one leg submitted, at least one skipped or failed.
 * none_submitted — no legs were submitted (either no refs declared, or all failed).
 */
export type ReviewProgramOrchestrationOverallStatus =
  | 'all_submitted'
  | 'partial'
  | 'none_submitted';

export interface ReviewProgramOrchestrationRequest {
  /** The canonical snapshot ID produced by a prior extraction run when one exists. */
  snapshotId?: string;
  /** Resolved client context for constructing ProgramKeys for each leg. */
  clientId: string;
  subClientId: string;
  /** Defaults to 'FULL' when omitted. */
  runMode?: 'FULL' | 'STEP_ONLY';
  rerunReason?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  preparedContextId?: string;
  preparedContextVersion?: string;
  preparedDispatchId?: string;
  preparedEngineDispatches?: PreparedEngineDispatch[];
}

export interface ReviewProgramOrchestrationResult {
  reviewProgramId: string;
  reviewProgramName: string;
  overallStatus: ReviewProgramOrchestrationOverallStatus;
  axiomLegs: OrchestrationRunLeg[];
  mopLegs: OrchestrationRunLeg[];
  /**
   * Set when overallStatus is 'none_submitted' because the program has no refs
   * declared at all (as opposed to all legs having failed).
   */
  skippedReason?: string;
}
