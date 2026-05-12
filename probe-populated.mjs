import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');

// Find any eval results where dataConsulted has populated fields
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT TOP 10 c.scopeId, c.evaluationRunId, c.verdict, c.dataConsulted.fields, c._ts FROM c WHERE ARRAY_LENGTH(OBJECT_KEYS(c.dataConsulted.fields)) > 0 ORDER BY c._ts DESC"
}).fetchAll();
console.log(`-- eval results with populated fields (${resources.length}) --`);
for (const r of resources) {
  const fields = r.fields || {};
  const sampleKeys = Object.keys(fields).slice(0, 5);
  console.log(`  scope=${r.scopeId} run=${r.evaluationRunId?.substring(0,8)} verdict=${r.verdict} ts=${r._ts}`);
  console.log(`    fieldKeys[0..4]: ${JSON.stringify(sampleKeys)}`);
}
