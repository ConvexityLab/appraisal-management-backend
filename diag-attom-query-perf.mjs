import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: process.env.AZURE_COSMOS_ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

console.log('Checking FL/32233 query performance...');
const t1 = Date.now();
const { resources: full } = await db.container('attom-data').items.query({
  query: "SELECT c.id FROM c WHERE c.type = 'attom-data' AND c.address.state = 'FL' AND c.address.zip = '32233'",
  parameters: []
}).fetchAll();
const ms1 = Date.now() - t1;
console.log(`SELECT id only: ${full.length} rows in ${ms1}ms`);

// Now SELECT * (what LocalAttom actually does)
const t2 = Date.now();
const { resources: fullData } = await db.container('attom-data').items.query({
  query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = 'FL' AND c.address.zip = '32233'",
  parameters: []
}).fetchAll();
const ms2 = Date.now() - t2;
const dataSizeMb = (JSON.stringify(fullData).length / 1024 / 1024).toFixed(2);
console.log(`SELECT *: ${fullData.length} rows in ${ms2}ms, data size: ${dataSizeMb} MB`);
