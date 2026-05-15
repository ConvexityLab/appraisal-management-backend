# Property Canonical Architecture — Operational Runbook

**Created:** 2026-05-xx  
**Scope:** Appraisal Management Backend — property canonical pipeline from intake through QC verdict  
**Audience:** On-call engineers, SRE, QA

---

## 1 — Architecture overview

```
Intake (bulk / manual / doc-first)
  │
  ▼
Order + canonical snapshot created
  │  (loanPropertyContextId links order → canonical)
  ▼
Review context prepared (source-priority resolution)
  │  (sourceIdentity lineage propagated to run-ledger records)
  ▼
Engine dispatch: Axiom (criteria) + MOP/Prio (pricing)
  │
  ▼
RunLedgerRecord stamped with:
  - status / verdictCounts / terminalOutcome
  - criteriaStepRunIds (Axiom engine run references)
  ▼
QC panels + report builder read run-ledger records
```

### Key identifiers

| Identifier | Where set | Purpose |
|---|---|---|
| `orderId` | Order creation | Primary key for an appraisal order |
| `loanPropertyContextId` | Canonical snapshot | Foreign key that ties order to property canonical record |
| `canonicalSnapshotId` | RunLedgerRecord | Snapshot in effect at the time of the run |
| `engagementId` | Order / run-ledger | Groups re-runs for the same engagement |
| `criteriaStepRunIds` | RunLedgerRecord | List of Axiom criteria engine run IDs |

---

## 2 — Services and their roles

| Service | File | Responsibility |
|---|---|---|
| `AxiomService` | `src/services/axiom.service.ts` | Dispatches criteria to Axiom engine; stamps `verdictCounts` + `terminalOutcome` on run completion |
| `ReviewRequirementResolutionService` | `src/services/review-requirement-resolution.service.ts` | Resolves compiled criteria against source-priority context; builds per-criterion resolution objects including comp/adjustment category |
| `CriteriaReevaluationHandlerService` | `src/services/criteria-reevaluation-handler.service.ts` | Listens for `qc.criterion.reevaluate.requested` events; runs cascade reevaluation with Cosmos distributed lock |
| `ReviewProgramOrchestrationService` | `src/services/review-program-orchestration.service.ts` | Orchestrates Axiom + MOP/Prio dispatch; owns the prepared-context dispatch path |
| `CosmosDbService` | `src/services/cosmos-db.service.ts` | Thin Cosmos DB wrapper; 409 conflicts returned as `{ success: false }` |

### Cosmos containers

| Container | Partition key | Key document types stored |
|---|---|---|
| `run-ledger` | `tenantId` | `run-ledger-entry`, `reevaluation-lock` |
| `orders` | `tenantId` | order records |
| `aiInsights` | `tenantId` | criteria evaluation poll results |
| `documents` | `tenantId` | uploaded document records |

---

## 3 — RunLedgerRecord status lifecycle

```
created → dispatching → evaluating → completed | failed | cannot_evaluate
```

### `terminalOutcome` field

Stamped on the run-ledger record when the Axiom evaluation result meets specific
conditions. Only set when the run cannot produce a normal pass/warn/fail verdict.

| Value | Condition |
|---|---|
| `cannot_evaluate` | Every evaluated criterion returned `cannot_evaluate` and none passed, warned, or failed |
| `skipped_missing_requirements` | Run was skipped because required data or documents were absent at dispatch time |
| `evaluation_error` | Reserved for unrecoverable engine errors; not yet auto-stamped |

### `verdictCounts` shape (inside `statusDetails`)

```typescript
{
  passCount: number;
  warnCount: number;
  failCount: number;
  totalCount: number;
  cannotEvaluateCount: number;
}
```

---

## 4 — Startup configuration requirements

The API server (`api-server.ts`) validates the following at startup.  
**Missing values in production cause `process.exit(1)`.**

| Variable | Behaviour when missing |
|---|---|
| `AXIOM_API_BASE_URL` | Warn — Axiom uses mock mode |
| `API_BASE_URL` | Warn — Axiom webhooks will fail |
| `AXIOM_WEBHOOK_SECRET` | Warn — `submitOrderEvaluation` will throw |
| `STORAGE_CONTAINER_DOCUMENTS` | Warn — document extraction dispatch fails |
| `AZURE_STORAGE_ACCOUNT_NAME` | Warn — Axiom extraction trigger incomplete |
| `MOP_PRIO_API_BASE_URL` | **ERROR in production** — `throw new Error(...)` → process exits |

### Deployment checklist

- [ ] `MOP_PRIO_API_BASE_URL` is set in the deployment environment
- [ ] `AXIOM_API_BASE_URL` is set (or intentional mock mode is acceptable)
- [ ] `AXIOM_WEBHOOK_SECRET` is configured and matches Axiom's outbound signing key
- [ ] `AZURE_STORAGE_ACCOUNT_NAME` + `STORAGE_CONTAINER_DOCUMENTS` are set
- [ ] Cosmos DB access via managed identity is working (`DefaultAzureCredential`)

---

## 5 — Cascade reevaluation distributed lock

`CriteriaReevaluationHandlerService` listens for `qc.criterion.reevaluate.requested`
Service Bus events and runs a cascade reevaluation when a corrected field affects
dependent criteria.

### Lock strategy

- Lock documents are written to the `run-ledger` Cosmos container with  
  `type: 'reevaluation-lock'` and a Cosmos-enforced unique `id`.
- Lock ID format: `reeval-lock:<orderId>:<normalizedField>:<newValueJson>` (truncated to 255 chars).
- On a 409 conflict (`createItem` returns `{ success: false }`),  
  the current instance skips processing — another instance owns the job.
- The lock is deleted in a `finally` block after processing completes or throws.

### Diagnosing stuck locks

If a lock document was not deleted (e.g., instance crashed mid-processing):

```bash
# In Cosmos Data Explorer — run-ledger container
SELECT * FROM c WHERE c.type = 'reevaluation-lock'

# Delete a stuck lock (use actual id and tenantId):
# DELETE document by id = 'reeval-lock:<key>' partition = '<tenantId>'
```

Lock documents do not have a Cosmos TTL configured. If stuck locks are common,
add a TTL of 300 s to the container default (do this via Bicep — never in code).

---

## 6 — Criterion-level blocker detection

`ReviewRequirementResolutionService.resolveCompiledCriterion()` now derives the
comp/adjustment category from `CompiledCriterion.category` (e.g.
`'comparableSalesAnalysis'`, `'adjustmentGrid'`) rather than path-keyword inference.

### Category derivation rules

| `criterion.category` substring | Derived path category |
|---|---|
| `comparable`, `comp`, `salescomparison` | `comp` |
| `adjustment` | `adjustment` |
| *(anything else or absent)* | no map — keyword fallback remains active |

If a criterion category is missing from the compiled schema, the service falls
back to the static `COMP_PATH_KEYWORDS` / `ADJUSTMENT_PATH_KEYWORDS` arrays in
`ReviewRequirementResolutionService`. This is logged at debug level only.

---

## 7 — Common operational procedures

### 7.1 — Re-run a single order through Axiom

```http
POST /api/orders/:orderId/review-programs/:programId/submit-prepared
Content-Type: application/json
Authorization: Bearer <token>

{ "engineProgramId": "axiom-base", "engineProgramVersion": "1" }
```

Check run-ledger for the resulting record:

```http
GET /api/orders/:orderId/run-ledger
```

Look for the newest entry with `criteriaStepRunIds` populated.

### 7.2 — Diagnosing a `cannot_evaluate` terminal run

1. Fetch run-ledger record — confirm `terminalOutcome === 'cannot_evaluate'`  
   and `verdictCounts.cannotEvaluateCount > 0`.
2. Fetch Axiom evaluation by `criteriaStepRunIds[0]`.
3. For each criterion with verdict `cannot_evaluate`:  
   - Check `resolution.missingDataPaths` — these are the blocking gaps.  
   - Check `resolution.missingDocumentTypes` — missing document groups.
4. Correct the missing data via the order update API or upload the document.
5. Re-run (7.1 above).

### 7.3 — Backfilling verdict counts after a schema migration

Run the backfill script (dry-run first):

```bash
npx ts-node src/scripts/backfill-verdict-counts.ts --dry-run --tenant <tenantId>
npx ts-node src/scripts/backfill-verdict-counts.ts --tenant <tenantId>
```

The script reads run-ledger records that have `criteriaStepRunIds` but no
`statusDetails.verdictCounts`, fetches the Axiom evaluation, and patches the
run-ledger document in place.

### 7.4 — Confirming MOP/Prio is reachable

```bash
curl -sf "$MOP_PRIO_API_BASE_URL/health" | python3 -m json.tool
```

If this fails, the MOP/Prio leg of every review program dispatch will throw.
Fix the `MOP_PRIO_API_BASE_URL` environment variable and restart the service.

---

## 8 — Alerts and SLIs (reference thresholds — adjust in monitoring config)

| Signal | Threshold | Action |
|---|---|---|
| Run-ledger records with `terminalOutcome = 'cannot_evaluate'` | > 20 % of runs in a 1 h window | Page on-call — likely missing data feed |
| `reevaluation-lock` docs older than 10 min | any | Page on-call — cascade reevaluator may be crashed |
| `MOP_PRIO_API_BASE_URL` health check failure | > 3 consecutive | Page on-call |
| Axiom webhook 5xx rate | > 5 % in 5 min | Warn |

---

## 9 — Open items (not yet implemented)

- [ ] Cosmos TTL on `reevaluation-lock` documents (set via Bicep ARM param — NOT in code)
- [ ] Hard-gate startup on any critical background-job bootstrap failure  
  (`startBackgroundJobs` currently swallows errors and continues serving traffic)
- [ ] QC operator panel and report-builder surfaces wired into primary page flows
- [ ] Partial-dispatch UX (failed engine leg indicators in primary run-history card)
