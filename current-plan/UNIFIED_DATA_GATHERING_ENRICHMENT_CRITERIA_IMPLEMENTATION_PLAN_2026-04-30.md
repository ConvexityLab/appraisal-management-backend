# Unified Data Gathering, Enrichment, and Criteria System — Implementation Plan

**Date:** 2026-04-30  
**Status:** Proposed / Active Working Plan  
**Primary Repo:** appraisal-management-backend  
**Related Repos:** l1-valuation-platform-ui, axiom, mortgage-origination-platform, prio  
**Purpose:** Converge bulk upload, manual order entry, document upload/extraction, enrichment, canonical merge, review-program preparation, and multi-engine criteria evaluation into **different entry points to the same underlying data gathering and review system**.

---

## 1. Executive Summary

### 1.1 What this plan is solving

Today, the platform already has meaningful implementation in several areas:

- bulk spreadsheet/blob ingestion,
- manual order entry,
- document upload,
- Axiom extraction,
- property enrichment,
- run-ledger tracking,
- review-program preparation,
- prepared-context dispatch,
- Axiom result persistence.

However, those capabilities are still split across **multiple partially overlapping orchestration paths**.

The key architectural problem is that the platform does **not yet fully behave as one unified system** where:

1. data may arrive from any entry point,
2. all gathered data is normalized into one canonical, provenance-aware model,
3. review programs select subsets of that model for downstream engines,
4. all returned decisions/evidence/document references re-enter the same shared review record.

### 1.2 Target end-state

The target state is a single platform with:

- **many entry points**,
- **one canonical evidence and data graph**,
- **one run/orchestration ledger**,
- **one review-program contract**,
- **many engine adapters**,
- **one normalized results model**.

### 1.3 Bottom-line architectural conclusion

Yes — the codebase is now understood deeply enough to produce a concrete plan.

The implementation evidence is strong enough to say:

- this is **not** a greenfield design exercise,
- the backend spine already exists,
- the right next move is **convergence**, not reinvention.

---

## 2. Non-Negotiable Architecture Rules

These rules govern all work in this plan.

- [ ] **One canonical review system.** Bulk upload, manual entry, and document-driven workflows must feed the same canonical domain model.
- [ ] **No silent fallbacks.** Missing required config, unresolved mappings, or unsupported engine paths must fail explicitly.
- [ ] **No infrastructure creation in app code.**
- [ ] **Immutable run lineage.** Extraction runs, criteria runs, and step reruns remain append-only.
- [ ] **Prepared dispatch is the forward path.** Legacy snapshot-submit and special-case ad hoc engine request shapes must continue to shrink.
- [ ] **Engine parity is contractual.** Axiom and MOP/Prio must both satisfy the same run contract where applicable.
- [ ] **Canonical provenance is mandatory.** Every resolved field and every returned decision must remain traceable.
- [ ] **Document references must be durable and operator-visible.**
- [ ] **Operator UX must reflect the real pipeline state, not inferred guesses.**

---

## 3. Target System Model

## 3.1 Unified conceptual flow

All journeys should converge into this shape:

1. **Entry point receives data**
   - bulk spreadsheet upload,
   - shared-storage file drop,
   - manual order wizard,
   - direct document upload,
   - downstream integration/API submission.

2. **Intake staging / source registration**
   - source artifacts are stored,
   - identifiers/correlation keys are assigned,
   - audit events are emitted.

3. **Canonical evidence graph assembly**
   - order/engagement identity,
   - loan/property identity,
   - uploaded/external documents,
   - extracted document data,
   - provider enrichment,
   - report data,
   - comps,
   - adjustments,
   - provenance.

4. **Canonical snapshot creation / refresh**
   - immutable snapshot tied to a run context,
   - completeness/readiness evaluation,
   - requirement coverage by review program.

5. **Review-program preparation**
   - select review programs,
   - resolve required fields and documents,
   - compute dispatch readiness,
   - produce prepared engine payloads.

6. **Engine execution**
   - Axiom,
   - MOP/Prio,
   - future deterministic or LLM engines.

7. **Result normalization**
   - decisions,
   - evidence refs,
   - returned document refs,
   - scores,
   - structured outputs,
   - warnings/blockers.

8. **Unified review workspace**
   - show gathered data,
   - show readiness,
   - show decisions,
   - show provenance,
   - allow reruns and operator intervention.

## 3.2 Canonical source domains that must become first-class

The durable canonical model must evolve to include these sources as first-class namespaces:

- `order`
- `subjectProperty`
- `documents`
- `documentExtraction`
- `providerData`
- `report`
- `compSelection`
- `adjustments`
- `criteriaResults`
- `provenance`
- `audit`

---

## 4. Current-State Gap Matrix

This matrix is the authoritative implementation status as of **2026-04-30**.

## Status legend

- **Implemented** = production-meaningful code path exists and was directly evidenced.
- **Partial** = meaningful implementation exists, but not yet converged into the target system.
- **Missing** = required target capability was not proven and should be treated as absent.

---

## 4.1 Journey: Bulk onboarding

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Bulk onboarding | Intake API | Implemented | Bulk submission supports multipart, shared-storage, and tape-conversion intake modes with CSV/XLSX + PDF handling. | `src/controllers/bulk-ingestion.controller.ts` | Keep; standardize emitted source-registration contract with other entry points. |
| Bulk onboarding | Shared-storage listener | Implemented | Blob/queue-driven submission path exists for shared-storage ingestion. | `src/jobs/bulk-upload-event-listener.job.ts` | Keep; align storage-event submissions with same source-artifact registry used by manual/API entry. |
| Bulk onboarding | Job orchestration | Implemented | Bulk jobs persist state, stages, retries, and lifecycle control. | `src/services/bulk-ingestion.service.ts` | Keep; converge stage names with run-ledger vocabulary over time. |
| Bulk onboarding | Row canonicalization | Implemented | Canonical worker validates rows against adapter definitions and persists canonical records. | `src/services/bulk-ingestion-canonical-worker.service.ts` | Expand canonical worker so it writes into the same canonical evidence graph contract used elsewhere, not just bulk-local records. |
| Bulk onboarding | Order creation from rows | Implemented | Completed canonical rows can create orders and trigger follow-on work. | `src/services/bulk-ingestion-order-creation-worker.service.ts` | Keep; refactor to create/attach `loanPropertyContext` style identities when that model lands. |
| Bulk onboarding | Document association | Partial | Deterministic document mapping exists conceptually and through job/document maps, but it is still bulk-pipeline-local. | `src/services/bulk-ingestion-canonical-worker.service.ts`, `current-plan/BULK_INGESTION_CORNERSTONE_IMPLEMENTATION_PLAN_2026-03-31.md` | Promote document-association to a shared domain capability so bulk and manual entry use the same attachment/linkage model. |
| Bulk onboarding | Bulk extraction trigger | Implemented | Extraction worker submits Axiom extraction for bulk-created documents/orders. | `src/services/bulk-ingestion-extraction-worker.service.ts` | Route through common extraction-run creation APIs once fully converged. |
| Bulk onboarding | Bulk criteria execution | Partial | Criteria worker exists, with Axiom criteria-only and local-rule fallback paths. | `src/services/bulk-ingestion-criteria-worker.service.ts` | Replace/absorb bulk-local criteria execution into review-program prepared dispatch so bulk becomes another upstream source, not a separate evaluation system. |
| Bulk onboarding | Bulk operator UX parity | Partial | Bulk row drill-through now embeds the same prepared-review workspace used by order review, the standalone bulk loan-detail drawer redirects created orders toward shared order/QC review, bulk results grid row selection routes created rows into shared order review, and the grid now exposes an explicit `Open shared review` affordance for created rows. | `../l1-valuation-platform-ui/src/app/(control-panel)/bulk-portfolios/BulkRowDetailTabs.tsx`, `../l1-valuation-platform-ui/src/app/(control-panel)/bulk-portfolios/BulkQcReviewPanel.tsx`, `../l1-valuation-platform-ui/src/app/(control-panel)/bulk-portfolios/ReviewLoanDetailPanel.tsx`, `../l1-valuation-platform-ui/src/app/(control-panel)/bulk-portfolios/ReviewTapeResultsGrid.tsx` | Continue retiring bulk-local edit surfaces by converting them into redirect/triage shells and closing unified history/result parity gaps; after that, reduce the non-created-row drawer to a lighter inline triage experience if operators no longer need the full local editor. |

---

## 4.2 Journey: Manual order entry

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Manual entry | Backend order creation API | Implemented | Order create/update/search/lifecycle endpoints exist. | `src/controllers/order.controller.ts` | Keep; make sure created identity objects align with future unified context model. |
| Manual entry | Frontend intake wizard | Implemented | Multi-step order wizard exists and calls create-order API. | `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx` | Keep; align wizard state with durable intake/session records instead of local-only draft assumptions. |
| Manual entry | Drafting/resume behavior | Implemented | Draft state persists to localStorage and can resume. | `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx` | Move draft persistence server-side if multi-user/session continuity becomes required. |
| Manual entry | Supporting document upload before submit | Partial | Supporting documents now upload against a draft-scoped entity, reassociate to the created order after submit, and have targeted created-order document-panel coverage in Vitest, but broader parity across all review surfaces is still pending. | `../l1-valuation-platform-ui/src/components/intake/SupportingDocumentsStep.tsx`, `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx`, `../l1-valuation-platform-ui/src/components/intake/supportingDocumentDraftOwner.ts`, `../l1-valuation-platform-ui/src/components/intake/__tests__/OrderIntakeWizard.createdOrderDocuments.test.tsx` | Keep expanding draft -> order provenance visibility across the remaining non-preparation operator surfaces. |
| Manual entry | Enrichment during intake | Partial | Wizard includes enrichment step, but convergence into durable canonical state is not fully unified. | `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx` | Persist enrichment runs through the same run-ledger/canonical refresh path used by document extraction. |
| Manual entry | Review-program handoff | Partial | Manual-created orders can enter the review-program flow, but the intake wizard is not yet obviously designed around the shared prepared-review lifecycle. | `../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx` | Add explicit prepare/review readiness checkpoints after intake completion. |

---

## 4.3 Journey: General document upload and extraction

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Document upload | Backend upload API | Implemented | Documents can be uploaded by `orderId` or by `entityType` + `entityId`. | `src/controllers/document.controller.ts` | Keep; extend explicit document association model for multi-order/engagement reuse. |
| Document upload | Frontend document management | Implemented | Document panel supports listing, category display, preview, comparison, and upload initiation. | `../l1-valuation-platform-ui/src/components/documents/DocumentPanel.tsx` | Keep; connect more directly to unified review readiness and evidence surfaces. |
| Document upload | Interactive upload zone | Implemented | Upload zone supports category selection, upload progress, optional Axiom auto-processing, and stream tracking. | `../l1-valuation-platform-ui/src/components/documents/DocumentUploadZone.tsx` | Keep; move remaining Axiom-specific UI assumptions behind engine-neutral orchestration where possible. |
| Document upload | Enhanced bulkish upload dialog | Implemented | Enhanced upload component supports drag-drop, multi-file, and optional analysis trigger. | `../l1-valuation-platform-ui/src/components/documents/EnhancedDocumentUpload.tsx` | Decide whether to keep both upload UIs or converge on one shared component. |
| Extraction orchestration | Run-ledger-backed document extraction | Implemented | Axiom webhook orchestration creates extraction run(s), builds/refeshes snapshot(s), and starts criteria steps. | `src/controllers/axiom.controller.ts`, `src/services/run-ledger.service.ts` | Keep; route all extraction entry points through the same explicit extraction-run service contract. |
| Extraction results persistence | Document extraction write-back | Implemented | Axiom pipeline results are fetched and written back into `documents.extractedData`, then snapshot refresh is attempted. | `src/services/axiom.service.ts` | Keep; formalize extracted artifact schema and version metadata. |
| Extraction engine parity | MOP/Prio extraction parity | Missing | Current review found no proven MOP/Prio extraction path equivalent to Axiom’s implemented flow. | Proof absent in current review | Implement engine adapters and run-hydration parity or explicitly scope extraction to Axiom-only until parity is real. |

---

## 4.4 Journey: Canonical merge / shared data model

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Canonical merge | Snapshot persistence | Implemented | Canonical snapshots are persisted in `aiInsights` and linked to runs. | `src/services/canonical-snapshot.service.ts`, `current-plan/RUN_LEDGER_CANONICAL_DATA_MODEL.md` | Keep; expand schema breadth. |
| Canonical merge | Normalized snapshot fields | Partial | Snapshot currently includes `subjectProperty`, `extraction`, `providerData`, and `provenance`. | `src/services/canonical-snapshot.service.ts` | Expand normalized snapshot to include report, comps, adjustments, document inventory, and normalized criteria-result references. |
| Canonical merge | Property enrichment integration | Implemented | Latest property enrichment is included in snapshot construction. | `src/services/canonical-snapshot.service.ts` | Keep; formalize provider conflict/precedence rules. |
| Canonical merge | Multi-source convergence | Partial | Richer review context supplements snapshot with report/comp/adjustment info, but those are not durable first-class snapshot fields. | `src/services/review-context-assembly.service.ts` | Converge review-context-only fields into canonical snapshot or canonical evidence graph. |
| Canonical merge | Provenance/evidence refs | Partial | Provenance exists in snapshots and evidence refs exist in review context and step-input slices. | `src/services/canonical-snapshot.service.ts`, `src/services/criteria-step-input.service.ts`, `src/services/review-context-assembly.service.ts` | Make provenance a formal cross-cutting schema with field-level source lineage where needed. |
| Canonical merge | Report/comps/adjustments as dispatchable first-class data | Missing | Present only as summary-level enrichments in review context, not as first-class canonical namespaces. | `src/services/review-context-assembly.service.ts` | Add durable canonical sections such as `report`, `compSelection`, and `adjustments`. |

---

## 4.5 Journey: Review-program preparation and dispatch

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Review preparation | Context assembly | Implemented | Preparation assembles order, docs, enrichment, runs, programs, latest report, comp summary, adjustment summary. | `src/services/review-context-assembly.service.ts` | Keep; shrink differences between review context and canonical snapshot over time. |
| Review preparation | Prepared-context persistence | Implemented | Prepared review contexts and planned engine dispatches are persisted. | `src/services/review-prepared-context.service.ts` | Keep; make prepared artifact the stable operator-facing review checkpoint. |
| Review preparation | Requirement resolution/readiness | Implemented | The current backend supports readiness states and unmet requirements in prepared flows. | `src/services/review-requirement-resolution.service.ts`, `src/services/review-preparation.service.ts` | Keep; extend to new canonical namespaces once added. |
| Dispatch assembly | Prepared payload builder | Implemented | Criteria payloads include resolved values, matched documents, unmet required inputs, criteria summary, and provenance summary. | `src/services/prepared-dispatch-payload-assembly.service.ts` | Keep; expand resolvable source namespaces beyond current set. |
| Dispatch execution | Prepared dispatch orchestration | Implemented | Prepared dispatch supports `all_ready_only` and `include_partial`, with blocking logic. | `src/services/review-dispatch.service.ts` | Keep; make this the only criteria dispatch path over time. |
| Dispatch source coverage | Full canonical field coverage | Partial | Resolved data values currently come from `order`, `subjectProperty`, `extraction`, `providerData`, `provenance`. | `src/services/prepared-dispatch-payload-assembly.service.ts` | Add `report`, `compSelection`, `adjustments`, normalized `documents`, and normalized prior-results references. |
| Dispatch receiver parity | MOP/Prio prepared-dispatch parity | Partial | Backend can generate/send strict prepared payloads, but downstream receiver parity was not proven from current repo review. | `src/services/review-prepared-context.service.ts`, `src/services/engine-dispatch.service.ts` | Verify and harden matching receiver contracts in `mortgage-origination-platform` / `prio`. |

---

## 4.6 Journey: Criteria execution, step slicing, and result normalization

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Criteria execution | Run-ledger criteria runs | Implemented | Criteria runs and criteria-step runs are persisted with engine refs and lineage. | `src/services/run-ledger.service.ts` | Keep; ensure all criteria journeys converge here. |
| Criteria execution | Step input slices | Implemented | Step-specific input slices and evidence refs are persisted. | `src/services/criteria-step-input.service.ts` | Keep; allow slices from richer canonical namespaces once model is expanded. |
| Criteria execution | Step rerun lineage | Implemented | Criteria-step reruns and lineage support exist in run ledger. | `src/services/run-ledger.service.ts` | Keep; expose better UI affordances for rerun reason/audit. |
| Criteria execution | Axiom criteria result persistence | Implemented | Axiom webhook/result retrieval stores decisions, criteria outputs, and extraction outputs. | `src/services/axiom.service.ts` | Keep; normalize results into engine-neutral schema. |
| Criteria execution | Engine-neutral normalized results model | Missing | No single proven normalized result model for Axiom + MOP/Prio was evidenced. | Proof absent in current review | Create unified `criteria-result-artifact` contract with per-engine mapping adapters. |
| Criteria execution | Returned document/evidence refs normalization | Partial | Axiom result enrichment exists, but shared cross-engine normalized evidence/document ref handling is not yet proven. | `src/services/axiom.service.ts` | Introduce shared result-normalization service and cross-engine document/evidence reference schema. |
| Criteria execution | UI result parity | Partial | Review-program UI exists, but evidence of one complete cross-engine results surface is still incomplete. | `../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx` | Expand workspace into canonical review/results console rather than dispatch-only view. |

---

## 4.7 Journey: Operator review and audit UX

| Journey | Subsystem | Status | Current implementation | Proof file(s) | Recommended fix |
|---|---|---:|---|---|---|
| Operator review | Review workspace | Partial | Prepared review workspace exists and is aligned to the prepared-context path. | `../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx` | Expand from dispatch/preparation surface to full evidence/readiness/decision console. |
| Operator review | Document-centric operator workflow | Implemented | Document panel and upload tooling are real and integrated. | `../l1-valuation-platform-ui/src/components/documents/DocumentPanel.tsx` | Integrate document evidence state into canonical review readiness. |
| Operator review | Run artifact visibility | Partial | Run ledger and step slice storage exist, but operator-facing surfaces are not yet clearly unified across all journeys. | `current-plan/RUN_LEDGER_CANONICAL_DATA_MODEL.md`, `src/services/run-ledger.service.ts` | Build unified run history / artifact viewer in UI. |
| Operator review | Cross-journey audit trail | Partial | Strong eventing/run persistence exists, but one operator-facing audit timeline across entry points is not yet proven. | `src/services/audit-event-sink.service.ts`, run-ledger services, ingestion services | Add unified timeline APIs and UI panels keyed by engagement/order/context. |

---

## 5. Architecture Decision: How the Journeys Come Together

The correct convergence strategy is:

### 5.1 Keep entry points separate

We should **not** force bulk upload, manual order entry, and document upload into one UI flow.

They are legitimately different entry points.

### 5.2 Converge everything after source registration

The convergence point should be:

- source artifact registration,
- canonical identity resolution,
- evidence graph population,
- canonical snapshot creation,
- review-program preparation,
- engine dispatch,
- result normalization,
- operator review.

### 5.3 Practical design rule

**Different entry points; same mid-pipeline and downstream pipeline.**

That is the organizing principle for all remaining work.

---

## 6. Dated Convergence Plan

## Phase 0 — Freeze target contracts and stop drift
**Target window:** 2026-04-30 to 2026-05-03

### Goals

- Lock the target system vocabulary.
- Stop adding new one-off workflow shapes.
- Define what “same system” means structurally.

### Deliverables

- [ ] Approve this plan as the active convergence document.
- [ ] Freeze canonical namespace vocabulary.
- [ ] Freeze prepared-dispatch contract extension strategy.
- [ ] Freeze result-normalization target schema.
- [ ] Decide whether bulk criteria worker remains temporary or is immediately put on deprecation path.

### Exit criteria

- [ ] Team agrees that all new work lands in shared contracts first.
- [ ] No new ad hoc engine request/response shapes are introduced.

---

## Phase 1 — Canonical identity and source registration convergence
**Target window:** 2026-05-03 to 2026-05-10

**Implementation progress (2026-04-30):**

- [x] Manual intake supporting documents no longer upload against fake order IDs.
- [x] Draft-scoped intake documents are reassociated to the created order on submit.
- [x] Draft-origin linkage is now surfaced in backend review/prepared document summaries.
- [x] Review workspace now exposes draft-origin and reassociation lineage in the prepared artifact view.
- [x] Controller-level backend coverage now verifies `intakeDraftId` reassociation and audit provenance.
- [x] Created-order document-panel coverage now proves reassociated intake documents are visible after manual submit.
- [x] Shared intake source identity helpers now exist for manual-draft, bulk-item, and API-order entry points.
- [x] Shared source identity now propagates into review-context identity, run-ledger records, canonical snapshots, and snapshot provenance.
- [x] Bulk job submission, bulk canonicalization, and bulk order creation now stamp/extend the same shared source-identity contract end-to-end.
- [x] Review preparation UI now exposes full entry-point lineage for manual draft, bulk item, and API-order sources.
- [x] Bulk row drill-through now reuses the same `ReviewProgramWorkspace`/prepared-review path used by standard order review.
- [x] Review-context coverage now proves manual-created and bulk-created orders converge to the same shared context identity contract.
- [x] Dedicated review-context coverage now proves bulk row canonical identity survives into shared context, snapshot, and run lineage.
- [x] Non-preparation operator parity now includes order detail and bulk submission-detail source-identity summaries.
- [x] QC detail now shows the same shared source-identity summary used by other operator surfaces.
- [x] Document run-ledger history and recent review-program run history now show the same shared source-origin lineage outside the preparation flow.
- [x] Phase 1 recommendation is to keep bulk-local history/result grids as compact triage/deep-link surfaces and consolidate authoritative review work inside the shared order/QC drill-through.
- [x] The standalone bulk loan-detail drawer now switches created orders into redirect mode, sending operators to shared order/QC review instead of preserving bulk-local override editing.
- [x] The bulk results grid now routes created rows straight into shared order review, making the legacy bulk drawer a fallback only for rows that do not yet have persisted orders.
- [x] The bulk results grid now shows an explicit `Open shared review` action for created rows, and the remaining open UX question is whether non-created rows still need the full legacy drawer or can move to a smaller inline triage treatment later.
- [x] The remaining non-created-row fallback is now a compact inline triage panel in the bulk results surface, so the full standalone drawer is no longer part of the operator path.

**Authoritative identifier contract (Phase 1)**

- `draft`: `intakeDraftId` is authoritative until a persisted order exists.
- `bulk row`: `bulkJobId` + `bulkItemId` are authoritative until a persisted order exists.
- `order`: `orderId` is authoritative for shared review identity, with `engagementId` / `loanPropertyContextId` preserved as correlation anchors.
- `snapshot`: canonical snapshot `id` is authoritative for the materialized evidence state, and must carry `sourceIdentity` forward.
- `run`: run-ledger `id` is authoritative for execution lineage, with `snapshotId`, `preparedContextId`, and `sourceIdentity` linking back to canonical state and intake origin.

### Goals

Create a shared intake identity model that all entry points can use.

### Work

- [x] Define shared source-registration records for:
  - bulk item source,
  - manual intake draft/session,
  - document source,
  - integration/API source.
- [ ] Introduce or formalize unified context identity fields:
  - `engagementId`
  - `loanPropertyContextId`
  - `orderId`
  - `documentId`
  - source artifact refs
- [x] Fix manual intake supporting-document uploads so they bind to a real persisted identity.
- [x] Document explicit document-association model for reuse across orders/engagements.

### Primary files likely touched

- `src/controllers/order.controller.ts`
- `src/controllers/document.controller.ts`
- `src/services/*bulk-ingestion*`
- `../l1-valuation-platform-ui/src/components/intake/OrderIntakeWizard.tsx`
- `../l1-valuation-platform-ui/src/components/intake/SupportingDocumentsStep.tsx`

### Exit criteria

- [ ] Any entry point can create/attach documents without fake or unstable IDs.
- [ ] Every source artifact has deterministic linkage to the shared context model.

---

## Phase 2 — Expand canonical snapshot into canonical evidence graph
**Target window:** 2026-05-10 to 2026-05-20

### Goals

Turn the current narrow snapshot into the durable shared data model the whole platform can use.

### Work

- [ ] Expand canonical snapshot/evidence graph schema to include:
  - `documents`
  - `report`
  - `compSelection`
  - `adjustments`
  - richer `provenance`
- [ ] Preserve current `subjectProperty`, `extraction`, `providerData`, `provenance` structure for compatibility.
- [ ] Define merge precedence rules between:
  - source spreadsheet fields,
  - document extraction,
  - provider enrichment,
  - report data,
  - manual overrides.
- [ ] Add completeness/readiness evaluation based on canonical sections.
- [ ] Formalize canonical field-level provenance where high-risk decisions depend on it.

### Primary files likely touched

- `src/services/canonical-snapshot.service.ts`
- `src/services/review-context-assembly.service.ts`
- `src/types/*run-ledger*`
- `src/types/review-context.types.ts`
- `src/types/review-preparation.types.ts`

### Exit criteria

- [ ] Review context no longer needs to carry critical data that canonical persistence lacks.
- [ ] Comps and adjustments are durable canonical inputs, not summary-only sidecars.

---

## Phase 3 — Make review-program preparation the universal readiness engine
**Target window:** 2026-05-20 to 2026-05-28

### Goals

Make prepared review context the universal “ready/not ready/partially ready” checkpoint for all journeys.

### Work

- [ ] Ensure bulk onboarding feeds into review preparation rather than separate bulk-local criteria logic.
- [ ] Expand requirement resolution to new canonical namespaces.
- [ ] Add readiness rules for:
  - required report sections,
  - comp selection,
  - adjustments,
  - mandatory provider fields,
  - engine-specific required artifacts.
- [ ] Persist gap details in stable operator-facing artifacts.

### Primary files likely touched

- `src/services/review-preparation.service.ts`
- `src/services/review-requirement-resolution.service.ts`
- `src/services/review-prepared-context.service.ts`
- `src/services/bulk-ingestion-criteria-worker.service.ts`

### Exit criteria

- [ ] Bulk, manual, and document-first flows all produce the same style of prepared review artifact.

---

## Phase 4 — Expand prepared-dispatch payload coverage
**Target window:** 2026-05-28 to 2026-06-05

### Goals

Allow review programs to dispatch against the full canonical dataset, not only current snapshot subsets.

### Work

- [ ] Add new payload source namespaces to prepared payload resolution:
  - `report`
  - `compSelection`
  - `adjustments`
  - normalized `documents`
  - prior normalized `criteriaResults` where appropriate
- [ ] Extend criterion binding rules to reference those namespaces.
- [ ] Preserve current payload contract versions while adding a clear next contract version.
- [ ] Add tests for mixed-source resolution and unmet-input reporting.

### Primary files likely touched

- `src/services/prepared-dispatch-payload-assembly.service.ts`
- `src/services/review-requirement-resolution.service.ts`
- `src/types/review-preparation.types.ts`
- tests for preparation/dispatch services

### Exit criteria

- [ ] Review programs can request values from full canonical namespaces.
- [ ] Operators can see exactly which canonical sources fed each dispatch.

---

## Phase 5 — Engine adapter parity and normalized result contracts
**Target window:** 2026-06-05 to 2026-06-18

### Goals

Create a truly engine-neutral execution/result model.

### Work

- [ ] Verify and/or implement MOP/Prio receiver compatibility for prepared payloads.
- [ ] Create unified normalized result artifact schema:
  - decision
  - score
  - criterion results
  - evidence refs
  - document refs
  - engine metadata
  - warnings/errors
- [ ] Add per-engine mappers:
  - Axiom -> normalized result
  - MOP/Prio -> normalized result
- [ ] Persist normalized results back into the shared review system.
- [ ] Decide whether bulk-local criteria result records are deprecated or migrated.

### Primary repos/files likely touched

- `src/services/engine-dispatch.service.ts`
- `src/services/axiom.service.ts`
- downstream `mortgage-origination-platform`
- downstream `prio`

### Exit criteria

- [ ] Prepared dispatches round-trip through both engines into one normalized result contract.
- [ ] Downstream UI does not need engine-specific result parsing.

---

## Phase 6 — Unified operator workspace
**Target window:** 2026-06-18 to 2026-06-30

### Goals

Turn the current review workspace into the main control plane for the whole system.

### Work

- [ ] Expand review workspace to show:
  - entry-point origin,
  - gathered sources,
  - canonical completeness,
  - unresolved gaps,
  - prepared dispatches,
  - returned normalized results,
  - run history,
  - evidence/document references,
  - rerun actions.
- [ ] Add unified timeline/history view.
- [ ] Add artifact drill-down:
  - canonical snapshot,
  - prepared artifact,
  - step input slices,
  - normalized results.
- [ ] Ensure bulk jobs can drill into the same workspace.

### Primary files likely touched

- `../l1-valuation-platform-ui/src/components/order/ReviewProgramWorkspace.tsx`
- backend review artifact/result endpoints
- run history endpoints/UI

### Exit criteria

- [ ] Operator can manage all journeys from one review console.

---

## Phase 7 — Legacy path retirement
**Target window:** 2026-06-30 to 2026-07-10

### Goals

Retire duplicate evaluation paths and enforce convergence.

### Work

- [ ] Deprecate snapshot-rooted direct criteria submission where prepared dispatch is available.
- [ ] Deprecate bulk-local criteria pipeline once parity is confirmed.
- [ ] Remove special-case UI flows that bypass preparation/readiness.
- [ ] Remove duplicated result parsing logic from frontend.

### Exit criteria

- [ ] One dominant evaluation path remains.
- [ ] Old paths are either removed or clearly marked compatibility-only with shutdown date.

---

## 7. Workstreams and Ownership Checklist

## Workstream A — Entry-point convergence

- [ ] Bulk source registration aligned with shared identity model
- [ ] Manual intake draft/upload convergence completed
- [ ] Document association model made explicit
- [ ] Integration/API submissions aligned with shared context IDs

## Workstream B — Canonical model expansion

- [ ] Snapshot schema expanded
- [ ] Report/comps/adjustments made first-class
- [ ] Provenance model formalized
- [ ] Canonical completeness rules implemented

## Workstream C — Review preparation convergence

- [ ] Bulk uses prepared review path
- [ ] Requirement resolution extended to new namespaces
- [ ] Prepared artifacts expose all unmet gaps consistently

## Workstream D — Engine parity

- [ ] Prepared payload contract verified in Axiom
- [ ] Prepared payload contract verified in MOP/Prio
- [ ] Normalized result contract implemented
- [ ] Cross-engine result parity tests passing

## Workstream E — UI convergence

- [ ] Review workspace becomes unified operator console
- [ ] Run history/artifact drill-downs implemented
- [ ] Bulk drill-through integrated
- [ ] Intake and document UIs show readiness/provenance linkages

---

## 8. Test and Validation Plan

## 8.1 Required test layers

- [ ] Backend unit tests for canonical merge expansion
- [ ] Backend unit tests for requirement resolution on new namespaces
- [ ] Backend unit tests for prepared payload assembly on report/comp/adjustment fields
- [ ] Backend integration tests for manual intake -> canonical -> prepare
- [ ] Backend integration tests for bulk -> canonical -> prepare
- [ ] Backend integration tests for document upload -> extraction -> snapshot refresh -> prepare
- [ ] Contract tests for Axiom prepared payload dispatch
- [ ] Contract tests for MOP/Prio prepared payload dispatch
- [ ] Result-normalization tests across both engines
- [ ] Frontend tests for review workspace unified console behavior

## 8.2 Release gates

- [ ] No fake ID document attachments remain in intake flow
- [ ] Canonical snapshot contains all required review namespaces
- [ ] Bulk and manual entry produce same prepared review artifact shape
- [ ] Both engines can consume prepared payloads where promised
- [ ] Returned decisions render through same UI model

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Canonical schema expansion becomes too disruptive | High | Add namespaces compatibly, keep old fields readable during migration, version contracts explicitly. |
| Bulk criteria path diverges further before convergence | High | Freeze new bulk-local criteria features and prioritize prepared-path adoption. |
| MOP/Prio parity proves weaker than expected | High | Treat as explicit workstream with contract tests and staged release, not assumed parity. |
| UI keeps growing as thin wrappers around backend quirks | Medium | Define one operator console model and refactor toward it incrementally. |
| Provenance requirements expand complexity | Medium | Start with namespace-level provenance, then deepen to field-level where decisions demand it. |

---

## 10. Immediate Next Steps

These are the next concrete actions to start the convergence work correctly.

### Next slice to execute

- [ ] Confirm this document as the active plan of record.
- [~] Create follow-up implementation tickets for:
  - draft-to-order reassociation end-to-end UI coverage,
  - remaining run-history/operator-history source-origin parity,
  - canonical snapshot expansion,
  - prepared payload namespace expansion,
  - MOP/Prio contract verification,
  - unified normalized result schema.
- [ ] Decide whether bulk criteria worker is officially transitional.
- [ ] Close the remaining Phase 1 evidence/parity gaps before taking on broad Phase 2 canonical expansion work.

**Bulk history decision:** keep job-history rows deep-link only for lineage. The history grid remains job-centric and compact; authoritative intake lineage lives in the updated order detail, bulk detail, and QC detail surfaces.

### Recommended implementation order

1. Close remaining Phase 1 coverage/parity gaps.
2. Expand canonical snapshot/evidence graph.
3. Extend review requirement resolution and prepared payload coverage.
4. Verify/implement MOP/Prio parity.
5. Unify result model.
6. Expand operator workspace.
7. Retire duplicate paths.

---

## 11. Final Recommendation

This plan should now serve as the central convergence document.

The right move is **not** to keep patching each journey independently.
The right move is to:

- preserve the existing working entry points,
- converge their shared middle and downstream layers,
- then retire duplicate orchestration and result models.

That is how these journeys become **different doors into the same system** instead of different systems that happen to touch the same orders.
