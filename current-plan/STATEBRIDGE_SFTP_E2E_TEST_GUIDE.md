# Statebridge SFTP Integration — End-to-End Test Guide

**Environment:** Staging (`rg-appraisal-mgmt-staging-eastus`)  
**Last updated:** 2026-03-25

---

## SFTP Connection Details (Staging)

| Field | Value |
|---|---|
| **Account** | `apprsftpstaw6m5a7` |
| **Host** | `apprsftpstaw6m5a7.blob.core.windows.net` |
| **Port** | `22` |
| **Username** | `apprsftpstaw6m5a7.statebridge` |
| **Password** | See `.env.local` → `SFTP_STATEBRIDGE_PASSWORD` |
| **Home dir** | `uploads/` |
| **Results dir** | `results/` (read-only for this user) |

**Permissions granted to the `statebridge` local user:**
- `uploads/` → `rcwl` (read, create, write, list)
- `results/` → `rl` (read, list)

---

## The Full Flow

```
1. Statebridge uploads pipe-delimited order file → uploads/ container
        ↓
2. BlobCreated → Event Grid system topic → sftp-order-events Storage Queue
        ↓
3. processSftpOrderFile (Queue trigger on functions app)
   • Parses pipe-delimited rows
   • Creates Engagement + EngagementLoan + BPO Product in Cosmos
   • Creates Order document (source: "statebridge-sftp", status: "pending")
        ↓
4. Appraiser uploads BPO PDF via API → document record in Cosmos `documents` container
        ↓
5. handleStatebridgeBpoDocument (Cosmos Change Feed on `documents`)
   • Fires on new/updated docs with documentType == "BPO_REPORT"
   • Skips if bpoExtractionStatus is already AXIOM_PENDING or COMPLETED
   • Builds 30-min SAS URL for the PDF blob
   • POSTs to Axiom /api/pipelines  (pipeline: "document-extraction")
   • Waits for result via SSE stream (4-min timeout)
   • Reads extracted fields: county, propertyCondition, asIsValue, repairedValue
   • Copies BPO PDF → SFTP results/ as {loanId}_BPO_{collateral}_{yyyymmdd#hhmmss}.pdf
   • Patches order: status = "COMPLETED", dateCompleted = now
        ↓
6. writeStatebridgeDailyResults (Timer — 23:55 UTC, or trigger manually)
   • Queries all orders completed today for statebridge-tenant
   • Writes TAB-delimited results file → SFTP results/statebridge_results_YYYYMMDD.txt
   • Statebridge picks this up via SFTP
```

---

## Step-by-Step Test Procedure

### Step 1 — Regenerate SFTP password (if needed / credential rotation)

```bash
az storage account local-user regenerate-password \
  --account-name apprsftpstaw6m5a7 \
  --name statebridge \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --output json
```

Store the returned `sshPassword` in:
- `appraisal-management-backend/.env.local` → `SFTP_STATEBRIDGE_PASSWORD`
- `l1-valuation-platform-ui/.env.local` → `SFTP_STATEBRIDGE_PASSWORD`

---

### Step 2 — Create a test order file

Pipe-delimited, 13 columns. Header row is optional (ignored by parser).

```
OrderID|LoanID|CollateralNumber|ProductType|Occupancy|PropertyType|AddressLine1|AddressLine2|City|State|Zip|BorrowerName|LockboxCode
SB-TEST-001|LN-20240001|COL-001|BPO|Owner Occupied|SFR|123 Main St||Austin|TX|78701|John Borrower|LB001
SB-TEST-002|LN-20240002|COL-002|BPO|Vacant|SFR|456 Oak Ave|Unit 2|Dallas|TX|75201|Jane Smith|LB002
```

Save as e.g. `test_orders_20260324.txt`.

---

### Step 3 — Upload the order file

**Option A — SFTP (real Statebridge path):**
```bash
sftp apprsftpstaw6m5a7.statebridge@apprsftpstaw6m5a7.blob.core.windows.net
# password from SFTP_STATEBRIDGE_PASSWORD in .env.local
put test_orders_20260324.txt
```
Or use WinSCP / FileZilla with the same credentials.

**Option B — Direct blob upload (faster for dev, still fires Event Grid):**
```bash
az storage blob upload \
  --account-name apprsftpstaw6m5a7 \
  --container-name uploads \
  --name test_orders_20260324.txt \
  --file ./test_orders_20260324.txt \
  --auth-mode login
```

---

### Step 4 — Watch function logs

```bash
az containerapp logs show \
  --name ca-appraisalfunctions-sta-lqxl \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --follow \
  --tail 50
```

**Expected output (within ~10–30 s):**
```
[processSftpOrderFile] Processing uploads/test_orders_20260324.txt (2 rows)
[processSftpOrderFile] Created engagement eng-... for order SB-TEST-001
[processSftpOrderFile] Created engagement eng-... for order SB-TEST-002
[processSftpOrderFile] Done: 2 processed, 0 skipped, 0 errors
```

---

### Step 5 — Verify orders in Cosmos

```bash
# Get Cosmos account name first:
az cosmosdb list -g rg-appraisal-mgmt-staging-eastus --query "[0].name" -o tsv

# Then query:
az cosmosdb sql query \
  --account-name <cosmos-account> \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --database-name <db-name> \
  --container-name orders \
  --query-text "SELECT c.id, c.orderStatus, c.source, c.bpoExtractionStatus FROM c WHERE c.source = 'statebridge-sftp'" \
  --output json
```

**Expected:** 2 documents, `orderStatus: "pending"`, `source: "statebridge-sftp"`, no `bpoExtractionStatus` yet.

---

### Step 6 — Trigger the BPO PDF path

`handleStatebridgeBpoDocument` watches the **`documents` Cosmos container** (main storage, not SFTP).

**Production path:** Appraiser uploads BPO PDF through the API → creates a `documents` record with `documentType: "BPO_REPORT"` and `orderId: "SB-TEST-001"`.

**Dev shortcut — insert a mock document record directly into Cosmos:**

First upload any PDF as placeholder:
```bash
az storage blob upload \
  --account-name <main-storage-account> \
  --container-name documents \
  --name test-bpo-placeholder.pdf \
  --file any-test.pdf \
  --auth-mode login
```

Then insert into Cosmos `documents` container:
```json
{
  "id": "doc-test-sb-001",
  "orderId": "SB-TEST-001",
  "tenantId": "statebridge-tenant",
  "documentType": "BPO_REPORT",
  "mimeType": "application/pdf",
  "blobPath": "test-bpo-placeholder.pdf",
  "fileName": "bpo-report.pdf"
}
```

The Change Feed fires within a few seconds.

---

### Step 7 — Watch Axiom extraction via SSE

**Expected log lines:**
```
[handleStatebridgeBpoDocument] Submitted BPO extraction to Axiom for order SB-TEST-001 (pipelineJobId=...)
[handleStatebridgeBpoDocument] SSE extraction complete for order SB-TEST-001
[handleStatebridgeBpoDocument] Order SB-TEST-001 marked COMPLETED. sftpResultPdfName=LN-20240001_BPO_COL-001_20260324#xxxxxxx.pdf
```

Verify the PDF landed in SFTP results:
```bash
az storage blob list \
  --account-name apprsftpstaw6m5a7 \
  --container-name results \
  --auth-mode login \
  --output table
```

---

### Step 8 — Trigger the daily results file manually

The timer fires at 23:55 UTC. To run it immediately:

```bash
curl -X POST \
  "https://ca-appraisalfunctions-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io/admin/functions/writeStatebridgeDailyResults" \
  -H "Content-Type: application/json" \
  -d "{}"
```

Then download the results file via SFTP to verify the tab-delimited format:
```bash
sftp apprsftpstaw6m5a7.statebridge@apprsftpstaw6m5a7.blob.core.windows.net
get statebridge_results_20260324.txt
```

**Expected format (14 columns, TAB-separated):**
```
SB-TEST-001\tLN-20240001\tCOL-001\t123 Main St\t\tAustin\tTX\t78701\tTRAVIS\t2026-03-24\t2026-03-24\tGood\t350000\t360000
```

Columns: `OrderID`, `LoanID`, `CollateralNumber`, `AddressLine1`, `AddressLine2`, `City`, `State`, `Zip`, `County` (ALL CAPS), `DateOrdered`, `DateCompleted`, `PropertyCondition`, `AsIsValue`, `RepairedValue`

---

## Key Environment Variables (Staging Functions App)

| Variable | Value |
|---|---|
| `SFTP_STORAGE_ACCOUNT_NAME` | `apprsftpstaw6m5a7` |
| `STATEBRIDGE_TENANT_ID` | `885097ba-35ea-48db-be7a-a0aa7ff451bd` |
| `STATEBRIDGE_CLIENT_ID` | `statebridge` |
| `STATEBRIDGE_CLIENT_NAME` | `Statebridge` |
| `AXIOM_API_BASE_URL` | `https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io` |

---

## Seed Script (run once if Cosmos is missing the DocumentTypeRegistry)

```bash
cd appraisal-management-backend
COSMOS_ENDPOINT=<endpoint> COSMOS_DATABASE_ID=<db> npx tsx scripts/seed-statebridge-bpo.ts
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `processSftpOrderFile` not firing | Event Grid subscription active? Queue `sftp-order-events` has messages? |
| `handleStatebridgeBpoDocument` not firing | Change Feed lease container exists? `CosmosDbConnection__accountEndpoint` set? |
| Axiom submission fails | `AXIOM_API_BASE_URL` correct? App Config key `services.axiom-api.base-url` points to right URL? |
| SSE extraction times out | Axiom extraction taking >4 min; check Axiom pipeline logs. Order gets stamped `AXIOM_SSE_TIMEOUT`. |
| SFTP upload rejected (auth) | Regenerate password (Step 1); username must be `accountname.username` format |
| HNS blob errors | Metadata, changeFeed, versioning, soft-delete are all unsupported on HNS — do not add these to the Bicep |
