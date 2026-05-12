import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('orders');
const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='SEED-VO-00101'"
}).fetchAll();
const o = resources[0];
console.log('keys:', Object.keys(o));
console.log('axiomProgramId:', o.axiomProgramId, 'axiomProgramVersion:', o.axiomProgramVersion);
console.log('partition fields candidates:', { tenantId: o.tenantId, clientId: o.clientId });
