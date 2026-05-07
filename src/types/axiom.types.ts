/**
 * Types for the Axiom AI Platform criteria compilation API.
 *
 * Mirror of the public wire contract defined in Axiom at
 * src/types/CriteriaContract.ts. Engine-agnostic: the same shape will
 * be emitted by MOP/Prio's analogous endpoint once it adopts the contract.
 *
 * Forward-compat: consumers MUST tolerate unknown fields.
 */

/** Severity of a criterion; drives blocker ranking and verdict aggregation. */
export type CriterionSeverity = 'critical' | 'high' | 'medium' | 'low';

/** A single data path the criterion reads from the order data graph. */
export interface CriterionDataRequirement {
  /** Dotted path into the order/canonical-snapshot graph (e.g. "subject.propertyAddress.street"). */
  path: string;
  /**
   * If true, the criterion CANNOT be evaluated without this path resolving.
   * If false, evaluation proceeds with degraded quality but still produces a verdict.
   */
  required: boolean;
}

/**
 * One AND-group of acceptable document types.
 *
 * Semantics: at least one document whose `documentType` matches one of the
 * listed types must be present on the order. Multiple groups are AND-ed;
 * every group must be satisfied independently.
 *
 * Examples:
 *   { oneOf: ["form-1004"] }                                    — exactly one specific type required
 *   { oneOf: ["form-1004", "form-1073", "form-1025"] }          — any one of the three forms
 *   [{ oneOf: ["form-1004"] }, { oneOf: ["title-report"] }]     — must have 1004 AND title-report
 *   [{ oneOf: ["form-1004", "form-1073"] }, { oneOf: ["avm"] }] — (1004 OR 1073) AND avm
 */
export interface CriterionDocumentRequirementGroup {
  oneOf: string[];
}

/** A single criterion in the compiled response. */
export interface CompiledCriterion {
  // Identity
  id: string;
  code: string;

  // Categorization
  category: string;
  subcategory?: string;

  // Display
  statement: string;
  description: string;
  notes?: string;

  // Severity
  severity: CriterionSeverity;

  // Data + evidence
  dataRequirements: CriterionDataRequirement[];
  /** Empty array → no document gating. Each entry is an OR-group; entries are AND-ed. */
  documentRequirements: CriterionDocumentRequirementGroup[];

  // Evaluation descriptor (engine-internal logic surfaced for transparency)
  evaluation: {
    type: string;
    parameters: Record<string, unknown>;
  };
}

/** Audit/cache metadata for a compiled-criteria snapshot. */
export interface CompiledCriteriaMetadata {
  /** ISO timestamp when this snapshot was produced (or last refreshed in cache). */
  compiledAt: string;
  /** True if returned from cache; false if just compiled. Hint for clients tuning their own caches. */
  cached: boolean;
  /** Audit trail: which canonical(s) and which versions were merged to produce this snapshot. */
  sourceCanonicals: Array<{ name: string; version: string }>;
  /** Convenience — equals `criteria.length`. */
  criteriaCount: number;
}

/** Top-level wire shape for GET .../compiled and POST .../compile. */
export interface CompiledCriteriaResponse {
  programId: string;
  programVersion: string;
  clientId: string;
  subClientId: string;
  criteria: CompiledCriterion[];
  metadata: CompiledCriteriaMetadata;
}

// --- Axiom Pipeline Execution & Tracking ---------------------------------

export type AxiomPipelineMode = 
  | 'FULL_PIPELINE' 
  | 'CLASSIFICATION_ONLY' 
  | 'EXTRACTION_ONLY' 
  | 'CRITERIA_ONLY';

export type AxiomExecutionStatus = 
  | 'QUEUED' 
  | 'CLASSIFYING' 
  | 'EXTRACTING' 
  | 'CONSOLIDATING'
  | 'EVALUATING' 
  | 'COMPLETED' 
  | 'FAILED';

export interface AxiomExecutionRecord {
  id: string;                    // Internal platform document tracking ID (PK for Cosmos)
  tenantId: string;
  orderId?: string;              // Linked Order
  documentIds: string[];         // Platform doc IDs passed
  axiomFileSetId?: string;       // Tied to Axiom's /api/documents
  axiomJobId: string;            // Tied to Axiom's /api/pipelines execution
  pipelineMode: AxiomPipelineMode;
  status: AxiomExecutionStatus;
  runCount: number;              // Documents can be re-run
  initiatedBy: string;           // userId or 'SYSTEM-AUTO'
  results?: any;                 // The final consolidated output
  failureReason?: string;
  createdAt: string;             // ISO Date
  updatedAt: string;             // ISO Date
  completedAt?: string;          // ISO Date
}

// ─── Axiom v2 Contract Types ─────────────────────────────────────────────────
//
// Mirrors the v2 wire contract documented in
// l1-valuation-platform-ui/docs/AXIOM_PROXY_CONTRACT_2026-05-07.md and
// the Axiom integration guide
// (axiom/docs/INTEGRATION_GUIDE_2026-05-06.md).
//
// These types describe the proxy surface the FE consumes; this backend
// translates them to/from Axiom's internal v2 endpoints
// (`/api/criterion/scopes/...` and `/api/criterion/loans/.../evaluate`).
//
// Required fields are guaranteed by the v2 contract — receipt of a
// response missing any of them is a contract violation and should throw
// (long-term-correct posture: no silent fallbacks).

/** v2 five-value verdict enum.  Replaces v1 `'pass' | 'fail' | 'warning' | 'info'`. */
export type AxiomCriterionStatus =
  | 'pass'
  | 'fail'
  | 'needs_review'
  | 'cannot_evaluate'
  | 'not_applicable';

/** Run-level status.  `'timed_out'` is terminal and distinct from `'failed'`. */
export type AxiomEvaluationRunStatus =
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timed_out';

/** Identity of the actor that produced a verdict. */
export type AxiomEvaluatedBy =
  | 'underwriter-actor'
  | 'pipeline-evaluator'
  | 'api-service'
  | 'human-override';

/**
 * Snapshot of the criterion definition the verdict was rendered against.
 * Required on every v2 result doc.
 */
export interface AxiomCriterionSnapshot {
  id: string;
  title: string;
  description: string;
  dataRequirements?: Array<{
    path: string;
    required?: boolean;
    sourceAcceptance?: string[];
  }>;
  documentRequirements?: Array<{
    documentType: string;
    required?: boolean;
  }>;
}

/** Path-keyed slice of the envelope the AI consulted. */
export type AxiomDataConsultedSlice = Record<string, unknown>;

/** Structured "what's missing" report attached to `cannot_evaluate` verdicts. */
export interface AxiomCannotEvaluateDetails {
  missingData?: string[];
  missingDocuments?: string[];
  actionableMessage?: string;
}

/**
 * v2 result doc — one entry per `(scopeId, criterionId, runId)` in Axiom's
 * append-only `evaluation-results` container, plus normalised denormalised
 * fields for proxy consumers.
 */
export interface AxiomEvaluationResultDoc {
  // Identity
  resultId: string;             // `${scopeId}:${criterionId}:${runId}`
  evaluationRunId: string;
  scopeId: string;
  criterionId: string;
  criterionName: string;

  // Verdict
  evaluation: AxiomCriterionStatus;
  confidence: number;
  reasoning: string;
  remediation?: string;

  // Provenance
  evaluatedBy: AxiomEvaluatedBy;
  evaluatedAt: string;
  manualOverride: boolean;
  supersedes?: string;
  overriddenBy?: string;
  overrideReason?: string;
  conditions?: string[];

  // Transparency (v2-required)
  criterionSnapshot: AxiomCriterionSnapshot;
  dataConsulted: AxiomDataConsultedSlice;

  // Cannot-evaluate detail
  cannotEvaluate?: AxiomCannotEvaluateDetails;

  // Source citations
  documentReferences: Array<{
    page: number;
    section?: string;
    quote: string;
    coordinates?: { x: number; y: number; width: number; height: number };
    documentId?: string;
    documentName?: string;
    blobUrl?: string;
    sourceFieldPaths?: string[];
  }>;
  dataUsed?: Array<Record<string, unknown>>;

  // Program identity (denormalised)
  programId?: string;
  programVersion?: string;
}

/**
 * Response shape of `POST /api/criterion/loans/:loanId/programs/:programId/evaluate`
 * + `GET /api/criterion/scopes/:scopeId/runs/:runId`.
 */
export interface AxiomEvaluationRunResponse {
  evaluationRunId: string;
  scopeId: string;
  programId: string;
  programVersion: string;
  status: AxiomEvaluationRunStatus;
  evaluatedAt: string;
  pipelineJobId?: string;
  schemaId?: string;
  error?: string;
  results: AxiomEvaluationResultDoc[];
  // Counts (Axiom returns these on the evaluate-summary response)
  totalCriteria?: number;
  passed?: number;
  failed?: number;
  needsReview?: number;
  cannotEvaluate?: number;
  notApplicable?: number;
  // Denormalised
  loanId?: string;
  orderId?: string;
}

/**
 * Response shape of `GET /api/criterion/scopes/:scopeId/results?programId=...`.
 *
 * "Latest verdict per criterion" — NOT a single run.
 */
export interface AxiomLatestResultsResponse {
  scopeId: string;
  programId: string;
  count: number;
  results: AxiomEvaluationResultDoc[];
  asOf?: string;
}

/**
 * Response shape of `GET /api/criterion/scopes/:scopeId/criteria/:criterionId/history`.
 * Newest-first.
 */
export interface AxiomCriterionHistoryResponse {
  scopeId: string;
  criterionId: string;
  count: number;
  history: AxiomEvaluationResultDoc[];
}

/**
 * Request payload for the v2 override endpoint.
 *
 * Backend writes the Axiom append-only override doc AND the platform
 * engagement audit event atomically — either both land or neither.
 */
export interface AxiomOverrideVerdictRequest {
  supersedes: string;
  verdict: 'pass' | 'fail' | 'needs_review';
  reasoning: string;
  overriddenBy: string;
  overrideReason?: string;
  engagementId: string;
  confidence?: number;
  conditions?: string[];
}

/**
 * v2 verdict-enum validator.  Throws if input is the legacy `'warning'`/`'info'`
 * or any other unrecognised value — used at every Axiom→backend boundary so
 * legacy values never escape into proxy responses.
 */
const VALID_V2_VERDICTS = new Set<AxiomCriterionStatus>([
  'pass',
  'fail',
  'needs_review',
  'cannot_evaluate',
  'not_applicable',
]);

export function assertV2Verdict(value: unknown, locator?: string): AxiomCriterionStatus {
  if (typeof value !== 'string' || !VALID_V2_VERDICTS.has(value as AxiomCriterionStatus)) {
    const ctx = locator ? ` at ${locator}` : '';
    throw new Error(
      `Axiom v2 contract violation${ctx}: expected verdict ∈ {pass, fail, needs_review, cannot_evaluate, not_applicable}, received ${JSON.stringify(value)}. ` +
        `(Legacy 'warning' and 'info' are removed in v2 — backend must emit 'needs_review' instead.)`,
    );
  }
  return value as AxiomCriterionStatus;
}

const VALID_V2_RUN_STATUSES = new Set<AxiomEvaluationRunStatus>([
  'processing',
  'completed',
  'failed',
  'timed_out',
]);

export function assertV2RunStatus(value: unknown, locator?: string): AxiomEvaluationRunStatus {
  if (typeof value !== 'string' || !VALID_V2_RUN_STATUSES.has(value as AxiomEvaluationRunStatus)) {
    const ctx = locator ? ` at ${locator}` : '';
    throw new Error(
      `Axiom v2 contract violation${ctx}: expected status ∈ {processing, completed, failed, timed_out}, received ${JSON.stringify(value)}.`,
    );
  }
  return value as AxiomEvaluationRunStatus;
}

