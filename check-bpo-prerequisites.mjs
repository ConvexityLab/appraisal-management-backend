/**
 * Check that the BPO prerequisites exist in Cosmos DB:
 *   1. QC checklist  : criteria container, id = seed-checklist-uad-standard-2026
 *   2. Report template: document-templates container, id = seed-report-template-dvr-bpo-v1
 *
 * Usage:
 *   node check-bpo-prerequisites.mjs
 *
 * Requires: AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT env var (or .env file).
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

async function findById(containerName, id) {
  const { resources } = await db.container(containerName).items.query(
    { query: 'SELECT c.id, c.name, c.type, c.isActive, c.version FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }] },
    { enableCrossPartitionQuery: true },
  ).fetchAll();
  return resources[0] ?? null;
}

const CHECKLIST_ID = 'seed-checklist-uad-standard-2026';
const TEMPLATE_ID  = 'seed-report-template-dvr-bpo-v1';

console.log('Checking BPO prerequisites in Cosmos DB...\n');

const [checklist, template] = await Promise.all([
  findById('criteria',           CHECKLIST_ID),
  findById('document-templates', TEMPLATE_ID),
]);

console.log('--- QC Checklist ---');
if (checklist) {
  console.log('  FOUND');
  console.log(`  id      : ${checklist.id}`);
  console.log(`  name    : ${checklist.name}`);
  console.log(`  version : ${checklist.version}`);
  console.log(`  isActive: ${checklist.isActive}`);
} else {
  console.log(`  NOT FOUND  (id: ${CHECKLIST_ID})`);
}

console.log('\n--- Report Template ---');
if (template) {
  console.log('  FOUND');
  console.log(`  id      : ${template.id}`);
  console.log(`  name    : ${template.name}`);
  console.log(`  isActive: ${template.isActive}`);
} else {
  console.log(`  NOT FOUND  (id: ${TEMPLATE_ID})`);
}

console.log('\n--- Summary ---');
const allPresent = checklist && template;
console.log(`  QC Checklist   : ${checklist  ? 'OK' : 'MISSING'}`);
console.log(`  Report Template: ${template   ? 'OK' : 'MISSING'}`);
console.log(allPresent ? '\nAll prerequisites present.' : '\nOne or more prerequisites are missing — run the seed scripts.');
