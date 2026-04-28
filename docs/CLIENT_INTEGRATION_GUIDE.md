# Axiom — Client Integration Guide

**Audience:** External client applications (e.g., Appraisal Management) integrating with the Axiom document processing platform.

**Base URL (dev):** `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`

**Auth:** Currently open (`AEGIS_AUTH_MODE=off`). No token required yet. When auth is enabled, clients will pass an Entra Bearer token: `Authorization: Bearer <token>`.

**CORS:** Open in dev. Any origin can call the API directly.

---

## Overview

The core client flow for every document submission:

```
1. POST /api/documents              → get fileSetId + queueJobId
2. GET  /api/pipelines/:jobId/stream → real-time SSE stream until done
3. GET  /api/pipelines/:jobId/results → final structured results
```

**Alternative (push model):** Use `POST /api/pipelines` instead of step 1 to register webhook endpoints that Axiom will POST lifecycle events to. See [Webhook Model](#-webhook-model-alternative) below.

---

## Step 1 — Submit a Document

```http
POST /api/documents
Content-Type: multipart/form-data
```

### Required fields

| Field | Type | Notes |
|---|---|---|
| `clientId` | string | Your organisation's client identifier |
| `subClientId` | string | Tenant/sub-client identifier |
| `files` | binary (multipart) | One or more PDF/document files |

### Optional fields

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human-readable label for this submission |
| `description` | string | Free-text description |
| `programId` | string | Processing program (e.g. `urar`, `fnma-1003`) |
| `programVersion` | string | Version of the program |
| `pipelineId` | string | Pipeline template to run (default: `document-extraction`) |
| `metadata` | JSON string | Arbitrary key/value pairs threaded through to results |
| `presignedUrls` | JSON string | Array of `{ fileName, url, fileSize }` — hot-link files instead of uploading |
| `azureBlobPaths` | JSON string | Array of `{ containerName, blobName, fileName, fileSize }` — reference blobs already in Azure Storage |

### Example — file upload

```typescript
const form = new FormData();
form.append('clientId', 'axm-client-001');
form.append('subClientId', 'fidelity-national');
form.append('name', '123 Main St — Appraisal 2026');
form.append('programId', 'urar');
form.append('metadata', JSON.stringify({ loanNumber: 'LN-2026-00123', orderId: 'APR-7890' }));
form.append('files', pdfBuffer, 'appraisal.pdf');

const res = await fetch('https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io/api/documents', {
    method: 'POST',
    body: form,
});

const { fileSetId, queueJobId, status, files } = await res.json();
// status === 'queued'
// Store both fileSetId and queueJobId — you'll need them in subsequent calls.
```

### Example — Azure Blob reference (no binary upload)

```typescript
const form = new FormData();
form.append('clientId', 'axm-client-001');
form.append('subClientId', 'fidelity-national');
form.append('azureBlobPaths', JSON.stringify([
    {
        containerName: 'raw-uploads',
        blobName: 'inbound/2026/appraisal-7890.pdf',
        fileName: 'appraisal-7890.pdf',
        fileSize: 1048576
    }
]));

const res = await fetch('.../api/documents', { method: 'POST', body: form });
const { fileSetId, queueJobId } = await res.json();
```

### Response `201`

```json
{
    "fileSetId": "fset-fidelity-national-axm-client-001-1743350000000",
    "queueJobId": "fset-fidelity-national-axm-client-001-1743350000000-1743350001234",
    "status": "queued",
    "files": [
        { "fileName": "appraisal.pdf", "url": "https://...", "fileSize": 1048576, "uploadMethod": "inline" }
    ],
    "message": "FileSet created and queued for processing. 1 file(s) uploaded."
}
```

### Error responses

| Status | Meaning |
|---|---|
| `400` | Missing required fields, invalid metadata JSON, or file validation failed |
| `413` | File exceeds per-file size limit |
| `429` | Queue at capacity or per-tenant rate limit — retry after `Retry-After` seconds |
| `503` | Axiom service not ready (transient — retry) |

---

## Step 2 — Stream Status (SSE)

Open a Server-Sent Events connection immediately after submission using the `queueJobId` from Step 1. The stream closes automatically when the pipeline finishes.

```
GET /api/pipelines/:queueJobId/stream
Accept: text/event-stream
```

> **Use `/stream`, not `/observe`.** `/stream` is the recommended, Redis-backed implementation. `/observe` is a legacy endpoint.

### EventSource example (browser)

```typescript
function streamPipeline(jobId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const baseUrl = 'https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io';
        const source = new EventSource(`${baseUrl}/api/pipelines/${jobId}/stream`);

        source.addEventListener('snapshot', (e) => {
            const data = JSON.parse(e.data);
            console.log('Initial state:', data.status, data.stages);
        });

        source.addEventListener('stage.started', (e) => {
            const { stageName } = JSON.parse(e.data);
            console.log('Stage started:', stageName);
        });

        source.addEventListener('stage.completed', (e) => {
            const { stageName, result } = JSON.parse(e.data);
            console.log('Stage complete:', stageName, result);
        });

        source.addEventListener('pipeline_final', (e) => {
            const { status, completedAt } = JSON.parse(e.data);
            source.close();
            if (status === 'completed') resolve();
            else reject(new Error(`Pipeline failed at ${completedAt}`));
        });

        source.addEventListener('pipeline.failed', (e) => {
            source.close();
            reject(new Error(JSON.parse(e.data).error));
        });

        source.onerror = (err) => {
            source.close();
            reject(err);
        };
    });
}
```

### Node.js / server-side example

`EventSource` is a browser API. In Node.js use the `eventsource` npm package or `fetch` with a readable stream:

```typescript
import EventSource from 'eventsource';

const source = new EventSource(
    `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io/api/pipelines/${jobId}/stream`
);

source.addEventListener('pipeline_final', (e) => {
    const data = JSON.parse(e.data);
    source.close();
    console.log('Done:', data.status);
});
```

### SSE event types

| Event | When fired | Key payload fields |
|---|---|---|
| `snapshot` | Immediately on connect | `status`, `stages[]`, `executionId`, `pipelineId` |
| `stage.started` | Stage begins | `stageName`, `timestamp` |
| `stage.completed` | Stage finishes | `stageName`, `result`, `durationMs` |
| `stage.failed` | Stage errors | `stageName`, `error`, `timestamp` |
| `task.completed` | Individual task done | `stageName`, `taskId`, `result` |
| `pipeline_final` | Pipeline done (success or failure) | `status`, `completedAt`, `executionId` |
| `pipeline.failed` | Pipeline failed | `error`, `executionId` |
| `: heartbeat` | Every 15s | Comment line — keep-alive, no data |

The stream auto-closes ~1 second after `pipeline_final` is emitted. Always handle `onerror` and close the source on final events to prevent connection leaks.

### Reconnection

`EventSource` reconnects automatically on network drops. The `/stream` endpoint replays events from the last-seen position using the `Last-Event-ID` header. No extra work required.

---

## Step 3 — Poll Status (Alternative to SSE)

If SSE is not practical (e.g., serverless, short-lived processes), poll instead:

```typescript
async function waitForCompletion(fileSetId: string, intervalMs = 5000): Promise<void> {
    const baseUrl = 'https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io';

    while (true) {
        const res = await fetch(`${baseUrl}/api/documents/${fileSetId}/status`);
        const { status, executionId, completedAt, error } = await res.json();

        if (status === 'completed') return;
        if (status === 'failed') throw new Error(`Pipeline failed: ${error}`);

        await new Promise(r => setTimeout(r, intervalMs));
    }
}
```

```
GET /api/documents/:fileSetId/status
```

Response:

```json
{
    "fileSetId": "fset-...",
    "executionId": "fset-...-1743350001234",
    "status": "running",
    "startedAt": "2026-03-30T14:00:00.000Z",
    "completedAt": null,
    "duration": null,
    "error": null
}
```

Status values: `queued` → `running` → `completed` | `failed`

---

## Step 4 — Fetch Results

```
GET /api/pipelines/:queueJobId/results
```

Returns `409` if the pipeline is not yet finished. Wait for `completed` status before calling.

```typescript
const res = await fetch(`${baseUrl}/api/pipelines/${queueJobId}/results`);

if (res.status === 409) {
    // Pipeline still running — results not ready yet
}

const { jobId, fileSetId, status, results, executionMetadata } = await res.json();
```

Response:

```json
{
    "jobId": "fset-...-1743350001234",
    "fileSetId": "fset-...",
    "status": "completed",
    "results": { /* extracted document data */ },
    "pipeline": { "name": "document-extraction", "version": "1.0.0" },
    "executionMetadata": {
        "submittedAt": "2026-03-30T14:00:00.000Z",
        "startedAt": "2026-03-30T14:00:01.000Z",
        "completedAt": "2026-03-30T14:02:30.000Z",
        "duration": 149000,
        "actorsExecuted": 4
    }
}
```

### Fetch the full FileSet (documents + metadata)

```
GET /api/documents/:fileSetId?clientId=axm-client-001&subClientId=fidelity-national
```

Both `clientId` and `subClientId` are required query parameters (used as the Cosmos partition key).

---

## Putting It Together — End-to-End Example

```typescript
const BASE = 'https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io';

async function processAppraisal(pdfBuffer: Buffer, meta: { loanNumber: string }): Promise<unknown> {
    // 1. Submit
    const form = new FormData();
    form.append('clientId', 'axm-client-001');
    form.append('subClientId', 'fidelity-national');
    form.append('programId', 'urar');
    form.append('metadata', JSON.stringify(meta));
    form.append('files', pdfBuffer, 'appraisal.pdf');

    const submitRes = await fetch(`${BASE}/api/documents`, { method: 'POST', body: form });
    if (!submitRes.ok) throw new Error(`Submit failed: ${submitRes.status}`);
    const { fileSetId, queueJobId } = await submitRes.json();

    // 2. Stream until done
    await new Promise<void>((resolve, reject) => {
        const source = new EventSource(`${BASE}/api/pipelines/${queueJobId}/stream`);
        source.addEventListener('pipeline_final', (e) => {
            const d = JSON.parse(e.data);
            source.close();
            d.status === 'completed' ? resolve() : reject(new Error('Pipeline failed'));
        });
        source.onerror = () => { source.close(); reject(new Error('SSE error')); };
    });

    // 3. Fetch results
    const resultsRes = await fetch(`${BASE}/api/pipelines/${queueJobId}/results`);
    if (!resultsRes.ok) throw new Error(`Results fetch failed: ${resultsRes.status}`);
    const { results } = await resultsRes.json();
    return results;
}
```

---

## 🔔 Webhook Model (Alternative)

Use `POST /api/pipelines` instead of `POST /api/documents` when you want Axiom to **push** events to your service rather than your service pulling/streaming.

```http
POST /api/pipelines
Content-Type: application/json
```

```json
{
    "pipelineId": "document-extraction",
    "input": {
        "fileSetId": "fset-...",
        "files": [{ "fileName": "appraisal.pdf", "url": "https://..." }]
    },
    "subClientId": "fidelity-national",
    "clientId": "axm-client-001",
    "webhooks": [
        {
            "id": "appraisal-mgmt-lifecycle",
            "url": "https://your-service.example.com/axiom/webhook",
            "type": "durable",
            "events": ["pipeline.completed", "pipeline.failed"],
            "headers": { "Authorization": "Bearer your-inbound-secret" }
        },
        {
            "id": "appraisal-mgmt-progress",
            "url": "https://your-service.example.com/axiom/progress",
            "type": "ephemeral",
            "events": ["stage.*"],
            "batchSize": 10,
            "flushIntervalMs": 500
        }
    ]
}
```

Response `202`:

```json
{
    "jobId": "exec-1743350001234-abc123",
    "status": "queued"
}
```

### Webhook delivery types

| Type | Guarantee | Use for |
|---|---|---|
| `durable` | At-least-once, BullMQ-backed with exponential backoff | `pipeline.completed`, `pipeline.failed` — must not be lost |
| `ephemeral` | At-most-once, fire-and-forget, supports batching | Stage/page progress — high frequency, OK to lose occasionally |

### Webhook POST payload (single durable event)

```json
{
    "eventId": "uuid-v4",
    "type": "pipeline.completed",
    "executionId": "exec-...",
    "entityId": "fset-...",
    "entityType": "FileSet",
    "timestamp": "2026-03-30T14:02:30.000Z",
    "source": "axiom-pipeline-runner",
    "sequenceNumber": 42,
    "subClientId": "fidelity-national",
    "clientId": "axm-client-001",
    "correlationId": "optional-trace-id",
    "payload": { /* event-specific data */ }
}
```

Ephemeral endpoints receive a JSON **array** of the above objects.

### Topic patterns

| Pattern | Matches |
|---|---|
| `pipeline.completed` | Exact |
| `pipeline.*` | `pipeline.completed`, `pipeline.failed`, etc. |
| `stage.*` | All stage events |
| `*` | Everything |

### Idempotency

Durable webhooks are at-least-once. Your receiver must be idempotent. Use `eventId` (UUID) to deduplicate. Discard events with `sequenceNumber` ≤ the last processed value for a given `executionId`.

---

## Rate Limits & Back-Pressure

| Condition | Response |
|---|---|
| Per-tenant queue quota exceeded | `429` with `Retry-After` header |
| Global queue at max depth | `429` with `{ "retryAfter": 30 }` |

Always check `res.status === 429` and honour the `Retry-After` value before retrying.

---

## Front Door / Gateway (Staging & Production)

In staging/prod the API sits behind Azure Front Door. All requests must include:

```
X-Azure-FDID: <frontDoorId>
```

In **dev** this header is optional — the guard is a no-op. The dev FQDN is directly reachable.

For SSE through Front Door: Front Door Standard may buffer the stream. If you see delayed events, contact the platform team to confirm buffering settings.

---

## Quick Reference

| Operation | Method | Path |
|---|---|---|
| Submit document(s) | `POST` | `/api/documents` |
| Stream execution events | `GET` (SSE) | `/api/pipelines/:jobId/stream` |
| Poll execution status | `GET` | `/api/documents/:fileSetId/status` |
| Fetch results | `GET` | `/api/pipelines/:jobId/results` |
| Fetch full FileSet | `GET` | `/api/documents/:fileSetId?clientId=…&subClientId=…` |
| Submit with webhooks | `POST` | `/api/pipelines` |
| List executions | `GET` | `/api/pipelines?fileSetId=…&status=…&clientId=…` |

---

## Key IDs to Track

After `POST /api/documents` you receive two IDs — track both:

| ID | Source | Used for |
|---|---|---|
| `fileSetId` | Response body | Status polling, FileSet retrieval, Cosmos queries |
| `queueJobId` | Response body | SSE streaming, results fetch, execution lookup |

When using `POST /api/pipelines` directly you receive only `jobId` (equivalent to `queueJobId`). You must supply `fileSetId` yourself via the `input` object in that case.
