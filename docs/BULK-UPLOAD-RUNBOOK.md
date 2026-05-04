# Bulk Upload Runbook

**Scope:** Step-by-step guide for preparing and submitting a bulk order CSV + PDF package via the
Bulk Portfolios page.  Covers column requirements, document naming, submission, real-time monitoring,
and per-row retry.

**Related docs:**
- Architecture decision: [BULK-UPLOAD-ARCHITECTURE.md](BULK-UPLOAD-ARCHITECTURE.md)
- Operational monitoring: [BULK_INGESTION_OPERATIONS_RUNBOOK.md](BULK_INGESTION_OPERATIONS_RUNBOOK.md)
- Axiom bulk submission ops: [AXIOM_BULK_SUBMISSION_RUNBOOK.md](AXIOM_BULK_SUBMISSION_RUNBOOK.md)

---

## 1. Prerequisites

| Item | Requirement |
|------|-------------|
| User role | Must have `bulk-ingestion:write` scope on the tenant |
| Adapter key | Know the adapter key for the target lender/workflow (e.g. `bridge-standard`) — confirm with ops |
| Client | A client record must exist in the system (select it in Step 1 of the wizard) |
| Browser | Chrome or Edge recommended; maximum supported CSV/XLSX: 10 000 rows; maximum PDFs per request: 500 |

---

## 2. CSV / XLSX Manifest Format

### Required columns

| Column name(s) | Description |
|----------------|-------------|
| `loanNumber` / `loan number` / `loan #` | Unique identifier for the loan row |
| `propertyAddress` / `property address` | Full street address including number and street name |
| `city` | City |
| `state` | Two-letter US state code (e.g. `TX`) |
| `zipCode` / `zip code` / `zip` | 5-digit or 5+4 ZIP code |

### Recommended columns

| Column name(s) | Description |
|----------------|-------------|
| `loanAmount` / `loan amount` | Loan amount in USD (numeric; no dollar signs) |
| `borrowerName` / `borrower name` | Full name of primary borrower |
| `propertyType` / `property type` | `SFR`, `CONDO`, `PUD`, `2-4 UNIT`, or `MANUFACTURED` |
| `loanPurpose` / `loan purpose` | `Purchase` or `Refinance` |
| `externalId` / `external id` | Optional unique key your system uses for the row |

### Document linkage columns (choose one)

| Column name(s) | Description |
|----------------|-------------|
| `documentFileName` / `document file name` | Name of the **single** PDF to attach to this row (e.g. `sample_001.pdf`) |
| `documentFileNames` / `document file names` | **Comma-separated** list of PDF names for rows that need multiple documents (e.g. `sample_001a.pdf, sample_001b.pdf`) |

> **Tip:** column header matching is case-insensitive and ignores spaces/punctuation.
> `Document File Name`, `Document_File_Name`, and `documentfilename` all resolve to the same alias.

---

## 3. PDF Naming Rules

- PDF file names must **exactly match** the values in `documentFileName` / `documentFileNames` (including extension).
- Names are matched case-sensitively.
- If a PDF is listed in the manifest but not uploaded, that row enters manual review (`DOCUMENT_NOT_FOUND`).
- There is no naming format requirement — keep your existing file naming convention.

---

## 4. Submitting a Batch

### Step 1 — Configuration

1. Navigate to **Bulk Portfolios** (`/bulk-portfolios`).
2. Select **Client** and optionally an **Engagement**.
3. Set **Analysis Type** to `AVM`, `FRAUD`, `ANALYSIS_1033`, `QUICK_REVIEW`, `DVR`, or `ROV`.
4. Set **Mode** to `ORDER_CREATION` (the full extraction + criteria pipeline).
5. Confirm the **Adapter Key** (defaults to `bridge-standard`; change only if instructed by ops).
6. Click **Next**.

### Step 2 — Upload & Review

1. Drag-and-drop (or click to browse):
   - Your CSV or XLSX manifest file.
   - All PDF documents for the batch (can include the manifest file in the same drop; it is filtered out automatically).
2. Wait for the client-side parse to finish.  A table preview shows:
   - One row per manifest row.
   - A **Doc Files** column showing how many PDFs matched each row.
3. Verify:
   - Row count matches your expectation.
   - All rows that should have documents show a chip (e.g. `2 files`).
   - Rows showing `—` in the Doc Files column have no matched PDF — check the file names.
4. Click **Submit**.

### Step 3 — Results

After submission you see:

- **Job Queued** confirmation with the job ID, status, total items, and pending count.
- **Row Failures** table (appears only when one or more rows failed immediately on intake).  Each row shows: Row #, Loan #, Stage, Error Code, Message, Retry button (if retryable).
- **Monitor Job** button → opens the Bulk Ingestion Ops dashboard filtered to this job.

---

## 5. Monitoring Progress

Open **Bulk Ingestion Ops** (`/bulk-ingestion-ops`) or click **Monitor Job** from the results screen.

| Column | Meaning |
|--------|---------|
| Status | `PENDING` → `PROCESSING` → `COMPLETED` / `PARTIAL` / `FAILED` |
| Total / Pending / Failed | Item counts for the job |
| Failures | Click to open the per-item failure detail dialog |

The job progresses through three internal stages per item:

```
canonicalization → extraction (Axiom) → criteria evaluation (Axiom) → finalizer
```

A job reaches `COMPLETED` when all items are in a terminal state (`COMPLETED` or `FAILED`).

---

## 6. Per-Row Retry

In the **Row Failures** table (Bulk Portfolios > Step 3 results) or in the failure detail
dialog on the ops page:

1. Find the failed row.
2. If the **Retry** column shows a {% icon Refresh %} icon, the failure is retryable.
3. Click the icon.  The row is re-queued at the start of the failed stage.
4. The failure list auto-refreshes; the row moves to `PROCESSING` on success.

> **Non-retryable failures** (icon absent): typically data-validation errors that require
> correcting the source CSV and submitting a new batch.

---

## 7. Common Failure Codes

| Code | Stage | Meaning | Remediation |
|------|-------|---------|-------------|
| `DOCUMENT_NOT_FOUND` | canonicalization | PDF file name in the manifest was not uploaded | Re-upload with the correct file; or remove the column value and re-submit |
| `DOCUMENT_ASSOCIATION_AMBIGUOUS` | canonicalization | Multiple PDFs partially match the manifest value | Rename PDFs to be unambiguous |
| `ORDER_CREATION_FAILED` | order-creation | Could not create an order record | Check required fields (loanNumber, address) |
| `EXTRACTION_TIMEOUT` | extraction | Axiom did not respond within the SLO window | Retryable — click Retry; escalate if persistent |
| `AXIOM_UPSTREAM_ERROR` | extraction / criteria | Axiom returned a 5xx error | Retryable — click Retry; check Axiom service status |
| `CRITERIA_FAILED` | criteria | Item failed local rules evaluation | Review criteria config with ops; not retryable until config changes |

---

## 8. Limits and SLOs

| Parameter | Value |
|-----------|-------|
| Max rows per job | 10 000 |
| Max PDFs per job | 500 |
| Max PDF size | 50 MB per file |
| P95 completion time | ≤ 10 minutes (standard 100-row batch) |
| Criteria stage available | Requires `BULK_INGESTION_ENABLE_CRITERIA_STAGE=true` in backend env |

---

## 9. Escalation Path

1. Per-row retry fails repeatedly → collect the **job ID** and **item ID** from the failure row and open a support ticket.
2. All rows failing at the same stage → likely a system-level issue; page on-call ops engineer.
3. Axiom upstream errors persist > 15 min → check Axiom status page; notify integration owner.
