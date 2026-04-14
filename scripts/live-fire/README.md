# Axiom Live-Fire Test Pack

These scripts run against a live backend deployment and exercise real Axiom integration paths end-to-end.

For a permanent staging setup + troubleshooting guide (Entra auth wiring, error-code triage, and recovery steps), see:

- `scripts/live-fire/STAGING_RUNBOOK.md`

## Scripts

- `axiom-live-fire-property-intake.ts`
  - `POST /api/axiom/property/enrich`
  - `GET /api/axiom/property/enrichment/:orderId`
  - `POST /api/axiom/scoring/complexity`
  - `GET /api/axiom/scoring/complexity/:orderId`

- `axiom-live-fire-document-flow.ts`
  - `POST /api/axiom/documents`
  - `GET /api/axiom/evaluations/:evaluationId`
  - `GET /api/axiom/evaluations/order/:orderId`
  - `POST /api/axiom/documents/compare`
  - `GET /api/axiom/comparisons/:comparisonId` (when returned)

- `axiom-live-fire-analyze-and-webhook.ts`
  - `POST /api/axiom/analyze`
  - `GET /api/axiom/evaluations/order/:orderId` (poll)
  - `POST /api/axiom/webhook` unsigned (expects `401` if webhook secret configured, else `200`)
  - `POST /api/axiom/webhook` signed (when `AXIOM_LIVE_WEBHOOK_SECRET` is provided)

- `axiom-live-fire-bulk-submit.ts`
  - `POST /api/bulk-ingestion/submit` (multipart `CSV + PDF`)
  - `GET /api/bulk-ingestion/:jobId` (poll)
  - Validates live submission + job persistence path for engagement/order + related document intake

- `axiom-live-fire-preflight-probe.ts`
  - `GET /api/orders` (paged)
  - `GET /api/documents?orderId=...`
  - Finds first order/document pair where document has `id` and `blobPath/blobUrl`
  - Prints ready-to-run export commands for `AXIOM_LIVE_ORDER_ID`, `AXIOM_LIVE_DOCUMENT_ID`, `AXIOM_LIVE_CLIENT_ID`

- `axiom-live-fire-ui-parity.ts`
  - Mode `extraction`: `POST /api/runs/extraction` + `POST /api/runs/:runId/refresh-status` + `GET /api/runs/:runId/snapshot`
  - Mode `criteria`: `POST /api/runs/criteria` + run/step polling + `GET /api/runs/:stepRunId/step-input`
  - Mode `full`: `POST /api/axiom/analyze` + `GET /api/axiom/evaluations/order/:orderId` polling
  - Purpose: backend-only UI-parity validation to isolate UI issues from pipeline/engine issues

- `axiom-live-fire-aegis-connect.ts`
  - Mode: direct Axiom API connectivity probe with Aegis-enforced auth
  - Purpose: acquire a real Entra JWT (`az account get-access-token --resource api://3bc96929-593c-4f35-8997-e341a7e09a69`) and verify headers (`Authorization`, `X-Client-Id`, optional `X-Sub-Client-Id`) against Axiom endpoint

- `axiom-live-fire-sse-full-round-trip.ts`  ← **pnpm axiom:livefire:sse-round-trip**
  - `POST /api/analysis/submissions` — exact UI submission path
  - `GET /api/axiom/evaluations/order/:orderId/stream` — live SSE stream (runs concurrently with poll)
  - `GET /api/analysis/submissions/:submissionId` — poll until terminal status
  - `GET /api/axiom/evaluations/:evaluationId` — full evaluation payload (not truncated)
  - `POST /api/axiom/webhook` — unsigned + signed (when `AXIOM_LIVE_WEBHOOK_SECRET` set)
  - Purpose: full round-trip mimicking exact UI flow with real-time SSE monitoring and complete response logging
  - Extra env: `AXIOM_LIVE_EVALUATION_MODE` (default `COMPLETE_EVALUATION`), `AXIOM_LIVE_SSE_TIMEOUT_MS` (default `120000`)

- `axiom-live-fire-analyze-with-sse.ts`  ← **pnpm axiom:livefire:analyze-with-sse**
  - `POST /api/axiom/analyze` — legacy analyze path
  - `GET /api/axiom/evaluations/:evaluationId` — immediate check after submit
  - `GET /api/axiom/evaluations/order/:orderId/stream` — SSE stream (runs concurrently with order-list poll)
  - `GET /api/axiom/evaluations/order/:orderId` — poll for evaluation in order list
  - `GET /api/axiom/evaluations/:evaluationId` — poll to completed, full payload logged
  - `POST /api/axiom/webhook` — unsigned + signed (when `AXIOM_LIVE_WEBHOOK_SECRET` set)
  - Purpose: legacy analyze path with concurrent SSE, order-list polling, full response logging, and webhook round-trip
  - Extra env: `AXIOM_LIVE_SSE_TIMEOUT_MS` (default `120000`)

## Required environment

Set these for all scripts:

- `AXIOM_LIVE_BASE_URL` (example: `https://staging-api.example.com`)
- `AXIOM_LIVE_TENANT_ID`
- `AXIOM_LIVE_CLIENT_ID`
- Auth (choose one):
  - `AXIOM_LIVE_BEARER_TOKEN`, or
  - `AXIOM_LIVE_USE_DEVICE_CODE=true` (delegated-user login via MSAL device code), or
  - `AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true` (uses Azure `DefaultAzureCredential`), or
  - `AXIOM_LIVE_TEST_JWT_SECRET` (for dev/test envs that accept test JWTs)

If using `AXIOM_LIVE_USE_DEVICE_CODE=true`, also set:

- `AXIOM_LIVE_DEVICE_CODE_CLIENT_ID` (Azure app registration client ID for interactive login)
- `AXIOM_LIVE_DEVICE_CODE_TENANT_ID` (or `AZURE_TENANT_ID`)

If using `AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true`, also set one of:

- `AXIOM_LIVE_TOKEN_SCOPE` (full scope string, e.g. `api://<api-client-id>/.default`), or
- `AXIOM_LIVE_AUDIENCE_CLIENT_ID` (scope auto-derived as `api://<id>/.default`), or
- `AZURE_API_CLIENT_ID` (same auto-derivation fallback)

Both `AXIOM_LIVE_USE_DEVICE_CODE=true` and `AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true` cannot be enabled together.

### Token cache (device-code/default-credential)

To avoid interactive login on every run, delegated/device-code and default-credential modes use a local token cache by default.

- Default cache file: `scripts/live-fire/.livefire-token-cache.json`
- Reuse policy: token is reused until near expiry (with safety skew)

Optional cache controls:

- `AXIOM_LIVE_TOKEN_CACHE_FILE` (absolute or workspace-relative path)
- `AXIOM_LIVE_TOKEN_CACHE_SKEW_SECONDS` (default `120`)
- `AXIOM_LIVE_DISABLE_TOKEN_CACHE=true` (forces fresh token acquisition every run)

Script-specific required values:

### Property intake

- `AXIOM_LIVE_ORDER_ID`
- `AXIOM_LIVE_PROPERTY_ADDRESS`
- `AXIOM_LIVE_PROPERTY_CITY`
- `AXIOM_LIVE_PROPERTY_STATE`
- `AXIOM_LIVE_PROPERTY_ZIP`

### Document flow

- `AXIOM_LIVE_ORDER_ID`
- `AXIOM_LIVE_DOCUMENT_URL`
- `AXIOM_LIVE_REVISED_DOCUMENT_URL`

### Analyze + webhook

- `AXIOM_LIVE_ORDER_ID`
- `AXIOM_LIVE_DOCUMENT_ID` (must exist in backend `documents` collection for that tenant)
- Optional: `AXIOM_LIVE_WEBHOOK_SECRET` (enables signed webhook acceptance check)

### Bulk submit

- `AXIOM_LIVE_BULK_ADAPTER_KEY`
- `AXIOM_LIVE_ANALYSIS_TYPE` (`AVM`, `FRAUD`, `ANALYSIS_1033`, `QUICK_REVIEW`, `DVR`, or `ROV`)

### UI parity harness (`axiom-live-fire-ui-parity.ts`)

All modes:

- `AXIOM_LIVE_PARITY_MODE` = `extraction` | `criteria` | `full` (or pass `--mode`)

### Direct Aegis connect probe (`axiom-live-fire-aegis-connect.ts`)

Required:

- `AXIOM_AEGIS_CLIENT_ID` (business client id sent as `X-Client-Id`)

Optional:

- `AXIOM_AEGIS_SUB_CLIENT_ID` (sent as `X-Sub-Client-Id`)
- `AXIOM_AEGIS_BASE_URL` (default `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`)
- `AXIOM_AEGIS_RESOURCE` (default `api://3bc96929-593c-4f35-8997-e341a7e09a69`)
- `AXIOM_AEGIS_ENDPOINT` (default `/api/health`)
- `AXIOM_AEGIS_AZ_PATH` (optional explicit Azure CLI path, e.g. `C:\\Program Files (x86)\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd`)
- `AXIOM_AEGIS_CHECK_ROLE_ENDPOINT` (default `true`)
- `AXIOM_AEGIS_ROLE_ENDPOINT` (default `/api/virtual-actors`)

Example (PowerShell):

```powershell
$env:AXIOM_AEGIS_CLIENT_ID='live-fire-test'
$env:AXIOM_AEGIS_SUB_CLIENT_ID='test-tenant'
pnpm axiom:livefire:aegis-connect
```

Extraction mode (`extraction`):

- `AXIOM_LIVE_DOCUMENT_ID`
- Optional:
  - `AXIOM_LIVE_SCHEMA_CLIENT_ID` (defaults to `AXIOM_LIVE_CLIENT_ID`)
  - `AXIOM_LIVE_SCHEMA_SUB_CLIENT_ID` (default `default-sub-client`)
  - `AXIOM_LIVE_SCHEMA_DOCUMENT_TYPE` (defaults to `AXIOM_LIVE_DOCUMENT_TYPE`, then `APPRAISAL`)
  - `AXIOM_LIVE_SCHEMA_VERSION` (default `1.0.0`)
  - `AXIOM_LIVE_RUN_REASON` (default `LIVE_FIRE_EXTRACTION_ONLY`)

Criteria mode (`criteria`):

- `AXIOM_LIVE_PROGRAM_ID`
- One of:
  - `AXIOM_LIVE_SNAPSHOT_ID`, or
  - `AXIOM_LIVE_EXTRACTION_RUN_ID` (snapshot inferred from run linkage)
- Optional:
  - `AXIOM_LIVE_PROGRAM_CLIENT_ID` (defaults to `AXIOM_LIVE_CLIENT_ID`)
  - `AXIOM_LIVE_PROGRAM_SUB_CLIENT_ID` (default `default-sub-client`)
  - `AXIOM_LIVE_PROGRAM_VERSION` (default `1.0.0`)
  - `AXIOM_LIVE_CRITERIA_RUN_MODE` (`FULL` or `STEP_ONLY`, default `FULL`)
  - `AXIOM_LIVE_CRITERIA_STEP_KEYS` (comma-delimited, default `overall-criteria`)
  - `AXIOM_LIVE_RERUN_REASON` (default `LIVE_FIRE_CRITERIA_ONLY`)

Full mode (`full`, mirrors submit-from-document journey):

- `AXIOM_LIVE_DOCUMENT_ID`
- `AXIOM_LIVE_ORDER_ID`
- Optional:
  - `AXIOM_LIVE_DOCUMENT_TYPE` (default `appraisal`)

Optional poll tuning for all scripts:

- `AXIOM_LIVE_POLL_ATTEMPTS` (default `20`)
- `AXIOM_LIVE_POLL_INTERVAL_MS` (default `3000`)

Optional preflight tuning:

- `AXIOM_LIVE_PREFLIGHT_ORDER_LIMIT` (default `50`)
- `AXIOM_LIVE_PREFLIGHT_MAX_SCAN` (default `200`)

## Commands

- `pnpm axiom:livefire:property-intake`
- `pnpm axiom:livefire:document-flow`
- `pnpm axiom:livefire:analyze-webhook`
- `pnpm axiom:livefire:bulk-submit`
- `pnpm axiom:livefire:preflight`
- `pnpm axiom:livefire:ui-parity -- --mode extraction`
- `pnpm axiom:livefire:ui-parity -- --mode criteria`
- `pnpm axiom:livefire:ui-parity -- --mode full`
- `pnpm axiom:livefire:remote-suite`
- `pnpm axiom:livefire:verify-local-remote -- <flow>`

### Full remote-first suite

`pnpm axiom:livefire:remote-suite` performs:

1. Deployed env validation via `GET /api/health/services` for required Axiom runtime env:
  - `AXIOM_API_BASE_URL`
  - `API_BASE_URL`
  - `AXIOM_WEBHOOK_SECRET`
  - `STORAGE_CONTAINER_DOCUMENTS`
2. Live-fire input prerequisite checks (order/document/property vars)
3. Sequential execution of:
  - `axiom:livefire:preflight`
  - `axiom:livefire:property-intake`
  - `axiom:livefire:document-flow`
  - `axiom:livefire:analyze-webhook`

If health endpoints are protected in deployed environments, set:

- `AXIOM_LIVE_HEALTH_API_KEY`

### Remote-first verification wrapper

By default, the wrapper runs against remote/deployed only (no local run).
Use `--include-local` (or `AXIOM_VERIFY_INCLUDE_LOCAL=true`) to run local first, then remote.

- Required:
  - `AXIOM_VERIFY_REMOTE_BASE_URL`
- Optional:
  - `AXIOM_VERIFY_LOCAL_BASE_URL` (default `http://localhost:3011`)
  - `AXIOM_VERIFY_FLOW` (if not passed as CLI arg)
  - `AXIOM_VERIFY_INCLUDE_LOCAL=true` (opt-in local + remote sequence)

Per-target overrides are supported via env prefixes and mapped into `AXIOM_LIVE_*` for each run:

- `AXIOM_LOCAL_<NAME>` → `AXIOM_LIVE_<NAME>` for local run
- `AXIOM_REMOTE_<NAME>` → `AXIOM_LIVE_<NAME>` for remote run

Example (PowerShell):

```powershell
$env:AXIOM_VERIFY_REMOTE_BASE_URL='https://ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io'
$env:AXIOM_LIVE_TENANT_ID='885097ba-35ea-48db-be7a-a0aa7ff451bd'
$env:AXIOM_LIVE_CLIENT_ID='statebridge'

# Local uses test JWT mode
$env:AXIOM_LOCAL_TEST_JWT_SECRET='<local-test-jwt-secret>'

# Remote uses device-code delegated login
$env:AXIOM_REMOTE_USE_DEVICE_CODE='true'
$env:AXIOM_REMOTE_DEVICE_CODE_CLIENT_ID='ee1cad4a-3049-409d-96e4-70c73fad2139'
$env:AXIOM_REMOTE_DEVICE_CODE_TENANT_ID='885097ba-35ea-48db-be7a-a0aa7ff451bd'
$env:AXIOM_REMOTE_AUDIENCE_CLIENT_ID='dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a'

# Remote only (default)
pnpm axiom:livefire:verify-local-remote -- property-intake

# Local first, then remote
pnpm axiom:livefire:verify-local-remote -- property-intake --include-local
```

## Notes

- These are intentionally strict and fail-fast; they do not fall back to hidden defaults for critical config.
- Use unique `AXIOM_LIVE_ORDER_ID` values for isolated runs.
- For non-production environments without Axiom webhook secret configured, unsigned webhook checks return `200` by design.
