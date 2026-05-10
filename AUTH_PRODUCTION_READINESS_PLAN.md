# Authorization Production Readiness Plan

**Created:** 2026-05-06  
**Status:** In Progress  
**Owner:** Platform Engineering  
**Repos in scope:** `appraisal-management-backend`, `l1-valuation-platform-ui`

Progress key: `[ ]` not started · `[~]` in progress · `[x]` complete · `[!]` blocked

---

## Executive Assessment

The authorization infrastructure has a **solid skeleton** but critical gaps that prevent production deployment.  The summary below organizes work from most dangerous (things that already exist but are hollow) to future improvements (expanding the model).

### What exists and works
- Casbin policy engine with `buildQueryFilter()` that generates role-scoped Cosmos SQL
- `AuthorizationMiddleware` with `loadUserProfile() → authorize(resource, action)` pipeline
- `AuthorizationService.authorizeResource()` for per-object ABAC checks
- `AccessControlHelper` with typed factories for stamping `accessControl` blocks on documents
- `AccessScope` supporting teams, departments, regions, clients, vendors, states
- `visibilityScope` enum (PUBLIC | TEAM | PRIVATE | ASSIGNED_ONLY) embedded in document schema
- Tenant isolation via `tenantId` partition key on all Cosmos containers
- Test token infrastructure for local development

### Critical gaps discovered during review

| # | Gap | Risk |
|---|-----|------|
| G1 | **Bulk order creation does not stamp `accessControl`** — `BulkPortfolioService.submit()` receives `submittedBy` and `tenantId` but never calls `AccessControlHelper.createOrderAccessControl()`. Orders created through the bulk path have no `ownerId`, `teamId`, or `visibilityScope`. The Casbin query filter then cannot match them — they are invisible to all non-admin users or accidentally visible to everyone depending on filter logic. | **CRITICAL** |
| G2 | **`BulkIngestionService` and `BulkIngestionOrderCreationWorkerService` have the same gap** — the ingestion pipeline creates orders from adapter-mapped records with no `accessControl` block. | **CRITICAL** |
| G3 | **Casbin policies are hardcoded in TypeScript** (`casbin-engine.service.ts`), not stored in the database. Adding a new role or changing a policy requires a code deployment. No policy management API exists. | HIGH |
| G4 | **UserProfile documents must exist in Cosmos for filtering to work** — if `loadUserProfile()` returns null, the middleware currently falls through to the route handler with no `req.userProfile`, meaning downstream queries run without a filter. The `ENFORCE_AUTHORIZATION=false` env var completely bypasses even this. | **CRITICAL** |
| G5 | **No Cosmos composite indexes** for `accessControl.teamId + tenantId`, `accessControl.ownerId + tenantId`, `accessControl.assignedUserIds[] + tenantId`. Scoped queries will do full-container scans and hit RU limits under load. | HIGH |
| G6 | **Query filter injection is not applied consistently** — routes `/api/notifications`, `/api/chat`, `/api/criteria`, `/api/mop-criteria` call only `authenticate()` and then query without `loadUserProfile()` or filter injection. | HIGH |
| G7 | **Legacy `qc-api-validation.middleware.ts` `requireRole()` reads roles from JWT claims** — conflicts with the Casbin architecture that intentionally strips roles from the token and loads them from DB. These checks silently pass or fail based on stale JWT data. | MEDIUM |
| G8 | **UI auth is still mock** — `authApi.ts` calls `/api/mock/auth/*`. No real MSAL/Entra token flow is wired to the user object that `FuseAuthorization` checks. | **CRITICAL** |
| G9 | **UI route guards are empty** — every production route has `auth: null` or no `auth` property. `FuseAuthorization` is wired but never invoked on protected content. | HIGH |
| G10 | **UI role taxonomy (`admin/staff/user`) does not match backend** (`admin/manager/analyst/appraiser`). The mapping bridge in `aiScopes.ts` does not apply to route guards or data-fetch hooks. | MEDIUM |
| G11 | **No field-level authorization** — an `analyst` can read the full order document including loan amounts, borrower PII, pricing, etc. Scoping which fields each role sees is not implemented. | MEDIUM |
| G12 | **`ENFORCE_AUTHORIZATION=false` has no start-up guard** — it silently disables all authorization in any environment including production if the env var is wrong. | HIGH |

---

## Phase 1 — Stop the bleeding: fix the bulk/ingestion paths
**Target:** Sprint 1 (2 weeks)  
Work ensures ALL creation paths produce documents with correct `accessControl` metadata.  
Without this, the query filters in Phase 2 cannot work for bulk-created data.

### 1.1 — Stamp `accessControl` in `BulkPortfolioService.submit()`

> **Files:** `src/services/bulk-portfolio.service.ts`

- [x] Inject `AccessControlHelper` into `BulkPortfolioService` constructor
- [x] In `submit()`, after `submittedBy` and `tenantId` are known, resolve the submitter's `UserProfile` to get `teamId`
- [x] Call `accessControlHelper.createOrderAccessControl(submittedBy, submitterEmail, request.clientId, tenantId, { teamId })` and merge into every `orderPayload` built in the `for (const item of orderItems)` loop
- [x] Apply the same to `createOrdersFromResults()` (tape evaluation → orders path) — use the `submittedBy` argument already passed in
- [x] Write unit test: submit a 3-item batch as `manager`; assert every created order document has `accessControl.ownerId === managerId`, `accessControl.teamId`, and `accessControl.tenantId` → `tests/bulk-portfolio.accesscontrol.test.ts`
- [x] Write unit test: simulate missing `UserProfile` for submitter; assert submission still creates documents with at minimum `ownerId` and `tenantId` (graceful degradation with explicit logging, NOT silent null)

### 1.2 — Stamp `accessControl` in `BulkIngestionService`

> **Files:** `src/services/bulk-ingestion.service.ts`, `src/services/bulk-ingestion-processor.service.ts`, `src/services/bulk-ingestion-order-creation-worker.service.ts`

- [x] Audit all three files for every path that calls `dbService.createOrder()` or equivalent
- [x] For each call site: inject `AccessControlHelper` and stamp `accessControl` using the authenticated `submittedBy` context
- [x] The worker services run async after the HTTP request — ensure the `submittedBy` userId and `tenantId` are persisted on the job record and propagated into each order creation call
- [x] Write integration test for the full ingestion → order creation path; assert `accessControl` is present on created orders

### 1.3 — Audit all remaining `createOrder` / document-creation call sites

> **Files:** Any service that calls `dbService.createOrder()`, `dbService.createDocument()`, or equivalent

- [x] Run: `grep -r "createOrder\|createDocument\|container.items.create" src/ --include="*.ts" -l` to enumerate all creation sites
- [x] For each file, verify the created document payload includes an `accessControl` block
- [x] Document any sites that legitimately have no owning user (e.g., system-generated documents) and apply a designated system identity with `visibilityScope: 'PUBLIC'` or `'TEAM'` as appropriate
- [x] Create a shared `assertHasAccessControl(doc)` validation utility that throws if `accessControl.ownerId` or `accessControl.tenantId` is absent — call it before every `create` in production paths
- [x] Stamp `accessControl` in `VendorOrderService.createVendorOrder()`: preserve upstream `accessControl` if present; else derive from `input.createdBy`; else throw → `src/services/vendor-order.service.ts`
- [x] Write unit tests for `VendorOrderService.createVendorOrder` accessControl stamping → `tests/vendor-order.service.test.ts` (4 tests)

---

## Phase 2 — Harden the enforcement layer
**Target:** Sprint 2 (2 weeks)

### 2.1 — Close the `ENFORCE_AUTHORIZATION` escape hatch

> **Files:** `src/middleware/authorization.middleware.ts`

- [x] Add a startup assertion: if `NODE_ENV === 'production'` and `ENFORCE_AUTHORIZATION === 'false'`, throw an error and refuse to start — do NOT silently allow all traffic
- [x] Replace the boolean flag with an enum `'enforce' | 'audit' | 'off'` (matching Axiom's AEGIS pattern) to give ops a clearly named audit mode that logs decisions without blocking — `ENFORCE_AUTHORIZATION=audit` logs, `ENFORCE_AUTHORIZATION=off` skips entirely (fatal in production) → `src/middleware/authorization.middleware.ts`
- [x] Write a test that starts the server with `NODE_ENV=production, ENFORCE_AUTHORIZATION=false` and asserts startup throws → `tests/authorization/authorization-middleware-startup.test.ts` (6 cases: off/false → throws; dev/audit/enforce → safe)

### 2.2 — Guard against missing UserProfile

> **Files:** `src/middleware/authorization.middleware.ts`, `src/api/api-server.ts`

- [x] In `loadUserProfile()`: if `UserProfile` is not found in Cosmos, return `401 { error: 'User profile not found. Contact your administrator.', code: 'PROFILE_MISSING' }` — **never** fall through to the handler with `req.userProfile = undefined`
- [x] Add a startup health check that queries the `users` container to verify the Cosmos connection is live → added to `initializeDatabase()` in `src/api/api-server.ts` (throws with actionable error if container unreachable)
- [x] Write test: request with valid JWT but no matching `UserProfile` document → assert `403 USER_PROFILE_NOT_FOUND` → covered by `tests/authorization/http-authz.test.ts` ("valid JWT but user not found in DB → 403 USER_PROFILE_NOT_FOUND")

### 2.3 — Apply `loadUserProfile()` to all routes that query user-scoped data

> **Files:** `src/api/api-server.ts`, `src/controllers/*`

- [x] Audit every `this.app.use('/api/...')` registration in `setupAuthorizationRoutes()`
- [x] Routes currently missing `loadUserProfile()`: `/api/notifications`, `/api/chat`, `/api/criteria`, `/api/mop-criteria` — add it or document explicitly why these are intentionally unscoped
- [x] For notification and chat routes: add `buildQueryFilter` injection — **N/A**: `in-app-notifications` container is partitioned by `/userId`; Cosmos partition key enforces isolation at the storage layer; no additional query filter injection is needed or appropriate. Chat route confirmed same pattern.
- [ ] Write test matrix: each route × each role → verify response data is correctly scoped

### 2.4 — Create Cosmos composite indexes

> **Files:** New Bicep module `infrastructure/cosmos-indexes.bicep`

- [x] Create Bicep module that applies composite indexes to the `orders` container:
  ```
  ["accessControl.tenantId", "accessControl.teamId"]
  ["accessControl.tenantId", "accessControl.clientId"]  
  ["accessControl.tenantId", "accessControl.ownerId"]
  ["accessControl.tenantId", "accessControl.assignedUserIds[]"]
  ```
- [x] Apply same indexes to: `qc-reviews`, `revisions`, `escalations`, `vendors`, `bulk-portfolio-jobs`
- [x] Verify index paths match the exact JSON field paths in the documents
- [ ] Load test: submit 1,000-item bulk job, run scoped query as `manager` role, assert RU consumption does not exceed baseline by more than 20%
- [ ] Deploy to staging and verify query execution plans use the indexes

### 2.5 — Retire `qc-api-validation.middleware.ts` role checks

> **Files:** `src/middleware/qc-api-validation.middleware.ts`, all routes using it

- [x] Identify all routes that use `QCApiValidationMiddleware.requireRole()` or `requirePermission()` — confirmed: middleware has no such methods and is not imported anywhere (dead code)
- [x] Replace each with the Casbin `this.authorize(resource, action)` pattern already used by the main routes — N/A, no active call sites found
- [x] Remove `requireRole()` and `requirePermission()` from `QCApiValidationMiddleware` — N/A, methods never existed
- [x] Write test: call a QC route as `appraiser`; assert `403` is returned via Casbin, not via the old JWT-role check → covered by `tests/authorization/http-authz.test.ts` Layer 3 DENY matrix ("appraiser → GET /api/qc-workflow/queue → 403 AUTHORIZATION_DENIED")

---

## Phase 3 — Move policies to the database (dynamic policy management)
**Target:** Sprint 3 (3 weeks)  
Removes hard-coded role logic from `casbin-engine.service.ts` and makes policies editable without deployment.

### 3.1 — Design DB-backed policy schema

> **Files:** New `src/types/policy.types.ts`, Cosmos container `authorization-policies`

- [x] Define `PolicyRule` document shape:
  ```typescript
  interface PolicyRule {
    id: string;
    tenantId: string;
    role: string;                    // 'manager', 'analyst', etc.
    resourceType: ResourceType;
    actions: Action[];
    conditions: PolicyCondition[];   // attribute-based filters
    effect: 'allow' | 'deny';
    priority: number;                // higher number wins on conflict
    description: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  }

  interface PolicyCondition {
    attribute: string;               // e.g. 'accessControl.teamId', 'accessControl.ownerId'
    operator: 'eq' | 'in' | 'contains_user' | 'is_owner' | 'any';
    value?: string | string[];       // static value OR omit for user-contextual operators
  }
  ```
- [x] Design the runtime-evaluated operators (`contains`, `is_owner`, `is_assigned`, `bound_entity_in`) that compare document fields to the calling user's identity
- [ ] Add Cosmos container `authorization-policies` with partition key `/tenantId` to Bicep infra
- [x] Seed default policies that replicate the current DB-backed row-scope policy behavior and default Casbin capability materialization:

  | Role | Resource | Action | Condition |
  |------|----------|--------|-----------|
  | admin | * | * | none (allow all) |
  | manager | order | read | team IN user.accessScope.teamIds OR client IN user.accessScope.managedClientIds |
  | manager | order | write | team IN user.accessScope.teamIds |
  | analyst | order | read | is_assigned OR (is_owner AND ASSIGNED_ONLY) |
  | analyst | qc_review | read | is_assigned |
  | appraiser | order | read | is_owner OR is_assigned |
  | appraiser | order | write | is_owner OR is_assigned |

- [x] Write unit tests for seeded/default policy behavior

### 3.2 — Replace `CasbinAuthorizationEngine.buildQueryFilter()` with DB-backed evaluator

> **Files:** `src/services/casbin-engine.service.ts`, new `src/services/policy-evaluator.service.ts`

- [x] Create `PolicyEvaluatorService` that:
  1. Loads policies for `(tenantId, role, resourceType, action)` from Cosmos (with 60s in-memory TTL cache)
  2. Evaluates `PolicyCondition[]` against `UserProfile` to produce a Cosmos SQL WHERE clause
  3. Composites multiple matching rules with OR/AND based on `effect` and `priority`
- [x] Implement array-membership SQL generation via `contains`: generates `ARRAY_CONTAINS(...)` clauses
- [x] Implement `is_owner`: generates `c.accessControl.ownerId = @userId`
- [x] Implement `in` / `bound_entity_in` with valid Cosmos equality OR-clauses for team/client/entity scope
- [x] Wire `PolicyEvaluatorService` into `AuthorizationService.buildQueryFilter()` replacing the direct `CasbinAuthorizationEngine` call
- [x] Retain `CasbinAuthorizationEngine` as the coarse capability gate while `PolicyEvaluatorService` handles row-scope SQL generation
- [x] Write parity tests for scoped rule resolution and Cosmos SQL generation

### 3.3 — Policy management API

> **Files:** New `src/controllers/policy-management.controller.ts`

- [x] `GET /api/policies` — list policies for tenant (admin only)
- [x] `POST /api/policies` — create a policy rule (admin only)
- [x] `PUT /api/policies/:id` — update a policy (admin only)
- [x] `DELETE /api/policies/:id` — delete a policy (admin only)
- [x] `POST /api/policies/evaluate` — dry-run: given a user + resource + action, return the computed filter and decision (admin only)
- [x] Cache invalidation: on any write, flush the in-memory cache for the affected `(tenantId, role, resourceType)` triple and any moved scope keys
- [x] Write HTTP-level tests for each endpoint including authorization (non-admin → 403)

### 3.4 — Policy change audit trail

> **Files:** `src/controllers/policy-management.controller.ts`, `src/services/audit.service.ts`

- [x] Every policy create/update/delete writes an audit log entry with: before/after JSON, actorUserId, timestamp
- [x] `GET /api/policies/:id/history` — list all changes to a policy (admin only)

### 3.5 — Casbin capability-source convergence

> **Files:** `src/services/casbin-engine.service.ts`, `src/data/platform-capability-matrix.ts`, `src/scripts/seed/modules/authorization-capabilities.ts`

- [x] Load Casbin capability rules from Cosmos `authorization-policies` documents of type `authorization-capability`
- [x] Seed capability materialization in both the unified seed orchestrator and `scripts/seed-default-policies.ts`
- [x] Remove the separate in-memory runtime capability source; default capability definitions now exist only as seed materialization input matching the Cosmos document shape
- [x] Write targeted tests for capability materialization load/reload/startup failure behavior

---

## Phase 4 — UserProfile lifecycle management
**Target:** Sprint 4 (2 weeks)  
Makes UserProfile creation automatic and correct so G4 cannot recur.

### 4.1 — Auto-provision UserProfile on first authenticated request

> **Files:** `src/middleware/authorization.middleware.ts` or new `src/middleware/user-provisioning.middleware.ts`

- [x] After successful JWT validation, if no `UserProfile` exists for the `(userId, tenantId)` pair, create a minimal profile with a configured default role and `accessScope: { teamIds: [], departmentIds: [] }` when `AUTO_PROVISION_USERS=true`
- [x] Log the auto-provision event to audit log so admins can see new users and assign proper roles
- [x] **Never** auto-provision in test mode using test tokens when the explicit test-token bypass path is enabled; those requests synthesize an in-memory profile only
- [x] Write test: first-time user with valid Entra token → `UserProfile` is created → subsequent request loads the profile correctly

### 4.2 — Azure Entra group → application role sync

> **Files:** New `src/services/entra-group-sync.service.ts`, `src/controllers/user-profile.controller.ts`

- [x] On `loadUserProfile()`, read `req.user.groups` (Entra group OIDs already extracted by auth middleware)
- [x] Look up a tenant-scoped `EntraGroupRoleMapping` document in Cosmos that maps group OID → application role
- [x] If mapping found and user's stored role differs, update the `UserProfile` role in Cosmos and log the change
- [x] Provide admin API: `GET/POST/DELETE /api/admin/group-role-mappings` to manage the Entra group → role map
- [x] Write test: token with group OID `G1` → mapping `G1 → manager` → `UserProfile.role` is set to `manager`
- [x] Add HTTP-level authorization coverage for the group-role mapping admin API

### 4.3 — Seed all staging/production UserProfiles

> **Files:** `scripts/live-fire/seed-staging-users.ts` (already exists)

- [ ] Audit all known users in staging Azure AD tenant against `users` Cosmos container
- [x] Run `seed-staging-users.ts` with real Entra OIDs for all platform users
- [x] Verify the seed script contract locally: validate checked-in user definitions up front and assert generated documents match the middleware lookup contract before live Cosmos writes
- [x] Add a deployment smoke check that counts `users` documents and fails the pipeline when the count is below the per-environment seeded-user minimum for staging/prod environments
- [x] Add a live staging verification script that calls `/api/authz-test/profile` with a real seeded-user token and asserts the authenticated profile matches the checked-in seed set

### `authorization-policies` container layout / index expectations

- Partition key: `/tenantId`
- Mixed discriminators in active use: `authorization-policy`, `authorization-policy-audit`, `authorization-capability`, `entra-group-role-mapping`
- Current backend queries always filter by `tenantId` and `type`, then by one or more of `role`, `resourceType`, `portalDomain`, `clientId`, `subClientId`, or `groupObjectId`
- Current sort keys are single-field only (`priority`, `timestamp`), so default Cosmos range indexes are sufficient for the implemented query patterns

### 4.4 — User profile admin API

> **Files:** `src/controllers/user-profile.controller.ts` (partially exists)

- [x] `PATCH /api/users/:id/role` — change a user's role (admin only) — currently missing, role can only be changed by direct DB edit
- [x] `PATCH /api/users/:id/access-scope` — update teams, clients, regions (admin or manager for their own team)
- [x] Emit audit log event on every role/scope change
- [x] Write tests for each endpoint including cross-tenant access attempt → 403

---

## Phase 5 — UI authorization
**Target:** Sprint 5 (2 weeks)  
Connects the frontend to real identity, applies route guards, and removes mock auth.

### 5.1 — Connect MSAL to the user object

> **Files:** `src/@auth/authApi.ts`, MSAL provider configuration

- [ ] Remove all calls to `/api/mock/auth/*` from `authApi.ts`
- [ ] Wire MSAL `acquireTokenSilent()` → pass the Entra access token to the backend `/api/users/me` (or existing profile endpoint)
- [ ] Ensure the `User` object in Redux/context has `role` populated from the backend `UserProfile.role`, **not** from the JWT claim
- [ ] Add `roles` array to `User` type to support users with multiple roles (Entra group mapping can produce multiple)
- [ ] Write integration test: sign in with a test Entra account → verify `user.role` matches the `UserProfile` in Cosmos

### 5.2 — Align UI role taxonomy with backend

> **Files:** `src/@auth/authRoles.ts`, `src/@auth/aiScopes.ts`

- [ ] Update `authRoles` to match backend roles:
  ```typescript
  const authRoles = {
    admin:      ['admin'],
    manager:    ['admin', 'manager'],
    analyst:    ['admin', 'manager', 'analyst'],
    appraiser:  ['admin', 'manager', 'analyst', 'appraiser'],
    user:       ['admin', 'manager', 'analyst', 'appraiser', 'user'],
    onlyGuest:  []
  };
  ```
- [ ] Update `aiScopes.ts` `getScopesForRole()` to use the new role names
- [ ] Write unit tests for role hierarchy transitivity (e.g., `admin` passes a check for `appraiser`-permissioned routes)

### 5.3 — Apply route guards to all protected routes

> **Files:** `src/app/**/Route.tsx` files

- [ ] Audit every route file in `src/app/` — enumerate routes that have no `auth` property or `auth: null`
- [ ] For each protected route, assign the minimum required role from this matrix:

  | Route prefix | Required role |
  |---|---|
  | `/orders/*` | `authRoles.appraiser` (any authenticated staff) |
  | `/vendors/*` | `authRoles.analyst` |
  | `/analytics/*` | `authRoles.manager` |
  | `/admin/*` | `authRoles.admin` |
  | `/qc/*` | `authRoles.analyst` |
  | `/bulk-portfolios/*` | `authRoles.manager` |

- [ ] Write test (Playwright or Vitest React): sign in as `appraiser`, navigate to `/admin` → verify redirect to 403 page; navigate to `/orders` → verify content loads

### 5.4 — Role-conditioned UI component rendering

> **Files:** New `src/hooks/useHasRole.ts`, `src/hooks/useHasScope.ts`

- [ ] Create `useHasRole(minRole: string): boolean` hook that reads `user.role` from auth context and checks against `authRoles` hierarchy
- [ ] Create `useHasScope(scope: Scope): boolean` hook wrapping existing `aiScopes.ts` logic
- [ ] Apply hooks to hide (not just disable) action buttons the user is not permitted to perform:
  - Create Order button → hide for `user` role
  - Assign Vendor button → hide for `appraiser`
  - Admin panel link → hide for non-admin
  - Bulk Upload tab → hide for `appraiser` and `analyst`
- [ ] Write component tests for each conditional rendering case

### 5.5 — Intercept 401/403 API responses globally

> **Files:** `src/utils/apiFetch.ts` or equivalent API client

- [ ] Add response interceptor: `401` → dispatch sign-out action; `403` → navigate to `/403` page with the role required shown
- [ ] Create `src/app/(public)/403/` page that displays which role is needed and provides a link to request access
- [ ] Write test: mock API returning 403 → verify user sees the 403 page with correct message

---

## Phase 6 — Modern authorization features (ABAC expansion)
**Target:** Sprint 6-7 (3 weeks)  
Expands the policy model to support attribute-based conditions, inheritance, time-bounds, and field-level scope.

### 6.1 — Policy inheritance / role hierarchy in evaluator

> **Files:** `src/services/policy-evaluator.service.ts`, `src/types/policy.types.ts`

- [ ] Add `RoleHierarchy` document to Cosmos: defines parent/child relationships (`manager` > `analyst` > `appraiser`)
- [ ] `PolicyEvaluatorService` resolves inherited policies: a `manager` automatically satisfies any `analyst` or `appraiser` policy
- [ ] This removes the need to duplicate policies for every sub-role
- [ ] Write test: `manager` calls a route guarded by `appraiser`-level policy → allowed via inheritance

### 6.2 — Geographic / state scope enforcement

> **Files:** `src/services/casbin-engine.service.ts` / `PolicyEvaluatorService`

- [ ] `AccessScope.statesCovered` is defined but never evaluated in `buildQueryFilter()`
- [ ] Add `PolicyCondition` type `state_in_scope` that generates: `c.propertyAddress.state IN @userStates`
- [ ] Apply to `order` read queries for `manager` and `appraiser` roles when `statesCovered` is non-empty
- [ ] Write test: manager with `statesCovered: ['CA']` performs order list query → orders in Nevada are excluded

### 6.3 — Time-bounded access

> **Files:** `src/types/policy.types.ts`, `src/services/access-graph.service.ts`

- [ ] `GrantAccessRequest.conditions.timeWindow` is defined in `AccessGraphService` but not checked at query time
- [ ] Add `time_in_window` policy condition evaluator that injects `AND (c.expiresAt IS NULL OR c.expiresAt > @now)` when applicable
- [ ] Add document-level `visibleAfter` and `visibleUntil` fields to `AccessControl`
- [ ] Apply to QC review assignments: reviewers only see assignments during their working window
- [ ] Write test: create document with `visibleUntil = now - 1 day` → verify it is excluded from scoped queries

### 6.4 — Field-level authorization (read-only scope for PII)

> **Files:** New `src/utils/fieldProjection.ts`, order read routes

- [ ] Define a projection map: `role → allowedFields[]` for the `order` document type:
  - `appraiser`: `[id, orderNumber, status, propertyAddress, dueDate, checklistItems]` — no loan amount, borrower PII
  - `analyst`: above + `[assessedValue, loanAmount]` — no borrower SSN/DOB
  - `manager`+: full document
- [ ] Add `applyFieldProjection(doc, role): PartialOrder` utility
- [ ] Apply to `GET /api/orders/:id` response and to order list items
- [ ] Write test: `appraiser` calls `GET /api/orders/:id` → response does not include `borrower.ssn` or `loanAmount`

### 6.5 — Cross-tenant operation guard (supervisor / platform admin)

> **Files:** `src/middleware/authorization.middleware.ts`, new `src/types/authorization.types.ts`

- [ ] Define `platform_admin` role that can act across tenants (for support staff operations)
- [ ] Require explicit `X-Target-Tenant-Id` header for cross-tenant calls (never infer from JWT alone)
- [ ] Log every cross-tenant operation with the actor, target tenant, resource, and reason
- [ ] Write test: `platform_admin` with `X-Target-Tenant-Id: tenant-B` can read tenant-B orders; any non-platform-admin with that header gets 403

---

## Phase 7 — Authorization observability
**Target:** Sprint 7 (1 week)

### 7.1 — Authorization decision logging

> **Files:** `src/services/casbin-engine.service.ts` / `PolicyEvaluatorService`, `src/utils/audit.ts`

- [ ] Emit a structured log for every `authorize()` call: `{ userId, role, resource, action, decision, matchedPolicies, durationMs }`
- [ ] Emit a structured log for every `buildQueryFilter()` call: `{ userId, role, resourceType, generatedSQL }`
- [ ] Route these to Application Insights via the existing logger
- [ ] Write test: make 3 requests with different roles → verify exactly 3 authorization decision log entries are emitted

### 7.2 — Authorization metrics dashboard

> **Tooling:** Application Insights / Azure Monitor

- [ ] Create KQL query: `403 rate by role and endpoint over 7 days`
- [ ] Create KQL query: `avg filter evaluation time by resourceType`
- [ ] Create alert: 403 rate for any endpoint exceeds 5% over 15 minutes (indicates misconfigured policy)
- [ ] Create alert: authorization middleware evaluation time exceeds 100ms p99 (indicates Cosmos performance degradation on policy load)

### 7.3 — Authorization test suite

> **Files:** `tests/authorization/http-authz.test.ts` (already partially exists)

- [ ] Extend to cover every route in `setupAuthorizationRoutes()` for all 4 roles + unauthenticated
- [ ] Add filter projection tests for bulk list endpoints: each role should see the correct count and correct fields
- [ ] Add cross-path tests: create via bulk → query via flow path → assert same user sees the document
- [ ] Add negative tests: document created for tenant-A is not visible to tenant-B users
- [ ] Target: no route left without at least one 403 test and one 200 test per role

---

## Phase 8 — Production deployment checklist
**Target:** Before first prod deployment

### 8.1 — Environment configuration

- [ ] `ENFORCE_AUTHORIZATION=true` is set in all non-local environments
- [ ] `ALLOW_TEST_TOKENS=false` is verified in staging and production
- [ ] `AEGIS_AUTH_MODE=enforce` is set in axiom staging and production
- [ ] Cosmos `users` container has a document for every production user
- [ ] Cosmos `authorization-policies` container is seeded with default policies
- [ ] Cosmos composite indexes verified applied (check Azure Portal → Data Explorer → container → Scale & Settings → Indexing Policy)

### 8.2 — Runbook for common operations

- [ ] Document: "How to add a new user and assign a role" (API call sequence)
- [ ] Document: "How to change a user's team assignment" (PATCH accessScope)
- [ ] Document: "How to create a custom policy rule" (policy management API)
- [ ] Document: "How to diagnose a 403 a user should not be getting" (authz decision log query)
- [ ] Document: "Emergency: how to temporarily grant access to a resource outside normal policies" (time-bounded AccessGraph grant)

### 8.3 — Security review

- [ ] Confirm no endpoint returns a list without either `tenantId` filter or explicit `canViewAll` scope check
- [ ] Confirm no endpoint exposes another tenant's data via predictable IDs (`/api/orders/known-id` without tenantId check in query)
- [ ] Confirm `UserProfile.isActive = false` blocks all access (test: deactivate a user → verify all requests return 401)
- [ ] Confirm test tokens produce a `400`/`401` in production, not a service error

---

## Dependency map

```
G1,G2 (bulk accessControl)    ← must be done before Phase 2 filter injection matters
G4 (UserProfile null guard)   ← must be done before Phase 3 policy evaluation
G3 (hardcoded policies)       ← Phase 3 replaces this
G5 (indexes)                  ← can run in parallel with Phase 2
G8,G9 (UI mock auth)          ← Phase 5, unblocked
Phase 6 (ABAC expansion)      ← requires Phase 3 (DB policies) to be useful
Phase 7 (observability)       ← can start at Phase 4/5
Phase 8 (prod checklist)      ← final gate
```

---

## Open questions requiring product decision

| # | Question | Impact |
|---|----------|--------|
| Q1 | Should `visibilityScope: 'PUBLIC'` orders be searchable by all authenticated users regardless of team? | Phase 2 filter logic |
| Q2 | What is the default role for an auto-provisioned user (Phase 4.1)? `user`, `appraiser`, or blocked pending admin assignment? | Phase 4 provisioning |
| Q3 | Should managers be able to see all orders for their managed clients, or only orders on teams they manage? (Currently both in `casbin-engine.service.ts`) | Phase 3 seeded policies |
| Q4 | Field-level auth: what is the exhaustive PII field list per role? (Phase 6.4 needs product sign-off) | Phase 6 |
| Q5 | Should the UI show a user's own role/permissions to them? (useful for support, risky for enumeration) | Phase 5 |
