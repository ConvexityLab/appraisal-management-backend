# P-21 Provenance Hardening Runbook

**Created:** 2026-04-28  
**Related cap:** Capability 4 — Review journey + provenance  
**Related tasks:** T4.1–T4.7

---

## Purpose

This runbook describes how to audit, verify, and maintain the provenance chain
that links every AI-extracted field and QC verdict back to a specific page and
bounding-box location inside a source PDF.  It is the authoritative reference
for:

1. Diagnosing missing or broken provenance links in a production order.
2. Confirming enrichment is working end-to-end after a deployment.
3. Running the periodic coordinate-accuracy spot-check (T4.7).
4. Triaging unverified field corrections (no source citation).

---

## 1. Enrichment Pipeline Overview

```
Axiom API  →  axiom.service.ts:enrichCriteriaWithDocument()
                │
                ├─ documentReferences[].documentId   (fallback from meta when absent)
                ├─ documentReferences[].blobUrl       (fallback from meta.blobUrl / meta.documentUrl)
                └─ supportingData[].sourceDocumentId  (stamped when row sourceDocument name matches meta)
                   supportingData[].sourceBlobUrl
```

**Files:**
- `src/services/axiom.service.ts` — `enrichCriteriaWithDocument()`, lines ~1100–1160
- `src/types/axiom.types.ts` — `AxiomSupportingDataItem` (line 168), `AxiomCriterion` (line 190)

---

## 2. Verifying Enrichment on a Live Evaluation (T4.1 protocol)

### 2.1 Fetch the raw evaluation

```bash
# Replace with real IDs from the order record
curl -s "https://<api>/api/axiom/evaluations/order/<orderId>" \
  -H "Authorization: Bearer <token>" \
  | jq '.'  > /tmp/eval.json
```

### 2.2 Check documentReferences enrichment

```bash
# Should show non-null documentId for every reference
jq '[.[] | .results.criteria[] | .documentReferences[] | {documentId, blobUrl}]' /tmp/eval.json \
  | jq 'map(select(.documentId == null))'
# expected: []
```

### 2.3 Check supportingData enrichment

```bash
# Count rows with and without sourceDocumentId
jq '[.[] | .results.criteria[] | .supportingData // [] | .[]]' /tmp/eval.json \
  | jq '{
      total: length,
      withSource: (map(select(.sourceDocumentId != null)) | length),
      missing: (map(select(.sourceDocumentId == null)) | [.[] | {sourceDocument, sourcePage}])
    }'
```

**Acceptance:** `withSource / total >= 0.95`  
**Action if below 0.95:** See §5 Troubleshooting.

---

## 3. Panel Audit Protocol (T4.2–T4.4)

These panels must all render source-citation chips that open the PDF viewer at
the correct page and coordinates.

| Panel | File | Prop | Trigger condition |
|-------|------|------|-------------------|
| QCIssuesPanel | `src/components/qc/QCIssuesPanel.tsx` | `onViewRef` | `issue.documentReferences.length > 0` |
| QCVerdictReasoningPanel | `src/components/qc/QCVerdictReasoningPanel.tsx` | `onOpenDocumentReference` | `item.aiDocumentReferences.length > 0 && ref.documentId != null` |
| CrossDocumentDiscrepancyPanel | `src/components/qc/CrossDocumentDiscrepancyPanel.tsx` | `onViewSource` | `s.documentId != null` |

### Visual verification steps

1. Open an order with a completed Axiom evaluation (status `completed`).
2. Navigate to the QC Review tab.
3. For each panel, expand a criterion with `evaluation: 'fail'` or `'warning'`.
4. Confirm source-citation chips are visible.
5. Click a chip — the PDF viewer should open **at the correct page**.
6. Confirm a bounding-box highlight appears on the extracted text region.

If the PDF viewer opens but no highlight appears, see §5 Coordinate Accuracy.

---

## 4. Coordinate-Accuracy Spot-Check (T4.7 protocol)

Run this against 5 criterion verdicts on real Axiom data.

```bash
# Pick 5 criterion verdicts that have documentReferences with coordinates
jq '[.[] | .results.criteria[] | select(.documentReferences | length > 0) | {
  criterionId, evaluation,
  refs: (.documentReferences[:5] | map({documentId, page, coordinates}))
}][:5]' /tmp/eval.json
```

For each criterion:

- [ ] Open the PDF viewer via the UI chip click
- [ ] Confirm the bounding-box overlay lands on the cited text (not a blank region)
- [ ] Confirm the page number matches
- [ ] Note coordinate system: Axiom uses normalized `[0,1]` × `[0,1]` (origin top-left)

Record results in:  
`test-artifacts/p-21/coordinate-spot-check-<YYYY-MM-DD>.md`

**Template:**

```markdown
# Coordinate Spot-Check — <date>
| # | Criterion | Page | Expected text | Overlay correct? |
|---|-----------|------|---------------|-----------------|
| 1 | ...       | ...  | "..."         | ✅ / ❌ |
```

If ≥1 box is misaligned by >50px: open a bug against `axiom.service.ts`
`enrichCriteriaWithDocument` or the coordinate-transform in `PdfViewerOverlay`.

---

## 5. Troubleshooting

### 5a. `sourceDocumentId` null for all rows

**Symptom:** jq check in §2.3 returns `total > 0, withSource: 0`

**Likely causes:**

1. `enrichCriteriaWithDocument` was never called — check `axiom.service.ts` call
   sites; it must be called after fetching `criteria[]` from Axiom and must
   receive the correct `documentMeta` argument.
2. `meta.documentName` or `meta.fileName` is null — the name-match guard at
   line 1148 will skip every row. Log `metaDocName` at the entry to
   `enrichCriteriaWithDocument` to confirm.
3. All rows have `row.sourceDocument = null` AND `row.sourcePage = null` —
   Axiom did not emit source location for these rows.  This is an Axiom API
   issue; file a ticket.

### 5b. `blobUrl` null on document references

**Symptom:** PDF viewer chip renders but clicking shows "Document not
available".

**Fix:** Confirm `meta.blobUrl` or `meta.documentUrl` is populated before
calling `enrichCriteriaWithDocument`.  The caller in the extraction worker must
pass the blob SAS URL from Cosmos `documents` container record.

### 5c. Provenance Health < 80% on a real order

1. Run the jq check in §2.3 — identify which fields are missing source.
2. If fields are from a known non-document source (e.g., public record data),
   they legitimately have no PDF source.  Exclude those criterion types from the
   health denominator by filtering on `criteriType !== 'public-record-*'`.
3. If fields should have a source, trace back through `axiom.service.ts` line
   1143 guard: `if (row.sourceDocumentId) return row; // already resolved — skip`.
   Ensure the guard is not prematurely exiting on stale data.

---

## 6. Unverified Field Corrections (T4.5)

When a reviewer submits a field correction without a source citation, the audit
event carries `noProvenanceAcknowledged: true` in `eventData`.

To query these from the audit log:

```bash
# Cosmos DB audit-events query (adjust to your query tool)
SELECT * FROM c
WHERE c.eventType = 'qc.field.corrected'
  AND c.eventData.noProvenanceAcknowledged = true
ORDER BY c._ts DESC
```

These corrections should be reviewed in the next appraisal QC cycle to
retrospectively attach a source reference when possible.

---

## 7. Acceptance Criteria

| Check | Target |
|-------|--------|
| `withSource / total` on supportingData | ≥ 95% |
| PDF viewer opens from source-citation chip click | 100% of chips with documentId |
| Bounding-box lands on correct text region | ≥ 80% (coordinate accuracy) |
| Unverified corrections require acknowledgment checkbox | Enforced in UI (FieldCorrectionDialog) |
| Provenance Health chip visible on AxiomInsightsPanel | ✅ rendered when supportingData rows exist |
