/**
 * Shared helpers for exposing Capability-5 AI/enrichment fields
 * (criteriaEvaluations, extractedDataFields, enrichmentData, sourceDocuments)
 * in the Handlebars context returned by every field mapper.
 *
 * All functions are pure — they only read from the CanonicalReportDocument
 * passed by mapToFieldMap().  They never throw; missing data yields safe nulls.
 */

import type { CanonicalReportDocument } from '../../../types/canonical-schema';

// ── Footnotes / Citations ─────────────────────────────────────────────────────

/**
 * A single deduplicated footnote entry assembled from all document references
 * across criteria and extracted fields.
 */
export interface FootnoteEntry {
  /** 1-based footnote index. */
  index: number;
  /** Inline citation label shown in body text, e.g. "[1]". */
  label: string;
  documentId?:   string;
  documentName?: string;
  page?:         number;
  section?:      string;
  quote?:        string;
  /** Azure Blob SAS URL — present when the service layer has resolved it. */
  blobUrl?: string;
}

export interface FootnotesContext {
  footnotes:    FootnoteEntry[];
  hasFootnotes: boolean;
}

/**
 * Collects all document references from criteriaEvaluations and extractedDataFields,
 * deduplicates by (documentId, page, section) key, and assigns sequential 1-based
 * footnote indices.  Pure — never throws.
 */
export function buildFootnotesContext(doc: CanonicalReportDocument): FootnotesContext {
  const seen     = new Map<string, number>(); // dedup key → 1-based index
  const footnotes: FootnoteEntry[] = [];

  function addRef(ref: {
    documentId?:   string;
    documentName?: string;
    page?:         number;
    section?:      string;
    quote?:        string;
    blobUrl?:      string;
  }): void {
    const key = `${ref.documentId ?? ''}::${ref.page ?? ''}::${ref.section ?? ''}`;
    if (seen.has(key)) return;
    const index = footnotes.length + 1;
    seen.set(key, index);
    footnotes.push({ index, label: `[${index}]`, ...ref });
  }

  for (const criterion of (doc.criteriaEvaluations ?? [])) {
    for (const ref of (criterion.documentReferences ?? [])) {
      addRef(ref);
    }
  }

  for (const field of (doc.extractedDataFields ?? [])) {
    addRef({
      ...(field.sourceDocumentId !== undefined && { documentId:   field.sourceDocumentId }),
      ...(field.sourceDocument   !== undefined && { documentName: field.sourceDocument }),
      ...(field.sourcePage       !== undefined && { page:         field.sourcePage }),
      ...(field.sourceSection    !== undefined && { section:      field.sourceSection }),
      ...(field.sourceQuote      !== undefined && { quote:        field.sourceQuote }),
      ...(field.sourceBlobUrl    !== undefined && { blobUrl:      field.sourceBlobUrl }),
    });
  }

  return { footnotes, hasFootnotes: footnotes.length > 0 };
}

// ── AI Insights context ───────────────────────────────────────────────────────

export interface AiInsightsContext {
  hasCriteria:  boolean;
  criteria:     CanonicalReportDocument['criteriaEvaluations'];
  passCount:    number;
  failCount:    number;
  warnCount:    number;
  /** Aggregate decision derived from criterion outcomes. */
  decision:     'PASS' | 'WARNING' | 'FAIL' | null;
  /** Top-3 criteria ordered by confidence (highest first). */
  top3Findings: CanonicalReportDocument['criteriaEvaluations'];
  /** Extracted field values (from document AI extraction). */
  extractedFields: CanonicalReportDocument['extractedDataFields'];
  hasExtractedFields: boolean;
  /** Ordered footnote/citation list assembled from all document references. */
  footnotes:    FootnoteEntry[];
  hasFootnotes: boolean;
}

export function buildAiInsightsContext(doc: CanonicalReportDocument): AiInsightsContext {
  const criteria = doc.criteriaEvaluations ?? [];

  const passCount = criteria.filter(c => c.evaluation === 'pass').length;
  const failCount = criteria.filter(c => c.evaluation === 'fail').length;
  const warnCount = criteria.filter(c => c.evaluation === 'warning').length;

  let decision: AiInsightsContext['decision'] = null;
  const evaluatedCount = passCount + failCount + warnCount;
  if (evaluatedCount > 0) {
    decision = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARNING' : 'PASS';
  }

  const top3Findings = [...criteria]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3);

  const extractedFields = doc.extractedDataFields ?? [];
  const { footnotes, hasFootnotes } = buildFootnotesContext(doc);

  return {
    hasCriteria:        criteria.length > 0,
    criteria,
    passCount,
    failCount,
    warnCount,
    decision,
    top3Findings,
    extractedFields,
    hasExtractedFields: extractedFields.length > 0,
    footnotes,
    hasFootnotes,
  };
}

// ── Enrichment context ────────────────────────────────────────────────────────

export type EnrichmentContext = CanonicalReportDocument['enrichmentData'] | null;

export function buildEnrichmentContext(doc: CanonicalReportDocument): EnrichmentContext {
  return doc.enrichmentData ?? null;
}

// ── Source documents context ──────────────────────────────────────────────────

export type SourceDocumentsContext = NonNullable<CanonicalReportDocument['sourceDocuments']>;

export function buildSourceDocumentsContext(
  doc: CanonicalReportDocument,
): SourceDocumentsContext {
  return doc.sourceDocuments ?? [];
}
