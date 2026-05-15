/**
 * Clear lastVerifiedAt on prop-1778086971512-3rjsphm
 * so the next "Re-fetch Data" will bypass the cache and call the provider chain.
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const PROPERTY_ID = 'prop-1778086971512-3rjsphm';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const container = client.database('appraisal-management').container('property-records');

const { resource: record } = await container.item(PROPERTY_ID, TENANT).read();
if (!record) {
  console.log('ERROR: record not found');
  process.exit(1);
}

console.log('Before:');
console.log('  lastVerifiedAt:', record.lastVerifiedAt ?? '(none)');
console.log('  lastVerifiedSource:', record.lastVerifiedSource ?? '(none)');
console.log('  building:', JSON.stringify(record.building));

// Patch: remove lastVerifiedAt and lastVerifiedSource so cache is bypassed
const patched = { ...record };
delete patched.lastVerifiedAt;
delete patched.lastVerifiedSource;

const { resource: updated } = await container.item(PROPERTY_ID, TENANT).replace(patched);
console.log('\nAfter:');
console.log('  lastVerifiedAt:', updated.lastVerifiedAt ?? '(none — cache cleared ✓)');
console.log('  lastVerifiedSource:', updated.lastVerifiedSource ?? '(none)');
