# Bulk Ingestion Plan Review (2026-04-01)

## Purpose
This review reconciles implemented work against the active bulk-ingestion cornerstone + performance matrix plan artifacts.

## Confirmed Implemented

- Bulk submit-path correctness hardening for local execution:
  - submit requests no longer fail from synchronous mock event-dispatch side effects.
- Mixed-flow terminal completion validation executed successfully.
- BI performance harness implemented and extended:
  - BI-PERF-03 (P-LARGE serial)
  - BI-PERF-04 (concurrency ramp)
- BI-PERF-03 explicit A/B mode toggle implemented:
  - `--bi03Mode multipart`
  - `--bi03Mode shared-storage`

## Latest Benchmark Evidence

- BI-PERF-03 `multipart`
  - Success: 100%
  - 5xx rate: 0%
  - p95: 18285.32ms
  - Threshold result: **fail** (latency only)
  - Artifact: `output/perf/BI-PERF-03/2026-04-01T03-10-06-867Z/summary.json`

- BI-PERF-03 `shared-storage`
  - Success: 100%
  - 5xx rate: 0%
  - p95: 1120.69ms
  - Threshold result: **pass**
  - Artifact: `output/perf/BI-PERF-03/2026-04-01T03-13-03-556Z/summary.json`

- BI-PERF-04 (10,25,50)
  - Success: 100%
  - 5xx rate: 0%
  - p95: 1517.57ms
  - Threshold result: **pass**
  - Artifact: `output/perf/BI-PERF-04/2026-04-01T03-06-40-169Z/summary.json`

- BI-PERF-05 (smoke: `rps=10`, `durationSec=10`)
  - Success: 100%
  - 5xx rate: 0%
  - overall p95: 3409.89ms
  - endpoint p95:
    - list: 4270.30ms (**fail**, threshold 1000ms)
    - get: 248.27ms (**pass**, threshold 1000ms)
    - failures: 233.55ms (**pass**, threshold 1500ms)
  - Threshold result: **fail** (list endpoint latency)
  - Artifact: `output/perf/BI-PERF-05/2026-04-01T03-27-37-038Z/summary.json`

## What Is Left (Actionable)

1. Complete remaining matrix scenarios
  - BI-PERF-05 matrix-grade execution (`30/60/120` RPS, `5m` each).
  - BI-PERF-06, BI-PERF-07, BI-PERF-08, BI-PERF-09.
  - Current harness implementation status (code-verified):
   - Implemented in `scripts/perf/run-bulk-perf.ts`: BI-PERF-01 through BI-PERF-05 only.
   - Not yet implemented in runner: BI-PERF-06 through BI-PERF-09 execution paths.

2. Produce missing evidence artifacts
   - `kql-snapshots.md` per executed scenario run directory per matrix requirements.
  - Current runner writes `summary.json` and `raw.csv` only; no automatic `kql-snapshots.md` generation yet.

3. CI/Release policy decision
   - Decide and document default BI-PERF-03 lane mode in automated gates:
     - `shared-storage` for SLA conformance lane.
     - optional `multipart` as stress/baseline lane.

4. Axiom live-test readiness and first connection (highest priority)
  - Runtime/env preconditions (required before live calls):
    - `AXIOM_API_BASE_URL`
    - `API_BASE_URL` (publicly reachable by Axiom for webhook callbacks)
    - `AXIOM_WEBHOOK_SECRET`
    - `STORAGE_CONTAINER_DOCUMENTS`
    - `AXIOM_API_KEY` when target Axiom environment requires auth
  - Connection validation gates:
    - Service health must show Axiom configuration `healthy` (not `degraded`).
    - Backend must receive signed webhook on `/api/axiom/webhook` and pass HMAC verification.
    - One real pipeline submission must complete end-to-end (`submit` -> SSE/observe events -> webhook -> persisted result).

## Axiom Fast-Track Plan (to begin live testing ASAP)

1. Enable live mode (disable mock fallback path)
  - Set `AXIOM_API_BASE_URL` and required webhook/runtime vars in the backend runtime.
  - Ensure `API_BASE_URL` is externally reachable from Axiom (tunnel or deployed endpoint) for webhook delivery.

2. Run configuration preflight
  - Execute backend health check (`pnpm health-check`) and confirm Axiom config is `healthy` with no missing env vars.

3. Prove webhook trust chain
  - Send/receive one signed webhook event and confirm `verifyAxiomWebhook` accepts signature.
  - Confirm failure behavior on invalid signature (expected `401`) remains intact.

4. Execute first live E2E submissions
  - Submit one ORDER pipeline and verify terminal result persisted.
  - Submit one BULK_JOB pipeline and verify progress + completion propagation.

5. Capture go-live evidence bundle
  - Persist request/response IDs (`pipelineJobId`, correlation IDs), webhook receipt logs, and resulting records for traceability.
  - Add evidence links to this plan as the live-test checkpoint artifact set.

## Immediate Critical Path

- P0: Axiom runtime env + publicly reachable webhook endpoint.
- P0: First signed webhook pass + one ORDER live pipeline success.
- P1: BULK_JOB live-path verification.
- P1: BI-PERF-05 full matrix (`30/60/120`, `5m`) to establish operator-read baseline under live-connected conditions.
- P2: Implement BI-PERF-06/07/08/09 in harness + add `kql-snapshots.md` generation workflow.

## Today Readiness Deliverables Added (2026-04-01)

- Axiom-side action handoff document created:
  - `current-plan/AXIOM_AI_ASSISTANT_HANDOFF_2026-04-01.md`
- Workspace live-fire submission tooling extended for real intake validation:
  - Script: `scripts/live-fire/axiom-live-fire-bulk-submit.ts`
  - Command: `pnpm axiom:livefire:bulk-submit`
  - Validates `POST /api/bulk-ingestion/submit` + `GET /api/bulk-ingestion/:jobId` live path
- Live-fire docs updated with new command and required env var:
  - `scripts/live-fire/README.md`

## Security Gate Evidence (2026-04-01)

- Command executed:
  - `pnpm vitest run tests/unit/bulk-ingestion.controller.test.ts tests/unit/bulk-ingestion.service.test.ts`
- Result:
  - `2` test files passed, `33` tests passed, `0` failed.
- Covered security/error-boundary controls in evidence:
  - malformed multipart payload rejection (`400`) for invalid `dataFile` and non-PDF `documents`
  - invalid query boundary rejection (`400`) for unsupported sort/cursor/export format
  - control-path enforcement + status semantics (`202`, `404`, `409`, `500`) for retry/pause/resume/cancel
  - tenant/user context propagation assertions on operator actions

## Recommendation
Use `BI-PERF-03 shared-storage` as the required SLO compliance lane, while retaining `multipart` as a comparative stress benchmark for transport-heavy regression visibility.
