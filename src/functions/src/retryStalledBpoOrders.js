/**
 * retryStalledBpoOrders.js
 *
 * Timer-triggered Azure Function that runs every 2 hours to unstick BPO orders
 * that landed in a terminal failure state due to transient errors (Axiom
 * submission retry exhaustion, SSE timeouts, etc.).
 *
 * Strategy per failure state:
 *
 *   AXIOM_SUBMISSION_FAILED   — Axiom POST never succeeded.
 *                               Action: re-POST to Axiom, stamp AXIOM_PENDING, wait SSE.
 *
 *   AXIOM_SSE_TIMEOUT         — Axiom accepted the job but SSE stream timed out.
 *   AXIOM_TIMEOUT             — Axiom-side pipeline timeout.
 *                               Action: poll GET /results first (job may have finished
 *                               after the SSE disconnect); if still running, wait SSE.
 *
 *   AXIOM_FAILED              — Axiom reported pipeline failure.
 *   AXIOM_PROCESSING_FAILED   — Results fetch or local processing failed.
 *                               Action: full re-submission (fresh pipeline, fresh SSE wait).
 *
 * Safety limits:
 *   • Processes at most MAX_ORDERS_PER_RUN orders per invocation (default 2).
 *   • Skips orders that have been retried within the last RETRY_COOLDOWN_MS (30 min).
 *   • Marks each order with /lastRetryAt before touching Axiom, so a crash does
 *     not cause unbounded re-submission loops.
 *
 * Required env vars (same as handleStatebridgeBpoDocument):
 *   COSMOSDB_ENDPOINT, DATABASE_NAME
 *   AZURE_STORAGE_ACCOUNT_NAME
 *   SFTP_STORAGE_ACCOUNT_NAME
 *   STATEBRIDGE_TENANT_ID, STATEBRIDGE_CLIENT_ID
 *   AXIOM_API_BASE_URL
 *   STORAGE_CONTAINER_DOCUMENTS
 */

"use strict";

const { app }      = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const axios = require("axios");
const http  = require("http");
const https = require("https");
const { BPO_EXTRACTION_PIPELINE } = require("./bpo-pipeline-config");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint         = process.env.COSMOSDB_ENDPOINT;
const databaseName           = process.env.DATABASE_NAME;
const storageAccountName     = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridge_tenantId   = process.env.STATEBRIDGE_TENANT_ID;
const statebridgeClientId    = process.env.STATEBRIDGE_CLIENT_ID;
const axiomApiBaseUrl        = process.env.AXIOM_API_BASE_URL;
const docContainerName       = process.env.STORAGE_CONTAINER_DOCUMENTS;

if (!cosmosEndpoint)         throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName)           throw new Error("DATABASE_NAME is required but not set");
if (!storageAccountName)     throw new Error("AZURE_STORAGE_ACCOUNT_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridge_tenantId)   throw new Error("STATEBRIDGE_TENANT_ID is required but not set");
if (!statebridgeClientId)    throw new Error("STATEBRIDGE_CLIENT_ID is required but not set");
if (!axiomApiBaseUrl)        throw new Error("AXIOM_API_BASE_URL is required but not set");
if (!docContainerName)       throw new Error("STORAGE_CONTAINER_DOCUMENTS is required but not set");

// Max orders to attempt in a single function invocation.
// Each order can block for up to SSE_TIMEOUT_MS; keep total well under 5 min.
const MAX_ORDERS_PER_RUN = 2;

// Don't retry an order that was already retried within this window.
const RETRY_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

// SSE wait: 2 min per order in retry context (leaves headroom for 2 orders + overhead).
const SSE_TIMEOUT_MS = 2 * 60 * 1000;

// Failure states eligible for retry (excludes AXIOM_CANCELLED — likely intentional).
const RETRYABLE_STATUSES = [
  "AXIOM_SUBMISSION_FAILED",
  "AXIOM_SSE_TIMEOUT",
  "AXIOM_TIMEOUT",
  "AXIOM_FAILED",
  "AXIOM_PROCESSING_FAILED",
];

// ─── Clients ──────────────────────────────────────────────────────────────────

const credential = new DefaultAzureCredential();

const cosmosClient  = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
const db            = cosmosClient.database(databaseName);
const ordersContainer = db.container("orders");

const mainBlobClient = new BlobServiceClient(
  `https://${storageAccountName}.blob.core.windows.net`,
  credential
);

const sftpBlobClient = new BlobServiceClient(
  `https://${sftpStorageAccountName}.blob.core.windows.net`,
  credential
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withRetry(fn, { maxRetries = 2, initialDelayMs = 1000, label = "op" } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, initialDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

async function buildSasUrl(containerName, blobPath) {
  const userDelegationKey = await mainBlobClient.getUserDelegationKey(
    new Date(),
    new Date(Date.now() + 30 * 60 * 1000)
  );
  const blobClient = mainBlobClient.getContainerClient(containerName).getBlobClient(blobPath);
  const sasParams = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn: new Date(Date.now() + 30 * 60 * 1000),
    },
    userDelegationKey,
    storageAccountName
  );
  return `${blobClient.url}?${sasParams.toString()}`;
}

async function copyBpoToSftpResults(blobPath, documentContainerName, loanId, collateralNumber, context) {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const hhmmss   = now.toISOString().slice(11, 19).replace(/:/g, "");
  const destBlobName = `results/${loanId}_BPO_${collateralNumber}_${yyyymmdd}#${hhmmss}.pdf`;

  const sourceSasUrl = await buildSasUrl(documentContainerName, blobPath);
  const destContainer  = sftpBlobClient.getContainerClient("statebridge");
  const destBlobClient = destContainer.getBlockBlobClient(destBlobName);

  context.log(`[retryBpo] Copying BPO PDF → SFTP statebridge/${destBlobName}`);
  const poller = await destBlobClient.beginCopyFromURL(sourceSasUrl);
  await poller.pollUntilDone();
  return destBlobName;
}

/** Wait for SSE pipeline terminal event. Returns { eventType, data }. */
function awaitPipelineCompletion(jobId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${axiomApiBaseUrl}/api/pipelines/${jobId}/observe?timeout=${timeoutMs}`);
    const transport = url.protocol === "https:" ? https : http;

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`SSE timed out after ${timeoutMs}ms for pipeline ${jobId}`));
    }, timeoutMs + 5000);

    const req = transport.get(url, { headers: { Accept: "text/event-stream" }, timeout: timeoutMs + 10000 }, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer); reject(new Error(`SSE HTTP ${res.statusCode} for pipeline ${jobId}`));
        res.resume(); return;
      }
      let buffer = ""; let currentEvent = {};
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const frames = buffer.split("\n\n"); buffer = frames.pop();
        for (const frame of frames) {
          if (!frame.trim()) continue;
          for (const line of frame.split("\n")) {
            if (line.startsWith("event: ")) currentEvent.eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) currentEvent.data = line.slice(6);
          }
          const terminalEvents = new Set(["pipeline.completed","pipeline.failed","pipeline.cancelled","pipeline.timeout","done"]);
          if (currentEvent.eventName && terminalEvents.has(currentEvent.eventName)) {
            clearTimeout(timer); req.destroy();
            let parsed = {}; try { parsed = JSON.parse(currentEvent.data); } catch { /* ok */ }
            resolve({ eventType: currentEvent.eventName, data: parsed }); return;
          }
          currentEvent = {};
        }
      });
      res.on("end", () => { clearTimeout(timer); reject(new Error(`SSE ended without terminal event for ${jobId}`)); });
      res.on("error", (err) => { clearTimeout(timer); reject(new Error(`SSE error for ${jobId}: ${err.message}`)); });
    });
    req.on("error", (err) => { clearTimeout(timer); reject(new Error(`SSE connect failed for ${jobId}: ${err.message}`)); });
    req.on("timeout", () => { clearTimeout(timer); req.destroy(); reject(new Error(`SSE connect timed out for ${jobId}`)); });
  });
}

/** Fetch results from Axiom REST endpoint (no SSE needed for already-completed jobs). */
async function fetchAxiomResults(pipelineJobId) {
  const resp = await withRetry(
    () => axios.get(`${axiomApiBaseUrl}/api/pipelines/${pipelineJobId}/results`, { timeout: 15000 }),
    { maxRetries: 2, initialDelayMs: 1000, label: `fetchResults ${pipelineJobId}` }
  );
  const raw   = resp.data;
  // execution.result = result.stages keyed by stage name (each is an array).
  // Our pipeline stores BPO fields in: stages.extract_bpo_fields[0].extractedData
  const stages = raw?.results;
  return stages?.extract_bpo_fields?.[0]?.extractedData ?? {};
}

async function processResults(orderId, pipelineJobId, order, blobName, extractedData, context) {
  const county            = extractedData?.county ?? null;
  const propertyCondition = extractedData?.propertyCondition ?? null;
  const asIsValue         = typeof extractedData?.asIsValue === "number" ? extractedData.asIsValue : null;
  const repairedValue     = typeof extractedData?.repairedValue === "number" ? extractedData.repairedValue : null;

  const docBlobContainer = docContainerName;

  let sftpResultPdfName = null;
  let sftpDeliveryStatus = "SKIPPED";
  if (blobName) {
    try {
      sftpResultPdfName  = await copyBpoToSftpResults(blobName, docBlobContainer, order.loanId, order.collateralNumber, context);
      sftpDeliveryStatus = "DELIVERED";
    } catch (err) {
      context.error(`[retryBpo] SFTP copy failed for order ${orderId}: ${err.message}`);
      sftpDeliveryStatus = "FAILED";
    }
  }

  const now = new Date().toISOString();
  const patches = [
    { op: "set", path: "/bpoExtractionStatus",  value: "COMPLETED" },
    { op: "set", path: "/status",               value: "COMPLETED" },
    { op: "set", path: "/dateCompleted",         value: now },
    { op: "set", path: "/updatedAt",             value: now },
    { op: "set", path: "/sftpDeliveryStatus",    value: sftpDeliveryStatus },
    { op: "set", path: "/bpoExtractedData",      value: { county, propertyCondition, asIsValue, repairedValue, extractedAt: now, pipelineJobId } },
    { op: "set", path: "/bpoRawExtractedData",   value: extractedData },
    { op: "set", path: "/retriedAt",             value: now },
  ];
  if (sftpResultPdfName) patches.push({ op: "set", path: "/sftpResultPdfName", value: sftpResultPdfName });
  await ordersContainer.item(orderId, statebridge_tenantId).patch(patches);
  context.log(`[retryBpo] Order ${orderId} completed. sftpDeliveryStatus=${sftpDeliveryStatus}`);
}

// ─── Per-order retry logic ─────────────────────────────────────────────────────

async function retryOrder(order, context) {
  const orderId       = order.id;
  const failureStatus = order.bpoExtractionStatus;
  const blobName      = order.bpoBlobName;

  context.log(`[retryBpo] Retrying order ${orderId} (status=${failureStatus})`);

  // Stamp lastRetryAt immediately to prevent parallel/duplicate retries.
  await ordersContainer.item(orderId, statebridge_tenantId).patch([
    { op: "set", path: "/lastRetryAt", value: new Date().toISOString() },
  ]);

  // ── For SSE-timeout cases: poll results before re-submitting ──────────────
  // The Axiom pipeline may have completed after our SSE disconnected.
  if ((failureStatus === "AXIOM_SSE_TIMEOUT" || failureStatus === "AXIOM_TIMEOUT") &&
      order.axiomBpoPipelineJobId) {
    context.log(`[retryBpo] Checking REST results for existing jobId=${order.axiomBpoPipelineJobId}`);
    try {
      const extractedData = await fetchAxiomResults(order.axiomBpoPipelineJobId);
      // If the fetch succeeded and returned something meaningful, use it directly.
      if (extractedData && Object.keys(extractedData).length > 0) {
        context.log(`[retryBpo] Found existing results for order ${orderId} — processing without re-submission`);
        await processResults(orderId, order.axiomBpoPipelineJobId, order, blobName, extractedData, context);
        return;
      }
    } catch (err) {
      context.log(`[retryBpo] REST results not available for ${order.axiomBpoPipelineJobId}: ${err.message} — will re-submit`);
    }
  }

  // ── Build SAS URL and re-submit to Axiom ──────────────────────────────────
  if (!blobName) {
    context.error(`[retryBpo] Order ${orderId} has no bpoBlobName — cannot re-submit`);
    return;
  }

  const docBlobContainer = docContainerName;

  let blobSasUrl;
  try {
    blobSasUrl = await buildSasUrl(docBlobContainer, blobName);
  } catch (err) {
    context.error(`[retryBpo] Failed to build SAS URL for order ${orderId}: ${err.message}`);
    return;
  }

  let pipelineJobId;
  try {
    const resp = await withRetry(
      () => axios.post(
        `${axiomApiBaseUrl}/api/pipelines`,
        {
          pipeline: BPO_EXTRACTION_PIPELINE,
          input: {
            // Infrastructure / routing fields
            tenantId:       statebridge_tenantId,
            clientId:       statebridgeClientId,
            correlationId:  orderId,
            correlationType: "BPO_EXTRACTION_RETRY",
            // Fields consumed by pipeline stage inputs (see bpo-pipeline-config.js)
            documentId:    orderId,
            fileSetId:     orderId,
            blobUrl:       blobSasUrl,
            fileName:      "bpo-report.pdf",
            documentType:  "BPO_REPORT",
          },
        },
        { headers: { "Content-Type": "application/json" }, timeout: 15000 }
      ),
      { maxRetries: 2, initialDelayMs: 1000, label: `Axiom re-submit order ${orderId}` }
    );
    pipelineJobId = resp.data?.jobId ?? resp.data?.pipelineJobId;
    if (!pipelineJobId) throw new Error(`Axiom did not return a jobId: ${JSON.stringify(resp.data)}`);
  } catch (err) {
    context.error(`[retryBpo] Re-submission failed for order ${orderId}: ${err.message}`);
    await ordersContainer.item(orderId, statebridge_tenantId).patch([
      { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_SUBMISSION_FAILED" },
      { op: "set", path: "/bpoSubmissionError",  value: err.message },
      { op: "set", path: "/updatedAt",           value: new Date().toISOString() },
    ]).catch(() => {});
    return;
  }

  await ordersContainer.item(orderId, statebridge_tenantId).patch([
    { op: "set", path: "/bpoExtractionStatus",    value: "AXIOM_PENDING" },
    { op: "set", path: "/axiomBpoPipelineJobId",  value: pipelineJobId },
    { op: "set", path: "/updatedAt",              value: new Date().toISOString() },
  ]).catch(() => {});

  context.log(`[retryBpo] Re-submitted order ${orderId} → jobId=${pipelineJobId}. Waiting for SSE…`);

  // ── Wait for SSE completion ───────────────────────────────────────────────
  let sseResult;
  try {
    sseResult = await awaitPipelineCompletion(pipelineJobId, SSE_TIMEOUT_MS);
  } catch (sseErr) {
    context.error(`[retryBpo] SSE timed out again for order ${orderId}: ${sseErr.message}`);
    await ordersContainer.item(orderId, statebridge_tenantId).patch([
      { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_SSE_TIMEOUT" },
      { op: "set", path: "/bpoSseError",          value: sseErr.message },
      { op: "set", path: "/updatedAt",            value: new Date().toISOString() },
    ]).catch(() => {});
    return;
  }

  if (sseResult.eventType !== "pipeline.completed" && sseResult.eventType !== "done") {
    const failedStatus =
      sseResult.eventType === "pipeline.failed"    ? "AXIOM_FAILED"   :
      sseResult.eventType === "pipeline.cancelled" ? "AXIOM_CANCELLED" :
      sseResult.eventType === "pipeline.timeout"   ? "AXIOM_TIMEOUT"  :
      "AXIOM_UNKNOWN_STATUS";
    context.error(`[retryBpo] Pipeline ${pipelineJobId} ended with ${sseResult.eventType} for order ${orderId}`);
    await ordersContainer.item(orderId, statebridge_tenantId).patch([
      { op: "set", path: "/bpoExtractionStatus", value: failedStatus },
      { op: "set", path: "/updatedAt",           value: new Date().toISOString() },
    ]).catch(() => {});
    return;
  }

  // ── Fetch results and process ─────────────────────────────────────────────
  try {
    const extractedData = await fetchAxiomResults(pipelineJobId);
    await processResults(orderId, pipelineJobId, order, blobName, extractedData, context);
  } catch (err) {
    context.error(`[retryBpo] Result processing failed for order ${orderId}: ${err.message}`);
    await ordersContainer.item(orderId, statebridge_tenantId).patch([
      { op: "set", path: "/bpoExtractionStatus", value: "AXIOM_PROCESSING_FAILED" },
      { op: "set", path: "/bpoProcessingError",  value: String(err.message ?? err) },
      { op: "set", path: "/updatedAt",           value: new Date().toISOString() },
    ]).catch(() => {});
  }
}

// ─── Timer trigger ─────────────────────────────────────────────────────────────

app.timer("retryStalledBpoOrders", {
  // Every 2 hours (at :05 past the even hour to avoid clash with 23:55 daily job)
  schedule: "0 5 */2 * * *",
  runOnStartup: false,
  handler: async (timerInfo, context) => {
    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - RETRY_COOLDOWN_MS).toISOString();

    // Query up to MAX_ORDERS_PER_RUN orders in a retryable state that have not
    // been retried recently (lastRetryAt absent OR older than cooldown window).
    const statusList = RETRYABLE_STATUSES.map((s) => `'${s}'`).join(", ");
    const { resources: stuckOrders } = await ordersContainer.items.query(
      {
        query: `
          SELECT c.id, c.bpoExtractionStatus, c.axiomBpoPipelineJobId,
                 c.bpoBlobName, c.bpoDocumentId, c.loanId, c.collateralNumber,
                 c.lastRetryAt
          FROM c
          WHERE c.tenantId = @tenantId
            AND c.source   = 'statebridge-sftp'
            AND c.bpoExtractionStatus IN (${statusList})
            AND (NOT IS_DEFINED(c.lastRetryAt) OR c.lastRetryAt < @cooldownCutoff)
          ORDER BY c.updatedAt ASC
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: "@tenantId",       value: statebridge_tenantId },
          { name: "@cooldownCutoff", value: cooldownCutoff },
          { name: "@limit",          value: MAX_ORDERS_PER_RUN },
        ],
      },
      { partitionKey: statebridge_tenantId }
    ).fetchAll();

    if (stuckOrders.length === 0) {
      context.log("[retryStalledBpoOrders] No stuck orders found.");
      return;
    }

    context.log(`[retryStalledBpoOrders] Found ${stuckOrders.length} stuck order(s) to retry.`);

    // Process sequentially — each order may block for up to SSE_TIMEOUT_MS.
    for (const order of stuckOrders) {
      try {
        await retryOrder(order, context);
      } catch (err) {
        context.error(`[retryStalledBpoOrders] Unexpected error retrying order ${order.id}: ${err.message}`);
      }
    }

    context.log("[retryStalledBpoOrders] Done.");
  },
});
