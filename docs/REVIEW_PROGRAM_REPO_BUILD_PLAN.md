# Review Program Repo-Specific Build Plan

**Date:** April 29, 2026  
**Status:** In progress — backend substantially implemented, frontend and audit cleanup still active  
**Companion doc:** [docs/REVIEW_PROGRAM_REQUIREMENTS_GAP_ANALYSIS.md](REVIEW_PROGRAM_REQUIREMENTS_GAP_ANALYSIS.md)

## Purpose

This document converts the gap analysis into a repo-specific build plan with:

- concrete repositories in scope,
- concrete files likely to change,
- new services/types/endpoints to add,
- test work per phase,
- sequencing rules to reduce rework.

This is the implementation map we should use to actually build the system.

## Current implementation progress

Completed in the current slice and prior slices:

- backend `ReviewContext`, `CriterionResolution`, and prepare request/response contracts are in place,
- backend `ReviewContextAssemblyService`, `ReviewPreparationService`, `ReviewRequirementResolutionService`, and `ReviewSourcePriorityService` are now implemented,
- `POST /api/review-programs/prepare` is live and covered by controller/integration tests,
- prepared-context artifacts are now persisted in `aiInsights` and returned with `preparedContextId` / `preparedContextVersion`,
- backend `ReviewDispatchService` and `POST /api/review-programs/dispatch` now dispatch from prepared context artifacts,
- criteria and criteria-step run-ledger records now link back to prepared context IDs, versions, dispatch IDs, and payload refs,
- the MOP/Prio prepared payload contract is now locked in [docs/MOP_PRIO_PREPARED_PAYLOAD_CONTRACT.md](MOP_PRIO_PREPARED_PAYLOAD_CONTRACT.md),
- the workspace now calls the preparation endpoint, stores the latest preparation result, and renders criterion-level readiness details,
- targeted backend and frontend tests are passing for context assembly, preparation, requirement resolution, prepare integration, and workspace mixed ready/blocked states.

Completed in the latest slice:

- `GET /api/review-programs/prepared/:id` and prepared-context diff retrieval are live for explainability and rerun comparison,
- engine dispatch adapters now resolve persisted prepared payload artifacts directly for Axiom and MOP/Prio request-side dispatch,
- `ReviewContextAssemblyService` now includes canonical report / comp / adjustment summaries so comp-sensitive readiness has stable inputs,
- the backend now accepts both `POST /api/review-programs/dispatch` and `POST /api/review-programs/prepared/:preparedContextId/dispatch` for prepared-context dispatch,
- review-program preparation now emits lifecycle audit events (`started`, `completed`, `failed`) into the shared event stream,
- readiness classification now distinguishes `requires_extraction` and `partially_ready` instead of collapsing those cases into generic blocking states.

Next implementation slice:

- finish frontend cleanup so the workspace uses prepared-context dispatch/retrieval paths exclusively and remove legacy snapshot-first fallback behavior,
- add stricter MOP/Prio result-contract handling and adapter coverage for response parsing,
- extend audit/reporting coverage for prepared dispatch outcomes and close the remaining explainability/readiness UX gaps.

---

## 1. Repos in Scope

## 0. Code-truth snapshot as of April 30, 2026

What is actually done in code right now:

- backend prepare/persist/retrieve/diff/dispatch flows are live in the appraisal-management-backend repo,
- prepared-context artifacts are the backend source of truth for re-dispatch and explainability,
- backend dispatch no longer depends on a raw snapshot-only request contract when a prepared context is available,
- frontend preparation UX is live, but the workspace still carries some migration-era snapshot fallback logic,
- cross-repo prepared payload acceptance exists contractually, but end-to-end proof for every downstream engine path is still incomplete.

What still blocks a “fully done” declaration:

- frontend cleanup and polish around prepared artifact history/diff/dispatch flows,
- stricter MOP/Prio response-side validation coverage,
- final parity verification across backend, UI, and engine adapters.

## 1.1 Primary repos

### [appraisal-management-backend](../)

System-of-orchestration for:

- orders,
- documents,
- enrichment,
- review-program definitions,
- run ledger,
- review-program submission,
- audit events.

This repo should own:

- review-context assembly,
- readiness planning,
- preparation API,
- dispatch API,
- review-context persistence,
- engine adapter coordination,
- auditability.

### [l1-valuation-platform-ui](../../l1-valuation-platform-ui)

Primary reviewer/operator UI.

This repo should own:

- requirement-aware readiness UX,
- program preparation flows,
- program dispatch UX,
- missing-requirement explanations,
- navigation into corrective actions,
- result presentation.

### [axiom](../../axiom)

Criteria requirement and evaluation engine.

This repo should own:

- authoritative criterion requirement semantics,
- data/document requirement expansion,
- criterion-level cannot-evaluate behavior,
- engine payload acceptance contract for prepared review context.

## 1.2 Secondary / dependent repos

### [mortgage-origination-platform](../../mortgage-origination-platform)

Potential MOP-side receiver/engine for ruleset-driven review legs.

### [prio](../../prio)

Potential rules/runtime implementation for MOP/Prio rule execution.

## 1.3 Important note on current workspace evidence

In current workspace inspection, the snapshot-gated submit path is clearly present in:

- backend review-program orchestration,
- backend run-ledger criteria submission,
- frontend review workspace.

However, a concrete requirement-aware MOP/Prio review receiver was **not** found in current repo searches. That means the MOP/Prio portion of this plan should begin with contract definition and interface alignment, not assumptions.

---

## 2. Build Strategy

We should implement this in the following order:

1. **Define contracts before coding**
2. **Build backend prepare/readiness engine first**
3. **Wire UI to preparation results before replacing dispatch**
4. **Adapt Axiom and MOP/Prio to prepared payloads**
5. **Migrate existing submit path after parity is proven**

This sequencing matters. If we change UI first without preparation APIs, we will keep papering over the same architectural defect.

---

## 3. Repo-by-Repo Work Plan

## 3.1 appraisal-management-backend

This repo is the center of gravity.

### 3.1.1 Existing files that should be modified

- [src/controllers/review-programs.controller.ts](../src/controllers/review-programs.controller.ts)
- [src/services/review-program-orchestration.service.ts](../src/services/review-program-orchestration.service.ts)
- [src/services/analysis-submission.service.ts](../src/services/analysis-submission.service.ts)
- [src/services/engine-dispatch.service.ts](../src/services/engine-dispatch.service.ts)
- [src/services/canonical-snapshot.service.ts](../src/services/canonical-snapshot.service.ts)
- [src/services/criteria-step-input.service.ts](../src/services/criteria-step-input.service.ts)
- [src/types/review-program-orchestration.types.ts](../src/types/review-program-orchestration.types.ts)
- [src/types/run-ledger.types.ts](../src/types/run-ledger.types.ts)
- [src/types/analysis-submission.types.ts](../src/types/analysis-submission.types.ts)
- [src/api/api-server.ts](../src/api/api-server.ts)
- [src/controllers/runs.controller.ts](../src/controllers/runs.controller.ts)
- [src/controllers/order.controller.ts](../src/controllers/order.controller.ts)
- [src/types/events.ts](../src/types/events.ts)
- [src/services/audit-event-sink.service.ts](../src/services/audit-event-sink.service.ts)

### 3.1.2 New backend files/services to add

Suggested additions:

- `src/types/review-context.types.ts`
- `src/types/review-preparation.types.ts`
- `src/services/review-context-assembly.service.ts`
- `src/services/review-requirement-resolution.service.ts`
- `src/services/review-preparation.service.ts`
- `src/services/review-prepared-context.service.ts`
- `src/services/review-dispatch.service.ts`
- `src/services/review-source-priority.service.ts`
- `src/services/review-context-diff.service.ts`
- `src/services/review-program-explain.service.ts`
- `src/controllers/review-program-preparation.controller.ts` or extend existing controller cleanly

### 3.1.3 Backend responsibilities by phase

#### Phase A — Type system and contracts

Implement:

- `ReviewContext`
- `CriterionResolution`
- `ProgramReadiness`
- `PreparedEngineDispatch`
- `PrepareReviewProgramsRequest`
- `PrepareReviewProgramsResponse`
- `DispatchPreparedReviewProgramsRequest`
- `DispatchPreparedReviewProgramsResponse`

Primary files:

- [src/types/review-program-orchestration.types.ts](../src/types/review-program-orchestration.types.ts)
- `src/types/review-context.types.ts`
- `src/types/review-preparation.types.ts`

#### Phase B — Context assembly

Build a new `ReviewContextAssemblyService` that loads and normalizes:

- order core data,
- client/sub-client context,
- latest property enrichment,
- order documents,
- extraction outputs,
- report subject/comps/adjustments,
- prior run references,
- evidence/provenance refs.

Likely dependencies:

- order data from [src/controllers/order.controller.ts](../src/controllers/order.controller.ts) / DB service
- documents container access already used by [src/services/canonical-snapshot.service.ts](../src/services/canonical-snapshot.service.ts)
- enrichment access already present in [src/services/canonical-snapshot.service.ts](../src/services/canonical-snapshot.service.ts)
- review-program definitions from [src/controllers/review-programs.controller.ts](../src/controllers/review-programs.controller.ts)

#### Phase C — Requirement resolution planner

Build `ReviewRequirementResolutionService` that:

1. expands selected review programs into engine legs,
2. expands criteria into requirement sets,
3. resolves data requirements by source priority,
4. resolves document availability,
5. classifies criteria/program readiness,
6. recommends next actions.

This service must become the source of truth for readiness.

#### Phase D — Preparation API

Extend [src/controllers/review-programs.controller.ts](../src/controllers/review-programs.controller.ts) with new endpoints, or split into dedicated controller if the file gets too large.

Recommended endpoints:

- `POST /api/review-programs/prepare`
- `POST /api/review-programs/dispatch`
- `GET /api/review-programs/prepared/:id`
- `GET /api/review-programs/prepared/:id/diff/:otherId`

#### Phase E — Dispatch refactor

Refactor [src/services/review-program-orchestration.service.ts](../src/services/review-program-orchestration.service.ts) so it no longer accepts raw snapshot-only readiness as the primary contract.

Target structure:

- `ReviewPreparationService` does prepare-only work.
- `ReviewDispatchService` accepts a prepared context artifact and dispatch mode.
- Existing orchestration service becomes a thin compatibility wrapper or is retired.

#### Phase F — Run ledger and artifact persistence

Extend [src/types/run-ledger.types.ts](../src/types/run-ledger.types.ts) and related services to support:

- prepared context ID/version linkage,
- dispatch payload references,
- requirement resolution artifact refs,
- richer evidence refs,
- criterion-level skip/cannot-evaluate metadata.

Likely changes:

- [src/types/run-ledger.types.ts](../src/types/run-ledger.types.ts)
- [src/services/criteria-step-input.service.ts](../src/services/criteria-step-input.service.ts)
- [src/services/analysis-submission.service.ts](../src/services/analysis-submission.service.ts)

#### Phase G — Engine adapter layer

Refactor [src/services/engine-dispatch.service.ts](../src/services/engine-dispatch.service.ts) to consume prepared engine dispatch artifacts rather than assuming `snapshotId` + `programKey` are sufficient.

For Axiom:

- pass prepared payloads,
- preserve evidence refs,
- retain criterion-ready slices.

For MOP/Prio:

- define the missing contract first,
- then adapt dispatch to the real rule input format.

### 3.1.4 Backend tests to add

Suggested new test files:

- `tests/unit/review-context-assembly.service.test.ts`
- `tests/unit/review-requirement-resolution.service.test.ts`
- `tests/unit/review-preparation.service.test.ts`
- `tests/unit/review-dispatch.service.test.ts`
- `tests/unit/review-source-priority.service.test.ts`
- `tests/unit/review-programs.prepare.controller.test.ts`
- `tests/integration/review-program-preparation.integration.test.ts`
- `tests/integration/review-program-dispatch.integration.test.ts`

Existing tests likely to update:

- [tests/unit/review-programs.controller.test.ts](../tests/unit/review-programs.controller.test.ts)
- [tests/review-program-orchestration.service.test.ts](../tests/review-program-orchestration.service.test.ts)

### 3.1.5 Backend definition of done

- [ ] Prepare endpoint returns requirement-aware readiness.
- [x] Dispatch endpoint uses prepared context artifact.
- [x] Run ledger records link back to prepared context.
- [ ] Snapshot is no longer the only readiness gate.
- [ ] Audit events exist for prepare and dispatch.

---

## 3.2 l1-valuation-platform-ui

This repo should become the operational cockpit for requirement-aware review execution.

### 3.2.1 Existing files that should be modified

- [src/components/order/ReviewProgramWorkspace.tsx](../../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx)
- [src/components/order/__tests__/ReviewProgramWorkspace.test.tsx](../../l1-valuation-platform-ui/src/components/order/__tests__/ReviewProgramWorkspace.test.tsx)
- [src/components/qc/QCReviewContent.tsx](../../l1-valuation-platform-ui/src/components/qc/QCReviewContent.tsx)
- [src/store/api/bulkPortfoliosApi.ts](../../l1-valuation-platform-ui/src/store/api/bulkPortfoliosApi.ts)
- [src/store/api/runLedgerApi.ts](../../l1-valuation-platform-ui/src/store/api/runLedgerApi.ts)
- [src/store/api/ordersApi.ts](../../l1-valuation-platform-ui/src/store/api/ordersApi.ts)
- [src/components/engagement/eventEnrichment.ts](../../l1-valuation-platform-ui/src/components/engagement/eventEnrichment.ts)
- [src/app/(control-panel)/orders/[id]/page.tsx](../../l1-valuation-platform-ui/src/app/(control-panel)/orders/[id]/page.tsx)

### 3.2.2 New frontend files/components to add

Suggested additions:

- `src/types/backend/reviewPreparation.types.ts`
- `src/components/order/ReviewProgramPreparationPanel.tsx`
- `src/components/order/ReviewProgramCriterionTable.tsx`
- `src/components/order/ReviewProgramBlockerPanel.tsx`
- `src/components/order/ReviewProgramSourceSummary.tsx`
- `src/components/order/ReviewProgramDispatchDialog.tsx`
- `src/components/order/ReviewProgramPreparedDiffView.tsx`

### 3.2.3 Frontend responsibilities by phase

#### Phase A — API integration

Extend [src/store/api/bulkPortfoliosApi.ts](../../l1-valuation-platform-ui/src/store/api/bulkPortfoliosApi.ts) with:

- `prepareReviewPrograms`
- `dispatchPreparedReviewPrograms`
- `getPreparedReviewPrograms`
- `diffPreparedReviewPrograms`

Keep the existing `submitReviewProgram` mutation temporarily for compatibility.

#### Phase B — Readiness-first UX

Refactor [src/components/order/ReviewProgramWorkspace.tsx](../../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx):

Current behavior to remove over time:

- derive readiness from `latestSnapshotId`
- gate primary flow on extraction snapshot existence
- submit directly from selection to dispatch

Target behavior:

1. user selects programs,
2. UI calls prepare endpoint,
3. UI shows readiness by program and criterion,
4. user resolves blockers or proceeds with ready/partial dispatch,
5. UI dispatches using prepared artifact.

#### Phase C — Readiness explanation panels

Add panels for:

- missing data requirements,
- missing document requirements,
- comp/adjustment requirements,
- source conflicts,
- recommended next actions.

#### Phase D — Result UX

Enhance the result area to show:

- per-engine submission status,
- per-criterion status,
- skipped vs cannot-evaluate distinctions,
- evidence/source summary,
- links to audit history.

### 3.2.4 Frontend tests to add

Suggested additions:

- `src/components/order/__tests__/ReviewProgramPreparationPanel.test.tsx`
- `src/components/order/__tests__/ReviewProgramCriterionTable.test.tsx`
- `src/components/order/__tests__/ReviewProgramBlockerPanel.test.tsx`
- API contract tests for new preparation mutations in the relevant RTK query test files

Existing tests to expand:

- [src/components/order/__tests__/ReviewProgramWorkspace.test.tsx](../../l1-valuation-platform-ui/src/components/order/__tests__/ReviewProgramWorkspace.test.tsx)

New UX scenarios required:

- ready without extraction
- blocked by missing documents
- blocked by missing comp context
- partial-runnable program
- source conflict warning
- dispatch from prepared context

### 3.2.5 Frontend definition of done

- [ ] UI no longer models readiness as snapshot-only.
- [ ] UI shows criterion-level blocker details.
- [ ] UI allows actioning blockers directly.
- [ ] UI dispatches through prepared context flow.
- [ ] UI results distinguish submitted, skipped, failed, cannot-evaluate.

---

## 3.3 axiom

This repo already contains the richest requirement model. We should leverage it rather than re-invent it.

### 3.3.1 Existing files that matter most

- [src/types/criterion/DataRequirement.ts](../../axiom/src/types/criterion/DataRequirement.ts)
- [src/types/criterion/DocumentRequirement.ts](../../axiom/src/types/criterion/DocumentRequirement.ts)
- [src/types/criterion/CriterionNode.ts](../../axiom/src/types/criterion/CriterionNode.ts)
- [src/utils/criterion/field-resolver.ts](../../axiom/src/utils/criterion/field-resolver.ts)
- [src/services/criterion/CriterionEvaluationService.ts](../../axiom/src/services/criterion/CriterionEvaluationService.ts)

### 3.3.2 Likely Axiom work

#### Phase A — Requirement export / contract alignment

We need a stable way for appraisal-management-backend to consume criterion requirement metadata for referenced programs.

That could be done via:

- a direct API response from Axiom,
- a shared artifact/schema,
- or a synchronized compiled-program document contract.

#### Phase B — Prepared payload acceptance

Axiom should explicitly support prepared review-context payloads rather than forcing everything through a snapshot-only abstraction.

#### Phase C — Explainability parity

Axiom result payloads should preserve:

- missing requirement reasoning,
- evidence refs,
- criterion-level cannot-evaluate causes,
- source usage metadata where available.

### 3.3.3 Likely Axiom deliverables

- [ ] stable requirement metadata export contract
- [ ] prepared-context-compatible evaluation contract
- [ ] result contract that keeps cannot-evaluate details and evidence refs
- [ ] golden fixtures for mixed-source criterion evaluation

---

## 3.4 mortgage-origination-platform / prio

This is the least-defined area in the current workspace for this feature.

### 3.4.1 What we know from current backend dispatch

Current backend MOP/Prio dispatch posts:

- `runId`
- `tenantId`
- `correlationId`
- `idempotencyKey`
- `snapshotId`
- `programKey`

And for step runs:

- `stepRunId`
- `criteriaRunId`
- `stepKey`
- `snapshotId`
- `programKey`
- `stepInputPayloadRef`
- `stepInputPayload`
- `stepEvidenceRefs`

### 3.4.2 What is missing

We do not yet have a clear repo-local implementation contract proving:

- what MOP/Prio expects for rule execution,
- how rulesets declare their requirements,
- whether rules are snapshot-based, step-slice-based, or field-map-based.

### 3.4.3 Required first deliverable

Before major code changes in these repos, define and ratify:

- a MOP/Prio review rule input contract,
- a requirement declaration shape for MOP/Prio rulesets,
- a result shape with pass/fail/cannot-evaluate/skip semantics,
- evidence and provenance expectations.

### 3.4.4 Suggested MOP/Prio plan

- [ ] inspect existing MOP/Prio rule execution entrypoints
- [ ] define canonical input contract for review runs
- [ ] add requirement declaration metadata to rulesets if absent
- [ ] implement adapter acceptance tests from backend prepared dispatch artifacts

---

## 4. Cross-Repo Phase Plan

## Phase 0 — Architecture lock

Primary repo: [appraisal-management-backend](../)

- [ ] finalise `ReviewContext` schema
- [ ] finalise `PrepareReviewProgramsResponse` schema
- [ ] finalise dispatch-from-prepared-context schema
- [ ] confirm source-priority rules
- [ ] confirm readiness states

Supporting repos:

- [ ] confirm Axiom requirement export contract
- [ ] confirm MOP/Prio requirement contract
- [ ] confirm UI readiness states and action model

## Phase 1 — Backend preparation engine

Primary repo: [appraisal-management-backend](../)

- [x] implement context assembly
- [x] implement requirement resolution
- [x] implement preparation endpoint
- [x] persist prepared context artifacts
- [x] add targeted tests

## Phase 2 — Frontend preparation UX

Primary repo: [l1-valuation-platform-ui](../../l1-valuation-platform-ui)

- [x] call preparation endpoint
- [x] render readiness tables
- [ ] render blocker panels
- [ ] add direct next actions
- [ ] keep existing dispatch path only as fallback during migration

## Phase 3 — Engine payload adapters

Primary repos:

- [appraisal-management-backend](../)
- [axiom](../../axiom)
- [mortgage-origination-platform](../../mortgage-origination-platform) / [prio](../../prio)

- [ ] align Axiom prepared payload contract
- [x] align MOP/Prio prepared payload contract
- [-] refactor engine dispatch service
- [-] add adapter tests

## Phase 4 — Dispatch migration

Primary repo: [appraisal-management-backend](../)

- [x] implement dispatch endpoint using prepared context
- [-] add prepared artifact retrieval/diff endpoints
- [ ] update audit events
- [x] link run ledger to prepared artifacts

Primary repo: [l1-valuation-platform-ui](../../l1-valuation-platform-ui)

- [ ] dispatch from prepared context
- [ ] update results UX
- [ ] remove snapshot-first readiness from primary path

## Phase 5 — Cleanup and enforcement

- [ ] remove obsolete snapshot-only assumptions
- [ ] remove temporary fallback UX
- [ ] update docs
- [ ] run parity and regression suite

---

## 5. Concrete File-Level Build Checklist

## 5.1 Backend checklist

- [ ] Update [src/types/review-program-orchestration.types.ts](../src/types/review-program-orchestration.types.ts)
- [x] Add `src/types/review-context.types.ts`
- [x] Add `src/types/review-preparation.types.ts`
- [x] Add `src/services/review-context-assembly.service.ts`
- [x] Add `src/services/review-requirement-resolution.service.ts`
- [x] Add `src/services/review-preparation.service.ts`
- [x] Add `src/services/review-prepared-context.service.ts`
- [x] Add `src/services/review-dispatch.service.ts`
- [x] Update [src/controllers/review-programs.controller.ts](../src/controllers/review-programs.controller.ts)
- [ ] Update [src/api/api-server.ts](../src/api/api-server.ts)
- [ ] Update [src/services/review-program-orchestration.service.ts](../src/services/review-program-orchestration.service.ts)
- [ ] Update [src/services/analysis-submission.service.ts](../src/services/analysis-submission.service.ts)
- [-] Update [src/services/engine-dispatch.service.ts](../src/services/engine-dispatch.service.ts)
- [ ] Update [src/services/canonical-snapshot.service.ts](../src/services/canonical-snapshot.service.ts) or intentionally leave narrow and document why
- [ ] Update [src/services/criteria-step-input.service.ts](../src/services/criteria-step-input.service.ts)
- [ ] Update [src/types/run-ledger.types.ts](../src/types/run-ledger.types.ts)
- [ ] Update [src/types/events.ts](../src/types/events.ts)
- [ ] Update [src/services/audit-event-sink.service.ts](../src/services/audit-event-sink.service.ts)

## 5.2 Frontend checklist

- [x] Update [src/store/api/bulkPortfoliosApi.ts](../../l1-valuation-platform-ui/src/store/api/bulkPortfoliosApi.ts)
- [x] Add `src/types/backend/review-preparation.types.ts`
- [x] Update [src/components/order/ReviewProgramWorkspace.tsx](../../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx)
- [x] Add `src/components/order/ReviewProgramPreparationPanel.tsx`
- [ ] Add `src/components/order/ReviewProgramCriterionTable.tsx`
- [ ] Add `src/components/order/ReviewProgramBlockerPanel.tsx`
- [ ] Add `src/components/order/ReviewProgramSourceSummary.tsx`
- [ ] Add `src/components/order/ReviewProgramDispatchDialog.tsx`
- [ ] Update [src/components/qc/QCReviewContent.tsx](../../l1-valuation-platform-ui/src/components/qc/QCReviewContent.tsx)
- [ ] Update [src/app/(control-panel)/orders/[id]/page.tsx](../../l1-valuation-platform-ui/src/app/(control-panel)/orders/[id]/page.tsx)
- [ ] Update [src/components/engagement/eventEnrichment.ts](../../l1-valuation-platform-ui/src/components/engagement/eventEnrichment.ts)
- [x] Expand [src/components/order/__tests__/ReviewProgramWorkspace.test.tsx](../../l1-valuation-platform-ui/src/components/order/__tests__/ReviewProgramWorkspace.test.tsx)

## 5.3 Axiom checklist

- [ ] Confirm authoritative requirement export path from compiled programs
- [ ] Update prepared payload acceptance path if needed
- [ ] Preserve cannot-evaluate and evidence details in result contract
- [ ] Add fixtures for mixed-source evaluation paths

## 5.4 MOP/Prio checklist

- [ ] Define requirement declaration contract
- [x] Define prepared input payload contract
- [ ] Define result contract
- [ ] Add compatibility tests against backend adapter assumptions

---

## 6. Testing Plan by Repo

## 6.1 appraisal-management-backend

Commands likely used during implementation:

- `pnpm vitest run tests/unit/review-programs.controller.test.ts`
- `pnpm vitest run tests/review-program-orchestration.service.test.ts`
- `pnpm vitest run tests/unit/review-context-assembly.service.test.ts`
- `pnpm vitest run tests/unit/review-requirement-resolution.service.test.ts`

## 6.2 l1-valuation-platform-ui

Commands likely used during implementation:

- `pnpm vitest run src/components/order/__tests__/ReviewProgramWorkspace.test.tsx --maxWorkers=1 --minWorkers=1`
- targeted tests for new preparation components

## 6.3 Cross-repo validation

Required validation scenarios:

- [ ] review program ready without extraction
- [ ] review program requires extraction for only some criteria
- [ ] review program blocked by missing documents
- [ ] review program blocked by missing comp context
- [ ] mixed Axiom + MOP/Prio dispatch from one prepared context
- [-] rerun after context change produces explainable diff

---

## 7. Risks and Sequence Traps

### 7.1 Biggest risk

Trying to implement dispatch refactors before readiness preparation exists.

### 7.2 Second biggest risk

Letting Axiom and MOP/Prio diverge on requirement semantics.

### 7.3 Third biggest risk

Hiding unresolved architecture decisions inside temporary UI workarounds.

### 7.4 Enforcement rule

No new UI-only workaround should be treated as “the fix” unless the preparation engine contract already exists underneath it.

---

## 8. Immediate Next Build Steps

If we start implementation now, the first concrete steps should be:

1. In [appraisal-management-backend](../), define the new types:
   - `ReviewContext`
   - `CriterionResolution`
   - `PrepareReviewProgramsResponse`
2. In [appraisal-management-backend](../), add `ReviewContextAssemblyService`.
3. In [appraisal-management-backend](../), add `ReviewRequirementResolutionService`.
4. In [appraisal-management-backend](../), add `POST /api/review-programs/prepare`.
5. In [l1-valuation-platform-ui](../../l1-valuation-platform-ui), replace direct submit-first behavior in [src/components/order/ReviewProgramWorkspace.tsx](../../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx) with prepare-first behavior.
6. In [axiom](../../axiom), lock the requirement export/consumption contract.
7. Define the MOP/Prio prepared payload contract before touching the current adapter assumptions.

---

## 9. Final Delivery Standard

This build plan is complete only when every repo has:

- clear ownership,
- clear files to touch,
- clear test expectations,
- clear sequencing,
- no hidden dependency on snapshot-only gating.

That is the standard required to build this correctly.