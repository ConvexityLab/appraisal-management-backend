/**
 * Directly invoke PropertyEnrichmentService against production Cosmos
 * using the address of prop-1778095282668-6fldurh to verify LocalAttom is used.
 *
 * Uses the loan ID as the orderId (same as enrichEngagement does).
 */
import { CosmosDbService } from './src/services/cosmos-db.service.js';
import { PropertyRecordService } from './src/services/property-record.service.js';
import { PropertyEnrichmentService } from './src/services/property-enrichment.service.js';
// No-op geocoder — property already has coords, no geocoding needed for this test
const noopGeocoder = { geocode: async () => null };

const db = new CosmosDbService();
await db.initialize();

const propertyRecordService = new PropertyRecordService(db);
const enrichmentService = new PropertyEnrichmentService(
  db,
  propertyRecordService,
  undefined,  // use factory (LocalAttom + Bridge + Attom per env)
  noopGeocoder,
);

console.log('Re-enriching: 395 AHERN STREET, ATLANTIC BEACH FL 32233');
console.log('orderId (loan): LOAN-2026-UG0SWAG2 | tenantId: 885097ba-35ea-48db-be7a-a0aa7ff451bd');
console.log('(lastVerifiedAt was cleared — provider chain WILL be called)\n');

const result = await enrichmentService.enrichOrder(
  'LOAN-2026-UG0SWAG2-RECHECK',
  '885097ba-35ea-48db-be7a-a0aa7ff451bd',
  {
    street: '395 AHERN STREET',
    city: 'ATLANTIC BEACH',
    state: 'FL',
    zipCode: '32233',
  },
);

console.log('Result:', JSON.stringify(result, null, 2));
