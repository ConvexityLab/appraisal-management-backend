# Report Builder Runbook

> **Capability 5 — URAR/1004 PDF Report Generation**
> Covers the full end-to-end flow from order setup through PDF download.

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| Backend running | `pnpm dev` in `appraisal-management-backend`; listen port defaults to **8080** |
| Frontend running | `pnpm dev` in `l1-valuation-platform-ui`; default port **4173** |
| Cosmos DB accessible | `AZURE_COSMOS_ENDPOINT` must be set (or Azurite emulator running) |
| Blob storage accessible | `AZURE_STORAGE_ACCOUNT_NAME` must be set (or Azurite) |
| At least one order | The order must have a completed appraisal document attached |
| (Optional) Axiom eval | Complete an Axiom evaluation on the order for the **AI Analysis Reference** badge to appear on the PDF cover |

### Required environment variables (backend `.env`)

```dotenv
AZURE_COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
AZURE_STORAGE_ACCOUNT_NAME=<account>
PORT=8080
NODE_ENV=development
```

---

## 2. Report Builder — Section Registry

Each section maps to a toggle in the **Report Package Composer** UI panel.

| Section | Data Source | Required |
|---|---|---|
| **Subject Property** | `CanonicalReportMetadata` + `subject` fields | Always |
| **Sales Comparison Grid** | `comparables` array (≥ 1 comp needed) | Recommended |
| **QC Criteria Evaluation** | `criteriaEvaluations` (from Axiom / QC pre-screening) | Optional |
| **Highest & Best Use** | `highestAndBestUseAnalysis` on subject | Optional |
| **Cost Approach** | `costApproach` on the canonical doc | Optional |
| **Income Approach** | `incomeApproach` on the canonical doc | Optional |
| **Reconciliation & Opinion** | `reconciliation` sub-object | Optional |
| **Market Map** | Populated automatically when ≥ 1 comp has geocoded coordinates | Auto |
| **AI Insights** | `criteriaEvaluations` + extracted fields from Axiom | Appears when Axiom eval is completed |
| **Certification & Signatures** | `appraiser` / `supervisoryAppraiser` sub-objects | Always |

---

## 3. Generating a Report — Step-by-Step

### 3.1 Open the Report Builder

1. Navigate to **Orders → [Order ID] → Report Builder**.
2. The **Report Package Composer** panel loads on the right.
3. Each section has an **enable/disable toggle**.

### 3.2 Enable Sections

- Turn on the sections you want to include in the PDF.
- Sections with missing required data show a warning icon — hover for details.
- The **Market Map** section is auto-enabled when geocoded comps are present.

### 3.3 Preview

- Click **Preview** (eye icon) to render a read-only HTML preview of the report inside the browser.
- The preview renders the Handlebars template via `GET /api/final-reports/:orderId/preview`.

### 3.4 Generate PDF

1. Click **Generate PDF**.
2. The UI posts to `POST /api/final-reports/:orderId/generate`.
3. Backend renders the URAR v2 Handlebars template (`src/templates/urar-v2.hbs`) through Puppeteer.
4. The generated PDF is streamed back and the browser triggers a download.
5. The PDF filename convention: `URAR-1004-<orderNumber>-<YYYYMMDD>.pdf`.

### 3.5 Export as XLSX / CSV

- Click the **Export** dropdown → **Download XLSX** or **Download CSV**.
- XLSX export uses ExcelJS; CSV is a raw field dump.
- Endpoints: `GET /api/final-reports/:orderId/export?format=xlsx|csv`

---

## 4. AI Analysis Reference (PDF Cover Badge)

When the order has a completed Axiom evaluation the PDF cover page shows:

```
AI Ref: <axiomEvaluationId>  ·  <axiomCompletedAt>
```

This badge is rendered by the `{{#if metadata.hasAxiomRef}}` block in `urar-v2.hbs`.

**How it gets there:**

1. `_enrichCanonicalDocForReport()` in `final-report.service.ts` stamps `axiomEvaluationId` + `axiomCompletedAt` from the `AppraisalOrder` onto `doc.metadata`.
2. `buildMetaCtx()` in `urar-1004.mapper.ts` exposes `hasAxiomRef`, `axiomEvaluationId`, and `axiomCompletedAt` to the template.

**To link back to the evaluation in the UI:** Navigate to `/orders/<orderId>/axiom`.

---

## 5. Market Map Section

The market map renders a MapLibre-GL web map screenshot of subject + comp locations.

- **Requires:** At least one comparable with `latitude` and `longitude` populated on its `address` object.
- **If comps are not geocoded:** The section is hidden automatically (toggle remains off).
- **To geocode manually:** Use the **Enhanced Property Intelligence** panel to trigger a geocoding run.

---

## 6. Footnotes and Citations

- Every extracted-field value sourced from a document carries a numeric citation marker, e.g. `[1]`.
- The footnotes list at the bottom of the AI Insights section maps each `[N]` back to the source document, page, and section.
- The citation `blobUrl` links directly to the source PDF blob in Azure Blob Storage.
- In the PDF, `[N]` markers appear inline in the field grid wherever a value was AI-extracted.

---

## 7. Running the Live-Fire Playwright Tests

### Setup

```bash
# In l1-valuation-platform-ui
export VITE_API_BASE_URL=http://localhost:8080
export LIVE_UI_REPORT_ORDER_ID=<your-order-id>
export LIVE_UI_STORAGE_STATE=.auth/live-fire-ui.json

# Start backend and frontend first, then:
pnpm playwright test e2e/live-fire/report-generation-journey.live-fire.spec.ts
```

### What the spec asserts

| Assertion | Description |
|---|---|
| `/api/final-reports/` returns 200 | Report generation API succeeded |
| PDF contains `orderId` string | Correct order was rendered |
| PDF contains PASS / FAIL / WARNING | QC verdict section is present |
| PDF contains dollar amount or sq-ft | At least one extracted value rendered |
| PDF contains `[1]` or `source:` | Footnotes are present |

### Artifacts

All run artifacts are saved to:
```
test-artifacts/live-fire/report-generation-journey/<timestamp>-<orderId>/
  ├── 01-report-builder-loaded.png
  ├── 02-sections-enabled.png
  ├── 03-download-triggered.png
  ├── 04-complete.png
  ├── generated-report.pdf
  ├── pdf-text.txt
  ├── network-capture.json
  └── console.log
```

---

## 8. Analytics Dashboard

The analytics page at `/analytics` now shows **live backend data**:

| Widget | Backend Endpoint |
|---|---|
| Key metrics (total orders, revenue, pass rate, on-time delivery) | `GET /api/analytics/overview` |
| Weekly order trend line chart | `GET /api/analytics/orders/trend?weeks=N` |
| Top vendor performance table | `GET /api/analytics/vendors/performance` |

All three endpoints require the `analytics:view` permission.

---

## 9. Known Issues & Gotchas

| Issue | Workaround |
|---|---|
| PDF generation timeout | Increase `PUPPETEER_TIMEOUT` env var (default: 30 s). Large reports (many comps) can take 60+ s. |
| Market Map not appearing | Verify comps have `address.latitude` / `address.longitude`. Re-run geocoding via EPI panel. |
| Axiom badge missing | Check `order.axiomEvaluationId` is set. Run Axiom evaluation first from `/orders/:id/axiom`. |
| Blank QC section in PDF | Axiom criteria evaluation must be in `completed` state, not `pending` or `error`. |
| `ENOBUFS` on large PDF | Reduce the number of comparable photos included or lower image DPI in the template CSS. |

---

## 10. Quick PDF Preview Without Playwright

```bash
# After starting the backend on port 8080:
curl -s http://localhost:8080/api/final-reports/<ORDER_ID>/preview \
  -H "Authorization: Bearer $TEST_JWT" \
  > /tmp/report-preview.html && open /tmp/report-preview.html
```

This renders the full HTML template without triggering PDF conversion — useful for iterating on template styling.

---

## 11. Key File Locations

| File | Purpose |
|---|---|
| `src/templates/urar-v2.hbs` | Handlebars PDF template |
| `src/services/final-report.service.ts` | Report generation orchestrator |
| `src/services/report-engine/field-mappers/urar-1004.mapper.ts` | Template context builder |
| `src/services/report-engine/field-mappers/ai-insights.helpers.ts` | AI/Axiom insights context |
| `src/controllers/final-reports.controller.ts` | REST endpoints for generate/preview/export |
| `src/types/canonical-schema.ts` | `CanonicalReportDocument` and `CanonicalReportMetadata` |
| `l1-valuation-platform-ui/src/components/report-builder/ReportPackageComposer.tsx` | Section toggles UI |
| `l1-valuation-platform-ui/e2e/live-fire/report-generation-journey.live-fire.spec.ts` | T5.11 live-fire spec |
