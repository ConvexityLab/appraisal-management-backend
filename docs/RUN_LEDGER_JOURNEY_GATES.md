# Run Ledger Journey Gates

This document defines hard release gates for end-to-end run-ledger journey confidence:

1. Data/document input upload
2. Extraction and monitoring
3. Criteria processing and step reruns
4. Results artifact retrieval
5. Results artifact viewing in UI

## Gate 1 — API Contract Coverage

Required checks:
- `POST /api/runs/extraction` accepts valid payload with idempotency headers.
- `POST /api/runs/criteria` creates parent + step run payload shape.
- `POST /api/runs/:runId/refresh-status` contract is stable.
- `GET /api/runs/:runId/snapshot` and `GET /api/runs/:runId/step-input` return typed data/4xx.

## Gate 2 — Backend Unit/Integration Coverage

Required checks:
- Missing idempotency/correlation headers are rejected.
- Invalid run type for step-input retrieval returns `RUN_TYPE_INVALID`.
- Missing step-input slice returns `STEP_INPUT_NOT_FOUND`.
- Criteria run fanout persists step-input refs/evidence refs.

## Gate 3 — Frontend Journey Coverage

Required checks:
- Run details dialog renders canonical snapshot JSON.
- Criteria-step run renders step-input payload JSON and numeric fields.
- Empty/error/loading states render deterministic UX text.

## Gate 4 — Full Suite Gate

Required checks:
- Frontend `pnpm vitest run` passes.
- Backend `pnpm vitest run` passes.

## Gate 5 — Synthetic Canary (Deployed Env)

Use script: `scripts/canary/run-ledger-journey-canary.ts`

Required env vars:
- `CANARY_BASE_URL`
- `CANARY_BEARER_TOKEN`
- `CANARY_ORDER_ID` or `CANARY_ENGAGEMENT_ID`

What it validates:
- `/health` is reachable.
- Run list is retrievable in tenant context.
- Run read endpoint succeeds.
- Snapshot endpoint returns 200 or typed 404 (never 5xx).
- Step-input endpoint for criteria-step returns 200 or typed 404 (never 5xx).

## Release Checklist

- [ ] API contract gate green
- [ ] Backend unit/integration gate green
- [ ] Frontend run artifact gate green
- [ ] Full frontend suite green
- [ ] Full backend suite green
- [ ] Canary pass in staging/prod
