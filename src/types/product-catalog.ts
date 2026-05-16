/**
 * Product Catalog — single source of truth for all product and document types.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The codebase previously had six separate, partially-overlapping product type
 * vocabularies maintained in isolation:
 *
 *   • EngagementClientOrder product types (engagement.types.ts)             — 12 SCREAMING_SNAKE values
 *   • OrderType enum (order-management.ts)                         — 8 SCREAMING_SNAKE values (legacy)
 *   • order.productType free string (various services)             — snake_case values from frontend
 *   • ProductType union (order-schema.ts, frontend)                — SCREAMING_SNAKE w/ form numbers
 *   • BulkAnalysisType (bulk-portfolio.types.ts)                   — 6 SCREAMING_SNAKE values
 *   • PRODUCT_TYPE_MAP ad-hoc table (CreateVendorOrderDialog.tsx)  — 12 hand-mapped entries
 *
 * Each was a hand-maintained table that drifted from the others over time.
 *
 * THIS FILE replaces all of them.  To add a new product type:
 *   1. Add a key to `ProductType` const.
 *   2. Add a `ProductDefinition` entry in `PRODUCT_CATALOG`.
 *   Done — all routing, document lookup, and bulk mapping derive from here.
 *
 * HIERARCHY
 * ---------
 *   Engagement
 *     └── EngagementProperty (many, embedded)
 *           └── EngagementClientOrder (many) — productType: ProductType
 *                 └── VendorOrder / Order (many) — productType: ProductType
 *                       └── Document (many) — category: DocumentCategory
 *
 * NAMING CONVENTION
 * -----------------
 * ProductType values are SCREAMING_SNAKE (e.g. 'FULL_APPRAISAL').
 * DocumentCategory values are kebab-case (e.g. 'appraisal-report') — matching
 * what the document service stores in Cosmos and what the frontend DocumentCategory
 * enum uses.  Both are plain string literals (no TypeScript enum) so they survive
 * JSON serialization without transformation.
 *
 * LEGACY snake_case NORMALIZATION
 * --------------------------------
 * Older order documents in Cosmos may carry snake_case productType values written
 * by the direct-order form (e.g. 'full_appraisal', 'bpo_exterior').  Callers that
 * receive a raw productType from Cosmos should normalize before lookup:
 *
 *   const key = (rawProductType ?? '').toUpperCase() as ProductType;
 *   const def = PRODUCT_CATALOG[key];
 *
 * `.toUpperCase()` is a perfect lossless mapping: 'bpo_exterior' → 'BPO_EXTERIOR'.
 * Idempotent for values already in SCREAMING_SNAKE.
 */

// =============================================================================
// DOCUMENT CATEGORIES
// =============================================================================

/**
 * Canonical document category strings stored in the `category` field of
 * DocumentMetadata documents.  These must match the DocumentCategory enum in
 * the frontend (l1-valuation-platform-ui/src/types/backend/document.types.ts).
 *
 * Adding a new category: add a key here, update PRODUCT_CATALOG entries, and
 * add the matching value to the frontend DocumentCategory enum.
 */
export const DocumentCategory = {
  APPRAISAL_REPORT:       'appraisal-report',
  BPO_REPORT:             'bpo-report',
  INSPECTION_REPORT:      'inspection-report',
  ROV_EVIDENCE:           'rov-evidence',
  ROV_COMPARABLE:         'rov-comparable',
  ROV_RESPONSE:           'rov-response',
  ARV_REPORT:             'arv-report',
  AVM_REPORT:             'avm-report',
  FRAUD_ANALYSIS_REPORT:  'fraud-analysis-report',
  DVR_REPORT:             'dvr-report',
  STR_FEASIBILITY_REPORT: 'str-feasibility-report',
  ABSORPTION_STUDY_REPORT: 'absorption-study-report',
  SUPPORTING_DOCUMENT:    'supporting-document',
  PHOTO:                  'photo',
  FLOOR_PLAN:             'floor-plan',
  COMPARABLE_SALES:       'comparable-sales',
  INVOICE:                'invoice',
  QC_REPORT:              'qc-report',
  CERTIFICATION:          'certification',
  LICENSE:                'license',
  CONTRACT:               'contract',
} as const;

export type DocumentCategory = typeof DocumentCategory[keyof typeof DocumentCategory];

// =============================================================================
// PRODUCT TYPES
// =============================================================================

/**
 * Canonical product type identifiers — SCREAMING_SNAKE strings.
 *
 * These values flow through the full hierarchy:
 *   EngagementClientOrder.productType → VendorOrder.productType → Document routing
 *
 * SCREAMING_SNAKE is used (not snake_case) so values are self-documenting in
 * Cosmos documents and JSON payloads without needing a lookup table.
 *
 * Backward-compat note:
 *   - All former product type enum values are present unchanged.
 *   - snake_case aliases used by the direct-order form (full_appraisal, etc.)
 *     normalize to these keys via `.toUpperCase()` — see file header.
 */
export const ProductType = {
  // ── Appraisal family ──────────────────────────────────────────────────────
  /** Full interior appraisal — FNMA 1004 / 1073 */
  FULL_APPRAISAL:   'FULL_APPRAISAL',
  /** Exterior-only appraisal — FNMA 2055 (also called "drive-by") */
  DRIVE_BY:         'DRIVE_BY',
  /** Alias for DRIVE_BY used in engagement creation forms */
  EXTERIOR_ONLY:    'EXTERIOR_ONLY',
  /** FNMA 1004D desktop appraisal (no inspection) */
  DESKTOP_APPRAISAL: 'DESKTOP_APPRAISAL',
  /** Alias — backward compat */
  DESKTOP_REVIEW:   'DESKTOP_REVIEW',
  /** FNMA 1073 condominium appraisal */
  CONDO_APPRAISAL:  'CONDO_APPRAISAL',
  /** Hybrid: third-party inspector + desk appraiser */
  HYBRID_APPRAISAL: 'HYBRID_APPRAISAL',
  /** Alias — backward compat */
  HYBRID:           'HYBRID',
  /** Non-USPAP evaluation (evaluation report) */
  EVALUATION:       'EVALUATION',

  // ── BPO ──────────────────────────────────────────────────────────────────
  /**
   * Generic BPO — used at engagement-creation time when the client hasn't
   * yet specified exterior vs interior.  Fulfillment orders must use
   * BPO_EXTERIOR or BPO_INTERIOR.
   */
  BPO:              'BPO',
  /** BPO exterior only — no interior access required */
  BPO_EXTERIOR:     'BPO_EXTERIOR',
  /** BPO interior — full property access required */
  BPO_INTERIOR:     'BPO_INTERIOR',

  // ── Reviews ───────────────────────────────────────────────────────────────
  /** Appraiser field review of an existing appraisal */
  FIELD_REVIEW:     'FIELD_REVIEW',
  /** Appraiser desk review of an existing appraisal */
  DESK_REVIEW:      'DESK_REVIEW',
  /** Desktop Valuation Review */
  DVR:              'DVR',

  // ── Automated / AI ────────────────────────────────────────────────────────
  /** Automated Valuation Model */
  AVM:              'AVM',
  /** After-Repair Value analysis */
  ARV:              'ARV',
  /** AVM + Broker hybrid */
  AVB:              'AVB',
  /** Reconsideration of Value (FHFA 2024 guidance) */
  ROV:              'ROV',
  /** AI fraud / collusion analysis of an existing appraisal */
  FRAUD_ANALYSIS:   'FRAUD_ANALYSIS',
  /** FNMA Form 1033 Individual Appraisal Field Review */
  ANALYSIS_1033:    'ANALYSIS_1033',
  /** Short-Term Rental Feasibility Report */
  STR_FEASIBILITY:  'STR_FEASIBILITY',
  /** Absorption Rate & Sellout Analysis */
  ABSORPTION_STUDY: 'ABSORPTION_STUDY',
} as const;

export type ProductType = typeof ProductType[keyof typeof ProductType];

// =============================================================================
// PRODUCT DEFINITION
// =============================================================================

/**
 * Everything the platform needs to know about a product type in one place.
 *
 * `primaryDocumentCategory`
 *   The document category that holds the primary deliverable Axiom will
 *   evaluate.  Drives document routing in AxiomAutoTriggerService.
 *
 * `supportingDocumentCategories`
 *   Additional categories that may accompany the primary document (photos,
 *   comps, etc.).  For informational use — not required for Axiom submission.
 *
 * `requiresPhysicalInspection`
 *   True when a vendor must physically visit the property.  Used by vendor
 *   dispatch rules (no automation / AVM vendor pool for these).
 *
 * `requiresCertifiedAppraiser`
 *   True when USPAP / licensing requirements mandates a certified appraiser.
 *
 * `isAutomated`
 *   True when the product is fulfilled algorithmically (AVM, AVB, AI analysis)
 *   with no vendor dispatch.
 *
 * `bulkAnalysisType`
 *   The BulkAnalysisType string for products orderable via bulk tape upload.
 *   Drives ANALYSIS_TYPE_TO_PRODUCT_TYPE derivation (see bulk-portfolio.types.ts).
 *   Leave undefined for products not available in bulk upload.
 */
export interface ProductDefinition {
  label: string;
  primaryDocumentCategory: DocumentCategory;
  supportingDocumentCategories: DocumentCategory[];
  requiresPhysicalInspection: boolean;
  requiresCertifiedAppraiser: boolean;
  isAutomated: boolean;
  // Set for products orderable via bulk tape upload (drives ANALYSIS_TYPE_TO_PRODUCT_TYPE)
  bulkAnalysisType?: string;
}

// =============================================================================
// PRODUCT CATALOG
// =============================================================================

/**
 * The authoritative catalog of every product type the platform supports.
 *
 * Rules:
 *  - Every ProductType key MUST have an entry here.
 *  - All downstream routing (Axiom document category, vendor dispatch, bulk
 *    analysis mapping) MUST derive from this catalog — never from ad-hoc tables.
 *  - To add a product: add a key to `ProductType` + one entry here.
 *  - To change routing: edit the entry here, not the callers.
 */
export const PRODUCT_CATALOG: Record<ProductType, ProductDefinition> = {
  // ── Appraisal family ──────────────────────────────────────────────────────

  FULL_APPRAISAL: {
    label: 'Full Appraisal (1004)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES, DocumentCategory.FLOOR_PLAN],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  DRIVE_BY: {
    label: 'Drive-By / Exterior Only (2055)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  EXTERIOR_ONLY: {
    label: 'Exterior Only Appraisal',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  DESKTOP_APPRAISAL: {
    label: 'Desktop Appraisal (1004D)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  DESKTOP_REVIEW: {
    label: 'Desktop Review',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  CONDO_APPRAISAL: {
    label: 'Condominium Appraisal (1073)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES, DocumentCategory.FLOOR_PLAN],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  HYBRID_APPRAISAL: {
    label: 'Hybrid Appraisal',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.INSPECTION_REPORT, DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,   // inspector visits; appraiser does desk portion
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  HYBRID: {
    label: 'Hybrid Appraisal (legacy alias)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.INSPECTION_REPORT, DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  EVALUATION: {
    label: 'Evaluation (non-USPAP)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  // ── BPO ──────────────────────────────────────────────────────────────────

  BPO: {
    label: 'BPO (inspection type TBD)',
    primaryDocumentCategory: DocumentCategory.BPO_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  BPO_EXTERIOR: {
    label: 'BPO — Exterior Only',
    primaryDocumentCategory: DocumentCategory.BPO_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  BPO_INTERIOR: {
    label: 'BPO — Interior',
    primaryDocumentCategory: DocumentCategory.BPO_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES, DocumentCategory.FLOOR_PLAN],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  // ── Reviews ───────────────────────────────────────────────────────────────

  FIELD_REVIEW: {
    label: 'Field Review',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.PHOTO, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
  },

  DESK_REVIEW: {
    label: 'Desk Review',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
    bulkAnalysisType: 'QUICK_REVIEW',
  },

  DVR: {
    label: 'Desktop Valuation Review',
    primaryDocumentCategory: DocumentCategory.DVR_REPORT,
    supportingDocumentCategories: [DocumentCategory.APPRAISAL_REPORT, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
    bulkAnalysisType: 'DVR',
  },

  // ── Automated / AI ────────────────────────────────────────────────────────

  AVM: {
    label: 'Automated Valuation Model',
    primaryDocumentCategory: DocumentCategory.AVM_REPORT,
    supportingDocumentCategories: [],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: true,
    bulkAnalysisType: 'AVM',
  },

  ARV: {
    label: 'After-Repair Value',
    primaryDocumentCategory: DocumentCategory.ARV_REPORT,
    supportingDocumentCategories: [DocumentCategory.SUPPORTING_DOCUMENT, DocumentCategory.PHOTO],
    requiresPhysicalInspection: true,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  AVB: {
    label: 'AVM + Broker',
    primaryDocumentCategory: DocumentCategory.AVM_REPORT,
    supportingDocumentCategories: [DocumentCategory.BPO_REPORT],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: true,
  },

  ROV: {
    label: 'Reconsideration of Value (FHFA 2024)',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.ROV_EVIDENCE, DocumentCategory.ROV_COMPARABLE, DocumentCategory.ROV_RESPONSE],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
    bulkAnalysisType: 'ROV',
  },

  FRAUD_ANALYSIS: {
    label: 'AI Fraud Analysis',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.FRAUD_ANALYSIS_REPORT],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: true,
    bulkAnalysisType: 'FRAUD',
  },

  ANALYSIS_1033: {
    label: 'FNMA Form 1033 Field Review',
    primaryDocumentCategory: DocumentCategory.APPRAISAL_REPORT,
    supportingDocumentCategories: [DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: true,
    isAutomated: false,
    bulkAnalysisType: 'ANALYSIS_1033',
  },

  STR_FEASIBILITY: {
    label: 'Short-Term Rental Feasibility Report',
    primaryDocumentCategory: DocumentCategory.STR_FEASIBILITY_REPORT,
    supportingDocumentCategories: [DocumentCategory.SUPPORTING_DOCUMENT],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },

  ABSORPTION_STUDY: {
    label: 'Absorption Rate & Sellout Analysis',
    primaryDocumentCategory: DocumentCategory.ABSORPTION_STUDY_REPORT,
    supportingDocumentCategories: [DocumentCategory.SUPPORTING_DOCUMENT, DocumentCategory.COMPARABLE_SALES],
    requiresPhysicalInspection: false,
    requiresCertifiedAppraiser: false,
    isAutomated: false,
  },
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Look up a product definition given any productType string — tolerates both
 * SCREAMING_SNAKE ('FULL_APPRAISAL') and the legacy snake_case values written
 * by older orders ('full_appraisal').
 *
 * Returns `undefined` if the productType is unknown; callers MUST handle this
 * case explicitly — no silent fallback is acceptable.
 */
export function lookupProductDefinition(productType: string | undefined): ProductDefinition | undefined {
  if (!productType) return undefined;
  return PRODUCT_CATALOG[productType.toUpperCase() as ProductType];
}

/**
 * All BulkAnalysisType → ProductType mappings derived from the catalog.
 * Replaces the hand-maintained ANALYSIS_TYPE_TO_PRODUCT_TYPE table in
 * bulk-portfolio.types.ts — import from there (which re-derives from here)
 * for backward compat.
 */
export const BULK_ANALYSIS_TYPE_TO_PRODUCT_TYPE: Record<string, ProductType> = Object.fromEntries(
  Object.entries(PRODUCT_CATALOG)
    .filter(([, def]) => def.bulkAnalysisType != null)
    .map(([pt, def]) => [def.bulkAnalysisType!, pt as ProductType]),
);
