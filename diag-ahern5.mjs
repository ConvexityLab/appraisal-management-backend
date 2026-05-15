/**
 * Diagnostic: check cache state, enrichment history, and ATTOM presence
 * for prop-1778095282668-6fldurh (395 AHERN STREET, ATLANTIC BEACH FL 32233)
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT must be set');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const propId = 'prop-1778095282668-6fldurh';

// ── 1. PropertyRecord cache status ────────────────────────────────────────────
const { resources: propRecs } = await db.container('property-records').items.query({
  query: 'SELECT c.id, c.address, c.lastVerifiedAt, c.lastVerifiedSource, c.dataSource FROM c WHERE c.id = @id',
  parameters: [{ name: '@id', value: propId }]
}).fetchAll();

console.log('=== PropertyRecord ===');
if (propRecs.length === 0) {
  console.log('NOT FOUND in property-records container');
} else {
  const r = propRecs[0];
  console.log('id:', r.id);
  console.log('lastVerifiedAt:', r.lastVerifiedAt ?? '(none)');
  console.log('lastVerifiedSource:', r.lastVerifiedSource ?? '(none)');
  console.log('dataSource:', r.dataSource ?? '(none)');
  if (r.lastVerifiedAt) {
    const ageDays = (Date.now() - new Date(r.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    console.log('age (days):', ageDays.toFixed(2), '  CACHE_TTL_DAYS default=30 →', ageDays < 30 ? 'WOULD BE CACHED (skips provider)' : 'stale, provider would be called');
  } else {
    console.log('No lastVerifiedAt → cache check returns false → provider WILL be called');
  }
}

// ── 2. All enrichment records for this property ───────────────────────────────
const { resources: enrichments } = await db.container('property-enrichments').items.query({
  query: 'SELECT c.id, c.orderId, c.status, c.createdAt, c.dataResult.source as src FROM c WHERE c.propertyId = @pid ORDER BY c.createdAt DESC',
  parameters: [{ name: '@pid', value: propId }]
}).fetchAll();

console.log('\n=== Enrichment Records (newest first) ===');
if (enrichments.length === 0) {
  console.log('NONE');
} else {
  enrichments.forEach((e, i) => {
    console.log(`[${i}] ${e.createdAt}  status=${e.status}  src=${e.src ?? 'null'}  orderId=${e.orderId}`);
  });
}

// ── 3. Does ATTOM have 395 AHERN in FL/32233? ─────────────────────────────────
const { resources: attomCandidates } = await db.container('attom-data').items.query({
  query: "SELECT c.attomId, c.apnFormatted, c.address FROM c WHERE c.type = 'attom-data' AND c.address.state = 'FL' AND c.address.zip = '32233' AND c.address.houseNumber = '395'",
  parameters: []
}).fetchAll();

console.log('\n=== ATTOM candidates for houseNumber=395 FL 32233 ===');
if (attomCandidates.length === 0) {
  console.log('NO RECORDS — property is NOT in the attom-data container for this zip');
} else {
  attomCandidates.forEach((c, i) => {
    const a = c.address;
    console.log(`[${i}] attomId=${c.attomId} apn=${c.apnFormatted}`);
    console.log(`     reconstructed: "${[a.houseNumber, a.streetDirection, a.streetName, a.streetSuffix, a.streetPostDirection].filter(Boolean).join(' ')}" city=${a.city}`);
  });
}
