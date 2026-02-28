/**
 * Seed Bulk Portfolio Job History — Orchestrator
 *
 * Reads fixture data from ./seed-data/bulk-portfolio-fixtures.js and upserts
 * every job (with its constituent loan line items) into Cosmos DB.
 *
 * Usage:
 *   node scripts/seed-bulk-portfolio-jobs.js
 *   (or: pnpm seed:bulk-portfolios)
 *
 * Fixture data lives in:
 *   scripts/seed-data/bulk-portfolio-fixtures.js
 *
 * Requires:
 *   - Az CLI logged in with an identity that has Cosmos DB data contributor role
 *   - COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT env var
 */

'use strict';

require('dotenv').config();

const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { SEED_JOBS } = require('./seed-data/bulk-portfolio-fixtures');

// ── Config ───────────────────────────────────────────────────────────────────

const COSMOS_ENDPOINT =
  process.env.COSMOS_ENDPOINT ||
  process.env.AZURE_COSMOS_ENDPOINT;

if (!COSMOS_ENDPOINT) {
  throw new Error(
    'COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT must be set. ' +
    'Example: COSMOS_ENDPOINT=https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/'
  );
}

const DATABASE_NAME  = 'appraisal-management';
const CONTAINER_NAME = 'bulk-portfolio-jobs';

// ── Insert logic ─────────────────────────────────────────────────────────────

async function main() {
  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });

  const container = client
    .database(DATABASE_NAME)
    .container(CONTAINER_NAME);

  console.log(`\n🌱  Seeding ${SEED_JOBS.length} bulk portfolio jobs into`);
  console.log(`    ${COSMOS_ENDPOINT}`);
  console.log(`    Database : ${DATABASE_NAME}`);
  console.log(`    Container: ${CONTAINER_NAME}\n`);

  let created = 0;
  let failed = 0;

  for (const job of SEED_JOBS) {
    try {
      // Upsert so re-running the script is idempotent
      const { resource } = await container.items.upsert(job);
      const itemCount = Array.isArray(resource.items) ? resource.items.length : 0;
      console.log(`  ✅  ${resource.id}  [${resource.status} / ${resource.processingMode}]  — ${itemCount} line item(s)`);
      created++;
    } catch (err) {
      console.error(`  ❌  ${job.id}  — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Done — ${created} upserted, ${failed} failed.\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
