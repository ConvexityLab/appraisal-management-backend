/**
 * Bulk Portfolio Types
 *
 * A client submits a spreadsheet (CSV / XLSX) of properties to be evaluated.
 * Each row specifies an analysis type. The operator reviews and corrects the
 * parsed rows in the UI, then submits. The service creates one AppraisalOrder
 * per valid row and persists a BulkPortfolioJob record for tracking.
 *
 * Analysis types supported:
 *   AVM           – Automated Valuation Model (no existing appraisal needed)
 *   FRAUD         – AI fraud / collusion analysis of an existing appraisal
 *   ANALYSIS_1033 – FNMA Form 1033 Individual Appraisal Field Review
 *   QUICK_REVIEW  – Rapid desk review (Form 2000D / desk)
 *   DVR           – Desktop Valuation Review
 *   ROV           – Reconsideration of Value (FHFA Jan 2024 guidance)
 *
 * When processingMode === 'TAPE_EVALUATION', items are RiskTapeItem[] and
 * the service evaluates them immediately instead of creating AppraisalOrders.
 */

import type {
  TapeProcessingMode,
  ReviewTapeResult,
  ReviewTapeJobSummary,
  ReviewTapeExtractionItem,
} from './review-tape.types.js';
export type { TapeProcessingMode } from './review-tape.types.js';
import { BULK_ANALYSIS_TYPE_TO_PRODUCT_TYPE } from './product-catalog.js';
import type { ProductType } from './product-catalog.js';

// ─── Analysis Type ───────────────────────────────────────────────────────────

export type BulkAnalysisType =
  | 'AVM'
  | 'FRAUD'
  | 'ANALYSIS_1033'
  | 'QUICK_REVIEW'
  | 'DVR'
  | 'ROV';

export type BulkEngagementGranularity = 'PER_BATCH' | 'PER_LOAN';

/**
 * Maps BulkAnalysisType → canonical ProductType.
 *
 * Derived from PRODUCT_CATALOG — do NOT edit this table directly.
 * To change a mapping: update the `bulkAnalysisType` field on the relevant
 * ProductDefinition in src/types/product-catalog.ts.
 */
export const ANALYSIS_TYPE_TO_PRODUCT_TYPE: Record<BulkAnalysisType, ProductType> =
  Object.fromEntries(
    Object.entries(BULK_ANALYSIS_TYPE_TO_PRODUCT_TYPE)
      .filter(([key]) => ([
        'AVM', 'FRAUD', 'ANALYSIS_1033', 'QUICK_REVIEW', 'DVR', 'ROV',
      ] as string[]).includes(key)),
  ) as Record<BulkAnalysisType, ProductType>;

/** Display labels for the UI */
export const BULK_ANALYSIS_LABELS: Record<BulkAnalysisType, string> = {
  AVM: 'AVM',
  FRAUD: 'Fraud Analysis',
  ANALYSIS_1033: '1033 Field Review',
  QUICK_REVIEW: 'Quick Review',
  DVR: 'DVR (Desktop)',
  ROV: 'ROV',
};

/**
 * Maps BulkAnalysisType → the Axiom program and version to invoke for document
 * schema extraction and criteria evaluation.
 *
 * This is domain knowledge and must live in code — not in env vars.
 * To change a mapping: update the entry here. All callers derive from this table.
 */
export const ANALYSIS_TYPE_TO_AXIOM_PROGRAM: Record<BulkAnalysisType, { programId: string; programVersion: string }> = {
  AVM:           { programId: 'FNMA-URAR', programVersion: '1.0.0' },
  FRAUD:         { programId: 'FNMA-URAR', programVersion: '1.0.0' },
  ANALYSIS_1033: { programId: 'FNMA-URAR', programVersion: '1.0.0' },
  QUICK_REVIEW:  { programId: 'FNMA-URAR', programVersion: '1.0.0' },
  DVR:           { programId: 'FNMA-URAR', programVersion: '1.0.0' },
  ROV:           { programId: 'FNMA-URAR', programVersion: '1.0.0' },
};

// ─── Multi-product support ────────────────────────────────────────────────────

/** Maximum number of additional product slots (product_2 through product_5) */
export const MAX_ADDITIONAL_PRODUCTS = 4;

/**
 * An additional product to order for the same property row.
 * Parsed from product_2/fee_2 through product_5/fee_5 spreadsheet columns.
 */
export interface AdditionalProduct {
  analysisType: BulkAnalysisType;
  fee?: number;
  /** Populated after order creation */
  orderId?: string;
  orderNumber?: string;
  status?: BulkItemStatus;
  errorMessage?: string;
}

// ─── Row-level item ───────────────────────────────────────────────────────────

/**
 * Per-row validation status (populated client-side before submit, then updated
 * server-side with CREATED / FAILED after order creation).
 */
export type BulkItemStatus = 'VALID' | 'INVALID' | 'CREATED' | 'FAILED' | 'SKIPPED';

/**
 * One row from the uploaded spreadsheet.
 *
 * Required fields (for all types): propertyAddress, city, state, zipCode,
 *   borrowerFirstName, borrowerLastName, analysisType.
 *
 * Review-specific (FRAUD, ANALYSIS_1033, QUICK_REVIEW, ROV):
 *   existingAppraisalDate, existingAppraisedValue, appraiserName,
 *   appraiserLicense, appraiserLicenseState.
 *
 * UAD / 1033-specific:
 *   appraisalFormType, conditionRating (C1–C6), qualityRating (Q1–Q6),
 *   gla, lotSize, yearBuilt, bedrooms, bathrooms, cuRiskScore, apn.
 */
export interface BulkPortfolioItem {
  /** Original 1-based row number in the uploaded file */
  rowIndex: number;

  analysisType: BulkAnalysisType;

  // ── Property ─────────────────────────────────────────────────────────────
  propertyAddress: string;
  city: string;
  state: string;       // 2-letter state code
  zipCode: string;     // 5-digit
  county?: string;
  apn?: string;        // Assessor Parcel Number (UAD: ADDITIONAL_IDENTIFIER)

  // ── Borrower ──────────────────────────────────────────────────────────────
  borrowerFirstName: string;
  borrowerLastName: string;
  borrowerEmail?: string;
  borrowerPhone?: string;

  // ── Loan (optional context) ───────────────────────────────────────────────
  loanNumber?: string;
  loanAmount?: number;
  loanType?: string;       // CONVENTIONAL | FHA | VA | USDA | JUMBO
  loanPurpose?: string;    // PURCHASE | REFINANCE | CASH_OUT | HELOC

  // ── Engagement linkage (set when bulk intake creates via an engagement) ─────
  /** Optional FK to a parent LenderEngagement that owns this item */
  engagementId?: string;

  // ── Order config ──────────────────────────────────────────────────────────
  propertyType?: string;   // SFR | CONDO | TOWNHOME | MULTI_FAMILY | …
  priority?: 'NORMAL' | 'RUSH';
  notes?: string;

  // ── Existing appraisal (FRAUD, ANALYSIS_1033, QUICK_REVIEW, ROV) ─────────
  existingAppraisalDate?: string;     // ISO date string (effective date)
  existingAppraisedValue?: number;
  appraiserName?: string;
  appraiserLicense?: string;
  appraiserLicenseState?: string;

  // ── UAD / 1033 fields ─────────────────────────────────────────────────────
  /** Appraisal form number: '1004' | '1073' | '1025' | '2090' | '2055' */
  appraisalFormType?: string;
  /** UAD condition rating C1–C6 */
  conditionRating?: string;
  /** UAD quality rating Q1–Q6 */
  qualityRating?: string;
  /** Gross Living Area (sq ft) */
  gla?: number;
  /** Lot size (sq ft) */
  lotSize?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  /** Collateral Underwriter risk score 1.0–5.0; preferred ≤2.5 */
  cuRiskScore?: number;

  // ── Document (optional — Scenario A: URL in tape CSV for auto-upload) ───────
  /**
   * Optional URL of the appraisal PDF to automatically fetch and store in blob
   * storage when this order is created.  Populated from a "document url" /
   * "appraisal url" / "pdf url" column in the tape CSV.
   */
  documentUrl?: string;

  // ── Additional products (multi-product per row) ───────────────────────────
  /**
   * Additional products to order for the same property/borrower.
   * Parsed from product_2/fee_2 through product_5/fee_5 spreadsheet columns.
   * The primary product is still in `analysisType` (product_1).
   */
  additionalProducts?: AdditionalProduct[];

  // ── Result (populated by service after submission) ────────────────────────
  status?: BulkItemStatus;
  validationErrors?: string[];
  orderId?: string;
  orderNumber?: string;
  errorMessage?: string;

  // ── Document fetch status (Scenario A — set by service during order creation) ─
  /**
   * Status of the automated document fetch when a `documentUrl` was provided.
   * Set by the order-creation service after it attempts to pull the PDF from the URL.
   */
  documentFetchStatus?: 'FETCHING' | 'STORED' | 'FAILED';
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export type BulkJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

/**
 * A single bulk upload job record, persisted in the `bulk-portfolio-jobs`
 * Cosmos container.  Partitioned by /tenantId.
 *
 * When processingMode === 'TAPE_EVALUATION', items contains ReviewTapeResult[]
 * and no AppraisalOrders are created.  All other modes produce AppraisalOrders
 * and items contains BulkPortfolioItem[].
 */
export interface BulkPortfolioJob {
  id: string;
  tenantId: string;
  clientId: string;
  jobName?: string;
  fileName: string;
  engagementGranularity?: BulkEngagementGranularity;
  status: BulkJobStatus;
  submittedAt: string;    // ISO timestamp
  submittedBy: string;    // user id
  completedAt?: string;
  totalRows: number;
  successCount: number;
  failCount: number;
  skippedCount: number;
  /** Discriminates tape-evaluation jobs from order-creation jobs */
  processingMode?: TapeProcessingMode;
  /** The review program used for evaluation (tape mode only) */
  reviewProgramId?: string;
  reviewProgramVersion?: string;
  /** Optional FK to a parent LenderEngagement (Phase 5 bulk-intake bridge) */
  engagementId?: string;
  /** Portfolio-level summary appended after tape evaluation completes */
  reviewSummary?: ReviewTapeJobSummary;
  /** Axiom bulk pipeline correlation metadata for TAPE_EVALUATION jobs */
  axiomPipelineJobId?: string;
  axiomBatchId?: string;
  axiomSubmittedAt?: string;
  axiomSubmissionStatus?: 'queued' | 'submitted' | 'failed';
  axiomSubmissionError?: string;
  items: BulkPortfolioItem[] | ReviewTapeResult[];
  // ── Document Extraction tracking (processingMode === 'DOCUMENT_EXTRACTION') ──
  /** Per-loan extraction state; replaces items[] for DOCUMENT_EXTRACTION jobs */
  extractionItems?: ReviewTapeExtractionItem[];
  /** Loans successfully extracted and evaluated */
  extractedCount?: number;
  /** Loans where extraction or evaluation failed */
  extractionFailCount?: number;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface BulkSubmitRequest {
  clientId: string;
  jobName?: string;
  fileName: string;
  /** Optional FK to an existing engagement selected in the bulk wizard. */
  engagementId?: string;
  /** Controls whether new engagements are created once per batch or once per valid row. */
  engagementGranularity?: BulkEngagementGranularity;
  /**
   * Defaults to 'ORDER_CREATION' when absent.  Must be 'TAPE_EVALUATION' for
   * risk tape submissions.  When 'TAPE_EVALUATION', reviewProgramId is
   * required and items must conform to RiskTapeItem shape.
   */
  processingMode?: TapeProcessingMode;
  /** Required when processingMode === 'TAPE_EVALUATION' */
  reviewProgramId?: string;
  items: BulkPortfolioItem[] | import('./review-tape.types.js').RiskTapeItem[];
  /**
   * Required when processingMode === 'DOCUMENT_EXTRACTION'.
   * Maps loanNumber → Azure Blob SAS URL of the appraisal PDF to extract.
   */
  documentUrls?: Record<string, string>;
}

export interface BulkSubmitResponse {
  job: BulkPortfolioJob;
  message: string;
}
