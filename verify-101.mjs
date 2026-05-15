import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const { resources } = await c.database('appraisal-management').container('aiInsights').items.query({
  query: "SELECT c.id, c.evaluationId, c.createdAt, c.updatedAt, c.createdBy FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
console.log(`qc-issues for SEED-VO-00101: ${resources.length}`);
for (const r of resources) console.log(' ', JSON.stringify(r));
