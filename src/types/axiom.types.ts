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
