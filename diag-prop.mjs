/**
 * Diagnostic: trace enrichment result for a specific property record.
 * Usage: node diag-prop.mjs <propertyId>
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const propertyId = process.argv[2];
if (!propertyId) {
  console.error('Usage: node diag-prop.mjs <propertyId>');
  process.exit(1);
}

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = 'appraisal-management';

// 1. Property record — version history tells us what createVersion actually wrote
const tenantId = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const { resource: prop } = await client
  .database(db).container('property-records')
  .item(propertyId, tenantId).read();

console.log('\n=== PROPERTY RECORD ===');
if (!prop) {
  console.log('  NOT FOUND');
} else {
  console.log(JSON.stringify({
    id: prop.id,
    recordVersion: prop.recordVersion,
    building: prop.building,
    dataSource: prop.dataSource,
    lastVerifiedAt: prop.lastVerifiedAt,
    versionHistory: prop.versionHistory?.map(v => ({
      version: v.version,
      reason: v.reason,
      source: v.source,
      changedFields: v.changedFields,
      previousValues: v.previousValues,
    })),
  }, null, 2));
}

// 2. Enrichment record — shows what the provider actually returned in core
const { resources: enrichments } = await client
  .database(db).container('property-enrichments')
  .items.query(
    {
      query: 'SELECT c.id, c.orderId, c.status, c.dataResult.source, c.dataResult.core, c.createdAt FROM c WHERE c.propertyId = @propertyId AND c.tenantId = @tenantId',
      parameters: [
        { name: '@propertyId', value: propertyId },
        { name: '@tenantId', value: tenantId },
      ],
    },
    { enableCrossPartitionQuery: true },
  ).fetchAll();

console.log('\n=== ENRICHMENT RECORDS ===');
for (const e of enrichments) {
  console.log(JSON.stringify(e, null, 2));
}
if (enrichments.length === 0) console.log('  (none found)');

// 3. Test the EXACT query LocalAttomPropertyDataProvider runs (no enableCrossPartitionQuery flag)
const attomQuery = "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC";
const attomParams = [{ name: '@state', value: 'FL' }, { name: '@zip', value: '32256' }];

// 3a. Without enableCrossPartitionQuery (mirrors queryDocuments)
const { resources: withoutFlag } = await client
  .database(db).container('attom-data')
  .items.query({ query: attomQuery, parameters: attomParams })
  .fetchAll().catch(e => { console.error('WITHOUT flag ERROR:', e.message); return { resources: [] }; });

console.log(`\n=== ATTOM query WITHOUT enableCrossPartitionQuery: ${withoutFlag.length} results ===`);

// 3b. With enableCrossPartitionQuery (mirrors diag script)
const { resources: withFlag } = await client
  .database(db).container('attom-data')
  .items.query({ query: attomQuery, parameters: attomParams }, { enableCrossPartitionQuery: true })
  .fetchAll().catch(e => { console.error('WITH flag ERROR:', e.message); return { resources: [] }; });

console.log(`\n=== ATTOM query WITH enableCrossPartitionQuery: ${withFlag.length} results ===`);
if (withFlag[0]) {
  console.log('First result type:', withFlag[0].type, '| attomId:', withFlag[0].attomId);
}

// 3c. Also check what the document type field is
const { resources: attomCandidates } = await client
  .database(db).container('attom-data')
  .items.query(
    {
      query: "SELECT c.attomId, c.type, c.address, c.propertyDetail.livingAreaSqft, c.propertyDetail.yearBuilt, c.propertyDetail.bedroomsTotal, c.propertyDetail.bathroomsFull, c.propertyDetail.bathroomsHalf FROM c WHERE c.address.state = 'FL' AND c.address.zip = '32256'",
      parameters: [],
    },
    { enableCrossPartitionQuery: true },
  ).fetchAll();

const attomMatch = attomCandidates.filter(r =>
  (r.address?.houseNumber ?? '') === '8703' ||
  reconstructStreet(r.address ?? {}).toUpperCase().includes('8703')
);

function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}

console.log('\n=== ATTOM-DATA CANDIDATES for house 8703, zip 32256, FL ===');
for (const r of attomMatch) {
  console.log(JSON.stringify({
    attomId: r.attomId,
    address: r.address,
    livingAreaSqft: r.livingAreaSqft,
    yearBuilt: r.yearBuilt,
    bedroomsTotal: r.bedroomsTotal,
    bathroomsFull: r.bathroomsFull,
    bathroomsHalf: r.bathroomsHalf,
  }, null, 2));
}
if (attomMatch.length === 0) console.log('  (no attom-data records found for 8703 in zip 32256)');
