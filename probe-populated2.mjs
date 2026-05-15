import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const { resources } = await db.container('evaluation-results').items.query({
  query: "SELECT TOP 50 c.scopeId, c.evaluationRunId, c.verdict, c._ts FROM c ORDER BY c._ts DESC"
}).fetchAll();
const byScope = {};
for (const r of resources) {
  byScope[r.scopeId] = byScope[r.scopeId] || { count: 0, verdicts: {}, _ts: r._ts };
  byScope[r.scopeId].count++;
  byScope[r.scopeId].verdicts[r.verdict] = (byScope[r.scopeId].verdicts[r.verdict]||0) + 1;
}
console.log('-- scopes seen in most recent 50 results --');
for (const [scope, info] of Object.entries(byScope)) {
  console.log(`  ${scope}: count=${info.count} verdicts=${JSON.stringify(info.verdicts)} ts=${info._ts}`);
}
