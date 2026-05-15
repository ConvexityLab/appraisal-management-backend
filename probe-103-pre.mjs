import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const orders = db.container('orders');
const aiInsights = db.container('aiInsights');

const { resources: ords } = await orders.items.query({
  query: "SELECT TOP 1 c.id, c.tenantId, c.clientId, c.axiomProgramId, c.axiomProgramVersion FROM c WHERE c.id='SEED-VO-00103'"
}).fetchAll();
console.log('order SEED-VO-00103 before:', JSON.stringify(ords[0]));

const { resources: issues } = await aiInsights.items.query({
  query: "SELECT c.id, c.criterionId, c.createdAt FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00103'"
}).fetchAll();
console.log(`existing qc-issues for SEED-VO-00103: ${issues.length}`);
for (const i of issues) console.log('  ', JSON.stringify(i));
