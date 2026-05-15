import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
// Give the SB recorder a moment
await new Promise(r => setTimeout(r, 6000));
const { resources } = await c.database('appraisal-management').container('aiInsights').items.query({
  query: "SELECT * FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00101'"
}).fetchAll();
console.log(`post-eval qc-issues for SEED-VO-00101: ${resources.length}`);
for (const r of resources) {
  console.log(`  id=${r.id.substring(0,80)}`);
  console.log(`    createdAt=${r.createdAt}  updatedAt=${r.updatedAt}`);
  console.log(`    createdBy=${r.createdBy}  evaluationId=${r.evaluationId}`);
}
