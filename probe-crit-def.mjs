import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
// All FNMA-1004 criteria — get id + evaluation.mode + evaluation.expression
const { resources } = await db.container('compiled-programs').items.query({
  query: "SELECT c.id, c.evaluation.mode, c.evaluation.expression, c.evaluation.deterministicRules FROM c WHERE c.programId='FNMA-1004'"
}).fetchAll();
console.log(`-- FNMA-1004 criteria (${resources.length}) --`);
for (const r of resources) {
  const exprPreview = r.expression ? r.expression.substring(0, 100) : (r.deterministicRules ? JSON.stringify(r.deterministicRules).substring(0, 100) : 'none');
  console.log(`  [${r.mode}] ${r.id.substring(0, 70)}: ${exprPreview}`);
}
