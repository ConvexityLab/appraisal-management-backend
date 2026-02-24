/**
 * Review Tape Types
 *
 * Generic type definitions for the Criteria Review workflow.
 *
 * A "Risk Tape" is a structured spreadsheet (Excel / CSV) containing up to 73
 * fields per loan.  Rows are evaluated against a versioned ReviewProgram to
 * produce a ReviewTapeResult (risk score + flag breakdown + overall decision).
 *
 * The ReviewProgram carries a `programType` that identifies WHAT is being
 * reviewed (Fraud, QC, 1033, Portfolio, etc.).  The evaluation engine is
 * completely generic — the same DSL and the same service evaluate every type.
 *
 * Processing mode discriminates between tape evaluation (immediate, no vendor
 * assignment) and the existing order-creation path.
 *
 * Source: data/fraud/VisionAppraisal_Risk_Template.xlsx  (Sheet 1 + Sheet 3)
 */

// ─── Processing Mode ──────────────────────────────────────────────────────────

export type TapeProcessingMode =
  | 'TAPE_EVALUATION'
  | 'ORDER_CREATION'
  | 'DOCUMENT_EXTRACTION';

// ─── Program Type ─────────────────────────────────────────────────────────────

/** What kind of criteria are being reviewed — does NOT change the evaluation logic. */
export type ReviewProgramType =
  | 'FRAUD'
  | 'QC'
  | 'PORTFOLIO'
  | '1033'
  | 'APPRAISAL_REVIEW';

// ─── Risk Tape Item (73 canonical fields) ─────────────────────────────────────

/**
 * All 73 fields from the VisionAppraisal Risk Tape, organized in 8 sections.
 * Calculated fields (LTV, CLTV, appreciation%, AVM gap%, Non-MLS%) are always
 * recomputed server-side from source inputs; client-provided values are ignored.
 */
export interface RiskTapeItem {
  /** Original row index in the uploaded file (0-based) */
  rowIndex: number;

  // ── Section A — Loan / Borrower Identity (cols 1–15) ──────────────────────
  loanNumber?: string;
  borrowerName?: string;
  /** Purchase | Rate-Term Refi | Cash-Out Refi | Bridge | DSCR | Other */
  loanPurpose?: string;
  /** Conventional | Jumbo | Non-QM | DSCR | Bridge | Private Lender */
  loanType?: string;
  loanAmount?: number;
  firstLienBalance?: number;
  secondLienBalance?: number;
  /** Appraised value from the appraisal report — the primary subject value */
  appraisedValue?: number;
  contractPrice?: number;
  priorPurchasePrice?: number;
  priorPurchaseDate?: string;
  /** CALCULATED: loanAmount / appraisedValue — always server-computed */
  ltv?: number;
  /** CALCULATED: (firstLienBalance + secondLienBalance) / appraisedValue */
  cltv?: number;
  /** Owner-Occupied | Second Home | Investment */
  occupancyType?: string;
  /** Debt Service Coverage Ratio */
  dscr?: number;

  // ── Section B — Property Identity (cols 16–21) ────────────────────────────
  propertyAddress?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  censusTract?: string;

  // ── Section C — Property Classification (cols 22–23) ─────────────────────
  /** SFR | Condo | Townhome | 2-4 Unit | Manufactured | Mixed-Use (SBC) | Other */
  propertyType?: string;
  units?: number;

  // ── Section D — Physical Characteristics (cols 24–35) ────────────────────
  yearBuilt?: number;
  /** Gross Living Area (sq ft) */
  gla?: number;
  basementSf?: number;
  lotSize?: number;
  bedrooms?: number;
  bathsFull?: number;
  bathsHalf?: number;
  parking?: string;
  /** UAD: C1–C6 or descriptive (Good/Average/Fair/Poor) */
  conditionRating?: string;
  /** UAD: Q1–Q6 or descriptive */
  qualityRating?: string;
  effectiveAge?: string;
  renovationDate?: string;

  // ── Section E — Transaction / Appraisal (cols 36–39) ─────────────────────
  appraisalEffectiveDate?: string;
  appraiserLicense?: string;
  /** 1004 | 1073 | 1025 | 2090 | 2055 */
  formType?: string;
  reconciliationNotes?: string;

  // ── Section F — Prior Sales / Appreciation (cols 40–45) ──────────────────
  priorSale24mPrice?: number;
  priorSale24mDate?: string;
  /** CALCULATED: (appraisedValue - priorSale24mPrice) / priorSale24mPrice */
  appreciation24m?: number;
  priorSale36mPrice?: number;
  priorSale36mDate?: string;
  /** CALCULATED: (appraisedValue - priorSale36mPrice) / priorSale36mPrice */
  appreciation36m?: number;

  // ── Section G — Market & Comparables (cols 46–59) ────────────────────────
  /** Increasing | Stable | Declining */
  marketTrend?: string;
  avgDom?: number;
  monthsInventory?: number;
  numComps?: number;
  compPriceRangeLow?: number;
  compPriceRangeHigh?: number;
  avgPricePerSf?: number;
  avgDistanceMi?: number;
  maxDistanceMi?: number;
  compsDateRangeMonths?: number;
  /** Count of non-MLS / non-public comparable sales */
  nonMlsCount?: number;
  /** CALCULATED: nonMlsCount / numComps */
  nonMlsPct?: number;
  /** Average net adjustment % across comparables */
  avgNetAdjPct?: number;
  /** Average gross adjustment % across comparables */
  avgGrossAdjPct?: number;

  // ── Section H — Risk Flags & Decision (cols 60–73) ───────────────────────
  /** Tape-provided auto-flag value (server recomputes) */
  highNetGrossFlag?: string;
  /** Yes | No — chain of title red flags noted by appraiser */
  chainOfTitleRedFlags?: boolean | string;
  /** Yes | No — derived from loanPurpose */
  cashOutRefi?: boolean | string;
  avmValue?: number;
  /** CALCULATED: |appraisedValue - avmValue| / avmValue */
  avmGapPct?: number;
  /** Yes | No — external lookup or manual entry */
  highRiskGeographyFlag?: boolean | string;
  ucdpSsrScore?: string;
  /** Low | Medium | High */
  collateralRiskRating?: string;
  /** Yes | No */
  appraiserGeoCompetency?: boolean | string;
  /** Tape-provided appreciation flag (server recomputes) */
  unusualAppreciationFlag?: string;
  /** Tape-provided DSCR flag (server recomputes) */
  dscrFlag?: string;
  /** Tape-provided non-public comps flag (server recomputes) */
  nonPublicCompsFlag?: string;
  /** Client-provided decision (may differ from server-computed) */
  overallDecision?: string;
  reviewerNotes?: string;
}

// ─── Review Thresholds ────────────────────────────────────────────────────────

/**
 * All threshold values that drive auto-flag firing.
 * These are part of the ReviewProgram and are versioned with it.
 */
export interface ReviewThresholds {
  /** LTV threshold (e.g. 0.80 = 80%) — HIGH_LTV flag */
  ltv: number;
  /** CLTV threshold (e.g. 0.90 = 90%) — HIGH_CLTV flag */
  cltv: number;
  /** DSCR minimum (e.g. 1.0) — DSCR_FLAG */
  dscrMinimum: number;
  /** 24-month appreciation threshold (e.g. 0.25 = 25%) */
  appreciation24mPct: number;
  /** 36-month appreciation threshold (e.g. 0.35 = 35%) */
  appreciation36mPct: number;
  /** Net adjustment % threshold (e.g. 0.15 = 15%) */
  netAdjustmentPct: number;
  /** Gross adjustment % threshold (e.g. 0.25 = 25%) */
  grossAdjustmentPct: number;
  /** Non-MLS % threshold (e.g. 0.20 = 20%) */
  nonMlsPct: number;
  /** AVM gap % threshold (e.g. 0.10 = 10%) */
  avmGapPct: number;
}

// ─── Flag condition DSL ───────────────────────────────────────────────────────

export type ReviewFlagOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NOT_NULL' | 'IS_TRUE';
export type ReviewConditionOperator = 'AND' | 'OR';

export interface ReviewFlagRule {
  field: keyof RiskTapeItem;
  op: ReviewFlagOperator;
  /** If present, resolve value from thresholds[thresholdKey] */
  thresholdKey?: keyof ReviewThresholds;
  /** Literal comparison value (used when thresholdKey is absent) */
  value?: number | boolean;
}

export interface ReviewFlagCondition {
  operator: ReviewConditionOperator;
  rules: ReviewFlagRule[];
}

// ─── Fired Flag (result of evaluation) ───────────────────────────────────────

export type ReviewFlagSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * A fired flag attached to a ReviewTapeResult — one instance per evaluated rule.
 * Contains both the rule definition and the evaluated evidence.
 */
export interface ReviewAutoFlag {
  id: string;
  label: string;
  description: string;
  severity: ReviewFlagSeverity;
  weight: number;
  /** true when the flag condition evaluated to true for this loan */
  isFired: boolean;
  /** The actual field value(s) that caused the flag to fire */
  actualValue?: number | string | boolean | null;
  /** The threshold value the actual value was compared against */
  thresholdValue?: number | boolean | null;
}

// ─── Review Program Definition ────────────────────────────────────────────────

/**
 * Auto-flag definition stored in the ReviewProgram.
 * Each entry has an evaluation condition referencing threshold keys.
 */
export interface ReviewProgramAutoFlagDef {
  id: string;
  label: string;
  description: string;
  severity: ReviewFlagSeverity;
  weight: number;
  condition: ReviewFlagCondition;
}

/**
 * Manual (Y/N) flag definition — fires when the named boolean field is true
 * (or false for inverted flags — see TapeEvaluationService).
 */
export interface ReviewProgramManualFlagDef {
  id: string;
  label: string;
  description: string;
  field: keyof RiskTapeItem;
  severity: ReviewFlagSeverity;
  weight: number;
}

/**
 * Decision threshold rules.  Score >= reject.minScore → Reject,
 * >= conditional.minScore → Conditional, else → Accept.
 */
export interface ReviewDecisionRules {
  reject: { minScore: number };
  conditional: { minScore: number };
  accept: { maxScore: number };
}

export type ReviewProgramStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type ReviewDecision = 'Accept' | 'Conditional' | 'Reject';

/**
 * A versioned, client-attributed review program.
 * Stored in the `review-programs` Cosmos container (partitioned by /clientId).
 *
 * clientId === null means the program is a platform-wide default available
 * to all clients.
 *
 * programType identifies WHAT is being reviewed.  The evaluation engine is
 * identical for all types — only the flag definitions and thresholds differ.
 */
export interface ReviewProgram {
  id: string;
  name: string;
  version: string;
  /** What kind of criteria this program evaluates */
  programType: ReviewProgramType;
  status: ReviewProgramStatus;
  /** null = platform default (all clients); set to restrict to one client */
  clientId: string | null;
  createdAt: string;
  thresholds: ReviewThresholds;
  autoFlags: ReviewProgramAutoFlagDef[];
  manualFlags: ReviewProgramManualFlagDef[];
  decisionRules: ReviewDecisionRules;
}

// ─── Evaluation Result ────────────────────────────────────────────────────────

/**
 * Per-loan result produced by TapeEvaluationService.
 * Extends RiskTapeItem (contains post-calculation field values) with
 * evaluation output: fired flags, risk score, and overall decision.
 */
export interface ReviewTapeResult extends RiskTapeItem {
  /** Weighted risk score 0–100 */
  overallRiskScore: number;
  /** Server-computed decision (may differ from tape-provided overallDecision) */
  computedDecision: ReviewDecision;
  /** All auto-flags evaluated (fired and not-fired) */
  autoFlagResults: ReviewAutoFlag[];
  /** All manual flags evaluated */
  manualFlagResults: ReviewAutoFlag[];
  /** Any data quality issues found during evaluation (missing source fields) */
  dataQualityIssues: string[];
  /** ISO timestamp of when the evaluation ran */
  evaluatedAt: string;
  /** The program id + version used for this evaluation */
  programId: string;
  programVersion: string;
  // ── Document Extraction fields (set when result came from DOCUMENT_EXTRACTION mode) ──
  /** Axiom evaluationId for the extraction job that produced this result */
  axiomEvaluationId?: string;
  /** Axiom overall extraction confidence score (0–1) */
  axiomExtractionConfidence?: number;
  // ── Reviewer override (set via PATCH /:jobId/review-results/:loanNumber) ──
  /** Reviewer-supplied decision override; takes precedence over computedDecision in the UI */
  overrideDecision?: ReviewDecision;
  /** Reason the reviewer provided for the override (required when overrideDecision is set) */
  overrideReason?: string;
  /** ISO timestamp when the override was last saved */
  overriddenAt?: string;
  /** User id of the reviewer who saved the override */
  overriddenBy?: string;
}

// ─── Batch Evaluation Summary ─────────────────────────────────────────────────

/**
 * Portfolio-level summary attached to a BulkPortfolioJob after tape evaluation.
 */
export interface ReviewTapeJobSummary {
  totalLoans: number;
  acceptCount: number;
  conditionalCount: number;
  rejectCount: number;
  avgRiskScore: number;
  maxRiskScore: number;
  flagBreakdown: Record<string, number>; // flagId → count of loans where it fired
}

// ─── Document Extraction (Sprint 4 — DOCUMENT_EXTRACTION mode) ───────────────

/**
 * Request sent to Axiom for structured field extraction from a PDF appraisal.
 *
 * Axiom resolves the DocumentSchema and evaluation criteria from
 * requestType + programId — no schema is passed inline.
 * The /documents/extract endpoint is currently stubbed; the exact contract
 * will be finalised collaboratively with the Axiom team.
 */
export interface TapeExtractionRequest {
  /** BulkPortfolioJob this extraction belongs to (for webhook correlation) */
  jobId: string;
  /** Loan identifier — used to correlate the Axiom result back to a tape row */
  loanNumber: string;
  /** Azure Blob Storage SAS URL pointing to the appraisal PDF */
  documentUrl: string;
  /** Review program id — Axiom uses this to look up the correct DocumentSchema */
  programId: string;
  /** URL this server exposes for Axiom to POST the completed result to */
  webhookUrl: string;
}

/** Lifecycle states for a single-loan document extraction */
export type ExtractionStatus =
  | 'PENDING'     // Submitted to Axiom; acknowledgement not yet received
  | 'PROCESSING'  // Axiom acknowledged; extraction in progress
  | 'EXTRACTED'   // Axiom returned extracted fields; tape evaluation pending
  | 'EVALUATED'   // Tape evaluation complete; final ReviewTapeResult ready
  | 'FAILED';     // Extraction or evaluation failed

/**
 * Per-loan extraction state tracked in BulkPortfolioJob.extractionItems
 * when processingMode === 'DOCUMENT_EXTRACTION'.
 */
export interface ReviewTapeExtractionItem {
  loanNumber: string;
  documentUrl: string;
  /** Axiom evaluationId returned after submission */
  axiomEvaluationId?: string;
  extractionStatus: ExtractionStatus;
  /** ISO timestamp when submitted to Axiom */
  submittedAt: string;
  /** ISO timestamp when Axiom returned extracted fields */
  extractedAt?: string;
  /** ISO timestamp when tape evaluation completed */
  evaluatedAt?: string;
  /** Axiom overall confidence score (0–1) */
  extractionConfidence?: number;
  /** Final tape evaluation result — populated when extractionStatus === 'EVALUATED' */
  result?: ReviewTapeResult;
  /** Error detail when extractionStatus === 'FAILED' */
  errorMessage?: string;
  /** Data quality issues found while mapping Axiom fields to RiskTapeItem */
  dataQualityIssues?: string[];
}

/**
 * Webhook payload Axiom sends when a TAPE_EXTRACTION evaluation completes.
 *
 * The extractedFields key names match RiskTapeItem field names exactly —
 * this is enforced by the DocumentSchema registered in Axiom's
 * DocumentSchemas container using our canonical field names.
 */
export interface TapeExtractionWebhookPayload {
  evaluationId: string;
  /** BulkPortfolioJob id threaded through the original extraction request */
  jobId: string;
  loanNumber: string;
  status: 'completed' | 'failed';
  timestamp: string;
  /** Extracted field values — keys are RiskTapeItem field names */
  extractedFields?: Partial<RiskTapeItem>;
  /** Axiom overall confidence score (0–1) */
  extractionConfidence?: number;
  /** Per-field confidence scores (optional, provided by Axiom when available) */
  fieldConfidence?: Partial<Record<keyof RiskTapeItem, number>>;
  error?: string;
}
