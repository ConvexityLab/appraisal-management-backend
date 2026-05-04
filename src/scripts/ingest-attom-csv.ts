#!/usr/bin/env tsx
/**
 * ATTOM CSV Ingestion Script
 *
 * Streams the ATTOM CSV files from Azure Blob Storage (using Managed Identity)
 * and upserts each row into the property-data-cache Cosmos container.
 *
 * This is idempotent — re-running it updates any existing records with fresh data.
 * Rows with no ATTOMID are skipped with a warning.
 *
 * Usage (run from repo root):
 *   npx tsx src/scripts/ingest-attom-csv.ts
 *
 * Required env vars:
 *   COSMOS_ENDPOINT          CosmosDB account endpoint
 *   ATTOM_CSV_STORAGE_ACCOUNT  Storage account name (e.g. apprdev7iqxpvst)
 *   ATTOM_CSV_CONTAINER        Blob container name (default: attom-data)
 *
 * Optional env vars:
 *   ATTOM_CSV_BLOBS            Comma-separated blob names to ingest
 *                             (default: Duval_FL_2025_2026.csv,LA_2025_2026.csv)
 *   ATTOM_CSV_BATCH_SIZE       Records per Cosmos batch (default: 100)
 *   ATTOM_CSV_DRY_RUN          Set to "true" to parse without writing to Cosmos
 */

import 'dotenv/config';
import * as readline from 'node:readline';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { PropertyDataCacheService, PropertyDataCacheEntry, GeoJsonPoint } from '../services/property-data-cache.service.js';

// ─── Config ───────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `ingest-attom-csv: Required env var "${name}" is not set. ` +
      `See the script header for the full list of required vars.`,
    );
  }
  return val;
}

function loadConfig() {
  const storageAccount = requireEnv('ATTOM_CSV_STORAGE_ACCOUNT');
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    throw new Error('ingest-attom-csv: COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is not set.');
  }

  const container = process.env.ATTOM_CSV_CONTAINER ?? 'attom-data';
  const blobsRaw = process.env.ATTOM_CSV_BLOBS ?? 'Duval_FL_2025_2026.csv,LA_2025_2026.csv';
  const blobs = blobsRaw.split(',').map((b) => b.trim()).filter(Boolean);
  const batchSize = parseInt(process.env.ATTOM_CSV_BATCH_SIZE ?? '100', 10);
  const dryRun = process.env.ATTOM_CSV_DRY_RUN === 'true';

  if (isNaN(batchSize) || batchSize < 1) {
    throw new Error(`ingest-attom-csv: ATTOM_CSV_BATCH_SIZE must be a positive integer, got "${process.env.ATTOM_CSV_BATCH_SIZE}"`);
  }

  return { storageAccount, cosmosEndpoint, container, blobs, batchSize, dryRun };
}

// ─── Retry helper ────────────────────────────────────────────────────────────

/** Error codes treated as transient and eligible for retry. */
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND']);

function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code && TRANSIENT_CODES.has(code)) return true;
    // Cosmos SDK wraps the error in a message string
    if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT') ||
        err.message.includes('The operation was aborted')) return true;
  }
  return false;
}

/**
 * Retry `fn` up to `maxAttempts` times on transient errors.
 * Waits `baseDelayMs * 2^attempt` ms between retries.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4,
  baseDelayMs = 2000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !isTransient(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `[retry] ${label} — attempt ${attempt}/${maxAttempts} failed (${(err as Error).message}). ` +
        `Retrying in ${delay / 1000}s...`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  // Unreachable but TypeScript needs a return path
  throw new Error(`[retry] ${label} — exhausted all ${maxAttempts} attempts`);
}

// ─── RFC 4180 CSV tokenizer ───────────────────────────────────────────────────

/**
 * Parse a single CSV line following RFC 4180 rules:
 *   - Fields may be quoted with double-quotes
 *   - Embedded double-quotes are escaped as ""
 *   - Embedded commas and newlines are valid inside quoted fields
 *
 * This is a state-machine implementation — a naive .split(',') breaks on
 * quoted fields containing commas (common in LEGALDESCRIPTION, PUBLICLISTINGREMARKS).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside a quoted field
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  fields.push(current);
  return fields;
}

// ─── Row → PropertyDataCacheEntry mapper ─────────────────────────────────────

function toFloat(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toInt(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function boolY(val: string | undefined): boolean {
  return val?.trim().toUpperCase() === 'Y';
}

function mapRowToEntry(
  headers: string[],
  values: string[],
): PropertyDataCacheEntry | null {
  // Build a column-name → value map for readable access
  const row: Record<string, string> = {};
  headers.forEach((header, i) => {
    row[header] = values[i] ?? '';
  });

  const attomId = row['ATTOMID']?.trim();
  if (!attomId) return null; // Skip rows without a primary key

  const lat = toFloat(row['LATITUDE']);
  const lon = toFloat(row['LONGITUDE']);
  const location: GeoJsonPoint | null =
    lat != null && lon != null && lat !== 0 && lon !== 0
      ? { type: 'Point', coordinates: [lon, lat] } // GeoJSON: [longitude, latitude]
      : null;

  const entry: PropertyDataCacheEntry = {
    id: attomId,
    type: 'property-data-cache',
    attomId,
    apnFormatted: row['APNFORMATTED']?.trim().toUpperCase() ?? '',
    source: 'attom-csv-import',
    cachedAt: new Date().toISOString(),
    sourcedAt: row['DBUPDATEDATE']?.trim() || row['DBCREATEDATE']?.trim() || new Date().toISOString(),

    address: {
      full: row['PROPERTYADDRESSFULL']?.trim() ?? '',
      houseNumber: row['PROPERTYADDRESSHOUSENUMBER']?.trim() ?? '',
      streetDirection: row['PROPERTYADDRESSSTREETDIRECTION']?.trim() ?? '',
      streetName: row['PROPERTYADDRESSSTREETNAME']?.trim().toUpperCase() ?? '',
      streetSuffix: row['PROPERTYADDRESSSTREETSUFFIX']?.trim() ?? '',
      streetPostDirection: row['PROPERTYADDRESSSTREETPOSTDIRECTION']?.trim() ?? '',
      unitPrefix: row['PROPERTYADDRESSUNITPREFIX']?.trim() ?? '',
      unitValue: row['PROPERTYADDRESSUNITVALUE']?.trim() ?? '',
      city: row['PROPERTYADDRESSCITY']?.trim() ?? '',
      state: row['PROPERTYADDRESSSTATE']?.trim().toUpperCase() ?? '',
      zip: row['PROPERTYADDRESSZIP']?.trim() ?? '',
      zip4: row['PROPERTYADDRESSZIP4']?.trim() ?? '',
      county: row['SITUSCOUNTY']?.trim() ?? '',
    },

    location,

    propertyDetail: {
      attomPropertyType: row['ATTOMPROPERTYTYPE']?.trim() ?? '',
      attomPropertySubtype: row['ATTOMPROPERTYSUBTYPE']?.trim() ?? '',
      mlsPropertyType: row['MLSPROPERTYTYPE']?.trim() ?? '',
      mlsPropertySubtype: row['MLSPROPERTYSUBTYPE']?.trim() ?? '',
      yearBuilt: toInt(row['YEARBUILT']),
      livingAreaSqft: toFloat(row['LIVINGAREASQUAREFEET']),
      lotSizeAcres: toFloat(row['LOTSIZEACRES']),
      lotSizeSqft: toFloat(row['LOTSIZESQUAREFEET']),
      bedroomsTotal: toInt(row['BEDROOMSTOTAL']),
      bathroomsFull: toInt(row['BATHROOMSFULL']),
      bathroomsHalf: toInt(row['BATHROOMSHALF']),
      stories: row['STORIES']?.trim() ?? '',
      garageSpaces: toInt(row['GARAGESPACES']),
      poolPrivate: boolY(row['POOLPRIVATEYN']),
    },

    assessment: {
      taxYear: row['TAXYEARASSESSED']?.trim() ?? '',
      assessedValueTotal: toFloat(row['TAXASSESSEDVALUETOTAL']),
      marketValue: toFloat(row['MARKETVALUE']),
      marketValueDate: row['MARKETVALUEDATE']?.trim() ?? '',
      taxAmount: toFloat(row['TAXAMOUNT']),
    },

    salesHistory: {
      lastSaleDate: row['ASSESSORLASTSALEDATE']?.trim() ?? '',
      lastSaleAmount: toFloat(row['ASSESSORLASTSALEAMOUNT']),
    },

    mlsData: {
      mlsListingId: row['MLSLISTINGID']?.trim() ?? '',
      mlsRecordId: row['MLSRECORDID']?.trim() ?? '',
      mlsNumber: row['MLSNUMBER']?.trim() ?? '',
      mlsSource: row['MLSSOURCE']?.trim() ?? '',
      listingStatus: row['LISTINGSTATUS']?.trim() ?? '',
      currentStatus: row['CURRENTSTATUS']?.trim() ?? '',
      listingDate: row['LISTINGDATE']?.trim() ?? '',
      latestListingPrice: toFloat(row['LATESTLISTINGPRICE']),
      previousListingPrice: toFloat(row['PREVIOUSLISTINGPRICE']),
      soldDate: row['MLSSOLDDATE']?.trim() ?? '',
      soldPrice: toFloat(row['MLSSOLDPRICE']),
      daysOnMarket: toInt(row['DAYSONMARKET']),
      pendingDate: row['PENDINGDATE']?.trim() ?? '',
      originalListingDate: row['ORIGINALLISTINGDATE']?.trim() ?? '',
      originalListingPrice: toFloat(row['ORIGINALLISTINGPRICE']),
    },

    // Full raw CSV row — all columns preserved at full fidelity
    rawData: row,
  };

  return entry;
}

// ─── Blob streaming + ingestion logic ─────────────────────────────────────────

async function ingestBlob(
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  cacheService: PropertyDataCacheService,
  batchSize: number,
  dryRun: boolean,
): Promise<void> {
  console.log(`\n[${blobName}] Starting ingestion...`);

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download(0);
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`ingest-attom-csv: Failed to open download stream for ${blobName}`);
  }

  const rl = readline.createInterface({
    input: downloadResponse.readableStreamBody as NodeJS.ReadableStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let lineNumber = 0;
  let batch: PropertyDataCacheEntry[] = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    if (lineNumber === 1) {
      // Header row
      headers = parseCsvLine(line);
      console.log(`[${blobName}] Headers parsed: ${headers.length} columns`);
      continue;
    }

    const values = parseCsvLine(line);
    const entry = mapRowToEntry(headers, values);

    if (!entry) {
      totalSkipped++;
      if (totalSkipped <= 5) {
        console.warn(`[${blobName}] Line ${lineNumber}: skipped (no ATTOMID) — values[0]="${values[0]}"`);
      }
      continue;
    }

    batch.push(entry);

    if (batch.length >= batchSize) {
      if (!dryRun) {
        const result = await withRetry(
          () => cacheService.upsertBatch(batch),
          `${blobName} batch at row ${lineNumber}`,
        );
        totalFailed += result.failed;
      }
      totalProcessed += batch.length;
      batch = [];

      if (totalProcessed % 10000 === 0) {
        console.log(`[${blobName}] Progress: ${totalProcessed.toLocaleString()} records processed${dryRun ? ' (DRY RUN)' : ''}`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    if (!dryRun) {
      const result = await withRetry(
        () => cacheService.upsertBatch(batch),
        `${blobName} final batch`,
      );
      totalFailed += result.failed;
    }
    totalProcessed += batch.length;
  }

  console.log(
    `[${blobName}] Done. ` +
    `processed=${totalProcessed.toLocaleString()}, ` +
    `skipped=${totalSkipped}, ` +
    `failed=${totalFailed}` +
    (dryRun ? ' (DRY RUN — nothing written)' : ''),
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('ATTOM CSV Ingestion Script');
  console.log('==========================================');
  console.log(`Storage account : ${config.storageAccount}`);
  console.log(`Container       : ${config.container}`);
  console.log(`Blobs           : ${config.blobs.join(', ')}`);
  console.log(`Cosmos endpoint : ${config.cosmosEndpoint}`);
  console.log(`Batch size      : ${config.batchSize}`);
  console.log(`Dry run         : ${config.dryRun}`);
  console.log('');

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${config.storageAccount}.blob.core.windows.net`,
    credential,
  );

  const cosmosService = new CosmosDbService(config.cosmosEndpoint);
  const cacheService = new PropertyDataCacheService(cosmosService);

  const startTime = Date.now();

  for (const blobName of config.blobs) {
    await withRetry(
      () => ingestBlob(
        blobServiceClient,
        config.container,
        blobName,
        cacheService,
        config.batchSize,
        config.dryRun,
      ),
      `ingestBlob(${blobName})`,
      3,   // max 3 attempts per blob
      5000, // start at 5s between blob-level retries
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll blobs ingested in ${elapsed}s.`);
}

main().catch((err) => {
  console.error('ingest-attom-csv: Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
