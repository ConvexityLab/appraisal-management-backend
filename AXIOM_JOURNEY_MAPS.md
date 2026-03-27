Upload a BPO PDF to blob storage in the documents container# Axiom Integration — Complete Journey Maps

> **Generated:** March 25, 2026  
> **Source:** Verified against actual source code in `appraisal-management-backend/src` and `l1-valuation-platform-ui/src`  
> **Axiom API base:** `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`

---

## Overview — All Journeys at a Glance
Upload a BPO PDF to blob storage in the documents container
```mermaid
flowchart TD
    subgraph HUMAN["Human-Initiated Submissions"]
        J1["Journey 1\nDocument Upload\n+ Axiom toggle"]
        J6["Journey 6\nOrder Intake Wizard\nProperty Enrichment"]
        J4["Journey 4\nBulk Tape Evaluation\nXLSX → per-loan pipeline"]
        J5["Journey 5\nBulk Doc Extraction\nmanifest XLSX → PDF extraction"]
    end

    subgraph AUTOMATED["Automated Submissions"]
        J2["Journey 2\nOrder Status → SUBMITTED\nAxiomAutoTriggerService"]
        J9["Journey 9\nTimeout Watcher\n(cron every 5min)"]
    end

    subgraph OBSERVATION["Observing Processing"]
        SSE["SSE: GET /api/documents/stream/:executionId\n→ proxied to Axiom /api/pipelines/:id/observe\n(AxiomProgressPanel, EventSource)"]
        POLL_FAST["Poll 2s: useGetOrderEvaluationsQuery\n(QCReviewContent)"]
        POLL_MED["Poll 5s: useGetOrderEvaluationsQuery\n(AxiomAnalysisTab, BulkRowDetailTabs)"]
        POLL_SLOW["Poll 15s: useGetBulkJobAxiomStatusQuery\n(Bulk Tape TAPE_EVALUATION)"]
        POLL_EXTR["Poll 5s: useGetExtractionProgressQuery\n(ExtractionProgressPanel)"]
        INT_SSE["watchPipelineStream()\nInternal EventSource (server-side)\nauto-stores results on completed"]
    end

    subgraph RESULTS["Obtaining Results"]
        WEBHOOK_O["Webhook /api/axiom/webhook\ncorrelationType: ORDER\n→ fetchAndStorePipelineResults()"]
        WEBHOOK_T["Webhook /api/axiom/webhook\ncorrelationType: TAPE_LOAN\n→ stampBatchEvaluationResults()"]
        WEBHOOK_E["Webhook /api/axiom/webhook/extraction\n→ mapAxiomResultToTapeItem()"]
        COSMOS_AI["aiInsights Cosmos container\nAxiomEvaluationResponse stored"]
    end

    subgraph UTILIZATION["Utilizing Results"]
        J3["Journey 3: QC Review\napplyAxiomPrefill() stamps aiVerdict\nAxiomInsightsPanel per-criterion\nDecision stamps axiomCriteriaSnapshot"]
        J7["Journey 7: AI Analysis Tab\nLive SSE stage ticks\nAxiomInsightsPanel with PDF citations"]
        J8["Journey 8: QC Execution Engine\naxiomEvaluation injected into AI prompts\nmapScoreToSeverity for revision severity"]
        BULK_R["Bulk Results Grid\nReviewTapeResultsGrid\nRisk chips + AI Assist queries"]
    end

    J1 --> SSE
    J1 --> INT_SSE
    J2 --> INT_SSE
    J4 --> POLL_SLOW
    J5 --> POLL_EXTR
    J6 --> POLL_FAST

    INT_SSE --> COSMOS_AI
    WEBHOOK_O --> COSMOS_AI
    WEBHOOK_T --> COSMOS_AI
    WEBHOOK_E --> COSMOS_AI

    COSMOS_AI --> POLL_FAST
    COSMOS_AI --> POLL_MED
    SSE --> J7

    POLL_FAST --> J3
    POLL_MED --> J7
    POLL_SLOW --> BULK_R
    POLL_EXTR --> BULK_R

    J3 --> J8
    POLL_MED --> J8
```

---

## Observation Mechanisms — Quick Reference

| Mechanism | Component / Code | Interval | Journeys |
|---|---|---|---|
| **Live SSE (frontend)** | `AxiomProgressPanel` → `EventSource` → `GET /api/documents/stream/:id` → proxied to Axiom `/observe` | Real-time push | 1, 7 |
| **Internal SSE (server-side)** | `watchPipelineStream()` — `EventSource` from `eventsource` npm package | Event-driven, 30-min timeout | 1, 2, 4 |
| **Poll 2s** | `useGetOrderEvaluationsQuery` in `QCReviewContent` | 2 000 ms | 3 |
| **Poll 5s** | `useGetOrderEvaluationsQuery` in `AxiomAnalysisTab` + `BulkRowDetailTabs` | 5 000 ms | 4, 7 |
| **Poll 5s** | `useGetExtractionProgressQuery` in `ExtractionProgressPanel` | 5 000 ms | 5 |
| **Poll 15s** | `useGetBulkJobAxiomStatusQuery` in bulk portfolios page | 15 000 ms, stops on all-terminal | 4 |
| **Webhook (ORDER)** | `POST /api/axiom/webhook` → `fetchAndStorePipelineResults()` | Axiom-pushed | 1, 2 |
| **Webhook (TAPE_LOAN)** | `POST /api/axiom/webhook` → `stampBatchEvaluationResults()` | Axiom-pushed per loan | 4 |
| **Webhook (extraction)** | `POST /api/axiom/webhook/extraction` → `mapAxiomResultToTapeItem()` | Axiom-pushed per loan | 5 |

---

## Axiom Pipeline Modes

| Mode constant | Loom pipeline used | Stages |
|---|---|---|
| `FULL_PIPELINE` | `PIPELINE_RISK_EVAL` | `DocumentProcessor` → `CriterionEvaluator` |
| `EXTRACTION_ONLY` | `PIPELINE_DOC_EXTRACT` | `DocumentProcessor` |
| `CRITERIA_ONLY` | `PIPELINE_BULK_EVAL` | `CriteriaLoader` → `CriterionEvaluator` → `ResultsAggregator` |

Override any pipeline with env var `AXIOM_PIPELINE_ID_RISK_EVAL`, `AXIOM_PIPELINE_ID_DOC_EXTRACT`, or `AXIOM_PIPELINE_ID_BULK_EVAL` to use a registered Axiom template UUID instead of the inline Loom JSON.

---

## Webhook Correlation Types

| `correlationType` | `correlationId` format | Handler | Result storage |
|---|---|---|---|
| `ORDER` | `orderId` | `handleWebhook` in `axiom.controller.ts` → `fetchAndStorePipelineResults()` | `aiInsights` Cosmos container |
| `TAPE_LOAN` | `{jobId}::{loanNumber}` | `handleWebhook` → split on `::` → `stampBatchEvaluationResults()` | `BulkPortfolioJob.results[n]` in Cosmos |
| `BULK_JOB` | `jobId` | `handleBulkWebhook` | `BulkPortfolioJob` status |
| `EXECUTION` | `executionId` | `handleWebhook` → `AxiomExecutionService.updateExecutionStatus()` | `axiom-executions` Cosmos container |

All webhooks verified via HMAC-SHA256 on `x-axiom-signature` header using `AXIOM_WEBHOOK_SECRET`.

---

## Journey 1 — Document Upload with Axiom Analysis (Human-Initiated)

**Entry points:** Order detail → Documents tab → `DocumentUploadZone` or `EnhancedDocumentUpload`  
**Key components:** `DocumentUploadZone.tsx`, `EnhancedDocumentUpload.tsx`, `AxiomProgressPanel`, `AxiomInsightsPanel`  
**Backend entry:** `POST /api/axiom/analyze` → `axiomController.analyzeDocument()`  
**Axiom pipeline:** `PIPELINE_RISK_EVAL` with `correlationType: ORDER`

```mermaid
sequenceDiagram
    actor H as Human (Staff/Reviewer)
    participant UI as l1-valuation-platform-ui
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant RD as Redis Streams
    participant CS as Cosmos DB

    H->>UI: Navigate to Order → Documents tab
    H->>UI: Open upload dialog (DocumentUploadZone or EnhancedDocumentUpload)
    H->>UI: Toggle "Auto-Process via Axiom" switch ON
    H->>UI: Drop files + select category + click Upload

    UI->>BE: POST /api/documents (multipart, file blob)
    BE-->>UI: 200 { documentId }

    UI->>BE: POST /api/axiom/analyze { orderId, documentId, documentType }
    BE->>BE: axiomController.analyzeDocument()
    BE->>AX: POST /api/documents (blob path or presigned URL)
    AX-->>BE: 202 { fileSetId, queueJobId }
    BE->>AX: POST /api/pipelines { pipelineId: RISK_EVAL, input: { tenantId, clientId, fileSetId, correlationType: ORDER, correlationId: orderId } }
    AX-->>BE: 202 { jobId }
    BE-->>UI: 200 { evaluationId, pipelineJobId, status: queued }

    BE->>BE: watchPipelineStream(jobId) [fire-and-forget, internal SSE consumer]
    AX->>RD: Publishes stage events as pipeline runs

    Note over UI: AxiomProgressPanel mounts
    UI->>BE: GET /api/documents/stream/:executionId (EventSource / SSE)
    BE->>AX: GET /api/pipelines/:jobId/observe (pipe via proxyPipelineStream)
    AX-->>BE: SSE: event:snapshot, stage.completed, pipeline.completed
    BE-->>UI: SSE piped: stage events, completion

    alt Webhook path (parallel to SSE)
        AX->>BE: POST /api/axiom/webhook { correlationType: ORDER, correlationId: orderId, status: completed, result: {...} }
        BE->>BE: verifyAxiomWebhook (HMAC-SHA256)
        BE->>AX: GET /api/pipelines/:jobId/results
        AX-->>BE: Full extraction + criteria results
        BE->>CS: Upsert to aiInsights container
        BE->>BE: broadcastAxiomStatus via WebPubSub
    end

    alt Internal SSE watcher completes
        BE->>AX: GET /api/pipelines/:jobId/results
        AX-->>BE: Full results
        BE->>CS: Upsert to aiInsights container
        BE->>BE: broadcastAxiomStatus via WebPubSub
    end

    UI->>BE: GET /api/axiom/evaluations/order/:orderId (RTK Query, 2s poll)
    BE->>CS: Query aiInsights container
    CS-->>BE: AxiomEvaluationResponse
    BE-->>UI: Evaluation with criteria[]

    UI->>UI: Render AxiomInsightsPanel
    Note over UI: Per-criterion cards: verdict chip,<br/>reasoning, remediation guidance,<br/>DocumentCitations, SupportingDataTable
    H->>UI: Click citation → AxiomDocRefDialog opens PDF viewer
```

### Key notes
- `DocumentUploadZone` defaults `isAxiomEnabled = false`; `EnhancedDocumentUpload` defaults `isAxiomEnabled = true`
- Both the webhook path AND the internal `watchPipelineStream()` write to `aiInsights` — idempotent upsert, whichever arrives first wins
- SSE proxy: `GET /api/documents/stream/:executionId` → resolves `executionId` → `axiomJobId` via `AxiomExecutionRecord` → `proxyPipelineStream()` pipes raw Axiom stream

---

## Journey 2 — Automated Axiom Trigger on Order Submission

**Entry point:** Any user action that sets order status → `SUBMITTED` (e.g. "Submit for QC" button)  
**Key service:** `AxiomAutoTriggerService` — Service Bus consumer on `order.status.changed`  
**Guard:** Tenant config `axiomAutoTrigger === true` + order `axiomStatus` not already `submitted`/`processing`  
**Axiom pipeline:** `PIPELINE_RISK_EVAL` with `correlationType: ORDER`

```mermaid
sequenceDiagram
    actor H as Human (Staff)
    participant UI as l1-valuation-platform-ui
    participant BE as appraisal-mgmt-backend
    participant SB as Service Bus
    participant AX as Axiom API
    participant CS as Cosmos DB
    participant WP as WebPubSub

    H->>UI: Clicks "Submit for QC" on order
    UI->>BE: PATCH /api/orders/:orderId { status: SUBMITTED }
    BE->>CS: Update order.status = SUBMITTED
    BE->>SB: Publish order.status.changed { orderId, newStatus: SUBMITTED }
    BE-->>UI: 200

    Note over BE: AxiomAutoTriggerService (Service Bus consumer)
    BE->>BE: Receives order.status.changed
    BE->>CS: Load tenant config → check axiomAutoTrigger === true
    BE->>CS: Load order → check axiomStatus not in [submitted, processing]

    BE->>AX: POST /api/documents { tenantId, clientId, files (from order.documents[]) }
    AX-->>BE: 202 { fileSetId }

    BE->>AX: POST /api/pipelines { pipeline: PIPELINE_RISK_EVAL, input: { fileSetId, correlationType: ORDER, correlationId: orderId, webhookUrl: /api/axiom/webhook } }
    AX-->>BE: 202 { jobId }

    BE->>CS: Stamp order { axiomStatus: submitted, axiomPipelineJobId: jobId, axiomEvaluationId, axiomSubmittedAt }
    BE->>SB: Publish axiom.evaluation.submitted

    BE->>BE: watchPipelineStream(jobId, orderId, ORDER) [fire-and-forget]

    Note over AX: Pipeline runs: classify → extract → evaluate criteria

    alt Webhook arrives (Axiom pushes)
        AX->>BE: POST /api/axiom/webhook { correlationType: ORDER, correlationId: orderId, status: completed }
        BE->>BE: HMAC verify
        BE->>AX: GET /api/pipelines/:jobId/results
        AX-->>BE: criteria[], riskScore, extractedFields
        BE->>CS: Upsert aiInsights { orderId, evaluationId, criteria[], riskScore }
        BE->>CS: Stamp order { axiomStatus: completed, axiomEvaluationCompletedAt }
        BE->>WP: broadcastAxiomStatus(orderId, evaluationId, completed)
        BE->>SB: Publish axiom.evaluation.completed
    end

    alt Internal SSE watcher fires (parallel to webhook)
        BE->>AX: EventSource /api/pipelines/:jobId/observe
        Note over BE: Listens for pipeline_completed event
        AX-->>BE: pipeline_completed
        BE->>AX: GET /api/pipelines/:jobId/results
        BE->>CS: Upsert aiInsights (idempotent)
        BE->>WP: broadcastAxiomStatus
    end

    UI->>UI: QCReviewContent tab loads
    UI->>BE: GET /api/axiom/evaluations/order/:orderId (RTK Query 2s poll)
    Note over UI: Shows AxiomProcessingStatus chip while pending/processing
    BE-->>UI: evaluation { status: completed, criteria[], riskScore }
    UI->>UI: Render AxiomInsightsPanel inline in QC checklist
    Note over UI: Each checklist item gets aiVerdict via applyAxiomPrefill()<br/>matching checklistItem.axiomCriterionIds[]
```

### Key notes
- Fields stamped on the order document: `axiomStatus`, `axiomPipelineJobId`, `axiomEvaluationId`, `axiomSubmittedAt`
- Fields stamped on completion: `axiomStatus: completed`, `axiomEvaluationCompletedAt`
- Service Bus events emitted: `axiom.evaluation.submitted`, `axiom.evaluation.completed`
- No human interaction required after the initial "Submit for QC" click

---

## Journey 3 — QC Review with Axiom Insights (Human QC Reviewer)

**Entry point:** Order detail → QC Review tab (Tab 9)  
**Key components:** `QCReviewContent.tsx` (1,612 lines), `AxiomInsightsPanel.tsx` (888 lines), `AxiomDocRefDialog`, `CriteriaRequirementsPanel`  
**Key utility:** `applyAxiomPrefill()` in `axiomQcBridge.ts`  
**Backend entry:** `POST /api/qc-workflow/queue/:queueItemId/decision`

```mermaid
sequenceDiagram
    actor QC as Human (QC Reviewer)
    participant UI as l1-valuation-platform-ui
    participant BE as appraisal-mgmt-backend
    participant CS as Cosmos DB
    participant SB as Service Bus

    QC->>UI: Navigate to Order → QC Review tab
    UI->>UI: QCReviewContent mounts
    UI->>BE: GET /api/axiom/evaluations/order/:orderId (2s poll)
    BE->>CS: Query aiInsights container
    CS-->>BE: AxiomEvaluationResponse (or 404)

    alt Evaluation still processing
        BE-->>UI: { status: processing/queued }
        UI->>UI: Show AxiomProcessingStatus chip (animated)
        Note over UI: "Axiom AI evaluating..." with spinner
    end

    alt Evaluation complete
        BE-->>UI: { status: completed, riskScore, criteria[], programId }
        UI->>UI: Render AI Analysis badge in header (score chip)
        UI->>UI: applyAxiomPrefill() - stamp aiVerdict on each checklist item
        Note over UI: Per checklist item: worst-case verdict across<br/>all matched axiomCriterionIds[]

        UI->>BE: GET /api/criteria/clients/:c/tenants/:t/programs/:p/:v/compiled
        BE->>CS: Cache-first Axiom criteria query
        CS-->>BE: CompiledProgramNode[]
        BE-->>UI: Compiled criteria with descriptions/requirements
        UI->>UI: CriteriaRequirementsPanel shows program requirements
    end

    QC->>UI: Expands checklist item with fail/warning verdict
    UI->>UI: Show right panel: Axiom tab selected
    UI->>UI: AxiomInsightsPanel: EvaluationCard for matched criterion
    Note over UI: - Verdict chip (PASS/FAIL/WARNING/REVIEW)<br/>- Confidence score<br/>- AI reasoning text<br/>- Remediation guidance<br/>- DocumentCitations list<br/>- SupportingDataTable (extracted fields)

    QC->>UI: Clicks document citation
    UI->>UI: AxiomDocRefDialog opens
    Note over UI: Shows quote/text highlight +<br/>PDF viewer (sourceBlobUrl) +<br/>page number + field context

    QC->>UI: Reviews all criteria, makes QC decision
    QC->>UI: Clicks "Submit Decision" → QC Decision Dialog
    QC->>UI: Sets outcome (APPROVED/REJECTED/CONDITIONAL) + comments + conditions[]

    UI->>BE: POST /api/qc-workflow/queue/:queueItemId/decision { outcome, conditions, notes, axiomApplied: true }
    BE->>BE: qcWorkflowController.submitDecision()
    BE->>CS: axiomService.getEvaluationsForOrder(orderId) [best-effort]
    BE->>BE: Find most recent completed evaluation
    BE->>CS: completeWithDecision { axiomEvaluationId, axiomRiskScore, axiomStatus: completed, axiomCriteriaSnapshot[] }

    alt outcome === APPROVED
        BE->>CS: Update order.status = COMPLETED
        BE->>SB: Publish order.completed
    else outcome === REJECTED or CONDITIONAL
        BE->>CS: Update order.status = REVISION_REQUESTED
        BE->>BE: mapScoreToSeverity(riskScore): score<30→CRITICAL, <50→MAJOR, <70→MODERATE, else→MINOR
        BE->>CS: revisionService.createRevisionRequest(conditions[], severity, dueDate)
        BE->>SB: Publish revision.requested
    end

    BE-->>UI: 200 { decisionId, outcome }
    UI->>UI: Show confirmation snackbar + navigate
```

### Key notes
- `applyAxiomPrefill()` is a pure function — takes `ReviewData` and `AxiomCriterion[]`, returns new `ReviewData` with `aiVerdict` set to worst-case (`fail > warning > pass`) across all matched criterion IDs. Never mutates input.
- `mapScoreToSeverity()`: score < 30 → CRITICAL, < 50 → MAJOR, < 70 → MODERATE, else → MINOR
- Decision record stores `axiomEvaluationId`, `axiomRiskScore`, `axiomStatus`, `axiomCriteriaSnapshot[]` — a point-in-time snapshot of what Axiom found at decision time
- `CriteriaRequirementsPanel` fetches compiled criteria (canonical + lender delta merged) with 1-hour in-memory cache; `?force=true` bypasses cache

---

## Journey 4 — Bulk Portfolio Tape Evaluation (Human-Initiated)

**Entry point:** `/bulk-portfolios` page → select `TAPE_EVALUATION` mode  
**Key components:** `bulk-portfolios/page.tsx`, `ReviewTapeResultsGrid.tsx` (1,000 lines), `BulkRowDetailTabs.tsx` (505 lines)  
**Backend entry:** `POST /api/bulk-portfolio { mode: TAPE_EVALUATION }`  
**Axiom pipeline:** `PIPELINE_RISK_EVAL` per loan, `correlationType: TAPE_LOAN`, `correlationId: jobId::loanNumber`

```mermaid
sequenceDiagram
    actor PA as Human (Portfolio Analyst)
    participant UI as Bulk Portfolios Page
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant CS as Cosmos DB
    participant WP as WebPubSub

    PA->>UI: Navigate to /bulk-portfolios
    PA->>UI: Select TAPE_EVALUATION mode
    PA->>UI: Drop XLSX risk tape file
    UI->>UI: parseSheet() / parseTapeSheet() - client-side ExcelJS parsing
    Note over UI: Normalizes 73 fields, coerces numerics/booleans,<br/>computes LTV/CLTV/appreciation/AVM Gap
    UI->>UI: Preview table: Loan# / Borrower / Address / AppraisedValue / LTV
    PA->>UI: Select Program (ReviewProgramSelector)
    PA->>UI: Click "Evaluate N Loans"

    UI->>BE: POST /api/bulk-portfolio { mode: TAPE_EVALUATION, tapeRows[], programId, tenantId, clientId }
    BE->>CS: Create BulkPortfolioJob { status: PENDING, loanCount }
    BE-->>UI: 202 { job: { id: jobId } }

    Note over BE: Fan-out loop (one Axiom pipeline per loan)
    loop For each loan in tapeRows
        BE->>AX: POST /api/pipelines { pipeline: PIPELINE_RISK_EVAL, input: { correlationType: TAPE_LOAN, correlationId: jobId::loanNumber, tenantId, clientId, fields: loanFields } }
        AX-->>BE: 202 { jobId: loanJobId }
        BE->>BE: watchPipelineStream(loanJobId, jobId::loanNumber, TAPE_LOAN) [fire-and-forget per loan]
    end

    UI->>UI: Step 2 renders ReviewTapeResultsGrid
    UI->>BE: GET /api/bulk-portfolio/:jobId/axiom-status (every 15s poll)
    Note over UI: Shows "Axiom evaluating..." banner while any loan is pending
    Note over UI: AI Risk column: risk score chip / spinner / warning

    Note over AX: Parallel pipeline execution, one per loan
    loop For each completed loan (Axiom pushes webhooks)
        AX->>BE: POST /api/axiom/webhook { correlationType: TAPE_LOAN, correlationId: jobId::loanNumber, status: completed, result: { overallRiskScore, overallDecision } }
        BE->>BE: verifyAxiomWebhook (HMAC-SHA256)
        BE->>BE: Split correlationId → jobId + loanNumber
        BE->>CS: bulkPortfolioService.stampBatchEvaluationResults(jobId, [{ loanNumber, riskScore, decision, status }])
        BE->>WP: broadcastBatchJobUpdate(jobId)
    end

    UI->>BE: GET /api/bulk-portfolio/:jobId/axiom-status (15s poll)
    BE->>CS: Load job, check all loans axiomStatus
    BE-->>UI: { rows: [{ loanNumber, axiomStatus, axiomRiskScore, axiomDecision }] }
    UI->>UI: Merge into resultRowsWithAxiom (useMemo)
    UI->>UI: Stop polling when all rows === completed|failed

    PA->>UI: Reviews Syncfusion grid: risk scores, decisions, fired flags, LTV, CLTV
    PA->>UI: Uses AI Assist toolbar → prompt to filter/analyze grid
    PA->>UI: Select loans + Bulk Action (Create Orders / Export CSV / etc.)
    PA->>UI: Click "Create Orders" for eligible loans
    UI->>BE: POST /api/bulk-portfolio/:jobId/create-orders { selectedLoanNumbers[] }
    BE-->>UI: { created[], failed[] }
    UI->>UI: Show success/fail summary + OrderNumberTemplate links
```

### Key notes
- XLSX parsing is 100% client-side via ExcelJS — no file upload for the tape, only the parsed JSON rows are sent to the backend
- `correlationId` format `jobId::loanNumber` allows the webhook handler to route results to the correct job and row with a single string split on `::`
- `ReviewTapeResultsGrid` uses Syncfusion Grid with 60+ columns and an AI Assist dialog that calls `getAzureChatAIRequest`
- Polling stops (`pollingInterval: 0`) when ALL rows have `axiomStatus === 'completed' | 'failed'`
- `BulkRowDetailTabs` (per-row expanded detail) shows AI Analysis tab with its own `AxiomProgressPanel`

---

## Journey 5 — Bulk Portfolio Document Extraction (Human-Initiated)

**Entry point:** `/bulk-portfolios` page → select `DOCUMENT_EXTRACTION` mode  
**Key components:** `ExtractionProgressPanel.tsx` (253 lines), `ReviewTapeResultsGrid.tsx`  
**Backend service:** `ReviewDocumentExtractionService` → `POST /documents/extract` per loan  
**Webhook:** `POST /api/axiom/webhook/extraction` → `mapAxiomResultToTapeItem()` (70-field mapping)

```mermaid
sequenceDiagram
    actor PA as Human (Portfolio Analyst)
    participant UI as Bulk Portfolios Page
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant CS as Cosmos DB

    PA->>UI: Navigate to /bulk-portfolios
    PA->>UI: Select DOCUMENT_EXTRACTION mode
    PA->>UI: Drop extraction manifest XLSX (2 columns: loanNumber + documentUrl)
    UI->>UI: parseExtractionManifest() - normalizes 6 header aliases
    Note over UI: Shows manifest preview table + warnings (missing URLs, duplicates)
    PA->>UI: Select Client + Program
    PA->>UI: Click "Submit"

    UI->>BE: POST /api/bulk-portfolio { mode: DOCUMENT_EXTRACTION, documentUrls: Map<loanNumber→url>, programId, tenantId, clientId }
    BE->>CS: Create BulkPortfolioJob { status: PENDING }
    BE->>BE: ReviewDocumentExtractionService.submitDocuments()

    loop For each loan in manifest
        BE->>AX: POST /documents/extract { jobId, loanNumber, documentUrl, programId, webhookUrl: /api/axiom/webhook/extraction }
        Note over AX: PDF → text/image → page classification → field extraction
        AX-->>BE: 202 { evaluationId }
        BE->>CS: buildExtractionItem(loanNumber, url, evaluationId) → status: PENDING
    end

    BE-->>UI: 202 { job: { id: jobId } }
    UI->>UI: Step 2 renders ExtractionProgressPanel

    loop Poll every 5s
        UI->>BE: GET /api/bulk-portfolio/:jobId/extraction-progress
        BE->>CS: Load job extraction items
        BE-->>UI: { overall: { pct, completed, total }, loans: [{ loanNumber, status, confidence, timestamps, errors }] }
        UI->>UI: LinearProgress header + per-loan status table
        Note over UI: Status chips: PENDING→SUBMITTING→EXTRACTING→COMPLETED|PARTIAL|FAILED
    end

    loop For each completed extraction (Axiom pushes webhooks)
        AX->>BE: POST /api/axiom/webhook/extraction { correlationId: jobId::loanNumber, status: completed, result: { extractedFields: { field: value }[] } }
        BE->>BE: verifyAxiomWebhook
        BE->>BE: ReviewDocumentExtractionService.mapAxiomResultToTapeItem(evaluationId, extractedFields, loanNumber, rowIndex)
        Note over BE: Maps 70 fields: 36 numeric (parseFloat + strip $,%),<br/>4 boolean (yes/true/1), 30 string pass-through.<br/>NaN → dataQualityIssues[]
        BE->>CS: Store mapped ReviewTapeItem for this loan
        BE->>CS: Update extraction item status = COMPLETED, confidence
    end

    UI->>BE: GET /api/bulk-portfolio/:jobId/extraction-progress
    Note over UI: When all loans in TERMINAL_STATUSES (COMPLETED|PARTIAL|FAILED)
    UI->>UI: setIsDone(true) → stop polling → call onComplete()
    UI->>UI: Render ReviewTapeResultsGrid (same as TAPE_EVALUATION)
    Note over UI: Full 73-field grid with extracted values populated.<br/>dataQualityIssues shown as warning tooltips.

    PA->>UI: Reviews extracted data, exports XLSX, creates orders
```

### Key notes
- Field mapping in `mapAxiomResultToTapeItem()`: 36 numeric fields (strip `$`, `%`, commas → `parseFloat`), 4 boolean fields (`yes/true/1` → `true`), 30 string fields (pass-through with null guard)
- `dataQualityIssues[]` accumulates any field where `parseFloat` returns `NaN` — shown as warning tooltips in the grid
- Per-loan failures are logged and skipped — the job continues even if individual extractions fail
- Terminal statuses that stop polling: `COMPLETED`, `PARTIAL`, `FAILED` — `PARTIAL` means some fields extracted, others missing

---

## Journey 6 — Order Intake Wizard with Axiom Property Enrichment (Human-Initiated)

**Entry point:** New Order intake wizard → Step 2 (`AxiomEnrichmentStep`)  
**Key components:** `AxiomEnrichmentStep.tsx` (385 lines), `AxiomComplexityScoreCard`, `AxiomPropertyEnrichmentPanel`, `AxiomProcessingStatus`  
**Backend routes:** `POST /api/axiom/property/enrich`, `POST /api/axiom/scoring/complexity`  
**Trigger:** Auto-fires on component mount — no manual button press

```mermaid
sequenceDiagram
    actor LO as Human (Loan Officer / Staff)
    participant UI as Order Intake Wizard
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant CS as Cosmos DB

    LO->>UI: Start New Order (intake wizard)
    LO->>UI: Step 1 — Fill property info (address, type, APN, etc.)
    LO->>UI: Click Next → Step 2 (AxiomEnrichmentStep auto-mounts)

    Note over UI: AxiomEnrichmentStep auto-triggers on mount
    UI->>UI: Show "Processing with Axiom AI..." (AxiomProcessingStatus)
    UI->>BE: POST /api/axiom/property/enrich { propertyInfo }
    BE->>AX: POST /api/pipelines (DOC_EXTRACT pipeline variant for property enrichment)
    AX-->>BE: Enriched property data
    BE-->>UI: { enrichmentData: { sqft, bedrooms, bathrooms, yearBuilt, AVM, comparables... } }

    UI->>BE: POST /api/axiom/scoring/complexity { propertyInfo, enrichmentData }
    BE->>AX: Complexity scoring pipeline
    AX-->>BE: { complexityScore, drivers[], riskFactors[] }
    BE-->>UI: ComplexityScoreResponse

    UI->>UI: Render AxiomComplexityScoreCard (score + drivers)
    UI->>UI: Render AxiomPropertyEnrichmentPanel (AVM, comps, enriched fields)

    LO->>UI: Reviews enrichment, optionally adjusts order type/fee
    LO->>UI: Click "Continue" or "Skip Enrichment"
    LO->>UI: Complete remaining wizard steps
    LO->>UI: Submit order
    UI->>BE: POST /api/orders { ...orderData, axiomEnrichmentId? }
    BE->>CS: Store order with enrichment reference
    BE-->>UI: 201 { orderId }
    UI->>UI: Navigate to new order detail page
```

### Key notes
- Enrichment is sequential: enrich first, then complexity score using enrichment output
- "Skip Enrichment" button available — user can bypass if Axiom is unavailable or enrichment fails
- RTK Query hooks used: `useEnrichPropertyMutation`, `useCalculateComplexityScoreMutation` from `axiomApi.ts`

---

## Journey 7 — AI Analysis Tab with Live SSE Feed (Human)

**Entry point:** Order detail → "AI Analysis" tab (Tab 13)  
**Key components:** `AxiomAnalysisTab` (inline in `orders/[id]/page.tsx`), `AxiomProgressPanel`, `AxiomInsightsPanel`, `AxiomDocRefDialog`  
**SSE path:** Frontend `EventSource` → `GET /api/documents/stream/:executionId` → `proxyPipelineStream()` → Axiom `/api/pipelines/:jobId/observe`  
**Poll:** `useGetOrderEvaluationsQuery` at 5s interval

```mermaid
sequenceDiagram
    actor R as Human (Reviewer / Staff)
    participant UI as Order Detail — AI Analysis Tab (Tab 13)
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant CS as Cosmos DB

    R->>UI: Navigate to Order → "AI Analysis" tab
    UI->>UI: AxiomAnalysisTab mounts
    UI->>BE: GET /api/axiom/evaluations/order/:orderId (5s poll via useGetOrderEvaluationsQuery)
    BE->>CS: Query aiInsights container
    CS-->>BE: AxiomEvaluationResponse[]

    alt No evaluations yet
        BE-->>UI: []
        UI->>UI: Alert: "No AI analysis available yet for this order"
        Note over UI: User can manually trigger from Documents tab
    end

    alt Evaluations found
        BE-->>UI: [{ evaluationId, pipelineJobId, status, riskScore, criteria[] }]
        UI->>UI: Render one AxiomProgressPanel per evaluation

        Note over UI: For each AxiomProgressPanel
        UI->>BE: GET /api/documents/stream/:executionId (EventSource)
        Note over UI: executionId maps to axiomJobId via AxiomExecutionRecord
        BE->>AX: GET /api/pipelines/:jobId/observe (proxy stream)
        AX-->>BE: SSE stream: event:connected { jobId, cursor }

        loop While pipeline running
            AX-->>BE: event:stage.completed { stageName, progress: 0-100 }
            BE-->>UI: SSE event (piped)
            UI->>UI: Update progress bar + stage label in AxiomProgressPanel
            R->>UI: Sees live stage ticks: Classification → Extraction → Criteria Evaluation
        end

        AX-->>BE: event:pipeline.completed
        BE-->>UI: SSE event
        UI->>UI: Close EventSource
        UI->>UI: Render AxiomInsightsPanel inside AxiomProgressPanel

        R->>UI: Expand individual criterion accordion
        Note over UI: Shows: verdict, confidence, reasoning,<br/>remediation guidance, citations, extracted data table
        R->>UI: Click document citation
        UI->>UI: AxiomDocRefDialog opens with PDF viewer + quote highlight
        R->>UI: Click "View Source" on ExtractedDataSection
        UI->>UI: Toggle between clean fields view and raw JSON (DataObjectIcon)
    end
```

### Key notes
- `AxiomProgressPanel` renders one per evaluation — an order can have multiple evaluations (e.g. re-runs)
- SSE stream URL: `${backendBaseUrl}/api/documents/stream/${pipelineJobId}?access_token=${token}`
- `proxyPipelineStream()` pipes the raw Axiom SSE response with no buffering: `response.data.pipe(res)` — destroyed on `req.close`
- After `pipeline.completed` SSE event, the component transitions from progress view to full `AxiomInsightsPanel`
- `ExtractedDataSection` toggle: clean field table ↔ raw JSON view via `DataObjectIcon`

---

## Journey 8 — QC Execution Engine with Axiom Context (Automated / Human-triggered)

**Entry point:** `POST /api/reviews/execute` (sync) or `POST /api/reviews/execute/async` (202 pattern)  
**Key controller:** `QCExecutionController` (`reviews.controller.ts`, 1,649 lines)  
**Axiom integration:** `axiomService.getEvaluation(orderId)` injected into `QCExecutionContext` — best-effort, swallowed on failure  
**Session storage:** In-memory `Map<string, QCExecutionSession>` — not persisted to Cosmos

```mermaid
sequenceDiagram
    actor QC as Human (QC System / Automated)
    participant UI as QC Execution UI
    participant BE as appraisal-mgmt-backend
    participant AX as Axiom API
    participant CS as Cosmos DB

    alt Synchronous execution
        QC->>BE: POST /api/reviews/execute { orderId, config }
        BE->>BE: QCExecutionController.executeQCReview()
        BE->>CS: axiomService.getEvaluation(orderId) [best-effort, catch swallowed]
        alt Axiom evaluation exists and completed
            CS-->>BE: AxiomEvaluationResponse { status: completed, riskScore, criteria[] }
            BE->>BE: Build axiomEvaluation = { evaluationId, riskScore, status, criteria[], completedAt }
            BE->>BE: Inject into QCExecutionContext.axiomEvaluation
            BE->>BE: Stamp documentData.__axiomEvaluation (used by AI prompt engine)
        end
        BE->>BE: Run QC engine with enriched context
        BE-->>QC: 200 { sessionId, results, score }
    else Async execution (202 pattern)
        QC->>BE: POST /api/reviews/execute/async { orderId, config }
        BE-->>QC: 202 { sessionId }
        BE->>BE: executeQCReviewInBackground(sessionId) [parallel]
        BE->>CS: axiomService.getEvaluation(orderId) [best-effort]
        BE->>BE: Run QC engine with axiomEvaluation context
        BE->>CS: Store session results

        loop Poll until complete
            QC->>BE: GET /api/reviews/sessions/:sessionId/status
            BE-->>QC: { status: running/completed, progress: 0-100 }
        end
        QC->>BE: GET /api/reviews/sessions/:sessionId/results
        BE-->>QC: Full QC results with Axiom-informed findings
    end

    Note over BE: How Axiom data flows through QC engine:<br/>- AI prompts see documentData.__axiomEvaluation fields<br/>- Risk score influences overall QC score computation<br/>- Failed criteria flag corresponding checklist items<br/>- mapScoreToSeverity(riskScore) drives revision severity
```

### Key notes
- `getEvaluation()` failure is explicitly caught and swallowed — QC execution proceeds without Axiom data rather than failing
- `documentData.__axiomEvaluation` is the bridge between Axiom results and the AI prompt templates inside the QC engine
- Analytics endpoints (`GET /api/reviews/analytics`) compute score distributions, common issues, and checklist usage from in-memory sessions only — data is lost on restart
- Both sync and async paths share the same Axiom injection logic in `executeQCReviewInBackground()`

---

## Journey 9 — Automated Axiom Timeout Monitoring

**Entry point:** `AxiomTimeoutWatcherJob` — scheduled cron (every 5 minutes)  
**Threshold:** Per-tenant `axiomTimeoutMinutes` configuration  
**Trigger condition:** `axiomSubmittedAt` set + `axiomEvaluationCompletedAt` null + `axiomTimedOut !== true`  
**Events:** Publishes `axiom.evaluation.timeout` to Service Bus

```mermaid
sequenceDiagram
    participant JOB as AxiomTimeoutWatcherJob (cron every 5 min)
    participant CS as Cosmos DB
    participant SB as Service Bus
    participant UI as l1-valuation-platform-ui

    loop Every 5 minutes
        JOB->>CS: Query orders WHERE axiomSubmittedAt IS NOT NULL<br/>AND axiomEvaluationCompletedAt IS NULL<br/>AND axiomTimedOut != true
        CS-->>JOB: Stalled orders[]

        loop For each stalled order
            JOB->>CS: Load tenant config → get axiomTimeoutMinutes
            JOB->>JOB: elapsed = now - order.axiomSubmittedAt
            alt elapsed > axiomTimeoutMinutes
                JOB->>CS: Patch order { axiomTimedOut: true, axiomTimeoutAt: now }
                JOB->>SB: Publish axiom.evaluation.timeout { orderId, tenantId, clientId, elapsed }
                Note over SB: Downstream consumers can:<br/>- Alert reviewer<br/>- Trigger fallback workflow<br/>- Mark order for manual review
            end
        end
    end

    Note over UI: No direct UI push from timeout job.<br/>Next poll of GET /api/axiom/evaluations/order/:orderId<br/>reflects axiomTimedOut: true.<br/>AxiomProgressPanel/AxiomInsightsPanel<br/>render timeout/error state accordingly.
```

### Key notes
- `axiomTimeoutMinutes` is configurable per tenant — different lenders can have different SLA expectations
- The watcher only marks timeout; recovery/retry logic is downstream (Service Bus consumers)
- UI reflects timeout on next poll cycle — no WebSocket/WebPubSub push from this job

---

## Key Source Files

### Backend (`appraisal-management-backend/src`)

| File | Purpose | Lines |
|---|---|---|
| `services/axiom.service.ts` | Core Axiom HTTP client, pipeline definitions, SSE proxy, SSE watcher, result storage | ~2,256 |
| `controllers/axiom.controller.ts` | Express router at `/api/axiom` — analyze, evaluate, webhook handlers | 871 |
| `services/axiom-execution.service.ts` | Cosmos CRUD for `axiom-executions` container | ~150 |
| `services/axiom-auto-trigger.service.ts` | Service Bus listener, auto-submit on order status change | ~200 |
| `middleware/verify-axiom-webhook.middleware.ts` | HMAC-SHA256 signature verification on `x-axiom-signature` | ~60 |
| `jobs/axiom-timeout-watcher.job.ts` | Cron job every 5 min for stalled evaluations | ~120 |
| `types/axiom.types.ts` | `AxiomExecutionRecord`, `AxiomPipelineMode`, `AxiomExecutionStatus`, etc. | ~80 |
| `services/review-document-extraction.service.ts` | Bulk extraction submission + 70-field result mapping | ~250 |
| `controllers/qc-workflow.controller.ts` | QC decision submission with Axiom snapshot attachment | 1,349 |
| `controllers/reviews.controller.ts` | QC execution engine with Axiom context injection | 1,649 |
| `controllers/criteria-programs.controller.ts` | Compiled criteria proxy with 1h cache | 113 |

### Frontend (`l1-valuation-platform-ui/src`)

| File | Purpose | Lines |
|---|---|---|
| `store/api/axiomApi.ts` | RTK Query endpoints — analyze, evaluate, compare, enrich, complexity, compiled criteria | 374 |
| `types/axiom.types.ts` | `AxiomEvaluationResponse`, `AxiomCriterion`, `AxiomDocumentReference`, `CompileResponse` | 745 |
| `utils/axiomQcBridge.ts` | `applyAxiomPrefill()` — pure function, maps criteria to checklist items | ~80 |
| `components/axiom/AxiomInsightsPanel.tsx` | Full evaluation display: criteria cards, citations, extracted data | 888 |
| `components/qc/QCReviewContent.tsx` | QC review tab with inline Axiom verdict prefill and decision submission | 1,612 |
| `components/intake/AxiomEnrichmentStep.tsx` | Order intake step 2 — property enrichment + complexity score | 385 |
| `components/documents/DocumentUploadZone.tsx` | Upload + optional Axiom analyze trigger (default OFF) | 322 |
| `components/documents/EnhancedDocumentUpload.tsx` | Upload dialog + optional Axiom analyze trigger (default ON) | 498 |
| `app/(control-panel)/bulk-portfolios/page.tsx` | Full bulk portfolio page — tape eval + doc extraction + order creation | ~2,174 |
| `app/(control-panel)/bulk-portfolios/ExtractionProgressPanel.tsx` | Per-loan extraction progress with 5s poll | 253 |
| `app/(control-panel)/bulk-portfolios/ReviewTapeResultsGrid.tsx` | Syncfusion grid with AI Assist — displays all bulk results | 1,000 |
| `app/(control-panel)/bulk-portfolios/BulkRowDetailTabs.tsx` | Per-row expanded detail: submission fields + AI analysis + QC links | 505 |
| `services/axiom.service.ts` | Direct Axiom HTTP client (dev/test only — prod uses backend proxy) | 390 |

---

## Environment Variables

| Variable | Where used | Required |
|---|---|---|
| `AXIOM_API_BASE_URL` | `AxiomService` constructor — enables live mode (else mock) | Yes for live |
| `AXIOM_API_KEY` | Bearer auth header on all Axiom requests | Optional |
| `AXIOM_WEBHOOK_SECRET` | HMAC-SHA256 webhook signature verification | Yes for webhooks |
| `AXIOM_MOCK_DELAY_MS` | Mock mode lifecycle timing (default: 8000 ms) | No |
| `AXIOM_PIPELINE_ID_RISK_EVAL` | Override inline pipeline with registered Axiom template UUID | No |
| `AXIOM_PIPELINE_ID_DOC_EXTRACT` | Override inline pipeline with registered Axiom template UUID | No |
| `AXIOM_PIPELINE_ID_BULK_EVAL` | Override inline pipeline with registered Axiom template UUID | No |
| `AXIOM_COMPILE_CACHE_TTL_MS` | Compiled criteria in-memory cache TTL (default: 3,600,000 ms / 1 hour) | No |
| `API_BASE_URL` | Used to construct the webhook callback URL sent to Axiom | Yes for webhooks |
| `VITE_AXIOM_API_URL` | Frontend direct Axiom client — dev/test only | Dev only |
| `VITE_AXIOM_API_KEY` | Frontend direct Axiom client — dev/test only | Dev only |
