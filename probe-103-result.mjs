import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const runId = '81644472-87e4-4de7-bc6f-8abcda36a574';
const { resources } = await c.database('axiom').container('evaluation-results').items.query({
  query: `SELECT TOP 5 c.criterionId, c.evaluation, c.reasoning, c.dataConsulted.fields FROM c WHERE c.scopeId='SEED-VO-00103' AND c.evaluationRunId='${runId}'`
}).fetchAll();
console.log('-- sample evaluation-results --');
for (const r of resources) {
  console.log(`  [${r.evaluation}]`, r.criterionId.substring(0, 80));
  console.log('     reasoning:', (r.reasoning||"").substring(0, 100));
  console.log('     dataConsulted.fields keys:', Object.keys(r.fields ?? {}).slice(0, 10));
}
