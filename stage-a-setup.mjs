import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('orders');
const { resources } = await c.items.query({
  query: "SELECT TOP 1 * FROM c WHERE c.id='SEED-VO-00103'"
}).fetchAll();
const o = resources[0];
o.axiomProgramId = 'FNMA-1004';
o.axiomProgramVersion = '1.0.0';
const { resource } = await c.item(o.id, o.tenantId).replace(o);
console.log('SEED-VO-00103 after: axiomProgramId=%s axiomProgramVersion=%s', resource.axiomProgramId, resource.axiomProgramVersion);
