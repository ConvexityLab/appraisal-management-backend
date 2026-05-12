import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('orders');

const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='SEED-VO-00101'"
}).fetchAll();
const o = resources[0];
console.log('before: axiomProgramId=%s axiomProgramVersion=%s', o.axiomProgramId, o.axiomProgramVersion);
o.axiomProgramId = 'FNMA-1004';
o.axiomProgramVersion = '1.0.0';
const { resource } = await c.item(o.id, o.tenantId).replace(o);
console.log('after:  axiomProgramId=%s axiomProgramVersion=%s', resource.axiomProgramId, resource.axiomProgramVersion);
