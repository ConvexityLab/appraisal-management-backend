# Vendor Integration Ingress Architecture

**Status:** Draft for review
**Owner:** Platform / vendor-integrations
**Last updated:** 2026-05-10

---

## 1. Purpose

Define how external vendor/partner systems (AIM-Port today, Mercury / Reggora / SFTP partners / direct lender feeds tomorrow) post data into our platform, how those payloads are routed to the right vendor adapter, and how each tenant's traffic is identified, authenticated, throttled, and observed.

This document covers **inbound ingress only**. Outbound calls (we → vendor) and the canonical-event consumer pipeline are out of scope here.

---

## 2. Goals

1. **One ingress contract that scales to N vendors with N schemas.** New vendor onboarding = add an adapter + a route, never reshape the platform.
2. **Per-vendor edge controls** — IP allow-list, rate limits, request-size limits, schema validation — without code deploys for each tweak.
3. **Per-vendor auth contracts respected.** AIM-Port authenticates in `body.login.{client_id,api_key}`. Mercury would use HMAC headers. Reggora would use OAuth. The edge layer cannot replace this; it must coexist with it.
4. **Canonical internal model untouched.** Adapters normalize to `VendorDomainEvent`; everything downstream is vendor-agnostic.
5. **Cheap initial cost, clear upgrade path.** Start with the smallest production-suitable APIM tier; upgrade only when a concrete need appears.

---

## 3. Current state (2026-05-10)

- Express server runs in an Azure Container App with **public ingress** (`external: true`, `httpsOnly: true`).
- Adapter pattern is in place — `VendorAdapter` interface, `AimPortAdapter`, `ClassValuationWebhookAdapter`.
- Per-vendor inbound routes are live in application code:
   - `POST /api/v1/integrations/aim-port/inbound`
   - `POST /api/v1/integrations/class-valuation/inbound`
- APIM is now wired into [infrastructure/main.bicep](../infrastructure/main.bicep) and the dedicated AIM-Port API resource exists in [infrastructure/modules/apim.bicep](../infrastructure/modules/apim.bicep).
- AIM-Port APIM policy rewrites to the backend ingress route and stamps `X-APIM-Forwarded: true`.
- Auth still lives inside the adapter (`client_id` from body matches `connection.inboundIdentifier`; `api_key` matches Key Vault secret).
- Application code now rejects direct AIM-Port ingress outside `dev` unless `X-APIM-Forwarded: true` is present; Class Valuation still needs the same APIM + header-enforcement rollout.
- Container App ingress IP allow-listing to APIM / vendor egress ranges is still an infra follow-up.
- Express `express-rate-limit` now skips `/api/v1/integrations/*`, so vendor retries are not blocked by the generic app-user rate limiter.

---

## 4. Target architecture

```
                     ┌──────────────────────────────┐
                     │   Vendor / Lender system     │
                     │   (AIM-Port, Mercury, ...)   │
                     └───────────────┬──────────────┘
                                     │  HTTPS, vendor-specific auth in body/headers
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  Azure API Management (Basic tier)   │
                  │                                      │
                  │  Per-vendor API resource:            │
                  │  • path: /integrations/{vendor}      │
                  │  • IP allow-list (vendor egress IPs) │
                  │  • Rate limit (per-vendor)           │
                  │  • Request size cap                  │
                  │  • Optional schema validation        │
                  │  • CORS / TLS edge                   │
                  └───────────────┬──────────────────────┘
                                  │  HTTPS, FD-ID header / IP restriction enforced
                                  │  on Container App ingress
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  Azure Container App (locked down)   │
                  │  Express server                      │
                  │                                      │
                  │  POST /api/v1/integrations/          │
                  │       {vendor}/inbound               │
                  └───────────────┬──────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  vendor-integration.controller.ts    │
                  │  → VendorIntegrationService          │
                  │  → adapter.authenticateInbound()     │  vendor-specific
                  │  → adapter.handleInbound()           │  (body→domain events)
                  │  → outbox.persistInboundEvents()     │
                  │  → ack response                      │
                  └───────────────┬──────────────────────┘
                                  │
                                  ▼  (async)
                  ┌──────────────────────────────────────┐
                  │  VendorIntegrationEventConsumer      │
                  │  → canonical order / engagement /    │
                  │    inspection / document creation    │
                  └──────────────────────────────────────┘
```

---

## 5. Component decisions

### 5.1 APIM tier: **Basic (~$150/mo)**

| Tier | Monthly cost | SLA | Max request body | VNet | Verdict |
|---|---|---|---|---|---|
| Consumption | $0 + ~$3.50/M calls | 99.95% | **1 MB** | No | ❌ AIM-Port `OrderFilesRequest` payloads (base64 PDFs) routinely exceed 1 MB. |
| Developer | ~$48/mo | None | 250 MB | Optional | ❌ No SLA, dev/test only. |
| **Basic** | **~$150/mo** | **99.95%** | **250 MB** | No | ✅ Cheapest production-suitable. Good enough for foreseeable vendor list. |
| Standard | ~$700/mo | 99.95% | 250 MB | No | Future, when ≥3 vendors and we need multi-region. |
| Premium | $2,700+/mo | 99.99% | 250 MB | Yes | Overkill until VNet integration is required. |

**Decision: Basic.** Rationale:
- AIM-Port file uploads (base64-in-JSON) rule out Consumption.
- Developer has no SLA and is not a production tier.
- We don't need VNet integration today (Container App ingress IP-restriction is an acceptable substitute at this scale; see §5.4).

**Upgrade trigger:** move to Standard when we have ≥3 active vendors, or when per-vendor analytics in APIM become a primary operations tool.

### 5.2 URL pattern: **per-vendor path**

```
POST /api/v1/integrations/aim-port/inbound
POST /api/v1/integrations/class-valuation/inbound
POST /api/v1/integrations/{vendor}/inbound
```

Why per-vendor URL rather than a single endpoint with body-shape detection:

- **Edge policies attach to URLs.** APIM operations, IP allow-lists, rate limits all key off URL path. Body-shape detection happens after the request is inside the container — too late to defend.
- **Per-vendor swagger is meaningful.** AIM-Port has its V2.9 contract; a future vendor will have theirs. Trying to merge them into one shape destroys both.
- **Observability is automatic.** Container App logs, App Insights, APIM analytics all index by route. A spike on `/aim-port/inbound` is instantly attributable.
- **Application-layer change is small.** The controller picks the adapter from the URL parameter; `canHandleInbound(body)` becomes a sanity check, not the dispatcher. Existing adapter interface is unchanged.

**Tenant stays in the body.** We do *not* put `{tenantSlug}` in the URL. `client_id` (or vendor equivalent) inside the payload identifies the tenant; per-tenant URLs would mean a different URL per lender, which is operationally painful for marginal benefit.

### 5.3 Auth: **adapter-owned, APIM does not replace it**

APIM's subscription-key model cannot replace vendor-specific auth contracts:

- AIM-Port authenticates in `body.login.{client_id,api_key}` (V2.9 spec). They will not also send `Ocp-Apim-Subscription-Key`.
- Future vendors with HMAC headers, OAuth, mTLS each have their own contract.

**Therefore:**
- Each adapter owns its `authenticateInbound()`. Unchanged from today.
- APIM enforces *complementary* defenses: IP allow-list per vendor, rate-limit per vendor, request-size cap per vendor, schema validation where the vendor's spec is stable enough.
- For vendors we author the contract for (e.g., a future internal direct-feed), APIM subscription keys *can* be the contract — decided per-vendor at onboarding.

### 5.4 Container App lockdown: **ingress IP-restricted to APIM**

Basic-tier APIM does not support VNet integration, so we cannot put the Container App on a private VNet behind APIM. Instead:

- **Container App ingress** keeps `external: true` (technical requirement for APIM Basic to reach it).
- **Container App ingress IP restrictions** allow only APIM's outbound IPs (APIM publishes a stable set per region; Azure also exposes the `ApiManagement` service tag).
- **Defense-in-depth:** application-layer check that requests have come through APIM (e.g., a known header set by APIM policy) — never the only line of defense.

This is *not* as strong as private endpoint + Premium APIM, but it's the right trade for the cost target. **Upgrade trigger:** if compliance or a customer contract requires private network isolation, revisit.

### 5.5 Outbound: **unchanged, direct from Container App**

Outbound vendor calls (we → AIM-Port etc.) bypass APIM. The Container App egresses directly to the vendor's URL. If a vendor wants to allow-list us, we expose a stable egress IP via NAT gateway or Container App's static outbound IP feature. **Out of scope for this doc.**

---

## 6. Inbound request lifecycle

1. **Vendor → APIM.** HTTPS POST to `https://{apim-gw}.azure-api.net/api/v1/integrations/{vendor}/inbound`. Vendor includes its own auth in body/headers per its contract.
2. **APIM edge enforcement.** IP allow-list match → rate-limit check → request-size cap → optional schema validation. Reject early on any failure.
3. **APIM → Container App.** APIM forwards to `https://{container-app-fqdn}/api/v1/integrations/{vendor}/inbound`, adds `X-Forwarded-For` and an `X-APIM-Forwarded` header (set by APIM policy) for the application-layer check.
4. **Container App ingress IP filter.** Only APIM IPs accepted; everything else dropped at ingress. Belt-and-braces.
5. **Express → Controller.** Route handler picks the adapter from the URL parameter, hands the request to `VendorIntegrationService.processInbound(adapter, body, headers)`.
6. **Adapter chain:**
   - `adapter.identifyInboundConnection(body, headers)` → returns the inbound identifier (`client_id` for AIM-Port).
   - `connectionService.getActiveConnectionByInboundIdentifier(...)` → loads the Cosmos `vendor-connections` row.
   - `adapter.authenticateInbound(body, headers, connection, ctx)` → vendor-specific auth (Key Vault lookup for AIM-Port).
   - `adapter.handleInbound(body, headers, connection, ctx)` → produces `VendorDomainEvent[]` and the vendor-specific ack.
7. **Outbox persist.** `outboxService.persistInboundEvents(...)` durably stores the normalized events. Inbound is fully processed at this point.
8. **Ack returned.** Vendor gets its native ack format (e.g., `{ client_id, success: "true", order_id, fee }` for AIM-Port). HTTP 200 stops AIM-Port's 15-min retry loop.
9. **Async consumer.** `VendorIntegrationEventConsumerService` picks up outbox rows and creates canonical orders / engagements / inspections / documents / communications. **Vendor-agnostic from here on.**

---

## 7. Per-vendor onboarding

For a new vendor (`acme`), the change set is:

| Layer | Change |
|---|---|
| Code: types | Add `src/types/acme.types.ts` — wire format. |
| Code: adapter | Add `src/services/vendor-integrations/AcmeAdapter.ts` implementing `VendorAdapter`. Register in `VendorIntegrationService.adapters` and `VendorOutboundDispatcher.adapters`. |
| Code: route | `router.post('/acme/inbound', …)` in `vendor-integration.controller.ts` — or use a single dynamic `/:vendor/inbound` with an allow-list. |
| Cosmos | Add `vendor-connections` row(s) per tenant: `vendorType: 'acme'`, `inboundIdentifier`, `credentials.{inboundApiKeySecretName, outboundApiKeySecretName, outboundClientId}`, `outboundEndpointUrl`. |
| Key Vault | Add inbound + outbound secrets named per the connection record. |
| APIM | Add a new API resource in `apim.bicep`: path `/api/v1/integrations/acme`, IP allow-list (Acme's egress IPs), rate limit, size cap, optional schema. |
| Tests | Adapter unit tests + a controller integration test for the new route. |
| Docs | Per-vendor integration-points doc (mirror `AIM_PORT_INTEGRATION_POINTS.md`). |

**No change** to `VendorIntegrationService`, `VendorOrderReferenceService`, `VendorEventOutboxService`, `VendorIntegrationEventConsumerService`, or any canonical order/engagement code.

---

## 8. Security model (defense in depth)

| Layer | Control | Failure mode if bypassed |
|---|---|---|
| 1. APIM IP allow-list | Drop if source IP ≠ vendor egress IPs | Bypassed by IP spoofing → next layer catches |
| 2. APIM rate limit | 429 if vendor exceeds N req/min | Bypassed by distributed source → next layer catches |
| 3. APIM request-size cap | 413 if body > N MB | Hard limit, no bypass |
| 4. Container App ingress IP filter | Drop if source ≠ APIM IPs | Internet traffic that didn't go through APIM is rejected |
| 5. Application header check | Reject if `X-APIM-Forwarded` not set | Detects misconfigured ingress filter |
| 6. Adapter auth | Vendor-specific (api_key / HMAC / OAuth / mTLS) | The contractual line of defense; everything above is hardening |
| 7. Per-tenant connection scoping | Cosmos lookup by `inboundIdentifier`, must be `active: true` | Disabled tenants are rejected even with valid creds |

A leaked vendor `api_key` does *not* compromise the platform — it compromises that one tenant's connection. Rotation is a Key Vault secret-update + connection-record update; no code change.

---

## 9. Observability

Per-vendor visibility comes from the per-vendor URL automatically:

- **APIM analytics** — per-API request count, latency, error rate, top callers, top failed operations.
- **App Insights** — request route is `/api/v1/integrations/{vendor}/inbound`, so dashboards filter by vendor with no extra work.
- **Custom dimensions** — log `vendorType`, `connectionId`, `tenantId`, `vendorOrderId` on every inbound event (already done by `VendorIntegrationService.logNormalizedEvents`).
- **Outbox dashboards** — existing `/admin/vendor-outbox` UI shows per-vendor backlog, retries, dead-letters.

**Alerts to wire (out of scope here):** spike in 4xx per vendor, sustained 5xx, outbox DLQ growth, rate-limit 429 rate.

---

## 10. Cost summary

| Component | Tier | Monthly | Notes |
|---|---|---|---|
| APIM | Basic | ~$150 | Single instance, 99.95% SLA. |
| Container App | Existing | unchanged | Already deployed. |
| Key Vault | Existing | unchanged | Vendor secrets stored alongside existing platform secrets. |
| Cosmos `vendor-connections` | Existing | unchanged | Low row count, negligible RU. |
| Egress | Existing | unchanged | Outbound vendor calls priced as normal Container App egress. |

**Total incremental cost: ~$150/mo** for the APIM tier.

**Cost guard:** APIM Basic includes a fixed call quota; Standard/Premium scale with traffic. We will not auto-upgrade tiers. Tier decisions are explicit and documented.

---

## 11. Phased rollout

### Phase 1 — pre-APIM hardening (this week, no infra cost)

1. Rename route to per-vendor: `/api/v1/integrations/aim-port/inbound`. Keep `/api/v1/integrations/inbound` redirecting for one release as a safety net.
2. Add `/api/v1/integrations/` to the global rate-limiter `skip()` (mirrors the existing Axiom webhook skip).
3. Add Container App ingress IP allow-list for AIM-Port's known egress IPs (need to confirm with AIM-Port support).
4. Confirm Express `express.json()` body-size limit is high enough for `OrderFilesRequest`.
5. Update `AIM_PORT_INTEGRATION_POINTS.md` with the per-vendor URL.

**Outcome:** AIM-Port go-live works without APIM. ~95% of the security risk is closed.

### Phase 2 — wire APIM Basic (one engineer, ~2 days)

1. Wire `apim.bicep` into `main.bicep`. Provision Basic tier.
2. Add per-vendor API resource for AIM-Port: path, IP allow-list, rate limit, size cap.
3. Container App ingress IP allow-list switches from "AIM-Port IPs" to "APIM IPs" (via `ApiManagement` service tag).
4. APIM policy adds `X-APIM-Forwarded` header; Express middleware verifies it.
5. AIM-Port re-points to the APIM URL.
6. Update this doc + `AIM_PORT_INTEGRATION_POINTS.md` with the new URL.

**Outcome:** edge defense in depth, per-vendor analytics in APIM, vendor onboarding pattern proven end-to-end.

### Phase 3 — onboard vendor #2 (whenever)

Follow the §7 checklist. Validates that the pattern is reusable.

### Phase 4 — re-evaluate tier (when triggered)

- ≥3 vendors → consider Standard (~$700/mo) for multi-region active-active.
- Compliance / customer contract requiring private network → consider Premium (~$2,700/mo) for VNet.
- WAF / DDoS / bot protection requirement → layer Front Door Premium + WAF (~$330/mo) in front, Container App ingress restricted to Front Door's IPs.

---

## 12. Open questions

1. **AIM-Port egress IPs.** Required for Phase 1 step 3 and Phase 2 step 2. Need to ask AIM-Port support.
2. **Express body-size limit.** Need to verify the global `express.json({ limit })` (or per-route override) accommodates the largest expected `OrderFilesRequest`. Likely needs to be raised to ~50 MB.
3. **Schema validation in APIM.** Worth doing for AIM-Port since V2.9 is stable, or defer to adapter-level Zod validation? Recommendation: defer; adapter validation is more expressive and version-aware.
4. **Outbound static egress IP.** If AIM-Port wants to allow-list us on their side, we need a stable outbound IP. Container App's static outbound IP feature or NAT Gateway. Out of scope here, raise as separate follow-up.
5. **Per-vendor SLA / priority.** No formal commitments yet. If a contract specifies one, revisit tier and rate-limit settings for that vendor.
6. **Product catalog.** A separate workstream is consolidating the product catalog into Cosmos. This doc assumes that work lands first; per-connection product mappings will live alongside `vendor-connections`.

---

## 13. Decisions needed before implementation

- [ ] Confirm Basic tier (vs. Consumption with a file-bypass workaround).
- [ ] Confirm per-vendor URL pattern (vs. retain single body-dispatch endpoint).
- [ ] Confirm Phase 1 ships before Phase 2 (vs. skip Phase 1 and go straight to APIM).
- [ ] Get AIM-Port egress IP list.
- [ ] Decide Express JSON body-size limit.
