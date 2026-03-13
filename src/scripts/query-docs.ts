import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env['AZURE_COSMOS_ENDPOINT']!;
const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });

async function main() {
  const { resources } = await client.database('appraisal-management').container('documents').items.query({
    query: 'SELECT c.id, c.name, c.fileName, c.blobName, c.blobPath, c.orderId, c.category FROM c WHERE c.orderId = @o',
    parameters: [{ name: '@o', value: 'seed-order-001' }]
  }).fetchAll();
  console.log(JSON.stringify(resources, null, 2));
}
main().catch(console.error);
