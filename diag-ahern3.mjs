/**
 * Diagnostic: Check attom-data container indexing policy and
 * whether ORDER BY works for the cross-partition query used by LocalAttomPropertyDataProvider
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database('appraisal-management');

console.log('=== attom-data container indexing policy ===');
try {
  const { resource: containerDef } = await db.container('attom-data').read();
  console.log('Partition key:', JSON.stringify(containerDef?.partitionKey));
  console.log('Indexing policy:', JSON.stringify(containerDef?.indexingPolicy, null, 2));
} catch (e) {
  console.error('Could not read container definition:', e.message);
}

// Test the EXACT query used by LocalAttomPropertyDataProvider — with ORDER BY
console.log('\n=== Testing exact LocalAttomPropertyDataProvider query (with ORDER BY) ===');
const t1 = Date.now();
try {
  const { resources } = await db.container('attom-data').items.query({
    query: "SELECT c.attomId, c.address FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
    parameters: [
      { name: '@state', value: 'FL' },
      { name: '@zip', value: '32233' },
    ]
  }).fetchAll();
  console.log(`OK — ${resources.length} results in ${Date.now() - t1}ms`);
} catch (e) {
  console.error(`FAILED in ${Date.now() - t1}ms:`, e.message, e.code);
}

// Test WITHOUT ORDER BY — to compare
console.log('\n=== Testing WITHOUT ORDER BY ===');
const t2 = Date.now();
try {
  const { resources } = await db.container('attom-data').items.query({
    query: "SELECT c.attomId, c.address FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip",
    parameters: [
      { name: '@state', value: 'FL' },
      { name: '@zip', value: '32233' },
    ]
  }).fetchAll();
  console.log(`OK — ${resources.length} results in ${Date.now() - t2}ms`);
} catch (e) {
  console.error(`FAILED in ${Date.now() - t2}ms:`, e.message, e.code);
}

// Check if there are any enrichment records where LocalAttom was the source
console.log('\n=== Enrichment records using LocalAttom (ATTOM Data Solutions Cosmos cache) ===');
const { resources: localAttomEnrichments } = await db.container('property-enrichments').items.query({
  query: "SELECT TOP 5 c.id, c.propertyId, c.orderId, c.status, c.createdAt, c.dataResult.source as src FROM c WHERE c.dataResult.source = 'ATTOM Data Solutions (Cosmos cache)' ORDER BY c.createdAt DESC",
}).fetchAll();
console.log(`Records with LocalAttom source: ${localAttomEnrichments.length}`);
localAttomEnrichments.forEach((r, i) => {
  console.log(`  [${i}] ${r.createdAt} orderId=${r.orderId} status=${r.status}`);
});

// Check any recent enrichments (last 10)
console.log('\n=== Most recent 10 enrichment records (any source) ===');
const { resources: recent } = await db.container('property-enrichments').items.query({
  query: "SELECT TOP 10 c.id, c.status, c.createdAt, c.dataResult.source as src FROM c ORDER BY c.createdAt DESC",
}).fetchAll();
recent.forEach((r, i) => {
  console.log(`  [${i}] ${r.createdAt} status=${r.status} src="${r.src ?? '(none)'}"`);
});
