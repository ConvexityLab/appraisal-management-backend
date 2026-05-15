import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const c = db.container('criteria');
const { resources } = await c.items.query({
  query: "SELECT TOP 3 c.id, c.tenantId, c.type, c.name FROM c WHERE c.id LIKE 'seed-checklist%' OR CONTAINS(c.type, 'checklist')"
}).fetchAll();
console.log(`-- checklist records (${resources.length}) --`);
for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
