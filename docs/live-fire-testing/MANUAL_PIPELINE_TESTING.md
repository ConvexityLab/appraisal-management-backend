# Manual Pipeline Testing — Ad-Hoc Guide

> **Audience:** AI coding agents (Copilot, Claude, etc.) and developers who need to manually
> submit pipelines to a deployed Axiom instance, watch SSE streams, and verify results
> via curl / PowerShell — without running the automated Vitest live-fire suite.
>
> **Last validated:** 2026-03-24 against `axiom-dev-api` in eastus.

---

## Table of Contents

1. [Quick Reference — Copy-Paste Recipes](#1-quick-reference)
2. [Environment URLs](#2-environment-urls)
3. [Pipeline Submission API — Exact Contract](#3-pipeline-submission-api)
4. [Loom Stage DSL — Required Fields](#4-loom-stage-dsl)
5. [Executor Modes — Complete Reference](#5-executor-modes)
6. [Seeded Actors (Cosmos DB)](#6-seeded-actors)
7. [Seeded Data — clientId / tenantId Combos](#7-seeded-data)
8. [Bypassing Pre-Flight Checks](#8-bypassing-pre-flight-checks)
9. [Observing Execution — SSE Endpoints](#9-observing-execution)
10. [Checking Results](#10-checking-results)
11. [Common Errors and Fixes](#11-common-errors-and-fixes)
12. [Worked Example — Full E2E](#12-worked-example)
13. [PowerShell Gotchas](#13-powershell-gotchas)
14. [Architecture Notes for Agents](#14-architecture-notes)

---

## 1. Quick Reference

### Minimal Working Pipeline Submission (PowerShell)

```powershell
$payload = @'
{"pipeline":{"name":"e2e-smoke","version":"1.0.0","stages":[{"name":"load-criteria","actor":"CriteriaLoader","mode":"single","input":{"criteriaSetId":"canonical-criteria","clientId":"acme-main","tenantId":"acme-lending"}},{"name":"aggregate-results","actor":"ResultsAggregator","mode":"single","input":{"mode":"simple"},"dependsOn":["load-criteria"]}]},"input":{"clientId":"acme-main","tenantId":"acme-lending","documentTypes":[]}}
'@
[System.IO.File]::WriteAllText("$env:TEMP\pipeline.json", $payload)
$axiom = "https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io"
curl.exe -s -X POST "$axiom/api/pipelines" -H "Content-Type: application/json" -d "@$env:TEMP\pipeline.json"
```

### Watch SSE Stream

```powershell
# Replace $jobId with the jobId from the submission response
curl.exe -s -N "$axiom/api/pipelines/$jobId/observe" --max-time 60
```

### Check Status & Results

```powershell
curl.exe -s "$axiom/api/pipelines/$jobId" | ConvertFrom-Json | ConvertTo-Json -Depth 10
curl.exe -s "$axiom/api/pipelines/$jobId/results" | ConvertFrom-Json | ConvertTo-Json -Depth 20
```

---

## 2. Environment URLs

| Environment | API Base URL |
|---|---|
| **Dev** | `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io` |

Other endpoints on the same base:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check — shows subsystem status |
| `/api/pipelines` | POST | Submit a pipeline |
| `/api/pipelines/:jobId` | GET | Poll execution status |
| `/api/pipelines/:jobId/results` | GET | Retrieve final results |
| `/api/pipelines/:jobId/stream` | GET | SSE stream (Redis Streams, resumable) |
| `/api/pipelines/:jobId/observe` | GET | SSE stream (Redis Pub/Sub + snapshot) |
| `/api/actors` | GET | List all registered actors in Cosmos |
| `/api/schemas` | GET | List all seeded schemas |

---

## 3. Pipeline Submission API

### `POST /api/pipelines`

**Content-Type:** `application/json`

**Returns:** `202 Accepted` with `{ jobId, status, pipeline, submittedAt, estimatedDuration, message }`

There are two submission modes:

### Mode A: Inline Pipeline Definition (recommended for ad-hoc testing)

```json
{
  "pipeline": {
    "name": "my-test-pipeline",
    "version": "1.0.0",
    "stages": [ /* Loom stage definitions — see Section 4 */ ]
  },
  "input": {
    "clientId": "acme-main",
    "tenantId": "acme-lending",
    "documentTypes": []
  }
}
```

### Mode B: Pipeline Template Reference

```json
{
  "pipelineId": "text-based-document-processing",
  "input": {
    "clientId": "acme-main",
    "tenantId": "acme-lending"
  }
}
```

> **Warning:** Mode B resolves the template from Cosmos DB via `PipelineTemplateRegistry.get(id)`.
> As of 2026-03-24, **no seeded template uses exclusively seeded actors** — all 34 templates
> reference actors like `DataProvenanceActor` that are not in the actor registry. **Use Mode A (inline).**

### Required Top-Level Pipeline Fields

| Field | Required | Notes |
|---|---|---|
| `pipeline.name` | **YES** | Throws `Pipeline name is required` at `complete-pipeline-runner.ts:722` |
| `pipeline.version` | **YES** | Throws `Pipeline version is required` at `complete-pipeline-runner.ts:725` |
| `pipeline.stages` | **YES** | Array of stage definitions |

### Required Input Fields

| Field | Required | Notes |
|---|---|---|
| `input.clientId` | YES | Must match seeded data in Cosmos (see Section 7) |
| `input.tenantId` | YES | Must match seeded data in Cosmos (see Section 7) |
| `input.documentTypes` | **Conditional** | Pass `[]` to skip the `loadDocumentTypesFromRegistry` Cosmos lookup. Omitting this field triggers the lookup, which requires matching document types in Cosmos (see Section 8). |

---

## 4. Loom Stage DSL

Each stage in the `stages` array must have these fields:

```json
{
  "name": "my-stage-name",
  "actor": "CriteriaLoader",
  "mode": "single",
  "input": { "key": "value" }
}
```

### Required Fields Per Stage

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | **YES** | Unique stage name within the pipeline |
| `actor` | string | **YES** | Actor type — must match a registered actor in Cosmos `actors` container. Case-sensitive for Cosmos lookup but PascalCase names work (e.g., `CriteriaLoader`, `ResultsAggregator`). |
| `mode` | string | **YES** | Executor mode — see Section 5 for valid values |
| `input` | object | **YES for `single` mode** | Stage input data. The `SingleExecutor.validate()` checks `!!stage.actor && !!stage.input` — if input is missing/falsy, you get `Invalid configuration for single executor in stage <name>`. |
| `dependsOn` | string[] | Optional | Array of stage names this stage waits for |
| `config` | object | Optional | Additional configuration (NOT the same as `input` — `config` alone does NOT satisfy the `single` executor validation) |
| `scatter` | object | Required for scatter mode | `{ input: "jmespath.expression", as: "variableName" }` |
| `gather` | object | Required for gather mode | `{ stage: "source-stage-name" }` |
| `executorConfig` | object | Optional | Executor-specific tuning (e.g., `maxParallel` for scatter) |

> **CRITICAL:** For `single` mode, the `input` field is **mandatory**. Passing only `config`
> without `input` will fail with `Invalid configuration for single executor in stage <name>`.
> This validation lives in `@certo-ventures/loom` at
> `dist/src/pipelines/builtin-executors.js` → `SingleExecutor.validate()`.

---

## 5. Executor Modes

The Loom `PipelineOrchestrator` uses pluggable executors registered in a Map. Available modes:

| Mode | Description | Required Stage Fields | Validated By |
|---|---|---|---|
| **`single`** | Execute one actor with one input | `actor`, `input` | `!!stage.actor && !!stage.input` |
| **`scatter`** | Fan-out over an array, one task per item | `scatter.input`, `scatter.as` | `!!stage.scatter && !!stage.scatter.input && !!stage.scatter.as` |
| **`gather`** | Collect outputs from a scatter stage | `gather.stage` | `!!stage.gather && !!stage.gather.stage` |
| **`broadcast`** | Send to multiple actors | `executorConfig.actors` | (see executor source) |
| **`fork-join`** | Parallel branches that join | `executorConfig.branches` | (see executor source) |
| **`human-approval`** | Pause pipeline for human decision | `config.approvalConfig` | (see executor source) |
| **`activate-actor`** | Route via `ActorMessageDispatcher` | `actor` | (see executor source) |
| **`sub-pipeline`** | Invoke a nested pipeline | `config.subPipeline` | (see executor source) |

> **For ad-hoc testing, use `single` mode.** It's the simplest — one actor, one input, one output.

Invalid mode values produce: `Unknown executor mode: <value>. Available: single, scatter, gather, broadcast, fork-join, human-approval, activate-actor, sub-pipeline`

The executor dispatch lives in `@certo-ventures/loom`:
- `dist/src/pipelines/pipeline-orchestrator.js` → `getExecutor(mode)` (line ~151)
- `dist/src/pipelines/builtin-executors.js` → `SingleExecutor`, `ScatterExecutor`, `GatherExecutor`, etc.

---

## 6. Seeded Actors

These actors are registered in the Cosmos `actors` container and available on the deployed dev environment. Query them live via `GET /api/actors`.

| Actor Type (Cosmos key) | Display Name | JS Reference | Concurrency | Dependencies |
|---|---|---|---|---|
| `completepdfprocessor` | CompletePdfProcessorActor | `CompletePdfProcessorActor.js` | 2 | CosmosClient, BlobServiceClient, ConfigService |
| `criterialoader` | CriteriaLoaderActor | `CriteriaLoaderActor.js` | 1 | ActorContext, CriteriaRepository, CriteriaCompilerService, ConfigService |
| `criterionevaluator` | CriterionEvaluatorActor | `CriterionEvaluatorActor.js` | 4 | ActorContext, ConfigService |
| `resultsaggregator` | ResultAggregatorActor | `ResultAggregatorActor.js` | 1 | ActorContext, ConfigService |
| `marketplacetransferactor` | MarketplaceTransferActor | `MarketplaceTransferActor.js` | — | — |
| `carpromotionactor` | CARPromotionActor | `CARPromotionActor.js` | — | — |
| `agentanalysisactor` | AgentAnalysisActor | `AgentAnalysisActor.js` | — | — |
| `marketplaceposttransferactor` | MarketplacePostTransferActor | `MarketplacePostTransferActor.js` | — | — |
| `processrungateactor` | ProcessRunGateActor | `ProcessRunGateActor.js` | — | — |
| `depositclassificationactor` | DepositClassificationActor | `DepositClassificationActor.js` | 4 | (none) |

### Safe Actors for Ad-Hoc Testing

For a quick smoke test that doesn't require documents in blob storage or LLM calls:

- **`CriteriaLoader`** — Loads criteria from the criteria service. Returns empty criteria if no matching programVersion exists. Will not crash.
- **`ResultsAggregator`** — Aggregates evaluation results. Returns a summary with 0 criteria if given empty input. Will not crash.
- **`DepositClassificationActor`** — No external dependencies. Good for simple input/output testing.

### Actors That Require External Resources

- **`CompletePdfProcessorActor`** — Needs actual PDF files in Blob Storage
- **`CriterionEvaluatorActor`** — Needs criteria loaded from a prior stage + may invoke LLM

### Actor Name Resolution

When you specify `"actor": "CriteriaLoader"` in a stage, the pipeline runner:
1. Looks up the actor in the Cosmos `actors` container
2. The `actorType` field in Cosmos is **lowercase** (e.g., `criterialoader`)
3. The lookup normalizes the name you provide, so `CriteriaLoader` works
4. Validation at `complete-pipeline-runner.ts:648-681` — checks `validateActorsExist()` against registered actors

---

## 7. Seeded Data

### clientId / tenantId Combinations (from `/api/schemas`)

| tenantId | clientId | Description | Has Criteria? | Has Documents? |
|---|---|---|---|---|
| `certo` | *(none — canonical)* | Canonical v1 schemas (taxonomy, criteria, documents, datafields) | Yes (canonical) | Yes (canonical) |
| `canonical` | *(none — canonical)* | v2 schemas (documents-v2.0.0, criteria-v2.0.0, taxonomy-v2.0.0) | Yes (v2) | Yes (v2) |
| `certo` | `certo-client` | Delta schemas (lender + program level) | Delta | Delta |
| **`acme-lending`** | **`acme-main`** | **Full program delta — Conforming 30yr Fixed** | **Yes (with deltas)** | **Yes (with deltas)** |
| `test` | `test` | Test canonical loan schema | Minimal | Minimal |

> **Recommended for testing:** Use `clientId: "acme-main"`, `tenantId: "acme-lending"`.
> This is the richest seeded dataset with full criteria deltas, document deltas,
> taxonomy deltas, and an `evaluationCodeRegistry`.

### Schema Details

The `acme-lending/acme-main` program delta includes:
- `programId`: implicit in the schema structure
- `criteriaDeltas`: Additions/modifications to canonical criteria
- `documentDeltas`: Additional document types
- `taxonomyDeltas`: Additional taxonomy entries
- `evaluationCodeRegistry`: Custom evaluation code for criteria

---

## 8. Bypassing Pre-Flight Checks

The `CompletePipelineRunner` performs several pre-flight checks before dispatching a pipeline to Loom. Understanding these is critical for ad-hoc testing.

### Document Type Check

**Source:** `complete-pipeline-runner.ts:1212`

```typescript
const documentTypes = request.input.documentTypes
    ?? await this.loadDocumentTypesFromRegistry(request.clientId, request.tenantId);
```

This is a **null coalescing** (`??`) operator. If `documentTypes` is `null` or `undefined`, it queries Cosmos:

```sql
SELECT * FROM c
WHERE c.tenantId = @tenantId
  AND c.clientId = @clientId
  AND c.isEnabled = true
```

If zero results → throws `No document types found in DocumentTypeRegistry for client=${clientId} tenant=${tenantId}`.

**Bypass:** Pass `"documentTypes": []` in the `input` object. The empty array is truthy (not null/undefined), so the null coalescing skips the Cosmos lookup entirely.

> **Important:** `documentTypes: []` is a **bypass**, not a "no documents" signal. It means
> "I'm providing my own document types list and it happens to be empty." This is fine for
> smoke testing actors that don't need document type metadata.

### Actor Validation Check

**Source:** `complete-pipeline-runner.ts:648-681`

The runner loads all actors referenced in pipeline stages and calls `validateActorsExist()`. If any actor isn't registered in the Cosmos `actors` container:

```
Pipeline references non-existent actors: UnknownActor, AnotherFakeActor
```

**Fix:** Only use actor names from Section 6 (seeded actors list).

### Pipeline Version Check

**Source:** `complete-pipeline-runner.ts:725`

```
Pipeline version is required
```

**Fix:** Always include `"version": "1.0.0"` (or any semver string) in the pipeline object.

---

## 9. Observing Execution

### SSE Endpoints

| Endpoint | Backing | Best For |
|---|---|---|
| `GET /api/pipelines/:jobId/stream` | Redis Streams | Production use, resumable via `?from=<lastId>` |
| `GET /api/pipelines/:jobId/observe` | Redis Pub/Sub + snapshot | Ad-hoc testing — emits stage snapshot on connect |

### Connecting via curl

```powershell
# Stream (recommended for long-running)
curl.exe -s -N "$axiom/api/pipelines/$jobId/stream" --max-time 120

# Observe (emits snapshot immediately)
curl.exe -s -N "$axiom/api/pipelines/$jobId/observe" --max-time 60
```

### SSE Event Types (Lifecycle Order)

For a 2-stage `single`-mode pipeline, expect these events in order:

| # | Event Type | When |
|---|---|---|
| 1 | `onStageStart` | Stage begins execution |
| 2 | `onTaskDispatched` | BullMQ task enqueued for actor |
| 3 | `onTaskCompleted` | Actor returned result |
| 4 | `onStageComplete` | Stage barrier released, outputs collected |
| 5 | `stage.started` | StructuredEvent from observability layer |
| 6 | `checkpoint.saved` | Execution checkpoint persisted |
| — | *(repeat 1-6 for each subsequent stage)* | |
| N | `onPipelineComplete` | All stages done, full results payload |
| N+1 | `pipeline_final` | Terminal event — `status: "completed"` |

### Event Data Structure

Each SSE frame:
```
event: onStageStart
data: {"type":"onStageStart","executionId":"exec-...","pipelineId":"pipeline_idempotent_...","eventType":"onStageStart","timestamp":1774322764387,"data":["stage-name",{stageInput},{pipelineContext}]}
```

The `data` field in the JSON is an **array**: `[stageName, stageInput, pipelineContext]`.

For `onTaskCompleted`: `data` is `[stageName, taskIndex, taskResult, pipelineContext]`.

For `onPipelineComplete`: `data` is `[allStageResults, pipelineContext]`.

---

## 10. Checking Results

### Status Endpoint

```powershell
curl.exe -s "$axiom/api/pipelines/$jobId" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Returns:
```json
{
  "jobId": "exec-...",
  "fileSetId": "fs-...",
  "status": "completed",       // or "submitted", "processing", "failed"
  "pipeline": { "name": "...", "version": "..." },
  "progress": { "currentStage": 2, "totalStages": 2, "percentage": 100 },
  "submittedAt": "...",
  "startedAt": "...",
  "completedAt": "...",
  "duration": 12882,
  "error": null                // populated on failure
}
```

### Results Endpoint

```powershell
curl.exe -s "$axiom/api/pipelines/$jobId/results" | ConvertFrom-Json | ConvertTo-Json -Depth 20
```

Returns per-stage results keyed by stage name:
```json
{
  "jobId": "exec-...",
  "status": "completed",
  "results": {
    "load-criteria": [ { /* CriteriaLoader output */ } ],
    "aggregate-results": [ { /* ResultsAggregator output */ } ]
  },
  "executionMetadata": { "duration": 12882, "actorsExecuted": 0 }
}
```

---

## 11. Common Errors and Fixes

| Error Message | Root Cause | Fix |
|---|---|---|
| `Pipeline name is required` | Missing `pipeline.name` | Add `"name": "my-pipeline"` to pipeline object |
| `Pipeline version is required` | Missing `pipeline.version` | Add `"version": "1.0.0"` to pipeline object |
| `Stage at index 0 missing required fields (name, actor, mode)` | Stage missing `name`, `actor`, or `mode` | Add all three fields to every stage |
| `Invalid configuration for single executor in stage <name>` | `single` mode stage missing `input` field | Add `"input": { ... }` to the stage (not just `config`) |
| `Unknown executor mode: sequential` | Invalid mode string | Use one of: `single`, `scatter`, `gather`, `broadcast`, `fork-join`, `human-approval`, `activate-actor`, `sub-pipeline` |
| `No document types found in DocumentTypeRegistry for client=X tenant=Y` | `input.documentTypes` not provided, and Cosmos has no matching document types | Pass `"documentTypes": []` in the input object |
| `Pipeline references non-existent actors: X` | Actor not registered in Cosmos | Use only actors from Section 6, or check `/api/actors` for current list |
| `Failed to load actors: X` | Actor JS file not accessible by worker runtime | Check worker container logs; actor may be registered in Cosmos but the JS file may not be deployed |
| `Pipeline version is required for telemetry` | Version field present but falsy (empty string) | Use a non-empty version string like `"1.0.0"` |

### Error Classification

The pipeline error classifier (`src/utils/pipeline-error-classifier.ts`) maps errors to codes:

| Code | Pattern | Meaning |
|---|---|---|
| `missing-document-types` | `/no document types found/i` | Document type registry lookup failed |
| `missing-actors` | `/failed to load actors\|non-existent actors/i` | Actor validation failed |

---

## 12. Worked Example — Full E2E

This is the exact sequence that works as of 2026-03-24.

### Step 1: Verify Health

```powershell
$axiom = "https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io"
curl.exe -s "$axiom/health" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

Expected: `status: "healthy"` with all subsystems passing.

### Step 2: Check Available Actors (optional)

```powershell
curl.exe -s "$axiom/api/actors" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Step 3: Submit Pipeline

```powershell
$payload = @'
{"pipeline":{"name":"e2e-criteria-eval","version":"1.0.0","stages":[{"name":"load-criteria","actor":"CriteriaLoader","mode":"single","input":{"criteriaSetId":"canonical-criteria","clientId":"acme-main","tenantId":"acme-lending"}},{"name":"aggregate-results","actor":"ResultsAggregator","mode":"single","input":{"mode":"simple"},"dependsOn":["load-criteria"]}]},"input":{"clientId":"acme-main","tenantId":"acme-lending","documentTypes":[]}}
'@
[System.IO.File]::WriteAllText("$env:TEMP\pipeline.json", $payload)
$result = curl.exe -s -X POST "$axiom/api/pipelines" -H "Content-Type: application/json" -d "@$env:TEMP\pipeline.json" | ConvertFrom-Json
$jobId = $result.jobId
Write-Host "Job ID: $jobId"
```

Expected: 202 response with jobId like `exec-1774321484629-rvmxltkv5ed`.

### Step 4: Watch SSE Stream

```powershell
curl.exe -s -N "$axiom/api/pipelines/$jobId/observe" --max-time 60
```

Expected: Stream of `onStageStart` → `onTaskDispatched` → `onTaskCompleted` → `onStageComplete` events for each stage, ending with `onPipelineComplete` and `pipeline_final`.

### Step 5: Check Results

```powershell
curl.exe -s "$axiom/api/pipelines/$jobId/results" | ConvertFrom-Json | ConvertTo-Json -Depth 20
```

Expected: `status: "completed"` with `results` containing per-stage outputs.

### All-in-One (Submit + Stream)

```powershell
$payload = @'
{"pipeline":{"name":"e2e-smoke","version":"1.0.0","stages":[{"name":"load-criteria","actor":"CriteriaLoader","mode":"single","input":{"criteriaSetId":"canonical-criteria","clientId":"acme-main","tenantId":"acme-lending"}},{"name":"aggregate-results","actor":"ResultsAggregator","mode":"single","input":{"mode":"simple"},"dependsOn":["load-criteria"]}]},"input":{"clientId":"acme-main","tenantId":"acme-lending","documentTypes":[]}}
'@
[System.IO.File]::WriteAllText("$env:TEMP\pipeline.json", $payload)
$axiom = "https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io"
$result = curl.exe -s -X POST "$axiom/api/pipelines" -H "Content-Type: application/json" -d "@$env:TEMP\pipeline.json" | ConvertFrom-Json
$jobId = $result.jobId
Write-Host "Job ID: $jobId — connecting to SSE..."
curl.exe -s -N "$axiom/api/pipelines/$jobId/observe" --max-time 60
```

---

## 13. PowerShell Gotchas

### JSON in PowerShell 5.1

PowerShell 5.1 (Windows default) has aggressive string interpolation and encoding issues:

1. **Use here-strings with single quotes** (`@'...'@`) for JSON payloads — this prevents variable interpolation and special character issues.

2. **Write to temp file** instead of inline `-d` — avoids PowerShell's quote escaping mangling JSON:
   ```powershell
   [System.IO.File]::WriteAllText("$env:TEMP\payload.json", $payload)
   curl.exe -d "@$env:TEMP\payload.json"
   ```

3. **Use `curl.exe`** not `curl` — PowerShell aliases `curl` to `Invoke-WebRequest`. Always use `curl.exe` explicitly.

4. **`Out-File -Encoding utf8NoBOM`** doesn't work in PS 5.1 — use `[System.IO.File]::WriteAllText()` instead. PS 5.1's valid encodings are: `unknown, string, unicode, bigendianunicode, utf8, utf7, utf32, ascii, default, oem`.

5. **`-N` flag for SSE** — `curl.exe -s -N` disables output buffering, which is required to see SSE events as they arrive rather than all at once at the end.

6. **`--max-time`** — Always set a timeout for SSE connections to avoid hanging indefinitely: `curl.exe -s -N "..." --max-time 60`.

---

## 14. Architecture Notes for Agents

### Pipeline Execution Flow

```
POST /api/pipelines
  → Express route handler (src/api/routes/pipelines.ts)
    → BullMQ job enqueued
      → Worker picks up job
        → CompletePipelineRunner.execute()
          → Pre-flight: validate actors, load document types, create execution record
          → Loom PipelineOrchestrator.execute()
            → For each stage:
              → getExecutor(stage.mode)
              → executor.validate(stage) — FAILS HERE if fields missing
              → executor.execute() — enqueues BullMQ tasks for actors
              → Actor worker picks up task, executes, returns result
              → Stage barrier checks if all tasks complete
            → onPipelineComplete
          → Store results in Cosmos (or blob if >1MB)
          → Emit pipeline_final event
```

### Key Source Files

| File | Purpose |
|---|---|
| `src/api/routes/pipelines.ts` | POST route handler, stage field validation |
| `src/runners/complete-pipeline-runner.ts` | Main runner — pre-flight checks, orchestrator wiring, result storage |
| `src/utils/pipeline-error-classifier.ts` | Error pattern matching → error codes |
| `src/agent/registry/PipelineTemplateRegistry.ts` | Cosmos lookup for pipeline templates |
| `@certo-ventures/loom/.../pipeline-orchestrator.js` | Loom orchestrator — getExecutor(), stage dispatch |
| `@certo-ventures/loom/.../builtin-executors.js` | SingleExecutor, ScatterExecutor, etc. — validate() methods |

### Redis Streams for SSE

The SSE `/stream` endpoint reads from a Redis Stream keyed by executionId. Events are written by:
- **Loom lifecycle hooks** (`onStageStart`, `onTaskDispatched`, `onTaskCompleted`, `onStageComplete`, `onPipelineComplete`)
- **StructuredEvent emitter** (`stage.started`, `checkpoint.saved`)
- **CompletePipelineRunner** (`pipeline_final`)

The `/observe` endpoint uses Redis Pub/Sub (not Streams) and also queries Cosmos EventBus for a snapshot on connect.

### Actor Registration

Actors are stored in the Cosmos `actors` container. Each document has:
```json
{
  "id": "unique-doc-id",
  "actorType": "criterialoader",        // lowercase
  "name": "CriteriaLoaderActor",        // PascalCase display name
  "reference": "CriteriaLoaderActor.js", // Worker module path
  "description": "...",
  "concurrency": 1,
  "dependencies": ["ActorContext", "CriteriaRepository", "..."],
  "seededBy": "seed-all"
}
```

The pipeline runner normalizes actor names to lowercase for the Cosmos lookup, so `CriteriaLoader` in a stage definition maps to `criterialoader` in the registry.

---

## Appendix: Discovery Endpoints

If the seeded data changes, re-query these to get current state:

```powershell
# All registered actors
curl.exe -s "$axiom/api/actors" | ConvertFrom-Json | ConvertTo-Json -Depth 5

# All seeded schemas (shows tenantId/clientId combos)
curl.exe -s "$axiom/api/schemas" | ConvertFrom-Json | ConvertTo-Json -Depth 5

# Health check (shows all subsystem status)
curl.exe -s "$axiom/health" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```
