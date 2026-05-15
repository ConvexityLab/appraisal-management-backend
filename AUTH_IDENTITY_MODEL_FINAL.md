# Authorization Identity Model — Final Design

**Created:** 2026-05-06  
**Status:** Design COMPLETE — all open items resolved (O1–O4). Ready for TypeScript implementation.  
**Incorporates:** Product answers P1–P8 and open-item resolutions O1–O4

---

## The Core Insight (read this first)

P8 forced the right question: *is "VendorSupervisor" a role, or is it "Supervisor in the Vendor domain?"*

The answer has major consequences. If we enumerate them as separate role strings (`vendor_supervisor`, `platform_supervisor`, `client_supervisor`), adding a new capability requires code changes. If we model them as a **role × domain** pair, adding a new capability is a policy row.

**The model we are building:**

```
identity = role + portalDomain + attributes
```

Where:
- **`role`** = the capability category ("what kinds of things can you do")
- **`portalDomain`** = the trust boundary ("in which world do you operate")  
- **`attributes`** = data-scope qualifiers ("which specific records do you own/manage")

The policy engine evaluates all three together. A rule is:
> "A user with `role=R` in `domain=D` with attribute `X` can perform `action` on `resourceType` where `condition` is true."

---

## Part 1 — The Role Set (small, stable, domain-independent)

Roles are **capability categories** — they describe what kind of work a person does, not which organization they belong to.  The domain (below) determines which resources that work applies to.

| Role | Core capability | Notes |
|---|---|---|
| `admin` | Full platform configuration; all resources, all actions | Platform domain only |
| `manager` | Manage workflow state, assignments, and order intake. Also the role for lender read-only users — policy rules (not a separate role) limit them to read actions. | All three domains (see below) |
| `supervisor` | Oversight of people + workload in their scope | All three domains |
| `analyst` | Review work products, approve or request changes | Platform domain primarily; also applied to hired desk/field review firms (vendor domain) |
| `appraiser` | Perform valuation work on assigned orders | Vendor domain; `isInternal` attribute distinguishes internal staff from external panel |
| `reviewer` | Desk/field review of a vendor's submitted work — hired by the platform, not the lender. E.g., a firm engaged to perform a desktop review of another vendor's appraisal. | Vendor domain (can be internal or external reviewer firm) |

**Why this set is correct:**
- "QC Analyst" → `analyst` — the "QC" is the resource type they analyze, not a separate role
- "Vendor Coordinator" → `manager` in vendor domain — same capability (manage workflow), different world
- "Lender Admin" → `manager` in client domain, policy actions = [read, create, update]
- "Lender Read-Only User" → `manager` in client domain, policy actions = [read] only — no new role needed
- "Internal Supervisor" → `supervisor` + `isInternal: true`
- "Reviewer" = a hired review firm, NOT a lender employee. A lender requests an appraisal + desktop review of it; the review firm is the `reviewer`, engaged by the platform.
- No new roles are needed for current requirements

**What is NOT a role:**
- `appraiser_internal` — this is `appraiser` with `isInternal: true` attribute
- `vendor_supervisor` — this is `supervisor` with `portalDomain: 'vendor'`
- `client_admin` / `client_viewer` — both are `manager` in `client` domain; different policy action sets

---

## Part 2 — Portal Domain (the trust boundary)

`portalDomain` determines which containers and resource types a user's policies are evaluated against. It is set at account provisioning time and is **immutable** by the user.

| Domain | Who lives here | Primary resources visible | Trust level |
|---|---|---|---|
| `platform` | Our internal staff (ops managers, QC, supervisors) | All resource types within their data scope | Highest — can cross client/vendor boundaries per policy |
| `vendor` | Vendor company staff, individual appraisers, hired reviewer firms, internal staff | `vendor_order` (their firm's or assigned-to-them), `appraiser` (their firm's), `document` (their orders) | Medium — external: `boundEntityIds ∋ vendorId`; internal: `isInternal + teamIds` |
| `client` | Lender/AMC staff (admin and read-only) | `engagement`, `client_order`, `document` (final reports only) | Medium — scoped to `boundEntityIds ∋ clientId` |

**Critical isolation rules:**
1. A `vendor` domain user can NEVER see `client_order` fields — no fee, no lender contact, no loan data.
2. A `client` domain user can NEVER see `vendor_order` directly — they see the final report delivered through the `client_order`.
3. A `client` domain user can NEVER see vendor identity — they see work status from the `client_order` status, not which firm/appraiser handled it.
4. Cross-domain actions (e.g., platform manager reassigns a VendorOrder to a different vendor) remain in the `platform` domain — the vendor domain user is not the actor.

---

## Part 3 — The `boundEntityIds` + Scoping Attributes

`boundEntityIds` is the primary scope anchor for external non-platform domain users. It is an **array** because a single appraiser or staff member may be affiliated with more than one firm (O2 — confirmed use case).

| Domain | `boundEntityIds` meaning | Example Cosmos condition |
|---|---|---|
| `platform` | `[]` — no entity binding; scope via `accessScope` | `c.accessControl.clientId IN @managedClientIds` |
| `vendor` (external) | The vendor firm ID(s) this person works for | `ARRAY_CONTAINS(@boundEntityIds, c.accessControl.vendorId)` |
| `vendor` (internal, `isInternal: true`) | `[]` — internal staff do NOT bind to a vendor firm; access governed by `isInternal + accessScope.teamIds` | `ARRAY_CONTAINS(c.accessControl.assignedUserIds, @userId)` |
| `client` | The lender/AMC ID(s) this person belongs to | `ARRAY_CONTAINS(@boundEntityIds, c.accessControl.clientId)` |

For platform domain users, scope is driven by `accessScope` (teamIds, managedClientIds, statesCovered, etc.) as designed today.

For external vendor/client domain users, `boundEntityIds` is the primary filter. `accessScope` can add further narrowing (e.g., a vendor supervisor might have `accessScope.managedUserIds` scoped to their sub-team within the firm).

**O2 resolved:** `boundEntityIds: string[]` replaces the earlier `boundEntityId?: string` scalar. The `bound_entity_in` policy operator checks `docField IN user.boundEntityIds`.

**O4 resolved:** Internal staff (`isInternal: true`) have `boundEntityIds: []`. Their VendorOrder access is governed entirely by `isInternal + accessScope.teamIds + assignedUserIds`. They are stored in the `vendors` Cosmos container for operational reasons but are NOT bound to any vendor firm for authorization policy evaluation. Setting `boundEntityIds: []` for internal staff is intentional and required — the `bound_entity_in` operator must never match for them.

**Answer to P7 (client-level scoping is the primary case):** Confirmed. The `boundEntityIds` mechanism makes client-level scoping the default for all external `client` and `vendor` domain users. Platform-domain users use `managedClientIds[]` in their `accessScope`.

---

## Part 4 — Updated `UserProfile` shape

```typescript
/**
 * The trust principal loaded from Cosmos `users` container on every authenticated request.
 * Loaded by AuthorizationMiddleware.loadUserProfile() and attached to req.userProfile.
 *
 * `role` + `portalDomain` together determine which policy rules apply.
 * `boundEntityId` pins vendor/client domain users to their organization.
 * `accessScope` provides data-level scope within the policy.
 * `isInternal` is a convenience attribute for appraiser/reviewer roles.
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  azureAdObjectId?: string;
  tenantId: string;

  // ── Identity axes ─────────────────────────────────────────────────────────

  /** Capability category. Small stable set: admin | manager | supervisor | analyst | appraiser | reviewer */
  role: Role;

  /**
   * Trust boundary. Determines which resource containers are visible and which
   * policy rules apply. Set at provisioning; immutable by user.
   *   'platform' — internal staff
   *   'vendor'   — vendor company staff / individual appraisers
   *   'client'   — lender / AMC staff
   */
  portalDomain: PortalDomain;

  /**
   * Organization binding for non-platform, non-internal domain users.
   * Array because a single appraiser may be affiliated with multiple vendor firms (O2).
   *
   *   vendor domain, external  → vendorId(s) of the firm(s) this user works for
   *   client domain            → clientId(s) of the lender(s) this user belongs to
   *   platform domain          → [] (scope via accessScope.managedClientIds instead)
   *   vendor domain, internal  → [] (internal staff: scope via isInternal + teamIds, not a firm ID)
   */
  boundEntityIds: string[];

  /**
   * For appraiser and reviewer roles: true = internal staff (bypasses bid loop;
   * has additional internal workflow visibility per policy).
   * false / absent = external fee-panel contractor.
   */
  isInternal?: boolean;

  // ── Data scope within the domain ─────────────────────────────────────────
  accessScope: AccessScope;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Role = 'admin' | 'manager' | 'supervisor' | 'analyst' | 'appraiser' | 'reviewer';

export type PortalDomain = 'platform' | 'vendor' | 'client';
```

---

## Part 5 — Who maps to what (concrete examples)

| Person | role | portalDomain | boundEntityIds | isInternal | accessScope notes |
|---|---|---|---|---|---|
| Platform operations manager | `manager` | `platform` | `[]` | — | `managedClientIds: ['first-horizon', 'clearpath']`, `teamIds: ['team-east']` |
| Platform admin | `admin` | `platform` | `[]` | — | No restrictions needed |
| QC analyst | `analyst` | `platform` | `[]` | — | `teamIds` if QC is team-organized |
| Platform supervisor | `supervisor` | `platform` | `[]` | — | Sees internal staff workloads across `accessScope.teamIds` |
| Internal staff appraiser (Sarah Chen) | `appraiser` | `vendor` | `[]` | `true` | `isInternal` unlocks full-read policy; scoped to assigned orders |
| Internal reviewer (James Okonkwo) | `reviewer` | `vendor` | `[]` | `true` | Hired by platform; reviews another vendor's submitted work; assigned orders only |
| Internal supervisor (Diana Morales) | `supervisor` | `vendor` | `[]` | `true` | Sees all VendorOrders in `accessScope.teamIds` |
| External appraiser (one firm) | `appraiser` | `vendor` | `[VENDOR_IDS.PREMIER]` | `false` | Only their assigned VendorOrders |
| External appraiser (two firms) | `appraiser` | `vendor` | `[VENDOR_IDS.PREMIER, VENDOR_IDS.TX_PROP]` | `false` | Assigned VendorOrders from either firm |
| Vendor coordinator (Premier) | `manager` | `vendor` | `[VENDOR_IDS.PREMIER]` | `false` | VendorOrders where `accessControl.vendorId IN boundEntityIds` |
| Vendor supervisor (Premier) | `supervisor` | `vendor` | `[VENDOR_IDS.PREMIER]` | `false` | Same + can reassign appraisers within firm |
| Hired reviewer firm (desktop review) | `reviewer` | `vendor` | `[VENDOR_IDS.REVIEW_CO]` | `false` | Assigned review-type VendorOrders only |
| Lender admin (First Horizon) | `manager` | `client` | `[CLIENT_IDS.FIRST_HORIZON]` | — | policy actions: read+create+update; Engagements + ClientOrders |
| Lender read-only (First Horizon) | `manager` | `client` | `[CLIENT_IDS.FIRST_HORIZON]` | — | **Same role** as lender admin; a per-tenant policy override restricts actions to read only |

---

## Part 6 — Policy rule schema (the type `PolicyRule`)

Policies are the engine. A policy rule maps `(role + domain + conditions) → effect on (resource + action + optionally: field subset)`.

```typescript
/**
 * A single evaluable policy rule stored in the `authorization-policies` Cosmos container.
 *
 * The evaluator:
 *   1. Selects rules where (role, portalDomain, resourceType, actions) match the caller.
 *   2. Evaluates each condition against the calling UserProfile and the resource's AccessControl.
 *   3. Applies effect: rules with 'deny' short-circuit regardless of priority.
 *   4. For 'allow': generates a Cosmos query filter clause from the conditions.
 *   5. For field-level reads: intersects allowedFields across all matching allow rules.
 *   6. For field-level writes: intersects writableFields across all matching allow rules.
 *
 * Design principle: rules express WHAT DATA satisfies access, not which code path.
 * Adding a new capability = adding a rule row. Zero code changes.
 */
export interface PolicyRule {
  id: string;
  tenantId: string;   // '*' = platform-wide default; specific tenantId overrides it

  // ── Who this rule applies to ──────────────────────────────────────────────
  role: Role | '*';                    // '*' = any role (use sparingly)
  portalDomain: PortalDomain | '*';
  isInternal?: boolean;               // undefined = applies to both internal and external

  // ── What resource + action ────────────────────────────────────────────────
  resourceType: ResourceType | '*';
  actions: (Action | '*')[];

  // ── Conditions (all must be satisfied = AND; use multiple rules for OR) ───
  conditions: PolicyCondition[];

  // ── Effect ────────────────────────────────────────────────────────────────
  effect: 'allow' | 'deny';
  priority: number;   // higher wins on conflict within same effect; deny always beats allow

  // ── Optional field projection (only for 'allow' rules) ───────────────────
  /**
   * When present, the caller may only READ these top-level field names on
   * matched resources. Absent or empty = all fields readable.
   *
   * IMPORTANT: This is enforced by the response projection layer, NOT the
   * Cosmos query. The query returns full documents; projection strips fields
   * before the HTTP response is sent.
   *
   * Absence of allowedFields on a rule = "all fields" (not "no fields").
   * To restrict fields, you must set an explicit list.
   */
  allowedFields?: string[];

  /**
   * When present, the caller may only WRITE (create/update) these top-level
   * field names. Absent or empty = all writable fields per resource schema.
   *
   * Specific writable fields for appraiser on vendor_order (P6):
   *   propertyData, criteriaResults, evaluationData, bidResponse
   * (fees, slaDeadline, tenantId, clientId, accessControl — never writable by appraiser)
   */
  writableFields?: string[];

  // ── Metadata ──────────────────────────────────────────────────────────────
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * A single condition within a policy rule.
 *
 * Operators:
 *   'eq'           — document field equals a static value or user attribute
 *   'in'           — document field is in a user-attribute array
 *   'contains'     — document array field contains a user attribute value
 *   'is_owner'         — document.accessControl.ownerId === user.id
 *   'is_assigned'      — user.id IN document.accessControl.assignedUserIds
 *   'bound_entity_in'  — document.accessControl.[vendorId|clientId] IN user.boundEntityIds (array contains)
 *   'is_internal'      — user.isInternal === true
 *   'any'              — no condition (always true for this predicate; use for unconditional allow)
 */
export interface PolicyCondition {
  operator: PolicyOperator;
  /**
   * Document field path for operators that compare against a doc field.
   * e.g. 'accessControl.clientId', 'accessControl.teamId'
   */
  documentField?: string;
  /**
   * User profile field for 'eq'/'in' comparisons against the caller's attributes.
   * e.g. 'accessScope.managedClientIds', 'boundEntityIds', 'accessScope.teamIds'
   */
  userField?: string;
  /** Static comparison value for 'eq' against a constant */
  staticValue?: string;
}

export type PolicyOperator =
  | 'eq'              // docField === staticValue
  | 'in'              // docField IN user[userField]  (user has an array; doc has scalar)
  | 'contains'        // user[userField] IN docField  (doc has an array; user has scalar)
  | 'is_owner'        // doc.accessControl.ownerId === user.id
  | 'is_assigned'     // user.id IN doc.accessControl.assignedUserIds
  | 'bound_entity_in' // doc.accessControl.[field] IN user.boundEntityIds (array membership check)
  | 'is_internal'     // user.isInternal === true
  | 'any';            // unconditional
```

---

## Part 7 — Seed policy rules (canonical defaults)

These are the seed rows that replicate the current hardcoded `casbin-engine.service.ts` logic, but expressed as policy data. They live in `authorization-policies` container, `tenantId: '*'`.

### Platform domain policies

```
[P-ADM-001] role=admin, domain=platform, resource=*, action=[*]
  conditions: [any]
  effect: allow, priority: 1000
  description: "Platform admin has full access to all resources"

[P-MGR-001] role=manager, domain=platform, resource=vendor_order, action=[read]
  conditions: [{ op:'in', docField:'accessControl.clientId', userField:'accessScope.managedClientIds' }]
  effect: allow, priority: 100
  description: "Platform manager reads VendorOrders for their managed clients"

[P-MGR-002] role=manager, domain=platform, resource=vendor_order, action=[read]
  conditions: [{ op:'in', docField:'accessControl.teamId', userField:'accessScope.teamIds' }]
  effect: allow, priority: 100
  description: "Platform manager reads VendorOrders in their team"

[P-MGR-003] role=manager, domain=platform, resource=engagement, action=[read,create,update]
  conditions: [{ op:'in', docField:'accessControl.clientId', userField:'accessScope.managedClientIds' }]
  effect: allow, priority: 100

[P-MGR-004] role=manager, domain=platform, resource=client_order, action=[read,create,update]
  conditions: [{ op:'in', docField:'accessControl.clientId', userField:'accessScope.managedClientIds' }]
  effect: allow, priority: 100

[P-ANL-001] role=analyst, domain=platform, resource=vendor_order, action=[read]
  conditions: [{ op:'is_assigned' }]
  effect: allow, priority: 100
  description: "QC analyst reads VendorOrders assigned to them"
  allowedFields: [id, orderNumber, status, productType, productName, propertyAddress,
                  propertyDetails, propertyData, criteriaResults, evaluationData,
                  autoVendorAssignment, dueDate, checklistItems, qcNotes, revisionHistory,
                  documents, accessControl.tenantId, accessControl.teamId]
  -- NOTE: fees, borrowerInformation, loanInformation are NOT in allowedFields
  -- ClientOrder access (P5): client_order is intentionally absent here. Add a separate
  -- rule [P-ANL-002] when product approves it; zero code change required.

[P-ANL-QC-001] role=analyst, domain=platform, resource=qc_review, action=[read,create,update,approve,reject]
  conditions: [{ op:'is_assigned' }]
  effect: allow, priority: 100

[P-SUP-001] role=supervisor, domain=platform, resource=vendor_order, action=[read]
  conditions: [{ op:'in', docField:'accessControl.teamId', userField:'accessScope.teamIds' }]
  effect: allow, priority: 100

[P-SUP-002] role=supervisor, domain=platform, resource=vendor_order, action=[update]
  conditions: [{ op:'in', docField:'accessControl.teamId', userField:'accessScope.teamIds' }]
  effect: allow, priority: 100
  writableFields: [assignedVendorId, autoVendorAssignment, status, priority]
  description: "Supervisor can reassign within their team scope"
```

### Vendor domain policies

```
[V-MGR-001] role=manager, domain=vendor, resource=vendor_order, action=[read,update]
  conditions: [{ op:'bound_entity_in', docField:'accessControl.vendorId' }]
  effect: allow, priority: 100
  description: "Vendor coordinator reads+updates all VendorOrders for their firm(s)"
  -- NO create action (P4: vendor coordinators cannot create orders)
  writableFields: [status, vendorNotes, bidResponse, internalAssignedAppraiser]

[V-MGR-002] role=manager, domain=vendor, resource=appraiser, action=[read]
  conditions: [{ op:'bound_entity_in', docField:'vendorId' }]
  effect: allow, priority: 100
  description: "Vendor coordinator sees their firm's appraiser roster"

[V-MGR-003] role=manager, domain=vendor, resource=vendor, action=[read,update]
  conditions: [{ op:'bound_entity_in', docField:'id' }]
  effect: allow, priority: 100
  writableFields: [contactName, phone, email, serviceAreas, availability, bankingInfo]
  description: "Vendor coordinator can read and update their own firm profile (limited fields)"

[V-SUP-001] role=supervisor, domain=vendor, resource=vendor_order, action=[read,update]
  conditions: [{ op:'bound_entity_in', docField:'accessControl.vendorId' }]
  effect: allow, priority: 100
  description: "Vendor supervisor — same as coordinator + can reassign appraisers within firm"
  writableFields: [status, vendorNotes, bidResponse, internalAssignedAppraiser, assignedUserId]

[V-APR-001] role=appraiser, domain=vendor, resource=vendor_order, action=[read,update]
  conditions: [{ op:'is_assigned' }]
  effect: allow, priority: 100
  writableFields: [propertyData, criteriaResults, evaluationData, bidResponse, appraisalNotes,
                   inspectionDate, inspectionType, reportAttachmentId]
  -- NOT writable: fees, slaDeadline, clientId, tenantId, accessControl, loanInformation, borrowerInformation

[V-APR-002] role=appraiser, domain=vendor, isInternal=true, resource=vendor_order, action=[read]
  conditions: [{ op:'is_assigned' }]
  effect: allow, priority: 110  -- higher priority than V-APR-001
  -- allowedFields absent = all fields readable (internal staff can see full work packet)
  description: "Internal appraiser has full read on their assigned orders"

[V-REV-001] role=reviewer, domain=vendor, isInternal=true, resource=vendor_order, action=[read]
  conditions: [{ op:'in', docField:'accessControl.teamId', userField:'accessScope.teamIds' }]
  effect: allow, priority: 100
  description: "Internal reviewer reads VendorOrders in their team for review work"

[V-REV-002] role=reviewer, domain=vendor, isInternal=true, resource=qc_review, action=[read,update]
  conditions: [{ op:'is_assigned' }]
  effect: allow, priority: 100
  description: "Internal reviewer can update QC review assigned to them"
```

### Client domain policies

```
[C-MGR-001] role=manager, domain=client, resource=engagement, action=[read]
  conditions: [{ op:'bound_entity_in', docField:'accessControl.clientId' }]
  effect: allow, priority: 100
  description: "Lender admin sees all their engagement records"
  allowedFields: [id, engagementNumber, status, loans, clientOrders, createdAt, dueDate, notes]
  -- NOT: internal notes, vendor assignment details, pricing strategy

[C-MGR-002] role=manager, domain=client, resource=client_order, action=[read]
  conditions: [{ op:'bound_entity_in', docField:'accessControl.clientId' }]
  effect: allow, priority: 100
  allowedFields: [id, clientOrderNumber, status, productType, dueDate, fee, deliveredReportId,
                  propertyAddress, loanNumber, instructions]
  -- NOT: vendorOrderIds (internal decomposition is invisible to client)

[C-MGR-003] role=manager, domain=client, resource=document, action=[read]
  conditions: [
    { op:'bound_entity_in', docField:'accessControl.clientId' },
    { op:'eq', docField:'category', staticValue:'appraisal-report' }  -- final reports only
  ]
  effect: allow, priority: 100
  description: "Lender sees final appraisal report documents only"

-- Lender read-only user:
-- Same role=manager, domain=client, boundEntityIds=[clientId].
-- A per-tenant policy rule (tenantId=<specific-lender-tenant>) overrides C-MGR-002 actions to [read]
-- and narrows allowedFields. No new role. No code change.
-- Example:
[C-MGR-002-READONLY] tenantId=<tenant-specific>, role=manager, domain=client, resource=client_order, action=[read]
  conditions: [{ op:'bound_entity_in', docField:'accessControl.clientId' }]
  allowedFields: [id, clientOrderNumber, status, productType, dueDate, deliveredReportId]
  effect: allow, priority: 90   -- lower than C-MGR-002 so both can coexist; field intersection applies

-- Explicit deny: no client domain user may ever see vendor_order
[C-DENY-001] role=*, domain=client, resource=vendor_order, action=[*]
  conditions: [any]
  effect: deny, priority: 9999
  description: "Hard wall: client domain users cannot see VendorOrders under any circumstances"
```

---

## Part 8 — `AccessControl` updated schema (on every document)

```typescript
export interface AccessControl {
  // ── Ownership (platform-side) ─────────────────────────────────────────────
  ownerId: string;            // Platform user who created this record
  ownerEmail?: string;

  // ── Fulfillment assignment ────────────────────────────────────────────────
  assignedUserIds: string[];  // Appraiser/reviewer userIds assigned to work on this
  vendorId?: string;          // Vendor firm for this order (REQUIRED on VendorOrder; used by V-MGR-001)
  appraiserId?: string;       // The specific appraiser (mirrors primary assignedUserId for quick lookups)

  // ── Platform organizational scope ────────────────────────────────────────
  teamId?: string;
  departmentId?: string;

  // ── Business relationship scope ──────────────────────────────────────────
  clientId: string;           // REQUIRED on VendorOrder, ClientOrder, Engagement
  engagementId?: string;
  clientOrderId?: string;     // REQUIRED on VendorOrder

  // ── Visibility ────────────────────────────────────────────────────────────
  visibilityScope: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'ASSIGNED_ONLY';

  // ── Multi-tenancy ─────────────────────────────────────────────────────────
  tenantId: string;
}
```

**Fields required at creation (enforced by `assertHasAccessControl()` utility):**

| Document type | Required AccessControl fields |
|---|---|
| `vendor_order` | `ownerId`, `tenantId`, `clientId`, `vendorId`, `clientOrderId`, `visibilityScope` |
| `client_order` | `ownerId`, `tenantId`, `clientId`, `engagementId`, `visibilityScope` |
| `engagement` | `ownerId`, `tenantId`, `clientId`, `visibilityScope` |
| `qc_review` | `ownerId`, `tenantId`, `clientId`, `assignedUserIds`, `visibilityScope` |
| `vendor` (profile) | `ownerId`, `tenantId`, `visibilityScope` |
| `appraiser` | `ownerId`, `tenantId`, `vendorId` (employing firm), `visibilityScope` |

---

## Part 9 — `AuthorizationContext` updated (passed to policy evaluator)

The policy evaluator needs all identity axes to evaluate rules. The context expands to carry `portalDomain`, `boundEntityIds`, and `isInternal`:

```typescript
export interface AuthorizationContext {
  user: {
    id: string;
    role: Role;
    portalDomain: PortalDomain;
    boundEntityIds: string[];   // [] for platform domain and internal staff
    isInternal?: boolean;
    email: string;
    teamIds: string[];
    departmentIds: string[];
    managedClientIds?: string[];
    statesCovered?: string[];
    canViewAllOrders?: boolean;
  };
  resource: {
    type: ResourceType;
    id: string;
    // AccessControl fields denormalized here for policy evaluation:
    ownerId?: string;
    teamId?: string;
    clientId?: string;
    vendorId?: string;
    assignedUserIds?: string[];
    visibilityScope?: string;
  };
  action: Action;
  context?: {
    ipAddress?: string;
    timestamp: Date;
    requestId?: string;
  };
}
```

---

## Part 10 — Extensibility proof (how to add capabilities without code changes)

### Add QC analyst read access to ClientOrder (P5 deferral)

When product approves it, add one policy row to Cosmos:

```json
{
  "id": "P-ANL-002",
  "tenantId": "*",
  "role": "analyst",
  "portalDomain": "platform",
  "resourceType": "client_order",
  "actions": ["read"],
  "conditions": [
    { "operator": "in", "documentField": "accessControl.clientId",
      "userField": "accessScope.managedClientIds" }
  ],
  "effect": "allow",
  "priority": 100,
  "allowedFields": ["id", "clientOrderNumber", "productType", "dueDate",
                    "instructions", "propertyAddress", "loanNumber"],
  "description": "QC analyst may read limited ClientOrder fields for context"
}
```

No TypeScript changes. Policy cache invalidates in ≤60s. Zero deployment required.

### Add writable field to appraiser on VendorOrder (P6 expansion)

Edit `V-APR-001.writableFields` in the policy document via the policy management API. Effective immediately on next cache flush.

### Add a new portal domain ("inspector")

1. Add `'inspector'` to the `PortalDomain` union type.
2. Add policy rules for `role=appraiser, domain=inspector, resource=inspection_order`.
3. Provision users with `portalDomain: 'inspector'`.

No changes to `AuthorizationMiddleware`, `AuthorizationService`, or `PolicyEvaluatorService`.

### Add a "Client Supervisor" role

No new role needed. Provision as `role: 'supervisor', portalDomain: 'client', boundEntityIds: [clientId]`. Add policy rules `[C-SUP-001]` etc. Zero code changes.

---

## Part 11 — Impact on existing code

| File | Required change |
|---|---|
| `src/types/authorization.types.ts` | Add `Role`, `PortalDomain` types; add `portalDomain`, `boundEntityIds: string[]`, `isInternal` to `UserProfile`; expand `AuthorizationContext`; rename `PolicyOperator 'is_bound_entity'` → `'bound_entity_in'` |
| `src/services/casbin-engine.service.ts` | Replace with `PolicyEvaluatorService` (Phase 3) |
| `src/middleware/authorization.middleware.ts` | Pass `portalDomain`/`boundEntityIds` from loaded `UserProfile` into `AuthorizationContext` |
| `src/services/access-control-helper.service.ts` | Add `vendorId` and `clientOrderId` to required creation params; add `assertHasAccessControl()` validator |
| `src/scripts/seed/modules/users.ts` | Add `portalDomain`, `boundEntityIds`, `isInternal` to all seeded users |
| `l1-valuation-platform-ui/src/@auth/authRoles.ts` | Update to match canonical `Role` type + add `portalDomain` to user context |
| `l1-valuation-platform-ui/src/@auth/aiScopes.ts` | Update `getScopesForRole()` to use `(role, portalDomain)` pair |

**Phases 1 and 2 of `AUTH_PRODUCTION_READINESS_PLAN.md` do not require the new model — proceed in parallel.  Phase 3 schema design must use this document.**

---

## Part 12 — Resolved open items

All four open items are resolved. No remaining blockers.

| # | Resolution |
|---|---|
| O1 | `reviewer` = a firm or individual hired **by the platform** to review another vendor's submitted work (e.g., desktop review of an appraisal). NOT a lender employee. Lender read-only users are `manager` in `client` domain; their access is narrowed by a per-tenant policy rule override (`actions=[read]`, narrower `allowedFields`). No new role needed. ✅ |
| O2 | `boundEntityIds: string[]` replaces `boundEntityId?: string`. An appraiser working for two firms carries both vendorIds. Policy operator is `bound_entity_in` (`ARRAY_CONTAINS(@boundEntityIds, doc.field)`). ✅ |
| O3 | Per-client scoping is sufficient for now. `accessScope.managedVendorIds` remains in the schema but no policy rules depend on it today. ✅ |
| O4 | Internal staff (`isInternal: true`) have `boundEntityIds: []`. Their authorization scope is governed by `isInternal: true` + `accessScope.teamIds` + `assignedUserIds`. They are stored in the `vendors` Cosmos container for operational reasons but are NOT bound to any vendor firm for policy evaluation. The `bound_entity_in` operator will never match for them — which is correct. ✅ |

**Design document status: COMPLETE. Ready for TypeScript implementation.**
