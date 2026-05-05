# Order Domain Redesign — Design Document (v2)

**Status:** Draft for review
**Branch context:** `integration/feature-merge-2026-05-04`
**Prereqs shipped:** Slices 1–7, 9, 8a (canonical-alignment foundation; per-Property accumulating canonical view)
**Last updated:** 2026-05-05
**Supersedes:** v1 (2026-05-04)

---

## What changed in v2

The v1 doc was written before I'd surveyed the integration branch. This rewrite incorporates four corrections from the design conversation:

1. **Property is the load-bearing entity, not Loan.** v1 echoed the codebase's existing `EngagementLoan` naming. That's the wrong anchor — engagements hold *properties*; loans are reference metadata that hangs off properties.
2. **More of v1's scope is already built than v1 acknowledged.** The integration branch already has `Engagement`, `ClientOrder`, `VendorOrder`, `Product`, `ProductType` (atomic catalog), and `DecompositionRule` (composition mechanism). What's missing is wiring, seeds, and the legacy-removal cleanup — not the entities themselves.
3. **One canonical SHAPE, multiple stores by lifecycle.** v1 was silent on this. The clarification is now explicit: provenance stores (raw) + rolling property view + frozen per-order snapshot — all the same `CanonicalReportDocument` shape, distinct lifecycles.
4. **Decomposition is "rules-as-suggestions", not auto-fan-out.** v1 implied automatic fan-out at order create. The integration branch deliberately makes this human-confirmable (with `autoApply: true` for low-risk products). The doc now reflects that.

---

## 1. Target domain model (corrected)

```
Engagement                              (Client → AMP, lender relationship)
   │   id, clientId, tenantId, status, properties[]
   │
   └─ EngagementProperty[]              ← Properties, not Loans (currently mis-named EngagementLoan in code)
         │   propertyId  → PropertyRecord     (load-bearing FK)
         │   loanReferences[]                 (reference-only metadata; many loans possible per property)
         │   clientOrders[]                   (orders for THIS property)
         │   ...
         │
         └─ ClientOrder[]               (one per product the client buys for this property: DVR, BPO, Appraisal, ROV, ...)
               │   id, engagementId, engagementPropertyId, productId,
               │   propertyId, productSnapshot, resolvedComposition, vendorOrderIds[]
               │
               └─ VendorOrder[]         (the fan-out — AMP → vendor/staff per fulfillment unit)
                     id, clientOrderId, productId (atomic), vendorId,
                     scope, fee, dueDate, status, deliverables, ...

PropertyRecord                          (the canonical physical asset; data hangs HERE)
   ├─ address, building, taxAssessments, permits
   ├─ currentCanonical: PropertyCurrentCanonicalView    (rolling, slice 8a)
   └─ versionHistory[]

Vendor                                  (kind via staffType: 'EXTERNAL' | 'INTERNAL')
                                        (staff are vendors with staffType=INTERNAL)

Product (catalog)                       (clientFacing | vendorFulfillable | both)
DecompositionRule                       (1 ClientOrder → N VendorOrders mapping; rules-as-suggestions)
```

### 1.1 Cardinality at every level
- 1 Engagement → N EngagementProperty
- 1 EngagementProperty → 1 PropertyRecord (FK) + N LoanReference (metadata) + N ClientOrder
- 1 ClientOrder → N VendorOrder
- 1 PropertyRecord → 1 currentCanonical (rolling) + N CanonicalSnapshot (per-order, frozen)

### 1.2 What lives WHERE on the property

Properties are the unit of work — orders, products, third-party data, enrichment, canonical accumulation, comps history all hang off the property.

```
PropertyRecord
  ├─ identity: address, apn, fipsCode, propertyType
  ├─ characteristics: building.{gla, yearBuilt, bedrooms, ...}
  ├─ history: taxAssessments[], permits[], versionHistory[]
  ├─ currentCanonical (rolling canonical view — slice 8a)
  └─ provenance: dataSource, lastVerifiedAt
```

`PropertyEnrichmentRecord` (per-call audit blob) and `Document.extractedData` (per-document Axiom output) sit alongside as raw provenance — not children of the property, but linked by propertyId / orderId so we can re-derive canonical if mappers change.

---

## 2. State of the integration branch — what's built vs missing

### 2.1 Already built ✓

| Entity / capability | File | Status |
|---|---|---|
| `Engagement` (aggregate root) | [`engagement.types.ts`](src/types/engagement.types.ts) | Built; **mis-anchored on Loan** |
| `EngagementLoan` (per-loan child) | same | Built; should be `EngagementProperty` |
| `EngagementClientOrder` (embedded per-loan order) | same | Built; FK fields named `engagementLoanId` |
| `ClientOrder` (standalone) | [`client-order.types.ts`](src/types/client-order.types.ts) | Built (`client-orders` container) |
| `VendorOrder` | [`vendor-order.types.ts`](src/types/vendor-order.types.ts) | Built as `AppraisalOrder & VendorOrderLinkage` alias |
| `ClientOrderService.placeClientOrder(input, vendorOrderSpecs)` | `client-order.service.ts` | Built; performs fan-out from caller-supplied specs |
| Industry-standard atom catalog | [`product-catalog.ts`](src/types/product-catalog.ts) — `ProductType` enum (23 atoms) + `ProductDefinition` | Built |
| Sellable products | `Product` interface in `index.ts` | Built; 8 seeded |
| Composition mechanism | [`decomposition-rule.types.ts`](src/types/decomposition-rule.types.ts) + `OrderDecompositionService` | Built (rules-as-suggestions) |
| Internal staff as vendor | `Vendor.staffType: 'internal' \| 'external'` + `staffRole` enum | Built; 3 staff seeded |
| Per-property rolling canonical | `PropertyRecord.currentCanonical` (slice 8a) | Built |
| Per-order frozen canonical | `CanonicalSnapshotRecord` | Built |

### 2.2 Built but not yet wired / activated ⚠️

| Item | Why it matters | Current state |
|---|---|---|
| **DecompositionRule seed data** | Without rule rows, every ClientOrder fans out to exactly one VendorOrder (default 1:1). DVR, BPO multi-atom flows can't fire. | No rules seeded |
| **`type: 'vendor-order'` discriminator flip** | Phase 4 plan: switch reads/writes from legacy `type:'order'` to `'vendor-order'`. | Still on `type:'order'` for back-compat |
| **`ClientOrder.engagementId` enforcement** | Required parent in the target model. | Optional in current type; orphan-order paths still possible |

### 2.3 Wrong / needs renaming ❌

| Current (wrong) | Target |
|---|---|
| `Engagement.loans: EngagementLoan[]` | `Engagement.properties: EngagementProperty[]` |
| `EngagementLoan` interface (loan-anchored fields at top level) | `EngagementProperty` interface (property-anchored; loan info → `loanReferences[]`) |
| `engagementLoanId` (FKs throughout codebase) | `engagementPropertyId` |
| `EngagementClientOrder` embedded shape with loan fields hoisted | property-anchored; loan fields nested as references |

### 2.4 Missing (still real work) 🔨

| Item | Slice |
|---|---|
| Rule-driven composition (predicate against canonical context) | 8h |
| `subjectProperty` flat-shim retirement (legacy parallel view in snapshot) | 8j |
| `BulkIngestionCanonicalRecord.canonicalData` retirement (legacy adapter blob) | 8j |
| Direct write-paths to `orders` container (~30 services + 10 controllers still bypass `ClientOrderService` / `VendorOrderService`) | 8e |
| Final `AppraisalOrder` type removal | 8k |

---

## 3. One canonical SHAPE, multiple STORES

This is the data-architecture clarification I owe the doc. It's NOT a multi-source problem; it's the same shape persisted at different lifecycles.

```
THE SHAPE
   CanonicalReportDocument  (canonical-schema.ts)
   ───────────────────────
   Every source (Axiom, BatchData, MLS, intake, CSV, MOP) projects ONTO this shape via per-source mappers.

THE STORES (different lifecycles)
   Provenance / raw          — kept for audit + re-projection
     ├─ PropertyEnrichmentRecord     (`property-enrichments`, per-call vendor blob)
     └─ Document.extractedData       (`documents`, per-document Axiom output)

   Rolling per-property      — accumulates across orders
     └─ PropertyRecord.currentCanonical  (`property-records`, slice 8a)

   Frozen per-order          — USPAP / legal reproducibility
     └─ CanonicalSnapshotRecord      (`aiInsights`, per-extraction-run)
```

Why each store is necessary:
- **Raw provenance** lets us re-project canonical when a mapper changes without re-calling the vendor or re-running Axiom.
- **Rolling per-property** lets next year's refi read last year's accumulated subject + transaction history.
- **Frozen per-order** lets us legally reproduce "what data did the rules run against for this specific QC outcome" months later.

The three stores can't be merged because their lifecycles are incompatible — you can't both freeze and accumulate on the same record.

### 3.1 Legacy parallel views (transitional debt to retire — slice 8j)

```ts
CanonicalSnapshotRecord.normalizedData {
  canonical:        { ... }   // ← THE ONE, read this
  extraction:       { ... }   // raw provenance — keep
  providerData:     { ... }   // raw provenance — keep
  subjectProperty:  { ... }   // ← LEGACY shim, duplicates canonical, DELETE
  provenance:       { ... }   // metadata — keep
}

BulkIngestionCanonicalRecord {
  canonicalDocument: { ... }  // ← THE ONE (slice 3 added this)
  canonicalData:     { ... }  // ← LEGACY adapter blob, DELETE once consumers migrate
  sourceData:        { ... }  // raw row — keep for provenance
}
```

These survived the slice 1–9 work for backward compat. Slice 8j retires them once the readers have migrated.

---

## 4. Refactored slice sequence

Renumbered and re-scoped against the integration branch's actual state. Slice numbers continue from 8a (which already shipped):

| Slice | Branch | Scope | Size | Depends |
|---|---|---|---|---|
| **8b** | `feat/decomposition-rule-seeds` | Author DecompositionRule rows for multi-atom products (DVR, BPO, Hybrid). Activates the dormant fan-out. | ½ – 1 d | – |
| **8c** | `feat/engagement-property-rename` | **THE BIG ONE.** Rename `EngagementLoan` → `EngagementProperty`; `Engagement.loans` → `Engagement.properties`; `engagementLoanId` → `engagementPropertyId` everywhere; loan fields → `loanReferences[]`. ~30 service + 10 controller touches. | 4–5 d | – |
| **8d** | `feat/loan-references-shape` | Define `LoanReference` interface; migrate existing top-level loan fields (loanNumber, loanAmount, loanType, loanPurpose, borrowerName, ...) into the array. Multiple loans-per-property supported. | 1–2 d | 8c |
| **8e** | `feat/migrate-write-paths` | Route all "create order" paths through `ClientOrderService.placeClientOrder` / `VendorOrderService`. Stop direct `orders`-container writes with raw `AppraisalOrder` shape. | 3–5 d | 8c |
| **8f** | `feat/discriminator-flip` | Flip `type:'order'` → `'vendor-order'` on writes; update read queries; backfill legacy rows. **Coordinated PR — single biggest risk.** | 2–3 d | 8e |
| **8g** | `feat/engagement-primacy` | Make `ClientOrder.engagementId` required on creation; reject orphan creates; backfill any in-flight orphans to a system-default engagement. | 1–2 d | 8c |
| **8h** | `feat/composition-rules-engine` | Add rule-driven composition (`composition.rules[]`) using the review-program rule evaluator against canonical context. Clients can author rules. | 2–3 d | 8b |
| **8i** | `feat/client-authored-products` | Persist client-tier Product rows (`clientId: <id>` overrides platform default). Same canonical/client tier pattern as review-programs. | 1–2 d | 8b |
| **8j** | `feat/retire-legacy-shims` | Delete `subjectProperty` shim from snapshot.normalizedData; delete `canonicalData` legacy adapter blob from BulkIngestionCanonicalRecord; migrate readers to `canonical` / `canonicalDocument`. | 2–3 d | 8e (so reader paths are clean) |
| **8k** | `feat/appraisal-order-removal` | Final cleanup: zero `AppraisalOrder` reads/writes left → delete the type, delete the legacy controller + service. | 1–2 d | 8e, 8f, 8j |

**Total estimate:** 18–28 days of focused work. ~3–4 weeks at one engineer.

### 4.1 Critical-path order
The dependency graph means the high-leverage chain is:
```
8c (rename) → 8e (write paths) → 8f (discriminator flip) → 8j (retire shims) → 8k (delete legacy)
```
Everything else (8b seeds, 8d loan refs, 8g engagement guard, 8h rules, 8i client-authoring) can run in parallel branches off 8c once it lands.

8b is the cheapest win that unlocks visible behaviour change (ClientOrders actually fanning out to multiple vendor work units). Recommended first.

### 4.2 Migration strategy for 8c (the rename)

Rename touches are mechanical but high-volume. Approach:

1. **Add new types alongside old** — `EngagementProperty` defined; `EngagementLoan` becomes a deprecated type alias `= EngagementProperty` so existing code compiles.
2. **Add accessor properties** — `engagement.properties` getter that returns `engagement.loans` during transition (and back-fills the rename later).
3. **Migrate consumers in waves** — controllers first (smallest surface), then services (largest), then tests.
4. **Final pass** — delete the deprecated alias; delete the `loans` accessor; update the persisted document shape.

Cosmos doesn't enforce field names so existing rows continue to read. We backfill the field rename in the document on next write (`{...existing, properties: existing.loans, loans: undefined}`).

---

## 5. Open questions — answered in design conversation

The v1 doc had 6 open questions; conversation answered all of them:

| # | Question | Answer |
|---|---|---|
| 1 | Pricing — flat package or composition-derived? | (Not yet answered — defer until 8b/8h) |
| 2 | VendorOrder partition key — `/tenantId` or `/clientOrderId`? | `/tenantId` (already chosen on integration branch). Cross-partition fan-out queries are small N (~3–5). |
| 3 | Vendor selection at fan-out — automatic or deferred? | Deferred. ClientOrderService spawns VendorOrders with `vendorId=null`; auto-assignment runs after. (Already implemented this way.) |
| 4 | Composition result versioning — recompose on catalog update? | Frozen at order time (`ClientOrder.resolvedComposition`). Recompose only on explicit reorder. |
| 5 | Engagement granularity — multi-property per engagement? | **YES, multi-property.** Engagement has many properties; each property has many client orders; each client order has many vendor orders. |
| 6 | Loan-level granularity — load-bearing or reference? | **Reference only.** A property may have multiple loans (first lien + HELOC + refi-in-flight); we store them as `loanReferences[]` so client conversations resolve, but no workflow hangs off "loan." |

### 5.1 Still-open (blockers for specific slices)

- **For 8b (decomposition seeds):** What atoms make up each multi-product? Confirm: DVR = Appraisal + AVM + DesktopReview + QC; BPO = Realtor BPO + Inspection + Review. Author wants list to seed.
- **For 8d (loan references):** What loan fields move into `LoanReference`? Confirm: `loanNumber`, `loanAmount`, `loanType`, `loanPurpose`, `lienPosition`, `originator`, `borrowerName`, `borrowerEmail`, `borrowerPhone`. (Borrower could arguably move to property — TBD.)

---

## 6. What's NOT in this redesign (deferred)

- **Pricing model** (flat package vs derived). Real but not in any slice yet.
- **Sub-products / nested packages** (DVR-Plus = DVR + extra Inspection). Composer can recurse; UI cost is too high to justify.
- **Versioned vendor agreements** (negotiated fee schedules per vendor + product over time).
- **Marketplace scoring** ("which vendor is best for this VendorOrder?") — already in `auto-assignment.controller`.

---

## 7. Approval gate

**Before 8b starts:**
- [ ] §1 hierarchy (Engagement → EngagementProperty[] → ClientOrder[] → VendorOrder[]) confirmed
- [ ] §2 state-of-codebase mapping confirmed (or corrected)
- [ ] §3 store lifecycles confirmed
- [ ] §4 slice sequence + estimate confirmed (or reordered)
- [ ] §5.1 atom-list for DVR / BPO confirmed (blocks 8b seed)
- [ ] §5.1 LoanReference field list confirmed (blocks 8d)

Once green: branch `feat/decomposition-rule-seeds` and start 8b.

---

## Appendix A — slice 8a recap (for context)

`feat/property-canonical-accumulation` (commit `8dec967`, shipped) wired the per-Property rolling canonical view. After every snapshot build, property-scoped branches (subject, transactionHistory, avmCrossCheck, riskFlags) write back to `PropertyRecord.currentCanonical`. New snapshots seed from the property's accumulated state as a base layer. Order-scoped branches (comps, loan, ratios, valuation, reconciliation) intentionally don't propagate — they belong to the specific ClientOrder run, not the property.

This is the "C is IDEAL" lifecycle: per-property accumulation + per-order frozen reproducibility. Both directions wired; never blocks the snapshot return.
