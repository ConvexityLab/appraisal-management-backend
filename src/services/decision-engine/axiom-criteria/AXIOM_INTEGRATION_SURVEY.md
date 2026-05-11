# Axiom Criteria Integration — Survey

**Phase L of `docs/DECISION_ENGINE_RULES_SURFACE.md`.**

Mandatory survey commit before integration code lands. Captures what we
learned about the existing Axiom integration so the Phase L decision
between Option A (AMS-authored, pushed to Axiom) and Option B
(Axiom-authoritative, mirrored into Decision Engine) is grounded in
reality.

## Findings

### 1. Where Axiom stores criteria

Axiom owns criteria storage. Criteria are addressed by
`(clientId, subClientId, programId, programVersion)` — there is no
single-document "criteria pack" surface that AMS pushes to.

Evidence:
- `AxiomService.getCompiledCriteria(clientId, subClientId, programId, programVersion, force?)` —
  AMS calls Axiom to fetch the COMPILED criteria for a given
  `(programId, programVersion)`. Cache key is the four-tuple.
- The pipeline definitions in `AxiomService` include a `load-criteria`
  stage that takes `programId + subClientId` from the trigger payload
  and resolves criteria server-side. AMS never passes criteria inline.
- `ReviewProgram.aiCriteriaRefs?: Array<{programId, programVersion}>` —
  the platform already references Axiom-stored criteria sets by handle,
  not by content.

### 2. Where Axiom stores evaluation results

Two layers:

- **Axiom-side authoritative store**: `evaluation-results` container in
  Axiom's Cosmos. One doc per `(scopeId, criterionId, runId)`. Append-only.
- **AMS-side proxy / mirror**: `aiInsights` container
  (`AxiomService.containerName = 'aiInsights'`). Caches result docs
  per `evaluationId` so AMS reads don't hit Axiom every time.

`AxiomEvaluationResultDoc` shape includes:
- `resultId`, `evaluationRunId`, `scopeId`, `criterionId`, `criterionName`
- `evaluation` (verdict), `confidence`, `reasoning`, `remediation`
- `evaluatedAt`, `programId`, `programVersion`
- `manualOverride`, `overriddenBy`, `overrideReason` — **already has
  the M.1 override surface natively!**

### 3. How tenantId joins to results

Result docs do NOT carry `tenantId` directly. They're keyed by `scopeId`.
The join path:

```
AMS:  AxiomExecutionRecord { tenantId, orderId, axiomJobId } in aiInsights
                            ↓
Axiom: scope (per loan / per document) → criterionId result docs
```

To enumerate "all Axiom decisions for tenant T":
1. Query `aiInsights` for `AxiomExecutionRecord` docs with `tenantId = T`.
2. For each, follow `axiomJobId` to result docs (also in `aiInsights` via
   the cached proxy, or in Axiom's `evaluation-results` via REST).

This means there's a real query path, just multi-step.

### 4. How operators currently edit criteria

Today: through Axiom's own UI / API, NOT through AMS. The platform's
review-program documents reference Axiom criteria sets via
`aiCriteriaRefs[]` but no AMS surface authors them.

## Integration design recommendation

**Hybrid (lean toward Option A, with a key adjustment):**

- **Authoring lives in AMS.** Decision Engine workspace's
  AxiomCriteriaEditor (Phase H) is the operator surface for criterion
  text + expected answer + rubric + weight.
- **Publishing creates an Axiom criteria set.** On `createVersion` for
  `axiom-criteria` category, AMS calls an Axiom "register criteria set"
  endpoint (needs Axiom-side work — does NOT exist today). The endpoint
  accepts a list of criteria + returns the canonical
  `(programId, programVersion)` Axiom assigns it.
- **AMS stores the mapping.** The Decision Engine pack doc gets stamped
  with `axiomProgramId + axiomProgramVersion` so downstream evaluations
  reference the published criteria.
- **Reading results uses the existing flow.** No new container — we
  proxy through `aiInsights` exactly as the existing AMS reads do.

This requires NEW Axiom-side work (the "register criteria set" endpoint).
Until that ships, the Decision Engine workspace for axiom-criteria
remains "edit-only" with no live evaluator path.

## Phase L delivery plan (in order)

1. ✅ **L0 — Survey commit (this doc).**
2. **L1 — AxiomCriteriaResultsReader stub** that documents the
   `aiInsights` query path. Returns `{ pending: true }` analytics
   summary; FE surfaces a clear "Axiom evaluator integration pending"
   message (better than 501 — explains what's coming).
3. **L2 — Axiom-side endpoint** (separate PR, separate repo):
   `POST /api/criteria-sets` accepting AMS's authored criteria, returns
   `(programId, programVersion)`.
4. **L3 — AxiomCriteriaPusher** in AMS, wired into the
   `onNewActivePack` hook for `category = 'axiom-criteria'`. Stamps
   `axiomProgramId/Version` back onto the AMS pack.
5. **L4 — Full reader implementation** that joins
   `AxiomExecutionRecord` (tenantId-scoped) to result docs and projects
   into the Decision Engine analytics shape. Lights up the Analytics
   tab end-to-end.
6. **L5 — Replay** (mechanically hardest — LLM-based replay needs Axiom
   to support stateless preview against proposed criteria; flag deferred
   on Axiom's API survey).

## What lands today

- This survey doc (L0).
- `axiom-criteria-results-reader.service.ts` stub (L1) — returns a
  `{ status: 'pending', reason: 'axiom-evaluator-integration-pending' }`
  shaped result that the FE recognises and renders inline.
- `AxiomCriteriaCategory.analytics` wired to the stub so the Analytics
  tab no longer returns 501 — operators see "pending: needs Axiom
  endpoint" with a link to this doc.

L2/L3/L4/L5 are sized in a follow-up PR once the Axiom-side endpoint
question is answered.
