const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");
const crypto = require("crypto");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint = process.env.COSMOSDB_ENDPOINT;
const databaseName = process.env.DATABASE_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridgeClientId = process.env.STATEBRIDGE_CLIENT_ID;
const statebridgeClientName = process.env.STATEBRIDGE_CLIENT_NAME;
const statebridge_tenantId = process.env.STATEBRIDGE_TENANT_ID;

if (!cosmosEndpoint) throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName) throw new Error("DATABASE_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridgeClientId) throw new Error("STATEBRIDGE_CLIENT_ID is required but not set");
if (!statebridgeClientName) throw new Error("STATEBRIDGE_CLIENT_NAME is required but not set");
if (!statebridge_tenantId) throw new Error("STATEBRIDGE_TENANT_ID is required but not set");

// ─── Constants for input validation ───────────────────────────────────────────

const VALID_FILE_EXTENSIONS = [".txt", ".csv", ".dat"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB hard limit

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL",
  "IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE",
  "NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC",
  "SD","TN","TX","UT","VT","VA","VI","WA","WV","WI","WY","GU","AS","MP",
]);

const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

// ─── Clients (module-scoped so they are reused across invocations) ─────────────

const credential = new DefaultAzureCredential();

const cosmosClient = new CosmosClient({
  endpoint: cosmosEndpoint,
  aadCredentials: credential,
});
const db = cosmosClient.database(databaseName);
const ordersContainer = db.container("orders");
const engagementsContainer = db.container("engagements");

// SFTP storage account uses a separate account — access via Managed Identity
const sftpBlobClient = new BlobServiceClient(
  `https://${sftpStorageAccountName}.blob.core.windows.net`,
  credential
);

// ─── Column indices for inbound pipe-delimited format ──────────────────────────
// OrderID|LoanID|CollateralNumber|ProductType|Occupancy|PropertyType|
// AddressLine1|AddressLine2|City|State|Zip|BorrowerName|LockboxCode
const IN = {
  OrderID: 0,
  LoanID: 1,
  CollateralNumber: 2,
  ProductType: 3,
  Occupancy: 4,
  PropertyType: 5,
  AddressLine1: 6,
  AddressLine2: 7,
  City: 8,
  State: 9,
  Zip: 10,
  BorrowerName: 11,
  LockboxCode: 12,
};

const MIN_COLUMNS = 12; // at least through BorrowerName; LockboxCode may be absent

// ─── Deterministic ID generation (idempotent across retries/duplicate events) ──

/**
 * Produce a deterministic, collision-resistant ID from a prefix and seed parts.
 * Same inputs always yield the same output, so duplicate invocations for the
 * same file produce the same Cosmos document IDs → 409 Conflict on retry.
 */
function deterministicId(prefix, ...parts) {
  const hash = crypto
    .createHash("sha256")
    .update(parts.join(":"))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${hash}`;
}

function generateEngagementId(sourceFile) {
  return deterministicId("sftp-eng", statebridge_tenantId, sourceFile);
}

function generateEngagementNumber() {
  const year = new Date().getFullYear();
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `ENG-${year}-${ts}${rand}`;
}

function generateLoanId(sourceFile, rowIndex) {
  return deterministicId("sftp-loan", statebridge_tenantId, sourceFile, String(rowIndex));
}

function generateProductId(sourceFile, rowIndex) {
  return deterministicId("sftp-prod", statebridge_tenantId, sourceFile, String(rowIndex));
}

function generateOrderId(sourceFile, rowIndex) {
  return deterministicId("sftp-ord", statebridge_tenantId, sourceFile, String(rowIndex));
}

/**
 * Returns true if a Cosmos error is a 409 Conflict (document already exists).
 */
function isConflict(err) {
  return err && err.code === 409;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the Event Grid message that arrived via storage queue.
 * Returns the blob name (path within the container).
 */
function parseEventGridMessage(queueMessage) {
  let events;
  try {
    events = typeof queueMessage === "string" ? JSON.parse(queueMessage) : queueMessage;
  } catch (err) {
    throw new Error(`Failed to parse Event Grid queue message as JSON: ${err.message}`);
  }

  const event = Array.isArray(events) ? events[0] : events;

  if (!event || !event.data || !event.data.url) {
    throw new Error(`Unexpected Event Grid message shape — missing data.url. Message: ${JSON.stringify(event)}`);
  }

  // subject: /blobServices/default/containers/statebridge/blobs/uploads/<filename>
  const subject = event.subject || "";
  const blobNameMatch = subject.match(/\/blobs\/(.+)$/);
  const blobName = blobNameMatch
    ? blobNameMatch[1]
    : new URL(event.data.url).pathname.split("/statebridge/")[1];

  return { blobName };
}

/**
 * Download a blob from the SFTP storage account and return its text content.
 * Enforces a file size limit to prevent OOM from unexpectedly large uploads.
 */
async function downloadSftpBlob(containerName, blobName, context) {
  const containerClient = sftpBlobClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  // Check blob size before downloading into memory
  const properties = await blobClient.getProperties();
  const blobSize = properties.contentLength;
  if (blobSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Blob ${containerName}/${blobName} is ${blobSize} bytes, ` +
      `exceeding the ${MAX_FILE_SIZE_BYTES} byte limit. Rejecting.`
    );
  }

  context.log(`Downloading SFTP blob: ${containerName}/${blobName} (${blobSize} bytes)`);
  const downloadResponse = await blobClient.download(0);

  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Move a blob from uploads/ to archive/processed/ or archive/failed/.
 *
 * This is the sole mechanism for clearing the uploads/ inbox — no ARM lifecycle
 * policies exist on this account (permanent audit/recovery retention requirement).
 *
 * Called for every terminal outcome so uploads/ contains only files that are
 * actively being processed or pending a queue retry:
 *   "processed" — file was successfully ingested into Cosmos
 *   "failed"    — file was permanently rejected (bad extension, empty, all-malformed)
 *
 * Retryable errors (Cosmos down, download failure) are thrown WITHOUT calling
 * this function so the queue retries from uploads/.
 */
async function moveBlobToArchive(containerName, blobName, dest, context) {
  const containerClient = sftpBlobClient.getContainerClient(containerName);
  const sourceBlobClient = containerClient.getBlobClient(blobName);

  // Strip the uploads/ prefix, keep any sub-path after it
  const relativeName = blobName.replace(/^uploads\//, "");
  const destPath = `archive/${dest}/${relativeName}`;
  const destBlobClient = containerClient.getBlobClient(destPath);

  try {
    // Copy then delete (ADLS Gen2 / HNS doesn't support server-side rename via SDK)
    const poller = await destBlobClient.beginCopyFromURL(sourceBlobClient.url);
    await poller.pollUntilDone();
    await sourceBlobClient.delete();
    context.log(`Moved ${blobName} → ${destPath}`);
  } catch (err) {
    // Non-fatal — for "processed", data is already in Cosmos; for "failed", file
    // stays in uploads/ where ops can investigate.
    context.log(`WARNING: Failed to move ${blobName} → ${destPath}: ${err.message}`);
  }
}

/**
 * Validate a single parsed row's fields. Returns an array of warning strings
 * (empty if all fields are valid).
 */
function validateRow(fields, rowIndex) {
  const warnings = [];
  const state = (fields[IN.State] || "").trim().toUpperCase();
  const zip = (fields[IN.Zip] || "").trim();
  const address = (fields[IN.AddressLine1] || "").trim();
  const city = (fields[IN.City] || "").trim();
  const loanId = (fields[IN.LoanID] || "").trim();

  if (!loanId) {
    warnings.push(`Row ${rowIndex}: LoanID is empty`);
  }
  if (!address) {
    warnings.push(`Row ${rowIndex}: AddressLine1 is empty`);
  }
  if (!city) {
    warnings.push(`Row ${rowIndex}: City is empty`);
  }
  if (state && !US_STATES.has(state)) {
    warnings.push(`Row ${rowIndex}: Invalid state code "${state}"`);
  }
  if (zip && !ZIP_REGEX.test(zip)) {
    warnings.push(`Row ${rowIndex}: Invalid zip code "${zip}"`);
  }
  return warnings;
}

/**
 * Parse a pipe-delimited order file.
 * Skips blank lines and the header row (if it starts with "OrderID").
 */
function parseOrderFile(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("OrderID|"))
    .map((line) => line.split("|"));
}

/**
 * Build one EngagementLoan + its single BPO product from a parsed row.
 * Returns { loan, productId } so the order can reference the productId.
 */
function buildLoanAndProduct(fields, sourceFile, rowIndex) {
  const loanId = generateLoanId(sourceFile, rowIndex);
  const productId = generateProductId(sourceFile, rowIndex);

  const loan = {
    id: loanId,
    loanNumber: (fields[IN.LoanID] || "").trim().padStart(10, "0"),
    borrowerName: (fields[IN.BorrowerName] || "").trim(),
    property: {
      streetAddress: (fields[IN.AddressLine1] || "").trim(),
      city: (fields[IN.City] || "").trim(),
      state: (fields[IN.State] || "").trim(),
      zipCode: (fields[IN.Zip] || "").trim(),
      propertyType: (fields[IN.PropertyType] || "").trim(),
    },
    status: "PENDING",
    clientOrders: [
      {
        id: productId,
        productType: (fields[IN.ProductType] || "").trim(),
        status: "PENDING",
        vendorOrderIds: [],
      },
    ],
  };

  return { loan, productId };
}

/**
 * Build a Cosmos DB Engagement document from ALL rows in the file.
 * One engagement per daily SFTP file — each row becomes one EngagementLoan.
 */
function buildEngagementDocument(rows, sourceFileName) {
  const engagementId = generateEngagementId(sourceFileName);
  const now = new Date().toISOString();

  const loanMeta = rows.map((fields, rowIndex) => {
    const { loan, productId } = buildLoanAndProduct(fields, sourceFileName, rowIndex);
    return { loan, productId, fields, rowIndex };
  });

  return {
    engagement: {
      id: engagementId,
      engagementNumber: generateEngagementNumber(),
      tenantId: statebridge_tenantId,
      engagementType: loanMeta.length === 1 ? "SINGLE" : "PORTFOLIO",
      loansStoredExternally: false,
      client: {
        clientId: statebridgeClientId,
        clientName: statebridgeClientName,
      },
      loans: loanMeta.map((m) => m.loan),
      status: "RECEIVED",
      priority: "ROUTINE",
      receivedAt: now,
      createdAt: now,
      createdBy: "statebridge-sftp",
      source: "statebridge-sftp",
      sourceFile: sourceFileName,
    },
    // carry through the per-row metadata so orders can reference engagementId/loanId/productId
    loanMeta,
    engagementId,
  };
}

/**
 * Build a Cosmos DB order document for one row, linked to the engagement.
 */
function buildOrderDocument(fields, engagementId, loanId, productId, sourceFileName, rowIndex) {
  const loanNumber = (fields[IN.LoanID] || "").trim().padStart(10, "0");
  const collateralNumber = (fields[IN.CollateralNumber] || "").trim();

  return {
    id: generateOrderId(sourceFileName, rowIndex),
    type: 'order', // Required: findOrders query filters by c.type = 'order'
    clientId: statebridgeClientId,
    tenantId: statebridge_tenantId,
    // Engagement linkage
    engagementId,
    engagementPropertyId: loanId,
    engagementClientOrderId: productId,
    // Statebridge identifiers — preserved verbatim for the results file
    externalOrderId: (fields[IN.OrderID] || "").trim(),
    loanId: loanNumber,
    collateralNumber,
    // Address
    streetAddress: (fields[IN.AddressLine1] || "").trim(),
    addressLine2: (fields[IN.AddressLine2] || "").trim(),
    city: (fields[IN.City] || "").trim(),
    state: (fields[IN.State] || "").trim(),
    zip: (fields[IN.Zip] || "").trim(),
    // Order metadata
    borrowerName: (fields[IN.BorrowerName] || "").trim(),
    lockboxCode: (fields[IN.LockboxCode] || "").trim(),
    productType: (fields[IN.ProductType] || "").trim(),
    propertyType: (fields[IN.PropertyType] || "").trim(),
    occupancy: (fields[IN.Occupancy] || "").trim(),
    // Lifecycle
    orderStatus: "pending",
    status: "NEW",
    dateOrdered: new Date().toISOString(),
    dateCompleted: null,
    source: "statebridge-sftp",
    sourceFile: sourceFileName,
    // PDF naming helper — surfaced so outbound leg doesn't re-parse
    // Output PDF name: <loanNumber>_<productType>_<collateralNumber>_<yyyymmdd#hhmmss>.pdf
    expectedPdfPrefix: `${loanNumber}_${(fields[IN.ProductType] || "").trim()}_${collateralNumber}`,
  };
}

/**
 * Check whether this file has already been processed (rejects re-uploads with
 * the same filename). For corrections, Statebridge must upload a new file
 * (e.g., Orders_20260325_v2.txt).
 *
 * NOTE: This check has a small race window when two concurrent Event Grid
 * messages arrive for the SAME upload — both may pass this check. The 409
 * Conflict handling in the create calls below is the true idempotency guard;
 * this query is an early-exit optimisation that produces a clear log message
 * for genuine re-uploads that happen minutes/hours later.
 */
async function fileAlreadyProcessed(sourceFileName) {
  const { resources } = await engagementsContainer.items
    .query(
      {
        query:
          "SELECT c.id FROM c WHERE c.tenantId = @tenantId AND c.sourceFile = @sourceFile OFFSET 0 LIMIT 1",
        parameters: [
          { name: "@tenantId", value: statebridge_tenantId },
          { name: "@sourceFile", value: sourceFileName },
        ],
      },
      { partitionKey: statebridge_tenantId }
    )
    .fetchAll();
  return resources.length > 0;
}

// ─── Function Handler ─────────────────────────────────────────────────────────

app.storageQueue("processSftpOrderFile", {
  // Queue on the MAIN storage account (where Event Grid delivers notifications).
  // Managed identity auth: Functions resolves SFTP_ORDER_QUEUE_STORAGE__queueServiceUri
  // from env and uses DefaultAzureCredential (AZURE_CLIENT_ID) to authenticate.
  // Required RBAC on the storage account: Storage Queue Data Contributor (already granted
  // to all container app identities in data-services.bicep :: primaryStorageQueueRoleAssignments).
  queueName: "sftp-order-events",
  connection: "SFTP_ORDER_QUEUE_STORAGE",

  handler: async (queueMessage, context) => {
    context.log("processSftpOrderFile: received queue message from SFTP Event Grid");

    // 1. Parse the Event Grid envelope
    let blobName;
    try {
      ({ blobName } = parseEventGridMessage(queueMessage));
    } catch (err) {
      context.log(`ERROR: Cannot parse Event Grid message — discarding. ${err.message}`);
      return;
    }

    context.log(`Processing SFTP inbound file: ${blobName}`);

    // 2. Reject files with unexpected extensions (only .txt, .csv, .dat)
    const ext = blobName.includes(".") ? blobName.substring(blobName.lastIndexOf(".")).toLowerCase() : "";
    if (!VALID_FILE_EXTENSIONS.includes(ext)) {
      context.log(
        `REJECTED: File "${blobName}" has unsupported extension "${ext}". ` +
        `Expected one of: ${VALID_FILE_EXTENSIONS.join(", ")}. Moving to archive/failed/.`
      );
      await moveBlobToArchive("statebridge", blobName, "failed", context);
      return;
    }

    // 3. Reject re-uploads of already-processed filenames.
    //    Statebridge must use a unique filename for corrections (e.g., _v2 suffix).
    //    Do NOT attempt to move the blob — it was already moved to archive/processed/
    //    by the first invocation and no longer exists in uploads/.
    if (await fileAlreadyProcessed(blobName)) {
      context.log(
        `REJECTED: File "${blobName}" has already been processed. ` +
        `To submit corrections, upload with a unique filename ` +
        `(e.g., ${blobName.replace(/\.txt$/i, "_v2.txt")}). Discarding.`
      );
      return;
    }

    // 4. Download the file text (with size guard)
    let fileContent;
    try {
      fileContent = await downloadSftpBlob("statebridge", blobName, context);
    } catch (err) {
      context.log(`ERROR: Failed to download blob ${blobName}: ${err.message}`);
      throw err; // retryable
    }

    // 5. Parse rows
    const rows = parseOrderFile(fileContent);
    if (rows.length === 0) {
      context.log(`WARNING: No data rows found in ${blobName} — moving to archive/failed/`);
      await moveBlobToArchive("statebridge", blobName, "failed", context);
      return;
    }
    context.log(`Parsed ${rows.length} order row(s) from ${blobName}`);

    // Validate each row has minimum columns and valid fields before creating anything
    const validRows = [];
    for (let i = 0; i < rows.length; i++) {
      const fields = rows[i];
      if (fields.length < MIN_COLUMNS) {
        context.log(`WARNING: Skipping malformed row ${i} (${fields.length} columns, need ${MIN_COLUMNS}): ${fields.join("|")}`)
        continue;
      }
      // Per-field validation — warn but still process (Statebridge data may have quirks)
      const fieldWarnings = validateRow(fields, i);
      for (const w of fieldWarnings) {
        context.log(`VALIDATION WARNING: ${w} in ${blobName}`);
      }
      validRows.push(fields);
    }

    if (validRows.length === 0) {
      context.log(`ERROR: All rows in ${blobName} were malformed — moving to archive/failed/`);
      await moveBlobToArchive("statebridge", blobName, "failed", context);
      return;
    }

    // 6. Build and write the Engagement (one per file upload)
    // IDs are deterministic from (tenantId + sourceFile + rowIndex), so duplicate
    // invocations produce the same IDs and Cosmos returns 409 Conflict.
    const { engagement, loanMeta, engagementId } = buildEngagementDocument(validRows, blobName);

    try {
      await engagementsContainer.items.create(engagement);
      context.log(
        `Created engagement id=${engagementId} number=${engagement.engagementNumber} with ${loanMeta.length} loan(s)`
      );
    } catch (err) {
      if (isConflict(err)) {
        context.log(
          `Engagement ${engagementId} already exists (duplicate event) — continuing to orders for partial-retry safety`
        );
      } else {
        context.log(`ERROR: Failed to create engagement for file ${blobName}: ${err.message}`);
        throw err; // retryable — orders should not be created without the engagement
      }
    }

    // 7. Create one linked order per valid row
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const { fields, loan, productId, rowIndex } of loanMeta) {
      const orderDoc = buildOrderDocument(
        fields,
        engagementId,
        loan.id,
        productId,
        blobName,
        rowIndex
      );

      // Phase B step 8: engagement-primacy guard at the SFTP write site.
      // This Azure Function bypasses dbService.createOrder() (TypeScript-side)
      // for performance reasons, so the cosmos-db.service guard does NOT
      // apply here. Validate the linkage fields locally and refuse to write
      // an orphan VendorOrder. Without this, malformed Statebridge rows
      // would create rows queryable by engagementId but unattributable to
      // a specific loan or clientOrder — which is exactly the bug class the
      // ORDER-DOMAIN-REDESIGN Phase B refactor is closing.
      const linkageErrors = [];
      if (!orderDoc.engagementId || !String(orderDoc.engagementId).trim()) {
        linkageErrors.push("missing engagementId");
      }
      if (!orderDoc.engagementPropertyId || !String(orderDoc.engagementPropertyId).trim()) {
        linkageErrors.push("missing engagementPropertyId");
      }
      if (!orderDoc.engagementClientOrderId || !String(orderDoc.engagementClientOrderId).trim()) {
        linkageErrors.push("missing engagementClientOrderId");
      }
      if (linkageErrors.length > 0) {
        const msg = `Engagement-primacy: refusing to write orphan order — ${linkageErrors.join(", ")}`;
        context.log(
          `ERROR: ${msg} (externalOrderId=${orderDoc.externalOrderId} loanId=${orderDoc.loanId})`
        );
        errors.push({ externalOrderId: orderDoc.externalOrderId, error: msg });
        continue;
      }

      try {
        await ordersContainer.items.create(orderDoc);
        created++;
        context.log(
          `Created order id=${orderDoc.id} externalOrderId=${orderDoc.externalOrderId} loanId=${orderDoc.loanId} engagementId=${engagementId}`
        );
      } catch (err) {
        if (isConflict(err)) {
          skipped++;
          context.log(
            `Order ${orderDoc.id} already exists (duplicate event) — skipping`
          );
        } else {
          context.log(
            `ERROR: Failed to create order externalOrderId=${orderDoc.externalOrderId} loanId=${orderDoc.loanId}: ${err.message}`
          );
          errors.push({ externalOrderId: orderDoc.externalOrderId, error: err.message });
        }
      }
    }

    context.log(
      `processSftpOrderFile complete — file: ${blobName} | engagement: ${engagementId} | orders created: ${created} | skipped (already exist): ${skipped} | errors: ${errors.length}`
    );

    // 8. Move to archive/processed/ — engagement exists in Cosmos regardless of partial
    //    order errors, so the file is permanently archived before surfacing the error.
    await moveBlobToArchive("statebridge", blobName, "processed", context);

    if (errors.length > 0) {
      throw new Error(
        `${errors.length} order(s) failed to create. First error: ${errors[0].error}. File: ${blobName}`
      );
    }
  },
});

// ─── Exports for testing ──────────────────────────────────────────────────────

module.exports = {
  IN,
  MIN_COLUMNS,
  parseOrderFile,
  validateRow,
  parseEventGridMessage,
  buildLoanAndProduct,
  buildEngagementDocument,
  buildOrderDocument,
  deterministicId,
  generateEngagementId,
  generateOrderId,
};

