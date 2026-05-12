import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources } = await db.container('canonical-snapshots').items.query({
  query: "SELECT TOP 1 * FROM c WHERE c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
const snap = resources[0];
console.log('pk hints: tenantId=', snap.tenantId, 'propertyId=', snap.propertyId, 'orderId=', snap.orderId);
console.log('-- normalizedData full --');
console.log(JSON.stringify(snap.normalizedData, null, 2).substring(0, 4500));
