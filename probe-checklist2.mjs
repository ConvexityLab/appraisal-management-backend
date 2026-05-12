import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const c = db.container('qc-reviews');

// Find any qc-review for SEED-VO-00101
const { resources: forOrder } = await c.items.query({
  query: "SELECT * FROM c WHERE c.orderId='SEED-VO-00101'"
}).fetchAll();
console.log(`-- qc-reviews for SEED-VO-00101: ${forOrder.length} --`);
for (const r of forOrder) console.log(`  ${JSON.stringify({id:r.id, type:r.type})}`);

// Inspect schema from seed-qc-review-001 (SEED-VO-00112)
const { resources: example } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-qc-review-001'"
}).fetchAll();
const r = example[0];
console.log('\n-- seed-qc-review-001 top-level keys --');
console.log(Object.keys(r));
console.log('\n-- partition key candidates --');
console.log('tenantId:', r.tenantId, 'orderId:', r.orderId);
console.log('\n-- checklistItems shape (first 2) --');
console.log(JSON.stringify(r.checklistItems?.slice(0,2) ?? r.items?.slice(0,2) ?? r.checklist?.slice(0,2), null, 2));
console.log('\n-- has axiomCriterionIds? --');
console.log('per-item:', (r.checklistItems||r.items||r.checklist||[]).some(i => Array.isArray(i.axiomCriterionIds)));
console.log('top-level:', Array.isArray(r.axiomCriterionIds));
