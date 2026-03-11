# Vision VMC × L1 — Master Implementation Roadmap

**Created:** 2026-03-11
**Source:** [MASTER_REVIEW_PROCESS.md](./MASTER_REVIEW_PROCESS.md)
**Overall Platform Coverage at Start:** ~38%

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
- [ ] Wire UAD cost/income types into canonical mapper
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

- [ ] Replace `executeAutomatedCheck() → passed: true` with real rule evaluation
- [ ] Wire `DynamicCodeExecutionService` sandbox for configurable USPAP rule execution
- [ ] Implement checkpoint evaluators for each USPAP category (Ethics, Competency, Scope, Development, Reporting, Record Keeping, Jurisdictional)
- [ ] Add tests with pass/fail scenarios

### 0.5 De-stub Portfolio Analytics (BE, M)
_Blocks: Tape analytics, heatmaps, servicer features_

- [ ] Replace all hardcoded mock returns in `portfolio-analytics.service.ts` with real Cosmos queries
- [ ] Wire `RiskMetrics`, `GeographicMetrics`, `TrendAnalysis` to actual order/review data
- [ ] Add scenario analysis with real property data

### 0.6 De-stub Comprehensive Vendor Management (BE, S)
_Blocks: Vendor matching accuracy_

- [ ] Replace `findAvailableVendors()` hardcoded mock vendors with Cosmos query
- [ ] Consolidate overlapping vendor management services (3 services → unified interface)

### 0.7 De-stub Wildfire/Climate Risk (BE, M)
_Blocks: §4 Market/hazard, disaster triggers_

- [ ] Replace `'unknown'` returns in `noaa-environmental.service.ts` with real data
- [ ] Integrate NIFC wildfire history API or USGS wildfire perimeters
- [ ] Wire hurricane/tornado risk from NOAA Storm Events Database
- [ ] Add wildfire defensible-space scoring

### 0.8 De-stub ROV Research Comparables (BE, M)
_Blocks: ROV workflow completeness_

- [ ] Replace `searchComparables()` TODO stub with Bridge Interactive MLS query
- [ ] Wire `analyzeMarketTrends()` to Census + Bridge data
- [ ] Generate actual `MarketAnalysisReport` from real data

---

## PHASE 1 — Core AMC Operations Gaps (Day-to-Day Platform)

> **Goal:** Complete the operational pipeline so the platform can run a real AMC from
> intake to delivery without manual workarounds.

### 1.1 Engagement Letter Generation Service (BE, L)
_Compliance requirement for every assignment_

- [ ] Create `engagement-letter.service.ts` with template-based generation
- [ ] Include: scope of work, AIR independence statement, due date/timezone, required exhibits, change-order policy, communication protocol, PII/security, deliverables
- [ ] Support all product types (1004, 1025, 1073, 1004D, Desktop, Hybrid, BPO, DVR)
- [ ] Integrate with `TemplateService` for customizable templates per client
- [ ] Add engagement letter PDF generation
- [ ] Add engagement letter e-signature flow (leverage existing `esignature.service.ts` lifecycle)
- [ ] Wire to vendor assignment flow (auto-generate on assignment)

### 1.2 Engagement Letter UI (FE, M)
- [ ] Add engagement letter preview/editor on engagement detail page
- [ ] Add template selector per client/product
- [ ] Add e-signature status tracking
- [ ] Add engagement letter viewer in vendor/appraiser portal

### 1.3 Client Configuration Depth (BOTH, L)
_Completes client onboarding per master process_

- [ ] **BE:** Add client configuration service with: SLA terms, fee schedules (per product), delivery format preferences, ROV policy & template, AIR/independence rules, approved product menu, credit-box rules, invoice model (borrower-pay/client-bill/split)
- [ ] **BE:** Add client matching criteria (blocked appraisers, geographic restrictions, required certifications)
- [ ] **FE:** Expand `/clients/[clientId]` with tabbed configuration: General, SLAs, Fee Schedule, Products, Compliance, Delivery, ROV Policy
- [ ] **FE:** Add fee-schedule editor with product×complexity matrix

### 1.4 Inbound MISMO XML Validation (BE, M)
_Required for vendor submission technical intake_

- [ ] Create `mismo-xml-validator.service.ts` for inbound XML validation
- [ ] Validate against MISMO 3.4 XSD schema on vendor submission
- [ ] Parse and extract structured data from valid XML
- [ ] Auto-populate canonical schema fields from valid XML
- [ ] Return structured validation errors to vendor for resubmission

### 1.5 UCDP/EAD Submission Service (BE, L)
_Required for GSE delivery_

- [ ] Create `ucdp-submission.service.ts` for Fannie Mae UCDP portal submission
- [ ] Create `ead-submission.service.ts` for FHA EAD portal submission
- [ ] Handle SSR (Submission Summary Report) feedback parsing
- [ ] Track submission status (pending, accepted, accepted-with-warnings, rejected)
- [ ] Store SSR findings in order record
- [ ] Auto-retry on transient failures

### 1.6 UCDP/EAD UI (FE, M)
- [ ] Add UCDP/EAD submission panel on delivery workflow
- [ ] Show SSR findings with severity levels
- [ ] Track submission history per order

### 1.7 Inspection Scheduling Module (BOTH, M)
_Fills scheduling gap in vendor workflow_

- [ ] **BE:** Add `inspection-scheduling.service.ts` with borrower-contact-attempt tracking (3 attempts in 48-72 hrs per master process)
- [ ] **BE:** Add access constraint fields: gated, tenants, lockbox code, pets, HOA/parking, elevator, special instructions
- [ ] **BE:** Add SLA enforcement: first contact within 24 hours of assignment
- [ ] **BE:** Support PDC/inspector dispatch for hybrid/desktop with photo and geotag requirements
- [ ] **FE:** Add inspection scheduling panel on order detail with attempt log, constraint fields, scheduling calendar integration

### 1.8 Billing & Invoicing Workflow (BOTH, L)
_Completes financial operations_

- [ ] **BE:** Add invoice generation service (not just CRUD): auto-generate from completed orders, itemized line items (base fee, rush, complexity, add-ons), tax calculation
- [ ] **BE:** Add batch/monthly invoicing for client-bill accounts
- [ ] **BE:** Add aging report generation (30/60/90 day buckets)
- [ ] **BE:** Add refund orchestration (Stripe refund + status tracking)
- [ ] **BE:** Add 1099 data aggregation for year-end vendor reporting
- [ ] **FE:** Rebuild `/billing` as an active invoicing workflow (not read-only)
- [ ] **FE:** Add invoice generation button, send invoice, track payment
- [ ] **FE:** Add aging dashboard with overdue alerts

### 1.9 WIP Status Board (FE, M)
_Consolidated at-a-glance order pipeline view_

- [ ] Create Kanban/swim-lane status board: New → Assigned → Accepted → Scheduled → Inspected → Drafting → Submitted → QC → Delivered
- [ ] Drag-and-drop status advancement (with confirmation)
- [ ] Color-coded SLA indicators (green/yellow/red)
- [ ] Filter by client, vendor, product, rush, overdue
- [ ] Auto-refresh with WebPubSub real-time updates

### 1.10 Post-Delivery Task Management (BOTH, M)

- [ ] **BE:** Create `post-delivery.service.ts` for 1004D completion tracking (trigger → vendor request → receive update → validate → deliver)
- [ ] **BE:** Add field/desk review trigger rules (variance thresholds, CU/SSR scores, investor overlays)
- [ ] **BE:** Add archiving/retention service: enforce retention policies (5-7 years per master process), archive completed orders, purge expired records
- [ ] **FE:** Add 1004D tracking panel on order detail (auto-remind near project completion)
- [ ] **FE:** Add field/desk review trigger UI
- [ ] **FE:** Add archiving/retention page with policy management

### 1.11 Vendor Performance Enhancements (BE, M)

- [ ] Add CU/SSR risk score to performance calculator
- [ ] Replace placeholder communication/accuracy scores with real data
- [ ] Add auto-suspension trigger when vendor drops to PROBATION tier
- [ ] Add coaching workflow: generate defect-pattern report, deliver quarterly scorecard via email
- [ ] Add geo/product expansion suggestion for high performers (PLATINUM tier)
- [ ] Track AIR independence compliance (anti-reuse-of-same-appraiser per property)

### 1.12 Duplicate Order Detection (BE, S)

- [ ] Add duplicate-order check in order intake: match by borrower + property address + date range
- [ ] Return warning (not hard block) with link to existing order
- [ ] Add to enhanced order controller

### 1.13 PIW/ACE/Waiver Screening (BE, S)

- [ ] Add waiver eligibility check in order intake (configurable per client)
- [ ] Store screening result on order record
- [ ] Surface in intake wizard (FE) as advisory

---

## PHASE 2 — Substantive Review Content (Filling the QC Container)

> **Goal:** Implement the actual review substance — the 11 sections of the master review
> flow — so the QC engine checks real things, not just empty checklists.

### 2.1 §1 Intake & Scope Lock-In Enhancements (BOTH, M)

- [ ] **FE:** Add to intake wizard: purpose, intended use/users, use case (origination/secondary/portfolio/workout), report type selection, effective date(s), subject interest (fee simple/leased fee), extraordinary/limiting conditions
- [ ] **FE:** Add data expectations capture: expected comp count, distance/time brackets, bracketing requirements, rental comps toggle, income evidence toggle
- [ ] **FE:** Add "truth set" document collection checklist: deed chain, prior MLS, public record, plat, zoning, FEMA, HOA, permits, photos, AVM/iAVM, market stats, rent surveys, cost references, client overlays
- [ ] **BE:** Add scope-lock validation: reject scope changes after lock-in without client approval and fee/time reset

### 2.2 §2 ECOA/Fair Lending & Bias Screening (BE, L)
_Critical compliance gap_

- [ ] Create `bias-screening.service.ts` for appraisal report text analysis
- [ ] NLP scan for prohibited factors (race, religion, national origin, familial status, etc.) in neighborhood/condition commentary
- [ ] Flag inadvertent bias in language (e.g., "declining neighborhood" without data support)
- [ ] Add engagement-vs-report alignment validation: compare client, intended use, value type, effective date(s) between engagement and delivered report
- [ ] Add bias screening results to QC checklist

### 2.3 §3 Purchase Contract Review (BOTH, L)
_Entire section currently missing_

- [ ] **BE:** Create `contract-review.service.ts`
- [ ] **BE:** Model purchase contract data: fully-executed status, all addenda, concessions (dollar + type), personal property, financing terms, arm's-length indicators
- [ ] **BE:** Implement arm's-length test: related-party check, ownership overlap, employer/family relationships, unusual concessions
- [ ] **BE:** Implement price reasonableness analysis: does indicated value credibly explain contract price (not the other way around)
- [ ] **BE:** Implement concessions comparison: verify comps adjusted similarly or bracketed for concessions
- [ ] **FE:** Add "Contract Review" tab on order detail for purchase orders
- [ ] **FE:** Display arm's-length indicators with pass/fail, concession analysis, price-vs-value reconciliation

### 2.4 §4 Market Analytics Enhancement (BOTH, L)

- [ ] **BE:** Add market regime calculation service: MOI (months of inventory), absorption rate, list-to-sale ratio, price-cut rate, DOM aggregation, contract ratio
- [ ] **BE:** Add micro-location scoring: school tiers (GreatSchools API or similar), adjacency influences (arterials, rail, commercial via Google Places), view/noise, flood/wildfire
- [ ] **BE:** Add submarket boundary crossing detector: flag when comps cross meaningful boundaries and verify consistent adjustments
- [ ] **FE:** Add market analytics panel on QC review detail: charts for supply/demand, DOM, price trajectory, concessions trend
- [ ] **FE:** Add "Market Narrative vs. Evidence" comparison view: appraiser's narrative alongside computed market data

### 2.5 §5 Zoning & Site Analysis Service (BE, L)
_Entire section currently missing_

- [ ] Create `zoning-analysis.service.ts`
- [ ] Model site specifics: size, shape, topography, access, utilities, easements/encroachments, environmental
- [ ] Integrate zoning lookup (municipal data or third-party API) for conforming/legal-nonconforming/illegal status
- [ ] ADU rules lookup by jurisdiction
- [ ] STR ordinance checking by jurisdiction
- [ ] Density/FAR cap verification
- [ ] Connect H&BU 4-test evaluation (from Phase 0.3) to zoning data and indicated value scenario

### 2.6 §5 Zoning & Site Analysis UI (FE, M)

- [ ] Add "Site & Zoning" tab/section on QC review detail
- [ ] Display zoning compliance status with color indicators
- [ ] Show H&BU 4-test results (as-vacant and as-improved)
- [ ] Display site specifics with map overlay (easements, encroachments, flood zone)

### 2.7 §6 Improvements & Condition Review (BOTH, M)

- [ ] **BE:** Add photo-vs-rating cross-validation: AI analysis of photos against reported condition (C1-C6) and quality (Q1-Q6) ratings
- [ ] **BE:** Add health & safety / deferred maintenance tracker: life-safety items, code violations, repair conditions with cost estimates
- [ ] **BE:** Add renovation verification: cross-reference claimed renovations against permit records, invoice data, and photo evidence
- [ ] **BE:** Add GLA/room count consistency check: sketch vs. public record vs. MLS
- [ ] **FE:** Add "Condition Review" panel in QC with photo carousel + rating comparison + health-safety issue list

### 2.8 §7 Cost Approach Review (BOTH, M)
_Depends on Phase 0.1 canonical schema_

- [ ] **BE:** Create `cost-approach-review.service.ts`
- [ ] **BE:** Validate: replacement cost source, soft costs, entrepreneurial profit, site/indirect costs, externalities
- [ ] **BE:** Validate depreciation: age-life vs. market extraction, effective-age consistency with narrative
- [ ] **BE:** Validate land value: sales, allocation, abstraction — coherence with market
- [ ] **BE:** Check cost factor source documentation
- [ ] **FE:** Add "Cost Approach" tab in QC review: line-item cost breakdown, depreciation table, land value evidence

### 2.9 §7 Income Approach Review (BOTH, M)
_Depends on Phase 0.1 canonical schema_

- [ ] **BE:** Create `income-approach-review.service.ts`
- [ ] **BE:** Validate market rent derivation (1007 or survey) vs. subject utility, condition, micro-location
- [ ] **BE:** Flag if appraiser used STR data instead of long-term leases
- [ ] **BE:** Validate vacancy/credit loss, expenses, reserves against market norms
- [ ] **BE:** Validate cap rate/GRM with comparable income property evidence
- [ ] **BE:** Reconcile overall rate to market/interest rate context
- [ ] **FE:** Add "Income Approach" tab in QC review: rent comp grid, expense analysis, cap rate evidence table

### 2.10 §8 Reconciliation & Reasonableness Tools (BOTH, M)
_Depends on Phases 0.1, 2.8, 2.9_

- [ ] **BE:** Add cross-approach triangulation: compare cost, income, and sales comparison indications
- [ ] **BE:** Add sensitivity analysis: ±key adjustments → value stability check
- [ ] **BE:** Add time-adjustment validation: sale dates normalized to effective date with market-supported rates
- [ ] **FE:** Add reconciliation dashboard: 3-approach comparison chart, sensitivity spider/tornado diagram, final value narrative workspace

### 2.11 §9 Photo/Map/Math Integrity (BOTH, M)

- [ ] **BE:** Add photo-truth-test: automated check that photos match reported ratings, adjustments, views, and adverse factors
- [ ] **BE:** Add sketch-vs-public-record GLA comparison (pull public record GLA, compare to sketch-reported GLA, flag ≥ threshold variance)
- [ ] **BE:** Add arithmetic grid validator: verify adjustment math, $/sf consistency, net/gross totals, rounding
- [ ] **FE:** Add "Math & Integrity" panel in QC: grid math verification results, GLA discrepancy flag, photo match scores

### 2.12 §10 Enhanced Fraud Detection (BE, L)

- [ ] Add serial flip detection from deed chain analysis (rapid resales with large price jumps lacking renovation proof)
- [ ] Add photo reuse/AI-alteration detection: perceptual hashing (pHash/dHash) for cross-order duplicate detection
- [ ] Add "perfect match" comp detector: flag distant comps that perfectly match when closer comps were available
- [ ] Add comp clustering detection: same seller/builder/intermediary across comp set
- [ ] Add MLS mismatch detection: compare report claims to MLS listing data
- [ ] Add permit-claim-without-records detection: cross-reference permit claims with permit data
- [ ] Add AVM/iAVM dispersion check: flag when appraised value exceeds AVM + tolerance band

### 2.13 §11 Report Compliance Enhancements (BOTH, M)

- [ ] **BE:** Add extraordinary assumption validator: check that each EA is clearly labeled, appropriate for the assignment, and consistent with the value scenario
- [ ] **BE:** Add required addenda tracker: verify presence of 1004D, 1007/216, rent rolls, cost backup per product type
- [ ] **BE:** Add supervisory role documentation checker: proper co-signatures, trainee/supervisor roles, disclosure statements
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

| Phase | Description | Items | Done | % |
|---|---|---|---|---|
| 0 | De-stub & Data Model Fixes | 8 groups | 0 | 0% |
| 1 | Core AMC Operations Gaps | 13 groups | 0 | 0% |
| 2 | Substantive Review Content | 13 groups | 0 | 0% |
| 3 | Scenario Branches | 5 groups | 0 | 0% |
| 4 | Product Waterfall & Intelligence | 9 groups | 0 | 0% |
| 5 | Data Connectors & Integrations | 11 groups | 0 | 0% |
| 6 | Servicer Module | 9 groups | 0 | 0% |
| 7 | Statistical ML Models | 4 groups | 0 | 0% |
| 8 | Borrower-Facing [DEFERRED] | 2 groups | 0 | 0% |
| **TOTAL** | | **74 groups** | **0** | **0%** |

### Estimated Timeline (Aggressive)

| Phase | Duration | Cumulative | Platform Coverage |
|---|---|---|---|
| 0 — Foundation | 2-3 weeks | Week 3 | ~45% |
| 1 — Core Operations | 4-6 weeks | Week 9 | ~58% |
| 2 — Review Content | 4-6 weeks | Week 15 | ~70% |
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

## Notes

- **No new dependencies** will be added without explicit justification and approval
- **DefaultAzureCredential** for all Azure SDK clients — no keys unless absolutely necessary
- **No infrastructure creation in code** — all Cosmos containers, service bus topics, etc. provisioned via Bicep
- **No silent defaults or fallbacks** — missing config throws with clear error message
- **TDD approach** — tests written before or alongside implementation for every phase item
- **Each phase item should compile and pass all existing tests** before merging
