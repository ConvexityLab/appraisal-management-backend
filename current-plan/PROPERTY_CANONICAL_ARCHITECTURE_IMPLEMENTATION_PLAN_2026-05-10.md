# Property Canonical Architecture — Approved Target-State Implementation Plan

**Created:** 2026-05-10  
**Status:** 🟡 IN PROGRESS — Approved architecture, active implementation  
**Decision:** This document is the authoritative plan for property-domain re-architecture.  
**Supersedes in direction:** [PROPERTY_DATA_REFACTOR_PLAN.md](../PROPERTY_DATA_REFACTOR_PLAN.md) and legacy summary docs that treat `PropertyRecord` as the primary physical holder of all property facts.

---

## 1. Executive Decision

We are standardizing on the following architecture:

- `PropertyRecord` is the **parcel identity anchor + current materialized property read model**.
- Raw and normalized inbound facts are stored as **immutable property observations**.
- Per-order reproducibility lives in **canonical snapshots**, not in `PropertyRecord`.
- Workflow aggregates (`engagements`, `client-orders`, `orders`) may cache property fields temporarily, but **they are never the source of truth**.
- Provider caches are operational accelerators only and are **not domain truth**.

This is the correct architecture and is approved for implementation.

---

## 2. Design Goals

1. Make every enriched property automatically eligible for the unified property view.
2. Separate **identity**, **observations**, **read models**, and **workflow state**.
3. Preserve full provenance and replayability of source facts.
4. Eliminate silent truth drift caused by duplicated property blobs.
5. Make projectors deterministic, idempotent, and backfillable.
6. Keep the system easy to query operationally: one parcel id, many observations, one current view.

---

## 3. Target Containers

### 3.1 `property-records`
**Role:** parcel identity anchor + current materialized property view  
**Partition key:** `/tenantId`

Stores:
- stable parcel identity and aliases
- canonical address / match keys
- `currentCanonical`
- lightweight property summary fields for list/detail pages
- projection lineage metadata (`projectedAt`, `projectionVersion`, `latestSnapshotId`, `latestObservationAt`)

Does **not** store:
- raw provider payloads
- append-only provider history as truth
- frozen order-level snapshots

### 3.2 `property-observations`
**Role:** immutable event / fact log for all property knowledge  
**Partition key:** `/tenantId`

Stores one row per observation:
- provider enrichment
- bulk import/public-record import
- document extraction
- manual correction
- permit update
- tax assessment update
- AVM update
- projector-emitted canonical patch when needed

Each record must include:
- `propertyId`
- `observationType`
- `observedAt`
- `ingestedAt`
- `sourceSystem`
- `sourceArtifactRef`
- `sourceFingerprint`
- `rawPayload`
- `normalizedFacts`

### 3.3 `canonical-snapshots`
**Role:** frozen per-order reproducibility record  
**Partition key:** `/tenantId`

Stores:
- exact order-scoped canonical data used for a run
- source refs used to build the snapshot
- source schema version / projector version
- order / engagement / property linkage

### 3.4 `documents`
**Role:** source artifact system of record for uploaded and extracted docs

Documents remain the source of truth for uploaded artifact metadata and extracted payloads, but extracted property facts only influence the property domain after they are emitted as `property-observations`.

### 3.5 `engagements`
**Role:** workflow aggregate for lender engagement state

Rule: embedded property data is cache-only / request-capture only.

### 3.6 `client-orders`
**Role:** workflow aggregate for lender-side order state

Rule: copied property fields are not canonical truth.

### 3.7 `orders`
**Role:** workflow aggregate for vendor-side execution state

Rule: `propertyId` is authoritative; copied property details are non-authoritative.

### 3.8 `property-data-cache` and `attom-data`
**Role:** acquisition cache / import staging

These remain useful, but they are explicitly **not domain truth**.

---

## 4. Source-of-Truth Matrix

| Concern | Authoritative store | Notes |
|---|---|---|
| Parcel identity | `property-records` | stable `propertyId`, canonical address, aliases |
| Raw source observations | `property-observations` | immutable, append-only |
| Current cross-order property view | `property-records.currentCanonical` | projector-owned |
| Frozen order reproducibility | `canonical-snapshots` | never mutate historical snapshots |
| Workflow state | `engagements`, `client-orders`, `orders` | never canonical property truth |
| Uploaded / extracted source artifacts | `documents` | artifact truth, not parcel truth |
| API/provider cache | `property-data-cache`, `attom-data` | rebuildable operational cache |

---

## 5. Approved Data Model Rules

### 5.1 `PropertyRecord`
`PropertyRecord` becomes a **thinner** object with four responsibilities only:

1. property identity
2. current materialized parcel view
3. projection lineage metadata
4. merge / dedupe governance

### 5.2 Observations are immutable
- No in-place mutation of raw facts.
- Corrections create new observations.
- Replay and projection are always possible from the observation log.

### 5.3 Canonical snapshots are frozen
- No in-place rebuilding of a historical order snapshot.
- A refresh creates a new snapshot or updates only an explicit refresh record strategy.

### 5.4 Workflow containers are never canonical property truth
- Embedded property blobs may remain temporarily for DX and backwards compatibility.
- The join key is `propertyId`.

### 5.5 Caches are disposable
- If a cache is lost, the system remains semantically correct.
- If a cache value differs from the canonical read model, the canonical read model wins.

### 5.6 Provenance is mandatory
Every property-domain write must preserve provenance sufficient to answer:

- what changed
- when it changed
- who or what asserted it
- which artifact or upstream record caused it
- which projector/snapshot/write path materialized it

Minimum provenance for every immutable observation:
- `propertyId`
- `observationType`
- `sourceSystem`
- `sourceProvider` when applicable
- `observedAt`
- `ingestedAt`
- `sourceRecordId` when present
- primary `sourceArtifactRef`
- lineage refs for upstream contributors when multiple sources were merged
- `createdBy`

Minimum provenance for every materialized projection:
- `snapshotId` / projector version
- source observation refs or source snapshot refs
- previous value and new value when practical

---

## 5A. Eventing Decision

We should distinguish **durable data truth** from **integration notifications**.

### Decision
- The source of truth is the persisted write in `property-observations`, `property-records`, and `canonical-snapshots`.
- Events are optional integration notifications, **not** provenance and **not** truth.
- If/when emitted, they must be published only **after** the durable write succeeds.
- If/when emitted, they should use an **outbox pattern** rather than direct fire-and-forget publish.

### Current plan
- Do **not** block the architecture on event bus work.
- Do **add** eventing to the plan as a follow-on capability for cross-service reactions.

### Approved future event types
- `property.observation.recorded`
- `property.currentCanonical.updated`
- `property.snapshot.created`
- `property.snapshot.refreshed`

### Rules for future eventing
1. events must be derived from already-committed writes
2. events must carry ids and provenance refs, not large raw payloads
3. consumers must treat events as notifications and re-read source of truth when needed
4. event failure must not invalidate the durable write

---

---

## 6. Projector Architecture

### 6.1 Ingestion flow
For every inbound property fact source:

1. resolve `propertyId`
2. persist immutable observation
3. project property-scoped facts onto `property-records.currentCanonical`
4. update projection lineage metadata
5. optionally build / refresh a frozen `canonical-snapshots` record for order-scoped use cases

### 6.2 Projector input sources
- provider enrichments
- document extractions
- ATTOM / public-record imports
- manual corrections
- permit and tax updates
- AVM updates

### 6.3 Merge precedence
Default precedence order:

1. manual correction
2. curated / structured document extraction
3. county / public-record import
4. provider enrichment
5. cache replay / legacy imported rows

### 6.4 Field merge policy
- **latest-wins:** normalized address verification, latest AVM summary, last snapshot metadata
- **append / union:** transfers, tax assessments, permits
- **recomputed:** risk flags, cross-order canonical summary
- **confidence/date arbitration:** building facts when conflicting sources arrive

---

## 7. `PropertyRecord` Target Shape

### Keep
- `id`
- `tenantId`
- canonical identity keys
- canonical address / match aliases
- `currentCanonical`
- `currentSummary`
- projection lineage metadata
- merge governance metadata

### Move out of root truth storage
- raw provider payloads
- tax history arrays as root truth
- permit history arrays as root truth
- top-level AVM history as root truth
- duplicated building facts that merely mirror `currentCanonical.subject`
- root-level version history intended to explain every inbound source mutation

### New mental model
`PropertyRecord` is **identity + current materialization**, not the archive of every fact we ever ingested.

---

## 8. Implementation Phases

## Phase P0 — Plan Authoring & Approval
- [x] Document approved target-state architecture
- [x] Define exact containers and truth rules
- [x] Define phased implementation approach

## Phase P1 — Observation Foundation
- [x] Add `property-observations` as an approved container in architecture plan
- [x] Add `PropertyObservation` type contracts
- [x] Add `PropertyObservationService`
- [x] Add infrastructure module for `property-observations`
- [x] Export service foundation for downstream wiring
- [ ] Add explicit observation document schema docs/examples

## Phase P2 — Dual-Write Ingestion
- [x] Refactor property enrichment to write immutable observations on provider enrichment / AVM success
- [x] Refactor document extraction completion to emit observations during snapshot materialization
- [x] Refactor ATTOM/public-record materialization path to emit tenant-scoped observations
- [x] Refactor manual correction API path to emit observations

**ATTOM/public-record import note:** raw ATTOM CSV/cache ingestion is currently a global staging/cache path and does not yet have the tenant-scoped `propertyId` required for authoritative parcel observations. Durable `public-record-import` observations are now emitted from the tenant-scoped enrichment/materialization path, while raw cache loading remains explicitly non-authoritative until a dedicated tenant-aware import boundary exists.

## Phase P3 — Property Projector
- [x] Implement initial deterministic projector service for snapshot → `currentCanonical`
- [ ] Build field-level merge policies
- [ ] Make projector idempotent and replayable
- [x] Persist projection lineage metadata on `PropertyRecord` (existing `currentCanonical` snapshot lineage retained)
- [x] Add projection provenance refs for snapshot-driven `currentCanonical` updates via immutable observations

## Phase P4 — Snapshot Separation
- [ ] Introduce dedicated `canonical-snapshots` container
- [ ] Move snapshot reads/writes off generic `aiInsights`
- [ ] Attach projector version and source refs explicitly

## Phase P5 — Read Path Cutover
- [ ] Update property list/detail APIs to read from projected `PropertyRecord`
- [ ] Remove mixed-source property view assembly
- [ ] Expose provenance/observation refs via the property API

## Phase P6 — Thin `PropertyRecord`
- [ ] Stop writing deprecated root-level fact branches
- [ ] Move remaining fact history to observations
- [ ] Remove duplicated property truth from workflow aggregates where feasible

## Phase P7 — Legacy Retirement
- [ ] Retire legacy `/api/properties` stack
- [ ] Remove deprecated embedded property truth dependencies
- [ ] Finalize documentation and operational runbooks

## Phase P8 — Integration Event Outbox
- [ ] Add durable outbox for property-domain integration events
- [ ] Emit `property.observation.recorded` after committed observation writes
- [ ] Emit `property.currentCanonical.updated` after projector writes
- [ ] Emit `property.snapshot.created` / `property.snapshot.refreshed` after snapshot writes
- [ ] Keep event emission non-blocking and non-authoritative

---

## 9. Initial File-Level Worklist

### Foundation
- [x] `src/types/property-observation.types.ts`
- [x] `src/services/property-observation.service.ts`
- [x] `tests/property-observation.service.test.ts`
- [x] `infrastructure/modules/cosmos-property-observations-container.bicep`
- [x] `infrastructure/main.bicep`
- [x] `src/services/index.ts`

### Next implementation slice
- [x] `src/services/property-enrichment.service.ts`
- [x] `tests/property-enrichment.service.test.ts`
- [x] `src/services/canonical-snapshot.service.ts`
- [x] `tests/unit/canonical-snapshot.service.test.ts`

### Upcoming implementation slice
- [x] public-record / ATTOM import observations
- [x] manual-correction observations
- [x] dedicated property projector service (separate from snapshot service)
- [ ] event outbox design and first non-blocking publisher path

---

## 10. Non-Negotiable Rules

1. No code path may create infrastructure implicitly.
2. No silent fallbacks for missing required config.
3. All parcel-domain truth must be attributable to a source observation.
4. `propertyId` is the canonical join key for parcel semantics.
5. Workflow convenience fields are never the source of truth.
6. Projectors must be rerunnable from source observations.

---

## 11. Success Criteria

This program is complete when:

- every enriched property fact source emits immutable observations
- `PropertyRecord` acts as identity + current materialized view only
- property UI reads from one canonical parcel read model
- order reproducibility is handled by explicit snapshots
- duplicated workflow property truth is eliminated or clearly marked cache-only

---

## 12. Current Status Note

As of 2026-05-10, the architecture is approved and implementation is active across the observation foundation, tenant-scoped public-record/materialization observations, manual-correction observations, and the initial dedicated property projector slice.
