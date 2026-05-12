import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT TOP 500 c.scopeId, c.evaluationRunId, c.verdict, c._ts FROM c ORDER BY c._ts DESC"
}).fetchAll();
const byScope = {};
for (const r of resources) {
  byScope[r.scopeId] = byScope[r.scopeId] || { count: 0, verdicts: {}, runIds: new Set(), latest: r._ts };
  byScope[r.scopeId].count++;
  byScope[r.scopeId].verdicts[r.verdict] = (byScope[r.scopeId].verdicts[r.verdict]||0) + 1;
  byScope[r.scopeId].runIds.add(r.evaluationRunId);
}
console.log(`-- ${resources.length} results across ${Object.keys(byScope).length} scopes --`);
for (const [scope, info] of Object.entries(byScope)) {
  console.log(`  ${scope}: results=${info.count} runs=${info.runIds.size} verdicts=${JSON.stringify(info.verdicts)} latest=${info.latest}`);
}
