/**
 * One-off: purge any pdf-report-template documents whose id is not in the
 * canonical REPORT_TEMPLATE_IDS set.
 *
 * Run with:
 *   npx tsx src/scripts/one-off/purge-unknown-report-templates.ts
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { REPORT_TEMPLATE_IDS } from '../seed/seed-ids.js';

const ENDPOINT     = process.env.COSMOS_ENDPOINT;
const TENANT_ID    = process.env.AZURE_TENANT_ID;
const DB_NAME      = 'appraisal-management';
const CONTAINER    = 'document-templates';

if (!ENDPOINT)  throw new Error('COSMOS_ENDPOINT env var is required');
if (!TENANT_ID) throw new Error('AZURE_TENANT_ID env var is required');

const knownIds = new Set(Object.values(REPORT_TEMPLATE_IDS));

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const container = client.database(DB_NAME).container(CONTAINER);

async function main() {
  const { resources } = await container.items
    .query({
      query: `SELECT c.id, c.tenantId, c.name FROM c WHERE c.type = 'pdf-report-template'`,
    })
    .fetchAll();

  console.log(`Found ${resources.length} pdf-report-template document(s):`);
  for (const doc of resources) {
    const known = knownIds.has(doc.id);
    console.log(`  ${known ? '✅ keep' : '🗑  DELETE'} — ${doc.id}  (${doc.name ?? 'no name'})`);
  }

  const toDelete = resources.filter(d => !knownIds.has(d.id));
  if (toDelete.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  console.log(`\nDeleting ${toDelete.length} unknown document(s)...`);
  for (const doc of toDelete) {
    await container.item(doc.id, doc.tenantId ?? doc.id).delete();
    console.log(`  ✅ Deleted ${doc.id}`);
  }
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
