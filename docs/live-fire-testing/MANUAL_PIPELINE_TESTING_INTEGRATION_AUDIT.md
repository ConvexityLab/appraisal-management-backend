# Manual Pipeline Testing — Integration Path Audit

> **Audience:** AI coding agents (Copilot, Claude, etc.) and developers evaluating whether
> Sentinel's three integration paths to Axiom will successfully submit and monitor pipeline
> executions, based on live-fire testing knowledge.
>
> **Companion doc:** `MANUAL_PIPELINE_TESTING.md` (same directory) covers ad-hoc curl-based testing.
>
> **Last validated:** 2026-03-24 against source code in `sentinel` and `axiom` repos.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Axiom Contract Recap (from live-fire testing)](#2-axiom-contract-recap)
3. [Path 1 — Process Orchestration](#3-path-1--process-orchestration)
4. [Path 2 — Documents Gateway](#4-path-2--documents-gateway)
5. [Path 3 — ECA Fire-and-Forget](#5-path-3--eca-fire-and-forget)
6. [Cross-Cutting Issues](#6-cross-cutting-issues)
7. [Verdict Matrix](#7-verdict-matrix)
8. [Recommended Fixes](#8-recommended-fixes)

---

## 1. Executive Summary

Three Sentinel code paths submit pipelines to Axiom. After reading every relevant
source file and comparing them against the Axiom API contract we validated during
live-fire testing, the findings are:

| Path | Will Submit? | Will Monitor? | Severity |
|---|---|---|---|
| **1: Process Orchestration** | ⚠️ Almost | ✅ Yes | Medium — data-layer gaps |
| **2: Documents Gateway** | ❌ No | ⚠️ Partial | High — body schema mismatch |
| **3: ECA Handler** | ⚠️ Almost | ❌ None (by design) | Medium — missing `clientId` |

**Path 1** is closest to working. **Path 2** has a fundamental payload mismatch that
will cause Axiom's Zod validation to reject every request. **Path 3** will fire
correctly only if the ECA subscription's `inputMapping` includes `clientId`.

All three paths share a common data-layer gap: **no seeded pipeline template has a
fully runnable actor set** (all 34 templates reference `DataProvenanceActor`, which
is not registered), and **`documentTypes: []` bypass is not injected** in the
trigger input.

---

## 2. Axiom Contract Recap

These facts were established by submitting real pipelines to the deployed Axiom instance.
See `MANUAL_PIPELINE_TESTING.md` for the full details.

### POST /api/pipelines — Request Body

Axiom accepts exactly one of two modes:

| Mode | Body | When to Use |
|---|---|---|
| **A — Inline pipeline** | `{ pipeline: { name, version, stages[] }, input: { clientId, tenantId, ... } }` | Ad-hoc runs, process orchestration |
| **B — Template reference** | `{ pipelineId: "<slug>", input: { clientId, tenantId, ... } }` | ECA-triggered runs referencing registered templates |

**Zod schema** (from `axiom/src/api/validation/schemas.ts`):
- Must provide either `pipelineId` or `pipeline`, never both.
- `input` is **required** (`z.record(z.string(), z.unknown())`).
- After Zod, the route handler validates: `input.clientId` required, `input.tenantId` required.

### Inline Pipeline Requirements

| Field | Required | Notes |
|---|---|---|
| `pipeline.name` | ✅ | Non-empty string |
| `pipeline.version` | ✅ | Non-empty string (e.g., `"1.0.0"`) — rejected if missing |
| `pipeline.stages[]` | ✅ | Non-empty array |
| `stage.name` | ✅ | Unique within pipeline |
| `stage.actor` | ✅ | Must match a registered actor |
| `stage.mode` | ✅ | One of: `single`, `scatter`, `gather`, `broadcast`, `fork-join`, `human-approval`, `activate-actor`, `sub-pipeline` |
| `stage.input` | ✅ | `SingleExecutor.validate()` requires `!!stage.input` — `config` alone is NOT sufficient |

### Seeded Data (dev environment)

- **10 actors:** completepdfprocessor, criterialoader, criterionevaluator, resultsaggregator, marketplacetransferactor, carpromotionactor, agentanalysisactor, marketplaceposttransferactor, processrungateactor, depositclassificationactor
- **Best tenant/client:** `tenantId: "acme-lending"`, `clientId: "acme-main"`
- **DataProvenanceActor** is NOT seeded — all 34 templates will fail with `[missing-actors]`

### documentTypes Bypass

Passing `documentTypes: []` in `input` prevents `CompletePipelineRunner.loadDocumentTypesFromRegistry()`
from querying Cosmos. When omitted, the lookup runs but returns `[]` anyway for unseeded tenants
(non-fatal, but adds a Cosmos round-trip and an empty fact-set).

---

## 3. Path 1 — Process Orchestration

**Flow:** UI → `POST /api/processes/runs` → `processController.ts` → `AxiomClient.submitProcessPipeline()` → Axiom

### Source Files

| File | Role |
|---|---|
| `sentinel/packages/api-server/src/controllers/processController.ts` | Resolves ProcessTemplate, builds triggerInput, injects webhooks, stores ProcessRun |
| `sentinel/packages/api-server/src/clients/AxiomClient.ts` (`submitProcessPipeline`) | HTTP client — sends `{ pipeline, input, webhooks }` to `/api/pipelines` |
| `sentinel/packages/api-server/src/controllers/webhooksController.ts` | Receives Axiom webhook callbacks, fans out to SSE |
| `sentinel/ui/src/platform/useProcessRun.ts` | Polls ProcessRun + opens EventSource for stage events |
| `sentinel/ui/src/platform/WorkflowRunner.tsx` | Renders live stage log, capability components, terminal state |

### Submission Analysis

**URL:** `submitProcessPipeline()` constructs `${getApiRootUrl()}/pipelines`. `getApiRootUrl()` strips
any `/v\d+$` suffix from `AXIOM_API_BASE_URL`. Result: `/api/pipelines` ✅

**Body:** `{ pipeline: <template.pipeline>, input: <triggerInput>, webhooks: [...] }` — Mode A (inline).
Matches Axiom's Zod schema ✅

**triggerInput construction** (processController lines 265–275):
```typescript
const triggerInput = {
  clientId: tenantId,    // ⚠️ Uses tenantId AS clientId
  tenantId,
  entityType, entityId, processKey,
  sentinelApiBase: sentinelBase,
  initiatedBy: createdBy,
  ...(entityFacts ?? {}),
};
```

| Field | Status | Issue |
|---|---|---|
| `clientId` | ⚠️ | Set to `tenantId`. Works only if tenant and client IDs match (e.g., `acme-lending` as both). In live-fire, we used `clientId: "acme-main"` and `tenantId: "acme-lending"` — those don't match. |
| `tenantId` | ✅ | Always present |
| `documentTypes` | ❌ | **Not injected.** Axiom will query Cosmos for document types — non-fatal but produces an empty fact-set |
| `pipeline.version` | ❓ | Depends on the stored `ProcessTemplate.pipeline` object. If the template lacks `version`, Axiom rejects with 400 |
| Stage actors | ❌ | All 34 templates need `DataProvenanceActor` — not registered in dev |

### Webhook Injection

```typescript
webhooks: [
  { id: `${runId}-durable`,   url: `${sentinelBase}/webhooks/axiom/state`,             type: 'durable',   events: ['pipeline.started', ...] },
  { id: `${runId}-ephemeral`, url: `${sentinelBase}/webhooks/axiom/stream/${runId}`,   type: 'ephemeral', events: ['stage.started', ...] },
]
```

`sentinelBase` = `SENTINEL_API_BASE`. The error hint says `"http://sentinel-api/api"` (includes `/api`).
- Durable URL → `http://host/api/webhooks/axiom/state` → matches Fastify route (prefix `/api` + `/webhooks/axiom/state`) ✅
- Ephemeral URL → `http://host/api/webhooks/axiom/stream/<runId>` ✅

**⚠️ This requires `SENTINEL_API_BASE` to include `/api`. See Cross-Cutting Issue #1.**

### Monitoring

| Component | Verdict | Notes |
|---|---|---|
| Durable webhook → Cosmos + tenant SSE + ECA | ✅ | Secret validation, deduplication by `axiomEventId`, `publishEvent()` |
| Ephemeral webhook → session SSE | ✅ | In-memory `Map<string, Set<writer>>`, cleaned on disconnect |
| `useProcessRun` EventSource | ✅ | Connects to `/api/webhooks/axiom/stream/${runId}`, parses SSE JSON, sorts by `sequenceNumber` |
| `useProcessRun` polling | ✅ | TanStack Query polls every 3s, stops on terminal status |
| `WorkflowRunner` render | ✅ | Shows `LiveStageLog` for running, `CapabilityComponent` for paused, `TerminalState` for done |
| Status proxy | ⚠️ | `getProcessPipelineStatus()` has **dead variable bug** (see Issue #3) |

### Approval Loop

The full human-in-the-loop cycle works:
1. Axiom pauses at `human-approval` stage → calls `POST /processes/runs/:id/approval`
2. Sentinel creates `ReviewSession`, sets run status to `paused`
3. WorkflowRunner renders the capability component
4. User submits → `POST /processes/runs/:id/approval/submit` → forwards to Axiom → pipeline resumes
5. Gate-only runs (created by `ProcessRunGateActor` via `POST /processes/open-gate`) skip the Axiom
   forwarding step and complete locally with ECA downstream event firing

**Verdict: Approval loop is well-implemented.** ✅

---

## 4. Path 2 — Documents Gateway

**Flow:** UI → `POST /api/pipelines` → `documentsController.ts` → `AxiomClient.submitPipeline()` → Axiom

### Source Files

| File | Role |
|---|---|
| `sentinel/packages/api-server/src/controllers/documentsController.ts` | Injects webhooks, proxies to `axiomClient.submitPipeline()` |
| `sentinel/packages/api-server/src/clients/AxiomClient.ts` (`submitPipeline`) | HTTP client — sends document-oriented payload |

### Submission Analysis

**URL:** `submitPipeline()` uses `this.request('POST', '/pipelines')` which constructs
`${this.baseUrl}/pipelines`. If `AXIOM_API_BASE_URL = ".../api"`, this → `/api/pipelines` ✅
If it includes `/v1`, this → `/api/v1/pipelines` ❌ (Axiom has no v1 routes).

**Body — CRITICAL MISMATCH:**

`AxiomClient.submitPipeline()` signature (lines 330–343):
```typescript
async submitPipeline(params: {
  documentId: string;
  pipelineType: PipelineType;
  clientId: string;
  tenantId: string;
  options?: Record<string, unknown>;
  webhooks?: WebhookConfig[];
  delegationToken?: string;
}): Promise<PipelineExecution>
```

This sends `{ documentId, pipelineType, clientId, tenantId, options, webhooks }` to Axiom.

Axiom's Zod schema expects `{ pipelineId | pipeline, input }`.

| Axiom Requires | Sentinel Sends | Match? |
|---|---|---|
| `pipeline` or `pipelineId` | Neither — sends `pipelineType` | ❌ |
| `input` (required) | Not present | ❌ |
| — | `documentId` (unknown field) | Stripped by Zod |
| — | `pipelineType` (unknown field) | Stripped by Zod |

**This will fail with Zod validation error: "Must provide either pipelineId or pipeline".**

### Webhook Injection

```typescript
{ url: `${sentinelBase}/api/webhooks/axiom/state`, type: 'durable', ... }
{ url: `${sentinelBase}/api/webhooks/axiom/stream/${sessionId}`, type: 'ephemeral', ... }
```

Here `sentinelBase` = `SENTINEL_API_BASE`. The error hint says `"http://localhost:3000"` (origin, no `/api`).
- URLs include explicit `/api/` prefix → `http://host/api/webhooks/axiom/state`

**⚠️ This requires `SENTINEL_API_BASE` to NOT include `/api`. Conflicts with Path 1. See Issue #1.**

### Monitoring (independent of submission)

| Component | Verdict | Notes |
|---|---|---|
| Polling SSE (`/pipelines/:id/events`) | ✅ | Polls Axiom every 2s, pushes progress events over SSE. Works for any pipeline submitted through another path |
| Raw proxy (`/pipelines/executions/*`) | ✅ | Correctly uses `getApiRootUrl()` to strip `/v1` |
| `getPipelineStatus()` | ⚠️ | Uses `this.baseUrl` — same conditional `/v1` issue |

---

## 5. Path 3 — ECA Fire-and-Forget

**Flow:** Sentinel event → Eventra engine → `SubmitAxiomPipelineHandler` → `POST /api/pipelines` on Axiom

### Source Files

| File | Role |
|---|---|
| `sentinel/packages/api-server/src/eca/handlers/SubmitAxiomPipelineHandler.ts` | Maps event fields to pipeline input, calls Axiom |
| `sentinel/packages/api-server/src/eca/ecaBootstrap.ts` | Wires handler with `AXIOM_ENDPOINT` env var |

### Submission Analysis

**URL:** `${this.axiomBaseUrl}/api/pipelines` where `axiomBaseUrl` = `AXIOM_ENDPOINT` (origin).
Produces correct `/api/pipelines` ✅

**Body:** `{ pipelineId, input }` — Mode B (template reference). Matches Axiom's Zod schema ✅

**Input construction** (lines 68–77):
```typescript
const input = {
  ...mappedInput,           // from ECA subscription inputMapping
  tenantId: event.tenantId, // always injected
  correlationId: event.correlationId ?? event.id,
  ...(sentinelApiBase ? { sentinelApiBase } : {}),
};
```

| Field | Status | Issue |
|---|---|---|
| `clientId` | ❌ | **Not explicitly injected.** Relies on `inputMapping` config in the ECA subscription. If mapping omits it, Axiom rejects: `"clientId is required in input"` |
| `tenantId` | ✅ | Always present |
| `documentTypes` | ❌ | Not injected. Cosmos lookup triggered |
| Template actors | ❌ | Same issue — all 34 templates need `DataProvenanceActor` |

### Monitoring

Fire-and-forget by design. No webhooks injected. No SSE. No status tracking beyond
the ECA execution log in Cosmos (success/failure of the HTTP POST itself).

---

## 6. Cross-Cutting Issues

### Issue 1: `SENTINEL_API_BASE` Convention Conflict (BUG)

**processController** (line 297):
```typescript
url: `${sentinelBase}/webhooks/axiom/state`
```
Error hint: `"Set it to … http://sentinel-api/api"` (includes `/api`).

**documentsController** (line 271):
```typescript
url: `${sentinelBase}/api/webhooks/axiom/state`
```
Error hint: `"Set it to … http://localhost:3000"` (origin only).

**Impact:** One of these will produce a broken webhook callback URL at runtime.

| If `SENTINEL_API_BASE` is... | processController webhook | documentsController webhook |
|---|---|---|
| `http://host/api` | `http://host/api/webhooks/axiom/state` ✅ | `http://host/api/api/webhooks/axiom/state` ❌ |
| `http://host` | `http://host/webhooks/axiom/state` ❌ | `http://host/api/webhooks/axiom/state` ✅ |

**Fix:** Standardize on one convention. Recommended: `SENTINEL_API_BASE` = origin (no `/api`), and
update processController to prepend `/api` like documentsController does.

### Issue 2: `AxiomClient.submitPipeline()` Schema Mismatch

The method's TypeScript signature and the body it sends (`documentId`, `pipelineType`, `clientId`,
`tenantId`) do not match Axiom's current `POST /api/pipelines` Zod schema. This method was likely
designed for an earlier Axiom API surface. Any code calling it will receive a Zod rejection.

**Fix:** Update `submitPipeline()` to accept and send `{ pipelineId | pipeline, input, webhooks }`,
or deprecate it and route all callers through `submitProcessPipeline()`.

### Issue 3: `getProcessPipelineStatus()` Dead Variable

```typescript
async getProcessPipelineStatus(jobId: string): Promise<...> {
    const url = `${this.getApiRootUrl()}/pipelines/${encodeURIComponent(jobId)}`;
    //    ^^^^ carefully strips /v1 — but never used
    return this.request('GET', `/pipelines/${encodeURIComponent(jobId)}`);
    //     ^^^^ uses this.baseUrl instead
}
```

If `AXIOM_API_BASE_URL` includes `/v1`, status checks will 404 at `/api/v1/pipelines/:id`.

**Fix:** Either use the constructed `url` variable directly (bypass `this.request()`), or fix
`this.request()` to use `getApiRootUrl()`, or ensure `AXIOM_API_BASE_URL` is set to `/api` (no `/v1`).

### Issue 4: Two Env Vars for the Same Service

| Env Var | Used By | Value Convention |
|---|---|---|
| `AXIOM_API_BASE_URL` | `AxiomClient` | Full API path (`https://host/api` or `https://host/api/v1`) |
| `AXIOM_ENDPOINT` | `SubmitAxiomPipelineHandler` | Origin only (`https://host`) |

Not broken if both are set consistently, but fragile and confusing.

### Issue 5: No Runnable Pipeline Templates

All 34 seeded pipeline templates reference actors that don't exist in the dev actor registry.
This blocks every template-based submission (Path 1 from Cosmos, Path 3 via `pipelineId`).

**Fix:** Either seed `DataProvenanceActor` in Axiom, or create pipeline templates that use only
the 10 actors already seeded (criterialoader, resultsaggregator, etc.).

---

## 7. Verdict Matrix

### Submission

| Path | URL Correct? | Body Valid? | Input Complete? | Actors Available? | Overall |
|---|---|---|---|---|---|
| 1: Process Orch | ✅ | ✅ | ⚠️ (clientId=tenantId, no documentTypes) | ❌ | ⚠️ Almost |
| 2: Documents GW | ⚠️ (conditional on no `/v1`) | ❌ (wrong schema) | N/A | N/A | ❌ Broken |
| 3: ECA Handler | ✅ | ✅ | ❌ (no clientId guarantee) | ❌ | ⚠️ Almost |

### Monitoring

| Path | Webhook Injection | Webhook Receipt | SSE to UI | Polling | Overall |
|---|---|---|---|---|---|
| 1: Process Orch | ⚠️ (depends on SENTINEL_API_BASE) | ✅ | ✅ | ✅ | ✅ |
| 2: Documents GW | ⚠️ (conflicts with Path 1) | ✅ | ✅ (polling-based) | ✅ | ⚠️ Partial |
| 3: ECA Handler | ❌ None injected | N/A | N/A | N/A | ❌ None |

### Human-in-the-Loop (Approval)

| Component | Status |
|---|---|
| `POST /processes/runs/:id/approval` (Axiom → Sentinel) | ✅ Creates ReviewSession, sets run to paused |
| `POST /processes/open-gate` (ProcessRunGateActor → Sentinel) | ✅ Idempotent, with rollback on partial failure |
| `POST /processes/runs/:id/approval/submit` (UI → Sentinel → Axiom) | ✅ Forwards to Axiom, fires downstream ECA events |
| WorkflowRunner UI component | ✅ Renders capability components, handles all states |

---

## 8. Recommended Fixes

Listed in priority order. All are code changes in `sentinel` — no infrastructure modifications.

### Fix 1 — Standardize `SENTINEL_API_BASE` webhook URL convention

**Severity:** High (one of two paths silently produces broken callbacks)
**Files:** `processController.ts`
**Change:** Prepend `/api` to webhook URLs (matching documentsController's convention):
```diff
- url: `${sentinelBase}/webhooks/axiom/state`,
+ url: `${sentinelBase}/api/webhooks/axiom/state`,

- url: `${sentinelBase}/webhooks/axiom/stream/${runId}`,
+ url: `${sentinelBase}/api/webhooks/axiom/stream/${runId}`,
```

### Fix 2 — Update `AxiomClient.submitPipeline()` payload

**Severity:** High (every call to this method will be rejected by Axiom)
**Files:** `AxiomClient.ts`
**Change:** Align the method signature and body with Axiom's current Zod schema:
```typescript
async submitPipeline(params: {
  pipelineId?: string;
  pipeline?: unknown;
  input: Record<string, unknown>;
  webhooks?: WebhookConfig[];
  delegationToken?: string;
}): Promise<PipelineExecution>
```

### Fix 3 — Fix `getProcessPipelineStatus()` dead variable

**Severity:** Medium (status checks may 404 depending on env var value)
**Files:** `AxiomClient.ts`
**Change:** Use `getApiRootUrl()` for the path prefix, matching `submitProcessPipeline()`.

### Fix 4 — Inject `documentTypes: []` in processController triggerInput

**Severity:** Low (non-fatal, but avoids an unnecessary Cosmos round-trip)
**Files:** `processController.ts`
**Change:** Add `documentTypes: []` to `triggerInput`.

### Fix 5 — Inject `clientId` in SubmitAxiomPipelineHandler

**Severity:** Medium (missing clientId = Axiom rejection)
**Files:** `SubmitAxiomPipelineHandler.ts`
**Change:** Default `clientId` to `event.tenantId` (matching processController) when not provided by `inputMapping`.

### Fix 6 — Seed `DataProvenanceActor` or create runnable templates

**Severity:** High (blocks all template-based submissions)
**Action:** Either register the actor in Axiom, or create new pipeline templates using only the 10 existing actors.

---

*Generated 2026-03-24 from source code analysis of sentinel and axiom repositories.*
