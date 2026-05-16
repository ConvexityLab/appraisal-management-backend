# Analysis Unification ToDos (Production Rollout)

## Goal
Create one unified analysis experience and contract across Engagement, Order, and Bulk row contexts.

## Target Outcomes
- One canonical backend submission API for analysis dispatch.
- One reusable UI surface for submission + lifecycle + results.
- Backward-compatible migration from existing `/api/axiom/*` and `/api/runs/*` usage.
- Production observability, idempotency, and safe rollout controls.

---

## Phase 0 — Contract & Architecture
- [x] Define canonical submission contract (`analysisType`, `pipelineId`, context refs, payload).
- [x] Define canonical response contract (`submissionId`, status, provider refs, result refs).
- [x] Define stable enums for current/future analysis types (document analyze, extraction, criteria, criteria-step, compare, etc).
- [x] Define result envelope with typed `resultKind` + schema version.
- [x] Define compatibility matrix from legacy routes to unified route.
- [x] Define deprecation policy and timeline for legacy APIs.

## Phase 1 — Backend Foundation
- [x] Add `analysis-submission.types.ts` with discriminated unions for request/response.
- [x] Add `AnalysisSubmissionService` (single orchestration service).
- [x] Implement dispatch handlers by `analysisType`:
  - [x] Document analyze (current `/api/axiom/analyze` path behavior)
  - [x] Extraction run (current `/api/runs/extraction` behavior)
  - [x] Criteria run (current `/api/runs/criteria` behavior)
- [x] Add strict request validation per analysis type.
- [x] Add deterministic idempotency and correlation handling.
- [x] Add unified route `POST /api/analysis/submissions`.
- [x] Add read route `GET /api/analysis/submissions/:submissionId`.
- [x] Add event stream route `GET /api/analysis/submissions/:submissionId/stream` (SSE bridge).
- [x] Register route in API server with UnifiedAuth.

## Phase 2 — Legacy Compatibility Layer
- [x] Refactor `/api/axiom/analyze` to call `AnalysisSubmissionService` internally.
- [x] Refactor `/api/runs/extraction` to call `AnalysisSubmissionService`.
- [x] Refactor `/api/runs/criteria` to call `AnalysisSubmissionService`.
- [x] Keep legacy payloads/responses stable for clients not yet migrated.
- [x] Add structured deprecation headers/log warnings on legacy endpoints.

## Phase 3 — UI API Consolidation
- [x] Add `analysisApi.ts` RTK slice with unified mutation/query hooks.
- [x] Add typed frontend `AnalysisSubmissionRequest` / `AnalysisSubmissionResponse`.
- [x] Migrate `DocumentUploadZone` auto-submit to unified API.
- [x] Migrate `DocumentListItem` submit/re-submit to unified API.
- [x] Migrate Engagement page "Submit/Re-submit" button to unified API (`DocumentRunLedgerPanel`).
- [x] Preserve current UX behavior while swapping transport/API only.

## Phase 4 — Unified UI Component
- [x] Create `AnalysisWorkbench` component (reusable in Engagement/Order/Bulk row).
- [x] Support `mode='simple' | 'advanced'`:
  - [x] Simple: submit + status + completion/failure display
  - [x] Advanced: engine target selection, run reason (EXTRACTION); CRITERIA deferred
- [x] Accept generic context props: `orderId`, `engagementId`, `documentId`.
- [x] Add route-aware wrappers for:
  - [x] Engagement Documents tab
  - [x] Order Documents tab
  - [x] Bulk row detail documents panel

## Phase 5 — Results & Eventing Normalization
- [x] Normalize pending/running/completed/failed state transitions.
- [x] Normalize event timeline records (submission, provider accepted, pipeline stages, webhook received, finalized).
- [x] Persist latest status snapshots for deterministic refresh.
- [x] Ensure SSE + polling fallback produce consistent UX state.

## Phase 6 — Security, Reliability, Operations
- [x] Enforce authz checks for tenant/client/context ownership.
- [x] Enforce input validation with actionable errors.
- [x] Ensure webhook signature verification remains unchanged.
- [ ] Add request tracing across submission → provider → webhook.
- [ ] Add metrics dashboards (success/fail rates, latency, retries, orphaned submissions).
- [ ] Add DLQ/replay strategy for failed provider callbacks where applicable.

## Phase 7 — Tests
- [x] Backend unit tests for `AnalysisSubmissionService` handlers (`analysis-submission.service.test.ts`).
- [x] Backend integration tests for unified route (`analysis-submission.controller.test.ts`).
- [x] Contract tests for legacy compatibility wrappers (`runs-legacy-wrapper.test.ts`).
- [x] UI API contract tests for `analysisApi` (`analysisApi.test.ts`).
- [x] UI component tests for `AnalysisWorkbench`.
- [ ] E2E smoke tests: engagement, order, bulk row.

## Phase 8 — Rollout & Decommission
- [N/A] Add feature flag for unified API usage (`UI_ANALYSIS_UNIFIED_ENABLED`) — dev environment only; unified API is the sole path, no flag needed.
- [N/A] Canary rollout to staging + monitored tenants — N/A for dev environment.
- [N/A] Verify parity metrics against legacy routes — routes deleted; no traffic to compare.
- [x] Migrate all UI call sites — `ReviewProgramWorkspace` migrated to `useSubmitAnalysisMutation`; last remaining caller of legacy mutations.
- [x] Disable new traffic to legacy routes — `POST /runs/extraction` and `POST /runs/criteria` handlers deleted from `runs.controller.ts`.
- [x] Remove legacy code once error budget and KPI thresholds are met — mutations removed from `runLedgerApi.ts`, barrel re-exports cleaned, dead types (`CreateExtractionRunRequest`, `CreateCriteriaRunRequest`, `CreateCriteriaRunResponse`) removed from `runLedger.types.ts`.

---

## Immediate Implementation Slice (Done)
- [x] Ship backend unified submit route (`POST /api/analysis/submissions`) for `DOCUMENT_ANALYZE`, `EXTRACTION`, `CRITERIA`.
- [x] Register route in API server.
- [x] Add UI `analysisApi` and migrate `DocumentUploadZone` to new route.
- [x] Add compatibility wrappers for old UI submit paths still using `analyzeDocument`.
- [x] Run targeted typecheck/tests and fix compile issues.
- [x] Commit migration notes and next-slice tasks.

---

## Deferred / Out-of-scope for current milestone
- Route-aware wrapper components (Engagement Documents tab, Order Documents tab, Bulk row detail panel) — Phase 4 remainder.
- SSE-native provider push (currently implemented as poll-over-SSE bridge at 2 s intervals).
- CRITERIA advanced mode in `AnalysisWorkbench` (requires `snapshotId` + `programKey` UI — UX TBD).
- Metrics dashboards and DLQ/replay strategy — ops/infra work.
- Feature-flag canary rollout — pending product/ops sign-off.
- **Pre-existing failing test (unrelated):** `tests/post-delivery.test.ts > PostDeliveryService > checkRecertificationStatus > should return recert status when task exists` — `AssertionError: expected 0 to be greater than 0`. Existed before Phase 8 work; needs separate investigation.
