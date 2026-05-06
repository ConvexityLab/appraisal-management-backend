/**
 * Diagnostic: verify the cross-partition query behavior through queryDocuments
 * by replicating the exact CosmosDbService.queryDocuments() code path.
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
const credential = new DefaultAzureCredential();

// Replicate exactly how CosmosDbService initializes the client in production
const clientOptions = {
  endpoint,
  aadCredentials: credential,
  connectionPolicy: {
    requestTimeout: 30000,
    enableEndpointDiscovery: true,
    preferredLocations: ['East US', 'West US', 'Central US'],
  },
};
const client = new CosmosClient(clientOptions);
const db = client.database('appraisal-management');

// Replicate getContainer() exactly
function getContainer(containerName) {
  return db.container(containerName);
}

// Replicate queryDocuments() exactly (no FeedOptions passed)
async function queryDocuments(containerName, query, parameters) {
  const container = getContainer(containerName);
  const querySpec = { query, parameters: parameters || [] };
  console.log(`  Executing query on ${containerName}`);
  const { resources } = await container.items.query(querySpec).fetchAll();
  console.log(`  Query returned ${resources.length} results`);
  return resources;
}

// Now run the EXACT query LocalAttomPropertyDataProvider runs
console.log('=== Simulating exact LocalAttomPropertyDataProvider.lookupByAddress ===');
console.log('Address: 395 AHERN STREET, ATLANTIC BEACH, FL 32233');

const state = 'FL';
const zip = '32233';

const t0 = Date.now();
let candidates;
try {
  candidates = await queryDocuments(
    'attom-data',
    "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
    [
      { name: '@state', value: state },
      { name: '@zip', value: zip },
    ],
  );
  console.log(`Query completed in ${Date.now() - t0}ms`);
  console.log(`rawData field presence check on first doc: ${candidates[0]?.rawData ? 'HAS rawData (' + Object.keys(candidates[0].rawData).length + ' fields)' : 'NO rawData'}`);
  
  // Check total data size
  const dataSize = JSON.stringify(candidates).length;
  console.log(`Total result data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  console.error(`Query FAILED:`, err.message, 'code:', err.code, 'statusCode:', err.statusCode);
  process.exit(1);
}

// Simulate the address matching
const STREET_SUFFIX_CANONICAL = {
  ALLEY:'ALY',ALLY:'ALY',AVENUE:'AVE',AV:'AVE',BOULEVARD:'BLVD',BOULV:'BLVD',
  CIRCLE:'CIR',CIRC:'CIR',CIRCL:'CIR',COURT:'CT',COVE:'CV',CROSSING:'XING',CRSSNG:'XING',
  DRIVE:'DR',DRV:'DR',EXPRESSWAY:'EXPY',EXPWY:'EXPY',FREEWAY:'FWY',FRWY:'FWY',
  HIGHWAY:'HWY',HIGHWY:'HWY',HIWAY:'HWY',HIWY:'HWY',LANE:'LN',PARKWAY:'PKWY',PARKWY:'PKWY',
  PKWAY:'PKWY',PWY:'PKWY',PLACE:'PL',ROAD:'RD',SQUARE:'SQ',STREET:'ST',
  TERRACE:'TER',TERR:'TER',TRAIL:'TRL',TRAILS:'TRL',TURNPIKE:'TPKE',TURNPK:'TPKE',
};
const STREET_DIRECTION_CANONICAL = {NORTH:'N',SOUTH:'S',EAST:'E',WEST:'W',NORTHEAST:'NE',NORTHWEST:'NW',SOUTHEAST:'SE',SOUTHWEST:'SW'};
function normalizeStreetForMatch(street) {
  return street.toUpperCase().replace(/[.,#']/g,'').replace(/\s+/g,' ').trim()
    .split(' ').map(w => STREET_SUFFIX_CANONICAL[w] ?? STREET_DIRECTION_CANONICAL[w] ?? w).join(' ');
}
function normalizeCity(city) { return city.trim().toUpperCase(); }
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}

const inStreet = normalizeStreetForMatch('395 AHERN STREET');
const inCity = normalizeCity('ATLANTIC BEACH');
console.log(`\nInput normalized: street="${inStreet}" city="${inCity}"`);

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
  console.log(`✓ MATCH via queryDocuments code path: attomId=${matched.attomId}`);
} else {
  console.log('✗ NO MATCH via queryDocuments code path');
}

// Check if the issue might be with how the enrichment was actually triggered
// by looking at any other enrichment records in the DB
console.log('\n=== All enrichment records for prop-1778091685808-7lzr2el ===');
const { resources: allEnrichments } = await db.container('property-enrichments').items.query({
  query: "SELECT c.id, c.orderId, c.status, c.createdAt, c.dataResult.source as src FROM c WHERE c.propertyId = 'prop-1778091685808-7lzr2el'",
}).fetchAll();
allEnrichments.forEach((e, i) => {
  console.log(`  [${i}] ${e.createdAt} orderId=${e.orderId} status=${e.status} src="${e.src}"`);
});

// Check the actual engagement record to understand the order chain
console.log('\n=== Any orders for this property (cross-reference by address) ===');
const { resources: orders } = await db.container('orders').items.query({
  query: "SELECT c.id, c.type, c.status, c.createdAt, c.propertyAddress FROM c WHERE CONTAINS(c.propertyAddress.streetAddress, 'AHERN') ORDER BY c.createdAt DESC",
}).fetchAll();
console.log(`Orders with AHERN in address: ${orders.length}`);
orders.slice(0,5).forEach((o, i) => {
  console.log(`  [${i}] id=${o.id} type=${o.type} status=${o.status}`);
  console.log(`       createdAt=${o.createdAt}`);
  console.log(`       addr=${JSON.stringify(o.propertyAddress)}`);
});
