# Bulk Ingestion App Insights Workbook Spec

## Purpose
Operational workbook for **Bulk Ingestion + Axiom Bulk Submission** health and SLO tracking.

## Scope
- Ingestion throughput, errors, and latency SLOs
- Stage-level failure concentration
- DLQ pressure and replay effectiveness
- Alert-path reliability

## Workbook Layout

### 1) Overview
- Time range selector: `Last 24h` default
- Tenant filter (optional) if tenant-level dimensions are available
- KPI tiles:
  - Ingestion requests (24h)
  - Ingestion error rate (%)
  - P95 ingestion latency (ms)
  - Open DLQ events
  - Replay success rate (%)

### 2) Ingestion Health
- Chart: request/error trend (5m bins)
- Table: stage/code failures (descending)
- Chart: terminal outcomes (`COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`) if dimensions are emitted

### 3) Latency & SLO
- Tile set: P50 / P95 / P99 duration
- SLO target markers:
  - Availability SLO: `99.5%` successful processing
  - Latency SLO: `P95 < 10m` end-to-end for standard jobs
- Burn-rate panel (optional) using 1h and 6h windows

### 4) DLQ & Replay Operations
- Chart: `dlqCreated`, `replaySucceeded`, `replayFailed` over time
- Table: latest open DLQ snapshot and replay attempts
- Action note linking to backend ops endpoints:
  - `GET /api/axiom/bulk-submission/dlq`
  - `POST /api/axiom/bulk-submission/dlq/{eventId}/replay`

### 5) Alert Channel Reliability
- Tile: alerts sent vs failures (`AXIOM_BULK_SUBMISSION`)
- Trend: alert failures over time

## Query Pack
Use [bulk-ingestion-observability.kql](bulk-ingestion-observability.kql) for all workbook visuals.

## Suggested Azure Workbook Parameters
- `TimeRange` (default: 24h)
- `TenantId` (optional)
- `ClientId` (optional)

## Ownership
- Platform SRE + Backend ingestion owners
- Update cadence: with every change to ingestion event schema or alerting logic
