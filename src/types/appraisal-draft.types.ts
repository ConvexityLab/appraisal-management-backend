/**
 * Appraisal Draft Types — Phase 1 of UAD 3.6 Full Compliance
 *
 * Defines the draft entity stored in the `appraisal-drafts` Cosmos container
 * (partition key: /orderId). Represents an in-progress appraisal being authored
 * by an appraiser, separate from finalized reports in the `reporting` container.
 *
 * @see UAD_3.6_COMPLIANCE_PLAN.md — AD-1: Appraisal Draft as First-Class Entity
 */

import type { CanonicalReportDocument } from '@l1/shared-types';
import type { AppraisalFormType } from './template.types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DRAFT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draft lifecycle states.
 *
 * CREATED → EDITING → VALIDATING → FINALIZED → SUBMITTED
 *
 * - CREATED: Draft initialized from order data; no appraiser edits yet.
 * - EDITING: Appraiser is actively filling sections.
 * - VALIDATING: UAD validation is running (transient; reverts to EDITING on failure).
 * - FINALIZED: All required sections complete, validation passed, appraiser certified.
 *   Report document is copied to the `reporting` container.
 * - SUBMITTED: MISMO XML generated and submitted to UCDP/EAD.
 */
export enum DraftStatus {
  CREATED = 'CREATED',
  EDITING = 'EDITING',
  VALIDATING = 'VALIDATING',
  FINALIZED = 'FINALIZED',
  SUBMITTED = 'SUBMITTED',
}

/**
 * Per-section completion tracking.
 */
export enum SectionStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
  HAS_ERRORS = 'HAS_ERRORS',
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION IDs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical section identifiers matching URAR form layout.
 * Used as keys in `sectionStatus` and for PATCH endpoints.
 */
export const DRAFT_SECTION_IDS = [
  'subject',
  'contract',
  'neighborhood',
  'site',
  'improvements',
  'hbu',
  'sales-comparison',
  'cost-approach',
  'income-approach',
  'reconciliation',
  'certification',
  'photos',
  'addenda',
] as const;

export type DraftSectionId = (typeof DRAFT_SECTION_IDS)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// DRAFT ENTITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * An in-progress appraisal being authored by an appraiser.
 *
 * Stored in Cosmos container `appraisal-drafts`, partition key `/orderId`.
 * The `reportDocument` field holds the full canonical report data being assembled.
 */
export interface AppraisalDraft {
  /** Cosmos document ID. */
  id: string;
  /** Partition key — FK to orders container. */
  orderId: string;
  /** The FNMA form type being filled (e.g. FORM_1004, FORM_1073). */
  reportType: AppraisalFormType;
  /**
   * Product ID from the product catalog — drives EffectiveReportConfig merging.
   * Populated from the associated order's productId at draft creation time (R-10).
   * Optional for backward compatibility with drafts created before R-10.
   */
  productId?: string;
  /** Current lifecycle status. */
  status: DraftStatus;
  /** The actual report data being authored — same shape as finalized reports. */
  reportDocument: CanonicalReportDocument;
  /**
   * Product-agnostic section data bag (R-10).
   * Keys are section IDs from EffectiveReportConfig (e.g. 'prior-transfers', 'photos').
   * Sections whose data maps directly to CanonicalReportDocument fields (the 13 core
   * canonical sections) are merged into `reportDocument` instead. All other product-
   * or client-specific sections land here.
   */
  sections: Record<string, unknown>;
  /**
   * Per-section completion status — widened to Record<string, SectionStatus> (R-10)
   * so arbitrary product-config section keys can be tracked without modifying the type.
   */
  sectionStatus: Record<string, SectionStatus>;
  /** Last UAD validation result, if any. */
  validationErrors: DraftValidationError[] | null;
  /** ISO-8601 timestamp of draft creation. */
  createdAt: string;
  /** ISO-8601 timestamp of last modification. */
  updatedAt: string;
  /** User ID (appraiser) who created the draft. */
  createdBy: string;
  /** User ID of the most recent editor. */
  lastEditedBy: string;
  /** ISO-8601 timestamp of last auto-save, or null if never auto-saved. */
  autoSavedAt: string | null;
  /** Optimistic concurrency version — incremented on every write. */
  version: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single validation error found during UAD validation of a draft.
 */
export interface DraftValidationError {
  /** Which section the error belongs to. */
  /** The section key (matches EffectiveReportConfig section key). */
  sectionId: string;
  /** Dot-notation path to the offending field (e.g. 'subject.address.city'). */
  fieldPath: string;
  /** Human-readable error message. */
  message: string;
  /** Error severity. */
  severity: 'error' | 'warning';
  /** UAD 3.6 rule reference, if applicable (e.g. 'UAD-3.6-SUBJECT-001'). */
  ruleId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE DTOs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request body for POST /api/appraisal-drafts — create a new draft.
 */
export interface CreateDraftRequest {
  /** The order to create a draft for. */
  orderId: string;
  /** The form type to use. */
  reportType: AppraisalFormType;
}

/**
 * Request body for PATCH /api/appraisal-drafts/:id/sections/:sectionId — save one section.
 *
 * For sections that map to CanonicalReportDocument (the 13 core canonical sections),
 * `data` is a partial CanonicalReportDocument keyed by the top-level field names.
 * For all other (product-agnostic) sections, `data` is free-form and stored in the
 * draft `sections` bag keyed by sectionId (R-10).
 */
export interface SectionSaveRequest {
  /** Section data — a partial CanonicalReportDocument for canonical sections,
   *  or arbitrary shape for product-agnostic sections. */
  data: Record<string, unknown>;
  /** Client-side version for optimistic concurrency. */
  expectedVersion: number;
}

/**
 * Response wrapper for draft operations — follows existing { success, data } envelope.
 */
export interface DraftResponse {
  success: boolean;
  data: AppraisalDraft;
  message?: string;
}

/**
 * Response for validation operations.
 */
export interface DraftValidationResponse {
  success: boolean;
  data: {
    isValid: boolean;
    errors: DraftValidationError[];
    sectionStatus: Record<string, SectionStatus>;
  };
}

/**
 * Builds initial sectionStatus with all 13 canonical sections set to NOT_STARTED.
 * The returned type is widened to Record<string, SectionStatus> (R-10) so
 * product-specific section keys can be added without a type change.
 */
export function createInitialSectionStatus(): Record<string, SectionStatus> {
  const status: Record<string, SectionStatus> = {};
  for (const id of DRAFT_SECTION_IDS) {
    status[id] = SectionStatus.NOT_STARTED;
  }
  return status;
}
