import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
// Wait longer for SB delivery
await new Promise(r => setTimeout(r, 15000));
const { resources } = await c.database('appraisal-management').container('aiInsights').items.query({
  query: "SELECT * FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00101' ORDER BY c.updatedAt DESC"
}).fetchAll();
console.log(`qc-issues for SEED-VO-00101: ${resources.length}`);
for (const r of resources) {
  console.log(`  id=${r.id.substring(0,90)}`);
  console.log(`    createdAt=${r.createdAt}  updatedAt=${r.updatedAt}`);
  console.log(`    evaluationId=${r.evaluationId}  createdBy=${r.createdBy}`);
}
