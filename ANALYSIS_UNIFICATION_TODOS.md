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
- [ ] Define canonical submission contract (`analysisType`, `pipelineId`, context refs, payload).
- [ ] Define canonical response contract (`submissionId`, status, provider refs, result refs).
- [ ] Define stable enums for current/future analysis types (document analyze, extraction, criteria, criteria-step, compare, etc).
- [ ] Define result envelope with typed `resultKind` + schema version.
- [ ] Define compatibility matrix from legacy routes to unified route.
- [ ] Define deprecation policy and timeline for legacy APIs.

## Phase 1 — Backend Foundation
- [ ] Add `analysis-submission.types.ts` with discriminated unions for request/response.
- [ ] Add `AnalysisSubmissionService` (single orchestration service).
- [ ] Implement dispatch handlers by `analysisType`:
  - [ ] Document analyze (current `/api/axiom/analyze` path behavior)
  - [ ] Extraction run (current `/api/runs/extraction` behavior)
  - [ ] Criteria run (current `/api/runs/criteria` behavior)
- [ ] Add strict request validation per analysis type.
- [ ] Add deterministic idempotency and correlation handling.
- [ ] Add unified route `POST /api/analysis/submissions`.
- [ ] Add read route `GET /api/analysis/submissions/:submissionId`.
- [ ] Add event stream route `GET /api/analysis/submissions/:submissionId/stream` (SSE bridge).
- [ ] Register route in API server with UnifiedAuth.

## Phase 2 — Legacy Compatibility Layer
- [ ] Refactor `/api/axiom/analyze` to call `AnalysisSubmissionService` internally.
- [ ] Refactor `/api/runs/extraction` to call `AnalysisSubmissionService`.
- [ ] Refactor `/api/runs/criteria` to call `AnalysisSubmissionService`.
- [ ] Keep legacy payloads/responses stable for clients not yet migrated.
- [ ] Add structured deprecation headers/log warnings on legacy endpoints.

## Phase 3 — UI API Consolidation
- [ ] Add `analysisApi.ts` RTK slice with unified mutation/query hooks.
- [ ] Add typed frontend `AnalysisSubmissionRequest` / `AnalysisSubmissionResponse`.
- [ ] Migrate `DocumentUploadZone` auto-submit to unified API.
- [ ] Migrate `DocumentListItem` submit/re-submit to unified API.
- [ ] Migrate Engagement page “Submit/Re-submit” button to unified API.
- [ ] Preserve current UX behavior while swapping transport/API only.

## Phase 4 — Unified UI Component
- [ ] Create `AnalysisWorkbench` component (reusable in Engagement/Order/Bulk row).
- [ ] Support `mode='simple' | 'advanced'`:
  - [ ] Simple: upload + submit + status + insights
  - [ ] Advanced: engine selection, program/run mode/step keys
- [ ] Accept generic context props: `orderId`, `engagementId`, `bulkItemId`, `documentId`.
- [ ] Add route-aware wrappers for:
  - [ ] Engagement Documents tab
  - [ ] Order Documents tab
  - [ ] Bulk row detail documents panel

## Phase 5 — Results & Eventing Normalization
- [ ] Normalize pending/running/completed/failed state transitions.
- [ ] Normalize event timeline records (submission, provider accepted, pipeline stages, webhook received, finalized).
- [ ] Persist latest status snapshots for deterministic refresh.
- [ ] Ensure SSE + polling fallback produce consistent UX state.

## Phase 6 — Security, Reliability, Operations
- [ ] Enforce authz checks for tenant/client/context ownership.
- [ ] Enforce input validation with actionable errors.
- [ ] Ensure webhook signature verification remains unchanged.
- [ ] Add request tracing across submission → provider → webhook.
- [ ] Add metrics dashboards (success/fail rates, latency, retries, orphaned submissions).
- [ ] Add DLQ/replay strategy for failed provider callbacks where applicable.

## Phase 7 — Tests
- [ ] Backend unit tests for `AnalysisSubmissionService` handlers.
- [ ] Backend integration tests for unified route.
- [ ] Contract tests for legacy compatibility wrappers.
- [ ] UI API contract tests for `analysisApi`.
- [ ] UI component tests for migrated submit paths.
- [ ] E2E smoke tests: engagement, order, bulk row.

## Phase 8 — Rollout & Decommission
- [ ] Add feature flag for unified API usage (`UI_ANALYSIS_UNIFIED_ENABLED`).
- [ ] Canary rollout to staging + monitored tenants.
- [ ] Verify parity metrics against legacy routes.
- [ ] Migrate all UI call sites.
- [ ] Disable new traffic to legacy routes.
- [ ] Remove legacy code once error budget and KPI thresholds are met.

---

## Immediate Implementation Slice (Today)
- [ ] Ship backend unified submit route (`POST /api/analysis/submissions`) for `DOCUMENT_ANALYZE`, `EXTRACTION`, `CRITERIA`.
- [ ] Register route in API server.
- [ ] Add UI `analysisApi` and migrate `DocumentUploadZone` to new route.
- [ ] Add compatibility wrappers for old UI submit paths still using `analyzeDocument`.
- [ ] Run targeted typecheck/tests and fix compile issues.
- [ ] Commit migration notes and next-slice tasks.
