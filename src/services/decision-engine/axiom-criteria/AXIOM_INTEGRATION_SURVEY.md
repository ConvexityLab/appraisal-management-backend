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

## ⚠️ Tenant trust boundary — read carefully

`AxiomCriteriaPusher` (L3) authenticates to Axiom with a **single shared
bearer token** (`AXIOM_API_KEY`) and sends `tenantId` as a body field.
That means **AMS is trusting Axiom to enforce the tenant boundary** —
there is no per-tenant credential and no signed assertion AMS could
verify on its side.

If Axiom is misconfigured (e.g. ignores the body `tenantId`, or routes
all callers to the same tenant scope), AMS cannot detect the failure:
the push returns 2xx with whatever `(programId, programVersion)` Axiom
assigns, and downstream evaluations may run against the wrong tenant's
criteria without any AMS-visible signal.

Required mitigations before L3 goes to production:

1. **Axiom-side contract test** that demonstrates body `tenantId` is
   honored (per-tenant rows in `evaluation-results`, per-tenant
   visibility rules on `GET /api/criteria-sets/:id`). The Axiom team
   owns this test; AMS reviews it before turning on push.
2. **Per-tenant scoped tokens (preferred)** OR **HMAC of the criteria
   payload + tenantId, signed with a per-tenant key the receiver
   verifies**. Either approach moves the enforcement from "Axiom
   trusts the body" to "the wire format itself binds payload to tenant".
3. **AMS-side audit row** (`decision-rule-audit`, `action: 'axiom-push'`)
   stamped on every push outcome — including the returned
   `(programId, programVersion)` — so cross-tenant routing can be
   detected after the fact by reconciliation against Axiom's own logs.

Until #1 lands the pusher should run in dev/staging only. Production
turn-on is gated on the contract test passing.

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
