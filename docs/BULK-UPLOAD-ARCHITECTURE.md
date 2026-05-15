# Bulk Upload Architecture Decision

**Date:** 2026-04-28
**Status:** DECIDED
**Deciders:** Platform Engineering (T3.1 — required by production readiness plan)

---

## Context

There are two independent bulk-submission code paths in the codebase:

### Path A — Bulk Portfolio (`/api/bulk-portfolios`)

Files: `bulk-portfolio.controller.ts`, `bulk-portfolio.service.ts`

Supports three `processingMode` values:
| Mode | What it does |
|---|---|
| `ORDER_CREATION` | Parse CSV/XLSX → create orders (+ optional PDF attachment) |
| `TAPE_EVALUATION` | Evaluate a risk tape (AVM / FRAUD / etc.) via Axiom without creating orders |
| `DOCUMENT_EXTRACTION` | Submit PDFs to Axiom extraction for existing orders |

Axiom integration is **bolt-on**: extraction and criteria run through separate steps after order creation; there is no worker chain, no per-row stage tracking, and no retry mechanism beyond re-submitting the entire job.

### Path B — Bulk Ingestion (`/api/bulk-ingestion`)

Files: `bulk-ingestion.controller.ts`, `bulk-ingestion.service.ts`, five worker services

A proper event-driven multi-stage pipeline:
```
submit → bulk.ingestion.requested event
            ↓
   BulkIngestionProcessorService   (canonicalize + upload docs to blob)
            ↓  bulk.ingestion.processed
   BulkIngestionOrderCreationWorker (create order per row)
            ↓  bulk.ingestion.order.created
   BulkIngestionExtractionWorker    (POST /api/documents + /api/pipelines to Axiom)
            ↓  bulk.ingestion.extraction.completed
   BulkIngestionCriteriaWorker      (rules-based criteria eval — Axiom integration pending T3.4)
            ↓  bulk.ingestion.criteria.completed
   BulkIngestionFinalizerService    (stamp order, mark job complete)
```

Supports: adapter-based field mappings, per-row failure records with retry, three ingestion modes (`MULTIPART`, `SHARED_STORAGE`, `TAPE_CONVERSION`), export of failures as CSV/XLSX.

---

## Decision

### 1. Bulk Ingestion IS the production path for CSV + PDF bulk order submission

`POST /api/bulk-ingestion/submit` (Path B) is the authoritative production route for all workflows that involve:
- Creating new orders in bulk from CSV/XLSX
- Attaching PDFs to those orders
- Running Axiom extraction + criteria on them via the worker chain

**Path A `ORDER_CREATION` mode is deprecated.** The Bulk Portfolios page in the frontend (T3.2) will be rewritten to submit against `/api/bulk-ingestion/submit`. The backend `ORDER_CREATION` endpoint will remain callable during the transition period but will log a deprecation warning and not receive new features.

**Path A `DOCUMENT_EXTRACTION` mode is deprecated.** The Bulk Ingestion extraction worker handles document submission as part of the standard pipeline; there is no need for a separate extraction-only bulk path.

### 2. Bulk Portfolio TAPE_EVALUATION is kept — different use case

`processingMode: TAPE_EVALUATION` serves a distinct workflow: reviewing an existing **loan portfolio tape** (no order creation, assessment-only, AVM / FRAUD / ROV risk types) and optionally creating orders from selected results afterward via `POST /api/bulk-portfolios/:jobId/create-orders`.

This workflow has no equivalent in Bulk Ingestion and is NOT superseded. It remains on Path A.

### 3. The Bulk Portfolios ops-monitoring UI is kept

The ops-monitoring page (`/bulk-portfolios-ops` or equivalent) provides a cross-job status view. It is NOT the same as the submit wizard; it stays. Once T3.2 is complete, the submit wizard routes to Bulk Ingestion, while the ops view continues to read from the `bulkJobs` container (both paths write there).

---

## Consequences

| Concern | Outcome |
|---|---|
| New bulk uploads | Use Bulk Ingestion path (T3.2 frontend rewrite) |
| Existing ORDER_CREATION jobs in Cosmos | No migration; they remain readable via existing GET endpoints |
| TAPE_EVALUATION workflow | Unchanged — stays on Bulk Portfolio |
| Per-row retry | Implemented in Bulk Ingestion (T3.6) |
| Criteria via real Axiom | Added to Bulk Ingestion criteria worker (T3.4) |
| Backend deprecation timing | ORDER_CREATION endpoint soft-deprecated at T3.2 ship; hard-removal deferred to post-Cap-3 |

---

## Multi-document-per-order support

Today `BulkIngestionItemInput` has `documentFileName?: string` (single value). T3.3 adds `documentFileNames?: string[]` so a single CSV row can reference multiple PDFs (e.g. appraisal report + attachments). Both fields will be supported simultaneously for backward compatibility.

---

## Linked tasks

- T3.2 — Frontend rewrite of Bulk Portfolios page → submit to Bulk Ingestion
- T3.3 — Backend: `documentFileNames[]` multi-doc support
- T3.4 — Criteria worker: invoke real Axiom when `programId` present
- T3.5 / T3.6 — Per-row failure UI + retry endpoint
- T3.7 — Ops monitoring page decision (keep, fold, or link)
- T3.8 — End-to-end Playwright verification (10 rows + 10 docs)
- T3.9 — Runbook
