import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT');
const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = 'appraisal-management';
const tenantId = '885097ba-35ea-48db-be7a-a0aa7ff451bd';

// Most recent 20 enrichment records
const { resources } = await client.database(db).container('property-enrichments')
  .items.query({
    query: `SELECT c.id, c.orderId, c.propertyId, c.status, c.dataResult.source, c.dataResult.core, c.createdAt
            FROM c WHERE c.tenantId = @t AND c.type = 'property-enrichment'
            ORDER BY c.createdAt DESC OFFSET 0 LIMIT 20`,
    parameters: [{ name: '@t', value: tenantId }],
  }, { enableCrossPartitionQuery: true }).fetchAll();

console.log(`Found ${resources.length} enrichment records:\n`);
for (const r of resources) {
  console.log(JSON.stringify(r, null, 2));
}
