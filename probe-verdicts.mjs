import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const runId = '2dc79ab0-a100-4ac4-a6d9-7157776ac781';
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT c.criterionId, c.verdict, c.reasonCode, ARRAY_LENGTH(c.dataConsulted.fields) AS fieldCount, c.dataConsulted.fields FROM c WHERE c.scopeId='SEED-VO-00105' AND c.evaluationRunId=@r",
  parameters: [{ name: '@r', value: runId }]
}).fetchAll();
console.log(`-- pre-fix run ${runId} verdict breakdown --`);
const counts = {};
for (const r of resources) counts[r.verdict || '?'] = (counts[r.verdict || '?'] || 0) + 1;
console.log('counts:', JSON.stringify(counts));
console.log('total criteria:', resources.length);
console.log('-- sample (first 3) --');
for (const r of resources.slice(0, 3)) {
  console.log(`  ${r.criterionId}: verdict=${r.verdict} reason=${r.reasonCode} fields=${r.fieldCount}`);
}
