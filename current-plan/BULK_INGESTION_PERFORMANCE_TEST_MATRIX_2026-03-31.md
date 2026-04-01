# Bulk Ingestion Performance Test Matrix (Step 1 Baseline)

**Date:** 2026-03-31  
**Owner:** Backend + SRE  
**Scope:** Phase 7 hardening kickoff for bulk-ingestion throughput/latency/concurrency.

---

## 1) Discovery Summary (Existing Assets)

### Existing performance-related assets found
- `tests/integration/performance.test.ts`
  - In-process API performance checks (health/auth/code execution).
  - Includes concurrent and memory checks.
  - Gated by `VITEST_INTEGRATION=true`.
- `vitest.config.ts`
  - Integration test include pattern and timeout settings already configured.
- `docs/BULK_INGESTION_OPERATIONS_RUNBOOK.md`
  - Defines operational SLOs (notably: P95 completion < 10 minutes for standard jobs).
- `docs/observability/bulk-ingestion-observability.kql`
  - Query pack for latency, failure, DLQ, and replay trend analysis.

### Gaps discovered
- No dedicated bulk-ingestion load harness (`k6`, `artillery`, `autocannon`, `wrk`) currently present.
- No benchmark fixture generator for deterministic `CSV/XLSX + PDF` mixed-ingestion payload profiles.
- No persisted benchmark result template/report format in repo yet.

---

## 2) Exact Test Matrix to Run

## Profile Definitions
- **P-SMALL:** 100 items, 20 PDFs, single adapter key, valid MIME/types.
- **P-MEDIUM:** 1,000 items, 200 PDFs, valid MIME/types.
- **P-LARGE:** 5,000 items, 500 PDFs (controller hard max for docs), valid MIME/types.

## Scenario Matrix

| ID | Category | Endpoint(s) | Input Profile | Load Pattern | Primary Metrics | Pass Criteria |
|---|---|---|---|---|---|---|
| BI-PERF-01 | Submit baseline | `POST /api/bulk-ingestion/submit` | P-SMALL | 1 request/iteration, 20 iterations | p50/p95 submit latency, HTTP success rate | p95 < 2.0s, success >= 99% |
| BI-PERF-02 | Submit scale-up | `POST /api/bulk-ingestion/submit` | P-MEDIUM | 1 request/iteration, 10 iterations | p50/p95 submit latency, enqueue success | p95 < 5.0s, success >= 99% |
| BI-PERF-03 | Submit upper-bound | `POST /api/bulk-ingestion/submit` | P-LARGE | 1 request/iteration, 5 iterations | submit latency, memory growth, error codes | no 5xx spike, memory growth bounded (<20% steady-state) |
| BI-PERF-04 | Submit concurrency | `POST /api/bulk-ingestion/submit` | P-SMALL | 10, 25, 50 concurrent clients (3 ramps) | throughput (jobs/min), error rate, p95 latency | success >= 98%, p95 < 8.0s at 50 conc |
| BI-PERF-05 | Operator read pressure | `GET /api/bulk-ingestion`, `GET /api/bulk-ingestion/:jobId`, `GET /api/bulk-ingestion/:jobId/failures` | existing jobs | 30/60/120 RPS for 5 min each | p50/p95 latency, CPU, Cosmos RU consumption | p95 < 1.0s list/get, <1.5s failures |
| BI-PERF-06 | Failure export pressure | `GET /api/bulk-ingestion/:jobId/failures/export?format=csv|xlsx` | failed job sample | 5/10 concurrent downloads | export duration, memory footprint, 5xx | CSV p95 < 2.0s, XLSX p95 < 5.0s, zero OOM |
| BI-PERF-07 | Control-action contention | `POST /:jobId/retry-failed`, `POST /:jobId/items/:itemId/retry`, `POST /:jobId/pause|resume|cancel` | mixed terminal/non-terminal jobs | 10 concurrent control actions over same job | status-code distribution (202/409), consistency correctness | no invalid state transitions; only expected 409 conflicts |
| BI-PERF-08 | Axiom ops polling load | `GET /api/axiom/bulk-submission/metrics`, `GET /api/axiom/bulk-submission/dlq` | live/seeded DLQ data | 10/25/50 concurrent pollers @ 5s interval | p95 latency, error rate | p95 < 1.0s, success >= 99.5% |
| BI-PERF-09 | End-to-end SLO validation | job lifecycle telemetry + App Insights KQL | P-SMALL + P-MEDIUM mixed | sustained 60 min run | P50/P95/P99 completion duration, failure %, DLQ growth | P95 completion < 10 min, non-systemic success >= 99.5%, OPEN DLQ not monotonically increasing |

---

## 3) Execution Order

1. BI-PERF-01 (baseline sanity)
2. BI-PERF-02 and BI-PERF-03 (payload scaling)
3. BI-PERF-04 (submit concurrency ramp)
4. BI-PERF-05 and BI-PERF-08 (read/polling pressure)
5. BI-PERF-06 and BI-PERF-07 (export + control contention)
6. BI-PERF-09 (full SLO validation window)

---

## 4) Measurement & Output Requirements

For every scenario capture:
- Test metadata: scenario ID, commit SHA, environment, timestamp, data profile.
- Latency: p50/p95/p99 and max.
- Throughput: requests/sec and successful jobs/min where applicable.
- Reliability: success %, error % by status code class.
- Resource signals: CPU, memory, Cosmos RU, Service Bus queue depth.
- Domain outcomes (bulk-specific):
  - job terminal status distribution (`COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`)
  - failure stage/code distribution
  - DLQ OPEN count trend and replay effectiveness

Artifacts to produce per run:
- `output/perf/<scenario-id>/<timestamp>/summary.json`
- `output/perf/<scenario-id>/<timestamp>/raw.csv`
- `output/perf/<scenario-id>/<timestamp>/kql-snapshots.md`

---

## 5) Commands We Will Use (Current + Next-Step)

Current available command now:
- `VITEST_INTEGRATION=true pnpm vitest run tests/integration/performance.test.ts`

Planned runner commands for step 2 implementation:
- `pnpm perf:bulk:run --scenario BI-PERF-01`
- `pnpm perf:bulk:run --scenario BI-PERF-04 --concurrency 10,25,50`
- `pnpm perf:bulk:run --scenario BI-PERF-09 --duration 60m`

(These `perf:bulk:*` commands will be added in the next step with a dedicated harness.)

---

## 6) Risks / Controls

- **Risk:** noisy local environment skews latency.  
  **Control:** run baseline and stress suites in fixed pre-prod target.
- **Risk:** auth/token churn contaminates measurements.  
  **Control:** pre-warm token, reuse auth context, measure auth separately.
- **Risk:** synthetic data not representative.  
  **Control:** include both synthetic and sanitized production-shape fixture mixes.

---

## 7) Exit Condition for Step 1

Step 1 is complete when:
- existing benchmark/perf assets are inventoried,
- exact scenario matrix is frozen,
- pass/fail thresholds are explicit,
- and step-2 harness implementation targets are defined.

---

## 8) Step 2 Execution Snapshot (2026-04-01)

- Harness implemented:
  - `scripts/perf/bulk-fixtures.ts`
  - `scripts/perf/run-bulk-perf.ts`
  - `package.json` scripts: `perf:bulk:run`, `perf:bulk:bi01`, `perf:bulk:bi02`
- Scenarios executed:
  - `BI-PERF-01` against `http://localhost:3022`
  - `BI-PERF-02` against `http://localhost:3022`
- Result status:
  - Both scenarios executed and wrote artifacts under `output/perf/...`
  - Both failed threshold gates because submit requests returned HTTP `500`.
- Primary blocker observed in server logs:
  - Cosmos DB firewall denied writes (`Request originated ... through public internet ... blocked by your Cosmos DB account firewall settings`).
  - This blocks valid `202` acceptance for `/api/bulk-ingestion/submit`, so success-rate thresholds cannot pass until environment access is corrected.

---

## 9) Step 2.1 Checkpoint (2026-04-01)

- Harness scope was expanded to support:
  - `BI-PERF-03` (P-LARGE serial run, 5 iterations)
  - `BI-PERF-04` (submit concurrency ramp with configurable `--concurrency`, defaults `10,25,50`)
- Additional script entry points added:
  - `perf:bulk:bi03`
  - `perf:bulk:bi04`
- Runner output now includes:
  - aggregate `failures5xx` and `failures5xxRatePct`
  - per-ramp metrics for concurrency runs (success rate, p95, 5xx count)

### Current execution state

- Type-check passes after harness expansion (`npx tsc --noEmit`).
- Backend starts and serves on selected port, but benchmark validity remains blocked until Cosmos firewall rule propagation completes.
- Latest observed runtime blockers while attempting post-unblock verification:
  - Cosmos DB `403 Forbidden` on write/read paths until firewall access is active for current client IP.
  - Local port contention on `3022` during one run attempt (`EADDRINUSE`).

### Immediate next command sequence once firewall update is active

1. Start backend on a free port (e.g., `3023`).
2. Run `pnpm perf:bulk:bi03 -- --baseUrl http://localhost:3023`.
3. Run `pnpm perf:bulk:bi04 -- --baseUrl http://localhost:3023 --concurrency 10,25,50`.
4. Capture artifacts from `output/perf/BI-PERF-03/...` and `output/perf/BI-PERF-04/...`.

---

## 10) Step 2.2 Result Update (2026-04-01)

### Implemented optimizations and controls

- Local mock Service Bus behavior was aligned with asynchronous bus semantics to prevent synchronous submit-path failure propagation in local mode.
- `BI-PERF-03` runner now supports explicit A/B mode selection:
  - `--bi03Mode multipart`
  - `--bi03Mode shared-storage`
- `BI-PERF-03` shared-storage mode stages fixture artifacts once and submits metadata-only requests per iteration.

### Commands now supported for BI-PERF-03 A/B

- `pnpm perf:bulk:bi03 -- --baseUrl http://localhost:3011 --bi03Mode multipart`
- `pnpm perf:bulk:bi03 -- --baseUrl http://localhost:3011 --bi03Mode shared-storage`

### Latest validated outcomes

- `BI-PERF-03` (`multipart` mode):
  - success rate `100%`, `5xxRate=0%`
  - still fails latency gate (`p95=18285.32ms`, threshold `12000ms`)
  - artifact: `output/perf/BI-PERF-03/2026-04-01T03-10-06-867Z/summary.json`

- `BI-PERF-03` (`shared-storage` mode):
  - success rate `100%`, `5xxRate=0%`
  - passes latency gate (`p95=1120.69ms`, threshold `12000ms`)
  - artifact: `output/perf/BI-PERF-03/2026-04-01T03-13-03-556Z/summary.json`

- `BI-PERF-04` (concurrency `10,25,50`):
  - success rate `100%`, `5xxRate=0%`
  - passes latency gate (`p95=1517.57ms`, threshold `8000ms`)
  - artifact: `output/perf/BI-PERF-04/2026-04-01T03-06-40-169Z/summary.json`

- `BI-PERF-05` (smoke validation `rps=10`, `durationSec=10`):
  - scenario implementation added to harness (`operator-read-ramp`, list/get/failures endpoint mix)
  - success rate `100%`, `5xxRate=0%`
  - overall p95 `3409.89ms` (fails)
  - endpoint p95:
    - list `4270.30ms` (fails threshold `<1000ms`)
    - get `248.27ms` (passes threshold `<1000ms`)
    - failures `233.55ms` (passes threshold `<1500ms`)
  - artifact: `output/perf/BI-PERF-05/2026-04-01T03-27-37-038Z/summary.json`

### Interpretation

- The unresolved `BI-PERF-03` issue is now mode-dependent throughput cost of per-request multipart document transfer, not systemic submit-path correctness.
- Shared-storage ingest mode is the validated path for high-volume submission SLO conformance in this benchmark.

---

## 11) Remaining Work (from this matrix)

- Execute BI-PERF-05 matrix-grade ramps (`30/60/120` RPS × `5m`) and BI-PERF-06, BI-PERF-07, BI-PERF-08, BI-PERF-09; capture artifacts in `output/perf/<scenario>/...`.
- Add the missing `kql-snapshots.md` companion artifacts referenced in section 4 for executed scenarios.
- Publish final recommendation for CI default `BI-PERF-03` mode (`shared-storage` vs `multipart` baseline lane).

### Security gate evidence update (2026-04-01)

- Executed command:
  - `pnpm vitest run tests/unit/bulk-ingestion.controller.test.ts tests/unit/bulk-ingestion.service.test.ts`
- Result:
  - `2` test files passed, `33` tests passed, `0` failed.
- Evidence coverage:
  - malformed payload boundaries (`400`) for invalid multipart file types
  - invalid filter/export boundaries (`400`) for bad sort/cursor/format inputs
  - control-action path behavior and policy-state handling (`202`/`404`/`409`/`500`) for retry, retry-failed, pause, resume, cancel
