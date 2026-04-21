#!/usr/bin/env tsx
/**
 * ATTOM CSV Ingestion Script — attom-data container (geohash-partitioned)
 *
 * Streams ATTOM CSV files from Azure Blob Storage (using Managed Identity)
 * and upserts each row as a fully typed AttomDataDocument into the attom-data
 * CosmosDB container, partitioned by geohash precision-5.
 *
 * Writes typed documents directly via CosmosDbService — does NOT go through
 * PropertyDataCacheService, so it can target any provisioned CosmosDB container.
 *
 * Document shape written to Cosmos:
 *   AttomDataDocument { id: <ATTOMID>, geohash5: <geohash5>, attomId, address, location, ... }
 *
 * IMPORTANT: The target CosmosDB container must already be provisioned via Bicep
 * with partition key /geohash5. This script will NOT create it.
 *
 * Rows are skipped (with a warning) if:
 *   - No ATTOMID is present
 *   - Latitude or longitude is missing or zero (cannot compute geohash)
 *
 * This is idempotent — re-running it updates any existing records with fresh data.
 *
 * Usage (run from repo root):
 *   npx tsx --env-file .env src/scripts/ingest-attom-csv-attom-data-container.ts
 *
 * Required env vars:
 *   COSMOS_ENDPOINT              CosmosDB account endpoint
 *   ATTOM_CSV_STORAGE_ACCOUNT    Storage account name (e.g. apprdev7iqxpvst)
 *   ATTOM_CSV_CONTAINER          Blob container name (default: attom-data)
 *
 * Optional env vars:
 *   ATTOM_COSMOS_CONTAINER       Target CosmosDB container name (default: attom-data)
 *   ATTOM_CSV_BLOBS              Comma-separated blob names to ingest
 *                                (default: Duval_FL_2025_2026.csv,LA_2025_2026.csv)
 *   ATTOM_CSV_BATCH_SIZE         Records per Cosmos batch (default: 100)
 *   ATTOM_CSV_BATCH_DELAY_MS     Delay in ms between batches to avoid 429s (default: 0)
 *   ATTOM_CSV_DRY_RUN            Set to "true" to parse without writing to Cosmos
 */

import * as readline from 'node:readline';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { encodeGeohash } from '../utils/geohash.util.js';
import { toFloat, toInt, boolY } from '../utils/csv-parse.util.js';
import type { AttomDataDocument } from '../types/attom-data.types.js';
import type { GeoJsonPoint } from '../services/property-data-cache.service.js';

// ─── Config ───────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `ingest-attom-csv-attom-data-container: Required env var "${name}" is not set. ` +
      `See the script header for the full list of required vars.`,
    );
  }
  return val;
}

function loadConfig() {
  const storageAccount = requireEnv('ATTOM_CSV_STORAGE_ACCOUNT');
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    throw new Error('ingest-attom-csv-attom-data-container: COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is not set.');
  }

  const blobContainer = process.env.ATTOM_CSV_CONTAINER ?? 'attom-data';
  const cosmosContainer = process.env.ATTOM_COSMOS_CONTAINER ?? 'attom-data';
  const blobsRaw = process.env.ATTOM_CSV_BLOBS ?? 'Duval_FL_2025_2026.csv,LA_2025_2026.csv';
  const blobs = blobsRaw.split(',').map((b) => b.trim()).filter(Boolean);
  const batchSize = parseInt(process.env.ATTOM_CSV_BATCH_SIZE ?? '100', 10);
  const batchDelayMs = parseInt(process.env.ATTOM_CSV_BATCH_DELAY_MS ?? '0', 10);
  const dryRun = process.env.ATTOM_CSV_DRY_RUN === 'true';

  if (isNaN(batchSize) || batchSize < 1) {
    throw new Error(
      `ingest-attom-csv-attom-data-container: ATTOM_CSV_BATCH_SIZE must be a positive integer, got "${process.env.ATTOM_CSV_BATCH_SIZE}"`,
    );
  }
  if (isNaN(batchDelayMs) || batchDelayMs < 0) {
    throw new Error(
      `ingest-attom-csv-attom-data-container: ATTOM_CSV_BATCH_DELAY_MS must be a non-negative integer, got "${process.env.ATTOM_CSV_BATCH_DELAY_MS}"`,
    );
  }

  return { storageAccount, cosmosEndpoint, blobContainer, cosmosContainer, blobs, batchSize, batchDelayMs, dryRun };
}

// ─── RFC 4180 CSV tokenizer ───────────────────────────────────────────────────

/**
 * Parse a single CSV line following RFC 4180 rules:
 *   - Fields may be quoted with double-quotes
 *   - Embedded double-quotes are escaped as ""
 *   - Embedded commas and newlines are valid inside quoted fields
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

// ─── CSV row → typed AttomDataDocument ───────────────────────────────────────

const GEOHASH_PRECISION = 5;

function mapRowToAttomDataDoc(
  headers: string[],
  values: string[],
  ingestedAt: string,
): AttomDataDocument | null {
  const row: Record<string, string> = {};
  headers.forEach((header, i) => {
    row[header] = values[i] ?? '';
  });

  const attomId = row['ATTOMID']?.trim();
  if (!attomId) return null;

  const lat = toFloat(row['LATITUDE']);
  const lon = toFloat(row['LONGITUDE']);
  if (lat == null || lon == null || lat === 0 || lon === 0) return null;

  const geohash5 = encodeGeohash(lat, lon, GEOHASH_PRECISION);
  const location: GeoJsonPoint = { type: 'Point', coordinates: [lon, lat] };

  return {
    id: attomId,
    type: 'attom-data',
    geohash5,
    attomId,
    apnFormatted: row['APNFORMATTED']?.trim().toUpperCase() ?? '',
    ingestedAt,
    sourcedAt: row['DBUPDATEDATE']?.trim() || row['DBCREATEDATE']?.trim() || ingestedAt,

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

    rawData: row,
  };
}

// ─── Blob streaming + ingestion logic ─────────────────────────────────────────

async function upsertBatch(
  cosmosService: CosmosDbService,
  cosmosContainer: string,
  batch: AttomDataDocument[],
): Promise<{ succeeded: number; failed: number }> {
  const results = await Promise.allSettled(
    batch.map((doc) => cosmosService.upsertItem(cosmosContainer, doc)),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ingestBlob(
  blobServiceClient: BlobServiceClient,
  blobContainer: string,
  blobName: string,
  cosmosService: CosmosDbService,
  cosmosContainer: string,
  batchSize: number,
  batchDelayMs: number,
  dryRun: boolean,
): Promise<void> {
  console.log(`\n[${blobName}] Starting ingestion into Cosmos container "${cosmosContainer}"...`);

  const containerClient = blobServiceClient.getContainerClient(blobContainer);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download(0);
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`ingest-attom-csv-attom-data-container: Failed to open download stream for ${blobName}`);
  }

  const rl = readline.createInterface({
    input: downloadResponse.readableStreamBody as NodeJS.ReadableStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let lineNumber = 0;
  let batch: AttomDataDocument[] = [];
  let totalProcessed = 0;
  let totalSkippedNoId = 0;
  let totalSkippedNoGeo = 0;
  let totalFailed = 0;
  const ingestedAt = new Date().toISOString();

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    if (lineNumber === 1) {
      headers = parseCsvLine(line);
      console.log(`[${blobName}] Headers parsed: ${headers.length} columns`);
      continue;
    }

    const values = parseCsvLine(line);
    const attomId = values[headers.indexOf('ATTOMID')]?.trim();

    if (!attomId) {
      totalSkippedNoId++;
      if (totalSkippedNoId <= 5) {
        console.warn(`[${blobName}] Line ${lineNumber}: skipped (no ATTOMID) — values[0]="${values[0]}"`);
      }
      continue;
    }

    const doc = mapRowToAttomDataDoc(headers, values, ingestedAt);
    if (!doc) {
      totalSkippedNoGeo++;
      if (totalSkippedNoGeo <= 5) {
        console.warn(`[${blobName}] Line ${lineNumber}: skipped (no valid lat/lon for geohash) — attomId="${attomId}"`);
      }
      continue;
    }

    batch.push(doc);

    if (batch.length >= batchSize) {
      if (!dryRun) {
        const result = await upsertBatch(cosmosService, cosmosContainer, batch);
        totalFailed += result.failed;
        if (batchDelayMs > 0) await sleep(batchDelayMs);
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
      const result = await upsertBatch(cosmosService, cosmosContainer, batch);
      totalFailed += result.failed;
    }
    totalProcessed += batch.length;
  }

  console.log(
    `[${blobName}] Done. ` +
    `processed=${totalProcessed.toLocaleString()}, ` +
    `skippedNoId=${totalSkippedNoId}, ` +
    `skippedNoGeo=${totalSkippedNoGeo}, ` +
    `failed=${totalFailed}` +
    (dryRun ? ' (DRY RUN — nothing written)' : ''),
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('ATTOM CSV Ingestion Script — attom-data container (geohash-partitioned)');
  console.log('======================================================================');
  console.log(`Storage account  : ${config.storageAccount}`);
  console.log(`Blob container   : ${config.blobContainer}`);
  console.log(`Blobs            : ${config.blobs.join(', ')}`);
  console.log(`Cosmos endpoint  : ${config.cosmosEndpoint}`);
  console.log(`Cosmos container : ${config.cosmosContainer}`);
  console.log(`Batch size       : ${config.batchSize}`);
  console.log(`Batch delay (ms) : ${config.batchDelayMs}`);
  console.log(`Geohash precision: ${GEOHASH_PRECISION}`);
  console.log(`Dry run          : ${config.dryRun}`);
  console.log('');

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${config.storageAccount}.blob.core.windows.net`,
    credential,
  );

  const cosmosService = new CosmosDbService(config.cosmosEndpoint);

  const startTime = Date.now();

  for (const blobName of config.blobs) {
    await ingestBlob(
      blobServiceClient,
      config.blobContainer,
      blobName,
      cosmosService,
      config.cosmosContainer,
      config.batchSize,
      config.batchDelayMs,
      config.dryRun,
    );
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nAll blobs ingested in ${elapsed}s.`);
}

main().catch((err) => {
  console.error(
    'ingest-attom-csv-attom-data-container: Fatal error:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});

// npx tsx --env-file .env src/scripts/ingest-attom-csv-attom-data-container.ts
// ATTOM_CSV_BATCH_SIZE=25 ATTOM_CSV_BATCH_DELAY_MS=500 npx tsx --env-file .env src/scripts/ingest-attom-csv-attom-data-container.ts
// in Powershell:
// $env:ATTOM_CSV_BATCH_SIZE=25; $env:ATTOM_CSV_BATCH_DELAY_MS=500; npx tsx --env-file .env src/scripts/ingest-attom-csv-attom-data-container.ts
// $env:ATTOM_CSV_BATCH_SIZE=100; $env:ATTOM_CSV_BATCH_DELAY_MS=100; npx tsx --env-file .env src/scripts/ingest-attom-csv-attom-data-container.ts
