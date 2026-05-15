# Bulk Import & Downstream Automation — Production Implementation Plan

**Created:** April 23, 2026  
**Scope:** `appraisal-management-backend` · `l1-valuation-platform-ui` · `axiom`  
**Legend:** ✅ Done · 🔄 In Progress · ⬜ Not Started · 🔴 Blocked

---

## How to Use This Document

- Each task has a unique ID (e.g. `P1-BE-01`).
- Update the status symbol and add a completion date when a task is done.
- Add implementation notes or PR links in the Notes column.
- "Repo" column: **BE** = appraisal-management-backend, **UI** = l1-valuation-platform-ui, **AX** = axiom

---

## Phase 1 — Make What Exists Actually Work

**Goal:** Unblock production. Fix every critical/high gap so existing features work end-to-end.  
**Target completion:** May 7, 2026

### 1.1 — Service Bus Subscriptions Verification (P1-BE-01)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-01 | ✅ | BE | Verify that all 6 `bulk-ingestion-*` Service Bus topic subscriptions exist in the Azure deployment. | **Verified April 23, 2026** — all 6 are fully declared in `infrastructure/modules/service-bus.bicep` with correct settings. G-20 was a false alarm from a deadlocked terminal. |
| P1-BE-02 | ✅ | BE | Verify the 6 bulk-ingestion worker subscriptions are covered by `DeadLetterQueueMonitorService`. Add them if missing. | **Done April 24, 2026** — added `bulk-ingestion-processor-service`, `bulk-ingestion-canonical-worker-service`, `bulk-ingestion-extraction-worker-service`, `bulk-ingestion-order-creation-worker-service`, `bulk-ingestion-criteria-worker-service`, and `bulk-ingestion-finalizer-service` to `MANAGED_SUBSCRIPTIONS` in `src/services/dead-letter-queue-monitor.service.ts`. |

### 1.2 — BulkIngestionItemInput Schema Extension (P1-BE-03 → P1-BE-04)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-03 | ✅ | BE | Extend `BulkIngestionItemInput` with borrower and financial fields: `borrowerName`, `borrowerEmail`, `borrowerPhone`, `loanAmount`, `loanType`, `loanPurpose`, `occupancyType`, `city`, `state`, `zipCode`, `propertyType`. All optional. | File: `src/types/bulk-ingestion.types.ts`. Done April 23, 2026. |
| P1-BE-04 | ✅ | BE | Extend `parseCsvItems()` in `BulkUploadEventListenerJob` to read the new schema fields from CSV columns (with normalised header aliases). | File: `src/jobs/bulk-upload-event-listener.job.ts`. Done April 23, 2026. |

### 1.3 — Address Parsing Hardening (P1-BE-05)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-05 | ✅ | BE | Replace naive comma-split `parseAddress()` in `BulkIngestionOrderCreationWorkerService` with a multi-strategy parser: (1) `{street}, {city}, {state} {zip}` comma-split, (2) trailing 5-digit zip detection, (3) 2-letter state before zip, (4) graceful fallback. No external deps. | File: `src/services/bulk-ingestion-order-creation-worker.service.ts`. Done April 23, 2026. |

### 1.4 — Fix Placeholder Borrower Data (P1-BE-06 → P1-BE-07)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-06 | ✅ | BE | Use `BulkIngestionItemInput` borrower fields (from P1-BE-03) when constructing the `CreateEngagementRequest` in `BulkIngestionOrderCreationWorkerService.onOrderingRequested()`. Fall through to descriptive placeholder `Borrower-{loanNumber}` (not 'Unknown Borrower') when fields are absent. Remove `as any` cast on engagement creation call. | File: `src/services/bulk-ingestion-order-creation-worker.service.ts`. Done April 23, 2026. |
| P1-BE-07 | ✅ | BE | Use `BulkIngestionItemInput` borrower and financial fields when constructing the order record. Remove hardcoded `loanAmount: 0`, `email: ''`, `phone: ''`. Add SLA-based due date calculation reading `BULK_INGESTION_DEFAULT_DUE_DATE_DAYS` env var (default 5, throw if `NaN`). | File: `src/services/bulk-ingestion-order-creation-worker.service.ts`. Done April 23, 2026. |

### 1.5 — Publish Missing order.created Event (P1-BE-08)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-08 | ✅ | BE | After `dbService.createOrder()` succeeds in `BulkIngestionOrderCreationWorkerService`, publish the `order.created` Service Bus event (matching `OrderManagementService` payload shape) so that audit sink, notification service, and other subscribers receive it. | File: `src/services/bulk-ingestion-order-creation-worker.service.ts`. Done April 23, 2026. |

### 1.6 — XLSX Support in Blob-Drop Job (P1-BE-09 → P1-BE-10)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-09 | ✅ | BE | Add `exceljs@^4.4.0` to `appraisal-management-backend/package.json` dependencies. Justification: same version already used in UI; no large transitive dep tree; required to fix complete XLSX blindness in partner blob-drop path. | File: `package.json`. Done April 23, 2026. |
| P1-BE-10 | ✅ | BE | In `BulkUploadEventListenerJob`: (1) detect data file extension; (2) route CSV to existing `parseCsvItems()`; (3) route XLSX to new `parseXlsxItems()` using ExcelJS that reads first sheet, normalises headers identically to the CSV parser, and returns `BulkIngestionItemInput[]`. | File: `src/jobs/bulk-upload-event-listener.job.ts`. Done April 23, 2026. |

### 1.7 — Fix `downloadBlobAsText` private member access (P1-BE-11)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P1-BE-11 | ✅ | BE | Add a `downloadBlob(container, blobName): Promise<Buffer>` public method to `BlobStorageService` and use it in `BulkUploadEventListenerJob` instead of the `as any` private field access. | Files: `src/services/blob-storage.service.ts`, `src/jobs/bulk-upload-event-listener.job.ts`. Done April 23, 2026. |

---

## Phase 2 — Complete the Document-Order Correlation Story

**Goal:** Per-row document attachment in UI; reliable document correlation backend; real Axiom extraction.  
**Target completion:** May 21, 2026

### 2.1 — Axiom Document Extraction (P2-AX-01 → P2-AX-02)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-AX-01 | ✅ | BE/AX | Remove the mock-mode fallback from `ReviewDocumentExtractionService`. Throw explicitly if `AXIOM_API_BASE_URL` is not configured so the problem is visible at startup. | **Done April 24, 2026** — `ReviewDocumentExtractionService` now throws when `AXIOM_API_BASE_URL` is missing, and `BulkPortfolioService` eagerly instantiates the extraction service so the configuration error is surfaced during startup rather than on first use. |
| P2-AX-02 | ✅ | BE | Add `AxiomMissedTriggerJob` retry logic: if document extraction run is stalled >30 min, re-submit via recovery logic. | **Done April 24, 2026** — `AxiomMissedTriggerJob.recoverStalledBulkExtractions()` scans bulk-ingestion items stuck in `AXIOM_PENDING`, regenerates blob SAS URLs, re-submits extraction, and refreshes `axiomSubmittedAt` / `axiomPipelineJobId`. This is implemented directly against the bulk-ingestion extraction path rather than via `AxiomAutoTriggerService`, which only supports order-level auto-trigger flows. |

### 2.2 — Criteria Stage (P2-BE-03 → P2-BE-04)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-BE-03 | ✅ | BE | Design and implement the criteria evaluation logic in `BulkIngestionCriteriaWorkerService` (currently a no-op). Should: (1) load tenant criteria rules, (2) evaluate each canonical record against them, (3) stamp `criteriaStatus: 'PASSED' | 'FAILED' | 'REVIEW'`, (4) emit `criteria.completed`. | **Done April 24, 2026** — worker subscribes to `bulk.ingestion.extraction.completed`, loads tenant/client criteria config, evaluates canonical record fields, stamps per-item `criteriaStatus` and `criteriaDecision`, persists the result to the job, and publishes `bulk.ingestion.criteria.completed`. Processor canonical records were enriched with source loan/property fields so rules evaluate real row data. |
| P2-BE-04 | ✅ | BE | Add `BULK_INGESTION_ENABLE_CRITERIA_STAGE=true` to production env config and document required minimum criteria rule set. | **Done April 24, 2026** — promoted `BULK_INGESTION_ENABLE_CRITERIA_STAGE=true` into deployment config (`infrastructure/modules/app-services.bicep`, `infrastructure/modules/app-service-config.bicep`) and documented the required minimum criteria rule set plus local-only `BULK_INGESTION_SKIP_BLOB_COPY` guidance in `docs/BULK_INGESTION_OPERATIONS_RUNBOOK.md`. |

### 2.3 — Per-row Document Attachment UI (P2-UI-05 → P2-UI-07)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-UI-05 | ✅ | UI | Add a `documentStatus` computed column to the Step 2 review table in the bulk wizard (`bulk-portfolios/page.tsx`): shows `No document / Matched: {filename} / URL: {url} / Manual` per row. | **Done April 24, 2026** — Step 2 now renders a Document column in `src/app/(control-panel)/bulk-portfolios/page.tsx` with `No doc`, `Matched PDF`, `URL`, and `Manual` chip states. |
| P2-UI-06 | ✅ | UI | Add a per-row document attach button (file picker, single PDF) in Step 2. When a file is selected, update the row's `documentFileName` in local state and show `Manual` status chip. | **Done April 24, 2026** — Step 2 now supports per-row PDF attach via file picker and persists the selection in local state as a `Manual` document chip. |
| P2-UI-07 | ✅ | UI | Add a naming-convention guidance card under the PDF drop zone in Step 1 of the bulk wizard explaining the `{loanNumber}.pdf` convention, with example filenames. Include a tooltip or collapsible panel. | **Done April 24, 2026** — the bulk wizard now shows a PDF naming-convention guidance card under the document attach section in `src/app/(control-panel)/bulk-portfolios/page.tsx`. |

### 2.4 — Scenario A URL Validation (P2-BE-08 → P2-UI-09)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-BE-08 | ✅ | BE | Add `POST /api/bulk-ingestion/validate-document-urls` endpoint that accepts `{ urls: string[] }` and returns `{ valid: string[], invalid: Array<{url, reason}> }` via HEAD request pre-flight. | **Done April 24, 2026** — aligned backend route contract in `src/controllers/bulk-ingestion.controller.ts` and updated the UI API typings in `src/store/api/bulkPortfoliosApi.ts` to consume `{ valid, invalid }`. |
| P2-UI-09 | ✅ | UI | Call `validateDocumentUrls` in the bulk wizard when the user advances from Step 1 → Step 2. Show per-row warning chip on rows with invalid `documentUrl` values. | **Done April 24, 2026** — `bulk-portfolios/page.tsx` now validates document URLs before entering the review step for both ORDER_CREATION rows and DOCUMENT_EXTRACTION manifests, stores invalid reasons, shows summary warnings, and renders per-row invalid URL chips/tooltips. |

### 2.5 — Scenario A Per-row Fetch Status (P2-UI-10)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-UI-10 | ✅ | UI | Add `documentFetchStatus` column to the Step 3 ORDER_CREATION results table. Poll from the order's document list and show: `Fetching / Stored / Failed`. | **Done April 24, 2026** — the Step 3 results table now renders from submitted backend job items and polls order document lists to derive `FETCHING / STORED / FAILED` document status per created order. |

### 2.6 — Zip Archive Upload (P2-UI-11)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P2-UI-11 | ✅ | UI | Add optional zip file drop zone to Step 1 of the bulk wizard. On drop: client-side unzip (using JSZip), extract all PDFs, run same stem-matching logic as `matchPdfFilesToLoanNumbers`, show matched results before submission. | **Done April 24, 2026** — zip upload flow is present in `src/app/(control-panel)/bulk-portfolios/page.tsx` and `src/app/(control-panel)/bulk-portfolios/bulk-portfolio-zip.utils.ts`, including extraction, non-PDF skip reporting, and pre-submit PDF matching. |

---

## Phase 3 — Engagement Model for Bulk Import

**Goal:** Proper engagement scoping, grouping strategies, field mapping per adapter.  
**Target completion:** June 4, 2026

### 3.1 — Engagement Granularity Config (P3-BE-01 → P3-BE-03)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P3-BE-01 | ✅ | BE | Add `engagementGranularity: 'PER_BATCH' | 'PER_LOAN'` to `BulkIngestionSubmitRequest` and `BulkIngestionJob`. Default: `PER_BATCH` (current behaviour). | **Done April 24, 2026** — added `engagementGranularity` to the request/job model, persisted `PER_BATCH` as the submit-time default in `src/services/bulk-ingestion.service.ts`, and threaded the field through the submit controller + bulk-ingestion request event payload. |
| P3-BE-02 | ✅ | BE | In `BulkIngestionOrderCreationWorkerService`: when `engagementGranularity === 'PER_LOAN'`, create one engagement per item with a single loan instead of one engagement for all items. | **Done April 24, 2026** — `src/services/bulk-ingestion-order-creation-worker.service.ts` now supports both `PER_BATCH` and `PER_LOAN`, creating per-item engagements only when requested while preserving batch-mode behavior as the default. |
| P3-BE-03 | ✅ | BE | Add per-adapter `engagementFieldMapping` config (Cosmos-persisted, per-tenant per-adapterKey) that maps spreadsheet columns → engagement fields: `borrowerName`, `loanAmount`, `email`, `phone`. | **Done April 24, 2026** — added `src/services/bulk-ingestion-adapter-config.service.ts`, persisted config docs in the existing `bulk-portfolio-jobs` Cosmos container, preserved normalized raw spreadsheet columns during CSV/XLSX parsing, and applied adapter-specific field mapping during bulk order/engagement creation. |

### 3.2 — Tape Evaluation → Order Creation Bridge (P3-UI-04 → P3-UI-05)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P3-UI-04 | ✅ | UI | Add a "Create Orders for Approved Rows" action button in the `ReviewTapeResultsGrid` footer. Only enabled when ≥1 row has `decision: 'APPROVE'`. | **Done April 24, 2026** — replaced the tape grid's order-conversion trigger with a footer action that targets approved rows only, shows submission state, and links users to bulk-ingestion ops after submit. |
| P3-UI-05 | ✅ | UI | Wire that action to `POST /api/bulk-ingestion/submit` with `ingestionMode: TAPE_CONVERSION`, sending only approved rows with mapped fields. Add the `TAPE_CONVERSION` mode handling on the backend. | **Done April 24, 2026** — added `TAPE_CONVERSION` support across the bulk-ingestion controller/event pipeline/canonical adapter registry, exposed a UI submit mutation, and mapped approved tape rows into bulk-ingestion items for async order creation. |

### 3.3 — Engagement Targeting in Bulk Wizard (P3-UI-06 → P3-UI-07)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P3-UI-06 | ✅ | UI | Add "Associate with existing engagement" optional step 0 in the bulk wizard. Shows a searchable engagement picker. If selected, the `engagementId` is passed to the submit request. | **Done April 24, 2026** — added a searchable engagement picker to Step 0, auto-synced the selected client from the chosen engagement, and threaded `engagementId` through the UI + backend bulk-portfolio submit flow so created jobs/orders stay linked to the existing engagement. |
| P3-UI-07 | ✅ | UI | Add `engagementGranularity` toggle in Step 1 of the wizard: "One engagement for the whole batch" vs "One engagement per loan". | **Done April 24, 2026** — added a Step 1 granularity toggle, enforced existing-engagement compatibility, and threaded the selection through the bulk-portfolio order-creation path so new orders can share one engagement or create one per valid row. |

### 3.4 — Intake Wizard Draft Resume Fix (P3-UI-08)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P3-UI-08 | ✅ | UI | Fix `OrderIntakePage.resumeDraft()` to pass `draftId` to `OrderIntakeWizard`. Add `draftId?: string` prop; wizard loads draft state on mount when prop is present. | **Done April 24, 2026** — `OrderIntakePage` now passes the selected draft id into `OrderIntakeWizard`, and the wizard restores keyed draft state on mount while keeping the draft summary list in sync with localStorage-backed saves and removals. |

### 3.5 — Adapter Registry (P3-BE-09 → P3-BE-10)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P3-BE-09 | ✅ | BE | Move adapter definitions out of `buildAdapterRegistry()` in `BulkIngestionCanonicalWorkerService` into a Cosmos-persisted `BulkAdapterDefinition` collection. Add admin CRUD endpoints. | **Done April 24, 2026** — Added `BulkAdapterDefinition` types/service, tenant-scoped CRUD routes at `/api/bulk-adapter-definitions`, and refactored the canonical worker to resolve definitions from persisted registry data plus shipped built-ins. |
| P3-BE-10 | ✅ | BE | Add 3 additional built-in adapters: `generic-appraisal-v1`, `fnma-1004-v1`, `residential-bpo-v2`. Document field mapping expectations. | **Done April 24, 2026** — Added the three built-in adapter definitions and documented required fields, document expectations, and canonical field mappings in the bulk-ingestion runbook. |

---

## Phase 4 — AI Autonomous Bidding Assistant

**Goal:** Enable the AI assistant to take server-side actions autonomously; implement bid recommendation.  
**Target completion:** June 25, 2026

### 4.1 — POST /api/ai/execute (P4-BE-01 → P4-BE-03)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P4-BE-01 | ✅ | BE | Create `POST /api/ai/execute` endpoint. Accepts `AiParseResult` (already typed). Validates schema with Zod before dispatch. Dispatches each `intent` to a typed handler map. | **Done April 24, 2026** — added `ai-execute.controller.ts`, registered `/api/ai/execute`, validated the request body with Zod, dispatched executable intents through a typed handler map, and added unit coverage plus OpenAPI docs. |
| P4-BE-02 | ✅ | BE | Implement handlers for: `TRIGGER_AUTO_ASSIGNMENT` (calls auto-assignment orchestrator), `CREATE_ORDER` (calls OrderManagementService), `CREATE_ENGAGEMENT` (calls EngagementService), `ASSIGN_VENDOR` (uses the persisted assignment path because the payload already contains a concrete vendor). | **Done April 24, 2026** — added `ai-action-dispatcher.service.ts`, wired `POST /api/ai/execute` to use the dispatcher in the real app server, routed `CREATE_ORDER`, `CREATE_ENGAGEMENT`, `TRIGGER_AUTO_ASSIGNMENT`, and `ASSIGN_VENDOR` to concrete backend services, and added dispatcher unit coverage. |
| P4-BE-03 | ✅ | BE | Add Zod validation schemas for every intent payload in `src/store/api/schemas/aiSchemas.ts` equivalent on the backend. Throw `400` with actionable message on schema violation — never pass raw LLM output to service calls. | **Done April 24, 2026** — added `ai-intent-payloads.validator.ts`, validated executable intent payloads before dispatch inside `/api/ai/execute`, surfaced actionable `400` issue lists on schema failures, and added unit coverage for validator behavior plus controller short-circuiting. |

### 4.2 — AiMagicInput Schema Validation (P4-UI-04)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P4-UI-04 | ✅ | UI | Add Zod validation in `AiMagicInput` after receiving the parsed intent and before firing the mutation. Use existing `src/store/api/schemas/aiSchemas.ts`. Surface schema errors as inline warnings ("AI couldn't extract all required fields — please review before submitting"). | **Done April 24, 2026** — added executable-intent payload schemas + helpers in `src/store/api/schemas/aiSchemas.ts`, validated terminal action payloads inside `AiMagicInput` before approval/mutation, rendered inline warning alerts with actionable issues, and added schema + component unit coverage. |

### 4.3 — Axiom Bidding Analysis (P4-AX-05 → P4-AX-07)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P4-AX-05 | ✅ | AX | Add `appraisal_vendor_bid_analysis` to the `AgentAnalysisActor` analysis type enum. Inputs: `vendorCandidates[]` (id, name, score, recentOrders, avgTurnaround, avgFee), `orderDetails` (productType, propertyAddress, priority, dueDate). Output: ranked recommendation with rationale per candidate and overall recommendation. | **Done April 24, 2026** — added `appraisal_vendor_bid_analysis` to the actor analysis type set, taught the prompt builder to rank vendor candidates from `vendorCandidates` + `orderDetails`, and surfaced `rankedCandidates` / `overallRecommendation` in the actor output/state. |
| P4-AX-06 | ✅ | AX | Add `POST /api/agent/analyze/vendor-bid` route that accepts the above input and returns the analysis synchronously (≤30s timeout). | **Done April 24, 2026** — added request validation plus the synchronous `POST /api/agent/analyze/vendor-bid` route in `src/api/routes/agent.ts`, executed via `AgentAnalysisActor`, and capped timeout at 30s. |
| P4-AX-07 | ✅ | BE | In `AutoAssignmentOrchestratorService.onOrderCreated()`: when `BULK_INGESTION_AI_BID_SCORING=true`, call Axiom `analyzeVendorBid` before sending bid to `rankedVendors[0]`. Use AI recommendation as override when confidence ≥ threshold; fall back to rules-based rank. | **Done April 24, 2026** — added Axiom-backed vendor-bid scoring to `AutoAssignmentOrchestratorService`, required explicit confidence-threshold config, persisted the analysis snapshot onto the order, and only reordered the ranked list when AI confidence met the configured threshold. |

### 4.4 — Autonomous Bidding UI (P4-UI-08 → P4-UI-10)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P4-UI-08 | ⬜ | UI | Enable `tools.negotiation` flag. Implement "Bid Recommendation" card in the RFB award step: shows Axiom recommendation (recommended vendor + rationale), confidence chip, "Accept Recommendation" button. | Files: `src/app/(control-panel)/orders/[id]/rfb/page.tsx`, `src/configs/aiAssistantFlags.ts` |
| P4-UI-09 | ⬜ | UI | Add "Auto-award on first acceptable bid" toggle per order in the RFB page. Configures `autoAwardThreshold: { maxFeeMultiplier, minVendorScore }` on the RFB record. Backend honors this in bid-acceptance logic. | File: `src/app/(control-panel)/orders/[id]/rfb/page.tsx` |
| P4-UI-10 | ✅ | UI | Add AI "Why this vendor?" explainability panel (collapsible) to vendor acceptance queue per assigned order. Calls `GET /api/agent/analyze/vendor-bid/:orderId` to retrieve cached trajectory. | **Done April 24, 2026** — added the vendor acceptance queue explainability panel in `src/app/(control-panel)/vendor-engagement/acceptance/page.tsx`, backed by the cached-analysis query hook and richer rank-trajectory / dispatch-reason metadata from the backend. |

### 4.5 — Proactive AI Monitoring (P4-BE-11 → P4-UI-12)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P4-BE-11 | ⬜ | BE | Add `ProactiveAiMonitorService` that subscribes to order state events and: (1) detects batches where >30% of orders have been in `PENDING_BID` >18h, (2) surfaces an alert event to the notification channel with suggested action. | New file: `src/services/proactive-ai-monitor.service.ts` |
| P4-UI-12 | ⬜ | UI | Wire proactive AI alerts to the `NotificationBell` component as a new alert type `AI_INSIGHT` with action buttons (e.g. "Re-broadcast stalled orders"). | File: `src/components/notifications/NotificationBell.tsx` (or equivalent) |

---

## Phase 5 — Operational Excellence & Consolidation

**Goal:** Unified API, real-time push, retry tooling, adapter plugin system.  
**Target completion:** July 16, 2026

### 5.1 — Bulk API Consolidation (P5-BE-01 → P5-BE-02)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-BE-01 | ⬜ | BE | Deprecate `POST /api/bulk-portfolios/submit` in favour of `POST /api/bulk-ingestion/submit`. Add `Deprecation` and `Sunset` response headers, log usage. Document migration path. | File: `src/controllers/bulk-portfolio.controller.ts` |
| P5-BE-02 | ⬜ | UI | Update `bulkPortfoliosApi.ts` submit path to use `bulk-ingestion` endpoint. Ensure all 3 modes (ORDER_CREATION, TAPE_EVALUATION, DOCUMENT_EXTRACTION) are supported by the new API. | File: `src/store/api/bulkPortfoliosApi.ts` |

### 5.2 — Real-time Push for ORDER_CREATION Mode (P5-BE-03 → P5-UI-04)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-BE-03 | ⬜ | BE | Publish WebPubSub `bulk-job-progress` events from `BulkIngestionOrderCreationWorkerService` after each order is created/failed. Payload: `{ jobId, orderId, orderNumber, status, rowIndex, progressPct }`. | File: `src/services/bulk-ingestion-order-creation-worker.service.ts` |
| P5-UI-04 | ⬜ | UI | Add `ExtractionProgressPanel`-style live progress panel for ORDER_CREATION mode in the bulk wizard Step 3. Subscribe to `useNotificationSocket` for `bulk-job-progress` events. | New file: `src/app/(control-panel)/bulk-portfolios/OrderCreationProgressPanel.tsx` |

### 5.3 — Bulk Job Completion Push Notification (P5-UI-05)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-UI-05 | ⬜ | UI | Wire `bulk.ingestion.orders.created` event (already published by the worker) to a `NotificationBell` push notification: "Bulk job '{jobName}' completed: {n} orders created, {m} failed." With "View Results" link. | File: notification subscription wiring |

### 5.4 — Retry Failed Rows in Ops Page (P5-UI-06)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-UI-06 | ✅ | UI | Add "Retry" action button (shown when `retryable: true`) to failure items in `bulk-ingestion-ops/page.tsx`. Calls `POST /api/bulk-ingestion/:jobId/items/:itemId/retry`. | **Done April 24, 2026** — bulk ingestion ops now exposes per-item retry actions in `src/app/(control-panel)/bulk-ingestion-ops/page.tsx`, wired through `useRetryBulkIngestionItemMutation` to `POST /api/bulk-ingestion/:jobId/items/:itemId/retry`. |

### 5.5 — Broadcast Multi-round Exhaustion Test (P5-BE-07)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-BE-07 | ⬜ | BE | Write Vitest test covering `VendorBidRoundExhaustedEvent` → new broadcast round with next N candidates. Add `maxRounds` config (default 3). | File: `tests/unit/auto-assignment-orchestrator.test.ts` (new) |

### 5.6 — Axiom Evaluation Retry Path (P5-BE-08)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-BE-08 | ⬜ | BE | In `AutoAssignmentOrchestratorService.onAxiomEvaluationTimedOut()`: resubmit evaluation via `AxiomService.submitDocument()` up to `MAX_AXIOM_RETRY` times (env-configured, default 2). After max retries, publish `axiom.evaluation.failed` event for manual intervention. | File: `src/services/auto-assignment-orchestrator.service.ts` |

### 5.7 — Axiom ScratchpadManager Durability (P5-AX-09)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-AX-09 | ⬜ | AX | Replace in-memory `ScratchpadManager` Map with Loom StateStore persistence so agent working memory survives process crashes mid-ReAct run. | File: `src/agent/core/ScratchpadManager.ts` in axiom repo |

### 5.8 — Pipelines Route Refactor Cleanup (P5-AX-10)

| ID | Status | Repo | Task | Notes |
|---|---|---|---|---|
| P5-AX-10 | ⬜ | AX | Commit the in-progress pipelines route handler extraction: merge `pipelines-post-handler.ts.new` into `pipelines.ts`, delete `.backup` and `.new` files. | File: `src/api/routes/pipelines.ts` in axiom repo |

---

## Enhancement Backlog (Phase 6+)

These are enhancements beyond gap-fixing. Prioritise after Phase 5 is complete.

| ID | Priority | Repo | Feature | Description |
|---|---|---|---|---|
| E-01 | High | BE/UI | Resumable Uploads | Azure Blob multipart upload with resumable token for large XLSX + PDF batches (>50MB). |
| E-02 | High | BE | Dry-run Mode | `POST /api/bulk-ingestion/submit` with `dryRun: true` — validates all rows, returns error report, creates nothing. |
| E-03 | High | BE | Row Schema Inference | Detect `adapterKey` automatically by sniffing column headers in uploaded file. |
| E-04 | Medium | BE | Delta Ingestion | Re-submit only changed/new rows from a previously submitted batch using `externalId` dedup. |
| E-05 | Medium | AX | Natural Language Bulk Import | AI constructs import manifest from plain-language description. |
| E-06 | Medium | BE/UI | Bid Analytics Dashboard | Per-batch acceptance rate, avg time-to-accept, vendor decline reasons, fee variance. |
| E-07 | Medium | UI | Bulk RFB Broadcast | Broadcast an RFB across all orders in a bulk batch simultaneously. |
| E-08 | Medium | UI | AI Document Classification | Post-upload classify document type (appraisal/title/insurance) and surface for user confirmation before commit. |
| E-09 | Low | BE | Engagement Duplication/Clone | "Clone engagement" action for quickly creating similar engagements. |
| E-10 | Low | UI | Bulk Job Dry-run Preview UI | Show dry-run validation results in Step 2 with row-level error/warning chips before user commits. |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ~~Bulk ingestion Service Bus subscriptions missing in prod~~ | **RESOLVED** — all 6 confirmed in Bicep April 23, 2026 | — | — |
| Axiom extraction endpoint never called in production | High | Critical | P2-AX-01 removes silent fallback; P2-AX-02 adds retry. |
| `exceljs` adds startup/memory overhead to backend | Low | Low | Library is well-optimised; used in UI already; no streaming needed for ≤500 rows. |
| AI autonomous actions taken on wrong orders | Medium | High | P4-BE-03 Zod validation + P4-UI-04 UI confirmation + P4-UI-09 auto-award threshold guards. |
| `POST /api/ai/execute` exposed without auth | Low | Critical | Must be behind same auth middleware as all other endpoints. Verify in P4-BE-01 implementation. |

---

## Completion Summary

| Phase | Total Tasks | Done | In Progress | Blocked |
|---|---|---|---|---|
| Phase 1 — Make It Work | 11 | 11 | 0 | 0 |
| Phase 2 — Document Correlation | 10 | 10 | 0 | 0 |
| Phase 3 — Engagement Model | 10 | 10 | 0 | 0 |
| Phase 4 — AI Autonomous Bidding | 12 | 8 | 0 | 0 |
| Phase 5 — Operational Excellence | 10 | 1 | 0 | 0 |
| **Total** | **53** | **40** | **0** | **0** |
