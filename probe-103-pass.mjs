import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const c = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const runId = '81644472-87e4-4de7-bc6f-8abcda36a574';

const { resources } = await c.database('axiom').container('evaluation-results').items.query({
  query: `SELECT TOP 5 * FROM c WHERE c.scopeId='SEED-VO-00103' AND c.evaluationRunId='${runId}' AND c.verdict='pass'`
}).fetchAll();
console.log(`-- PASS rows: ${resources.length} --`);
for (const r of resources) {
  console.log(`  ${r.criterionId}`);
  console.log(`    verdict=${r.verdict} evaluation=${r.evaluation}`);
  console.log(`    reasoning: ${(r.reasoning||"").substring(0,100)}`);
  console.log(`    dataConsulted.fields:`, JSON.stringify(r.dataConsulted?.fields ?? {}).substring(0,300));
}

// What fields are reachable AT ALL across the run?
const { resources: all } = await c.database('axiom').container('evaluation-results').items.query({
  query: `SELECT c.criterionId, c.dataConsulted.fields FROM c WHERE c.scopeId='SEED-VO-00103' AND c.evaluationRunId='${runId}'`
}).fetchAll();
const allFields = new Set();
for (const r of all) {
  for (const k of Object.keys(r.fields ?? {})) allFields.add(k);
}
console.log('\nDistinct envelope-field paths used by any criterion in this run:');
console.log([...allFields].sort());
