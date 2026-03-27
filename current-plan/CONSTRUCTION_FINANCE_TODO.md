# Construction Finance Module — Master TODO Tracker

**Plan Reference:** `CONSTRUCTION_FINANCE_MODULE_PLAN.md`  
**Started:** March 6, 2026  
**Last Updated:** March 6, 2026 (Session 3 — Phase 2 complete; 89/89 tests green)  

Mark items `[x]` when complete. Add the date and initials in a trailing comment, e.g. `[x] item — ✅ 2026-03-10`.

---

## Legend
- `[BE]` Backend (`appraisal-management-backend`)
- `[UI]` Frontend (`l1-valuation-platform-ui`)
- `[TEST]` Test file
- `[INFRA]` Infrastructure / config
- `🤝` Azure Fluid Relay collaboration surface

---

## Phase 1 — Foundation: Types + Construction Loan + Budget

### 1.1 Type Definitions `[BE]`
- [x] `src/types/construction-loan.types.ts` — ✅ 2026-03-06
  - [x] `ConstructionLoanType` union (`GROUND_UP` | `FIX_FLIP` | `REHAB` | `MULTIFAMILY` | `COMMERCIAL`)
  - [x] `ConstructionLoanStatus` union (7 statuses: `UNDERWRITING` → `CLOSED`)
  - [x] `BudgetCategory` union (23 categories)
  - [x] `BudgetLineItem` interface (original / change-order / revised / drawn / remaining / % complete)
  - [x] `ConstructionBudget` interface (versioned snapshot)
  - [x] `ContractorProfile` interface (license + bond + risk tier)
  - [x] `ProjectMilestone` interface
  - [x] `ConstructionLoan` interface (full entity)
- [x] `src/types/draw-request.types.ts` — ✅ 2026-03-06
  - [x] `DrawRequestStatus` union (10 statuses)
  - [x] `LienWaiverStatus` union
  - [x] `DrawInspectionType` union (`FIELD` | `DESKTOP` | `DRIVE_BY` | `FINAL`)
  - [x] `DrawLineItemRequest` interface
  - [x] `DrawLineItemResult` interface (approved / retainage / net)
  - [x] `DrawInspectionReport` interface (line-item findings + photos)
  - [x] `DrawRequest` interface (full entity)
- [x] `src/types/change-order.types.ts` — ✅ 2026-03-06
  - [x] `ChangeOrderStatus` union
  - [x] `ChangeOrder` interface (line-item deltas + approval chain)
- [x] `src/types/construction-config.types.ts` — ✅ 2026-03-06
  - [x] `TenantConstructionConfig` interface (all configurable behavior)
  - [x] `FeasibilityRule` interface (lender-defined rules)
- [x] `src/types/feasibility-report.types.ts` — ✅ 2026-03-06
  - [x] `FeasibilityReport` interface (scores, line findings, ARV check, timeline check)
  - [x] `ContractorFeasibilityResult` interface
- [x] `src/types/construction-status-report.types.ts` — ✅ 2026-03-06
  - [x] `ConstructionStatusReport` interface (AI narrative + metrics + action items)
  - [x] `ConstructionRiskFlag` interface
  - [x] `ConstructionRiskFlagCode` union (18 codes)

### 1.2 Core Services `[BE]`
- [x] `src/services/construction-config.service.ts` — ✅ 2026-03-06
  - [x] `getConfig(tenantId)` — loads from Cosmos, throws if missing (no silent defaults)
  - [x] `upsertConfig(tenantId, config)` — create/update
  - [x] `getDefaultConfig()` — returns documented defaults (used only at tenant onboarding)
- [x] `src/services/construction-loan.service.ts` — ✅ 2026-03-06
  - [x] `createLoan(input, tenantId)` — validate + write to `construction-loans` container
  - [x] `getLoan(id, tenantId)` — fetch with budget + draw summary
  - [x] `listLoans(tenantId, filters)` — paginated, filterable by status/type
  - [x] `transitionStatus(id, newStatus, tenantId)` — validates allowed transitions
  - [x] `updateMilestone(loanId, milestoneId, update, tenantId)`
  - [x] `getLoanDrawSummary(loanId, tenantId)` — aggregate draw totals
- [x] `src/services/construction-budget.service.ts` — ✅ 2026-03-06 (pure functions + Cosmos I/O used by change-order service)
  - [x] `createBudget(loanId, lineItems, tenantId)` — version 1
  - [x] `getBudget(budgetId, tenantId)`
  - [x] `getCurrentBudget(loanId, tenantId)` — latest approved version
  - [x] `approveBudget(budgetId, approverId, tenantId)` — sets status + approvedAt
  - [x] `computeVariance(budgetId)` — returns per-line variance + totals
  - [x] `applyChangeOrder(changeOrderId, tenantId)` — creates new budget version (delegated to change-order.service)
  - [x] `computeRetainageRelease(loanId, tenantId)` — checks threshold, returns release amount

### 1.3 Tests `[TEST]`
- [x] `src/tests/construction-config.service.test.ts` — ✅ 2026-03-06
  - [x] Throws when config missing (no silent defaults)
  - [x] Returns correct defaults at onboarding
- [x] `src/tests/construction-loan.service.test.ts` — ✅ 2026-03-06
  - [x] Creates loan, rejects invalid status transitions
  - [x] Draw summary aggregates correctly
- [x] `src/tests/construction-budget.service.test.ts` — ✅ 2026-03-06
  - [x] Versions increment on change order apply
  - [x] Variance computed correctly
  - [x] Retainage release threshold check

### 1.4 Controllers `[BE]`
- [x] `src/controllers/construction-loan.controller.ts` — ✅ 2026-03-06
  - [x] `POST /api/construction-loans`
  - [x] `GET /api/construction-loans` (tenant-scoped, filterable)
  - [x] `GET /api/construction-loans/:id`
  - [x] `PUT /api/construction-loans/:id/status`
  - [x] `GET /api/construction-loans/:id/budget`
  - [x] `GET /api/construction-loans/:id/timeline`
  - [x] `GET /api/construction-loans/:id/draws` (summary, full list in Phase 2)
- [x] `src/controllers/construction-config.controller.ts` — ✅ 2026-03-06
  - [x] `GET /api/construction-config`
  - [x] `PUT /api/construction-config`

### 1.5 Register Routes `[BE]`
- [x] Add `construction-loan.controller` to main `app.ts` router — ✅ 2026-03-06
- [x] Add `construction-config.controller` to main `app.ts` router — ✅ 2026-03-06

### 1.6 Seed Data `[BE]`
- [ ] Add `TenantConstructionConfig` default seed for `demo-tenant` in `scripts/seed-demo-data.js`
- [ ] Add 3-5 sample `ConstructionLoan` seed documents (one each: GROUND_UP, FIX_FLIP, REHAB)
- [ ] Add sample `ConstructionBudget` per seed loan

---

## Phase 2 — Draw Lifecycle + Inspections + Change Orders + Contractors

### 2.1 Services `[BE]`
- [x] `src/services/draw-request.service.ts` — ✅ 2026-03-06
  - [x] `submitDraw(loanId, request, tenantId)` — run eligibility checks from `TenantConstructionConfig`
  - [x] `getDraw(drawId, tenantId)`
  - [x] `listDraws(loanId, tenantId)`
  - [x] `orderInspection(drawId, inspectionType, tenantId)`
  - [x] `reviewDraw(drawId, lineItemResults, reviewerId, tenantId)` — reduce/approve per line
  - [x] `approveDraw(drawId, approverId, tenantId)` — validates dual-auth if configured
  - [x] `disburseDraw(drawId, method, disbursedBy, tenantId)` — records disbursement, updates budget actuals
  - [x] `rejectDraw(drawId, reason, tenantId)`
  - [x] `holdDraw(drawId, reason, tenantId)`
  - [x] `updateLienWaiver(drawId, status, docUrl, tenantId)`
  - [x] Retainage withholding math (reads `retainagePercent` from loan, never hardcoded)
  - [x] Auto-trigger retainage release check after disburse (reads `TenantConstructionConfig`)
- [x] `src/services/draw-inspection.service.ts` — ✅ 2026-03-06
  - [x] `scheduleInspection(drawId, request, tenantId)` — advances DrawRequest to INSPECTION_ORDERED
  - [x] `submitInspectionReport(inspectionId, report, tenantId)` — inspector submits; advances draw to INSPECTION_COMPLETE
  - [x] `acceptInspection(inspectionId, acceptedBy, tenantId)`
  - [x] `disputeInspection(inspectionId, reason, tenantId)`
  - [x] `getInspectionById(inspectionId, constructionLoanId)`
  - [x] `listInspectionsByDraw(drawId, constructionLoanId)`
- [x] `src/services/change-order.service.ts` — ✅ 2026-03-06
  - [x] `submitChangeOrder(input)` — validates budget exists, sequential CO# assignment
  - [x] `reviewChangeOrder(coId, tenantId, reviewedBy)` — SUBMITTED → UNDER_REVIEW
  - [x] `approveChangeOrder(coId, tenantId, approverId)` — applies deltas, creates budget v+1
  - [x] `rejectChangeOrder(coId, tenantId, reason, rejectedBy)`
  - [x] `listChangeOrders(tenantId, opts)`
  - [ ] `getChangeOrderImpact(coId, tenantId)` — net delta + new total + ARV coverage impact (deferred to Phase 3)
- [x] `src/services/contractor.service.ts` — ✅ 2026-03-06 (core CRUD + verification)
  - [x] `createContractor(input, tenantId)` — triggers dual license verification
  - [x] `getContractor(id, tenantId)`
  - [x] `listContractors(tenantId, filters)`
  - [ ] `verifyLicenseManual(contractorId, docUrl, verifiedBy, tenantId)` — manual path (TODO)
  - [ ] `verifyLicenseApi(contractorId, tenantId)` — API path (state registry call) (TODO)
  - [x] `updateRiskTier(contractorId, tier, reason, tenantId)`
  - [ ] `getContractorProjects(contractorId, tenantId)` — active projects for capacity check (TODO)
  - [ ] `addContractorToLoan(loanId, contractorId, tenantId)` — link GC to loan (TODO)
  - [ ] Tag `DRAW_INSPECTOR` vendor type in existing vendor matching engine (TODO)

### 2.2 Tests `[TEST]`
- [x] `src/tests/draw-request.service.test.ts` — ✅ 2026-03-06
  - [x] Eligibility: rejects draw when another in-flight draw exists (when `allowConcurrentDraws = false`)
  - [x] Eligibility: allows concurrent draw when `allowConcurrentDraws = true`
  - [x] Eligibility: rejects when `requireInspectionBeforeDraw = true` and no inspection
  - [x] Eligibility: lien waiver grace period enforced
  - [x] Retainage math: correct withholding per configured %
  - [x] Auto-retainage release triggered at configured threshold
  - [x] Disbursement updates budget actuals correctly
- [x] `src/tests/draw-inspection.service.test.ts` — ✅ 2026-03-06
  - [x] scheduleInspection creates inspection + advances draw to INSPECTION_ORDERED
  - [x] Rejects scheduling when draw not in SUBMITTED status
  - [x] submitInspectionReport advances draw to INSPECTION_COMPLETE
  - [x] acceptInspection / disputeInspection lifecycle
  - [x] listInspectionsByDraw returns correct results
- [x] `src/tests/change-order.service.test.ts` — ✅ 2026-03-06
  - [x] Approval creates new budget version (immutable history — v1 preserved, v2 created)
  - [x] Valid state machine transitions enforced (SUBMITTED → UNDER_REVIEW → APPROVED)
  - [x] Rejects approval of terminal-state CO
  - [x] Rejects approval when budgetLineItemId does not exist in budget
- [x] `src/tests/contractor.service.test.ts` — ✅ 2026-03-06
  - [x] Dual license verification — both paths run concurrently
  - [x] `VERIFIED` when either path succeeds
  - [x] `FAILED` only when API negative AND no manual upload

### 2.3 Controllers `[BE]`
- [x] `src/controllers/draw-request.controller.ts` — ✅ 2026-03-06
  - [x] `POST /api/construction/draws`
  - [x] `GET /api/construction/draws/:id`
  - [x] `GET /api/construction/draws` (loan-scoped)
  - [x] `PUT /api/construction/draws/:id/advance-status`
  - [x] `PUT /api/construction/draws/:id/review`
  - [x] `PUT /api/construction/draws/:id/disburse`
  - [x] `PUT /api/construction/draws/:id/lien-waiver`
- [x] `src/controllers/draw-inspection.controller.ts` — ✅ 2026-03-06
  - [x] `POST /api/construction/draw-inspections`
  - [x] `GET /api/construction/draw-inspections/:inspectionId`
  - [x] `GET /api/construction/draw-inspections/by-draw/:drawRequestId`
  - [x] `PUT /api/construction/draw-inspections/:id/submit`
  - [x] `PUT /api/construction/draw-inspections/:id/accept`
  - [x] `PUT /api/construction/draw-inspections/:id/dispute`
- [x] `src/controllers/change-order.controller.ts` — ✅ 2026-03-06
  - [x] `POST /api/construction/change-orders`
  - [x] `GET /api/construction/change-orders`
  - [x] `GET /api/construction/change-orders/:coId`
  - [x] `PUT /api/construction/change-orders/:coId/review`
  - [x] `PUT /api/construction/change-orders/:coId/approve`
  - [x] `PUT /api/construction/change-orders/:coId/reject`
- [x] `src/controllers/contractor.controller.ts` — ✅ 2026-03-06
  - [x] `POST /api/construction/contractors`
  - [x] `GET /api/construction/contractors/:id`
  - [x] `GET /api/construction/contractors` (tenant-scoped)
  - [x] `PUT /api/construction/contractors/:id/verify-license`
  - [x] `PUT /api/construction/contractors/:id/risk-tier`

### 2.4 Register Routes `[BE]`
- [x] Add `draw-request.controller` to `api-server.ts` — ✅ 2026-03-06
- [x] Add `draw-inspection.controller` to `api-server.ts` — ✅ 2026-03-06
- [x] Add `change-order.controller` to `api-server.ts` — ✅ 2026-03-06
- [x] Add `contractor.controller` to `api-server.ts` — ✅ 2026-03-06

---

## Phase 3 — Portfolio Monitor + Risk Flags + Reports

### 3.1 Services `[BE]`
- [ ] `src/services/construction-risk.service.ts`
  - [ ] `computeRiskFlags(loanId, tenantId)` — evaluate all 18 flag codes against `TenantConstructionConfig` thresholds (no hardcoded values)
  - [ ] `getRiskFlags(loanId, tenantId)` — current active flags
  - [ ] `resolveFlag(loanId, flagCode, resolvedBy, notes, tenantId)`
  - [ ] `computePortfolioRiskSummary(tenantId)` — aggregate for dashboard
  - [ ] Cron job registration: daily risk flag sweep across all `ACTIVE` loans
- [ ] `src/services/construction-portfolio.service.ts`
  - [ ] `getPortfolioDashboard(tenantId)` — summary cards + flag counts
  - [ ] `getDrawVelocity(tenantId, windowMonths)` — aggregate monthly draw amounts
  - [ ] `getPortfolioByGeography(tenantId)` — state/market breakdown for heat map
  - [ ] `getLoansNearingMaturity(tenantId)` — loans where completion forecast > maturity - N days
  - [ ] `getLoansWithPendingDraws(tenantId)` — dashboard widget

### 3.2 Tests `[TEST]`
- [ ] `src/tests/construction-risk.service.test.ts`
  - [ ] Each of 18 flag codes fires at correct threshold
  - [ ] Thresholds read from `TenantConstructionConfig`, not hardcoded
  - [ ] Flags resolve correctly
  - [ ] Portfolio summary aggregates correctly

### 3.3 Controllers `[BE]`
- [ ] `src/controllers/construction-portfolio.controller.ts`
  - [ ] `GET /api/construction-portfolio/dashboard`
  - [ ] `GET /api/construction-portfolio/draw-velocity`
  - [ ] `GET /api/construction-portfolio/geography`
  - [ ] `GET /api/construction-portfolio/maturing-loans`
  - [ ] `GET /api/construction-portfolio/pending-draws`

### 3.4 Register Routes `[BE]`
- [ ] Add `construction-portfolio.controller` to `app.ts`

---

## Phase 4a — AI: Feasibility Engine (Pillar 1)

### 4a.1 Service `[BE]`
- [ ] `src/services/ai/construction-feasibility.service.ts`
  - [ ] `runFeasibilityAnalysis(loanId, budgetId, tenantId)` → `FeasibilityReport`
    - [ ] Benchmark each `BudgetLineItem` against cost data (RSMeans or portfolio actuals)
    - [ ] Detect missing required line items per loan type
    - [ ] Score each category 0–100; roll up to `overallScore`
    - [ ] Evaluate lender's `FeasibilityRule[]` from `TenantConstructionConfig`
    - [ ] Run ARV/LTV coverage check against loan's `arvEstimate`
    - [ ] Assess timeline realism (requested days vs. AI estimate by type + scope)
  - [ ] `runContractorFeasibilityCheck(contractorId, loanId, tenantId)` → `ContractorFeasibilityResult`
    - [ ] License/bond/insurance vs. loan size
    - [ ] Capacity check (active projects count)
    - [ ] Portfolio history: prior stalls/defaults
  - [ ] `getFeasibilityReport(loanId, tenantId)` — retrieve stored report
  - [ ] `overrideFeasibilityVerdict(reportId, verdict, notes, reviewerId, tenantId)` — human override
  - [ ] `isFeasibilityGateBlocking(loanId, tenantId)` — used by draw eligibility check

### 4a.2 Tests `[TEST]`
- [ ] `src/tests/construction-feasibility.service.test.ts`
  - [ ] Under-funded line item correctly flagged
  - [ ] Missing line item detected per loan type
  - [ ] Custom `FeasibilityRule` evaluated: `FAIL` blocks when `feasibilityBlocksApproval = true`
  - [ ] ARV coverage check fires at correct threshold
  - [ ] Contractor capacity check fires correctly
  - [ ] Human override stored and respected

### 4a.3 Controller `[BE]`
- [ ] `src/controllers/construction-feasibility.controller.ts`
  - [ ] `POST /api/construction-loans/:id/feasibility` — run/re-run analysis
  - [ ] `GET /api/construction-loans/:id/feasibility` — get current report
  - [ ] `PUT /api/construction-loans/:id/feasibility/override` — human override
  - [ ] `GET /api/construction-config/feasibility-rules` — list rules
  - [ ] `PUT /api/construction-config/feasibility-rules` — update rules (admin)

---

## Phase 4b — AI: Ongoing Monitor (Pillar 2)

### 4b.1 Services `[BE]`
- [ ] `src/services/ai/draw-anomaly-detector.service.ts`
  - [ ] `analyzeDrawRequest(drawId, tenantId)` — detect anomalies before review
    - [ ] Phase-sequence check (draw out of order)
    - [ ] Amount vs. portfolio benchmark
    - [ ] Time since last draw
    - [ ] GC multi-loan synchronized draw pattern
  - [ ] Attach `DrawAnomalyAnalysis` to `DrawRequest`
- [ ] `src/services/ai/inspection-ai-analyzer.service.ts`
  - [ ] `analyzeInspectionReport(inspectionId, tenantId)` on report submission
    - [ ] EXIF date/location validation against scheduled inspection
    - [ ] Photo authenticity score
    - [ ] NLP on concerns text — severity classification
    - [ ] AI-recommended draw amount (independent of inspector's recommendation)
    - [ ] % complete trend consistency check
  - [ ] Attach `InspectionAiAnalysis` to `DrawInspectionReport`
- [ ] `src/services/ai/completion-forecaster.service.ts`
  - [ ] `forecastCompletion(loanId, tenantId)` → `{ p25, p50, p75 }` ISO dates
    - [ ] Model: current % complete + draw velocity + remaining budget
    - [ ] Confidence interval from historic comparable project distribution
  - [ ] Called after every draw disbursement and inspection acceptance
- [ ] `src/services/ai/construction-monitor.service.ts`
  - [ ] Daily cron: run `computeRiskFlags` + `forecastCompletion` + `burnRateProjection` for all `ACTIVE` loans
  - [ ] `projectBurnRate(loanId, tenantId)` — per-line depletion forecast
  - [ ] `detectContingencyRisk(loanId, tenantId)` — fires flag when contingency > 75% consumed
  - [ ] `detectChangeOrderVelocity(loanId, tenantId)` — multiple COs in short window
- [ ] `src/services/ai/construction-cpp.service.ts`
  - [ ] `evaluateCppTrigger(loanId, flags, tenantId)` — fires when CPP threshold met
  - [ ] `createCppWorkoutPlan(loanId, tenantId)` — AI-generates draft workout plan
  - [ ] `getCppStatus(loanId, tenantId)`
  - [ ] `resolveCpp(loanId, resolution, resolvedBy, tenantId)`

### 4b.2 Tests `[TEST]`
- [ ] `src/tests/draw-anomaly-detector.service.test.ts`
  - [ ] Phase-sequence anomaly detected
  - [ ] Normal draw passes without false positive
  - [ ] Multi-loan GC synchronization detected
- [ ] `src/tests/completion-forecaster.service.test.ts`
  - [ ] P50 forecast moves correctly with updated velocity
  - [ ] Returns valid date range (P25 ≤ P50 ≤ P75)
- [ ] `src/tests/construction-cpp.service.test.ts`
  - [ ] CPP trigger fires at correct flag combination
  - [ ] Does not fire on single non-critical flag

---

## Phase 4c — AI: Servicing & Asset Management (Pillar 3)

### 4c.1 Services `[BE]`
- [ ] `src/services/ai/construction-servicing-ai.service.ts`
  - [ ] `computeInterestReserveStatus(loanId, tenantId)` — balance, projected depletion date
  - [ ] `autoComputeMonthlyInterestDraw(loanId, tenantId)` — no manual calculation
  - [ ] `checkMaturityRisk(loanId, tenantId)` — forecast vs. maturity, fires `MATURITY_APPROACHING`
  - [ ] `generateConversionReadinessChecklist(loanId, tenantId)` — GROUND_UP only
  - [ ] `getItemsBlockingConversion(loanId, tenantId)` — pending items list
- [ ] `src/services/ai/construction-report-generator.service.ts`
  - [ ] `generateStatusReport(loanId, reportType, tenantId)` → `ConstructionStatusReport`
    - [ ] AI narrative paragraph (summary)
    - [ ] Budget snapshot, risk flags, pending items
    - [ ] P50/P75 completion forecast
    - [ ] AI-generated `recommendedActions[]`
  - [ ] `getReports(loanId, tenantId)` — list all reports
  - [ ] Scheduled trigger: daily check against `statusReportFrequencyDays`
  - [ ] PDF render hook (integrate with existing report builder infrastructure)
- [ ] `src/services/ai/construction-stress-tester.service.ts`
  - [ ] `runStressTest(tenantId, scenario)` — what-if portfolio scenarios
    - [ ] Scenario: all projects slip N days
    - [ ] Scenario: material cost increase N%
    - [ ] Scenario: N% of projects go to CPP
  - [ ] Returns financial impact summary per scenario

### 4c.2 Tests `[TEST]`
- [ ] `src/tests/construction-servicing-ai.service.test.ts`
  - [ ] Interest reserve depletion date computed correctly
  - [ ] `MATURITY_APPROACHING` fires at configured warning days
  - [ ] Conversion checklist items correct for GROUND_UP
- [ ] `src/tests/construction-report-generator.service.test.ts`
  - [ ] Report generated with all required fields
  - [ ] Scheduled trigger respects `statusReportFrequencyDays`

### 4c.3 Controllers `[BE]`
- [ ] `src/controllers/construction-servicing.controller.ts`
  - [ ] `GET /api/construction-loans/:id/servicing` — interest reserve + maturity status
  - [ ] `GET /api/construction-loans/:id/reports` — status report history
  - [ ] `POST /api/construction-loans/:id/reports` — on-demand report generation
  - [ ] `GET /api/construction-loans/:id/reports/:reportId` — single report
  - [ ] `GET /api/construction-loans/:id/conversion-readiness` — checklist
  - [ ] `POST /api/construction-portfolio/stress-test` — run scenario

---

## Phase 5 — Frontend UI

### 5.1 Portfolio Dashboard `[UI]`
- [ ] Route: `/construction`
- [ ] `ConstructionPortfolioDashboard` page component
  - [ ] Summary cards: active loans, total exposure, avg % complete, pending draws
  - [ ] `DrawVelocityChart` (monthly draw bar chart vs. expected curve)
  - [ ] `ConstructionPortfolioMap` (geographic heat map, risk-colored)
  - [ ] Active risk flags summary panel
  - [ ] Loans nearing maturity widget
  - [ ] Quick link to pending draw approvals

### 5.2 Loan List `[UI]`
- [ ] Route: `/construction/loans`
- [ ] `ConstructionLoanList` page — filterable by status, type, market
- [ ] `ConstructionLoanCard` component — status badge, % complete, risk flags, draw count
- [ ] "New Loan" button → loan creation wizard

### 5.3 Loan Creation Wizard `[UI]`
- [ ] Route: `/construction/loans/new`
- [ ] Multi-step wizard: Loan Details → Property → Contractor → Budget Entry → Review + Feasibility
- [ ] Budget entry step: add/remove line items by `BudgetCategory`
- [ ] Pre-submission: trigger feasibility analysis, show `FeasibilityReportViewer` inline before save

### 5.4 Loan Detail — Overview Tab `[UI]`
- [ ] Route: `/construction/loans/:id/overview`
- [ ] Summary header with status badge, loan amount, ARV, LTV
- [ ] `ProjectTimelineBar` (Gantt-style milestones)
- [ ] `CompletionForecastCard` (P25/P50/P75 fan chart)
- [ ] `RiskFlagPanel` — active flags with severity + resolve action
- [ ] 🤝 `ConstructionCollaboratorBar` (CollaboratorAvatars + connection status)
- [ ] Notes section using `CollaborativeTextField` (fieldKey: `"overview-notes"`)

### 5.5 Budget Tab `[UI]` 🤝
- [ ] Route: `/construction/loans/:id/budget`
- [ ] Wrap page in `CollaborationProvider` (containerId: `budget-{budgetId}`)
- [ ] `BudgetTable` component
  - [ ] Columns: Category, Description, Original, Change Orders, Revised, Drawn, Remaining, % Disbursed, % Inspected, AI Finding badge
  - [ ] Heat-mapped background: green (on-track), yellow (warning), red (over/under)
  - [ ] Per-line `CollaborativeLineItemNotes` (fieldKey: `"budget-note-{lineItemId}"`)
  - [ ] 🤝 `CollaboratorAvatars` per line showing who is editing that note
- [ ] `BurnRateWidget` — per-category depletion projection
- [ ] Change orders summary + link to change orders tab
- [ ] Budget version history drawer

### 5.6 Draw History + Submit Draw `[UI]` 🤝
- [ ] Route: `/construction/loans/:id/draws`
- [ ] `DrawHistoryList` — all draws, status badges, amounts, disbursement dates
- [ ] Route: `/construction/loans/:id/draws/new`
- [ ] `DrawRequestForm`
  - [ ] Per-line amount input with remaining balance shown
  - [ ] AI pre-check: show `DrawAnomalyAnalysis` warnings before final submission
  - [ ] Attach supporting notes per line

### 5.7 Draw Detail + Approval Workflow `[UI]` 🤝
- [ ] Route: `/construction/loans/:id/draws/:drawId`
- [ ] Wrap in `CollaborationProvider` (containerId: `draw-{drawId}`)
- [ ] Split view: Draw request (left) + Inspection report (right, if available)
- [ ] `DrawApprovalWorkflow`
  - [ ] Per-line: requested amount, inspector % complete, approved amount input
  - [ ] 🤝 `CollaborativeApprovalState` — both reviewers see each other's live approval marks
  - [ ] Retainage calculated and displayed inline
  - [ ] Notes per line: `CollaborativeTextField` (fieldKey: `"draw-line-note-{lineItemId}"`)
- [ ] Dual-auth indicator if tenant config requires two approvers
- [ ] Lien waiver status widget + upload
- [ ] Anomaly alert banner (if AI flagged this draw)
- [ ] Approve / Reduce / Reject / Hold action buttons

### 5.8 Inspection Queue + Inspection Detail `[UI]` 🤝
- [ ] Route: `/construction/inspections`
- [ ] `DrawInspectionQueue` — all inspections, ordered by due date
- [ ] Route: `/construction/inspections/:id`
- [ ] Wrap in `CollaborationProvider` (containerId: `inspection-{inspectionId}`)
- [ ] Tabbed: Overview | Line-Item Findings | Photo Gallery | AI Analysis | Concerns
- [ ] 🤝 `CollaboratorAvatars` + `CollaborativeTextField` on reviewer comment fields
- [ ] AI photo authenticity overlay on photo gallery
- [ ] Accept / Dispute action buttons

### 5.9 Change Orders `[UI]` 🤝
- [ ] Route: `/construction/loans/:id/change-orders`
- [ ] `ChangeOrderList` — history with status badges
- [ ] `ChangeOrderDiff` — before/after budget comparison (red/green delta highlighting)
- [ ] New change order form with justification required per line
- [ ] Wrap detail view in `CollaborationProvider` (containerId: `changeorder-{coId}`)
- [ ] 🤝 `CollaborativeTextField` on review notes (fieldKey: `"co-review-notes"`)

### 5.10 Feasibility Report `[UI]` 🤝
- [ ] Route: `/construction/loans/:id/feasibility`
- [ ] Wrap in `CollaborationProvider` (containerId: `feasibility-{loanId}`)
- [ ] `FeasibilityReportViewer`
  - [ ] Overall score ring (0–100) with PASS/WARN/FAIL verdict badge
  - [ ] Per-line finding rows: benchmark range, submitted amount, finding badge
  - [ ] Custom rule results table
  - [ ] ARV coverage section
  - [ ] Timeline realism section
  - [ ] Contractor feasibility result
- [ ] Override form: verdict + notes (requires authorized role)
- [ ] 🤝 `CollaborativeFeasibilityOverride` — team discussion notes
- [ ] Re-run feasibility button

### 5.11 Feasibility Rule Editor (Lender Admin) `[UI]`
- [ ] Route: `/construction/feasibility` (admin only)
- [ ] `FeasibilityRuleEditor` — add/edit/delete `FeasibilityRule` per tenant
- [ ] Rule preview: show which active loans would be affected by a new rule

### 5.12 Contractors `[UI]`
- [ ] Route: `/construction/contractors`
- [ ] `ContractorList` — filterable by risk tier, state, specialty
- [ ] Route: `/construction/contractors/:id`
- [ ] `ContractorCard` full view:
  - [ ] License status: manual upload status + API verification status (both shown)
  - [ ] Bond / insurance expiry with warning colors
  - [ ] Risk tier badge with history
  - [ ] Active projects list (capacity view)
  - [ ] Project performance history (completed, stalled, defaulted counts)
- [ ] License upload component (drag-and-drop → Blob)

### 5.13 Servicing Dashboard `[UI]`
- [ ] Route: `/construction/servicing`
- [ ] Servicing overview: interest reserves depleting, maturities approaching
- [ ] `InterestReserveWidget` — balance, burn rate, projected depletion date (color-coded)
- [ ] `MaturityCountdown` — days to maturity, completion P75 vs. maturity warning bar
- [ ] Per-loan: `/construction/loans/:id/servicing`
  - [ ] Interest reserve detail
  - [ ] Maturity risk assessment
  - [ ] `ConversionReadinessChecklist` (GROUND_UP only)

### 5.14 Status Reports `[UI]`
- [ ] Route: `/construction/loans/:id/reports`
- [ ] `StatusReportList` — history of AI-generated reports
- [ ] `StatusReportViewer`
  - [ ] AI narrative paragraph
  - [ ] Budget snapshot table
  - [ ] Active risk flag summary
  - [ ] Recommended actions list
  - [ ] Download as PDF
- [ ] "Generate Report Now" button

### 5.15 Portfolio Reports & Stress Test `[UI]`
- [ ] Route: `/construction/reports`
- [ ] Budget variance report (sortable by % over/under)
- [ ] Draw disbursement log (exportable)
- [ ] Lien waiver status report (outstanding by loan)
- [ ] `StressTestRunner` component
  - [ ] Scenario selector (schedule slip, cost increase, CPP rate)
  - [ ] Parameter inputs
  - [ ] Results table: impacted loans, financial exposure

### 5.16 CPP Workflow Panel `[UI]` 🤝
- [ ] Add to loan overview when `CPP_TRIGGER` flag active
- [ ] Wrap in `CollaborationProvider` (containerId: `cpp-{loanId}`)
- [ ] `CPPWorkflowPanel`
  - [ ] CPP trigger summary (flags that fired)
  - [ ] AI workout plan draft (editable narrative sections)
  - [ ] 🤝 `CollaborativeTextField` on each narrative section
  - [ ] 🤝 `CollaboratorAvatars` showing all team members present
  - [ ] Escalation controls: assign to senior review, notify borrower, freeze draws

### 5.17 Navigation & Routing `[UI]`
- [ ] Add "Construction" top-level nav item (sidebar + mobile)
- [ ] Role-based access: hide admin routes from non-admin roles
- [ ] Breadcrumb support for all nested routes

---

## Phase 6 — Collaboration Components `[UI]`

> The existing `CollaborationProvider`, `CollaborativeTextField`, `CollaboratorAvatars`, and `useSharedField` are production-ready. Only construction-specific additions are listed here.

- [ ] `CollaborativeLineItemNotes` — `CollaborativeTextField` scoped to a budget/draw line item key with row-level presence indicator
- [ ] `CollaborativeApprovalState` — SharedMap-backed approval button showing all participants' live approval marks (prevents double-action)
- [ ] `CollaborativeFeasibilityOverride` — override verdict field with co-reviewer visibility and presence
- [ ] `ConstructionCollaboratorBar` — `CollaboratorAvatars` + Fluid connection status badge + dirty/saved indicator; used as standard header bar on all collaborative construction surfaces
- [ ] Unit tests: `CollaborativeApprovalState.test.tsx`, `ConstructionCollaboratorBar.test.tsx`

---

## Infrastructure & Config `[INFRA]`

- [x] Verify `construction-loans` Cosmos container provisioned (via Bicep, not code) — ✅ 2026-03-06
- [x] Verify `draws` Cosmos container provisioned — ✅ 2026-03-06
- [x] Verify `contractors` Cosmos container provisioned — ✅ 2026-03-06
- [ ] Fluid Relay container IDs documented in `fluid.client.ts` comment header (extend existing convention)
- [ ] Add construction finance routes to APIM policy (if applicable)
- [ ] Confirm `DRAW_INSPECTOR` vendor type tag added to vendor onboarding docs/seed data
- [ ] Add construction module env vars to deployment docs

---

## Documentation Updates

- [ ] Update `API_CONTRACT.md` with all new construction finance endpoints
- [ ] Update `README.md` with construction finance module overview
- [ ] Update `ROADMAP.md` — add Construction Finance as Item 8+

---

## Progress Summary

| Phase | Total Items | Completed | % Done |
|---|---|---|---|
| Phase 1 — Foundation | ~40 | ~38 | ~95% |
| Phase 2 — Draw + Inspections | ~55 | ~48 | ~87% |
| Phase 3 — Portfolio Monitor | ~20 | 0 | 0% |
| Phase 4a — AI Feasibility | ~18 | 0 | 0% |
| Phase 4b — AI Monitor | ~22 | 0 | 0% |
| Phase 4c — AI Servicing | ~16 | 0 | 0% |

### Phase 2 remaining open items:
- `contractor.service.ts`: `verifyLicenseManual`, `verifyLicenseApi`, `getContractorProjects`, `addContractorToLoan`, `DRAW_INSPECTOR` vendor tag
- Phase 1.6 seed data (TenantConstructionConfig, sample loans, budgets)
- `getChangeOrderImpact` on change-order service (deferred to Phase 3)

**Last tests:** 89/89 passing (7 construction-finance suites), TypeScript clean (`tsc --noEmit` → exit 0)
| Phase 5 — Frontend UI | ~95 | 0 | 0% |
| Phase 6 — Collaboration | ~8 | 0 | 0% |
| Infrastructure | ~8 | 0 | 0% |
| Docs | ~3 | 0 | 0% |
| **Total** | **~285** | **0** | **0%** |
