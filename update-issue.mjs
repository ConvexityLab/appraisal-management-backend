import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('aiInsights');

const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.type='qc-issue' AND c.orderId='SEED-VO-00101'"
}).fetchAll();
const r = resources[0];
console.log('before:', r.issueSummary);
r.issueSummary = 'Occupancy status not one of Owner Tenant Vacant';
r.updatedAt = new Date().toISOString();
const { resource } = await c.item(r.id, r.tenantId).replace(r);
console.log('after: ', resource.issueSummary);
