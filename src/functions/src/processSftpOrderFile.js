const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");
const uuid = require("uuid");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint = process.env.COSMOSDB_ENDPOINT;
const databaseName = process.env.DATABASE_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridgeClientId = process.env.STATEBRIDGE_CLIENT_ID;
const statebridgeClientName = process.env.STATEBRIDGE_CLIENT_NAME || "Statebridge";
const statebridge_tenantId = process.env.STATEBRIDGE_TENANT_ID;

if (!cosmosEndpoint) throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName) throw new Error("DATABASE_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridgeClientId) throw new Error("STATEBRIDGE_CLIENT_ID is required but not set");
if (!statebridge_tenantId) throw new Error("STATEBRIDGE_TENANT_ID is required but not set");

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

// ─── ID generators (match format used in engagement.service.ts) ───────────────

function generateEngagementId() {
  return `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateEngagementNumber() {
  const year = new Date().getFullYear();
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `ENG-${year}-${ts}${rand}`;
}

function generateLoanId() {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateProductId() {
  return `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
 */
async function downloadSftpBlob(containerName, blobName, context) {
  const containerClient = sftpBlobClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  context.log(`Downloading SFTP blob: ${containerName}/${blobName}`);
  const downloadResponse = await blobClient.download(0);

  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Parse a pipe-delimited order file.
 * Skips blank lines and the header row (if it starts with "OrderID").
 */
function parseOrderFile(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("OrderID"))
    .map((line) => line.split("|"));
}

/**
 * Build one EngagementLoan + its single BPO product from a parsed row.
 * Returns { loan, productId } so the order can reference the productId.
 */
function buildLoanAndProduct(fields) {
  const loanId = generateLoanId();
  const productId = generateProductId();

  const loan = {
    id: loanId,
    loanNumber: (fields[IN.LoanID] || "").trim().padStart(10, "0"),
    borrowerName: (fields[IN.BorrowerName] || "").trim(),
    property: {
      streetAddress: (fields[IN.AddressLine1] || "").trim(),
      city: (fields[IN.City] || "").trim(),
      state: (fields[IN.State] || "").trim(),
      zipCode: (fields[IN.Zip] || "").trim(),
    },
    status: "PENDING",
    products: [
      {
        id: productId,
        productType: "BPO",
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
  const engagementId = generateEngagementId();
  const now = new Date().toISOString();

  const loanMeta = rows.map((fields) => {
    const { loan, productId } = buildLoanAndProduct(fields);
    return { loan, productId, fields };
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
function buildOrderDocument(fields, engagementId, loanId, productId, sourceFileName) {
  const loanNumber = (fields[IN.LoanID] || "").trim().padStart(10, "0");
  const collateralNumber = (fields[IN.CollateralNumber] || "").trim();

  return {
    id: uuid.v4(),
    clientId: statebridgeClientId,
    tenantId: statebridge_tenantId,
    // Engagement linkage
    engagementId,
    engagementLoanId: loanId,
    engagementProductId: productId,
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
    productType: "BPO",
    occupancy: (fields[IN.Occupancy] || "").trim(),
    propertyType: (fields[IN.PropertyType] || "").trim(),
    // Lifecycle
    orderStatus: "pending",
    status: "NEW",
    dateOrdered: new Date().toISOString(),
    dateCompleted: null,
    source: "statebridge-sftp",
    sourceFile: sourceFileName,
    // PDF naming helper — surfaced so outbound leg doesn't re-parse
    // Output PDF name: <loanNumber>_BPO_<collateralNumber>_<yyyymmdd#hhmmss>.pdf
    expectedPdfPrefix: `${loanNumber}_BPO_${collateralNumber}`,
  };
}

/**
 * Check whether we have already processed this file (idempotency on re-delivery).
 * Returns true if an engagement with this sourceFile already exists.
 */
async function fileAlreadyProcessed(sourceFileName) {
  const { resources } = await engagementsContainer.items
    .query({
      query:
        "SELECT c.id FROM c WHERE c.tenantId = @tenantId AND c.sourceFile = @sourceFile",
      parameters: [
        { name: "@tenantId", value: statebridge_tenantId },
        { name: "@sourceFile", value: sourceFileName },
      ],
    })
    .fetchAll();
  return resources.length > 0;
}

// ─── Function Handler ─────────────────────────────────────────────────────────

app.storageQueue("processSftpOrderFile", {
  // Queue on the MAIN storage account (where Event Grid delivers notifications).
  queueName: "sftp-order-events",
  connection: "AZURE_STORAGE_CONNECTION_STRING",

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

    // 2. Idempotency: skip if this file has already been processed
    if (await fileAlreadyProcessed(blobName)) {
      context.log(`File ${blobName} already processed — skipping (idempotent re-delivery)`);
      return;
    }

    // 3. Download the file text
    let fileContent;
    try {
      fileContent = await downloadSftpBlob("statebridge", blobName, context);
    } catch (err) {
      context.log(`ERROR: Failed to download blob ${blobName}: ${err.message}`);
      throw err; // retryable
    }

    // 4. Parse rows
    const rows = parseOrderFile(fileContent);
    if (rows.length === 0) {
      context.log(`WARNING: No data rows found in ${blobName} — nothing to process`);
      return;
    }
    context.log(`Parsed ${rows.length} order row(s) from ${blobName}`);

    // Validate each row has minimum columns before creating anything
    const validRows = [];
    for (const fields of rows) {
      if (fields.length < 11) {
        context.log(`WARNING: Skipping malformed row (${fields.length} columns): ${fields.join("|")}`);
        continue;
      }
      validRows.push(fields);
    }

    if (validRows.length === 0) {
      context.log(`ERROR: All rows in ${blobName} were malformed — nothing to process`);
      return;
    }

    // 5. Build and write the Engagement (one per file upload)
    const { engagement, loanMeta, engagementId } = buildEngagementDocument(validRows, blobName);

    try {
      await engagementsContainer.items.create(engagement);
      context.log(
        `Created engagement id=${engagementId} number=${engagement.engagementNumber} with ${loanMeta.length} loan(s)`
      );
    } catch (err) {
      context.log(`ERROR: Failed to create engagement for file ${blobName}: ${err.message}`);
      throw err; // retryable — orders should not be created without the engagement
    }

    // 6. Create one linked order per valid row
    let created = 0;
    const errors = [];

    for (const { fields, loan, productId } of loanMeta) {
      const orderDoc = buildOrderDocument(
        fields,
        engagementId,
        loan.id,
        productId,
        blobName
      );

      try {
        await ordersContainer.items.create(orderDoc);
        created++;
        context.log(
          `Created order id=${orderDoc.id} externalOrderId=${orderDoc.externalOrderId} loanId=${orderDoc.loanId} engagementId=${engagementId}`
        );
      } catch (err) {
        context.log(
          `ERROR: Failed to create order externalOrderId=${orderDoc.externalOrderId} loanId=${orderDoc.loanId}: ${err.message}`
        );
        errors.push({ externalOrderId: orderDoc.externalOrderId, error: err.message });
      }
    }

    context.log(
      `processSftpOrderFile complete — file: ${blobName} | engagement: ${engagementId} | orders created: ${created} | errors: ${errors.length}`
    );

    if (errors.length > 0) {
      throw new Error(
        `${errors.length} order(s) failed to create. First error: ${errors[0].error}. File: ${blobName}`
      );
    }
  },
});

