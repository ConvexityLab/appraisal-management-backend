/**
 * Diagnostic: simulate exactly what LocalAttomPropertyDataProvider does
 * using the real CosmosDbService (same code path as the server).
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT');

// ---- replicate CosmosDbService internals ----
const credential = new DefaultAzureCredential();
const client = new CosmosClient({
  endpoint,
  aadCredentials: credential,
  connectionPolicy: {
    requestTimeout: 30000,
    enableEndpointDiscovery: true,
    preferredLocations: ['East US'],
  },
});
const db = client.database('appraisal-management');
// NOTE: we do NOT store individual container refs — just like getContainer() works

function getContainer(name) {
  if (!db) throw new Error('Database not initialized');
  return db.container(name);
}

async function queryDocuments(containerName, query, parameters) {
  const container = getContainer(containerName);
  const querySpec = { query, parameters: parameters || [] };
  console.log(`  Executing query on ${containerName}`);
  const { resources } = await container.items.query(querySpec).fetchAll();
  console.log(`  Query returned ${resources.length} results`);
  return resources;
}

// ---- replicate normalizeStreetForMatch ----
const STREET_SUFFIX_CANONICAL = {
  ALLEY:'ALY',ALLY:'ALY',AVENUE:'AVE',AV:'AVE',
  BOULEVARD:'BLVD',BOULV:'BLVD',
  CIRCLE:'CIR',COURT:'CT',COVE:'CV',CROSSING:'XING',
  DRIVE:'DR',DRV:'DR',EXPRESSWAY:'EXPY',FREEWAY:'FWY',
  HIGHWAY:'HWY',LANE:'LN',PARKWAY:'PKWY',PLACE:'PL',
  ROAD:'RD',SQUARE:'SQ',STREET:'ST',TERRACE:'TER',
  TRAIL:'TRL',TURNPIKE:'TPKE',
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

// ---- simulate lookupByAddress exactly ----
async function lookupByAddress(params) {
  const state = (params.state ?? '').trim().toUpperCase();
  const zip = zip5(params.zipCode ?? '');

  if (!state || !zip) {
    console.log('Skipping — state/zip required');
    return null;
  }

  console.log(`\nlookupByAddress: ${params.street}, ${params.city}, ${state} ${zip}`);

  const candidates = await queryDocuments(
    'attom-data',
    "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
    [{ name: '@state', value: state }, { name: '@zip', value: zip }],
  );

  if (candidates.length === 0) {
    console.log('  No candidates for state/zip');
    return null;
  }

  // Address match
  const inStreet = normalizeStreetForMatch(params.street ?? '');
  const inCity = normalizeCity(params.city ?? '');
  console.log(`  Normalized input street: "${inStreet}", city: "${inCity}"`);

  for (const candidate of candidates) {
    const candStreet = normalizeStreetForMatch(reconstructStreet(candidate.address));
    const candCity = normalizeCity(candidate.address.city ?? '');

    if (candStreet === inStreet && candCity === inCity) {
      console.log(`  MATCHED: attomId=${candidate.attomId}`);
      console.log(`  PropertyDetail: ${JSON.stringify(candidate.propertyDetail)}`);
      return { source: 'ATTOM Data Solutions (Cosmos cache)', attomId: candidate.attomId };
    }
  }

  console.log(`  No match found among ${candidates.length} candidates.`);
  // Show first 3 candidates for debugging
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    const c = candidates[i];
    const cs = normalizeStreetForMatch(reconstructStreet(c.address));
    const cc = normalizeCity(c.address.city ?? '');
    console.log(`    Candidate[${i}]: street="${cs}" city="${cc}" raw="${JSON.stringify(c.address)}"`);
  }
  return null;
}

// Run the exact same lookup the server would do
const result = await lookupByAddress({
  street: '1949 Sevilla Boulevard West',
  city: 'Atlantic Beach',
  state: 'FL',
  zipCode: '32233',
});

console.log(`\nFinal result: ${result ? JSON.stringify(result) : 'null (no match)'}`);
