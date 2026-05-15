import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });

// All docs (any type) for SEED-VO-00101 from last 10 minutes
const { resources } = await c.database('appraisal-management').container('aiInsights').items.query({
  query: "SELECT TOP 10 c.id, c.type, c.orderId, c.evaluationId, c._ts, c.createdAt, c.updatedAt FROM c WHERE c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
console.log(`-- all aiInsights for SEED-VO-00101 (${resources.length}) --`);
for (const r of resources) console.log(' ', JSON.stringify(r));
