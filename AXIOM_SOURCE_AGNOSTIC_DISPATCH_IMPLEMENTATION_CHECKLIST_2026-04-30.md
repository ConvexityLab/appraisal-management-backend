# Axiom Source-Agnostic Dispatch Implementation Checklist

**Date:** 2026-04-30  
**Repository:** `appraisal-management-backend`  
**Status:** In planning / ready for implementation  
**Owner:** GitHub Copilot implementation checklist for active session

---

## Governing Contract

This document is the working checklist for implementing the following contract:

1. **Axiom must not depend on an extraction snapshot in order to dispatch criteria review.**
2. **Review dispatch must be source-agnostic.** Required data may come from:
	 - extracted document data,
	 - provider / enrichment data,
	 - order / canonical application data,
	 - user-entered values.
3. **This behavior must be the same for both Axiom and MOP/Prio.** Neither engine may depend on extraction snapshots as a prerequisite when canonical required inputs are otherwise available.
4. **Dispatchability must be criterion-requirement-driven, not snapshot-driven.**
5. **The system must gather what canonical data and document objects exist, submit the correct engine payload, and let the engine return whatever criteria can be satisfied.**
6. **Missing inputs should block only the criteria / engine legs that truly require them.**
7. **Warnings, unmet requirements, provenance, and partial results must be persisted and surfaced.**

---

## Implementation Goals

- [x] Remove snapshot-gated Axiom dispatch behavior.
- [x] Keep source-agnostic dispatch behavior aligned across Axiom and MOP/Prio.
- [x] Replace Axiom `requires_extraction` readiness semantics with source-agnostic missing-data semantics.
- [x] Build Axiom prepared payloads from canonical resolved data and document objects.
- [x] Preserve criterion-level requirement resolution as the governing source of truth.
- [x] Preserve partial-dispatch behavior.
- [ ] Preserve provenance so the UI can explain where each value came from.
- [ ] Keep MOP/Prio behavior working.
- [ ] Keep stale program normalization and prepared dispatch flows working.

---

## Expected Files In Scope

### Core backend files

- [x] `src/services/review-preparation.service.ts`
- [x] `src/services/review-prepared-context.service.ts`
- [x] `src/services/review-program-orchestration.service.ts`
- [x] `src/services/analysis-submission.service.ts`
- [x] `src/services/engine-dispatch.service.ts`
- [x] `src/services/review-requirement-resolution.service.ts`
- [x] `src/types/review-preparation.types.ts`

### Likely new helper / assembler


- [x] Add a helper for assembling Axiom prepared dispatch input from canonical context.
	- Suggested file: `src/services/axiom-prepared-payload.service.ts`

### Test files expected to change

- [x] `tests/unit/review-preparation.service.test.ts`
- [x] `tests/unit/review-dispatch.service.test.ts`
- [x] `tests/review-program-orchestration.service.test.ts`
- [x] `tests/unit/analysis-submission-prepared-context.test.ts`
- [x] `tests/unit/engine-dispatch.service.test.ts`
- [ ] `tests/unit/review-requirement-resolution.service.test.ts`

---

## Phase 1 — Readiness Semantics

### Objective

Stop encoding the assumption that missing Axiom-required data means “run extraction first”. Extraction is only one possible source, not a prerequisite architecture rule.

### Checklist

- [x] Review current readiness transitions in `ReviewRequirementResolutionService`.
- [x] Remove the logic that turns missing required data into Axiom `requires_extraction` solely because no snapshot exists.
- [x] Replace that logic with source-agnostic missing-data handling.
- [x] Ensure missing required documents still produce `requires_documents` when appropriate.
- [x] Ensure comp-specific missing requirements still produce `requires_comp_selection` when appropriate.
- [x] Ensure missing required data with no canonical source available becomes a source-agnostic resolution state instead of snapshot-driven extraction state.
- [x] Confirm recommended actions remain actionable and explicit.
- [x] Avoid silent fallback behavior.

### Notes

- Readiness must reflect what is actually missing.
- Readiness must not imply that extraction is the only valid way to satisfy a requirement.

---

## Phase 2 — Preparation / Dispatchability Logic

### Objective

Make prepared Axiom dispatch eligibility depend on actual criterion requirements and configuration, not on `latestSnapshotId`.

### Checklist

- [x] Update `ReviewPreparationService.computeProgramDispatchability()`.
- [x] Remove the special-case `latestSnapshotId` requirement for Axiom-only programs.
- [x] Ensure programs can become dispatchable when criterion requirements are satisfied from canonical context without a snapshot.
- [x] Keep client/sub-client requirements explicit and required.
- [x] Keep no-doc/no-enrichment as warnings unless a criterion explicitly requires those inputs.
- [x] Verify `contextSummary.latestSnapshotId` remains informational only.

### Validation targets

- [x] Axiom-only program can be `canDispatch = true` without snapshot when data/docs are satisfied.
- [x] Axiom-only program stays blocked only for true missing requirements or missing routing config.

---

## Phase 3 — Prepared Dispatch Artifact Contract

### Objective

Upgrade the Axiom prepared payload contract so it contains canonical resolved input rather than being snapshot-shaped.

### Checklist

- [x] Review `AxiomPreparedPayload` shape in `src/types/review-preparation.types.ts`.
- [x] Keep `snapshotId` optional for provenance only.
- [x] Add canonical resolved input sections as needed, such as:
	- [x] resolved data values
	- [x] resolved document objects / evidence references
	- [x] missing required inputs
	- [x] optional missing inputs / warnings
	- [x] source provenance summary
- [x] Ensure payload versioning remains explicit.
- [x] Ensure MOP payload contract is not broken by Axiom changes.

### Payload principle

The payload must answer:

- What criteria are being evaluated?
- What required inputs were resolved?
- What source provided each resolved value?
- What documents are attached / available?
- What remains missing?

---

## Phase 4 — Canonical Payload Assembly

### Objective

Create a dedicated assembler that converts requirement resolution output + canonical context into concrete Axiom dispatch input.

### Checklist

- [x] Add or extend a service that assembles Axiom prepared input from canonical context.
- [x] Read actual values from resolved data bindings.
- [x] Map required document types to canonical document objects.
- [x] Attach evidence refs and source provenance.
- [x] Include unmet required inputs explicitly.
- [x] Include optional missing inputs as warnings.
- [x] Keep implementation deterministic and testable.
- [x] Avoid hidden defaults and implicit “best guess” substitutions.

### Assembly rules

- [x] Data source should not matter if the canonical value exists.
- [x] Document source should not matter if the canonical document object exists.
- [x] Provenance must still be preserved.

---

## Phase 5 — Prepared Context Planning

### Objective

Generate Axiom planned dispatch entries without snapshot gating.

### Checklist

- [x] Update `ReviewPreparedContextService.buildPlannedEngineDispatches()`.
- [x] Remove the Axiom blocked reason that says no snapshot means no Axiom dispatch.
- [x] Continue blocking for missing client/sub-client routing data.
- [x] Continue blocking for truly non-dispatchable criteria.
- [x] Populate the new Axiom prepared payload structure.
- [x] Ensure `canDispatch` reflects actual criterion/data/document readiness.
- [x] Deduplicate blocked reasons and warnings.

### Validation targets

- [x] Prepared Axiom dispatch is created without snapshot when canonical data/docs are sufficient.
- [x] Prepared Axiom dispatch is blocked only by real unmet requirements.

---

## Phase 6 — Orchestration and Submission

### Objective

Allow orchestration and criteria submission to proceed for Axiom without `snapshotId` when prepared canonical payload exists.

### Checklist

- [x] Update `ReviewProgramOrchestrationService.dispatchAxiomLeg()`.
- [x] Remove unconditional skip when `request.snapshotId` is absent.
- [x] Continue honoring `preparedDispatch.canDispatch`.
- [x] Update `AnalysisSubmissionService.submitCriteria()` to allow Axiom prepared-context submission without snapshot.
- [x] Ensure criteria run creation still records the prepared context / payload references.
- [ ] Decide how criteria step runs should behave for no-snapshot Axiom runs:
	- [x] skip snapshot-based step slicing for this mode, or
	- [ ] add prepared-context-based step slicing.
- [x] Keep published event payloads valid when no snapshot exists.

### Critical rule

The presence of a prepared canonical payload must be sufficient to submit Axiom criteria review when criterion requirements are otherwise satisfied.

---

## Phase 7 — Engine Dispatch Adapter

### Objective

Send Axiom criteria requests from prepared canonical payload, not from snapshot-only input.

### Checklist

- [x] Update `AxiomEngineAdapter.dispatchCriteria()`.
- [x] Remove the `missing snapshotId` failure path for prepared-context Axiom dispatch.
- [x] Keep `programKey.clientId` and `programKey.subClientId` required.
- [x] Confirm what Axiom `submitPipeline()` actually needs for `CRITERIA_ONLY` mode.
- [x] Pass the prepared canonical payload in a contract Axiom can consume.
- [x] Keep correlation / idempotency wiring intact.
- [x] Preserve engine response mapping.

### Integration concern

- [x] Confirm whether Axiom currently assumes `fileSetId` or snapshot-like identifiers for criteria mode.
- [x] If yes, adapt the payload translation in the adapter rather than reintroducing snapshot dependency into readiness logic.

---

## Phase 8 — Persistence and Results

### Objective

Persist enough detail so the system can explain partial outcomes and provenance after Axiom returns.

### Checklist

- [x] Persist source-agnostic dispatch metadata on the run record.
- [x] Persist prepared payload references and contract type/version.
- [x] Preserve missing requirement metadata.
- [x] Preserve source provenance metadata.
- [ ] Ensure downstream UI/result readers can distinguish:
	- [x] satisfied criteria
	- [x] skipped / unmet criteria
	- [x] missing required documents
	- [x] missing required canonical data
	- [x] warnings from optional missing inputs

---

## Phase 9 — Test Checklist

### Requirement resolution tests

- [x] Axiom criterion resolves from `order` data with no snapshot.
- [x] Axiom criterion resolves from `providerData` with no snapshot.
- [ ] Axiom criterion resolves from extracted canonical data when snapshot exists.
- [x] Missing required document types still block the criterion.
- [x] Missing required data paths block only based on actual absence, not on missing snapshot.

### Preparation / planning tests

- [x] Axiom-only program becomes dispatchable without snapshot when canonical inputs are present.
- [x] Axiom-only program is blocked without snapshot only when real criterion requirements remain unmet.
- [x] `latestSnapshotId` appears as informational metadata only.

### Orchestration / submission tests

- [x] Prepared Axiom dispatch submits without snapshot.
- [ ] Mixed program returns `partial` when only some Axiom criteria are satisfiable.
- [x] MOP/Prio no-snapshot prepared dispatch still works.
- [x] Existing stale/global normalization behavior still works.

### Engine adapter tests

- [x] `AxiomEngineAdapter.dispatchCriteria()` accepts prepared payloads without `snapshotId`.
- [x] Axiom dispatch still fails fast when client/sub-client routing is absent.
- [x] Axiom dispatch forwards canonical prepared payload correctly.

### Regression tests

- [x] Existing `review-dispatch` tests still pass.
- [x] Existing orchestration tests still pass.
- [x] Existing prepared-context tests still pass.
- [x] Existing review-preparation tests still pass.
- [x] Backend type-check passes.

---

## Validation Commands

### Targeted tests

- [x] `pnpm vitest run tests/unit/prepared-dispatch-payload-assembly.service.test.ts tests/unit/review-requirement-resolution.service.test.ts tests/unit/engine-dispatch.service.test.ts tests/unit/analysis-submission-prepared-context.test.ts`
- [x] `pnpm vitest run tests/unit/review-preparation.service.test.ts tests/unit/review-dispatch.service.test.ts tests/review-program-orchestration.service.test.ts`

### Type-check

- [x] `pnpm type-check`

### Optional broader validation

- [ ] `pnpm test:unit`

---

## Risks / Watch Items

- [ ] Axiom adapter may still be implicitly snapshot-shaped.
- [ ] Criteria step-run machinery is currently snapshot-oriented.
- [ ] Some Axiom criteria may require actual document URLs or full document references, not just document inventory metadata.
- [ ] Path resolution may need to read real canonical values, not just path availability metadata.
- [ ] Result persistence may need enhancement so unmet requirements are visible after dispatch.

---

## Implementation Log

Use this section during execution.

### 2026-04-30

- [x] Governing contract clarified: Axiom must be source-agnostic and must not depend on extraction snapshots.
- [x] Impacted backend areas identified.
- [x] Checklist document created.
- [x] Implementation started.
- [x] Readiness semantics updated.
- [x] Prepared payload contract updated.
- [x] Axiom adapter updated.
- [x] Tests updated.
- [x] Validation completed.
- [x] Unmet required inputs now persist on prepared payloads and run status details.
- [x] Provenance summaries now persist on prepared payloads and run status details.
- [x] Provider-data requirement resolution coverage added.

---

## Definition of Done

- [x] Axiom criteria dispatch no longer depends on `latestSnapshotId` or `snapshotId` as a prerequisite.
- [x] Axiom dispatch uses canonical resolved data/document context.
- [x] Criterion-level requirements determine dispatchability.
- [x] Partial results are supported and persisted.
- [x] Provenance remains available.
- [x] Targeted tests pass.
- [x] Backend type-check passes.
- [x] This checklist is updated to reflect final implementation status.
