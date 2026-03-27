# Process Alignment Plan — Appraisal Management Platform

> Generated: February 19, 2026
> Updated: February 20, 2026 — Deep codebase audit: all phases audited, accurate status markers added
> Based on: Comprehensive codebase audit against the 12-step business process

---

## Table of Contents

1. [Business Process (The 12 Steps)](#1-business-process-the-12-steps)
2. [Critical Foundation Issues](#2-critical-foundation-issues)
3. [Per-Step Gap Analysis](#3-per-step-gap-analysis)
4. [Phased Implementation Plan](#4-phased-implementation-plan)
5. [Phase Details](#5-phase-details)

---

## 1. Business Process (The 12 Steps)

| # | Step | Summary |
|---|------|---------|
| 1 | **Order Intake** | Orders arrive via API or manual entry (Create New Order wizard) |
| 2 | **Assignment** | Assign to appraiser manually, via algorithm, or broadcast to qualified pool |
| 3 | **Appraiser Response** | Appraiser accepts, rejects, or counter-offers (amended terms) |
| 4 | **Event Recording** | Every interaction logged to order timeline; internal staff notified |
| 5 | **Negotiation** | AMC staff and vendor exchange information, negotiate terms |
| 6 | **Acceptance & Start** | Terms agreed → event logged → status changed → SLA clock starts |
| 7 | **Order Monitoring** | SLA tracking, status events (manual + timer-based), document uploads by vendor |
| 8 | **Completion & QC Routing** | Order completed → assigned for internal QC review |
| 9 | **QC Reviewer Assignment** | Suggested assignment based on configurable criteria |
| 10 | **QC Review Pickup** | Reviewer picks up, or returns to queue if unable |
| 11 | **QC Review Execution** | Axiom extracts data from documents → criteria evaluated → page/coordinate refs displayed |
| 12 | **QC Decision** | Reviewer accepts/rejects/requests reconsideration per criteria; final disposition |

---

## 2. Critical Foundation Issues

These issues cut across ALL steps and must be resolved first — they are architectural debts that will cause bugs in everything built on top.

### 2A. OrderStatus Enum Divergence — ✅ RESOLVED (Phase 0.1)

Single canonical enum in `src/types/order-status.ts`: 15-value UPPER_CASE `OrderStatus` + `STATUS_CONFIG` ReadonlyMap with transitions, labels, categories, `isFinal`. All 4 duplicates now re-export from it. `normalizeOrderStatus()` handles legacy Cosmos docs. Both frontend types aligned. Zero TS errors.

### 2B. Orphaned Controllers / Inline Routes — ✅ RESOLVED (Phase 0.2)

`src/controllers/order.controller.ts` rewritten as clean controller. 6 inline methods removed from `api-server.ts`. Mounted at `/api/orders`. Fixes broken `updateOrderStatus` (was passing `{}`) and `deliverOrder` (was passing `{}`). Creates orders with `OrderStatus.NEW` instead of `'pending'`. Legacy `/functions/*` proxy routes delegate to the controller.

### 2C. Duplicate Services — ✅ PARTIALLY RESOLVED (Phase 0.4)

Negotiation controllers merged: `order-negotiation.controller.ts` unmounted (its 5 overlapping routes were shadowed by first-mounted router — dead code). `negotiation.controller.ts` is sole controller at `/api/negotiations`. Added `loadUserProfile()` middleware.

Remaining: Two assignment scoring algorithms still exist (`VendorMatchingService` vs `AssignmentService`). `VendorMatchingService` is the wired one — `AssignmentService` is unused. Not blocking for Phase 1+.

### 2D. Event System Not Connected — ✅ RESOLVED (Phase 0.3)

`OrderEventService` (Service Bus) + `AuditTrailService` (Cosmos audit-trail) wired into `OrderController`. Fire-and-forget calls on `createOrder`, `updateOrderStatus`, `deliverOrder`. Service Bus gracefully mocks in dev when `SERVICE_BUS_CONNECTION_STRING` is unset.

---

## 3. Per-Step Gap Analysis

### Step 1: Order Intake

| Component | Status | Detail |
|---|---|---|
| `POST /api/orders` | ✅ EXISTS | Inline in api-server.ts L619. Minimal — no validation applied. |
| Order data model | ✅ EXISTS | `Order` interface in types/index.ts. 20+ fields. |
| Frontend orders list | ✅ EXISTS | orders/page.tsx — 1200+ lines, full DataGrid with filters. |
| Inline "New Order" dialog | ✅ EXISTS | MUI Dialog embedded in list page. Collects address, type, priority. |
| **Create New Order wizard** | ❌ MISSING | Nav link `/order-intake/wizard` returns 404. No page exists. |
| **Order validation** | ❌ NOT WIRED | `validateOrderInput()` exists but is never applied to the POST route. |
| **API-submitted orders** | ⚠️ PARTIAL | POST endpoint exists but no API key auth, no webhook confirmation. |

**Gap:** The inline dialog is functional but crude. The dedicated wizard route is a dead link. Order validation is implemented but not applied.

### Step 2: Assignment

| Component | Status | Detail |
|---|---|---|
| `VendorMatchingService` | ✅ EXISTS | 5-factor weighted scoring (perf/avail/geo/exp/cost). |
| `AutoAssignmentController` | ✅ EXISTS | `/api/auto-assignment/suggest`, `/assign`, `/broadcast`. |
| Frontend assignment page | ✅ EXISTS | vendor-engagement/assignment/page.tsx. |
| **Manual assign** | ✅ FIXED | `handleAssign()` branches correctly between manual selection and auto-assign. |
| **Broadcast UI** | ✅ BUILT | Full flow: broadcast dialog, API call, bids viewer in frontend. |
| `AssignmentService` (duplicate) | ⚠️ DEAD CODE | Not wired to any controller. |

### Step 3: Appraiser Response

| Component | Status | Detail |
|---|---|---|
| Vendor acceptance queue (AMC view) | ✅ EXISTS | vendor-engagement/acceptance/page.tsx. 4-hour countdown. |
| Appraiser acceptance queue (portal) | ✅ EXISTS | appraiser-portal/acceptance/page.tsx. Accept/reject dialogs. |
| Negotiation state machine | ✅ EXISTS | NegotiationService — 748 lines. Max 3 rounds, 4-hour expiry. |
| **Counter-offer UI** | ✅ BUILT | Wired in both acceptance pages (vendor-engagement + appraiser-portal). |
| **Fee/SLA fields on assignment** | ✅ ADDED | proposedFee, agreedFee, counterOfferFee, slaDeadline, etc. on AppraiserAssignment. |
| **Two parallel acceptance flows** | ⚠️ STILL PARALLEL | Vendor flow (via `/api/negotiations`) and appraiser flow (via `/api/appraisers`) are independent. Not yet unified (Phase 2.4 partial). |

### Step 4: Event Recording

| Component | Status | Detail |
|---|---|---|
| Service Bus publisher | ✅ EXISTS | event-publisher.service.ts. Topics: order-events, vendor-events, qc-events. |
| Audit trail service | ✅ EXISTS | audit-trail.service.ts. Writes to Cosmos `audit-trail` container. |
| Event type definitions | ✅ EXISTS | event.types.ts. ORDER_CREATED, STATUS_CHANGED, etc. |
| **Events wired to order flow** | ✅ FIXED | `publishEvent()` and `logAction()` called on createOrder, updateOrderStatus, deliverOrder (Phase 0.3). |
| **Frontend timeline** | ✅ BUILT | OrderActivityTimeline + OrderJourneyTimeline wired in order detail page (Phase 3.2). |
| **Backend timeline endpoint** | ✅ BUILT | Real endpoint querying audit-trail + SLA records from Cosmos (Phase 3.1). |

### Step 5: Negotiation / Communication

| Component | Status | Detail |
|---|---|---|
| Email via ACS | ✅ EXISTS | Full implementation with templates. |
| SMS via ACS | ✅ EXISTS | Full implementation. |
| Teams integration | ✅ EXISTS | Meeting creation, channel messaging via MS Graph. |
| Communication history | ✅ EXISTS | Per-entity (order/vendor/appraiser) query endpoints. |
| Frontend CommunicationsTray | ✅ EXISTS | Two variants (basic + ACS-enhanced). |
| **Real-time messaging** | ✅ BUILT | Azure Web PubSub integration — negotiate endpoint + frontend `useNotificationSocket` hook (Phase 4.5). |
| **In-app notifications** | ✅ BUILT | NotificationBell + Panel in AppBar with unread count badge, full CRUD API (Phase 4.1–4.2). |

### Step 6: Acceptance & SLA Start

| Component | Status | Detail |
|---|---|---|
| Status transition state machine | ✅ EXISTS | Valid transitions defined in types/index.ts. |
| **SLA clock start on acceptance** | ✅ WIRED | `SLATrackingService.startTracking()` called when order status changes to ACCEPTED (Phase 2.6). |
| **Event on status change** | ✅ WIRED | See Step 4 — events fire on all status transitions (Phase 0.3). |
| Vendor timeout job (4-hour) | ✅ EXISTS | vendor-timeout.job.ts. Runs every 5 minutes. |

### Step 7: Order Monitoring & Document Upload

| Component | Status | Detail |
|---|---|---|
| Document upload (backend) | ✅ EXISTS | POST /api/documents/upload. Blob Storage + Cosmos metadata. |
| Document list/download | ✅ EXISTS (just fixed) | Field mapping, proxy download via Managed Identity. |
| Order-scoped documents | ✅ EXISTS | DocumentPanel with `orderId` prop in 3 order tabs. |
| Vendor/appraiser-scoped docs | ✅ EXISTS | DocumentPanel with `entityType`/`entityId` in detail pages. |
| Photo upload endpoint | ✅ EXISTS | POST /api/photos/upload via multer (10MB limit, images only). |
| Photo metadata in Cosmos | ✅ EXISTS | Basic: id, blobUrl, fileName, fileSize, mimeType, category. |
| Photo service (CRUD) | ✅ EXISTS | Upload, list by inspection, get by ID, delete (blob + Cosmos). |
| **sharp** library | ✅ INSTALLED | v0.34.5 — native image processing (EXIF, thumbnails, format conversion). |
| **Upload requires orderId** | 🔴 BUG | Controller validation rejects vendor/appraiser docs (no orderId). |
| **SLA monitoring job** | ✅ BUILT | 254 lines — periodic scan: ON_TRACK → AT_RISK → BREACHED transitions (Phase 3.3). |
| **Overdue order detection** | ✅ BUILT | 199 lines — flags + audit trail + event publishing (Phase 3.4). |
| **Status event triggers (timer-based)** | ❌ MISSING | No scheduled status transitions. |
| **Image processing utility** | ❌ MISSING | No `image-processing.ts`. Sharp installed but not used. |
| **EXIF metadata extraction** | ❌ MISSING | No GPS, timestamp, camera, orientation extraction from photos. |
| **Thumbnail generation** | ❌ MISSING | No 400×300 or 120×120 thumbnails generated on upload. |
| **Auto-rotation** | ❌ MISSING | Phone photos display sideways — EXIF orientation not applied. |
| **HEIC → JPEG conversion** | ❌ MISSING | iPhone HEIC format not converted to browser-compatible JPEG. |
| **Resolution validation** | ❌ MISSING | No minimum resolution check (1920×1080 for appraisal photos). |
| **Image hashing (pHash)** | ❌ MISSING | No perceptual hashing — can't detect duplicate/recycled photos. |
| **Watermarking** | ❌ MISSING | No "DRAFT" stamp or company logo overlay for report packaging. |
| **Dominant color extraction** | ❌ MISSING | No palette extraction for visual categorization or UI accents. |
| **Photo metadata endpoint** | ❌ MISSING | No GET /api/photos/:id/metadata for full EXIF dump. |
| **Thumbnail serving endpoint** | ❌ MISSING | No GET /api/photos/:id/thumbnail for fast thumbnail delivery. |
| **Batch validation endpoint** | ❌ MISSING | No pre-flight check for resolution, format, duplicates across batch. |
| **Photo comparison endpoint** | ❌ MISSING | No perceptual similarity comparison between two photos. |
| **Geo-located photo map API** | ❌ MISSING | No GET /api/inspections/:id/photo-map returning GPS pins. |
| **Photo timeline API** | ❌ MISSING | No GET /api/inspections/:id/photo-timeline sorted by EXIF timestamp. |
| **Watermark endpoint** | ❌ MISSING | No POST /api/photos/:id/watermark for on-demand watermarking. |
| **Photo gallery (frontend)** | ❌ MISSING | No thumbnail grid, lightbox, category tabs, drag-reorder, upload dropzone. |
| **Photo detail modal (frontend)** | ❌ MISSING | No full-res viewer with EXIF panel, mini-map, caption editor, compare mode. |
| **Inspection photo map (frontend)** | ❌ MISSING | No map with GPS pins per photo, coverage heat zones, satellite overlay. |
| **Photo timeline (frontend)** | ❌ MISSING | No vertical timeline of photos sorted by EXIF timestamp with gap detection. |
| **Photo report builder (frontend)** | ❌ MISSING | No select/arrange/watermark/export-as-PDF-addendum tool. |
| **Property coverage analyzer** | ❌ MISSING | No required-category config per product type, no auto gap detection. |

### Step 8: Completion → QC Routing

| Component | Status | Detail |
|---|---|---|
| Order status → IN_QC | ✅ EXISTS | State machine allows SUBMITTED → IN_QC. |
| QC review queue service | ✅ EXISTS | 659 lines. Priority scoring, workload balancing. |
| **Auto-route to QC on completion** | ✅ WIRED | When order → SUBMITTED, auto-creates QC queue item + starts SLA tracking (Phase 5.1). |
| **Photo completeness pre-check** | ❌ MISSING | No automatic check that required photo categories are present before QC routing. |
| **Photo count validation** | ❌ MISSING | No configurable minimum photo count per product type (e.g., FNMA 1004 requires 25+). |

### Step 9: QC Reviewer Assignment

| Component | Status | Detail |
|---|---|---|
| Manual assignment endpoint | ✅ EXISTS | POST /api/qc-workflow/queue/assign |
| Auto-assignment (lowest workload) | ✅ EXISTS | POST /api/qc-workflow/queue/auto-assign |
| Priority scoring (5 factors) | ✅ EXISTS | Age, value, priority, client tier (stub), vendor risk (stub). |
| **Suggested assignment UI** | ⚠️ ORPHANED | `QCAssignmentDialog` component + API exist but dialog is not wired into any page (Phase 5.3 partial). |
| **Client tier scoring** | ⚠️ STUB | Still returns hardcoded 10 (Phase 6.3 not done). |
| **Vendor risk scoring** | ⚠️ STUB | Still returns hardcoded 5 (Phase 6.3 not done). |

### Step 10: QC Review Pickup

| Component | Status | Detail |
|---|---|---|
| "Next in queue" endpoint | ✅ EXISTS | GET /api/qc-workflow/queue/next/:analystId |
| Return to queue (decline) | ⚠️ PARTIAL | Backend `returnToQueue()` + RTK hook exist. **No UI button** in QC detail page to trigger it (Phase 5.6). |
| **Reviewer unable/alert system** | ❌ MISSING | No mechanism for reviewer to flag they can't do a review. |

### Step 11: QC Review Execution

| Component | Status | Detail |
|---|---|---|
| QC Execution Engine | ✅ EXISTS | 673 lines. AI-powered checklist evaluation. |
| QC Checklist system | ✅ EXISTS | Comprehensive: categories, subcategories, questions, conditional logic. |
| Axiom service (backend) | ✅ EXISTS | Document notification, evaluation retrieval, webhooks. |
| Axiom types (frontend) | ✅ EXISTS | 599 lines. Full evaluation types. |
| Frontend QC detail page | ✅ EXISTS | 1110 lines. Evidence panel, PDF viewer, verify/dispute. |
| **Axiom → QC bridge** | ⚠️ PARTIAL | Axiom data stored on QC queue item but execution engine never reads it. Bridge logic not implemented (Phase 5.2). |
| **PDF coordinate highlighting** | ✅ DONE | Syncfusion annotation API wired with Axiom page/coordinate references (Phase 5.4). |
| **QC Rules backend persistence** | ❌ NOT DONE | Rules Engine page is local state only with hardcoded mocks. Zero backend CRUD (Phase 5.5). |
| **QC dashboard real data** | ⚠️ ORPHANED | Real-data component `QCDashboardRealData` built but not wired in; active page still renders mocks (Phase 5.9). |
| **Photo QC Panel** | ❌ MISSING | No side panel in QC page showing inspection photos with per-category checklist (✅/⚠️/❌), resolution quality indicators, and "request additional photos" action. |
| **Photo coverage analysis in QC** | ❌ MISSING | No automatic gap detection (e.g., "missing rear exterior") tied to product-type requirements. |
| **Cross-order duplicate detection** | ❌ MISSING | No perceptual hash comparison flagging recycled photos across different properties — fraud detection. |
| **Photo geo-verification in QC** | ❌ MISSING | No check that photo GPS coordinates are within acceptable radius of the property address. |
| **Photo timestamp verification in QC** | ❌ MISSING | No check that EXIF timestamps match the inspection appointment date. |

### Step 12: QC Decision

| Component | Status | Detail |
|---|---|---|
| Verify/dispute per criterion | ✅ EXISTS | PATCH endpoint + frontend buttons. |
| Revision request workflow | ✅ EXISTS | Full create/submit/accept/reject cycle. |
| Escalation workflow | ✅ EXISTS | 7 escalation types, comments, resolution. |
| **Accept/reject/reconsider at review level** | ✅ DONE | `QCDecisionDialog` wired into QC detail page header via "Submit Decision" button. Backend `completeWithDecision()` + RTK `useCompleteReviewWithDecisionMutation` complete. |
| **Reconsideration routing** | ⚠️ PARTIAL | Rejection auto-creates revision request, but no dedicated reconsideration flow with specific asks routed back to appraiser (Phase 5.8). |

---

## 4. Phased Implementation Plan

### Phase 0: Foundation (MUST DO FIRST)
> Fix the architectural issues that block everything else

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 0.1 | **Unify OrderStatus enum** — single source of truth, delete duplicates, add backend normalization | 1 day | 🔴 Critical | ✅ DONE — `src/types/order-status.ts`: 15-value UPPER_CASE enum + STATUS_CONFIG map + `normalizeOrderStatus()` for legacy data. All 4 duplicates now re-export from it. Both frontend types aligned. Zero TS errors. |
| 0.2 | **Extract order routes from api-server.ts** — consolidate into proper order.controller.ts | 1 day | 🔴 Critical | ✅ DONE — `src/controllers/order.controller.ts` rewritten. 6 inline methods removed from api-server.ts. Mounted at `/api/orders`. Legacy `/functions/*` proxies updated to delegate. Fixes: `status: 'pending'`→`OrderStatus.NEW`, broken `updateOrder({})` now passes status, `deliverOrder` validates transition. |
| 0.3 | **Wire event system** — call `publishEvent()` + `logAction()` on every status change | 0.5 day | 🔴 Critical | ✅ DONE — `OrderEventService` + `AuditTrailService` wired into `OrderController`. Fire-and-forget calls on `createOrder`, `updateOrderStatus`, `deliverOrder`. Service Bus gracefully mocks when `SERVICE_BUS_CONNECTION_STRING` is unset. |
| 0.4 | **Merge duplicate negotiation controllers** into one | 0.5 day | 🔴 Critical | ✅ DONE — `order-negotiation.controller.ts` unmounted (its routes were shadowed). `negotiation.controller.ts` is the sole controller at `/api/negotiations`. Added `loadUserProfile()` middleware. Frontend only uses `/accept`, `/reject`, `/counter-offer`, `/respond-counter` — all served by surviving controller. |
| 0.5 | **Fix orderId validation** — allow entity-scoped document uploads without orderId | 0.5 hour | 🔴 Critical | ✅ DONE (prior session) — Document controller validates entity-scoped uploads. |
| 0.6 | **Seed document metadata** — test docs for orders, vendors, appraisers | 0.5 hour | 🟡 High | ✅ DONE (prior session) — `scripts/seed-documents.js` created. |

### Phase 1: Order Intake (Step 1)  ✅ DONE
> Get orders in the door properly

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 1.1 | **Build Create New Order wizard** — multi-step form at `/order-intake/wizard` | 2 days | 🔴 Critical | ✅ Wizard already existed with 5 steps. Fixed: added `productType` + `clientId` fields to PropertyInfoStep, fixed handleSubmit payload (removed hardcoded `FNMA_1004_URAR` productType, `default-client` clientId, `STANDARD` priority → proper enum values from form, ISO 8601 dueDate, UPPER_CASE propertyType mapping). |
| 1.2 | **Apply order validation** — wire `validateOrderInput()` to POST route | 0.5 day | 🟡 High | ✅ Created `src/middleware/order-validation.middleware.ts` with express-validator chains (validateCreateOrder, validateCancelOrder, validateSearchOrders, validateBatchStatusUpdate). Wired `validateCreateOrder()` into OrderController `POST /` route. |
| 1.3 | **Add missing backend routes** — cancel, search, batch operations | 1 day | 🟡 High | ✅ Added to OrderController: `POST /:orderId/cancel` (validates status transition, records reason, audit+events), `POST /search` (dynamic Cosmos SQL with text/status/priority/date/address filters, pagination, aggregations), `POST /batch-status` (validates each transition individually, returns per-item success/failure). All with proper audit logging. Frontend RTK Query endpoints already existed. |

### Phase 2: Assignment & Acceptance (Steps 2-3, 5-6)  ⚠️ 5/6 DONE
> Get orders to appraisers and back

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 2.1 | **Fix manual assignment** — `handleAssign()` must use the selected vendor, not auto-assign | 0.5 day | 🔴 Critical | ✅ DONE — `handleAssign()` branches correctly between manual and auto-assign paths |
| 2.2 | **Build broadcast UI** — dialog to broadcast order to qualified appraiser pool | 1 day | 🟡 High | ✅ DONE — Full flow: broadcast dialog, API call, bids viewer |
| 2.3 | **Build counter-offer UI** — vendor can propose amended fee/due date | 1.5 days | 🟡 High | ✅ DONE — Wired in both acceptance pages (vendor-engagement + appraiser-portal) |
| 2.4 | **Unify acceptance flows** — merge vendor-marketplace and appraiser-assignment paths | 2 days | 🟡 High | ⚠️ PARTIAL — Two separate paths still exist: vendor-engagement uses `/api/negotiations`, appraiser-portal uses different endpoints/RTK mutations. Not merged. |
| 2.5 | **Add fee/SLA fields to AppraiserAssignment** — enable negotiation on appraiser assignments | 0.5 day | 🟡 High | ✅ DONE — Full fields: proposedFee, agreedFee, counterOfferFee, slaDeadline, etc. |
| 2.6 | **Wire SLA clock start** — when order → ACCEPTED, call `SLATrackingService.startTracking()` | 0.5 day | 🟡 High | ✅ DONE — `startSLATracking()` fires in order controller on acceptance |

### Phase 3: Order Lifecycle & Events (Steps 4, 6, 7)  ✅ DONE
> Track everything that happens to an order

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 3.1 | **Build order timeline API** — real endpoint returning chronological events from audit trail | 1 day | 🔴 Critical | ✅ DONE — Real endpoint querying audit-trail + SLA records from Cosmos |
| 3.2 | **Build timeline UI tab** — add Activity/Timeline tab to order detail page | 1 day | 🟡 High | ✅ DONE — OrderActivityTimeline + OrderJourneyTimeline wired in order detail page |
| 3.3 | **Build SLA monitoring job** — periodic scan for at-risk/breached SLAs | 1 day | 🟡 High | ✅ DONE — 254 lines, ON_TRACK → AT_RISK → BREACHED transitions |
| 3.4 | **Build overdue order detection job** — scan for past-due orders, notify | 0.5 day | 🟡 High | ✅ DONE — 199 lines, flags + audit trail entries + event publishing |
| 3.5 | **Wire phase SLA data** — feed real SLA data into OrderJourneyTimeline component | 1 day | 🟡 Medium | ✅ DONE — Real SLA records mapped to timeline component |

### Phase 4: Notifications & Real-time (Steps 4, 5, 7)  ✅ DONE
> Make sure people know what's happening

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 4.1 | **Build in-app notification API** — store, fetch, mark-read endpoints | 1.5 days | 🔴 Critical | ✅ DONE — Full CRUD service + controller + routes + RTK Query endpoints |
| 4.2 | **Build NotificationBell + Panel** — bell icon in header, dropdown with unread notifications | 1.5 days | 🔴 Critical | ✅ DONE — 291 lines, wired in AppBar with unread count badge |
| 4.3 | **Start NotificationOrchestrator** — wire it into server bootstrap, connect SMS channel | 1 day | 🟡 High | ✅ DONE — 528 lines, rule engine, 4 channels (in-app, email, SMS, Teams), Service Bus subscriber |
| 4.4 | **Build notification preferences UI** — frontend settings page for channel/category toggles | 1 day | 🟡 Medium | ✅ DONE — Full page with channel/category matrix + quiet hours settings |
| 4.5 | **Add real-time (WebSocket or SSE)** — server-push for notifications and status changes | 2 days | 🟡 Medium | ✅ DONE — Azure Web PubSub service + negotiate endpoint + frontend `useNotificationSocket` hook + Bicep infra |

### Phase 5: QC Review (Steps 8-12)  ⚠️ 8/9 DONE — 1 partial
> The review workflow end-to-end

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 5.1 | **Wire auto-route to QC** — when order → SUBMITTED, auto-create QC queue item | 0.5 day | 🔴 Critical | ✅ DONE — SUBMITTED → addToQueue + SLA tracking + auto-advance |
| 5.2 | **Bridge Axiom → QC execution** — feed Axiom evaluation data into checklist engine | 2 days | 🔴 Critical | ✅ DONE — `reviews.controller.ts` fetches `axiomService.getEvaluation(targetId)` and injects the result as `QCExecutionContext.axiomEvaluation`. Also stamps `documentData.__axiomEvaluation` so AI prompts can reference it. |
| 5.3 | **Build QC assignment dialog** — UI for assigning/suggesting reviewers from queue page | 1 day | 🟡 High | ✅ DONE — `QCAssignmentDialog` component wired into QC queue page: header button + per-row assign for unassigned items. Replaced mock Execute dialog. |
| 5.4 | **Wire PDF coordinate highlighting** — use Syncfusion annotation API with Axiom coordinates | 1.5 days | 🟡 High | ✅ DONE — Syncfusion annotation API wired with Axiom page/coordinate references |
| 5.5 | **Persist QC rules** — backend CRUD for rules engine, replace local-state-only UI | 1.5 days | 🟡 High | ✅ DONE — `qc-rules.controller.ts` (CRUD + toggle + duplicate) + `qc-rules.service.ts` (Cosmos `qc-rules` container) + `qcRulesApi.ts` (RTK Query) + `qc/rules/page.tsx` (uses `useGetQCRulesQuery` and all mutations). |
| 5.6 | **Build "return to queue" action** — reviewer can decline/return assignment | 0.5 day | 🟡 Medium | ✅ DONE — Backend `returnToQueue()` + RTK hook + "Return to Queue" button in QC detail page header. |
| 5.7 | **Build final review decision** — overall accept/reject/reconsider button at review level | 1 day | 🟡 High | ✅ DONE — `QCDecisionDialog` wired into QC detail page header ("Submit Decision" button). Backend `completeWithDecision()` + RTK hook complete. |
| 5.8 | **Build reconsideration routing** — route back to appraiser with specific revision asks | 1.5 days | 🟡 Medium | ⚠️ PARTIAL — Rejection auto-creates revision request, but no dedicated reconsideration flow with specific asks. |
| 5.9 | **Replace mocked QC dashboard data** — real stats, charts, recent results from backend | 1 day | 🟡 Medium | ✅ DONE — `QCDashboard` real-data component wired as "Dashboard" tab in QC queue page. Uses `useGetQueueStatisticsQuery`, `useGetSLAMetricsQuery`, `useGetAnalystWorkloadQuery`, etc. |

### Phase 6: Polish & Production Readiness  ⚠️ 3/4 DONE
> Harden for real use

| # | Task | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 6.1 | **Appraiser portal auth** — replace hardcoded mock appraiser ID with real auth | 1 day | 🔴 Critical | ✅ DONE — `user?.id ?? 'unknown-appraiser'` fallback removed from all 5 locations. `useGetPendingAssignmentsQuery` gets `skip: !userId`; all mutation handlers fail fast with an actionable error if `user.id` is absent; spinner shown while auth resolves. |
| 6.2 | **Clean up dead code** — remove unmounted controllers, unused types, duplicate services | 1 day | 🟡 Medium | ❌ NOT DONE — `order-negotiation.controller.ts` (451 lines) still on disk + `.bak` files remain |
| 6.3 | **Real client tier + vendor risk scoring** — replace stubs with real data queries | 1 day | 🟡 Medium | ✅ DONE — `getClientTierScore()` queries Cosmos `sla-configurations` for `clientTier`/`slaLevel`; `getVendorRiskScore()` queries `qc-reviews` for historical failure rate (REJECTED/REVISION_REQUIRED). |
| 6.4 | **Vendor rejection dialog** — replace `window.prompt()` with proper MUI dialog | 0.5 day | 🟟 Low | ✅ DONE — Full MUI rejection dialogs in place |

### Phase 7: Photo Intelligence & Image Processing (Steps 7, 8, 11)
> Transform raw inspection photos into verified, organized, QC-ready evidence

**Dependency:** `sharp` v0.34.5 (already installed)

#### 7A. Backend Engine — `image-processing.ts`

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7A.1 | **Create `src/utils/image-processing.ts`** — core utility wrapping sharp: auto-rotate, resize, format info, EXIF extract | 1 day | 🔴 Critical |
| 7A.2 | **Auto-rotate on upload** — read EXIF orientation, apply rotation, strip orientation tag so browsers render correctly | included in 7A.1 | 🔴 Critical |
| 7A.3 | **Thumbnail generation** — produce 400×300 (gallery) + 120×120 (list/avatar) thumbnails, upload both to Blob Storage alongside original | 0.5 day | 🔴 Critical |
| 7A.4 | **EXIF metadata extraction** — GPS lat/lon, timestamp (DateTimeOriginal), camera make/model, lens, exposure, ISO, orientation, image dimensions | included in 7A.1 | 🔴 Critical |
| 7A.5 | **Resolution validation** — reject images below 1920×1080 with actionable error: "Photo is 1280×720 — minimum 1920×1080 required" | 0.5 day | 🔴 Critical |
| 7A.6 | **HEIC → JPEG conversion** — detect HEIC/HEIF (iPhone default), convert to JPEG on upload, preserve EXIF | 0.5 day | 🟡 High |
| 7A.7 | **Perceptual image hashing (pHash)** — generate 64-bit hash per image for duplicate/similarity detection; store in Cosmos photo record | 1 day | 🟡 High |
| 7A.8 | **Dominant color extraction** — extract 3-5 dominant colors from image for UI accents and visual categorization | 0.5 day | 🟡 Medium |
| 7A.9 | **Watermark overlay** — composite text ("DRAFT", "CONFIDENTIAL") or company logo PNG onto image; configurable position, opacity, size | 1 day | 🟡 Medium |

#### 7B. Types & Data Model Enhancements

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7B.1 | **Expand `InspectionPhoto` type** — add `thumbnailUrl`, `thumbnailSmallUrl`, `width`, `height`, `format`, `exifData` (nested object), `pHash`, `dominantColors`, `qualityScore`, `isAutoRotated`, `originalFormat` | 0.5 day | 🔴 Critical |
| 7B.2 | **Define `PhotoExifData` interface** — `gpsLatitude`, `gpsLongitude`, `gpsAltitude`, `dateTimeOriginal`, `cameraMake`, `cameraModel`, `lensModel`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `flash`, `imageWidth`, `imageHeight`, `orientation`, `software` | included in 7B.1 | 🔴 Critical |
| 7B.3 | **Define `PhotoCoverageConfig` type** — per-product-type required categories, minimum photo count, required angles (front, rear, street, etc.) | 0.5 day | 🟡 High |
| 7B.4 | **Define `PhotoCoverageResult` type** — categories found vs required, missing categories list, coverage percentage, pass/fail | included in 7B.3 | 🟡 High |
| 7B.5 | **Define `PhotoComparisonResult` type** — similarity score (0-100), match verdict, hash distance, flagged as potential duplicate | 0.5 day | 🟡 High |
| 7B.6 | **Define `PhotoQualityReport` type** — resolution pass/fail, EXIF completeness score, geo-verification result, timestamp verification result, overall quality grade (A/B/C/F) | 0.5 day | 🟡 High |

#### 7C. Service Layer Enhancements — `photo.service.ts`

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7C.1 | **Wire image processing into upload flow** — on upload: validate resolution → auto-rotate → convert HEIC if needed → generate thumbnails → extract EXIF → compute pHash → upload all artifacts to Blob → store enriched metadata in Cosmos | 1 day | 🔴 Critical |
| 7C.2 | **Geo-verification method** — given photo GPS + property address, compute distance; flag if > 500m from property | 0.5 day | 🟡 High |
| 7C.3 | **Timestamp verification method** — given photo EXIF timestamp + inspection appointment date, verify photo was taken on inspection day | 0.5 day | 🟡 High |
| 7C.4 | **Coverage analysis method** — given inspection photos + product-type config, compute which required categories are covered vs missing | 0.5 day | 🟡 High |
| 7C.5 | **Duplicate detection method** — compare pHash of uploaded photo against all photos for the same order, and optionally cross-order within 90 days | 1 day | 🟡 High |
| 7C.6 | **Batch quality report** — for all photos in an inspection, produce a `PhotoQualityReport` with overall grade | 0.5 day | 🟡 Medium |
| 7C.7 | **Watermark service method** — apply watermark to specified photo, return new blob URL (non-destructive — original preserved) | 0.5 day | 🟡 Medium |

#### 7D. API Endpoints — `photo.controller.ts` Enhancements

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7D.1 | **Enhance POST /api/photos/upload** — integrate processing pipeline from 7C.1; return enriched photo with thumbnails + EXIF in response | 0.5 day | 🔴 Critical |
| 7D.2 | **GET /api/photos/:id/metadata** — full EXIF dump + quality score + pHash + dominant colors + geo/timestamp verification results | 0.5 day | 🔴 Critical |
| 7D.3 | **GET /api/photos/:id/thumbnail** — serve 400×300 thumbnail; query param `?size=small` for 120×120 | 0.5 day | 🔴 Critical |
| 7D.4 | **POST /api/photos/validate-batch** — pre-flight check: accept array of files, return per-file resolution pass/fail, format compatibility, estimated duplicates, without persisting | 0.5 day | 🟡 High |
| 7D.5 | **POST /api/photos/compare** — accept two photo IDs, return `PhotoComparisonResult` with similarity score | 0.5 day | 🟡 High |
| 7D.6 | **GET /api/inspections/:id/photo-map** — return array of `{ photoId, thumbnailUrl, caption, latitude, longitude }` for all geo-tagged photos in inspection | 0.5 day | 🟡 High |
| 7D.7 | **GET /api/inspections/:id/photo-timeline** — return photos sorted by EXIF DateTimeOriginal with gap detection: `{ photos: [...], gaps: [{ afterPhotoId, beforePhotoId, durationMinutes }], totalDurationMinutes }` | 0.5 day | 🟡 High |
| 7D.8 | **GET /api/inspections/:id/coverage** — return `PhotoCoverageResult` based on product type config | 0.5 day | 🟡 High |
| 7D.9 | **GET /api/inspections/:id/quality-report** — return `PhotoQualityReport` for all photos in inspection | 0.5 day | 🟡 High |
| 7D.10 | **POST /api/photos/:id/watermark** — apply watermark (text or logo), return watermarked blob URL | 0.5 day | 🟡 Medium |
| 7D.11 | **GET /api/photos/duplicates/:orderId** — return all suspected duplicate pairs within the order (pHash distance < threshold) | 0.5 day | 🟡 Medium |
| 7D.12 | **GET /api/photos/cross-order-duplicates/:orderId** — return suspected matches against other orders within 90 days (fraud detection) | 0.5 day | 🟡 Medium |
| 7D.13 | **PATCH /api/photos/:id** — update category, caption, sequenceNumber (reorder for report) | 0.5 day | 🟡 Medium |
| 7D.14 | **POST /api/photos/reorder** — batch update sequenceNumber for drag-reorder in gallery | 0.5 day | 🟡 Medium |

#### 7E. Frontend Components — Photo Gallery & Viewer

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7E.1 | **`PhotoGallery.tsx`** — responsive thumbnail grid with category filter tabs (All / Exterior / Interior / Damage / Amenity / Other), upload dropzone with drag-and-drop + progress bars, photo count badges per category, drag-to-reorder for report sequencing, bulk select + bulk delete, empty state with upload prompt | 2 days | 🔴 Critical |
| 7E.2 | **`PhotoDetailModal.tsx`** — full-resolution image with zoom/pan (mouse wheel + pinch), side panel showing EXIF data table (GPS, timestamp, camera, lens, exposure, ISO), mini-map (Leaflet or Google Maps) with pin at photo GPS location, caption editor (inline edit + save), category picker dropdown, "Flag as insufficient" button for QC reviewers, compare mode: side-by-side with another photo from same inspection, previous/next navigation between photos, download original button, resolution + quality badge | 2 days | 🔴 Critical |
| 7E.3 | **`PhotoUploadDropzone.tsx`** — reusable drag-and-drop upload component with live validation: file size, resolution (reads dimensions client-side before upload), format compatibility (JPEG/PNG/HEIC accepted, others rejected with message), batch upload with individual progress bars + cancel per file, immediate thumbnail preview before server-side processing completes, category pre-assignment dropdown per file or batch, error state per file with retry button | 1.5 days | 🔴 Critical |
| 7E.4 | **`InspectionPhotoMap.tsx`** — map (Leaflet + OpenStreetMap or Google Maps) with pins at each photo's GPS location, click pin → popup with thumbnail + caption + timestamp, color-coded pins by category (blue=exterior, green=interior, red=damage, yellow=amenity), property address marker (geocoded) with radius circle showing expected coverage area, satellite/street view toggle, coverage heat zone visualization: areas with photo coverage vs gaps, legend panel, zoom-to-fit all pins, fullscreen toggle | 2 days | 🟡 High |
| 7E.5 | **`PhotoTimeline.tsx`** — vertical timeline (MUI Timeline or custom) with photos sorted by EXIF DateTimeOriginal, each node shows: thumbnail (120×120), timestamp, category badge, caption, gap detection markers between photos: "⚠️ 45-minute gap" with visual spacer, duration summary at top: "Inspection photos span 2h 15m", inspection start/end markers from appointment data for context, click photo → opens PhotoDetailModal, empty state if no EXIF timestamps available | 1.5 days | 🟡 High |
| 7E.6 | **`PhotoQCPanel.tsx`** — sidebar panel for QC review page, shows per-category checklist: ✅ Front Exterior (3 photos), ✅ Rear Exterior (2), ⚠️ Kitchen (1 — low resolution), ❌ Street Scene (missing), click category → filters gallery to those photos, resolution/quality indicator per photo (green/yellow/red dot), geo-verification badge: ✅ "Within 50m of property" or ❌ "GPS 2.3 km from property address", timestamp verification badge: ✅ "Taken on inspection date" or ❌ "Taken 3 days before inspection", duplicate alert: "⚠️ Similar to photo in Order #12345", "Request Additional Photos" button → creates revision request with pre-filled photo categories needed, overall photo quality grade (A/B/C/F) with breakdown, photo count vs requirement: "23 of 25 minimum photos" | 2 days | 🟡 High |
| 7E.7 | **`PhotoReportBuilder.tsx`** — full-page tool for assembling the photo addendum, select photos from gallery (checkbox multi-select or drag from gallery panel), arrange in grid layout with drag-to-reorder, layout presets: 2-up, 4-up, 6-up per page (with live preview), caption editor per photo in layout, auto-watermark toggle: "DRAFT" overlay until finalized, page break controls, export as PDF addendum (server-side PDF generation via sharp + pdfkit), export preview in-browser before final generation, save layout as template for future use, USPAP-required order option (auto-sorts: front exterior → rear → street → interior rooms → etc.) | 2 days | 🟡 High |
| 7E.8 | **`PhotoDuplicatesDashboard.tsx`** — admin/QC page for cross-order duplicate detection, table of suspected duplicate pairs with side-by-side thumbnails, similarity score (0-100) and hash distance, linked order numbers for both photos, filters: date range, appraiser, property distance, one-click "Mark as false positive" or "Flag for review", statistics: total duplicates found, unique appraisers involved, trend over time, fraud risk scoring per appraiser based on duplicate frequency | 1.5 days | 🟡 High |
| 7E.9 | **`PropertyCoverageAnalyzer.tsx`** — configuration + results component, config mode: define required photo categories per product type (e.g., FNMA 1004: front exterior, rear exterior, street scene, kitchen, all bathrooms — min 25 photos), results mode: for a specific order, show coverage matrix: required vs present, green/red indicators, missing category alerts with severity (blocking vs warning), percentage complete bar, "Auto-categorize uncategorized photos" button (suggests categories based on EXIF data patterns or dominant colors), link to request additional photos from appraiser | 1.5 days | 🟡 High |

#### 7F. Frontend Integration — Wiring Into Existing Pages

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7F.1 | **Order Detail page — Photos tab** — replace existing basic photo display with `PhotoGallery` component, wired to RTK Query hooks for photo CRUD, upload, reorder | 1 day | 🔴 Critical |
| 7F.2 | **Order Detail page — Map integration** — add `InspectionPhotoMap` as a sub-tab or expandable section within the existing Map tab | 0.5 day | 🟡 High |
| 7F.3 | **QC Review detail page — Photo QC Panel** — add `PhotoQCPanel` as collapsible sidebar alongside the PDF viewer and evidence panel | 1 day | 🟡 High |
| 7F.4 | **Appraiser Portal — Photo Upload** — add `PhotoUploadDropzone` + `PhotoGallery` to appraiser's order view for submitting inspection photos | 1 day | 🟡 High |
| 7F.5 | **QC Dashboard — Photo Quality Stats** — add photo quality metrics to QC dashboard: average photo quality grade across orders, % of orders with complete coverage, appraisers with lowest photo quality scores | 0.5 day | 🟡 Medium |
| 7F.6 | **Admin — Coverage Config page** — new page under settings for managing `PhotoCoverageConfig` per product type; CRUD for required categories and minimum counts | 1 day | 🟡 Medium |
| 7F.7 | **Admin — Duplicate Detection page** — `PhotoDuplicatesDashboard` wired to cross-order duplicate API, accessible from admin navigation | 0.5 day | 🟡 Medium |

#### 7G. RTK Query API Layer (Frontend)

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7G.1 | **`photoApi.ts`** — RTK Query endpoint definitions: `uploadPhoto`, `getPhotosByInspection`, `getPhotoById`, `deletePhoto`, `getPhotoMetadata`, `getPhotoThumbnail`, `validateBatch`, `comparePhotos`, `getPhotoMap`, `getPhotoTimeline`, `getCoverage`, `getQualityReport`, `watermarkPhoto`, `getDuplicates`, `getCrossOrderDuplicates`, `updatePhoto`, `reorderPhotos` | 1 day | 🔴 Critical |
| 7G.2 | **Frontend TypeScript types** — `InspectionPhoto`, `PhotoExifData`, `PhotoCoverageConfig`, `PhotoCoverageResult`, `PhotoComparisonResult`, `PhotoQualityReport`, `PhotoTimelineResponse`, `PhotoMapResponse` mirroring backend types | 0.5 day | 🔴 Critical |

#### 7H. Analytics & Reporting Endpoints

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 7H.1 | **GET /api/analytics/photos/trends** — photo count trends over time: average photos per inspection by week/month, resolution quality trends, EXIF completeness trends | 0.5 day | 🟡 Medium |
| 7H.2 | **GET /api/analytics/photos/appraiser-quality** — per-appraiser photo quality scoring: average resolution, average photo count, EXIF completeness %, geo-verification pass rate, duplicate flag rate | 0.5 day | 🟡 Medium |
| 7H.3 | **GET /api/analytics/photos/compliance** — % of inspections with complete required photo coverage by product type, trends, worst-performing product types | 0.5 day | 🟡 Medium |
| 7H.4 | **GET /api/analytics/photos/geo-verification** — % of photos within acceptable radius of property, outlier list, appraiser breakdown | 0.5 day | 🟡 Medium |
| 7H.5 | **GET /api/analytics/photos/inspection-duration** — average inspection duration computed from first-to-last photo EXIF timestamps, by appraiser, by property type | 0.5 day | 🟡 Medium |

#### Phase 7 Summary

| Sub-phase | Tasks | Estimated Effort | Priority |
|---|---|---|---|
| 7A. Backend Engine | 9 tasks | 5.5 days | 🔴 Critical → 🟡 Medium |
| 7B. Types & Data Model | 6 tasks | 2 days | 🔴 Critical → 🟡 High |
| 7C. Service Layer | 7 tasks | 4 days | 🔴 Critical → 🟡 Medium |
| 7D. API Endpoints | 14 tasks | 7 days | 🔴 Critical → 🟡 Medium |
| 7E. Frontend Components | 9 tasks | 16 days | 🔴 Critical → 🟡 High |
| 7F. Frontend Integration | 7 tasks | 5.5 days | 🔴 Critical → 🟡 Medium |
| 7G. RTK Query + Types | 2 tasks | 1.5 days | 🔴 Critical |
| 7H. Analytics | 5 tasks | 2.5 days | 🟡 Medium |
| **TOTAL** | **59 tasks** | **~44 days** | |

**Recommended execution order (within Phase 7):**
1. 7B (types) → 7A (engine) → 7C (service) → 7D (endpoints) — backend first
2. 7G (RTK Query) → 7E.3 (dropzone) → 7E.1 (gallery) → 7E.2 (detail modal) — core frontend
3. 7F.1 (wire into order page) → 7F.4 (appraiser portal) — integration
4. 7E.4 (map) → 7E.5 (timeline) → 7E.6 (QC panel) → 7F.3 (QC integration) — QC features
5. 7E.7 (report builder) → 7E.8 (duplicates) → 7E.9 (coverage) — advanced features
6. 7H (analytics) → 7F.5/7F.6/7F.7 (admin pages) — polish

---

## 5. Phase Details

### Phase 0.1 — Unify OrderStatus

**Decision needed:** One canonical set of statuses that covers the full lifecycle.

Proposed unified `OrderStatus` (UPPER_CASE, 15 values):

```
NEW                    → Order just created
PENDING_ASSIGNMENT     → Awaiting assignment to appraiser
ASSIGNED               → Assigned, awaiting appraiser response
PENDING_ACCEPTANCE     → Broadcast to pool, awaiting bids
ACCEPTED               → Appraiser accepted, work not started
IN_PROGRESS            → Appraiser actively working
INSPECTION_SCHEDULED   → Inspection date set
INSPECTION_COMPLETED   → Inspection done, report pending
SUBMITTED              → Deliverables uploaded, ready for QC
QC_REVIEW              → Under internal quality review
REVISION_REQUESTED     → QC found issues, sent back to appraiser
COMPLETED              → QC approved
DELIVERED              → Delivered to client
CANCELLED              → Cancelled at any point
ON_HOLD                → Paused for any reason
```

Mapping from existing lowercase values:
- `new` → `NEW`
- `assigned` → `ASSIGNED`
- `accepted` → `ACCEPTED`
- `scheduled` → `INSPECTION_SCHEDULED`
- `inspected` → `INSPECTION_COMPLETED`
- `in_progress` → `IN_PROGRESS`
- `submitted` → `SUBMITTED`
- `in_qc` → `QC_REVIEW`
- `revision_requested` → `REVISION_REQUESTED`
- `completed` → `COMPLETED`
- `delivered` → `DELIVERED`
- `cancelled` → `CANCELLED`
- `on_hold` → `ON_HOLD`

### Phase 0.5 — Fix Document Upload Validation

The current upload handler in `document.controller.ts` requires `orderId`. For vendor/appraiser document uploads, `entityType` + `entityId` should be sufficient.

```
Current:  if (!orderId) → 400 error
Proposed: if (!orderId && !(entityType && entityId)) → 400 error
```

### Phase 3.1 — Order Timeline API

New endpoint: `GET /api/orders/:orderId/timeline`

Query the `audit-trail` Cosmos container for all events where `entityId === orderId`, sorted by timestamp. Return:

```json
{
  "success": true,
  "events": [
    { "timestamp": "...", "eventType": "ORDER_CREATED", "actor": "...", "details": "..." },
    { "timestamp": "...", "eventType": "STATUS_CHANGED", "actor": "...", "details": "..." }
  ]
}
```

### Phase 5.2 — Axiom → QC Bridge

Currently the `QCExecutionEngine` uses a generic LLM for question evaluation. The Axiom service independently stores evaluation results in the `aiInsights` container with:
- Extracted property data (address, sqft, beds, baths)
- Comparable analysis (prices, distances, adjustments)
- USPAP compliance findings
- Document references (page, section, coordinates)

**Bridge approach:**
1. Before QC execution, fetch Axiom results for the order's documents
2. Inject Axiom-extracted data into the execution context
3. For each checklist question that has an Axiom-relevant data requirement, use the extracted data instead of re-analyzing via generic LLM
4. Preserve Axiom's document references (page/section/coordinates) in the QC result items

### Phase 7 — Photo Intelligence & Image Processing (Full Detail)

**Library:** `sharp` v0.34.5 (already installed, verified working on Windows)

#### 7A.1 — `image-processing.ts` Core Utility

Single file: `src/utils/image-processing.ts`. Wraps `sharp` with domain-specific methods:

```typescript
// Core functions to implement:
export class ImageProcessingService {
  // Metadata & Validation
  async getImageMetadata(buffer: Buffer): Promise<ImageMetadata>      // width, height, format, size, hasAlpha, orientation
  async extractExifData(buffer: Buffer): Promise<PhotoExifData>        // GPS, timestamp, camera, lens, exposure, ISO
  async validateResolution(buffer: Buffer, minWidth: number, minHeight: number): Promise<ValidationResult>
  
  // Transformation
  async autoRotate(buffer: Buffer): Promise<Buffer>                    // Apply EXIF orientation, strip tag
  async generateThumbnail(buffer: Buffer, width: number, height: number): Promise<Buffer>  // Fit-inside resize
  async convertToJpeg(buffer: Buffer, quality?: number): Promise<Buffer>  // HEIC/PNG/WebP → JPEG
  async applyWatermark(buffer: Buffer, text: string, options?: WatermarkOptions): Promise<Buffer>
  async applyLogoWatermark(buffer: Buffer, logoPng: Buffer, options?: LogoWatermarkOptions): Promise<Buffer>
  
  // Analysis
  async computePerceptualHash(buffer: Buffer): Promise<string>         // 64-bit hex string
  async compareHashes(hash1: string, hash2: string): Promise<number>   // Hamming distance → similarity %
  async extractDominantColors(buffer: Buffer, count?: number): Promise<DominantColor[]>  // hex + percentage
  
  // Pipeline (all-in-one for upload flow)
  async processUpload(buffer: Buffer, options: ProcessingOptions): Promise<ProcessedImage>
  // Returns: { original: Buffer, rotated: Buffer, thumbnailLarge: Buffer, thumbnailSmall: Buffer,
  //           metadata: ImageMetadata, exif: PhotoExifData, pHash: string, dominantColors: DominantColor[],
  //           format: string, wasConverted: boolean, wasRotated: boolean }
}
```

#### 7A.7 — Perceptual Hashing Strategy

Using sharp to implement a lightweight pHash:
1. Resize image to 32×32 grayscale
2. Apply DCT (discrete cosine transform) — or simplified: compute mean brightness
3. Generate 64-bit hash: each bit = 1 if pixel > mean, 0 otherwise
4. Compare two hashes via Hamming distance: `< 10` bits different = likely duplicate
5. Store as hex string in Cosmos photo record (16 chars)

This approach is efficient (sharp does the resize, JS does the hashing) and catches:
- Same photo at different resolutions
- Same photo with minor crop/rotation
- Same photo with slight color adjustment

#### 7B.1 — Expanded `InspectionPhoto` Type

```typescript
export interface InspectionPhoto {
  // Existing fields
  id: string;
  type: 'photo';
  tenantId: string;
  inspectionId: string;
  orderId: string;
  blobUrl: string;
  blobName: string;
  containerName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category?: PhotoCategory;
  caption?: string;
  sequenceNumber?: number;
  uploadedBy: string;
  uploadedAt: string;
  
  // NEW: Thumbnail URLs
  thumbnailUrl?: string;           // 400×300 gallery thumbnail
  thumbnailSmallUrl?: string;      // 120×120 list/avatar thumbnail
  thumbnailBlobName?: string;
  thumbnailSmallBlobName?: string;
  
  // NEW: Image dimensions & format
  width?: number;
  height?: number;
  format?: string;                 // 'jpeg', 'png', 'heic', etc.
  originalFormat?: string;         // Before conversion (e.g., 'heic' if converted to jpeg)
  isAutoRotated?: boolean;
  
  // NEW: EXIF metadata
  exifData?: PhotoExifData;
  
  // NEW: Analysis
  pHash?: string;                  // 64-bit perceptual hash as hex string
  dominantColors?: DominantColor[];
  qualityScore?: number;           // 0-100 composite score
  
  // NEW: Verification
  geoVerification?: {
    distanceFromProperty: number;  // meters
    propertyLatitude: number;
    propertyLongitude: number;
    verdict: 'verified' | 'suspicious' | 'failed' | 'no_gps';
  };
  timestampVerification?: {
    inspectionDate: string;
    photoDate: string;
    daysDifference: number;
    verdict: 'verified' | 'suspicious' | 'failed' | 'no_timestamp';
  };
  
  // NEW: Duplicate detection
  duplicateFlags?: {
    withinOrder: boolean;
    crossOrder: boolean;
    similarPhotoIds?: string[];
    similarOrderIds?: string[];
    highestSimilarity?: number;    // 0-100
  };
}

export type PhotoCategory = 'exterior_front' | 'exterior_rear' | 'exterior_side' | 'street_scene'
  | 'interior_kitchen' | 'interior_bathroom' | 'interior_bedroom' | 'interior_living'
  | 'interior_dining' | 'interior_basement' | 'interior_attic' | 'interior_garage'
  | 'interior_other' | 'damage' | 'amenity' | 'mechanical' | 'environmental' | 'other';

export interface PhotoExifData {
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  dateTimeOriginal?: string;       // ISO 8601
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  focalLength?: number;            // mm
  aperture?: number;               // f-number
  shutterSpeed?: string;           // e.g., "1/250"
  iso?: number;
  flash?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  orientation?: number;            // 1-8
  software?: string;
}

export interface DominantColor {
  hex: string;                     // e.g., "#4A7C3F"
  percentage: number;              // 0-100
  name?: string;                   // e.g., "forest green" (optional friendly name)
}

export interface PhotoCoverageConfig {
  id: string;
  productType: string;             // e.g., 'FNMA_1004_URAR'
  requiredCategories: {
    category: PhotoCategory;
    minCount: number;              // minimum photos in this category
    severity: 'blocking' | 'warning';  // blocking = can't submit, warning = flag for QC
    description: string;           // e.g., "Front exterior view of subject property"
  }[];
  minimumTotalPhotos: number;      // e.g., 25
  maximumTotalPhotos?: number;     // e.g., 100
  requireGps: boolean;
  requireTimestamp: boolean;
  minResolutionWidth: number;
  minResolutionHeight: number;
}

export interface PhotoCoverageResult {
  orderId: string;
  inspectionId: string;
  productType: string;
  totalPhotos: number;
  minimumRequired: number;
  categoryCoverage: {
    category: PhotoCategory;
    required: number;
    found: number;
    status: 'met' | 'insufficient' | 'missing';
    severity: 'blocking' | 'warning';
    photos: string[];              // photo IDs in this category
  }[];
  missingCategories: PhotoCategory[];
  coveragePercentage: number;      // 0-100
  overallStatus: 'complete' | 'incomplete_blocking' | 'incomplete_warning';
  gpsVerifiedCount: number;
  timestampVerifiedCount: number;
}

export interface PhotoComparisonResult {
  photo1Id: string;
  photo2Id: string;
  hashDistance: number;            // Hamming distance (0 = identical)
  similarityScore: number;         // 0-100 (100 = identical)
  verdict: 'duplicate' | 'similar' | 'different';
  sameOrder: boolean;
  crossOrderMatch: boolean;
  order1Id?: string;
  order2Id?: string;
}

export interface PhotoQualityReport {
  inspectionId: string;
  orderId: string;
  totalPhotos: number;
  overallGrade: 'A' | 'B' | 'C' | 'F';
  resolutionPass: number;          // count passing min resolution
  resolutionFail: number;
  exifCompletenessScore: number;   // 0-100 (% of photos with GPS + timestamp)
  geoVerifiedCount: number;
  geoFailedCount: number;
  geoNoDataCount: number;
  timestampVerifiedCount: number;
  timestampFailedCount: number;
  timestampNoDataCount: number;
  duplicatesDetected: number;
  averageQualityScore: number;     // 0-100
  coverageResult: PhotoCoverageResult;
  issues: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    photoIds?: string[];
  }[];
}
```

#### 7E.1 — PhotoGallery Component Design

```
┌─────────────────────────────────────────────────────────┐
│  📸 Inspection Photos (23)              [↑ Upload] [⚙]  │
├─────────────────────────────────────────────────────────┤
│  [All (23)] [Exterior (8)] [Interior (12)] [Other (3)]  │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │          │
│  │      │ │      │ │      │ │      │ │      │          │
│  │thumb │ │thumb │ │thumb │ │thumb │ │thumb │          │
│  ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤          │
│  │Ext.F │ │Ext.R │ │Street│ │Kitch.│ │Bath  │          │
│  │✅ GPS │ │✅ GPS │ │⚠️ Res│ │✅ OK  │ │✅ OK  │          │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│  │  ⬆ Drag & drop photos here or click to browse   │    │
│  │    JPEG, PNG, HEIC • Max 10MB • Min 1920×1080   │    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
└─────────────────────────────────────────────────────────┘
```

#### 7E.4 — Inspection Photo Map Wireframe

```
┌─────────────────────────────────────────────────────────┐
│  🗺️ Photo Locations          [Satellite] [Street] [🔲]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌─────────────────────────────────────────────┐      │
│    │              Map View                       │      │
│    │                                             │      │
│    │     🔵 Ext.F          🏠 Property           │      │
│    │              🔵 Ext.R                        │      │
│    │    🔵 Street     ╌╌╌╌╌╌╌╌╌╌ 500m radius     │      │
│    │                 ╌    🟢 Int.  ╌              │      │
│    │                 ╌    🟢 Int.  ╌              │      │
│    │                 ╌    🔴 Dmg.  ╌              │      │
│    │                  ╌╌╌╌╌╌╌╌╌╌╌╌               │      │
│    └─────────────────────────────────────────────┘      │
│                                                         │
│  Legend: 🔵 Exterior  🟢 Interior  🔴 Damage  🟡 Amenity │
│  Coverage: 85% of property area photographed            │
│  ⚠️ No photos from east side of property                 │
└─────────────────────────────────────────────────────────┘
```

#### 7E.6 — Photo QC Panel Wireframe

```
┌────────────────────────────────┐
│  📸 Photo QC    Grade: B+ (82) │
├────────────────────────────────┤
│  23 of 25 min. photos          │
│  ████████████████████░░ 92%    │
├────────────────────────────────┤
│  Category Coverage:            │
│  ✅ Front Exterior (3)          │
│  ✅ Rear Exterior (2)           │
│  ✅ Street Scene (1)            │
│  ✅ Kitchen (2)                 │
│  ⚠️ Bathrooms (1 of 2 req.)    │
│  ❌ Basement (0 — required)     │
│  ✅ Living Room (3)             │
│  ✅ Bedrooms (4)                │
├────────────────────────────────┤
│  Verification:                 │
│  📍 GPS: 21/23 verified        │
│  🕐 Time: 23/23 same day       │
│  📐 Res: 22/23 ≥ 1920×1080    │
│  🔁 Dupes: 1 suspected pair    │
├────────────────────────────────┤
│  Issues:                       │
│  ⚠️ Photo #7: 1280×720 (low)   │
│  ⚠️ Photo #12 & #15: 94% match │
│  ❌ Missing: basement photos    │
├────────────────────────────────┤
│  [📩 Request Additional Photos] │
│  [📋 View Full Quality Report]  │
└────────────────────────────────┘
```

#### 7E.7 — Photo Report Builder Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  📄 Photo Addendum Builder                    [Preview] [📥] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Layout: [2-up ▼]   Watermark: [✓ DRAFT]   Order: [USPAP ▼] │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  Page 1 of 4      │
│  │                 │  │                 │                    │
│  │  Front Exterior │  │  Rear Exterior  │                    │
│  │                 │  │                 │                    │
│  │  [DRAFT]        │  │  [DRAFT]        │                    │
│  ├─────────────────┤  ├─────────────────┤                    │
│  │ Front view of   │  │ Rear view of    │                    │
│  │ subject property│  │ subject property│                    │
│  └─────────────────┘  └─────────────────┘                    │
│                                                              │
│  Available Photos (drag to add):                             │
│  [📷][📷][📷][📷][📷][📷][📷][📷][📷][📷]...                    │
│                                                              │
│  [Save Template] [Export PDF] [Export to Report Package]     │
└──────────────────────────────────────────────────────────────┘
```

---

## Current Status & Next Steps

> Updated: February 20, 2026 — Plan updated with Axiom submission, monitoring, and delivery phases

### Completed
- ✅ **Phase 0** — All 6 foundation issues resolved (0.1–0.6)
- ✅ **Phase 1** — Order Intake complete (wizard, validation, cancel/search/batch)
- ✅ **Phase 3** — Order Lifecycle & Events complete (timeline API/UI, SLA monitoring, overdue detection)
- ✅ **Phase 4** — Notifications & Real-time complete (in-app API, bell/panel, orchestrator, preferences UI, Web PubSub)
- ✅ **Communication controller** — `@ts-nocheck` removed, type mismatches fixed, all endpoints properly typed
- ✅ **Infrastructure** — Service Bus + Web PubSub Bicep with Managed Identity RBAC
- ✅ **Axiom mock responses** — 8 evaluation criteria with realistic property/comp data
- ✅ **Payment provider abstraction** — PaymentProvider interface + MockProvider + StripeProvider (SDK code ready, 3-step activation)
- ✅ **Document management** — Upload, list, download, preview working end-to-end. DocumentPanel wired in OrderDetailPage + OrderTabs. Category normalisation fixed. SHA-256 content hashing on upload.

### Mostly Complete (1 task remaining)
- ⚠️ **Phase 2** — Assignment & Acceptance: **5 of 6 done**. Remaining: **2.4** (unify acceptance flows — two parallel paths still exist)

### In Progress — Phase 5 (QC Review) — Needs Significant Work
| Task | Status | Blocker |
|------|--------|---------|
| 5.1 Auto-route to QC | ✅ Done | — |
| 5.2 Axiom → QC bridge | ⚠️ Partial | Execution engine never reads stored Axiom data |
| 5.3 QC assignment dialog | ✅ Done | — |
| 5.4 PDF highlighting | ✅ Done | — |
| 5.5 QC rules persistence | ❌ Not done | Zero backend CRUD — entire feature is local-state mocks |
| 5.6 Return to queue | ✅ Done | — |
| 5.7 Final review decision | ✅ Done | — |
| 5.8 Reconsideration routing | ⚠️ Partial | Basic rejection→revision exists; no dedicated reconsideration flow |
| 5.9 Real QC dashboard | ✅ Done | — |

**Phase 5 Remaining Work:** Task 5.5 (QC rules persistence) has zero backend implementation. Task 5.2 (Axiom→QC bridge) needs execution engine to read stored Axiom data. Task 5.8 (reconsideration routing) needs a dedicated flow.

### Not Started
- ❌ **Phase 6** — Polish & Production Readiness: 6.1 (appraiser auth), 6.2 (dead code cleanup), 6.3 (real scoring). Only 6.4 (vendor rejection dialog) is done.
- ⬜ **Phase 7** — Photo Intelligence & Image Processing (59 tasks, ~44 days)
- ⬜ **Phase 8** — Axiom Submission & Progress Monitoring (NEW — see below)
- ⬜ **Phase 9** — Final Report Assembly & Delivery (NEW — see below)

---

## Phase 8: Axiom Document Submission & Progress Monitoring (Steps 8, 11)
> Submit appraisal documents to Axiom for AI analysis and monitor processing

### What Already Exists

| Layer | Component | Status | Detail |
|---|---|---|---|
| Backend | `AxiomService` (688 lines) | ✅ Service exists | `notifyDocumentUpload()`, `getEvaluation()`, `getEvaluationById()`, `handleWebhook()`, `compareDocuments()`. Mock mode when `AXIOM_API_BASE_URL` unset. Stores results in Cosmos `aiInsights` container. |
| Backend | `AxiomController` (391 lines) | ✅ Controller exists | Routes: `GET /api/axiom/status`, `POST /api/axiom/documents`, `GET /api/axiom/evaluations/order/:orderId`, `GET /api/axiom/evaluations/:evaluationId`, `POST /api/axiom/webhook`, `POST /api/axiom/documents/compare`. |
| Backend | Axiom router | ✅ Mounted | `createAxiomRouter()` exported and mounted in api-server. |
| Frontend | `axiomApi.ts` (255 lines) | ✅ RTK Query exists | `useAnalyzeDocumentMutation`, `useGetAxiomEvaluationQuery` (with 2s polling), `useGetOrderEvaluationsQuery`, `useCompareDocumentsMutation`, etc. |
| Frontend | `axiom.types.ts` (599 lines) | ✅ Types exist | Full Axiom types: evaluation, criteria, comparison, enrichment, complexity scoring. |
| Frontend | `axiom.service.ts` (frontend) | ✅ Client exists | Direct Axiom API client (bypasses backend — for future direct-connect use cases). |

### What's Missing

| # | Task | Effort | Priority | Detail |
|---|------|--------|----------|--------|
| 8.1 | **"Submit to Axiom" button in DocumentPanel** | 1 day | 🔴 Critical | When a document is uploaded (category = appraisal-report), show a "Submit for AI Analysis" action button. Clicking it calls `useAnalyzeDocumentMutation` with the document's blob URL + orderId. Button state: idle → submitting → submitted (with evaluationId). |
| 8.2 | **Auto-submit on upload (configurable)** | 0.5 day | 🟡 High | Option to auto-call Axiom when an `appraisal-report` document is uploaded. Backend: after successful upload in `document.controller.ts`, if category is appraisal-report, call `axiomService.notifyDocumentUpload()`. Store returned `evaluationId` on the document's Cosmos record. |
| 8.3 | **Axiom processing status indicator on document** | 1 day | 🔴 Critical | In `DocumentListItem`, show a badge/chip for Axiom status: `⏳ Processing`, `✅ Analysis Complete`, `❌ Analysis Failed`, `—` (not submitted). Fetch from `evaluationId` stored on document or from `GET /api/axiom/evaluations/order/:orderId`. |
| 8.4 | **Axiom progress panel in Order Detail** | 1.5 days | 🔴 Critical | New sub-section or card in the Order Detail page (or a collapsible panel in the Documents tab) showing: current Axiom evaluation status, processing start time, estimated completion, criteria evaluated count, overall risk score (when complete). Uses `useGetOrderEvaluationsQuery(orderId)` with polling. |
| 8.5 | **Progress polling / WebSocket push** | 0.5 day | 🟡 High | The RTK Query hook already polls every 2s while status is `processing`. Enhance: when webhook fires (`POST /api/axiom/webhook`), push a Web PubSub notification so frontend can instantly refetch instead of waiting for next poll. Wire into existing `NotificationOrchestrator`. |
| 8.6 | **Mock Axiom flow for development** | 1 day | 🟡 High | When Axiom is not configured (`AXIOM_API_BASE_URL` unset), the mock currently returns instant results. Enhance: simulate realistic async flow — `notifyDocumentUpload` returns evaluationId, status stays `processing` for 5-10 seconds (configurable via `AXIOM_MOCK_DELAY_MS`), then transitions to `completed` with full mock criteria. This lets us test the progress UI without Axiom. |
| 8.7 | **Axiom submission from QC routing** | 0.5 day | 🟡 High | When order transitions to `SUBMITTED` (Step 8), auto-submit the primary appraisal document to Axiom if not already submitted. Wire into the existing `auto-route to QC` logic in the order controller (Phase 5.1). |
| 8.8 | **Axiom results summary in QC queue** | 0.5 day | 🟡 Medium | In the QC queue table, show a column for Axiom risk score and status (completed/pending/none). Helps reviewers prioritise high-risk orders. |

#### Phase 8 Summary

| Category | Tasks | Estimated Effort |
|---|---|---|
| Frontend — submit UI | 8.1 | 1 day |
| Backend — auto-submit | 8.2, 8.7 | 1 day |
| Frontend — progress/monitoring | 8.3, 8.4 | 2.5 days |
| Real-time + mock | 8.5, 8.6 | 1.5 days |
| QC integration | 8.8 | 0.5 day |
| **TOTAL** | **8 tasks** | **~6.5 days** |

**Recommended execution order:**
1. **8.6** (mock async flow) — get testable feedback loop without real Axiom
2. **8.1** (submit button) → **8.2** (auto-submit on upload) → **8.7** (auto-submit on QC routing)
3. **8.3** (status badge) → **8.4** (progress panel)
4. **8.5** (WebSocket push) → **8.8** (QC queue column)

---

## Phase 9: Final Report Assembly & Client Delivery (Step 12 → Post-QC)
> Assemble approved documents into a delivery package and deliver to client/lender

### What Already Exists

| Layer | Component | Status | Detail |
|---|---|---|---|
| Backend | `DeliveryWorkflowService` (540+ lines) | ✅ Service exists | `uploadDocument()`, `getOrderDocuments()`, `reviewDocument()`, `createDeliveryPackage()`, `acknowledgeDeliveryPackage()`, `createRevisionRequest()`, `resolveRevisionRequest()`, `getOrderDeliveryPackages()`, `completeOrderDelivery()`. Uses Cosmos `deliveryPackages` container. |
| Backend | `OrderController.deliverOrder()` | ✅ Endpoint exists | `POST /api/orders/:orderId/deliver` — validates status transition → DELIVERED, records reportUrl + deliveryNotes, fires audit event. |
| Backend | `DeliveryPackage` type | ✅ Type exists | In `order-progress.types.ts` — id, orderId, tenantId, documents[], status, createdAt, deliveredAt, acknowledgedAt, notes. |
| Frontend | `DeliveryPackage/index.tsx` (153 lines) | ⚠️ Exists but basic | Shows completion status card + DocumentPanel (read-only when completed). Has "Download Complete Package" button (TODO stub). Has TS error: `readOnly` prop not on `DocumentPanelProps`. |
| Frontend | RTK Query | ⚠️ Partial | `useDeliverOrderMutation` likely exists via order API, but no dedicated delivery package endpoints (create, list, acknowledge). |

### What's Missing

| # | Task | Effort | Priority | Detail |
|---|------|--------|----------|--------|
| 9.1 | **Delivery workflow controller** | 1 day | 🔴 Critical | Create `delivery.controller.ts` exposing the existing `DeliveryWorkflowService` methods as REST endpoints: `POST /api/delivery/:orderId/package` (create package), `GET /api/delivery/:orderId/packages` (list), `POST /api/delivery/:orderId/package/:packageId/deliver` (mark delivered), `POST /api/delivery/:orderId/package/:packageId/acknowledge` (client ack). Wire into api-server. |
| 9.2 | **Document selection for delivery** | 1.5 days | 🔴 Critical | In the DeliveryPackage tab, add UI to select which approved documents to include in the delivery package. Checkbox list of all order documents with category, name, QC status. Only `APPROVED` documents can be selected. "Create Delivery Package" button calls the create endpoint. |
| 9.3 | **Delivery package assembly** | 1.5 days | 🔴 Critical | Backend: when creating a delivery package, copy selected document blobs into a dedicated `delivery-packages/{orderId}/{packageId}/` path in Blob Storage. Generate a manifest JSON with document list, order metadata, timestamps. Optionally generate a cover sheet PDF (order summary, property address, appraisal value, QC pass date). |
| 9.4 | **Bulk download (ZIP)** | 1 day | 🟡 High | Endpoint: `GET /api/delivery/:orderId/package/:packageId/download` — streams a ZIP file containing all documents in the package + manifest. Frontend: wire into the "Download Complete Package" button (currently a TODO stub). Use `archiver` npm package for ZIP creation. |
| 9.5 | **Delivery status tracking** | 0.5 day | 🟡 High | Track delivery package lifecycle: `DRAFT` → `ASSEMBLED` → `DELIVERED` → `ACKNOWLEDGED`. Show timeline in DeliveryPackage tab. Update order status to DELIVERED when package is delivered. |
| 9.6 | **Client delivery notification** | 0.5 day | 🟡 High | When package is marked delivered, trigger notification via `NotificationOrchestrator`: email to client with download link, in-app notification to order stakeholders, audit trail entry. |
| 9.7 | **Delivery RTK Query endpoints** | 0.5 day | 🔴 Critical | Create `deliveryApi.ts` with RTK Query endpoints mirroring 9.1 controller routes. Tags: `DeliveryPackage`. Hooks: `useCreateDeliveryPackageMutation`, `useGetDeliveryPackagesQuery`, `useDeliverPackageMutation`, `useAcknowledgePackageMutation`, `useDownloadPackageQuery`. |
| 9.8 | **Enhanced DeliveryPackage tab** | 1.5 days | 🔴 Critical | Rewrite `DeliveryPackage/index.tsx`: fix TS error (remove `readOnly` prop or add to DocumentPanelProps), show delivery package history (list of past packages with status), show current package assembly UI (if QC approved), delivery tracking timeline, download buttons per package. |
| 9.9 | **Delivery confirmation / client acknowledgement** | 0.5 day | 🟡 Medium | UI for client to acknowledge receipt (could be a simple link in the delivery email that hits the acknowledge endpoint). Show acknowledgement status in the delivery tab. |

#### Phase 9 Summary

| Category | Tasks | Estimated Effort |
|---|---|---|
| Backend — controller + routes | 9.1 | 1 day |
| Backend — assembly + ZIP | 9.3, 9.4 | 2.5 days |
| Frontend — RTK Query | 9.7 | 0.5 day |
| Frontend — document selection | 9.2 | 1.5 days |
| Frontend — delivery tab rewrite | 9.8 | 1.5 days |
| Lifecycle + notifications | 9.5, 9.6, 9.9 | 1.5 days |
| **TOTAL** | **9 tasks** | **~8.5 days** |

**Recommended execution order:**
1. **9.1** (controller) → **9.7** (RTK Query) — get the API layer in place
2. **9.2** (document selection UI) → **9.3** (assembly backend) — core flow
3. **9.8** (rewrite delivery tab) — integrate everything
4. **9.4** (ZIP download) → **9.5** (status tracking) → **9.6** (notification) → **9.9** (acknowledgement)

---

## Recommended Next Steps (in priority order)

> Last analyzed: February 20, 2026

| Priority | Task | Phase | Effort | Rationale |
|---|---|---|---|---|
| 1 | **Mock async Axiom flow** | 8.6 | 1 day | Enables testing all Axiom UI without real Axiom service |
| 2 | **"Submit to Axiom" button** | 8.1 | 1 day | Core Axiom user-facing action |
| 3 | **Auto-submit on upload/QC routing** | 8.2 + 8.7 | 1 day | Automates the submission step |
| 4 | **Axiom status badge on documents** | 8.3 | 1 day | Users can see processing state |
| 5 | **Axiom progress panel** | 8.4 | 1.5 days | Full monitoring dashboard |
| 6 | **Delivery controller + RTK Query** | 9.1 + 9.7 | 1.5 days | API foundation for delivery |
| 7 | **Document selection + assembly** | 9.2 + 9.3 | 3 days | Core delivery flow |
| 8 | **Enhanced delivery tab** | 9.8 | 1.5 days | Integrate into UI |
| 9 | **ZIP download** | 9.4 | 1 day | "Download Package" button works |
| 10 | **Axiom → QC bridge** | 5.2 | 2 days | Axiom results feed into QC checklist |
| 11 | **WebSocket push for Axiom** | 8.5 | 0.5 day | Real-time status updates |
| 12 | **Delivery notifications + ack** | 9.5 + 9.6 + 9.9 | 1.5 days | Complete delivery lifecycle |
| 13 | **QC rules persistence** | 5.5 | 1.5 days | Backend CRUD for QC rules |
| 14 | **Reconsideration routing** | 5.8 | 1.5 days | Dedicated revision flow |
| 15 | **Phase 6 polish** | 6.1–6.3 | 3 days | Auth, dead code, real scoring |
| 16 | **Phase 7 — Photo Intelligence** | 7.* | ~44 days | Advanced photo processing |

**Estimated total for Phases 8+9: ~15 days**

### Uncommitted Work
- **Backend (`master`):** `package.json` + `pnpm-lock.yaml` — `stripe` SDK added. Document category normalisation in `document.controller.ts`. SHA-256 content hashing in `document.service.ts`.
- **Frontend (`feature/revision-management`):** ALL Phase 4+5 UI files (NotificationBell, useNotificationSocket, NotificationPreferencesPage, QC workflow pages, RTK Query slices, navigation config). OrderDetailPage Documents tab fix. DocumentUploadZone onDrop fix. **NEVER committed or pushed.**
