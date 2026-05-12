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

- [ ] Replace in-memory `PLATFORM_CAPABILITY_MATRIX` as the long-term source of Casbin capability rules.
- [ ] Materialize Casbin capability tuples from Cosmos-backed policy/config documents.
- [ ] Remove duplicated capability definitions once Cosmos-backed Casbin loading is stable.

### Phase 5 — Verification

- [x] Repair stale authorization tests.
- [x] Add targeted tests for scoped rule resolution and Cosmos SQL generation.
- [x] Run targeted backend tests.
- [ ] Run SAST scan on modified backend code.

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

### 2026-05-08

- Implemented strict request validation for `POST /api/policies`, `PUT /api/policies/:id`, and `POST /api/policies/evaluate`, including rejection of forged system-managed fields and malformed conditions.
- Strengthened `PolicyEvaluatorService` cache invalidation so policy updates that move across `(tenantId, role, resourceType)` scopes evict both the old and new cache keys.
- Added targeted authorization HTTP tests for policy payload validation and evaluator unit tests for cache invalidation behavior.
- Integrated default authorization policy seeding into the unified seed orchestrator via `src/scripts/seed/modules/authorization-policies.ts` and aligned the standalone policy-seed script to the same deterministic `seed-policy-*` ID scheme.
- Ran targeted backend validation:
   - `pnpm vitest run tests/authorization/policy-management-http.test.ts`
   - `pnpm vitest run tests/authorization/policy-evaluator-parity.test.ts tests/authorization/policy-management-http.test.ts`
   - `pnpm exec tsc --noEmit`