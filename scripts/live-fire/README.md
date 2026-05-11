# Axiom Live-Fire Test Pack

These scripts run against a live backend deployment and exercise real Axiom integration paths end-to-end.

For a permanent staging setup + troubleshooting guide (Entra auth wiring, error-code triage, and recovery steps), see:

- `scripts/live-fire/STAGING_RUNBOOK.md`

## v2-only

As of the 2026-05-07 Axiom proxy migration, every live-fire script exercises
the v2 surface (`/api/axiom/scopes/...`) or feature-specific surfaces (property
enrichment, complexity scoring, bulk submission, review programs, analysis
submissions). The legacy `/analyze`, `/criteria/evaluate`, `/evaluations/:id`,
`/evaluations/order/:orderId`, and `/evaluations/order/:orderId/stream` routes
have been **retired on the backend** — the scripts that exercised them
(`document-flow`, `analyze-webhook`, `analyze-with-sse`, `sse-round-trip`)
have been deleted along with their npm scripts. Mixed scripts
(`canonical-suite`, `ui-parity`) have had their legacy sections removed.

## Scripts

- `axiom-live-fire-property-intake.ts`
  - `POST /api/axiom/property/enrich`
  - `GET /api/axiom/property/enrichment/:orderId`
  - `POST /api/axiom/scoring/complexity`
  - `GET /api/axiom/scoring/complexity/:orderId`

- `axiom-live-fire-bulk-submit.ts`
  - `POST /api/bulk-ingestion/submit` (multipart `CSV + PDF`)
  - `GET /api/bulk-ingestion/:jobId` (poll)
  - `GET /api/bulk-ingestion?clientId=...` (client-facing job list)
  - `GET /api/bulk-ingestion/:jobId/failures` (client-facing failure grid)
  - `GET /api/bulk-ingestion/:jobId/failures/export` (client-facing export path)
  - Validates live submission + job persistence path for engagement/order + related document intake

- `integration-live-fire-aim-port.ts`  ← **pnpm integration:livefire:aim-port**
  - `POST /api/v1/integrations/aim-port/inbound`
  - `GET /api/orders/:orderId`
  - Verifies the real AIM-Port adapter/auth/ack path, then confirms the returned internal `order_id` is readable through the authenticated orders API with the expected `metadata.vendorIntegration` linkage
  - Purpose: live-fire partner/client endpoint coverage for inbound vendor integrations

- `integration-live-fire-class-valuation.ts`  ← **pnpm integration:livefire:class-valuation**
  - `POST /api/v1/integrations/class-valuation/inbound`
  - Verifies the real Class Valuation webhook auth/normalize/ack path, including HMAC signature handling plus `X-Vendor-Type`, `X-Vendor-Connection-Id`, and normalized-event-count response headers
  - Purpose: live-fire partner/client endpoint coverage for Class Valuation inbound webhooks

- `axiom-live-fire-preflight-probe.ts`
  - `GET /api/orders` (paged)
  - `GET /api/documents?orderId=...`
  - Finds first order/document pair where document has `id` and `blobPath/blobUrl`
  - Prints ready-to-run export commands for `AXIOM_LIVE_ORDER_ID`, `AXIOM_LIVE_DOCUMENT_ID`, `AXIOM_LIVE_CLIENT_ID`

- `verify-authz-test-profile.ts`  ← **pnpm axiom:livefire:authz-profile**
  - `GET /api/authz-test/profile`
  - Requires a real delegated token for a seeded staging/prod user
  - Verifies token subject matches `scripts/user-identities.json` and, for staging, `seed-staging-users.ts`
  - Asserts response `user.id`, `user.email`, `user.role`, and `interpretation.can_view_all`

- `axiom-live-fire-canonical-suite.ts`  ← **pnpm axiom:livefire:canonical-suite**
  - `POST /api/analysis/submissions` — exact current UI submit contract
  - `GET /api/documents/stream/:executionId` — exact upload-zone live tracker stream
  - `GET /api/analysis/submissions/:submissionId` — submission status polling
  - `GET /api/axiom/scopes/:scopeId/results?programId=…` — current `AxiomInsightsPanel` data source (v2)
  - `GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history` — current criterion-history drawer surface (v2)
  - Purpose: one canonical live-fire suite that mirrors how the UI submits, monitors, and processes Axiom results today
  - Artifacts: writes JSON outputs under `test-artifacts/live-fire/axiom-canonical-suite/<timestamp>-<orderId>/` unless `AXIOM_LIVE_ARTIFACT_DIR` is set

- `axiom-live-fire-review-program-suite.ts`  ← **pnpm axiom:livefire:review-program-suite**
  - `POST /api/review-programs/prepare` — exact prepared-context entrypoint the review workspace should use
  - `GET /api/review-programs/prepared/:preparedContextId` — confirms the persisted prepared artifact and planned engine payloads
  - `POST /api/review-programs/prepared/:preparedContextId/dispatch` — exact prepared-context dispatch contract
  - `GET /api/analysis/submissions/:submissionId?analysisType=CRITERIA` — monitors Axiom-backed review-program criteria runs to terminal state
  - `GET /api/axiom/scopes/:scopeId/results?programId=…` — verifies the latest-results surface after review-program dispatch
  - `GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history` — verifies criterion history after review-program dispatch
  - Purpose: exercise review programs sending full prepared Axiom payloads, monitor the live criteria runs, and validate the result/history surfaces as they land
  - Artifacts: writes JSON outputs under `test-artifacts/live-fire/axiom-review-program-suite/<timestamp>-<orderId>/` unless `AXIOM_LIVE_REVIEW_ARTIFACT_DIR` is set

- `axiom-live-fire-ui-parity.ts`
  - Mode `extraction`: `POST /api/runs/extraction` + `POST /api/runs/:runId/refresh-status` + `GET /api/runs/:runId/snapshot`
  - Mode `criteria`: `POST /api/runs/criteria` + run/step polling + `GET /api/runs/:stepRunId/step-input`
  - Purpose: backend-only UI-parity validation to isolate UI issues from pipeline/engine issues
  - Note: the prior `full` mode (`POST /api/axiom/analyze` + `/evaluations/...`) was retired in the 2026-05-07 v2 migration. The end-to-end UI submission flow is now covered by `axiom-live-fire-canonical-suite.ts`.

- `axiom-live-fire-aegis-connect.ts`
  - Mode: direct Axiom API connectivity probe with Aegis-enforced auth
  - Purpose: acquire a real Entra JWT (`az account get-access-token --resource api://3bc96929-593c-4f35-8997-e341a7e09a69`) and verify headers (`Authorization`, `X-Client-Id`, optional `X-Sub-Client-Id`) against Axiom endpoint

- `axiom-live-fire-full-pipeline-suite.ts`  ← **pnpm axiom:livefire:full-pipeline**
  - `POST /api/runs/extraction` — kicks off a fresh extraction
  - `POST /api/runs/:runId/refresh-status` + `GET /api/runs/:runId` — poll until terminal
  - `GET /api/runs/:runId/snapshot` — fetch canonical snapshot
  - `POST /api/axiom/scopes/:scopeId/evaluate` — v2 criteria evaluation against fresh extraction
  - `GET /api/orders/:scopeId` — verify `axiomStatus` + `axiomCompletedAt` stamped
  - `GET /api/orders/:id/timeline` — verify `AXIOM_COMPLETED` audit event landed
  - `GET /api/axiom/scopes/:scopeId/results?programId=...` — verify same criteria set surfaces
  - `GET /api/axiom/scopes/:scopeId/criteria/:criterionId/history` — verify history row exists
  - Purpose: the single canonical "did our changes break the full extraction → envelope → criteria → render → timeline chain?" regression gate.
    Cross-step assertions catch the failure modes the component suites miss:
      - Snapshot must be **substantive** (≥1 key in canonical/extraction/subjectProperty, or ≥1 sourceRef)
      - At least one criterion must produce a **grounded verdict** (`pass`/`fail`/`needs_review`, not all `cannot_evaluate`)
      - At least one criterion must have **non-empty `dataConsulted`** (proves envelope assembler flowed data through)
      - Order must be **stamped** (`axiomStatus=completed`, `axiomCompletedAt` set)
      - Timeline must contain **`AXIOM_COMPLETED`** audit event
  - Extra env: `AXIOM_LIVE_DOCUMENT_ID` (required), `AXIOM_LIVE_V2_PROGRAM_ID` + `AXIOM_LIVE_V2_PROGRAM_VERSION` (else fetched from order), `AXIOM_LIVE_POLL_ATTEMPTS` (default 60, ~5 min ceiling), `AXIOM_LIVE_POLL_INTERVAL_MS` (default 5000)

- `axiom-live-fire-v2-flow.ts`  ← **pnpm axiom:livefire:v2-flow**
  - `POST   /api/axiom/scopes/:scopeId/evaluate` — kicks off v2 evaluation run
  - `GET    /api/axiom/scopes/:scopeId/runs/:runId` — polls until terminal status
  - `GET    /api/axiom/scopes/:scopeId/results?programId=…` — latest verdicts
  - `GET    /api/axiom/scopes/:scopeId/criteria/:criterionId/history` — audit trail
  - `POST   /api/axiom/scopes/:scopeId/criteria/:criterionId/override` — atomic override (gated by `AXIOM_LIVE_V2_RUN_OVERRIDE=true`)
  - Purpose: end-to-end validation of the Axiom v2 proxy surface used by the FE
    after the 2026-05-07 migration. Asserts response shape matches the strict
    contract the FE's `normalizeEvaluationResponse` enforces (v2 verdict enum,
    required `evaluationRunId`/`scopeId`/`criterionSnapshot`/`dataConsulted`,
    no legacy `'warning'`/`'info'` verdicts).
  - Extra env: `AXIOM_LIVE_V2_PROGRAM_ID` (else fetched from order's
    `axiomProgramId`), `AXIOM_LIVE_V2_PROGRAM_VERSION`, `AXIOM_LIVE_V2_SCHEMA_ID`
    (default = programId), `AXIOM_LIVE_V2_RUN_OVERRIDE` (default `false`),
    `AXIOM_LIVE_V2_OVERRIDE_VERDICT` (default `pass`, must be one of
    pass/fail/needs_review).

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

- `AXIOM_LIVE_TOKEN_CACHE_FILE` (path must stay under the repo root or `scripts/live-fire/`)
- `AXIOM_LIVE_TOKEN_CACHE_SKEW_SECONDS` (default `120`)
- `AXIOM_LIVE_DISABLE_TOKEN_CACHE=true` (forces fresh token acquisition every run)

Script-specific required values:

### Property intake

- `AXIOM_LIVE_ORDER_ID`
- `AXIOM_LIVE_PROPERTY_ADDRESS`
- `AXIOM_LIVE_PROPERTY_CITY`
- `AXIOM_LIVE_PROPERTY_STATE`
- `AXIOM_LIVE_PROPERTY_ZIP`

### Bulk submit

- `AXIOM_LIVE_BULK_ADAPTER_KEY`
- `AXIOM_LIVE_ANALYSIS_TYPE` (`AVM`, `FRAUD`, `ANALYSIS_1033`, `QUICK_REVIEW`, `DVR`, or `ROV`)

### AIM-Port inbound

- Requires the shared live-fire auth env (`AXIOM_LIVE_TENANT_ID`, `AXIOM_LIVE_CLIENT_ID`, and one auth mode) because the harness now verifies the created order through the authenticated orders API.
- `AXIOM_LIVE_BASE_URL` (use the APIM gateway URL in staging/prod; direct Container App ingress is now rejected for AIM-Port when `ENVIRONMENT != dev`)
- `INTEGRATION_LIVE_AIMPORT_CLIENT_ID`
- `INTEGRATION_LIVE_AIMPORT_API_KEY`
- Optional:
  - `INTEGRATION_LIVE_AIMPORT_ORDER_ID`
  - `INTEGRATION_LIVE_AIMPORT_ADDRESS`
  - `INTEGRATION_LIVE_AIMPORT_CITY`
  - `INTEGRATION_LIVE_AIMPORT_STATE`
  - `INTEGRATION_LIVE_AIMPORT_ZIP`
  - `INTEGRATION_LIVE_AIMPORT_BORROWER`
  - `INTEGRATION_LIVE_AIMPORT_DUE_DATE` (defaults to now + 72h; required by internal order creation)
  - `INTEGRATION_LIVE_AIMPORT_DISCLOSED_FEE` (defaults to `550`)
  - `INTEGRATION_LIVE_AIMPORT_EXPECT_LENDER_ID` (optional assertion for the created order's `clientId`)

### Class Valuation inbound

- `AXIOM_LIVE_BASE_URL`
- `INTEGRATION_LIVE_CLASS_VALUATION_ACCOUNT_ID`
- `INTEGRATION_LIVE_CLASS_VALUATION_HMAC_SECRET`
- `INTEGRATION_LIVE_CLASS_VALUATION_EXTERNAL_ORDER_ID`
- `INTEGRATION_LIVE_CLASS_VALUATION_OCCURRED_AT`
- Optional:
  - `INTEGRATION_LIVE_CLASS_VALUATION_ORDER_ID`
  - `INTEGRATION_LIVE_CLASS_VALUATION_FILE_ID`
  - `INTEGRATION_LIVE_CLASS_VALUATION_FILE_NAME`
  - `INTEGRATION_LIVE_CLASS_VALUATION_FILE_CATEGORY`
  - `INTEGRATION_LIVE_CLASS_VALUATION_FILE_CONTENT_BASE64`
  - `INTEGRATION_LIVE_CLASS_VALUATION_FILE_DESCRIPTION`

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

### Review-program prepared-context suite (`axiom-live-fire-review-program-suite.ts`)

- `AXIOM_LIVE_ORDER_ID`
- `AXIOM_LIVE_REVIEW_PROGRAM_IDS` (comma-delimited review program ids)
- Optional:
  - `AXIOM_LIVE_REVIEW_CLIENT_ID`
  - `AXIOM_LIVE_REVIEW_SUB_CLIENT_ID`
  - `AXIOM_LIVE_REVIEW_ENGAGEMENT_ID`
  - `AXIOM_LIVE_REVIEW_DISPATCH_MODE` (`all_ready_only` or `include_partial`, default `all_ready_only`)
  - `AXIOM_LIVE_REVIEW_CONFIRM_WARNINGS` (`true` or `false`, default `false`)
  - `AXIOM_LIVE_REVIEW_INCLUDE_COMP_CONTEXT`
  - `AXIOM_LIVE_REVIEW_INCLUDE_DOCUMENT_INVENTORY`
  - `AXIOM_LIVE_REVIEW_AUTO_RESOLVE_DERIVED_FIELDS`
  - `AXIOM_LIVE_REVIEW_AUTO_PLAN_EXTRACTION`
  - `AXIOM_LIVE_REVIEW_ARTIFACT_DIR` (path must stay under the repo root or `scripts/live-fire/`)

Optional poll tuning for all scripts:

- `AXIOM_LIVE_POLL_ATTEMPTS` (default `20`)
- `AXIOM_LIVE_POLL_INTERVAL_MS` (default `3000`)

### Authz profile verification

- `AXIOM_LIVE_ENVIRONMENT` (`staging` or `prod`)
- Uses the standard shared auth env documented above

Example:

```powershell
$env:AXIOM_LIVE_ENVIRONMENT='staging'
pnpm axiom:livefire:authz-profile
```

Optional preflight tuning:

- `AXIOM_LIVE_PREFLIGHT_ORDER_LIMIT` (default `50`)
- `AXIOM_LIVE_PREFLIGHT_MAX_SCAN` (default `200`)

## Commands

- `pnpm axiom:livefire:property-intake`
- `pnpm axiom:livefire:document-flow`
- `pnpm axiom:livefire:analyze-webhook`
- `pnpm axiom:livefire:bulk-submit`
- `pnpm axiom:livefire:preflight`
- `pnpm axiom:livefire:canonical-suite`
- `pnpm axiom:livefire:review-program-suite`
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
