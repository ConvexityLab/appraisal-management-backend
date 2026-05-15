# Weekly Plan — Week of 2026-04-27

**Created:** 2026-04-27 (Monday)
**Week range:** Mon 2026-04-27 → Sun 2026-05-03
**Source of truth:** [PRODUCTION-READINESS-PLAN.csv](PRODUCTION-READINESS-PLAN.csv)
**Last updated:** 2026-04-28

---

## How to use this document

- Each task has a checkbox `[ ]` — tick to `[x]` when done
- Add the completion date and any notes inline: `(done 2026-04-28 — wired in policy.csv:42)`
- When you finish a task, also flip the corresponding row's Status to `Done` in `PRODUCTION-READINESS-PLAN.csv`
- Add discoveries, blockers, or new items in the **Daily Log** section at the bottom — don't lose context overnight
- Friday end-of-week: roll forward unfinished items into the next week's plan

---

## Week summary

| Bucket | Count | Story Points |
|---|---|---|
| Overdue (must clear) | 11 | ~36 |
| Active this week (4/27–5/3) | 11 | 51 |
| Live-fire & provenance (added 2026-04-27) | 3 | 21 |
| **Total carryable load** | **25** | **~108** |

Capacity check: with 4 dev streams (Swarm/Alpha/Bravo/Charlie) and ~5 working days = ~20 dev-days. 108 story points is well over capacity. Either stretch into next week, accept some slip on P1s, or pull additional people onto the auth chain (the bottleneck) and the new live-fire / provenance work (Pipeline lane).

---

## PART A — Overdue items (clear these FIRST)

These items have already passed their planned end date. **Authorization (A-) and Data Integration (D-) chains are stuck — every downstream item is blocked on them.**

### Authorization chain (CRITICAL — unblocks A-03, A-05, R-04, AA-XX)

- [ ] **A-01 [P0]** Fix Casbin policy syntax + unit tests
  - **Was due:** 4/22/2026 · **Pts:** 3 · **Owner:** Dev 1 · **Repo:** backend
  - **Action:** Rewrite policy.csv lines using invalid JS expressions to valid Casbin matcher syntax. Add unit tests for each policy line.
  - **Blocks:** A-02, R-04
  - **Notes:**

- [ ] **A-02 [P0]** Role hierarchy and permission inheritance
  - **Was due:** 4/23/2026 · **Pts:** 3 · **Owner:** Dev 1 · **Repo:** backend · **Deps:** A-01
  - **Action:** Define Casbin role hierarchy (admin > manager > analyst > appraiser). Remove duplicate policy lines.
  - **Blocks:** A-04, A-03
  - **Notes:**

- [ ] **A-04 [P0]** Align frontend roles with backend
  - **Was due:** 4/24/2026 · **Pts:** 3 · **Owner:** Dev 1 · **Repo:** frontend · **Deps:** A-02
  - **Action:** Replace admin/staff/user in `authRoles.ts` with admin/manager/analyst/appraiser. Update route guards and MSAL claim mapping.
  - **Blocks:** A-05, A-06
  - **Notes:**

- [ ] **A-06 [P1]** Global 403 error boundary
  - **Was due:** 4/24/2026 · **Pts:** 2 · **Owner:** Dev 1 · **Repo:** frontend · **Deps:** A-04
  - **Action:** App-wide handler for 403 responses. Access Denied page with role info and contact path.
  - **Notes:**

- [ ] **A-08 [P1]** Rate limiting on auth failures
  - **Was due:** 4/25/2026 · **Pts:** 3 · **Owner:** Dev 1 · **Repo:** backend
  - **Action:** Middleware to throttle repeated failed token validations per IP. Configurable lockout threshold.
  - **Notes:**

### Foundation

- [ ] **F-01 [P0]** Startup config validation: fail fast on missing env vars
  - **Was due:** 4/22/2026 · **Pts:** 5 · **Owner:** Dev 3 · **Repo:** backend
  - **Action:** Audit all env vars. Add startup validation with actionable error messages. Eliminate in-memory Service Bus fallback in production.
  - **Notes:**

### Data Integration chain (D-01 blocks D-02, D-03, D-04, D-05)

- [ ] **D-01 [P0]** Production client data import
  - **Was due:** 4/23/2026 · **Pts:** 5 · **Owner:** Dev 3 · **Repo:** backend
  - **Action:** Import real client records using seed orchestrator + bulk ingestion. Validate clients render correctly with correct product/fee mappings.
  - **Blocks:** D-02, D-03, D-04, D-05
  - **Notes:**

- [ ] **D-03 [P0]** Product and fee schedule import
  - **Was due:** 4/24/2026 · **Pts:** 3 · **Owner:** Dev 3 · **Repo:** backend · **Deps:** D-01
  - **Action:** Load production fee schedules per client × product × geography. Verify fee calculation against test cases.
  - **Notes:**

- [ ] **D-04 [P0]** Document types, report templates, QC checklists import
  - **Was due:** 4/26/2026 · **Pts:** 5 · **Owner:** Dev 3 · **Repo:** backend · **Deps:** D-01
  - **Action:** Load production document taxonomy, report templates, review programs, QC checklists. Verify report builder and criteria evaluation.
  - **Notes:**

### Reporting

- [ ] **R-01 [P0]** Criteria evaluation data in report templates
  - **Was due:** 4/23/2026 · **Pts:** 5 · **Owner:** Dev 2 · **Repo:** backend
  - **Action:** Ensure all report types include per-criterion pass/fail, confidence, AI reasoning, and remediation.
  - **Blocks:** R-02
  - **Notes:**

- [ ] **R-02 [P0]** Enrichment data in report templates
  - **Was due:** 4/24/2026 · **Pts:** 3 · **Owner:** Dev 2 · **Repo:** backend · **Deps:** R-01
  - **Action:** Add template sections for census, market, risk, and comparable property data with source citations.
  - **Notes:**

---

## PART B — Active this week (4/27 → 5/3)

### Reporting (Dev 2 lane)

- [ ] **R-03 [P0]** CSV/Excel export endpoints + download buttons
  - **Window:** 4/25 → 4/27 · **Pts:** 5 · **Repo:** both
  - **Action:** Export endpoints for order lists, evaluation summaries, vendor performance. Frontend download buttons.
  - **Notes:**

- [ ] **R-04 [P1]** Report access controls (scoped by auth)
  - **Window:** 4/27 → 4/28 · **Pts:** 3 · **Repo:** backend · **Deps:** A-01
  - **Action:** Reports filtered by user authorization scope. Manager sees only their clients. Enforced server-side.
  - **Notes:**

- [ ] **R-07 [P1]** Report builder: Market Map section
  - **Window:** 4/28 → 4/29 · **Pts:** 5 · **Repo:** both
  - **Action:** Implement geographic map showing subject and comparables. Completes the last report builder section.
  - **Notes:**

- [ ] **R-08 [P1]** Analytics: replace mocks with real data + charting
  - **Window:** 4/29 → 5/1 · **Pts:** 8 · **Repo:** both
  - **Action:** Replace `Math.random()` mocks in trend/vendor tables with real API endpoints. Integrate Recharts. Add backend trend aggregation endpoints.
  - **Notes:**

### Data Integration (Dev 3 lane)

- [ ] **D-09 [P0]** ATTOM go-live
  - **Window:** 4/26 → 4/28 · **Pts:** 5 · **Repo:** backend
  - **Action:** Provision production ATTOM API key in Key Vault. Run CSV batch ingestion at scale. Validate Bridge → ATTOM fallback. Verify rate limit compliance.
  - **External dep:** ATTOM partner provisioning (matches I-01 / P-07 in `PRODUCTION-READINESS-BACKLOG.md`).
  - **Notes:**

- [ ] **D-02 [P0]** Production vendor/appraiser panel import
  - **Window:** 4/28 → 4/30 · **Pts:** 5 · **Repo:** backend · **Deps:** D-01
  - **Action:** Import real vendor panels with license data, coverage areas, certifications, fee schedules. Validate matching engine.
  - **Notes:**

- [ ] **D-05 [P1]** SLA configuration import and validation
  - **Window:** 4/30 → 5/1 · **Pts:** 2 · **Repo:** backend · **Deps:** D-01
  - **Action:** Load production SLA rules per client × product. Verify SLA monitoring triggers at correct thresholds.
  - **Notes:**

### Authorization / Foundation / Eventing (M2 starts 5/2)

- [ ] **A-03 [P1]** Transitive access-graph resolution
  - **Window:** 5/2 → 5/4 · **Pts:** 5 · **Repo:** backend · **Deps:** A-02
  - **Action:** Implement user→team→object and user→role→object traversal in `access-graph.service.ts`. Add multi-hop grant tests.
  - **Notes:**

- [ ] **E-01 [P0]** Idempotency audit and testing
  - **Window:** 5/2 → 5/4 · **Pts:** 5 · **Repo:** backend
  - **Action:** Audit all event consumers. Tests: replay same event twice → no duplicate side effects.
  - **Cross-ref:** Already partially covered by entity-marker pattern audited in B-09 (`PRODUCTION-READINESS-BACKLOG.md`).
  - **Notes:**

- [ ] **F-02 [P0]** Health check endpoints
  - **Window:** 5/2 → 5/3 · **Pts:** 3 · **Repo:** backend
  - **Action:** `/health` (liveness) and `/ready` (readiness) endpoints checking Cosmos, Service Bus, ACS, Web PubSub.
  - **Cross-ref:** Liveness/readiness aliases already added per O-07; this item completes coverage of all dependencies. Partial overlap with O-06 in `PRODUCTION-READINESS-BACKLOG.md`.
  - **Notes:**

- [ ] **F-03 [P0]** Structured logging with correlation IDs
  - **Window:** 5/3 → 5/5 · **Pts:** 5 · **Repo:** backend
  - **Action:** Standardize log format across all services. Propagate correlationId from HTTP → event → downstream.
  - **Cross-ref:** Correlation ID propagation already done in O-02. This item covers the per-service log-format migration.
  - **Notes:**

### Quality / Live-Fire Verification (NEW — added 2026-04-27)

These are the journey-level integration items that take the code-complete Axiom + QC paths from "audited" to "live-verified". They are P0 because the platform's value proposition is "AI extracts → criteria evaluate → reviewer trusts the results" — without live-fire validation we don't actually know that pipeline holds end-to-end.

- [ ] **P-19 [P0]** Live-fire testing of extraction journey
  - **Window:** 4/28 → 4/30 · **Pts:** 8 · **Owner:** Dev 2 · **Repo:** both
  - **Action:** Submit a real document end-to-end through the extraction pipeline. Verify: (a) `axiom.evaluation.submitted` event fires, (b) document arrives at Axiom (or staged equivalent), (c) webhook fires and signature validates, (d) `fetchAndStorePipelineResults` writes the evaluation to `aiInsights` AND `extractedData` back to `documents`, (e) order is stamped with `axiomRiskScore` / `axiomDecision` / `axiomExtractedSummary`, (f) `axiom.evaluation.completed` event published, (g) `AxiomInsightsPanel` renders the extracted fields with source citations, (h) PDF viewer opens at correct page + coordinates when the user clicks a source chip. Capture failures as discrete tickets.
  - **Cross-ref:** Closes the live-fire half of A-04, A-10, A-11, A-13, Q-07 (all currently audit-passed / code-complete but live-fire pending in `PRODUCTION-READINESS-BACKLOG.md`). Pre-condition for T-01 happy path.
  - **Progress (2026-04-27 AM):**
    - ✅ Audit complete — inventoried 11 backend test files (~2,676 LOC) + 3 frontend tests covering the journey. Mapped every step to existing coverage.
    - ✅ Step (e) order field stamping: 1 new test in `axiom-pipeline-result-stamping.test.ts` asserting `updateOrder` receives `axiomRiskScore`/`axiomStatus`/`axiomEvaluationId`/`axiomPipelineJobId`/`axiomLastUpdatedAt`/`axiomDecision`/`axiomExtractedSummary`.
    - ✅ Step (f) `axiom.evaluation.completed` event: 1 new test asserting the published payload (orderId, tenantId, pipelineName, status='failed', score, criteriaCount, passCount, failCount, warnCount, decision, fieldsExtracted).
    - ✅ Step (d-extension) document writeback: 1 new test asserting `extractedData`+`extractedDataSource`+`extractedDataPipelineJobId`+`extractedDataAt` written back to `documents` container.
    - ✅ qc.issue.detected publish: 1 new test asserting events fire per fail/warning criterion with correct severity (CRITICAL for fail, MAJOR for warning), criterionId, evaluationId, documentReferences.
    - ✅ `QCIssueRecorderService`: new test file `qc-issue-recorder.service.test.ts` — 8 tests covering deterministic ID, severity round-trip, missing-fields drop, cosmos-failure swallow, fallback for missing evaluationId, idempotent start/stop. Closes a 0-coverage gap.
    - ✅ `CanonicalSnapshotService.refreshFromExtractionRun()` (A-13): 5 new tests in `canonical-snapshot.service.test.ts` — non-extraction-run skip, missing-snapshotId skip, deleted-snapshot skip, post-Axiom rebuild + `refreshedAt` stamp, upsert-failure non-throw.
    - ✅ Full extraction-journey backend suite: **13 test files, 114/114 passing** with 17 new assertions added.
    - 🚫 Step (g) `AxiomInsightsPanel` render test: **deferred to Cypress/Playwright E2E** per the project pattern in `vitest.config.mts` ("MUI v6 + Vitest + jsdom has known rendering issues with styled-engine. Tests validate logic and mock API interactions; full component rendering is done in Cypress/Playwright E2E tests"). The hooks-mocked render path collides with RTKQ middleware checks in jsdom. Tracked as a separate E2E item to add to the Playwright suite.
    - ⏳ Steps (a), (b), (c), (h) — already covered by existing tests; needs live-fire run against staged Axiom + manual PDF-viewer verification.
  - **Progress (2026-04-27 PM — closure):**
    - ✅ Backend webhook → service end-to-end integration test: new file `tests/unit/axiom-webhook-end-to-end.test.ts` — 3 tests wiring REAL `AxiomService` through `AxiomController.handleWebhook` for the ORDER correlation path. Covers: order stamping (controller AND service), evaluation writeback, document writeback, qc.issue.detected per fail/warn criterion, axiom.evaluation.completed payload, durable-ACK contract on cosmos failure (returns 500 + does NOT call fetchAndStorePipelineResults). Closest-to-live-fire assertion runnable in CI without real Axiom.
    - ✅ Playwright spec: new file `c:/source/l1-valuation-platform-ui/e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts` — drives the Order Detail "AI Insights" tab, captures network, asserts criterion text + verdict-count chips appear, clicks a "View in" citation chip, asserts PDF viewer dialog opens with "Page N" header. Pattern-matched on `engagement-documents-submit.live-fire.spec.ts` (auth via `LIVE_UI_STORAGE_STATE`, network ndjson capture, run-dir artifacts).
    - ✅ Live-fire runbook: new file `current-plan/P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md` — 5-part runbook with prereqs, env vars, Run 1.1 (analyze-webhook command), Run 1.2 (SSE round-trip command), Run 1.3 (curl verification per step d/e/f), Run 2.1 (Playwright command), Run 2.2 (manual UI checklist with 10 numbered steps + expected vs broken signals), pass/fail criteria, common gotchas, and "when live Axiom credentials become available" addendum.
    - ✅ Full backend extraction-journey suite re-run: **14 test files, 117/117 passing** (+3 new e2e webhook tests over yesterday's 114).
  - **Status: P-19 CODE WORK COMPLETE.** Remaining is operational: someone runs Run 1.1 + Run 2.1 against staging, walks through the manual UI checklist, archives artifacts in `test-artifacts/p-19/<timestamp>/`, and ticks the pass/fail boxes in the runbook. The Axiom-cluster deferral (A-01/A-02/A-06/A-07) means the operational run uses `AXIOM_FORCE_MOCK=true` until those are unblocked.
  - **Progress (2026-04-28 — auto-auth + first PASS):**
    - ✅ **Backend test-token middleware shipped** — `unified-auth.middleware.ts` stamps `isTestToken: true` on validated test tokens; `authorization.middleware.ts` synthesizes an admin profile when `isTestToken && NODE_ENV !== 'production'`. Eliminates the `USER_PROFILE_NOT_FOUND` 403 that blocked the first attempted run. Gated to dev/test only — production path is unchanged.
    - ✅ **Playwright auto-auth shipped** — `playwright.config.ts:configureAutoAuth()` mints a fresh JWT signed with `TEST_JWT_SECRET` at config-load time, sets `VITE_BYPASS_AUTH=true` + `VITE_TEST_JWT=<jwt>` BEFORE webServer starts, persists token to `.auth/live-fire-test-token.txt`. WebServer command uses `--mode test` so Vite skips `.env.local` (which sets `VITE_BYPASS_AUTH=false` for the dev workflow). No interactive sign-in. No storage state to refresh. Optional opt-out via `LIVE_UI_SKIP_AUTH_SETUP=true`.
    - ✅ **CORS fix** — backend `.env` `ALLOWED_ORIGINS` extended to cover Playwright dev server ports (4173, 5174). Diagnosed via console.log artifact after every API call returned CORS-blocked.
    - ✅ **Spec route + tab-label fix** — `axiom-insights-extraction-journey.live-fire.spec.ts` now hits `/orders/{orderId}` and clicks the "AI Analysis" tab (was wrong `/property-valuation/order/...` route + "AI Insights" tab text).
    - ✅ **Smoke-mode fallback** — spec passes cleanly with `NOTE-no-evaluation.txt` / `NOTE-no-criteria.txt` artifacts when fixtures lack real Axiom criteria. Documents next steps so a green pass cannot be misread as full verification.
    - ✅ **First PASS recorded** — `1 passed (21.8s)` against `seed-order-003` end-to-end: backend on `:3011`, Vite dev server on `:5174`, headless. Auto-auth + CORS + route + tab + smoke-mode all green.
    - ⏳ Outstanding to graduate from smoke mode to full verification: run `npm run axiom:livefire:analyze-webhook` against staging Axiom (or `AXIOM_FORCE_MOCK=true`) so an order has criteria + documentReferences, then re-run the spec to exercise (g) criterion rendering + (h) PDF coordinate jump.
  - **Notes:**

- [ ] **P-20 [P0]** Live-fire testing of criteria evaluation journey
  - **Window:** 4/29 → 5/1 · **Pts:** 8 · **Owner:** Dev 2 · **Repo:** both · **Deps:** P-19
  - **Action:** With extracted data in place from P-19, trigger the criteria evaluation pipeline. Verify: (a) criteria pipeline runs after extraction (confirm whether auto-trigger or manual), (b) criterion verdicts (pass / fail / warning) appear in evaluation record with confidence + reasoning + remediation, (c) `qc.issue.detected` event fires per failing criterion, (d) `QCIssueRecorderService` writes records to `aiInsights` (`type=qc-issue`) with deterministic ID, (e) `applyAxiomPrefill` populates `aiVerdict` on at least one matching QC checklist item, (f) QC Issues panel renders open + resolved issues, (g) override audit panel reflects any reviewer corrections, (h) cascade re-evaluation fires when a corrected field has dependent criteria.
  - **Cross-ref:** Closes the live-fire half of A-08 (criteria evaluation runs, not just extraction), A-09 (pipeline chain documentation), Q-02 (QC pre-fill verification). Validates the full Axiom feedback loop end-to-end. Cascade re-eval check exercises last week's P-16.
  - **Progress (2026-04-27):**
    - ✅ Audit complete — gap matrix produced. Steps (c)/(d) fully covered by P-19's `axiom-webhook-end-to-end.test.ts` and `qc-issue-recorder.service.test.ts`. Step (e) had ZERO coverage. Step (h) was discovered to be **half-implemented** (publisher exists, no consumer).
    - ✅ Step (e) closure: new `src/utils/__tests__/axiomQcBridge.test.ts` — 15 tests covering empty fast-path, no-id pass-through, single + multi match (worst-verdict logic across pass/warn/fail), document-ref union, reasoning concatenation, remediation precedence, all three checklist buckets, immutability, pinned aiConfidence behavior, edge cases (empty reasoning / empty refs).
    - ✅ Step (a) confirmed via `c:/source/appraisal-management-backend/docs/AXIOM_CRITERIA_API.md` — Axiom exposes `criteria-only-evaluation` as a SEPARATE pipeline, not auto-chained from extraction. Documented in runbook Part 2.
    - ✅ Runbook: new `current-plan/P20-CRITERIA-EVAL-LIVE-FIRE-RUNBOOK.md` — backend tests, live-fire commands (steps a/b), Playwright spec command + manual UI checklist (steps f/g + step e end-to-end), cascade-reeval gap section (Part 4) with exact spec for the missing handler, pass/fail criteria, common gotchas.
    - ✅ Playwright spec: new `e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts` — drives QC review page, opens AI Issues panel via "AI Issues" button, asserts severity chips + issue label render, optionally checks QCOverrideAuditPanel + AI Verdict reasoning panel when fixtures support them. Pattern-matched on the P-19 extraction-journey spec.
    - ⚠️ Step (h) cascade re-eval: **gap confirmed**. `engagement-audit.controller.ts:888` publishes `qc.criterion.reevaluate.requested` but no service subscribes. The `qc.criterion.reevaluated` event that should complete the cycle is never published. Frontend `CascadeReevaluationPanel` will show "requested" markers but no completion deltas. Documented in runbook Part 4 with full spec for new `CriteriaReevaluationHandler` service (~5 SP / 1 day) — **descoped to a separate ticket** for next week's plan.
    - ✅ Backend P-19+P-20 critical path: **28/28 passing**. Frontend bridge: **15/15 passing**.
  - **Status: P-20 CODE WORK COMPLETE except step (h)**. Steps a/b/c/d/e/f/g all closed (mocked tests + runbook + Playwright spec). Step (h) is the only outstanding item; needs a backend handler build (separate ticket).
  - **Progress (2026-04-28 — auto-auth + first PASS):**
    - ✅ **Spec endpoint fix** — `qc-criteria-evaluation-journey.live-fire.spec.ts` now polls `/api/orders/:orderId/qc-issues` (the actual RTKQ endpoint per `qcIssuesApi.ts`) instead of the non-existent `/api/qc/issues`.
    - ✅ **First PASS recorded** — `1 passed (32.7s)` against `seed-order-003` end-to-end. session.json: `{ issuesCount: 0, hasOverrides: true, hasVerdict: false }` — the QCOverrideAuditPanel rendered correctly off real audit-trail data; issues + verdict are smoke-mode pending fixture data with `axiomCriterionIds`.
    - ✅ **Inherits P-19's auto-auth + CORS + `--mode test` infra** — same `playwright.config.ts:configureAutoAuth()`, no spec-level changes needed for auth.
    - ⏳ Outstanding to graduate from smoke mode: same as P-19 — populate fresh Axiom criteria via `npm run axiom:livefire:analyze-webhook`, plus seed at least one QC checklist item with `axiomCriterionIds` matching the Axiom criterion IDs so `applyAxiomPrefill` produces verdicts.
  - **Notes:**

- [ ] **P-21 [P0]** Hardening data + criteria → document provenance journey
  - **Window:** 4/30 → 5/2 · **Pts:** 5 · **Owner:** Dev 2 · **Repo:** both · **Deps:** P-19, P-20
  - **Action:** Audit every extracted field, criterion verdict, and reviewer override for source attribution. Verify: (a) every `extractedData` field carries `{value, confidence, sourceDocumentId, sourcePage, sourceCoordinates}`; (b) every criterion verdict has `documentReferences[]` pointing back to the source pages that produced it; (c) every reviewer correction (`FieldCorrectionDialog`) records the original source ref alongside the new value; (d) cross-document discrepancies (`CrossDocumentDiscrepancyPanel`) properly cite every source. Tighten any field that loses provenance — backfill from `canonicalSnapshot.normalizedData.fieldSources[]` if present, log a structured warning when missing. Surface a "provenance health" % on the Axiom Insights panel so reviewers can see at a glance whether the pipeline is fully traceable.
  - **Cross-ref:** Builds on last week's P-15 / P-17 / P-18 (QC accuracy dashboard, cross-doc discrepancy panel, bounding-box overlay). Closes P-06 in CSV ("Data lineage in criteria results"). Required for compliance audit defensibility.
  - **Notes:**

---

## PART C — Suggested execution order

Given the dependency chains, attack in this order:

| Day | Focus | Items |
|---|---|---|
| **Mon 4/27** | Unblock auth chain | A-01, F-01 |
| **Tue 4/28** | Continue auth + start data import + **kick off live-fire extraction** | A-02, A-04, D-01, **P-19** |
| **Wed 4/29** | Frontend auth rollout + reports + ATTOM + **start criteria live-fire** | A-06, A-08, R-01, R-02, D-09, **P-20** |
| **Thu 4/30** | Reports + data + **provenance hardening kicks off** | R-03, R-04, R-07, D-03, D-04, **P-21** |
| **Fri 5/1** | Analytics + SLA + close M1 + **close P-19/P-20** | R-08, D-02, D-05, **P-19**, **P-20** |
| **Sat-Sun** | Buffer / catchup |  |
| **Mon 5/2 (M2)** | Eventing + foundation + **close P-21** | A-03, E-01, F-02, **P-21** |
| **Tue 5/3** | Logging | F-03 |

**Parallelism:** Each day's items split across Dev 1 (auth), Dev 2 (reports + Pipeline live-fire), Dev 3 (data integration). The live-fire / provenance lane is owned by Dev 2 alongside reports — Dev 2's load doubles this week, so consider pulling Dev 4 onto Pipeline if the test setup work proves heavier than estimated.

---

## PART D — Cross-references

- **Master backlog:** [PRODUCTION-READINESS-BACKLOG.md](PRODUCTION-READINESS-BACKLOG.md) — broader item list (162 items, 67 done)
- **Sprint plan CSV:** [PRODUCTION-READINESS-PLAN.csv](PRODUCTION-READINESS-PLAN.csv) — 104 rows with dates, owners, story points
- **Engagement event stream plan:** [ENGAGEMENT-EVENT-STREAM-PLAN.md](ENGAGEMENT-EVENT-STREAM-PLAN.md)
- **AI assistant production readiness:** [AI-ASSISTANT-PRODUCTION-READINESS-PLAN.md](AI-ASSISTANT-PRODUCTION-READINESS-PLAN.md)
- **Last week's deliverables:** captured in this week's appendix below

---

## PART E — Last week's accomplishments (for context)

22 items shipped between 2026-04-23 and 2026-04-27 — none from this week's planned list (was net-new feature velocity from the engagement-event-stream and AI-assistant tracks). Full breakdown:

**Existing CSV items closed early (4):** C-03, C-05, J-03, B-06.
**New rows added as Done (18):** J-10–J-12 · P-13–P-18 · B-08 · C-10–C-11 · F-06–F-10 · H-06.

See change log at the bottom of `PRODUCTION-READINESS-BACKLOG.md` for the full sprint summary.

---

## PART F — Daily log

Append a line for each working session. Format: `YYYY-MM-DD HH:MM — short note`. Keep blockers visible.

### Mon 2026-04-27
- 11:30 — P-19 mocked-path coverage **shipped**. Audit identified 5 gaps (steps e, f, qc-issue events, QCIssueRecorderService 0-coverage, refreshFromExtractionRun untested). All 5 closed: 17 new test assertions across 3 files (`axiom-pipeline-result-stamping.test.ts`, new `qc-issue-recorder.service.test.ts`, `canonical-snapshot.service.test.ts`). Full extraction-journey backend suite now **114/114 green**.
- Step (g) `AxiomInsightsPanel` render test **deferred to E2E** per `vitest.config.mts` project pattern; tracked as Playwright follow-up (now closed below).
- 12:00 — P-19 closure **shipped**. Three deliverables landed:
  - Backend webhook → service e2e test (`axiom-webhook-end-to-end.test.ts`, 3 cases)
  - Playwright spec (`axiom-insights-extraction-journey.live-fire.spec.ts`)
  - Live-fire runbook (`current-plan/P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md`) with manual UI checklist
- Backend suite now **117/117 green** (+3 new e2e webhook tests). **P-19 code work complete** — only operational live-fire run remains (use `AXIOM_FORCE_MOCK=true` until Axiom cluster un-deferred).
- Next: P-20 criteria evaluation journey kickoff (same audit-first → enhance-tests → write-runbook flow).

### Tue 2026-04-28
- Auto-auth shipped for live-fire Playwright. `playwright.config.ts:configureAutoAuth()` mints a fresh test JWT and exports `VITE_BYPASS_AUTH=true` + `VITE_TEST_JWT=<jwt>` BEFORE the Vite dev server starts. Backend `unified-auth.middleware.ts` + `authorization.middleware.ts` accept the test token and synthesize an admin profile (dev/test only — gated by `NODE_ENV !== 'production'`). No interactive sign-in step anywhere in the loop. Backend `.env` `ALLOWED_ORIGINS` extended for ports 4173/5174.
- **P-19 Playwright spec PASSES** end-to-end against `seed-order-003`: `1 passed (21.8s)`. Smoke mode (NOTE-no-criteria.txt — fixtures lack real Axiom criteria yet).
- **P-20 Playwright spec PASSES** end-to-end against `seed-order-003`: `1 passed (32.7s)`. QCOverrideAuditPanel rendered (real audit data); issues + verdict in smoke mode pending fixture data. Spec endpoint fix: now polls `/api/orders/:orderId/qc-issues` (was `/api/qc/issues`).
- P-19 + P-20 runbooks updated with auto-auth flow, port override (`LIVE_UI_PORT=5174` to avoid conflict with dev workflow's 4173), CORS gotcha, and `--mode test` Vite flag explanation.
- Next: graduate both specs from smoke mode → full verification by populating real Axiom criteria via `npm run axiom:livefire:analyze-webhook`. Cascade re-eval gap (P-20 step h) still open as a separate ticket.

### Wed 2026-04-29
-

### Thu 2026-04-30
-

### Fri 2026-05-01
-

### Sat-Sun 2026-05-02 / 2026-05-03
-

---

## PART G — Blockers / risks raised this week

Add any new external dependencies, partner waits, or surprises here. Carry forward into next week's plan if unresolved.

-

---

## PART H — End-of-week roll-up (fill in Friday EOD)

**Items completed this week:**

**Items rolled into next week:**

**New items discovered:**

**Velocity:** ___ / 51 active points + ___ / ~36 overdue points + ___ / 21 live-fire points

**Notes / sprint retro:**
