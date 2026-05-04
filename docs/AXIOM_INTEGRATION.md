# Axiom AI Platform — Integration Reference

**Last updated:** 2026-04-28
**Owner:** Platform Engineering

This document covers everything needed to understand, configure, and troubleshoot the Appraisal Management Platform's integration with the Axiom AI Platform.

---

## Table of Contents

1. [Tenant Identity Mapping](#tenant-identity-mapping)
2. [Auth Configuration](#auth-configuration)
3. [Idempotency Policy](#idempotency-policy)
4. [Pipeline Modes](#pipeline-modes)
5. [Risk Score Events](#risk-score-events)
6. [Environment Variable Reference](#environment-variable-reference)

---

## Tenant Identity Mapping

Axiom partitions data by **`clientId`** (top-level platform identity) and **`subClientId`** (per-lender/AMC identity).

### Platform-level identity (same for all submissions)

| Field | Value | Notes |
|---|---|---|
| `clientId` | `vision` | Registered platform account — never changes per-order |
| default `subClientId` | `platform` | Used only for seed data and integration tests; production orders always carry a lender-specific slug |

> **CRITICAL — `clientId` and `subClientId` are NEVER global env vars at runtime.**
> The application reads them from the `order` document at submission time.
> `AXIOM_CLIENT_ID` / `AXIOM_SUB_CLIENT_ID` exist **only** in the seed bootstrap section of `.env.example` and are read only by `src/scripts/seed/index.ts`.

### Per-lender subClientId mapping

Each lender/AMC registered in our platform has a short slug that becomes the `subClientId` sent to Axiom for every order belonging to that client:

| Our Cosmos `clientId` | Axiom `subClientId` slug | Entity type |
|---|---|---|
| `seed-client-lender-firsthorizon-001` | `firsthorizon` | Lender |
| `seed-client-lender-pacificcoast-002` | `pacificcoast` | Lender |
| `seed-client-amc-nationalamc-003` | `nationalamc` | AMC |
| `seed-client-amc-clearpath-004` | `clearpath` | AMC |
| `seed-client-broker-suncoast-005` | `suncoast` | Broker |
| `seed-client-cu-firsttechfcu-006` | `firsttechfcu` | Credit Union |

The mapping lives in [`src/scripts/seed/seed-ids.ts:SUB_CLIENT_SLUGS`](../src/scripts/seed/seed-ids.ts).

At runtime the auto-trigger service resolves the `subClientId` as:
```
order.subClientId ?? clientConfig.axiomSubClientId ?? ''
```

New productions tenants require: (a) a `subClientId` slug agreed with the Axiom team; (b) that slug stored in either the order document or the `ClientAutomationConfig` (`axiomSubClientId` field) in the `client-configs` Cosmos container.

---

## Auth Configuration

### Development (default)

Axiom dev (`axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`) accepts unauthenticated calls. Set:

```dotenv
AXIOM_AUTH_REQUIRED=false
# AXIOM_API_KEY and AXIOM_AUTH_AUDIENCE are not needed in dev
```

The service will send no `Authorization` header and all calls will succeed against dev.

### Production (managed identity)

Axiom production requires a bearer token from an Entra ID app registration:

```dotenv
AXIOM_AUTH_REQUIRED=true
AXIOM_AUTH_AUDIENCE=api://<axiom-app-registration-guid>
# Do NOT set AXIOM_API_KEY when using managed identity
```

When `AXIOM_AUTH_REQUIRED=true`, the service acquires tokens via `DefaultAzureCredential.getToken('${AXIOM_AUTH_AUDIENCE}/.default')` and attaches `Authorization: Bearer <token>` to every outbound request. Tokens are cached until 2 minutes before expiry.

### Opt-in to managed identity without the flag (legacy)

Set `AXIOM_USE_DEFAULT_CREDENTIAL=true` (kept for backward compatibility — prefer `AXIOM_AUTH_REQUIRED=true` for new deployments).

---

## Idempotency Policy

Per Axiom Quickstart §10, Axiom deduplicates submissions within **60 seconds** using `(fileSetId, content, pipelineVersion)` as the compound key.

### Our deduplication strategy

| Trigger | Behavior | rationale |
|---|---|---|
| Auto-trigger on order created | Standard submission — uses a `correlationId` derived from `orderId` | Idempotent within 60s: accidental double-triggers are safe |
| Reviewer clicks **"Re-run AI"** | `forceResubmit=true` flow — appends `~r{timestamp}` suffix to both `correlationId` and `fileSetId` to defeat Redis dedup | The reviewer explicitly intends a fresh run; we must not silently return a cached result |
| Criteria reevaluation (cascade) | New `correlationId` per trigger; deduped in-flight by the `CriteriaReevaluationHandler` via an in-memory Set keyed on `orderId:fieldNorm:newValue` | Prevents multiple simultaneous cascade submissions for the same field change |

### When NOT to use `forceResubmit`

- Background automation (auto-trigger, batch jobs)
- Within 60 seconds of a prior submission for the same order
- Any case where the user has NOT explicitly requested a redo

The `forceResubmit` path requires a **confirmation modal** in the UI before calling the mutation. The current "Re-run AI" button in `AxiomAnalysisTab` does NOT show a modal (the 60s automatic dedup makes accidental double-submits safe without the modal). If this changes, add the modal before enabling `forceResubmit`.

---

## Pipeline Modes

| Mode | Axiom pipeline name | Used for |
|---|---|---|
| `FULL_PIPELINE` | `complete-document-criteria-evaluation` | Single-order end-to-end (extraction + criteria) |
| `EXTRACTION_ONLY` | `adaptive-document-processing` | Document data extraction without criteria evaluation |
| `CRITERIA_ONLY` | `criteria-only-evaluation` | Re-run criteria against already-extracted data |
| `BULK_EVAL` | _(inline Loom definition)_ | Batch portfolio evaluation |

Default per-order auto-trigger uses `adaptive-document-processing` (extraction only). Criteria are evaluated via a separate `POST /api/axiom/criteria/evaluate` call.

Override any pipeline with registered Cosmos template UUIDs (when Axiom provisions them):
```dotenv
AXIOM_PIPELINE_ID_RISK_EVAL=<uuid>
AXIOM_PIPELINE_ID_DOC_EXTRACT=<uuid>
AXIOM_PIPELINE_ID_BULK_EVAL=<uuid>
```

---

## Risk Score Events

When a completed evaluation carries an `overallRiskScore` at or above the threshold, the service publishes an `axiom.risk.threshold.crossed` Service Bus event.

**Default threshold:** 70 (configurable via `AXIOM_RISK_THRESHOLD` env var)

**Event payload:**

```json
{
  "type": "axiom.risk.threshold.crossed",
  "data": {
    "orderId": "<order-id>",
    "tenantId": "<tenant-id>",
    "evaluationId": "<eval-id>",
    "overallRiskScore": 85,
    "riskThreshold": 70,
    "timestamp": "2026-04-28T12:00:00.000Z"
  }
}
```

**Consumer responsibilities** (to be implemented — currently publisher only):
- Route order to senior QC analyst queue
- Trigger escalation notification
- Flag for manual review before final report delivery

---

## Environment Variable Reference

| Variable | Required | Default | Notes |
|---|---|---|---|
| `AXIOM_API_BASE_URL` | Yes (live) | — | Full URL to Axiom API. Omit to use mock mode. |
| `AXIOM_AUTH_REQUIRED` | No | — (legacy heuristic) | `false` = no auth (dev), `true` = require DefaultAzureCredential |
| `AXIOM_AUTH_AUDIENCE` | Cond. | — | Required when `AXIOM_AUTH_REQUIRED=true`. Axiom app registration URI: `api://<guid>` |
| `AXIOM_API_KEY` | No | — | Static bearer token (for API-key-protected endpoints only). Mutually exclusive with DefaultAzureCredential. |
| `AXIOM_FORCE_MOCK` | No | `false` | Force mock mode even if `AXIOM_API_BASE_URL` is set |
| `AXIOM_MOCK_DELAY_MS` | No | `8000` | Simulated latency in mock mode |
| `AXIOM_RISK_THRESHOLD` | No | `70` | `overallRiskScore` ≥ this triggers `axiom.risk.threshold.crossed` |
| `AXIOM_USE_DEFAULT_CREDENTIAL` | No | `false` | Legacy opt-in. Prefer `AXIOM_AUTH_REQUIRED=true`. |
| `AXIOM_CB_FAILURE_THRESHOLD` | No | `5` | Circuit breaker opens after N consecutive 5xx responses |
| `AXIOM_CB_OPEN_MS` | No | `60000` | Circuit breaker stays open for N ms before allowing probe |
| `AXIOM_PIPELINE_ID_RISK_EVAL` | No | _(inline Loom)_ | Override with a registered Axiom pipeline UUID |
| `AXIOM_PIPELINE_ID_DOC_EXTRACT` | No | _(inline Loom)_ | Override with a registered Axiom pipeline UUID |
| `AXIOM_PIPELINE_ID_BULK_EVAL` | No | _(inline Loom)_ | Override with a registered Axiom pipeline UUID |

**Seed-only variables** (read by `src/scripts/seed/index.ts` — not used at runtime):

| Variable | Value | Notes |
|---|---|---|
| `AXIOM_CLIENT_ID` | `vision` | Stamps `clientId` on seed documents |
| `AXIOM_SUB_CLIENT_ID` | `platform` | Default `subClientId` for seed documents only |
