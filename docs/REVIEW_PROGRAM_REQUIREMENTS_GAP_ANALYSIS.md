# Review Program Execution Requirements Gap Analysis

**Date:** April 29, 2026  
**Status:** In progress — backend largely implemented, end-to-end cleanup still open

**Repo-specific execution plan:** [docs/REVIEW_PROGRAM_REPO_BUILD_PLAN.md](REVIEW_PROGRAM_REPO_BUILD_PLAN.md)

## Purpose

This document compares the intended review-program workflow against what is currently implemented across the order UI, backend orchestration layer, run ledger, canonical snapshot model, Axiom integration, and MOP/Prio dispatch.

The goal is to answer one question clearly:

> Why does the current system still behave as if a prior extraction snapshot is mandatory, when the actual product requirement is to gather all required data for the selected review program and evaluate each criterion against the best available data source?

## Implementation progress snapshot

Implemented so far:

- backend preparation contracts now exist for review context, criterion resolution, program readiness, and prepare request/response payloads,
- backend preparation flow now includes `ReviewContextAssemblyService`, `ReviewRequirementResolutionService`, `ReviewPreparationService`, and explicit source-priority mapping,
- `POST /api/review-programs/prepare` now returns criterion-level readiness, blockers, resolved data bindings, and by-source path visibility,
- prepared review-context artifacts are now persisted and returned with stable IDs/versions,
- `POST /api/review-programs/dispatch` now dispatches from persisted prepared contexts,
- run-ledger criteria and criteria-step records now retain prepared-context linkage and payload refs,
- the MOP/Prio prepared payload contract is now frozen in [docs/MOP_PRIO_PREPARED_PAYLOAD_CONTRACT.md](MOP_PRIO_PREPARED_PAYLOAD_CONTRACT.md),
- the workspace now presents persistent preparation details instead of relying only on snack/toast messaging,
- targeted unit, integration, and workspace tests now cover mixed ready/blocked preparation flows.

Still open in the next slices:

- frontend dispatch/retrieval cleanup is still needed so the workspace relies exclusively on prepared-context routes and artifacts,
- MOP/Prio still needs stricter result-contract parsing and adapter compatibility tests for response handling,
- end-to-end verification is still needed for full prepared-payload parity across backend, UI, Axiom, and MOP/Prio.

Newly closed in the current slice:

- backend now accepts the nested prepared-dispatch route shape already used by the UI,
- preparation lifecycle events now exist for auditability (`review-program.prepare.started|completed|failed`),
- readiness classification now explicitly surfaces `requires_extraction` and `partially_ready` cases.

## May 1, 2026 blunt production gap list (docs + code reality)

This is the short version after checking the code instead of trusting the plans.

### What is actually in place now

- Prepared review context assembly, persistence, retrieval, diffing, and prepared dispatch are genuinely implemented in the backend.
- The review workspace genuinely renders preparation results, artifact metadata, diff data, lineage, and dispatch feedback.
- Intake draft -> real order document reassociation and source-identity propagation are implemented end-to-end enough to be considered real progress, not placeholder work.

### Exactly what is still missing for true production-worthiness

#### Backend

1. **One execution model, not two.**
	The old snapshot-first submit path still exists, and the UI still has a direct-submit fallback for single-program failures. Until that is removed, the platform still has a split brain between “prepared context dispatch” and “legacy snapshot submission.”

2. **Explicit comp/adjustment requirement wiring.**
	Requirement resolution still relies on keyword-based path inference for comp and adjustment blockers. That is a useful bridge, but it is not yet the explicit, schema-backed binding model we need for high-confidence appraisal review decisions.

3. **Criterion outcome taxonomy is still too shallow.**
	The system is good at saying whether legs were submitted or blocked, but it still does not persist and expose a full criterion outcome model that cleanly separates `cannot_evaluate`, `skipped_missing_requirements`, partial coverage, and terminal business outcomes.

#### UI / UX

1. **The workspace still contains migration safety logic.**
	It can fall back to the old direct submit mutation, which means the happy path is better than before but the page still behaves like a transitional surface instead of a final one.

2. **Some of the newest operator panels are still component-level assets, not proven workflow surfaces.**
	QC discrepancy / override / cascade panels and several report-builder section components now exist, but they are not yet clearly wired into the main operator pages in a way that proves the experience is complete.

3. **Partial dispatch and rerun states still need stronger primary-page affordances.**
	The data is there, but the “what do I do next?” experience for partial engine coverage, failed legs, and rerun deltas still needs to feel deliberate instead of merely inspectable.

#### Operations

1. **Critical config gaps still degrade at runtime instead of failing early.**
	Missing engine config can still cause a skipped leg rather than a deployment/startup failure, which is operationally too soft for a production-critical review path.

2. **Cascade reevaluation dedupe is still process-local.**
	The current in-memory guard is fine for one process, but not sufficient protection in a horizontally scaled deployment.

3. **Startup health still tolerates some degraded states.**
	The app can log startup/bootstrap health failures and continue running, which is not the bar we want once this path is treated as truly production-critical.

### Non-comp ranked owner worklist (2026-05-01)

This ranking excludes comp/adjustment-owned domain work on purpose.

1. **Review orchestration backend**
	Converge the platform onto prepared-context dispatch as the one standard execution contract.

2. **Review workspace / QC frontend**
	Make the shared review workspace the clearly authoritative operator console for preparation, dispatch, result state, reruns, and the newer QC/report-builder panels.

3. **Journey convergence owners**
	Finish non-comp convergence for manual-intake and bulk-created orders so operators reliably land in the same shared review/QC path after order creation.

4. **Canonical evidence / run-ledger backend**
	Close the remaining non-comp canonical gaps around normalized document inventory, normalized criteria-result artifacts, stronger provenance/evidence refs, and unified run-artifact access.

5. **Engine integration owners**
	Prove downstream prepared-payload receiver parity and live-fire result hydration behavior, especially for MOP/Prio.

6. **Platform / operations backend**
	Hard-gate critical config and startup health, and replace process-local reevaluation dedupe with multi-instance-safe behavior.

7. **Security and release owners**
	Close secret exposure, authz/tenant-isolation verification, smoke/UAT/load/DR validation, and release/runbook sign-off.

### Decision on the snapshot-submit path

**Recommended decision:** keep it **temporarily** as a **migration fallback only**.

That means:

- do **not** retire it immediately while the UI still depends on it for certain single-program failure cases,
- do **not** bless it as a normal long-term production workflow,
- explicitly document it as temporary transitional behavior,
- remove or hard-disable it once prepared dispatch is proven across the remaining manual, bulk-created, and rerun-oriented operator flows.

---

## Executive Summary

### Product requirement in plain language

The required workflow is:

1. An order is placed on a property.
2. The property/order is enriched with third-party datasets.
3. Comparable selection and adjustments may be added or edited.
4. Documents may optionally be uploaded and extracted according to configurable schemas.
5. One or more review programs are run against the aggregate dataset.
6. Each underlying criterion should declare what data and/or documents it needs.
7. The platform should determine whether those needs are already satisfied, whether additional collection/extraction is needed, and then marshal the correct payload to Axiom and/or MOP/Prio.

### Current implementation in plain language

The current implementation does **not** execute review programs as a requirement-driven orchestration problem.

Instead, it does this:

1. Look for a previously-created canonical snapshot.
2. If no snapshot exists, try to start a document extraction run.
3. Once a snapshot exists, dispatch each referenced engine leg using only:
	- `snapshotId`
	- `clientId`
	- `subClientId`
	- `programId`
	- `programVersion`
4. Let downstream engines figure out the rest.

That means the system is currently **snapshot-gated**, not **requirements-driven**.

### Bottom line

The present design can dispatch criteria runs, but it cannot yet guarantee that:

- all required data has been assembled,
- optional data sources are used when available,
- missing inputs are identified per criterion,
- comps/adjustments are included in the evaluation context,
- document extraction is invoked only when actually required,
- Axiom and MOP/Prio receive engine-specific payloads built from criterion-level requirements.

---

## Required End-State

## 1. Business workflow requirements

The intended workflow implies all of the following must be true:

### 1.1 Order-first, not extraction-first

Review-program availability should begin from the order and its associated artifacts, not from the existence of one extraction snapshot.

### 1.2 Multi-source context assembly

The executable review context may include data from all of these sources:

- order core fields
- property enrichment / public record / flood / provider data
- document extraction output
- selected comparable sales
- manual comp adjustments
- prior analysis outputs
- canonical normalized values
- criterion-specific supplemental inputs

### 1.3 Requirement-aware execution

Each criterion within a review program should declare:

- what structured fields it needs,
- whether those fields are required or optional,
- where each field can come from,
- what documents are required,
- whether a requirement applies conditionally,
- what to do when a requirement is missing.

### 1.4 Partial satisfiability

Some review programs should still run when only a subset of criteria can be fully evaluated.

Expected behavior:

- some criteria may return `cannot_evaluate`,
- others may complete successfully,
- the program-level response should explain which data was missing and why.

### 1.5 Engine-specific marshalling

The platform should prepare engine-specific payloads rather than assuming a single canonical snapshot is sufficient for every engine.

### 1.6 Auditable provenance

Every verdict should be traceable to:

- the source document(s),
- enrichment record(s),
- comp selection state,
- manual overrides/adjustments,
- derived values,
- criterion input slice used at dispatch time.

---

## 2. What is currently implemented

## 2.1 UI behavior

The current UI in [src/components/order/ReviewProgramWorkspace.tsx](../src/components/order/ReviewProgramWorkspace.tsx) resolves readiness from:

- `clientId`
- `subClientId`
- latest extraction-derived snapshot
- a source document that can be used to auto-start extraction

Key current behaviors:

- It derives `latestSnapshotId` only from extraction runs.
- If there is no snapshot, it treats extraction as the next required step.
- It can auto-start extraction when a source document plus schema key are available.
- It submits review programs only after a snapshot exists.

This is a useful tactical UI improvement, but it encodes the wrong product assumption: **review-program readiness is modeled as snapshot readiness**.

## 2.2 Review-program orchestration contract

The backend contract in [src/types/review-program-orchestration.types.ts](../src/types/review-program-orchestration.types.ts) requires:

- `snapshotId`
- `clientId`
- `subClientId`
- optional `runMode`
- optional `engagementId`
- optional `loanPropertyContextId`

There is no place in this contract to pass:

- required data inventory,
- required document inventory,
- satisfaction status,
- comp package,
- manual adjustment package,
- per-engine marshalled payload,
- missing-requirement explanation.

## 2.3 Review-program orchestration service

The orchestration service in [src/services/review-program-orchestration.service.ts](../src/services/review-program-orchestration.service.ts) currently:

1. fetches the selected program,
2. verifies the requested snapshot exists,
3. iterates `aiCriteriaRefs`,
4. iterates `rulesetRefs`,
5. submits each leg independently.

What it does **not** do:

- inspect criterion data requirements,
- inspect criterion document requirements,
- assemble missing data,
- locate comp/adjustment context,
- decide whether extraction is actually necessary,
- choose engine-specific payload content based on criterion needs.

This is fan-out orchestration, not data orchestration.

## 2.4 Criteria submission model

The criteria submission model in [src/services/analysis-submission.service.ts](../src/services/analysis-submission.service.ts) creates a criteria run from:

- `snapshotId`
- `programKey`
- `runMode`
- optional step keys

It validates the snapshot, creates the criteria run, dispatches it, then creates step runs and step-input slices.

This means criteria execution is currently rooted in an already-materialized snapshot.

## 2.5 Extraction submission model

The extraction route in [src/controllers/runs.controller.ts](../src/controllers/runs.controller.ts) requires:

- `documentId`
- `runReason`
- `schemaKey.clientId`
- `schemaKey.subClientId`
- `schemaKey.documentType`
- `schemaKey.version`

This is a valid extraction contract, but it is not yet integrated into a broader requirement-satisfaction planner.

## 2.6 Canonical snapshot contents

The canonical snapshot model in [src/types/run-ledger.types.ts](../src/types/run-ledger.types.ts) and [src/services/canonical-snapshot.service.ts](../src/services/canonical-snapshot.service.ts) currently materializes:

- `subjectProperty`
- `extraction`
- `providerData`
- `provenance`

Notably absent from the normalized snapshot payload:

- selected comps
- comp-level adjustments
- reviewer overrides
- explicit requirement-satisfaction state
- derived criterion-ready field map
- document inventory by required document type
- alternate source resolution metadata

That is the core reason the snapshot alone cannot satisfy the full review-program requirement.

## 2.7 Step-input slice contents

The criteria step input slice in [src/services/criteria-step-input.service.ts](../src/services/criteria-step-input.service.ts) defaults to:

- `stepKey`
- `snapshotId`
- `subjectProperty`
- `extraction`
- `providerData`
- `provenance`

This is helpful for basic step execution, but still omits:

- comps,
- adjustment evidence,
- requirement-resolution status,
- document requirement fulfillment detail,
- criterion-specific field extraction choices.

## 2.8 Axiom requirement model already exists

The Axiom repo already contains a richer requirement model:

- [src/types/criterion/DataRequirement.ts](../../axiom/src/types/criterion/DataRequirement.ts)
- [src/types/criterion/DocumentRequirement.ts](../../axiom/src/types/criterion/DocumentRequirement.ts)
- [src/types/criterion/CriterionNode.ts](../../axiom/src/types/criterion/CriterionNode.ts)
- [src/utils/criterion/field-resolver.ts](../../axiom/src/utils/criterion/field-resolver.ts)
- [src/services/criterion/CriterionEvaluationService.ts](../../axiom/src/services/criterion/CriterionEvaluationService.ts)

These types support exactly the kind of semantics the product needs:

- required vs optional data,
- extraction sources,
- derivations,
- document requirements,
- applicability conditions,
- `cannot_evaluate` when required inputs are missing.

However, the appraisal-management orchestration layer is not yet using that model as its source of truth for review-program readiness and dispatch preparation.

## 2.9 Mock compile response masks the gap

In [src/services/axiom.service.ts](../src/services/axiom.service.ts), the mock compile response currently creates compiled criteria nodes with:

- `dataRequirements: []`
- `documentRequirements: []`

That means local/mock flows can misleadingly appear "ready" even when the real requirement graph has not been modeled or consumed.

## 2.10 MOP/Prio dispatch is equally snapshot-centric

The MOP/Prio engine dispatch path in [src/services/engine-dispatch.service.ts](../src/services/engine-dispatch.service.ts) posts criteria runs using:

- `runId`
- `tenantId`
- `correlationId`
- `idempotencyKey`
- `snapshotId`
- `programKey`

There is no evidence that the MOP/Prio dispatch path currently receives a richer program-specific data package assembled from criterion requirements.

---

## 3. Detailed gap analysis by requirement

## 3.1 Requirement: Review programs should start from the order lifecycle

### Expected

The order should be the root entity. A review program should evaluate the best currently available state of the order, regardless of whether that state was produced by enrichment, comps, document extraction, or manual edits.

### Current

The UI and orchestration layer both treat `snapshotId` as the hard gate.

### Gap

The root execution entity is wrong. It is currently "a prior snapshot" rather than "the order review context."

### Implication

Users see errors about extraction even in cases where the review program could theoretically proceed on enrichment-only or non-document inputs.

---

## 3.2 Requirement: Third-party enrichment should be part of the review context

### Expected

Property enrichment should be automatically available to criteria that need it.

### Current

The canonical snapshot service does include latest enrichment data and merges it into `subjectProperty` / `providerData`.

### Gap

This enrichment is present only as part of a snapshot created from an extraction run. There is no enrichment-first review context builder.

### Implication

A property with rich provider data but no document extraction is still blocked by snapshot-centric orchestration.

---

## 3.3 Requirement: Comparable selection and adjustments should influence review execution

### Expected

If comps are selected or adjusted, review criteria that depend on comparable analysis should consume those decisions.

### Current

- Canonical report and frontend state clearly support comps and adjustments.
- Review-program orchestration does not load them.
- Canonical snapshots do not materialize them.
- Criteria step slices do not include them.

### Gap

There is no bridge from report/comps state into review-program evaluation context.

### Implication

Comp-sensitive criteria may run without the actual comp package the reviewer expects the system to use.

---

## 3.4 Requirement: Document extraction should be optional and requirement-driven

### Expected

Extraction should run when criteria actually require document-derived fields or documents that are not already satisfied.

### Current

The system assumes a snapshot from extraction is the standard prerequisite to running review programs.

### Gap

There is no planner that says:

- these criteria can run now,
- these criteria need extraction first,
- these criteria need a different schema/document type,
- these criteria are blocked on missing documents.

### Implication

The user receives a coarse "run extraction first" message instead of a criterion-by-criterion explanation.

---

## 3.5 Requirement: Criterion-level data requirements should drive readiness

### Expected

Readiness should be computed from the union of all selected criteria requirements.

### Current

Readiness is computed from a small fixed set of transport prerequisites:

- `clientId`
- `subClientId`
- `snapshotId` or extractable document

### Gap

No requirement graph is resolved before submission.

### Implication

The system cannot distinguish:

- fully evaluable criteria,
- partially evaluable criteria,
- blocked criteria,
- criteria satisfied entirely from enrichment,
- criteria requiring only comp data,
- criteria requiring document extraction.

---

## 3.6 Requirement: The platform should marshal engine-specific inputs

### Expected

Axiom and MOP/Prio should each receive the exact payload they need.

### Current

Both engines are primarily driven with `snapshotId` plus `programKey`, and step dispatch adds a generic slice built from snapshot fields.

### Gap

There is no explicit engine-adapter layer that transforms a requirement-resolved review context into:

- Axiom criterion payloads,
- MOP/Prio rule payloads,
- engine-specific evidence references,
- explainable missing-data annotations.

### Implication

The platform remains tightly coupled to snapshot shape rather than true engine contracts.

---

## 3.7 Requirement: The system should explain missing data precisely

### Expected

Users should be told:

- which criterion is blocked,
- which field/document is missing,
- whether the data can be derived,
- what action can satisfy it.

### Current

Current errors are coarse and transport-oriented, such as:

- missing `subClientId`
- missing snapshot
- run extraction first

### Gap

Missing-data explanations are not tied to criterion requirement metadata.

### Implication

The UX feels arbitrary even when backend behavior is technically consistent with current contracts.

---

## 4. Root causes

## 4.1 Wrong abstraction boundary

The orchestration boundary is currently:

`Review Program -> Snapshot -> Engine Dispatch`

The required boundary is:

`Review Program -> Resolve Criteria Requirements -> Build Review Context -> Determine Missing Inputs -> Satisfy What Can Be Satisfied -> Marshal Per Engine -> Dispatch`

## 4.2 Snapshot model is too narrow

The canonical snapshot is useful but too limited. It is an extraction-centered normalized artifact, not a complete order review context.

## 4.3 Review-program contract is too transport-oriented

The submission contract expresses only routing inputs, not requirement-resolution state.

## 4.4 Requirement metadata exists in Axiom but is not operationalized here

The richest modeling already exists on the Axiom side, but the appraisal-management orchestration layer does not use it to compute readiness, planning, or engine payload assembly.

## 4.5 Comp/adjustment data is outside the orchestration path

Even though comp workflows exist, there is no canonical join point that feeds their current state into review execution.

---

## 5. Recommended target architecture

## 5.1 Introduce a Review Context Assembly layer

Create a first-class backend service, conceptually:

- `ReviewContextAssemblyService`

Responsibilities:

1. Load order core data.
2. Load latest enrichment.
3. Load documents and extraction outputs.
4. Load report/comps/adjustments.
5. Load selected review programs and expand referenced criteria/rulesets.
6. Resolve the union of data/document requirements.
7. Determine which requirements are already satisfied.
8. Identify which additional actions are required.
9. Emit an auditable `ReviewContext` object.

## 5.2 Introduce requirement-resolution output types

The planner should produce something like:

- `satisfiedRequirements[]`
- `missingRequirements[]`
- `derivableRequirements[]`
- `requiredDocumentsMissing[]`
- `availableEvidenceRefs[]`
- `enginePayloads.axiom[]`
- `enginePayloads.mopPrio[]`
- `criteriaReady[]`
- `criteriaBlocked[]`

## 5.3 Separate “prepare” from “dispatch”

The platform should support two explicit phases:

1. **Prepare review program**
	- analyze requirements
	- gather data
	- report readiness and gaps

2. **Dispatch review program**
	- submit only the criteria/legs that are ready
	- optionally request additional collection steps first

## 5.4 Expand canonical context beyond extraction

Either extend the canonical snapshot model or introduce a higher-level `review-context` artifact that can contain:

- order data
- enrichment data
- extraction data
- comp package
- adjustment package
- provenance
- requirement-resolution metadata
- engine-specific slices

## 5.5 Make criterion readiness explainable in the UI

The UI should present:

- Ready now
- Ready after extraction
- Blocked: missing document
- Blocked: missing comp selection
- Blocked: missing sub-client configuration
- Partially runnable

That is much closer to the business workflow than the current snapshot warning.

---

## 6. Recommended closure plan

## Phase 1 — Document and freeze current contracts

1. Document current review-program submission behavior as snapshot-gated.
2. Document current run-ledger snapshot contents and omissions.
3. Document current Axiom and MOP/Prio dispatch payloads.

## Phase 2 — Requirement inventory

1. Enumerate all criterion `dataRequirements` and `documentRequirements` for targeted review programs.
2. Enumerate MOP/Prio input expectations by ruleset.
3. Define source priority for each requirement:
	- order
	- enrichment
	- extracted document
	- report/comps/adjustments
	- derived field

## Phase 3 — Review context model

1. Define a unified `ReviewContext` schema.
2. Define provenance and evidence references for every field family.
3. Define comp/adjustment embedding rules.

## Phase 4 — Readiness planner

1. Build a planner that resolves requirement satisfaction before dispatch.
2. Return criterion-level readiness and blocker reasons.
3. Support partial-runnable programs.

## Phase 5 — Engine adapters

1. Build an Axiom payload adapter from `ReviewContext`.
2. Build a MOP/Prio payload adapter from `ReviewContext`.
3. Stop assuming raw `snapshotId` is sufficient.

## Phase 6 — UI alignment

1. Replace snapshot-only readiness messaging with requirement-aware readiness.
2. Show which data was used.
3. Show what is missing and how to satisfy it.

## Phase 7 — Auditability and regression coverage

1. Persist review-context artifacts or equivalent auditable slices.
2. Add end-to-end tests for:
	- enrichment-only runnable criteria,
	- extraction-required criteria,
	- comp-sensitive criteria,
	- partial program execution,
	- cross-engine mixed review programs.

---

## 7. Immediate implementation priorities

If the goal is to close the most painful product gaps first, the recommended order is:

1. **Build requirement-aware preparation endpoint**
	- highest leverage
	- removes the misleading snapshot-only UX

2. **Model comp/adjustment inclusion in review context**
	- required for review credibility

3. **Use Axiom criterion requirements as source-of-truth for readiness**
	- avoids inventing a parallel model

4. **Define MOP/Prio requirement contract explicitly**
	- necessary for parity with Axiom path

5. **Refactor dispatch to consume prepared review context rather than raw snapshot**

---

## 8. Conclusion

The current implementation is not broken in the narrow sense of its existing contracts. It is behaving consistently with a design that assumes:

- extraction happens first,
- extraction yields a snapshot,
- snapshot drives criteria dispatch.

The issue is that this design is materially narrower than the actual product requirement.

The real requirement is not:

> “Run a review program if a snapshot exists.”

It is:

> “Run one or more review programs against the best available order-review context, using criterion-level data and document requirements to determine what can run now, what additional data must be gathered, and how to marshal each engine submission.”

That is the gap that must now be closed.

---

## 9. Check-Off Implementation Plan

> **MAY 1, 2026 — CODE-VERIFIED STATUS AUDIT**
>
> This checklist has been audited against the actual codebase. Status markers are now accurate.
> Legend:
> - `[x]` = code exists and working
> - `[-]` = partial / stub / workaround in place
> - `[ ]` = NOT DONE — no code exists
>
> **Summary by phase:**
> | Phase | Status |
> |---|---|
> | 0 — Baseline / contract freeze | ❌ NOT STARTED |
> | 1 — Requirements inventory | ❌ NOT STARTED |
> | 2 — Review context model | ❌ NOT STARTED |
> | 3 — Backend context assembly | ✅ Substantially done |
> | 4 — Requirement resolution planner | ✅ Mostly done, comp/adj and some states missing |
> | 5 — Preparation endpoint / orchestration split | ⚠️ Prepare endpoint done; split incomplete (legacy path survives) |
> | 6 — Engine adapters | ⚠️ MOP/Prio mostly done; Axiom adapter partial; no adapter tests |
> | 7 — Frontend readiness UX | ⚠️ Partial; legacy fallback still live; partial-runnable state missing |
> | 8 — Dispatch, results, audit trail | ⚠️ Artifacts persisted; outcome taxonomy and criterion-level explanations missing |
> | 9 — Migration and cleanup | ⚠️ Backend migrated; UI and docs still partially on old path |
> | Acceptance checklist | ❌ NOT MET — zero items can be checked off today |
>
> **Sections 10-21 of this document are entirely aspirational design content. No code exists for any of them.** See the status banners in each section.

### Phase 0 — Baseline and contract freeze

> **STATUS: PARTIALLY DONE (2026-05-01).** API contracts frozen and documented at `docs/contracts/FROZEN_API_CONTRACTS.md`. All three route shapes (`/prepare`, `/:preparedContextId/dispatch`, `/:id/submit`) are documented with request/response types, sample payloads, and known snapshot dependencies. **Remaining gaps:** scope of first production `aiCriteriaRefs` program not declared; runtime behavior for extraction auto-start not formally documented; QC-specific submission path not separately documented.

- [ ] Confirm the scope of the first supported review program set.
- [x] Freeze the current review-program request/response contracts. See `docs/contracts/FROZEN_API_CONTRACTS.md`.
- [ ] Document current runtime behavior for:
	- [ ] order page review submission
	- [ ] QC review submission
	- [ ] extraction auto-start
	- [ ] Axiom dispatch
	- [ ] MOP/Prio dispatch
- [ ] Capture one known-good sample payload for:
	- [ ] extraction run creation
	- [ ] criteria run creation
	- [ ] review-program submission
- [ ] Identify all current snapshot dependencies in frontend and backend code.

### Phase 1 — Requirements inventory

> **STATUS: DONE for current seeded programs (2026-05-01).** Target review-program refs are enumerated, the Axiom appraisal-QC requirement inventory is documented, equivalent MOP/Prio requirement metadata is documented below, source families/provenance owners are classified, and seed loading for the new criteria JSON files is confirmed. **Decision:** Axiom now uses an explicit `PLATFORM/default` fallback delta for `appraisal-qc@1.0.0` when no tenant-specific delta exists.

- [x] Create Axiom canonical taxonomy seed (`axiom/seed-data/criteria/appraisal-qc-canonical-v1.0.0.json`).
- [x] Create platform delta seed (`axiom/seed-data/criteria/appraisal-qc-platform-delta.json`).
- [x] Wire review program `aiCriteriaRefs` -> `appraisal-qc@1.0.0` (`src/data/review-programs.ts`).
- [x] Confirm Axiom seed loader picks up the new criteria JSON files automatically. `seed-data/seed-all-v2.ts` points criteria seeding at `seed-data/criteria`, and `CatalogSeeder.getJsonFiles()` recursively loads every non-template `.json` file under that directory.
- [x] Enumerate all `aiCriteriaRefs` used by target review programs.
- [x] Enumerate all `rulesetRefs` used by target review programs.
- [x] Export or document Axiom `dataRequirements` for each referenced criterion.
- [x] Export or document Axiom `documentRequirements` for each referenced criterion.
- [x] Define equivalent requirement metadata for MOP/Prio rulesets.
- [x] Classify every requirement by source type:
	- [x] order core data
	- [x] enrichment/provider data
	- [x] extracted document data
	- [x] report subject data
	- [x] comp data
	- [x] adjustment data
	- [x] derived/calculated data
- [ ] Mark each requirement as:
	- [x] required
	- [x] optional
	- [x] conditionally applicable

#### Current seeded target-program refs (2026-05-01)

- `vision-appraisal-v1.0`
	- `aiCriteriaRefs`: `appraisal-qc@1.0.0`
	- `rulesetRefs`: `vision-appraisal@1.0`

#### Axiom appraisal-QC requirement inventory (`appraisal-qc@1.0.0`)

| Criterion | Required data requirements | Required / qualifying documents | Source classification | Provenance owner |
|---|---|---|---|---|
| `PROPERTY_ADDRESS_COMPLETE` | `subject.propertyAddress`, `.street`, `.city`, `.state`, `.zip` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data; report subject data | Axiom extraction pipeline (`latestSnapshot.extraction`) and appraisal snapshot normalization (`latestSnapshot.subjectProperty`) |
| `PARCEL_ID_MATCHES_TITLE` | `subject.assessorsParcelNumber`, `subject.legalDescription` | `uniform-residential-appraisal-report`, `form-1004`; conditional cross-doc support from `title-report` | extracted document data; report subject data; conditionally additional document verification | Axiom extraction pipeline for appraisal/title docs; cross-document provenance recorded in `ReviewEvidenceRef` |
| `NO_UNACCEPTABLE_APPRAISAL_PRACTICES` | `appraiserCertification.signed`, `.date`, `.appraiserLicenseNumber`, `.appraiserName` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data | Axiom extraction pipeline |
| `PROPERTY_CONDITION_DOCUMENTED` | `improvements.condition`, `improvements.conditionDescription`, `subject.propertyPhotos` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data; report subject data | Axiom extraction pipeline + normalized subject/report artifact |
| `MARKET_TRENDS_IDENTIFIED` | `neighborhood.marketConditions`, `.propertyValues`, `.demand`, `.marketingTime` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data; enrichment/provider data for corroboration | Axiom extraction pipeline; property-enrichment provider payload when available |
| `PROPERTY_HIGHEST_BEST_USE` | `site.highestAndBestUse`, `site.presentUse`, `site.zoning` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data; report subject data | Axiom extraction pipeline + normalized subject/report artifact |
| `REQUIRED_PHOTOS_INCLUDED` | `subject.propertyPhotos`, `comparables[*].photo` | `uniform-residential-appraisal-report`, `form-1004` | extracted document data; comp data | Axiom extraction pipeline; report comp package assembly |
| `THREE_CLOSED_COMPS_USED` | `salesComparison.comparables`, `salesComparison.comparablesCount` | `uniform-residential-appraisal-report`, `form-1004` | comp data; derived/calculated data | Report comp package assembly; derived comp-count summary in review context |
| `COMPS_ARE_SUITABLE_SUBSTITUTES` | `salesComparison.comparables[*].gla`, `.yearBuilt`, `.saleDate`, `.propertyType`, `.distance`, `subject.gla`, `subject.yearBuilt`, `subject.propertyType` | `uniform-residential-appraisal-report`, `form-1004` | comp data; report subject data | Report comp package assembly + normalized subject/report artifact |
| `ADJUSTMENTS_ARE_REASONABLE` | `salesComparison.comparables[*].netAdjustmentDollar`, `.netAdjustmentPct`, `.grossAdjustmentDollar`, `.grossAdjustmentPct`, `.salePrice`, `.adjustedSalePrice` | `uniform-residential-appraisal-report`, `form-1004` | adjustment data; comp data; derived/calculated data | Review-context adjustment summary + report comp package assembly |
| `VALUE_SUPPORTED_BY_COMPS` | `reconciliation.finalValueOpinion`, `reconciliation.indicatedValueSalesApproach`, `salesComparison.comparables[*].adjustedSalePrice`, `salesComparison.comparables[*].weight` | `uniform-residential-appraisal-report`, `form-1004` | report subject data; comp data; derived/calculated data | Reconciliation fields from extraction/normalized snapshot; comp weighting from report comp package |

**Source-family coverage note**

- `order core data` is now checked because the `vision-appraisal@1.0` MOP/Prio ruleset consumes order/tape-native values such as `ltv`, `cltv`, `loanAmount`, prior-sale pricing, and manual-flag booleans.
- `conditionally applicable` is checked because `PARCEL_ID_MATCHES_TITLE` requires title-document corroboration when cross-document validation is run, and several comp/adjustment criteria are only runnable once comp packages exist.
- `optional` is now checked because provider corroboration for market-trend analysis and AVM support is warning-level/optional rather than hard-blocking in the current seeded programs.
- Seed-loading confirmation proves the JSON files are discovered and seeded. At runtime, Axiom now attempts exact `{clientId, subClientId}` resolution first and then falls back to the seeded `PLATFORM/default` appraisal-QC delta.

#### Equivalent MOP/Prio requirement metadata (`vision-appraisal@1.0`)

| Rule / flag | Required fields | Threshold / comparison inputs | Source classification | Provenance owner | Requirement level |
|---|---|---|---|---|---|
| `HIGH_NET_GROSS_ADJ` | `avgNetAdjPct`, `avgGrossAdjPct` | `thresholds.netAdjustmentPct`, `thresholds.grossAdjustmentPct` | adjustment data; derived/calculated data | review-context adjustment summary built from report comp package | required when comps/adjustments exist |
| `UNUSUAL_APPRECIATION_24M` | `priorSale24mPrice`, `appreciation24m` | `thresholds.appreciation24mPct` | report subject data; derived/calculated data | prior-sale history in snapshot/provider data + derived appreciation calculation | conditionally applicable |
| `UNUSUAL_APPRECIATION_36M` | `priorSale36mPrice`, `appreciation36m` | `thresholds.appreciation36mPct` | report subject data; derived/calculated data | prior-sale history in snapshot/provider data + derived appreciation calculation | conditionally applicable |
| `DSCR_FLAG` | `dscr` | `thresholds.dscrMinimum` | order core data; derived/calculated data | order/tape feed or underwriting calculator output | conditionally applicable |
| `NON_PUBLIC_COMPS` | `numComps`, `nonMlsPct` | `thresholds.nonMlsPct` | comp data; derived/calculated data | report comp package assembly | required when comp grid exists |
| `AVM_GAP` | `avmValue`, `avmGapPct` | `thresholds.avmGapPct` | enrichment/provider data; derived/calculated data | AVM/property-enrichment provider payload + derived gap calculation | optional corroboration |
| `HIGH_LTV` | `ltv` | `thresholds.ltv` | order core data | order/tape feed | required |
| `HIGH_CLTV` | `cltv` | `thresholds.cltv` | order core data | order/tape feed | required |
| `CHAIN_OF_TITLE` | `chainOfTitleRedFlags` | none | order core data; manual review input | reviewer/manual tape flag | optional/manual |
| `HIGH_RISK_GEOGRAPHY` | `highRiskGeographyFlag` | none | enrichment/provider data; manual review input | geography-risk provider or reviewer override | optional/manual |
| `APPRAISER_GEO_COMPETENCY` | `appraiserGeoCompetency` | none | manual review input; report subject data | reviewer override or extracted appraiser metadata | optional/manual |

**MOP/Prio notes**

- These rules are currently declared in [src/data/review-programs.ts](src/data/review-programs.ts). They remain inline/legacy-compatible, but the requirement metadata above is the contract Phase 1 needed in order to assemble readiness and provenance consistently.
- Threshold keys are configuration inputs from the seeded review program, not external data requirements.
- Rules driven by prior sale, comp, adjustment, or AVM fields remain conditionally applicable because readiness depends on whether those supporting contexts were assembled.

### Phase 2 — Review context model

> **STATUS: SUBSTANTIALLY DONE for core types; PARTIAL for comp/adj and retention rules (2026-05-01).** `ReviewContext` is fully defined at `src/types/review-context.types.ts`. `CriterionResolution`, `ProgramReadiness`, and `PreparedEngineDispatch` are fully typed in `src/types/review-preparation.types.ts`. The "extend snapshot vs new artifact" decision is made: `PreparedReviewContextArtifact` is the new artifact stored in the `aiInsights` Cosmos container. **Remaining gaps:** comp/adjustment package shapes not defined; provenance rules per field family not documented; persistence/retention rules not documented; reviewer/manual override shape not defined.

- [x] Define a unified `ReviewContext` schema. See `src/types/review-context.types.ts`.
- [x] Define a unified `RequirementResolutionResult` schema. `CriterionResolution` + `ProgramReadiness` in `src/types/review-preparation.types.ts` cover this.
- [ ] Define provenance rules for every field family.
- [ ] Define document inventory shape for required/optional documents.
- [ ] Define comp package shape.
- [ ] Define adjustment package shape.
- [ ] Define reviewer/manual override shape.
- [ ] Decide whether to:
	- [x] extend canonical snapshot, or  <- DECIDED: new artifact chosen
	- [x] introduce a new `review-context` artifact  <- DONE: `PreparedReviewContextArtifact` stored in `aiInsights` Cosmos container
- [ ] Document persistence and retention rules for the new artifact.

### Phase 3 — Backend context assembly

> **STATUS: SUBSTANTIALLY DONE.** `ReviewContextAssemblyService` exists. Order, enrichment, documents, extraction outputs, prior runs, and provenance refs are all loaded. **Gap: comp/adjustment loading is partial/stub.**

- [x] Implement `ReviewContextAssemblyService`.
- [x] Load order core data into the assembled context.
- [x] Load latest property enrichment into the assembled context.
- [x] Load document metadata and extracted data into the assembled context.
- [-] Load report subject/comps/adjustments into the assembled context.
- [x] Load prior run metadata needed for reruns/explanations.
- [x] Attach provenance/evidence refs for all included sources.
- [x] Add unit tests for context assembly.

### Phase 4 — Requirement resolution planner

> **STATUS: MOSTLY DONE, with real gaps.** Criterion expansion, union resolution, source-priority resolution, missing-field/document detection, and basic readiness types all work. **Missing: derived-field resolution, comp/adjustment-blocked criterion detection, and the `blocked` and `cannot_evaluate` readiness states are not yet emitted.**

- [x] Implement criterion requirement expansion for selected review programs.
- [x] Resolve the union of all selected-program requirements.
- [x] Implement source-priority resolution for fields.
- [ ] Implement derived-field resolution where allowed.
- [x] Detect missing required fields.
- [x] Detect missing required documents.
- [ ] Detect criteria blocked specifically on comp/adjustment context.
- [ ] Produce criterion-level readiness status:
	- [x] ready
	- [x] ready with warnings
	- [x] requires extraction
	- [x] requires additional documents
	- [ ] blocked
	- [ ] cannot evaluate
- [x] Add unit tests for requirement planning and readiness output.

### Phase 5 — Preparation endpoint and orchestration split

> **STATUS: COMPLETE for the prepared-context migration slice.** Preparation endpoint exists and is tested. Prepared-context dispatch exists. The legacy snapshot submit route now hard-fails with explicit migration guidance, and the workspace dispatches through prepared-context routes only.

- [x] Add a backend “prepare review program” endpoint.
- [x] Return criterion-level readiness and blocker details.
- [x] Return missing requirement details with actionable messages.
- [x] Return engine-specific preparation summaries.
- [x] Split orchestration into:
	- [x] prepare phase
	- [x] dispatch phase
- [x] Retire the legacy submit path once migration is complete.
- [x] Add API contract tests for the preparation endpoint.

### Phase 6 — Engine adapters

> **STATUS: PARTIAL for both engines.**
> - **Axiom**: An adapter path exists but still relies on raw snapshot presence. Criterion-ready context is not explicitly passed. Evidence/provenance refs not preserved. No adapter payload shape tests exist.
> - **MOP/Prio**: Mostly done. Adapter exists, contract frozen. Missing: evidence/provenance in returned results and adapter shape tests.

#### Axiom

- [-] Build an Axiom adapter from prepared review context. ← **PARTIAL**
- [ ] Stop relying on raw snapshot presence as the only readiness signal.
- [ ] Pass criterion-ready data/document context explicitly where supported.
- [ ] Preserve evidence/provenance refs for returned results.
- [ ] Add adapter tests against expected Axiom payload shapes.

#### MOP/Prio

- [x] Define the required MOP/Prio rule input contract.
- [x] Build a MOP/Prio adapter from prepared review context.
- [x] Include comp/adjustment context when required by rulesets.
- [ ] Preserve evidence/provenance refs for returned results.
- [ ] Add adapter tests against expected MOP/Prio payload shapes.

### Phase 7 — Frontend readiness UX

> **STATUS: SUBSTANTIALLY COMPLETE excluding comp/adjustment-specific semantics.** The workspace renders cert/program readiness summary, blockers, source info, prepared-context-only dispatch behavior, and runnable-with-warnings readiness state. Comp/adjustment readiness semantics remain intentionally out of scope for this stream.

- [x] Replace snapshot-only readiness messaging in the review workspace.
- [x] Show criterion/program readiness summary before dispatch.
- [x] Show specific blockers instead of generic extraction errors.
- [x] Show when extraction is required vs optional.
- [-] Show when comp selection/adjustments are required.
- [x] Show what data sources will be used for the run.
- [x] Show partial-runnable program state.
- [x] Add focused frontend tests for readiness states.

### Phase 8 — Dispatch, results, and audit trail

> **STATUS: PARTIAL.** Artifacts persisted, dispatch linked to prepared contexts, diff endpoints exist. **Missing: criterion-level missing-data explanations not persisted, engine response provenance not preserved, the structured outcome taxonomy (`passed` / `failed` / `warning` / `cannot_evaluate` / `skipped_missing_requirements`) does not exist, and result-ingestion audit events are missing.**

- [x] Persist prepared review-context artifacts or equivalent run-linked slices.
- [x] Link dispatch runs to the prepared context version used.
- [x] Add prepared artifact retrieval and explainable diff endpoints.
- [ ] Persist criterion-level missing-data explanations.
- [ ] Persist engine response provenance.
- [ ] Expose results in a way that distinguishes:
	- [ ] passed
	- [ ] failed
	- [ ] warning
	- [ ] cannot evaluate
	- [ ] skipped due to missing requirements
- [ ] Add audit events for prepare and dispatch lifecycle stages.

### Phase 9 — Migration and cleanup

> **STATUS: MOSTLY COMPLETE for the non-comp/adjustment slice.** Backend and UI dispatch now use prepared-context flow only. Legacy fallback UX is removed. Remaining open items are docs/runbook expansion and real-environment end-to-end verification.

- [x] Migrate existing snapshot-gated UI flow to the preparation flow.
- [x] Migrate backend review-program submission to prepared-context dispatch.
- [x] Remove obsolete snapshot-only readiness assumptions.
- [x] Remove temporary/manual fallback UX that is no longer needed.
- [x] Update docs and runbooks.
- [ ] Re-run end-to-end review-program journeys in real environments.

### Acceptance checklist

> **STATUS: NOT MET. Zero of these items can be checked off today.** The gap between "prepared context machinery exists" and "the product is actually ready" is exactly what this checklist measures.

- [ ] A review program can explain exactly why it is or is not runnable.
- [ ] Enrichment-only criteria can run without requiring document extraction.
- [ ] Document-dependent criteria clearly identify which extraction/documents are missing.
- [ ] Comp-dependent criteria consume current comp and adjustment state.
- [ ] Partial review-program execution is supported and explainable.
- [ ] Axiom payloads are marshalled from requirement-resolved context.
- [ ] MOP/Prio payloads are marshalled from requirement-resolved context.
- [ ] Run results retain provenance and evidence references.
- [ ] UI no longer reduces readiness to “snapshot exists / does not exist.”
- [ ] End-to-end tests pass for mixed-source review-program execution.

---

## 10. World-Class Product Principles

> **STATUS: ⚠️ ASPIRATIONAL DESIGN — NOT IMPLEMENTED.** These are principles written as requirements. No code implements or enforces them explicitly. Treat this section as acceptance criteria for future work, not a description of current behavior.

If this is going to be the best review system we can build, the implementation must follow these principles.

### 10.1 No silent fallbacks

The system must never silently downgrade from a requirement-aware plan to a weaker execution mode.

If required context is missing, the platform must say exactly:

- what is missing,
- why it matters,
- which criterion/program is affected,
- what action resolves it.

### 10.2 Deterministic preparation before dispatch

Every dispatch must be preceded by a deterministic preparation artifact that records:

- the inputs selected,
- the sources chosen,
- the requirements satisfied,
- the requirements still missing,
- the engine payload generated.

No engine should receive an opaque request that cannot later be explained.

### 10.3 Explainability is a first-class feature

The system is not complete if it can only produce a verdict. It must also explain:

- why the verdict was reached,
- which evidence was used,
- which evidence was unavailable,
- what confidence and coverage limitations existed.

### 10.4 Best-available-data, not perfect-data-only

The system should use the best currently available inputs and distinguish between:

- `fully_evaluable`,
- `partially_evaluable`,
- `not_evaluable`.

It should not block the entire review program merely because one source family is absent if other criteria remain runnable.

### 10.5 Order-centric auditability

Everything must roll up cleanly to the order and engagement history:

- what was prepared,
- what was dispatched,
- what came back,
- what changed between runs,
- who initiated the run,
- what data changed enough to justify a rerun.

---

## 11. Target Domain Model

> **STATUS: ❌ NOT IMPLEMENTED.** None of these entities exist as formal TypeScript types or schemas in the codebase. `ReviewContext`, `RequirementResolutionResult`, `CriterionResolution`, and `PreparedEngineDispatch` are all target shapes, not current ones. The runtime objects used in the assembly and resolution services are similar in spirit but have not been formalized against this model.

The current design needs a stronger domain model.

### 11.1 Core entities

Recommended core entities:

- `ReviewProgramDefinition`
- `ReviewProgramSelection`
- `ReviewContext`
- `RequirementResolutionResult`
- `PreparedEngineDispatch`
- `ReviewProgramDispatch`
- `ReviewCriterionOutcome`
- `ReviewProgramOutcome`
- `ReviewEvidenceRef`

### 11.2 `ReviewContext`

This should be the normalized, order-centric representation of all usable inputs.

Suggested sections:

- `identity`
	- `orderId`
	- `engagementId`
	- `tenantId`
	- `clientId`
	- `subClientId`
- `orderData`
- `propertyEnrichment`
- `documents`
- `extractionOutputs`
- `reportData`
- `comps`
- `adjustments`
- `priorRuns`
- `derivedFields`
- `provenance`
- `assembledAt`
- `assembledBy`
- `contextVersion`

### 11.3 `RequirementResolutionResult`

This should describe readiness in a structured way, not just as an error string.

Suggested sections:

- `programId`
- `programVersion`
- `overallReadiness`
- `criterionResolutions[]`
- `engineResolutions[]`
- `missingRequirements[]`
- `satisfiedRequirements[]`
- `warnings[]`
- `recommendedActions[]`

### 11.4 `CriterionResolution`

Each criterion should resolve independently.

Suggested fields:

- `criterionId`
- `criterionTitle`
- `engine`
- `readiness`
- `requiredDataRequirements[]`
- `optionalDataRequirements[]`
- `requiredDocumentRequirements[]`
- `resolvedBindings`
- `missingBindings`
- `evidenceRefs[]`
- `blockingReason?`
- `recommendedAction?`

### 11.5 `PreparedEngineDispatch`

This is the object the engine adapter should consume.

Suggested fields:

- `dispatchId`
- `engine`
- `programKey`
- `criteriaIncluded[]`
- `criteriaSkipped[]`
- `payload`
- `payloadHash`
- `evidenceRefs[]`
- `preparedAt`
- `preparedFromContextVersion`

---

## 12. Canonical Source Priority Rules

> **STATUS: ❌ NOT IMPLEMENTED.** These precedence rules do not exist as code. Source priority is resolved in `ReviewRequirementResolutionService` as a heuristic, not as a formal declared precedence table. Conflict handling, `sourceConflict` warnings, and material-conflict detection for GLA/appraised-value/comp divergence are not implemented.

We need explicit source precedence rules so the platform behaves consistently.

### 12.1 Proposed source priority by data family

#### Subject/property facts

Recommended default precedence:

1. reviewer-confirmed manual override
2. canonical report subject data
3. extracted appraisal document data
4. property enrichment / public record data
5. order intake data

#### Comparable sales facts

Recommended default precedence:

1. reviewer-selected comp package
2. canonical saved report comps
3. extracted appraisal comp grid
4. provider-derived comp candidates

#### Adjustment facts

Recommended default precedence:

1. reviewer-entered adjustment state
2. canonical saved report adjustments
3. extracted report adjustments

#### Administrative/order metadata

Recommended default precedence:

1. persisted order authoritative record
2. engagement-linked order enrichment
3. manual run-time override only if explicitly allowed and audited

### 12.2 Conflict handling

When values disagree across sources, the planner should:

1. choose the winning source by precedence,
2. retain the losing candidates in provenance,
3. record a `sourceConflict` warning when the difference is material,
4. optionally block execution if the criterion demands verified consistency.

### 12.3 Material conflict examples

Examples of material conflicts that should surface visibly:

- GLA differs by more than threshold
- appraised value differs from saved report value
- selected comp set differs from extracted comp grid materially
- subject address differs across sources
- property type differs across enrichment/report/extraction

---

## 13. Readiness State Machine

> **STATUS: PARTIAL.** The system emits `ready`, `ready_with_warnings`, `requires_extraction`, and `requires_additional_documents`. The remaining states from the program-level and criterion-level lists below — including `partially_ready`, `requires_comp_selection`, `requires_manual_resolution`, `blocked_by_configuration`, `blocked_by_data_integrity`, `cannot_evaluate_missing_*`, `cannot_evaluate_conflicting_inputs`, `not_applicable` — **do not exist in code**. The action recommendation states do not exist.

The system needs explicit states.

### 13.1 Program-level readiness states

- `ready`
- `ready_with_warnings`
- `partially_ready`
- `requires_extraction`
- `requires_documents`
- `requires_comp_selection`
- `requires_manual_resolution`
- `blocked_by_configuration`
- `blocked_by_data_integrity`
- `not_runnable`

### 13.2 Criterion-level readiness states

- `ready`
- `ready_optional_missing`
- `cannot_evaluate_missing_required_data`
- `cannot_evaluate_missing_required_documents`
- `cannot_evaluate_missing_comp_context`
- `cannot_evaluate_conflicting_inputs`
- `not_applicable`

### 13.3 Action recommendation states

Every blocked state should map to a recommended next step:

- `run_extraction`
- `upload_required_documents`
- `select_comps`
- `resolve_source_conflict`
- `configure_sub_client`
- `update_review_program_mapping`
- `contact_admin`

---

## 14. Required API Surface

> **STATUS: PARTIAL.** `POST /api/review-programs/prepare` and `POST /api/review-programs/prepared/:id/dispatch` exist and match the spirit of sections 14.1 and 14.2. The explain endpoint (`GET /api/review-programs/prepared/:preparedContextId`) exists. **Missing: the diff endpoint (14.4) does not exist. The request/response shapes below are aspirational targets, not the actual live contracts — the live contracts are in `review-programs.controller.ts`.**

The current surface is too small. We need explicit preparation APIs.

### 14.1 Prepare endpoint

Suggested contract:

- `POST /api/review-programs/prepare`

Suggested request:

- `orderId`
- `engagementId?`
- `reviewProgramIds[]`
- `clientId?`
- `subClientId?`
- `options`
	- `includeCompContext`
	- `includeDocumentInventory`
	- `attemptAutoResolveDerivedFields`
	- `attemptAutoPlanExtraction`

Suggested response:

- `contextSummary`
- `programReadiness[]`
- `criterionReadiness[]`
- `recommendedActions[]`
- `plannedExtractionRequests[]`
- `plannedEngineDispatches[]`

### 14.2 Dispatch endpoint

Suggested contract:

- `POST /api/review-programs/dispatch`

Suggested request:

- `preparedContextId` or `preparedContextVersion`
- `reviewProgramIds[]`
- `dispatchMode`
	- `all_ready_only`
	- `include_partial`
- `confirmWarnings: boolean`

Suggested response:

- `dispatchId`
- `submittedPrograms[]`
- `skippedPrograms[]`
- `engineRuns[]`
- `criterionDispatchSummary[]`

### 14.3 Explain endpoint

Suggested contract:

- `GET /api/review-programs/prepared/:preparedContextId`

This should return the full explainability artifact used to prepare the run.

### 14.4 Diff endpoint

Suggested contract:

- `GET /api/review-programs/prepared/:preparedContextId/diff/:otherPreparedContextId`

This would allow us to answer:

- what changed between the last run and this run,
- which criteria changed from blocked to ready,
- which evidence set changed.

---

## 15. World-Class UX Requirements

> **STATUS: ❌ ASPIRATIONAL — NOT IMPLEMENTED.** The program selection view (15.1), expandable per-criterion details (15.2), one-click next actions (15.3), structured result presentation (15.4), and the prohibition on opaque red toasts (15.5) are all target UX specs. Some partial analogues exist in the workspace, but none of these are implemented to the standard described here.

If the backend becomes requirement-aware, the frontend must expose that clearly.

### 15.1 Program selection view

For each review program show:

- program name/version
- engines involved
- readiness badge
- criteria ready / blocked counts
- last successful run
- data freshness summary
- warnings count

### 15.2 Expandable program details

For each selected program show:

- criteria list
- readiness per criterion
- missing requirement details
- source family used for each important field
- documents available vs required
- comp/adjustment readiness state

### 15.3 One-click next actions

The UI should let the user act directly on blockers:

- start extraction
- navigate to upload docs
- navigate to comp selection
- navigate to conflict resolution
- rerun using updated context

### 15.4 Result presentation

Results should separate:

- decision outcome
- reasoning summary
- evidence used
- confidence / coverage
- cannot-evaluate causes
- engine-specific messages

### 15.5 No opaque red toasts

A generic toast like “Run extraction first” is not acceptable as the primary explanation layer for a system of this complexity.

---

## 16. Non-Functional Requirements

> **STATUS: ❌ NOT DEFINED / NOT MEASURED.** No performance targets have been formally agreed. No p50/p95 latency benchmarks exist for prepare or dispatch. Determinism, idempotency, observability, and security-boundary requirements listed here have not been formally validated against the current implementation.

### 16.1 Performance

Targets should be defined now.

Suggested initial targets:

- prepare endpoint p50 under 1.5s for a single program
- prepare endpoint p95 under 4s for multi-program execution
- dispatch endpoint response under 1s for accepted submissions
- UI readiness refresh under 2s after data changes where cached context is reusable

### 16.2 Determinism

For identical inputs, preparation output should be identical except for timestamps and IDs.

### 16.3 Idempotency

Dispatch must be idempotent at the prepared-context level.

### 16.4 Observability

Every prepare and dispatch flow should emit:

- correlation ID
- prepared context ID
- order ID
- review program IDs
- criteria counts
- ready/blocked counts
- source conflict counts
- engine dispatch counts

### 16.5 Security and data boundaries

The system must respect tenant, client, and sub-client boundaries at every stage of context assembly and dispatch.

No engine payload should include data not authorized for that order context.

### 16.6 Zero infra creation in runtime code

All new containers/artifacts must be provisioned via infrastructure code, not dynamically created at runtime.

---

## 17. Observability and Audit Design

> **STATUS: PARTIAL.** `review-program.prepare.started|completed|failed` lifecycle events exist. **Most of the metrics defined in 17.2 and the audit-question answering capability in 17.3 do not exist. `review-program.result.ingested`, `dispatch.partial`, and the full metrics suite are not implemented.**

### 17.1 Required events

Recommended events:

- `review-program.prepare.started`
- `review-program.prepare.completed`
- `review-program.prepare.failed`
- `review-program.dispatch.started`
- `review-program.dispatch.completed`
- `review-program.dispatch.partial`
- `review-program.dispatch.failed`
- `review-program.result.ingested`

### 17.2 Required metrics

Recommended metrics:

- preparation latency
- dispatch latency
- criteria ready ratio
- criteria blocked ratio
- extraction-required ratio
- comp-context-missing ratio
- source-conflict ratio
- partial-run ratio
- rerun-after-data-change ratio

### 17.3 Audit questions the system must answer

For any review run, we should be able to answer:

- what data sources were used,
- what was missing,
- what conflicts existed,
- why the run was allowed to proceed,
- why any criterion was skipped,
- what changed since the prior run.

---

## 18. Test Strategy for a Best-in-Class Review System

> **STATUS: PARTIAL.** Unit tests exist for assembly and requirement planning. **The contract tests (18.2), integration tests for enrichment-only / comp-sensitive / partial-runnable / cross-engine flows (18.3), regression tests for the scenarios in 18.4, and golden fixtures (18.5) do not exist.**

### 18.1 Unit tests

Must cover:

- source precedence resolution
- derived field resolution
- conflict detection
- criterion readiness calculation
- program readiness aggregation
- engine payload generation

### 18.2 Contract tests

Must cover:

- prepare endpoint request/response
- dispatch endpoint request/response
- explain endpoint retrieval
- engine adapter payload shapes

### 18.3 Integration tests

Must cover:

- enrichment-only review flow
- document-only review flow
- comp-sensitive review flow
- mixed Axiom + MOP/Prio program flow
- partial-runnable program flow

### 18.4 Regression tests

Must cover:

- stale review-program documents
- missing `subClientId`
- no snapshot present
- snapshot present but comp context missing
- conflicting subject data across sources

### 18.5 Golden test fixtures

We should maintain gold fixtures for:

- simple order with enrichment only
- order with complete appraisal extraction
- order with reviewer-selected comps and adjustments
- order with missing required documents
- order with conflicting source data
- order with mixed ready and blocked criteria

---

## 19. Rollout Strategy

> **STATUS: ❌ NOT STARTED.** No feature flags exist for the preparation flow. Dual-run comparison mode does not exist. Exit criteria for full migration have not been formally agreed. The rollout plan described here has not been actioned.

### 19.1 Controlled rollout

Do not replace the current flow in one cut.

Recommended rollout:

1. backend prepare endpoint behind feature flag
2. internal-only readiness UI
3. dual-run comparison mode
4. engine adapter parity validation
5. production rollout by tenant/sub-client/program set

### 19.2 Dual-run mode

For a period, run:

- current snapshot-gated flow
- new preparation-based flow

Then compare:

- readiness differences
- criteria coverage differences
- payload differences
- result differences

### 19.3 Exit criteria for full migration

- readiness explanations are stable
- adapter payloads are validated
- blocker classifications are accurate
- reviewers trust the output
- no critical audit gaps remain

---

## 20. Open Decisions We Should Settle Early

> **STATUS: NONE OF THESE ARE SETTLED.** Every question in this section is genuinely open. Code behavior today reflects accidental emergence, not explicit design decisions. These must be decided before Phase 2 (context model) and Phase 3 (assembly service formalization) can be considered complete.

These decisions should be made explicitly rather than emerging accidentally in code.

- [ ] Will `ReviewContext` be persisted as a new artifact or synthesized on demand only?
- [ ] Will comps/adjustments live inside canonical snapshot or only inside `ReviewContext`?
- [ ] What thresholds define a material source conflict?
- [ ] Which criteria may run in partial mode vs must hard-block the entire program?
- [ ] How will MOP/Prio declare its requirement model?
- [ ] Will preparation cache be invalidated by document upload, extraction completion, comp edits, adjustment edits, and enrichment refresh?
- [ ] How long should a prepared context remain dispatchable before it becomes stale?
- [ ] Which warnings require explicit user confirmation before dispatch?

---

## 21. Definition of Done for “World’s Best Review System”

> **STATUS: NOT DONE.** Zero of the following ten criteria are met today. This section is the definitive target. Work is not complete until every item below is literally true.

We should consider this initiative complete only when all of the following are true:

1. A user can select one or more review programs and immediately see true requirement-aware readiness.
2. The system can explain, per criterion, why it is ready, partially ready, or blocked.
3. The system uses the best available data source with explicit provenance.
4. Comp selection and adjustments materially participate in review execution where relevant.
5. Extraction is invoked only when actually required.
6. Axiom and MOP/Prio each receive prepared, explainable, engine-specific payloads.
7. Partial execution is supported safely and transparently.
8. Every run is reproducible and auditable.
9. Reviewers trust the system because it is explicit, deterministic, and debuggable.
10. The UI feels like an expert operations system, not a thin dispatch shell.
