# Phase 7 — Final Report Generation: Implementation Plan

> Created: February 22, 2026
> Status: ✅ COMPLETE
> Repos: `appraisal-management-backend` · `l1-valuation-platform-ui`

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
