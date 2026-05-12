import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// Find all containers that might hold qc-checklist records
const containers = ['qc-reviews', 'qcChecklist', 'qc-checklist', 'qcReviews'];
for (const name of containers) {
  try {
    const { resources } = await db.container(name).items.query({
      query: "SELECT TOP 3 c.id, c.orderId, c.type, c.tenantId FROM c"
    }).fetchAll();
    console.log(`-- ${name} (${resources.length}) --`);
    for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
  } catch (e) { console.log(`-- ${name}: NOT FOUND --`); }
}
