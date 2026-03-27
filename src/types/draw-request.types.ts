/**
 * Construction Finance Module — Draw Request & Inspection Types
 *
 * Models the full draw lifecycle: submission → inspection → review → approval → disbursement.
 * DrawInspectionReport documents may be stored alongside DrawRequests
 * in the `draws` Cosmos container (partition key: /constructionLoanId).
 */

import type { BudgetCategory } from './construction-loan.types.js';

// ─── Draw Status ──────────────────────────────────────────────────────────────

/**
 * Lifecycle states for a draw request, in approximate chronological order.
 * Terminal states: DISBURSED, REJECTED.
 */
export type DrawRequestStatus =
  | 'DRAFT'               // GC / borrower is composing the draw request
  | 'SUBMITTED'           // Submitted to the lender for review
  | 'INSPECTION_ORDERED'  // A draw inspection has been requested
  | 'INSPECTION_COMPLETE' // Inspector has submitted the inspection report
  | 'UNDER_REVIEW'        // Loan admin is reviewing alongside the inspection report
  | 'APPROVED'            // Per-line amounts approved; pending disbursement authorization
  | 'PARTIALLY_APPROVED'  // Some line items approved at reduced amounts
  | 'DISBURSED'           // Funds have been sent — terminal success state
  | 'REJECTED'            // Draw denied; reason required — terminal failure state
  | 'ON_HOLD';            // Lien waiver, title, or other administrative hold

// ─── Lien Waiver Status ───────────────────────────────────────────────────────

/** Tracks lien waiver collection for a given draw. */
export type LienWaiverStatus =
  | 'NOT_REQUIRED'  // Lender has waived the requirement for this draw (documented decision)
  | 'PENDING'       // Required but not yet received
  | 'RECEIVED'      // Document received and logged
  | 'VERIFIED';     // Document reviewed and title / legal has confirmed it is valid

// ─── Inspection Type ──────────────────────────────────────────────────────────

/**
 * Method of draw inspection.
 * Vendor matching uses the existing vendor engine with the DRAW_INSPECTOR tag;
 * the type here drives scheduling and report template, not the vendor pool.
 */
export type DrawInspectionType =
  | 'FIELD'    // Inspector visits the construction site in person
  | 'DESKTOP'  // Inspector reviews photos and documentation remotely
  | 'DRIVE_BY' // Exterior-only observation from the street
  | 'FINAL';   // Final completion inspection; required before final draw and CO issuance

// ─── Draw Line-Item Request ───────────────────────────────────────────────────

/** A single line-item funding request within a draw submission. */
export interface DrawLineItemRequest {
  /** Refers to a BudgetLineItem.id in the current approved ConstructionBudget. */
  budgetLineItemId: string;

  /** Denormalised category for reporting without budget re-fetch. */
  category: BudgetCategory;

  /** Denormalised description for display in review workflow. */
  description: string;

  /** Amount requested for disbursement against this line item. */
  requestedAmount: number;

  /** Borrower / GC notes supporting the request (photos, invoices referenced). */
  supportingNotes?: string;
}

// ─── Draw Line-Item Result ────────────────────────────────────────────────────

/** The reviewer's decision on a single line item within a draw. Populated during UNDER_REVIEW → APPROVED. */
export interface DrawLineItemResult {
  /** Refers to the corresponding DrawLineItemRequest.budgetLineItemId. */
  budgetLineItemId: string;

  requestedAmount: number;

  /** Amount the reviewer approved (may be less than requested). */
  approvedAmount: number;

  /** approvedAmount × (retainagePercent / 100) — withheld per loan retainage terms. */
  retainageWithheld: number;

  /** approvedAmount − retainageWithheld — the net amount to wire/ACH for this line. */
  netDisbursed: number;

  /**
   * Inspector-certified percent complete for this specific line item.
   * Sourced from the linked DrawInspectionReport.lineItemFindings.
   */
  inspectorPercentComplete?: number;

  reviewerNotes?: string;

  status: 'APPROVED' | 'REDUCED' | 'DENIED';
}

// ─── Draw Inspection Report ───────────────────────────────────────────────────

/**
 * Inspection report submitted by a DRAW_INSPECTOR vendor.
 * Stored in the `draws` Cosmos container alongside the DrawRequest it supports.
 */
export interface DrawInspectionReport {
  id: string;
  drawRequestId: string;
  constructionLoanId: string;
  tenantId: string;

  inspectionType: DrawInspectionType;

  /** Vendor ID of the assigned inspector (from the existing vendor management system). */
  inspectorId: string;
  inspectorName: string;

  /** State license number of the inspector, if applicable. */
  inspectorLicense?: string;

  scheduledDate: string;

  /** Actual date the inspection was completed. Null until inspector submits. */
  completedDate?: string;

  // ── Progress Certification ────────────────────────────────────────────────
  /** Inspector-certified overall project completion percentage (0–100) as of this inspection. */
  overallPercentComplete: number;

  /** Overall percent from the previous accepted inspection report (or 0 for the first). */
  previousOverallPercent: number;

  /** overallPercentComplete − previousOverallPercent — how much progress was made this draw period. */
  percentCompleteThisDraw: number;

  // ── Per-Line Findings ─────────────────────────────────────────────────────
  lineItemFindings: {
    /** Refers to BudgetLineItem.id in the current budget. */
    budgetLineItemId: string;

    /** Denormalised for display without budget re-fetch. */
    category: string;
    description: string;

    /** Percent complete certified by this inspector at the previous inspection. */
    previousPercent: number;

    /** Percent complete certified by this inspector as of this inspection. */
    currentPercent: number;

    inspectorNotes?: string;
  }[];

  // ── Photo Documentation ───────────────────────────────────────────────────
  photos: {
    id: string;
    url: string;
    caption?: string;

    /** ISO timestamp the photo was taken (from EXIF or inspector-recorded). */
    takenAt: string;
  }[];

  // ── Inspector Findings ────────────────────────────────────────────────────
  /** Issues or conditions flagged by the inspector (text). Used by AI analysis in Pillar 2. */
  concerns: string[];

  /** Inspector recommendations to the lender (text). */
  recommendations: string[];

  /**
   * The inspector's recommended draw amount based on certified progress.
   * Lender reviewer may approve higher or lower; this is advisory.
   */
  recommendedDrawAmount?: number;

  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACCEPTED' | 'DISPUTED';

  submittedAt?: string;
  acceptedAt?: string;

  /** Populated by InspectionAiAnalyzerService after the inspector submits the report. */
  aiAnalysis?: InspectionAiAnalysis;

  createdAt: string;
  updatedAt: string;
}

// ─── Draw Anomaly Analysis ────────────────────────────────────────────────────

/**
 * AI analysis result attached to a DrawRequest by DrawAnomalyDetectorService.
 * Populated on every SUBMITTED or UNDER_REVIEW draw when aiDrawAnomalyDetection is enabled.
 */
export interface DrawAnomalyAnalysis {
  analyzedAt: string;
  modelVersion: string;

  /** True when at least one finding is WARNING or CRITICAL severity. */
  anomalyDetected: boolean;

  /**
   * Aggregate anomaly score 0–100.  Higher = more anomalous.
   * Computed as the max severity-weighted finding score.
   */
  anomalyScore: number;

  findings: Array<{
    /**
     * PHASE_SEQUENCE  — draw requests items out of typical build-phase order
     * AMOUNT_OUTLIER  — draw amount deviates significantly from portfolio benchmarks
     * TIMING_ANOMALY  — suspiciously short interval since the previous disbursed draw
     * GC_SYNC_PATTERN — same GC submitted coincident draws across multiple loans (fraud signal)
     */
    type: 'PHASE_SEQUENCE' | 'AMOUNT_OUTLIER' | 'TIMING_ANOMALY' | 'GC_SYNC_PATTERN';
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;

    /** Model confidence in this finding, 0–1. */
    confidence: number;
  }>;

  /**
   * Recommended lender action:
   * APPROVE — no material anomalies; proceed normally
   * REVIEW  — one or more WARNING findings; human review advised before advancing
   * HOLD    — one or more CRITICAL findings; draw should be held pending investigation
   */
  recommendedAction: 'APPROVE' | 'REVIEW' | 'HOLD';
}

// ─── Inspection AI Analysis ───────────────────────────────────────────────────

/**
 * AI analysis result attached to a DrawInspectionReport by InspectionAiAnalyzerService.
 * Populated after the inspector submits the report (status → SUBMITTED).
 */
export interface InspectionAiAnalysis {
  analyzedAt: string;
  modelVersion: string;

  /**
   * Photo authenticity score 0–1.
   * Based on EXIF metadata consistency and cross-inspection variance.
   * 1.0 = high confidence authentic; <0.5 = potentially manipulated or reused.
   */
  photoAuthenticityScore: number;

  /** Result of EXIF date/location validation against inspection scheduledDate and project address. */
  exifValidation: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';

  /** Human-readable explanation for the exifValidation result. */
  exifMessage: string;

  /** NLP-derived severity classification of the inspector's concerns array. */
  concernsSeverity: 'NONE' | 'MINOR' | 'MODERATE' | 'CRITICAL';

  /** Short NLP classification label (e.g. "Structural issue mentioned", "Cosmetic defects only"). */
  concernsClassification: string;

  /**
   * AI-recommended draw amount based on certified % complete and remaining budget.
   * Advisory only; reviewer may approve a different amount.
   */
  aiRecommendedDrawAmount: number;

  /**
   * Whether the % complete progression across inspections is logically consistent.
   * CONSISTENT          — each inspection shows measurable forward progress
   * INCONSISTENT        — percent decreased or jumped implausibly between reports
   * INSUFFICIENT_DATA   — fewer than two accepted inspections to compare
   */
  percentCompleteTrend: 'CONSISTENT' | 'INCONSISTENT' | 'INSUFFICIENT_DATA';

  /** Human-readable explanation for the trend result. */
  percentCompleteTrendMessage: string;

  /**
   * Overall AI verdict for this inspection:
   * PASS             — all signals OK; safe to advance draw
   * REVIEW_REQUIRED  — one or more signals need human attention
   * FLAG             — significant anomaly detected; draw should be held
   */
  overallVerdict: 'PASS' | 'REVIEW_REQUIRED' | 'FLAG';
}

// ─── Draw Request ─────────────────────────────────────────────────────────────

/**
 * Root document for a draw request.
 * Stored in the `draws` Cosmos container (partition key: /constructionLoanId).
 */
export interface DrawRequest {
  id: string;

  /** Sequential draw number for this loan: Draw 1, Draw 2, etc. */
  drawNumber: number;

  constructionLoanId: string;
  /** FK → PropertyRecord.id — propagated from parent ConstructionLoan at creation time. Added Phase R0.4. */
  propertyId?: string;
  /** FK → Engagement.id — propagated from parent ConstructionLoan at creation time. Added Phase R0.4. */
  engagementId?: string;

  /** ID of the ConstructionBudget version in effect when this draw was submitted. */
  budgetId: string;

  tenantId: string;

  status: DrawRequestStatus;

  // ── Submission ────────────────────────────────────────────────────────────
  /** User ID of the borrower or GC who submitted the draw. */
  requestedBy: string;
  requestedAt: string;

  /** Sum of all DrawLineItemRequest.requestedAmount values. */
  requestedAmount: number;

  lineItemRequests: DrawLineItemRequest[];

  /** Populated by the reviewer during UNDER_REVIEW → APPROVED transition. */
  lineItemResults?: DrawLineItemResult[];

  // ── Approval Amounts ──────────────────────────────────────────────────────
  /** Sum of all DrawLineItemResult.approvedAmount values. Null until approved. */
  approvedAmount?: number;

  /** Sum of all DrawLineItemResult.retainageWithheld values. Null until approved. */
  retainageWithheld?: number;

  /** Sum of all DrawLineItemResult.netDisbursed values — wire / ACH amount. Null until approved. */
  netDisbursementAmount?: number;

  // ── Inspection ────────────────────────────────────────────────────────────
  /** ID of the associated DrawInspectionReport document. */
  inspectionId?: string;
  inspectionType?: DrawInspectionType;

  // ── Lien Waiver ───────────────────────────────────────────────────────────
  lienWaiverStatus: LienWaiverStatus;
  lienWaiverDocumentUrl?: string;

  // ── Title ─────────────────────────────────────────────────────────────────
  titleUpdateRequired: boolean;
  titleUpdateStatus?: 'PENDING' | 'CLEARED';

  // ── Review & Approval Chain ───────────────────────────────────────────────
  reviewedBy?: string;
  reviewedAt?: string;

  /** User ID of the individual who gave final draw approval. */
  approvedBy?: string;
  approvedAt?: string;

  disbursedAt?: string;
  disbursementMethod?: 'ACH' | 'WIRE' | 'CHECK';

  // ── Rejection / Hold ──────────────────────────────────────────────────────
  /** Required when status is REJECTED. */
  rejectionReason?: string;

  /** Required when status is ON_HOLD. */
  holdReason?: string;

  notes?: string;

  /** Populated by DrawAnomalyDetectorService after each SUBMITTED draw analysis. */
  anomalyAnalysis?: DrawAnomalyAnalysis;

  createdAt: string;
  updatedAt: string;
}
