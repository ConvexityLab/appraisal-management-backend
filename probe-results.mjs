import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT TOP 5 c.id, c.scopeId, c.programId, c.programVersion, c.evaluationRunId, c.status, c._ts FROM c WHERE c.scopeId = @s ORDER BY c._ts DESC",
  parameters: [{ name: '@s', value: 'SEED-VO-00105' }]
}).fetchAll();
console.log('-- evaluation-results for SEED-VO-00105 --');
for (const r of resources) console.log(`  ${JSON.stringify(r)}`);
