# Bulk Ingestion Operations Runbook

## Scope
Runbook for operating bulk-ingestion pipelines and associated Axiom bulk-submission DLQ workflows.

## Components
- API endpoints:
  - `GET /api/bulk-ingestion`
  - `GET /api/bulk-ingestion/:jobId`
  - `GET /api/bulk-ingestion/:jobId/failures`
  - `GET /api/bulk-ingestion/:jobId/failures/export?format=csv|xlsx`
  - `GET /api/axiom/bulk-submission/metrics`
  - `GET /api/axiom/bulk-submission/dlq`
  - `POST /api/axiom/bulk-submission/dlq/:eventId/replay`

## SLO Targets (Operational)
- **Processing success SLO:** >= 99.5% non-systemic completion rate
- **Latency SLO:** P95 bulk-ingestion completion under 10 minutes for standard-size jobs
- **DLQ pressure:** OPEN DLQ should trend to zero under normal operations

## Dashboarding
- App Insights workbook spec: [observability/BULK_INGESTION_APP_INSIGHTS_WORKBOOK_SPEC.md](observability/BULK_INGESTION_APP_INSIGHTS_WORKBOOK_SPEC.md)
- KQL query pack: [observability/bulk-ingestion-observability.kql](observability/bulk-ingestion-observability.kql)
- UI ops page (control panel): `admin/bulk-ingestion-ops`

## Daily Checks
1. Confirm ingestion error-rate trend is stable.
2. Confirm P95 latency remains below threshold.
3. Confirm OPEN DLQ count is not accumulating.
4. Verify replay success rate remains healthy.

## Incident Response
1. **Detect impact**
   - Review workbook overview and failure trend panels.
   - Check `GET /api/axiom/bulk-submission/metrics` and `GET /api/axiom/bulk-submission/dlq?status=OPEN`.
2. **Triage failures**
   - Use `GET /api/bulk-ingestion/:jobId/failures` for filterable diagnosis.
   - Use CSV/XLSX exports for offline triage if needed.
3. **Remediate**
   - Replay affected DLQ events by event ID.
   - Retry item/job failures through bulk-ingestion operator controls.
4. **Validate recovery**
   - OPEN DLQ count drops.
   - Replay failures stop increasing.
   - Affected jobs move to expected terminal states.

## Escalation Conditions
Escalate to on-call if any are true:
- Ingestion error rate spikes and persists > 15 minutes
- P95 latency breaches SLO for > 30 minutes
- OPEN DLQ continuously increases over 3 polling intervals
- Replay failures continue for same source event after dependency recovery

## Notes
- Keep runbook and KQL in sync when adding new stage names, failure codes, or telemetry dimensions.

## Performance Harness Notes (BI-PERF-03)

`BI-PERF-03` now has explicit benchmark modes for A/B comparison:

- `multipart` mode
   - exercises repeated data+document multipart upload per submit request
   - useful as stress/baseline for transfer-heavy intake
- `shared-storage` mode
   - stages artifacts once, then submits metadata-only references
   - validated to meet current submit latency threshold for P-LARGE profile

Runner examples:

- `pnpm perf:bulk:bi03 -- --baseUrl http://localhost:3011 --bi03Mode multipart`
- `pnpm perf:bulk:bi03 -- --baseUrl http://localhost:3011 --bi03Mode shared-storage`

Operationally expected log behavior in `shared-storage` mode:

- Background worker logs show document copy uploads to job-scoped `.../copied/document/...` paths.
- High log volume is expected for large profiles (e.g., 500 docs per job) and is not by itself an error condition.
