import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const runId = '9f4e351e-b898-426a-8e4f-d75e45a66f3b';
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT c.criterionId, c.verdict, c.reasonCode, c.reasoning, ARRAY_LENGTH(c.dataConsulted.fields) AS fieldCount FROM c WHERE c.scopeId='SEED-VO-00105' AND c.evaluationRunId=@r",
  parameters: [{ name: '@r', value: runId }]
}).fetchAll();
console.log(`-- post-fix run ${runId} --`);
const counts = {};
for (const r of resources) counts[r.verdict || '?'] = (counts[r.verdict || '?'] || 0) + 1;
console.log('counts:', JSON.stringify(counts));
console.log('total:', resources.length);
// Reasoning sample - missing docs pattern
const missingDocReasons = new Set();
for (const r of resources) {
  if (r.reasoning && r.reasoning.includes('missing documents')) {
    const m = r.reasoning.match(/missing documents: ([^.]+)/);
    if (m) missingDocReasons.add(m[1].trim());
  }
}
console.log('distinct missing-document tokens:', [...missingDocReasons]);
