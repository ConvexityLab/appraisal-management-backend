# Axiom Criteria-Evaluation API — Client Integration Quickstart

Evaluate documents against a criteria program. **One endpoint, four
patterns** depending on where your data and criteria come from.

For full reference (all options, response shapes, error codes), see
[`CRITERIA_EVALUATION_API.md`](./CRITERIA_EVALUATION_API.md). This doc
is the 5-minute version.

---

## 1. What you need to know

- **Endpoint:** `POST /api/pipelines`
- **Auth:** Azure AD bearer token, audience `api://3bc96929-593c-4f35-8997-e341a7e09a69`
- **Tenant headers:** `x-client-id` and `x-sub-client-id` must match `input.clientId` / `input.subClientId` in the body
- **Pipeline name:** `criteria-only-evaluation`
- **Result format:** poll `GET /api/pipelines/{jobId}` → `GET /api/pipelines/{jobId}/results`
- **Typical wall time:** 50-60 seconds for ~30 criteria

---

## 2. Pick your pattern

| You have… | Use |
|---|---|
| A `fileSetId` from a prior axiom extraction | **Pattern A** — auto-load |
| Raw document data, no axiom extraction | **Pattern B** — ad-hoc |
| Custom criteria not registered in axiom | **Pattern C** — inline criteria |
| Need to tweak a registered program for one call | **+ inlineDelta** (combines with any) |

---

## 3. Pattern A — Evaluate a previously extracted fileSet

Use when axiom has already extracted documents for a `fileSetId` and
you just want to run criteria against that data.

```bash
curl -X POST $AXIOM_BASE/api/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-client-id: my-client" \
  -H "x-sub-client-id: my-tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelineId": "criteria-only-evaluation",
    "input": {
      "fileSetId":      "fs-some-existing-id",
      "clientId":       "my-client",
      "subClientId":    "my-tenant",
      "programId":      "FNMA-1004",
      "programVersion": "1.0.0"
    }
  }'
```

Response:
```json
{ "jobId": "abc123…", "status": "submitted", "estimatedDuration": "~1m" }
```

---

## 4. Pattern B — Evaluate caller-supplied data (no prior extraction)

Use when you have document data from your own systems and want
axiom to evaluate it. **Set `createIfMissing: true`** so axiom
records the evaluation against a new file-sets record using your
chosen `fileSetId`.

```bash
curl -X POST $AXIOM_BASE/api/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-client-id: my-client" \
  -H "x-sub-client-id: my-tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "pipelineId": "criteria-only-evaluation",
    "input": {
      "fileSetId":       "loan-12345-eval-001",
      "clientId":        "my-client",
      "subClientId":     "my-tenant",
      "programId":       "FNMA-1004",
      "programVersion":  "1.0.0",
      "createIfMissing": true,
      "correlationId":   "your-internal-ref",
      "extractedDocuments": [
        {
          "documentId":   "your-doc-id",
          "documentType": "uniform-residential-appraisal-report",
          "confidence":   0.95,
          "metadata":     {},
          "extractedData": {
            "propertyAddress": "123 Main St",
            "salesPrice":      425000,
            "appraisedValue":  430000
          },
          "consolidatedData": {
            "propertyAddress": "123 Main St",
            "salesPrice":      425000,
            "appraisedValue":  430000
          }
        }
      ]
    }
  }'
```

**Document shape**: each entry needs `documentType` + at least one of
`extractedData` / `consolidatedData`. Other fields are advisory.
Match `documentType` to whatever the criteria reference (the registry
publishes the canonical names).

---

## 5. Pattern C — Bring your own criteria

Use when the rules you want to evaluate aren't (yet) registered in
the axiom program registry — what-if analysis, third-party rule
sets, rapid iteration.

```jsonc
{
  "pipelineId": "criteria-only-evaluation",
  "input": {
    "fileSetId":       "ad-hoc-001",
    "clientId":        "my-client",
    "subClientId":     "my-tenant",
    "programId":       "MY-CUSTOM",
    "programVersion":  "0.1.0",
    "createIfMissing": true,
    "extractedDocuments": [/* … */],

    "inlineCriteria": {
      "flatCriteria": [
        {
          "nodeId":           "my-rule-001",
          "tier":             "program",
          "owner":            "my-client",
          "version":          "0.1.0",
          "canonNodeId":      "canon:custom:Appraisal.SalesPriceBand",
          "canonPath":        "Appraisal.SalesPriceBand",
          "taxonomyCategory": "Appraisal",
          "deltaType":        "addition",
          "concept":          "sales-price-reasonable",
          "title":            "Sales price between $50k and $5M",
          "description":      "The contracted sales price must fall within reasonable bounds.",
          "evaluation": {
            "kind":       "llm",
            "promptHint": "Pass if extractedData.salesPrice is between 50000 and 5000000."
          }
        }
        // … more rules …
      ]
    }
  }
}
```

`programId` / `programVersion` are still required for tracking but no
Cosmos lookup happens on them when `inlineCriteria.flatCriteria` is
present.

---

## 6. inlineDelta — request-time tweaks (composes with everything)

Add to the input alongside any of A/B/C to **layer changes on top of
the resolved base criteria**:

```jsonc
"inlineDelta": {
  "removals":  ["URAR-1004-007", "URAR-1004-013"],   // skip these for this run
  "overrides": [/* CriterionNode[] — replace by nodeId */],
  "additions": [/* CriterionNode[] — add new rules */]
}
```

Application order: `removals` → `overrides` → `additions`.

---

## 7. Polling and getting results

```bash
# 1. Check status (poll every 5-15s)
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-client-id: my-client" \
     -H "x-sub-client-id: my-tenant" \
     "$AXIOM_BASE/api/pipelines/$JOB_ID"
# → { "status": "running" | "completed" | "failed" | "completed-partial", … }

# 2. Get results once status = completed
curl -H "Authorization: Bearer $TOKEN" \
     -H "x-client-id: my-client" \
     -H "x-sub-client-id: my-tenant" \
     "$AXIOM_BASE/api/pipelines/$JOB_ID/results"
```

Per-criterion result shape:
```jsonc
{
  "criterionId": "URAR-1004-007",
  "outcome":     "pass" | "fail" | "n/a" | "needs-review",
  "confidence":  0.0,
  "reasoning":   "Cited evidence and rationale.",
  "evidence":    { "salesPrice": 425000, … }
}
```

Aggregate summary lives at `results.aggregateResults[0].summary`:
```json
{ "totalCriteria": 33, "passed": 28, "failed": 4, "notApplicable": 1, "pending": 0, "overallStatus": "fail" }
```

---

## 8. Acquiring the auth token

```bash
TOKEN=$(az account get-access-token \
  --resource api://3bc96929-593c-4f35-8997-e341a7e09a69 \
  --query accessToken -o tsv)
```

Or in a service identity flow (Azure SDKs):

```typescript
import { DefaultAzureCredential } from '@azure/identity';
const credential = new DefaultAzureCredential();
const tokenResponse = await credential.getToken(
  'api://3bc96929-593c-4f35-8997-e341a7e09a69/.default'
);
```

Tokens are short-lived; re-acquire before each call or on `401`.

---

## 9. Common errors

| HTTP | Why | Fix |
|---|---|---|
| 400 `clientId is required` | Missing `input.clientId` | Add it (must match header) |
| 400 `Tenant header/body mismatch` | Header `x-client-id` ≠ `input.clientId` | Make them agree |
| 400 `FileSet ... not found` | `fileSetId` doesn't exist in axiom | Use Pattern B (`createIfMissing: true`) |
| 400 `FileSet has no documentTypeCompletions yet` | Prior extraction hasn't finished | Wait, or use Pattern B |
| 401 / 403 | Token invalid or wrong audience | Re-acquire with the correct `--resource` |
| 404 `Pipeline not found` | `pipelineId` typo | Use `criteria-only-evaluation` |
| 429 | Queue at capacity | Caller-side backoff |

---

## 10. Idempotency

Duplicate submissions (same `fileSetId` + same content + same pipeline
version) within 60 seconds return the existing `jobId` with
`idempotent: true`. To force a fresh evaluation, append
`?mode=rerun` to the URL.

---

## 11. Recommended client integration shape

```typescript
async function evaluateCriteria(input: EvalInput): Promise<EvalResult> {
  const token = await getAxiomToken();

  // 1. Submit
  const submit = await fetch(`${AXIOM_BASE}/api/pipelines`, {
    method:  'POST',
    headers: {
      'Authorization':   `Bearer ${token}`,
      'x-client-id':     input.clientId,
      'x-sub-client-id': input.subClientId,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify({
      pipelineId: 'criteria-only-evaluation',
      input,
    }),
  });
  if (!submit.ok) throw new Error(`Submit failed: ${submit.status}`);
  const { jobId } = await submit.json();

  // 2. Poll
  const deadline = Date.now() + 5 * 60 * 1000; // 5-min cap
  while (Date.now() < deadline) {
    await sleep(10_000);
    const status = await fetch(`${AXIOM_BASE}/api/pipelines/${jobId}`, {
      headers: /* same headers */,
    }).then(r => r.json());
    if (['completed', 'completed-partial'].includes(status.status)) {
      const results = await fetch(`${AXIOM_BASE}/api/pipelines/${jobId}/results`, {
        headers: /* same headers */,
      }).then(r => r.json());
      return results;
    }
    if (['failed', 'cancelled'].includes(status.status)) {
      throw new Error(`Evaluation ${status.status}: ${status.error ?? 'unknown'}`);
    }
  }
  throw new Error('Evaluation timed out');
}
```

---

## 12. Need help?

- **Full API reference:** [`CRITERIA_EVALUATION_API.md`](./CRITERIA_EVALUATION_API.md)
- **What programs are seeded:** ask axiom team or query the pipeline-templates registry
- **Document type names:** match the canonical registry — the axiom team can provide your tenant's seeded list
- **Custom criteria CriterionNode shape:** see the full reference, "Minimum required CriterionNode fields"
