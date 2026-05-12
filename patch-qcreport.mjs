import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('qc-reviews');

const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-qc-review-full-report-001'"
}).fetchAll();
const report = resources[0];
console.log('orderId pk:', report.orderId);

const target = 'program:FNMA-1004:SubjectProperty.PropertyIdentification.OccupancyStatusIndicated:006';
let patched = 0;
for (const cat of report.categoriesResults ?? []) {
  for (const q of cat.questions ?? []) {
    if (q.questionId === 'PROPERTY_ADDRESS_CORRECT') {
      if (!Array.isArray(q.axiomCriterionIds)) q.axiomCriterionIds = [];
      if (!q.axiomCriterionIds.includes(target)) {
        q.axiomCriterionIds.push(target);
        patched++;
      }
      console.log('q PROPERTY_ADDRESS_CORRECT axiomCriterionIds:', q.axiomCriterionIds);
    }
  }
}
if (patched) {
  const { resource } = await c.item(report.id, report.orderId).replace(report);
  console.log('patched:', resource.id, 'questions changed:', patched);
} else console.log('already patched');
