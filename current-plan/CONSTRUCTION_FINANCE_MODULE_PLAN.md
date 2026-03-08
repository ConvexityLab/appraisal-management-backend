# Construction Finance Module — Build Plan

**Author:** GitHub Copilot  
**Date:** March 6, 2026  
**Status:** APPROVED — All architectural decisions resolved March 6, 2026  
**Reference:** CFSI Loan Management (thinkcfsi.com) competitive parity + substantial AI-driven enhancements

---

## Overview

This plan adds a full **Construction Finance Management** capability to the platform, covering:

- Ground-Up Construction
- Fix & Flip
- Repair / Rehab
- Multi-Family & Commercial (phase 2)

The module replaces CFSI-style manual/outsourced loan administration with an in-platform, automated, AI-assisted system for lenders, AMCs, and private capital.

---

## What We Already Have (Do NOT Rebuild)

| Existing Asset | Location | Reuse |
|---|---|---|
| ARV engine + types | `src/types/arv.types.ts`, `src/services/arv-engine.service.ts` | Extend `DealType` → becomes loan type for construction loans |
| Scope of Work items | `ScopeOfWorkItem` in arv.types.ts | Evolve into full `BudgetLineItem` with actuals + draws |
| Deal metrics (MAO, LTV, profit) | `arv-engine.service.ts` | Feed into draw eligibility checks |
| Inspection scheduling | `src/services/inspection.service.ts` | Extend with `DrawInspection` variant |
| Vendor management | Multiple vendor files | Add `ContractorProfile` sub-type |
| Communication platform | `src/controllers/communication.controller.ts` | Attach draw thread per project |
| Order management | `src/services/order-management.service.ts` | Add `CONSTRUCTION_LOAN` order type |
| Payment types | `src/types/payment.types.ts` | Extend to support draw disbursements |

---

## Module Architecture

```
Construction Finance
├── Construction Loan (the "project entity")
│   ├── Loan details (type, amount, term, interest reserve)
│   ├── Property & borrower info
│   ├── Contractor profiles (dual license verification)
│   ├── Tenant-configurable settings (TenantConstructionConfig)
│   └── Project timeline + milestones
├── Budget
│   ├── Original budget (line items by category)
│   ├── Change orders (approved revisions, immutable versioning)
│   ├── Contingency reserve tracking
│   └── Budget vs. Actual (real-time, updated per draw)
├── Draw Requests
│   ├── Draw submission (GC / borrower)
│   ├── Draw inspection (field / desktop / drive-by / final)
│   ├── Draw review & approval workflow (line-item level)
│   ├── Lien waiver collection + tracking
│   ├── Retainage withholding + configurable auto-release
│   └── Disbursement authorization (human approval, always)
├── AI Pillar 1 — Feasibility Engine (pre-loan)
│   ├── Budget feasibility scoring vs. market benchmarks
│   ├── Lender-configurable rule engine (FeasibilityRule)
│   ├── Contractor feasibility check
│   ├── ARV / LTV coverage analysis
│   └── Timeline realism analysis
├── AI Pillar 2 — Ongoing Monitor (during construction)
│   ├── Draw anomaly detection
│   ├── Inspection photo AI analysis (EXIF + authenticity)
│   ├── Budget burn rate projection (per line item)
│   ├── Completion forecasting (P25/P50/P75)
│   ├── Risk flag auto-computation (18 flag codes)
│   └── CPP trigger + workout plan generation
├── AI Pillar 3 — Servicing & Asset Management
│   ├── Interest reserve management + depletion forecast
│   ├── Maturity date monitoring + extension recommendation
│   ├── Automated AI status reports (scheduled + on-demand)
│   ├── Construction-to-perm conversion readiness
│   └── Portfolio stress testing (what-if scenarios)
├── Portfolio Monitor
│   ├── Dashboard (all active projects, real-time)
│   ├── Geographic heat map (risk by market)
│   ├── Draw velocity analytics
│   └── AI completion forecasts
└── Reporting
    ├── Draw history / disbursement log
    ├── Budget variance report
    ├── Lien waiver status report
    ├── AI-generated periodic status reports (PDF)
    └── Portfolio performance + stress test results
```

---

## Phase 1 — Foundation: Construction Loan + Budget (Sprint 1-2)

**Goal:** A lender or AMC can create a construction loan record, set up a detailed budget, and track the loan through its lifecycle.

### 1.1 New Types: `src/types/construction-loan.types.ts`

```typescript
// Core loan type
export type ConstructionLoanType =
  | 'GROUND_UP'
  | 'FIX_FLIP'
  | 'REHAB'
  | 'MULTIFAMILY'
  | 'COMMERCIAL';

export type ConstructionLoanStatus =
  | 'UNDERWRITING'       // Pre-approval, budget review
  | 'APPROVED'           // Approved, awaiting first draw
  | 'ACTIVE'             // Construction in progress
  | 'SUBSTANTIALLY_COMPLETE' // >95% complete, final draw pending
  | 'COMPLETED'          // Certificate of occupancy / final inspection done
  | 'IN_DEFAULT'         // Missed milestones / budget overrun > threshold
  | 'CLOSED';            // Permanent financing taken out, loan retired

export type BudgetCategory =
  | 'LAND_ACQUISITION'
  | 'SITE_WORK'
  | 'FOUNDATION'
  | 'FRAMING'
  | 'ROOFING'
  | 'EXTERIOR'
  | 'WINDOWS_DOORS'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'HVAC'
  | 'INSULATION'
  | 'DRYWALL'
  | 'FLOORING'
  | 'KITCHEN'
  | 'BATHROOMS'
  | 'INTERIOR_FINISH'
  | 'LANDSCAPING'
  | 'GARAGE'
  | 'PERMITS_FEES'
  | 'SOFT_COSTS'         // Architecture, engineering, legal
  | 'INTEREST_RESERVE'
  | 'CONTINGENCY'
  | 'OTHER';

export interface BudgetLineItem {
  id: string;
  category: BudgetCategory;
  description: string;
  /** Approved original budget amount */
  originalAmount: number;
  /** Sum of approved change orders for this line */
  changeOrderAmount: number;
  /** originalAmount + changeOrderAmount */
  revisedAmount: number;
  /** Sum of all disbursed draw amounts for this line */
  drawnToDate: number;
  /** revisedAmount - drawnToDate */
  remainingBalance: number;
  /** Percent of this line item disbursed */
  percentDisbursed: number;
  /** Inspector-certified % complete (may differ from % disbursed) */
  percentCompleteInspected: number;
}

export interface ConstructionBudget {
  id: string;
  constructionLoanId: string;
  tenantId: string;
  version: number;                    // Increments on each approved revision
  status: 'DRAFT' | 'APPROVED' | 'REVISED';
  lineItems: BudgetLineItem[];
  /** Sum of all lineItem.originalAmount */
  totalOriginalBudget: number;
  /** Sum of all lineItem.revisedAmount */
  totalRevisedBudget: number;
  /** Sum of all lineItem.drawnToDate */
  totalDrawnToDate: number;
  contingencyAmount: number;
  contingencyUsed: number;
  contingencyRemaining: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorProfile {
  id: string;
  tenantId: string;
  name: string;
  role: 'GENERAL_CONTRACTOR' | 'SUBCONTRACTOR' | 'OWNER_BUILDER';
  licenseNumber: string;
  licenseState: string;
  licenseExpiry: string;
  licenseVerifiedAt?: string;
  licenseVerifiedBy?: string;
  insuranceCertExpiry: string;
  insuranceVerifiedAt?: string;
  bondAmount?: number;
  yearsInBusiness?: number;
  completedProjects?: number;
  riskTier: 'APPROVED' | 'CONDITIONAL' | 'WATCH' | 'DISQUALIFIED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  name: string;           // e.g. "Foundation Complete", "Framing Complete"
  targetDate: string;
  actualDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'OVERDUE';
  percentageOfCompletion: number;   // Expected project % at this milestone
  notes?: string;
}

export interface ConstructionLoan {
  id: string;
  tenantId: string;
  loanNumber: string;
  loanType: ConstructionLoanType;
  status: ConstructionLoanStatus;

  // Loan economics
  loanAmount: number;
  interestRate: number;
  maturityDate: string;
  interestReserveAmount: number;
  interestReserveDrawn: number;

  // Property
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  };
  propertyType: string;

  // Valuation
  asIsValue?: number;             // Appraised as-is (land + existing improvements)
  arvEstimate?: number;           // As-Repaired/As-Completed value
  arvAnalysisId?: string;         // Link to existing ArvAnalysis document

  // People
  borrowerId: string;
  borrowerName: string;
  generalContractorId?: string;   // Link to ContractorProfile

  // Budget & draws
  budgetId: string;               // Current approved budget
  totalDrawsApproved: number;     // Cumulative approved draws
  totalDrawsDisbursed: number;    // Cumulative disbursed
  percentComplete: number;        // Inspector-certified overall % complete
  retainagePercent: number;       // e.g. 10 = hold back 10% of each draw
  retainageHeld: number;          // Cumulative retainage withheld
  retainageReleased: number;

  // Timeline
  constructionStartDate?: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  milestones: ProjectMilestone[];

  // Links
  orderId?: string;               // Link to appraisal order (for ARV review)
  relatedAppraisalIds?: string[];

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 New Types: `src/types/draw-request.types.ts`

```typescript
export type DrawRequestStatus =
  | 'DRAFT'               // GC/borrower working on it
  | 'SUBMITTED'           // Submitted to lender for review
  | 'INSPECTION_ORDERED'  // Field or desktop inspection requested
  | 'INSPECTION_COMPLETE' // Inspector submitted report
  | 'UNDER_REVIEW'        // Loan admin reviewing with inspection report
  | 'APPROVED'            // Draw amounts approved, pending disbursement
  | 'PARTIALLY_APPROVED'  // Some line items approved at different amounts
  | 'DISBURSED'           // Funds sent
  | 'REJECTED'            // Draw denied — reason required
  | 'ON_HOLD';            // Lien waiver, title, or other issue

export type LienWaiverStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'RECEIVED'
  | 'VERIFIED';

export type DrawInspectionType =
  | 'FIELD'         // Inspector visits site
  | 'DESKTOP'       // Inspector reviews photos/documentation remotely
  | 'DRIVE_BY'      // Exterior only
  | 'FINAL';        // Final inspection for certificate of occupancy

export interface DrawLineItemRequest {
  budgetLineItemId: string;
  category: BudgetCategory;           // re-exported from construction-loan.types
  description: string;
  requestedAmount: number;
  supportingNotes?: string;
}

export interface DrawLineItemResult {
  budgetLineItemId: string;
  requestedAmount: number;
  approvedAmount: number;
  retainageWithheld: number;          // approvedAmount × retainagePercent
  netDisbursed: number;               // approvedAmount - retainageWithheld
  inspectorPercentComplete?: number;  // From inspection report, per line
  reviewerNotes?: string;
  status: 'APPROVED' | 'REDUCED' | 'DENIED';
}

export interface DrawInspectionReport {
  id: string;
  drawRequestId: string;
  constructionLoanId: string;
  tenantId: string;
  inspectionType: DrawInspectionType;
  inspectorId: string;
  inspectorName: string;
  inspectorLicense?: string;
  scheduledDate: string;
  completedDate?: string;

  /** Overall % complete as certified by the inspector */
  overallPercentComplete: number;
  previousOverallPercent: number;
  percentCompleteThisDraw: number;

  /** Per-line-item inspector findings */
  lineItemFindings: {
    budgetLineItemId: string;
    category: string;
    description: string;
    previousPercent: number;
    currentPercent: number;
    inspectorNotes?: string;
  }[];

  photos: {
    id: string;
    url: string;
    caption?: string;
    takenAt: string;
  }[];

  concerns: string[];         // Issues flagged by inspector
  recommendations: string[];

  /** Inspector's certified recommended draw amount */
  recommendedDrawAmount?: number;

  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACCEPTED' | 'DISPUTED';
  submittedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawRequest {
  id: string;
  drawNumber: number;             // Sequential: Draw 1, Draw 2, etc.
  constructionLoanId: string;
  budgetId: string;
  tenantId: string;
  status: DrawRequestStatus;

  requestedBy: string;            // borrower or GC user ID
  requestedAt: string;
  requestedAmount: number;        // Sum of all line item requests

  lineItemRequests: DrawLineItemRequest[];
  lineItemResults?: DrawLineItemResult[];   // Populated after review

  /** Approved total before retainage */
  approvedAmount?: number;
  /** Retainage withheld from this draw */
  retainageWithheld?: number;
  /** Net disbursement amount */
  netDisbursementAmount?: number;

  inspectionId?: string;          // Link to DrawInspectionReport
  inspectionType?: DrawInspectionType;

  lienWaiverStatus: LienWaiverStatus;
  lienWaiverDocumentUrl?: string;

  titleUpdateRequired: boolean;
  titleUpdateStatus?: 'PENDING' | 'CLEARED';

  // Review & approval chain
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  disbursedAt?: string;
  disbursementMethod?: 'ACH' | 'WIRE' | 'CHECK';

  rejectionReason?: string;
  holdReason?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 New Types: `src/types/change-order.types.ts`

```typescript
export type ChangeOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface ChangeOrder {
  id: string;
  constructionLoanId: string;
  budgetId: string;
  tenantId: string;
  changeOrderNumber: number;
  status: ChangeOrderStatus;

  requestedBy: string;
  requestedAt: string;
  reason: string;         // Required: WHY is the budget changing?

  lineItemChanges: {
    budgetLineItemId: string;
    category: string;
    description: string;
    originalAmount: number;
    proposedAmount: number;
    delta: number;          // proposedAmount - originalAmount
    justification: string;
  }[];

  /** Net impact: sum of all deltas (positive = cost increase) */
  totalDelta: number;
  /** New total budget if approved */
  proposedTotalBudget: number;

  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  createdAt: string;
  updatedAt: string;
}
```

---

## Phase 2 — Draw Lifecycle & Inspection Workflow (Sprint 3-4)

**Goal:** Full draw request → inspection → review → approval → disbursement pipeline.

### API Endpoints — Construction Loans

| Method | Path | Description |
|---|---|---|
| POST | `/api/construction-loans` | Create new construction loan |
| GET | `/api/construction-loans` | List loans (tenant-scoped, filterable) |
| GET | `/api/construction-loans/:id` | Get loan + budget + draw summary |
| PUT | `/api/construction-loans/:id/status` | Advance loan status |
| GET | `/api/construction-loans/:id/draws` | Draw history |
| GET | `/api/construction-loans/:id/budget` | Current approved budget |
| GET | `/api/construction-loans/:id/timeline` | Milestones and status |

### API Endpoints — Draw Requests

| Method | Path | Description |
|---|---|---|
| POST | `/api/construction-loans/:id/draws` | Submit new draw request |
| GET | `/api/draws/:id` | Get draw detail |
| PUT | `/api/draws/:id/order-inspection` | Order a draw inspection |
| PUT | `/api/draws/:id/review` | Submit reviewer decision |
| PUT | `/api/draws/:id/approve` | Approve draw (with line-item amounts) |
| PUT | `/api/draws/:id/disburse` | Record disbursement |
| PUT | `/api/draws/:id/reject` | Reject draw with reason |
| PUT | `/api/draws/:id/hold` | Place draw on hold |
| PUT | `/api/draws/:id/lien-waiver` | Update lien waiver status |

### API Endpoints — Inspections

| Method | Path | Description |
|---|---|---|
| POST | `/api/draw-inspections` | Schedule draw inspection |
| GET | `/api/draw-inspections/:id` | Get inspection report |
| PUT | `/api/draw-inspections/:id/submit` | Inspector submits report |
| PUT | `/api/draw-inspections/:id/accept` | Lender accepts inspection |
| PUT | `/api/draw-inspections/:id/dispute` | Dispute inspection findings |

### API Endpoints — Budget & Change Orders

| Method | Path | Description |
|---|---|---|
| POST | `/api/construction-loans/:id/change-orders` | Submit change order |
| GET | `/api/construction-loans/:id/change-orders` | List change orders |
| PUT | `/api/change-orders/:id/approve` | Approve change order (creates new budget version) |
| PUT | `/api/change-orders/:id/reject` | Reject change order |
| GET | `/api/construction-loans/:id/budget/variance` | Budget vs. actual report |

### API Endpoints — Contractors

| Method | Path | Description |
|---|---|---|
| POST | `/api/contractors` | Create contractor profile |
| GET | `/api/contractors/:id` | Get profile + license verification |
| PUT | `/api/contractors/:id/verify-license` | Trigger license verification |
| PUT | `/api/contractors/:id/risk-tier` | Update risk tier |
| GET | `/api/contractors/:id/projects` | Projects this contractor is on |

---

## Phase 3 — Portfolio Monitoring & Risk Dashboard (Sprint 5)

**Goal:** Lenders can see their entire construction portfolio at a glance with risk alerts.

### Portfolio Dashboard Features

```
Construction Portfolio Monitor
├── Summary Cards
│   ├── Active projects (count + total exposure)
│   ├── Total funds committed vs. deployed
│   ├── Average % complete across portfolio
│   └── Draws pending review (count + amount)
├── Risk Flags (auto-computed)
│   ├── STALLED: No draw in 60+ days on active project
│   ├── OVER_BUDGET: Draws + change orders > original budget × 1.05
│   ├── SCHEDULE_SLIP: Expected completion > 30 days past target
│   ├── INSPECTION_FAILED: Inspector flagged concerns
│   ├── LIEN_WAIVER_MISSING: Draw approved but waiver not received
│   ├── CONTRACTOR_LICENSE_EXPIRING: License expires within 30 days
│   └── LOW_ARV_COVERAGE: Projected total cost > ARV × 0.85
├── Draw Velocity Chart
│   └── Monthly draw amounts over project life
├── Completion Forecast
│   └── Using current % complete + draw velocity → estimated finish date
└── Geographic Heat Map
    └── Risk concentration by state / market
```

### Risk Flag Schema

```typescript
export type ConstructionRiskFlagCode =
  | 'STALLED_PROJECT'
  | 'OVER_BUDGET'
  | 'SCHEDULE_SLIP'
  | 'INSPECTION_CONCERN'
  | 'LIEN_WAIVER_MISSING'
  | 'CONTRACTOR_LICENSE_EXPIRING'
  | 'CONTRACTOR_DISQUALIFIED'
  | 'LOW_ARV_COVERAGE'
  | 'HIGH_RETAINAGE_BACKLOG'    // Large unreleased retainage approaching turn
  | 'TITLE_HOLD';

export interface ConstructionRiskFlag {
  code: ConstructionRiskFlagCode;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  detectedAt: string;
  resolvedAt?: string;
}
```

---

## Phase 4 — AI Intelligence Layer (Sprint 6-9)

> Goal: make this platform dramatically smarter than CFSI or any manual process. AI is not an add-on — it runs throughout the entire lifecycle: before origination, during construction, and through servicing.

The AI layer is organized into **three pillars**. All are tenant-configurable via `TenantConstructionConfig`.

---

### Pillar 1 — Feasibility Engine (Pre-Loan / Origination)

**Trigger:** When a construction loan is in `UNDERWRITING` status and a budget is submitted.  
**Output:** A `FeasibilityReport` attached to the loan — lender-configurable as warning-only or hard approval gate.

#### 1a. Budget Feasibility Analysis
- Compare each `BudgetLineItem` against market cost benchmarks (sourced from RSMeans data, historic portfolio actuals, and regional cost indices).
- Flag line items that are **under-funded** (high probability of change order) or **over-funded** (possible fee inflation / GC padding).
- Detect **missing line items** for the declared loan type (e.g., a ground-up budget with no `PERMITS_FEES` line is flagged).
- Score each category 0–100; roll up to overall `feasibilityScore`.
- Apply lender-configured `FeasibilityRule` set on top of base AI score.

```typescript
export interface FeasibilityReport {
  id: string;
  constructionLoanId: string;
  budgetId: string;
  tenantId: string;
  generatedAt: string;
  modelVersion: string;

  overallScore: number;               // 0–100
  overallVerdict: 'PASS' | 'WARN' | 'FAIL';

  lineItemFindings: {
    budgetLineItemId: string;
    category: BudgetCategory;
    submittedAmount: number;
    benchmarkLow: number;
    benchmarkHigh: number;
    benchmarkSource: string;           // e.g. "RSMeans 2026 Southeast Region"
    finding: 'OK' | 'UNDER_FUNDED' | 'OVER_FUNDED' | 'MISSING' | 'SUSPICIOUS';
    confidence: number;                // 0–1
    message: string;
  }[];

  customRuleResults: {
    ruleId: string;
    ruleName: string;
    result: 'PASS' | 'WARN' | 'FAIL';
    message: string;
  }[];

  // ARV / Loan Coverage check (runs against existing ArvAnalysis)
  loanToArvRatio: number;
  loanToArvVerdict: 'PASS' | 'WARN' | 'FAIL';
  loanToArvMessage: string;

  // Timeline feasibility
  estimatedDaysToComplete: number;      // AI estimate based on type + scope
  requestedDaysToComplete: number;      // From loan.expectedCompletionDate
  timelineFinding: 'REALISTIC' | 'AGGRESSIVE' | 'UNREALISTIC';
  timelineMessage: string;

  reviewedBy?: string;                  // If a human overrides the verdict
  reviewNotes?: string;
  overrideVerdict?: 'PASS' | 'WARN' | 'FAIL';
}
```

#### 1b. Contractor Feasibility Check
- Cross-reference GC license expiry, bond amount, and insurance against loan size thresholds.
- Query internal portfolio history: has this contractor had prior stalled or defaulted projects?
- Check if GC has capacity (how many active projects are they on platform-wide?).
- Output: `ContractorFeasibilityResult` embedded in `FeasibilityReport`.

#### 1c. Lender-Configurable Rule Engine
- Rules defined in `TenantConstructionConfig.feasibilityCustomRules`.
- Examples lenders configure: "HVAC must be ≥ 3% of total budget for ground-up", "Contingency must be ≥ 8% for projects >$500K", "SOFT_COSTS cannot exceed 15% of total".
- Rules evaluated after AI scoring; `FAIL` rules blockin approval if `feasibilityBlocksApproval = true`.

---

### Pillar 2 — Ongoing Monitor & Draw Intelligence (During Construction)

**Trigger:** Continuous — evaluated on each draw submission, each inspection submission, and on a configurable schedule (default: daily cron evaluation of all `ACTIVE` loans).

#### 2a. Draw Anomaly Detection
- Compare requested draw amounts and line-item patterns against:
  - The project's own prior draws (velocity baseline)
  - Portfolio-wide benchmarks for same loan type and project phase
- Flag: draw requested significantly out of phase sequence (e.g., kitchen draw before framing is complete)
- Flag: line item amount dramatically higher than same-category draws from prior projects
- Flag: draw requested with no inspection or very short time since last draw
- Flag: same GC on multiple loans with suspiciously synchronized draw timing (collusion pattern)

#### 2b. Inspection Report AI Analysis
- When an inspector submits a `DrawInspectionReport`, AI parses:
  - Photo metadata (EXIF date/location — confirm photos were taken on-site and recently)
  - Free-text concerns section for risk keywords
  - Per-line % complete deltas vs. draw request amounts
- Produces `InspectionAiAnalysis` appended to the inspection report:
  - Photo authenticity score
  - Concern severity classification
  - Recommended approved amount (AI's independent computation vs. inspector's recommendation)
  - Flag if inspector's certified % complete is inconsistent with prior trend

#### 2c. Budget Burn Rate Monitor
- Runs daily across all `ACTIVE` loans.
- Compares actual `drawnToDate / revisedBudget` against expected curve for the project type and timeline.
- Projects draws at current velocity → estimate of when each line item runs out.
- Flags: line items likely to require a change order in the next 2 draws.
- Flags: contingency burn rate — if contingency is >50% depleted and project is <60% complete.

#### 2d. Completion Forecasting
- Model: current `percentComplete` + draw velocity (draws per month) + remaining budget → estimated completion date.
- Confidence interval: P25/P50/P75 based on historic comparable project distributions.
- Updated every time a draw is disbursed or inspection is completed.
- Exposed on loan overview and portfolio dashboard.

#### 2e. Risk Flag Auto-Computation (enhanced)
Extends the base `ConstructionRiskFlag` schema from Phase 3:

```typescript
export type ConstructionRiskFlagCode =
  | 'STALLED_PROJECT'               // No draw in N days (configurable)
  | 'OVER_BUDGET'                   // Actuals + pending COs > budget × threshold
  | 'SCHEDULE_SLIP'                 // Completion forecast > target by N days
  | 'INSPECTION_CONCERN'            // Inspector flagged issues
  | 'INSPECTION_PHOTO_ANOMALY'      // AI detected photo metadata inconsistency
  | 'LIEN_WAIVER_MISSING'           // Draw approved, waiver not received
  | 'CONTRACTOR_LICENSE_EXPIRING'   // License expires within N days
  | 'CONTRACTOR_DISQUALIFIED'       // License expired or GC placed on watch
  | 'CONTRACTOR_CAPACITY_RISK'      // GC has too many concurrent active projects
  | 'LOW_ARV_COVERAGE'              // Loan exposure approaching ARV threshold
  | 'HIGH_RETAINAGE_BACKLOG'        // Large retainage unreleased near maturity
  | 'TITLE_HOLD'                    // Title search returned exception
  | 'INTEREST_RESERVE_DEPLETING'    // Reserve < N days remaining at current burn
  | 'MATURITY_APPROACHING'          // Loan matures in N days, completion not certain
  | 'DRAW_ANOMALY'                  // AI anomaly detection triggered
  | 'CONTINGENCY_NEARLY_EXHAUSTED'  // Contingency > 75% consumed
  | 'CHANGE_ORDER_VELOCITY'         // Multiple COs in short window — scope creep risk
  | 'CPP_TRIGGER';                  // Construction Protection Program threshold hit
```

#### 2f. Construction Protection Program (CPP) Trigger
- Automatically triggered when `CPP_TRIGGER` risk flag fires.
- CPP fires when any of:
  - `STALLED_PROJECT` + `OVER_BUDGET` simultaneously active
  - Loan enters `IN_DEFAULT`
  - 3+ `CRITICAL` severity flags active at once
- Actions on CPP trigger:
  1. Auto-escalate to senior review queue with full project snapshot
  2. AI generates **workout plan draft** (replacement GC options from pool, revised timeline estimate, budget recovery options)
  3. Notification to lender risk team + borrower
  4. Freeze further draw processing pending CPP resolution

---

### Pillar 3 — Servicing & Asset Management Automation

**Trigger:** Post-origination, continuous for all `ACTIVE` and `SUBSTANTIALLY_COMPLETE` loans.  
**Goal:** Automate the administrative overhead of managing an active construction loan portfolio.

#### 3a. Interest Reserve Management
- Track `interestReserveDrawn` vs. `interestReserveAmount`.
- Forecast depletion date based on current burn rate.
- Auto-compute monthly interest draw when reserve is active (no manual calculation needed).
- Flag `INTEREST_RESERVE_DEPLETING` when projected depletion is within `interestReserveWarningDays`.

#### 3b. Maturity Date Monitoring
- Daily check: `expectedCompletionDate` vs. `maturityDate`.
- When `AI completion forecast P75 > maturityDate - maturityWarningDays`, fire `MATURITY_APPROACHING` flag.
- AI generates extension recommendation: estimated days needed, required documentation checklist.

#### 3c. Automated Status Reporting
- Configurable frequency (default: monthly, per `statusReportFrequencyDays`).
- Auto-generates `ConstructionStatusReport` for every active loan:
  - % complete, budget burn, draw history snapshot
  - Risk flag summary
  - Completion forecast (P50 date)
  - Pending items (lien waivers, inspections, change orders)
- Delivered via notification system to lender + optionally borrower.
- PDF-renderable for investor / warehouse line reporting.

```typescript
export interface ConstructionStatusReport {
  id: string;
  constructionLoanId: string;
  tenantId: string;
  reportDate: string;
  reportType: 'SCHEDULED' | 'ON_DEMAND' | 'CPP' | 'MATURITY_ALERT';
  generatedBy: 'AI_AUTO' | 'HUMAN';

  summary: string;                     // AI-generated narrative paragraph
  percentComplete: number;
  completionForecastP50: string;       // ISO date
  completionForecastP75: string;
  daysToMaturity: number;

  budgetSnapshot: {
    totalBudget: number;
    totalDrawnToDate: number;
    totalRemainingBudget: number;
    contingencyRemaining: number;
    retainageHeld: number;
  };

  activeRiskFlags: ConstructionRiskFlag[];
  pendingDraws: number;
  pendingInspections: number;
  pendingLienWaivers: number;
  pendingChangeOrders: number;

  narrativeInsights: string[];         // AI bullet points: key observations
  recommendedActions: string[];        // AI-suggested next steps for loan admin
}
```

#### 3d. Construction-to-Perm Conversion Readiness
- For `GROUND_UP` loans nearing completion:
  - Auto-check: all milestones complete, certificate of occupancy received, final inspection passed, retainage released.
  - Generate conversion readiness checklist with completion status per item.
  - Flag outstanding items blocking conversion.
  - Pre-populate permanent loan order (appraisal order for as-completed value if required).

#### 3e. Portfolio Stress Testing
- Run what-if scenarios across the portfolio:
  - "What if all projects slip 30 days?" → financial impact
  - "What if material costs increase 10%?" → which loans breach ARV coverage?
  - "What if 5% of projects go to CPP?" → reserve requirement
- Results feed the Portfolio Analytics module (existing infrastructure).

#### 3f. Automated Disbursement Initiation (configurable)
- After draw approval by authorized reviewer, if `autoInitiateDisbursement = true` in tenant config:
  - System auto-generates disbursement record with verified wire/ACH details.
  - Creates audit trail entry.
  - Human still confirms (two-person authorization rule) — never fully automated disbursement.

---

### AI Services Build List

```
src/services/ai/
  construction-feasibility.service.ts   → Pillar 1: feasibility scoring
  construction-monitor.service.ts       → Pillar 2: ongoing risk eval cron
  draw-anomaly-detector.service.ts      → Pillar 2: draw pattern analysis
  inspection-ai-analyzer.service.ts     → Pillar 2: photo + report AI parse
  completion-forecaster.service.ts      → Pillar 2: forecast model
  construction-servicing-ai.service.ts  → Pillar 3: interest reserve, maturity, reports
  construction-report-generator.service.ts → Pillar 3: automated status reports
  construction-cpp.service.ts           → Pillar 2+3: CPP workflow
```

---

## Phase 5 — Frontend (UI Module)

**Location:** `l1-valuation-platform-ui`

### New Routes / Pages

```
/construction                             → Portfolio monitor dashboard
/construction/loans                       → Loan list
/construction/loans/new                   → Create loan wizard (incl. budget entry + feasibility pre-check)
/construction/loans/:id                   → Loan detail (tabs below)
  /construction/loans/:id/overview        → Summary + milestones + risk flags + AI completion forecast
  /construction/loans/:id/feasibility     → FeasibilityReport viewer + lender override
  /construction/loans/:id/budget          → Budget table with actuals + AI line-item findings
  /construction/loans/:id/draws           → Draw history + current draw
  /construction/loans/:id/draws/new       → Submit draw request
  /construction/loans/:id/draws/:drawId   → Draw detail + approval workflow + AI anomaly alerts
  /construction/loans/:id/change-orders   → Change order history + new CO
  /construction/loans/:id/contractors     → GC + sub profiles + feasibility check
  /construction/loans/:id/documents       → Lien waivers, permits, certificates
  /construction/loans/:id/servicing       → Interest reserve, status reports, conversion readiness
  /construction/loans/:id/reports         → AI-generated status reports history
/construction/inspections                 → All draw inspections queue
/construction/inspections/:id             → Inspection detail + photo gallery + AI analysis overlay
/construction/contractors                 → Contractor registry
/construction/contractors/:id             → Contractor profile + license status + capacity view
/construction/feasibility                 → Feasibility rule configuration (lender admin)
/construction/servicing                   → Servicing dashboard: interest reserves, maturities, status reports
/construction/reports                     → Portfolio reports: variance, draw history, stress test results
```

### Key UI Components

| Component | Purpose |
|---|---|
| `BudgetTable` | Line items with original/revised/drawn/remaining columns, AI findings badges, heat-mapped for over/under |
| `DrawRequestForm` | GC/borrower submits draw with line item amounts + AI pre-check before submit |
| `DrawApprovalWorkflow` | Reviewer reduces/approves per line item, side-by-side with inspection report + AI anomaly alert banner |
| `DrawInspectionReport` | Tabbed: overview, per-line findings, photo gallery, AI photo analysis overlay, concerns |
| `FeasibilityReportViewer` | Full feasibility report with per-line findings, custom rule results, ARV coverage, override form |
| `FeasibilityRuleEditor` | Lender-admin UI to define/edit custom `FeasibilityRule` set |
| `ProjectTimelineBar` | Gantt-style milestone tracker with AI completion forecast overlaid |
| `CompletionForecastCard` | P25/P50/P75 date fan chart updated per draw |
| `ConstructionPortfolioMap` | Geographic heat map of active projects colored by risk severity |
| `DrawVelocityChart` | Bar chart of monthly draw amounts vs. expected budget drawdown curve |
| `BurnRateWidget` | Budget + contingency burn rate with AI projection lines |
| `RiskFlagPanel` | All active flags with severity, detection date, resolve action |
| `ChangeOrderDiff` | Before/after budget line comparison for review |
| `ContractorCard` | License status (manual + API verified), risk tier, capacity, project history |
| `LienWaiverTracker` | Status per-draw with upload action |
| `InterestReserveWidget` | Reserve balance, burn rate, projected depletion date |
| `MaturityCountdown` | Days to maturity, completion forecast vs. maturity warning |
| `StatusReportViewer` | AI-generated status report with narrative, actions, downloadable PDF |
| `StressTestRunner` | Portfolio stress test configuration + results table |
| `ConversionReadinessChecklist` | Ground-up: items required before permanent financing |
| `CPPWorkflowPanel` | CPP trigger alert, workout plan draft, escalation controls |

---

## Data Model Summary (Cosmos DB Containers)

| Container | Document Types | Partition Key |
|---|---|---|
| `construction-loans` | `ConstructionLoan`, `ConstructionBudget`, `ChangeOrder` | `/tenantId` |
| `draws` | `DrawRequest`, `DrawInspectionReport` | `/constructionLoanId` |
| `contractors` | `ContractorProfile` | `/tenantId` |

> Note: Reuse existing `inspections` container structure or create `draw-inspections` sub-partition. Decision at implementation time.

---

## Dependency Map (Build Order)

```
[1] Types
  construction-loan.types.ts          (ConstructionLoan, Budget, Milestone, ContractorProfile)
  draw-request.types.ts               (DrawRequest, DrawInspectionReport, LienWaiver)
  change-order.types.ts               (ChangeOrder)
  construction-config.types.ts        (TenantConstructionConfig, FeasibilityRule)
  feasibility-report.types.ts         (FeasibilityReport, ContractorFeasibilityResult)
  construction-status-report.types.ts (ConstructionStatusReport)

[2] Core Services (pure business logic, no infra creation)
  construction-loan.service.ts        → CRUD + status transitions
  construction-budget.service.ts      → Budget versioning, variance calc, retainage math
  draw-request.service.ts             → Draw lifecycle + eligibility from TenantConstructionConfig
  draw-inspection.service.ts          → Extends inspection.service.ts pattern for draw context
  change-order.service.ts             → Approval creates new budget version
  contractor.service.ts               → Profile CRUD + dual license verification (upload + API)
  construction-risk.service.ts        → Risk flag computation (on-demand + cron)
  construction-config.service.ts      → TenantConstructionConfig CRUD + defaults

[3] AI Services
  ai/construction-feasibility.service.ts       → Pillar 1: budget scoring + rule engine
  ai/draw-anomaly-detector.service.ts          → Pillar 2: draw pattern anomaly detection
  ai/inspection-ai-analyzer.service.ts         → Pillar 2: photo metadata + report NLP
  ai/completion-forecaster.service.ts          → Pillar 2: P25/P50/P75 forecast model
  ai/construction-monitor.service.ts           → Pillar 2: daily cron evaluation of all ACTIVE loans
  ai/construction-cpp.service.ts               → Pillar 2+3: CPP trigger + workout plan generation
  ai/construction-servicing-ai.service.ts      → Pillar 3: interest reserve, maturity, conversion readiness
  ai/construction-report-generator.service.ts  → Pillar 3: AI narrative status reports
  ai/construction-stress-tester.service.ts     → Pillar 3: portfolio stress scenarios

[4] Controllers
  construction-loan.controller.ts
  draw-request.controller.ts
  draw-inspection.controller.ts
  change-order.controller.ts
  contractor.controller.ts
  construction-portfolio.controller.ts         → Aggregation: portfolio dashboard data
  construction-feasibility.controller.ts       → Feasibility report + rule config
  construction-servicing.controller.ts         → Interest reserve, maturity, status reports
  construction-config.controller.ts            → TenantConstructionConfig management

[5] Tests (Vitest)
  construction-loan.service.test.ts
  draw-request.service.test.ts
  construction-budget.service.test.ts
  change-order.service.test.ts
  construction-risk.service.test.ts
  construction-feasibility.service.test.ts
  draw-anomaly-detector.service.test.ts
  completion-forecaster.service.test.ts
  construction-servicing-ai.service.test.ts

[6] Frontend (UI)
  Per Phase 5 routes above
```

---

## Key Business Rules

### Draw Eligibility
1. Loan must be in `ACTIVE` status.
2. If `TenantConstructionConfig.allowConcurrentDraws = false` (default): no other draw may be in `SUBMITTED`, `INSPECTION_ORDERED`, `UNDER_REVIEW`, or `APPROVED` state. If `allowConcurrentDraws = true`, enforce `maxConcurrentDraws` limit.
3. Requested amount cannot exceed `remainingBalance` across affected `BudgetLineItems`.
4. If `requireInspectionBeforeDraw = true` (default): an accepted `DrawInspectionReport` must exist before draw can advance to `UNDER_REVIEW`.
5. Lien waiver from prior draw must be `RECEIVED` unless within `lienWaiverGracePeriodDays` (default 0).
6. If Feasibility Engine is enabled and `feasibilityBlocksApproval = true`: loan's `FeasibilityReport` must have verdict `PASS` or a human-reviewed override before first draw.

### Retainage
- Withheld as `retainagePercent` (default 10%, from loan record which may override tenant default) of each approved draw gross amount.
- Accrues in `loan.retainageHeld`.
- **Auto-trigger:** when `loan.percentComplete >= TenantConstructionConfig.retainageReleaseThreshold` (default 95%): system auto-creates a Retainage Release draw record and fires notification to lender.
- Release draw requires human approval (always — `retainageReleaseRequiresHumanApproval` is non-negotiable in design, even if config says otherwise).

### Budget Change Orders
- Any net increase to a budget line item requires a Change Order.
- Change orders must be approved before they affect draw eligibility.
- Each approved CO increments `budget.version` and writes a new snapshot (immutable history).
- Contingency draws do not require a CO but debit `contingencyRemaining`; fire `CONTINGENCY_NEARLY_EXHAUSTED` when remaining < 25%.

### License Verification (Dual)
- On save of a `ContractorProfile`, both paths run concurrently:
  1. **Manual upload path**: document stored in Blob; status set to `MANUAL_PENDING` until a reviewer marks it `MANUAL_VERIFIED`.
  2. **API path**: call state license registry API (NMLS or state-specific); result stored atomically with timestamp and API source; status set to `API_VERIFIED` or `API_NOT_FOUND`.
- Overall `licenseVerificationStatus` is `VERIFIED` when either path succeeds; `FAILED` only when API returns a negative result AND no manual upload exists.
- Neither path blocks the other.

### Construction Risk Flags
- `STALLED_PROJECT`: `lastDrawDisbursedAt > now - stalledProjectDays` AND `percentComplete < 95`.
- `OVER_BUDGET`: `totalDrawsApproved + sum(pendingCO.totalDelta) > totalRevisedBudget × (1 + overBudgetThresholdPct / 100)`.
- `LOW_ARV_COVERAGE`: `(loanAmount + approvedChangeOrderDelta) / arvEstimate > lowArvCoverageThreshold`.
- All thresholds read from `TenantConstructionConfig` — no hardcoded values in service logic.

### ARV Integration
- Every construction loan should have an associated `ArvAnalysis` (existing engine).
- For Fix & Flip / Rehab: existing `calculateArv` output populates `loan.arvEstimate`.
- For Ground-Up: ARV comes from as-completed appraisal on plans, linked via `relatedAppraisalIds`.
- Feasibility Engine uses `loan.arvEstimate` for LTV coverage check as part of `FeasibilityReport`.

---

## Real-Time Collaboration via Azure Fluid Relay

> The platform is already running Azure Fluid Relay with a production-ready stack: `CollaborationService` (Key Vault JWT, Managed Identity), `AzureClient` with `BackendTokenProvider`, `CollaborationProvider`, `CollaborativeTextField` (SharedMap sync + live pulse indicator), and `CollaboratorAvatars`. Construction finance surfaces are high-value targets for this capability because they are inherently multi-party workflows.

### Container ID Conventions (extend existing pattern)

| Container ID | Scope | Who collaborates |
|---|---|---|
| `construction-{loanId}` | Loan overview, milestones, notes | Underwriter + loan admin + reviewer |
| `budget-{budgetId}` | Budget line items — reviewer notes, feasibility override | Multiple underwriters + risk team |
| `draw-{drawId}` | Draw approval — per-line approvals, reviewer notes | Loan admin + approver dual review |
| `inspection-{inspectionId}` | Inspection report — lender comments, AI override notes | Loan admin + risk reviewer |
| `changeorder-{changeOrderId}` | Change order review — financial impact discussion | Underwriter + senior approver |
| `feasibility-{loanId}` | Feasibility report — team override discussion | Risk team + credit officer |
| `cpp-{loanId}` | CPP workout plan — co-authoring the recovery plan | Senior team + borrower rep |

### Collaboration Touchpoints per Surface

**Budget Review** — Multiple underwriters can simultaneously review budget line items. `CollaborativeTextField` drives notes per line item. `CollaboratorAvatars` in the `BudgetTable` header shows who's reviewing. A lender-configurable "Budget Approved" SharedMap key prevents conflicting approvals.

**Draw Approval Workflow** — The dual-approval pattern (two authorized reviewers must approve) is a natural real-time collaboration scenario. Reviewer A approves their portion; Reviewer B sees the live updates via SharedMap before adding their approval. Line-item approval state is stored in the SharedMap alongside notes.

**Inspection Report Review** — Inspector submits; lender team opens simultaneously. AI analysis results are visible to all. Notes and "Accept"/"Dispute" flags sync in real-time so two reviewers don't contradict each other.

**Change Order Review** — The `ChangeOrderDiff` component wraps a `CollaborationProvider`. The requester and approver both see the live budget impact. Comment fields are `CollaborativeTextField` instances. Approval/rejection state in SharedMap prevents double-action.

**CPP Workout Plan** — The highest-stakes collaboration surface. Senior lender + workout specialist co-author the recovery plan in real-time. `CollaborativeTextField` on every narrative section. `CollaboratorAvatars` shows all parties present.

### New Shared Components Needed

| Component | Purpose |
|---|---|
| `CollaborativeLineItemNotes` | `CollaborativeTextField` scoped to a budget/draw line item key |
| `CollaborativeApprovalState` | SharedMap-backed approval button that shows other participants' live state |
| `CollaborativeFeasibilityOverride` | Override verdict field with co-reviewer visibility |
| `ConstructionCollaboratorBar` | `CollaboratorAvatars` + connection status, used as a standard header in all collaborative surfaces |

### Graceful Degradation
All construction finance surfaces must render fully without collaboration (when Fluid Relay env vars are absent or connection fails — existing `CollaborationProvider` behavior). Collaboration is additive, never blocking.

---

## Competitive Comparison vs. CFSI (and beyond)

| Capability | CFSI | Our Platform | Phase |
|---|---|---|---|
| Construction loan management | ✅ Manual | ✅ Automated CRUD + lifecycle | 1 |
| Budget setup & line-item tracking | ✅ Manual | ✅ Structured with computed actuals | 1 |
| Draw management & disbursement | ✅ Manual review | ✅ Full workflow + approval chain | 2 |
| Construction draw inspections | ✅ Field+desktop | ✅ Field+desktop+drive-by+final, platform-native | 2 |
| Contractor & vendor management | ✅ Manual vetting | ✅ Structured profiles + existing vendor engine | 2 |
| License verification | ✅ Manual | ✅ **Both** manual upload + live API call | 2 |
| Budget change orders | ✅ Manual | ✅ Approval workflow + budget versioning | 2 |
| Risk mitigation strategies | ✅ Human judgment | ✅ Auto-computed `ConstructionRiskFlag` set | 3 |
| Portfolio monitoring | ✅ Manual reporting | ✅ Real-time dashboard + heat map | 3 |
| Financial reporting | ✅ Manual | ✅ Variance, disbursement, draw history | 3 |
| **Budget feasibility analysis** | Subjective underwriter review | ✨ AI scoring vs. market benchmarks + lender rules | 4 |
| **Lender-configurable feasibility rules** | ❌ | ✨ Full `FeasibilityRule` engine per tenant | 4 |
| **Draw anomaly detection** | ❌ | ✨ AI pattern analysis vs. project + portfolio | 4 |
| **Inspection photo AI analysis** | ❌ | ✨ EXIF verification + authenticity scoring | 4 |
| **Completion forecasting** | ❌ | ✨ P25/P50/P75 fan chart, updated per draw | 4 |
| **Budget burn rate projection** | ❌ | ✨ Per-line-item depletion forecast | 4 |
| **CPP automated trigger** | Manual escalation | ✨ AI-triggered CPP + auto workout plan draft | 4 |
| **Interest reserve management** | Manual tracking | ✨ Auto-compute monthly draws + depletion forecast | 4 |
| **Maturity date monitoring** | Calendar reminder | ✨ AI forecast vs. maturity + extension rec. | 4 |
| **Automated status reports** | ❌ | ✨ AI narrative reports on schedule, PDF export | 4 |
| **Portfolio stress testing** | ❌ | ✨ What-if scenario modeling | 4 |
| **Construction-to-perm readiness** | ❌ | ✨ Automated checklist + pre-populate perm order | 4 |
| **Real-time collaborative budget review** | ❌ | ✨ Azure Fluid Relay — multi-user SharedMap, live presence | 5 |
| **Collaborative draw approval (dual-auth)** | ❌ | ✨ SharedMap-backed per-line approval, live state sync | 5 |
| **Collaborative inspection review** | ❌ | ✨ Real-time notes + accept/dispute, CollaboratorAvatars | 5 |
| **CPP workout plan co-authoring** | ❌ | ✨ All parties co-edit workout plan in real-time | 5 |

---

## Architectural Decisions — RESOLVED (March 6, 2026)

| Decision | Resolution | Rationale |
|---|---|---|
| **Cosmos containers** | Separate `construction-loans`, `draws`, `contractors` | Different access patterns, query shapes, and scale characteristics from `orders`. Clean isolation. |
| **One draw at a time** | Tenant-configurable via `TenantConstructionConfig.allowConcurrentDraws` (default: false) | Some lenders allow concurrent partial draws; strict single-draw is the safe default. |
| **Retainage release** | Auto-trigger when `percentComplete >= retainageReleaseThreshold`, threshold is configurable, requires human final approval | Automation creates the release draw record + notification; a human still approves + disburses. |
| **License verification** | Both simultaneously: manual document upload AND external state license API call | API runs on save; manual upload is the fallback/override. Both results stored. |
| **Draw inspector pool** | Extend existing vendor matching engine — draw inspectors are vendors tagged `DRAW_INSPECTOR` | No new pool needed; inherits geographic matching, availability, rating, and assignment logic already built. |
| **Phase 1 scope** | All three types: Ground-Up, Fix & Flip, Rehab | Budget category sets differ by type but the core loan/budget/draw model is the same. Type-specific validation rules handle the differences. |

### TenantConstructionConfig Shape

All configurable construction finance behavior is driven by a per-tenant config document stored in Cosmos:

```typescript
export interface TenantConstructionConfig {
  tenantId: string;

  // Draw rules
  allowConcurrentDraws: boolean;           // default: false
  maxConcurrentDraws: number;              // default: 1 (only used if allowConcurrentDraws = true)
  requireInspectionBeforeDraw: boolean;    // default: true
  allowDesktopInspection: boolean;         // default: true
  lienWaiverGracePeriodDays: number;       // default: 0 (must be received before next draw)

  // Retainage
  defaultRetainagePercent: number;         // default: 10
  retainageReleaseAutoTrigger: boolean;    // default: true
  retainageReleaseThreshold: number;       // default: 95 (percentComplete)
  retainageReleaseRequiresHumanApproval: boolean; // default: true (always)

  // Feasibility AI gates (see Feasibility Engine below)
  feasibilityEnabled: boolean;             // default: true
  feasibilityBlocksApproval: boolean;      // false = warning only; true = hard gate
  feasibilityMinScore: number;             // default: 65 (0-100)
  feasibilityCustomRules: FeasibilityRule[]; // lender-defined custom rules

  // Risk monitoring
  stalledProjectDays: number;              // default: 60
  overBudgetThresholdPct: number;          // default: 5 (i.e. 5% over triggers flag)
  scheduleSlipDays: number;               // default: 30
  lowArvCoverageThreshold: number;         // default: 0.90 (loan/ARV ratio)
  contractorLicenseExpiryWarningDays: number; // default: 30

  // Monitoring AI
  aiMonitoringEnabled: boolean;            // default: true
  aiDrawAnomalyDetection: boolean;         // default: true
  aiCompletionForecastingEnabled: boolean; // default: true

  // Servicing AI
  aiServicingEnabled: boolean;             // default: true
  interestReserveWarningDays: number;      // default: 30 (before depletion)
  maturityWarningDays: number;             // default: 60
  autoGenerateStatusReports: boolean;      // default: true
  statusReportFrequencyDays: number;       // default: 30

  updatedAt: string;
  updatedBy: string;
}

export interface FeasibilityRule {
  id: string;
  name: string;
  category: BudgetCategory | 'OVERALL';
  ruleType: 'MIN_AMOUNT' | 'MAX_AMOUNT' | 'MIN_PCT_OF_TOTAL' | 'MAX_PCT_OF_TOTAL'
           | 'REQUIRED_IF_TYPE' | 'CUSTOM_EXPRESSION';
  value: number;
  loanTypes: ConstructionLoanType[];   // applies to which loan types
  severity: 'WARNING' | 'FAIL';
  message: string;                     // shown to reviewer
}
```

---

## Estimated Effort

| Phase | Focus | Estimated Sprints |
|---|---|---|
| 1 | Types + Construction Loan CRUD + Budget + TenantConstructionConfig | 2 sprints |
| 2 | Draw lifecycle + Inspections + Change Orders + Contractors + dual license verification | 3 sprints |
| 3 | Portfolio monitor + Risk flags + Reports | 2 sprints |
| 4a | Feasibility Engine (Pillar 1: budget AI + lender rule engine + contractor check) | 2 sprints |
| 4b | Ongoing Monitor AI (Pillar 2: draw anomaly, inspection AI, burn rate, forecasting, CPP) | 3 sprints |
| 4c | Servicing AI (Pillar 3: interest reserve, maturity, status reports, stress testing, conversion) | 2 sprints |
| 5 | Full UI (all pages, AI components, feasibility viewer, servicing dashboard, Fluid Relay collaboration on budget/draw/inspection/CPP surfaces) | 4-5 sprints |
| **Total** | | **~18–20 sprints** |

---

## Next Step — Implementation Kickoff

All decisions are resolved. Begin implementation in order:

**Sprint 1 (Backend — Phase 1 foundation):**
1. `src/types/construction-loan.types.ts`
2. `src/types/draw-request.types.ts`
3. `src/types/change-order.types.ts`
4. `src/types/construction-config.types.ts` (includes `TenantConstructionConfig` + `FeasibilityRule`)
5. Tests for Phase 1 services (TDD — write tests first)
6. `src/services/construction-loan.service.ts`
7. `src/services/construction-budget.service.ts`
8. `src/services/construction-config.service.ts`

**Sprint 2 (Backend — Phase 1 complete + Phase 2 start):**
9. `src/controllers/construction-loan.controller.ts`
10. `src/controllers/construction-config.controller.ts`
11. `src/services/draw-request.service.ts` (eligibility rules read from `TenantConstructionConfig`)
12. `src/services/contractor.service.ts` (dual license verification)

Say "start" to begin Sprint 1 implementation.
