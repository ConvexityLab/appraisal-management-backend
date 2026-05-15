# P-20 — Criteria Evaluation Journey Live-Fire Runbook

**Created:** 2026-04-27
**Last Updated:** 2026-04-28 (auto-auth flow shipped + first PASS recorded)
**Owner:** Dev 2 (Pipeline lane)
**Tracks:** [WEEKLY-PLAN-2026-04-27.md → P-20](./WEEKLY-PLAN-2026-04-27.md)
**Backlog references:** A-08, A-09, Q-02 in [PRODUCTION-READINESS-BACKLOG.md](../../l1-valuation-platform-ui/PRODUCTION-READINESS-BACKLOG.md)
**Depends on:** [P-19 extraction live-fire](./P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md) — criteria evaluation runs after extraction lands.

---

## What this runbook does

P-20 verifies the **criteria evaluation journey**:

| Step | What we verify | Status today |
|------|----------------|--------------|
| (a)  | Criteria pipeline runs after extraction (auto-trigger or manual) | Confirmed via [docs/AXIOM_CRITERIA_API.md](../docs/AXIOM_CRITERIA_API.md) — Axiom exposes `criteria-only-evaluation` as a SEPARATE pipeline. NOT auto-chained from extraction. **Live-fire confirms** |
| (b)  | Criterion verdicts (pass/fail/warning) appear with confidence + reasoning + remediation | Mocked-path: ✅ `axiom-webhook-end-to-end.test.ts` (P-19). Live-fire confirms real Axiom shape |
| (c)  | `qc.issue.detected` event fires per failing criterion | ✅ Covered by `axiom-webhook-end-to-end.test.ts` (P-19) — 3 tests |
| (d)  | `QCIssueRecorderService` writes records to `aiInsights` | ✅ Covered by `qc-issue-recorder.service.test.ts` (P-19) — 8 tests |
| (e)  | `applyAxiomPrefill` populates `aiVerdict` on QC checklist items | ✅ **NEW** `axiomQcBridge.test.ts` — 15 tests |
| (f)  | `QCIssuesPanel` renders open + resolved issues | E2E (Playwright spec below) |
| (g)  | `QCOverrideAuditPanel` reflects reviewer corrections | E2E (Playwright spec below) |
| (h)  | Cascade re-eval fires when corrected field has dependent criteria | ⚠️ **PARTIAL — see Part 4** |

---

## Part 1 — Backend coverage you have today

### Step (e) — applyAxiomPrefill bridge

**Run:**
```bash
cd c:/source/l1-valuation-platform-ui
npx vitest run src/utils/__tests__/axiomQcBridge.test.ts
```

**Expected:** `15 passed (15)`. Covers:
- Empty criteria fast-path (referential equality)
- Items with no `axiomCriterionIds` pass-through
- IDs with no Axiom match pass-through
- Single-match populates aiVerdict / aiReasoning / aiDocumentReferences / aiRemediation / aiConfidence
- Multi-match takes the WORST verdict (fail > warning > pass) — three sub-tests
- Multi-match unions documentReferences across criteria
- Multi-match concatenates reasoning with `•` separator
- Remediation comes from worst-matched criterion
- All three buckets (errors / warnings / passed) are processed
- Input is never mutated
- aiConfidence comes from FIRST matched criterion (current behavior pinned)
- Edge cases: empty reasoning omitted, empty documentReferences omitted

### Steps (c) + (d) — qc.issue.detected and QCIssueRecorderService

Both already verified by P-19 work. Re-run to be sure:
```bash
cd c:/source/appraisal-management-backend
npm run test:unit -- tests/unit/qc-issue-recorder.service.test.ts tests/unit/axiom-webhook-end-to-end.test.ts
```

---

## Part 2 — Backend live-fire (steps a/b)

The same `analyze-and-webhook` script we use for P-19 also exercises the criteria stage (the `PIPELINE_RISK_EVAL` pipeline runs both `process-documents` and `evaluate-criteria` stages). Re-use the P-19 runbook setup.

### Run 2.1 — Same command, watch for criteria fields

```bash
# Same env vars as P-19 (see P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md prereqs)
cd c:/source/appraisal-management-backend
npm run axiom:livefire:analyze-webhook
```

**P-20-specific assertions to watch for in the script output:**
- `informativeCriteriaCount > 0` — confirms verdicts came back
- `hasCriteriaAggregate=true` — confirms `aggregateResults` was populated

**Manual curl after run completes** — confirm criteria fields landed in Cosmos:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$AXIOM_LIVE_BASE_URL/api/axiom/evaluations/order/$AXIOM_LIVE_ORDER_ID" | \
  jq '.data[0].criteria[] | {criterionId, evaluation, confidence, hasReasoning: (.reasoning | length > 0), hasRemediation: (.remediation // "" | length > 0), refCount: (.documentReferences | length)}'
```
Expect each criterion to have:
- `evaluation` ∈ {`pass`, `fail`, `warning`}
- `confidence` numeric in [0, 1]
- `hasReasoning: true`
- `hasRemediation: true` for fail/warning verdicts
- `refCount > 0` so the UI can render source citations

### Run 2.2 — Direct criteria-only pipeline (alternative)

Per [docs/AXIOM_CRITERIA_API.md](../docs/AXIOM_CRITERIA_API.md), Axiom exposes a `criteria-only-evaluation` pipeline that can be invoked separately. Useful when extraction already ran and you want to re-evaluate with a different `programId`/`programVersion`:

```bash
curl -X POST $AXIOM_LIVE_BASE_URL/api/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-client-id: $AXIOM_LIVE_CLIENT_ID" \
  -H "x-sub-client-id: $AXIOM_LIVE_TENANT_ID" \
  -H "content-type: application/json" \
  -d '{
    "pipelineId": "criteria-only-evaluation",
    "input": {
      "fileSetId": "<previously-extracted-fileSet>",
      "clientId": "'"$AXIOM_LIVE_CLIENT_ID"'",
      "subClientId": "'"$AXIOM_LIVE_TENANT_ID"'",
      "programId": "FNMA-1004",
      "programVersion": "1.0.0"
    }
  }'
```
The webhook flow that fires on completion is identical to the combined-pipeline path, so steps (c)/(d)/(e) verification is unchanged.

---

## Part 3 — Frontend live-fire (steps f/g)

### Run 3.1 — Playwright spec

The spec at `e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts` drives the QC review page (`/qc/{orderId}`) and verifies QCIssuesPanel + QCOverrideAuditPanel + QCVerdictReasoningPanel render correctly. **`LIVE_UI_QC_REVIEW_ID` is the order ID** — the QC route accepts an order ID directly (see `src/app/(control-panel)/qc/[id]/page.tsx`).

Auth is fully automated via `playwright.config.ts:configureAutoAuth()` — see [P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md](./P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md#one-time-setup) section 4 for the full description. Just ensure `TEST_JWT_SECRET` is in the backend `.env` (it is, in our local + staging environments).

The spec runs in **smoke-test mode** when fixtures don't have qc-issues / verdicts yet (writes `NOTE-no-issues.txt` / `NOTE-no-verdict.txt` and passes). Full step (f)/(e) assertions fire only when fixtures with real qc-issues + axiomCriterionIds are present.

```bash
cd c:/source/l1-valuation-platform-ui
VITE_API_BASE_URL=http://localhost:3011 \
LIVE_UI_PORT=5174 \
LIVE_UI_BASE_URL=http://127.0.0.1:5174 \
LIVE_UI_QC_REVIEW_ID=seed-order-003 \
PW_HEADLESS=true \
  npx playwright test e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts
```

Expected output (smoke mode, 2026-04-28 first-pass run):
```
[playwright config] Auto-auth ready: subject=axiom-live-fire-user, tenant=885097ba-..., token=eyJ...
ok 1 ... › renders QC issues panel + override audit panel + verdict reasoning panel for an order with completed Axiom criteria (~25s)
1 passed (~33s)
```

Artifacts land in `test-artifacts/live-fire/qc-criteria-evaluation-journey/<timestamp>-<reviewId>/`:
- `02-qc-review-page.png`, `03-issues-panel-open.png`, `04-override-audit-panel.png` (when overrides exist)
- `NOTE-no-issues.txt` / `NOTE-no-verdict.txt` (when smoke mode)
- `network.ndjson`, `console.log`, `issues.json`, `session.json`

### Run 3.2 — Manual UI checklist

| # | Action | Expected | If broken |
|---|---|---|---|
| 1 | Navigate to `/qc/{reviewId}` | QC review page loads | Check console for AuthN errors |
| 2 | Click the "AI Issues" toggle button | QCIssuesPanel slides in | If button missing: `useGetQcIssuesForOrderQuery` is empty — confirm backend wrote qc-issues |
| 3 | Verify each open issue shows severity chip + reasoning + source chips | CRITICAL/MAJOR/MINOR coloring matches Axiom verdict severity | Compare to `/api/qc/issues?orderId=...` payload |
| 4 | Click a source chip on an issue | PDF viewer opens at the cited page | If wrong page: `documentReferences[i].page` not propagated; trace `onViewRef` |
| 5 | Click Resolve on an open issue | Issue moves to "Resolved" section; `qc.issue.resolved` audit event fires | Re-fetch via curl to confirm cosmos write |
| 6 | Look above the checklist for the **QCOverrideAuditPanel** card | Visible with Recent / Reason Breakdown / Hot Spots tabs | If missing: no `qc.verdict.overridden` or `qc.field.corrected` events exist for this engagement yet |
| 7 | Click a checklist item with `aiVerdict` populated | QCVerdictReasoningPanel opens with verdict + reasoning + sources | Confirms step (e) end-to-end |
| 8 | Open AxiomInsightsPanel side-by-side; click a citation | Same PDF viewer opens; matches step (h) of P-19 | Same as P-19 manual check |
| 9 | Open browser DevTools → Network → no 4xx/5xx | All requests 200 | Capture failures as discrete tickets |

---

## Part 4 — ✅ Step (h) cascade re-evaluation: GAP CLOSED (T2.5, 2026-04-28)

**Originally discovered during P-20 audit (2026-04-27). Closed 2026-04-28 by T2.5.**

The cascade re-evaluation flow was half-implemented; it is now complete:

- ✅ `engagement-audit.controller.ts:888` publishes `qc.criterion.reevaluate.requested` when a field correction has `cascadeReeval: true`
- ✅ Frontend `CascadeReevaluationPanel.tsx` reads BOTH `qc.criterion.reevaluate.requested` AND `qc.criterion.reevaluated` audit events for display
- ✅ **`src/services/criteria-reevaluation-handler.service.ts`** — new service (519 lines) subscribes to `qc.criterion.reevaluate.requested`, identifies dependent criteria via `EXPLICIT_FIELD_TO_CRITERIA` lookup table (50 URAR-1004-NNN entries) + compiled program inference, calls `AxiomService.submitCriteriaReevaluation()`, polls `aiInsights` Cosmos container every 2s (90s timeout), and publishes `qc.criterion.reevaluated` per criterion with `{oldVerdict, newVerdict, changedFlag}`.
- ✅ **`CascadeReevaluationPanel.tsx`** guarded against events with no concrete `criterionId`
- ✅ **4/4 unit tests passing** (`tests/unit/criteria-reevaluation-handler.service.test.ts`)
- ✅ **Wired into `api-server.ts`** startup/shutdown (non-fatal on startup failure)

### What the handler does
1. Subscribes to `qc.criterion.reevaluate.requested`
2. Deduplicates in-flight by `${orderId}:${fieldNorm}:${newValue}` key
3. Loads order + latest completed evaluation from Cosmos; reads `axiomProgramId`/`axiomProgramVersion`
4. Resolves dependent criteria for the corrected field via explicit lookup + compiled program inference
5. Calls `AxiomService.submitCriteriaReevaluation()` → polls Cosmos for completion
6. Publishes `qc.criterion.reevaluated` per criterion with `{oldVerdict, newVerdict, changedFlag}`
7. On error: publishes error record for all dependent criteria (so frontend doesn't hang in pending state)

### End-to-end Playwright verification (T2.6)

The live-fire Playwright spec at `e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts` has been **hardened** (T2.6 code changes done 2026-04-28):
- Smoke-mode tolerances removed — hard assertions for (a) issue chips, (b) AI verdict, (c) Re-run Criteria
- Step (d/h) added: triggers a field correction → waits for "Cascade Re-Evaluations" panel → asserts ≥1 criterion shows "flipped" or "unchanged" within 100s

**Execution requires live environment** with:
- `LIVE_UI_QC_REVIEW_ID` — a QC review tied to an order with completed Axiom criteria
- `VITE_API_BASE_URL` — running backend with `CriteriaReevaluationHandlerService` active
- Order's QC checklist seed must have `axiomCriterionIds` arrays

Run command:
```bash
cd c:/source/l1-valuation-platform-ui
npx playwright test e2e/live-fire/qc-criteria-evaluation-journey.live-fire.spec.ts
```

---

## Part 5 — Pass / fail criteria for P-20

P-20 is **DONE** when:

- [x] `axiomQcBridge.test.ts` passes locally (15 tests) — closed 2026-04-27
- [ ] Backend live-fire Run 2.1 succeeds against staging (or `AXIOM_FORCE_MOCK=true` locally) AND step (b) curl returns expected criterion shape
- [x] Frontend Run 3.1 (Playwright spec) — first PASS recorded 2026-04-28T02:07Z (smoke mode). T2.6 full-fidelity spec hardened 2026-04-28; **execution against real data pending**.
- [ ] Manual UI checklist (Part 3.2) Steps 1–9 all pass against an order with real Axiom criteria
- [ ] Run artifacts archived under `test-artifacts/p-20/<timestamp>/`
- [x] Cascade re-eval gap (Part 4) — **CLOSED** by T2.5 (`CriteriaReevaluationHandlerService`) 2026-04-28. T2.6 spec updated to verify step (h) end-to-end.

---

## Part 6 — Common gotchas

Inherits all gotchas from [P-19 runbook Part 4](./P19-EXTRACTION-LIVE-FIRE-RUNBOOK.md#part-4--common-gotchas), plus:

1. **Criterion match requires `axiomCriterionIds` on QC checklist items.** If `applyAxiomPrefill` doesn't populate any `aiVerdict`, the QC checklist seed (`qc-checklists.ts`) is missing `axiomCriterionIds` arrays. This is the A-06/A-07 deferred work — once real Axiom criterion IDs land, the checklist seed must be updated to reference them.

2. **`qc.criterion.reevaluated` events now fire** once `CriteriaReevaluationHandlerService` (T2.5) is running. If `CascadeReevaluationPanel` shows "Cascade pending" but never transitions to "flipped"/"unchanged", check: (a) the Service Bus subscription is active, (b) the field being corrected maps to ≥1 criterion in `EXPLICIT_FIELD_TO_CRITERIA`, (c) Axiom criteria pipeline completes within the 90s handler timeout. Previously this was documented as a permanent limitation — it is now resolved.

3. **`programId` mismatch.** If the order was extracted with one program (e.g. `canonical-fnma-1033`) but criteria-only-evaluation is invoked with a different program (e.g. `FNMA-1004`), the criterion IDs won't line up and `applyAxiomPrefill` will produce zero matches.
