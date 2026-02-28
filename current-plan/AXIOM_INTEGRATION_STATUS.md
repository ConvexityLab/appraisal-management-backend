# Axiom Integration Status
**Date:** 2026-02-27  
**Purpose:** Single source of truth — where we are, what is wired, what is broken, what is left before we say "production-connected to Axiom, results flowing end-to-end."

---

## 1. What Axiom Is and Why We Use It

Axiom is a general-purpose **Loom pipeline executor with an AI evaluation layer**. It has no native concept of appraisal orders, risk tapes, or lending programs. We use it for three things:

| What | Why | How |
|---|---|---|
| **Appraisal document evaluation** | AI reads a PDF, evaluates each USPAP/FNMA criterion (comps, adjustments, USPAP compliance, etc.), returns pass/fail with a cited page + verbatim quote from the document. Target: 70%+ QC checklist auto-fill. | `POST /api/pipelines`, `schemaMode: "RISK_EVALUATION"`, document blob URL in `documents[]` |
| **Bulk tape risk evaluation** | 10–1,000 loans evaluated in parallel against a lending program. Each loan gets `riskScore` + `decision` (ACCEPT / CONDITIONAL / REJECT) + flags. Replaces manual per-loan review. | `POST /api/pipelines`, `correlationType: "BULK_JOB"`, `loans[]` array |
| **PDF field extraction** | Send a raw appraisal PDF → get back all 73 risk tape fields as structured JSON. Populates tape rows from unstructured documents. | `POST /api/pipelines`, `schemaMode: "DOCUMENT_EXTRACTION"` |

All three use the **same single Axiom endpoint**: `POST /api/pipelines`. Our domain context (correlation IDs, loan data, document references, webhook URL) goes inside the `input` object. Axiom stays generic; no domain-specific routes exist or will ever be requested.

---

## 2. Connection Architecture

```
Frontend (browser)
    │
    │  WebSocket (Azure Web PubSub)
    │  useNotificationSocket → RTK cache invalidation
    ▼
Backend (appraisal-management-backend)
    │                          │
    │  HTTP POST               │  SSE (eventsource npm)
    │  POST /api/pipelines     │  GET /api/pipelines/:jobId/stream
    │  Bearer <AXIOM_API_KEY>  │  Redis XREAD, resumable via ?from=<cursor>
    ▼                          ▼
Axiom (axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io)
    │
    │  HMAC-signed webhook
    │  POST /api/axiom/webhook          (single order)
    │  POST /api/axiom/webhook/bulk     (tape batch)
    │  POST /api/axiom/webhook/extraction (document extraction)
    ▼
Backend (receives, verifies, stamps Cosmos, broadcasts via WebPubSub)
```

**Three channels work together:**

1. **HTTP POST → Axiom** — we submit a job, receive a `pipelineJobId` in the 202
2. **SSE ← Axiom** — our backend opens `GET /api/pipelines/:pipelineJobId/stream` server-to-server immediately after submission. Axiom pushes `task.completed` per loan (scatter mode), then `pipeline.completed` / `pipeline.failed` as terminal events. Resume cursor tracked via `lastEventId` + `?from=<cursor>` on reconnect. 30-minute hard timeout.
3. **Webhook ← Axiom → our backend** — authoritative completion signal. HMAC-SHA256 signed (`X-Axiom-Signature` header). Our backend acknowledges `200` immediately, processes async. Stamps Cosmos, broadcasts via WebPubSub.

---

## 3. What Is Fully Built

### 3.1 Backend — `axiom.service.ts`

| Method | What it does | Status |
|---|---|---|
| `submitOrderEvaluation(orderId, fields[], documents[])` | `POST /api/pipelines` with `correlationType:"ORDER"`; stores pending record; opens SSE stream | ✅ Done |
| `submitBatchEvaluation(jobId, loans[], programId?)` | `POST /api/pipelines` with `correlationType:"BULK_JOB"`; opens SSE stream | ✅ Done |
| `submitDocumentExtractionPipeline(jobId, loanNumber, documents[])` | `POST /api/pipelines` with `schemaMode:"DOCUMENT_EXTRACTION"` | ✅ Done |
| `submitForExtraction(request)` | Legacy path via `POST /documents/extract` — still in service for DOCUMENT_EXTRACTION bulk jobs | ✅ Done |
| `watchPipelineStream(pipelineJobId, correlationId, correlationType)` | Opens SSE connection via `eventsource` npm; relays `task.completed` progress via WebPubSub; on terminal event fetches `/results`, stores in Cosmos, broadcasts | ✅ Done |
| `getEvaluation(orderId)` | Cache-first read from Cosmos `aiInsights`; falls back to Axiom if enabled | ✅ Done |
| `getEvaluationById(evaluationId)` | Direct lookup by evaluationId; enriches `documentReferences` with stored `_metadata` | ✅ Done |
| `getEvaluationsForOrder(orderId)` | Returns all evaluations for an order, enriched | ✅ Done |
| `compareDocuments(orderId, originalUrl, revisedUrl)` | Document diff via `POST /documents/compare` | ✅ Done |
| `getCompiledCriteria(clientId, tenantId, programId, version)` | `GET /api/programs/:programId/:version/compiled` — cache-first with TTL | ✅ Done |
| `compileCriteria(clientId, tenantId, programId, version)` | `POST /api/programs/:programId/:version/compile` — always fresh, warms cache | ✅ Done |
| `broadcastAxiomStatus(...)` | Pushes `axiom.evaluation.updated` to frontend via WebPubSub | ✅ Done |
| `broadcastBatchJobUpdate(...)` | Pushes `axiom.batch.updated` to frontend via WebPubSub | ✅ Done |
| **Mock mode** | Full lifecycle simulation (pending → processing → completed) with realistic 11-criterion result, 73-field tape extraction, and compiled criteria mock — fires when `AXIOM_API_BASE_URL` / `AXIOM_API_KEY` absent | ✅ Done |

### 3.2 Backend — `axiom.controller.ts`

| Route | Handler | Status |
|---|---|---|
| `GET /api/axiom/status` | Reports `enabled: true/false` | ✅ Done |
| `POST /api/axiom/documents` | Raw document notification (backend-to-backend) | ✅ Done |
| `POST /api/axiom/analyze` | Frontend-friendly: looks up blob URL by `documentId`, calls `submitOrderEvaluation` | ✅ Done |
| `GET /api/axiom/evaluations/order/:orderId` | Returns all evaluations for an order | ✅ Done |
| `GET /api/axiom/evaluations/:evaluationId` | Returns single evaluation by ID | ✅ Done |
| `POST /api/axiom/webhook` | Single-order completion — HMAC verified, stamps order in Cosmos (`axiomStatus`, `axiomRiskScore`, `axiomDecision`, `axiomFlags`, `axiomCompletedAt`), broadcasts | ✅ Done |
| `POST /api/axiom/webhook/bulk` | Batch completion — HMAC verified, calls `stampBatchEvaluationResults`, broadcasts | ✅ Done |
| `POST /api/axiom/webhook/extraction` | Document extraction completion — calls `processExtractionCompletion` | ✅ Done |
| `POST /api/axiom/documents/compare` | Document comparison | ✅ Done |

### 3.3 Backend — Types

| Location | Field | Status |
|---|---|---|
| `src/types/order-management.ts` — `AppraisalOrder` | `axiomEvaluationId?`, `axiomBatchId?`, `axiomRiskScore?`, `axiomDecision?`, `axiomStatus?`, `axiomCompletedAt?`, `axiomFlags?`, `axiomPipelineJobId?` | ✅ Done |
| `src/types/review-tape.types.ts` — `ReviewTapeResult` | `axiomEvaluationId?`, `axiomRiskScore?`, `axiomDecision?`, `axiomStatus?`, `orderId?`, `orderNumber?` | ✅ Done |
| `src/types/axiom.types.ts` | `CompileResponse`, `CompiledProgramNode`, `CompileMetadata`, `CompiledEvaluation` | ✅ Done |
| `src/services/axiom.service.ts` — internal types | `AxiomDocumentNotification`, `CriterionEvaluation`, `AxiomEvaluationResult`, `DocumentReference`, `ExtractionRecord` | ✅ Done |

### 3.4 Backend — Criteria & QC Bridge

| Item | Status |
|---|---|
| `GET /api/criteria/clients/:c/tenants/:t/programs/:p/:v/compiled` — cache-first endpoint | ✅ Done |
| `POST /api/criteria/clients/:c/tenants/:t/programs/:p/:v/compile` — force recompile | ✅ Done |
| `axiomCriterionIds` on QC checklist items — maps each checklist item to its Axiom concept code (e.g. `THREE_CLOSED_COMPS_USED`) | ✅ Done |
| `scripts/seed-qc-checklists-2026.js` — seeds all 11 criterion codes to Cosmos | ✅ Done |

### 3.5 Frontend — RTK Query (`axiomApi.ts`)

| Hook | Route | Status |
|---|---|---|
| `useAnalyzeDocumentMutation` | `POST /api/axiom/analyze` | ✅ Done |
| `useGetAxiomEvaluationQuery(evaluationId)` | `GET /api/axiom/evaluations/:id` | ✅ Done |
| `useGetOrderEvaluationsQuery(orderId)` | `GET /api/axiom/evaluations/order/:orderId` | ✅ Done |
| `useCompareDocumentsMutation` | `POST /api/axiom/compare` | ✅ Done |
| `useGetAxiomComparisonQuery` | `GET /api/axiom/comparisons/:id` | ✅ Done |
| `normalizeEvaluationResponse()` | Transforms flat backend shape → nested frontend shape; sets both `evaluation` and `status` (deprecated alias); both `quote` and `text` (deprecated alias); resolves `documentId`/`blobUrl` from `_metadata` | ✅ Done |
| Polling fallback in `getAxiomEvaluation` | Re-invalidates tag every 2 s when `status === 'processing'` | ✅ Done |

### 3.6 Frontend — WebSocket Dispatch (`useNotificationSocket.ts`)

| Event | Action | Status |
|---|---|---|
| `axiom.evaluation.updated` | Invalidates `AxiomEvaluation` (list + by evaluationId) + `Orders` (by orderId) | ✅ Done |
| `axiom.batch.updated` | Invalidates `BulkPortfolioJob` (list + by jobId) | ✅ Done |
| `axiom.progress` | Invalidates `BulkPortfolioJob` (by jobId only — avoids full-list hammer on progress ticks) | ✅ Done |
| Typed event interfaces exported | `AxiomEvaluationEvent`, `AxiomBatchEvent`, `AxiomProgressEvent`, `AxiomSocketEvent` | ✅ Done |
| `WebSocketMessage.data.metadata` typed | Discriminated union — `AxiomSocketEvent \| Record<string, unknown>` | ✅ Done |

### 3.7 Backend — HMAC Webhook Security

| Item | Status |
|---|---|
| `verifyAxiomWebhook` Express middleware — validates `X-Axiom-Signature: hmac-sha256=<hex>` | ✅ Done |
| Applied to `POST /api/axiom/webhook`, `/webhook/bulk`, `/webhook/extraction` | ✅ Done |
| Reads secret from `AXIOM_WEBHOOK_SECRET` env var — no hardcoding | ✅ Done |

---

## 4. What Is Broken / Wrong Right Now

### 4.1 🔴 `order.controller.ts` — wrong Axiom method called on SUBMIT

**File:** `src/controllers/order.controller.ts` line ~395  
**What it does:** When an order's status changes to `SUBMITTED`, it loops over `appraisal-report` documents and calls `this.axiomService.notifyDocumentUpload()` for each one.  
**Why it's wrong:** `notifyDocumentUpload()` is the old pre-pipeline stub. It hits `POST /documents` (not the pipeline), does not set `pipelineJobId` on the order, does not open an SSE stream, and does not stamp the correct Axiom fields back on the order.  
**What it should do:** Match the pattern in `document.controller.ts` — call `this.axiomService.submitOrderEvaluation(orderId, fields, documents)`, then stamp `axiomEvaluationId`, `axiomPipelineJobId`, `axiomStatus: 'submitted'` on the order.  
**Impact:** Every order submitted via the UI's status-change flow goes to the wrong Axiom path. In mock mode it still produces an evaluation (the old mock lifecycle runs), but in production it would call a non-pipeline endpoint.

### 4.2 ⚠️ `axiom.controller.ts` `notifyDocument` handler still delegates to `notifyDocumentUpload()`

**File:** `src/controllers/axiom.controller.ts` line ~142  
**What it does:** `POST /api/axiom/documents` calls `this.axiomService.notifyDocumentUpload(notification)`.  
**Why it's a smell:** This is a backend-to-backend route and `notifyDocumentUpload` is the old stub. Should be converted to `submitOrderEvaluation`. However, this route is not called from the frontend (`/analyze` is) so it is lower urgency than 4.1. Mark for cleanup.

---

## 5. What Is Left Before Production

These are ordered by dependency. Nothing in Group B can ship until Group A is done.

### Group A — Fix broken wiring (do this week)

| ID | What | File | Effort |
|---|---|---|---|
| **A-1** | Replace `notifyDocumentUpload()` in `order.controller.ts` with `submitOrderEvaluation()` pattern (same as `document.controller.ts`). Stamp `axiomEvaluationId`, `axiomPipelineJobId`, `axiomStatus` back on order on success. | `src/controllers/order.controller.ts` line ~395 | 1 hour |
| **A-2** | Convert `POST /api/axiom/documents` handler to use `submitOrderEvaluation()` instead of `notifyDocumentUpload()`. | `src/controllers/axiom.controller.ts` line ~142 | 30 min |

### Group B — Missing auto-submit wiring (blocking full automation)

| ID | What | File | Effort |
|---|---|---|---|
| **B-1** | Add `_orderToLoanData(item: BulkPortfolioItem)` helper that maps item fields → `Array<{fieldName, fieldType, value}>` for the pipeline input. | `src/services/bulk-portfolio.service.ts` | 1 hour |
| **B-2** | After `createOrder()` succeeds in the ORDER_CREATION path, fire `setImmediate(() => this.axiomService.submitOrderEvaluation(...))`. Never blocks order creation. Warn-log on failure. | `src/services/bulk-portfolio.service.ts` | 30 min |
| **B-3** | Investigate: identify the document upload controller/service path for single (flow) orders. Confirm blob URL is available at upload time. Then add `submitOrderEvaluation()` call on appraisal-report upload. | TBD after investigation | 1–2 hours |

### Group C — Tape batch (blocked on Axiom team)

| ID | What | File | Effort |
|---|---|---|---|
| **C-1** | Add `_tapeResultToLoanData(result: ReviewTapeResult)` helper. | `src/services/bulk-portfolio.service.ts` | 1 hour |
| **C-2** | After `_submitTapeEvaluation()` saves the job, fire `setImmediate(() => this.axiomService.submitBatchEvaluation(...))`. | `src/services/bulk-portfolio.service.ts` | 30 min |
| **C-3** | Add "AI Risk" column to `ReviewTapeResultsGrid.tsx` — shows `axiomRiskScore` + `axiomDecision` when present, spinner when `axiomStatus === 'processing'`, auto-refreshes via WebSocket. | `src/app/(control-panel)/bulk-portfolios/ReviewTapeResultsGrid.tsx` | 2 hours |

> ⏸️ **C-1 through C-3 are blocked until Axiom confirms `POST /api/pipelines` supports the `loans[]` scatter pattern.** See Section 7.

### Group D — Frontend display (results not visible in UI yet)

| ID | What | File | Effort |
|---|---|---|---|
| **D-1** | Wire `useGetOrderEvaluationsQuery(orderId)` in the order detail page. Render an Axiom panel: status badge, risk score (0–100), decision badge (ACCEPT/CONDITIONAL/REJECT), top flags, "Re-run Analysis" button. | Order detail page component | 3–4 hours |
| **D-2** | Fix confidence display in `AxiomInsightsPanel` — `${criterion.confidence}%` should be `${Math.round(criterion.confidence * 100)}%` (backend returns 0–1 float, not a percentage). | `AxiomInsightsPanel` component | 15 min |
| **D-3** | Verify frontend `AxiomDocumentReference.text` field is mapped from backend `DocumentReference.quote`. The `normalizeEvaluationResponse()` in `axiomApi.ts` already sets both `quote` and `text` (deprecated alias) — confirm the panel renders `quote` not just `text`. | `axiomApi.ts` + panel component | 30 min |

---

## 6. Environment Variables Required for Production

### Backend (`appraisal-management-backend`)

| Variable | Purpose | Required for |
|---|---|---|
| `AXIOM_API_BASE_URL` | `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io` | All live Axiom calls |
| `AXIOM_API_KEY` | Bearer token for all Axiom requests | All live Axiom calls |
| `AXIOM_WEBHOOK_SECRET` | HMAC key — used to sign outbound webhook `webhookSecret` field AND to verify inbound `X-Axiom-Signature` header | All webhooks |
| `API_BASE_URL` | Our backend public URL — passed to Axiom as `webhookUrl` base | All live submissions |
| `AXIOM_MOCK_DELAY_MS` | Simulated evaluation latency in mock mode (default: 8000 ms) | Dev / testing |
| `AXIOM_COMPILE_CACHE_TTL_MS` | Compiled criteria in-memory TTL (default: 3,600,000 = 1 hr) | Criteria endpoints |
| `AZURE_WEB_PUBSUB_ENDPOINT` | WebPubSub endpoint — if absent, emulator mode kicks in | Real-time frontend push |

When `AXIOM_API_BASE_URL` or `AXIOM_API_KEY` is absent, the service enters **mock mode automatically** — no crash, full mock lifecycle runs. This is intentional and safe.

---

## 7. Axiom Team Dependencies

These are items **we cannot unblock ourselves** — they require action from the Axiom team:

| ID | Ask | Why we need it | Status |
|---|---|---|---|
| **AX-01** | Confirm `POST /api/pipelines` supports a `webhookUrl` + `webhookSecret` inside `input` and the pipeline worker reads them and POSTs to our URL on completion | Without webhook delivery, our production path has no authoritative completion signal — we'd be poll-only | ❓ Unconfirmed |
| **AX-02** | Confirm `correlationId` is echoed in: (a) the 202 response, (b) every SSE `StructuredEvent` `correlation` field, (c) the webhook payload | Without it, we cannot route Axiom results back to our records without a lookup table | ❓ Unconfirmed |
| **AX-03** | Confirm the bulk `loans[]` scatter pattern — each loan as a separate Loom scatter task so `task.completed` fires per-loan on the SSE stream with `{ loanNumber, riskScore, decision }` in `data` | Required for per-loan progress in real time; required for Group C work | ❓ Unconfirmed |
| **AX-04** | Confirm HMAC-SHA256 signature mechanism — `X-Axiom-Signature: hmac-sha256=<hex>` over raw body using the `webhookSecret` we pass | Required for webhook security; our middleware already expects this header | ❓ Unconfirmed |
| **AX-05** | Confirm `programId` resolution — we pass `programId` in `input`; does Axiom resolve evaluation criteria from it, or must we pre-register programs via `POST /api/criteria/...` first? | Affects whether we need to call `compileCriteria()` before every submission | ❓ Unconfirmed |
| **AX-06** | Confirm `pipelineJobId` is returned in the 202 response | Required to open the SSE stream; currently assumed based on the general Loom API docs | ❓ Unconfirmed |
| **AX-07** | Staging environment URL | Required for end-to-end testing before production | ❓ Not provided |

---

## 8. The Path to "Production — Results Flowing End-to-End"

```
Week 1 (no blockers):
  A-1  Fix order.controller.ts → submitOrderEvaluation          [1 hour]
  A-2  Fix axiom.controller.ts notifyDocument handler           [30 min]
  D-1  Wire Axiom panel to order detail page                    [3-4 hours]
  D-2  Fix confidence display (×100)                            [15 min]
  D-3  Verify quote/text field rendering                        [30 min]
  B-1  _orderToLoanData() helper in bulk-portfolio.service      [1 hour]
  B-2  Auto-submit after ORDER_CREATION bulk                    [30 min]

Week 1 (needs investigation first):
  B-3  Flow order auto-submit on document upload                [1-2 hours]

After Axiom team confirms AX-01 through AX-06:
  End-to-end test: submit one real order → verify pipelineJobId returned
                 → verify SSE stream opens and events arrive
                 → verify webhook fires to our /api/axiom/webhook
                 → verify order stamped in Cosmos with axiomRiskScore etc.
                 → verify frontend panel shows result automatically

After end-to-end test passes:
  C-1  _tapeResultToLoanData() helper                           [1 hour]
  C-2  Auto-submit after TAPE_EVALUATION bulk                   [30 min]
  C-3  AI Risk column in ReviewTapeResultsGrid                  [2 hours]

Done. Production-connected.
```

---

## 9. What Works Right Now (Dev / Mock Mode)

Without any real Axiom credentials:

- Submit an order → `document.controller.ts` calls `submitOrderEvaluation()` → mock lifecycle starts → after `AXIOM_MOCK_DELAY_MS` (8 s default) evaluation is `completed` with 11 criteria, realistic risk score, document citations
- WebPubSub broadcast fires → `useNotificationSocket` receives `axiom.evaluation.updated` → RTK invalidates `AxiomEvaluation` + `Orders` tags → frontend components with `useGetOrderEvaluationsQuery` refresh
- Polling fallback also active: if WS is disconnected, `getAxiomEvaluation` re-fetches every 2 s until `status !== 'processing'`
- Bulk TAPE_EVALUATION job → `submitBatchEvaluation()` → mock lifecycle → `axiom.batch.updated` broadcast → bulk portfolio grid refreshes
- `GET /api/criteria/.../compiled` returns 11 mock criterion nodes with real concept codes from the FNMA 1033 program
- All webhook routes accept test payloads (HMAC verification passes when `AXIOM_WEBHOOK_SECRET` is set to the same value used to sign the test request)

The only path that is **wrong** in mock mode is the `order.controller.ts` status-change path (item A-1 above) — it runs the old `notifyDocumentUpload` mock instead of the pipeline mock. The result still appears in Cosmos but uses a different record shape and does not stamp `axiomPipelineJobId` on the order.
