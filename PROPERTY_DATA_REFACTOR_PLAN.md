# Property-as-Root Data Architecture Refactor

> **Superseded direction note (2026-05-10):** The approved target-state plan is now
> [current-plan/PROPERTY_CANONICAL_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-05-10.md](current-plan/PROPERTY_CANONICAL_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-05-10.md).
> This earlier plan remains useful as historical context, but the new plan is the
> authoritative implementation tracker.

**Created:** March 11, 2026  
**Last Updated:** March 11, 2026  
**Status:** 🔴 PLANNING — Not yet started  
**Author:** Architecture review session — GitHub Copilot + team

---

## Why This Refactor Exists

During Phase 3 planning (March 11, 2026) a structural audit revealed that the
platform's data hierarchy is fundamentally inverted. `Property` — the physical
real-world asset that is the subject of ALL work we do — is treated as a dumb
embedded struct rather than a first-class aggregate root. The consequences:

- The same physical property's address exists in 3+ Cosmos containers with no
  shared reference key, making cross-entity queries impossible.
- "Show me everything we've ever done on 123 Main St" cannot be answered with
  a database query — it would require address-string matching across containers.
- Duplicate appraisals on the same property cannot be detected programmatically.
- MLS comp data is never persisted — every comp search hits the provider API
  fresh, we accumulate zero institutional knowledge about sales history.
- `ScopeOfWork` in ARV and `BudgetLineItems` in Construction are parallel siloed
  structures describing the same thing, entered twice, never linked.
- Valuation reports (`CanonicalReportDocument`) have no FK to the engagement that
  produced them and no FK to the property they describe.
- Construction loans have no link to the engagement or appraisal on the same
  property.

---

## The Target Architecture

### Three Distinct Data Layers — Each With Its Own Lifecycle

#### Layer 1: `PropertyRecord` — The Physical Asset  
*Changes: slowly (permits, tax cycles, major renovations)*

The authoritative record of what physically exists at a parcel.
- Keyed by **APN** (Assessor Parcel Number) — the only government-stable identifier
- **Versioned**: each material change (permit close, reassessment) creates a new
  version; old versions are retained to support historical USPAP-compliant reports
- Tax assessments stored as a time series array
- Building permits stored as a time series array
- Replaces: `PropertySummary`, `PropertyDetails`, `ConstructionLoan.propertyAddress`

#### Layer 2: `PropertyComparableSale` — Market Transaction Events  
*Changes: never (a sale is immutable once it closes)*

A persisted record of every MLS sale event we have ever seen — our own comp database.
- Linked to `PropertyRecord` via `propertyId` (resolved at ingestion by APN match
  or normalized address match; flagged `UNRESOLVED` if new parcel)
- Snapshots the property characteristics **at time of sale** (`glaAtSale`,
  `bedroomsAtSale`, etc.) — legally required because the property may have changed
  since the sale
- Replaces: the transient `MlsListing` interface (API response shape) becomes only
  a provider-side DTO; ingestion saves to this persistent container
- **New Cosmos container:** `comparable-sales` (partitioned by `/zipCode`)

#### Layer 3: Canonical Report Snapshots — USPAP Frozen Data  
*Changes: never — reports are legal documents*

`CanonicalSubject` and `CanonicalComp` snapshot all property data as of the
effective date. This is **correct by law**. No structural change needed — we only
add FK fields pointing back to the source records so we can trace report data to
its origin.

---

### Complete Entity Hierarchy After Refactor

```
PropertyRecord  ←  the single root of everything
  id, apn, address (normalized), building{gla,beds,baths,year...}
  zoning, flood, legal, permits[], taxAssessments[]
  recordVersion, versionHistory[]

  ├── PropertyIntelligence          (already correct — has propertyId FK)
  │     views, transit, school, crime, demographics
  │
  ├── PropertyComparableSale[]      (NEW — persisted from MLS)
  │     mlsNumber, salePrice, saleDate, daysOnMarket, concessions
  │     propertyCaptureVersion → which PropertyRecord version was current
  │     glaAtSale, bedroomsAtSale  (snapshot at sale time)
  │
  ├── Engagement[]                  (via EngagementLoan.propertyId)
  │     LenderEngagement
  │       └── EngagementLoan
  │             propertyId → PropertyRecord   ← ADD (replace inline embed)
  │             └── EngagementProduct
  │                   └── AppraisalOrder
  │                         propertyId → PropertyRecord   ← ADD
  │                         └── CanonicalReportDocument
  │                               propertyId → PropertyRecord   ← ADD
  │                               engagementId → Engagement     ← ADD
  │                               subject: CanonicalSubject
  │                                 propertyId → PropertyRecord     ← ADD
  │                                 propertyRecordVersion: number   ← ADD
  │                               comps: CanonicalComp[]
  │                                 propertyId → PropertyRecord         ← ADD
  │                                 comparableSaleId → ComparableSale   ← ADD
  │
  └── ConstructionLoan[]
        propertyId → PropertyRecord              ← ADD (replace inline struct)
        engagementId → Engagement                ← ADD
        propertyAddress?  (@deprecated cache)
        arvAnalysisId → ArvAnalysis
        budgetId → ConstructionBudget (current)
        │
        ├── ConstructionBudget[] (versioned — v1=original, v2=post-CO1, ...)
        │     lineItems[]  ← THE ONE scope of work source
        │                     ArvAnalysis reads these; never re-entered
        │
        ├── DrawRequest[]
        │     propertyId → PropertyRecord         ← ADD
        │     engagementId → Engagement           ← ADD
        │
        └── ArvAnalysis
              propertyId → PropertyRecord          ← ADD
              constructionLoanId → ConstructionLoan ← ADD
              scopeOfWork ← READ from ConstructionBudget.lineItems
                            (ScopeOfWorkItem[] is @deprecated and removed here)
```

---

## Implementation Plan

Each phase is self-contained, additive (no breaking changes until Phase 5),
and can be code-reviewed independently. Check off steps as completed.

---

### Phase R0 — New Type Contracts  
**Target:** Type files only, zero runtime code changes  
**Estimated scope:** ~4 new/rewritten files in `src/types/`  
**Status:** 🔴 Not started

#### R0.1 — Define `PropertyRecord` type
- [ ] Create `src/types/property-record.types.ts`
- [ ] `PropertyRecord` interface — all fields above
- [ ] `PropertyVersionEntry` interface — `{ version, changedAt, changedBy, source, changedFields: string[] }`
- [ ] `TaxAssessmentRecord` interface — `{ taxYear, assessedValue, landValue, improvementValue, annualTaxAmount }`
- [ ] `PermitRecord` interface — `{ permitNumber, type, issuedDate, closedDate, description, valuationAmount }`
- [ ] `PropertyCondition`, `BuildingQuality` enums — migrate from `property-enhanced.ts`
- [ ] `CanonicalAddress` — single canonical address struct used everywhere (replaces the 4 different inline address shapes: `{street,city,state,zip}`, `{address,city,state,zipCode,county}`, `{street,city,state,zipCode,county}`, `PropertyDetails.address`)

#### R0.2 — Define `PropertyComparableSale` type
- [ ] Create `src/types/comparable-sale.types.ts`
- [ ] `PropertyComparableSale` interface
- [ ] `ComparableSaleStatus`: `'ACTIVE' | 'PENDING' | 'SOLD' | 'EXPIRED' | 'WITHDRAWN'`
- [ ] `PropertyIdResolutionMethod`: `'APN_MATCH' | 'ADDRESS_NORM' | 'MANUAL' | 'UNRESOLVED'`
- [ ] `CreateComparableSaleFromMlsDto` — maps `MlsListing` → `PropertyComparableSale`

#### R0.3 — Update `canonical-schema.ts`
- [ ] Add `propertyId: string` to `CanonicalReportDocument`
- [ ] Add `engagementId?: string` to `CanonicalReportDocument`
- [ ] Add `propertyId: string` and `propertyRecordVersion: number` to `CanonicalSubject`
- [ ] Add `propertyId?: string` and `comparableSaleId?: string` to `CanonicalComp`
- [ ] All new fields are optional (`?`) for backward compat — no existing code breaks

#### R0.4 — Add FK fields across 10 entity type files (all optional `?`)
- [ ] `src/types/engagement.types.ts`
  - [ ] `EngagementLoan`: add `propertyId?: string`
  - [ ] Keep `property: PropertyDetails` but mark `@deprecated — use propertyId`
- [ ] `src/types/order-management.ts`
  - [ ] `AppraisalOrder`: add `propertyId?: string`
  - [ ] Keep `propertyDetails: PropertyDetails` but mark `@deprecated — use propertyId`
- [ ] `src/types/arv.types.ts`
  - [ ] `ArvAnalysis`: add `propertyId?: string`, `constructionLoanId?: string`
  - [ ] Mark `ScopeOfWorkItem[]` fields as `@deprecated — read from ConstructionBudget.lineItems`
- [ ] `src/types/construction-loan.types.ts`
  - [ ] `ConstructionLoan`: add `propertyId?: string`, `engagementId?: string`
  - [ ] Keep `propertyAddress` but mark `@deprecated — use propertyId`
- [ ] `src/types/draw-request.types.ts`
  - [ ] `DrawRequest`: add `propertyId?: string`, `engagementId?: string`
- [ ] `src/types/rov.types.ts`
  - [ ] `ROVRequest`: add `propertyId?: string`
- [ ] `src/types/review.types.ts`
  - [ ] `AppraisalReview`: add `propertyId?: string`
  - [ ] `ComparableAnalysis`: add `propertyId?: string`, `orderId?: string` at top level
  - [ ] Mark `propertyAddress: string` as `@deprecated — use propertyId`
- [ ] `src/types/qc-management.ts`
  - [ ] Audit for property references — add `propertyId?: string` if missing
- [ ] `src/types/final-report.types.ts`
  - [ ] Add `propertyId?: string`, `engagementId?: string`

#### R0.5 — Run `tsc --noEmit` — must be 0 errors
- [ ] `cd appraisal-management-backend && npx tsc --noEmit`
- [ ] `cd l1-valuation-platform-ui && npx tsc --noEmit`
- [ ] Sync identical types to frontend (`src/types/canonical-schema.ts` lives in both repos)

---

### Phase R1 — Address Normalization & Property Resolution Service  
**Target:** New service that resolves an address or APN to a canonical `PropertyRecord.id`  
**Estimated scope:** 1 new service, 1 new Cosmos container  
**Status:** 🔴 Not started  
**Depends on:** R0 complete

#### R1.1 — `PropertyRecordService`
- [ ] Create `src/services/property-record.service.ts`
- [ ] `findByApn(apn: string, tenantId: string): Promise<PropertyRecord | null>`
- [ ] `findByNormalizedAddress(address: CanonicalAddress, tenantId: string): Promise<PropertyRecord | null>`
  - Normalization: uppercase, strip directionals (St → Street → ST), strip unit numbers for matching
- [ ] `resolveOrCreate(address: CanonicalAddress | string, apn?: string): Promise<{ propertyId: string; isNew: boolean }>`
  - **NO `createIfNotExists` in Cosmos SDK terms** — this is explicit: try find → if null, create new record → return id
  - Must be idempotent: calling twice with same APN returns same `propertyId`
- [ ] `getById(id: string, tenantId: string): Promise<PropertyRecord>`
- [ ] `getVersionHistory(id: string, tenantId: string): Promise<PropertyVersionEntry[]>`
- [ ] `createVersion(id: string, changes: Partial<PropertyRecord>, reason: string, source: string): Promise<PropertyRecord>`
  - Increments `recordVersion`, appends to `versionHistory`, saves new document

#### R1.2 — Register container in `cosmos.config.ts` (or equivalent)
- [ ] Add `property-records` container — partition key `/tenantId`
- [ ] Add `comparable-sales` container — partition key `/zipCode`
- [ ] **No auto-create code** — containers must be created via Bicep/infra — add containers to the Bicep file

#### R1.3 — Update `src/config/cosmos-containers.ts` (or equivalent config)
- [ ] Add container name constants: `PROPERTY_RECORDS_CONTAINER`, `COMPARABLE_SALES_CONTAINER`

#### R1.4 — `ComparableSaleService`
- [ ] Create `src/services/comparable-sale.service.ts`
- [ ] `ingestFromMls(listing: MlsListing, tenantId: string): Promise<PropertyComparableSale>`
  - Calls `PropertyRecordService.resolveOrCreate()` to get `propertyId`
  - Upserts the comparable sale (idempotent on `mlsNumber + saleDate`)
- [ ] `findByPropertyId(propertyId: string, tenantId: string): Promise<PropertyComparableSale[]>`
- [ ] `findByRadius(lat: number, lng: number, radiusMiles: number, filters: CompSearchFilters): Promise<PropertyComparableSale[]>`
  - This replaces the raw MLS API call in comp searches — hits our DB first, falls through to MLS provider if insufficient results, ingests anything new
- [ ] `getById(id: string, tenantId: string): Promise<PropertyComparableSale>`

#### R1.5 — Tests
- [ ] `tests/property-record.service.test.ts` — resolve/create, idempotency, version creation
- [ ] `tests/comparable-sale.service.test.ts` — ingest, dedup on mlsNumber, radius search

---

### Phase R2 — Wire FK Fields at Creation Time  
**Target:** All `create()` methods in existing services begin writing the new FK fields  
**Estimated scope:** ~8 service files, write paths only  
**Status:** 🔴 Not started  
**Depends on:** R0, R1 complete

**Rule for this phase:** Services must call `PropertyRecordService.resolveOrCreate()` before saving any document that needs a `propertyId`. The address data is still embedded (backward compat) — we are adding the FK, not removing the embed yet.

- [ ] `engagement.service.ts` — `createEngagement()`: resolve `propertyId` from `EngagementLoan.property`; write `engagementLoan.propertyId`
- [ ] `order.service.ts` (or equivalent) — `createOrder()`: resolve `propertyId` from `propertyDetails`; write `order.propertyId`
- [ ] `arv.service.ts` — `createAnalysis()`: write `propertyId`, accept `constructionLoanId`
- [ ] `construction-loan.service.ts` — `createLoan()`: resolve `propertyId` from `propertyAddress`; accept `engagementId`
- [ ] `draw-request.service.ts` — `createDrawRequest()`: propagate `propertyId` and `engagementId` from parent `ConstructionLoan`
- [ ] `rov.service.ts` — `createROV()`: resolve `propertyId` from linked order
- [ ] `review.service.ts` — `createReview()`: resolve `propertyId` from linked order
- [ ] `final-report.service.ts` / `canonical-report.service.ts` — `createReport()`: write `propertyId`, `engagementId`; set `subject.propertyId`, `subject.propertyRecordVersion`
- [ ] Update comp selection: when appraiser selects a comp for a report, call `ComparableSaleService.ingestFromMls()` and write `comp.comparableSaleId`

#### R2.1 — Tests for all write paths
- [ ] Verify every `create` call now produces a document with `propertyId` set
- [ ] Verify `propertyId` is stable (same address → same ID — idempotency)

---

### Phase R3 — Scope of Work Unification  
**Target:** Eliminate `ScopeOfWorkItem[]` duplication in `ArvAnalysis`  
**Estimated scope:** `arv.service.ts`, `arv-engine.service.ts`, `ArvAnalysis` type, ARV UI page  
**Status:** 🔴 Not started  
**Depends on:** R0 complete; R2 recommended but not required

**Rule:** The `ConstructionBudget.lineItems` array IS the scope of work. `ArvAnalysis` that are linked to a `ConstructionLoan` must read scope from the current budget version. Standalone ARV analyses (no construction loan — e.g., pure comp approach) have no scope of work at all.

- [ ] `arv.service.ts`: add `getScopeOfWork(arvAnalysisId: string): Promise<BudgetLineItem[]>`
  - If `arvAnalysis.constructionLoanId` is set: load the linked loan's current `ConstructionBudget`, return `lineItems`
  - If not set: return `[]` (no scope — comp-only analysis)
- [ ] `arv-engine.service.ts`: update cost approach calculator to accept `BudgetLineItem[]` directly
  - Remove any code that reads from `ArvAnalysis.scopeOfWork`
- [ ] `ArvAnalysis` type: mark `scopeOfWork?: ScopeOfWorkItem[]` as `@deprecated`
- [ ] ARV UI `/arv` page: SOW tab — read scope from `constructionLoanId → budget.lineItems`
  - If no `constructionLoanId`: show "Link to a construction loan to import scope" message
  - Remove duplicate entry form (entries happen in the Budget tab of the loan, not here)
- [ ] **Do NOT delete `ScopeOfWorkItem[]`** from the type yet — document is still written with it in Cosmos; clean-up is Phase R5

---

### Phase R4 — Comp Search Uses Persistent ComparableSale DB  
**Target:** All comp searches query `comparable-sales` container first; fall through to MLS API only when insufficient results  
**Estimated scope:** MLS service, comp search endpoints, ARV comp tab UI  
**Status:** 🔴 Not started  
**Depends on:** R1 complete

- [ ] `mls-data.service.ts` (or equivalent): modify `searchComps()`:
  1. Query `ComparableSaleService.findByRadius()` in our DB
  2. If result count < requested minimum: call MLS provider API for the gap
  3. Ingest any new records from provider via `ComparableSaleService.ingestFromMls()`
  4. Return merged, deduped results
- [ ] Add `propertyHistory` endpoint: `GET /properties/:propertyId/comparable-sales` — all sales we've recorded for a given parcel
- [ ] Prior appraisal alert: when creating a new order, check `Engagement[]` and `CanonicalReportDocument[]` for existing `propertyId` match — surface "⚠️ This property was appraised on [date] at $[value]. View report?" in UI
- [ ] Comp usage analytics: `GET /comparable-sales/:id/usage-history` — which reports selected this comp and what adjustments were made

---

### Phase R5 — Deprecation Cleanup (Breaking Changes)  
**Target:** Remove all the `@deprecated` inline embed fields  
**Estimated scope:** Type files, service write paths, migrations  
**Status:** 🔴 Not started  
**Depends on:** R0–R4 complete + data migration verified (all existing Cosmos documents have `propertyId` populated)  
**⚠️ This phase contains BREAKING CHANGES — requires coordination with frontend**

#### Pre-condition: Data Migration Script
- [ ] Write `scripts/migrate-property-ids.ts`
  - Read every document in: `engagements`, `orders`, `arv-analyses`, `construction-loans`, `draw-requests`, `reports`
  - For any document missing `propertyId`: call `PropertyRecordService.resolveOrCreate()` from its embedded address
  - Write the resolved `propertyId` back to the document (patch operation)
  - Log unresolved records to a report file for manual review
- [ ] Run migration in staging; verify 100% resolution rate (or document all unresolved)
- [ ] Run migration in production

#### Post-migration cleanup
- [ ] Remove `EngagementLoan.property: PropertyDetails` — make `propertyId: string` required
- [ ] Remove `AppraisalOrder.propertyDetails: PropertyDetails` — make `propertyId: string` required
- [ ] Remove `ConstructionLoan.propertyAddress` — make `propertyId: string` required
- [ ] Remove `ComparableAnalysis.propertyAddress: string` — make `propertyId: string` required
- [ ] Remove `ArvAnalysis.scopeOfWork?: ScopeOfWorkItem[]` — fully replaced by budget lineItems
- [ ] Remove `ScopeOfWorkItem` type entirely (after verifying zero usages)
- [ ] Remove `PropertyDetails` interface from `order-management.ts` (after verifying zero usages outside deprecated fields)
- [ ] Run `tsc --noEmit` — 0 errors
- [ ] Run full test suite — 0 regressions

---

## Cross-Cutting Decisions

### Address Normalization Strategy
- All addresses entering the system go through `PropertyRecordService.normalizeAddress()`
- Normalization: uppercase + USPS street type expansion (`St → Street`) + strip unit/suite for parcel matching
- APN takes precedence over address matching when both are available
- When APN is not available (pre-permit properties, foreign addresses): address normalization is the key

### What `PropertyDetails` Becomes
`PropertyDetails` (the current inline struct in `order-management.ts`) becomes a **DTO** used only at the API boundary — the shape that a client POSTs when creating an order or engagement. It is never stored directly. It is immediately resolved to a `propertyId` by the service layer and discarded.

### Versioning Rule for `PropertyRecord`
| Change | Triggers new version? |
|---|---|
| Address typo correction | No — patch in place |
| Tax assessment update | No — appends to `taxAssessments[]` |
| Permit closed (adds bedroom, sq ft change) | **Yes — new version** |
| Major renovation / rehab completes | **Yes — new version** |
| Zoning change | **Yes — new version** |

Reports always store `subject.propertyRecordVersion` so they can be reproduced against the property as it was on the effective date.

### Cosmos Container Summary (Post-Refactor)
| Container | Partition Key | New? | Notes |
|---|---|---|---|
| `property-records` | `/tenantId` | **NEW** | Replaces `properties` container data |
| `comparable-sales` | `/zipCode` | **NEW** | Persisted MLS sale events |
| `property-intelligence` | `/propertyId` | Existing | Already correct |
| `engagements` | `/tenantId` | Existing | `EngagementLoan.propertyId` added |
| `orders` | `/tenantId` | Existing | `propertyId` added |
| `reports` | `/tenantId` | Existing | `propertyId` + `engagementId` added |
| `arv-analyses` | `/tenantId` | Existing | `propertyId` + `constructionLoanId` added |
| `construction-loans` | `/tenantId` | Existing | `propertyId` + `engagementId` added |
| `draw-requests` | `/tenantId` | Existing | `propertyId` + `engagementId` added |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Address normalization misses a parcel → creates duplicate `PropertyRecord` | Medium | Medium | APN is the merge key; de-dup job in Phase R4; manual resolution UI |
| MLS provider doesn't provide APN → all resolution by address | High | Low | Address normalization is the fallback; partial data still better than none |
| Migration script times out on large tenants | Low | High | Batch processing with checkpointing; run off-peak; idempotent (re-runnable) |
| Front-end breaks when `propertyDetails` embed is removed (Phase R5) | High | High | **Phase R5 is coordinated with UI team; deploy backend additive changes first, remove embeds only after UI is updated** |
| `ScopeOfWorkItem` removal breaks existing ARV data in Cosmos | Low | High | Phase R5 pre-condition requires migration script to have back-filled all data |

---

## What Does NOT Change

- `CanonicalSubject` and `CanonicalComp` struct shapes — they are legal document
  snapshots and must remain denormalized. We only ADD FKs.
- Report generation logic — reads the same frozen snapshot fields
- PDF rendering — reads the same struct
- All existing API endpoints — all changes are additive (new optional fields)
- `PropertyIntelligence` container — already has `propertyId`; no changes needed
- All QC, vendor, payment, notification, esignature logic — untouched

---

## Progress Tracker

| Phase | Name | Status | Started | Completed | PR |
|---|---|---|---|---|---|
| R0.1 | `PropertyRecord` types | � Complete | 2026-03-11 | 2026-03-11 | — |
| R0.2 | `PropertyComparableSale` types | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R0.3 | Canonical schema FK fields | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R0.4 | FK fields on 10 entity types | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R0.5 | `tsc --noEmit` clean | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R1.1 | `PropertyRecordService` | � Complete | 2026-03-11 | 2026-03-11 | — |
| R1.2 | Cosmos container config | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R1.3 | Container name constants | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R1.4 | `ComparableSaleService` | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R1.5 | R1 tests | 🟢 Complete | 2026-03-11 | 2026-03-11 | — |
| R2 | Wire FK fields at creation | � In progress | 2026-03-11 | — | — |
| R2.1 | R2 tests | 🟡 In progress | 2026-03-11 | — | — |
| R3 | Scope of Work unification | 🔴 Not started | — | — | — |
| R4 | Persistent comp DB search | 🔴 Not started | — | — | — |
| R5 | Deprecation cleanup (BREAKING) | 🔴 Not started | — | — | — |

### Status Key
- 🔴 Not started
- 🟡 In progress
- 🟢 Complete
- ⏸️ Blocked (note reason)

---

## Update Log

| Date | Who | What |
|---|---|---|
| 2026-03-11 | Architecture review | Initial plan created — full audit of all 43 type files, identified all missing FKs, designed 3-layer property model, planned 5-phase additive refactor |
| 2026-03-11 | Implementation | **Phase R0 complete** — all 5 sub-steps done. Created `property-record.types.ts` and `comparable-sale.types.ts`; patched `canonical-schema.ts` (both repos), `engagement.types.ts`, `arv.types.ts`, `construction-loan.types.ts`, `draw-request.types.ts`, `rov.types.ts`, `review.types.ts`, `types/index.ts`, `order-management.ts`; fixed 10 pre-existing tsc errors (`archiving-retention.service.ts`, `enhanced-fraud-detection.service.ts`, `report-compliance.service.ts`); both repos confirmed 0 tsc errors. |
| 2026-03-11 | Implementation | **Phase R1 complete** — `PropertyRecordService` (find-by-APN, address normalization, resolveOrCreate, versioning), `ComparableSaleService` (MLS ingest/dedup, radius search with haversine, report tracking), `cosmos-db.service.ts` container wiring (`property-records`, `comparable-sales`), exports in `services/index.ts`; 44 vitest tests pass; backend 0 new tsc errors (3 pre-existing in `substantive-review.controller.ts` excluded from scope). |
| 2026-03-11 | Implementation | **Phase R2 in progress (4/8 services)** — `engagement.service.ts` (resolveOrCreate per loan → `EngagementLoan.propertyId`), `arv.service.ts` (`propertyId` on `ArvAnalysis`), `construction-loan.service.ts` (`propertyId` on `ConstructionLoan`), `draw-request.service.ts` (propagates `propertyId`+`engagementId` from parent loan). Controllers updated to inject `PropertyRecordService`. Engagement unit tests updated (48/48). Backend at 0 tsc errors. Deferred: `order-management.service.ts` (legacy DatabaseService), `rov-management.service.ts` (non-injected pattern), `final-report.service.ts` (generateReport, complex). |
