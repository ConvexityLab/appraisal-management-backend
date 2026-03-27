/**
 * Appraisal Draft Types — Phase 1 of UAD 3.6 Full Compliance
 *
 * Defines the draft entity stored in the `appraisal-drafts` Cosmos container
 * (partition key: /orderId). Represents an in-progress appraisal being authored
 * by an appraiser, separate from finalized reports in the `reporting` container.
 *
 * @see UAD_3.6_COMPLIANCE_PLAN.md — AD-1: Appraisal Draft as First-Class Entity
 */

import type { CanonicalReportDocument } from './canonical-schema.js';
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
  /** Current lifecycle status. */
  status: DraftStatus;
  /** The actual report data being authored — same shape as finalized reports. */
  reportDocument: CanonicalReportDocument;
  /** Per-section completion tracking. */
  sectionStatus: Record<DraftSectionId, SectionStatus>;
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
  sectionId: DraftSectionId;
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
 * The body is a partial CanonicalReportDocument scoped to the fields that section covers.
 */
export interface SectionSaveRequest {
  /** Partial report data for the section being saved. */
  data: Partial<CanonicalReportDocument>;
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
    sectionStatus: Record<DraftSectionId, SectionStatus>;
  };
}

/**
 * Builds initial sectionStatus with all sections set to NOT_STARTED.
 */
export function createInitialSectionStatus(): Record<DraftSectionId, SectionStatus> {
  const status: Partial<Record<DraftSectionId, SectionStatus>> = {};
  for (const id of DRAFT_SECTION_IDS) {
    status[id] = SectionStatus.NOT_STARTED;
  }
  return status as Record<DraftSectionId, SectionStatus>;
}
