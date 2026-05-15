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
- Keep eventing strictly behind the durable-write boundary so this work does **not** distract from the primary federation goal of authoritative parcel facts + deterministic projectors.

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
- [x] Add explicit observation document schema docs/examples

## Phase P2 — Dual-Write Ingestion
- [x] Refactor property enrichment to write immutable observations on provider enrichment / AVM success
- [x] Refactor document extraction completion to emit observations during snapshot materialization
- [x] Refactor ATTOM/public-record materialization path to emit tenant-scoped observations
- [x] Refactor manual correction API path to emit observations

**ATTOM/public-record import note:** raw ATTOM CSV/cache ingestion is currently a global staging/cache path and does not yet have the tenant-scoped `propertyId` required for authoritative parcel observations. Durable `public-record-import` observations are now emitted from the tenant-scoped enrichment/materialization path, while raw cache loading remains explicitly non-authoritative until a dedicated tenant-aware import boundary exists.

## Phase P3 — Property Projector
- [x] Implement initial deterministic projector service for snapshot → `currentCanonical`
- [x] Build field-level merge policies
- [x] Make projector idempotent and replayable
- [x] Persist projection lineage metadata on `PropertyRecord` (existing `currentCanonical` snapshot lineage retained)
- [x] Add projection provenance refs for snapshot-driven `currentCanonical` updates via immutable observations

**Current Phase P3 note:** field-level merge policy is now implemented in `mergePropertyCanonical(...)` with stale-snapshot protection, recursive subject merging, and transfer-history union semantics. Duplicate snapshot reprocessing is explicitly covered by focused projector tests, and `PropertyProjectorService` can now rebuild `currentCanonical` by replaying immutable `canonical-projection` observations in deterministic observation-log order. `PropertyRecord` now also carries top-level projection lineage (`projectedAt`, `projectionVersion`, `latestSnapshotId`, `latestObservationAt`) so replay/backfill status is available without drilling into `currentCanonical`.

## Phase P4 — Snapshot Separation
- [x] Introduce dedicated `canonical-snapshots` container
- [x] Move snapshot reads/writes off generic `aiInsights`
- [x] Attach projector version and source refs explicitly

**Current Phase P4 note:** canonical snapshot records now carry explicit projector/version provenance (`projectorVersion`, `sourceSchemaVersion`, `sourceRunId`, top-level property/order/document linkage), and snapshot-driven `canonical-projection` observations now emit explicit projector metadata alongside snapshot/run lineage.

## Phase P5 — Read Path Cutover
- [x] Update property list/detail APIs to read from projected `PropertyRecord`
- [x] Remove mixed-source property view assembly
- [x] Expose provenance/observation refs via the property API

**Current Phase P5 note:** canonical `PropertyRecord` now backs the primary `/api/v1/property-records` endpoints plus the legacy `/api/properties/summary` and `/api/properties/detailed` read paths. Remaining mixed-source work is now concentrated in older unmounted/unused legacy property services rather than the active property API surface.

## Phase P6 — Thin `PropertyRecord`
- [x] Stop writing deprecated root-level fact branches
- [x] Move remaining fact history to observations
- [x] Remove duplicated property truth from workflow aggregates where feasible

**Current Phase P6 note:** audit work confirmed the `EnhancedPropertyController` / `EnhancedPropertyService` / `EnhancedPropertyCosmosService` stack had no runtime callers and remained only as stale mixed-source code. That unmounted stack is now retired. The remaining legacy property surface is `PropertyController`, which is retained only for skipped CRUD integration coverage and is not mounted by the production API server.

**Phase P6 root-branch audit note (2026-05-10):** active enrichment write paths no longer push to deprecated root-level fact branches. `PropertyEnrichmentService.buildTopLevelChanges(...)` does not include `taxAssessments`, `permits`, or `avm`; AVM is recorded exclusively as an immutable `avm-update` observation. Manual patch and enrichment tax-assessment + permit writes were moved to `tax-assessment-update` / `permit-update` observations in earlier slices. The remaining root writes are: (1) `PropertyRecord.taxAssessments: []` initialization in `createRecord(...)` — correct and necessary as the type field must exist (the materializer overlays observation-derived values for reads); (2) the ATTOM comp-collection mapper (`attom-to-property-record.mapper.ts`) which synthesizes non-authoritative `PropertyRecord` objects for the comparables surface — this is explicitly deferred because ATTOM records lack tenant-scoped `propertyId` and the plan note calls them out as non-authoritative global staging cache. Both remaining root writes are intentional and deferred, not forgotten.

**Workflow de-duplication update:** the first workflow aggregate thinning slice is now in place for `client-orders`: `propertyDetails` is optional cache-only state, `EngagementService` stops copying full property-details blobs into standalone ClientOrder docs when a canonical `propertyId` already exists, and snapshot/order canonical projection now falls back to `PropertyRecord` when that cache is absent. A follow-on engagement slice now also stores a thinner address/request cache on `EngagementProperty.property`, dropping copied physical facts that belong on canonical property materializations instead of the workflow aggregate. The next thinning slice now extends that rule through order placement and vendor fan-out: `ClientOrderService` drops duplicated `propertyDetails` when a canonical `propertyId` is already known, `addVendorOrders(...)` no longer rehydrates that cache onto child vendor orders, and `VendorOrderService` defensively strips copied property-details blobs whenever the canonical join key is present.

**Canonical-first reader update:** the active order/report/Axiom readers that still flow through `OrderContextLoader` now request `includeProperty: true` on their joined loads, and `getPropertyAddress(...)` / `getPropertyDetails(...)` now synthesize canonical-first values from `PropertyRecord` before falling back to workflow cache copies. This keeps the remaining workflow blobs as compatibility cache only instead of the default read authority. A follow-on audit expanded that rollout to downstream property-reading consumers in ROV creation, QC queue seeding, order-created event emission, audit enrichment, AI-triggered auto-assignment, and bid/QC orchestration paths. The remaining non-`includeProperty` loader call currently identified is the UC DP/EAD auto-submit flow, which only reads loan/order fields and does not consume property blobs.

**Projector hardening update:** the previously outstanding projector exact-optional/type-cast compiler errors in `property-canonical-projection.ts` and `property-projector.service.ts` are now resolved. The property projector path type-checks cleanly again, and outbox payload typing explicitly carries projector/schema metadata used by canonical snapshot replay notifications.

**Replay/backfill update:** the canonical property router now exposes explicit replay endpoints for both single-property and multi-property backfill (`POST /api/v1/property-records/:propertyId/replay-current-canonical` and `POST /api/v1/property-records/replay-current-canonical`). Bulk replay requires explicit `propertyIds` or `all=true`, then rebuilds `currentCanonical` from immutable `canonical-projection` observations without treating workflow aggregates as truth.

**Observation-first tax history update:** the next thinning slice now stops appending `PropertyRecord.taxAssessments` during provider enrichment. Tax assessment history remains durable in immutable observations (`provider-enrichment` / `public-record-import` normalized facts), and the canonical property detail responses now rebuild assessment/tax views from those observations with legacy root-array fallback for older records. This narrows one of the remaining root-history branches without breaking existing property-detail consumers.

**Manual history/permit thinning update:** the active manual patch route now strips `taxAssessments` / `permits` out of `PropertyRecord` version writes and persists them as dedicated immutable `tax-assessment-update` / `permit-update` observations instead. Canonical property reads now rebuild permit history from observations with the same legacy root-array fallback used for older tax/permit records, so Phase P6 continues shrinking root-level fact storage without breaking existing detail consumers.

**Observation-first AVM update:** subject-property AVM writes are now also moving off root `PropertyRecord` truth for the active property API/enrichment paths. Enrichment records immutable `avm-update` observations instead of patching `PropertyRecord.avm`, the manual property PATCH route does the same for explicit AVM edits, and canonical property summary/detail/list reads now rebuild AVM/valuation views from observations with legacy root-field fallback for older records.

**Non-controller AVM audit update:** the remaining non-controller `PropertyRecord.avm` consumers were reviewed. `CompBasedValueEstimator`, `TieredAiCompSelectionStrategy`, and `OrderCompCollectionService` intentionally remain workflow/runtime AVM consumers: they operate on the in-memory comp batch assembled for the current selection/valuation run, not on canonical parcel truth reads. `OrderContextLoader` also remains observation-agnostic by design; it loads the stored `PropertyRecord` row for canonical identity/address/building joins, while observation-first AVM materialization stays on the canonical property API/read-model surface.

**Canonical loader materialization update:** the active `OrderContextLoader` property join now overlays immutable observation history onto the loaded `PropertyRecord` before returning it to downstream readers. This means `includeProperty: true` callers now see observation-derived AVM/tax/permit state on the joined canonical property row, while comp-selection/value-estimation flows that build their own runtime comp projections remain intentionally separate.

**Shared materialization update:** the canonical property controller and `OrderContextLoader` now use the same property-history materializer instead of maintaining duplicate AVM/tax/permit replay logic. This keeps canonical summary/detail/list responses and canonical loader joins aligned on one observation-replay path.

**Order property-record read update:** `GET /api/v1/orders/:orderId/property-record` now resolves its canonical property through `OrderContextLoader` instead of returning the raw `property-records` row directly. Order-scoped property-record reads therefore now inherit the same observation-derived AVM/tax/permit materialization as the canonical property API and loader joins.

**Order comparables subject update:** the vendor-order comparables subject join now also runs through the shared observation-replay materializer before building its compact `subject` payload. That keeps subject valuation on the comparables surface aligned with observation-derived AVM truth instead of the raw stored `PropertyRecord` row.

**Service-side subject reader update:** the subject-property loads inside `ComparableSelectionService` and `OrderCompCollectionService` now also fetch immutable property observations before materializing the subject record they consume. Their current outputs still mainly depend on address/building/geo fields, but they now read through the same canonical observation-backed property path instead of bypassing it with raw `PropertyRecord` reads.

**Bulk portfolio extraction update:** the bulk-portfolio extraction patch path now also materializes the current canonical property state from immutable observations before merging extracted address/building changes into `PropertyRecord.createVersion(...)`. This keeps extraction-driven property updates from merging against a stale raw row while Phase 6 continues thinning root-truth branches.

**Enrichment staging read update:** `PropertyEnrichmentService` now also overlays immutable property observations onto the resolved `PropertyRecord` before making cache/geocode/write decisions. That means the remaining non-controller enrichment staging read no longer bypasses the same observation-materialized canonical property path used by the active property API, loader, comparables, and service-side subject readers.

## Phase P7 — Legacy Retirement
- [x] Retire legacy `/api/properties` stack
- [x] Remove deprecated embedded property truth dependencies
- [~] Finalize documentation and operational runbooks

**Current Phase P7 note:** the legacy `PropertyController` / `PropertyManagementService` CRUD stack has now been retired. The production `/api/properties` surface is the canonical `createPropertyRecordRouter(...)` mount, and the skipped legacy integration tests that targeted the old CRUD controller were removed with the dead code.

**Property DTO audit note:** the former `src/types/property-enhanced.ts` compatibility layer has now been fully retired. Earlier slices removed the controller/service consumers, then isolated the last `CosmosDbService` summary DTO dependency into `src/types/property-summary-compat.types.ts`. A final audit confirmed the remaining non-summary types in `property-enhanced.ts` had no live consumers, so the legacy file could be safely deleted.

**Cosmos summary-method audit update:** a follow-up usage audit found no live callers for the legacy `CosmosDbService` property-summary compatibility methods (`createPropertySummary`, `findPropertySummaryById`, `searchPropertySummaries`) or their `property-summaries` container wiring. Those methods and the temporary `property-summary-compat.types.ts` DTO file are now retired, leaving the canonical property surface centered on `PropertyRecord` APIs and services.

**Canonical route retirement update:** the active UI property event-stream client now reads from `/api/v1/property-records/:propertyId/events` instead of the older `/api/properties/:propertyId/events` alias. The alias can remain temporarily for compatibility, but the first-party frontend no longer depends on the legacy route shape.

**WIP board retirement update:** the WIP board service no longer reads `propertyAddress` out of VendorOrder rows for its primary board/column queries. It now selects canonical join keys (`propertyId`, `clientOrderId`) and resolves display/search addresses from `PropertyRecord` first, then `ClientOrder` cache only when canonical property materialization is unavailable.

**Notification-reader update:** vendor-assignment notifications no longer format the property line directly from `order.propertyAddress`. `NotificationService` now resolves the address through `OrderContextLoader` + `getPropertyAddress(...)`, keeping first-party notification copy aligned with the same canonical property accessors used by other active order readers.

**Order-notification reader update:** `OrderNotificationService` no longer formats lifecycle notification property text directly from the embedded VendorOrder address copy. Assignment/cancellation/delivery notifications now resolve the property line through `OrderContextLoader` + `getPropertyAddress(...)`, with the deprecated embedded address retained only as an explicit fallback when the canonical join cannot be loaded.

**Auto-assignment reader update:** the active auto-assignment bid/QC invitation paths no longer read `order.propertyAddress` or `order.propertyDetails.fullAddress` as their primary property text source. `AutoAssignmentOrchestratorService` now centralizes those invitation/queue strings behind a canonical-first helper that formats `getPropertyAddress(...)` from `OrderContextLoader` before falling back to the legacy embedded copies only when the joined load is unavailable.

**Vendor-management reader update:** `VendorManagementService.findAvailableVendors(...)` no longer uses the embedded VendorOrder state copy as its primary vendor-service-area filter. It now resolves the subject state through `OrderContextLoader` + `getPropertyAddress(...)` first, with the legacy embedded `order.propertyAddress.state` branch retained only as an explicit compatibility fallback.

**Vendor integration reader update:** `VendorIntegrationEventConsumerService` no longer formats `order.created` and inspection-artifact property text straight from the embedded VendorOrder address copy. Those active vendor-event paths now resolve the property line through `OrderContextLoader` + `getPropertyAddress(...)` first, falling back to the legacy embedded formatter only when canonical order-context loading fails.

**Order-management reader update:** `OrderManagementService.createOrder(...)` no longer publishes `order.created` with property text built straight from the embedded order copy when a canonical `propertyId` is already present. The Service Bus payload now resolves property address text from the canonical property repository first and falls back to the embedded order address only for legacy create flows that do not yet have canonical property identity.

**Order-management validation update:** `OrderManagementService.validateOrderData(...)` no longer hard-requires an embedded `propertyAddress.streetAddress` when the create flow already carries canonical `propertyId`. Service-layer validation now accepts canonical `propertyId`-only order creation, while still failing fast if neither property identity nor an embedded compatibility address is supplied, and it verifies that any provided canonical property actually exists before persisting the order.

**Create-order middleware update:** `validateCreateOrder()` now mirrors the service-layer canonical property contract instead of rejecting `propertyId`-only requests at the HTTP boundary. The middleware accepts either canonical `propertyId` or the legacy embedded `propertyAddress`, still validates embedded address fields whenever that compatibility payload is supplied, and fails fast with a clear validation error when neither property identity path is present.

**First-party create-order caller update:** the first-party intake and AI order-creation paths now submit canonical `propertyId` / `clientOrderId` linkage instead of always sending an embedded `propertyAddress` blob. The intake wizard payload builder now emits canonical property/client-order ids after engagement placement, `AiActionDispatcherService` forwards canonical `propertyId` to `ClientOrderService.addVendorOrders(...)` without rehydrating an embedded address when canonical identity is already present, and representative integration tests now exercise `POST /api/orders` through that canonical-first request shape.

**AI contract cutover update:** the backend and frontend `CREATE_ORDER` AI schemas are now canonical-property-first at the request-contract layer, not just internally after dispatch. Both validator stacks now require canonical `propertyId` alongside `engagementId` / `clientOrderId`, treat embedded `propertyAddress` as optional compatibility data instead of a required field, and explicitly reject mismatched `engagementPropertyId` aliases when legacy callers send both ids.

**AI docs/fixture cleanup update:** first-party AI fixtures and capability docs no longer describe `CREATE_ORDER` as requiring embedded `propertyAddress`. Approval-flow fixtures now carry canonical `propertyId` / `clientOrderId`, the intent-registry fixture dispatches the canonical-first payload shape, and the remaining backend/frontend AI docs now describe embedded `propertyAddress` as compatibility-only instead of the primary create-order contract.

**Staff-roster reader update:** the supervisor staff-roster active-orders drill-down no longer formats its property column straight from the embedded VendorOrder address projection as the primary source. `GET /api/staff/roster/:vendorId/orders` now carries the canonical join keys needed for `OrderContextLoader`, resolves display addresses through `getPropertyAddress(...)` first, and only falls back to the embedded `propertyAddress` projection when the canonical context load is unavailable for a legacy row.

**QC-results reader update:** the active QC results endpoints no longer return the stored `qcReview.propertyAddress` field as their primary property display source. `GET /api/qc/results/order/:orderId` and the legacy `GET /api/qc/results/:orderId` route now resolve property text through `OrderContextLoader.loadByVendorOrderId(..., { includeProperty: true })` + `getPropertyAddress(...)` first, with the persisted QC review address retained only as an explicit fallback when canonical order context cannot be loaded.

**QC-queue reader update:** the active QC queue read path no longer returns the stored `qc-review.propertyAddress` field as the primary property text for supervisor/workflow reads. `QCReviewQueueService.searchQueue(...)` now resolves queue item property strings through `OrderContextLoader.loadByVendorOrderId(..., { includeProperty: true })` + `getPropertyAddress(...)` first, while retaining the persisted QC review address only as an explicit fallback for legacy rows or failed canonical context loads.

**QC-queue persistence thinning update:** queue writes now treat stored `qc-review.propertyAddress` as compatibility-only cache instead of default persisted truth. Automatic QC lifecycle queue creation no longer copies a formatted property string onto the persisted QC review document, the manual `POST /api/qc-workflow/queue` path forwards `propertyAddress` only when a caller explicitly supplies it, and `QCReviewQueueService.addToQueue(...)` omits the field from the stored `qc-reviews` row when no compatibility address was provided while still returning a display-safe queue item shape to callers.

**AI-QC gate reader update:** `AIQCGateService` no longer builds its fallback QC-analysis report payload from the embedded order `propertyAddress` copy as the primary display source. When an order lacks a persisted `reportText` / `appraisalReport`, the service now resolves property text through `OrderContextLoader.loadByVendorOrderId(..., { includeProperty: true })` + `getPropertyAddress(...)` first, and only falls back to a formatted legacy order address copy if canonical property context cannot be loaded.

**Inspection scheduling update:** `InspectionService.scheduleInspection(...)` no longer seeds inspection appointment property text directly from the parent VendorOrder's embedded `propertyAddress` blob. New inspection appointments now resolve property display text through `OrderContextLoader.loadByVendorOrder(..., { includeProperty: true })` + `getPropertyAddress(...)` first and persist a formatted canonical string, while retaining a formatted legacy order-address fallback only when canonical context lookup fails.

**Vendor-management state reader update:** vendor availability filtering continues to resolve the subject state canonically through `OrderContextLoader.loadByVendorOrder(..., { includeProperty: true })` + `getPropertyAddress(...)`, and now also normalizes its legacy fallback path so string-form embedded order addresses still yield a state when canonical context cannot be loaded. This keeps vendor-state eligibility canonical-first while preserving compatibility for older rows that only cached property text.

**Notification display fallback update:** `NotificationService` still resolves vendor-assignment property text canonically through `OrderContextLoader.loadByVendorOrder(..., { includeProperty: true })` first, but its compatibility fallback no longer assumes every cached workflow address is a structured object. Legacy string-form `propertyAddress` values (and `propertyDetails.fullAddress` copies when present) now format correctly for outbound notification content instead of collapsing to an empty address.

**Order-notification display fallback update:** `OrderNotificationService` continues to resolve lifecycle-notification property text canonically through `OrderContextLoader.loadByVendorOrder(..., { includeProperty: true })` first, and now hardens its compatibility fallback the same way. Legacy string-form `propertyAddress` values and `propertyDetails.fullAddress` copies now survive cancellation/delivery/assignment notification formatting instead of being treated like missing structured address blobs.

**Portal order-status fallback update:** the borrower/realtor portal order-status route still resolves `propertyAddress` canonically through `OrderContextLoader.loadByVendorOrder(..., { includeProperty: true })` first, but its compatibility fallback no longer leaks mixed shapes from legacy workflow rows. When canonical context is unavailable, string-form `propertyAddress` / `propertyDetails.fullAddress` values are now normalized into the structured portal `propertyAddress` object instead of being returned as raw strings.

**Vendor-bid persistence thinning update:** auto-assignment vendor-bid invitations no longer persist a copied `propertyAddress` field by default. Both sequential bids from `AutoAssignmentOrchestratorService.sendBidToVendor(...)` and broadcast-round bids from `BroadcastBidService.startRound(...)` now omit the compatibility address cache from stored `vendor-bids` rows, relying on canonical order context for downstream address reads instead of treating the bid document as another property-text source of truth.

**Vendor matching engine persistence thinning update:** legacy bid invitations created by `VendorMatchingEngine.createBidInvitation(...)` also no longer persist a copied `propertyAddress` field on `vendor-bids` rows. The engine still uses the request address for matching and scoring, but stored invitation documents now stay aligned with the broader canonical-property rule that bid documents must not become another embedded property-text source of truth.

**WIP board dead-fallback removal:** `WipBoardOrderRow` no longer carries a `propertyAddress` field (the Cosmos query never projected it, so the field was always `undefined` in production). The corresponding dead-code fallback branches in `resolveDisplayAddress(...)` and `resolveAddressText(...)` have been removed. Address resolution now explicitly terminates at the client-order `propertyAddress` join, with no ambiguous embedded-field path remaining. Existing tests that were exercising the unreachable `row.propertyAddress` path via raw mock data have been updated to use canonical `propertyId`/`clientOrderId` joins, matching actual runtime behavior.

**VendorOrderReferenceService tsc-fix:** the two pre-existing `exactOptionalPropertyTypes` compiler errors in `VendorOrderReferenceService.ts` are now resolved. `normalizeLoanType(payload.loanType)` and `normalizeLoanPurpose(payload.loanPurpose)` are pre-computed into local `const` variables before the `createEngagement(...)` call so TypeScript can narrow them from `string | undefined` to `string` in the truthy branch of the conditional spread, satisfying `exactOptionalPropertyTypes` without a type-cast escape hatch.

## Phase P8 — Integration Event Outbox
- [x] Add durable outbox for property-domain integration events
- [x] Emit `property.observation.recorded` after committed observation writes
- [x] Emit `property.currentCanonical.updated` after projector writes
- [x] Emit `property.snapshot.created` / `property.snapshot.refreshed` after snapshot writes
- [x] Keep event emission non-blocking and non-authoritative

**Current outbox note:** the current slice adds snapshot outbox writes after snapshot create/refresh while keeping the publisher strictly downstream of the durable write boundary. Durable property writes in `property-observations`, `property-records`, and `canonical-snapshots` remain authoritative; publisher failures only move outbox rows through retry / dead-letter handling.

**Snapshot-reader audit note:** production snapshot readers now resolve snapshots through `CanonicalSnapshotService` rather than directly querying `aiInsights`. Remaining `aiInsights` usage in the codebase is run-ledger/evaluation-oriented, plus a small number of stale test/script comments that do not represent live snapshot reads.

**Duplicate-detection follow-up:** duplicate-order intake checks now resolve the subject address to a canonical `PropertyRecord` first and narrow VendorOrder candidates by `propertyId` whenever the caller provides a full address tuple. The older `VendorOrder.propertyAddress.state/zip` predicate remains only as an explicit compatibility path for legacy callers that cannot yet resolve canonical property identity.

**WIP board follow-up:** the WIP board service is now off the deprecated embedded VendorOrder property-address query path for its main board/column reads. Remaining Phase 8 VendorOrder embedded-field query work is concentrated in other analytics/ops readers such as portfolio analytics and related legacy reporting surfaces.

**Portfolio analytics follow-up:** portfolio analytics no longer uses embedded VendorOrder `propertyAddress.state` or `loanInformation.loanAmount` for region/value metrics. Region scoping now resolves through canonical `propertyId` / `clientOrderId` joins, geographic concentration is computed from canonical property state, and valuation totals/averages read loan amounts from `client-orders` instead of deprecated VendorOrder lender-field copies.

**Portal reporting follow-up:** the borrower/realtor portal order-status route no longer reads or returns `propertyAddress` directly from an embedded VendorOrder query projection. The route now resolves the order via `findOrderById(...)`, then materializes the portal-safe property address through `OrderContextLoader` + `getPropertyAddress(...)` before responding, keeping this reporting surface aligned with canonical property joins.

**Calendar reporting follow-up:** the iCal calendar feed no longer projects `propertyAddress` out of order/inspection query rows. Calendar event locations now resolve per `orderId` through `OrderContextLoader.loadByVendorOrderId(..., { includeProperty: true })`, then format the resulting `getPropertyAddress(...)` value for both due-date and inspection events so this reporting surface follows the same canonical property read path.

**Auto-assignment controller follow-up:** the `/api/auto-assignment/suggest` and manual `/api/auto-assignment/orders/:orderId/trigger-vendor` controller paths no longer format request payloads directly from embedded `order.propertyAddress` / `order.loanAmount`. Both controller flows now load canonical order context, derive property address/state from `getPropertyAddress(...)`, and pull loan amount from `getLoanInformation(...)` before dispatching the downstream matching/orchestrator requests.

**Order controller follow-up:** the remaining high-traffic `OrderController` property/loan projections are now off their embedded VendorOrder copies in the active create/status/search flows. `engagement.order.created` publishing now resolves canonical property address/state and canonical loan amount through `OrderContextLoader`, QC queue seeding on `SUBMITTED` uses the same canonical property formatter, and property/text search filters now post-filter candidate orders against canonical address fields instead of relying on deprecated `c.propertyAddress.*` Cosmos predicates.

---

## 9. Initial File-Level Worklist

### Foundation
- [x] `src/types/property-observation.types.ts`
- [x] `src/types/property-event-outbox.types.ts`
- [x] `src/services/property-observation.service.ts`
- [x] `src/services/property-event-outbox.service.ts`
- [x] `tests/property-observation.service.test.ts`
- [x] `tests/property-event-outbox.service.test.ts`
- [x] `infrastructure/modules/cosmos-property-observations-container.bicep`
- [x] `infrastructure/modules/cosmos-property-event-outbox-container.bicep`
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
- [x] event outbox design and first non-blocking publisher path
- [x] dedicated property outbox background publisher
- [x] dedicated `canonical-snapshots` container cutover in `CanonicalSnapshotService`
- [x] snapshot outbox writes after create/refresh
- [x] downstream snapshot-reader audit for direct `aiInsights` dependency
- [x] property list/detail endpoints hardened to require explicit tenant context
- [x] property detail / observations endpoints now expose provenance and immutable observation refs
- [x] legacy summary/detailed property routes now resolved from `PropertyRecord` + observations instead of mixed-source assemblers
- [x] unmounted enhanced-property legacy controller/service stack removed after usage audit confirmed no runtime consumers
- [x] last legacy `PropertyController` / `PropertyManagementService` test-only path removed after usage audit confirmed only skipped integration coverage depended on it
- [x] dead/export-only legacy database adapters (`ProductionDatabaseService`, `ConsolidatedCosmosDbService`) removed after usage audit
- [x] remaining `CosmosDbService` property summary DTOs isolated into a dedicated compatibility type module
- [x] unused non-summary `property-enhanced.ts` DTOs retired after final usage audit
- [x] unused `CosmosDbService` property-summary compatibility methods and DTO file retired after final usage audit
- [x] first-party UI property event stream moved off the legacy `/api/properties/:propertyId/events` alias and onto `/api/v1/property-records/:propertyId/events`
- [x] WIP board first-party reads now resolve property display/search addresses from canonical `propertyId` / `clientOrderId` joins instead of the deprecated embedded VendorOrder property blob
- [x] vendor-assignment notifications now resolve property addresses through `OrderContextLoader` / canonical property accessors instead of directly formatting `order.propertyAddress`
- [x] property enrichment tax-history writes moved off `PropertyRecord.taxAssessments` and property detail endpoints now derive assessment history from immutable observations with legacy fallback
- [x] manual property patch route now moves `taxAssessments` / `permits` into immutable observations and canonical property reads derive permit/tax history from observations with legacy fallback
- [x] property enrichment + manual patch AVM writes now flow into immutable `avm-update` observations and canonical single-property reads derive AVM from observations with legacy fallback
- [x] legacy/canonical property list endpoints now also derive AVM/valuation views from immutable observations instead of preferring root `PropertyRecord.avm`
- [x] audited remaining non-controller `PropertyRecord.avm` consumers and explicitly kept comp-selection/value-estimation flows as runtime projections instead of observation-backed canonical reads
- [x] `OrderContextLoader` now materializes observation-derived AVM/tax/permit history onto joined canonical `property` rows for `includeProperty: true` readers
- [x] canonical property controller + `OrderContextLoader` now share a single observation-replay materializer for AVM/tax/permit state
- [x] `/api/v1/orders/:orderId/property-record` now returns the observation-materialized canonical property instead of the raw stored row
- [x] vendor-order comparables subject reads now derive subject valuation from the shared observation-materialized canonical property join
- [x] `ComparableSelectionService` and `OrderCompCollectionService` subject loads now materialize canonical property state via the shared observation replay path
- [x] `BulkPortfolioService` now materializes canonical property state before extraction-driven `PropertyRecord` merge/patch writes
- [x] `PropertyEnrichmentService` staging reads now materialize canonical property state before cache/geocode/update decisions
- [x] duplicate-order detection now narrows candidate VendorOrders by canonical `propertyId` first, with legacy embedded-address filtering retained only as an explicit compatibility fallback
- [x] WIP board board/column queries now resolve addresses through canonical property/client-order joins instead of selecting deprecated embedded VendorOrder `propertyAddress`
- [x] portfolio analytics region/geographic/value metrics now resolve canonical property state + client-order loan amounts instead of querying embedded VendorOrder lender fields

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

As of 2026-05-10, the architecture is approved and implementation is active across the observation foundation, tenant-scoped public-record/materialization observations, manual-correction observations, the dedicated property projector slice, projector merge-policy + duplicate reprocessing coverage, deterministic replay of `currentCanonical` from immutable `canonical-projection` observations, top-level `PropertyRecord` projection lineage hardening, the property outbox publisher path, projector-driven `property.currentCanonical.updated` notifications, snapshot-created/refreshed outbox writes, explicit projector/version provenance on canonical snapshots and projection observations, the initial `canonical-snapshots` container cutover, the property read-path cutover to canonical `PropertyRecord` detail/list/summary responses with explicit provenance exposure, the first workflow aggregate de-duplication slice for `client-orders`, the follow-on engagement property-cache thinning slice, the follow-on client/vendor order write thinning slice that now strips duplicated `propertyDetails` when canonical `propertyId` is present, canonical-first order/report/Axiom readers via `OrderContextLoader` with `includeProperty: true`, the follow-on loader materialization slice that now overlays observation-derived AVM/tax/permit history onto joined canonical property rows, the follow-on order property-record slice that now routes `/api/v1/orders/:orderId/property-record` through the same materialized canonical join path instead of returning the raw stored row, the follow-on order-comparables subject slice that now derives subject valuation from the same observation-materialized canonical property join, the follow-on service-side subject slice that now routes `ComparableSelectionService` and `OrderCompCollectionService` subject reads through shared observation-backed materialization as well, the follow-on bulk-portfolio extraction slice that now merges extracted property updates against the observation-materialized canonical property state instead of a raw `PropertyRecord` row, the follow-on enrichment staging-read slice that now routes `PropertyEnrichmentService` cache/geocode/update decisions through the same observation-materialized canonical property path, explicit single-property + bulk replay/backfill endpoints on the canonical property router, the observation-first tax-history slice that stops new `PropertyRecord.taxAssessments` writes during enrichment and rebuilds property-detail assessment views from immutable observations, the follow-on manual patch/permit thinning slice that now moves tax-assessment + permit history into immutable observations and rebuilds canonical property reads from those observations with legacy fallback, the follow-on AVM thinning slice that now records subject AVM updates as immutable observations in enrichment/manual property updates and rebuilds canonical property summary/detail/list AVM views from those observations with legacy fallback, the audit decision that remaining non-controller AVM consumers intentionally stay as workflow/runtime projections rather than observation-backed canonical reads, and the retirement of the unmounted enhanced-property stack, the final test-only `PropertyController` CRUD stack, the dead/export-only legacy property database adapters, the obsolete `property-enhanced.ts` compatibility DTO file, and the unused `CosmosDbService` property-summary compatibility methods.
