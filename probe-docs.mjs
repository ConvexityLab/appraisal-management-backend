import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// AM BE docs container (whatever it is)
const beClient = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const beDb = beClient.database('appraisal-management');
const containers = (await beDb.containers.readAll().fetchAll()).resources.map(c => c.id);
console.log('appraisal-mgmt containers:', containers.filter(n => n.includes('doc') || n.includes('snap')));

// axiom cosmos: document-type-registry
const axClient = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const axDb = axClient.database('axiom');
const axContainers = (await axDb.containers.readAll().fetchAll()).resources.map(c => c.id);
console.log('axiom containers:', axContainers);

if (axContainers.includes('document-type-registry')) {
  const { resources } = await axDb.container('document-type-registry').items.query("SELECT TOP 5 c.id, c.canonicalType, c.aliases FROM c").fetchAll();
  console.log('-- document-type-registry (top 5) --');
  for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
}
