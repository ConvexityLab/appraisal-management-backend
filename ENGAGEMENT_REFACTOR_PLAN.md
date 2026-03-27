# Domain Model Refactor: LenderEngagement + VendorOrder

**Status:** PLANNING — awaiting naming confirmation before any code changes  
**Scope:** `appraisal-management-backend` + `l1-valuation-platform-ui`  
**Classification:** Legitimate foundational refactor — not a workaround

---

## 1. The Problem (Root Cause Analysis)

`AppraisalOrder` is a [God Object](https://en.wikipedia.org/wiki/God_object) that straddles two
distinct bounded contexts with incompatible lifecycles:

| Concept | Owner | Lifecycle | Partition of concern |
|---|---|---|---|
| **Lender Engagement** | Account Manager / Client | Weeks — from intake to delivery | What did the lender hire us to produce? |
| **Vendor Order** | Operations / Dispatch | Days — from assignment to delivery | Who are we hiring to produce it? |

These two concepts share almost no behaviour. Conflating them causes:

- **Null field explosion** — `assignedVendorId` is null for the entire lender-facing lifecycle
- **Status ambiguity** — is `status: 'DELIVERED'` the vendor delivering to us, or us delivering to the lender?
- **`OrderType` is mislabelled** — `FULL_APPRAISAL | DRIVE_BY | DESKTOP | BPO | AVB` are ALL vendor fulfillment product types, not engagement categories
- **QC, ARV, RFB, RoV, Reports** all foreign-key to `orderId` — but conceptually they belong to the engagement, not the vendor order
- **One engagement can require multiple vendor orders** (e.g., a lender orders a Full Appraisal + AVM; we order from two different vendors) — today this is impossible to model

---

## 2. Target Domain Model

```
Engagement  (aggregate root — new Cosmos container: "engagements")
├── id: string                 (CUID)
├── engagementNumber: string   (human-readable: ENG-2025-001234)
├── tenantId: string           (partition key)
│
├── client: EngagementClient           ← what was ClientInformation
│     clientId, clientName, loanNumber, borrowerName,
│     borrowerEmail, loanOfficer, loanType
│
├── property: PropertyDetails          ← UNCHANGED shared type
│
├── products: EngagementProduct[]      ← what the lender ordered
│     { id, productType: ProductType, status, fee, instructions, dueDate }
│
├── status: EngagementStatus           ← engagement lifecycle (not vendor status)
├── priority: OrderPriority            ← reuse existing enum
├── receivedAt, clientDueDate, closedAt
├── totalEngagementFee: number         ← what we charge the lender (sum of products)
├── accessInstructions?, specialInstructions?
└── audit: Audit


VendorOrder  (renamed from AppraisalOrder — Cosmos container: "orders", UNCHANGED)
├── id: string
├── orderNumber: string                (existing field)
├── engagementId: string               ← NEW FK to Engagement
├── engagementProductId: string        ← NEW — which EngagementProduct this fulfills
├── fulfillmentType: FulfillmentType   ← renamed from orderType / OrderType
├── status: VendorOrderStatus          ← renamed from OrderStatus
│
├── assignedVendorId?: string
├── assignedAt?, acceptedAt?, deliveredAt?
├── vendorFee?: number
├── additionalFees: AdditionalFee[]
│
├── assignmentHistory: OrderAssignment[]
├── statusHistory: VendorOrderStatusUpdate[]
├── documents: OrderDocument[]
├── notifications: OrderNotification[]
└── tenantId: string                   (partition key — unchanged)
```

**Child records** — all gain `engagementId?: string` (optional now, required on all new writes):
- `arv-analyses` → already has `orderId`; gains `engagementId`
- `qc-reviews` → already has `orderId`; gains `engagementId`
- `rfb-requests` → already has `orderId`; gains `engagementId`
- `rov-requests` → already has `orderId`; gains `engagementId`
- `documents` → gains `engagementId`
- `reports` (reporting container) → gains `engagementId`

---

## 3. New Type Definitions

### 3.1 New file: `src/types/engagement.types.ts`

```typescript
// ── Product catalog (what lenders order from us) ──────────────────────────

export enum ProductType {
  FULL_APPRAISAL   = 'FULL_APPRAISAL',
  DRIVE_BY         = 'DRIVE_BY',
  DESKTOP_REVIEW   = 'DESKTOP_REVIEW',
  FIELD_REVIEW     = 'FIELD_REVIEW',
  DESK_REVIEW      = 'DESK_REVIEW',
  AVM              = 'AVM',
  BPO              = 'BPO',
  ARV              = 'ARV',
  EXTERIOR_ONLY    = 'EXTERIOR_ONLY',
  AVB              = 'AVB',
}

export enum EngagementStatus {
  RECEIVED         = 'RECEIVED',    // Lender submitted, awaiting acceptance
  ACCEPTED         = 'ACCEPTED',    // We accepted the engagement
  IN_PROGRESS      = 'IN_PROGRESS', // Vendor work underway
  QC               = 'QC',          // Report under internal QC
  REVISION         = 'REVISION',    // Revision requested
  DELIVERED        = 'DELIVERED',   // Delivered to lender
  CANCELLED        = 'CANCELLED',
  ON_HOLD          = 'ON_HOLD',
}

export interface EngagementClient {
  clientId: string;
  clientName: string;
  loanNumber: string;
  borrowerName: string;
  borrowerEmail?: string;
  loanOfficer?: string;
  loanType?: string;
  fhaCase?: string;
}

export interface EngagementProduct {
  id: string;                        // CUID within the engagement
  productType: ProductType;
  status: EngagementProductStatus;
  instructions?: string;
  fee?: number;                      // what we charge the lender for this product
  dueDate?: string;                  // ISO date
  vendorOrderIds: string[];          // 0-N VendorOrders that fulfill this product
}

export enum EngagementProductStatus {
  PENDING       = 'PENDING',
  ASSIGNED      = 'ASSIGNED',
  IN_PROGRESS   = 'IN_PROGRESS',
  DELIVERED     = 'DELIVERED',
  CANCELLED     = 'CANCELLED',
}

export interface Engagement {
  id: string;
  engagementNumber: string;
  tenantId: string;

  client: EngagementClient;
  property: PropertyDetails;         // imported from order-management.ts

  products: EngagementProduct[];

  status: EngagementStatus;
  priority: OrderPriority;           // reuse existing enum

  receivedAt: string;                // ISO datetime
  clientDueDate?: string;
  internalDueDate?: string;
  closedAt?: string;

  totalEngagementFee?: number;

  accessInstructions?: string;
  specialInstructions?: string;
  engagementInstructions?: string;

  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}
```

### 3.2 Additions to `src/types/order-management.ts`

```typescript
// Add at top — replaces the semantically-wrong use of OrderType as fulfillment type
export { OrderType as FulfillmentType };   // Phase 1: alias; Phase 5: rename

// Add to AppraisalOrder (Phase 3 additions)
export interface AppraisalOrder {
  // ... existing fields unchanged ...
  engagementId?: string;         // Phase 3: FK to Engagement — required on new orders
  engagementProductId?: string;  // Phase 3: FK to EngagementProduct
}
```

---

## 4. New API Routes

```
GET    /api/engagements                     List engagements (with search/filter)
POST   /api/engagements                     Create engagement
GET    /api/engagements/:id                 Get engagement
PUT    /api/engagements/:id                 Update engagement
PATCH  /api/engagements/:id/status          Change engagement status
DELETE /api/engagements/:id                 Soft-delete engagement

GET    /api/engagements/:id/vendor-orders   List vendor orders for this engagement
POST   /api/engagements/:id/vendor-orders   Create vendor order within engagement

GET    /api/engagements/:id/arv             ARV analyses for this engagement
GET    /api/engagements/:id/qc              QC reviews for this engagement
GET    /api/engagements/:id/documents       Documents for this engagement
GET    /api/engagements/:id/reports         Reports for this engagement
```

Existing `/api/orders` routes remain **unchanged** through all phases — they are not removed
until Phase 5, after QA confirms no traffic.

---

## 5. Phased Migration Plan

Each phase is independently deployable and passes all existing tests before the next begins.

---

### Phase 1 — New types only (zero runtime impact, zero DB changes)
**Duration estimate:** 1 day  
**Risk:** Zero — additive only

Files changed:
- `src/types/engagement.types.ts` — **NEW** — all engagement type definitions
- `src/types/order-management.ts` — add `FulfillmentType` export alias; add optional
  `engagementId?` and `engagementProductId?` to `AppraisalOrder`
- `src/types/index.ts` — re-export from `engagement.types.ts`

No backend logic changes. No frontend changes. Types compile, tests still pass.

---

### Phase 2 — New Cosmos container + bare CRUD (additive)
**Duration estimate:** 2 days  
**Risk:** Low — new container, new routes, nothing replaced

Files changed:
- `infrastructure/modules/cosmos-containers.bicep` — add `engagements` container,
  partition key `/tenantId`, indexes on `engagementNumber`, `client.clientId`,
  `property.zipCode`, `status`, `priority`
- `src/services/cosmos-db.service.ts` — add `engagementsContainer` member; add to
  `containers` config map; add `initialize()` wiring
- `src/services/engagement.service.ts` — **NEW** — `createEngagement`, `getEngagement`,
  `updateEngagement`, `listEngagements` (with filtering), `changeStatus`
- `src/controllers/engagement.controller.ts` — **NEW** — standard REST handlers
- `src/api-server.ts` — register `/api/engagements` router

Deliverable: `/api/engagements` is fully functional. ARV/QC/etc still use `orderId`.

---

### Phase 3 — FK wiring (backward-compatible additions)
**Duration estimate:** 2 days  
**Risk:** Low — all new fields are optional; existing records are unchanged

For every container that is engagement-scoped, add `engagementId?: string`:

| Container | Service | Change |
|---|---|---|
| `orders` | `order-management.service.ts` | `createOrder()` requires `engagementId` on new records |
| `arv-analyses` | `arv.service.ts` | `createAnalysis()` accepts+stores `engagementId` |
| `qc-reviews` | `qc.service.ts` | `createReview()` accepts+stores `engagementId` |
| `rfb-requests` | `rfb.service.ts` | `createRfbRequest()` accepts+stores `engagementId` |
| `rov-requests` | `rov.service.ts` | `createRovRequest()` accepts+stores `engagementId` |
| `documents` | `document.service.ts` | accepts+stores `engagementId` |

Also add sub-resource routes:
- `GET /api/engagements/:id/vendor-orders`
- `GET /api/engagements/:id/arv`
- `GET /api/engagements/:id/qc`
- `GET /api/engagements/:id/documents`

Deliverable: New orders always carry `engagementId`. Queries work via both `orderId` and `engagementId`.

---

### Phase 4 — Frontend: Engagement-first UI
**Duration estimate:** 1 week  
**Risk:** Medium — UI changes are visible to users

New UI routes in `l1-valuation-platform-ui`:
- `/engagements` — engagement list (replaces `/orders` as the primary list view)
- `/engagements/new` — create engagement + optional initial vendor order
- `/engagements/:id` — engagement detail (shows all products, their vendor orders, ARV, QC, docs)
- `/engagements/:id/orders/:orderId` — vendor order detail (reframes existing order page)

Updated existing pages:
- ARV page — shows engagement header; receives `engagementId`
- QC pages — engagement context in breadcrumb
- Reports — engagement context header
- Order detail — renamed/reframed as "Vendor Order"

New RTK Query endpoints:
- `engagementsApi` — CRUD against `/api/engagements`
- Update `arvApi`, `qcApi`, `reportsApi` to pass `engagementId`

Deliverable: Users can create and manage engagements. All work product is visible from the
engagement view. Old direct `/orders` route kept as redirect.

---

### Phase 5 — Cleanup and rename
**Duration estimate:** 2 days  
**Risk:** Low (all guarded by Phase 4 rollout)

Steps (each a separate commit):
1. **Data backfill script** — for every `AppraisalOrder` without `engagementId`:
   create a corresponding `Engagement` (1:1), set `engagementId` on the order, set
   `engagementProductId` to the single EngagementProduct inferred from `orderType`

2. **Rename `OrderType` → `FulfillmentType`** — update all 70+ controller + service
   references; keep `OrderType` as a deprecated re-export for one sprint

3. **Strip client/property from VendorOrder** — after confirming all consumers fetch
   from Engagement, remove `clientInformation` and raw `propertyDetails` from
   `AppraisalOrder`/`VendorOrder` (they now live only on Engagement)

4. **Rename `/api/orders` → `/api/vendor-orders`** — add `/api/orders` as a
   deprecated alias returning a `Deprecation` response header

5. **Remove deprecated aliases**

---

## 6. What Does NOT Change

These are unaffected by the refactor and should not be touched:
- `/api/construction/*` — separate bounded context (construction loans, draws, etc.)
- `/api/vendors`, `/api/vendor-*`, `/api/appraisers` — vendor infrastructure
- `/api/collaboration`, `/api/acs`, `/api/teams`, `/api/chat` — comms platform
- `/api/avm`, `/api/geospatial`, `/api/bridge-mls` — data services
- `/api/qc/checklists`, `/api/qc/rules` — configuration (not order-scoped)
- All Cosmos containers except where `engagementId` FK is added

---

## 7. Decisions Required Before Starting

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Root aggregate name | `Engagement` / `LenderEngagement` / `ValuationEngagement` / `ServiceRequest` | **`Engagement`** — shortest, standard AMC industry term |
| 2 | Vendor order name | `VendorOrder` / `Assignment` / `FulfillmentOrder` | **`VendorOrder`** — explicit directionality (we order FROM vendor) |
| 3 | `OrderType` replacement name | `FulfillmentType` / `VendorOrderType` / `ProcurementType` | **`FulfillmentType`** — describes what the vendor fulfills |
| 4 | Product enum name | `ProductType` / `EngagementProductType` / `ValuationProductType` | **`ProductType`** — short, lives in engagement context |
| 5 | `EngagementProduct[]` vs single product | Array (1 engagement can have AVM + Full Appraisal) vs always 1:1 | **Array** — models reality correctly; 1:1 is a special case |
| 6 | Phase 1 start timing | Now / after naming confirmed | Confirm naming decisions → start Phase 1 |

---

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| 70+ controllers reference `orderId` | Phased — `orderId` never removed before Phase 5; `engagementId` is additive |
| Cosmos container `orders` is renamed | It is NOT renamed — we add a new `engagements` container; `orders` stays |
| TypeScript strict-mode breaks on new fields | New fields are `?` optional until Phase 5 |
| Frontend routing conflicts | New `/engagements` routes are new paths; existing `/orders` routes kept as redirects |
| Data migration fails mid-run | Script is idempotent (checks `engagementId` before creating) |

---

## 9. File Impact Summary

### Backend — new files
- `src/types/engagement.types.ts`
- `src/services/engagement.service.ts`
- `src/controllers/engagement.controller.ts`
- `infrastructure/modules/engagements-container.bicep` (or add to existing cosmos Bicep)

### Backend — modified files (Phase 1-3)
- `src/types/order-management.ts` (+3 lines)
- `src/types/index.ts` (+1 re-export)
- `src/services/cosmos-db.service.ts` (+2 container wiring lines)
- `src/api-server.ts` (+1 router registration)
- `src/services/arv.service.ts` (+engagementId param)
- `src/services/qc.service.ts` (+engagementId param)
- `src/services/rfb.service.ts` (+engagementId param)
- `src/services/rov.service.ts` (+engagementId param)
- `src/services/document.service.ts` (+engagementId param)
- `src/services/order-management.service.ts` (+engagementId validation on create)

### Frontend — new files
- `src/app/(control-panel)/engagements/page.tsx`
- `src/app/(control-panel)/engagements/new/page.tsx`
- `src/app/(control-panel)/engagements/[id]/page.tsx`
- `src/services/engagements/engagementsApi.ts`

### Frontend — modified files
- `src/app/(control-panel)/arv/page.tsx` (+engagementId prop)
- `src/app/(control-panel)/orders/page.tsx` (redirect or reframe)
- `src/services/orders/ordersApi.ts` (+engagementId on create)

---

*This document is the single source of truth for the refactor.  
Update status headings as phases complete.*
