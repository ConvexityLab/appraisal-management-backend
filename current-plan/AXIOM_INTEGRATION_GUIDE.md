# Axiom AI Platform — Integration Guide

**Platform:** Appraisal Management Backend + L1 Valuation Platform UI  
**Axiom dev server:** `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`

---

## 1. What Axiom Does

Axiom is our centralized AI intelligence platform. It runs **Loom pipelines** — a DAG of named stages — against appraisal documents and loan data to produce structured criterion evaluations, risk scores, and extracted property data.

| Phase | Feature |
|---|---|
| 1.2 | Property data enrichment + complexity scoring |
| 4.1 | Real-time USPAP compliance scanning during report creation |
| 5.2 | QC checklist auto-population (70%+ automation target) |
| 5A | Revision comparison / change detection |
| 6 | ROV comp analysis and value impact assessment |

---

## 2. Architecture Overview

```
┌─────────────┐   POST /api/axiom/orders/:id/evaluate
│  Frontend   │──────────────────────────────────────►┐
│  (RTK Query)│                                        │
│             │◄── RTK Query invalidates cache ────────┤
└─────────────┘   on WebPubSub push event              │
       ▲                                               ▼
       │                               ┌──────────────────────────┐
       │  WebPubSub push               │   Backend API Server     │
       │  (axiom.evaluation.*)         │                          │
       │                               │  AxiomController         │
       │            Service Bus        │    └─ AxiomService        │
       │       (axiom.evaluation.*)    │         └─ axios client   │
       └───────────────────────────────┤                          │
                                       └──────────┬───────────────┘
                                                  │  POST /api/pipelines
                                                  │  (inline Loom definition
                                                  │   or registered pipelineId)
                                                  ▼
                                       ┌──────────────────────┐
                                       │  Axiom AI Platform   │
                                       │                      │
                                       │  Stage 1: Document   │
                                       │    Processor         │
                                       │  Stage 2: Criterion  │
                                       │    Evaluator         │
                                       └──────────┬───────────┘
                                                  │  POST /api/axiom/webhook
                                                  │  (+ SSE stream while running)
                                                  ▼
                                       ┌──────────────────────┐
                                       │  Backend webhook     │
                                       │  handler + Cosmos    │
                                       └──────────────────────┘
```

---

## 3. Environment Configuration

All config is in `.env` / Container App environment variables. Never hardcode keys.

| Variable | Required | Description |
|---|---|---|
| `AXIOM_API_BASE_URL` | **Yes** | Base URL of the Axiom server. Set to the dev server for staging. |
| `AXIOM_API_KEY` | Yes in prod | Bearer token — obtain from Axiom team. Omit for the dev server (no auth). |
| `AXIOM_WEBHOOK_SECRET` | **Yes** | Shared secret for HMAC signature verification on incoming webhooks. |
| `API_BASE_URL` | **Yes** | Our own public API URL. Axiom POSTs results here: `${API_BASE_URL}/api/axiom/webhook`. |
| `AXIOM_PIPELINE_ID_RISK_EVAL` | No | UUID of a registered Loom pipeline template. If absent, the inline definition is used. |
| `AXIOM_PIPELINE_ID_DOC_EXTRACT` | No | UUID for document-only extraction. |
| `AXIOM_PIPELINE_ID_BULK_EVAL` | No | UUID for bulk tape evaluation. |
| `AXIOM_MOCK_DELAY_MS` | No | Delay for mock mode (default `8000`). Ignored when `AXIOM_API_BASE_URL` is set. |

**Mock mode** is active whenever `AXIOM_API_BASE_URL` is not set. All calls return synthetic results after `AXIOM_MOCK_DELAY_MS`.

---

## 4. Pipeline Definitions (Loom)

Three pipeline types are defined inline in `AxiomService`. They are sent with every `POST /api/pipelines` unless a registered `AXIOM_PIPELINE_ID_*` env var overrides them.

### 4.1 `RISK_EVAL` — single-order evaluation
```
Stage 1: DocumentProcessor
  input: documents (SAS URLs), tenantId, clientId
  timeout: 120s

Stage 2: CriterionEvaluator
  input: fields (order data), programId, processed docs
  timeout: 180s
```

### 4.2 `DOC_EXTRACT` — document-only extraction
```
Stage 1: DocumentProcessor
  input: documents, tenantId, clientId
  timeout: 120s
```

### 4.3 `BULK_EVAL` — tape / bulk loan evaluation
```
Stage 1: CriteriaLoader
  input: programId, tenantId, clientId

Stage 2: CriterionEvaluator (parallel per loan)
  input: criteria (from stage 1), loans[]

Stage 3: ResultsAggregator
  input: stage 2 results
```

When the Axiom team provisions registered templates in their Cosmos container, set the `AXIOM_PIPELINE_ID_*` env vars and inline definitions are no longer sent.

---

## 5. How a Pipeline Is Triggered

### 5.1 Automatic trigger (primary path)

`AxiomAutoTriggerService` subscribes to a Service Bus topic and fires when a document is uploaded to an order. It is idempotent: if `order.axiomStatus` is already `submitted` or `completed` it skips.

File: `src/services/axiom-auto-trigger.service.ts`  
Service Bus subscription name: `axiom-auto-trigger-service`

### 5.2 Manual trigger (API)

```
POST /api/axiom/orders/:orderId/evaluate
Authorization: Bearer <user JWT>
```

Controller reads the order from Cosmos, builds structured `fields[]` from the order data (address, loan amount, GLA, etc.), and calls `AxiomService.submitOrderEvaluation()`.

### 5.3 Document notification path

```
POST /api/axiom/documents/notify
```

Used when a specific document SAS URL needs to be submitted alongside the order fields. Controller looks up the order, adds the blob URL, submits to Axiom.

---

## 6. The Submit Call

`AxiomService.submitOrderEvaluation()` → `POST {AXIOM_API_BASE_URL}/api/pipelines`

**Request body:**
```json
{
  "pipeline": { ... },          // inline Loom definition (or "pipelineId": "<uuid>")
  "input": {
    "tenantId": "...",
    "clientId": "...",
    "correlationId": "<orderId>",
    "correlationType": "ORDER",
    "webhookUrl": "https://your-api/api/axiom/webhook",
    "webhookSecret": "...",
    "fields": [
      { "fieldName": "loanAmount", "fieldType": "number", "value": 450000 },
      { "fieldName": "propertyAddress", "fieldType": "string", "value": "123 Main St" }
    ],
    "documents": [
      { "documentName": "Appraisal Report.pdf", "documentReference": "<SAS URL>" }
    ],
    "schemaMode": "RISK_EVALUATION",
    "programId": "..."           // optional — scopes which criteria are evaluated
  }
}
```

**Response:**
```json
{ "jobId": "<pipelineJobId>" }
```

The service generates `evaluationId = "eval-<orderId>-<pipelineJobId>"`, writes a `pending` record to the Cosmos `analytics` container, and immediately opens the SSE stream.

---

## 7. Monitoring Pipeline Progress in the UI

Pipeline runs are monitored through **two parallel channels**:

### 7.1 SSE stream (server-side, best-effort)

Immediately after `submitOrderEvaluation()` returns, the backend opens a Server-Sent Events connection:

```
GET {AXIOM_API_BASE_URL}/api/pipelines/{pipelineJobId}/stream
```

The backend (`watchPipelineStream()`) receives events from Axiom and re-broadcasts them to the frontend via **Azure Web PubSub** in the `axiom.evaluation.progress` and `axiom.evaluation.completed` channels.

### 7.2 Webhook (primary completion signal)

When Axiom finishes it POSTs to:
```
POST /api/axiom/webhook
X-Axiom-Signature: <HMAC-SHA256 of body using AXIOM_WEBHOOK_SECRET>
```

The `verifyAxiomWebhook` middleware validates the signature. On success:
1. Calls `GET {AXIOM_API_BASE_URL}/api/pipelines/{jobId}/results` to fetch full structured results
2. Maps results into `AxiomEvaluationResult` shape (criteria, risk scores, document references)
3. Upserts the record in Cosmos `analytics` container (status → `completed`)
4. Publishes `axiom.evaluation.completed` on Service Bus
5. Broadcasts the same event via Web PubSub to the frontend

### 7.3 Frontend UI — RTK Query + Web PubSub

The frontend RTK Query slice (`axiomApi.ts`) provides:

```ts
// Poll for current evaluation state
useGetAxiomEvaluationQuery(orderId)

// Poll for evaluation by evaluationId
useGetAxiomEvaluationByIdQuery(evaluationId)

// Trigger a new evaluation
useEvaluateOrderMutation()
```

**Real-time update flow:**

1. User triggers evaluation → `evaluateOrder` mutation → backend returns `{ evaluationId, pipelineJobId }`
2. UI shows a progress indicator with `status: "pending"`
3. Web PubSub pushes `axiom.evaluation.progress` events → UI updates stage names / percentages
4. Web PubSub pushes `axiom.evaluation.completed` → RTK Query's `axiom.evaluation.completed` listener invalidates the `AxiomEvaluation` tag for that `orderId`
5. RTK Query auto-refetches → QC panel renders criteria results, risk score, document citations

**Web PubSub events the frontend listens for:**

| Event name | Payload | What triggers it |
|---|---|---|
| `axiom.evaluation.progress` | `{ orderId, pipelineJobId, stage, percentComplete }` | SSE stream forwarded by backend |
| `axiom.evaluation.completed` | `{ orderId, evaluationId, status }` | Webhook received + results stored |
| `axiom.evaluation.timeout` | `{ orderId, submittedAt }` | `AxiomTimeoutWatcherJob` fires (15 min) |
| `axiom.batch.updated` | `{ jobId, completedLoans, totalLoans }` | Bulk job progress events |

### 7.4 Timeout fallback

`src/jobs/axiom-timeout-watcher.job.ts` runs on a schedule and scans for `analytics` records still in `pending` status older than 15 minutes. It flags them as `timeout`, publishes `axiom.evaluation.timeout` on Service Bus, and `CommunicationEventHandlerService` sends an escalation email.

---

## 8. Fetching Results

### From the backend
```
GET /api/axiom/orders/:orderId/evaluation
```
Returns the stored `AxiomEvaluationResult` from Cosmos. If `status` is `pending`, the client should wait for the Web PubSub push.

### Direct pipeline fetch (admin / debug)
`GET {AXIOM_API_BASE_URL}/api/pipelines/{pipelineJobId}/results`

The backend calls this internally after the webhook fires. Not exposed directly to the frontend.

### Result shape (abridged)
```ts
interface AxiomEvaluationResult {
  orderId: string;
  evaluationId: string;
  pipelineJobId: string;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  overallRiskScore: number;          // 0.0–1.0
  criteria: CriterionEvaluation[];
}

interface CriterionEvaluation {
  criterionId: string;
  criterionName: string;
  evaluation: 'pass' | 'fail' | 'warning' | 'info';
  confidence: number;                // 0.0–1.0
  reasoning: string;
  remediation?: string;
  supportingData?: SupportingDataItem[];
  documentReferences: DocumentReference[];  // page, section, verbatim quote, blobUrl
}
```

### QC Bridge

`src/utils/axiomQcBridge.ts` maps `CriterionEvaluation[]` → the QC checklist item shape the UI renders. This is the join point between Axiom results and the QC review panel.

---

## 9. Security

| Concern | Implementation |
|---|---|
| API key never reaches browser | All Axiom calls made server-side; API key in Container App env var only |
| Webhook authenticity | `verifyAxiomWebhook` middleware validates HMAC-SHA256 signature against `AXIOM_WEBHOOK_SECRET` |
| Document access | SAS URLs are generated per-request with short TTLs; never stored permanently in Axiom payloads |
| No keys in Bicep | `AXIOM_API_KEY` and `AXIOM_WEBHOOK_SECRET` are GitHub environment secrets, injected as Container App env vars at deploy time |

---

## 10. Adding a New Pipeline Type

1. Define a new `LoomPipelineDefinition` static constant in `AxiomService`
2. Add its key to `buildPipelineParam()`
3. Add an optional `AXIOM_PIPELINE_ID_<TYPE>` env var override
4. Add a corresponding `AXIOM_PIPELINE_ID_<TYPE>` entry to `.env` and GitHub secrets
5. Create a new `submit*()` method following the pattern of `submitOrderEvaluation()`

---

## 11. Local Development

- `AXIOM_API_BASE_URL` is set to the dev server in `.env` — live calls work without auth
- `AXIOM_API_KEY` is intentionally blank — the dev server is open
- Webhooks cannot reach `localhost` — Axiom will time out on the webhook leg. The result can still be fetched manually via `GET /api/axiom/orders/:orderId/evaluation` once Axiom processes it, or polled using `AxiomService.fetchPipelineResults(pipelineJobId)`
- Set `AXIOM_MOCK_DELAY_MS=0` and clear `AXIOM_API_BASE_URL` to use mock mode for fully offline development

---

## Appendix — Fluid Relay Key Management

Fluid Relay requires a **tenant signing key** to mint user JWTs. This key is a secret and must never be in code or container images.

**Production (staging + prod):**  
`CollaborationService` uses `DefaultAzureCredential` → `SecretClient` → Key Vault secret name `fluid-relay-key`.  
The Bicep deployment writes the key from `listKeys()` into Key Vault during infra deploy. The Container App's managed identity has Key Vault Secrets User RBAC on that secret.

```
Container App (Managed Identity)
  → Key Vault RBAC: Secrets User on "fluid-relay-key"
  → SecretClient.getSecret("fluid-relay-key")   [cached 5 min]
  → generateToken(tenantId, tenantKey, scopes, containerId, user)
  → returns signed JWT to browser via GET /api/collaboration/fluid-token
```

**Local development bypass:**  
Set `AZURE_FLUID_RELAY_KEY=<primary key from Azure portal>` in `.env`.  
`CollaborationService.getTenantKey()` checks this env var first and skips Key Vault entirely. This avoids needing Key Vault RBAC locally.

**Never set `AZURE_FLUID_RELAY_KEY` in staging or production** — the Managed Identity + Key Vault path is always preferred and that env var is absent from those environments.
