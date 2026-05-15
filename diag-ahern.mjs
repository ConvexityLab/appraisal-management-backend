/**
 * Diagnostic: investigate why 395 AHERN STREET, ATLANTIC BEACH, FL 32233
 * (prop-1778091685808-7lzr2el) is using Bridge Interactive instead of local ATTOM.
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT');

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database('appraisal-management');

const PROPERTY_ID = 'prop-1778091685808-7lzr2el';
const TARGET_STREET = '395 AHERN STREET';
const TARGET_CITY   = 'ATLANTIC BEACH';
const TARGET_STATE  = 'FL';
const TARGET_ZIP    = '32233';

// ── helpers (mirrors local-attom.provider.ts exactly) ────────────────────────
const STREET_SUFFIX_CANONICAL = {
  ALLEY:'ALY',ALLY:'ALY',AVENUE:'AVE',AV:'AVE',
  BOULEVARD:'BLVD',BOULV:'BLVD',CIRCLE:'CIR',CIRC:'CIR',CIRCL:'CIR',
  COURT:'CT',COVE:'CV',CROSSING:'XING',CRSSNG:'XING',
  DRIVE:'DR',DRV:'DR',EXPRESSWAY:'EXPY',EXPWY:'EXPY',
  FREEWAY:'FWY',FRWY:'FWY',HIGHWAY:'HWY',HIGHWY:'HWY',HIWAY:'HWY',HIWY:'HWY',
  LANE:'LN',PARKWAY:'PKWY',PARKWY:'PKWY',PKWAY:'PKWY',PWY:'PKWY',
  PLACE:'PL',ROAD:'RD',SQUARE:'SQ',STREET:'ST',
  TERRACE:'TER',TERR:'TER',TRAIL:'TRL',TRAILS:'TRL',TURNPIKE:'TPKE',TURNPK:'TPKE',
};
const STREET_DIRECTION_CANONICAL = {
  NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',
  NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW',
};
function normalizeStreetForMatch(street) {
  return street.toUpperCase().replace(/[.,#']/g,'').replace(/\s+/g,' ').trim()
    .split(' ').map(w => STREET_SUFFIX_CANONICAL[w] ?? STREET_DIRECTION_CANONICAL[w] ?? w).join(' ');
}
function normalizeCity(city) { return city.trim().toUpperCase(); }
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}
function zip5(zip) {
  return (zip ?? '').replace(/\s/g,'').split('-')[0].padEnd(5,' ').slice(0,5).trim();
}

console.log('═══════════════════════════════════════════════════════════');
console.log('STEP 1: Recent enrichment records for the property');
console.log('═══════════════════════════════════════════════════════════');
const { resources: enrichments } = await db.container('property-enrichments').items.query({
  query: `SELECT c.id, c.orderId, c.status, c.createdAt, c.dataResult.source as providerSource
          FROM c WHERE c.propertyId = @pid ORDER BY c.createdAt DESC`,
  parameters: [{ name: '@pid', value: PROPERTY_ID }]
}).fetchAll();
console.log(`Found ${enrichments.length} enrichment record(s)`);
enrichments.slice(0, 5).forEach((e, i) => {
  console.log(`  [${i}] id=${e.id}`);
  console.log(`       orderId=${e.orderId}`);
  console.log(`       status=${e.status}  source="${e.providerSource ?? '(none)'}"`);
  console.log(`       createdAt=${e.createdAt}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('STEP 2: attom-data candidates for FL/32233');
console.log('═══════════════════════════════════════════════════════════');
const { resources: candidates } = await db.container('attom-data').items.query({
  query: `SELECT c.attomId, c.apnFormatted, c.address, c.sourcedAt
          FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip
          ORDER BY c.sourcedAt DESC`,
  parameters: [
    { name: '@state', value: TARGET_STATE },
    { name: '@zip',   value: zip5(TARGET_ZIP) },
  ]
}).fetchAll();
console.log(`Candidates for ${TARGET_STATE}/${TARGET_ZIP}: ${candidates.length}`);

const inStreet = normalizeStreetForMatch(TARGET_STREET);
const inCity   = normalizeCity(TARGET_CITY);
console.log(`\nTarget normalized street : "${inStreet}"`);
console.log(`Target normalized city   : "${inCity}"`);

let matched = null;
for (const c of candidates) {
  const cs = normalizeStreetForMatch(reconstructStreet(c.address));
  const cc = normalizeCity(c.address.city ?? '');
  if (cs === inStreet && cc === inCity) {
    matched = c;
    break;
  }
}

if (matched) {
  console.log(`\n✓ MATCH FOUND: attomId=${matched.attomId}`);
  console.log(`  address: ${JSON.stringify(matched.address)}`);
} else {
  console.log(`\n✗ NO MATCH — examining all ${candidates.length} candidates:`);
  candidates.forEach((c, i) => {
    const cs = normalizeStreetForMatch(reconstructStreet(c.address));
    const cc = normalizeCity(c.address.city ?? '');
    const streetMatch = cs === inStreet;
    const cityMatch   = cc === inCity;
    console.log(`  [${i}] attomId=${c.attomId}`);
    console.log(`       raw addr : ${JSON.stringify(c.address)}`);
    console.log(`       norm str : "${cs}" ${streetMatch ? '✓' : `✗ (expected "${inStreet}")`}`);
    console.log(`       norm city: "${cc}" ${cityMatch   ? '✓' : `✗ (expected "${inCity}")`}`);
  });
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('STEP 3: Broad search — any doc with AHERN in address');
console.log('═══════════════════════════════════════════════════════════');
// Query by attomId if we have it, or broad search
const { resources: ahernDocs } = await db.container('attom-data').items.query({
  query: `SELECT c.attomId, c.apnFormatted, c.address, c.geohash5
          FROM c WHERE c.type = 'attom-data' AND CONTAINS(c.address.full, 'AHERN')`,
}).fetchAll();
console.log(`Docs with AHERN in address.full: ${ahernDocs.length}`);
ahernDocs.forEach((d, i) => {
  console.log(`  [${i}] attomId=${d.attomId} geohash5=${d.geohash5}`);
  console.log(`       ${JSON.stringify(d.address)}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('STEP 4: PropertyRecord for this property (check lastVerifiedSource)');
console.log('═══════════════════════════════════════════════════════════');
const { resources: propRecs } = await db.container('property-records').items.query({
  query: `SELECT c.id, c.lastVerifiedAt, c.lastVerifiedSource, c.dataSource, c.address
          FROM c WHERE c.id = @id`,
  parameters: [{ name: '@id', value: PROPERTY_ID }]
}).fetchAll();
console.log(`PropertyRecord(s): ${propRecs.length}`);
propRecs.forEach((r, i) => {
  console.log(`  [${i}] lastVerifiedAt=${r.lastVerifiedAt}  lastVerifiedSource="${r.lastVerifiedSource}"`);
  console.log(`       dataSource=${r.dataSource}`);
  console.log(`       address=${JSON.stringify(r.address)}`);
});
