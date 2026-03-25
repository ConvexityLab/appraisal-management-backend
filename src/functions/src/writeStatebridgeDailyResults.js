/**
 * writeStatebridgeDailyResults.js
 *
 * Timer-triggered Azure Function that runs nightly at 23:55 UTC.
 * Queries all Statebridge orders that were completed today, builds a
 * TAB-delimited results file, and uploads it to the SFTP `results/`
 * container as:
 *
 *   statebridge_results_YYYYMMDD.txt
 *
 * Column order (14 columns, tab-separated, per Statebridge spec):
 *   OrderID, LoanID, CollateralNumber,
 *   AddressLine1, AddressLine2, City, State, Zip,
 *   County (ALL CAPS), DateOrdered, DateCompleted,
 *   PropertyCondition, AsIsValue, RepairedValue
 *
 * Required env vars (already present on the functions container):
 *   COSMOSDB_ENDPOINT, DATABASE_NAME
 *   SFTP_STORAGE_ACCOUNT_NAME
 *   STATEBRIDGE_TENANT_ID
 *
 * Safe to run multiple times — the upload is an upsert (overwrite) of the
 * same blob name, so re-running for the same date replaces the previous file
 * with any additional completions from that day.
 */

"use strict";

const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");

// ─── Config ───────────────────────────────────────────────────────────────────

const cosmosEndpoint         = process.env.COSMOSDB_ENDPOINT;
const databaseName           = process.env.DATABASE_NAME;
const sftpStorageAccountName = process.env.SFTP_STORAGE_ACCOUNT_NAME;
const statebridge_tenantId   = process.env.STATEBRIDGE_TENANT_ID;

if (!cosmosEndpoint)         throw new Error("COSMOSDB_ENDPOINT is required but not set");
if (!databaseName)           throw new Error("DATABASE_NAME is required but not set");
if (!sftpStorageAccountName) throw new Error("SFTP_STORAGE_ACCOUNT_NAME is required but not set");
if (!statebridge_tenantId)   throw new Error("STATEBRIDGE_TENANT_ID is required but not set");

// ─── Clients ──────────────────────────────────────────────────────────────────

const credential = new DefaultAzureCredential();

const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
const db = cosmosClient.database(databaseName);
const ordersContainer = db.container("orders");

const sftpBlobClient = new BlobServiceClient(
  `https://${sftpStorageAccountName}.blob.core.windows.net`,
  credential
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a date as M/DD/YYYY (e.g. 3/11/2024) matching Statebridge convention. */
function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString; // pass through if unparseable
  const month = d.getUTCMonth() + 1;
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const year  = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Normalise a UAD condition code or free-text condition from the BPO to the
 * descriptive term Statebridge expects in the results file.
 */
function normaliseCondition(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toUpperCase();
  switch (s) {
    case "C1": return "Excellent";
    case "C2": return "Good";
    case "C3": return "Average";
    case "C4": return "Fair";
    case "C5":
    case "C6": return "Poor";
    default:
      // Already a descriptive word — capitalise first letter and pass through.
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
}

/**
 * Format a numeric dollar amount.  Statebridge receives plain integers without
 * currency symbols or commas (e.g. 360000).
 */
function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (isNaN(n)) return "";
  return String(Math.round(n));
}

/** Escape a tab-delimited field, replacing any literal tab with a space. */
function escapeField(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\t/g, " ").trim();
}

// ─── Timer trigger ─────────────────────────────────────────────────────────────

app.timer("writeStatebridgeDailyResults", {
  // 23:55 UTC every day
  schedule: "0 55 23 * * *",
  runOnStartup: false,
  handler: async (timerInfo, context) => {
    const now = timerInfo.scheduleStatus?.next
      ? new Date(timerInfo.scheduleStatus.next)
      : new Date();

    // Build UTC day window for "today"
    const todayStart    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const yyyymmdd      = todayStart.toISOString().slice(0, 10).replace(/-/g, "");

    context.log(
      `[writeStatebridgeDailyResults] Building results file for ${yyyymmdd} ` +
      `(window: ${todayStart.toISOString()} – ${tomorrowStart.toISOString()})`
    );

    // ── Query completed Statebridge orders from today ─────────────────────────
    // All Statebridge documents share tenantId = statebridge_tenantId, enabling
    // an efficient single-partition scan.
    const { resources: orders } = await ordersContainer.items.query(
      {
        query: `
          SELECT
            c.id,
            c.externalOrderId,
            c.loanId,
            c.collateralNumber,
            c.propertyAddress,
            c.dateOrdered,
            c.dateCompleted,
            c.bpoExtractedData
          FROM c
          WHERE c.tenantId       = @tenantId
            AND c.source         = 'statebridge-sftp'
            AND c.status         = 'COMPLETED'
            AND c.dateCompleted >= @todayStart
            AND c.dateCompleted  < @tomorrowStart
        `,
        parameters: [
          { name: "@tenantId",      value: statebridge_tenantId },
          { name: "@todayStart",    value: todayStart.toISOString() },
          { name: "@tomorrowStart", value: tomorrowStart.toISOString() },
        ],
      },
      { partitionKey: statebridge_tenantId }
    ).fetchAll();

    context.log(`[writeStatebridgeDailyResults] Found ${orders.length} completed orders for ${yyyymmdd}`);

    if (orders.length === 0) {
      context.log("[writeStatebridgeDailyResults] Nothing to write — exiting.");
      return;
    }

    // ── Build tab-delimited output (14 columns per Statebridge spec) ────────────
    const HEADER = [
      "OrderID", "LoanID", "CollateralNumber",
      "AddressLine1", "AddressLine2", "City", "State", "Zip",
      "County", "DateOrdered", "DateCompleted",
      "PropertyCondition", "AsIsValue", "RepairedValue",
    ].join("\t");
    const lines = [HEADER];

    for (const order of orders) {
      const bpo = order.bpoExtractedData ?? {};
      const addr = (typeof order.propertyAddress === "object" && order.propertyAddress !== null)
        ? order.propertyAddress
        : {};

      const row = [
        escapeField(order.externalOrderId ?? order.id),
        escapeField(order.loanId),
        escapeField(order.collateralNumber),
        escapeField(addr.street ?? ""),
        escapeField(addr.street2 ?? ""),
        escapeField(addr.city ?? ""),
        escapeField(addr.state ?? ""),
        escapeField(addr.zipCode ?? ""),
        escapeField((bpo.county ?? "").toUpperCase()), // spec requires ALL CAPS county
        formatDate(order.dateOrdered),
        formatDate(order.dateCompleted),
        escapeField(normaliseCondition(bpo.propertyCondition)),
        formatCurrency(bpo.asIsValue),
        formatCurrency(bpo.repairedValue),
      ].join("\t");

      lines.push(row);
    }

    const fileContent = lines.join("\r\n") + "\r\n"; // CRLF line endings for Windows-compatible delivery
    const fileBytes   = Buffer.from(fileContent, "utf-8");

    // ── Upload to SFTP results/ container ────────────────────────────────────
    const blobName    = `statebridge_results_${yyyymmdd}.txt`;
    const containerClient = sftpBlobClient.getContainerClient("statebridge");
    const blockBlobClient = containerClient.getBlockBlobClient(`results/${blobName}`);

    await blockBlobClient.upload(fileBytes, fileBytes.byteLength, {
      blobHTTPHeaders: { blobContentType: "text/plain; charset=utf-8" },
      // Overwrite — safe because re-running for the same date is intentional.
    });

    context.log(
      `[writeStatebridgeDailyResults] Uploaded ${blobName} ` +
      `(${fileBytes.byteLength} bytes, ${orders.length} orders)`
    );
  },
});
