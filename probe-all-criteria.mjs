import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const { resources } = await c.database('axiom').container('compiled-programs').items.query({
  query: "SELECT c.id FROM c WHERE c.programId='FNMA-1004' ORDER BY c.id"
}).fetchAll();
for (const r of resources) console.log(r.id);
