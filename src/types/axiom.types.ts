/**
 * Types for the Axiom AI Platform criteria compilation API.
 *
 * These types reflect the shape of Axiom's HTTP API responses for:
 *   GET  /api/programs/:programId/:version/compiled
 *   POST /api/programs/:programId/:version/compile
 */

// ─── Compiled criterion node (one per criterion, returned in the array) ───────

export interface CompiledEvaluation {
  mode: string;
  parameters?: {
    field: string;
    operator: string;
    value: string | number | boolean | null;
    unit: string | null;
  };
}

export interface CompiledDataRequirement {
  path: string;
  required: boolean;
  concept?: string;
  description?: string;
  /**
   * Explicit semantic category of this data requirement. When present, the
   * review-requirement resolver prefers this over keyword-based path matching
   * to decide whether a missing requirement is comp-related, adjustment-
   * related, or standard. Older compiled programs that do not carry a
   * category fall back to keyword detection for backward compatibility.
   */
  category?: 'comp' | 'adjustment' | 'standard';
}

export interface CompiledDocumentRequirement {
  documentType: string;
  required: boolean;
  purpose?: string;
  quantity?: string;
}

/**
 * One compiled criterion node as returned by Axiom's API.
 *
 * nodeId format: program:{programId}:{taxonomyCategory}.{concept}:{seq}
 * e.g.  program:canonical-fnma-1033-v1.0.0:propertyIdentification.PROPERTY_ADDRESS_COMPLETE:001
 */
export interface CompiledProgramNode {
  id: string;
  nodeId: string;
  tier: string;
  owner: string;
  version: string;
  canonNodeId: string;
  canonPath: string;
  taxonomyCategory: string;
  concept: string;           // criterion code, e.g. "PROPERTY_ADDRESS_COMPLETE"
  title: string;
  description: string;
  notes?: string;
  evaluation: CompiledEvaluation;
  dataRequirements: CompiledDataRequirement[];
  documentRequirements: CompiledDocumentRequirement[];
  priority: string;
  required: boolean;
  programId: string;
  compiledAt: string;
  compiledBy?: string;
}

// ─── API response envelope ────────────────────────────────────────────────────

export interface CompileMetadata {
  programId: string;
  programVersion: string;
  fullProgramId: string;
  criteriaCount: number;
  categories: string[];
  compiledAt: string;
}

export interface CompileResponse {
  criteria: CompiledProgramNode[];
  /** true = result came from cache; false = freshly compiled */
  cached: boolean;
  metadata: CompileMetadata;
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

