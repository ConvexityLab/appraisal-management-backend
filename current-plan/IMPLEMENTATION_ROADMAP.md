# Vision VMC × L1 — Master Implementation Roadmap

**Created:** 2026-03-11  
**Last Reviewed:** 2026-03-12  
**Source:** [MASTER_REVIEW_PROCESS.md](./MASTER_REVIEW_PROCESS.md)  
**Overall Platform Coverage at Start:** ~38%  
**Current Estimated Coverage:** ~55% (Phases 0–1 complete + Phase 1.5 automation backbone built + Phase 2 all BE services done)

> **Active convergence plan (2026-04-30):** [UNIFIED_DATA_GATHERING_ENRICHMENT_CRITERIA_IMPLEMENTATION_PLAN_2026-04-30.md](./UNIFIED_DATA_GATHERING_ENRICHMENT_CRITERIA_IMPLEMENTATION_PLAN_2026-04-30.md)
>
> **Phase 1 execution checklist:** [UNIFIED_CONVERGENCE_PHASE1_CHECKLIST_2026-04-30.md](./UNIFIED_CONVERGENCE_PHASE1_CHECKLIST_2026-04-30.md)

> **Ordering rationale:** Foundation fixes that unblock multiple features come first. Each phase
> delivers working, testable value. Borrower-facing features are deferred (marked `[DEFERRED]`).
> Items within each phase are sequenced so earlier items unblock later ones.

---

## Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[S]` — Stubbed/mock (needs real implementation)
- `[D]` — Deferred (borrower-facing or far-future)
- **BE** = Backend · **FE** = Frontend · **BOTH** = Both repos
- Effort: **S** = Small (< 1 day) · **M** = Medium (1–3 days) · **L** = Large (3–7 days) · **XL** = Extra-large (1–2 weeks)

---

## PHASE 0 — De-stub & Data Model Fixes (Foundation)

> **Goal:** Fix the most dangerous illusions — services that look done but aren't — and
> close the data model gaps that block everything downstream.

### 0.1 Canonical Schema: Add Cost & Income Approach (BOTH, M)
_Blocks: §7 Cost/Income UI, §8 Reconciliation, 3-approach triangulation_

- [x] Add `CostApproach` section to `CanonicalReportDocument` (replacement cost, depreciation breakdown [physical/functional/external], land value, entrepreneurial profit, soft costs, externalities, source notes) — ✅ 2026-03-11 16:00
- [x] Add `IncomeApproach` section to `CanonicalReportDocument` (market rent, vacancy/credit loss, operating expenses, reserves, NOI, GRM, cap rate, DCF support, rent comps) — ✅ 2026-03-11 16:00
- [x] Add `Reconciliation` section with per-approach values, weights, and confidence — ✅ 2026-03-11 16:00
- [x] Wire UAD cost/income types into canonical mapper — ✅ 2026-03-12 (`mapBatchDataReport()` in `batch-data.mapper.ts`; `mapCostApproach`, `mapIncomeApproach`, `mapReconciliation` helper functions added; all 3 optional fields wired into return object)
- [x] Mirror types to frontend `canonical-schema.ts` — ✅ 2026-03-11 16:20
- [x] Write unit tests (28 pass, Vitest) — ✅ 2026-03-11 16:31

### 0.2 Add `ValueType` to Data Model (BOTH, S)
_Blocks: §1 Intake scope, all scenario branches_

- [x] Add `ValueType` enum: `AS_IS`, `PROSPECTIVE_AS_REPAIRED`, `PROSPECTIVE_AS_COMPLETED`, `PROSPECTIVE_MARKET_RENT`, `RETROSPECTIVE` — ✅ 2026-03-11 16:00
- [x] Add `valueTypes: ValueType[]` to order schema and canonical valuation — ✅ 2026-03-11 16:00
- [x] Add `effectiveDates` map (per value type → date) to support multi-date scenarios — ✅ 2026-03-11 16:00
- [ ] Update intake wizard to capture value type(s)
- [ ] Update engagement creation to include value type(s)

### 0.3 Expand H&BU from Binary to 4-Test Framework (BOTH, M)
_Blocks: §5 Zoning/H&BU review_

- [x] Replace `highestAndBestUse: 'Present' | 'Other'` with structured `HighestAndBestUse` type (deprecated old field, added `highestAndBestUseAnalysis`) — ✅ 2026-03-11 16:00
- [x] Model 4 tests: `legallyPermissible`, `physicallyPossible`, `financiallyFeasible`, `maximallyProductive` — ✅ 2026-03-11 16:00
- [x] Separate `asVacant` and `asImproved` analyses — ✅ 2026-03-11 16:00
- [x] Add `hbuConclusion`, `hbuNarrative`, `zoningConsistency` fields — ✅ 2026-03-11 16:00
- [x] Update canonical schema in both repos — ✅ 2026-03-11 16:20

### 0.4 De-stub USPAP Compliance Engine (BE, M)
_Blocks: §2 Compliance review_

- [x] Replace `executeAutomatedCheck() → passed: true` with real rule evaluation — ✅ 2026-03-11 16:46
- [x] Implement checkpoint evaluators for each USPAP category (Ethics, Competency, Scope, Development, Reporting, Record Keeping) — ✅ 2026-03-11 16:46
- [x] Add `automationScript` to 5 checkpoints that were silently skipped (COMP-2, SR1-1-2, SR2-1-2, SR2-3-2, SR2-3-3) — ✅ 2026-03-11 16:46
- [x] Export `CHECKPOINT_EVALUATORS` registry (11 evaluators) + `REQUIRED_CERTIFICATION_ELEMENTS` (23 elements) — ✅ 2026-03-11 16:46
- [x] Add tests with pass/fail scenarios (59 tests passing) — ✅ 2026-03-11 16:46
- [ ] Wire `DynamicCodeExecutionService` sandbox for configurable USPAP rule execution _(deferred: direct evaluators sufficient for known rules; DynamicCodeExecution reserved for tenant-custom rules)_

### 0.5 De-stub Portfolio Analytics (BE, M) — ✅ COMPLETE 2026-03-12
_Blocks: Tape analytics, heatmaps, servicer features_

- [x] Replace all hardcoded mock returns in `portfolio-analytics.service.ts` with real Cosmos queries — ✅ Rewrote entire 958-line stub service; all ~15 private methods now query Cosmos `orders` container
- [x] Wire `RiskMetrics`, `GeographicMetrics`, `TrendAnalysis` to actual order/review data — ✅ Real Cosmos GROUP BY / aggregation queries
- [x] `CosmosDbService.runOrdersQuery(SqlQuerySpec)` added as thin analytics pass-through — ✅
- [x] Constructor now requires `CosmosDbService` (no silent fallback); lazy `ensureInitialized()` guard added — ✅
- [x] `AIMLController` updated to inject `portfolioDbService` instance — ✅
- [x] Uncommented export in `services/index.ts` — ✅
- [ ] Add scenario analysis with real property data _(deferred to Phase 2: requires historical baseline data)_

### 0.6 De-stub Comprehensive Vendor Management (BE, S) — ✅ ALREADY WIRED
_Blocks: Vendor matching accuracy_

- [x] `vendor-management.service.ts` is fully wired to Cosmos (12+ methods) — confirmed 2026-03-11 17:00
- [ ] Consolidate overlapping vendor management services (3 services → unified interface) _(deferred: consolidation is refactoring, not de-stubbing)_

### 0.7 ~~De-stub Wildfire/Climate Risk (BE, M)~~ — DEFERRED (greenfield, not a de-stub)
_Blocks: §4 Market/hazard, disaster triggers_
_Deferred 2026-03-11: `noaa-environmental.service.ts` `getClimateRisk()` is stubbed but the broader wildfire/hurricane/tornado integration requires new external API work (NIFC, USGS, NOAA Storm Events). This is greenfield feature work, not a de-stub. Moved to Phase 4+ backlog._

### 0.8 De-stub ROV Research Comparables (BE, M) — ✅ COMPLETE (prior session)
_Blocks: ROV workflow completeness_

- [x] `searchComparables()` wired to `MlsDataProvider` interface (default: `SeededMlsDataProvider`, swap to Bridge/CoreLogic via constructor injection) — ✅ 2026-03-12
- [x] `analyzeMarketTrends()` computes real statistics from MLS sold data (median, average, trend direction, month-by-month, sample size) — ✅
- [x] `generateMarketAnalysisReport()` generates formatted text report from live data — ✅
- [x] `mapMlsListingToROVComparable()` exported for testability — ✅
- [x] Haversine distance calculation added — ✅

---

## PHASE 1 — Core AMC Operations Gaps (Day-to-Day Platform)

> **Goal:** Complete the operational pipeline so the platform can run a real AMC from
> intake to delivery without manual workarounds.

### 1.1 Engagement Letter Generation Service (BE, L) ✅
_Compliance requirement for every assignment_

- [x] Create `engagement-letter.service.ts` with template-based generation
- [x] Include: scope of work, AIR independence statement, due date/timezone, required exhibits, change-order policy, communication protocol, PII/security, deliverables
- [x] Support all product types (1004, 1025, 1073, 1004D, Desktop, Hybrid, BPO, DVR)
- [x] Integrate with template selection (client-specific per product type, with built-in defaults)
- [ ] Add engagement letter PDF generation (Phase 5.9 — DocuSign/Adobe Sign provider)
- [x] Add engagement letter e-signature flow (signing-request lifecycle wired; provider TBD)
- [x] Wire to vendor assignment flow (auto-generate on assignment via `phase1.controller.ts`)

### 1.2 Engagement Letter UI (FE, M)
- [x] Add `EngagementLetterPanel` on order detail tab 15 — letter generation, inline content preview, e-sign progress stepper, signatory tracking
- [ ] Add template selector per client/product
- [x] Add e-signature status tracking (Draft→Sent→Viewed→Signed stepper with signatory-level status)
- [ ] Add engagement letter viewer in vendor/appraiser portal

### 1.3 Client Configuration Depth (BOTH, L)
_Completes client onboarding per master process_

- [x] **BE:** `client-configuration.service.ts` — SLA terms, fee schedules (per product), delivery format preferences, ROV policy, waiver config, custom fields, invoice model
- [ ] **BE:** Add client matching criteria (blocked appraisers, geographic restrictions, required certifications)
- [x] **FE:** Client configuration page at `/clients/:clientId/configuration` — 6 tabs: Fee Schedule, SLA Terms, Delivery, ROV Policy, Waivers, History
- [ ] **FE:** Add fee-schedule editor with product×complexity matrix

### 1.4 Inbound MISMO XML Validation (BE, M) ✅
_Required for vendor submission technical intake_

- [x] `mismo-xml-validator.service.ts` — inbound XML validation, MISMO version detection
- [x] Validate structure and required fields on vendor submission
- [x] Parse and extract structured data from valid XML (address, borrower, property, result, comparables)
- [x] Auto-populate canonical schema fields from valid XML
- [x] Return structured validation errors to vendor for resubmission

### 1.5 UCDP/EAD Submission Service (BE, L) ✅
_Required for GSE delivery_

- [x] Create unified `ucdp-ead-submission.service.ts` with pluggable `SubmissionProvider` interface (UCDP + EAD)
- [x] Handle SSR (Submission Summary Report) feedback parsing
- [x] Track submission status (pending, accepted, accepted-with-warnings, rejected)
- [x] Store SSR findings in order record
- [x] Auto-retry on transient failures (MAX_RETRIES=3)

### 1.6 UCDP/EAD UI (FE, M)
- [x] Add RTK Query hooks for GSE submission endpoints (submit, get, list per order)
- [x] Add `GSESubmissionPanel` on order detail tab 17 — UCDP/EAD portal summary cards, submit dialog with portal selector
- [x] Show SSR findings with severity levels (HARD_STOP/WARNING/INFO icons + detail dialog)
- [x] Track submission history per order (table with status chips, timestamp, findings count)

### 1.7 Inspection Scheduling Module (BOTH, M)
_Fills scheduling gap in vendor workflow_

- [x] **BE:** `inspection-enhancement.service.ts` — borrower-contact-attempt tracking, 3-attempt SLA enforcement
- [x] **BE:** SLA enforcement: first-contact deadline (4h), scheduling deadline (24h), min-attempt count
- [x] **BE:** `getViolations()` — query all non-compliant assigned orders for a tenant
- [ ] **BE:** Access constraint fields: gated, lockbox, pets, HOA, elevator, special instructions (schema ready)
- [x] **FE:** `InspectionTrackingPanel` on order detail tab 5 — SLA compliance card (ok/warning/critical/breach), borrower contact attempt log, record-attempt dialog
- [ ] **FE:** Constraint fields + scheduling calendar (inspector availability)

### 1.8 Billing & Invoicing Workflow (BOTH, L)
_Completes financial operations_

- [x] **BE:** `billing-enhancement.service.ts` — `batchCreateInvoices()` auto-generates from completed orders, itemized line items, payment terms
- [x] **BE:** Batch/monthly invoicing for client-bill accounts via `BatchInvoiceRequest`
- [x] **BE:** Aging report generation (`generateAgingReport()`) — 0-30 / 31-60 / 61-90 / 91-120 / 120+ day buckets with top-delinquent list
- [x] **BE:** Refund orchestration — `requestRefund()`, `processRefund()` (approve/deny + status tracking)
- [x] **BE:** 1099 data aggregation — `generate1099Report()` by tax year per vendor, IRS $600 threshold
- [x] **FE:** Billing Enhancement page at `/billing/enhancement` — 4 tabs: AR Aging dashboard, Batch Invoice, 1099 Report with year selector, Refund approval workflow
- [ ] **FE:** Rebuild core `/billing` as an active invoicing workflow (not read-only)
- [ ] **FE:** Add invoice generation button, send invoice, track payment

### 1.9 WIP Status Board (FE, M)
_Consolidated at-a-glance order pipeline view_

- [x] Create Kanban/swim-lane WIP Board page wired at `/orders/wip` with BE `wip-board.service.ts` providing status-grouped columns
- [ ] Drag-and-drop status advancement (with confirmation)
- [ ] Color-coded SLA indicators (green/yellow/red)
- [ ] Filter by client, vendor, product, rush, overdue
- [ ] Auto-refresh with WebPubSub real-time updates

### 1.10 Post-Delivery Task Management (BOTH, M)

- [x] **BE:** `post-delivery.service.ts` — 1004D completion tracking (create/complete/escalate task lifecycle)
- [x] **BE:** `field-review-trigger.service.ts` — field/desk review trigger rules (variance thresholds, CU/SSR scores, investor overlays) — ✅ 2026-03-12
- [x] **BE:** `archiving-retention.service.ts` — retention policies (5-7 years), archive completed orders, purge expired records — ✅ 2026-03-12
- [x] **FE:** `PostDeliveryPanel` on order detail tab 16 — task list with status icons, 1004D recertification countdown card, summary bar (completed/overdue)
- [ ] **FE:** Add field/desk review trigger UI
- [ ] **FE:** Add archiving/retention page with policy management

### 1.11 Vendor Performance Enhancements (BE, M)

- [ ] Add CU/SSR risk score to performance calculator
- [x] Replace placeholder communication/accuracy scores with real data (implemented in vendor-performance-calculator.service.ts)
- [x] Add auto-suspension trigger when vendor drops to PROBATION tier
- [x] Add coaching workflow: generate defect-pattern report, deliver quarterly scorecard
- [ ] Add geo/product expansion suggestion for high performers (PLATINUM tier)
- [ ] Track AIR independence compliance (anti-reuse-of-same-appraiser per property)

### 1.12 Duplicate Order Detection (BE+FE, S) ✅

- [x] `duplicate-order-detection.service.ts` — checks by borrower + property address + date range (90-day window)
- [x] Address normalization (`normalizeAddress()`) — abbreviation expansion, punctuation strip, whitespace collapse
- [x] Returns advisory warning (not hard block) with match type (ADDRESS vs ADDRESS_AND_BORROWER) and match score
- [x] Wired into `order.controller.ts` intake flow
- [x] **FE:** RTK Query hook `useCheckForDuplicatesMutation` + IntakeScreeningPanel in Order Intake Wizard Review step

### 1.13 PIW/ACE/Waiver Screening (BE+FE, S) ✅

- [x] `waiver-screening.service.ts` — screens PIW, ACE, VALUE_ACCEPTANCE, DESKTOP_ELIGIBLE, HYBRID_ELIGIBLE
- [x] Client-configurable: LTV limits, loan amount caps, property/loan/occupancy type allow-lists, excluded states
- [x] Returns advisory result with recommended action and estimated savings
- [x] Wired into `order.controller.ts` intake flow
- [x] **FE:** RTK Query hook `useScreenForWaiversMutation` + IntakeScreeningPanel in Order Intake Wizard Review step

---

## PHASE 1.5 — Automation Backbone & Event-Driven Workflows

> **Goal:** Make the platform self-operating — intelligent auto-assignment, event-driven state
> machines, robust messaging, and supervisory governance. This is the bridge between a
> manually-operated AMC tool and a truly autonomous platform.

> **Status (code review 2026-03-12):** The core state machine and messaging infrastructure
> is **substantially complete.** Remaining gaps: staff typed model, supervisory layer,
> dead-letter monitoring, and tenant-level automation config.

### 1.5.1 Azure Service Bus Messaging Infrastructure (BE, M) ✅ COMPLETE

- [x] `ServiceBusEventPublisher` — `DefaultAzureCredential`, topic `appraisal-events`, console-mock fallback when no namespace — ✅ 2026-03-12
- [x] `ServiceBusEventSubscriber` — `MessagingEntityNotFoundError` graceful close, `Promise.allSettled` handler dispatch — ✅ 2026-03-12
- [x] `events.ts` — 20 typed events in `AppEvent` union (ORDER, QC, VENDOR, ASSIGNMENT, SYSTEM categories) — ✅ 2026-03-12
- [x] Dedicated subscription per service: `notification-service` and `auto-assignment-service` — no cross-service competition — ✅ 2026-03-12

### 1.5.2 Auto-Assignment Orchestrator — Vendor & Reviewer FSMs (BOTH, XL) ✅ COMPLETE

- [x] **BE:** `auto-assignment-orchestrator.service.ts` — full vendor bid FSM + reviewer assignment FSM, idempotent, state persisted on order document — ✅ 2026-03-12
- [x] **BE:** Vendor bid loop: `engagement.order.created` → rank vendors → bid to vendor[0] → publish `vendor.bid.sent` — ✅
- [x] **BE:** `vendor.bid.timeout` / `vendor.bid.declined` → try vendor[n+1]; if exhausted → publish `vendor.assignment.exhausted` (human escalation) — ✅
- [x] **BE:** Review assignment loop: `order.status.changed{SUBMITTED}` → QC queue → rank reviewers by workload → assign reviewer[0] — ✅
- [x] **BE:** `review.assignment.timeout` → try reviewer[n+1]; if exhausted → publish `review.assignment.exhausted` (human escalation) — ✅
- [x] **BE:** `triggerVendorAssignment()` public method for direct invocation from order controller — ✅
- [x] **BE:** `auto-assignment.controller.ts` (796 lines) — suggest, trigger, status, bid-accept, bid-decline REST endpoints — ✅
- [x] **BE:** `acceptVendorBid` / `declineVendorBid` wired in `order.controller.ts` — publishes `vendor.bid.accepted` event — ✅
- [x] **FE:** `autoAssignmentApi.ts` — RTK Query hooks: suggest, trigger, status, acceptBid, declineBid — ✅ 2026-03-12
- [x] **FE:** `AutoAssignmentStatusPanel.tsx` (544 lines) — FSM state visualizer, ranked vendor list, bid countdown, accept/decline controls, reviewer panel — ✅ 2026-03-12
- [x] Tests: `auto-assignment-orchestrator.test.ts` — vendor FSM, reviewer FSM, timeout, decline, escalation, idempotency all passing — ✅ 2026-03-12

### 1.5.3 Bid & Review Timeout Jobs (BE, M) ✅ COMPLETE

- [x] `vendor-timeout-checker.job.ts` — polls Cosmos every 5 min, fires `vendor.bid.timeout` for expired bid invitations — ✅ 2026-03-12
- [x] `review-assignment-timeout.job.ts` — fires `review.assignment.timeout` for expired reviewer assignments — ✅ 2026-03-12
- [x] Firewall-block protection: stops polling when Cosmos unreachable to avoid log storm — ✅ 2026-03-12
- [x] Both jobs start in `server.ts` at process startup — ✅ 2026-03-12

### 1.5.4 Configurable Notification Rules (BOTH, M) ✅ COMPLETE

- [x] **BE:** `notification-rules.service.ts` — DB-backed rules CRUD in `notification-rules` Cosmos container, `throttleMs` dedup field — ✅ 2026-03-12
- [x] **BE:** `notification-rules.controller.ts` — REST CRUD for tenant-scoped notification rules — ✅ 2026-03-12
- [x] **BE:** `core-notification.service.ts` — orchestrates subscriber + email + SMS + inApp + WebPubSub channel services — ✅ 2026-03-12
- [x] **FE:** `notificationRulesApi.ts` — RTK Query CRUD hooks — ✅ 2026-03-12
- [x] **FE:** `NotificationRulesPage` (615 lines) — full admin CRUD UI: event type, channels, templates, throttle ms, enable/disable toggle — ✅ 2026-03-12

### 1.5.5 Staff as Typed Vendors — Internal Assignment Path (BOTH, M) ✅ 2026-05

- [x] **BE:** Add `StaffType`, `StaffRole`, `InternalStaffCapacity` types to `vendor-marketplace.types.ts` — ✅ 2026-05
- [x] **BE:** `staffType: 'internal' | 'external'` + `staffRole` discriminator on vendor/staff model — ✅ 2026-05
- [x] **BE:** Internal staff bypass the bid broadcast loop → `assignStaffDirectly()` in `AutoAssignmentOrchestratorService` — ✅ 2026-05
- [x] **BE:** Staff roles: `appraiser_internal`, `inspector_internal`, `reviewer`, `supervisor` as first-class role values — ✅ 2026-05
- [x] **BE:** Staff capacity model: `activeOrderCount` + `maxConcurrentOrders`; `activeOrderCount` incremented immediately at direct assignment — ✅ 2026-05
- [x] **BE:** `vendor-matching-engine.service.ts`: synthesize availability from vendor doc fields for internal staff (bypasses `vendor-availability` container miss) — ✅ 2026-05
- [x] **BE:** Seed data: `buildInternalStaff()` (3 records: appraiser, reviewer, supervisor) + `INTERNAL_STAFF_IDS` in `seed-ids.ts` — ✅ 2026-05
- [x] **FE:** Staff management page (`/staff`): list/add/edit internal staff, capacity settings, live workload bar — ✅ 2026-05
- [x] **FE:** `AutoAssignmentStatusPanel`: visually distinguish internal (direct) vs external (bid loop) — "Direct Assignment" info badge, no bid countdown/accept-decline for internal — ✅ 2026-05

### 1.5.6 Supervisory Layer (BOTH, M) ✅ 2026-05

- [x] **BE:** Add `requiresSupervisoryReview: boolean` + `supervisorId: string | null` to order model
- [x] **BE:** Auto-flag rules: trainee appraiser assignment, high-value property (> configurable threshold), QC risk score above threshold — integrated into `auto-assignment-orchestrator.service.ts`
- [x] **BE:** Add `SupervisionAssignedEvent` to `events.ts`; handle in orchestrator post vendor assignment
- [x] **BE:** Supervisor co-sign endpoint: `GET/POST /api/supervisory-review/:orderId` + `POST /:orderId/cosign` + `GET /pending`
- [x] **FE:** `SupervisoryReviewPanel.tsx` — status badge, Request Supervision dialog, Co-Sign dialog; wired as Tab 22 in order detail
- [x] **FE:** Order detail Supervision tab (tab 22) shows pending/cosigned status badge and action buttons

### 1.5.7 Tenant-Level Automation Config (BOTH, M) ✅ 2026-05

- [x] **BE:** `tenant-automation-config.service.ts` — `getConfig()`, `updateConfig()`, `isFeatureEnabled()` against `tenant-automation-configs` Cosmos container
- [x] **BE:** Config fields: `autoAssignmentEnabled`, `bidTimeoutHours`, `maxVendorAttempts`, `requireHumanApprovalBeforeAssignment`, `autoReviewAssignmentEnabled`, `preferredVendorIds`, escalation/supervisory policy flags
- [x] **BE:** `AutoAssignmentOrchestratorService` reads tenant config before every bid dispatch; respects `autoAssignmentEnabled`, `maxVendorAttempts`, `preferredVendorIds`
- [x] **BE:** `GET /api/tenant-automation-config/schema` — returns field metadata for UI rendering
- [x] **FE:** Admin page at `admin/tenant-automation` — full settings form with switches, number inputs, tag-list inputs; auto-routed via `TenantAutomationRoute.tsx`
- [ ] **FE:** WIP board header shows live automation config summary (e.g., "Auto-assign ON · 4hr timeout · 5 max attempts") — deferred

### 1.5.8 Dead Letter Queue Monitor (BE+FE, M) ✅ 2026-05

- [x] **BE:** `dead-letter-queue-monitor.service.ts` — `getDeadLetterStats()` (runtime properties), `getDeadLetterMessages()` (peek without consuming), `reprocessMessage()` (forward + complete), `discardMessage()` (complete only)
- [x] **BE:** Monitors `notification-service` + `auto-assignment-service` subscriptions on `appraisal-events` topic; Managed Identity auth
- [x] **BE:** Routes: `GET /api/dlq-monitor/stats`, `GET /api/dlq-monitor/messages`, `POST /api/dlq-monitor/messages/:id/reprocess`, `DELETE /api/dlq-monitor/messages/:id`
- [x] **FE:** Admin page at `admin/dlq-monitor` — stats cards per subscription + total, message table with reprocess/discard; 30s auto-refresh; auto-routed via `DLQMonitorRoute.tsx`

---

## PHASE 2 — Substantive Review Content (Filling the QC Container)

> **Goal:** Implement the actual review substance — the 11 sections of the master review
> flow — so the QC engine checks real things, not just empty checklists.

> **Status (2026-05):** All 13 backend review services **implemented** and wired through
> `SubstantiveReviewEngine` → `substantive-review.controller.ts`. RTK Query hooks + mirrored
> types exist in the frontend. `SubstantiveReviewTab.tsx` (12-card overview grid, Run All +
> individual Run buttons, overall score bar) **implemented** and wired as Tab 21 in the order
> detail page. Individual per-section deep-dive panels still pending. Overall ~75%.

### 2.1 §1 Intake & Scope Lock-In Enhancements (BOTH, M)

- [ ] **FE:** Add to intake wizard: purpose, intended use/users, use case (origination/secondary/portfolio/workout), report type selection, effective date(s), subject interest (fee simple/leased fee), extraordinary/limiting conditions
- [ ] **FE:** Add data expectations capture: expected comp count, distance/time brackets, bracketing requirements, rental comps toggle, income evidence toggle
- [ ] **FE:** Add "truth set" document collection checklist: deed chain, prior MLS, public record, plat, zoning, FEMA, HOA, permits, photos, AVM/iAVM, market stats, rent surveys, cost references, client overlays
- [x] **BE:** `scope-lock-validation.service.ts` — scope-lock validation, reject post-lock-in changes without client approval and fee/time reset — ✅ 2026-03-12

### 2.2 §2 ECOA/Fair Lending & Bias Screening (BOTH, L)
_Critical compliance gap_

- [x] **BE:** `bias-screening.service.ts` (601 lines) — appraisal report text analysis — ✅ 2026-03-12
- [x] **BE:** NLP scan for prohibited factors in neighborhood/condition commentary — ✅
- [x] **BE:** Flag inadvertent bias in language (e.g., "declining neighborhood" without data support) — ✅
- [x] **BE:** Engagement-vs-report alignment validation: client, intended use, value type, effective date(s) — ✅
- [x] **BE:** Bias screening results wired into `SubstantiveReviewEngine` — ✅
- [ ] **FE:** Add "Bias Screening" panel in QC: flagged phrases, engagement alignment status, pass/fail indicator

### 2.3 §3 Purchase Contract Review (BOTH, L)

- [x] **BE:** `contract-review.service.ts` (444 lines) — full purchase contract review — ✅ 2026-03-12
- [x] **BE:** Purchase contract data model: fully-executed status, addenda, concessions, personal property, financing terms, arm's-length indicators — ✅
- [x] **BE:** Arm's-length test: related-party check, ownership overlap, employer/family relationships, unusual concessions — ✅
- [x] **BE:** Price reasonableness analysis: does indicated value credibly explain contract price — ✅
- [x] **BE:** Concessions comparison: verify comps adjusted similarly or bracketed — ✅
- [ ] **FE:** Add "Contract Review" tab on order detail for purchase orders: arm's-length indicators, concession analysis, price-vs-value reconciliation

### 2.4 §4 Market Analytics Enhancement (BOTH, L)

- [x] **BE:** `market-analytics.service.ts` (386 lines) — MOI, absorption rate, DOM aggregation, concessions trend, submarket crossing detector — ✅ 2026-03-12
- [ ] **BE:** Micro-location scoring: school tiers (GreatSchools API), adjacency influences (Google Places), view/noise, flood/wildfire _(requires Phase 5 data feeds)_
- [ ] **FE:** Add market analytics panel on QC review detail: charts for supply/demand, DOM, price trajectory, concessions trend
- [ ] **FE:** Add "Market Narrative vs. Evidence" comparison view: appraiser's narrative alongside computed market data

### 2.5 §5 Zoning & Site Analysis Service (BE, L) ✅ BE DONE

- [x] **BE:** `zoning-site-review.service.ts` (308 lines) — site specifics, zoning compliance, H&BU 4-test connections — ✅ 2026-03-12
- [x] **BE:** Site specifics: size, shape, topography, access, utilities, easements/encroachments, environmental — ✅
- [x] **BE:** Zoning compliance status: conforming/legal-nonconforming/illegal; ADU rules, STR ordinance, density/FAR — ✅
- [x] **BE:** Connected to H&BU 4-test evaluation (Phase 0.3) — ✅

### 2.6 §5 Zoning & Site Analysis UI (FE, M)

- [ ] Add "Site & Zoning" tab/section on QC review detail
- [ ] Display zoning compliance status with color indicators
- [ ] Show H&BU 4-test results (as-vacant and as-improved)
- [ ] Display site specifics with map overlay (easements, encroachments, flood zone)

### 2.7 §6 Improvements & Condition Review (BOTH, M)

- [x] **BE:** `improvements-review.service.ts` (314 lines) — photo-vs-rating cross-validation, health & safety tracker, renovation verification, GLA consistency — ✅ 2026-03-12
- [x] **BE:** Photo-vs-rating cross-validation: condition (C1-C6) and quality (Q1-Q6) ratings — ✅
- [x] **BE:** Health & safety / deferred maintenance tracker: life-safety items, code violations, repair conditions — ✅
- [x] **BE:** Renovation claims cross-reference: permit records, invoice data, photo evidence — ✅
- [x] **BE:** GLA/room count consistency check: sketch vs. public record vs. MLS — ✅
- [ ] **FE:** Add "Condition Review" panel in QC with photo carousel + rating comparison + health-safety issue list

### 2.8 §7 Cost Approach Review (BOTH, M)
_Depends on Phase 0.1 canonical schema_

- [x] **BE:** `cost-approach-review.service.ts` (285 lines) — cost approach review — ✅ 2026-03-12
- [x] **BE:** Validate: replacement cost source, soft costs, entrepreneurial profit, site/indirect costs, externalities — ✅
- [x] **BE:** Validate depreciation: age-life vs. market extraction, effective-age consistency with narrative — ✅
- [x] **BE:** Validate land value: sales, allocation, abstraction — coherence with market — ✅
- [x] **BE:** Cost factor source documentation check — ✅
- [ ] **FE:** Add "Cost Approach" tab in QC review: line-item cost breakdown, depreciation table, land value evidence

### 2.9 §7 Income Approach Review (BOTH, M)
_Depends on Phase 0.1 canonical schema_

- [x] **BE:** `income-approach-review.service.ts` (253 lines) — income approach review — ✅ 2026-03-12
- [x] **BE:** Validate market rent derivation (1007 or survey) vs. subject utility, condition, micro-location — ✅
- [x] **BE:** Flag if appraiser used STR data instead of long-term leases — ✅
- [x] **BE:** Validate vacancy/credit loss, expenses, reserves against market norms — ✅
- [x] **BE:** Validate cap rate/GRM with comparable income property evidence — ✅
- [x] **BE:** Reconcile overall rate to market/interest rate context — ✅
- [ ] **FE:** Add "Income Approach" tab in QC review: rent comp grid, expense analysis, cap rate evidence table

### 2.10 §8 Reconciliation & Reasonableness Tools (BOTH, M)
_Depends on Phases 0.1, 2.8, 2.9_

- [x] **BE:** `reconciliation-review.service.ts` (200 lines) — cross-approach triangulation, sensitivity analysis, time-adjustment validation — ✅ 2026-03-12
- [x] **BE:** Cross-approach triangulation: compare cost, income, and sales comparison indications — ✅
- [x] **BE:** Sensitivity analysis: ±key adjustments → value stability check — ✅
- [x] **BE:** Time-adjustment validation: sale dates normalized to effective date with market-supported rates — ✅
- [ ] **FE:** Add reconciliation dashboard: 3-approach comparison chart, sensitivity spider/tornado diagram, final value narrative workspace

### 2.11 §9 Photo/Map/Math Integrity (BOTH, M)

- [x] **BE:** `math-integrity.service.ts` (521 lines) — photo truth-test, sketch-vs-public-record GLA comparison, arithmetic grid validator — ✅ 2026-03-12
- [x] **BE:** Photo-truth-test: automated check photos match reported ratings/adjustments/views/adverse factors — ✅
- [x] **BE:** Sketch-vs-public-record GLA comparison (flag ≥ threshold variance) — ✅
- [x] **BE:** Arithmetic grid validator: adjustment math, $/sf consistency, net/gross totals, rounding — ✅
- [ ] **FE:** Add "Math & Integrity" panel in QC: grid math verification results, GLA discrepancy flag, photo match scores

### 2.12 §10 Enhanced Fraud Detection (BE, L)

- [x] **BE:** `enhanced-fraud-detection.service.ts` (286 lines) — full fraud detection engine — ✅ 2026-03-12
- [x] **BE:** Serial flip detector: deed chain analysis, rapid resales with large price jumps — ✅
- [x] **BE:** Photo reuse / AI-alteration detection: perceptual hashing (pHash/dHash) — ✅
- [x] **BE:** "Perfect match" comp detector: distant comps flagged when local comps available — ✅
- [x] **BE:** Comp clustering detection: same seller/builder/intermediary across comp set — ✅
- [x] **BE:** MLS mismatch detection: report claims vs. MLS listing data — ✅
- [x] **BE:** Permit-claim-without-records detection — ✅
- [x] **BE:** AVM/iAVM dispersion check: appraised value vs. AVM + tolerance band — ✅
- [ ] **FE:** Add "Fraud Risk" panel in QC: fraud signal list with severity, serial flip timeline, comp clustering indicator

### 2.13 §11 Report Compliance Enhancements (BOTH, M)

- [x] **BE:** `report-compliance.service.ts` (320 lines) — extraordinary assumption validator, addenda tracker, supervisory docs checker — ✅ 2026-03-12
- [x] **BE:** EA validator: each EA clearly labeled, appropriate for assignment, consistent with value scenario — ✅
- [x] **BE:** Required addenda tracker: 1004D, 1007/216, rent rolls, cost backup per product type — ✅
- [x] **BE:** Supervisory role documentation checker: co-signatures, trainee/supervisor roles, disclosure statements — ✅
- [ ] **FE:** Add "Compliance Checklist" panel in QC: addenda status, EA review, certification review, supervisory docs

---

## PHASE 3 — Scenario Branches (Property Type Coverage)

> **Goal:** Support the full range of property types and scenarios the client reviews.

### 3.1 Scenario A: Complete ARV/Fix-and-Flip (BOTH, M)
_ARV engine exists; adding review-specific validations_

- [ ] **BE:** Add scope validation depth: line-item bid detail, materials/finishes tier, contractor credential cross-reference, permit verification
- [ ] **BE:** Add cost-service benchmarking: reconcile bids to MVS/RSMeans ± contingency (10-20%)
- [ ] **BE:** Add feasibility & market fit validation: post-repair product vs. bracketed ARV comps (quality/amenities/features match)
- [ ] **BE:** Add time & carrying risk model: prospective effective date, market trend during construction window, absorption risk
- [ ] **FE:** Enhance ARV page with: bid-level detail entry, cost benchmark comparison table, feasibility scoring, carrying cost calculator

### 3.2 Scenario B: Ground-Up Construction Valuation (BOTH, L)
_Construction finance module exists; adding valuation-review layer_

- [ ] **BE:** Create `construction-valuation-review.service.ts`
- [ ] **BE:** Add plans/specs matching to GLA, bed/bath, garage, porch — verify valuation model items match drawings
- [ ] **BE:** Add entitlement validation: zoning compliance, variances, subdivision map status, permits pulled, impact fees
- [ ] **BE:** Add land value method validation: sales/allocations consistent with submarket; residual sanity check
- [ ] **BE:** Add prospective as-completed comp selection validation: new builds or model-match resales, age/spec delta adjustments
- [ ] **BE:** Add market absorption analysis for multi-unit/phase projects: bulk discounts, sell-out pace, carrying risk
- [ ] **BE:** Add builder incentive detection: adjust comps if upgrades/incentives distort prices
- [ ] **FE:** Add "Construction Valuation Review" section on construction loan detail: plans match, entitlement check, comp validation, absorption analysis

### 3.3 Scenario C: Mixed-Use Component Valuation (BOTH, L)
_Currently not implemented_

- [ ] **BE:** Create `mixed-use-valuation.service.ts`
- [ ] **BE:** Model component valuation: separate residential and commercial income streams
- [ ] **BE:** Add commercial rent support: market leases, TI/LC, vacancy, cap rate evidence
- [ ] **BE:** Add parking ratio, signage, hours, non-conformity checks
- [ ] **BE:** Add reconciliation: prevent double-counting; verify combined value aligns with mixed-use market
- [ ] **FE:** Add "Mixed-Use Analysis" page/panel: component breakdown, commercial rent grid, residential comp grid, combined reconciliation

### 3.4 Scenario D: Mid-Construction / Rehab In-Progress (BOTH, M)
_Percent-complete tracking exists; adding valuation layer_

- [ ] **BE:** Add dual-valuation model: `asIs` and `asCompleted` valuations each with own effective date and assumptions
- [ ] **BE:** Add photo-to-progress verification: compare inspection photos to claimed percent complete
- [ ] **BE:** Add remaining-cost-to-complete validation vs. budget with contingency
- [ ] **BE:** Add scope creep / change order / code issue detection
- [ ] **BE:** Add habitability assessment: if not habitable, reflect in marketability/time-on-market
- [ ] **FE:** Add "Dual Valuation" panel: side-by-side as-is vs. as-completed with effective dates, assumptions, and value reconciliation

### 3.5 Scenario E: Complex Properties (BOTH, L)
_Currently not implemented_

- [ ] **BE:** Create `complex-property-review.service.ts`
- [ ] **BE:** Add data scarcity plan: systematic search widening (time, then distance, then inferior/superior comps) with explicit adjustment support
- [ ] **BE:** Add rights & encumbrances model: riparian/littoral rights, dock permits, view corridors, conservation easements
- [ ] **BE:** Add externalities quantification: shoreline erosion, seawalls, wildfire defensible space, insurance availability/cost shocks
- [ ] **BE:** Add ADU/STR legality & economics: ordinance lookup, permit status, occupancy limits, tax/fee regime, personal property separation
- [ ] **BE:** Add shifted unit-of-comparison support: $/frontage, $/view-tier, $/dock-length (beyond $/sf)
- [ ] **FE:** Add "Complex Property" analysis panel: data scarcity map, rights/encumbrances checklist, externalities scoring, unit-of-comparison selector

---

## PHASE 4 — Product Waterfall & Intelligence Platform (Nick's Vision)

> **Goal:** Build the configurable product routing engine, truth-set backbone, and
> portfolio analytics that transform this from an AMC tool into a risk-first platform.

### 4.1 Confidence-Gated Product Waterfall (BOTH, XL)
_Nick's vision centerpiece_

- [ ] **BE:** Create `product-waterfall.service.ts` with configurable routing rules:
  ```
  if AVM.conf < 65 or AVM.dispersion > T1 → route to iAVM
  if iAVM.conf < 70 or abs(iAVM - prior) > 15% → route to DVR
  if DVR.flags >= 2 or fraud_score > F1 → route to Desktop/Field/Full
  ```
- [ ] **BE:** Make thresholds configurable per client/segment/geography
- [ ] **BE:** Track routing decisions with full audit trail (why each product was selected/escalated)
- [ ] **BE:** Implement one-click escalation: upgrade product with single API call preserving all context
- [ ] **FE:** Add waterfall configuration UI on product-fees page: visual routing diagram with threshold sliders
- [ ] **FE:** Add "Next-Best Action" indicator on order detail: Proceed / Escalate to iAVM / Escalate to DVR / Escalate to Full
- [ ] **FE:** Add one-click escalation button on order detail

### 4.2 Standardized Reason Codes & Deficiency Taxonomy (BOTH, M)

- [ ] **BE:** Implement formal deficiency taxonomy: DATA, COMPS, METHOD, MARKET, FRAUD_RISK, OPERATIONS
- [ ] **BE:** Create standardized reason code catalog (NAL01, CMP05, etc.) per master spec
- [ ] **BE:** Apply reason codes to all QC findings, fraud flags, tape evaluation results
- [ ] **BE:** Every alert carries: reason code, human-readable explanation, recommended action
- [ ] **FE:** Add deficiency code management page
- [ ] **FE:** Display reason codes consistently across QC, fraud, tape, and delivery UIs

### 4.3 Truth-Set & Benchmarking Backbone (BE, XL)
_Foundation for calibration and auto-learning_

- [ ] Create `truth-set.service.ts` with Cosmos schemas:
  - `loan_truth`: loan_id, truth_value, truth_low, truth_high, truth_tier (1-5), method_notes
  - `valuation_product_result`: loan_id, product_type, value, range, confidence, turn_time, cost, reason_codes, model_version
  - `residuals`: loan_id, product_id, abs_err, pct_err, in_range_80, in_range_90
  - `scorecard_product_segment`: product_type, segment_id, MAE, Coverage90, TurnTimeMed, DefectRate, Score, period
  - `deficiency_event`: loan_id, product_id, code, severity, source, remediation_status
- [ ] Build truth-set hierarchy: Tier 1 (same-day sale) → Tier 5 (AVM estimate) with error bars
- [ ] Build backcast engine: time-adjusted benchmark from local pairs/index + subject features
- [ ] Build variance engine: loan-level variance matrix vs truth and vs peers
- [ ] Build calibration metrics: MAE/MAPE/RMSE, Coverage@80/90, confidence-error correlation

### 4.4 Variance & Calibration Analytics Dashboard (FE, L)

- [ ] Loan comparison pane: side-by-side product results per loan
- [ ] Portfolio-level metrics: MAE, MAPE, RMSE with segment cuts (rural, luxury, STR, condo, new build)
- [ ] Performance heatmaps: geographic variance distribution
- [ ] Confidence-error correlation charts
- [ ] Turn-time / revision / defect / ROV metrics per product type

### 4.5 "Best Tool for This Loan?" Product Selector (BOTH, L)

- [ ] **BE:** Predict expected error, coverage, turn-time, cost per product for a given property
- [ ] **BE:** Output Next-Best Action with expected gain vs. current product assignment
- [ ] **FE:** Add selector gain chart: visual comparison of expected outcomes per product

### 4.6 Waterfall Auto-Learning (BE, L)
_Depends on truth-set backbone_

- [ ] Build segment scorecards that update post-truth (when sale closes)
- [ ] Auto-tighten gates for underperforming segments
- [ ] Version-track all routing rule changes with before/after performance metrics
- [ ] Champion/challenger framework for routing rule experiments

### 4.7 Enhanced Outputs & Audit Pack (BOTH, M)

- [ ] Add P10/P50/P90 value distribution to AVM/iAVM outputs
- [ ] Add SHAP-style attribution for key value drivers
- [ ] Generate audit pack per order: data provenance log, transform steps, model version, scoring explanations
- [ ] Make audit pack downloadable from order detail

### 4.8 Entity Resolution & Relationship Graph (BE, XL)
_Fraud detection foundation_

- [ ] Create `entity-resolution.service.ts` with graph-based entity tracking
- [ ] Build owner/LLC graph from deed records and public filings
- [ ] Track relationships: brokers, appraisers, buyers/sellers, AMCs, GC/builders
- [ ] Detect recurring relationship loops (collusion signals)
- [ ] Score network-based fraud risk per transaction
- [ ] Add graph visualization endpoint for frontend consumption

### 4.9 Unified Exception Queue (FE, M)

- [ ] Build combined exception queue sorting by Fraud Risk + Valuation Risk + SLA urgency
- [ ] Pull from: QC findings, fraud alerts, escalations, SLA breaches, valuation variance flags
- [ ] One-click navigation to relevant detail page
- [ ] Explainer card per exception with reason codes and recommended action

---

## PHASE 5 — Data Connectors & External Integrations

> **Goal:** Wire in the data feeds that power the intelligence layers.

### 5.1 Market Data Feeds (BE, L)

- [ ] Integrate FHFA HPI (House Price Index) — quarterly feed for market regime
- [ ] Integrate Case-Shiller or similar macro index
- [ ] Build MOI/absorption/list-to-sale/price-cut-rate calculator from MLS data (Bridge)
- [ ] Add market-decline detector: composite of short/long slope, MOI, price cuts, contract ratio

### 5.2 Parcel & Permit Data (BE, L)

- [ ] Integrate parcel/plat API (county assessor or third-party like ATTOM/Regrid)
- [ ] Implement APN ↔ parcel boundary mapping
- [ ] Integrate permit data API for renovation verification
- [ ] Cross-reference permit claims with permit records automatically

### 5.3 STR Legality & Revenue Data (BE, L)

- [ ] Integrate AirDNA or Mashvisor for STR revenue data (ADR, occupancy, RevPAR)
- [ ] Build STR legality scraper/API: local ordinances, license registries
- [ ] Add TOT (Transient Occupancy Tax) verification
- [ ] Flag illegal nightly rentals that jeopardize income/insurance

### 5.4 Deed & Title Data (BE, L)

- [ ] Integrate deed/title API (county recorder or third-party)
- [ ] Build ownership chain timeline per property
- [ ] Feed into entity resolution graph (Phase 4.8)
- [ ] Enable serial-flip detection from deed chronology

### 5.5 Courts & Liens (BE, M)

- [ ] Integrate court record / lien search API
- [ ] Monitor for mechanics' liens, judgments, silent seconds
- [ ] Feed into risk assessment and fraud detection

### 5.6 HOA Document Intelligence (BE, L)

- [ ] Build HOA document parser (LLM-powered): budget analysis, minutes analysis, litigation mentions
- [ ] Extract deficit trends, special assessments, litigation risk
- [ ] Score building financial health
- [ ] Track recertification milestones (25/30/40-year)

### 5.7 FinCEN/Fraud Index Ingestion (BE, M)

- [ ] Ingest FinCEN GTO coverage CSV (already referenced in master doc)
- [ ] Ingest FinCEN SAR datasets (state/county/MSA)
- [ ] Integrate Cotality/CoreLogic fraud risk indices (if API access obtained)
- [ ] Add geo-overlay: SAR density per ZIP/county as risk factor

### 5.8 Computer Vision Pipeline (BE, L)

- [ ] Implement perceptual hashing (pHash/dHash) for photo dedup across orders
- [ ] Build finish quality detector using Azure Computer Vision or custom model
- [ ] Build view classification model (mountain, water, urban, obstructed, etc.)
- [ ] Add photo manipulation/AI-generation detection
- [ ] Cross-order duplicate photo alerting

### 5.9 Real E-Signature Provider Integration (BE, M)
_E-signature lifecycle exists but no provider_

- [ ] Integrate DocuSign or Adobe Sign API
- [ ] Wire to engagement letter, vendor agreements, and client deliverables
- [ ] Handle webhook callbacks for status updates

### 5.10 Real Geocoding Integration (BE, S)

- [ ] Replace mock geocoding in `comprehensive-vendor-management.service.ts` with Azure Maps or Google Geocoding
- [ ] Replace mock SF coordinates in `vendor-matching-engine.service.ts` with real geocoding

### 5.11 Real Background Check Integration (BE, M)

- [ ] Integrate Checkr or Sterling API for vendor background checks
- [ ] Wire to onboarding workflow step
- [ ] Handle async results via webhook

---

## PHASE 6 — Servicer Module

> **Goal:** Build the post-origination surveillance and servicing intelligence overlay.
> This is the largest greenfield effort.

### 6.1 Servicer Data Foundation (BE, XL)

- [ ] Create Cosmos containers/schemas for servicer loan data: payment history, escrow balances, insurance policies, tax assessments, HOA dues
- [ ] Build data ingestion pipeline for servicing system feeds (payments, NSF, autopay, escrow)
- [ ] Build data ingestion for tax/treasurer rolls
- [ ] Build data ingestion for insurance carrier notifications

### 6.2 EPD Propensity Model (BE, XL)

- [ ] Create `epd-propensity.service.ts`
- [ ] Model payment timing patterns: NSFs, partials, auto-pay drops
- [ ] Model contract-to-value gaps, valuation disagreements, borrower profile signals
- [ ] Score 30/60/90-day default risk per loan
- [ ] Build payment friction signal detector: escrow shortage risk, insurance premium hikes, HOA spikes, utility liens

### 6.3 Collateral Surveillance (BE, L)

- [ ] Build scheduled quarterly aerial/street CV check pipeline
- [ ] Add roof aging, tarp/patches, exterior distress detection
- [ ] Build interior quality drift detector (compare origination photos to new photos)
- [ ] Build automated monthly value refresh using AVM cascade
- [ ] Add P(sell in 90/180 days) liquidity metric

### 6.4 Hazard & Disaster Event Engine (BE, L)

- [ ] Subscribe to FEMA disaster declarations (real-time feed)
- [ ] Subscribe to NIFC wildfire perimeters
- [ ] Subscribe to NWS flood crest alerts
- [ ] Build event-driven auto-ordering: disaster footprint → auto-order inspection/BPO
- [ ] Build insurance cost shock model: predict premium/coverage changes in wildfire/coastal markets
- [ ] Build FIRM/flood zone change monitoring

### 6.5 Escrow, Tax & Insurance Health (BE, L)

- [ ] Build escrow shortage forecaster: month-ahead projection, spread vs. lump-sum simulation
- [ ] Build tax delinquency watch: county roll import, default probability prediction
- [ ] Build hazard policy lapse detector: carrier notification ingestion, real-time lapse alerts

### 6.6 Occupancy & Income Surveillance (BE, L)

- [ ] Build occupancy change risk detector: non-invasive signals (mail changes, rental listings, STR activity, utility shifts)
- [ ] Build DSCR drift monitor: rent AVM + vacancy/expense norms, trending DSCR over time
- [ ] Build STR legality monitor: ongoing scrape of local ordinances and license registries

### 6.7 Title & Lien Surveillance (BE, L)

- [ ] Build title gap / lien surveillance: monitor recordings, releases, assignments
- [ ] Detect silent seconds, mechanics' liens, new judgments
- [ ] Build post-close transfer chain monitoring for equity stripping

### 6.8 Servicer Dashboard & Alerts (FE, XL)

- [ ] Build EPD dashboard: risk-scored loan queue, color-coded watchlists
- [ ] Build collateral surveillance dashboard: condition change alerts, value refresh timeline
- [ ] Build disaster response queue: event-triggered inspection/BPO orders
- [ ] Build escrow health dashboard: shortage forecasts, lapse alerts, tax delinquency
- [ ] Build occupancy/income dashboard: DSCR drift, STR legality, occupancy re-verification
- [ ] Build unified servicer watchlist: high-risk segment blending (disaster + escrow + negative equity + EPD score)
- [ ] Build counterfactual stressing UI: property-level shocks with delinquency lift projections
- [ ] Build REO readiness index viewer

### 6.9 Servicer Governance & Compliance (BE, M)

- [ ] Implement servicer-specific reason codes (ESI_SHORTAGE_RISK, OCCUPANCY_SHIFT, DISASTER_FOOTPRINT, etc.)
- [ ] Bias/fair-use guardrails on collections/outreach decisions
- [ ] Audit pack for servicer actions: time-stamped data lineage, model versions, action logs

---

## PHASE 7 — Statistical ML Models (Advanced)

> **Goal:** Replace rule-based and LLM heuristics with trained statistical models
> for better accuracy and calibration. Likely requires Python/Azure ML.

### 7.1 ML Infrastructure (BE, L)

- [ ] Set up Azure ML workspace with managed endpoints
- [ ] Build feature store pipeline: property features, market regime, ownership chain, loan metrics
- [ ] Implement model serving via Azure ML endpoints (replace mock valuation-engine endpoints)
- [ ] Build champion/challenger framework with drift monitoring

### 7.2 GBM Ensemble Valuation Model (BE, XL)

- [ ] Train stacked GBM + hedonic OLS model on historical sales
- [ ] Implement quantile regression for P10/P50/P90 distributions
- [ ] Build comp-selection ranking model
- [ ] Validate: PSI/KS stability, segment error distribution, out-of-time tests

### 7.3 Anomaly & Fraud ML Models (BE, XL)

- [ ] Train Isolation Forest for value anomaly detection
- [ ] Train LOF (Local Outlier Factor) for neighborhood-level outlier detection
- [ ] Build graph anomaly detection for entity-resolution collusion rings
- [ ] Train document forensics model for photo/signature manipulation detection

### 7.4 Specialized Models (BE, L each)

- [ ] STR Revenue model: seasonality + ADR/Occ features, compliance gate
- [ ] Market-Decline Detector model: composite classifier for regime changes
- [ ] Refi/Prepay vs. Default Classifier (servicer use)

---

## PHASE 8 — Borrower-Facing Features [DEFERRED]

> **Goal:** Build borrower communication, payment, and portal capabilities. Deferred
> per client direction — initial use cases are not borrower-facing.

### 8.1 Borrower Communication Portal [D]

- [ ] Borrower intro email/SMS at order intake
- [ ] Borrower payment link (secure, PCI-compliant)
- [ ] Quote presentation and acceptance flow
- [ ] Borrower portal: order status, document delivery, ROV submission
- [ ] Dodd-Frank 3-day rule tracking and automated borrower copy delivery

### 8.2 Call Center NLP [D]

- [ ] Inbound call transcription and classification
- [ ] Hardship signal detection (job loss, medical, rent issues)
- [ ] Sentiment analysis and urgency triage
- [ ] LLM-powered ROV dispute triage with evidence request generation

---

## Progress Tracking

### Phase Completion Summary

| Phase | Description | Groups | Done | Partial | % |
|---|---|---|---|---|---|
| 0 | De-stub & Data Model Fixes | 8 | 7 (0.1–0.6, 0.8) | 1 (0.2) | ~92% |
| 1 | Core AMC Operations Gaps | 13 | 11 (1.1–1.8, 1.10BE, 1.12, 1.13) | 2 (1.9, 1.10FE, 1.11-partial) | ~87% |
| 1.5 | Automation Backbone & Eventing | 8 | 4 (1.5.1–1.5.4) | 0 | ~50% |
| 2 | Substantive Review Content | 13 | 10 BE done (2.1BE–2.13BE) | 13 FE panels needed | ~65% |
| 3 | Scenario Branches | 5 | 0 | 0 | 0% |
| 4 | Product Waterfall & Intelligence | 9 | 0 | 0 | 0% |
| 5 | Data Connectors & Integrations | 11 | 0 | 0 | 0% |
| 6 | Servicer Module | 9 | 0 | 0 | 0% |
| 7 | Statistical ML Models | 4 | 0 | 0 | 0% |
| 8 | Borrower-Facing [DEFERRED] | 2 | 0 | 0 | 0% |
| **TOTAL** | | **82 groups** | **~32** | **~16** | **~55%** |

### Report Engine Deliverables (completed alongside Phase 0, 2026-03-11)

- [x] `ReportTemplate`, `CanonicalReportDocument` type system + all 6 canonical interfaces — ✅
- [x] `HtmlRenderStrategy` (Playwright + Handlebars) — ✅
- [x] `urar-v1.hbs` 3-page URAR template — ✅
- [x] `urar-v2.hbs` 4-page Vision VMC branded URAR (navy + gold, UAD 3.6) — ✅
- [x] `dvr-v1.hbs` 2-page DVR/BPO template — ✅
- [x] `urar-1004.mapper.ts` with full UAD 3.6 context keys — ✅
- [x] Seed module → all 3 `.hbs` blobs uploaded + Cosmos documents created — ✅
- [x] `smoke-render-urar-v2.ts` E2E smoke test → 117.8 KB PDF in 4.7s — ✅
- [ ] **[BACKLOG]** Add `npx playwright install chromium` to CI/CD pipeline after all deploy steps so flaky browser install never gates a deployment — _swing back when convenient, not blocking_

### Estimated Timeline (Aggressive)

| Phase | Duration | Cumulative | Platform Coverage |
|---|---|---|---|
| 0 — Foundation | ✅ DONE | Week 3 | ~45% |
| 1 — Core Operations | ✅ DONE | Week 9 | ~58% |
| 1.5 — Automation Backbone | ~2 weeks remaining | Week 11 | ~65% |
| 2 — Review Content (FE panels) | 3-4 weeks | Week 15 | ~70% |
| 3 — Scenario Branches | 3-4 weeks | Week 19 | ~77% |
| 4 — Intelligence Platform | 6-8 weeks | Week 27 | ~85% |
| 5 — Data Connectors | 4-6 weeks | Week 33 | ~90% |
| 6 — Servicer Module | 6-8 weeks | Week 41 | ~95% |
| 7 — ML Models | 4-6 weeks | Week 47 | ~98% |
| 8 — Borrower [DEFERRED] | 2-3 weeks | When needed | 100% |

---

## Dependency Graph (Key Chains)

```
Phase 0.1 (Canonical Schema) ──┬── Phase 2.8 (Cost Approach Review)
                                ├── Phase 2.9 (Income Approach Review)
                                └── Phase 2.10 (Reconciliation Tools)

Phase 0.2 (ValueType) ─────────┬── Phase 2.1 (Intake Enhancements)
                                └── Phase 3.4 (Mid-Construction Dual Valuation)

Phase 0.3 (H&BU 4-Test) ───────── Phase 2.5 (Zoning & Site Analysis)

Phase 0.4 (USPAP De-stub) ─────── Phase 2.2 (ECOA/Bias Screening)

Phase 0.5 (Portfolio De-stub) ──── Phase 4.4 (Calibration Dashboard)

Phase 1.5.2 (Orchestrator) ────┬── Phase 1.5.5 (Staff Model)
                                ├── Phase 1.5.6 (Supervisory Layer)
                                └── Phase 1.5.7 (Tenant Automation Config)

Phase 1.5 (Automation Backbone) ─┬── Phase 1.9 (WIP Board real-time)
                                  ├── Phase 2 (QC findings trigger events)
                                  └── Phase 4.9 (Exception Queue)

Phase 4.3 (Truth-Set) ─────────┬── Phase 4.4 (Calibration Dashboard)
                                ├── Phase 4.5 (Product Selector)
                                └── Phase 4.6 (Auto-Learning)

Phase 4.8 (Entity Resolution) ─── Phase 7.3 (Graph Anomaly ML)

Phase 5.4 (Deed Data) ─────────┬── Phase 2.12 (Fraud: Serial Flips)
                                ├── Phase 4.8 (Entity Resolution Graph)
                                └── Phase 6.7 (Title Surveillance)

Phase 6.1 (Servicer Data) ─────┬── Phase 6.2-6.7 (All Servicer Features)
                                └── Phase 6.8 (Servicer Dashboard)
```

---

## Current Priority Queue (as of 2026-03-12)

| Priority | Item | Effort | Why Now |
|---|---|---|---|
| 🔴 | 1.5.5 Staff typed vendor model | M | Unblocks direct assignment; needed before supervisor layer |
| 🔴 | 1.5.6 Supervisory layer | M | Required for trainee appraiser compliance per master process |
| 🔴 | 1.5.7 Tenant automation config | M | No way to turn off auto-assign per tenant without this |
| 🟡 | 2.x FE review panels | L | Phase 2 BE is done — FE panels are the remaining work |
| 🟡 | 1.9 WIP board real-time (WebPubSub) | S | Socket infra ready — just needs auto-refresh wiring |
| 🟡 | 4.9 Exception / human task queue | M | Escalations publish events but no FE queue to act on them |
| 🟠 | 1.5.8 Dead letter queue monitor | M | Observability for event failures |
| 🟠 | 1.8 FE billing rebuild | M | Core billing workflow still read-only |
| 🟠 | 3.x Scenario branches | L | ARV/Construction/Mixed-use review validations |

---

## What's Missing to Make This Really Successful

> These are the gaps beyond the eventing/automation phase that the platform needs to be
> truly production-grade and commercially viable.

### A. Vendor Portal (External-Facing UI) — HIGH PRIORITY

The backend has bid accept/decline endpoints and the coordinator-side `AutoAssignmentStatusPanel`
exists, but **there is no vendor-facing UI**. External appraisers/inspectors/vendors need:
- A dedicated portal (separate app or secure URL) to log in, see pending bid invitations, accept/decline
- Order work queue: assigned orders, submission interface, upload documents, mark milestones
- Engagement letter viewer + e-signature flow
- Payment/invoicing view (their side of the 1099 / remittance)

### B. Real AVM Data Feed — HIGH PRIORITY

`avm-cascade.service.ts` and `valuation-engine.service.ts` exist but use seeded/mock data.
No real AVM provider (Cotality, Clear Capital, HouseCanary, etc.) is wired yet.
Without real AVM data, the product waterfall (Phase 4.1) and fraud dispersion checks are exercising
mock values.

### C. Real MLS / Bridge Interactive Feed — HIGH PRIORITY

`bridge-interactive.service.ts` exists but is likely a placeholder.
`seeded-mls-data-provider.ts` is the current data source for comp search and market analytics.
The entire Phase 2 QC engine is running against seeded MLS data — real Bridge/CoreLogic wire-up
is essential before the review quality means anything in production.

### D. ROV Workflow End-to-End

`rov-management.service.ts` and `rov-research.service.ts` exist. What's missing:
- ROV intake form enforcing evidence standards (per master process)
- Triage for merit → forward to appraiser without value influence
- Track outcome (value changed / unchanged / partial), document rationale
- ROV portal UI for coordinators and the ROV submission form for clients/borrowers

### E. Revision Management End-to-End

`revision-management.service.ts` exists. What's missing:
- Structured defect/clarification request: reference pages/lines, time-boxed turnaround
- Vendor notification + re-submission flow (email with revision request detail)
- Full audit trail of all revisions — what was requested, what was changed
- FE revision tracking panel on order detail

### F. Full Audit Trail & Immutable Log

`audit.service.ts` and `audit-trail.service.ts` exist. Likely partial:
- Every status change, assignment, acceptance, revision, delivery must be time-stamped and immutable
- GLBA/PII audit log: who accessed what data and when
- Audit export endpoint for regulatory/investor review

### G. End-to-End Order Journey (Integration Test Coverage)

Unit tests exist (orchestrator passes). What's missing:
- Integration test: create order → auto-assign → vendor accepts → submit → QC runs → deliver
- E2E test: full journey from Playwright browser test against running backend
- Load test: what happens with 50 concurrent orders going through the bid loop simultaneously

### H. CI/CD Pipeline Completeness

- `npx playwright install chromium` must be added to CI/CD pipeline (backlog item)
- GitHub Actions: automated test run on PR, build check, deploy to staging on merge to main
- Environment variable validation at startup (currently some services may fail silently)
- Secrets rotation: all credentials via Key Vault references in Bicep — none in GitHub secrets

### I. Multi-Tenant Production Readiness

- Tenant onboarding wizard: create tenant, configure products, set fees, create first user
- Tenant isolation hardening: all Cosmos queries validate `tenantId` partition key
- Per-tenant feature flags: enable/disable modules (e.g., Servicer Module not needed by pure AMC clients)
- Tenant-scoped rate limiting and quotas

### J. Production Email/SMS Delivery Verification

`email-notification.service.ts`, `sms-notification.service.ts`, and `azure-communication.service.ts`
exist. Need to verify:
- ACS email domain verified and production-ready
- Real email templates are rendering correctly across clients (Outlook, Gmail)
- SMS delivery rates monitored
- Bounce/unsubscribe handling

### K. Exception Queue / Human Task Queue (Phase 4.9)

When auto-assignment is exhausted (`vendor.assignment.exhausted`, `review.assignment.exhausted`),
coordinators need a clear work queue to act on escalations. Currently events fire but there is no FE
queue. This is Phase 4.9 (Unified Exception Queue) and should be pulled forward.

### L. Appraiser Independence (AIR) Enforcement

Per master process, must prevent:
- Same appraiser assignment to same property within a cooling-off period
- Client/broker contact with appraiser post-assignment (no contact log bridging)
- Blocked appraiser lists per client configuration (Phase 1.3 gap)
Currently tracked in Phase 1.11 (AIR compliance item) but not implemented.

---

## Notes

- **No new dependencies** will be added without explicit justification and approval
- **DefaultAzureCredential** for all Azure SDK clients — no keys unless absolutely necessary
- **No infrastructure creation in code** — all Cosmos containers, service bus topics, etc. provisioned via Bicep
- **No silent defaults or fallbacks** — missing config throws with clear error message
- **TDD approach** — tests written before or alongside implementation for every phase item
- **Each phase item should compile and pass all existing tests** before merging
- **Automation config is required** — `AutoAssignmentOrchestratorService` must read tenant config before any bid dispatch; never auto-assign without knowing tenant's intent
- **Staff model before supervisor layer** — 1.5.5 must land before 1.5.6; supervisor assignment depends on staff role type
