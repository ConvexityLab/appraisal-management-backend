import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const { resources } = await db.container('document-type-registry').items.query("SELECT TOP 1 * FROM c WHERE ARRAY_CONTAINS(c.aliases, 'URAR', false)").fetchAll();
console.log(JSON.stringify(resources[0], null, 2));
