import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const { resources } = await c.database('axiom').container('compiled-programs').items.query({
  query: "SELECT DISTINCT VALUE c.programId FROM c"
}).fetchAll();
console.log('distinct programIds:', resources);
