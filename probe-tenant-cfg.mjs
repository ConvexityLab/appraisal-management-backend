import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources } = await db.container('client-configs').items.query({
  query: "SELECT TOP 5 c.id, c.clientId, c.subClientId, c.axiomProgramId, c.axiomProgramVersion, c.entityType FROM c WHERE c.entityType='client-config'"
}).fetchAll();
console.log(`-- client-configs (${resources.length}) --`);
for (const r of resources) console.log('  ', JSON.stringify(r));
