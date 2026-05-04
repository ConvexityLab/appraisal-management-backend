# Axiom + MOP/Prio Multi-Engine Refactor — Implementation Guide

**Date:** 2026-04-04  
**Status:** In Progress  
**Primary Repo:** appraisal-management-backend  
**Scope:** Engagement/Loan/Property/Document data model, extraction-only and criteria-only orchestration, canonical snapshot strategy, auditability, reruns, multi-engine submission (Axiom + MOP/Prio), and phased migration from combined pipeline flow.

---

## 1) Problem Statement

Current implementation is partially wired but still too order-scoped in key paths. We need to refactor to a model where:

- Engagements contain many loans/properties.
- Each loan/property contains many documents.
- Each document supports many extraction runs (rerunnable, immutable history).
- Each criteria program supports many criteria runs (rerunnable, immutable history), including repeated runs of individual criteria steps.
- Document schema and criteria program are both versioned by client/subClient/version.
- Canonical dataset snapshots are built from all relevant sources (Bridge, Attom, appraisal/BPO/inspection/desktop-review docs, etc.).
- Criteria evaluation sends only step-relevant canonical slices to the LLM.
- Execution can target Axiom and/or MOP/Prio per tenant/program policy.
- All execution paths are human-reviewable, auditable, and replayable.

---

## 2) Target Domain Model (Authoritative)

- Engagement
  - id, tenantId, status, metadata
- LoanPropertyContext
  - id, engagementId, loan identifiers, property identifiers
- Document
  - id, loanPropertyContextId, documentType, source, blobRef, schemaKey, version metadata
- DocumentExtractionRun
  - id, documentId, schemaKey(client/subClient/documentType/version), pipelineMode, status, inputFingerprint, outputRef, evidenceMapRef, startedAt, completedAt, parentRunId(optional), rerunReason
- CanonicalSnapshot
  - id, engagementId, loanPropertyContextId, snapshotVersion, sourceRefs, normalizedDataRef, createdByRunIds, createdAt
- CriteriaRun
  - id, engagementId, loanPropertyContextId, criteriaProgramKey(client/subClient/program/version), snapshotId, status, overallDecision, overallScore, startedAt, completedAt, parentRunId(optional), rerunReason
- CriteriaStepRun
  - id, criteriaRunId, stepKey, status, model metadata, promptRef, inputSliceRef, outputRef, evidenceRefs, confidence, startedAt, completedAt, error

---

## 3) Pipeline Modes and Usage

- Extraction-only pipeline (Axiom):
  - Primary mode for document normalization.
  - Triggered on document ingestion and explicit reruns.
- Criteria-only pipeline (Axiom):
  - Primary mode for criteria execution against immutable canonical snapshot.
- Full combined pipeline (Axiom):
  - Compatibility/fallback mode during transition.
  - Used for parity checks and controlled rollout only.

### Multi-Engine Execution Targets

- Axiom and MOP/Prio are first-class peer execution engines.
- MOP/Prio support is required for both extraction and criteria workflows (not optional backlog).
- Engine routing is policy-driven by tenant/program/version and must be explicit per run.
- Every run must persist `engine` + `engineVersion` + `engineRunRef` to support audit and replay.
- Engine adapter boundaries must isolate provider-specific payload/response shapes from canonical contracts.

### First-Class Engine Standard

An engine is considered first-class only when all of the following are true:

- It supports extraction-only and criteria-only orchestration paths.
- It supports rerun semantics with immutable run lineage.
- It exposes auditable request/response/event traceability in run records.
- It passes parity, replay, and rollback-readiness gates defined in this guide.

---

## 4) Non-Negotiable Rules

- [ ] No silent fallback behavior for missing required config or version keys.
- [ ] Every run is immutable and append-only; reruns create new run records.
- [ ] Every criteria decision references a specific snapshotId and program version.
- [ ] Every step execution stores prompt/model/input slice/evidence/output metadata for audit.
- [ ] Combined pipeline does not remain primary after migration complete.
- [ ] Engine routing (Axiom vs MOP/Prio) is explicit, deterministic, and persisted per run.
- [ ] No engine-specific path can bypass canonical snapshot, audit trail, or rerun lineage requirements.
- [ ] Cross-tenant data boundaries are always enforced.

---

## 5) Phase Plan with Checklists

## Phase 0 — Contract & State Machine Freeze

**Goal:** lock definitions before implementation.

- [ ] Finalize entity contracts and required fields.
- [ ] Define lifecycle states for ExtractionRun / CriteriaRun / CriteriaStepRun.
- [ ] Define rerun lineage semantics (parentRunId, reason, actor).
- [ ] Define schema/program version resolution rules.
- [ ] Define error taxonomy and retry policy by pipeline mode.
- [ ] Define engine routing policy contract (tenant/program/version -> engine target).

**Exit Criteria:**

- [ ] State transition diagram approved.
- [ ] API contract draft approved.

---

## Phase 1 — Data Model Split (Storage)

**Goal:** introduce run-ledger entities without breaking existing reads.

- [ ] Add storage contracts for DocumentExtractionRun.
- [ ] Add storage contracts for CanonicalSnapshot.
- [ ] Add storage contracts for CriteriaRun and CriteriaStepRun.
- [ ] Add indexes/queries for per-document, per-loan/property, per-engagement timelines.
- [ ] Add immutable write guards (no update-overwrite for completed runs).
- [ ] Add run metadata fields: engine, engineVersion, engineRunRef, engineRequestRef, engineResponseRef.

**Exit Criteria:**

- [ ] New entities persisted and queryable in test env.
- [ ] Existing endpoints remain backward compatible.

---

## Phase 2 — Extraction Orchestrator

**Goal:** extraction-only orchestration as first-class path.

- [ ] Implement `startDocumentExtractionRun` service.
- [ ] Persist input fingerprint and schema key per extraction run.
- [ ] Support rerun with explicit reason code.
- [ ] Persist normalized extraction artifacts + evidence map refs.
- [ ] Emit run lifecycle events for UI/audit stream.
- [ ] Add adapter path for MOP/Prio extraction submission and status/result hydration.

**Exit Criteria:**

- [ ] Documents can run extraction-only independently of criteria.
- [ ] Multiple runs per document visible with lineage.
- [ ] Both Axiom and MOP/Prio extraction adapters satisfy the same run contract.

---

## Phase 3 — Canonical Snapshot Builder

**Goal:** deterministic snapshot construction from all available sources.

- [ ] Build source adapters for Bridge/Attom and document extraction outputs.
- [ ] Normalize to canonical schema with provenance metadata.
- [ ] Create immutable snapshot per trigger/run context.
- [ ] Validate completeness gates before criteria execution.

**Exit Criteria:**

- [ ] Criteria can execute from snapshotId only.
- [ ] Snapshot provenance trace is queryable.

---

## Phase 4 — Criteria Orchestrator (Step-Oriented)

**Goal:** criteria-only execution with step-level LLM scoping.

- [ ] Implement `startCriteriaRun(snapshotId, programKey)`.
- [ ] Implement selective input slicing per criteria step.
- [ ] Persist CriteriaStepRun with prompt/model/evidence/output refs.
- [ ] Support full rerun and partial step rerun.
- [ ] Aggregate step outputs into CriteriaRun summary.
- [ ] Add adapter path for MOP/Prio criteria submission and step/result mapping.

**Exit Criteria:**

- [ ] Step-level replay and audit trail available.
- [ ] Program version pinning enforced.
- [ ] Both Axiom and MOP/Prio criteria adapters satisfy the same step-run contract.

---

## Phase 5 — Combined Pipeline Compatibility Layer

**Goal:** preserve reliability during migration.

- [ ] Keep combined pipeline behind feature flag.
- [ ] Add dual-run compare mode (split vs combined) for selected tenants.
- [ ] Record parity metrics (decision/score/evidence deltas).
- [ ] Define cutoff criteria for disabling combined primary path.
- [ ] Add cross-engine compare mode (Axiom vs MOP/Prio) for selected tenants/programs.

**Exit Criteria:**

- [ ] Split path achieves agreed parity and stability thresholds.
- [ ] Cross-engine parity thresholds (Axiom vs MOP/Prio) are met for enabled tenant/program cohorts.

---

## Phase 6 — API Surface Refactor

**Goal:** explicit run-oriented API model.

- [ ] Add endpoint: start extraction run.
- [ ] Add endpoint: rerun extraction.
- [ ] Add endpoint: create canonical snapshot.
- [ ] Add endpoint: start criteria run.
- [ ] Add endpoint: rerun criteria (full/partial step).
- [ ] Add endpoints: run history, lineage, audit details, evidence retrieval.
- [ ] Add engine-aware request options (`engineTarget`, optional `enginePolicyRef`) and expose engine metadata on all run reads.

**Exit Criteria:**

- [ ] Frontend can drive extraction and criteria independently.

---

## Phase 7 — Frontend Tracker Refactor

**Goal:** align UX with run-ledger architecture.

- [ ] Split tracker lanes: Ingestion, Extraction, Snapshot, Criteria.
- [ ] Display rerun lineage and version tags.
- [ ] Add human-review view with evidence links and step outputs.
- [ ] Preserve persisted history scoped by engagement/order/context.

**Exit Criteria:**

- [ ] Operators can inspect and compare runs without backend log digging.

---

## Phase 8 — Migration & Backfill

**Goal:** move safely with no data loss.

- [ ] Define backfill mapping from historical combined records.
- [ ] Mark derived records with provenance flags.
- [ ] Run backfill in idempotent batches with checkpointing.
- [ ] Validate sampled parity before broad rollout.

**Exit Criteria:**

- [ ] Historical traceability retained across old and new models.

---

## Phase 9 — Test, Replay, and Rollout

**Goal:** prove correctness and operational safety.

- [ ] Golden dataset test suite for extraction + criteria outcomes.
- [ ] Replay harness for deterministic snapshot and criteria comparisons.
- [ ] Contract tests for all new endpoints.
- [ ] Tenant-gated rollout plan + rollback criteria.
- [ ] Production runbooks for incident triage.
- [ ] Engine parity tests across Axiom and MOP/Prio adapters for extraction and criteria paths.

**Exit Criteria:**

- [ ] Rollout complete for target tenants with SLO compliance.
- [ ] MOP/Prio engine path validated and production-ready for enabled tenants.
- [ ] MOP/Prio passes first-class engine standard (feature, audit, rerun, parity, replay).

---

## Phase 10 — External Engine Integration (MOP/Prio)

**Goal:** production-grade support for submitting and tracking runs in MOP/Prio.

- [ ] Define MOP/Prio adapter interfaces for extraction and criteria submissions.
- [ ] Map canonical request contracts to MOP/Prio payloads (versioned transformations).
- [ ] Implement status polling/webhook handlers for MOP/Prio run lifecycle.
- [ ] Normalize MOP/Prio results into CanonicalSnapshot and CriteriaRun/CriteriaStepRun models.
- [ ] Persist engine-native raw payload references for audit (request/response/event).
- [ ] Implement retry/idempotency strategy specific to MOP/Prio semantics.
- [ ] Add tenant-level feature flags and rollout controls for MOP/Prio enablement.

**Exit Criteria:**

- [ ] MOP/Prio adapter passes contract, parity, and replay validation.
- [ ] Target tenants can run extraction and criteria through MOP/Prio with full audit visibility.

---

## Phase 10.1 — Engine-Aware API Contract (Implementation Spec)

**Goal:** define concrete request/response contracts so engineering can implement adapters and orchestration consistently.

### 10.1.1 Engine Target and Policy Fields

- `engineTarget`: `"AXIOM" | "MOP_PRIO"` (required for direct-run endpoints unless policy mode is used).
- `enginePolicyRef`: string (optional; policy key for tenant/program/version routing).
- `engineSelectionMode`: `"EXPLICIT" | "POLICY"` (derived server-side and persisted on run records).

### 10.1.2 Idempotency and Correlation Standards

- Header: `Idempotency-Key` (required on run-creation endpoints).
- Header: `X-Correlation-Id` (required on run-creation endpoints).
- Idempotency key format (recommended):
  - extraction: `ext:{tenantId}:{documentId}:{schemaKey}:{reasonCode}:{requestNonce}`
  - criteria: `crt:{tenantId}:{snapshotId}:{programKey}:{runMode}:{requestNonce}`
- Server persists dedupe hash + first-seen timestamp and returns existing run on duplicate.

### 10.1.3 Run Metadata (Required on All Run Reads)

- `engine`: `"AXIOM" | "MOP_PRIO"`
- `engineVersion`: string
- `engineRunRef`: string
- `engineRequestRef`: string
- `engineResponseRef`: string
- `engineSelectionMode`: `"EXPLICIT" | "POLICY"`
- `enginePolicyRef`?: string

### 10.1.4 Endpoint Contracts (Draft)

#### Start extraction run

`POST /api/runs/extraction`

Request:

```json
{
  "documentId": "doc_123",
  "schemaKey": {
    "clientId": "lenderA",
    "subClientId": "servicingEast",
    "documentType": "APPRAISAL_REPORT",
    "version": "2.1.0"
  },
  "runReason": "INITIAL_INGEST",
  "engineTarget": "MOP_PRIO",
  "enginePolicyRef": "policy.default.v1"
}
```

Response (`202`):

```json
{
  "runId": "ext_run_abc",
  "status": "queued",
  "engine": "MOP_PRIO",
  "engineRunRef": "mop-job-9981",
  "engineSelectionMode": "EXPLICIT"
}
```

#### Start criteria run

`POST /api/runs/criteria`

Request:

```json
{
  "snapshotId": "snap_456",
  "programKey": {
    "clientId": "lenderA",
    "subClientId": "servicingEast",
    "programId": "FNMA_URAR_CORE",
    "version": "3.4.2"
  },
  "runMode": "FULL",
  "engineTarget": "AXIOM"
}
```

Response (`202`):

```json
{
  "runId": "crt_run_xyz",
  "status": "queued",
  "engine": "AXIOM",
  "engineRunRef": "ax-pipeline-714",
  "engineSelectionMode": "EXPLICIT"
}
```

#### Rerun criteria step

`POST /api/runs/criteria/{criteriaRunId}/steps/{stepKey}/rerun`

Request:

```json
{
  "rerunReason": "HUMAN_REVIEW_OVERRIDE",
  "engineTarget": "MOP_PRIO"
}
```

Response (`202`):

```json
{
  "stepRunId": "step_run_001",
  "status": "queued",
  "parentStepRunId": "step_run_000",
  "engine": "MOP_PRIO"
}
```

### 10.1.5 Adapter Normalization Contract

- Adapters may return engine-specific payloads internally, but orchestrator persists normalized records only.
- Required normalized outputs:
  - extraction: structured fields + evidence map refs + extraction quality metadata.
  - criteria: step outcomes + evidence refs + confidence + rationale + remediation.
- Raw engine payloads are stored as references (`engineRequestRef`, `engineResponseRef`) for audit.

### 10.1.6 Contract Acceptance Checklist

- [ ] All run-creation endpoints require `Idempotency-Key` and `X-Correlation-Id`.
- [ ] All run-read endpoints include required engine metadata fields.
- [ ] Both `engineTarget=AXIOM` and `engineTarget=MOP_PRIO` pass contract tests.
- [ ] Policy-routing mode and explicit mode both verified.
- [ ] Duplicate submissions return existing run records, not duplicate active runs.

---

## 6) Milestone Tracker

| Milestone | Target Date | Owner | Status | Notes |
|---|---|---|---|---|
| Phase 0 complete | TBD | TBD | ⬜ Not Started | |
| Phase 1 complete | TBD | TBD | ⬜ Not Started | |
| Phase 2 complete | TBD | TBD | ⬜ Not Started | |
| Phase 3 complete | TBD | TBD | ⬜ Not Started | |
| Phase 4 complete | TBD | TBD | ⬜ Not Started | |
| Phase 5 complete | TBD | TBD | ⬜ Not Started | |
| Phase 6 complete | TBD | TBD | ⬜ Not Started | |
| Phase 7 complete | TBD | TBD | ⬜ Not Started | |
| Phase 8 complete | TBD | TBD | ⬜ Not Started | |
| Phase 9 complete | TBD | TBD | ⬜ Not Started | |
| Phase 10 complete | TBD | TBD | ⬜ Not Started | |
| Phase 10.1 complete | TBD | TBD | ⬜ Not Started | |

---

## 7) Decision Log

| Date | Decision | Owner | Rationale | Impact |
|---|---|---|---|---|
| 2026-04-04 | Refactor to split extraction-only and criteria-only primary paths; keep combined mode as transitional fallback | Team | Better auditability, rerun control, and selective LLM data scope | Requires new run-ledger entities and migration plan |
| 2026-04-04 | Support MOP/Prio as an additional execution engine alongside Axiom | Team | Reduce engine coupling and enable tenant/program-specific routing | Requires engine adapter layer, parity tests, and rollout controls |
| 2026-04-04 | Treat MOP/Prio as a first-class peer engine with equal run/audit/replay guarantees | Team | Ensure multi-engine strategy is operationally real, not aspirational | Requires equal contract enforcement across adapters |

---

## 8) Risks and Mitigations

- [ ] Risk: parity drift between combined and split pipelines.  
  **Mitigation:** dual-run compare mode and threshold gating.
- [ ] Risk: incomplete source data at criteria start.  
  **Mitigation:** completeness gates and explicit missing-data status.
- [ ] Risk: migration ambiguity for historical runs.  
  **Mitigation:** provenance flags and non-destructive backfill.
- [ ] Risk: operational complexity increases.  
  **Mitigation:** runbooks, dashboards, and strict event contracts.
- [ ] Risk: cross-engine behavior differences (Axiom vs MOP/Prio) create decision drift.  
  **Mitigation:** engine parity suite, dual-run compare mode, and policy-gated cutover.

---

## 9) Out of Scope (Current Stage)

- Axiom Actor/Agent orchestration as primary execution engine.
- Autonomous order/engagement agents that perform tasks and Q&A.

> Note: Actor/Agent capabilities are planned for later phases once run ledger and snapshot architecture are stable.

---

## 10) Working Conventions

- [ ] Every implementation PR references Phase + checklist item(s) from this guide.
- [ ] Every completed item updates this document in the same PR.
- [ ] No direct production cutover without parity and replay signoff.

---

## 11) Change Log

- **2026-04-04:** Initial implementation guide created with phased checklist and acceptance criteria.
- **2026-04-04:** Added MOP/Prio external-engine integration plan, engine-aware checklist items, Phase 10, and parity/rollout requirements.
- **2026-04-04:** Added Phase 10.1 engine-aware API contract spec (engineTarget, idempotency, endpoint examples, and adapter normalization requirements).

---

## 12) Execution Walkdown Checklist (Simple, Sectioned)

Use this as the day-to-day checklist. Mark items complete as work lands.

### A) Implement — Foundation

- [ ] Confirm ownership for each phase area (data model, extraction, criteria, API, UI, migration, testing).
- [ ] Freeze entity contracts for DocumentExtractionRun, CanonicalSnapshot, CriteriaRun, CriteriaStepRun.
- [ ] Freeze engine metadata fields (`engine`, `engineVersion`, `engineRunRef`, `engineRequestRef`, `engineResponseRef`).
- [ ] Freeze engine routing rules (`engineTarget`, policy mode behavior, fallback rules).
- [ ] Define state transitions for extraction runs and criteria runs.
- [ ] Define rerun lineage rules (`parentRunId`, `rerunReason`, actor, timestamp).
- [ ] Define strict required config list (no silent defaults).

### B) Implement — Storage and Contracts

- [ ] Add storage model for DocumentExtractionRun.
- [ ] Add storage model for CanonicalSnapshot.
- [ ] Add storage model for CriteriaRun.
- [ ] Add storage model for CriteriaStepRun.
- [ ] Add indexes for queries by engagement, loan/property, document, run status, and date.
- [ ] Add immutable write guard for completed runs.
- [ ] Add standardized error model and status codes for run APIs.
- [ ] Add idempotency store/logic for run creation endpoints.

### C) Implement — Extraction Path

- [ ] Implement start extraction run endpoint/service.
- [ ] Persist extraction input fingerprint and schema key.
- [ ] Add Axiom extraction adapter path.
- [ ] Add MOP/Prio extraction adapter path.
- [ ] Normalize extraction output to canonical contract.
- [ ] Persist extraction evidence references and quality metadata.
- [ ] Emit extraction lifecycle events (queued/running/completed/failed).
- [ ] Implement extraction rerun endpoint with reason code.

### D) Implement — Canonical Snapshot Path

- [ ] Build Bridge adapter normalization.
- [ ] Build Attom adapter normalization.
- [ ] Merge extraction outputs into canonical snapshot builder.
- [ ] Persist immutable snapshot with provenance refs.
- [ ] Enforce completeness gates before criteria start.
- [ ] Add snapshot diff capability for reruns/updates.

### E) Implement — Criteria Path

- [ ] Implement start criteria run endpoint/service.
- [ ] Implement step-level input slicing from snapshot.
- [ ] Add Axiom criteria adapter path.
- [ ] Add MOP/Prio criteria adapter path.
- [ ] Persist step outcomes, confidence, rationale, remediation, evidence refs.
- [ ] Aggregate step outcomes into final criteria run summary.
- [ ] Implement full criteria rerun endpoint.
- [ ] Implement single-step rerun endpoint.

### F) Implement — API and UI Surfaces

- [ ] Ensure all run-create endpoints require `Idempotency-Key` and `X-Correlation-Id`.
- [ ] Ensure all run-read endpoints return engine metadata.
- [ ] Ensure all endpoints support explicit engine mode and policy mode.
- [ ] Update frontend tracker lanes (Ingestion/Extraction/Snapshot/Criteria).
- [ ] Show run lineage and rerun chains in UI.
- [ ] Show engine target used for each run/step.
- [ ] Show audit evidence links and raw event trace references.

### G) Test — Contract and Unit

- [ ] Contract test: extraction run create/read for Axiom.
- [ ] Contract test: extraction run create/read for MOP/Prio.
- [ ] Contract test: criteria run create/read for Axiom.
- [ ] Contract test: criteria run create/read for MOP/Prio.
- [ ] Unit test: idempotency dedupe behavior.
- [ ] Unit test: rerun lineage creation rules.
- [ ] Unit test: engine policy routing outcomes.
- [ ] Unit test: canonical completeness gate behavior.

### H) Test — Integration and Replay

- [ ] Integration test: document -> extraction -> snapshot -> criteria happy path (Axiom).
- [ ] Integration test: document -> extraction -> snapshot -> criteria happy path (MOP/Prio).
- [ ] Integration test: mixed-engine flow (extraction on one engine, criteria on the other).
- [ ] Integration test: failure and retry behavior per engine.
- [ ] Replay test: deterministic result from same snapshot + same program version.
- [ ] Replay test: compare rerun outputs and capture drift.
- [ ] Cross-engine parity test for selected datasets.

### I) Improve — Performance, Operability, Safety

- [ ] Add run-level metrics (latency, error rate, queue depth, retry count) by engine.
- [ ] Add dashboards for extraction and criteria health by tenant/program.
- [ ] Add alerting for stuck runs and parity drift thresholds.
- [ ] Add runbooks for incident triage and rerun procedures.
- [ ] Tune concurrency, polling, and timeout strategies per engine.
- [ ] Validate tenant isolation and access controls on all run/read paths.

### J) Migration and Rollout

- [ ] Finalize historical backfill mapping from combined records.
- [ ] Run backfill in staged batches with checkpoints.
- [ ] Validate sample audits after each backfill batch.
- [ ] Enable dual-run compare mode for pilot tenants.
- [ ] Confirm parity thresholds for pilot cohort.
- [ ] Expand rollout tenant-by-tenant behind feature flags.
- [ ] Define and validate rollback procedure.

### K) Sign-Off Gates (Must All Be Checked)

- [ ] All non-negotiable rules are satisfied.
- [ ] Axiom passes first-class engine standard.
- [ ] MOP/Prio passes first-class engine standard.
- [ ] API contract tests pass for both engines.
- [ ] Replay and parity gates pass for approved datasets.
- [ ] Audit trail is complete for extraction and criteria runs.
- [ ] Human-review UI supports evidence and rerun tracing.
- [ ] Production readiness review completed.
- [ ] Final go-live approval documented.

### L) Ongoing Weekly Checkpoint

- [ ] Update milestone statuses and owners.
- [ ] List blockers and mitigation owners.
- [ ] Review parity drift trends.
- [ ] Review top failure reasons and remediation actions.
- [ ] Confirm no silent fallback behavior was introduced.
- [ ] Update this checklist and change log with any scope changes.

