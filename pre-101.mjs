import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const { resources } = await c.database('appraisal-management').container('aiInsights').items.query({
  query: "SELECT c.id, c.criterionId, c.createdAt, c.createdBy, c.evaluationId FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00101'"
}).fetchAll();
console.log('pre-eval qc-issues for SEED-VO-00101:');
for (const r of resources) console.log(' ', JSON.stringify(r));
