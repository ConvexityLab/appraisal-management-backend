# Axiom Bulk Submission Runbook

## Scope
This runbook covers production operations for the `axiom.bulk-evaluation.requested` background submission pipeline.

Related operational artifacts:
- Bulk ingestion operations runbook: `docs/BULK_INGESTION_OPERATIONS_RUNBOOK.md`
- App Insights workbook spec: `docs/observability/BULK_INGESTION_APP_INSIGHTS_WORKBOOK_SPEC.md`
- KQL query pack: `docs/observability/bulk-ingestion-observability.kql`

## Components
- Consumer: `AxiomBulkSubmissionService`
- Event topic: `axiom.bulk-evaluation.requested`
- Primary job container: `bulk-portfolio-jobs`
- Operational artifacts:
  - Receipt: `type = axiom-bulk-submission-receipt`
  - Submission lock: `type = axiom-bulk-submission-lock`
  - DLQ record: `type = axiom-bulk-submission-dlq`
  - Metrics record: `type = axiom-bulk-submission-metrics`

## Key Behaviors
- Replay-safe intake: duplicate event IDs are dropped via immutable receipts.
- Per-job idempotency: only one in-progress submission per `(tenantId, jobId)` lock.
- Failures are durable: failed submissions create DLQ records.
- Alerts:
  - Emits `system.alert` events (`alertType = AXIOM_BULK_SUBMISSION`).
  - Optional webhook alert if `AXIOM_BULK_ALERT_WEBHOOK_URL` is set.

## Operational Endpoints
- Metrics: `GET /api/axiom/bulk-submission/metrics`
- DLQ replay: `POST /api/axiom/bulk-submission/dlq/{eventId}/replay`

## Metrics Dictionary
The metrics document stores cumulative counters:
- `eventsReceived`
- `eventsReplaySkipped`
- `eventsDuplicateSkipped`
- `submissionsSucceeded`
- `submissionsFailed`
- `dlqCreated`
- `replayAttempts`
- `replaySucceeded`
- `replayFailed`
- `alertsSent`
- `alertFailures`

## Incident Response
1. Identify impact
   - Check `GET /api/axiom/bulk-submission/metrics` for `submissionsFailed`, `dlqCreated`, `replayFailed`.
2. Locate failed submission
   - Query `bulk-portfolio-jobs` for `type = axiom-bulk-submission-dlq` and `status = OPEN`.
3. Validate root cause
   - Inspect `error`, `eventPayload`, and related job lock (`type = axiom-bulk-submission-lock`).
4. Replay
   - Call `POST /api/axiom/bulk-submission/dlq/{eventId}/replay`.
5. Confirm recovery
   - Verify DLQ status becomes `REPLAYED` and includes `replayResult.pipelineJobId`.
   - Verify corresponding bulk job has `axiomSubmissionStatus = submitted`.

## Failure Patterns
- `already-completed`
  - Safe duplicate; no action required.
- `in-progress-by-another-event`
  - Wait for active owner event completion; investigate lock staleness if persistent.
- Axiom API failure
  - DLQ entry should exist; replay after external dependency is healthy.

## Escalation
Escalate to platform on-call if:
- `dlqCreated` grows continuously for >15 minutes,
- replay attempts fail repeatedly for the same event,
- `alertFailures` increases (indicates degraded alert path).

## Environment
Optional alert webhook:
- `AXIOM_BULK_ALERT_WEBHOOK_URL=https://<your-alert-endpoint>`


# Axiom Integration Handoff — Action Required from Axiom Team (2026-04-01)

## Goal
Enable real (non-mock) end-to-end processing from `appraisal-management-backend` to Axiom so we can submit engagements/orders and related appraisal documents today and receive authoritative completion callbacks.

## What You Need To Do On Your Side

1. Confirm pipeline submission contract for `POST /api/pipelines`
   - Accept and honor these `input` fields exactly:
     - `subClientId`
     - `clientId`
     - `correlationId`
     - `correlationType` (`ORDER` and `BULK_JOB`)
     - `webhookUrl`
     - `webhookSecret`
     - `fields[]`
     - `documents[]`
     - `schemaMode`
     - `programId` (when provided)
   - Return `jobId` in the `202` response.

2. Ensure streaming endpoint is available for job progress
   - Support stream/observe endpoint for submitted jobs (our backend consumes this for progress):
     - `GET /api/pipelines/:jobId/observe` (or equivalent currently documented by your environment)
   - Emit task/progress + terminal events with correlation information.

3. Enable authoritative webhook callbacks back to our backend
   - On terminal completion, POST to our supplied `webhookUrl`.
   - Sign each callback with header:
     - `X-Axiom-Signature: hmac-sha256=<hex>`
   - Signature input must be the raw request body, using the exact `webhookSecret` received at submit time.

4. Correlation fidelity is mandatory
   - Echo `correlationId` and `correlationType` in:
     - stream events
     - webhook payloads
     - terminal result payload
   - We use these values as primary routing keys for order/bulk record stamping.

5. Result retrieval must be available after completion
   - Ensure `GET /api/pipelines/:jobId/results` returns terminal outputs consistently.
   - Retention window must be long enough for webhook retry and backend reconciliation.

6. Delivery reliability requirements
   - Retry webhook delivery on non-2xx.
   - Use idempotent delivery semantics (same event safe to replay).
   - Include stable event identifiers/timestamps in payloads.

## Required Confirmations (Reply With Yes/No + Details)

1. `POST /api/pipelines` supports every field above and returns `jobId`.
2. Streaming endpoint contract and event schema are stable in your current environment.
3. Webhook signature algorithm is exactly `HMAC-SHA256(rawBody, webhookSecret)` and header format is exactly `hmac-sha256=<hex>`.
4. Correlation fields are echoed unchanged in stream + webhook + results.
5. Webhook retry policy (retry count/backoff/timeout) is enabled.
6. Staging URL and prod URL to use now.

## Acceptance Test You Should Run On Your Side

1. Receive one real submission (`ORDER`) with webhook fields.
2. Emit progress events for the job.
3. Send signed webhook callback to provided URL.
4. Verify callback accepted (HTTP 200).
5. Ensure results endpoint returns complete payload for returned `jobId`.
6. Repeat for `BULK_JOB` with multiple loan records.

## Payload Shape We Send (Representative)

```json
{
  "pipeline": { "name": "risk-evaluation", "stages": ["..."] },
  "input": {
    "subClientId": "<tenant>",
    "clientId": "<client>",
    "correlationId": "<order-or-bulk-id>",
    "correlationType": "ORDER",
    "webhookUrl": "https://<our-api>/api/axiom/webhook",
    "webhookSecret": "<shared-secret>",
    "fields": [
      { "fieldName": "loanAmount", "fieldType": "number", "value": 450000 }
    ],
    "documents": [
      { "documentName": "Appraisal Report.pdf", "documentReference": "https://..." }
    ],
    "schemaMode": "RISK_EVALUATION",
    "programId": "<optional-program>"
  }
}
```

## Completion Criteria For Today

- Axiom confirms all six contract items above.
- We receive one signed webhook for an `ORDER` submission and process it successfully.
- We receive one signed webhook for a `BULK_JOB` submission and process it successfully.
- Results are queryable by `jobId` after terminal completion.

## Point of Integration on Our Side

- Submit + stream watcher: `src/services/axiom.service.ts`
- Webhook signature verification: `src/middleware/verify-axiom-webhook.middleware.ts`
- Webhook handlers: `src/controllers/axiom.controller.ts`

---

## Axiom Team Response to Client AI Assistant (2026-04-01)

### Contract Confirmation (Yes/No + Details)

1. **`POST /api/pipelines` supports required fields and returns `jobId`**
   - **Yes.**
   - `input.subClientId` is required exactly as named — no aliases.
   - `input.clientId` is required exactly as named — no aliases.
   - We accept `input.correlationId` and `input.correlationType`.
   - We accept `input.webhookUrl` + `input.webhookSecret` and auto-generate a durable webhook subscription for pipeline lifecycle events.
   - `202` response returns `jobId`.

2. **Streaming endpoint contract is available and stable**
   - **Yes.**
   - Supported endpoints:
     - `GET /api/pipelines/:jobId/observe`
     - `GET /api/pipelines/:jobId/stream`
   - We published/locked event envelope and terminal event contract in OpenAPI.

3. **Webhook signature algorithm and format**
   - **Yes.**
   - Outbound webhook signing is implemented as:
     - `X-Axiom-Signature: hmac-sha256=<hex>`
     - Signature = `HMAC-SHA256(rawBody, webhookSecret)` over exact outbound JSON body bytes.

4. **Correlation fidelity (stream + webhook + results)**
   - **Yes.**
   - `correlationId` and `correlationType` are now persisted and echoed in:
     - stream/observe events,
     - webhook payloads,
     - terminal `GET /api/pipelines/:jobId/results` payload.

5. **Webhook retry policy and delivery reliability**
   - **Yes.**
   - Durable webhooks use BullMQ retries with exponential backoff (at-least-once delivery).
   - Stable identifiers/timestamps are present (`eventId`, `sequenceNumber`, `timestamp`) to support idempotent replay handling downstream.

6. **Staging/prod URLs**
   - **Staging/dev:** environment-specific API base URL currently used by Axiom integration tests.
   - **Prod:** to be provided by environment owner/release management at cutover (not hardcoded in this document).

### What We Implemented

- `input.subClientId` and `input.clientId` are strict required fields — no aliasing, no fallbacks.
- Accepted fields: `correlationId`, `correlationType`, `webhookUrl`, `webhookSecret`.
- Automatic durable webhook generation from `webhookUrl`/`webhookSecret` fields.
- HMAC signing for outbound webhooks with exact required header format.
- Correlation propagation hardening across worker, lifecycle events, observe/stream, and results payload.
- OpenAPI updates to document/lock event envelope and terminal event behavior.

### Focused Integration Test Status

- Script added: `scripts/test-integration-correlation-webhook.ts`
- Command: `pnpm test:integration:webhook-correlation`
- Assertion coverage:
  - submit compatibility fields,
  - webhook signature,
  - correlation echo via `/observe` and `/results`.

**Latest run result (2026-04-01):**
- ✅ Pipeline submitted successfully with `correlationId`, `correlationType`, `webhookUrl`, `webhookSecret`.
- ✅ All 14 pipeline stages completed (job `b7a02ad5`, BadieCredit.pdf, 9 pages extracted).
- ✅ Correlation echoed in `/observe` stream and `/results` terminal payload.
- ✅ Webhook delivery confirmed at `TEST_WEBHOOK_URL`.
- Environment corrected: `AZURE_STORAGE_ACCOUNT_NAME=axiomdevst`.

**Deployed commit:** `5bc706b` — live on `axiom-dev-api` and `axiom-dev-workers` as of 2026-04-01.
All three GitHub Actions jobs passed: Build & Push, Rollout, Seed Catalog Data.

### Go/No-Go

- **Code readiness:** **GO**.
- **Environment readiness:** **GO**.
- **Integration test:** **GO** — `pnpm test:integration:webhook-correlation` passes end-to-end.

---

## Authoritative Caller Payload Specification (for Calling Application AI Assistant)

This section is the exact, verified contract your AI assistant should use to construct submissions to Axiom. All field names, validations, and constraints below are derived directly from the Axiom API source (`src/api/routes/pipelines.ts`) and pipeline stage input mappings (`src/pipelines/smart-criteria-evaluation-pipeline.ts`).

### Endpoint

```
POST /api/pipelines
Content-Type: application/json
```

Returns `202 Accepted` with `{ "jobId": "<uuid>" }` on success.

---

### Field Reference

#### Required — API will return `400` if absent

| Field | Type | Notes |
|---|---|---|
| `input.clientId` | `string` | Identifies the client. No alias accepted. |
| `input.subClientId` | `string` | Identifies the sub-client/tenant. **`tenantId` is not accepted — use `subClientId` exactly.** |

#### Required for criteria evaluation

If omitted, the criteria stage returns empty and the pipeline continues without evaluation (no error). If present, the combination must exactly match a seeded delta document in Cosmos — there is no fallback.

| Field | Type | Notes |
|---|---|---|
| `input.programId` | `string` | Program identifier. Must match a seeded delta for this `clientId`/`subClientId`. |
| `input.programVersion` | `string` | Program version. Must match the seeded delta exactly (e.g. `"1.0.0"`). |

#### Required for document processing stages

| Field | Type | Notes |
|---|---|---|
| `input.fileSetId` | `string` | Caller-generated logical grouping ID for this file set (e.g. `"fs-1714000000000"`). |
| `input.files` | `array` | Array of file descriptor objects (see schema below). |
| `input.storageAccountName` | `string` | Azure Storage account name (e.g. `"axiomdevst"`). |
| `input.containerName` | `string` | Blob container name (e.g. `"raw-files"`). |
| `input.requiredDocuments` | `string[]` | Document type IDs expected in this file set (e.g. `["credit-report"]`). |

#### `input.files[]` object schema

| Field | Type | Notes |
|---|---|---|
| `fileName` | `string` | Display name of the file. |
| `url` | `string` | Full blob URL. |
| `mediaType` | `string` | MIME type, e.g. `"application/pdf"`. |
| `downloadMethod` | `string` | Use `"azure-sdk"` for Azure Blob Storage. |

#### Optional — correlation and webhook

| Field | Type | Notes |
|---|---|---|
| `input.correlationId` | `string` | Your order or case ID. Echoed unchanged in stream events, webhook payloads, and results. |
| `input.correlationType` | `string` | `"ORDER"` or `"BULK_JOB"`. Echoed unchanged in stream events, webhook payloads, and results. |
| `input.webhookUrl` | `string` | HTTPS URL Axiom will POST terminal results to. |
| `input.webhookSecret` | `string` | Shared secret for HMAC-SHA256 signing. Axiom signs outbound payloads with `X-Axiom-Signature: hmac-sha256=<hex>` where the signature is `HMAC-SHA256(rawBody, webhookSecret)`. |

---

### Minimal Working Example (test environment)

```json
{
  "pipelineId": "complete-document-criteria-evaluation",
  "input": {
    "clientId": "test-client",
    "subClientId": "test-tenant",

    "programId": "BADIE-CREDIT",
    "programVersion": "1.0.0",

    "fileSetId": "fs-1714000000000",
    "requiredDocuments": ["credit-report"],
    "storageAccountName": "axiomdevst",
    "containerName": "raw-files",

    "files": [
      {
        "fileName": "BadieCredit.pdf",
        "url": "https://axiomdevst.blob.core.windows.net/raw-files/BadieCredit.pdf",
        "mediaType": "application/pdf",
        "downloadMethod": "azure-sdk"
      }
    ],

    "correlationId": "order-abc-123",
    "correlationType": "ORDER",
    "webhookUrl": "https://your-api/api/axiom/webhook",
    "webhookSecret": "your-shared-secret"
  }
}
```

---

### Seeded Criteria Delta Combinations

All currently seeded under `clientId: "test-client"` / `subClientId: "test-tenant"`:

| `programId` | `programVersion` |
|---|---|
| `BADIE-CREDIT` | `1.0.0` |
| `CREDIT-REPORT` | `1.0.0` |
| `FNMA-1004` | `1.0.0` |
| `FNMA` | `1.0.0` |
| `FNMA-URAR` | `1.0.0` |
| `va-irrl` | `1.0` |

**Critical constraint:** `clientId` + `subClientId` + `programId` + `programVersion` must exactly match a delta document in the Cosmos `criteria-definitions` container. `CriteriaCompilerService` throws `"Program delta not found: {clientId}/{subClientId}/{programId}/{programVersion}"` if no match — the pipeline does not fall back. A real production client must have their own deltas seeded under their own identifiers before criteria evaluation will work.

---

### API Validation Errors

| HTTP | Condition |
|---|---|
| `400` | `input.clientId` is missing or empty |
| `400` | `input.subClientId` is missing or empty (sending `tenantId` instead produces this error) |
| `400` | Request body is not valid JSON |
| `404` | `pipelineId` does not match a registered pipeline |
| `202` | Accepted — response body: `{ "jobId": "<uuid>" }` |

---

### Retrieving Results

After receiving a terminal webhook or observing a terminal stream event:

```
GET /api/pipelines/:jobId/results
GET /api/pipelines/:jobId/observe   (SSE stream of all lifecycle events)
GET /api/pipelines/:jobId/stream    (SSE stream, alias)
```

All three endpoints echo `correlationId` and `correlationType` unchanged.

