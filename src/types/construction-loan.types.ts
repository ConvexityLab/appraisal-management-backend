/**
 * Construction Finance Module — Core Loan & Budget Types
 *
 * Covers: Ground-Up Construction, Fix & Flip, Repair / Rehab (and future Multi-Family / Commercial).
 * All monetary values are in USD (whole dollars). All dates are ISO 8601 strings.
 *
 * Cosmos container: `construction-loans`  (partition key: /tenantId)
 */

import type { ConstructionRiskFlag } from './construction-risk.types.js';

// ─── Loan Type & Status ──────────────────────────────────────────────────────

/** Discriminates the loan program; drives type-specific validation and budget category rules. */
export type ConstructionLoanType =
  | 'GROUND_UP'    // New construction from bare land
  | 'FIX_FLIP'     // Acquire + renovate + sell
  | 'REHAB'        // Gut-rehab of existing structure held for rental or resale
  | 'MULTIFAMILY'  // 5+ unit residential new construction or rehab
  | 'COMMERCIAL';  // Commercial / mixed-use construction or rehab

/** Lifecycle states for a construction loan, in approximate chronological order. */
export type ConstructionLoanStatus =
  | 'UNDERWRITING'           // Pre-approval; budget and feasibility under review
  | 'APPROVED'               // Approved; awaiting borrower acceptance and first draw setup
  | 'ACTIVE'                 // Construction in progress; draws may be submitted
  | 'SUBSTANTIALLY_COMPLETE' // Inspector-certified ≥95% complete; final draw pending
  | 'COMPLETED'              // Certificate of occupancy or final inspection accepted; loan fully drawn
  | 'IN_DEFAULT'             // Missed milestones or budget overrun beyond lender threshold
  | 'CLOSED';                // Permanent financing taken out or loan retired

// ─── Budget Categories ───────────────────────────────────────────────────────

/**
 * Standardised budget line-item categories used across all loan types.
 * Not all categories apply to every loan type — type-specific validation rules
 * (in TenantConstructionConfig.feasibilityCustomRules) enforce required / prohibited categories.
 */
export type BudgetCategory =
  | 'LAND_ACQUISITION'  // Purchase price of the land parcel (ground-up only)
  | 'SITE_WORK'         // Grading, excavation, utilities stubout, demolition
  | 'FOUNDATION'        // Footings, slab, basement, piers
  | 'FRAMING'           // Structural framing, sheathing, trusses
  | 'ROOFING'           // Roof deck, underlayment, shingles / tile / metal
  | 'EXTERIOR'          // Siding, stucco, brick, exterior trim
  | 'WINDOWS_DOORS'     // Windows, exterior doors, garage doors
  | 'PLUMBING'          // Rough-in + finish plumbing, fixtures
  | 'ELECTRICAL'        // Rough-in + finish electrical, panels, fixtures
  | 'HVAC'              // Heating, ventilation, cooling systems
  | 'INSULATION'        // Batt, spray foam, rigid board insulation
  | 'DRYWALL'           // Hanging, taping, texture, finish
  | 'FLOORING'          // Hardwood, tile, carpet, LVP, underlayment
  | 'KITCHEN'           // Cabinets, countertops, appliances, tile
  | 'BATHROOMS'         // Cabinets, tile, fixtures, glass
  | 'INTERIOR_FINISH'   // Painting, trim, doors, hardware, closets
  | 'LANDSCAPING'       // Grading, sod, irrigation, hardscape
  | 'GARAGE'            // Detached / attached garage construction
  | 'PERMITS_FEES'      // Building permits, impact fees, utility fees
  | 'SOFT_COSTS'        // Architecture, engineering, legal, title, inspection fees
  | 'INTEREST_RESERVE'  // Pre-funded interest payments during construction
  | 'CONTINGENCY'       // Reserve for unforeseen cost overruns (not a CO replacement)
  | 'OTHER';            // Catch-all; should be described in BudgetLineItem.description

// ─── Budget Line Item ─────────────────────────────────────────────────────────

/** A single cost item in a construction budget. All computed fields are maintained by the service layer. */
export interface BudgetLineItem {
  /** Stable unique identifier for this line item within the budget. */
  id: string;

  /** Trade or work category this line represents. */
  category: BudgetCategory;

  /** Human-readable description (e.g. "Spray foam insulation — 2,400 sq ft"). */
  description: string;

  /** Approved original budget amount at loan origination. MUST NOT be mutated after budget approval — use changeOrderAmount for revisions. */
  originalAmount: number;

  /** Net sum of all approved change order deltas for this line item. Negative if a CO reduced the line. */
  changeOrderAmount: number;

  /** originalAmount + changeOrderAmount — the current approved budget for this line. */
  revisedAmount: number;

  /** Cumulative disbursed draw amounts for this line item across all approved draws. */
  drawnToDate: number;

  /** revisedAmount − drawnToDate — how much funding remains available. */
  remainingBalance: number;

  /** drawnToDate / revisedAmount × 100 — percent of this line item's budget disbursed. */
  percentDisbursed: number;

  /**
   * Inspector-certified percent complete for this trade.
   * May lag percentDisbursed (lender holding retainage) or lead it (work complete but not yet drawn).
   */
  percentCompleteInspected: number;

  // ── Catalog linkage (optional — backward-compatible) ─────────────────────

  /** CSI MasterFormat section code linked from the cost catalog (e.g. "09 21 16"). */
  csiCode?: string;

  /** ID of the CostCatalogItem this line was seeded from. */
  catalogItemId?: string;

  /** Quantity of units (paired with unit and unitCost for per-unit budget review). */
  qty?: number;

  /** Unit of measure from the catalog (e.g. "SF", "LF", "EA"). */
  unit?: string;

  /** Catalog unit cost used at budget creation — preserved for AI reasonability comparison. */
  unitCost?: number;
}

// ─── Construction Budget ─────────────────────────────────────────────────────

/** Versioned budget document. A new version is written for each approved change order — prior versions are immutable. */
export interface ConstructionBudget {
  id: string;
  constructionLoanId: string;
  tenantId: string;

  /** Monotonically incrementing version number. Version 1 is the original approved budget. */
  version: number;

  status: 'DRAFT' | 'APPROVED' | 'REVISED';

  lineItems: BudgetLineItem[];

  /** Sum of all lineItem.originalAmount. Set once at creation; never updated post-approval. */
  totalOriginalBudget: number;

  /** Sum of all lineItem.revisedAmount (reflects approved COs). Recomputed on each CO approval. */
  totalRevisedBudget: number;

  /** Sum of all lineItem.drawnToDate. Recomputed on each draw disbursement. */
  totalDrawnToDate: number;

  /** Total contingency line-item budget (may span multiple CONTINGENCY line items). */
  contingencyAmount: number;

  /** How much contingency has been consumed by contingency draws. */
  contingencyUsed: number;

  /** contingencyAmount − contingencyUsed. */
  contingencyRemaining: number;

  approvedAt?: string;
  approvedBy?: string;

  createdAt: string;
  updatedAt: string;
}

// ─── Linked Order ────────────────────────────────────────────────────────────

/**
 * The purpose / role of an order that has been linked to a ConstructionLoan.
 * Drives display grouping and validation rules (e.g. only one ARV_APPRAISAL active at a time).
 */
export type LinkedOrderRole =
  | 'ARV_APPRAISAL'        // As-Repaired Value appraisal — drives arvEstimate
  | 'AS_BUILT_APPRAISAL'   // Final appraisal confirming completed-value; required before COMPLETED transition
  | 'DRAW_INSPECTION'      // Field / desktop / drive-by inspection for a specific draw request
  | 'TITLE_UPDATE'         // Title commitment update or endorsement
  | 'ENVIRONMENTAL'        // Phase I or Phase II environmental assessment
  | 'STRUCTURAL_INSPECTION'// Structural engineering inspection (non-draw)
  | 'SURVEY'               // Land / boundary / as-built survey
  | 'OTHER';               // Catch-all — describe in `notes`

/**
 * A reference from a ConstructionLoan to an order in the orders container.
 * Embedded in ConstructionLoan.linkedOrders (not a separate document).
 */
export interface LinkedOrder {
  /** ID of the order document in the `orders` Cosmos container. */
  orderId: string;

  /** Denormalised order number for display without fetching the order. */
  orderNumber?: string;

  /** The order's role in this loan's lifecycle. */
  role: LinkedOrderRole;

  /** Denormalised current order status (informational only — not kept in sync automatically). */
  orderStatus?: string;

  /** Optional free-text note, e.g. "Draw 3 inspection" or "As-completed ARV for final draw". */
  notes?: string;

  /** ISO timestamp when this link was created. */
  linkedAt: string;

  /** User ID of the person who created this link. */
  linkedBy: string;
}

// ─── Contractor Profile ───────────────────────────────────────────────────────

/** Stored in the `contractors` Cosmos container (partition key: /tenantId). */
export interface ContractorProfile {
  id: string;
  tenantId: string;

  name: string;
  role: 'GENERAL_CONTRACTOR' | 'SUBCONTRACTOR' | 'OWNER_BUILDER';

  // ── License ──────────────────────────────────────────────────────────────
  licenseNumber: string;
  licenseState: string;

  /** ISO date string — when the license expires per official records. */
  licenseExpiry: string;

  /** Timestamp of the most recent successful manual verification. */
  licenseVerifiedAt?: string;

  /** User ID of the reviewer who completed the manual verification. */
  licenseVerifiedBy?: string;

  /**
   * Overall license verification status combining manual upload and API verification paths.
   * VERIFIED if either path has succeeded.  FAILED only when the API returns a negative result
   * AND no valid manual upload exists.
   */
  licenseVerificationStatus: 'PENDING' | 'MANUAL_PENDING' | 'MANUAL_VERIFIED' | 'API_VERIFIED' | 'API_NOT_FOUND' | 'FAILED';

  /** Timestamp + source of the most recent API verification attempt. */
  apiVerificationAt?: string;
  apiVerificationSource?: string;   // e.g. "CA CSLB API", "NMLS Consumer Access"

  // ── Insurance & Bond ─────────────────────────────────────────────────────
  insuranceCertExpiry: string;

  /** Timestamp of the most recent insurance certificate verification. */
  insuranceVerifiedAt?: string;

  /** Surety bond amount in USD, if applicable. */
  bondAmount?: number;

  // ── Track Record ──────────────────────────────────────────────────────────
  yearsInBusiness?: number;
  completedProjects?: number;

  /**
   * Lender-assessed risk tier.
   * APPROVED: can be assigned to construction loans.
   * CONDITIONAL: requires senior approval before assignment.
   * WATCH: extra monitoring required; existing assignments continue.
   * DISQUALIFIED: may not be assigned to new or existing loans.
   */
  riskTier: 'APPROVED' | 'CONDITIONAL' | 'WATCH' | 'DISQUALIFIED';

  notes?: string;

  /** URL of the uploaded manual verification document (license copy, certificate, etc.). */
  manualVerificationDocUrl?: string;

  createdAt: string;
  updatedAt: string;
}

// ─── Project Milestone ────────────────────────────────────────────────────────

/** A scheduled construction phase checkpoint within a loan's timeline. */
export interface ProjectMilestone {
  id: string;

  /** Human-readable name, e.g. "Foundation Complete", "Framing Complete". */
  name: string;

  /** Planned completion date (ISO string). */
  targetDate: string;

  /** Actual completion date once the milestone is reached. */
  actualDate?: string;

  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'OVERDUE';

  /**
   * The expected overall project completion percentage when this milestone is reached.
   * Used by the completion forecaster to calibrate pace.
   */
  percentageOfCompletion: number;

  notes?: string;
}

// ─── CPP (Construction Protection Program) ───────────────────────────────────

/**
 * A workout plan item generated by the CPP service.
 * Embedded in CppRecord.workoutPlan.
 */
export interface CppWorkoutStep {
  /** Short label for this action item. */
  action: string;

  /**
   * How urgent:
   * IMMEDIATE — must be completed within 48 hours
   * SHORT_TERM  — within 30 days
   * LONG_TERM   — within 90 days
   */
  timeframe: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM';

  /** Owner responsible: LENDER, BORROWER, CONTRACTOR, INSPECTOR */
  owner: 'LENDER' | 'BORROWER' | 'CONTRACTOR' | 'INSPECTOR';

  notes?: string;
}

/**
 * Embedded CPP record on a ConstructionLoan.
 * Created by ConstructionCppService.createCppWorkoutPlan().
 * Cleared (resolvedAt set) by resolveCpp().
 */
export interface CppRecord {
  /** ISO timestamp this CPP was triggered. */
  triggeredAt: string;

  /** Risk flags that caused the CPP trigger. */
  triggeringFlags: string[];

  /** AI-generated workout plan items. */
  workoutPlan: CppWorkoutStep[];

  /** Free-text AI narrative summarising the distress and recommended path. */
  narrative: string;

  modelVersion: string;

  /** ISO timestamp this CPP was resolved. Null while still active. */
  resolvedAt?: string;

  resolvedBy?: string;

  /** Resolution outcome chosen by the lender. */
  resolution?: 'CURED' | 'MODIFIED' | 'FORECLOSURE_INITIATED' | 'SOLD' | 'OTHER';

  /** Lender notes on resolution. */
  resolutionNotes?: string;
}

// ─── Construction Loan ────────────────────────────────────────────────────────

/** Root document for a construction loan. Stored in the `construction-loans` Cosmos container. */
export interface ConstructionLoan {
  id: string;
  tenantId: string;

  /** Human-readable loan identifier assigned by the lender. */
  loanNumber: string;

  loanType: ConstructionLoanType;
  status: ConstructionLoanStatus;

  // ── Loan Economics ────────────────────────────────────────────────────────
  /** Total committed loan amount in USD. */
  loanAmount: number;

  /** Annual interest rate as a decimal (e.g. 0.115 for 11.5%). */
  interestRate: number;

  /** ISO date string — loan maturity date. */
  maturityDate: string;

  /** Pre-funded interest reserve included in the loan amount. */
  interestReserveAmount: number;

  /** How much of the interest reserve has been consumed to date. */
  interestReserveDrawn: number;

  // ── Property ──────────────────────────────────────────────────────────────
  /** FK → PropertyRecord.id — the physical collateral property. Added Phase R0.4. */
  propertyId?: string;
  /** FK → Engagement.id — the valuation engagement on this same property, if any. Added Phase R0.4. */
  engagementId?: string;
  /**
   * @deprecated Use propertyId to reference the canonical PropertyRecord instead.
   * Retained as a display cache during Phase R0–R2 migration.
   */
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  };

  /** e.g. 'Single Family Residential', 'Multifamily', 'Commercial' */
  propertyType: string;

  // ── Valuation ─────────────────────────────────────────────────────────────
  /** Appraised as-is value (land + existing improvements) in USD.  May be null for raw land. */
  asIsValue?: number;

  /**
   * As-Repaired / As-Completed value estimate in USD.
   * For Fix & Flip / Rehab: populated from linked ArvAnalysis.
   * For Ground-Up: populated from plans appraisal.
   */
  arvEstimate?: number;

  /** Links to the ArvAnalysis document that produced arvEstimate. */
  arvAnalysisId?: string;

  // ── People ────────────────────────────────────────────────────────────────
  borrowerId: string;
  borrowerName: string;

  /** ID of the primary GeneralContractor's ContractorProfile document. */
  generalContractorId?: string;

  // ── Budget & Draws ────────────────────────────────────────────────────────
  /** ID of the currently approved ConstructionBudget document. */
  budgetId: string;

  /** Running total of all draw amounts ever approved (before retainage). */
  totalDrawsApproved: number;

  /** Running total of all draw amounts actually disbursed. */
  totalDrawsDisbursed: number;

  /** Inspector-certified overall project % complete (0–100). */
  percentComplete: number;

  /**
   * Retainage percentage withheld from each gross draw disbursement (e.g. 10 = 10%).
   * Value comes from the loan record, which may override the tenant default.
   */
  retainagePercent: number;

  /** Running total of retainage withheld across all draws. */
  retainageHeld: number;

  /** Running total of retainage that has been released to the borrower/GC. */
  retainageReleased: number;

  // ── Timeline ──────────────────────────────────────────────────────────────
  constructionStartDate?: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  milestones: ProjectMilestone[];

  // ── Cross-References ──────────────────────────────────────────────────────
  /**
   * Structured order links — replaces the old `orderId` and `relatedAppraisalIds` fields.
   * Each entry captures the order ID, its role in the loan lifecycle, and audit metadata.
   * Apply via POST /construction-loans/:loanId/linked-orders.
   */
  linkedOrders: LinkedOrder[];

  /**
   * @deprecated Use linkedOrders instead.
   * Retained for backward compatibility with documents written before linked-orders support.
   */
  orderId?: string;

  /**
   * @deprecated Use linkedOrders instead.
   * Retained for backward compatibility.
   */
  relatedAppraisalIds?: string[];

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  /**
   * Current active (unresolved) risk flags, computed by ConstructionRiskService.
   * AI-set flags (DRAW_ANOMALY, INSPECTION_PHOTO_ANOMALY) are written by Phase 4b services.
   * Updated in-place; each flag has resolvedAt when cleared.
   */
  activeRiskFlags?: ConstructionRiskFlag[];

  /**
   * Construction Protection Program record.  Present when the loan has an active or
   * historically resolved CPP workout. Created by ConstructionCppService.
   */
  cpp?: CppRecord;
}
