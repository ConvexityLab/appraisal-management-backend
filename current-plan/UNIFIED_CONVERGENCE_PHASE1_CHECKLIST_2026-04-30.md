# Unified Convergence Phase 1 Checklist

**Date:** 2026-04-30  
**Parent plan:** [UNIFIED_DATA_GATHERING_ENRICHMENT_CRITERIA_IMPLEMENTATION_PLAN_2026-04-30.md](./UNIFIED_DATA_GATHERING_ENRICHMENT_CRITERIA_IMPLEMENTATION_PLAN_2026-04-30.md)  
**Phase:** Phase 1 — Canonical identity and source registration convergence  
**Status:** Active  

---

## Goal

Remove unstable/fake document linkage at intake boundaries and establish the shared identity conventions that let bulk, manual entry, and document-first journeys converge into one canonical review pipeline.

## May 1, 2026 code-verified reality check

### Verified in code now

- [x] Prepared review-context flow is real, not aspirational: backend prepare/persist/retrieve/diff/dispatch routes exist and the UI is already consuming them.
- [x] Source-identity lineage now propagates across order creation, prepared review context assembly, run-ledger records, and shared QC/order presentation components.
- [x] Intake-draft document reassociation is implemented with preserved origin metadata instead of losing provenance when the real order is created.
- [x] Prepared engine payloads are no longer doc-only theory; they are persisted, referenced from run-ledger records, and exercised in backend tests for both Axiom and MOP/Prio dispatch paths.

### Still missing for this to be truly production-worthy

#### Backend

- [ ] Remove the legacy snapshot-first `/api/review-programs/:id/submit` path as a first-class execution contract. The prepared-context flow exists, but the old route is still live, which keeps two orchestration models in production at once.
- [ ] Replace heuristic comp/adjustment blocker detection with explicit report/comp/adjustment bindings. Today readiness still uses path-keyword inference in the requirement resolver, which is better than nothing but not the final correctness bar.
- [ ] Persist and expose criterion-level terminal outcome taxonomy (`cannot_evaluate`, `skipped_missing_requirements`, etc.) instead of mostly leg-level submission status plus blocker strings.

#### UI / UX

- [ ] Remove the workspace fallback that retries a single program through the old direct-submit mutation when prepared dispatch fails. That is migration safety logic, not a final operator workflow.
- [ ] Wire the newer QC and report-builder operator panels into real page flows. Several production-intent components now exist and have tests, but they are not yet proven as mounted, navigable surfaces in the primary operator journeys.
- [ ] Tighten the final operator experience around partial dispatch, failed engine legs, and rerun deltas so the primary page makes those states obvious without relying on toast/snackbar reading.

#### Operations

- [ ] Stop treating missing engine configuration as an acceptable runtime skip in production. Today a missing `MOP_PRIO_API_BASE_URL` simply skips the leg instead of failing deployment or startup checks.
- [ ] Replace process-local cascade reevaluation dedupe with a distributed/idempotent guard that works across multiple app instances.
- [ ] Fail fast or hard-gate startup for critical background/health bootstrap failures instead of logging the error and continuing to serve traffic in a degraded state.

---

## Ticket breakdown

### P1-01 — Stop fake order IDs in manual intake document uploads

**Status:** [~] In progress  
**Priority:** Critical  
**Why:** The order-intake wizard currently uploads supporting documents using a locally generated wizard `orderId`, which is not guaranteed to be a real persisted order.

**Exact files**

- `../l1-valuation-platform-ui/src/components/intake/SupportingDocumentsStep.tsx`
- `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx`
- `../l1-valuation-platform-ui/src/components/intake/supportingDocumentDraftOwner.ts`
- `../l1-valuation-platform-ui/src/types/backend/document.types.ts`
- `../l1-valuation-platform-ui/src/components/intake/__tests__/supportingDocumentDraftOwner.test.ts`
- `src/types/document.types.ts`

**Implementation checklist**

- [x] Introduce explicit draft-scoped document ownership in the frontend document entity vocabulary.
- [x] Upload intake supporting documents as entity-scoped draft attachments instead of fake order attachments.
- [x] Add follow-up reassociation flow so draft documents move/attach to the created order automatically after submit.
- [x] Add backend audit event for draft -> order document reassociation.
- [x] Surface draft-origin linkage in backend review/prepared document summaries.
- [x] Surface draft-origin linkage visibly in the review workspace/prepared artifact view.

**Tests**

- [x] Frontend component test proves draft uploads use entity-scoped props.
- [x] Frontend integration test proves submitted draft documents appear on created order after reassociation.
- [x] Backend test proves reassociation preserves provenance and document history.

**Remaining open items**

- Confirm the final created-order document surface covers every reassociated intake category expected by the workflow.
- Re-check whether any non-wizard upload path still assumes a fake/manual temporary `orderId`.

---

### P1-02 — Define shared intake source identity contract

**Status:** [~] In progress  
**Priority:** Critical

**Exact files**

- `src/types/run-ledger.types.ts`
- `src/types/review-context.types.ts`
- `src/types/document.types.ts`
- `src/services/review-context-assembly.service.ts`
- `src/services/canonical-snapshot.service.ts`

**Implementation checklist**

- [x] Define shared source registration fields for manual draft, bulk item, uploaded document, and API-submitted order.
- [x] Standardize `engagementId`, `loanPropertyContextId`, `orderId`, `documentId`, and source-artifact refs across flows.
- [x] Document which identifiers are authoritative at each stage.

**Implementation progress**

- [x] Introduced shared backend `IntakeSourceIdentity` helpers for manual-draft, bulk-item, and API-order entry points.
- [x] Manual `createOrder` now stamps shared source-identity metadata onto created orders.
- [x] Bulk order creation now stamps shared source-identity metadata onto created orders.
- [x] Bulk job submission and bulk canonicalization now emit the same shared source-identity contract into persisted jobs, items, canonical records, and created-order lineage.
- [x] Review context identity, latest snapshot summaries, run-ledger runs, and criteria step runs now surface shared source identity.
- [x] Canonical snapshot creation/refresh now carries shared source identity into stored snapshot materialization and provenance.
- [x] Comparative review-context coverage now proves manual-created and bulk-created orders converge to the same shared context identity contract while retaining source-specific anchors.

**Authoritative identifier contract**

- `draft` stage: `intakeDraftId` is authoritative for manual entry before order creation; no draft-scoped flow should treat a future `orderId` as authoritative before persistence.
- `bulk row` stage: `bulkJobId` + `bulkItemId` are authoritative for bulk intake before order creation; `sourceArtifactRefs` must retain the `bulk-ingestion-job` / `bulk-ingestion-item` anchors.
- `order` stage: persisted `orderId` becomes authoritative for cross-system review identity, while `engagementId` and `loanPropertyContextId` remain the shared correlation keys when already known.
- `snapshot` stage: canonical snapshot `id` is authoritative for materialized evidence state; snapshot lineage must continue carrying `sourceIdentity`, `engagementId`, and `loanPropertyContextId` so upstream entry-point anchors are not lost.
- `run` stage: run-ledger `id` is authoritative for execution lineage; `snapshotId`, `preparedContextId`, and `sourceIdentity` bind the run back to canonical state and intake origin.

**Tests**

- [x] Unit tests for identity resolution helpers.
- [x] Comparative test proving manual and bulk journeys produce equivalent shared context IDs.

**Remaining open items**

- Verify that all remaining bulk canonical/materialization paths emit the same identity fields without lossy translation.

---

### P1-03 — Make document association explicit and reusable

**Status:** [~] In progress  
**Priority:** High

**Exact files**

- `src/services/document.service.ts`
- `src/controllers/document.controller.ts`
- `src/types/document.types.ts`
- `current-plan/RUN_LEDGER_CANONICAL_DATA_MODEL.md`

**Implementation checklist**

- [x] Introduce explicit association record or association metadata contract for reusable documents.
- [x] Support draft-scoped, order-scoped, and engagement-scoped document linkage without ambiguity.
- [x] Add deterministic reassociation rules when a draft becomes an order.

**Tests**

- [x] Backend tests for association creation and reassociation.
- [x] API tests for listing by draft entity, order entity, and final associated order.

**Remaining open items**

- Fold the explicit document-association contract into any canonical/review docs that still describe the older implicit linkage model.
- Check whether reusable association metadata is surfaced consistently in all operator-facing document views, not just prepared artifact flows.

---

### P1-04 — Align bulk source registration with shared identity model

**Status:** [~] In progress  
**Priority:** High

**Exact files**

- `src/services/bulk-ingestion.service.ts`
- `src/services/bulk-ingestion-canonical-worker.service.ts`
- `src/services/bulk-ingestion-order-creation-worker.service.ts`
- `src/types/bulk-ingestion.types.ts`

**Implementation checklist**

- [x] Stamp shared source identity metadata onto bulk jobs/items.
- [x] Ensure canonicalized bulk rows produce the same shared context identities used by manual/API entry.
- [x] Prepare bulk outputs for the same prepared-review flow used by order review.

**Implementation progress**

- [x] Bulk job submission now stamps shared `bulk-item` source identity onto persisted jobs and rows.
- [x] Canonical bulk records now carry shared source identity instead of remaining bulk-local only.
- [x] Bulk order creation now extends row identity into created-order lineage and mirrors it back into canonical/job artifacts.
- [x] Bulk row drill-through now embeds the same `ReviewProgramWorkspace` used by order review so prepared context history, diffing, and dispatch are available directly from created bulk artifacts.

**Tests**

- [x] Integration coverage now proves both bulk-created orders and bulk canonical records converge to the shared context identity contract.
- [x] Regression test that existing bulk workflows still complete.

**Remaining open items**

- Confirm that every bulk-created artifact path that can open review/QC uses the shared prepared-review drill-through.
- Decide whether any remaining bulk-local criteria/result surfaces should be downgraded, redirected, or retired during Phase 1.

---

### P1-05 — Establish Phase 1 operator visibility

**Status:** [~] In progress  
**Priority:** Medium

**Exact files**

- `../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx`
- backend artifact/history endpoints as needed

**Implementation checklist**

- [x] Surface entry-point origin (`manual draft`, `bulk item`, `document upload`, etc.) in the review workspace.
- [x] Show whether a document is draft-scoped, order-scoped, or engagement-scoped.
- [x] Expose unresolved source-linkage gaps before dispatch.

**Implementation progress**

- [x] Prepared artifact UI now shows per-document origin and reassociation details for draft-linked evidence.
- [x] Preparation UI now shows entry-point lineage for manual-draft, bulk-item, API-order, snapshot, and run-ledger provenance.
- [x] Bulk created-order drill-through now surfaces the same prepared-review workspace directly from the bulk results grid.
- [x] Order detail and bulk submission-detail surfaces now show shared source identity outside the preparation workspace.
- [x] QC detail now shows the shared source identity summary alongside review-program launch controls and active review content.
- [x] Run-history/operator-history surfaces now show the same shared source identity in the document run ledger and recent review-program run history.
- [x] Recommended Phase 1 disposition for remaining bulk-local criteria/result views is to keep grid/history pages as triage entry points only and favor shared order/QC drill-through as the authoritative review surface.
- [x] Standalone bulk loan-detail drawers now redirect created orders toward shared order/QC review and stop offering bulk-local reviewer overrides once canonical order drill-through exists.
- [x] Bulk results grid row selection now prefers direct shared order drill-through for created rows, further reducing entry into the legacy bulk-local drawer.
- [x] Bulk results grid now exposes an explicit `Open shared review` action for created rows so operators can jump into the shared order workflow without relying on row-selection behavior.
- [x] Created-row `AI Analysis` inside `BulkRowDetailTabs` now behaves as a redirect-first summary that points operators to the shared review/documents/QC workflows instead of reviving a second bulk-local review console.
- [x] Focused Vitest coverage now asserts the redirect-first created-row behavior and the non-created-row informational states for `BulkRowDetailTabs`.

**Tests**

- [x] Frontend tests for source-origin rendering.
- [x] Backend contract tests for source-origin fields in prepared artifacts.
- [x] Focused `BulkRowDetailTabs` regression verifies created-row redirect-first AI review behavior.

**Remaining open items**

- Bulk history rows will remain deep-link only for lineage; the job-history grid stays compact and operators should open the updated order/QC/detail surfaces for authoritative source identity.
- Keep `ReviewTapeResultsGrid` and bulk history pages focused on batch triage, status, and navigation; avoid expanding them into duplicate authoritative criteria/result consoles.
- Prefer gradual redirect/retirement of standalone bulk-local row review/detail experiences when the shared order/QC drill-through covers the same operator task with better lineage fidelity.
- Apply the same redirect-first retirement pattern to any remaining bulk-local edit surfaces before removing them outright.
- [x] Replaced the non-created-row legacy bulk drawer with a compact inline triage panel embedded directly below the bulk results grid.
- Inline triage now handles quick reviewer notes and overrides before order creation, while created rows continue to deep-link directly into the shared order/QC review workflow.

---

## Suggested execution order

1. `P1-01` — stop fake order IDs immediately.
2. `P1-02` — define the shared identity contract.
3. `P1-03` — make document association explicit.
4. `P1-04` — align bulk identities.
5. `P1-05` — improve operator visibility.

---

## Exit criteria for Phase 1

- [ ] No intake or upload flow depends on fake order identifiers.
- [ ] Shared identity fields are defined and used consistently across manual and bulk journeys.
- [ ] Documents can be traced from draft/source state into final order/review state.
- [ ] Review artifacts expose source-origin metadata clearly enough for operators and downstream orchestration.