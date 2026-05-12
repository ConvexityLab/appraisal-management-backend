import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
// Try different containers
for (const cname of ['client-orders','orders','appraisal-orders','appraisalOrders']) {
  try {
    const c = db.container(cname);
    const { resources } = await c.items.query({
      query: "SELECT TOP 1 c.id, c.orderNumber, c.axiomProgramId FROM c WHERE c.id='SEED-VO-00101' OR c.orderNumber='SEED-VO-00101'"
    }).fetchAll();
    console.log(`${cname}: ${resources.length} matches`);
    if (resources.length) console.log('  ', JSON.stringify(resources[0]));
  } catch (e) { console.log(`${cname}: NOT FOUND`); }
}
