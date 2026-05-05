# Order Domain Redesign — Design Document

**Status:** Draft for review
**Author:** Canonical-alignment workstream (slices 8b–8f)
**Prereqs:** Slices 1–7, 9, 8a all shipped (canonical-alignment foundation in place; per-Property accumulating canonical view in place via 8a)
**Last updated:** 2026-05-04

---

## 1. Problem statement

The current model conflates three distinct concepts under one type:

```
AppraisalOrder  ← does triple duty:
                  (a) the client's order for our product
                  (b) our work order to a vendor
                  (c) the workflow state machine for both
```

This is wrong on several axes:

- **The name is misleading.** We sell more than appraisals: DTR, Hybrid Appraisal,
  RapidVal, BPO, etc. "AppraisalOrder" is a product-fitted name on a generic concept.
- **One client order can spawn multiple vendor orders.** A BPO ClientOrder fans
  out to: Realtor VendorOrder + Inspection VendorOrder + staff Review VendorOrder.
  Today there's no fan-out — one row per "order" with no clear distinction.
- **Products aren't first-class.** The `productType` enum is hard-coded; clients
  can't author their own product packages; composition rules don't exist.
- **Engagement isn't load-bearing.** Engagement exists but isn't required as the
  parent of every order; orphaned-order paths exist.

There are no external consumers of the AppraisalOrder shape today — so we have
freedom to redesign cleanly.

---

## 2. Target domain model

```
Engagement                               (Client → AMP, established by client)
    │   id, clientId, tenantId, status, products[], createdAt
    │
    ├─ ClientOrder                       (one per product the client buys)
    │     │   id, engagementId, productId, status, dueDate, propertyId
    │     │   slaTargets, clientPONumber, productOptions
    │     │
    │     ├─ VendorOrder                 (AMP → vendor/staff, per fulfillment unit)
    │     │     id, clientOrderId, productId (atomic),
    │     │     vendorId, scope, fee, instructions,
    │     │     status, dueDate, deliverables, payments
    │     │
    │     ├─ VendorOrder
    │     └─ VendorOrder
    │
    └─ ClientOrder
          └─ VendorOrder ...

Vendor                                   (kind: 'EXTERNAL' | 'INTERNAL')
                                         (staff are vendors with kind=INTERNAL)

Product (catalog)                        (clientFacing | vendorFulfillable | both)
    composition: { alwaysInclude, selectors, rules }   (all three modes supported)
```

### 2.1 Entities

**Engagement** — already exists; we tighten its parenthood.
```ts
interface Engagement {
  id: string;
  tenantId: string;
  clientId: string;
  status: 'ACTIVE' | 'CLOSED';
  // ... existing fields ...
  /** Optional override of client-facing pricing for this engagement. */
  pricingOverrides?: ProductPricingOverride[];
}
```

**ClientOrder** (new — replaces `AppraisalOrder` in the client-facing role).
```ts
interface ClientOrder {
  id: string;
  type: 'client-order';
  tenantId: string;
  engagementId: string;            // REQUIRED parent
  clientId: string;
  /** What the client bought — references Product.id where clientFacing=true. */
  productId: string;
  /** Product config snapshot at order time (frozen for reproducibility). */
  productSnapshot: ProductSnapshot;
  /** Resolved composition at order time — list of vendor-order specs. */
  resolvedComposition: ComposedAtomRef[];
  propertyId: string;              // FK → PropertyRecord
  status: ClientOrderStatus;
  // SLA / pricing / contact
  dueDate: string;
  rushOrder: boolean;
  clientPONumber?: string;
  productOptions?: Record<string, unknown>;  // e.g. loanType, loanPurpose for parameterized composition
  // Lifecycle
  createdAt: string;
  createdBy: string;
  acceptedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  // Linkage
  vendorOrderIds: string[];        // populated as fan-out happens
  canonicalSnapshotId?: string;    // QC reproducibility
}

type ClientOrderStatus =
  | 'PENDING_CLIENT_REVIEW'
  | 'ACCEPTED'
  | 'IN_PROGRESS'           // ≥1 VendorOrder is active
  | 'AWAITING_DELIVERABLES'
  | 'COMPLETED'
  | 'CANCELLED';
```

**VendorOrder** (new).
```ts
interface VendorOrder {
  id: string;
  type: 'vendor-order';
  tenantId: string;
  clientOrderId: string;           // REQUIRED parent
  /** Atomic industry-standard product (Appraisal, AVM, BPO, Inspection, Review). */
  productId: string;
  /** The role this vendor-order plays inside the client-order (Primary,
   *  Supporting, QC). Comes from the composition spec. */
  role: VendorOrderRole;
  vendorId: string;                // FK → Vendor (kind: EXTERNAL or INTERNAL)
  status: VendorOrderStatus;
  // Scope / fee / SLA
  scope: VendorOrderScope;
  fee?: VendorFee;
  dueDate: string;
  instructions?: string;
  // Deliverables (accumulates as the vendor produces output)
  deliverables: VendorDeliverable[];
  // Lifecycle
  createdAt: string;
  acceptedAt?: string;             // when vendor accepted
  completedAt?: string;
  cancelledAt?: string;
  // Linkage
  parentClientOrderId: string;     // dup of clientOrderId for partition-safety
  canonicalSnapshotId?: string;    // optional per-vendor-order snapshot
}

type VendorOrderRole = 'PRIMARY' | 'SUPPORTING' | 'QC' | 'INSPECTION' | 'REVIEW';
type VendorOrderStatus =
  | 'PENDING_VENDOR_ACCEPT'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'              // vendor submitted; awaiting QC
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';
```

**Vendor** — already exists; add `kind` flag.
```ts
interface Vendor {
  id: string;
  tenantId: string;
  kind: 'EXTERNAL' | 'INTERNAL';   // NEW: staff = INTERNAL
  name: string;
  // ... existing fields ...
  staffUserId?: string;            // populated when kind=INTERNAL
}
```

**Product (catalog)** — new container.
```ts
interface Product {
  id: string;
  type: 'product';
  tenantId: string;                // null = platform-default
  clientId: string | null;         // null = platform-default; client-id = client override
  name: string;
  version: string;                 // semver-style
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';

  // Two independent flags
  clientFacing: boolean;           // can a ClientOrder reference it?
  vendorFulfillable: boolean;      // can a VendorOrder reference it?

  // Composition — empty/absent means atomic (no fan-out)
  composition?: {
    alwaysInclude?: AtomRef[];                       // static
    selectors?: SelectorRule[];                      // parameterized
    rules?: RuleBasedRule[];                         // rule-driven (slice 8e)
  };

  // Pricing (high-level — line-items live elsewhere)
  pricing?: ProductPricing;

  createdAt: string;
  createdBy: string;
}

interface AtomRef {
  productId: string;               // points to a vendorFulfillable product
  role: VendorOrderRole;
  optional?: boolean;
}

interface SelectorRule {
  /** Match against ClientOrder.productOptions (loanType, loanPurpose, etc.). */
  when: Record<string, unknown>;
  include: AtomRef[];
}

interface RuleBasedRule {
  /** Same path-based predicate vocabulary as review-program rules. */
  condition: ReviewFlagCondition;  // reuse existing type
  include: AtomRef[];
}
```

### 2.2 The composer

Core function called at ClientOrder creation:
```ts
composeOrder(product: Product, context: CanonicalReportDocument | null) → AtomRef[]
```

- **Static**: return `composition.alwaysInclude`.
- **Parameterized**: walk `composition.selectors`, match each `when` against
  `context.loan.loanPurposeType`, `context.subject.propertyType`, etc. Union
  matched `include` lists.
- **Rule-driven**: walk `composition.rules`, evaluate `condition` against
  context using the existing review-program rule evaluator. Union matched
  `include` lists.
- Final result: union + dedupe (by productId+role).

Returns the spec for fan-out. ClientOrder.resolvedComposition stores the
RESULT so reproducibility is preserved even if the catalog evolves.

---

## 3. Slice breakdown

Each slice is independently shippable (modulo dependency order). Tests +
typecheck pass at each slice; no breaking changes to running services.

| Slice | Branch | Scope | Size | Depends |
|---|---|---|---|---|
| **8b** | `feat/product-catalog` | Product entity + Cosmos container + composer (static + parameterized only) + seed of platform atoms | 3-5 d | – |
| **8c** | `feat/client-order-domain` | ClientOrder entity (new container or evolve existing); auto-fan-out runs composer; spawns VendorOrders | 3-5 d | 8b |
| **8d** | `feat/vendor-order-domain` | VendorOrder entity + Vendor.kind='INTERNAL'; assignment paths consume VendorOrder | 3-5 d | 8c |
| **8e** | `feat/composition-rules-engine` | Add rule-driven composition (`composition.rules[]`); reuse review-program rule evaluator | 2-3 d | 8b |
| **8f** | `feat/engagement-primacy` | Engagement is mandatory parent of every ClientOrder; cleanup orphan paths | 1-2 d | 8c |

**Total estimate:** 12–20 days of focused work. Not a single sprint.

### 8b — Product Catalog

**Ship:**
- `src/types/product.types.ts` with `Product`, `AtomRef`, `SelectorRule`, etc.
- `src/services/product-catalog.service.ts` with CRUD + `compose()` (static + parameterized only).
- New Cosmos container `products` (Bicep, partition `/tenantId`).
- Seed platform-default atoms via `src/scripts/seed/modules/products.ts`:
  - Industry-standard atoms: Appraisal-1004, Appraisal-1073-Condo, AVM, BPO,
    Inspection, QC-Review, Desktop-Review, Field-Review.
  - Platform packages: DVR (= [Appraisal-1004, AVM, Desktop-Review, QC-Review]),
    RapidVal (= [AVM, Inspection]).
- `src/scripts/seed/modules/products.test.ts` for catalog seeding.
- Unit tests for `compose()` covering static and parameterized.

**Out of scope:**
- Rule-driven composition (slice 8e).
- Client-authored products (clientId-tier write API; deferred — same pattern as review-programs).

**Not breaking:** existing AppraisalOrder + review-program flows unchanged.
The catalog is dormant infrastructure until 8c consumes it.

### 8c — ClientOrder Domain

**Ship:**
- `src/types/client-order.types.ts` with `ClientOrder` + status enum.
- New Cosmos container `client-orders` (Bicep). Partition `/tenantId`.
- `src/services/client-order.service.ts`:
  - `createClientOrder({engagementId, productId, productOptions, propertyId})`
  - At create time: load Product, load canonical context (PropertyRecord.currentCanonical),
    run composer, store `resolvedComposition`, spawn VendorOrder records.
  - State transitions, queries, etc.
- `src/controllers/client-order.controller.ts` with REST endpoints.
- Migration helper: a script that backfills new `ClientOrder` rows from existing
  `AppraisalOrder` rows. Existing `AppraisalOrder` rows STAY (read-only) for
  in-flight work; new orders go to ClientOrder.
- Tests for create + fan-out + state transitions.

**Not breaking:** AppraisalOrder controller / endpoints continue to exist.
ClientOrder is alongside, not replacing-yet.

### 8d — VendorOrder Domain

**Ship:**
- `src/types/vendor-order.types.ts` with `VendorOrder` + status enum.
- New Cosmos container `vendor-orders` (Bicep).
- `src/services/vendor-order.service.ts`:
  - `createVendorOrder` (called from ClientOrder fan-out).
  - Lifecycle: accept, decline, deliver, complete.
  - Vendor selection (manual + auto-assignment integration).
- `src/types/vendor.types.ts` extension: `kind: 'EXTERNAL' | 'INTERNAL'`,
  `staffUserId?: string`.
- Update existing assignment paths (`auto-assignment.controller`) to consume
  VendorOrder when triggered by a ClientOrder.
- Tests.

**Not breaking:** legacy AppraisalOrder vendor-assignment paths unchanged.

### 8e — Composition Rules Engine

**Ship:**
- Extend `Product.composition` with `rules: RuleBasedRule[]`.
- Reuse `tape-evaluation.service`'s rule evaluator. The composer now runs
  rules against the canonical context (subject.condition, loan.loanPurposeType, etc.).
- Catalog editor: clients (and platform admins) can author rule-based
  composition via REST.
- Tests covering: rule fires → atom included; rule misses → atom omitted;
  multiple rules union+dedup correctly.

**Not breaking:** existing static + parameterized compositions continue to work.

### 8f — Engagement Primacy

**Ship:**
- ClientOrder.engagementId required (was optional during 8c).
- Migrate any orphan ClientOrders / AppraisalOrders to a default
  "auto-created" engagement per client.
- Update controller-layer guards: any client-order create call without
  `engagementId` is rejected.
- Tests.

---

## 4. Migration strategy

**Two-track during transition:**

```
LEGACY TRACK                          NEW TRACK
─────────────────                     ──────────────────────────────
AppraisalOrder              alongside  ClientOrder + VendorOrder
(in-flight work continues)            (new orders use new shape)

Cleanup phase (after 8f):  migrate remaining in-flight AppraisalOrders →
                            ClientOrder/VendorOrder, then delete the
                            legacy controller + service, remove the type.
```

Cleanup is its own slice (`feat/appraisal-order-removal`), gated on:
- Zero open AppraisalOrders in production.
- All UI consumers reading ClientOrder.
- All workers (axiom-trigger, qc-execution, etc.) reading ClientOrder.

This keeps the migration low-risk: at no point is the system half-broken.

---

## 5. Open questions (need user input before 8b starts)

1. **Pricing — flat per-product or composition-derived?**
   When a DVR ClientOrder fans out to 4 VendorOrders, does the client pay
   the package price (flat) or sum of components (derived)? Most platforms
   do package price externally + line-item derivation internally. Confirm.

2. **Cosmos partition keys** —
   - `client-orders`: `/tenantId` (consistent with rest of platform). Cross-
     tenant queries are admin-only.
   - `vendor-orders`: `/tenantId` OR `/clientOrderId`? The latter co-locates
     a ClientOrder with all its VendorOrders for cheap reads, but fragments
     vendor-side queries ("show all VendorOrders for vendor X"). Vote:
     `/tenantId` for query flexibility; we accept the cross-partition cost
     for ClientOrder→VendorOrders fan-out (it's a small N, ~3-5).

3. **Vendor selection at fan-out time — automatic or deferred?**
   Two flavors:
   - "Spawn VendorOrder rows immediately with vendorId=null; assignment
     happens via auto-assignment service afterwards."
   - "Spawn VendorOrder rows already assigned via auto-assignment."
   The first is simpler and matches today's flow. Vote: do (1).

4. **Versioning of the composition result.**
   ClientOrder.resolvedComposition stores the result of `compose()` at order
   time. If the catalog updates the Product later, does an in-flight order
   get recomposed or stays frozen? Vote: stays frozen (legal/USPAP repro).
   Recompose only on explicit reorder.

5. **Engagement granularity — `PER_LOAN` vs `PER_BATCH`.**
   Existing `BulkIngestionEngagementGranularity` enum suggests we already
   distinguish these. Confirm: a single Engagement can hold ClientOrders
   from MULTIPLE properties (PER_BATCH) or is restricted to one property
   per engagement? Vote: multi-property; engagement is the relationship
   container.

6. **Product clientId tier semantics.**
   Same as review-programs / mop-criteria? `clientId: null` = platform-
   default, available to all clients; `clientId: <id>` = override for one
   client. Confirm.

---

## 6. What's NOT in this redesign (deferred)

- **Sub-products / nested packages.** A package containing a package
  (DVR-Plus = DVR + extra Inspection) — the composer can recurse, but the
  catalog UI gets complicated. Defer until we have a real demand.
- **Versioned vendor agreements.** Vendor.fee structure today is per-order;
  long-term we want negotiated fee schedules per vendor + product.
- **Marketplace-side scoring.** "Which vendor is best for this VendorOrder?"
  is the auto-assignment service's job — already exists in
  `auto-assignment.controller`.

---

## 7. Approval gate

**Before I start 8b:**
- [ ] Domain model in §2 confirmed
- [ ] Slice sequence in §3 confirmed (or reordered)
- [ ] Open questions in §5 answered
- [ ] Migration strategy in §4 confirmed

Once those are green, I'll branch `feat/product-catalog` and start
shipping 8b.
