/**
 * handleStatebridgeBpoDocument.js
 *
 * Cosmos Change Feed function for the Statebridge BPO Axiom extraction flow:
 *
 *   detectStatebridgeBpoUpload — Cosmos Change Feed on `documents` container.
 *   When a BPO PDF document is inserted, this function:
 *     1. Verifies the document belongs to a Statebridge order
 *     2. Submits the PDF to Axiom's DOCUMENT_EXTRACTION pipeline
 *     3. Opens an SSE connection to GET /api/pipelines/:jobId/stream
 *     4. Waits for the pipeline.completed (or pipeline.failed) event
 *     5. Fetches full results via GET /api/pipelines/:jobId/results
 *     6. Copies the BPO PDF to the SFTP results/ folder with Statebridge naming
 *     7. Patches the order with extracted data and marks it COMPLETED
 *
 * Required env vars (add to infrastructure/modules/app-services.bicep):
 *   AXIOM_API_BASE_URL         — e.g. https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io
 *   CosmosDbConnection__accountEndpoint — same value as COSMOSDB_ENDPOINT;
 *                                required by the Cosmos DB trigger binding
 *
 * Already present env vars used here:
 *   COSMOSDB_ENDPOINT, DATABASE_NAME
 *   AZURE_STORAGE_ACCOUNT_NAME  — main doc storage (source of BPO PDFs)
 *   SFTP_STORAGE_ACCOUNT_NAME   — SFTP account (destination for result PDFs)
 *   STATEBRIDGE_TENANT_ID       — Cosmos partition key for Statebridge docs
 *   STATEBRIDGE_CLIENT_ID       — e.g. "visionone"
 *   STORAGE_CONTAINER_DOCUMENTS — blob container name for document files
 */

"use strict";

const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const axios = require("axios");
const http = require("http");
const https = require("https");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint         = process.env.COSMOSDB_ENDPOINT;
const databaseName           = process.env.DATABASE_NAME;
const storageAccountName     = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridge_tenantId   = process.env.STATEBRIDGE_TENANT_ID;
const statebridgeClientId    = process.env.STATEBRIDGE_CLIENT_ID;
const axiomApiBaseUrl        = process.env.AXIOM_API_BASE_URL;

// Fail loudly at cold-start so misconfiguration surfaces immediately.
if (!cosmosEndpoint)         throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName)           throw new Error("DATABASE_NAME is required but not set");
if (!storageAccountName)     throw new Error("AZURE_STORAGE_ACCOUNT_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridge_tenantId)   throw new Error("STATEBRIDGE_TENANT_ID is required but not set");
if (!statebridgeClientId)    throw new Error("STATEBRIDGE_CLIENT_ID is required but not set");
if (!axiomApiBaseUrl)        throw new Error("AXIOM_API_BASE_URL is required but not set");

// SSE timeout: 4 minutes — leaves headroom within Azure Functions' 5-min default limit.
const SSE_TIMEOUT_MS = 4 * 60 * 1000;

// ─── Clients (module-scoped so they are reused across invocations) ─────────────

const credential = new DefaultAzureCredential();

const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
const db = cosmosClient.database(databaseName);
const ordersContainer = db.container("orders");

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
 * the BPO PDF blob.  The SAS is valid for 30 minutes.
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

  const sourceSasUrl = await buildSasUrl(documentContainerName, blobPath);

  const destContainer = sftpBlobClient.getContainerClient("statebridge");
  const destBlobClient = destContainer.getBlockBlobClient(destBlobName);

  context.log(`Copying BPO PDF → SFTP statebridge/${destBlobName}`);
  const poller = await destBlobClient.beginCopyFromURL(sourceSasUrl);
  await poller.pollUntilDone();

  return destBlobName;
}

// ─── SSE Client ───────────────────────────────────────────────────────────────

/**
 * Connect to Axiom's SSE stream and wait for a terminal pipeline event.
 *
 * Returns a promise that resolves with { eventType, data } on terminal events:
 *   pipeline.completed, pipeline.failed, pipeline.cancelled, pipeline.timeout
 *
 * Rejects on network error, SSE parse failure, or timeout.
 *
 * Uses Node.js built-in http/https — no EventSource polyfill needed.
 */
function awaitPipelineCompletion(jobId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${axiomApiBaseUrl}/api/pipelines/${jobId}/stream?timeout=${timeoutMs}`);
    const transport = url.protocol === "https:" ? https : http;

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`SSE stream timed out after ${timeoutMs}ms waiting for pipeline ${jobId}`));
    }, timeoutMs + 5000); // +5s grace beyond Axiom's own timeout

    const req = transport.get(url, {
      headers: { Accept: "text/event-stream" },
      timeout: timeoutMs + 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`SSE stream returned HTTP ${res.statusCode} for pipeline ${jobId}`));
        res.resume();
        return;
      }

      let buffer = "";
      let currentEvent = {};

      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        buffer += chunk;
        // Parse SSE frames (delimited by blank lines)
        const frames = buffer.split("\n\n");
        buffer = frames.pop(); // keep incomplete last frame

        for (const frame of frames) {
          if (!frame.trim()) continue;
          const lines = frame.split("\n");
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent.eventName = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              currentEvent.data = line.slice(6);
            } else if (line.startsWith("id: ")) {
              currentEvent.id = line.slice(4).trim();
            }
            // Ignore comments (lines starting with :)
          }

          const terminalEvents = new Set([
            "pipeline.completed", "pipeline.failed",
            "pipeline.cancelled", "pipeline.timeout",
            "done",
          ]);

          if (currentEvent.eventName && terminalEvents.has(currentEvent.eventName)) {
            clearTimeout(timer);
            req.destroy();
            let parsed = {};
            try { parsed = JSON.parse(currentEvent.data); } catch { /* use empty obj */ }
            resolve({ eventType: currentEvent.eventName, data: parsed });
            return;
          }
          currentEvent = {};
        }
      });

      res.on("end", () => {
        clearTimeout(timer);
        reject(new Error(`SSE stream ended without a terminal event for pipeline ${jobId}`));
      });

      res.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`SSE stream error for pipeline ${jobId}: ${err.message}`));
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`SSE connection failed for pipeline ${jobId}: ${err.message}`));
    });

    req.on("timeout", () => {
      clearTimeout(timer);
      req.destroy();
      reject(new Error(`SSE connection timed out for pipeline ${jobId}`));
    });
  });
}

// ─── Result processor ─────────────────────────────────────────────────────────

/**
 * After pipeline completion: fetch results from Axiom, copy PDF to SFTP,
 * and patch the order with extracted data.
 */
async function processBpoExtractionResult(orderId, pipelineJobId, order, blobName, context) {
  // 1. Fetch extraction results from Axiom's polling endpoint (with retry).
  //    SSE pipeline.completed events truncate data >5KB so we always fetch the
  //    full results via the REST endpoint.
  let extractedData;
  try {
    const resp = await withRetry(
      () => axios.get(
        `${axiomApiBaseUrl}/api/pipelines/${pipelineJobId}/results`,
        { timeout: 15000 }
      ),
      { maxRetries: 2, initialDelayMs: 1000, label: `Axiom results order ${orderId}` }
    );
    const raw = resp.data;
    const inner = raw?.results ?? raw;
    extractedData = inner?.extractedData ?? inner?.stages?.extract?.extractedData ?? {};
  } catch (err) {
    context.error(`[processBpoResult] Failed to fetch Axiom results for order ${orderId}: ${err.message}`);
    throw err;
  }

  const county            = extractedData?.county ?? null;
  const propertyCondition = extractedData?.propertyCondition ?? null;
  const asIsValue         = typeof extractedData?.asIsValue === "number" ? extractedData.asIsValue : null;
  const repairedValue     = typeof extractedData?.repairedValue === "number" ? extractedData.repairedValue : null;

  context.log(`[processBpoResult] Extracted fields for order ${orderId}:`, {
    county, propertyCondition, asIsValue, repairedValue,
  });

  // 2. Copy the BPO PDF to SFTP results/ with Statebridge naming
  const loanId           = order.loanId;
  const collateralNumber = order.collateralNumber;

  let sftpResultPdfName = null;
  if (blobName) {
    try {
      const docBlobContainer = process.env.STORAGE_CONTAINER_DOCUMENTS;
      if (!docBlobContainer) {
        throw new Error("STORAGE_CONTAINER_DOCUMENTS is required to copy BPO PDF to SFTP");
      }
      sftpResultPdfName = await copyBpoToSftpResults(
        blobName, docBlobContainer, loanId, collateralNumber, context
      );
    } catch (err) {
      context.error(`[processBpoResult] SFTP copy failed for order ${orderId}: ${err.message}`);
      // Non-fatal — still write the extracted data even if the copy fails.
    }
  }

  // 3. Patch the order: set extracted BPO fields, COMPLETED status, dateCompleted
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
    `[processBpoResult] Order ${orderId} marked COMPLETED. sftpResultPdfName=${sftpResultPdfName}`
  );
}

// ─── Function: Detect BPO upload (Cosmos Change Feed) ─────────────────────────

app.cosmosDB("detectStatebridgeBpoUpload", {
  connection: "CosmosDbConnection",
  databaseName,
  containerName: "documents",
  leaseContainerName: "leases",
  leaseContainerPrefix: "bpo-detect",
  createLeaseContainerIfNotExists: false,
  startFromBeginning: false,
  handler: async (documents, context) => {
    for (const doc of documents) {
      // ── Filter: only BPO PDFs ────────────────────────────────────────
      if (doc.mimeType !== "application/pdf") continue;

      // Match on category (what DocumentService stores) or documentType (belt-and-suspenders)
      const isBpo = doc.category === "bpo-report" || doc.documentType === "BPO_REPORT";
      if (!isBpo) continue;
      if (!doc.orderId) continue;

      const tenantId = doc.tenantId ?? statebridge_tenantId;

      // ── Load the order to verify it is a Statebridge order ───────────
      let order;
      try {
        const { resource } = await ordersContainer.item(doc.orderId, tenantId).read();
        order = resource;
      } catch (err) {
        context.log(`[detectBpo] Could not read order ${doc.orderId}: ${err.message}`);
        continue;
      }

      if (!order || order.source !== "statebridge-sftp") continue;
      if (order.bpoExtractionStatus === "AXIOM_PENDING" ||
          order.bpoExtractionStatus === "COMPLETED") {
        context.log(`[detectBpo] Order ${doc.orderId} already has bpoExtractionStatus=${order.bpoExtractionStatus} — skipping`);
        continue;
      }

      if (!order.loanId || !order.collateralNumber) {
        context.error(`[detectBpo] Order ${doc.orderId} missing loanId or collateralNumber — cannot process`);
        continue;
      }

      // ── Build SAS URL for Axiom to download the PDF ──────────────────
      const docBlobContainer = process.env.STORAGE_CONTAINER_DOCUMENTS;
      if (!docBlobContainer) {
        context.error("[detectBpo] STORAGE_CONTAINER_DOCUMENTS is not set — cannot build SAS URL for Axiom");
        continue;
      }
      // DocumentService stores the blob path as `blobName` (e.g. "orderId/uuid.pdf")
      const blobName = doc.blobName;
      if (!blobName) {
        context.error(`[detectBpo] Document ${doc.id} has no blobName — cannot build SAS URL`);
        continue;
      }

      let blobSasUrl;
      try {
        blobSasUrl = await buildSasUrl(docBlobContainer, blobName);
      } catch (err) {
        context.error(`[detectBpo] Failed to build SAS URL for ${blobName}: ${err.message}`);
        continue;
      }

      // ── Submit to Axiom extraction pipeline ──────────────────────────
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
                    documentName: doc.name ?? doc.fileName ?? "bpo-report.pdf",
                    documentReference: blobSasUrl,
                    mimeType: "application/pdf",
                  },
                ],
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
          `[detectBpo] Axiom pipeline submission failed for order ${doc.orderId} after retries: ${err.message}`
        );
        try {
          await ordersContainer.item(doc.orderId, tenantId).patch([
            { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_SUBMISSION_FAILED" },
            { op: "set", path: "/bpoSubmissionError", value: err.message },
            { op: "set", path: "/updatedAt", value: new Date().toISOString() },
          ]);
        } catch (patchErr) {
          context.error(`[detectBpo] Also failed to stamp AXIOM_SUBMISSION_FAILED on order ${doc.orderId}: ${patchErr.message}`);
        }
        continue;
      }

      // ── Stamp AXIOM_PENDING ──────────────────────────────────────────
      try {
        await ordersContainer.item(doc.orderId, tenantId).patch([
          { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_PENDING" },
          { op: "set", path: "/axiomBpoPipelineJobId", value: pipelineJobId },
          { op: "set", path: "/bpoDocumentId", value: doc.id },
          { op: "set", path: "/bpoBlobName", value: blobName },
          { op: "set", path: "/updatedAt", value: new Date().toISOString() },
        ]);
      } catch (err) {
        context.warn(`[detectBpo] Could not stamp AXIOM_PENDING on order ${doc.orderId}: ${err.message}`);
      }

      context.log(
        `[detectBpo] Submitted BPO extraction to Axiom for order ${doc.orderId} (jobId=${pipelineJobId}). Opening SSE stream…`
      );

      // ── Wait for pipeline completion via SSE ─────────────────────────
      let sseResult;
      try {
        sseResult = await awaitPipelineCompletion(pipelineJobId, SSE_TIMEOUT_MS);
      } catch (sseErr) {
        context.error(`[detectBpo] SSE stream error for order ${doc.orderId}: ${sseErr.message}`);
        try {
          await ordersContainer.item(doc.orderId, tenantId).patch([
            { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_SSE_TIMEOUT" },
            { op: "set", path: "/bpoSseError", value: sseErr.message },
            { op: "set", path: "/updatedAt", value: new Date().toISOString() },
          ]);
        } catch (_) { /* best-effort stamp */ }
        continue;
      }

      context.log(`[detectBpo] SSE terminal event for order ${doc.orderId}: ${sseResult.eventType}`);

      // ── Handle pipeline.failed / cancelled / timeout ─────────────────
      if (sseResult.eventType !== "pipeline.completed" && sseResult.eventType !== "done") {
        const failureStatus =
          sseResult.eventType === "pipeline.failed" ? "AXIOM_FAILED" :
          sseResult.eventType === "pipeline.cancelled" ? "AXIOM_CANCELLED" :
          sseResult.eventType === "pipeline.timeout" ? "AXIOM_TIMEOUT" :
          "AXIOM_UNKNOWN_STATUS";

        context.error(`[detectBpo] Pipeline ${pipelineJobId} ended with ${sseResult.eventType} for order ${doc.orderId}`);
        try {
          await ordersContainer.item(doc.orderId, tenantId).patch([
            { op: "set", path: "/bpoExtractionStatus", value: failureStatus },
            { op: "set", path: "/updatedAt", value: new Date().toISOString() },
          ]);
        } catch (_) { /* best-effort stamp */ }
        continue;
      }

      // ── Pipeline completed — fetch full results and process ──────────
      try {
        await processBpoExtractionResult(doc.orderId, pipelineJobId, order, blobName, context);
      } catch (err) {
        context.error(`[detectBpo] Result processing failed for order ${doc.orderId}: ${err.message}`);
        try {
          await ordersContainer.item(doc.orderId, tenantId).patch([
            { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_PROCESSING_FAILED" },
            { op: "set", path: "/bpoProcessingError", value: String(err.message ?? err) },
            { op: "set", path: "/updatedAt", value: new Date().toISOString() },
          ]);
        } catch (_) { /* best-effort stamp */ }
      }
    }
  },
});
