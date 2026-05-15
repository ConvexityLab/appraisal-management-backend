import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// All documents
const { resources: all } = await db.container('documents').items.query({
  query: "SELECT TOP 30 c.id, c.documentType, c.classifiedAs, c.fileName, c.orderId, c.engagementId, c.tenantId, c._ts FROM c ORDER BY c._ts DESC"
}).fetchAll();
console.log(`-- all documents (top 30) --`);
for (const r of all) console.log(`  ${JSON.stringify(r)}`);
