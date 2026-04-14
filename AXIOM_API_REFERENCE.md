# Axiom API Reference

**Base URL (dev):** `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`  
**Content-Type:** `application/json` for all request bodies unless noted (file upload uses `multipart/form-data`).  
**Correlation ID:** Every request/response carries an `x-correlation-id` header automatically.

---

## Quick Start — Copy-Paste Examples

> **Stop re-discovering these values every session.** This section has everything you need to launch, monitor, and debug pipelines from scratch.

### Environment Setup

```bash
# Dev (Azure Container Apps)
export API_BASE="https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io"

# Local
export API_BASE="http://localhost:3000"
```

### Standard IDs

| Field | Dev/Test Value | Notes |
|---|---|---|
| `subClientId` | `test-tenant` | Default test tenant |
| `clientId` | `test-client` | Default test client |
| `programId` | `FNMA-URAR` | FNMA appraisal program |
| `programVersion` | `1.0.0` | Current version |
| `storageAccountName` | `axiomdevst` | Dev blob storage |
| `containerName` | `raw-files` | Upload target container |

### Container Names Map (Required for Pipeline Input)

```json
{
  "rawFiles": "raw-files",
  "blobPages": "pages",
  "pageDocuments": "pages",
  "documentTypeRegistry": "DocumentTypeRegistry",
  "fileSets": "loan-file-sets"
}
```

### Test PDF

```
https://axiomdevst.blob.core.windows.net/docs/URAR-Example.pdf
```

### Badie Credit PDF (Permanent — Pre-Uploaded, Azure SDK Auth)

The Badie Credit PDF is already staged in dev blob storage.  It is **not publicly accessible** — the worker downloads it using Managed Identity (`downloadMethod: "azure-sdk"`).  Never use `presignedUrl` or `public` methods for this blob.

```
Storage account : axiomdevst
Container       : raw-files
Blob name       : test-docs/Badie-Credit-docs.pdf
Full URL        : https://axiomdevst.blob.core.windows.net/raw-files/test-docs/Badie-Credit-docs.pdf
Download method : azure-sdk
```

---

## Testing Against the Remote Dev Container App

Use `scripts/test-badie-credit-remote.ts` for end-to-end remote pipeline testing.  It submits the Badie Credit PDF, streams SSE events in real-time, and dumps a full 5-section observability report on completion.

### Modes

```bash
# Submit new run, stream SSE live, dump full observability on finish:
npx tsx scripts/test-badie-credit-remote.ts

# Attach to an already-running or completed job (skip submit):
npx tsx scripts/test-badie-credit-remote.ts --job=<jobId>

# Dump all observability data for a completed job only (no observation):
npx tsx scripts/test-badie-credit-remote.ts --dump=<jobId>
```

### What it does

1. **Submits** `complete-document-criteria-evaluation` with the Badie Credit PDF payload
2. **Prints quick-inspect curl commands** immediately after submit so you can check status any time
3. **Streams SSE** from `/api/pipelines/:jobId/stream` — prints every event type + stage + percentage live
4. **Backup polls** every 10 s so you never miss a terminal status if SSE drops
5. **Dumps 5 observability sections** when the pipeline reaches a terminal state:
   - `1/5 STATUS` — overall status, progress percentage, current stage
   - `2/5 STAGES` — all stages with status/tasks; per-task detail auto-fetched for scatter stages
   - `3/5 EVENT HISTORY` — last 100 events with timestamps, types, stage names, errors
   - `4/5 CHECKPOINTS` — all checkpoint records
   - `5/5 RESULTS` — final stage results (409 logged gracefully if still running)

### SSE Event Stream (Node.js — no native EventSource)

Node 24 does not have a native `EventSource`.  The script uses `fetch` + `ReadableStream` to parse `text/event-stream` manually.  To watch the raw stream yourself:

```bash
# Watch /stream (Redis XREAD StructuredEvents — terminal: PIPELINE_COMPLETED/FAILED/CANCELLED)
curl -N -H "Accept: text/event-stream" \
  "https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io/api/pipelines/<jobId>/stream"

# Watch /observe (Loom lifecycle events)
curl -N -H "Accept: text/event-stream" \
  "https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io/api/pipelines/<jobId>/observe"
```

### Quick-Inspect Cheat Sheet (substitute your jobId)

```bash
# Status + percentage
curl -s "$API_BASE/api/pipelines/<jobId>" | jq '{status,pct:.progress.percentage,stage:.progress.currentStage}'

# All stages summary
curl -s "$API_BASE/api/pipelines/<jobId>/stages" | jq '.stages[] | {name,status,tasks:.completedTasks}'

# Recent events (errors)
curl -s "$API_BASE/api/pipelines/<jobId>/events?limit=20" | jq '.events[] | {type,stage:.stageName,err:.error}'

# Task detail for a specific scatter stage (basic status)
curl -s "$API_BASE/api/pipelines/<jobId>/stages/classifyPages/tasks" | jq '.'

# Task detail WITH FULL OUTPUT DATA (requires includeData=true, as output defaults to "[available]")
curl -s "$API_BASE/api/pipelines/<jobId>/stages/classifyPages/tasks?includeData=true" | jq '.tasks[] | select(.status == "completed") | {idx:.taskIndex, actor:.actorType, docType:.output.documentType, confidence:.output.confidence}'

# Event history overview (aggregates event types and counts them)
curl -s "$API_BASE/api/pipelines/<jobId>/events?limit=200" | jq '{total:.total, types:([.events[].eventType]|group_by(.)| map({(.[0]):length})|add)}'

# Download all extracted images from Blob Storage locally (using Azure CLI)
# Requires 'az login' and active Azure subscription access. Replace <fileSetId> with your run's ID
mkdir -p ./debug-output/badie-images && az storage blob download-batch --account-name axiomdevst --source pages --pattern "test-client/test-tenant/<fileSetId>/pages/*.png" --destination ./debug-output/badie-images --auth-mode login

# Azure Log Analytics - Fetch Recent Worker/API logs (requires az CLI and WORKSPACE_ID)
az monitor log-analytics query --workspace "$WORKSPACE_ID" \
  --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'axiom-dev-api' | where TimeGenerated > ago(2h) | project TimeGenerated, RevisionName_s, ContainerName_s, Log_s | order by TimeGenerated asc | take 100" \
  --timespan PT2H -o table

# Checkpoints
curl -s "$API_BASE/api/pipelines/<jobId>/checkpoints" | jq '.'

# Final results
curl -s "$API_BASE/api/pipelines/<jobId>/results" | jq '.'
```

---

### Example 1: Launch the Full Pipeline (Complete Document Criteria Evaluation)

This is the **primary production pipeline** — 14 stages: PDF intake → page extraction → classification → structured extraction → criteria evaluation → results storage.

```bash
# Generate unique IDs for this run
FILE_SET_ID="fs-$(date +%s)"
DOCUMENT_ID="doc-$(date +%s)"

curl -s -X POST "${API_BASE}/api/pipelines" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelineId": "complete-document-criteria-evaluation",
    "input": {
      "fileSetId": "'"${FILE_SET_ID}"'",
      "documentId": "'"${DOCUMENT_ID}"'",
      "subClientId": "test-tenant",
      "clientId": "test-client",
      "fileName": "URAR-Example.pdf",
      "programId": "FNMA-URAR",
      "programVersion": "1.0.0",
      "storageAccountName": "axiomdevst",
      "containerName": "raw-files",
      "containerNames": {
        "rawFiles": "raw-files",
        "blobPages": "pages",
        "pageDocuments": "pages",
        "documentTypeRegistry": "DocumentTypeRegistry",
        "fileSets": "loan-file-sets"
      },
      "files": [{
        "fileName": "URAR-Example.pdf",
        "url": "https://axiomdevst.blob.core.windows.net/docs/URAR-Example.pdf",
        "mediaType": "application/pdf",
        "fileSize": 0,
        "downloadMethod": "fetch"
      }]
    }
  }' | jq .
```

**Expected response (202):**
```json
{
  "jobId": "exec-1750000000000-abc123",
  "status": "submitted",
  "pipeline": { "name": "complete-document-criteria-evaluation", "version": "6.2.0", "stages": 14 },
  "submittedAt": "2026-03-11T12:00:00.000Z"
}
```

Save the `jobId` — you need it for everything below.

```bash
export JOB_ID="exec-..."   # ← paste from response
```

---

### Example 2: Poll Pipeline Status

```bash
curl -s "${API_BASE}/api/pipelines/${JOB_ID}" | jq .
```

**Response while running:**
```json
{
  "jobId": "exec-...",
  "status": "running",
  "progress": {
    "currentStage": 4,
    "totalStages": 14,
    "percentage": 28,
    "currentActor": "TextBasedClassification"
  }
}
```

**One-liner poll loop (bash):**
```bash
while true; do
  STATUS=$(curl -s "${API_BASE}/api/pipelines/${JOB_ID}" | jq -r '.status')
  echo "$(date +%H:%M:%S) — $STATUS"
  [[ "$STATUS" == "completed" || "$STATUS" == "completed-partial" || "$STATUS" == "failed" ]] && break
  sleep 10
done
```

---

### Example 3: Watch Pipeline via SSE (Real-Time)

```bash
curl -N -H "Accept: text/event-stream" \
  "${API_BASE}/api/pipelines/${JOB_ID}/observe"
```

Events arrive as Server-Sent Events: `snapshot`, `stage_started`, `stage_completed`, `stage_failed`, `heartbeat` (15s), `pipeline_completed`, `pipeline_failed`.

---

### Example 4: Get Pipeline Results

```bash
# Only works after status is "completed" or "failed" (returns 409 otherwise)
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/results" | jq .
```

---

### Example 5: Inspect Stages and Tasks

```bash
# All stages with status
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/stages" | jq .

# Task detail for a scatter stage (e.g., classifyPages)
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/stages/classifyPages/tasks" | jq .

# Event history
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/events?limit=50" | jq .

# Checkpoint history (crash recovery analysis)
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/checkpoints" | jq .

# Stored pipeline definition
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/definition" | jq .
```

---

### Example 6: Upload a PDF via Multipart Form

```bash
curl -X POST "${API_BASE}/api/documents" \
  -F "files=@/path/to/loan-document.pdf" \
  -F "subClientId=test-tenant" \
  -F "clientId=test-client" \
  -F "programId=FNMA-URAR" \
  -F "programVersion=1.0.0"
```

This uploads the PDF to blob storage and enqueues the `text-based-document-processing` pipeline automatically.

---

### Example 7: Cancel a Running Pipeline

```bash
curl -s -X DELETE "${API_BASE}/api/pipelines/${JOB_ID}" | jq .
```

---

### Example 8: List Recent Pipelines

```bash
# All recent executions
curl -s "${API_BASE}/api/pipelines?limit=10" | jq .

# Filter by status
curl -s "${API_BASE}/api/pipelines?status=failed&limit=5" | jq .

# Filter partial completions (criteria missing — resumable)
curl -s "${API_BASE}/api/pipelines?status=completed-partial&limit=10" | jq .

# Filter by tenant
curl -s "${API_BASE}/api/pipelines?subClientId=test-tenant&status=completed&limit=10" | jq .
```

---

### Example 9: DLQ — Retry Failed Jobs

```bash
# List failed jobs
curl -s "${API_BASE}/api/admin/dlq" | jq .

# Retry a specific job
curl -s -X POST "${API_BASE}/api/admin/dlq/<jobId>/retry" | jq .

# Retry all
curl -s -X POST "${API_BASE}/api/admin/dlq/retry-all" -H "Content-Type: application/json" -d '{"limit": 50}' | jq .
```

---

### Example 10: Run Criterion Evaluation (Synchronous, No Pipeline)

```bash
curl -s -X POST "${API_BASE}/api/criterion/loans/loan-123/programs/FNMA-URAR/evaluate" \
  -H "Content-Type: application/json" \
  -d '{ "schemaId": "FNMA-URAR" }' | jq .
```

---

### Utility Scripts (from Repo)

Run from the Axiom project root:

```bash
# Submit a pipeline job directly to BullMQ (bypasses API)
npx tsx scripts/submit-pipeline-job.ts https://axiomdevst.blob.core.windows.net/docs/URAR-Example.pdf FNMA-URAR 1.0.0

# Monitor a running pipeline (polls Redis every 2s)
npx tsx scripts/monitor-pipeline.ts <fileSetId>

# Check queue status (active, waiting, completed, failed counts)
npx tsx scripts/check-queue.ts

# Check pipeline state in Redis
npx tsx scripts/check-pipeline-status.ts

# Full live smoke test (starts worker, submits pipeline, waits for completion)
pnpm smoke:live
```

---

### Complete Pipeline Stage Reference

The `complete-document-criteria-evaluation` pipeline (v6.2.0) executes these stages in order:

| # | Stage Name | Actor | Mode | Purpose |
|---|---|---|---|---|
| 0 | `initializeFileSet` | `FileSetInitializer` | single | Create FileSet record, validate input |
| 1 | `processCompletePdf` | `CompletePdfProcessor` | single | Extract text/images from PDF pages |
| 2 | `storePages` | `SimplifiedPageStorage` | single | Persist extracted pages to blob |
| 3 | `loadDocumentTypes` | `DocumentTypeLoader` | single | Load doc-type definitions from registry |
| 4 | `classifyPages` | `TextBasedClassification` / `ImageBasedClassification` | scatter | Classify each page by document type |
| 5 | `aggregatePages` | `MultiPageAggregator` | single | Group classified pages into documents |
| 6 | `storeDetectedDocuments` | `FileSetDocumentStorage` | single | Persist detected document records |
| 7 | `extractStructuredData` | `ExtractionRouter` | scatter | Extract structured fields per document |
| 8 | `mergeExtractions` | `BatchMerge` | gather | Merge extraction results by documentId |
| 9 | `storeExtractions` | `StoreExtractedData` | scatter | Persist extractions to Cosmos |
| 10 | `loadCriteria` | `CriteriaLoader` | single | Load criteria definitions for program |
| 11 | `evaluateCriteria` | `CriterionEvaluator` | scatter | Evaluate each criterion via LLM |
| 12 | `aggregateResults` | `ResultsAggregator` | single | Aggregate pass/fail results |
| 13 | `storeResults` | `FileSetResultsStorage` | single | Persist final evaluation results |

---

### Troubleshooting Checklist

If the pipeline stalls or fails:

1. **Check health:** `curl ${API_BASE}/health | jq .` — are Redis, Cosmos, Blob, Queue all `pass`?
2. **Check pipeline status:** `curl ${API_BASE}/api/pipelines/${JOB_ID} | jq .status` — what stage is it on?
3. **Check stage details:** `curl ${API_BASE}/api/pipelines/${JOB_ID}/stages | jq '.stages[] | {name, status}'`
4. **Check events:** `curl "${API_BASE}/api/pipelines/${JOB_ID}/events?limit=20" | jq .`
5. **Check DLQ:** `curl ${API_BASE}/api/admin/dlq | jq .` — did the job fail and land in the dead letter queue?
6. **Check Redis directly:** `npx tsx scripts/check-pipeline-status.ts`
7. **Check queue:** `npx tsx scripts/check-queue.ts` — are jobs stuck in waiting/active?
8. **Check worker logs:** Workers run in a separate Container App. Check Azure Portal → Container Apps → `axiom-dev-worker` → Log stream.

Common failure causes:
- **Stage 0 fails:** Missing FileSet data, blob storage unreachable, or invalid `containerNames`
- **Stage 1 hangs:** PDF too large or corrupt, `CompletePdfProcessor` timeout
- **Stage 4 fails:** LLM API key expired or rate-limited (`AZURE_OPENAI_API_KEY`)
- **Stage 11 fails:** Criteria not loaded for program, or LLM timeout during evaluation
- **Pipeline stalls at barrier:** Multi-instance BullMQ routing issue (fixed by Loom lazy activation — Loom 0.13+)

---

## Platform Endpoints

### `GET /health`

Deep health check — probes Redis, Cosmos, Blob Storage, and the queue.

**Response 200** (all healthy) / **503** (degraded):
```json
{
  "status": "healthy",
  "timestamp": "2026-02-25T12:00:00.000Z",
  "uptime": 3600.5,
  "environment": "dev",
  "region": "eastus",
  "checks": {
    "redis":       { "status": "pass" },
    "cosmos":      { "status": "pass" },
    "blobStorage": { "status": "pass" },
    "queue":       { "status": "pass" },
    "services":    { "status": "pass" }
  }
}
```

---

### `GET /ready`

Lightweight readiness probe for Container Apps / load balancers. Returns `ready: false` and 503 during startup.

**Response 200 / 503:**
```json
{ "ready": true, "timestamp": "2026-02-25T12:00:00.000Z" }
```

---

## Pipelines — `/api/pipelines`

Submit Loom pipeline definitions for asynchronous execution. Jobs are enqueued to BullMQ and executed by the workers Container App.

---

### `POST /api/pipelines`

Submit a pipeline for execution. Accepts either an inline pipeline definition or a reference to a stored template.

**Request body:**
```json
{
  "pipeline": {
    "name": "my-pipeline",
    "version": "1.0.0",
    "stages": [
      {
        "name": "classify",
        "actor": "ImageBasedClassification",
        "mode": "single",
        "input": {
          "subClientId":      { "path": "trigger.subClientId" },
          "clientId":      { "path": "trigger.clientId" },
          "imageUrl":      { "path": "trigger.imageUrl" },
          "documentTypes": { "path": "trigger.documentTypes" }
        },
        "timeout": 60000
      }
    ]
  },
  "input": {
    "subClientId":  "acme-bank",
    "clientId":  "acme-bank",
    "entityId":  "run-001",
    "imageUrl":  "https://example.com/page1.png",
    "documentTypes": [{ "documentType": "paystub", "name": "Pay Stub" }]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `pipeline` | `PipelineDefinition` | ✓ (or `pipelineId`) | Inline Loom pipeline. Stages need `name`, `actor`, `mode`. |
| `pipelineId` | `string (UUID)` | ✓ (or `pipeline`) | ID of a stored template in the `pipeline-templates` Cosmos container. |
| `input` | `object` | ✓ | Trigger payload. `subClientId` and `clientId` are required. All other fields are pipeline-specific and passed through verbatim. |

**Stage input expressions (Loom 0.9.1+):**  
String values are **literal**. Use `{ "path": "trigger.fieldName" }` to reference the pipeline trigger input. Prior stage outputs are at `stages.<stageName>`.

**Response 202:**
```json
{
  "jobId": "exec-1750000000000-abc123",
  "status": "submitted",
  "pipeline": { "name": "my-pipeline", "version": "1.0.0", "stages": 1 },
  "submittedAt": "2026-02-25T12:00:00.000Z",
  "estimatedDuration": "~30s",
  "message": "Pipeline \"my-pipeline\" submitted. Workers will process asynchronously."
}
```

**Error responses:**

| Status | When |
|---|---|
| 400 | Schema validation failure, missing required stage fields, or missing `subClientId`/`clientId` |
| 404 | `pipelineId` not found in registry |
| 503 | Queue or execution service not initialized |

---

### `GET /api/pipelines/:jobId`

Poll the execution status of a submitted pipeline.

**Response 200:**
```json
{
  "jobId": "exec-1750000000000-abc123",
  "fileSetId": "fs-1750000000000",
  "status": "running",
  "pipeline": { "name": "my-pipeline", "version": "1.0.0" },
  "progress": {
    "currentStage": 1,
    "totalStages": 3,
    "percentage": 33,
    "currentActor": "ImageBasedClassification"
  },
  "submittedAt": "2026-02-25T12:00:00.000Z",
  "startedAt": "2026-02-25T12:00:01.000Z",
  "completedAt": null,
  "duration": null,
  "error": null
}
```

`status` values: `submitted` | `running` | `completed` | `failed`

---

### `GET /api/pipelines/:jobId/results`

Retrieve the final results of a completed or failed pipeline. Returns 409 if the pipeline is still running.

**Response 200:**
```json
{
  "jobId": "exec-1750000000000-abc123",
  "fileSetId": "fs-1750000000000",
  "status": "completed",
  "results": { ... },
  "pipeline": { "name": "my-pipeline", "version": "1.0.0" },
  "executionMetadata": {
    "submittedAt": "2026-02-25T12:00:00.000Z",
    "startedAt":   "2026-02-25T12:00:01.000Z",
    "completedAt": "2026-02-25T12:00:25.000Z",
    "duration": 24000,
    "actorsExecuted": 3
  }
}
```

**Error responses:**

| Status | When |
|---|---|
| 404 | Job ID not found |
| 409 | Pipeline not yet `completed` or `failed` |

---

### `GET /api/pipelines`

List pipeline executions with optional filters.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `fileSetId` | string | Filter by file set |
| `status` | string | `submitted` \| `running` \| `completed` \| `failed` |
| `subClientId` | string | Filter by tenant |
| `clientId` | string | Filter by client |
| `limit` | number | Max results (default: 50) |

**Response 200:**
```json
{
  "total": 12,
  "returned": 12,
  "limit": 50,
  "executions": [
    {
      "jobId": "exec-...",
      "fileSetId": "fs-...",
      "status": "completed",
      "pipeline": { "name": "...", "version": "1.0.0" },
      "submittedAt": "...",
      "completedAt": "..."
    }
  ]
}
```

---

### `DELETE /api/pipelines/:jobId`

Cancel a running pipeline. Sets a Redis cancellation flag that the worker checks between stages.

**Response 200:**
```json
{ "jobId": "...", "cancelled": true }
```

---

### `POST /api/pipelines/control/pause`

Pause the entire pipeline BullMQ queue. No new jobs will be picked up by workers until resumed. Jobs already in-progress continue to completion.

**Request:** No body.

**Response 200:**
```json
{ "message": "Pipeline queue paused" }
```

**Error 503:** Queue not initialized.

---

### `POST /api/pipelines/control/resume`

Resume the pipeline BullMQ queue after a pause. Workers will begin picking up waiting jobs again.

**Request:** No body.

**Response 200:**
```json
{ "message": "Pipeline queue resumed" }
```

**Error 503:** Queue not initialized.

---

### `POST /api/pipelines/:jobId/resume`

Resume a failed or interrupted pipeline execution from its latest checkpoint. Validates resumability before attempting.

**Request body (optional):**
```json
{ "fromStage": "stage-name" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `fromStage` | string | — | Resume from a specific stage name instead of the latest checkpoint |

**Response 202:**
```json
{
  "jobId": "exec-...",
  "status": "resuming",
  "resumedFrom": "stage-name",
  "resumedAt": "2026-03-15T12:00:00.000Z",
  "checkpointId": "cp-...",
  "loomOptions": { },
  "message": "Pipeline resuming from stage \"stage-name\". Re-submit the pipeline job with the provided loomOptions."
}
```

| Status | When |
|---|---|
| 404 | Pipeline execution not found |
| 409 | Pipeline already completed, or no resumable checkpoint found |
| 503 | Execution service, checkpoint service, or event bus not initialized |

---

### `GET /api/pipelines/:jobId/stream`

**Server-Sent Events** — streams all `StructuredEvent`s from the Redis `pipeline-events` stream matching the requested jobId.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | string (stream ID) | `"$"` | Resume from a specific Redis stream cursor |
| `timeout` | number (ms) | `1800000` (30 min) | Override the overall SSE timeout |

**SSE event format:**
```
id:    <redis-stream-id>
event: <eventType>          (e.g. "stage.completed", "pipeline.failed")
data:  <JSON StructuredEvent>
```

**Special events:** `connected` (on open), `done` (terminal), `timeout` (deadline exceeded), `error` (stream error).

**Terminal event types** (stream closes automatically): `PIPELINE_COMPLETED`, `PIPELINE_FAILED`, `PIPELINE_CANCELLED`, `PIPELINE_TIMEOUT`

**Behaviour:**
- Heartbeat every 15 s
- XREAD blocks 5 s per poll, reads up to 100 entries
- Filters events by `correlation.jobId` match
- Default 30-minute hard timeout

---

## Pipeline Observation — `/api/pipelines/:id/...`

Mounted alongside the pipelines router. The `:id` is the **executionId** (Cosmos document ID).

---

### `GET /api/pipelines/:id/observe`

**Server-Sent Events (SSE)** stream of real-time pipeline events.

Set `Accept: text/event-stream`. The connection stays open until the pipeline completes or the client disconnects.

**Events emitted:**
- `snapshot` — Full state at connection time (stages + statuses)
- `stage_started`, `stage_completed`, `stage_failed` — Loom lifecycle events
- `heartbeat` — Keepalive every 15 s
- `pipeline_completed`, `pipeline_failed` — Terminal events; client should close after receiving

---

### `GET /api/pipelines/:id/definition`

Returns the stored pipeline definition for an execution — stage order, actor assignments, config, and pipeline lifecycle timestamps.

**Response 200:**
```json
{
  "executionId": "exec-...",
  "pipelineId": "loom-...",
  "name": "complete-document-criteria-evaluation",
  "version": "6.2.0",
  "description": "...",
  "stageOrder": ["initializeFileSet", "processCompletePdf", "storePages", ...],
  "stages": [
    { "name": "initializeFileSet", "actor": "FileSetInitializer", "mode": "single", "dependsOn": [] },
    { "name": "processCompletePdf", "actor": "CompletePdfProcessor", "mode": "single", "dependsOn": ["initializeFileSet"] }
  ],
  "config": { ... },
  "status": "completed",
  "createdAt": "2026-03-15T12:00:00.000Z",
  "startedAt": "2026-03-15T12:00:01.000Z",
  "completedAt": "2026-03-15T12:03:30.000Z"
}
```

---

### `GET /api/pipelines/:id/stages`

All stage statuses and progress for a pipeline execution. The primary observability endpoint for monitoring pipeline progress.

```bash
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/stages" | jq .
```

**Response 200:**
```json
{
  "executionId": "exec-...",
  "pipelineId": "loom-...",
  "status": "completed",
  "totalStages": 14,
  "completedStages": 14,
  "completionPercent": 100,
  "currentStage": null,
  "stages": [
    {
      "name": "initializeFileSet",
      "status": "completed",
      "attempt": 1,
      "expectedTasks": 1,
      "completedTasks": 1,
      "startedAt": "2026-03-15T12:00:01.000Z",
      "completedAt": "2026-03-15T12:00:02.500Z",
      "error": null
    },
    {
      "name": "classifyPages",
      "status": "completed",
      "attempt": 1,
      "expectedTasks": 6,
      "completedTasks": 6,
      "startedAt": "2026-03-15T12:00:30.000Z",
      "completedAt": "2026-03-15T12:01:15.000Z",
      "error": null
    }
  ]
}
```

**Stage `status` values:** `pending` | `running` | `completed` | `failed`

---

### `GET /api/pipelines/:id/stages/:name/tasks`

Task-level detail for a single stage — essential for scatter/gather stages with many tasks.

```bash
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/stages/classifyPages/tasks" | jq .
```

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `includeData` | `"true"` | `"false"` | Include full input/output payloads (can be large) |
| `task` | number | — | Filter to a single task index |

**Response 200:**
```json
{
  "executionId": "exec-...",
  "pipelineId": "loom-...",
  "stage": {
    "name": "classifyPages",
    "status": "completed",
    "expectedTasks": 6,
    "completedTasks": 6,
    "startedAt": "...",
    "completedAt": "...",
    "error": null
  },
  "tasks": [
    {
      "taskIndex": 0,
      "status": "completed",
      "attempt": 1,
      "actorType": "TextBasedClassification",
      "queuedAt": 1710500400000,
      "startedAt": 1710500401000,
      "completedAt": 1710500408000,
      "durationMs": 7000,
      "error": null,
      "output": "[available]"
    }
  ],
  "taskStatusSummary": { "0": "completed", "1": "completed", "2": "completed" }
}
```

---

### `GET /api/pipelines/:id/events`

Structured event history from the EventBus (Redis Streams). Paginated, reverse-chronological by default.

```bash
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/events?limit=20" | jq .
```

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `100` | Max events to return |
| `offset` | number | `0` | Pagination offset |
| `types` | string (CSV) | — | Filter by event type (comma-separated, e.g. `stage_completed,pipeline_failed`) |

**Response 200:**
```json
{
  "executionId": "exec-...",
  "events": [
    {
      "eventType": "stage_completed",
      "executionId": "exec-...",
      "pipelineId": "loom-...",
      "stageName": "storeResults",
      "timestamp": "2026-03-15T12:03:30.000Z",
      "data": { ... }
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/pipelines/:id/checkpoints`

Checkpoint history for a pipeline — used for crash recovery analysis and understanding pipeline resume points.

```bash
curl -s "${API_BASE}/api/pipelines/${JOB_ID}/checkpoints" | jq .
```

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `50` | Max checkpoints to return |

**Response 200:**
```json
{
  "executionId": "exec-...",
  "checkpoints": [
    {
      "id": "cp-...",
      "executionId": "exec-...",
      "pipelineId": "loom-...",
      "stage": "extractStructuredData",
      "timestamp": "2026-03-15T12:02:00.000Z",
      "state": { ... }
    }
  ]
}

---

## Documents — `/api/documents`

Upload PDFs for extraction processing. Files are written to Azure Blob Storage and a `process-fileset` job is enqueued for the `text-based-document-processing` pipeline.

---

### `POST /api/documents`

Upload one or more PDFs (up to 10 files, 8 MB each). Accepts `multipart/form-data` with file upload **or** a JSON body referencing existing blobs or presigned URLs.

**Multipart form fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `files` | file(s) | ✓ (or blob/url) | PDF only. Max 8 MB each, max 10 files. |
| `subClientId` | string | ✓ | |
| `clientId` | string | ✓ | |
| `programId` | string | — | |
| `programVersion` | string | — | |
| `name` | string | — | FileSet display name |
| `description` | string | — | |
| `metadata` | JSON string | — | Arbitrary key-value bag |

**JSON body (blob reference upload):**
```json
{
  "subClientId": "acme-bank",
  "clientId": "acme-bank",
  "azureBlobPaths": [
    { "fileName": "loan.pdf", "containerName": "raw-files", "blobName": "path/to/loan.pdf" }
  ]
}
```

**Response 202:**
```json
{
  "fileSetId": "fs-1750000000000-abc",
  "jobId": "exec-1750000000000-xyz",
  "status": "submitted",
  "files": [{ "fileName": "loan.pdf", "size": 204800, "blobUrl": "https://..." }],
  "message": "Documents submitted for processing"
}
```

---

### `GET /api/documents/:fileSetId`

Retrieve a FileSet record from Cosmos (metadata + file list).

**Response 200:** FileSet document from `loan-file-sets` container.  
**Response 404:** FileSet not found.

---

### `GET /api/documents/:fileSetId/status`

Get the pipeline execution status for a document submission (shorthand — delegates to the execution service).

**Response 200:** Same shape as `GET /api/pipelines/:jobId`.

---

## Criterion Evaluation — `/api/criterion`

Synchronous LLM-based criterion evaluation against pre-loaded loan data. No queue — runs in-process. May be slow for large programs.

---

### `POST /api/criterion/loans/:loanId/programs/:programId/evaluate`

Run `CriterionEvaluationService.evaluateLoan()` for a loan/program pair.

**URL params:** `loanId`, `programId`

**Request body (optional):**
```json
{ "schemaId": "FNMA-SEL-2024" }
```
`schemaId` defaults to `programId` if omitted.

**Response 200** — `EvaluationSummary`:
```json
{
  "loanId": "loan-123",
  "programId": "FNMA-SEL-2024",
  "totalCriteria": 42,
  "passed": 38,
  "failed": 4,
  "results": [ ... ]
}
```

**Requires:** Loan data and compiled criteria pre-loaded in Cosmos (`loan-data` and `compiled-programs` containers).

---

### `GET /api/criterion/loans/:loanId/programs/:programId/results`

List all stored evaluation results for a loan+program pair, ordered by `evaluatedAt` descending.

**Response 200:**
```json
{
  "loanId": "loan-123",
  "programId": "FNMA-SEL-2024",
  "count": 42,
  "results": [ ... ]
}
```

---

### `GET /api/criterion/loans/:loanId/programs/:programId/results/:criterionId`

Point-read the stored result for a single criterion.

**Response 200:** `CriterionEvaluationResult` document.  
**Response 404:** Criterion not yet evaluated for this loan.

---

## Agent — `/api/agent`

Synchronous LLM agent execution with a tool loop. Hard timeout: **5 minutes**. No queue.

---

### `POST /api/agent/run`

Execute a prompt against the `EnhancedAgentEngine`.

**Request body:**
```json
{
  "prompt": "Analyze the DTI ratio for loan loan-123 against FNMA guidelines.",
  "options": {
    "maxIterations": 10,
    "context": { "loanId": "loan-123" }
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string | ✓ | Task description for the agent |
| `options.maxIterations` | number | — | Max tool-loop iterations |
| `options.context` | object | — | Additional context passed to the agent |

**Response 200:**
```json
{
  "sessionId": "uuid-...",
  "status": "completed",
  "result": "The DTI ratio is 42%, which exceeds the 45% threshold...",
  "error": null,
  "metrics": {
    "totalLLMCalls": 4,
    "totalTokens": 3200,
    "totalTools": 2
  },
  "trajectory": { ... }
}
```

`status`: `completed` | `failed`

---

### `GET /api/agent/:sessionId/status`

Check status of a persisted agent session.

**Response 200:**
```json
{
  "sessionId": "uuid-...",
  "status": "completed",
  "startTime": "...",
  "endTime": "...",
  "duration": 8200,
  "stepCount": 6,
  "metrics": { ... }
}
```

**Response 404:** Session not found.

---

### `GET /api/agent/:sessionId/trajectory`

Full step-by-step execution trace for an agent session.

**Response 200:**
```json
{
  "sessionId": "uuid-...",
  "stepCount": 6,
  "steps": [ ... ]
}
```

---

### `POST /api/agent/run/async`

Enqueue an agent run for asynchronous execution by `AgentExecutorWorker`. Returns immediately with a `runId`; observe progress via `GET /api/agent/:runId/observe`.

**Request body:**
```json
{
  "prompt": "Analyze the DTI ratio for loan loan-123 against FNMA guidelines.",
  "options": {
    "agentId": "default",
    "maxIterations": 10,
    "maxTokenBudget": 50000,
    "context": { "loanId": "loan-123" },
    "timeoutMs": 300000
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string | ✓ | Task description for the agent |
| `options.agentId` | string | — | Agent identity (default: `"default"`) |
| `options.maxIterations` | number | — | Max tool-loop iterations |
| `options.maxTokenBudget` | number | — | Token budget limit |
| `options.context` | object | — | Additional context passed to the agent |
| `options.timeoutMs` | number | — | Timeout in ms (default: 300000 / 5 min) |

**Response 202:**
```json
{
  "runId": "uuid-...",
  "jobId": "uuid-...",
  "status": "queued"
}
```

| Status | When |
|---|---|
| 400 | Missing or empty `prompt` |
| 501 | Agent queue or Redis not configured |
| 503 | Agent service not initialized |

---

### `DELETE /api/agent/:runId`

Signal cancellation for a queued or running agent job. Sets a Redis key (`agent:{runId}:cancelled`, TTL 24h) that the worker checks before beginning execution. Mid-execution cancellation is not currently supported — a running job will complete or time out normally.

**Response 202:**
```json
{
  "runId": "uuid-...",
  "status": "cancel_requested"
}
```

| Status | When |
|---|---|
| 501 | Redis not configured |
| 503 | Agent service not initialized |

---

### `GET /api/agent/:runId/node`

Returns the cluster node currently processing the given agent run (uses the actor location directory).

**Response 200:**
```json
{
  "actorId": "string",
  "nodeId": "string",
  "actorType": "string",
  "activatedAt": "2026-03-15T12:00:00.000Z",
  "fencingToken": "string?"
}
```

| Status | When |
|---|---|
| 404 | Run not found / not currently active on any node |
| 501 | Location directory not configured |

---

### `POST /api/agent/:runId/signal`

Inject an external signal (instruction) into an in-progress agent run. The worker's ReAct loop reads the signal key after each tool dispatch and appends the message as a `user` turn so the LLM adjusts its behaviour. Signal TTL is 60 seconds.

**Request body:**
```json
{ "message": "Focus on the appraisal value, not the income verification." }
```

**Response 202:**
```json
{
  "runId": "uuid-...",
  "status": "signal_queued"
}
```

| Status | When |
|---|---|
| 400 | Missing or empty `message` |
| 501 | Redis not configured |

---

### `GET /api/agent/:runId/observe`

**Server-Sent Events (SSE)** stream for an async agent run. Reads from the Redis Stream `agent-events:{<runId>}`. Late-joining observers receive the full event history from the beginning (Redis Streams are persistent, unlike pub/sub).

**SSE event format:**
```
event: agent-event
data: <JSON payload>
```

**Terminal event types** (stream closes automatically): `completed`, `failed`, `cancelled`, `timed_out`

**Behaviour:**
- Heartbeat comment every 15 s
- Hard 30-minute timeout
- Polls Redis Stream every 1 s (XREAD COUNT 50)

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

| Status | When |
|---|---|
| 501 | Redis not configured |
| 503 | Agent service not initialized |

---

## Schemas — `/api/schemas`

CRUD and validation for extraction schemas stored in Cosmos `schemas` container.

---

### `POST /api/schemas/validate`

Validate a single schema document without persisting it.

**Request body:**
```json
{
  "schema": { ... },
  "options": { "autoFix": false, "failOnWarnings": false }
}
```

**Response 200:**
```json
{
  "valid": true,
  "schemaId": "schema-123",
  "errors": [],
  "warnings": [],
  "metadata": { "timestamp": "...", "duration": 12, "fieldsChecked": 8 }
}
```

---

### `POST /api/schemas/validate/batch`

Validate multiple schemas in one call.

**Request body:**
```json
{ "schemas": [ ... ], "options": { } }
```

**Response 200:**
```json
{
  "results": [ { "schemaId": "...", "valid": true, "errors": [], "warnings": [] } ],
  "summary": { "total": 3, "valid": 3, "invalid": 0, "warnings": 0 }
}
```

---

### `POST /api/schemas/validate/file`

Validate schema JSON submitted as a string (for file-upload workflows).

**Request body:**
```json
{ "fileContent": "{\"id\":\"schema-123\",...}", "options": { } }
```

---

### `POST /api/schemas`

Create or upsert a schema document.

**Response 201:** Stored `SchemaDocument`.

---

### `GET /api/schemas`

List schemas.

**Query parameters:** `status`, `subClientId`, `clientId`, `limit`, `offset`

---

### `GET /api/schemas/:id`

Get a schema by ID.

**Response 200:** `SchemaDocument`.  
**Response 404:** Not found.

---

### `GET /api/schemas/:id/validate`

Validate a schema already stored in Cosmos by its ID.

---

### `PUT /api/schemas/:id`

Full replacement update of a schema document.

---

### `DELETE /api/schemas/:id`

Soft-delete (archive) a schema — sets `status: "archived"`.

---

### `POST /api/schemas/:id/activate`

Activate a draft schema (transition: `draft` → `active`). The schema is validated before activation — invalid schemas are rejected.

**Response 200:**
```json
{
  "message": "Schema activated successfully",
  "schema": { }
}
```

| Status | When |
|---|---|
| 400 | Schema already active, or cannot activate an archived schema |
| 404 | Schema not found |
| 422 | Schema has validation errors (returned in `errors` array) |

---

### `POST /api/schemas/:id/deprecate`

Deprecate an active schema (transition: `active` → `archived`). Only active schemas can be deprecated.

**Request body:**
```json
{
  "reason": "Superseded by v2.1",
  "replacementVersion": "2.1.0"
}
```

| Field | Type | Required |
|---|---|---|
| `reason` | string | ✓ |
| `replacementVersion` | string | — |

**Response 200:**
```json
{
  "message": "Schema deprecated successfully",
  "schema": { }
}
```

| Status | When |
|---|---|
| 400 | Missing `reason`, or schema is not active |
| 404 | Schema not found |

---

### `POST /api/schemas/:id/archive`

Archive a schema from any non-archived status (transition: `draft|active` → `archived`).

**Request body (optional):**
```json
{ "reason": "No longer needed" }
```

**Response 200:**
```json
{
  "message": "Schema archived successfully",
  "schema": { }
}
```

| Status | When |
|---|---|
| 400 | Schema already archived |
| 404 | Schema not found |

---

### `POST /api/schemas/infer`

LLM-powered schema inference — automatically maps source fields to a target canonical schema using `SchemaInferenceActor`.

**Request body:**
```json
{
  "sampleData": { },
  "targetSchemaId": "FNMA-URAR",
  "clientId": "acme-bank",
  "subClientId": "acme-bank",
  "programId": "FNMA-URAR",
  "hints": "Wells Fargo format, fields prefixed with WF_",
  "fieldDescriptions": { "WF_DTI": "Debt-to-income ratio" },
  "llmConfig": {
    "model": "gpt-4o",
    "temperature": 0.0,
    "maxTokens": 4096,
    "minConfidence": 0.75
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `sampleData` | object | ✓ | Client data sample to infer from |
| `targetSchemaId` | string | ✓ | Canonical schema to map to |
| `clientId` | string | — | Scope inference to client |
| `subClientId` | string | — | Scope inference to tenant |
| `programId` | string | — | Scope inference to program |
| `hints` | string | — | Additional LLM context |
| `fieldDescriptions` | object | — | Field-name → description hints |
| `llmConfig` | object | — | Override LLM model, temperature, etc. |

**Response 200:**
```json
{
  "inference": {
    "mappings": [
      { "sourcePath": "WF_DTI", "targetPath": "dtiRatio", "confidence": 0.95, "reasoning": "..." }
    ],
    "unmappedSourceFields": ["field1"],
    "unmappedTargetFields": ["field2"],
    "ambiguities": [],
    "warnings": []
  },
  "overallConfidence": 0.87,
  "autoApproved": false,
  "metadata": {
    "model": "gpt-4o",
    "duration": 3200,
    "tokensUsed": 1500
  }
}
```

---

### `POST /api/schemas/infer/review`

Review and refine LLM-suggested mappings from a prior `/infer` call. Applies human edits (approve/reject/modify) and produces a draft `SchemaDocument`.

**Request body:**
```json
{
  "inference": { },
  "edits": [
    { "sourcePath": "WF_DTI", "targetPath": "dtiRatio", "action": "approve" },
    { "sourcePath": "WF_UNKNOWN", "action": "reject" },
    { "sourcePath": "WF_AMT", "targetPath": "loanAmount", "action": "modify" }
  ],
  "clientId": "acme-bank",
  "programId": "FNMA-URAR",
  "version": "1.0.0",
  "targetSchemaId": "FNMA-URAR"
}
```

| Field | Type | Required |
|---|---|---|
| `inference` | object | ✓ — the `InferenceResult` from `/infer` |
| `edits` | array | ✓ — each with `sourcePath` and `action` (`approve`/`reject`/`modify`) |
| `clientId` | string | ✓ |
| `programId` | string | ✓ |
| `version` | string | ✓ |

**Response 200:**
```json
{
  "schema": {
    "id": "client-acme-bank-FNMA-URAR-v1.0.0",
    "type": "client-schema",
    "status": "draft",
    "mappings": { "schemaVersion": "1.0", "fields": { } },
    "description": "LLM-inferred schema, human-reviewed. Changes: 5 approved, 1 modified, 2 rejected."
  },
  "changes": { "approved": 5, "rejected": 2, "modified": 1 }
}
```

---

### `GET /api/schemas/infer/metrics`

Schema inference cost and performance metrics from the in-memory cost tracker.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `clientId` | string | — | Filter to a specific client |
| `days` | number | `30` | Lookback period in days |

**Response 200:**
```json
{
  "summary": {
    "totalInferences": 42,
    "successRate": 0.95,
    "averageCost": 0.03,
    "dailyCost": 1.20,
    "monthlyCost": 36.0
  },
  "byClient": { "acme-bank": { "inferences": 10, "totalCost": 0.30, "averageConfidence": 0.88 } },
  "byModel": { "gpt-4o": { "inferences": 42, "totalCost": 1.20, "averageDuration": 3200 } },
  "timestamp": "2026-03-15T..."
}
```

---

## Actors — `/api/actors`

CRUD for actor metadata in the Cosmos `actors` container. Used by `ActorLoader` to resolve actor implementations at runtime.

---

### `POST /api/actors`

Register or update (upsert) an actor document.

**Request body:**
```json
{
  "id": "imagebasedclassification-v2-r1",
  "actorType": "imagebasedclassification",
  "version": "2.0.0",
  "revision": 1,
  "status": "published",
  "metadata": {
    "name": "ImageBasedClassification",
    "reference": "/app/dist/actors/ImageBasedClassificationActor.js",
    "description": "Classifies a document page image using a vision LLM"
  }
}
```

| Field | Type | Required | Allowed values |
|---|---|---|---|
| `id` | string | ✓ | Unique document ID |
| `actorType` | string | ✓ | Lowercase, no spaces (e.g. `imagebasedclassification`) |
| `version` | string | ✓ | Semver string |
| `revision` | number | ✓ | Integer; `getLatest()` picks highest revision |
| `status` | string | ✓ | `draft` \| `published` \| `deprecated` \| `retired` |
| `metadata` | object | ✓ | Must include `reference` (module path for dynamic import) |

**Response 200:** Stored `ActorDocument`.

---

### `GET /api/actors`

List actor documents.

**Query parameters:** `status` (optional), `actorType` (optional)

**Response 200:**
```json
{ "count": 29, "actors": [ ... ] }
```

---

### `GET /api/actors/:actorType`

Get the latest published revision for an actor type.

**Response 200:** `ActorDocument`.  
**Response 404:** No published revision found.

---

### `PUT /api/actors/:actorType/:id`

Merge-update a specific actor document (fetches existing, merges body over it).

**Response 200:** Updated `ActorDocument`.  
**Response 404:** Document not found.

---

### `DELETE /api/actors/:actorType/:id`

Delete a specific actor document. Idempotent — 204 even if already deleted.

---

## Criteria — `/api/criteria`

CRUD for canonical taxonomies and program deltas in the Cosmos `criteria-definitions` container.

---

### `GET /api/criteria/canonicals`

List canonical taxonomies.

**Query parameters:** `taxonomyName`, `status`

---

### `GET /api/criteria/canonicals/:taxonomyName/:version`

Get a specific canonical taxonomy. **Response 404** if not found.

---

### `POST /api/criteria/canonicals`

Create or update (upsert) a canonical taxonomy.

**Required body fields:** `id`, `clientId` (`"CANONICAL"`), `subClientId` (taxonomy name), `programId`, `version`, `type`, `name`, `effectiveDate`, `status`, `criteria`

**Response 200:** Stored `CanonicalTaxonomy`.

---

### `PUT /api/criteria/canonicals/:taxonomyName/:version`

Merge-update a canonical taxonomy.

---

### `DELETE /api/criteria/canonicals/:taxonomyName/:version`

Delete a canonical taxonomy. Idempotent — 204 even if missing.

---

### `GET /api/criteria/canonicals/:taxonomyName/:version/programs`

Impact analysis — list all program deltas that reference this canonical.

---

### `GET /api/criteria/clients/:clientId/tenants/:subClientId/programs`

List all program deltas for a lender. **Query:** `status`

---

### `GET /api/criteria/clients/:clientId/tenants/:subClientId/programs/:programId/:programVersion`

Get a specific program delta. **Response 404** if not found.

---

### `POST /api/criteria/clients/:clientId/tenants/:subClientId/programs`

Create or update (upsert) a program delta.

**Response 200:** Stored `ProgramCriteriaDelta`.

---

### `PUT /api/criteria/clients/:clientId/tenants/:subClientId/programs/:programId/:programVersion`

Merge-update a program delta.

---

### `DELETE /api/criteria/clients/:clientId/tenants/:subClientId/programs/:programId/:programVersion`

Delete a program delta. Also deletes the compiled canonical cache for that program. Idempotent — 204 even if missing.

---

### `GET /api/criteria/clients/:clientId/tenants/:subClientId/programs/:programId/:programVersion/compiled`

Return fully merged criteria (canonical + delta) for a program. Cache-first: returns the stored compiled document when TTL is valid. Otherwise compiles on-demand.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `force` | `"true"` | — | Skip cache and recompile from source |

```bash
# Normal (cache-first)
curl -s "${API_BASE}/api/criteria/clients/test-client/tenants/test-tenant/programs/FNMA-URAR/1.0.0/compiled" | jq .

# Force recompile
curl -s "${API_BASE}/api/criteria/clients/test-client/tenants/test-tenant/programs/FNMA-URAR/1.0.0/compiled?force=true" | jq .
```

**Response 200:**
```json
{
  "criteria": { },
  "cached": true,
  "metadata": { }
}
```

**Error 404:** Delta or referenced canonical not found.

---

### `POST /api/criteria/clients/:clientId/tenants/:subClientId/programs/:programId/:programVersion/compile`

Force-recompile criteria from source documents (canonical + delta), store the result, invalidate cache, and return the fresh merged criteria. Intended for admin use after editing a canonical or delta.

**Request body (optional):**
```json
{ "userId": "admin@example.com" }
```

**Response 200:**
```json
{
  "criteria": { },
  "cached": false,
  "metadata": { }
}
```

**Error 404:** Delta or referenced canonical not found.

---

## Admin — `/api/admin`

Dead Letter Queue management. All endpoints require the `Admin` Entra role.  
In non-dev environments, also requires the `x-admin-secret` header matching `ADMIN_API_SECRET`.

---

### `GET /api/admin/dlq`

List failed jobs.

**Query parameters:** `limit` (default 20), `offset` (default 0)

**Response 200:**
```json
{
  "jobs": [
    {
      "id": "...",
      "name": "process-fileset",
      "data": { "fileSetId": "...", "subClientId": "...", "clientId": "...", "files": 2 },
      "failedReason": "Pipeline timeout after 300000ms",
      "attemptsMade": 3,
      "timestamp": 1740000000000,
      "processedOn": 1740000001000,
      "finishedOn": 1740000301000
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 22 }
}
```

---

### `GET /api/admin/dlq/:jobId`

Get full details of a specific failed job (including full stacktrace and job data).

**Response 200:** Full job object.  
**Response 404:** Job not found.  
**Response 400:** Job is not in failed state.

---

### `POST /api/admin/dlq/:jobId/retry`

Move a failed job back to the active queue for re-processing.

**Response 200:**
```json
{ "jobId": "...", "retried": true }
```

---

### `POST /api/admin/dlq/retry-all`

Retry all failed jobs in the DLQ.

**Request body (optional):**
```json
{ "limit": 50 }
```

**Response 200:**
```json
{ "retried": 22, "failed": 0 }
```

---

### `DELETE /api/admin/dlq/clear`

Purge all failed jobs from the DLQ.

**Request body (optional):**
```json
{ "confirm": true }
```

**Response 200:**
```json
{ "cleared": 22 }
```

---

### `DELETE /api/admin/dlq/:jobId`

Permanently delete a specific failed job from the DLQ. The job is removed from BullMQ entirely (not recoverable).

**Response 200:**
```json
{
  "success": true,
  "jobId": "...",
  "message": "Job permanently deleted"
}
```

**Error 404:** Job not found.

---

### `GET /api/admin/health/llm`

Probe text and vision LLM endpoints with a minimal completion request. Reflects the actual deployed configuration (same env vars as workers).

```bash
curl -s "${API_BASE}/api/admin/health/llm" | jq .
```

**Response 200** (always 200 — per-probe status distinguishes partial failures):
```json
{
  "overall": "ok",
  "probes": {
    "text": {
      "status": "ok",
      "latencyMs": 245,
      "model": "gpt-4o",
      "error": null
    },
    "vision": {
      "status": "ok",
      "latencyMs": 1200,
      "model": "pixtral-large",
      "error": null
    }
  }
}
```

`overall`: `"ok"` (all probes pass) | `"degraded"` (at least one probe failed)

---

## Config — `/api/config`

Hierarchical actor configuration management (Admin role required). Config is stored in Cosmos with a resolution hierarchy: base → client → tenant → version. Local + cross-process cache invalidation via Redis pub/sub.

---

### `GET /api/config/cache/stats`

Return config cache hit/miss statistics.

```bash
curl -s "${API_BASE}/api/config/cache/stats" | jq .
```

**Response 200:**
```json
{
  "hits": 142,
  "misses": 8,
  "size": 29,
  "keys": ["FileSetInitializer", "TextBasedClassification", ...]
}
```

---

### `POST /api/config/reload`

Invalidate config cache entries locally and across all remote processes via Redis pub/sub. Supports granular or blanket invalidation.

**Request body (all optional):**
```json
{
  "path": "TextBasedClassification",
  "context": {
    "clientId": "acme-bank",
    "subClientId": "acme-bank",
    "versionId": "1.0.0"
  }
}
```

- **No body** → clears entire cache everywhere
- **`path` only** → clears all contexts for that config path
- **`path` + `context`** → clears only the matching entry

```bash
# Nuclear option — clear everything
curl -s -X POST "${API_BASE}/api/config/reload" | jq .

# Clear a specific actor's config
curl -s -X POST "${API_BASE}/api/config/reload" \
  -H "Content-Type: application/json" \
  -d '{"path":"TextBasedClassification"}' | jq .
```

**Response 200:**
```json
{
  "status": "ok",
  "invalidated": "TextBasedClassification",
  "scope": "path",
  "context": null
}
```

---

### `GET /api/config/:path`

Read actor configuration with hierarchical resolution (base → client → tenant → version).

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `clientId` | string | — | Scope to client |
| `subClientId` | string | — | Scope to tenant |
| `versionId` | string | — | Scope to version |
| `direct` | `"true"` | `"false"` | Bypass cache, read directly from Cosmos |

```bash
# Read base config for an actor
curl -s "${API_BASE}/api/config/TextBasedClassification" | jq .

# Read client-scoped config
curl -s "${API_BASE}/api/config/TextBasedClassification?clientId=acme-bank&subClientId=acme-bank" | jq .
```

**Response 200:**
```json
{
  "path": "TextBasedClassification",
  "context": { "clientId": "acme-bank", "subClientId": "acme-bank" },
  "direct": false,
  "config": { }
}
```

**Error 404:** Config path not found for the given context.

---

### `PUT /api/config/:path`

Upsert actor configuration into Cosmos and invalidate all caches (local + cross-process).

**Request body:**
```json
{
  "scope": "client",
  "config": { "temperature": 0.1, "maxTokens": 2048 },
  "context": { "clientId": "acme-bank", "subClientId": "acme-bank" },
  "updatedBy": "admin@example.com"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `scope` | string | ✓ | `base` \| `client` \| `tenant` \| `version` |
| `config` | object | ✓ | Arbitrary config payload |
| `context` | object | — | Required for `client`/`tenant`/`version` scope |
| `updatedBy` | string | — | Audit trail |

**Response 200:**
```json
{
  "status": "ok",
  "path": "TextBasedClassification",
  "scope": "client",
  "context": { "clientId": "acme-bank" },
  "document": { "id": "...", "environment": "dev", "updatedAt": "2026-03-15T..." }
}
```

**Error 400:** Invalid scope/context combination (e.g. `client` scope without `clientId`).

---

## OpenAPI / Swagger — `/api/docs`

---

### `GET /api/docs`

Renders the Swagger UI HTML page for interactive API exploration.

```bash
# Open in browser
open "${API_BASE}/api/docs"
```

---

### `GET /api/docs/openapi.json`

Returns the full OpenAPI 3.1 specification as JSON.

```bash
curl -s "${API_BASE}/api/docs/openapi.json" | jq .
```

---

## Admin — Circuit Breakers `/api/admin/circuit-breakers`

Inspect and control the infrastructure circuit breakers (AzureOpenAI, CosmosDB, BlobStorage). Admin role required.

### `GET /api/admin/circuit-breakers`

List all circuit breakers with current state and stats.

### `GET /api/admin/circuit-breakers/:name`

Detailed stats for a single breaker. Names: `azureOpenAI`, `cosmosDB`, `blobStorage`.

### `POST /api/admin/circuit-breakers/:name/reset`

Force circuit to CLOSED and clear all counters.

### `POST /api/admin/circuit-breakers/:name/open`

Force circuit to OPEN (maintenance kill-switch).

### `POST /api/admin/circuit-breakers/:name/close`

Force circuit to CLOSED (skip recovery wait).

---

## Admin — Queue Management `/api/admin/queue`

BullMQ queue diagnostics and management. Admin role required.

### `GET /api/admin/queue/stats`

Queue depth, pending, active, completed, failed, delayed, and paused counts.

### `GET /api/admin/queue/active`

List currently processing jobs.

### `GET /api/admin/queue/stuck`

List jobs stuck beyond their expected duration.

### `POST /api/admin/queue/stuck/fail`

Force-fail all stuck jobs.

### `POST /api/admin/queue/clean`

Clean old completed/failed jobs. Body: `{ "age": <ms>, "type": "completed" | "failed" }`.

---

## Admin — Idempotency `/api/admin/idempotency`

Idempotency key inspection and metrics. Admin role required.

### `GET /api/admin/idempotency/metrics`

Cache hit/miss rates and totals.

### `POST /api/admin/idempotency/metrics/reset`

Reset metrics counters.

### `GET /api/admin/idempotency/keys/:key`

Inspect a specific idempotency record by its raw Redis key suffix.

### `DELETE /api/admin/idempotency/keys/:key`

Delete a stuck idempotency key to allow reprocessing.

---

## Admin — Feature Flags `/api/admin/features`

Feature flag CRUD with context-aware resolution. Admin role required.

### `GET /api/admin/features`

List all feature flags with current enabled state.

### `GET /api/admin/features/:name`

Check a single feature flag. Query: `?clientId=X&subClientId=Y` for context-scoped resolution.

### `PUT /api/admin/features/:name`

Create or update a feature flag. Body: `{ "enabled": true, "rolloutPercentage": 50, "enabledFor": ["acme"], "effectiveDate": "...", "expiresAt": "..." }`.

### `DELETE /api/admin/features/:name`

Soft-delete a feature flag (sets enabled=false with deletedAt timestamp).

---

## Admin — Archived Events `/api/admin/events`

Cross-pipeline archived event queries from Cosmos cold storage. Admin role required.

### `GET /api/admin/events`

Query archived events with filtering. Query params: `startTime`, `endTime`, `types` (comma-separated), `severity`, `source`, `pipelineId`, `executionId`, `fileSetId`, `actorType`, `limit` (max 1000), `offset`, `orderBy`, `order`.

### `GET /api/admin/events/stats`

Event counts aggregated by type.

---

## Admin — Worker Metrics `/api/admin/metrics`

Cross-process worker metrics aggregated from Redis-published snapshots. Admin role required.

### `GET /api/admin/metrics/workers`

Per-worker health and metrics snapshots.

### `GET /api/admin/metrics/pipelines`

Aggregated pipeline throughput (started, completed, failed, active) across all workers.

### `GET /api/admin/metrics/stages`

Per-stage timing averages aggregated across workers.

### `GET /api/admin/metrics/reconciler`

Reconciler and orphan reconciler stats aggregated from worker metrics.

---

## Admin — Checkpoints `/api/admin/checkpoints`

Pipeline checkpoint management (Redis + Cosmos). Admin role required.

### `POST /api/admin/checkpoints/prune`

Prune old checkpoints for a specific execution (keeps latest N per config). Body: `{ "executionId": "..." }`.

### `DELETE /api/admin/checkpoints/:executionId`

Delete ALL checkpoints for a specific execution. Destructive — execution can no longer be resumed.

---

## Admin — Provenance Hooks `/api/admin/provenance`

Provenance lifecycle hook inspection and control. Admin role required.

### `GET /api/admin/provenance/hooks`

List all registered provenance lifecycle hooks.

### `GET /api/admin/provenance/hooks/:id`

Get detail for a specific hook.

### `PUT /api/admin/provenance/hooks/:id/enabled`

Enable or disable a hook. Body: `{ "enabled": true }`.

---

## Admin — Infrastructure `/api/admin/infrastructure`

Redis infrastructure visibility. Admin role required.

### `GET /api/admin/infrastructure/redis`

Redis INFO output parsed into sections. Query: `?section=memory` for a specific section, `?raw=true` for raw output.

### `GET /api/admin/infrastructure/redis/keyspace`

Key count per Axiom namespace prefix (axiom:pipeline:, axiom:checkpoint:, loom:, bull:, etc.).

---

## Admin — Cluster `/api/admin/cluster`

Loom cluster introspection. Admin role required.

### `GET /api/admin/cluster/status`

Overall cluster health: runtime liveness, pipeline state store summary, Redis latency.

### `GET /api/admin/cluster/pipelines`

List active pipeline state keys with status and metadata. Query: `?limit=100`.

### `GET /api/admin/cluster/locations`

Enumerate actor locations from the Loom location directory. Query: `?limit=200`.

---

## Admin — Config Bulk `/api/admin/config-bulk`

Bulk config operations for backup, migration, and validation. Admin role required.

### `GET /api/admin/config-bulk/paths`

List all distinct config paths. Query: `?scope=base&environment=dev`.

### `GET /api/admin/config-bulk/export`

Export config documents. Query: `?prefix=actors.&scope=base&environment=dev`.

### `POST /api/admin/config-bulk/import`

Bulk-import config documents. Body: `{ "documents": [{ "path": "...", "scope": "base", "config": {...} }] }`. Max 500 docs. Returns 207 on partial failure.

### `POST /api/admin/config-bulk/validate/:path`

Dry-run validation. Body: `{ "scope": "base", "config": {...}, "context": {...} }`.

### `DELETE /api/admin/config-bulk/prefix/:prefix`

Delete all config docs matching a path prefix. Query: `?confirm=true` to execute (default is dry-run).

---

## Deprecated

### `POST /api/evaluations` — **410 Gone**

This endpoint was backed by a stub that was never initialized. Use:
- `POST /api/pipelines` for pipeline execution
- `POST /api/criterion/loans/:loanId/programs/:programId/evaluate` for criterion evaluation

---

## Common Error Shape

All error responses follow:
```json
{
  "error": "Short error type",
  "message": "Human-readable explanation of what went wrong and what to fix"
}
```

Validation errors include a `details` array with field-level messages.

---

## Notes

- **Authentication:** All routes require a valid Entra ID token in production (Bearer JWT). The `Admin` role is required for `/api/admin/*` and `/api/config/*`.
- **Max request body:** 10 MB JSON, 8 MB per uploaded file.
- **Pipeline workers** run in a separate Container App. `POST /api/pipelines` is non-blocking — poll `GET /api/pipelines/:jobId` or use SSE at `GET /api/pipelines/:jobId/observe`.
- **Agent workers** also run in the workers Container App for async runs (`POST /api/agent/run/async`). Sync runs (`POST /api/agent/run`) execute in the API process.
- **SSE endpoints** (`/observe`, `/stream`, agent `/observe`) require `Accept: text/event-stream`. All include heartbeats every 15 s and auto-close on terminal events.
- **Loom stage input expressions:** Strings are literal in Loom 0.9.1+. Wrap JMESPath in `{ "path": "trigger.fieldName" }`.
- **Config resolution order:** `version` → `tenant` → `client` → `base`. First non-null value wins.

---

## Endpoint Index

Quick reference of all endpoints grouped by route prefix:

| Prefix | Endpoints | Description |
|---|---|---|
| `/health`, `/ready` | 2 | Platform health & readiness probes |
| `/api/pipelines` | 9 | Pipeline submission, status, results, cancel, pause/resume, stream |
| `/api/pipelines/:id/...` | 6 | Pipeline observation (SSE, stages, tasks, events, checkpoints, definition) |
| `/api/documents` | 3 | Document upload and FileSet status |
| `/api/criterion` | 3 | Synchronous criterion evaluation |
| `/api/agent` | 8 | Agent execution (sync + async), cancel, signal, observe |
| `/api/schemas` | 14 | Schema CRUD, validation, lifecycle, LLM inference |
| `/api/actors` | 5 | Actor registry CRUD |
| `/api/criteria` | 12 | Canonical taxonomies, program deltas, compiled criteria |
| `/api/admin` | 7 | DLQ management, LLM health, runtime introspection |
| `/api/admin/circuit-breakers` | 5 | Circuit breaker inspection & control |
| `/api/admin/queue` | 5 | BullMQ queue diagnostics & management |
| `/api/admin/idempotency` | 4 | Idempotency key inspection & metrics |
| `/api/admin/features` | 4 | Feature flag CRUD |
| `/api/admin/events` | 2 | Archived event queries |
| `/api/admin/metrics` | 4 | Worker metrics aggregation |
| `/api/admin/checkpoints` | 2 | Checkpoint pruning & deletion |
| `/api/admin/provenance` | 3 | Provenance hook management |
| `/api/admin/infrastructure` | 2 | Redis INFO & keyspace |
| `/api/admin/cluster` | 3 | Cluster status & pipeline state |
| `/api/admin/config-bulk` | 5 | Config export, import, validation |
| `/api/config` | 4 | Hierarchical actor config CRUD + cache management |
| `/api/docs` | 2 | OpenAPI spec + Swagger UI |
| **Total** | **~114** | |
