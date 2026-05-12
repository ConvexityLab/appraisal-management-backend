import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('qc-reviews');
const { resources } = await c.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-qc-review-full-report-001'"
}).fetchAll();
const r = resources[0];
console.log('id:', r.id);
console.log('orderId:', r.orderId);
console.log('status:', r.status, 'passFailStatus:', r.passFailStatus);
console.log('categoriesResults:', r.categoriesResults?.length);
const q = r.categoriesResults?.[0]?.questions?.[0];
console.log('q[0].questionId:', q?.questionId);
console.log('q[0].axiomCriterionIds:', q?.axiomCriterionIds);
console.log('q[0] all keys:', Object.keys(q ?? {}));
