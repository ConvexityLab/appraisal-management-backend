import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const c = db.container('criteria');
const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-checklist-uad-standard-2026'"
}).fetchAll();
const r = resources[0];
console.log('keys:', Object.keys(r));
console.log('top-level type/category fields:');
console.log({categoryCount: r.categories?.length, itemsCount: r.items?.length, criteriaCount: r.criteria?.length, sectionsCount: r.sections?.length});
const items = r.categories || r.items || r.criteria || r.sections;
console.log('first nest sample:', JSON.stringify(items?.[0], null, 2).substring(0, 1500));
