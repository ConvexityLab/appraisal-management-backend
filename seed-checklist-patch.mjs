import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('criteria');

const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-checklist-uad-standard-2026'"
}).fetchAll();
const checklist = resources[0];
console.log('clientId pk:', checklist.clientId);

const target = 'program:FNMA-1004:SubjectProperty.PropertyIdentification.OccupancyStatusIndicated:006';
let patched = false;
for (const cat of checklist.categories || []) {
  for (const sub of cat.subcategories || []) {
    for (const q of sub.questions || []) {
      if (q.id === 'q-subj-01') {
        if (!Array.isArray(q.axiomCriterionIds)) q.axiomCriterionIds = [];
        if (!q.axiomCriterionIds.includes(target)) {
          q.axiomCriterionIds.push(target);
          patched = true;
        }
        console.log('q-subj-01 axiomCriterionIds:', q.axiomCriterionIds);
      }
    }
  }
}
if (patched) {
  // container partition key is /clientId (not /tenantId)
  const { resource } = await c.item(checklist.id, checklist.clientId).replace(checklist);
  console.log('patched:', resource.id);
} else console.log('already patched');
