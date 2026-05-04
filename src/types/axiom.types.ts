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

