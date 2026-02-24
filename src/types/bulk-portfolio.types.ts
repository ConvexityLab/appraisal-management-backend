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

// ─── Analysis Type ───────────────────────────────────────────────────────────

export type BulkAnalysisType =
  | 'AVM'
  | 'FRAUD'
  | 'ANALYSIS_1033'
  | 'QUICK_REVIEW'
  | 'DVR'
  | 'ROV';

/** Maps BulkAnalysisType → ProductType enum value (string) */
export const ANALYSIS_TYPE_TO_PRODUCT_TYPE: Record<BulkAnalysisType, string> = {
  AVM: 'avm',
  FRAUD: 'fraud_analysis',
  ANALYSIS_1033: 'analysis_1033',
  QUICK_REVIEW: 'desk_review',
  DVR: 'dvr',
  ROV: 'rov',
};

/** Display labels for the UI */
export const BULK_ANALYSIS_LABELS: Record<BulkAnalysisType, string> = {
  AVM: 'AVM',
  FRAUD: 'Fraud Analysis',
  ANALYSIS_1033: '1033 Field Review',
  QUICK_REVIEW: 'Quick Review',
  DVR: 'DVR (Desktop)',
  ROV: 'ROV',
};

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

  // ── Result (populated by service after submission) ────────────────────────
  status?: BulkItemStatus;
  validationErrors?: string[];
  orderId?: string;
  orderNumber?: string;
  errorMessage?: string;
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
  /** Portfolio-level summary appended after tape evaluation completes */
  reviewSummary?: ReviewTapeJobSummary;
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
