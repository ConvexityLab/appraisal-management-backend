# Bulk Ingestion Operations Runbook

## Scope
Runbook for operating bulk-ingestion pipelines and associated Axiom bulk-submission DLQ workflows.

## Components
- API endpoints:
  - `GET /api/bulk-ingestion`
  - `GET /api/bulk-ingestion/:jobId`
  - `GET /api/bulk-ingestion/:jobId/failures`
  - `GET /api/bulk-ingestion/:jobId/failures/export?format=csv|xlsx`
   - `GET /api/bulk-adapter-definitions`
   - `GET /api/bulk-adapter-definitions/:adapterKey`
   - `POST /api/bulk-adapter-definitions`
   - `PUT /api/bulk-adapter-definitions/:adapterKey`
   - `DELETE /api/bulk-adapter-definitions/:adapterKey`
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

## Criteria Stage Configuration

### Required deployment flag
- `BULK_INGESTION_ENABLE_CRITERIA_STAGE=true`

This flag must be enabled in deployed environments so the bulk-ingestion criteria worker
evaluates each extracted item, stamps the per-item criteria outcome, emits
`bulk.ingestion.criteria.completed`, and allows the finalizer to advance jobs to terminal state.

### Minimum criteria rule set
At minimum, each tenant should have a `bulk-ingestion-criteria-config` document with rules equivalent to:

1. `loanNumber exists` → fail as `FAILED`
2. `loanAmount >= 50000` → fail as `FAILED`
3. `loanAmount <= 5000000` → fail as `REVIEW`
4. `propertyType in ['SFR', 'CONDO', 'PUD', '2-4 UNIT', 'MANUFACTURED']` → fail as `FAILED`

The local/dev seed source of truth is:
- [scripts/seed-bulk-ingestion-criteria-config.mjs](scripts/seed-bulk-ingestion-criteria-config.mjs)

## Adapter Registry Operations

Bulk canonicalization now resolves adapter behavior from the tenant-scoped bulk adapter definition registry.

- Built-in adapters are always available.
- Tenant-created definitions are stored in the `bulk-portfolio-jobs` container with `type = 'bulk-adapter-definition'`.
- Tenant definitions override built-ins when the `adapterKey` matches exactly.
- Prefix-mode adapters match both the exact key and suffixed variants like `statebridge-<runId>`.

### Built-in adapter field expectations

| Adapter | Match | Document required | Minimum row fields | Canonical fields copied |
|---|---|---|---|---|
| `bridge-standard` | exact | yes | `loanNumber` or `externalId` | `correlationKey`, `loanNumber`, `externalId`, `propertyAddress`, `dataFileBlobName` |
| `statebridge` | prefix | yes | `loanNumber` or `externalId` | `correlationKey`, `loanNumber`, `externalId`, `propertyAddress`, `dataFileBlobName` |
| `bpo-report-v1` | exact | yes | none beyond mapped document | `correlationKey`, `propertyAddress`, `externalId`, static `bpoDocumentType=BPO_REPORT` |
| `tape-conversion-v1` | exact | no | `propertyAddress` and (`loanNumber` or `externalId`) | `correlationKey`, `loanNumber`, `externalId`, `propertyAddress`, `city`, `state`, `zipCode` |
| `generic-appraisal-v1` | exact | yes | `propertyAddress` and (`loanNumber` or `externalId`) | `correlationKey`, `loanNumber`, `externalId`, `propertyAddress`, `city`, `state`, `zipCode`, `dataFileBlobName` |
| `fnma-1004-v1` | exact | yes | `propertyAddress` and (`loanNumber` or `externalId`) | `correlationKey`, `loanNumber`, `externalId`, `propertyAddress`, `city`, `state`, `zipCode`, `propertyType`, `loanAmount`, `loanPurpose`, `occupancyType`, `dataFileBlobName`, static `appraisalForm=FNMA_1004` |
| `residential-bpo-v2` | exact | yes | `propertyAddress` | `correlationKey`, `propertyAddress`, `externalId`, `city`, `state`, `zipCode`, static `bpoDocumentType=RESIDENTIAL_BPO` |

### CRUD payload guidance

Each tenant-defined adapter definition must provide:

- `adapterKey`
- `name`
- `matchMode` (`EXACT` or `PREFIX`)
- `sourceAdapter`
- at least one `canonicalFieldMappings` entry

Optional validation sections:

- `requiredFields[]` for single mandatory fields
- `requiredAnyOf[]` for “one-of-many” identity requirements
- `documentRequirement` when a mapped PDF/blob is mandatory
- `staticCanonicalData` for adapter-specific fixed fields

Do not rely on implicit defaults. If an adapter needs a document, address, or identifier, encode that explicitly in the definition.

Do not enable `BULK_INGESTION_SKIP_BLOB_COPY` in deployed environments. That flag is for local/dev-only smoke workflows.

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
