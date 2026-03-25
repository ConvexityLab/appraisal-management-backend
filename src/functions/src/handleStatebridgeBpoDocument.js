/**
 * handleStatebridgeBpoDocument.js
 *
 * Two Azure Functions for the Statebridge BPO Axiom extraction round-trip:
 *
 *   1. detectStatebridgeBpoUpload — Cosmos Change Feed on `documents` container.
 *      Fires when a document is inserted/updated. Detects BPO PDF uploads
 *      linked to Statebridge orders and submits them to the Axiom
 *      DOCUMENT_EXTRACTION pipeline.
 *
 *   2. statebridgeBpoAxiomCallback — HTTP POST handler.
 *      Axiom calls this when it finishes extracting fields from the BPO PDF.
 *      On success, writes county/condition/asIsValue/repairedValue back to the
 *      order document, copies the PDF to the SFTP results container with the
 *      correct file-name format, then marks the order COMPLETED.
 *
 * Required env vars (add to infrastructure/modules/app-services.bicep):
 *   AXIOM_API_BASE_URL         — e.g. https://axiom.internal.example.com
 *   AXIOM_WEBHOOK_SECRET       — HMAC-SHA256 signing secret shared with Axiom
 *   API_CALLBACK_BASE_URL      — externally reachable URL of the functions host
 *                                (used to build the webhookUrl sent to Axiom)
 *   CosmosDbConnection__accountEndpoint — same value as COSMOSDB_ENDPOINT;
 *                                required by the Cosmos DB trigger binding
 *
 * Already present env vars used here:
 *   COSMOSDB_ENDPOINT, DATABASE_NAME
 *   AZURE_STORAGE_ACCOUNT_NAME  — main doc storage (source of BPO PDFs)
 *   SFTP_STORAGE_ACCOUNT_NAME   — SFTP account (destination for result PDFs)
 *   STATEBRIDGE_TENANT_ID       — Cosmos partition key for Statebridge docs
 *   STATEBRIDGE_CLIENT_ID       — "visionone"
 */

"use strict";

const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const { createHmac } = require("crypto");
const axios = require("axios");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint        = process.env.COSMOSDB_ENDPOINT;
const databaseName          = process.env.DATABASE_NAME;
const storageAccountName    = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridge_tenantId  = process.env.STATEBRIDGE_TENANT_ID;
const statebridgeClientId   = process.env.STATEBRIDGE_CLIENT_ID;
const axiomApiBaseUrl       = process.env.AXIOM_API_BASE_URL;
const axiomWebhookSecret    = process.env.AXIOM_WEBHOOK_SECRET;
const apiCallbackBaseUrl    = process.env.API_CALLBACK_BASE_URL;

// Fail loudly at cold-start so misconfiguration surfaces immediately.
if (!cosmosEndpoint)        throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName)          throw new Error("DATABASE_NAME is required but not set");
if (!storageAccountName)    throw new Error("AZURE_STORAGE_ACCOUNT_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridge_tenantId)  throw new Error("STATEBRIDGE_TENANT_ID is required but not set");
if (!statebridgeClientId)   throw new Error("STATEBRIDGE_CLIENT_ID is required but not set");
if (!axiomApiBaseUrl)       throw new Error("AXIOM_API_BASE_URL is required but not set");
if (!axiomWebhookSecret)    throw new Error("AXIOM_WEBHOOK_SECRET is required but not set");
// API_CALLBACK_BASE_URL is validated at handler invocation (not cold-start) because
// the first deploy cannot know its own FQDN yet — it is set in the second deploy.

// ─── Clients (module-scoped so they are reused across invocations) ─────────────

const credential = new DefaultAzureCredential();

const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
const db = cosmosClient.database(databaseName);
const ordersContainer    = db.container("orders");
const documentsContainer = db.container("documents");

// Main storage account — source of uploaded BPO PDFs
const mainBlobClient = new BlobServiceClient(
  `https://${storageAccountName}.blob.core.windows.net`,
  credential
);

// SFTP storage account — destination for result PDFs
const sftpBlobClient = new BlobServiceClient(
  `https://${sftpStorageAccountName}.blob.core.windows.net`,
  credential
);

// ─── Inline Loom pipeline definition (Document-only extraction) ───────────────
// Mirrors AxiomService.PIPELINE_DOC_EXTRACT in the container app.
const BPO_EXTRACTION_PIPELINE = {
  name: "document-extraction",
  version: "1.0.0",
  stages: [
    {
      name: "extract",
      actor: "DocumentProcessor",
      mode: "single",
      input: {
        documents:  { path: "trigger.documents" },
        tenantId:   { path: "trigger.tenantId" },
        clientId:   { path: "trigger.clientId" },
        documentType: { path: "trigger.documentType" },
      },
      timeout: 180000,
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Simple retry with exponential backoff for transient failures.
 * Retries up to `maxRetries` times, starting at `initialDelayMs` and doubling each attempt.
 */
async function withRetry(fn, { maxRetries = 2, initialDelayMs = 1000, label = "operation" } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
/**
 * Build a user-delegation SAS URL so Axiom (an external service) can download
 * the BPO PDF blob.  The SAS is valid for 30 minutes — enough time for Axiom
 * to ingest the document and call the callback.
 */
async function buildSasUrl(containerName, blobPath) {
  const userDelegationKey = await mainBlobClient
    .getUserDelegationKey(new Date(), new Date(Date.now() + 30 * 60 * 1000));

  const blobClient = mainBlobClient.getContainerClient(containerName).getBlobClient(blobPath);
  const sasParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn: new Date(Date.now() + 30 * 60 * 1000),
    },
    userDelegationKey,
    storageAccountName,
  );
  return `${blobClient.url}?${sasParams.toString()}`;
}

/**
 * Copy a blob from the main storage documents container to the SFTP results
 * container, using the Statebridge-required file-name format:
 *   {loanId}_BPO_{collateralNumber}_{yyyymmdd#hhmmss}.pdf
 *
 * Returns the destination blob name.
 */
async function copyBpoToSftpResults(blobPath, documentContainerName, loanId, collateralNumber, context) {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const hhmmss  = now.toISOString().slice(11, 19).replace(/:/g, "");
  const destBlobName = `results/${loanId}_BPO_${collateralNumber}_${yyyymmdd}#${hhmmss}.pdf`;

  const sourceBlob = mainBlobClient.getContainerClient(documentContainerName).getBlobClient(blobPath);
  const sourceSasUrl = await buildSasUrl(documentContainerName, blobPath);

  // Write to the statebridge SFTP container under results/ (same path as writeStatebridgeDailyResults)
  const destContainer = sftpBlobClient.getContainerClient("statebridge");
  const destBlobClient = destContainer.getBlockBlobClient(destBlobName);

  context.log(`Copying BPO PDF → SFTP statebridge/${destBlobName}`);
  const poller = await destBlobClient.beginCopyFromURL(sourceSasUrl);
  await poller.pollUntilDone();

  return destBlobName;
}

/**
 * Verify Axiom's HMAC-SHA256 webhook signature.
 * Axiom sends X-Axiom-Signature: sha256=<hex-digest> computed over the raw body.
 */
function verifyAxiomSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", axiomWebhookSecret)
    .update(rawBody, "utf8").digest("hex");
  // Constant-time comparison to defend against timing attacks
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Function 1: Detect BPO upload (Cosmos Change Feed) ──────────────────────

app.cosmosDB("detectStatebridgeBpoUpload", {
  // The binding setting name is the prefix for the identity-based connection.
  // Add CosmosDbConnection__accountEndpoint = COSMOSDB_ENDPOINT in Bicep.
  connection: "CosmosDbConnection",
  databaseName,
  containerName: "documents",
  leaseContainerName: "leases",
  // leaseContainerPrefix prevents "builder already used" crash — each trigger
  // must have a unique prefix so the Cosmos SDK allocates separate builder instances.
  leaseContainerPrefix: "bpo-detect",
  createLeaseContainerIfNotExists: false, // infrastructure creates leases container
  startFromBeginning: false,
  handler: async (documents, context) => {
    for (const doc of documents) {
      // Only process BPO PDFs
      if (doc.mimeType !== "application/pdf") continue;
      if (doc.documentType !== "BPO_REPORT") continue;
      if (!doc.orderId) continue;

      const tenantId = doc.tenantId ?? statebridge_tenantId;

      // Load the order to verify it is a Statebridge order
      let order;
      try {
        const { resource } = await ordersContainer.item(doc.orderId, tenantId).read();
        order = resource;
      } catch (err) {
        context.log(`[detectStatebridgeBpoUpload] Could not read order ${doc.orderId}: ${err.message}`);
        continue;
      }

      if (!order || order.source !== "statebridge-sftp") continue;
      if (order.bpoExtractionStatus === "AXIOM_PENDING" ||
          order.bpoExtractionStatus === "COMPLETED") {
        context.log(`[detectStatebridgeBpoUpload] Order ${doc.orderId} already has bpoExtractionStatus=${order.bpoExtractionStatus} — skipping`);
        continue;
      }

      // Build the blob SAS URL for Axiom to download the PDF
      const blobContainerName = "documents"; // main documents blob container
      let blobSasUrl;
      try {
        blobSasUrl = await buildSasUrl(blobContainerName, doc.blobPath);
      } catch (err) {
        context.error(`[detectStatebridgeBpoUpload] Failed to build SAS URL for ${doc.blobPath}: ${err.message}`);
        continue;
      }

      if (!apiCallbackBaseUrl) {
        context.error("[detectStatebridgeBpoUpload] API_CALLBACK_BASE_URL is not set — cannot submit to Axiom. Set this env var to the functions FQDN and redeploy.");
        continue;
      }
      const callbackUrl = `${apiCallbackBaseUrl}/api/statebridge-bpo-callback`;

      // Submit to Axiom extraction pipeline (with retry for transient failures)
      let pipelineJobId;
      try {
        const resp = await withRetry(
          () => axios.post(
            `${axiomApiBaseUrl}/api/pipelines`,
            {
              pipeline: BPO_EXTRACTION_PIPELINE,
              input: {
                tenantId: statebridge_tenantId,
                clientId: statebridgeClientId,
                correlationId: doc.orderId,
                correlationType: "BPO_EXTRACTION",
                documentType: "bpo-report",
                documents: [
                  {
                    documentName: doc.fileName ?? "bpo-report.pdf",
                    documentReference: blobSasUrl,
                    mimeType: "application/pdf",
                  },
                ],
                delivery: {
                  webhookUrl: callbackUrl,
                  webhookSecret: axiomWebhookSecret,
                  includeFieldConfidence: true,
                },
              },
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: 15000,
            }
          ),
          { maxRetries: 2, initialDelayMs: 1000, label: `Axiom submit order ${doc.orderId}` }
        );
        pipelineJobId = resp.data?.jobId ?? resp.data?.pipelineJobId;
        if (!pipelineJobId) throw new Error(`Axiom did not return a jobId. Response: ${JSON.stringify(resp.data)}`);
      } catch (err) {
        context.error(
          `[detectStatebridgeBpoUpload] Axiom pipeline submission failed for order ${doc.orderId} after retries: ${err.message}`
        );
        // Stamp AXIOM_SUBMISSION_FAILED so this order isn't silently lost
        try {
          await ordersContainer.item(doc.orderId, tenantId).patch([
            { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_SUBMISSION_FAILED" },
            { op: "set", path: "/bpoSubmissionError", value: err.message },
            { op: "set", path: "/updatedAt", value: new Date().toISOString() },
          ]);
        } catch (patchErr) {
          context.error(`[detectStatebridgeBpoUpload] Also failed to stamp AXIOM_SUBMISSION_FAILED on order ${doc.orderId}: ${patchErr.message}`);
        }
        continue;
      }

      // Stamp the order with the pending extraction state
      try {
        await ordersContainer.item(doc.orderId, tenantId).patch([
          { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_PENDING" },
          { op: "set", path: "/axiomBpoPipelineJobId", value: pipelineJobId },
          { op: "set", path: "/bpoDocumentId", value: doc.id },
          { op: "set", path: "/bpoBlobPath", value: doc.blobPath },
          { op: "set", path: "/updatedAt", value: new Date().toISOString() },
        ]);
      } catch (err) {
        // Non-fatal — Axiom submission succeeded; we just lose the status stamp.
        context.warn(
          `[detectStatebridgeBpoUpload] Could not stamp bpoExtractionStatus on order ${doc.orderId}: ${err.message}`
        );
      }

      context.log(
        `[detectStatebridgeBpoUpload] Submitted BPO extraction to Axiom for order ${doc.orderId} (pipelineJobId=${pipelineJobId})`
      );
    }
  },
});

// ─── Function 2: Receive Axiom callback (HTTP trigger) ───────────────────────

app.http("statebridgeBpoAxiomCallback", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "statebridge-bpo-callback",
  handler: async (request, context) => {
    // Acknowledge immediately — Axiom should not wait on our processing.
    // We read and verify the payload first, then process asynchronously.
    let rawBody;
    try {
      rawBody = await request.text();
    } catch (err) {
      return { status: 400, body: JSON.stringify({ error: "Could not read request body" }) };
    }

    const signature = request.headers.get("x-axiom-signature") ?? "";
    if (!verifyAxiomSignature(rawBody, signature)) {
      context.warn("[statebridgeBpoAxiomCallback] Invalid Axiom webhook signature — rejecting");
      return { status: 401, body: JSON.stringify({ error: "Invalid signature" }) };
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      return { status: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    // Acknowledge before processing — Axiom does not retry on 200.
    const immediate200 = { status: 200, body: JSON.stringify({ success: true }) };

    const orderId     = payload.correlationId ?? payload.orderId;
    const jobId       = payload.jobId ?? payload.pipelineJobId;
    const status      = payload.status;           // "completed" | "failed"

    if (!orderId || !jobId) {
      context.error("[statebridgeBpoAxiomCallback] Missing correlationId or jobId in payload", payload);
      return immediate200;
    }

    if (status === "failed") {
      context.error(`[statebridgeBpoAxiomCallback] Axiom BPO extraction failed for order ${orderId}`, payload.error);
      // Stamp FAILED so nightly results function can skip this order gracefully
      try {
        await ordersContainer.item(orderId, statebridge_tenantId).patch([
          { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_FAILED" },
          { op: "set", path: "/updatedAt", value: new Date().toISOString() },
        ]);
      } catch (_) { /* non-fatal */ }
      return immediate200;
    }

    if (status !== "completed") {
      context.log(`[statebridgeBpoAxiomCallback] Ignoring non-terminal status '${status}' for order ${orderId}`);
      return immediate200;
    }

    // Process the extraction result inline (not fire-and-forget) to ensure
    // the runtime doesn't terminate before we've written results to Cosmos.
    // We already read+verified the payload, so this is safe to await.
    try {
      await processBpoExtractionResult(orderId, jobId, context);
    } catch (err) {
      context.error(`[statebridgeBpoAxiomCallback] Processing failed for order ${orderId}: ${err.message}`);
      // Still return 200 — Axiom already delivered the payload; re-delivery won't help.
      // The order is stamped with AXIOM_PROCESSING_FAILED inside processBpoExtractionResult.
    }
    return immediate200;
  },
});

// ─── Async result processor ───────────────────────────────────────────────────

async function processBpoExtractionResult(orderId, pipelineJobId, context) {
  try {
    // 1. Load the order to get loanId, collateralNumber, blobPath
    const { resource: order } = await ordersContainer
      .item(orderId, statebridge_tenantId)
      .read();

    if (!order) {
      context.error(`[processBpoExtractionResult] Order ${orderId} not found in Cosmos`);
      return;
    }

    const loanId          = order.loanId;
    const collateralNumber = order.collateralNumber;
    const bpoBlobPath     = order.bpoBlobPath;

    if (!loanId || !collateralNumber) {
      context.error(`[processBpoExtractionResult] Order ${orderId} missing loanId or collateralNumber`);
      return;
    }

    // 2. Fetch extraction results from Axiom (with retry)
    let extractedData;
    try {
      const resp = await withRetry(
        () => axios.get(
          `${axiomApiBaseUrl}/api/pipelines/${pipelineJobId}/results`,
          { timeout: 15000 }
        ),
        { maxRetries: 2, initialDelayMs: 1000, label: `Axiom results order ${orderId}` }
      );
      // Axiom may nest under `results`
      const raw = resp.data;
      const inner = raw?.results ?? raw;
      extractedData = inner?.extractedData ?? inner?.stages?.extract?.extractedData ?? {};
    } catch (err) {
      context.error(`[processBpoExtractionResult] Failed to fetch Axiom results for order ${orderId}: ${err.message}`);
      return;
    }

    const county           = extractedData?.county ?? null;
    const propertyCondition = extractedData?.propertyCondition ?? null;
    const asIsValue        = typeof extractedData?.asIsValue === "number" ? extractedData.asIsValue : null;
    const repairedValue    = typeof extractedData?.repairedValue === "number" ? extractedData.repairedValue : null;

    context.log(`[processBpoExtractionResult] Extracted fields for order ${orderId}:`, {
      county, propertyCondition, asIsValue, repairedValue,
    });

    // 3. Copy the BPO PDF to SFTP results/ container
    let sftpResultPdfName = null;
    if (bpoBlobPath) {
      try {
        sftpResultPdfName = await copyBpoToSftpResults(
          bpoBlobPath, "documents", loanId, collateralNumber, context
        );
      } catch (err) {
        context.error(`[processBpoExtractionResult] SFTP copy failed for order ${orderId}: ${err.message}`);
        // Do not abort — still write the extracted data even if the copy fails.
      }
    }

    // 4. Patch the order: set extracted BPO fields, COMPLETED status, dateCompleted
    const now = new Date().toISOString();
    const patches = [
      { op: "set", path: "/bpoExtractionStatus", value: "COMPLETED" },
      { op: "set", path: "/status", value: "COMPLETED" },
      { op: "set", path: "/dateCompleted", value: now },
      { op: "set", path: "/updatedAt", value: now },
      { op: "set", path: "/bpoExtractedData", value: {
        county,
        propertyCondition,
        asIsValue,
        repairedValue,
        extractedAt: now,
        pipelineJobId,
      }},
    ];
    if (sftpResultPdfName) {
      patches.push({ op: "set", path: "/sftpResultPdfName", value: sftpResultPdfName });
    }

    await ordersContainer.item(orderId, statebridge_tenantId).patch(patches);

    context.log(
      `[processBpoExtractionResult] Order ${orderId} marked COMPLETED. sftpResultPdfName=${sftpResultPdfName}`
    );
  } catch (err) {
    context.error(`[processBpoExtractionResult] Unhandled error for order ${orderId}:`, err.message ?? err);
    // Stamp failure so the order isn't silently lost in limbo
    try {
      await ordersContainer.item(orderId, statebridge_tenantId).patch([
        { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_PROCESSING_FAILED" },
        { op: "set", path: "/bpoProcessingError", value: String(err.message ?? err) },
        { op: "set", path: "/updatedAt", value: new Date().toISOString() },
      ]);
    } catch (_) { /* best-effort stamp */ }
  }
}
