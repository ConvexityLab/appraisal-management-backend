import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('client-orders');
const { resources } = await c.items.query({
  query: "SELECT TOP 1 c.id, c.axiomProgramId, c.axiomProgramVersion, c.axiomStatus, c.tenantId, c.clientId FROM c WHERE c.id='SEED-VO-00101'"
}).fetchAll();
console.log(JSON.stringify(resources[0], null, 2));
