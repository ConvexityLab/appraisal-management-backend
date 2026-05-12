import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// Full inspect the SEED-VO-00101 qc-review
const c1 = db.container('qc-reviews');
const { resources: r1 } = await c1.items.query({
  query: "SELECT * FROM c WHERE c.id='seed-qc-review-full-report-001'"
}).fetchAll();
const r = r1[0];
console.log('-- seed-qc-review-full-report-001 keys --');
console.log(Object.keys(r));
console.log('checklistId:', r.checklistId);
console.log('orderId:', r.orderId);

// Find the matching checklist
if (r.checklistId) {
  // Try multiple containers
  for (const cn of ['qc-checklists', 'qcChecklists', 'qc-checklist', 'checklists', 'qcChecklistTemplates', 'qc-checklist-templates']) {
    try {
      const cc = db.container(cn);
      const { resources: cks } = await cc.items.query({
        query: `SELECT TOP 1 * FROM c WHERE c.id='${r.checklistId}'`
      }).fetchAll();
      if (cks.length > 0) {
        console.log(`\nfound in container: ${cn}`);
        console.log('keys:', Object.keys(cks[0]));
        console.log('items count:', (cks[0].items||cks[0].checklistItems||cks[0].checklist||[]).length);
        const items = cks[0].items||cks[0].checklistItems||cks[0].checklist||[];
        console.log('first item:', JSON.stringify(items[0], null, 2));
        break;
      }
    } catch (e) { /* skip */ }
  }
}
