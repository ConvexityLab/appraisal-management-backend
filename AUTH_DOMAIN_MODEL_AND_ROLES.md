# Authorization Domain Model & Role Taxonomy

**Created:** 2026-05-06  
**Status:** Design / Pre-implementation — requires product sign-off before any auth code changes  
**Purpose:** Resolve conflations in the actor/resource/role model before Phase 3 (DB-backed policies) is built.  
**Companion:** `AUTH_PRODUCTION_READINESS_PLAN.md`

---

## The Core Problem in One Sentence

The current authorization model defines one user-facing role (`appraiser`) where four distinct portal actors exist, uses a single resource type (`order`) where the domain has two semantically different objects (`ClientOrder` ↔ `VendorOrder`), and has no vocabulary for the lender/client or the vendor firm as authenticated principals — making it impossible to write correct, auditable, per-client-configurable policies.

---

## Part 1 — What exists today and what is confused

### 1.1 The `appraiser` role conflation

The current canonical authorization role set is: `admin`, `manager`, `supervisor`, `analyst`, `appraiser`, `reviewer`.

The domain has these fulfillment-side principals:

| Domain Identity | Where stored | Who they are |
|---|---|---|
| External fee-panel appraiser | `vendors` container, `type='appraiser'` | Individual licensed appraiser contracted to an external firm; logs in via vendor portal |
| Internal staff appraiser | `vendors` container, `type='vendor'`, `staffType='internal'`, `staffRole='appraiser_internal'` | Our own employee doing appraisals; bypasses bid loop |
| Internal reviewer | same container, `staffRole='reviewer'` | Internal staff doing desk/field reviews |
| Internal supervisor | same container, `staffRole='supervisor'` | Supervisory appraiser overseeing internal team |
| External vendor firm coordinator | `vendors` container, `type='vendor'`, `staffType='external'` | The company (e.g. Premier Appraisal Group); may have a portal-login coordinator who manages orders **for the whole firm** |

All five are currently forced into the single `appraiser` role. They have different access needs:

- An **external appraiser** should see only VendorOrders assigned to them (`assignedUserIds CONTAINS userId`).
- An **internal appraiser** should see VendorOrders assigned to them but may also have visibility into more internal workflow steps (e.g. can see the QC checklist before submission).
- A **vendor coordinator** (firm-level) should see ALL VendorOrders where `accessControl.vendorId = their vendorId` — they manage their whole firm's queue.
- An **internal supervisor** should see all VendorOrders in their team/supervisory scope.
- An **internal reviewer** acts more like an `analyst` than an appraiser — they review work before the external QC step.

### 1.2 The `order` resource type conflation

The domain has a clear 4-level hierarchy:

```
Engagement                         ← lender engages us for a loan pool
  └── EngagementLoan               ← one loan in the pool
        └── ClientOrder            ← what the lender ordered (e.g. "Full 1004")
              └── VendorOrder      ← the work dispatched to a vendor/appraiser to fulfill it
```

The current auth types have `order`, `client_order`, and `vendor_order` as `ResourceType` strings — but the Casbin policy, `buildQueryFilter()`, and all middleware calls use only `'order'`. The `client_order` and `vendor_order` types exist in the type declaration but have zero policy rules.

This is critical because:

- **A ClientOrder contains lender/borrower PII, pricing, and loan data.** Vendors and appraisers must **never** see the full ClientOrder.
- **A VendorOrder contains work instructions, assignment status, and the appraiser's submitted report.** Lenders must **never** see a VendorOrder directly — they see the output (the final report) via the ClientOrder.
- **A manager sees both.** But the policies need to be written against the right resource type.

### 1.3 Missing principals entirely

| Principal | Currently in model? | Notes |
|---|---|---|
| Lender / Client portal user | ❌ No | Lenders could log in to see their Engagements and ClientOrders |
| Vendor firm coordinator | ❌ No | Folded (wrongly) into `appraiser` role |
| Platform support admin | ❌ No | Cross-tenant support staff — see Phase 6.5 in plan |

### 1.4 `OrderType` naming overload

There are currently **three different things** called "order type":

| Symbol | Location | Meaning |
|---|---|---|
| `OrderType` (enum in `order-management.ts`) | `FULL_APPRAISAL`, `DRIVE_BY`, ... | Actually a **product type**, deprecated alias for `ProductType` |
| `OrderType` (union in `API_CONTRACT.md`) | `'purchase'`, `'refinance'`, ... | **Loan transaction type** (purchase vs refi) — completely different concept |
| `type` discriminator on Cosmos doc | `'order'`, `'vendor-order'`, `'client-order'` | Cosmos document **kind tag** — used to tell apart the shapes |

The loan transaction type (`purchase`, `refinance`, etc.) lives on `Order.orderType` but the name `OrderType` in `order-management.ts` was hijacked to mean product type (now deprecated). This creates confusion when writing access control policies that need to filter by loan-transaction type because the field name is shared.

---

## Part 2 — Proposed clean actor taxonomy

Each "actor group" corresponds to a portal persona and a `UserProfile.role` value.

### Platform-side actors (our staff)

| Role | Current name | Description | Suggested DB-backed label |
|---|---|---|---|
| `admin` | `admin` | Full tenant access — all resources, all actions. Configures the platform. | `admin` (keep) |
| `operations_manager` | `manager` | Manages order flow for their client/team portfolio. Creates orders, assigns vendors, views analytics. | `manager` (keep) |
| `analyst` | `analyst` (`qc_analyst` is accepted only as a legacy alias at old boundaries) | Reviews submitted appraisal reports. Approve/fail/escalate. Cannot modify orders or vendor data. | `analyst` |
| `supervisor` | *(missing)* | Supervisory appraiser overseeing internal staff. Can view internal staff workloads, reassign internal orders. | `supervisor` *(new)* |

### Fulfillment-side actors (vendor/appraiser portal)

| Role | Current name | Description | Suggested DB-backed label |
|---|---|---|---|
| `vendor_coordinator` | *(folded into `appraiser`)* | A coordinator at a vendor firm who manages ALL of their firm's VendorOrders. Scoped by `vendorId`. | `vendor_coordinator` *(new)* |
| `appraiser` | `appraiser` | Individual appraiser. Sees only their assigned VendorOrders. Cannot see other appraisers' work. | `appraiser` *(keep, narrowed)* |
| `appraiser_internal` | *(folded into `appraiser`)* | Internal staff appraiser. Same as `appraiser` for access but has additional internal workflow visibility. | `appraiser_internal` *(new)* |

### Client-side actors (lender/AMC portal) — future, optional

| Role | Current name | Description | Suggested DB-backed label |
|---|---|---|---|
| `client_admin` | *(missing)* | Lender admin. Sees all their Engagements and ClientOrders. Cannot see VendorOrders or internal data. | `client_admin` *(new, future)* |
| `client_user` | *(missing)* | Lender portal user with read-only access to their specific ClientOrders. | `client_user` *(new, future)* |

### Role hierarchy (inherits all listed child permissions)

```
admin
  └── manager / operations_manager
        └── supervisor
              ├── analyst
              └── appraiser_internal

vendor_coordinator     ← not in the platform hierarchy; separate vendor hierarchy
  └── appraiser

client_admin           ← separate client hierarchy; does NOT inherit platform roles
  └── client_user
```

**Key constraint:** `appraiser` (vendor-side) must NOT inherit any platform-side role. They are in a separate trust domain. Similarly, `client_admin` is in a separate trust domain from platform staff.

---

## Part 3 — Resource taxonomy and who can see what

### 3.1 Resource types and their owners

| ResourceType | Cosmos container | Primary owner | Contains |
|---|---|---|---|
| `engagement` | `engagements` | Platform (created on behalf of lender) | Lender-facing, loan-level metadata |
| `client_order` | `client-orders` | Platform / lender | What the lender ordered. Contains: productType, fee, lender-side status. **No vendor data.** |
| `vendor_order` | `orders` (discriminator `type='vendor-order'`) | Platform / assigned vendor | Work dispatched to vendor. Contains: assignment, work status, report upload, appraiser notes. **No loan PII beyond property address.** |
| `qc_review` | `qc-reviews` | Platform QC team | QC checklist evaluation of a VendorOrder's report |
| `revision` | `revisions` | Platform | Revision request against a VendorOrder |
| `escalation` | `escalations` | Platform | Escalated QC case |
| `vendor` | `vendors` | Platform | Vendor profile, license, service area |
| `appraiser` | `vendors` (type='appraiser') | Platform | Individual appraiser profile — different read rules than vendor firm |
| `document` | `documents` | Platform | Attachments associated with a order/engagement |
| `analytics` | derived | Platform | Aggregated performance data |
| `user` | `users` | Platform admin | UserProfile |
| `client` | `clients` | Platform | Client (lender/AMC) record |

### 3.2 Who can read what (access policy matrix)

> ✓ = allowed  ✗ = denied  ⊘ = only own/scoped

| Resource | admin | manager | analyst | supervisor | appraiser_internal | appraiser | vendor_coordinator |
|---|---|---|---|---|---|---|---|
| `engagement` | ✓ all | ✓ scoped to their clients | ✗ | ✓ scoped | ✗ | ✗ | ✗ |
| `client_order` | ✓ all | ✓ scoped to their clients | ✗ | ✗ | ✗ | ✗ | ✗ |
| `vendor_order` | ✓ all | ✓ scoped to their clients/teams | ✓ assigned only | ✓ team scope | ✓ assigned only | ✓ assigned only | ✓ vendor firm scope |
| `qc_review` | ✓ all | ✓ scoped | ✓ assigned | ✓ scoped | ✗ read-only own | ✗ | ✗ |
| `revision` | ✓ all | ✓ scoped | ✓ own | ✓ scoped | ⊘ own | ⊘ own | ✗ |
| `vendor` | ✓ all | ✓ managed vendors | ✗ | ✓ own team | ✗ | ✗ | ⊘ own firm only |
| `appraiser` | ✓ all | ✓ managed | ✗ | ✓ own team | ⊘ own profile | ⊘ own profile | ✓ own firm appraisers |
| `document` | ✓ all | ✓ scoped | ✓ related order | ✓ scoped | ⊘ own orders | ⊘ own orders | ⊘ own firm orders |
| `analytics` | ✓ all | ✓ own scope | ✗ | ✓ own scope | ✗ | ✗ | ✗ |
| `user` | ✓ all | ✓ read own team | ✗ own profile | ✓ own team | ✗ own profile | ✗ own profile | ✗ own profile |
| `client` | ✓ all | ✓ managed clients | ✗ | ✗ | ✗ | ✗ | ✗ |

### 3.3 Write/mutation actions (critical rules)

| Action | Who is allowed |
|---|---|
| Create `engagement` | `admin`, `manager` |
| Create `client_order` | `admin`, `manager` |
| Create `vendor_order` (decomposition) | `admin`, `manager`, system (auto-assignment) |
| Upload report on `vendor_order` | `appraiser`, `appraiser_internal`, `vendor_coordinator` (for firm orders) |
| Update status on `vendor_order` | `appraiser`, `appraiser_internal`, `vendor_coordinator` (accept, start, deliver) |
| Create `qc_review` | `analyst`, `admin` |
| Approve/reject `qc_review` | `analyst`, `admin` |
| Request revision on `vendor_order` | `analyst`, `manager`, `admin` |
| Reassign `vendor_order` to different vendor | `manager`, `admin` |
| Assign `vendor_order` to appraiser (within firm) | `vendor_coordinator`, `manager`, `admin` |
| Create `vendor` profile | `admin` |
| Update `vendor` profile | `admin`, `manager` (limited fields), `vendor_coordinator` (own profile limited fields) |

---

## Part 4 — AccessControl fields remapped to principals

The `AccessControl` block on every document needs to carry enough metadata to evaluate all of the above rules without joining to other containers:

```typescript
interface AccessControl {
  // ── Who created / owns it ─────────────────────────────────────────────────
  ownerId: string;            // UserId of the creating user (internal staff)
  ownerEmail?: string;

  // ── Who is working on it (fulfillment side) ─────────────────────────────
  assignedUserIds: string[];  // Appraiser(s) assigned to this VendorOrder
  vendorId?: string;          // The vendor firm (NEW: needs to be stamped on VendorOrders)
  appraiserId?: string;       // The specific assigned appraiser (subset of assignedUserIds)

  // ── Platform organizational scope ────────────────────────────────────────
  teamId?: string;            // Manager's team that owns this order
  departmentId?: string;

  // ── Business relationship scope ──────────────────────────────────────────
  clientId: string;           // REQUIRED: the lender/AMC who placed the order
  engagementId?: string;      // FK to Engagement (used for manager → client_order scoping)
  clientOrderId?: string;     // FK to ClientOrder (on VendorOrder only)

  // ── Visibility ────────────────────────────────────────────────────────────
  visibilityScope: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'ASSIGNED_ONLY';

  // ── Multi-tenancy ─────────────────────────────────────────────────────────
  tenantId: string;
}
```

**What's currently missing that policies need:**
- `vendorId` is defined in the schema but the `buildQueryFilter()` for `vendor_coordinator` role doesn't exist — there is no `vendor_coordinator` role yet. Once created, its query filter needs `c.accessControl.vendorId = @vendorId`.
- `clientId` is optional on `AccessControl` today — it needs to be **required** on `VendorOrder` and `ClientOrder` documents since multiple manager/client scoping rules depend on it.

---

## Part 5 — Per-client configurability

The user question was: **can roles be configured per client (lender)?**

There are two distinct asks here that must not be conflated:

### 5A — Per-tenant platform configuration (operator-level)

An **operator** running this platform for multiple lenders/AMCs in a single tenant can configure:
- Which roles exist in their instance (e.g., some operators don't use `vendor_coordinator`)
- What `AccessScope` attributes are applicable (e.g., whether `statesCovered` filtering is enforced)
- Custom workflow steps and statuses

This is addressed by Phase 3 (DB-backed policy rules per `tenantId`). Each tenant gets their own policy rows. ✓ Already planned.

### 5B — Per-client (lender-specific) portal and scoping rules

A specific **lender** using the portal may want:
- Their own uploaded appraisers/panels restricted to only their orders
- Their `client_admin` user can only see Engagements where `clientId = their lenderId`
- Custom data visibility rules (e.g., "this lender doesn't want to see internal reviewer notes")

This is achieved through:
1. The `clientId` field in `AccessControl` (already exists) — `client_admin` users have `accessScope.boundClientId = their lenderId` and all queries append `AND c.accessControl.clientId = @boundClientId`
2. **Client-specific access scope expansion:** `AccessScope` gets a new field `boundClientId?: string` — set at provisioning time, immutable, enforced on every query. This cannot be self-modified by the user.
3. **client portal policy rules** in Phase 3's policy schema: `role: 'client_admin', resourceType: 'client_order', condition: [{ attribute: 'accessControl.clientId', operator: 'eq', value: '@user.boundClientId' }]`

### 5C — What is NOT configurable per-client and why

The following must be **platform-wide constants** (not per-client):
- Which roles can create VendorOrders — if a client could change this, they could escalate their own privileges
- Whether QC is required — operators define this; clients cannot bypass it
- Which fields are visible per role (field-level auth) — clients cannot expand what their users see beyond what the platform allows

---

## Part 6 — The `OrderType` vs `ProductType` vs `LoanType` cleanup

Before writing any policy rules, the following naming must be resolved so policy descriptions are unambiguous:

| Concept | Correct name | Current state |
|---|---|---|
| What kind of loan transaction this is | `LoanTransactionType`: `purchase`, `refinance`, `equity_line`, `construction` | Called `OrderType` in `index.ts` — confusing, should rename |
| What kind of work product was ordered | `ProductType`: `FULL_APPRAISAL`, `DRIVE_BY`, `BPO`, etc. | Correct name, file `product-catalog.ts`. Old `OrderType` in `order-management.ts` is deprecated alias. |
| What kind of document is in Cosmos | type discriminator: `'order'`, `'vendor-order'`, `'client-order'`, `'engagement'` | Correct. Managed migration in progress (Phase 4 of engagement refactor). |

**Authorization policies care about `ProductType`** (e.g., only `appraiser` with `FULL_APPRAISAL` eligibility should be assigned to a `FULL_APPRAISAL` VendorOrder). They do **not** care about `LoanTransactionType` for access control (though compliance rules care about it).

---

## Part 7 — Open questions requiring product decision

These must be answered before building the DB-backed policy schema.

| # | Question | Why it matters for auth |
|---|----------|------------------------|
| P1 | **Does a vendor firm coordinator role exist?** Is there a "vendor company admin" who logs in and manages all orders for their firm, or does each appraiser manage their own orders independently? | Determines whether `vendor_coordinator` role needs to be built or whether only individual appraiser-scoped access is needed. |
| P2 | **Do lenders get portal access now, or is that a future phase?** | Determines whether we model `client_admin` / `client_user` now or leave `clientId` scoping as a future concern. |
| P3 | **What distinguishes `appraiser_internal` from `appraiser` for access purposes?** (Same VendorOrder scope, or do internal staff see more?) | Determines if `appraiser_internal` is a separate role or just `appraiser` with an `isInternal: true` attribute. |
| P4 | **Can a `vendor_coordinator` create a VendorOrder themselves (for corrections/re-orders), or only view/update existing ones?** | Determines write-side policy for `vendor_coordinator`. |
| P5 | **Can an `analyst` see a ClientOrder?** (They need to know the lender's instructions, fee, and due date for the QC report, but these are on the ClientOrder). | Determines whether `analyst` needs read access to `client_order` scoped to their assigned VendorOrder. |
| P6 | **What fields on a VendorOrder can an appraiser modify vs read-only?** (E.g., can an appraiser update the status to `IN_PROGRESS`, or does the system do that? Can they update the due date?) | Determines the action scope for `appraiser` on `vendor_order`. |
| P7 | **Per-tenant vs per-client policy config:** Is there a use case where two different lenders using the same tenant need different scoping rules? Or is tenant-level always sufficient? | If yes, `boundClientId` on AccessScope is needed. If no, tenant-level policies suffice. |
| P8 | **Should `supervisor` be a platform-side role or a vendor-side role?** Today `staffRole='supervisor'` is stored in the vendors container (internal staff), but a supervisor might also be an operations manager. | Determines whether supervisor is in the platform hierarchy (inherits from `manager`) or the fulfillment hierarchy. |

---

## Part 8 — Recommended sequence for implementation

Given the above, the implementation order in `AUTH_PRODUCTION_READINESS_PLAN.md` should be adjusted:

1. **Get answers to P1–P8** (above) from product/stakeholders — 1 week.
2. **Rename `OrderType` (loan transaction) → `LoanTransactionType`** in backend types so policy rule descriptions are unambiguous. This is a pure rename with no runtime impact since it's just a TypeScript type alias. Move this before Phase 3 schema design.
3. **Phase 1 (bulk stamping)** — fix today; does not depend on role taxonomy resolution. `accessControl.clientId`, `vendorId`, `ownerId`, `teamId` should all be stamped now with best-available data.
4. **Phase 2 (enforcement hardening)** — independent of role taxonomy.
5. **Phase 3 (DB-backed policies)** — but now with the correct role set and resource types from this document.
6. **`vendor_coordinator` role** if P1 is yes — add after Phase 3 scaffolding is in place.
7. **`client_admin` / `client_user`** if P2 is yes — add as a separate sprint after the platform-side model is stable.

---

## Appendix: Cosmos container ↔ ResourceType mapping

| Cosmos container | `ResourceType` in auth | type discriminator on doc |
|---|---|---|
| `engagements` | `engagement` | `type='engagement'` |
| `client-orders` | `client_order` | `type='client-order'` |
| `orders` | `vendor_order` | `type='vendor-order'` (migration ongoing) |
| `vendors` | `vendor` or `appraiser` | `type='vendor'` or `type='appraiser'` |
| `qc-reviews` | `qc_review` | — |
| `revisions` | `revision` | — |
| `escalations` | `escalation` | — |
| `documents` | `document` | — |
| `users` | `user` | — |
| `clients` | `client` | — |

Note: `orders` container uses the same partition key `/tenantId` for both legacy `'order'` docs and new `'vendor-order'` docs. Until Phase 4 migration completes, query filters must use `WHERE c.type = 'vendor-order' OR c.type = 'order'` (the `VENDOR_ORDER_TYPE_PREDICATE` constant in `vendor-order.types.ts` already handles this).
