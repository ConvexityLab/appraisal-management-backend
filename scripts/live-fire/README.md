# Axiom Live-Fire Test Pack

These scripts run against a live backend deployment and exercise real Axiom integration paths end-to-end.

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

## Required environment

Set these for all scripts:

- `AXIOM_LIVE_BASE_URL` (example: `https://staging-api.example.com`)
- `AXIOM_LIVE_TENANT_ID`
- `AXIOM_LIVE_CLIENT_ID`
- Auth (choose one):
  - `AXIOM_LIVE_BEARER_TOKEN`, or
  - `AXIOM_LIVE_TEST_JWT_SECRET` (for dev/test envs that accept test JWTs)

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

Optional poll tuning for all scripts:

- `AXIOM_LIVE_POLL_ATTEMPTS` (default `20`)
- `AXIOM_LIVE_POLL_INTERVAL_MS` (default `3000`)

## Commands

- `pnpm axiom:livefire:property-intake`
- `pnpm axiom:livefire:document-flow`
- `pnpm axiom:livefire:analyze-webhook`

## Notes

- These are intentionally strict and fail-fast; they do not fall back to hidden defaults for critical config.
- Use unique `AXIOM_LIVE_ORDER_ID` values for isolated runs.
- For non-production environments without Axiom webhook secret configured, unsigned webhook checks return `200` by design.
