import { CosmosDbService } from './src/services/cosmos-db.service.js';
import { PropertyRecordService } from './src/services/property-record.service.js';
import { PropertyEnrichmentService } from './src/services/property-enrichment.service.js';
import type { Geocoder } from './src/services/property-enrichment.service.js';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const noopGeocoder: Geocoder = { geocode: async () => null };

async function main() {
  const db = new CosmosDbService();
  await db.initialize();

  const propertyRecordService = new PropertyRecordService(db);
  const enrichmentService = new PropertyEnrichmentService(
    db,
    propertyRecordService,
    undefined,  // factory selects LocalAttom + Bridge + Attom per env
    noopGeocoder,
  );

  console.log('Re-enriching 395 AHERN STREET, ATLANTIC BEACH FL 32233');
  console.log('lastVerifiedAt was cleared — provider chain WILL be invoked');
  console.log('Expected source: ATTOM Data Solutions (Cosmos cache)\n');

  const result = await enrichmentService.enrichOrder(
    `LOAN-2026-UG0SWAG2-RECHECK-${Date.now()}`,
    '885097ba-35ea-48db-be7a-a0aa7ff451bd',
    {
      street: '395 AHERN STREET',
      city: 'ATLANTIC BEACH',
      state: 'FL',
      zipCode: '32233',
    },
  );

  console.log('enrichOrder result:', JSON.stringify(result, null, 2));

  const client = new CosmosClient({
    endpoint: process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT ?? '',
    aadCredentials: new DefaultAzureCredential(),
  });
  const { resources } = await client.database('appraisal-management')
    .container('property-enrichments').items.query({
      query: 'SELECT c.status, c.createdAt, c.dataResult.source as src FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: result.enrichmentId }],
    }).fetchAll();

  const rec = resources[0];
  console.log(`\nEnrichment record: status=${rec?.status}  source=${rec?.src ?? 'null (cached/miss)'}`);
  if (rec?.src === 'ATTOM Data Solutions (Cosmos cache)') {
    console.log('\n✓ SUCCESS: LocalAttom (Cosmos cache) was used as expected.');
  } else if (rec?.status === 'cached') {
    console.log('\n⚠ CACHED: lastVerifiedAt still set — clear it first with diag-force-reenrich.mjs --force-clear');
  } else {
    console.log(`\n✗ STILL using ${rec?.src ?? 'unknown'} — investigation needed`);
  }
}

main().catch(err => { console.error('FATAL:', (err as Error).message ?? err); process.exit(1); });
