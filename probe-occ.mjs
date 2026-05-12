import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const { resources } = await db.container('compiled-programs').items.query({
  query: "SELECT TOP 1 * FROM c WHERE c.id LIKE '%OccupancyStatus%'"
}).fetchAll();
console.log(JSON.stringify(resources[0], null, 2).substring(0, 3000));
