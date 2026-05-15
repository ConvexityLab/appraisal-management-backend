import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('qc-reviews');
const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-qc-review-full-report-001'"
}).fetchAll();
const r = resources[0];
console.log('categoriesResults length:', r.categoriesResults?.length);
const cat0 = r.categoriesResults?.[0];
if (cat0) {
  console.log('cat 0 keys:', Object.keys(cat0));
  console.log('cat 0 has subcategories?', !!cat0.subcategories, 'questionsResults?', !!cat0.questionsResults);
  // Try a few possible nesting names
  for (const k of ['subcategories', 'questions', 'questionsResults', 'items']) {
    if (Array.isArray(cat0[k])) {
      console.log(`  cat 0.${k}.length:`, cat0[k].length);
      console.log(`  first ${k}[0]:`, JSON.stringify(cat0[k][0], null, 2).substring(0, 1200));
      break;
    }
  }
}
