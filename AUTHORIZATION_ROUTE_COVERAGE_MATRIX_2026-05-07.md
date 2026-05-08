# Backend Authorization Coverage Matrix — 2026-05-07

## Purpose

This document answers one narrow question:

> For the backend routes actually mounted in `src/api/api-server.ts`, which ones are capability-gated, which ones have confirmed row-scope filtering, and which ones are still missing or partial?

This is a **prefix-level matrix** based on the routes currently mounted by the application. It is intentionally conservative: if a route group does not have explicit evidence of capability gating or row-scope enforcement in the current code, it is **not** marked complete.

## Status definitions

- **Complete**
  - Capability-gated, and
  - Uses the right scoping model for the route type:
    - `authorizeQuery(...)` + real query filter composition for list/search endpoints, or
    - `authorizeResource(...)` for resource endpoints, or
    - top-level admin/self-only route where row-scope filtering is not applicable.
- **Partial**
  - Capability gating exists, but row/resource scoping is not consistently enforced, or
  - controller code still relies on manual tenant checks / inline role checks instead of the canonical authorization path, or
  - a stronger authz mount exists but is undermined by an earlier weaker mount.
- **Missing**
  - Only authenticated at the app layer, or
  - no verified capability gate is present in the mounted route path.
- **Out of scope**
  - public health/auth endpoints, optional-auth discovery endpoints, or server-to-server webhook endpoints.

## Confirmed evidence anchors

- Mounted route registration: `src/api/api-server.ts`
- Canonical query/resource authorization middleware: `src/middleware/authorization.middleware.ts`
- Confirmed query filter append in Cosmos orders queries: `src/services/cosmos-db.service.ts`
- Confirmed full query/resource enforcement: `src/controllers/order.controller.ts`

## A. Confirmed complete

| Route prefix | Capability-gated | Row-scope / resource-scope | Status | Evidence / notes |
|---|---|---|---|---|
| `/api/orders` | Yes | Yes — `authorizeQuery('order', 'read')` and `authorizeResource(...)` | Complete | Mounted in `src/api/api-server.ts`; `src/controllers/order.controller.ts` uses `authorizeQuery` and `authorizeResource`; `src/services/cosmos-db.service.ts` appends `authorizationFilter` to live Cosmos SQL. |
| `/api/users/profile` | Self-only authenticated route | N/A | Complete | Mounted directly in `src/api/api-server.ts`; returns `req.userProfile` only after `authenticate()` + `loadUserProfile()`. |
| `/api/users` | Yes — top-level `authorize('user', 'manage')` | N/A for admin profile management | Complete | Mounted with `this.authorize('user', 'manage')` in `src/api/api-server.ts`; controller enforces tenant context in `src/controllers/user-profile.controller.ts`. |
| `/api/policies` | Yes — top-level `authorize('policy', 'manage')` | N/A for admin policy management | Complete | Mounted with `this.authorize('policy', 'manage')`; controller queries are tenant-scoped in `src/controllers/policy-management.controller.ts`. |
| `/api/admin/group-role-mappings` | Yes — top-level `authorize('policy', 'manage')` | N/A for admin mapping management | Complete | Mounted with `this.authorize('policy', 'manage')`; controller queries are tenant-scoped in `src/controllers/group-role-mapping.controller.ts`. |
| `/api/qc-checklists-new` | Yes — top-level `authorize('qc_review', 'read')` | N/A (reference data) | Complete | Read-only reference data mounted with explicit capability gate in `src/api/api-server.ts`. |
| `/api/client-orders` | Yes | Yes — create gate + `authorizeResource('client_order', ...)` on resource routes | Complete | Mounted after authz initialization in `src/api/api-server.ts`; `src/controllers/client-order.controller.ts` now uses canonical create/read/update authorization wiring. |
| `/api/vendor-orders` | Yes | Yes — `authorizeQuery('vendor_order', 'read')` and `authorizeResource('vendor_order', 'read')` | Complete | Mounted after authz initialization in `src/api/api-server.ts`; `src/controllers/vendor-order.controller.ts` appends `authorizationFilter` to live list queries and uses `authorizeResource` for detail reads. |
| `/api/orders/:orderId/comparables` and `/api/vendor-orders/:vendorOrderId/comparables` | Yes | Yes — `authorizeResource(...)` on parent client/vendor order | Complete | Mounted after authz initialization in `src/api/api-server.ts`; `src/controllers/order-comparables.controller.ts` now requires resource-level auth before comparable reads. |
| `/api/clients` | Yes — controller-level `authorize('client', 'create')`, `authorizeQuery('client', 'read')`, and `authorizeResource('client', ...)` | Yes — list queries append `req.authorizationFilter.sql`; detail/update/delete routes use `authorizeResource(...)` | Complete | `src/controllers/client.controller.ts`, `src/services/cosmos-db.service.ts`, and `src/middleware/authorization.middleware.ts` now enforce canonical query/resource authorization for the mounted client routes. |

## B. Confirmed partial

| Route prefix | Capability-gated | Row-scope / resource-scope | Status | Evidence / notes |
|---|---|---|---|---|
| `/api/access-graph` | Yes — top-level `authorize('access_graph', 'manage')` | No confirmed row-scope | Partial | Mount is gated, but `src/controllers/access-graph.controller.ts` still uses fallback tenant values like `'default'` and does not use canonical query/resource auth middleware. |
| `/api/qc/execution` | Yes — top-level `authorize('order', 'qc_execute')` | No confirmed `authorizeResource(orderId)` | Partial | Prefix is gated in `src/api/api-server.ts`, but the mounted router is not proven to enforce resource-level ABAC per `orderId`. |
| `/api/qc/results` | Yes — top-level `authorize('qc_review', 'read')` | No confirmed row/resource scoping | Partial | Prefix gate exists in `src/api/api-server.ts`, but no evidence in this audit of `authorizeQuery` or `authorizeResource` for order-scoped result access. |
| `/api/vendor-performance` | Yes — top-level `authorize('analytics', 'read')` | No row-scope filter verified | Partial | App-level capability gate exists; deeper row-scope enforcement was not confirmed in this pass. |
| `/api/appraisers` | Yes — controller-level `authorizeQuery('appraiser', 'read')`, `authorizeResource('appraiser', ...)`, and `authorize('appraiser', 'create')` | Partial row/resource coverage | Partial | `src/controllers/appraiser.controller.ts` now uses canonical query auth for list/available reads and resource auth for `/:id` read/update flows, but assignment-related endpoints are still keyed off the appraiser resource only and are not yet on canonical order/resource authorization for the related assignment/order objects. |
| `/api/vendors` | Yes — controller-level `authorizeQuery('vendor', 'read')`, `authorizeResource('vendor', ...)`, and capability gates for create/analytics/assign | Partial row/resource coverage | Partial | `src/controllers/production-vendor.controller.ts` now uses canonical query auth for list/search and resource auth for detail/update/delete/availability, but `/performance/:vendorId` remains capability-gated and `/assign/:orderId` is still not on canonical order/resource authorization. |
| `/api/documents` | Yes — controller-level `authorize('document', ...)` | No confirmed `authorizeQuery` / `authorizeResource` | Partial | `src/controllers/document.controller.ts` uses capability gates only for list/detail/mutation endpoints. |
| `/api/engagements` | Yes — controller-level `authorize('engagement', ...)` | No confirmed `authorizeQuery` / `authorizeResource` | Partial | `src/controllers/engagement.controller.ts` gates by capability but list/detail endpoints are not wired through canonical query/resource auth. |
| `/api/engagements/:id/audit` and `/api/engagements/:id/timeline` | Yes — controller-level `authorize('engagement', ...)` | No confirmed resource-level ABAC | Partial | `src/controllers/engagement-audit.controller.ts` uses capability gates, but not `authorizeResource('engagement', ...)`. |
| `/api/ops-metrics` | Yes — controller-level `authorize('engagement', 'read')` | Tenant-scoped only | Partial | `src/controllers/operations-metrics.controller.ts` uses capability gate plus raw tenant filtering, not canonical query/resource auth. |
| `/api/admin/events/:eventId/replay` | Manual admin check | N/A | Partial | `src/controllers/admin-events.controller.ts` performs inline role checks instead of policy-driven authorization middleware. |
| `/api/qc-workflow` | Yes — controller-level `authorize(...)` by resource family | No confirmed `authorizeQuery` / `authorizeResource` | Partial | `src/controllers/qc-workflow.controller.ts` has per-route capability gates only. |
| `/api/qc-rules` | Yes — controller-level `authorize('qc_review', ...)` | No confirmed row/resource scoping | Partial | Controller has capability gates, but canonical row/resource enforcement was not confirmed. |
| `/api/construction/draw-inspections` and `/api/construction/inspections` | Yes — controller-level `authorize('inspection', ...)` | No confirmed `authorizeQuery` / `authorizeResource` | Partial | `src/controllers/draw-inspection.controller.ts` uses capability gates only. |
| `/api/vendor-certifications` | Yes — top-level `authorize('vendor', 'update')` | No deeper route audit completed | Partial | Prefix is gated in `src/api/api-server.ts`, but route-level scoping has not been verified. |
| `/api/vendor-onboarding` | Yes — top-level `authorize('vendor', 'create')` | No deeper route audit completed | Partial | Prefix is gated in `src/api/api-server.ts`, but route-level scoping has not been verified. |
| `/api/vendor-analytics` | Yes — top-level `authorize('analytics', 'read')` | No deeper route audit completed | Partial | Prefix is gated in `src/api/api-server.ts`, but route-level scoping has not been verified. |

## C. Confirmed missing

These route groups are mounted with authentication only, with no verified capability gate in the mounted path.

| Route prefix | Capability-gated | Row-scope / resource-scope | Status | Evidence / notes |
|---|---|---|---|---|
| `/api/authz-test` | No | No | Missing | Mounted with `authenticate()` + `loadUserProfile()` only in `src/api/api-server.ts`; diagnostic controller exposes check/filter/profile helpers without a dedicated capability gate. |
| `/api/rov` | No verified gate | No | Missing | Mounted with auth only in `src/api/api-server.ts`. |
| `/api/templates` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/exclusion-list` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/consent` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/off-market` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/investors` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/deal-finder` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/rehab` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/proforma` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/market` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/alerts` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/portal` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/inspection` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/auto-assignment` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/delivery` | No verified gate | No | Missing | Both delivery routers are mounted with auth only. |
| `/api/acs` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/collaboration` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/teams` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/communication` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/communications` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/staff` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/inspections` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/photos` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/esignature` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/reports`, `/api/storage`, `/api/geocode` | No verified gate | No | Missing | Mounted with auth only via the reports router. |
| `/api/final-reports` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/comps` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/notification-rules` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/calendar` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/axiom` | No verified gate for end-user routes | No | Missing | Webhook and authenticated routers are mounted separately; end-user router is auth-only. |
| `/api/runs` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/analysis` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/criteria` | No verified gate | No | Missing | Mounted with auth only; intentionally read-only reference data, but not capability-gated. |
| `/api/mop-criteria` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/payments` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/notifications` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/chat` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/engagement-letters` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/client-config` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/mismo` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/gse-submissions` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/inspection-tracking` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/billing` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/wip-board` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/ai`, `/api/agent`, `/api/ai/audit`, `/api/ai/conversations`, `/api/settings/flags`, `/api/telemetry/ai` | No verified gate | No | Missing | Mounted with auth only except a few standalone `/api/ai/*` endpoints elsewhere in `api-server.ts` that do have explicit gates. |
| `/api/post-delivery` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/review-triggers` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/automation/metrics` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/orders/:orderId/rfb` and `/api/rfb` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/arv` and `/api/orders/:orderId/arv` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/appraisal-drafts` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/analytics/*` | Yes for these specific standalone endpoints | No row-scope verified | Missing | The four standalone analytics endpoints in `src/api/api-server.ts` have app-level capability checks, but no confirmed row-scope enforcement. Treat as missing until the backing queries are audited. |
| `/api/property-intelligence*` and `/api/property-intelligence-v2` | No verified gate beyond auth / optional auth | No | Missing | Address suggest is optional-auth; the rest are auth-only. |
| `/api/geospatial` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/bridge-mls` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/avm` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/fraud-detection` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/substantive-review` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/supervisory-review` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/tenant-automation-config` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/dlq-monitor` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/reviews` | No verified gate | No | Missing | Mounted with `authenticate()` and optional `loadUserProfile()`, but no verified capability gate. |
| `/api/construction/catalog` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/products` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/bulk-portfolios` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/bulk-ingestion` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/bulk-adapter-definitions` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/review-programs` | No verified gate | No | Missing | Mounted with auth only. |
| `/api/matching-criteria` | No verified gate | No | Missing | Mounted with auth only. |

## D. Out of scope / intentionally public / server-to-server

| Route prefix | Reason |
|---|---|
| `/health`, `/ready`, `/live`, `/api/status` | Operational health endpoints, not user authorization surfaces. |
| `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` | Authentication endpoints, not post-auth resource authorization. |
| `/api/auth/test-token` | Dev/test-only token helper. |
| `/api/auth/test` | Auth smoke-test endpoint. |
| `/api/v1/integrations` | Vendor-authenticated server-to-server integration surface by design. |
| `/api/axiom/webhook*` | HMAC-validated server-to-server webhook surface by design. |
| `/api/health/*` | Health diagnostics handled outside normal user authorization model. |

## Key conclusions

1. **`/api/orders` and the new client/vendor order surfaces are now confirmed on the canonical model**
  (`authorizeQuery` + real query filter append + `authorizeResource`, where applicable).
2. **Admin surfaces for user/policy/group-mapping management are in good shape**
   because they use top-level capability gates and tenant-scoped Cosmos queries.
3. **A large part of the backend is still only authenticated, not policy-authorized.**
4. **Several routers are capability-gated but still not on the canonical row/resource-scope path.**
5. **`/api/clients` is now on the canonical model** with `authorizeQuery(...)` on list reads, `authorizeResource(...)` on detail/update/delete, and real Cosmos filter composition for list queries.

## Next implementation queue implied by this matrix

1. Upgrade other high-value authenticated-only routers to explicit capability gates.
2. For list/search endpoints, replace manual tenant filtering with `authorizeQuery(...)` + real filter composition.
3. For resource detail/mutation endpoints, replace broad capability-only gates with `authorizeResource(...)` where the resource is user-owned or scope-owned.
4. Re-run this matrix after each router family is upgraded.