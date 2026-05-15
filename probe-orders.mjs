import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });

const dbId = 'appraisal-management';
const containers = ['orders', 'reviews', 'qc-reviews', 'engagements'];

for (const c of containers) {
  try {
    const { resources } = await client.database(dbId).container(c).items
      .query({ query: 'SELECT TOP 8 c.id, c.orderId, c.engagementId, c._ts FROM c ORDER BY c._ts DESC' })
      .fetchAll();
    console.log(`-- ${c} (${resources.length}) --`);
    for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
  } catch (e) {
    console.log(`-- ${c}: ${e.message?.split('\n')[0]} --`);
  }
}
