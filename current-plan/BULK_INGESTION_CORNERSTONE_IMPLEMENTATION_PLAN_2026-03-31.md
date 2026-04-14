# Bulk Ingestion Cornerstone Implementation Plan

**Date:** 2026-03-31  
**System:** Appraisal Management Platform  
**Scope:** Canonical bulk intake pipeline for mixed tabular data (`CSV`/`XLSX`) + document uploads (`PDF`), including queue orchestration, Azure Functions processing, Axiom integration, auditability, and operator UI/UX.

---

## 1) Executive Summary

This document is the implementation cornerstone for bulk engagement/order ingestion. It defines the target architecture, processing stages, contracts, observability, failure model, and rollout checklist.

### Objective

Build a resilient, auditable, high-throughput bulk ingestion capability that:

1. Accepts **data + PDFs simultaneously**.
2. Associates related records/documents reliably.
3. Maps client input formats to a **single canonical data model** through adapters.
4. Queues and processes extraction/criteria workflows via **Azure Function Apps** + Service Bus.
5. Supports retries, partial-failure handling, and operator controls.
6. Provides enterprise-grade monitoring and management UI.

### Non-Negotiable Outcomes

- No silent data loss.
- No orphaned documents.
- No hidden fallback behavior.
- Full immutable audit trail at job, item, stage, and action levels.
- Deterministic idempotency for all asynchronous processing stages.

### Implementation Status Snapshot (2026-04-01)

Implemented in current branch/session:

- Mixed-flow bulk ingestion reaches terminal completion in local validation.
- Local eventing fallback supports explicit in-memory mock mode for development reliability.
- `BI-PERF-03` and `BI-PERF-04` benchmark harness execution paths are implemented and producing artifacts.
- `BI-PERF-03` now supports explicit A/B mode selection (`multipart` vs `shared-storage`) in the perf harness.

Validated benchmark outcomes from recent runs:

- `BI-PERF-03` shared-storage mode: passes configured submit latency threshold.
- `BI-PERF-03` multipart mode: functionally healthy (no 5xx), but remains above configured submit latency threshold.
- `BI-PERF-04`: passes configured latency/success thresholds.

Open implementation/review items:

- Security gate evidence bundle for this phase is still pending completion.
- Full matrix completion beyond BI-PERF-03/04 remains pending (read/export/control/SLO window scenarios).

---

## 2) Architectural Decisions (Locked)

## 2.1 Trigger & Processing Model

- Use backend API for authenticated intake.
- Use **Azure Service Bus** for asynchronous processing.
- Use **Azure Function Apps** as processing triggers (`ServiceBusTrigger`, optional `BlobTrigger` for scan/verification tasks).
- Keep long-running orchestration in queue/state model; use Durable Functions only if fan-in/fan-out complexity requires it.

## 2.2 Storage Model

- Data state and process state persist in Cosmos DB.
- Original PDFs are copied to permanent storage controlled by us.
- Store immutable source artifacts and normalized working artifacts separately.

## 2.3 Canonicalization

- Every client format maps into one canonical schema.
- Per-client adapters are isolated, versioned, and test-covered.
- Canonical validation is strict and explicit.

## 2.4 Failure Philosophy

- Fail item-level when possible; do not fail the entire job unless systemic conditions occur.
- Report partial success with precise per-item diagnostics.
- Retry only retryable failures with bounded policy.

---

## 3) End-to-End Flow (Target)

1. User uploads data file (`CSV`/`XLSX`) + one or more PDFs in a single bulk submission.
2. API creates `BulkIngestionJob` (`PENDING`) and `BulkIngestionItem` placeholders.
3. API stores intake artifacts in staging and emits `bulk.ingestion.requested` event.
4. Function: Parse/Adapter stage reads file, maps rows to canonical records, writes stage results.
5. Function: Document association stage links PDFs to items by deterministic matching strategy.
6. Function: Permanent storage stage copies documents to controlled location and stamps metadata/hash.
7. Function: Extraction stage queues docs to Axiom (`axiom.extract.requested`).
8. Function: Criteria stage optionally queues Axiom criteria runs (`axiom.criteria.requested`).
9. Function: Completion aggregator computes job summary (`COMPLETED`, `PARTIAL`, `FAILED`).
10. UI shows live progress, errors, and management actions (retry/cancel/export).

---

## 4) Canonical Data Model

## 4.1 Core Entities

### `BulkIngestionJob`

- `id`
- `tenantId`
- `clientId`
- `engagementId` (optional)
- `jobName`
- `status`: `PENDING | VALIDATING | MAPPING | DOC_ASSOCIATING | DOC_PERSISTING | EXTRACTING | CRITERIA_RUNNING | COMPLETED | PARTIAL | FAILED | CANCELLED`
- `submittedBy`
- `submittedAt`
- `completedAt`
- `totals`: `{ totalItems, successItems, failedItems, partialItems, retryItems }`
- `stageCounters`
- `artifacts`: `{ sourceDataFileUri, sourceManifestUri?, batchHash }`
- `adapterVersion`
- `lastError`
- `revision`

### `BulkIngestionItem`

- `id` (deterministic: `jobId:rowIndex` or `jobId:externalRecordId`)
- `jobId`
- `tenantId`
- `clientId`
- `rowIndex`
- `correlationKey` (e.g., `jobId::loanNumber`)
- `sourceRecord`
- `canonicalRecord`
- `association`: `{ matchedPdfIds[], matchingStrategy, confidence }`
- `stages`:
  - `parsed`
  - `mapped`
  - `validated`
  - `docAssociated`
  - `docPersisted`
  - `axiomExtractQueued`
  - `axiomExtractCompleted`
  - `criteriaQueued`
  - `criteriaCompleted`
- `status`: `PENDING | PROCESSING | COMPLETED | PARTIAL | FAILED | CANCELLED`
- `errors[]`: structured failure objects
- `retries[]`: stage + attempt metadata
- `auditRefIds[]`

### `BulkDocument`

- `id`
- `jobId`
- `tenantId`
- `fileNameOriginal`
- `mimeType`
- `sizeBytes`
- `hashSha256`
- `stagingUri`
- `permanentUriRaw`
- `permanentUriWorking`
- `linkedItemIds[]`
- `scanStatus` (if malware scanning enabled)
- `createdAt`

### `BulkAuditEvent` (append-only)

- `id`
- `tenantId`
- `jobId`
- `itemId` (optional)
- `stage`
- `eventType`
- `actorType`: `USER | SYSTEM | FUNCTION`
- `actorId`
- `timestamp`
- `payload`
- `checksum`

---

## 5) Client Adapter Strategy

## 5.1 Adapter Interface

Each adapter must implement:

- `canHandle(clientId, versionHint)`
- `parseHeaders(rawHeaders)`
- `mapRowToCanonical(rawRow, context)`
- `validateMappedRecord(canonicalRecord)`
- `getMappingDiagnostics(rawRow, canonicalRecord)`

## 5.2 Adapter Versioning

- Semantic version each adapter (`major.minor.patch`).
- Stamp adapter version on job and each item.
- Support backward-compatible parser enhancements.

## 5.3 Mapping Diagnostics (Required)

For each mapped field, record:

- source column name
- source raw value
- transform rule id
- output canonical field
- output value
- warning/error flags

---

## 6) Data + Document Association Rules

Association runs as deterministic ordered strategy:

1. Exact `loanNumber` match from filename stem.
2. Exact external ID match from metadata sidecar.
3. Strong normalized address+borrower composite match.
4. Manual-review bucket if confidence below threshold.

### Rules

- Never auto-associate one PDF to multiple items unless explicitly allowed by client profile.
- Track confidence score and association strategy used.
- Unmatched docs create actionable failure entries.

---

## 7) Queue & Azure Functions Design

## 7.1 Service Bus Topics/Queues

Use topic: `bulk-ingestion-events` with subscriptions by stage workers.

### Event Types

- `bulk.ingestion.requested`
- `bulk.mapping.completed`
- `bulk.doc.association.completed`
- `bulk.doc.persist.completed`
- `axiom.extract.requested`
- `axiom.extract.completed`
- `axiom.criteria.requested`
- `axiom.criteria.completed`
- `bulk.item.failed`
- `bulk.job.completed`

## 7.2 Function Apps

### Function App A — Intake Orchestration

- Trigger: `ServiceBusTrigger(bulk.ingestion.requested)`
- Responsibilities:
  - lock job state transition
  - dispatch map stage batches
  - enforce idempotency token

### Function App B — Mapping Worker

- Trigger: `ServiceBusTrigger(bulk.map.requested)`
- Responsibilities:
  - parse file chunk
  - apply client adapter
  - validate canonical records
  - emit per-item success/failure

### Function App C — Document Worker

- Trigger: `ServiceBusTrigger(bulk.doc.process.requested)`
- Responsibilities:
  - associate PDFs to items
  - copy/move PDFs to permanent storage
  - stamp blob metadata

### Function App D — Axiom Extraction Worker

- Trigger: `ServiceBusTrigger(axiom.extract.requested)`
- Responsibilities:
  - submit extraction job to Axiom
  - record correlation id/pipeline job id
  - emit completion/failure event

### Function App E — Criteria Worker

- Trigger: `ServiceBusTrigger(axiom.criteria.requested)`
- Responsibilities:
  - run criteria workflow when configured
  - stamp result summary

### Function App F — Aggregator & Finalizer

- Trigger: `ServiceBusTrigger(stage completion/failure events)`
- Responsibilities:
  - compute item/job aggregate state
  - close job in terminal state
  - emit notifications

## 7.3 Function Runtime Controls

- `maxConcurrentCalls` tuned per function stage.
- Session-enabled where ordering matters.
- Dead-letter configured with reason codes.
- Retry policy stage-specific.

---

## 8) Idempotency, Concurrency, and Consistency

## 8.1 Idempotency Keys

- Job idempotency: `tenantId + clientId + uploadHash + submittedAtWindow`.
- Item idempotency: `jobId + rowIndex + stage`.
- Axiom idempotency: `itemId + stage + documentHash`.

## 8.2 Optimistic Concurrency

- Use Cosmos etag/version checks on state transitions.
- Reject stale updates; retry with fresh read.

## 8.3 Exactly-Once Effect (Practically)

- At-least-once delivery + idempotent consumers.
- Dedup tables/records for processed message IDs.

---

## 9) Failure and Partial-Failure Framework

## 9.1 Failure Object Contract

Each failure includes:

- `code`
- `stage`
- `message`
- `details`
- `retryable`
- `recommendedAction`
- `occurredAt`

## 9.2 Partial Completion Policy

- Job status is `PARTIAL` when at least one item is successful and at least one item fails.
- Item-level retries allowed without reprocessing entire job.

## 9.3 Retry Policy

- Immediate retry for transient system errors (bounded).
- Backoff retry for external dependency failures.
- Manual retry required for mapping/validation errors.

---

## 10) Audit, Compliance, and Traceability

## 10.1 Required Audit Events

- Job created
- Intake artifacts stored
- Mapping started/completed
- Association started/completed
- Permanent copy completed
- Axiom submission/completion
- Criteria execution completion
- Retry/cancel/operator actions
- Job terminal state

## 10.2 Traceability IDs

- `jobId`
- `itemId`
- `correlationKey`
- `messageId`
- `axiomPipelineJobId`

## 10.3 Immutable Artifact Guarantees

- Raw source files are immutable.
- Any normalized/canonical transformations are versioned and reproducible.

---

## 11) API Contract Additions

## 11.1 Intake

- `POST /api/bulk-ingestion/submit`
  - multipart: data file + pdf files + metadata
  - response: `202 Accepted` + `jobId`

## 11.2 Monitoring

- `GET /api/bulk-ingestion/jobs`
- `GET /api/bulk-ingestion/jobs/:jobId`
- `GET /api/bulk-ingestion/jobs/:jobId/items`
- `GET /api/bulk-ingestion/jobs/:jobId/audit`
- `GET /api/bulk-ingestion/jobs/:jobId/failures/export`

## 11.3 Controls

- `POST /api/bulk-ingestion/jobs/:jobId/pause`
- `POST /api/bulk-ingestion/jobs/:jobId/resume`
- `POST /api/bulk-ingestion/jobs/:jobId/cancel`
- `POST /api/bulk-ingestion/jobs/:jobId/retry-failed`
- `POST /api/bulk-ingestion/jobs/:jobId/items/:itemId/retry`

---

## 12) UI/UX Requirements (Queue Console)

## 12.1 Primary Views

- Queue Overview Dashboard
- Job List Grid
- Job Detail Drawer/Page
- Item Error Triage Table
- Retry/Action Panel

## 12.2 Core UX Elements

- Stage progress bars per job and per item.
- Status chips with terminal and in-progress states.
- “Failures by stage” heatmap.
- Downloadable failure CSV/Excel.
- Side-by-side raw-to-canonical mapping inspector.

## 12.3 Real-Time Behavior

- Prefer Web PubSub updates.
- Poll fallback at bounded interval when channel unavailable.
- Optimistic action feedback for pause/resume/retry with server reconciliation.

---

## 13) Observability & SLOs

## 13.1 Metrics

- ingest throughput (jobs/items per minute)
- stage latency p50/p95/p99
- failure rate by stage/client
- retry rate by reason
- DLQ count and age
- document association confidence distribution

## 13.2 Logs

- structured logs with `jobId`, `itemId`, `stage`, `tenantId`, `clientId`
- no secrets in logs

## 13.3 Alerts

- DLQ growth > threshold
- stage error spike
- stale jobs beyond SLA
- Axiom callback timeout breach

---

## 14) Security & Data Governance

- Tenant isolation on every data/query path.
- Managed identity for Azure SDK clients.
- Encrypt data at rest and in transit.
- Signed/validated webhook processing for Axiom callbacks.
- Role-based access on operator controls.
- PII masking in UI where appropriate.

---

## 15) Infrastructure Requirements

## 15.1 Azure Resources (Expected Existing + Extensions)

- Service Bus namespace + topic/subscriptions for bulk ingestion stages
- Function Apps for stage workers
- Storage containers for staging/raw/working docs
- Cosmos containers for jobs/items/audit/doc metadata
- App Insights dashboards and alerts

## 15.2 IaC

- All new entities provisioned via Bicep.
- Explicit API versions and outputs.
- No imperative infrastructure creation in runtime code.

---

## 16) Testing Strategy

## 16.1 Unit Tests

- adapter mapping correctness
- validation rules
- state transition guards
- idempotency checks

## 16.2 Integration Tests

- queue publish/consume stage chain
- doc association + permanent copy
- Axiom submission + callback stamping
- retry and dead-letter behavior

## 16.3 End-to-End Tests

- mixed CSV/XLSX + PDFs submission
- full success flow
- partial failure flow with retries
- cancellation path
- UI monitoring accuracy

## 16.4 Performance Tests

- baseline: 500, 2k, 10k items with mixed docs
- saturation and recovery behavior

---

## 17) Runbooks

## 17.1 Stuck Job Runbook

1. Confirm job stage and last heartbeat.
2. Check Service Bus subscription lag and DLQ.
3. Verify Function health and recent exceptions.
4. Trigger scoped retry for affected stage.
5. Document RCA in audit timeline.

## 17.2 DLQ Drain Runbook

1. Group dead-letter reasons.
2. Separate retryable from non-retryable.
3. Patch config or code if systemic.
4. Replay eligible messages with trace labels.

## 17.3 Axiom Degradation Runbook

1. Pause criteria stage optionally.
2. Continue mapping/persistence stages.
3. Queue extraction backlog with throttling.
4. Resume and replay when dependency stabilizes.

---

## 18) Implementation Plan by Phase (Checklist)

> Status checkboxes are intentionally exhaustive; these are the implementation control surface.

## Phase 0 — Foundation & Contracts

- [ ] Finalize canonical schema document and field dictionary.
- [ ] Define adapter interface and versioning policy.
- [ ] Define event contracts and message envelopes.
- [ ] Define `BulkIngestionJob`, `BulkIngestionItem`, `BulkDocument`, `BulkAuditEvent` schemas.
- [ ] Define stage status enums and transition table.
- [ ] Define correlation-id standards (`jobId`, `itemId`, `correlationKey`).
- [ ] Define failure code taxonomy and retryability matrix.
- [ ] Publish API contract draft for intake/monitor/control endpoints.

### Phase 0 Exit Criteria

- [ ] Architecture review sign-off.
- [ ] API contract sign-off.
- [ ] Data model sign-off.

## Phase 1 — Ingestion API & Persistence Baseline

- [x] Implement multipart intake endpoint.
- [ ] Validate file types (`CSV`, `XLSX`, `PDF`).
- [x] Persist source artifacts to staging.
- [x] Create job + item placeholders in Cosmos.
- [x] Emit `bulk.ingestion.requested` event.
- [x] Return `202` with `jobId` and initial status.

### Phase 1 Exit Criteria

- [ ] New jobs visible via list/get endpoints.
- [ ] Source artifacts retrievable by URI.
- [ ] End-to-end kickoff event verified.

## Phase 2 — Adapter Mapping Pipeline

- [ ] Implement mapping worker Function App.
- [x] Implement client adapter registry.
- [x] Implement canonical validation.
- [x] Persist mapping diagnostics.
- [x] Emit completion/failure events per item.
- [ ] Aggregate mapping stage metrics.

### Phase 2 Exit Criteria

- [x] At least 2 client adapters passing test suite.
- [ ] Deterministic canonical outputs validated.
- [x] Mapping errors reported at item level.

## Phase 3 — Document Association & Permanent Storage

- [x] Implement deterministic association strategy chain.
- [x] Implement unmatched-doc handling and manual-review flags.
- [x] Implement permanent copy/move into controlled storage.
- [ ] Store hash/metadata for every document.
- [ ] Link documents to one-or-more items per policy.
- [x] Emit stage completion/failure events.

### Phase 3 Exit Criteria

- [ ] Zero orphan documents in test corpus.
- [ ] Association confidence and strategy stamped.
- [ ] Permanent URIs and hashes persisted.

## Phase 4 — Axiom Extraction & Criteria Orchestration

- [ ] Implement extraction queue worker.
- [ ] Implement Axiom request idempotency.
- [ ] Capture Axiom correlation IDs and statuses.
- [ ] Process extraction completions/webhooks.
- [ ] Queue criteria runs when configured.
- [ ] Persist extraction + criteria outputs to canonical records.

### Phase 4 Exit Criteria

- [ ] Extraction pipeline validated on mixed sample set.
- [ ] Criteria optional path validated.
- [ ] Timeout/failure behavior validated.

## Phase 5 — Aggregation, Retries, and Operator Controls

- [ ] Implement finalizer worker for job terminal states.
- [x] Implement retry endpoints (job-level and item-level).
- [x] Implement pause/resume/cancel endpoints.
- [x] Enforce stage-level retry policy and max attempts.
- [x] Generate failure export (CSV/XLSX).
- [x] Record all operator actions in immutable audit stream.

### Phase 5 Exit Criteria

- [x] Partial failures are recoverable via targeted retries.
- [ ] Control actions safe under concurrent operations.
- [x] Audit trail complete for all control actions.

## Phase 6 — Monitoring UI/UX

- [ ] Build queue overview dashboard.
- [ ] Build jobs grid with stage progress.
- [ ] Build job detail with item timeline.
- [ ] Build error triage table with retry actions.
- [ ] Build mapping inspector (raw vs canonical).
- [ ] Add real-time updates with fallback polling.

### Phase 6 Exit Criteria

- [ ] Operators can identify, triage, and retry failures without backend access.
- [ ] UI reflects backend state transitions within acceptable latency.

## Phase 7 — SRE, Hardening, and Launch

- [ ] Create App Insights dashboards.
- [x] Configure alerts for DLQ, SLA breaches, error spikes.
- [ ] Run load/perf tests and tune concurrency.
- [ ] Complete security review (tenancy, RBAC, webhook validation).
- [x] Complete production runbooks and incident drills.
- [ ] Execute staged rollout with feature flags.

### Phase 7 Exit Criteria

- [ ] Meets SLO targets in pre-prod.
- [ ] No P0/P1 defects open.
- [ ] Go-live readiness sign-off completed.

---

## 19) Acceptance Criteria (Program-Level)

- [ ] System accepts mixed data+PDF submissions in single transaction.
- [ ] 100% of accepted records map to canonical or explicit item failure.
- [ ] 100% of accepted PDFs are associated or explicitly unmatched.
- [ ] All original documents persisted to controlled permanent storage.
- [ ] Full audit trail present for all processing stages and operator actions.
- [ ] Partial-failure jobs recoverable with targeted retry.
- [ ] Queue monitoring UI supports full operational lifecycle.

---

## 20) Open Decisions (Must Resolve Before Phase 2 Complete)

- [ ] Canonical schema ownership and governance body.
- [ ] Exact association confidence thresholds per client.
- [ ] Criteria run policy default (always vs client-configurable).
- [ ] Retention policy for raw and normalized artifacts.
- [ ] Maximum accepted file sizes and per-job limits.

---

## 21) RACI (Implementation Governance)

- Product Owner: scope, acceptance, rollout gates.
- Platform Architect: architecture integrity, canonical model governance.
- Backend Team: APIs, workers, queue orchestration, audit.
- Frontend Team: monitoring/triage/controls UX.
- DevOps/SRE: IaC, monitoring, alerting, runbooks, operational readiness.
- QA: test matrix execution and sign-off.

---

## 22) Immediate Next Actions (Start This Week)

- [ ] Create architecture review meeting and approve this plan baseline.
- [ ] Create implementation epic and phase-based stories from section 18.
- [ ] Freeze canonical schema v1 draft.
- [x] Scaffold new `bulk-ingestion` API contracts.
- [ ] Provision Service Bus stage topics/subscriptions via Bicep.
- [x] Scaffold first Function App worker (`bulk.ingestion.requested`).

### Updated Remaining Work (Post-implementation snapshot)

- [x] Add strict server-side data-file type validation (`CSV`/`XLSX`) and document MIME/extension guards.
- [x] Add DLQ discovery enhancements beyond replay/list (sorting presets, age buckets, and pagination strategy).
- [x] Add export endpoint for failure triage (`CSV`/`XLSX`) and operator-ready downloads.
- [x] Add JSON failure triage endpoint with filter/sort and cursor-based pagination (`nextCursor`/`prevCursor`).
- [x] Add App Insights dashboard specification with KQL pack and runbook linkage for DLQ + ingestion-stage SLO views.
- [x] Draft bulk-ingestion performance benchmark scenario matrix and execution baseline (`current-plan/BULK_INGESTION_PERFORMANCE_TEST_MATRIX_2026-03-31.md`).
- [x] Extend perf harness coverage to include BI-PERF-03 (upper-bound) and BI-PERF-04 (concurrency ramp) with per-ramp metrics capture.
- [x] Add extraction worker stage from canonicalized records to Axiom submission queueing with deterministic bulk correlation IDs.
- [x] Add webhook completion processing for bulk-ingestion DOCUMENT callbacks with durable item stamp + extraction completion event publication.
- [x] Add criteria worker path (`bulk.ingestion.extraction.completed` → `bulk.ingestion.criteria.completed`) and terminal-state finalizer worker.
- [ ] Add load/performance benchmark runs and concurrency tuning report.
- [ ] Complete security review checklist and rollout gate sign-offs.

---

## 23) Change Control

Any material change to the following requires architecture sign-off and plan revision:

- canonical schema
- event contracts
- failure/retry policy
- audit guarantees
- tenancy boundaries

Maintain a revision log in this document.

### Revision Log

- **2026-03-31 (v1.0):** Initial cornerstone implementation plan created.
- **2026-03-31 (v1.1):** Updated implementation status to reflect delivered backend slices (operator controls, deterministic association/manual review, Axiom DLQ metrics/replay/list ops, alert hooks, and runbook), and refreshed remaining work list.
- **2026-03-31 (v1.2):** Added strict multipart file-type guards and enhanced Axiom DLQ discovery with date ranges, sort presets, age buckets, and pagination metadata.
- **2026-03-31 (v1.3):** Completed failure triage exports (CSV/XLSX) and added operator JSON failure listing with filter/sort plus cursor navigation (`nextCursor`/`prevCursor`).
- **2026-03-31 (v1.4):** Added App Insights workbook specification + KQL pack for ingestion/DLQ SLO visibility, linked operational runbooks, and added focused UI ops page route (`admin/bulk-ingestion-ops`).
- **2026-03-31 (v1.5):** Completed Phase 7 step-1 performance planning by inventorying existing perf assets and publishing exact benchmark matrix + thresholds for bulk-ingestion hardening.
- **2026-04-01 (v1.6):** Implemented `perf:bulk:*` harness + fixture generation and executed BI-PERF-01/02; runs produced artifacts but failed due environment blocker (Cosmos DB firewall rejecting bulk-ingestion job persistence).
- **2026-04-01 (v1.7):** Expanded perf harness to cover BI-PERF-03/04 (including concurrency ramps and 5xx-rate metrics), documented post-unblock checkpoint, and staged execution commands pending Cosmos firewall rule propagation.
- **2026-04-01 (v1.8):** Implemented core post-canonical orchestration slice: new extraction worker (`bulk.ingestion.canonicalized` subscriber), criteria worker path, finalizer terminal-state worker, and bulk-ingestion DOCUMENT webhook correlation/idempotent completion handling; validated with `pnpm -s tsc --noEmit` and targeted unit suites.
