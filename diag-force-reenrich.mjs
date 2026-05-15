/**
 * End-to-end: run LocalAttomPropertyDataProvider live against production Cosmos,
 * then force re-enrichment by clearing lastVerifiedAt on the PropertyRecord.
 *
 * Usage:
 *   AZURE_COSMOS_ENDPOINT=... node diag-force-reenrich.mjs
 *   Add --force-clear to clear lastVerifiedAt and allow re-enrichment.
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const FORCE_CLEAR = process.argv.includes('--force-clear');

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('AZURE_COSMOS_ENDPOINT must be set');

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database('appraisal-management');

const PROP_ID = 'prop-1778095282668-6fldurh';
const TENANT_ID = 'onelend';  // adjust if different

// ── Step 1: Live LocalAttom match simulation ──────────────────────────────────

function normalizeApn(apn) { return apn.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function normalizeCity(city) { return city.trim().toUpperCase(); }
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}

const STREET_SUFFIX_CANONICAL = {
  ALLEY:'ALY',ALLY:'ALY',AVENUE:'AVE',AV:'AVE',BOULEVARD:'BLVD',BOULV:'BLVD',
  CIRCLE:'CIR',CIRC:'CIR',CIRCL:'CIR',COURT:'CT',COVE:'CV',CROSSING:'XING',CRSSNG:'XING',
  DRIVE:'DR',DRV:'DR',EXPRESSWAY:'EXPY',EXPWY:'EXPY',FREEWAY:'FWY',FRWY:'FWY',
  HIGHWAY:'HWY',HIGHWY:'HWY',HIWAY:'HWY',HIWY:'HWY',LANE:'LN',
  PARKWAY:'PKWY',PARKWY:'PKWY',PKWAY:'PKWY',PWY:'PKWY',PLACE:'PL',
  ROAD:'RD',SQUARE:'SQ',STREET:'ST',TERRACE:'TER',TERR:'TER',
  TRAIL:'TRL',TRAILS:'TRL',TURNPIKE:'TPKE',TURNPK:'TPKE',
};
const STREET_DIRECTION_CANONICAL = {
  NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW',
};
function normalizeStreetForMatch(street) {
  return street.toUpperCase().replace(/[.,#']/g, '').replace(/\s+/g, ' ').trim()
    .split(' ')
    .map(w => STREET_SUFFIX_CANONICAL[w] ?? STREET_DIRECTION_CANONICAL[w] ?? w)
    .join(' ');
}

console.log('=== Simulating LocalAttomPropertyDataProvider.lookupByAddress ===');
console.log('Params: street="395 AHERN STREET" city="ATLANTIC BEACH" state="FL" zip="32233"');

const t0 = Date.now();
const { resources: candidates } = await db.container('attom-data').items.query({
  query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = 'FL' AND c.address.zip = '32233'",
  parameters: []
}).fetchAll();
console.log(`\nQuery returned ${candidates.length} candidates in ${Date.now()-t0}ms`);

const inStreet = normalizeStreetForMatch('395 AHERN STREET');
const inCity = normalizeCity('ATLANTIC BEACH');
console.log(`Input normalized: street="${inStreet}" city="${inCity}"`);

let matched = null;
for (const c of candidates) {
  const cs = normalizeStreetForMatch(reconstructStreet(c.address));
  const cc = normalizeCity(c.address.city ?? '');
  if (cs === inStreet && cc === inCity) { matched = c; break; }
}

if (matched) {
  console.log(`\n✓ LocalAttom WOULD MATCH with current code: attomId=${matched.attomId} apn=${matched.apnFormatted}`);
  console.log(`  Reconstructed: "${reconstructStreet(matched.address)}" → normalized: "${normalizeStreetForMatch(reconstructStreet(matched.address))}"`);
} else {
  console.log('\n✗ LocalAttom would STILL miss — match logic has another bug');
  // Print a few candidates for inspection
  candidates.slice(0, 5).forEach((c, i) => {
    const cs = normalizeStreetForMatch(reconstructStreet(c.address));
    const cc = normalizeCity(c.address.city ?? '');
    console.log(`  candidate[${i}]: normalized="${cs}" city="${cc}"`);
  });
}

// ── Step 2: Show current cache state ─────────────────────────────────────────
const { resources: propRecs } = await db.container('property-records').items.query({
  query: 'SELECT c.id, c.tenantId, c.lastVerifiedAt, c.lastVerifiedSource FROM c WHERE c.id = @id',
  parameters: [{ name: '@id', value: PROP_ID }]
}).fetchAll();

const pr = propRecs[0];
if (!pr) { console.log('\nPropertyRecord not found!'); process.exit(1); }

console.log('\n=== PropertyRecord cache state ===');
console.log('lastVerifiedAt:', pr.lastVerifiedAt ?? '(none)');
console.log('lastVerifiedSource:', pr.lastVerifiedSource ?? '(none)');
if (pr.lastVerifiedAt) {
  const ageDays = (Date.now() - new Date(pr.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
  console.log(`Age: ${ageDays.toFixed(3)} days  → Cache TTL=30 → ${ageDays < 30 ? '⚠ CACHED — provider will NOT be called on next enrichment' : 'stale, provider will be called'}`);
}

// ── Step 3: Optionally clear lastVerifiedAt to allow re-enrichment ────────────
if (FORCE_CLEAR) {
  if (!pr.tenantId) {
    console.log('\nERROR: tenantId not on record, cannot patch');
    process.exit(1);
  }
  console.log('\n=== Clearing lastVerifiedAt to force re-enrichment ===');

  // Read the full record first (point-read by id + partition key)
  const { resource: fullRecord } = await db.container('property-records').item(PROP_ID, pr.tenantId).read();
  if (!fullRecord) { console.log('Full record read failed'); process.exit(1); }

  const patched = { ...fullRecord };
  delete patched.lastVerifiedAt;
  delete patched.lastVerifiedSource;

  const { resource: updated } = await db.container('property-records').item(PROP_ID, pr.tenantId).replace(patched);
  if (updated) {
    console.log('✓ lastVerifiedAt cleared. Next enrichment call will invoke the provider chain.');
    console.log('  LocalAttom will now be tried first and SHOULD match with the fixed normalizeStreetForMatch.');
  } else {
    console.log('Replace returned no resource — check Cosmos logs');
  }
} else {
  console.log('\nRun with --force-clear to clear lastVerifiedAt and allow re-enrichment from LocalAttom.');
}
