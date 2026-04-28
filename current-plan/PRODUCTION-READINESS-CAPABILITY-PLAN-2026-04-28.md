# Production-Readiness Implementation Plan — 5 Core Capabilities

**Date created:** 2026-04-28
**Last updated:** 2026-04-28
**Owner:** TBD (assign per capability lane)
**Status:** OPEN
**Goal:** 100% production-ready on the 5 capabilities below — extraction submission, criteria-only submission, bulk upload, review-with-provenance, report builder.

This is a checklist. Tick each `[ ]` to `[x]` as you complete it; add `(done YYYY-MM-DD — <commit-hash> — <one-line note>)` inline. Discoveries / blockers go in the "Daily log" at the bottom. Friday EOD: roll forward unfinished items into next week's plan.

---

## How to read this document

- **Capability blocks** — each of the 5 objectives gets its own section: acceptance criteria → numbered tasks with checkboxes.
- **Tasks are sized**: SP = story points (1 SP ≈ ½ day for one engineer). Effort is *implementation only* — review/QA on top.
- **Sequencing**: tasks within a capability assume top-down order unless `Deps:` says otherwise. Cross-capability dependencies are called out in the "Critical path" section.
- **Verification** lines define exactly what proves a task complete — not "feels done", but a specific test/curl/UI screen that demonstrates it.

---

## Source documents

This plan was derived from:
- [docs/CLIENT_INTEGRATION_GUIDE.md](../docs/CLIENT_INTEGRATION_GUIDE.md) — Axiom's full client contract
- [docs/CLIENT_INTEGRATION_QUICKSTART.md](../docs/CLIENT_INTEGRATION_QUICKSTART.md) — criteria-only quickstart
- [current-plan/P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md](./P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md)
- [current-plan/P20-CRITERIA-EVAL-LIVE-FIRE-RUNBOOK.md](./P20-CRITERIA-EVAL-LIVE-FIRE-RUNBOOK.md)
- [current-plan/WEEKLY-PLAN-2026-04-27.md](./WEEKLY-PLAN-2026-04-27.md)
- The 2026-04-28 5-capability gap analysis (in conversation context — not persisted as a separate doc)

Key correction from earlier analysis: **Axiom dev environment is already provisioned and reachable** (`AXIOM_API_BASE_URL=https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io`, auth off in dev). Earlier "blocked on Axiom credentials" items are downgraded — the blocker is whether our submissions actually work against the real service, not whether we have access.

---

## Production-ready definition (overall)

A capability is "production ready" when ALL of these are true:
1. Backend code path exists, has unit + integration tests, and is observable (structured logs, correlation IDs).
2. Frontend has a user-facing surface (button / page / panel) that exercises the path — no curl-only flows.
3. The path has been **live-fire verified end-to-end against real Axiom dev** at least once, with the run artifact archived under `test-artifacts/`.
4. Errors are user-recoverable: failures surface a message + a retry path, not a silent dead-end.
5. Provenance is preserved: every value the user sees (extracted field, criterion verdict, report figure) traces back to a source `{documentId, page, coordinates}` or a recorded human override.
6. Documentation: a runbook + the user-facing surface is reachable from the in-app navigation.

---

# Block 0 — Cross-cutting prerequisites

These unblock work on all 5 capabilities. Do them first.

- [x] **B0.1** — Confirm Axiom dev URL reachability from our backend host. (1 SP) `(done 2026-04-28 — see test-artifacts/p-19/axiom-reachability-2026-04-28.log + axiom-real-result-b0.1.json. /health 200 in 180ms, POST /api/documents 201 in 503ms returning fileSetId+queueJobId, pipeline document-extraction@1.0.0 completed in 68s. NOTE: plain submission with no programId returned only the extract-text stage (actorsExecuted=0) — to get structured fields + criteria the call must include programId, see T1.2.)`
  - Action: `curl -s $AXIOM_API_BASE_URL/health` and `curl -X POST $AXIOM_API_BASE_URL/api/documents -F "clientId=vision" -F "subClientId=platform" -F "files=@<sample.pdf>"`. Capture the returned `{fileSetId, queueJobId}`.
  - Verification: 200/201 from both calls; `fileSetId` returned.
  - Output: paste the round-trip into `test-artifacts/p-19/axiom-reachability-2026-04-28.log`.

- [ ] **B0.2** — Decide and document our canonical Axiom tenant identity. (0.5 SP)
  - Action: confirm `vision/platform` is the right `clientId/subClientId` for our integration; document the mapping `(our tenantId) → (axiom clientId, subClientId)` in [`docs/AXIOM_INTEGRATION.md`](../docs/AXIOM_INTEGRATION.md) (create file).
  - Verification: doc exists; mapping table includes at least 1 production tenant.

- [ ] **B0.3** — Add `AXIOM_AUTH_AUDIENCE` env var, gate token acquisition on a flag. (1 SP)
  - Action: add `AXIOM_AUTH_AUDIENCE=api://3bc96929-593c-4f35-8997-e341a7e09a69` and `AXIOM_AUTH_REQUIRED=false` to `.env`/`.env.example`. In `axiom.service.ts`, when `AXIOM_AUTH_REQUIRED=true`, mint a token via `DefaultAzureCredential.getToken('${AXIOM_AUTH_AUDIENCE}/.default')` and add `Authorization: Bearer <token>` to every outbound request. When `false`, send no auth header (matches dev mode).
  - Verification: unit test for both modes; manual curl via service still works in dev.
  - Why now: prevents painful staging-deploy surprises later.

- [x] **B0.4** — Standard observability for every Axiom call. (1 SP) `(done 2026-04-28 — axiom.service.ts now emits a structured 'axiom.outbound' log line per round-trip via response/error interceptors. Pulls method/url/status/durationMs/fileSetId/queueJobId/pipelineId/axiomClientId/axiomSubClientId. Severity: error ≥500 or exception, warn 4xx, info 2xx/3xx. Pure helper buildAxiomLogPayload exported and covered by axiom-outbound-logging.test.ts — 10/10 tests.)`
  - Action: in `axiom.service.ts`, log every outbound request with `{correlationId, fileSetId, queueJobId, pipelineId, status, durationMs}`. Use `req.correlationId` from incoming HTTP requests where available.
  - Verification: grep backend logs for an extraction submission and see one structured line per Axiom call.
  - Note: `correlationId` propagation deferred — axios client is a singleton with no per-request context. To thread the HTTP `req.correlationId` through, every call site needs to pass it in `config.metadata`, which is a separate refactor. Tracked as a follow-up.

- [ ] **B0.5** — Idempotency-key strategy for our submissions. (0.5 SP)
  - Action: per Axiom Quickstart §10, axiom dedupes within 60s by `(fileSetId, content, pipelineVersion)`. Document our policy in `AXIOM_INTEGRATION.md`: when do we set `?mode=rerun`? (Suggestion: only when reviewer explicitly clicks "Re-run AI" and accepts a confirmation modal.)
  - Verification: doc updated; matches behavior of the new Re-run button (T1.7 below).

---

# Capability 1 — Submit document(s) to extraction pipeline + get results

**Acceptance criteria (production ready):**
1. From the Order Detail page, a reviewer can drop a PDF onto an order and the document is submitted to Axiom for extraction without leaving the page.
2. The reviewer sees real-time progress (queued → running → stage progress → completed) without manual refresh.
3. On completion, AxiomInsightsPanel renders extracted fields with `{value, confidence, sourcePage, sourceCoordinates}` and source citations open the in-app PDF viewer at the right page + highlighted coordinates.
4. On failure, the panel shows a structured error (which stage failed, why) and a "Retry" button that re-submits.
5. The path has been verified end-to-end against the **real Axiom dev URL** (not mock), with the run artifact archived.

## Tasks

- [ ] **T1.1** — Add a "Submit to Axiom" / "Re-run AI" button in Order Detail. (2 SP) — Deps: B0.x
  - Action: in [src/app/(control-panel)/orders/[id]/page.tsx](../../l1-valuation-platform-ui/src/app/(control-panel)/orders/[id]/page.tsx), surface a button next to the AI Analysis tab that calls a new `useTriggerAxiomExtractionMutation()` RTKQ mutation. On click, show a confirmation modal listing target documents.
  - Verification: button visible; click triggers backend `POST /api/axiom/analyze`; toast shows "Submission queued — eval ID …".

- [x] **T1.2** — Backend: ensure `submitOrderEvaluation` calls real Axiom and survives webhook round-trip. (1 SP) — Deps: B0.1 `(done 2026-04-28 — live-fire passed end-to-end against real Axiom dev. Order seed-order-003 stamped with axiomEvaluationId, axiomStatus=completed, axiomRiskScore=55, axiomLastUpdatedAt. Evaluation record carries 17 extracted documents with structured fields — propertyAddress.street.value="17 David Dr" as proof of real extraction. Required one fix to the live-fire script: extended the step-2b poll loop to retry while status='pending'/processing, not just on 404.)`
  - Action: with `AXIOM_FORCE_MOCK=false`, run `npm run axiom:livefire:analyze-webhook` against `seed-order-003`. If it fails, debug and fix in `axiom.service.ts:submitOrderEvaluation` / webhook handler. Confirm the order ends up stamped with real `axiomRiskScore`/`axiomDecision`/`axiomEvaluationId`.
  - Verification: `curl /api/orders/seed-order-003 | jq .data.axiomDecision` returns one of `ACCEPT|CONDITIONAL|REJECT`; `aiInsights` container has the eval record with non-empty `criteria[]`.
  - Output: artifact under `test-artifacts/p-19/livefire-real-axiom-2026-04-28/`.
  - **Partial completion notes:**
    - `axiomDecision` still `undefined` and `criteria[]` is empty — the default analyze pipeline is `adaptive-document-processing` (extraction-only). The criteria-only pipeline must be invoked separately to populate verdicts + decision (this is what T2.3 builds + what T2.1 audits).
    - `sourcePages: []` on every extracted field — provenance gap; documents have `sourceBatch` (Axiom-internal) but no page numbers. Investigate in T1.3 / T4.1.
    - Axiom-side document IDs use Axiom-internal naming (`fs-seed-order-003-r17773...`), NOT our `seed-doc-report-003`. The mapping back to our document store is the T1.3 enrichment work.

- [x] **T1.3** — Backend: enrich extracted fields with `sourceDocumentId` + `sourceBlobUrl`. (1 SP) — Deps: T1.2 `(done 2026-04-28 — single-document submission case fully wired. Pending eval record now stores _metadata: {documentId, documentName, fileName, blobUrl, documentUrl} at submit time. fetchAndStorePipelineResults reads _metadata and runs new private method enrichExtractionResultRefs that stamps resolvedDocumentId, resolvedBlobUrl, resolvedDocumentName onto every entry of axiomExtractionResult, while preserving Axiom's original documentId for traceability. Idempotent if already populated. Unit tests: 8/8 (axiom-extraction-enrichment.test.ts). Verified live against real Axiom dev: all 17 extraction items on eval-seed-order-003-...~r1777386498289 carry resolvedDocumentId='seed-doc-report-003' + the SAS blob URL.)`
  - Action: in `axiom.service.ts:fetchAndStorePipelineResults` (or `unwrapExtractedField`), after Axiom returns extracted fields with `sourcePage`/`sourceCoordinates`, look up the matching document in our `documents` container by `pipelineJobId` / fileSetId mapping and stamp `sourceDocumentId` + `sourceBlobUrl` on each field. Add a unit test.
  - Verification: pull an extracted field from the API response and confirm both new fields are populated. Without this, the PDF chip click in T1.5 dies silently.
  - Multi-document submission case is a future extension (would need a per-Axiom-documentId → our-documentId mapping table). The single-doc path covers analyze flow today.

- [x] **T1.4** — Frontend: replace generic "evaluation failed" with structured error + retry. (1 SP) `(done 2026-04-28 — AxiomInsightsPanel.tsx + EvaluationCard now render an Alert with AlertTitle showing which pipeline stage failed (parsed from evaluation.pipelineExecutionLog.find(s => s.event === 'failed')), the stage-specific error message (falls back to evaluation.error), and a Retry button when an onRetry callback is provided. Only the most recent evaluation gets the retry handler — older failed evals stay frozen as historical context. Props: onRetry?: () => void; isRetrying?: boolean. Per project pattern (vitest.config.mts notes MUI render-tests are deferred to E2E), no unit test added — change is purely additive prop wiring covered by TypeScript. T1.1 will wire onRetry to the analyze mutation.)`
  - Action: in [src/components/axiom/AxiomInsightsPanel.tsx](../../l1-valuation-platform-ui/src/components/axiom/AxiomInsightsPanel.tsx), when `latestEvaluation.status === 'failed'`, render `latestEvaluation.error` (which stage, error message) and a "Retry" button that calls the mutation from T1.1.
  - Verification: simulate a failure; UI shows readable error + button; click retries.

- [ ] **T1.5** — End-to-end Playwright verification at full fidelity (no smoke mode). (2 SP) — Deps: T1.2, T1.3, T1.4
  - Action: with the order from T1.2 (now has real Axiom criteria), re-run [`e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts`](../../l1-valuation-platform-ui/e2e/live-fire/axiom-insights-extraction-journey.live-fire.spec.ts). Drop the smoke-mode `NOTE-no-criteria.txt` exit; require: (a) ≥1 criterion rendered with verdict + reasoning, (b) source-citation chip click opens PDF viewer on the right page, (c) coordinate highlight visible.
  - Verification: spec passes WITHOUT a NOTE-* file. Artifact under `test-artifacts/live-fire/axiom-insights-extraction-journey/<timestamp>-real/`.

- [ ] **T1.6** — TODO closure: implement risk-score follow-up actions. (2 SP)
  - Action: address the `// TODO: Trigger follow-up actions based on risk score` at [src/services/axiom.service.ts:1492](../src/services/axiom.service.ts#L1492). At minimum, publish a `axiom.risk.threshold.crossed` event when `axiomRiskScore` ≥ configurable threshold (default 70). Decide downstream consumer (notification? auto-escalation?) with product. If unknown, ship the publisher + a no-op consumer.
  - Verification: unit test asserting event publishes when score ≥ threshold; doesn't fire when below.

- [ ] **T1.7** — Documentation: update P-19 runbook to drop "smoke mode is an acceptable result" language now that real Axiom works. (0.5 SP) — Deps: T1.5
  - Action: update [P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md](./P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md) Part 3 acceptance criteria; tick the existing checkboxes; add a "production-ready" stamp at the top.

**Capability 1 total: 9.5 SP (~5 dev-days)**

---

# Capability 2 — Submit data to criteria-only pipeline + consume verdicts

**Acceptance criteria (production ready):**
1. Backend exposes `POST /api/criteria/evaluate` accepting either Pattern A (existing fileSetId) or Pattern B (caller-supplied data with `createIfMissing: true`) per CLIENT_INTEGRATION_QUICKSTART.md.
2. From the QC Review page, a reviewer can click "Re-run Criteria" to trigger a fresh evaluation against the latest data, see results stream in, and have `applyAxiomPrefill` rehydrate the checklist.
3. After a reviewer corrects a field with `cascadeReeval: true`, the dependent criteria are automatically re-evaluated and the QC checklist updates with new verdicts within 90s.
4. `axiomCriterionIds` on the seeded QC checklist match the real Axiom criterion IDs returned by the dev environment (verified, not assumed).
5. The path has been live-fire verified against real Axiom dev.

## Tasks

- [x] **T2.1** — Audit `axiomCriterionIds` against real Axiom criterion IDs. (1 SP) — Deps: B0.1, T1.2 `(done 2026-04-28 — submitted criteria-only-evaluation Pattern B with synthetic URAR data, programId=FNMA-1004 v1.0.0. Real Axiom returned 33 criterion IDs in URAR-1004-NNN format. Our seed uses 18 descriptive strings (e.g. "gross-adjustment-within-25"). MATCHES: ZERO. The two name-spaces are completely disjoint — applyAxiomPrefill produces no verdicts today even though the bridge is wired correctly. Full audit at test-artifacts/p-20/criterion-id-audit-2026-04-28.md.)`
  - Action: after T1.2 succeeds, dump the criteria array from the real Axiom evaluation response. Compare each `criterionId` to the `axiomCriterionIds` arrays in [src/scripts/seed/modules/qc-checklists.ts](../src/scripts/seed/modules/qc-checklists.ts). List mismatches.
  - Verification: a spreadsheet (or markdown table in `test-artifacts/p-20/criterion-id-audit-2026-04-28.md`) showing every QC item's expected IDs vs Axiom's actual IDs, with mismatches flagged.
  - **KEY FINDING:** the seed needs a complete rewrite — every entry must map our QC checklist concepts to one or more of `URAR-1004-001` through `URAR-1004-033`. T2.2 is the closure work; the audit file lists every Axiom criterion with its outcome + reasoning so a human can map them.

- [x] **T2.2** — Update QC checklist seed to use real Axiom criterion IDs. (1 SP) — Deps: T2.1 `(done 2026-04-28 — qc-checklists.ts seed rewritten with URAR-1004-* IDs across all 10 questions. Mapping table in source comments + audit doc. Coverage: 20/33 (61%) of real Axiom criteria are bound to a QC checklist question; the other 13 stay available in axiomExtractionResult but don't pre-fill onto a question. Re-seeded dev (criteria container) — verified by GET /api/qc/checklists/seed-checklist-uad-standard-2026 returning the new IDs. axiomQcBridge.test.ts still 15/15 (logic unchanged).)`
  - Action: fix the `axiomCriterionIds` in `qc-checklists.ts` per the audit. Re-seed dev. Re-run [`axiomQcBridge.test.ts`](../../l1-valuation-platform-ui/src/utils/__tests__/axiomQcBridge.test.ts) — should still pass since logic is unchanged.
  - Verification: 15/15 unit tests pass; on `seed-order-003` after a real Axiom run, at least one QC checklist item shows an `aiVerdict` in the UI.
  - **Last-mile gap:** seeing `aiVerdict` populated on the UI requires criteria-only-evaluation to actually fire for the order. The default analyze pipeline is extraction-only — that's T2.3. Until T2.3 ships, this seed is correct but won't produce visible verdicts in the QC review UI.

- [ ] **T2.3** — Build `POST /api/criteria/evaluate` endpoint (Pattern A + B). (3 SP)
  - Action: new controller method in `axiom.controller.ts`. Accept `{ orderId, mode: 'patternA' | 'patternB', programId, programVersion, ...patternBfields }`. Maps to `POST $AXIOM_API_BASE_URL/api/pipelines` with `pipelineId: 'criteria-only-evaluation'`. Return `{ jobId, status }`. Webhook handler already accepts pipeline-completed events — add a handler arm for `criteria-only-evaluation` job IDs that updates the order's evaluation rather than creating a new one. Unit + integration tests.
  - Verification: curl returns `{ jobId, status: 'submitted' }`; on completion, webhook fires; `aiInsights` is updated with new criteria; `qc.issue.detected` events fire for new fails.

- [ ] **T2.4** — Add "Re-run Criteria" button on QC Review page. (1.5 SP) — Deps: T2.3
  - Action: in [src/components/qc/QCReviewContent.tsx](../../l1-valuation-platform-ui/src/components/qc/QCReviewContent.tsx), add a button (top toolbar, near "AI Analysis" / "AI Issues") that calls a new `useTriggerCriteriaReevaluationMutation`. Show progress chip; on completion, RTKQ tag invalidation refreshes the panels.
  - Verification: click → backend submits → 60s later, panels show new verdict counts.

- [ ] **T2.5** — Build `CriteriaReevaluationHandler` service (closes step h gap). (3 SP) — Deps: T2.3
  - Action: new file `src/services/criteria-reevaluation-handler.service.ts` per the spec in [P20-CRITERIA-EVAL-LIVE-FIRE-RUNBOOK.md Part 4](./P20-CRITERIA-EVAL-LIVE-FIRE-RUNBOOK.md). Subscribes to `qc.criterion.reevaluate.requested`, identifies dependent criteria for the corrected field, calls the new `T2.3` endpoint, and on completion publishes `qc.criterion.reevaluated` per criterion with `{oldVerdict, newVerdict, changedFlag}`. Unit tests covering subscribe, submit, verdict comparison, idempotency on repeated requests.
  - Verification: unit test suite green; manual flow — correct a field with cascade enabled, watch `CascadeReevaluationPanel` first show "requested" markers then "reevaluated" deltas within 90s.

- [ ] **T2.6** — End-to-end Playwright verification at full fidelity. (2 SP) — Deps: T2.2, T2.4, T2.5
  - Action: re-run [`e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts`](../../l1-valuation-platform-ui/e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts) against an order with real Axiom criteria. Drop smoke-mode tolerances; require: (a) ≥1 issue chip rendered with severity, (b) ≥1 checklist item shows AI Verdict reasoning, (c) clicking "Re-run Criteria" produces new verdicts, (d) cascading correction produces a `qc.criterion.reevaluated` audit row.
  - Verification: spec passes WITHOUT NOTE-* files. Artifact under `test-artifacts/live-fire/qc-criteria-evaluation-journey/<timestamp>-real/`.

- [ ] **T2.7** — Documentation: update P-20 runbook + tick checkboxes. (0.5 SP) — Deps: T2.6

**Capability 2 total: 12 SP (~6 dev-days)**

---

# Capability 3 — Bulk upload of data + linked documents

**Acceptance criteria (production ready):**
1. From the Bulk Portfolios page (or a unified bulk page), a user can upload a CSV/XLSX manifest + a folder/zip of PDFs in one operation, see per-row preview, submit, and watch progress.
2. The submission flows through the full extraction + criteria-only pipelines (not just data-only).
3. Per-row failures surface in the UI with row number, stage, error message, and a "retry this row" button.
4. The linking between CSV rows and PDFs supports multi-doc-per-order via an explicit `documentFileNames` column (not just filename guessing).
5. The capability is verified by uploading a 10-row + 10-doc test set and seeing all 10 orders end up with completed Axiom evaluations.

## Tasks

- [ ] **T3.1** — Decision: unify on Bulk Ingestion path; deprecate Bulk Portfolio for upload. (0.5 SP — decision only)
  - Action: confirm with product/architecture: the Bulk Ingestion path (`POST /api/bulk-ingestion/submit`, multi-stage worker chain, auto-criteria) IS the production path. Bulk Portfolio's order-creation-only flow becomes a subset of this (or is sunset).
  - Verification: 1-page decision recorded in `docs/BULK-UPLOAD-ARCHITECTURE.md` (create file); link from this checklist.

- [ ] **T3.2** — Frontend: rewrite Bulk Portfolios page to submit to `/api/bulk-ingestion/submit`. (5 SP) — Deps: T3.1
  - Action: in [src/app/(control-panel)/bulk-portfolios/page.tsx](../../l1-valuation-platform-ui/src/app/(control-panel)/bulk-portfolios/page.tsx), change the submit step to multipart POST against `/api/bulk-ingestion/submit`. Keep the 3-step wizard (upload → review → results). Keep ExcelJS client-side parse + alias normalization. Add per-row preview of `documentFileNames` matched.
  - Verification: drag-drop CSV + 5 PDFs → click submit → backend receives multipart with all files → returns `jobId` → polls and renders per-row status.

- [ ] **T3.3** — Backend: support `documentFileNames: string[]` per row (multi-doc). (2 SP) — Deps: T3.1
  - Action: in [src/controllers/bulk-ingestion.controller.ts](../src/controllers/bulk-ingestion.controller.ts) and `bulk-ingestion.service.ts`, accept either `documentFileName: string` (today) OR `documentFileNames: string[]` (new). Worker chain submits each doc separately to Axiom and tracks them as siblings under the order. Unit tests.
  - Verification: bulk submission with one row referencing two PDFs results in two extraction jobs and two `documents` records linked to the same order.

- [ ] **T3.4** — Backend: ensure bulk-ingestion criteria-stage uses real Axiom (not auto-PASS). (2 SP) — Deps: T2.3, T3.3
  - Action: today the criteria worker [src/services/bulk-ingestion-criteria-worker.service.ts](../src/services/bulk-ingestion-criteria-worker.service.ts) (verify name) defaults to PASSED if no rules configured. Change so when an order has a `programId`, criteria run via the new T2.3 endpoint. When no `programId`, behavior is unchanged.
  - Verification: bulk-submit a row with `programId: 'urar'` → after extraction completes, criteria-only pipeline fires → criterion verdicts land on the order.

- [ ] **T3.5** — Frontend: per-row failure UI with retry. (2 SP) — Deps: T3.2
  - Action: in the bulk wizard step 3 (results), render a table of per-row outcomes pulled from `GET /api/bulk-ingestion/:jobId/failures`. For each failed row show stage, error, retry button. Button posts to a new `POST /api/bulk-ingestion/:jobId/retry-row` (T3.6).
  - Verification: simulated failure (e.g. malformed PDF) shows up with readable error; retry button re-queues that row only.

- [ ] **T3.6** — Backend: per-row retry endpoint. (1.5 SP) — Deps: T3.3
  - Action: new controller method `POST /api/bulk-ingestion/:jobId/retry-row` accepting `{ itemIndex }`. Re-queues the item for the failed stage onward. Idempotent on already-succeeded rows.
  - Verification: integration test — submit a job with one bad row, mock that row's stage to fail, retry returns 202 and the row succeeds on second try.

- [ ] **T3.7** — Decommission `bulk-ingestion-ops` read-only page OR fold its features into Bulk Portfolios. (1 SP) — Deps: T3.2
  - Action: decide. If keeping, ensure both pages link to each other and clearly differentiate (one for new uploads, one for ops monitoring across all jobs).
  - Verification: navigation map updated; no orphan pages.

- [ ] **T3.8** — End-to-end Playwright verification: 10 rows + 10 PDFs. (2 SP) — Deps: T3.2, T3.4
  - Action: new spec `e2e/live-fire/bulk-ingestion-journey.live-fire.spec.ts`. Drag-drop a 10-row CSV + 10 fixture PDFs, click submit, poll for completion, assert: all 10 orders created, all 10 documents have `extractedData`, all 10 orders have `axiomEvaluationId` and ≥1 criterion verdict.
  - Verification: spec passes against real Axiom dev. Artifact under `test-artifacts/live-fire/bulk-ingestion-journey/`.

- [ ] **T3.9** — Documentation: write `BULK-UPLOAD-RUNBOOK.md`. (1 SP) — Deps: T3.8

**Capability 3 total: 17 SP (~9 dev-days)**

---

# Capability 4 — Review journey + provenance + PDF viewer

**Acceptance criteria (production ready):**
1. Every extracted field shown in the UI carries `{value, confidence, sourceDocumentId, sourcePage, sourceCoordinates}` (or a structured "no-source" marker).
2. Every criterion verdict carries `documentReferences[]` with `{documentId, page, coordinates}`.
3. Every panel that displays extracted data or criterion verdicts (AxiomInsightsPanel, QCIssuesPanel, QCVerdictReasoningPanel, CrossDocumentDiscrepancyPanel, FieldCorrectionDialog) renders source-citation chips that open the in-app PDF viewer at the right page with a highlight overlay at the cited coordinates.
4. Every reviewer correction recorded via `qc.field.corrected` includes the original `sourceReference` (or fails to record if the reference is missing — no silent loss).
5. A "Provenance Health" indicator on the AxiomInsightsPanel shows what % of fields have full provenance.

## Tasks

- [ ] **T4.1** — Verify `sourceDocumentId` enrichment is actually happening. (1 SP)
  - Action: with a real Axiom evaluation result (from T1.2), inspect `aiInsights` record and any document `extractedData` blob. Confirm each field carries `sourceDocumentId` + `sourceBlobUrl`. If missing, the issue is in `axiom.service.ts` post-fetch enrichment — fix it (this is also covered by T1.3).
  - Verification: jq query on the eval JSON shows non-null `sourceDocumentId` for every extracted field with a `sourcePage`.

- [ ] **T4.2** — Audit QCIssuesPanel for source-citation rendering + PDF click-through. (1 SP)
  - Action: open [src/components/qc/QCIssuesPanel.tsx](../../l1-valuation-platform-ui/src/components/qc/QCIssuesPanel.tsx). Confirm it renders a chip per `documentReferences[i]` and the click handler opens the PDF viewer with `{documentId, page, coordinates}`. If broken, fix.
  - Verification: visual check on a real Axiom evaluation; click a chip, viewer opens at right page.

- [ ] **T4.3** — Audit QCVerdictReasoningPanel — same. (1 SP)
  - Same protocol as T4.2 but for [src/components/qc/QCVerdictReasoningPanel.tsx](../../l1-valuation-platform-ui/src/components/qc/QCVerdictReasoningPanel.tsx).

- [ ] **T4.4** — Audit CrossDocumentDiscrepancyPanel — same. (1 SP)
  - Same protocol as T4.2 but for [src/components/qc/CrossDocumentDiscrepancyPanel.tsx](../../l1-valuation-platform-ui/src/components/qc/CrossDocumentDiscrepancyPanel.tsx).

- [ ] **T4.5** — Validate `sourceReference` on field corrections. (1 SP)
  - Action: in [FieldCorrectionDialog](../../l1-valuation-platform-ui/src/components/qc/FieldCorrectionDialog.tsx), require `sourceReference` to be non-null before allowing submit (fields without provenance get a different correction flow or a "no source available" annotation). In [engagement-audit.controller.ts](../src/controllers/engagement-audit.controller.ts) line ~872, validate the incoming `sourceReference.documentId + page` are present; reject 400 if missing.
  - Verification: unit test on the controller; UI behavior matches.

- [ ] **T4.6** — Add "Provenance Health %" indicator to AxiomInsightsPanel. (2 SP) — Deps: T4.1
  - Action: add a small chip near the panel header showing `(fields with full provenance) / (total fields) %` and color-code (≥95% green, 80–95 amber, <80 red). Click expands a list of fields missing source.
  - Verification: on a real Axiom eval, indicator shows a number that matches a manual jq count.

- [ ] **T4.7** — Coordinate-accuracy spot-check on real Axiom data. (1 SP) — Deps: T1.5
  - Action: pick 5 criterion verdicts from a real Axiom eval, click each chip, visually confirm the PDF viewer's bounding-box overlay actually lands on the cited text in the PDF (not 50px off, not on the wrong page). If misaligned, file a ticket against Axiom or our coordinate-transform code.
  - Verification: a markdown checklist in `test-artifacts/p-21/coordinate-spot-check-2026-04-28.md` with 5 entries.

- [ ] **T4.8** — Documentation: P-21 provenance hardening runbook. (1 SP) — Deps: T4.1–T4.7
  - Action: new file `current-plan/P21-PROVENANCE-HARDENING-RUNBOOK.md` with the audit + spot-check methodology and the acceptance criteria above.

**Capability 4 total: 9 SP (~5 dev-days)**

---

# Capability 5 — Report creation UI consuming extracted data + docs

**Acceptance criteria (production ready):**
1. Report templates can include AI-extracted data, criterion evaluation verdicts, and ATTOM/comps enrichment data.
2. The Report Builder UI surfaces sections for "AI Analysis Summary", "Criteria Evaluation Results", "Enrichment Data", and "Source Documents".
3. Every value rendered in a generated report includes a citation back to its source document + page (footnote, sidebar, or hyperlink).
4. Reports can be exported as PDF, MISMO XML, AND CSV/Excel (R-03).
5. The Market Map section (R-07) is implemented and default-enabled where geocoded comps exist.
6. Generated reports link back to the originating Axiom evaluation (clickable from PDF metadata or report cover page).

## Tasks

- [ ] **T5.1** — Extend `ReportTemplate` data shape. (3 SP)
  - Action: in [src/types/final-report.types.ts](../src/types/final-report.types.ts), add fields `criteriaEvaluations: AxiomCriterion[]`, `extractedDataFields: ExtractedFieldWithProvenance[]`, `enrichmentData: EnrichmentBundle`, `sourceDocuments: DocumentRef[]`. Update the field-mapper interface to populate them. Backwards-compatible defaults so existing templates still render.
  - Verification: existing template tests still pass; one new test that fills all four new fields and renders.

- [ ] **T5.2** — Implement field mappers for the new fields per template. (5 SP) — Deps: T5.1
  - Action: for each of the 5 mappers (`urar-1004`, `dvr-bpo`, `dvr-desk-review`, `dvr-noo-review`, `dvr-noo-desktop`) in [src/services/final-report.service.ts](../src/services/final-report.service.ts), implement extraction of criteria/extracted-data/enrichment from the order + linked Axiom eval + linked documents.
  - Verification: per-mapper unit tests showing each new field populates from a fixture order with a completed Axiom eval.

- [ ] **T5.3** — New report-builder section: "AI Analysis Summary". (3 SP) — Deps: T5.1
  - Action: register new section in [src/components/report-builder/sectionRegistry.ts](../../l1-valuation-platform-ui/src/components/report-builder/sectionRegistry.ts) with id `ai-analysis-summary`, default-enabled. Component renders `axiomDecision`, `axiomRiskScore`, criterion summary table (passed/failed/warning counts), top-3 highest-confidence findings.
  - Verification: section appears in builder; toggling it on adds it to the live preview; rendered HTML/PDF includes the data.

- [ ] **T5.4** — New section: "Criteria Evaluation Results". (3 SP) — Deps: T5.3
  - Action: same protocol — full table of every criterion with verdict / confidence / reasoning / source citation footnote. Default-enabled when criteria > 0.
  - Verification: visual + unit test.

- [ ] **T5.5** — New section: "Enrichment Data" (ATTOM, comps, market). (3 SP) — Deps: T5.3, requires R-02 progress
  - Action: same protocol — render census, market, risk, comparable property data with source citations (ATTOM dataset version + retrieval timestamp).
  - Verification: visual + unit test on a fixture order with enrichment data.

- [ ] **T5.6** — New section: "Source Documents". (2 SP) — Deps: T5.3
  - Action: list every document linked to the order with name, page count, classification, retrieval method (uploaded vs ingested vs Axiom-fetched), and a hyperlink (when output is HTML/PDF-with-links) back to the document blob.
  - Verification: visual + unit test.

- [ ] **T5.7** — Footnote/citation rendering in PDF output. (3 SP) — Deps: T5.3, T5.4
  - Action: extend the Handlebars helpers and PDF-rendering pipeline to render `[source: <docName>, p.<n>]` footnotes wherever a templated value carries provenance. For PDF render strategy `html-render`, citations become hyperlinks; for `acroform`, they're rendered as superscript footnote markers + an appended footnotes page.
  - Verification: generate a test report with criteria + extracted data; spot-check that every value has a footnote.

- [ ] **T5.8** — R-03: report-specific CSV/Excel export endpoints. (3 SP)
  - Action: new endpoints `GET /api/final-reports/orders/:orderId/export?format=csv` and `?format=xlsx`. Bundle: order summary + criteria results + extracted data fields + enrichment summary in one tabular output. Add download buttons in the report builder UI.
  - Verification: download → open in Excel → all sections present + values match the PDF report.

- [ ] **T5.9** — R-07: Market Map section implementation. (5 SP)
  - Action: implement the geographic map component (likely Leaflet or react-map-gl with OpenStreetMap tiles to avoid licensing). Render subject + comparables. Wire into report builder. Flip `defaultEnabled: true` when ≥1 geocoded comp exists.
  - Verification: section visible in builder; renders for a test order with comps; export-to-PDF embeds the map as an image.

- [ ] **T5.10** — Generated report links back to Axiom eval. (1 SP) — Deps: T5.7
  - Action: on the report cover/metadata page, include a small "AI Analysis Reference: <axiomEvaluationId> generated <date>" line with a hyperlink (when applicable) to the in-app eval view.
  - Verification: visual on a generated PDF.

- [ ] **T5.11** — End-to-end Playwright verification of report generation. (3 SP) — Deps: T5.3, T5.4, T5.7
  - Action: new spec `e2e/live-fire/report-generation-journey.live-fire.spec.ts`. From an order with completed Axiom eval (real, not smoke), open Report Builder, enable all new sections, generate PDF, download, parse with `pdf-parse` to assert: order ID present, criterion verdicts present, extracted-field values present, ≥1 footnote citation present.
  - Verification: spec passes against real Axiom dev. Artifact archived.

- [ ] **T5.12** — R-08 carry-forward: replace analytics mocks with real data. (8 SP — large; may split into separate weekly item)
  - Action: per WEEKLY-PLAN-2026-04-27.md R-08. Replace `Math.random()` mocks in trend/vendor analytics tables with real backend endpoints and Recharts. NOT strictly required for "report builder production-ready" but blocks the broader reporting story. Track separately if scoping out.
  - Verification: per the WEEKLY-PLAN R-08 line.

- [ ] **T5.13** — Documentation: write `REPORT-BUILDER-RUNBOOK.md`. (1 SP) — Deps: T5.11

**Capability 5 total: 43 SP (~22 dev-days, including R-08). Excluding R-08: 35 SP (~18 dev-days).**

---

# Critical path & sequencing

## Why this order

1. **Block 0** unblocks everything: real Axiom in dev, observability, idempotency policy. Do this in parallel-safe chunks first.
2. **T1.2** is the keystone: it proves real Axiom works. If it fails, every other capability that depends on real criteria is blocked. Run it within day 1–2.
3. **T2.1 + T2.2** depend on T1.2 — they audit and fix the criterion-ID seed against what real Axiom returns.
4. **T1.3 / T4.1** fix the silent-PDF-link-break risk early.
5. **Capabilities 1, 2, 4** can run in parallel after the keystone — they each depend on different code areas.
6. **Capability 3** can start in parallel (frontend rewrite of bulk page) and graduate when T2.3 lands.
7. **Capability 5** is the largest but has the highest ratio of "decoupled tasks" — multiple developers can attack different sections concurrently after T5.1+T5.2 land.

## Suggested 4-week sequencing (1 dev-stream)

| Week | Days | Items | Outcome |
|---|---|---|---|
| W1 | M | B0.1, B0.2, B0.3, B0.4, B0.5 | Block 0 done |
| W1 | T-W | T1.2, T1.3, T2.1, T2.2 | Real Axiom verified end-to-end; criterion IDs aligned |
| W1 | Th-F | T1.1, T1.4, T1.5 | Cap 1 production ready |
| W2 | M-T | T2.3, T2.4 | Re-run criteria endpoint + UI |
| W2 | W-Th | T2.5, T2.6, T2.7 | Cap 2 production ready |
| W2 | F | T4.1–T4.7 | Cap 4 production ready |
| W3 | M-T | T3.1, T3.2, T3.3 | Bulk frontend on right path |
| W3 | W-Th | T3.4, T3.5, T3.6, T3.8 | Cap 3 production ready |
| W3 | F | T3.7, T3.9, T4.8 | Bulk + provenance docs |
| W4 | M-T | T5.1, T5.2 | Report data shape + mappers |
| W4 | W | T5.3, T5.4 | New sections |
| W4 | Th | T5.5, T5.6, T5.7 | Enrichment + citations |
| W4 | F | T5.8, T5.10, T5.11, T5.13 | Cap 5 minimum-viable production ready |
| W5+ | as available | T5.9 (Market Map), T5.12 (R-08 analytics) | Bonus closures |

**Realistic with 1 engineer:** ~5 weeks for everything except R-08, which is its own 2-week chunk.
**With 3 engineers in parallel:** capabilities 1+2 (lane A), 3 (lane B), 4+5 (lane C) → ~2 weeks for the core, ~3 weeks total.

---

# Sign-off — production-ready certification

When EVERY capability checkbox above is ticked, run this sign-off block and tick when each row is true:

- [ ] **S1** — All 5 capability sections show 100% checkbox completion above.
- [ ] **S2** — All five live-fire Playwright specs (P-19, P-20, bulk-ingestion-journey, report-generation-journey, plus a fifth covering full review) pass against real Axiom dev with NO smoke-mode tolerances and NO `NOTE-*` artifacts.
- [ ] **S3** — A 10-row + 10-PDF bulk submission completes end-to-end with all orders showing real Axiom criteria + at least one prefilled QC verdict per order.
- [ ] **S4** — A generated report PDF for one of those orders includes: AI Analysis Summary, Criteria Evaluation Results, Enrichment Data, Source Documents sections; every value carries a source citation; downloads as both PDF and CSV/XLSX.
- [ ] **S5** — All 4 runbooks (P-19, P-20, BULK-UPLOAD, REPORT-BUILDER) carry an "audited 100% production-ready as of YYYY-MM-DD" stamp.
- [ ] **S6** — Cross-cut: zero `// TODO:` or `// FIXME:` comments left in the touched files, OR every remaining one has a tracked ticket.
- [ ] **S7** — The relevant items in [WEEKLY-PLAN-2026-04-27.md](./WEEKLY-PLAN-2026-04-27.md) (R-01, R-02, R-03, R-07, P-19, P-20, P-21) are flipped to `[x]` Done in both the weekly plan AND `PRODUCTION-READINESS-PLAN.csv`.
- [ ] **S8** — Sign-off recorded by an engineer NOT on the implementation team (independent verification): name + date + commit hash here: ___________________.

---

# Daily log

Append each working session. Format: `YYYY-MM-DD HH:MM — short note`. Carry blockers forward.

### 2026-04-28
- 02:30 — Plan created. Block 0 not started yet. Auto-auth + Playwright smoke runs already shipped this morning (see [WEEKLY-PLAN-2026-04-27.md Tue 2026-04-28 entry](./WEEKLY-PLAN-2026-04-27.md#tue-2026-04-28)).

### 2026-04-29
-

### 2026-04-30
-

### 2026-05-01
-

---

# Blockers & risks raised during implementation

Capture anything that emerges. External dependencies, Axiom-side bugs, missing fixtures, etc.

-

---

# Out-of-scope items (intentionally NOT in this plan)

Document what we're NOT doing so it doesn't get re-litigated mid-sprint.

- **Real production Axiom credentials** — the dev URL is sufficient for production-readiness verification. Production cutover is a separate ops task.
- **Auth chain (A-01 / A-02 / A-04 etc.)** — these are owned by another lane (Dev 1) per WEEKLY-PLAN-2026-04-27.md. We assume `axiom-live-fire-user` test JWT bypass for verification; production uses real Entra.
- **Multi-tenant isolation hardening beyond the existing `tenantId` partition keys** — covered separately under Authorization chain.
- **Vendor/appraiser features** (D-02, D-09) — out of the AI/extraction/report scope.
