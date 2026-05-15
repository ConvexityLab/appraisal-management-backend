import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');

const { resources } = await db.container('compiled-programs').items.query({
  query: "SELECT TOP 5 c.id, c.programId, c.programVersion, c._ts FROM c WHERE c.programId='FNMA-1004' ORDER BY c._ts DESC"
}).fetchAll();
console.log('-- FNMA-1004 compiled programs --');
for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
