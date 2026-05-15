/**
 * One-off script: clear lastVerifiedAt on PropertyRecords whose building.gla
 * is 0 (or missing) so the next enrichment run forces a provider call instead
 * of returning 'cached'. This is needed for records that were enriched with
 * a pre-fix build that failed to extract building data from the provider.
 *
 * Run once after deploying the enrichment fixes:
 *   node scripts/clear-enrichment-cache-for-zero-gla.mjs [--dry-run]
 *
 * --dry-run  prints affected records without modifying them.
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const DRY_RUN = process.argv.includes('--dry-run');

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = 'appraisal-management';
const container = client.database(db).container('property-records');

// Find all property records where building.gla == 0 AND lastVerifiedAt is set
// (meaning they were enriched but got bad data).
const { resources } = await container.items.query({
  query: `SELECT c.id, c.tenantId, c.address, c.building, c.lastVerifiedAt, c.recordVersion
          FROM c
          WHERE c.building.gla = 0
            AND IS_DEFINED(c.lastVerifiedAt)
            AND c.lastVerifiedAt != null`,
  parameters: [],
}).fetchAll();

console.log(`Found ${resources.length} property record(s) with gla=0 and lastVerifiedAt set.`);
if (resources.length === 0) process.exit(0);

for (const rec of resources) {
  console.log(`\n  id: ${rec.id}`);
  console.log(`  address: ${rec.address?.street}, ${rec.address?.city} ${rec.address?.state} ${rec.address?.zip}`);
  console.log(`  gla: ${rec.building?.gla}  yearBuilt: ${rec.building?.yearBuilt}  bedrooms: ${rec.building?.bedrooms}`);
  console.log(`  lastVerifiedAt: ${rec.lastVerifiedAt}`);

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] would clear lastVerifiedAt`);
    continue;
  }

  // Fetch the full document, strip lastVerifiedAt, upsert.
  const { resource: full } = await container.item(rec.id, rec.tenantId).read();
  if (!full) {
    console.warn(`  SKIPPED: document not found (id=${rec.id})`);
    continue;
  }

  delete full.lastVerifiedAt;
  delete full.lastVerifiedSource;

  const { resource: updated } = await container.items.upsert(full);
  console.log(`  CLEARED lastVerifiedAt (new recordVersion still ${updated?.recordVersion ?? rec.recordVersion})`);
}

console.log(DRY_RUN ? '\n[DRY-RUN complete — no changes made]' : '\nDone.');
