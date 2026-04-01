# Axiom Bulk Submission Runbook

## Scope
This runbook covers production operations for the `axiom.bulk-evaluation.requested` background submission pipeline.

Related operational artifacts:
- Bulk ingestion operations runbook: `docs/BULK_INGESTION_OPERATIONS_RUNBOOK.md`
- App Insights workbook spec: `docs/observability/BULK_INGESTION_APP_INSIGHTS_WORKBOOK_SPEC.md`
- KQL query pack: `docs/observability/bulk-ingestion-observability.kql`

## Components
- Consumer: `AxiomBulkSubmissionService`
- Event topic: `axiom.bulk-evaluation.requested`
- Primary job container: `bulk-portfolio-jobs`
- Operational artifacts:
  - Receipt: `type = axiom-bulk-submission-receipt`
  - Submission lock: `type = axiom-bulk-submission-lock`
  - DLQ record: `type = axiom-bulk-submission-dlq`
  - Metrics record: `type = axiom-bulk-submission-metrics`

## Key Behaviors
- Replay-safe intake: duplicate event IDs are dropped via immutable receipts.
- Per-job idempotency: only one in-progress submission per `(tenantId, jobId)` lock.
- Failures are durable: failed submissions create DLQ records.
- Alerts:
  - Emits `system.alert` events (`alertType = AXIOM_BULK_SUBMISSION`).
  - Optional webhook alert if `AXIOM_BULK_ALERT_WEBHOOK_URL` is set.

## Operational Endpoints
- Metrics: `GET /api/axiom/bulk-submission/metrics`
- DLQ replay: `POST /api/axiom/bulk-submission/dlq/{eventId}/replay`

## Metrics Dictionary
The metrics document stores cumulative counters:
- `eventsReceived`
- `eventsReplaySkipped`
- `eventsDuplicateSkipped`
- `submissionsSucceeded`
- `submissionsFailed`
- `dlqCreated`
- `replayAttempts`
- `replaySucceeded`
- `replayFailed`
- `alertsSent`
- `alertFailures`

## Incident Response
1. Identify impact
   - Check `GET /api/axiom/bulk-submission/metrics` for `submissionsFailed`, `dlqCreated`, `replayFailed`.
2. Locate failed submission
   - Query `bulk-portfolio-jobs` for `type = axiom-bulk-submission-dlq` and `status = OPEN`.
3. Validate root cause
   - Inspect `error`, `eventPayload`, and related job lock (`type = axiom-bulk-submission-lock`).
4. Replay
   - Call `POST /api/axiom/bulk-submission/dlq/{eventId}/replay`.
5. Confirm recovery
   - Verify DLQ status becomes `REPLAYED` and includes `replayResult.pipelineJobId`.
   - Verify corresponding bulk job has `axiomSubmissionStatus = submitted`.

## Failure Patterns
- `already-completed`
  - Safe duplicate; no action required.
- `in-progress-by-another-event`
  - Wait for active owner event completion; investigate lock staleness if persistent.
- Axiom API failure
  - DLQ entry should exist; replay after external dependency is healthy.

## Escalation
Escalate to platform on-call if:
- `dlqCreated` grows continuously for >15 minutes,
- replay attempts fail repeatedly for the same event,
- `alertFailures` increases (indicates degraded alert path).

## Environment
Optional alert webhook:
- `AXIOM_BULK_ALERT_WEBHOOK_URL=https://<your-alert-endpoint>`
