import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// List ALL containers
const { resources: containers } = await db.containers.readAll().fetchAll();
console.log('-- all containers --');
for (const c of containers) console.log(`  ${c.id}`);
