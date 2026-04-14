# Axiom Integration Handoff — Action Required from Axiom Team (2026-04-01)

## Goal
Enable real (non-mock) end-to-end processing from `appraisal-management-backend` to Axiom so we can submit engagements/orders and related appraisal documents today and receive authoritative completion callbacks.

## What You Need To Do On Your Side

1. Confirm pipeline submission contract for `POST /api/pipelines`
   - Accept and honor these `input` fields exactly:
     - `tenantId`
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
    "tenantId": "<tenant>",
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
   - **Yes, with compatibility mapping now implemented.**
   - We accept `input.tenantId` as alias for `subClientId`.
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

- Compatibility mapper in pipeline submit path for `tenantId`, `correlationId`, `correlationType`, `webhookUrl`, `webhookSecret`.
- Automatic durable webhook generation from compatibility fields.
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

**Latest run result:**
- Test executed by Axiom team and **failed fast** because environment was still using non-Axiom storage account (`certostoragedev`).
- This is intentional guard behavior to prevent accidental live-fire against wrong storage.

### Required Environment Action Before Live Fire

- Set storage account to the Axiom storage account in runtime env:
  - `AZURE_STORAGE_ACCOUNT_NAME=<axiom-storage-account>`
  - or `AXIOM_STORAGE_ACCOUNT_NAME=<axiom-storage-account>`
- Re-run:
  - `pnpm test:integration:webhook-correlation`

### Go/No-Go

- **Code readiness:** **GO** (contract support implemented).
- **Environment readiness:** **NO-GO until storage account is corrected to Axiom account**.

