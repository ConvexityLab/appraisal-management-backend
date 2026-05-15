import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources } = await db.container('canonical-snapshots').items.query({
  query: "SELECT TOP 5 c.id, c.orderId, c._ts FROM c WHERE c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
console.log(`-- canonical-snapshots for SEED-VO-00101 (${resources.length}) --`);
for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
