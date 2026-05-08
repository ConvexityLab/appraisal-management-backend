/**
 * EvaluationEnvelopeAssembler
 *
 * Builds an `EvaluationDataEnvelope` from platform-side state (assembled
 * via the ReviewContextAssemblyService → canonical snapshot pipeline) for
 * submission to Axiom's v2 criterion evaluator
 * (`POST /api/criterion/loans/:loanId/programs/:programId/evaluate`).
 *
 * Why this exists
 * ───────────────
 * Axiom v2 (Phase 5) evaluates against an inline envelope rather than
 * requiring a pre-assembled `LoanDataObject` in Axiom's loan store. The
 * platform owns the order data, so the platform must supply the envelope.
 *
 * Data source: ReviewContextAssemblyService
 * ─────────────────────────────────────────
 * The envelope is built from the SAME `ReviewContext` that
 * `prepared-dispatch-payload-assembly.service.ts` resolves criterion
 * bindings against — i.e. the canonical snapshot's normalizedData
 * (canonical / subjectProperty / extraction / providerData / provenance)
 * + the order + the document inventory. Single source of truth, no
 * divergent assembly logic.
 *
 * Path-keying convention
 * ──────────────────────
 * Each leaf value of `canonicalData.<bucket>` is emitted as a path-keyed
 * envelope field under `<bucket>.<dotted-path>`:
 *   - `canonical.subject.gla`      (preferred — UAD/MISMO-aligned projection)
 *   - `subjectProperty.address`    (deprecated — pre-mapper flat shim)
 *   - `extraction.<...>`           (raw Axiom extraction output)
 *   - `providerData.<...>`         (deprecated — raw third-party-provider blob)
 *   - `provenance.<...>`
 * Plus order metadata under `order.id`, `order.productType`, `order.dueDate`.
 *
 * Fields with no value are absent from the envelope (Axiom's prefetcher
 * treats absent paths as "not provided" → `cannot_evaluate` if the
 * criterion's dataRequirement has `required: true`). Empty strings, NaN,
 * null, undefined are dropped.
 *
 * Source attribution today
 * ─────────────────────────
 * Order-context-derived values get `sources: []` (no provenance — the
 * lender system is the trusted source). Each document attached to the
 * order is registered in `envelope.sources` keyed `doc:<documentId>`,
 * even if no field currently references it (criteria that rely on
 * `dataRequirement.sourceAcceptance` to require a document type without
 * referencing a specific field still resolve correctly).
 */

import { Logger } from '../../utils/logger.js';
import { ReviewContextAssemblyService } from '../review-context-assembly.service.js';
import type { CosmosDbService } from '../cosmos-db.service.js';
import type { ReviewContext } from '../../types/review-context.types.js';
import type { AnalysisSubmissionActorContext } from '../../types/analysis-submission.types.js';

// ─── Envelope types (mirror of Axiom's EvaluationDataEnvelope shape) ────────
//
// Defined locally to avoid taking a dependency on @certo/axiom or
// duplicating the entire type module. Update if the Axiom shape changes.

export interface EvaluationScope {
  scopeId: string;
  loanId?: string;
  propertyId?: string;
  borrowerId?: string;
  portfolioId?: string;
  clientId?: string;
  subClientId?: string;
  programId?: string;
  programVersion?: string;
}

export interface EnvelopeFieldValue {
  value: unknown;
  sources: string[];
  contributedAt: string;
  confidence?: number;
}

export interface EnvelopeFieldEntry {
  values: EnvelopeFieldValue[];
}

export interface DocumentSource {
  type: 'document';
  documentType: string;
  documentRef: {
    blobPath: string;
    pageIndexNodeId?: string;
  };
  documentDate?: string;
  extractedAt?: string;
  extractorVersion?: string;
}

export type DataSource = DocumentSource;

export interface EvaluationDataEnvelope {
  schemaId: string;
  scope: EvaluationScope;
  fields: { [canonicalPath: string]: EnvelopeFieldEntry };
  sources: { [sourceId: string]: DataSource };
  assembledAt: string;
  version: number;
}

// ─── Inputs ────────────────────────────────────────────────────────────────

export interface AssembleEnvelopeInput {
  scopeId: string;
  programId: string;
  programVersion: string;
  /** Defaults to programId when omitted. */
  schemaId?: string;
  /** Identity for ReviewContext load (tenant scoping + correlation/audit). */
  actor: AnalysisSubmissionActorContext;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

/**
 * Add a field entry to the envelope only when the value is meaningful.
 * Empty strings, NaN, null, undefined are dropped silently — Axiom's
 * prefetcher treats absent paths as "not provided" rather than treating
 * empty strings as a value.
 */
function addField(
  fields: Record<string, EnvelopeFieldEntry>,
  path: string,
  value: unknown,
  options: { sources?: string[]; contributedAt: string; confidence?: number },
): void {
  if (!isMeaningful(value)) return;
  const entry: EnvelopeFieldValue = {
    value,
    sources: options.sources ?? [],
    contributedAt: options.contributedAt,
    ...(typeof options.confidence === 'number' && { confidence: options.confidence }),
  };
  const existing = fields[path];
  if (existing) {
    existing.values.push(entry);
  } else {
    fields[path] = { values: [entry] };
  }
}

/**
 * Walk an arbitrary value, emitting a path-keyed envelope field for each
 * scalar (or array-of-scalars) leaf. Objects are descended; arrays are
 * passed through as-is when they contain scalars and indexed individually
 * when they contain objects (so `comps[0].address` becomes `comps.0.address`).
 *
 * The `prefix` is prepended to every emitted path (e.g. `canonical`).
 */
function walkAndEmit(
  fields: Record<string, EnvelopeFieldEntry>,
  prefix: string,
  value: unknown,
  contributedAt: string,
): void {
  if (!isMeaningful(value)) return;

  if (Array.isArray(value)) {
    // Array-of-scalars → emit the whole array as one envelope value.
    // Array-of-objects → recurse with index segments so consumers can
    // address `<prefix>.0.field` (matches `prepared-dispatch-payload-
    // assembly.service.ts.readPath` segmenting `[N]` as `.N`).
    const allScalar = value.every(
      (item) => item == null || typeof item !== 'object',
    );
    if (allScalar) {
      addField(fields, prefix, value, { contributedAt });
      return;
    }
    value.forEach((item, idx) => {
      walkAndEmit(fields, `${prefix}.${idx}`, item, contributedAt);
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkAndEmit(fields, `${prefix}.${key}`, child, contributedAt);
    }
    return;
  }

  // Scalar leaf
  addField(fields, prefix, value, { contributedAt });
}

/**
 * Map a document's category/documentType to an Axiom DocumentTypeRegistry
 * slug. Best-effort; unknown types pass through verbatim so Axiom's
 * registry can resolve them (or surface a typed diagnostic).
 */
function resolveAxiomDocumentType(doc: ReviewContext['documents'][number]): string {
  // Prefer the SCREAMING_SNAKE documentType field, fallback to category,
  // fallback to a generic 'document'. Lowercased + hyphenated to match
  // Axiom's slug convention (e.g. 'appraisal_report' → 'appraisal-report').
  const raw = doc.documentType ?? doc.category ?? 'document';
  return String(raw).toLowerCase().replace(/_/g, '-');
}

/**
 * Build the `sources` map. Every document referenced by the ReviewContext
 * is registered, regardless of whether any field currently references it.
 * Note: ReviewContextDocumentSummary intentionally does not expose the raw
 * blobName (the context layer is meant to be transport-light), so the
 * blobPath here is left as the document id — Axiom's document-type
 * sourceAcceptance check resolves on the `documentType` field, not the
 * blob path.
 */
function buildSources(documents: ReviewContext['documents']): Record<string, DataSource> {
  const sources: Record<string, DataSource> = {};
  for (const doc of documents) {
    const sourceId = `doc:${doc.id}`;
    sources[sourceId] = {
      type: 'document',
      documentType: resolveAxiomDocumentType(doc),
      documentRef: {
        blobPath: doc.id,
      },
      ...(doc.uploadedAt && { documentDate: doc.uploadedAt }),
    };
  }
  return sources;
}

// ─── Assembler ─────────────────────────────────────────────────────────────

export class EvaluationEnvelopeAssembler {
  private readonly logger = new Logger('EvaluationEnvelopeAssembler');
  private readonly contextAssembler: ReviewContextAssemblyService;

  constructor(dbService: CosmosDbService) {
    this.contextAssembler = new ReviewContextAssemblyService(dbService);
  }

  async assemble(input: AssembleEnvelopeInput): Promise<EvaluationDataEnvelope> {
    const { scopeId, programId, programVersion, actor } = input;
    const schemaId = input.schemaId ?? programId;
    const assembledAt = new Date().toISOString();

    this.logger.info('Assembling evaluation envelope', {
      scopeId,
      programId,
      programVersion,
      schemaId,
    });

    // ReviewContextAssemblyService is the canonical platform-side data
    // assembler — it loads order, latest canonical snapshot, documents,
    // latest report, runs, and (when requested) review programs. We pass
    // an empty reviewProgramIds because the envelope is program-independent
    // (the same canonical data is evaluated by every program ref). Axiom
    // resolves which criteria to evaluate from the program/programVersion
    // route param + the criterion's own dataRequirements.
    const context = await this.contextAssembler.assemble(
      {
        orderId: scopeId,
        reviewProgramIds: [],
      },
      actor,
    );

    const fields = this.buildFields(context, assembledAt);
    const sources = buildSources(context.documents);

    const scope: EvaluationScope = {
      scopeId,
      loanId: scopeId,
      programId,
      programVersion,
      ...(context.identity.clientId && { clientId: context.identity.clientId }),
      ...(context.identity.subClientId && { subClientId: context.identity.subClientId }),
    };

    const envelope: EvaluationDataEnvelope = {
      schemaId,
      scope,
      fields,
      sources,
      assembledAt,
      version: 1,
    };

    this.logger.info('Envelope assembled', {
      scopeId,
      fieldCount: Object.keys(fields).length,
      sourceCount: Object.keys(sources).length,
      hasCanonicalSnapshot: Boolean(context.canonicalData),
    });

    return envelope;
  }

  // ─── Field builders ──────────────────────────────────────────────────

  private buildFields(
    context: ReviewContext,
    contributedAt: string,
  ): Record<string, EnvelopeFieldEntry> {
    const fields: Record<string, EnvelopeFieldEntry> = {};

    // ── Canonical snapshot data ─────────────────────────────────────────
    // Each bucket of normalizedData is walked recursively; leaves are
    // emitted as path-keyed fields under their bucket prefix. This matches
    // the prefixes resolved by `prepared-dispatch-payload-assembly`,
    // which is how criteria binding paths are addressed elsewhere in
    // the platform (single source of truth for path conventions).
    if (context.canonicalData) {
      const cd = context.canonicalData;
      if (cd.canonical) walkAndEmit(fields, 'canonical', cd.canonical, contributedAt);
      if (cd.subjectProperty) walkAndEmit(fields, 'subjectProperty', cd.subjectProperty, contributedAt);
      if (cd.extraction) walkAndEmit(fields, 'extraction', cd.extraction, contributedAt);
      if (cd.providerData) walkAndEmit(fields, 'providerData', cd.providerData, contributedAt);
      if (cd.provenance) walkAndEmit(fields, 'provenance', cd.provenance, contributedAt);
    }

    // ── Order metadata ──────────────────────────────────────────────────
    // Limited set of order fields that criteria commonly bind against.
    // (`order.X` is one of the legacy prefixes recognised by
    // prepared-dispatch-payload-assembly.getResolvedValue.)
    const order = context.order;
    addField(fields, 'order.id', order.id, { contributedAt });
    addField(fields, 'order.productType', order.productType, { contributedAt });
    if (order.dueDate) {
      addField(fields, 'order.dueDate', String(order.dueDate), { contributedAt });
    }

    return fields;
  }
}
