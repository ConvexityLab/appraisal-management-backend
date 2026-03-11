# Report Generation Platform: Master Plan

> Phase 7 (URAR AcroForm baseline): ✅ COMPLETE — February 22, 2026
> Phase 8 (Multi-Report-Type Engine): 🔴 NOT STARTED — March 11, 2026
> Repos: `appraisal-management-backend` · `l1-valuation-platform-ui`

---

## THIS DOCUMENT SUPERSEDES THE ORIGINAL PHASE 7 PLAN

Phase 7 delivered a working but minimal proof-of-concept: AcroForm field-fill for a synthetic URAR placeholder PDF.
Phase 8 evolves that foundation into a **production-grade, multi-report-type generation platform** capable of producing:

| Form | Name | Render Strategy |
|---|---|---|
| DVR | Desktop Valuation Review (BPO-style) | HTML → PDF (Handlebars + Chromium) |
| URAR / Form 1004 | Uniform Residential Appraisal Report | AcroForm fill (real FNMA template) with photo addenda |
| Form 2055 | Exterior-Only Inspection Residential Appraisal | AcroForm fill |
| Form 1004D | Appraisal Update and/or Completion | AcroForm fill |
| Form 1073 | Individual Condo Appraisal | AcroForm fill |
| Form 1025 | Small Residential Income Property Appraisal | AcroForm fill |
| Letter Review | Narrative review letter | HTML → PDF |
| Custom Addenda | Photo, Market Conditions, Location Map | jsPDF (frontend-generated, appended) |

---

## ─── PART A: WHAT WE ALREADY HAVE ───────────────────────────────────────────

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Existing Assets to Reuse](#3-existing-assets-to-reuse)
4. [New Files Inventory](#4-new-files-inventory)
5. [Implementation Increments](#5-implementation-increments)
6. [Todo Checklist](#6-todo-checklist)
7. [Key Constraints](#7-key-constraints)
8. [Data Flow Diagram](#8-data-flow-diagram)
9. [Event Chain Detail](#9-event-chain-detail)
10. [UI Panel Spec](#10-ui-panel-spec)

---

## 1. Feature Overview

The Final Report Generation pipeline allows AMC staff (or an automated trigger) to:

1. Select a fillable PDF template from the report template library (stored in Azure Blob Storage, `pdf-report-templates` container)
2. Auto-merge data from three sources:
   - The **Appraisal Order** (property address, client, borrower, order dates, fees, etc.)
   - The **QC Review results** (outcome, findings, reviewer comments, final appraised value)
   - **Reviewer Field Overrides** — specific field-level corrections made by the QC reviewer, each with an optional narrative comment explaining the change (human or AI-authored)
3. Fill the template PDF AcroForm fields using `pdf-lib`
4. Upload the completed PDF to Blob Storage under `orders/{orderId}/final-reports/{reportId}.pdf`
5. Save a `FinalReport` record in Cosmos DB (`final-reports` container)
6. Fire the post-generation event chain (notifications → email → conditional MISMO → conditional underwriting push)
7. Display the result in the **Reports** tab (tab index 4) of the Order Detail page with a download button

**Gate:** Generation is only allowed when the associated QC Review has status `APPROVED` or `APPROVED_WITH_CONDITIONS`.

---

## 2. Architecture Decisions

| Decision | Rationale |
|---|---|
| Reuse `fillPdf.js` pattern, ported to TypeScript | Already proven pipeline: download template PDF from Blob → fill AcroForm fields via `pdf-lib` → upload result. No new dependencies needed. |
| `FieldOverride[]` stored on `QCReview` | Keeps all reviewer work co-located in one document. Avoids a separate collection. |
| `ReviewerEdit` is a separate array on `QCReview` | Each edit has a `fieldOverrideId?` ref + full prose `narrativeComment` + `source: 'HUMAN' \| 'AI'`. Allows free-form narrative decoupled from field-level overrides. |
| QC status gate enforced in service layer | Not just UI-gated — `FinalReportService.generateReport()` throws `Error('QC review must be APPROVED...')` if status check fails. |
| Post-generation events are best-effort | All three event steps (notification, MISMO, underwriting) are wrapped in independent `try/catch`. Report success is never blocked by notification failure. |
| MISMO + underwriting push off by default | Controlled by env vars `ENABLE_MISMO_ON_DELIVERY` and `ENABLE_UNDERWRITING_PUSH`. Default = off. Matches existing `ENABLE_*` feature flag pattern in `app-service-config.bicep`. |
| Routes mounted at `/api/final-reports` | Separate from `/api/reports` (which handles property valuation reports/comps). Clear namespace separation. |
| `api-server.ts` is the mount point | All routers mounted in `AppraisalManagementAPIServer.setupRoutes()` — same pattern as all other controllers. |
| No `createIfNotExists` anywhere | `final-reports` Cosmos container and `pdf-report-templates` Blob container are assumed pre-existing. Service throws with a clear message if containers are missing. |

---

## 3. Existing Assets to Reuse

| Asset | Location | How used |
|---|---|---|
| `fillPdf.js` | `src/functions/utils/fillReport/fillPdf.js` | Port its PDF fill + Blob upload logic to TypeScript in `FinalReportService` |
| `pdf-lib` | Already in package.json | AcroForm field filling |
| `BlobServiceClient` | `@azure/storage-blob` | Download template + upload result (DefaultAzureCredential) |
| `CosmosDbService` | `src/services/cosmos-db.service.ts` | `getContainer('final-reports')`, `getContainer('orders')`, `getContainer('qc-reviews')` |
| `MismoXmlGenerator` | `src/services/mismo-xml-generator.service.ts` | Called conditionally on `ENABLE_MISMO_ON_DELIVERY=true` |
| `NotificationService` | `src/services/notification.service.ts` | `sendEmail()` for milestone notification |
| `TemplateCategory.APPRAISAL_REPORT` | `src/types/template.types.ts` | Enum value for template metadata |
| `AppraisalFormType` enum | `src/types/template.types.ts` | Maps order `productType` → template form type |
| Unified auth middleware | `src/middleware/unified-auth.middleware.ts` | `this.unifiedAuth.authenticate()` on all routes |
| `createReportsRouter` mount pattern | `src/api/api-server.ts` lines 506-509 | Template for mounting `createFinalReportsRouter` |
| `DeliveryPanel` | `src/components/delivery/DeliveryPanel.tsx` | Reference for UI panel structure in order detail |
| Tab index 4 = "Reports" | `src/app/(control-panel)/orders/[id]/page.tsx` line 393 | Where `FinalReportPanel` is wired in |

---

## 4. New Files Inventory

### Backend (`appraisal-management-backend`)

| File | Type | Description |
|---|---|---|
| `src/types/final-report.types.ts` | NEW | All new type definitions |
| `src/services/final-report.service.ts` | NEW | Core generation pipeline (9 steps) |
| `src/controllers/final-reports.controller.ts` | NEW | 4 REST endpoints |
| `src/types/qc-workflow.ts` | MODIFY | Add `fieldOverrides?`, `reviewerEdits?` to `QCReview` |
| `src/types/index.ts` | MODIFY | Add `finalReportId?`, `finalReportStatus?` to `AppraisalOrder` |
| `src/controllers/qc-workflow.controller.ts` | MODIFY | Add `POST /:reviewId/field-overrides` route |
| `src/api/api-server.ts` | MODIFY | Import + mount `createFinalReportsRouter` at `/api/final-reports` |

### Frontend (`l1-valuation-platform-ui`)

| File | Type | Description |
|---|---|---|
| `src/types/backend/final-report.types.ts` | NEW | Mirror of backend types |
| `src/store/api/finalReportApi.ts` | NEW | RTK Query slice (3 endpoints) |
| `src/components/orders/FinalReportPanel.tsx` | NEW | Full UI panel component |
| `src/types/backend/order-management.types.ts` | MODIFY | Add `finalReportId?`, `finalReportStatus?` to `AppraisalOrder` |
| `src/store/api/index.ts` | MODIFY | Export 4 new hooks |
| `src/app/(control-panel)/orders/[id]/page.tsx` | MODIFY | Wire `FinalReportPanel` into Reports tab (selectedTab === 4) |

**Total: 7 new files, 6 modified files**

---

## 5. Implementation Increments

### Increment 1 — Types only (no behavior, no routes)
Goal: All type definitions in place, both repos compile clean.

### Increment 2 — Backend service + endpoints
Goal: REST API fully functional and testable via curl/Postman.

### Increment 3 — Frontend API wiring
Goal: RTK Query hooks available, can be imported.

### Increment 4 — UI
Goal: Reports tab shows full `FinalReportPanel` with all sections.

### Increment 5 — Final verification
Goal: Both repos `tsc --noEmit` → exit 0 simultaneously.

---

## 6. Todo Checklist

### Increment 1 — Types

- [x] **1a** `backend/src/types/final-report.types.ts` — create with all type definitions ✅
  - `FinalReportStatus` enum: `PENDING | GENERATING | GENERATED | FAILED`
  - `FieldOverride` interface: `fieldKey, originalValue, overrideValue, overriddenBy, overriddenAt, narrativeComment?, source: 'HUMAN' | 'AI'`
  - `ReviewerEdit` interface: `id, reviewId, fieldOverrideId?, section, narrativeComment, source, createdBy, createdAt`
  - `FinalReport` interface: `id, tenantId, orderId, qcReviewId, templateId, templateName, formType, status: FinalReportStatus, blobPath, blobUrl, fieldOverrides: FieldOverride[], reviewerEdits: ReviewerEdit[], generatedBy, generatedAt?, failureReason?, mismoQueued: boolean, underwritingQueued: boolean, createdAt, updatedAt`
  - `FinalReportGenerationRequest` interface: `orderId, templateId, requestedBy, notes?`
  - `ReportTemplate` interface: `id, name, formType, blobName, description?, isActive: boolean`

- [x] **1b** Patch `backend/src/types/qc-workflow.ts` ✅
  - Added `fieldOverrides?: FieldOverride[]` to `QCReview`
  - Added `reviewerEdits?: ReviewerEdit[]` to `QCReview`
  - Import `FieldOverride, ReviewerEdit` from `./final-report.types.js`

- [x] **1c** Patch `backend/src/types/index.ts` ✅
  - Added `finalReportId?: string` to `AppraisalOrder`
  - Added `finalReportStatus?: FinalReportStatus` to `AppraisalOrder`
  - Import `FinalReportStatus` from `./final-report.types.js`

- [x] **1d** `frontend/src/types/backend/final-report.types.ts` — create mirror types ✅
  - Mirror all interfaces from backend (no `.js` imports, use plain TypeScript)
  - Patched `frontend/src/types/backend/order-management.types.ts` to add `finalReportId?` and `finalReportStatus?` to `AppraisalOrder`

- [x] **1e** ✅ GATE: `npx tsc --noEmit` in both repos → both exit 0 ✅

---

### Increment 2 — Backend service + endpoints

- [x] **2a** `backend/src/services/final-report.service.ts` ✅
  - `constructor()`: injects `CosmosDbService`, `NotificationService`, `BlobStorageService` (pre-existing, DefaultAzureCredential), `Logger`
  - `generateReport(req: FinalReportGenerationRequest): Promise<FinalReport>` — 9-step pipeline
    1. Load order from Cosmos → throw if not found
    2. QC gate → throw if status ≠ APPROVED | APPROVED_WITH_CONDITIONS
    3. Load template metadata → throw if templateId not found
    4. Assemble field map: order fields + QC results + fieldOverrides (overrides win)
    5. Download template PDF from Blob `pdf-report-templates/{blobName}`
    6. Fill AcroForm fields via `pdf-lib` (PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup)
    7. Upload filled PDF to Blob `orders/{orderId}/final-reports/{reportId}.pdf`
    8. Save FinalReport Cosmos record + patch order `finalReportId`/`finalReportStatus`
    9. `_firePostGenerationEvents()` — non-blocking via `void`
  - `getReport()`, `listTemplates()`, `addFieldOverride()` all implemented
  - **Note**: Reused pre-existing `BlobStorageService` instead of raw `BlobServiceClient`
  - **Note**: `pdf-lib ^1.17.1` installed (`pnpm add pdf-lib`)

- [x] **2b** `backend/src/controllers/final-reports.controller.ts` ✅
  - `GET  /templates` → `listTemplates()` → 200
  - `GET  /orders/:orderId` → `getReport(orderId)` → 200 or 404
  - `POST /orders/:orderId/generate` → `generateReport()` → 200 / 422 / 500
  - `GET  /orders/:orderId/download` → streams PDF as `application/pdf`
  - `POST /:reviewId/field-overrides` added to `qc-workflow.controller.ts` ✅
  - Mounted in `api-server.ts`: `/api/final-reports` behind `unifiedAuth.authenticate()` ✅

- [x] **2c** Post-generation event chain in `_firePostGenerationEvents()` ✅
  - **Block 1**: `NotificationService.sendEmail()` — always attempted, never re-throws
  - **Block 2**: `ENABLE_MISMO_ON_DELIVERY === 'true'` → logs + sets `mismoQueued = true` (MismoXmlGenerator wiring deferred)
  - **Block 3**: `ENABLE_UNDERWRITING_PUSH === 'true'` → logs + sets `underwritingQueued = true` (stub only)
  - Env var `FINAL_REPORT_NOTIFICATION_EMAILS` controls email recipients

- [x] **2d** ✅ GATE: `npx tsc --noEmit` in `appraisal-management-backend` → Exit 0 ✅

---

### Increment 3 — Frontend API wiring

- [x] **3a** `frontend/src/store/api/finalReportApi.ts` ✅
  - Endpoints: `listReportTemplates`, `getOrderReport`, `generateReport`, `addFieldOverride`
  - 404 on `getOrderReport` → returns `null` (not an error)
  - `generateReport` invalidates `FinalReports` + `Orders` tags
  - Tag `FinalReports` added to `baseApi.ts` tagTypes
  - **Note**: `QCReview` frontend type found in `qc-review-unified.types.ts` (not `qc-workflow.types.ts`)
  - **Note**: `addFieldOverride` placed here (routes to `/api/qc-workflow/:reviewId/field-overrides`)

- [x] **3b** Field override mutation ✅
  - `addFieldOverride({ reviewId, override })` → `POST /api/qc-workflow/${reviewId}/field-overrides`
  - `invalidatesTags: [{ type: 'QCReview', id: reviewId }]`
  - Included in `finalReportApi.ts`

- [x] **3c** `frontend/src/store/api/index.ts` ✅
  - Exported: `useListReportTemplatesQuery`, `useGetOrderReportQuery`, `useGenerateReportMutation`, `useAddFieldOverrideMutation`

---

### Increment 4 — UI

- [x] **4a** `frontend/src/components/delivery/FinalReportPanel.tsx` ✅
  - **Location note**: placed in `delivery/` folder (alongside `DeliveryPanel.tsx`) rather than `orders/` — better colocation
  - **Original plan spec:**

  **Props:** `{ orderId: string; qcReviewId?: string; qcStatus?: string }`

  **Section A — QC Gate**
  - If `qcStatus` is not `'APPROVED'` or `'APPROVED_WITH_CONDITIONS'`:
    - Show `<Alert severity="warning">QC review must be Approved before generating the final report. Current status: {qcStatus ?? 'Not reviewed'}</Alert>`
    - Generate button is disabled (not hidden)

  **Section B — Template Picker**
  - Call `useGetReportTemplatesQuery()`
  - If loading: `<CircularProgress size={20} />`
  - If empty: `<Alert severity="info">No report templates available. Upload fillable PDF templates to the pdf-report-templates Blob container.</Alert>`
  - Otherwise: `<Select>` pre-selected to the template whose `formType` matches `order.productType` (if found); user can change selection

  **Section C — Field Overrides**
  - Call `useGetFinalReportQuery(orderId)` to get existing overrides
  - `<Table>` with columns: Field Key | Original Value | Override Value | Source | By | When | Narrative
  - `<Button startIcon={<AddIcon />}>Add Override</Button>` opens Dialog:
    - Fields: Field Key (text), Original Value (text), Override Value (text), Narrative Comment (multiline), Source (Select: Human / AI)
    - Calls `useAddFieldOverrideMutation()`
    - Shows Snackbar on success/failure

  **Section D — Generate Button + Result**
  - `<Button variant="contained" disabled={!selectedTemplate || isQCGated || isGenerating} onClick={handleGenerate}>`
  - While `status === 'GENERATING'`: show `<LinearProgress />` + "Generating final report…"
  - When `status === 'GENERATED'`:
    - Download button: `<a href="/api/final-reports/orders/{orderId}/download" download>Download Final Report PDF</a>`
    - Chips: Generated timestamp | Template name
    - Event chain status chips: `Notification Sent` (green) | `MISMO Queued` (blue/grey) | `Underwriting Push Queued` (blue/grey)

- [x] **4b** Wire into `orders/[id]/page.tsx` ✅
  - Import: `FinalReportPanel from '@/components/delivery/FinalReportPanel'`
  - Import: `PictureAsPdf as PdfIcon` added to MUI icons
  - Tab 4 (Reports): appended `<FinalReportPanel orderId={orderId} />` after existing QC score cards inside `<Box sx={{ mt: 4 }}>`
  - Tab label, icon, index unchanged

---

### Increment 5 — Final verification

- [x] **5** ✅ GATE: Both repos `npx tsc --noEmit` → both Exit 0 ✅

---

## 7. Key Constraints

| Constraint | Rule |
|---|---|
| No `createIfNotExists` | Cosmos containers (`final-reports`, `orders`, `qc-reviews`) and Blob containers (`pdf-report-templates`) must pre-exist. Throw with clear message if missing. |
| No silent defaults | Missing `templateId`, missing Blob, non-approved QC status → explicit thrown `Error` with actionable message |
| Post-events never block report success | All three event steps in `_firePostGenerationEvents` are independent try/catch. Report is already saved at this point. |
| `ENABLE_MISMO_ON_DELIVERY` default = off | Only fires if explicitly `=== 'true'`. No action otherwise. |
| `ENABLE_UNDERWRITING_PUSH` default = off | Only fires if explicitly `=== 'true'`. No action otherwise. |
| No `any` casts in new code | All new TypeScript must be fully typed. Existing `(order as any)` in page.tsx for `qcReviewId`/`qcStatus` is acceptable since those fields are not yet on the typed interface — document with `// TODO: add to AppraisalOrder type once confirmed` |
| Managed Identity for Blob | `BlobServiceClient` constructed with `DefaultAzureCredential`. No connection strings. |
| Auth on all new routes | All new routes gated with `this.unifiedAuth.authenticate()` |

---

## 8. Data Flow Diagram

```
[User clicks Generate in FinalReportPanel]
        |
        v
POST /api/final-reports/orders/:orderId/generate
        |
        v
FinalReportService.generateReport()
   |
   ├─ 1. Load Order (Cosmos: orders)
   |     └─ throw if not found
   |
   ├─ 2. Load QC Review (Cosmos: qc-reviews, filter by orderId)
   |     └─ throw if status ≠ APPROVED | APPROVED_WITH_CONDITIONS
   |
   ├─ 3. Load Template metadata (listTemplates → Blob listing)
   |     └─ throw if templateId not found
   |
   ├─ 4. Assemble field map
   |     ├─ order fields (address, client, borrower, dates, fees)
   |     ├─ QC results (outcome, appraised value, findings summary)
   |     └─ fieldOverrides[] → overrides win on conflict
   |
   ├─ 5. Download template PDF from Blob
   |     └─ pdf-report-templates/{blobName}
   |
   ├─ 6. Fill AcroForm fields (pdf-lib)
   |
   ├─ 7. Upload filled PDF to Blob
   |     └─ orders/{orderId}/final-reports/{reportId}.pdf
   |
   ├─ 8. Save FinalReport to Cosmos (final-reports)
   |     └─ Patch order.finalReportId + finalReportStatus = GENERATED
   |
   └─ 9. _firePostGenerationEvents() [best-effort]
         ├─ NotificationService.sendEmail()        [always attempted]
         ├─ MismoXmlGenerator (if ENABLE_MISMO)    [conditional]
         └─ Underwriting push stub (if ENABLE_UW)  [conditional]

[Return 202 + FinalReport record to UI]
        |
        v
[FinalReportPanel polls useGetFinalReportQuery]
        |
        v
[status === GENERATED → show download button + event chips]
```

---

## 9. Event Chain Detail

| Step | Trigger | Condition | On failure |
|---|---|---|---|
| In-app + email notification | Always after successful PDF save | None | Log warning, continue |
| MISMO XML generation | `ENABLE_MISMO_ON_DELIVERY === 'true'` | Feature flag | Log warning, continue |
| Underwriting push | `ENABLE_UNDERWRITING_PUSH === 'true'` | Feature flag | Log warning, continue |

Email recipients: order contacts (client contact email + assigned analyst) pulled from the order record. Uses existing `NotificationService.sendEmail()`.

---

## 10. UI Panel Spec

```
┌─────────────────────────────────────────────────────────────┐
│  Final Report Generation                                      │
│─────────────────────────────────────────────────────────────│
│  ⚠ QC Status Gate                                            │
│  [Alert: QC must be Approved before generating]              │
│  (only shown if qcStatus ≠ APPROVED/APPROVED_WITH_CONDITIONS)│
│─────────────────────────────────────────────────────────────│
│  Template                                                     │
│  [Form 1004 — Uniform Residential Appraisal Report    ▼]    │
│  (auto-selected from order.productType, user can override)   │
│  (Alert shown if no templates uploaded to Blob)              │
│─────────────────────────────────────────────────────────────│
│  Reviewer Field Overrides                    [+ Add Override]│
│  ┌──────────────┬────────┬──────────┬────────┬────────────┐ │
│  │ Field        │ Orig   │ Override │ By     │ Narrative  │ │
│  │ appraised... │ 450000 │ 445000   │ jsmith │ Comp 2...  │ │
│  └──────────────┴────────┴──────────┴────────┴────────────┘ │
│─────────────────────────────────────────────────────────────│
│  [Generate Final Report]  ← disabled if gate active or       │
│                              no template selected            │
│─────────────────────────────────────────────────────────────│
│  ✅ Generated — Feb 22, 2026 14:32                           │
│  Template: Form 1004 v2.1                                    │
│  [⬇ Download Final Report PDF]                              │
│                                                              │
│  Event Chain:                                                │
│  ● Notification Sent  ○ MISMO Skipped  ○ UW Push Skipped    │
└─────────────────────────────────────────────────────────────┘
```

---

## Progress Tracker

| # | Todo | Status | Notes |
|---|------|--------|-------|
| 1 | Inc 1a: Backend types — final-report.types.ts | ✅ Complete | `backend/src/types/final-report.types.ts` created |
| 2 | Inc 1b: Backend — patch QCReview type | ✅ Complete | `fieldOverrides[]` + `reviewerEdits[]` added to `QCReview` |
| 3 | Inc 1c: Backend — patch AppraisalOrder type | ✅ Complete | `finalReportId?` + `finalReportStatus?` added |
| 4 | Inc 1d: Frontend types — final-report.types.ts | ✅ Complete | `frontend/src/types/backend/final-report.types.ts` created; `order-management.types.ts` patched |
| 5 | Inc 1e: tsc gate — types only | ✅ Complete | Both repos Exit 0 |
| 6 | Inc 2a: FinalReportService | ✅ Complete | `backend/src/services/final-report.service.ts`; reused `BlobStorageService`; `pdf-lib ^1.17.1` installed |
| 7 | Inc 2b: FinalReportsController + mount | ✅ Complete | `backend/src/controllers/final-reports.controller.ts`; mounted at `/api/final-reports` in `api-server.ts` |
| 8 | Inc 2c: Post-generation event chain | ✅ Complete | 3 independent try/catch blocks; `FINAL_REPORT_NOTIFICATION_EMAILS` env var; MISMO + UW push are stubs |
| 9 | Inc 2d: Backend tsc gate | ✅ Complete | Exit 0 |
| 10 | Inc 3a: RTK Query — finalReportApi slice | ✅ Complete | `frontend/src/store/api/finalReportApi.ts`; 4 endpoints; `FinalReports` tag added to `baseApi.ts` |
| 11 | Inc 3b: RTK Query — field override mutation | ✅ Complete | `addFieldOverride` included in `finalReportApi.ts` |
| 12 | Inc 3c: Export hooks from store/api/index.ts | ✅ Complete | All 4 hooks exported from `store/api/index.ts` |
| 13 | Inc 4a: FinalReportPanel component | ✅ Complete | `frontend/src/components/delivery/FinalReportPanel.tsx` |
| 14 | Inc 4b: Wire into Reports tab | ✅ Complete | Wired into `orders/[id]/page.tsx` Tab 4 |
| 15 | Inc 5: Final tsc clean — both repos | ✅ Complete | Both repos Exit 0 |

_Update status: ⬜ Not started → 🔄 In progress → ✅ Complete → ❌ Blocked_

---

## 11. Implementation Notes (Actual vs Plan)

| Topic | Plan | Actual |
|-------|------|--------|
| Blob client | Raw `BlobServiceClient` (DefaultAzureCredential) | Reused pre-existing `BlobStorageService` — no raw client needed |
| PDF library | Port `fillPdf.js` pattern | Used `pdf-lib ^1.17.1` (TypeScript-native, handles AcroForm natively) |
| FinalReportPanel location | `components/orders/` | `components/delivery/` (colocation with `DeliveryPanel.tsx`) |
| Store wiring | Separate `createApi` + add to store.ts | Extended `baseApi` via `injectEndpoints` pattern (consistent with codebase) |
| `QCReview` frontend type | `qc-workflow.types.ts` | `qc-review-unified.types.ts` (actual location in codebase) |
| MISMO wiring | Full `MismoXmlGenerator` call | Logged + `mismoQueued = true` stub (full wiring deferred — generator exists but integration TBD) |
| Underwriting push | Stub only (planned) | Stub only — logs + `underwritingQueued = true` |
| `useUser()` hook | `user?.uid` | `(user as any)?.id` (hook returns `{ data: user }`) |


---

---

# PART B: PHASE 8 — MULTI-REPORT-TYPE ENGINE

> Status: NOT STARTED
> Updated: March 11, 2026

---

## B.1  What Is Wrong With the Phase 7 Baseline

Phase 7 delivered a working proof-of-concept with three critical deficiencies:

1. **Synthetic placeholder template** — the seed build creates a 14-field AcroForm stub. The real FNMA Form 1004 has ~200 fields across 6 pages. We are currently filling ~7% of the actual form.

2. **AcroForm-only strategy** — the DVR/BPO report (see Vision sample `docs/samples/VisionBPOReport.pdf`) is a richly designed multi-page document with subject photos, comp photos, color-coded grids, aerial maps, and branded headers. This CANNOT be produced by filling AcroForm fields. A different render strategy is required.

3. **No photo integration** — `photo.service.ts` and image-processing utilities already exist and store photos in Blob. The report pipeline never calls them. Every deliverable URAR and every DVR requires embedded photos.

4. **No background/auto generation** — every report requires a human to click "Generate" in the UI. The architecture to auto-trigger on QC approval does not exist.

5. **FinalReportPanel UI is incomplete** — the field override editor, section selector, inline preview, and generation history table were described in the Phase 7 spec but not fully built.

6. **MISMO XML is stubbed** — the post-generation flow logs "MISMO queued" but never actually generates or uploads the XML.

---

## B.2  Report Formats and Their Requirements

### B.2.1  DVR — Desktop Valuation Review (BPO-Style)

Render strategy: **HTML -> PDF** (Handlebars template + headless Chromium)

The Vision BPO sample establishes the section anatomy. Below is a field-by-field gap analysis.

**Cover / Subject Summary**

| Field | Source | Gap |
|---|---|---|
| Property address | order.propertyAddress | None |
| As-Is market value | qcReview.appraisedValue | None |
| As-Repaired value | order.arvDetails or arv.service.ts | ARV exists; needs routing to report |
| Subject photos (3-6) | photo.service.ts -> Blob orders/{id}/photos/ | Not wired into report generation |
| Aerial map image | google-maps-property-intelligence.service.ts | Not wired into report |
| Occupancy status | order.occupancyStatus | Present on order |
| Borrower / client / lender | order.borrowerInformation, order.contactInformation | None |
| Loan number | order.loanInformation.loanNumber | None |
| Condition rating (BPO scale: Excellent/Good/Fair/Poor) | Not in canonical schema | Must add DvrSubjectDetail type |
| Interior / Exterior rating | Not in canonical schema | BPO-specific; needs new sub-model |
| Repair cost estimate | arv.service.ts / construction-budget.service.ts | Exists for construction orders; needs bridge for DVR |

**Sold Comps Grid (up to 6) and Listing Comps Grid (up to 6)**

All core comp fields (address, price, date, GLA, beds, baths, condition, adjustments, adjusted sale price, distance, DOM) are fully modeled in CanonicalComp and CanonicalAdjustment. The only gap is comp photos — these are stored in Blob but not wired to the report.

**Neighborhood / Market Analysis**

CanonicalNeighborhood covers all required fields: supply/demand, DOM trend, price range, marketing time, land use percentages, and narrative text. Flood zone and zoning are on CanonicalSubject. Gap: 12-month median price trend is computed by qc-market-validation.service.ts but not mapped into CanonicalNeighborhood.

### B.2.2  URAR — Form 1004

Render strategy: **AcroForm fill** (real FNMA template PDF + custom photo addenda appended)

**The real FNMA Form 1004 must be downloaded from Fannie Mae's forms repository (free, public domain) and uploaded to the pdf-report-templates Blob container. The current seed-generated placeholder is not suitable for production delivery.**

Full field coverage gap analysis:

| URAR Section | Status |
|---|---|
| Subject (address, county, parcel, census tract, owner, occupant, legal description) | Canonical has all fields |
| Contract (price, date, concessions, personal property items) | CanonicalSubject.contractInfo has all fields |
| Neighborhood (location type, built-up, growth, prop values trend, demand/supply, marketing time, price range, land use %) | CanonicalNeighborhood has all fields |
| Site (lot size, shape, zoning, utilities, flood zone) | CanonicalSubject + CanonicalUtilities has all fields |
| Improvements (GLA, rooms, beds, baths, year, quality, condition, heating, cooling, garage, basement, features) | CanonicalPropertyCore has all fields |
| Sales Comparison Grid (6 comps x ~30 fields each) | CanonicalComp[] + CanonicalAdjustment[] has all fields |
| Reconciliation (final value, effective date, approaches used, narrative) | MISSING — CanonicalReconciliation sub-object must be added |
| Cost Approach (RCN, depreciation, land value) | Not modeled — optional section for 1004 |
| Income Approach (GRM, monthly rent) | Not modeled — optional section for 1004 |
| Appraiser certification (name, cert #, state, license expiry, signature date, company) | Not joined — appraiser profile in appraiser.service.ts but not pulled into report |
| Supervisory appraiser | Not tracked on order — must be added |

Photo addenda: FNMA requires subject photos (front, rear, street scene) and comparable photos (front of each comp). The existing _appendCustomPages() mechanism accepts base64 jsPDF pages from the frontend. The UI needs a Photo Addendum Builder component (see B.6.2).

### B.2.3  Other Forms (Future)

Form 2055 (Exterior-Only), Form 1004D (Update/Completion), Form 1073 (Condo), Form 1025 (Small Income Property), and narrative Letter Review will use the same engine with different mappers and templates. They are out of scope for Phase 8 but the architecture must accommodate them.

---

## B.3  Architecture: Report Engine Abstraction

The current FinalReportService directly executes one strategy. It must be refactored before adding new report types.

### B.3.1  New Service Structure

```
src/services/report-engine/
  report-engine.service.ts            <- orchestrator (replaces direct PDF logic)
  strategies/
    acroform-fill.strategy.ts         <- extracted from current FinalReportService
    html-render.strategy.ts           <- NEW: Handlebars + Chromium/pdfkit
  field-mappers/
    urar-1004.mapper.ts               <- NEW: full 200-field URAR mapping
    dvr-bpo.mapper.ts                 <- NEW: DVR field assembly
  template-registry/
    template-registry.service.ts     <- maps formType -> strategy + mapper
  photo-resolver.service.ts           <- NEW: fetches photo bytes for report assets
```

### B.3.2  Strategy Interface

```typescript
interface ReportRenderStrategy {
  render(
    fieldMap: Record<string, string | boolean | number>,
    template: ReportTemplate,
    assets: ReportAssets
  ): Promise<Uint8Array>;
}

interface ReportAssets {
  subjectPhotos: PhotoAsset[];
  compPhotos:    PhotoAsset[];
  aerialMapPng?: Buffer;
  customAddendaPdfs?: Buffer[];
}

type PhotoAsset = {
  photoType: 'SUBJECT_FRONT' | 'SUBJECT_REAR' | 'SUBJECT_STREET' | 'SUBJECT_INTERIOR'
           | 'COMP_FRONT' | 'AERIAL' | 'FLOOR_PLAN' | 'ADDITIONAL';
  bytes: Buffer;
  caption?: string;
  compIndex?: number;
};
```

### B.3.3  Extended ReportTemplate Type

Add to ReportTemplate in both repos:

```typescript
interface ReportTemplate {
  // ... existing fields ...
  renderStrategy: 'acroform' | 'html-render';
  hbsTemplateName?: string;     // only for html-render (e.g. 'dvr-v1.hbs')
  mapperKey: string;            // matches template-registry -> field mapper
  sectionConfig: {
    requiresSubjectPhotos: boolean;
    requiresCompPhotos: boolean;
    requiresAerialMap: boolean;
    requiresMarketConditionsAddendum: boolean;
    requiresLocationMap: boolean;
    requiresFloorPlan: boolean;
  };
}
```

---

## B.4  Data Model Gaps — What Must Be Added

### Frontend + Backend (both copies of canonical-schema.ts)

```typescript
// Add to CanonicalReportDocument:
reconciliation?: CanonicalReconciliation;
appraiserInfo?: CanonicalAppraiserInfo;
dvrDetail?: DvrSubjectDetail;
costApproach?: CanonicalCostApproach;       // optional URAR section
incomeApproach?: CanonicalIncomeApproach;   // optional URAR section

interface CanonicalReconciliation {
  salesCompApproachValue: number | null;
  costApproachValue: number | null;
  incomeApproachValue: number | null;
  finalOpinionOfValue: number;
  effectiveDate: string;
  reconciliationNarrative: string | null;
  exposureTime: string | null;
  marketingTime: string | null;
}

interface CanonicalAppraiserInfo {
  name: string;
  licenseNumber: string;
  licenseState: string;
  licenseType: 'Certified Residential' | 'Certified General' | 'Licensed' | 'Trainee';
  licenseExpirationDate: string;
  companyName: string;
  companyAddress: string;
  phone: string;
  email: string;
  signatureDate: string;
  supervisoryAppraiser?: Omit<CanonicalAppraiserInfo, 'supervisoryAppraiser'>;
}

interface DvrSubjectDetail {
  overallCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  interiorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  exteriorCondition: 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor';
  estimatedRepairCostLow: number | null;
  estimatedRepairCostHigh: number | null;
  majorRepairsNeeded: string | null;
  occupancyStatus: 'Owner Occupied' | 'Tenant Occupied' | 'Vacant' | 'Unknown';
  occupantCooperation: 'Cooperative' | 'Uncooperative' | 'No Contact' | null;
  accessType: 'Interior' | 'Exterior Only' | 'Drive-By';
  daysToSell: number | null;
  listingPriceRecommendation: number | null;
  quickSaleDiscount: number | null;
}
```

### AppraisalOrder additions (both repos)

```typescript
autoGenerateReport?: boolean;          // trigger background generation on QC approval
defaultReportTemplateId?: string;      // template to use for auto-generation
```

---

## B.5  Backend — Build List

| # | File | Action | Phase |
|---|---|---|---|
| 1 | src/services/report-engine/strategies/acroform-fill.strategy.ts | EXTRACT from FinalReportService | 8a |
| 2 | src/services/report-engine/report-engine.service.ts | NEW orchestrator with ReportRenderStrategy interface | 8a |
| 3 | src/services/report-engine/field-mappers/urar-1004.mapper.ts | NEW full 200-field URAR mapper | 8a |
| 4 | src/services/report-engine/template-registry/template-registry.service.ts | NEW registry: formType -> strategy + mapper | 8a |
| 5 | src/types/canonical-schema.ts | ADD reconciliation, appraiserInfo, dvrDetail sub-types | 8a |
| 6 | src/types/final-report.types.ts | ADD renderStrategy, sectionConfig, hbsTemplateName to ReportTemplate | 8a |
| 7 | src/scripts/seed/modules/pdf-templates.ts | UPDATE to reference real FNMA Form 1004 PDF (or upload once manually) | 8a |
| 8 | src/templates/dvr-v1.hbs | NEW Handlebars HTML template for DVR | 8b |
| 9 | src/services/report-engine/strategies/html-render.strategy.ts | NEW Puppeteer/pdfkit renderer | 8b |
| 10 | src/services/report-engine/field-mappers/dvr-bpo.mapper.ts | NEW DVR field assembly with photos + ARV | 8b |
| 11 | src/services/report-engine/photo-resolver.service.ts | NEW fetch photo bytes from Blob for ReportAssets | 8b |
| 12 | src/scripts/seed/modules/dvr-template.ts | NEW seed DVR template metadata record | 8b |
| 13 | src/jobs/auto-report-generation.job.ts | NEW Service Bus consumer for auto-generation | 8e |
| 14 | src/services/qc-execution.engine.ts | ADD post-approval hook that publishes QC_REVIEW_APPROVED event | 8e |
| 15 | src/services/final-report.service.ts | Replace MISMO stub with real MismoXmlGenerator call | 8f |

**New dependency (needs approval):** `puppeteer` — required for HTML->PDF rendering of DVR. Alternatively, use `pdfkit` (already installed) for programmatic layout if Chromium is blocked in the Azure hosting environment. Decision must be made before Phase 8b begins.

**New dependency (needs approval):** `sharp` — image resizing before embedding photos in PDFs (raw photos may be 4-8 MB each; resize to ~300KB before embed).

---

## B.6  Frontend — Build List

| # | Component / File | Action | Phase |
|---|---|---|---|
| 1 | src/components/delivery/FinalReportPanel.tsx | ADD field override editor dialog (table + Add Override button + dialog with fieldKey, originalValue, overrideValue, narrativeComment, source) | 8d |
| 2 | src/components/delivery/FinalReportPanel.tsx | ADD section selector checkboxes driven by template.sectionConfig | 8d |
| 3 | src/components/delivery/FinalReportPanel.tsx | ADD inline PDF preview via PDFViewerPanel after generation succeeds | 8d |
| 4 | src/components/delivery/FinalReportPanel.tsx | ADD generation history table (all FinalReport[] for order, newest-first) | 8d |
| 5 | src/components/delivery/FinalReportPanel.tsx | ADD auto-generate toggle (PATCH order.autoGenerateReport) | 8d |
| 6 | src/components/orders/PhotoAddendumBuilder.tsx | NEW photo grid with role assignment slots (SUBJECT_FRONT, SUBJECT_REAR, COMP_1..6), produces base64 jsPDF payload for customPagePdfs[] | 8c |
| 7 | src/store/api/finalReportApi.ts | ADD getOrderReportHistory endpoint (all FinalReport[] for order) | 8d |
| 8 | src/types/canonical-schema.ts | ADD reconciliation, appraiserInfo, dvrDetail (mirror of backend) | 8a |
| 9 | src/types/backend/final-report.types.ts | ADD renderStrategy, sectionConfig, hbsTemplateName to ReportTemplate | 8a |
| 10 | src/types/backend/order-management.types.ts | ADD autoGenerateReport, defaultReportTemplateId to AppraisalOrder | 8e |

---

## B.7  Template Library Strategy

**AcroForm templates:** Stored as fillable PDF files in Blob container `pdf-report-templates`. Metadata record in Cosmos `document-templates` container. The `blobName` field points to the PDF file. The `mapperKey` field names the field mapper to use.

**HTML templates:** Stored as Handlebars `.hbs` files in the same Blob container. The `hbsTemplateName` field names the .hbs file. No static PDF template needed — the render strategy compiles the template with data and renders via Chromium.

**Acquiring the real URAR Form 1004:**
Download from https://singlefamily.fanniemae.com/delivering/selling-guide/forms (free, public domain). Upload to `pdf-report-templates` Blob container. Inspect AcroForm field names using `pdf-lib` before writing the field mapper, as Fannie Mae field names may differ from the seed placeholder field names.

**Adding a new report type (ongoing process):**
1. Create template file (PDF AcroForm or .hbs) and upload to Blob
2. Write a field mapper in src/services/report-engine/field-mappers/
3. Register in template-registry.service.ts
4. Seed a document-templates Cosmos record

No changes to the controller or service layer are required for new types.

---

## B.8  Dependencies

### New Backend Dependencies (require approval before installing)

| Package | Purpose | Alternative if blocked |
|---|---|---|
| puppeteer | Headless Chromium for HTML->PDF rendering of DVR | Use pdfkit programmatic layout (already installed) |
| sharp | Image resize before PDF embed | Resize with jimp (pure JS, no native binary) |

### Existing Backend (no changes)

pdf-lib, pdfkit, @types/pdfkit, handlebars, @azure/storage-blob, @azure/identity — all already installed and used.

### New Frontend Dependencies

None required. jspdf, jspdf-autotable, and @syncfusion/ej2-react-pdfviewer are already installed and sufficient.

---

## B.9  Implementation Phases

### Phase 8a — Engine Foundation (2-3 days)
Extract AcroForm strategy, create ReportEngine orchestrator, write full URAR field mapper, extend ReportTemplate type, add canonical schema sub-types, acquire real FNMA Form 1004 PDF. Gate: tsc clean in both repos.

### Phase 8b — DVR Report (3-4 days)
Add DvrSubjectDetail to canonical schema, create dvr-v1.hbs Handlebars template, build html-render.strategy.ts, write dvr-bpo.mapper.ts, build photo-resolver.service.ts, wire photos into ReportAssets, seed DVR template metadata. Gate: generate a DVR PDF for a seeded order and verify it matches Vision sample quality.

### Phase 8c — Photo Addendum Builder UI (2 days)
Build PhotoAddendumBuilder.tsx component with photo grid and role assignment slots, wire customPagePdfs into generate mutation, add photo list RTK endpoint.

### Phase 8d — FinalReportPanel UX Polish (1-2 days)
Field override editor dialog, section selector, inline PDF preview, generation history table, auto-generate toggle.

### Phase 8e — Background Auto-Generation (2 days)
Add autoGenerateReport flag to order, add QC approval hook in qc-execution.engine.ts, create auto-report-generation.job.ts Service Bus consumer, add ENABLE_AUTO_REPORT_GENERATION env var.

### Phase 8f — MISMO XML Completion (1 day)
Replace MISMO stub with real MismoXmlGenerator call in _firePostGenerationEvents.

---

## B.10  Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Puppeteer blocked in Azure Functions sandbox | HIGH | HIGH | Use pdfkit programmatic layout as fallback; or deploy report generation to Azure Container App |
| Real FNMA Form 1004 AcroForm field names differ from seed placeholder names | MEDIUM | MEDIUM | Inspect the real form's field names with pdf-lib before writing the mapper |
| Photo Blob paths inconsistent across order types | MEDIUM | MEDIUM | photo-resolver must handle missing photos gracefully — use blank placeholder for required slots |
| DVR orders created before DvrSubjectDetail fields are added will have nulls | HIGH | MEDIUM | All DVR mapper values must use null-coalescing; render blank rather than crash |
| URAR has 200+ fields — many orders will have partial data | HIGH | LOW | Partial fill is acceptable; empty AcroForm fields render as blank on the form |

---

## B.11  Definition of Done (Phase 8 Complete)

- [ ] POST /api/final-reports/orders/:orderId/generate with formType DVR produces a multi-page styled PDF with subject photos, comp grids, and neighborhood analysis matching Vision BPO sample quality
- [ ] POST /api/final-reports/orders/:orderId/generate with formType URAR_1004 produces a fully populated real FNMA Form 1004 PDF with all available fields filled from CanonicalReportDocument
- [ ] No "field not found" warnings in logs for known fields on either form type
- [ ] customPagePdfs with subject and comp photo addenda append correctly to both DVR and URAR
- [ ] MISMO 3.4 XML is actually generated and uploaded (not stubbed) when ENABLE_MISMO_ON_DELIVERY=true
- [ ] With autoGenerateReport: true on an order, approving the QC review triggers background report generation within 60 seconds
- [ ] FinalReportPanel shows: field override editor, section selector, inline PDF preview via Syncfusion viewer, generation history table, auto-generate toggle
- [ ] Both repos tsc --noEmit exit 0
- [ ] All pre-Phase-8 tests still pass
