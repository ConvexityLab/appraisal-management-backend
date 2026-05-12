import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const runId = '41a7e08d-0b61-4180-920c-a17261a2b4e8'; // latest post-fix run
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT TOP 1 c.dataConsulted FROM c WHERE c.scopeId='SEED-VO-00105' AND c.evaluationRunId=@r",
  parameters: [{ name: '@r', value: runId }]
}).fetchAll();
console.log('-- dataConsulted from latest run --');
console.log(JSON.stringify(resources[0]?.dataConsulted, null, 2).substring(0, 2000));
