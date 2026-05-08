import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database('appraisal-management');

const { resources } = await db.container('attom-data').items.query({
  query: "SELECT c.attomId, c.ingestedAt, c.sourcedAt, c.address.full as addrFull FROM c WHERE c.attomId = '27676690'",
}).fetchAll();
console.log('Doc 27676690:', JSON.stringify(resources, null, 2));

// Also check any recent ingestion activity
const { resources: recent } = await db.container('attom-data').items.query({
  query: "SELECT TOP 5 c.attomId, c.ingestedAt, c.address.state, c.address.zip FROM c WHERE c.address.state = 'FL' AND c.address.zip = '32233' ORDER BY c.ingestedAt DESC",
}).fetchAll();
console.log('\nMost recently ingested FL/32233 docs:');
recent.forEach((r, i) => console.log(`  [${i}] attomId=${r.attomId} ingestedAt=${r.ingestedAt}`));
