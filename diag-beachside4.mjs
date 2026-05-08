/**
 * Diagnostic: show full enrichment audit documents for prop-1778086971512-3rjsphm
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const PROPERTY_ID = 'prop-1778086971512-3rjsphm';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

const enrichContainer = db.container('property-enrichments');
const { resources: audits } = await enrichContainer.items.query(
  {
    query: "SELECT * FROM c WHERE c.tenantId = @tenantId AND c.propertyId = @propertyId ORDER BY c.createdAt DESC",
    parameters: [
      { name: '@tenantId', value: TENANT },
      { name: '@propertyId', value: PROPERTY_ID },
    ],
  },
  { partitionKey: TENANT }
).fetchAll();

console.log(`Found ${audits.length} enrichment audit records\n`);
for (const a of audits) {
  console.log('══════════════════════════════════════════════════════');
  console.log('id:', a.id);
  console.log('orderId:', a.orderId);
  console.log('createdAt:', a.createdAt);
  console.log('status:', a.status);
  console.log('dataResult?.source:', a.dataResult?.source ?? '(null)');
  if (a.dataResult) {
    console.log('dataResult.fetchedAt:', a.dataResult.fetchedAt);
    console.log('dataResult.core:', JSON.stringify(a.dataResult.core ?? null));
    console.log('dataResult.publicRecord:', JSON.stringify(a.dataResult.publicRecord ?? null));
  } else {
    console.log('dataResult: null (provider_miss or cached)');
  }
}
