import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT');
const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = 'appraisal-management';

// --- Replicate EXACT Local ATTOM query (including ORDER BY c.sourcedAt) ---
const state = 'FL';
const zip = '32233';

console.log(`\nTest 1: EXACT Local ATTOM query (with ORDER BY c.sourcedAt DESC)`);
try {
  const { resources: r1 } = await client.database(db).container('attom-data')
    .items.query({
      query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
      parameters: [{ name: '@state', value: state }, { name: '@zip', value: zip }],
    }).fetchAll();
  console.log(`  Results: ${r1.length}`);
  if (r1.length > 0) {
    const hit = r1.find(r => r.address?.houseNumber === '1949');
    console.log(`  House 1949 found: ${hit ? 'YES' : 'NO'}`);
    if (hit) console.log('  ', JSON.stringify({ attomId: hit.attomId, address: hit.address, sourcedAt: hit.sourcedAt }, null, 2));
  }
} catch (err) {
  console.error(`  ERROR: ${err.code} — ${err.message}`);
}

console.log(`\nTest 2: Same query WITHOUT ORDER BY (to isolate if ORDER BY is the issue)`);
try {
  const { resources: r2 } = await client.database(db).container('attom-data')
    .items.query({
      query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip",
      parameters: [{ name: '@state', value: state }, { name: '@zip', value: zip }],
    }).fetchAll();
  console.log(`  Results: ${r2.length}`);
  const hit2 = r2.find(r => r.address?.houseNumber === '1949');
  console.log(`  House 1949 found: ${hit2 ? 'YES' : 'NO'}`);
} catch (err) {
  console.error(`  ERROR: ${err.code} — ${err.message}`);
}

console.log(`\nTest 3: Normalization check`);
function normalizeStreetForMatch(street) {
  const SUFFIX = { ALLEY:'ALY',ALLY:'ALY',AVENUE:'AVE',AV:'AVE',BOULEVARD:'BLVD',BOULV:'BLVD',CIRCLE:'CIR',COURT:'CT',COVE:'CV',CROSSING:'XING',DRIVE:'DR',DRV:'DR',EXPRESSWAY:'EXPY',FREEWAY:'FWY',HIGHWAY:'HWY',LANE:'LN',PARKWAY:'PKWY',PLACE:'PL',ROAD:'RD',SQUARE:'SQ',STREET:'ST',TERRACE:'TER',TRAIL:'TRL',TURNPIKE:'TPKE' };
  const DIR = { NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW' };
  return street.toUpperCase().replace(/[.,#']/g,'').replace(/\s+/g,' ').trim()
    .split(' ').map(w => SUFFIX[w] ?? DIR[w] ?? w).join(' ');
}
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}
const orderStreet = '1949 Sevilla Boulevard West';
const attomAddr = { houseNumber: '1949', streetDirection: '', streetName: 'SEVILLA', streetSuffix: 'BLVD', streetPostDirection: 'W' };
const inStreet = normalizeStreetForMatch(orderStreet);
const candStreet = normalizeStreetForMatch(reconstructStreet(attomAddr));
console.log(`  Order normalized:  "${inStreet}"`);
console.log(`  ATTOM normalized:  "${candStreet}"`);
console.log(`  Match: ${inStreet === candStreet ? 'YES ✓' : 'NO ✗'}`);
