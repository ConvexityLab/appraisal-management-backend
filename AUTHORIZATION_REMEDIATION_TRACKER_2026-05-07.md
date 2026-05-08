# Authorization Remediation Tracker — 2026-05-07

## Objective

Stabilize the backend authorization system around one canonical policy source in Cosmos DB, keep `CasbinAuthorizationEngine` as the coarse capability gate, keep `PolicyEvaluatorService` as the row-scope compiler, and wire compiled filters into real Cosmos queries.

## Final architecture decisions

1. **Cosmos DB is the source of truth for authorization rules.**
   - Container: `authorization-policies`
   - Policy resolution must support at least `tenantId`, `clientId`, and `subClientId`.
   - Generic tenant-wide rules remain valid; more specific client/sub-client rules may override them by priority and specificity.

2. **`CasbinAuthorizationEngine` remains in the design.**
   - Responsibility: capability gate only (`can role X perform action Y on resource Z at all?`).
   - Long-term source of truth for Casbin capabilities should also move to Cosmos-backed policy materialization.

3. **`PolicyEvaluatorService` remains the row-scope compiler.**
   - Responsibility: compile applicable Cosmos policy rows into deterministic Cosmos SQL filters.
   - It must not be replaced by ad hoc repository logic.

4. **Repository/query enforcement is mandatory.**
   - Computing `req.authorizationFilter` is not enough.
   - Real Cosmos queries must append the compiled filter before execution.

5. **No CSV policy source.**
   - `policy.csv` stays dead.
   - No new fallback file-based policy path should be introduced.

## Current defects confirmed

- `PolicyEvaluatorService` lookup is only `tenantId + role + resourceType`.
- `clientId` and `subClientId` exist in JWT/auth middleware but are not first-class in `UserProfile`.
- `PolicyEvaluatorService` currently emits invalid Cosmos SQL for array-backed scalar membership (`IN (@arrayParam)`).
- `authorizeQuery()` computes filters, but key order list/search paths do not consistently apply them.
- Existing tests still contain stale assumptions from the pre-refactor state.

## Implementation phases

### Phase 1 — Context + lookup correctness

- [x] Add `clientId` / `subClientId` to authorization runtime profile types.
- [x] Preserve request claim context when synthesizing/loading `UserProfile`.
- [x] Extend `PolicyRule` to support optional `clientId`, `subClientId`, and `enabled`.
- [x] Update `PolicyEvaluatorService` lookup to resolve by tenant + role + resource + portal + client + sub-client.
- [x] Fix Cosmos SQL compilation for `in` / `bound_entity_in` conditions.

### Phase 2 — Query wiring

- [x] Wire authorization filter into `findOrders()`.
- [x] Wire authorization filter into `OrderController.searchOrders()`.
- [x] Wire authorization filter into other order-adjacent read paths that bypass `findOrders()`.
- [x] Introduce shared Cosmos query-composition helpers so controllers stop hand-appending auth SQL.

### Phase 3 — Policy storage hygiene

- [x] Add/update policy management validation so scoped policies can be created for tenant/client/sub-client.
- [x] Update default policy seed flow to support scoped seeding without silent defaults.
- [x] Review the mixed-use `authorization-policies` container layout and document discriminators/index expectations.

### Phase 4 — Capability-source convergence

- [x] Replace in-memory `PLATFORM_CAPABILITY_MATRIX` as the long-term source of Casbin capability rules.
- [x] Materialize Casbin capability tuples from Cosmos-backed policy/config documents.
- [x] Remove duplicated capability definitions once Cosmos-backed Casbin loading is stable.

### Phase 5 — Verification

- [x] Repair stale authorization tests.
- [x] Add targeted tests for scoped rule resolution and Cosmos SQL generation.
- [x] Run targeted backend tests.
- [ ] Run SAST scan on modified backend code.

### Phase 6 — Authorization admin panel readiness

#### 6.1 Backend admin API gaps from panel review

- [x] Add explicit `POST /api/users` provisioning endpoint for admin-driven `UserProfile` creation (application profile only, not Entra identity creation).
- [x] Remove silent `'default'` tenant fallback from `user-profile.controller.ts`; admin user-management endpoints now fail closed with `TENANT_REQUIRED` when tenant context is absent.
- [x] Add full update support for Entra group-role mappings via `PUT /api/admin/group-role-mappings/:id`.
- [x] Fix `/api/policies/evaluate` so admins can dry-run authorization for `targetUserId`, not only the caller.
- [x] Add durable audit-trail writes for user-admin mutations (`POST /api/users`, role patch, access-scope patch, deactivate/reactivate), not only logger entries.
- [x] Add soft-delete/status-normalization endpoint design for user lifecycle (`PATCH /api/users/:id/status` vs current deactivate/reactivate split).

#### 6.2 Frontend admin panel gaps from panel review

- [x] Add RTK Query admin API slice(s) for `/api/users`, `/api/policies`, and `/api/admin/group-role-mappings`.
- [x] Create a dedicated control-panel route for authorization administration (recommended label: `Access Administration`).
- [x] Implement `Users` tab UX: list/search/filter, detail drawer, provision profile, change role, edit access scope, activate/deactivate.
- [x] Implement `Policies` tab UX: list/filter, create/edit/delete, history drawer, dry-run evaluator.
- [x] Implement `Entra Group Mappings` tab UX: list/create/update/delete with priority visibility.
- [x] Add `Audit` tab UX surfacing policy/user admin changes once durable audit writes exist.
- [x] Remove remaining reliance on mock auth helpers in `src/@auth/authApi.ts` for admin/user-management flows.
- [x] Replace frontend role fallback during MSAL hydration with fail-closed behavior; do not silently default to `appraiser` when `/api/users/profile` cannot supply a role.
- [x] Tighten route-level guards on broad control-panel routes (`orders`, `qc`, `bulk-portfolios`) so UI route auth better matches backend authorization intent.

### `authorization-policies` container expectations

- **Partition key:** `/tenantId`. Every query path in the current backend scopes by `tenantId` first.
- **Document discriminators currently in use:**
   - `authorization-policy`
   - `authorization-policy-audit`
   - `authorization-capability`
   - `entra-group-role-mapping`
- **Indexed properties relied on by code today:** `type`, `tenantId`, `role`, `resourceType`, `portalDomain`, `clientId`, `subClientId`, `priority`, `groupObjectId`, `timestamp`, `enabled`.
- **Ordering requirements currently in code:**
   - policy listing and rule loading order by `priority`
   - policy history order by `timestamp`
   - group-role mapping listing order by `priority`
- **Indexing note:** current queries use equality filters plus a single-property `ORDER BY`, so the default Cosmos range indexes cover the live code paths; no custom composite index is currently required unless multi-field ordering is added later.

## Scope rules for this remediation

- No infra creation in code.
- No silent fallbacks for missing authorization config.
- No bypass path that skips policy evaluation in production.
- Prefer deterministic, inspectable SQL filters over implicit in-memory filtering.

## Progress log

### 2026-05-07

- Established the target architecture: Cosmos-backed policies + Casbin capability gate + `PolicyEvaluatorService` row-scope compiler.
- Started Phase 1 and Phase 2 implementation.
- First code slice covers context propagation, scoped rule lookup, valid Cosmos SQL generation, and order list/search query wiring.
- Second code slice introduced a shared order-query composition helper and wired dashboard + needs-attention reads through the authorization filter path.
- Added strict policy-management payload validation and tightened cache invalidation for policy updates that move across scope keys.
- Switched `CasbinAuthorizationEngine` startup/reload to Cosmos-backed `authorization-capability` documents in `authorization-policies`.
- Added capability materialization seeding in both the unified seed orchestrator and `scripts/seed-default-policies.ts`.
- Added targeted tests for Cosmos-backed Casbin materialization and capability seeding; reran policy-management HTTP authorization coverage and backend type-checking.
- Replaced the remaining matrix-style bootstrap dependency with default `authorization-capability` materialization definitions and reused that shape across seeding and tests.
- Added scoped `PolicyEvaluatorService` parity coverage for conditional deny precedence, sub-client specificity, and array-based SQL generation.
- Closed the remaining policy-write cache invalidation gap by invalidating both the prior and updated `(tenantId, role, resourceType)` cache buckets on policy updates.
- Added user lifecycle coverage for auto-provisioned profiles, test-token bypass behavior, Entra group → role sync, and staging user seed validation.
- Added explicit `audit-trail` entries for middleware-driven auto-provisioned users so first-login onboarding is discoverable.
- Added HTTP-level coverage for `/api/admin/group-role-mappings` and a staging/prod deploy smoke check that fails when the `users` container is empty.
- Tightened the staging/prod deploy smoke check so the `users` container must meet the per-environment seeded-user minimum from `scripts/user-identities.json`.
- Added a live staging auth verification script for `/api/authz-test/profile` that validates a real seeded-user token against the checked-in identity/seed definitions.
- Reviewed admin-panel readiness across backend + frontend and recorded the concrete API/UI gaps in Phase 6 above.
- Added `POST /api/users` explicit user-profile provisioning for admin workflows and removed the remaining silent tenant fallback in `user-profile.controller.ts`.
- Added `PUT /api/admin/group-role-mappings/:id` so Entra group → role mappings are now full CRUD.
- Fixed `/api/policies/evaluate` so admins can dry-run query filters for `targetUserId` instead of only the caller profile.
- Added HTTP-level coverage for the new user provisioning flow, target-user policy evaluation, and group-role mapping updates.
- Added a frontend `accessAdministrationApi` RTK Query slice and a new `/admin/access-administration` control-panel page with `Users`, `Policies`, and `Group Mappings` tabs.
- Replaced the frontend MSAL role fallback with fail-closed logout behavior when `/api/users/profile` cannot return a valid backend role.
- Added contextual audit UX inside the user detail drawer so administrators can inspect durable mutation history next to role/access-scope changes.
- Removed the remaining `/api/mock/auth/*` dependency in frontend auth flows by switching profile bootstrap to `/api/users/profile` and persisting user preferences locally per authenticated account.
- Tightened route guards and navigation visibility for `orders`, `qc`, and `bulk-portfolios` to better match backend authorization intent.
- Added durable `audit-trail` writes for admin-driven user provisioning, role changes, access-scope changes, and deactivate/reactivate mutations, plus HTTP regression coverage.
- Added normalized `PATCH /api/users/:userId/status` lifecycle management with strict status validation and durable audit coverage while preserving the legacy deactivate/reactivate endpoints.
- Added tenant-scoped `GET /api/users/audit` and `GET /api/policies/audit` endpoints plus the frontend `Audit` tab so access administrators can review merged user/policy changes from the Access Administration page.