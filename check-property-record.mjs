import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const container = client.database('appraisal-management').container('property-records');

const { resources } = await container.items.query(
  {
    query: "SELECT c.id, c.tenantId, c.building, c.lastVerifiedAt, c.lastVerifiedSource, c.address FROM c WHERE c.tenantId = @tenantId",
    parameters: [{ name: '@tenantId', value: TENANT }],
  },
  { partitionKey: TENANT }
).fetchAll();

// Find records with "sevilla" in address
const sevilla = resources.filter(r => JSON.stringify(r.address || '').toLowerCase().includes('sevilla'));
if (sevilla.length === 0) {
  console.log('No Sevilla records found. Total records:', resources.length);
  // Show first 3
  console.log('Sample:', JSON.stringify(resources.slice(0,3).map(r=>({id:r.id, street: r.address?.street})), null, 2));
} else {
  console.log(JSON.stringify(sevilla.map(d => ({
    id: d.id,
    street: d.address?.street,
    gla: d.building?.grossLivingArea,
    yearBuilt: d.building?.yearBuilt,
    lastVerifiedAt: d.lastVerifiedAt,
    lastVerifiedSource: d.lastVerifiedSource,
  })), null, 2));
}
