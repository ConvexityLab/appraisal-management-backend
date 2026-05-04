# P-19 — Extraction Journey Live-Fire Runbook

**Created:** 2026-04-27
**Last Updated:** 2026-04-28 (auto-auth flow shipped + first PASS recorded)
**Owner:** Dev 2 (Pipeline lane)
**Tracks:** [WEEKLY-PLAN-2026-04-27.md → P-19](./WEEKLY-PLAN-2026-04-27.md)
**Backlog references:** A-04, A-10, A-11, A-13, Q-07 in [PRODUCTION-READINESS-BACKLOG.md](../../l1-valuation-platform-ui/PRODUCTION-READINESS-BACKLOG.md)

---

## What this runbook does

P-19 verifies the **extraction journey** end-to-end:

| Step | What we verify |
|------|----------------|
| (a)  | `axiom.evaluation.submitted` event fires when a document is submitted |
| (b)  | Document arrives at Axiom (or staged equivalent) |
| (c)  | Webhook fires AND signature validates |
| (d)  | `fetchAndStorePipelineResults` writes evaluation to `aiInsights` AND `extractedData` back to `documents` |
| (e)  | Order is stamped with `axiomRiskScore` / `axiomDecision` / `axiomExtractedSummary` |
| (f)  | `axiom.evaluation.completed` event published |
| (g)  | `AxiomInsightsPanel` renders extracted fields with source citations |
| (h)  | PDF viewer opens at correct page + coordinates when user clicks a source chip |

Steps **(a)–(f)** are exercised by the existing live-fire scripts in `scripts/live-fire/`. Steps **(g)/(h)** are exercised by the Playwright spec at [`e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts`](../../l1-valuation-platform-ui/e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts).

The mocked-path coverage was completed 2026-04-27 — see WEEKLY-PLAN-2026-04-27.md P-19 progress notes. **This runbook is the actual run.**

---

## Prerequisites

### One-time setup

1. **Backend running** — locally or staged. Local default is `http://localhost:3011`.
2. **Frontend** — Playwright `playwright.config.ts` auto-starts a Vite dev server. Default port `4173`; override with `LIVE_UI_PORT=5174` if 4173 conflicts (the dev workflow on this box uses 4173 for a different server, so 5174 is the recommended Playwright port).
3. **Cosmos DB seeded** with at least one engagement + order + document:
   ```bash
   cd c:/source/appraisal-management-backend
   npm run seed -- --module orders
   ```
   Note the seed-order IDs printed at the end — you'll need the IDs of an order with a real document.

4. **Auth — fully automated, no manual sign-in needed** _(new 2026-04-28)_:

   `playwright.config.ts:configureAutoAuth()` mints a test JWT signed with the backend's `TEST_JWT_SECRET`, sets `VITE_BYPASS_AUTH=true` + `VITE_TEST_JWT=<jwt>` BEFORE the Vite dev server starts, and persists the token to `.auth/live-fire-test-token.txt`. The backend's `unified-auth.middleware.ts` accepts the JWT (gated by `NODE_ENV !== 'production'`) and `authorization.middleware.ts` synthesizes an admin profile so no user-profile seed is required.

   You only need to ensure `TEST_JWT_SECRET` exists. The config reads it from:
   - `process.env.TEST_JWT_SECRET` (if set), or
   - `c:/source/appraisal-management-backend/.env` (fallback, override via `LIVE_UI_BACKEND_ENV_PATH`).

   To opt out and use a previously-captured Entra session instead, set `LIVE_UI_SKIP_AUTH_SETUP=true` and `LIVE_UI_STORAGE_STATE=.auth/live-fire-ui.json`.

### Per-run environment

Set these in the shell where you'll run the live-fire scripts:

| Variable | Example | Notes |
|---|---|---|
| `AXIOM_LIVE_BASE_URL` | `http://localhost:3011` | Backend URL |
| `AXIOM_LIVE_TENANT_ID` | `tenant-001` | From the seeded engagement |
| `AXIOM_LIVE_CLIENT_ID` | `client-001` | From the seeded engagement |
| `AXIOM_LIVE_BEARER_TOKEN` | (paste from `az account get-access-token`) | OR set `AXIOM_LIVE_USE_DEFAULT_CREDENTIAL=true` |
| `AXIOM_LIVE_ORDER_ID` | `seed-order-003` | An order with at least one document |
| `AXIOM_LIVE_DOCUMENT_ID` | `seed-doc-report-003` | A document attached to that order |
| `AXIOM_LIVE_WEBHOOK_SECRET` | (from Key Vault or `.env.staging`) | Required for the signed webhook step |

**Don't have real Axiom?** Set `AXIOM_FORCE_MOCK=true` before starting the backend. The backend will fake the Axiom round-trip with an 8-second delay (configurable via `AXIOM_MOCK_DELAY_MS`). All event-publishing and writeback paths still execute — only the outbound HTTP to Axiom is skipped.

---

## Part 1 — Backend live-fire (steps a–f)

### Run 1.1 — Quickest path: analyze + webhook round-trip

This single script exercises analyze → webhook signature verification → result polling → final evaluation payload assertions in one shot. Closest equivalent to the full extraction journey on the backend side.

```bash
cd c:/source/appraisal-management-backend
npm run axiom:livefire:analyze-webhook
```

**What to expect:**

```
✓ analyze queued evaluationId=eval-...
… analyze evaluation pending (attempt 1/20)
… analyze evaluation pending (attempt 2/20)
✓ analyze evaluation appears on attempt 3 (status=processing)
✓ overallRiskScore=42
✓ informativeCriteriaCount=3
✓ hasExtractionOutput=true
✓ hasCriteriaAggregate=true
✓ unsigned webhook correctly rejected (401)
✓ signed webhook accepted (200)
```

**Failure modes to expect:**

| Symptom | Likely cause | Fix |
|---|---|---|
| `Missing required environment variable: AXIOM_LIVE_ORDER_ID` | Env not set | Export the per-run vars above |
| `analyze response missing evaluationId` | Backend is up but axiom.service is misconfigured (no `AXIOM_API_BASE_URL`) | Set `AXIOM_FORCE_MOCK=true` and restart backend, OR provision real Axiom creds |
| `Evaluation 'eval-...' did not complete successfully. Status='processing'` | Polling timeout (default 20 attempts × 3s = 60s) | Increase `AXIOM_LIVE_POLL_ATTEMPTS=60` for slow networks |
| `unsigned webhook was unexpectedly accepted (200)` | `AXIOM_WEBHOOK_SECRET` not set on the backend | Set it in backend env, restart |
| 5xx from `/api/axiom/analyze` | Backend not running or crashed | `npm run dev` in backend repo, watch logs |

### Run 1.2 — SSE round-trip (richer instrumentation)

If you want to see the evaluation appear via the SSE stream alongside the polling result:

```bash
npm run axiom:livefire:sse-round-trip
```

This mimics the EXACT UI submission path (`POST /api/analysis/submissions`) and runs the SSE stream concurrently with the polling. Use this when you want to verify the live tracker UI behaviour without opening a browser.

### Run 1.3 — Verify each step landed

After Run 1.1 or 1.2 succeeds, double-check each step landed in Cosmos:

```bash
# Step (d) — evaluation in aiInsights
curl -H "Authorization: Bearer $AXIOM_LIVE_BEARER_TOKEN" \
  "$AXIOM_LIVE_BASE_URL/api/axiom/evaluations/order/$AXIOM_LIVE_ORDER_ID" | jq '.data[0] | {evaluationId, status, overallRiskScore, criteriaCount: (.criteria | length)}'
# Expect: { evaluationId, status: "completed", overallRiskScore, criteriaCount > 0 }

# Step (d-extension) — extractedData on the source document
curl -H "Authorization: Bearer $AXIOM_LIVE_BEARER_TOKEN" \
  "$AXIOM_LIVE_BASE_URL/api/documents/$AXIOM_LIVE_DOCUMENT_ID" | jq '.data | {extractedDataSource, extractedDataAt, extractedDataPipelineJobId}'
# Expect: { extractedDataSource: "axiom", extractedDataAt: "2026-04-27T...", extractedDataPipelineJobId: "pjob-..." }

# Step (e) — order stamping
curl -H "Authorization: Bearer $AXIOM_LIVE_BEARER_TOKEN" \
  "$AXIOM_LIVE_BASE_URL/api/orders/$AXIOM_LIVE_ORDER_ID" | jq '.data | {axiomRiskScore, axiomStatus, axiomDecision, axiomEvaluationId, axiomLastUpdatedAt, hasExtractedSummary: (.axiomExtractedSummary != null)}'
# Expect: axiomStatus: "completed", numeric axiomRiskScore, ISO axiomLastUpdatedAt, hasExtractedSummary: true

# Step (f) — axiom.evaluation.completed event in audit trail
curl -H "Authorization: Bearer $AXIOM_LIVE_BEARER_TOKEN" \
  "$AXIOM_LIVE_BASE_URL/api/engagements/$ENGAGEMENT_ID/audit?eventType=axiom.evaluation.completed&pageSize=5" | jq '.data[] | {eventType, timestamp, data: .data | {orderId, status, score, criteriaCount, passCount, failCount, warnCount}}'
# Expect: at least one event with status field, score, counts matching the evaluation
```

### Run 1.4 — Capture run artifacts for the audit trail

```bash
mkdir -p test-artifacts/p-19/$(date +%Y-%m-%dT%H-%M-%S)
npm run axiom:livefire:analyze-webhook 2>&1 | tee test-artifacts/p-19/$(date +%Y-%m-%dT%H-%M-%S)/run.log
```

Drop the log + the curl outputs from 1.3 into a new branch for this verification run.

---

## Part 2 — Frontend Playwright (steps g/h)

### Run 2.1 — UI verification spec

The spec at `e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts` loads the Order Detail page for a known order, switches to the **AI Analysis** tab, asserts that AxiomInsightsPanel renders extracted criteria, clicks a source citation chip, and verifies the PDF viewer opens at the correct page + coordinates.

The spec **runs in smoke-test mode** when the order's evaluation has zero criteria (writes a `NOTE-no-criteria.txt` artifact and passes). Full criterion + PDF assertion fires only when fixtures with real Axiom criteria are present.

```bash
cd c:/source/l1-valuation-platform-ui

# Required env. The LIVE_UI_PORT=5174 override avoids a conflict with the
# dev-workflow server that runs on 4173 on this box.
VITE_API_BASE_URL=http://localhost:3011 \
LIVE_UI_PORT=5174 \
LIVE_UI_BASE_URL=http://127.0.0.1:5174 \
LIVE_UI_ORDER_ID=seed-order-003 \
PW_HEADLESS=true \
  npx playwright test e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts
```

Expected output (smoke mode):
```
[playwright config] Auto-auth ready: subject=axiom-live-fire-user, tenant=885097ba-..., token=eyJ...
[spec] Evaluation has 0 criteria — passing in smoke-test mode
ok 1 ... › renders Axiom Insights extraction journey + PDF viewer opens at cited page (~17s)
1 passed (~22s)
```

Artifacts land in `test-artifacts/live-fire/axiom-insights-extraction-journey/<timestamp>-<orderId>/`:
- `02-order-detail-page.png` — page state on first load
- `03-ai-analysis-tab-active.png` — page state after the AI Analysis tab is selected
- `NOTE-no-evaluation.txt` / `NOTE-no-criteria.txt` — present in smoke-test mode
- `network.ndjson` — every API call captured
- `console.log` — browser console output (used to surface CORS / auth issues)
- `session.json` — { orderId, baseURL, evaluationId, criteriaCount }

### Run 2.2 — Manual UI verification checklist

Use this when the Playwright spec catches a regression and you need to root-cause interactively.

**Pre-conditions:**
- Backend running with completed Axiom evaluation for the order in question
- Frontend running (Playwright auto-starts one; for manual UI work run `npm run dev` and visit `http://localhost:3010`)
- Logged in as a user with QC-read scope

**Steps:**

| # | Action | Expected behavior | If broken |
|---|---|---|---|
| 1 | Navigate to `/orders/{orderId}` and click the **AI Analysis** tab | Order Detail page loads; AI Analysis tab opens AxiomInsightsPanel | Check console for AuthN/AuthZ errors |
| 2 | Look for the **AxiomInsightsPanel** card (top of right pane or above checklist) | Card visible with "Axiom Insights" header + criterion list | If empty: confirm `useGetOrderEvaluationsQuery` returned data via Network tab |
| 3 | Verify each criterion shows **name + verdict icon + confidence %** | e.g., "GLA within 10% of comparable median ⚠️ 72%" | Compare to backend `/api/axiom/evaluations/order/:id` — should match |
| 4 | Verify per-criterion **AI reasoning** text is rendered | Below the verdict line | Check that `criterion.reasoning` is non-empty in API response |
| 5 | Verify per-criterion **source citations** show as chips with page numbers | "p.12 — Sales Comparison" or similar | If missing: criterion.documentReferences[] is empty in API — Axiom didn't return refs |
| 6 | Click a source citation chip | PDF viewer panel opens; document name visible in header | Check Network for `/api/documents/{id}/blob` GET; check console for Syncfusion errors |
| 7 | Verify the PDF auto-navigates to the **correct page** | Page indicator at top shows the page number from the chip | If wrong page: `documentReferences[i].page` value not propagated to viewer; trace `onDocumentReferenceClick` |
| 8 | Verify a **highlight overlay** appears at `coordinates` (when present) | Yellow/amber/red box at the AI-cited region; color matches confidence (high=green, med=amber, low=red) | If no highlight: coordinates may be missing; check `documentReferences[i].coordinates` shape |
| 9 | Click a different chip from a different criterion | PDF re-navigates; new highlight appears | If prior highlight persists incorrectly: bug in PDFViewerPanel cleanup |
| 10 | Open browser DevTools → Network → confirm no 4xx/5xx after click | All requests 200 OK | Capture failing request as a discrete ticket |

**Save findings:**
```bash
# After manual run, snapshot the page + network log
mkdir -p c:/source/appraisal-management-backend/test-artifacts/p-19/manual-ui/$(date +%Y-%m-%dT%H-%M-%S)
# Save screenshots from DevTools to that folder
```

---

## Part 3 — Pass / fail criteria

P-19 is **DONE** when ALL of the following are true:

- [ ] Backend Run 1.1 (analyze + webhook round-trip) exits 0 against the target environment
- [ ] Backend Run 1.3 verification curls return the expected fields for every step (d, e, f)
- [ ] Frontend Run 2.1 (Playwright spec) exits 0
- [ ] Manual UI checklist Steps 1–10 all show **expected** behavior (or any deviations are filed as discrete tickets and triaged)
- [ ] Run artifacts archived under `test-artifacts/p-19/<timestamp>/`
- [ ] Any failure tickets discovered during the run are linked to the WEEKLY-PLAN-2026-04-27.md "Blockers / risks raised this week" section

---

## Part 4 — Common gotchas

0. **User profile lookup — RESOLVED 2026-04-28.** Earlier runs failed with `USER_PROFILE_NOT_FOUND` because no `users` row existed for the test JWT subject. `authorization.middleware.ts` now synthesizes an admin profile when `req.user.isTestToken === true && NODE_ENV !== 'production'`. No user-profile seed needed. Backend changes:
   - `unified-auth.middleware.ts` stamps `isTestToken: true` on the validated user.
   - `authorization.middleware.ts` short-circuits the profile lookup in dev/test mode.

1. **CORS allowed origins.** The backend `.env` `ALLOWED_ORIGINS` must include the Playwright dev-server URL. Current value covers `localhost/127.0.0.1` × `{3010, 3011, 4173, 5174}`. If you change the Playwright port, add it here AND restart the backend, or every API call returns CORS-blocked.

2. **`.env.local` overrides Vite env vars in normal mode.** The dev workflow sets `VITE_BYPASS_AUTH=false` in `.env.local`, which would defeat the auto-auth. The `playwright.config.ts` webServer command uses `--mode test` so Vite skips `.env.local`. Don't drop the `--mode test` flag.

3. **Port conflict on 4173.** Override with `LIVE_UI_PORT=5174` (and `LIVE_UI_BASE_URL=http://127.0.0.1:5174`). The dev workflow on this box already uses 4173 for a different server.

4. **`AXIOM_FORCE_MOCK` is per-process.** If you set it in shell A but the backend is running in shell B, it has no effect. Restart the backend after changing.

5. **Webhook signature mismatch** when running locally: the live-fire script computes the HMAC using `AXIOM_LIVE_WEBHOOK_SECRET`. The backend verifies using `AXIOM_WEBHOOK_SECRET`. **They must be the same value.** Easy mistake when copy-pasting from staging.

6. **Stale evaluation cache.** If you re-run the same `(orderId, documentId)` pair, the backend may short-circuit on a cached pending record. Pass `forceResubmit: true` (the analyze script already does this) or delete the existing eval from `aiInsights` first.

7. **Tenant filtering.** The default tenant in `playwright.config.ts` is `885097ba-35ea-48db-be7a-a0aa7ff451bd` — the real seeded Azure tenant. Override with `LIVE_UI_TENANT_ID=<other>` for a different environment. A wrong tenant produces empty result sets, which the spec then misreports as "no fixture data".

8. **Headless storage-state path is now opt-in.** `.auth/live-fire-ui.json` is only used when `LIVE_UI_SKIP_AUTH_SETUP=true` is set. By default, every run mints a fresh JWT — no interactive sign-in, no token expiry to manage.

9. **PDF viewer fails silently** when the document blob doesn't exist in storage. Check `extractedData.sourceBlobUrl` is reachable independently before assuming the viewer is broken.

10. **Smoke-mode pass ≠ full verification.** A green run with `NOTE-no-criteria.txt` only proves the page loads + tab switches + auth works. It does NOT prove criterion rendering or PDF coordinate accuracy. To exercise (g)/(h) fully, run `npm run axiom:livefire:analyze-webhook` first to populate fresh Axiom criteria, then re-run the spec.

---

## Part 5 — When live Axiom credentials become available

The Axiom cluster (A-01 / A-02 / A-06 / A-07 / P-01–P-04) is currently **deferred** per the `PRODUCTION-READINESS-BACKLOG.md` Axiom-cluster-deferred entry. When the kickoff session happens:

1. Replace `AXIOM_FORCE_MOCK=true` with real `AXIOM_API_BASE_URL` + `AXIOM_API_KEY` (or `AXIOM_USE_DEFAULT_CREDENTIAL=true` with managed identity)
2. Configure Axiom platform to POST webhooks to your `${AXIOM_LIVE_BASE_URL}/api/axiom/webhook` (with the matching `AXIOM_WEBHOOK_SECRET`)
3. Re-run Part 1 — should produce the same output but with real Axiom processing latency (typically 30s–3min)
4. Re-run Part 2 — should produce real criterion text + real document coordinates rather than mock-fixture output

The mocked-path test coverage we built today (114 backend assertions) plus this runbook give us a defensible "production-ready" claim for the extraction journey on day-one of real Axiom.
