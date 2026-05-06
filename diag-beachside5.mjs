/**
 * Diagnostic: check current state of property record prop-1778086971512-3rjsphm
 * and simulate LocalAttom lookup using the stored address.street
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const PROPERTY_ID = 'prop-1778086971512-3rjsphm';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// 1) Read the property record
const { resource: rec } = await db.container('property-records').item(PROPERTY_ID, TENANT).read();
console.log('=== Property Record ===');
console.log('address.street      :', rec.address.street);
console.log('address.city        :', rec.address.city);
console.log('address.state       :', rec.address.state);
console.log('address.zip         :', rec.address.zip);
console.log('lastVerifiedAt      :', rec.lastVerifiedAt ?? '(none — cache cleared ✓)');
console.log('lastVerifiedSource  :', rec.lastVerifiedSource ?? '(none)');
console.log('building            :', JSON.stringify(rec.building));

// 2) Replicate normalizeStreetForMatch exactly as in current code
const STREET_SUFFIX_CANONICAL = {
  ALLEY:'ALY', ALLY:'ALY',
  AVENUE:'AVE', AV:'AVE',
  BOULEVARD:'BLVD', BOULV:'BLVD',
  CIRCLE:'CIR', CIRC:'CIR', CIRCL:'CIR',
  COURT:'CT',
  COVE:'CV',
  CROSSING:'XING', CRSSNG:'XING',
  DRIVE:'DR', DRV:'DR',
  EXPRESSWAY:'EXPY',
  FREEWAY:'FWY',
  HIGHWAY:'HWY',
  LANE:'LN',
  PARKWAY:'PKWY',
  PLACE:'PL',
  ROAD:'RD',
  SQUARE:'SQ',
  STREET:'ST',
  TERRACE:'TER',
  TRAIL:'TRL',
  TURNPIKE:'TPKE',
};
const STREET_DIRECTION_CANONICAL = {
  NORTH:'N', SOUTH:'S', EAST:'E', WEST:'W',
  NORTHEAST:'NE', NORTHWEST:'NW', SOUTHEAST:'SE', SOUTHWEST:'SW',
};
function normalizeStreetForMatch(street) {
  return street.toUpperCase().replace(/[.,#']/g,'').replace(/\s+/g,' ').trim()
    .split(' ').map(w => STREET_SUFFIX_CANONICAL[w] ?? STREET_DIRECTION_CANONICAL[w] ?? w).join(' ');
}
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}

const storedStreet = rec.address.street;
const normalizedInput = normalizeStreetForMatch(storedStreet);
console.log('\n=== Normalization ===');
console.log('stored street       :', storedStreet);
console.log('normalized input    :', normalizedInput);

// 3) Simulate the exact LocalAttom query
const state = rec.address.state;
const zip = rec.address.zip;
console.log('\n=== LocalAttom Lookup ===');
console.log(`Querying attom-data for state=${state}, zip=${zip}...`);

const { resources: candidates } = await db.container('attom-data').items.query({
  query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
  parameters: [{ name: '@state', value: state }, { name: '@zip', value: zip }],
}).fetchAll();

console.log(`Found ${candidates.length} candidates`);

const inCity = rec.address.city?.trim().toUpperCase();
let matched = null;
for (const c of candidates) {
  const candStreet = normalizeStreetForMatch(reconstructStreet(c.address));
  const candCity = (c.address.city ?? '').trim().toUpperCase();
  if (candStreet === normalizedInput && candCity === inCity) {
    matched = c;
    break;
  }
}

if (matched) {
  console.log('\n✓ MATCH FOUND');
  console.log('attomId             :', matched.attomId);
  console.log('stored as           :', reconstructStreet(matched.address));
  console.log('normalized to       :', normalizeStreetForMatch(reconstructStreet(matched.address)));
  console.log('propertyDetail      :', JSON.stringify(matched.propertyDetail, null, 2));
} else {
  console.log('\n✗ NO MATCH — LocalAttom would fall through to Bridge');
  // Show closest candidates
  const beachside = candidates.filter(c => reconstructStreet(c.address).toUpperCase().includes('BEACHSIDE'));
  if (beachside.length > 0) {
    console.log('BEACHSIDE candidates:');
    for (const c of beachside) {
      const cs = normalizeStreetForMatch(reconstructStreet(c.address));
      const cc = (c.address.city ?? '').trim().toUpperCase();
      console.log(`  raw="${reconstructStreet(c.address)}" → normalized="${cs}" city="${cc}"`);
      console.log(`  input normalized="${normalizedInput}" city="${inCity}"`);
      console.log(`  match: street=${cs === normalizedInput}, city=${cc === inCity}`);
    }
  }
}
