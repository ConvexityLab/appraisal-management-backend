import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const { resources } = await c.database('axiom').container('compiled-programs').items.query({
  query: "SELECT TOP 1 c.evaluation, c.dataRequirements FROM c WHERE c.id LIKE '%SubjectAddress%'"
}).fetchAll();
console.log(JSON.stringify(resources[0], null, 2).substring(0, 2000));
