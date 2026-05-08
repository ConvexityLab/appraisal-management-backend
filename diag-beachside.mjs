/**
 * Diagnostic: investigate why 1855 Beachside Court is enriched by Bridge
 * instead of Local ATTOM.
 *
 * Checks:
 *  1. Property record state (lastVerifiedAt, building data)
 *  2. attom-data candidates for FL 32233 — any BEACHSIDE entry?
 *  3. Simulates the exact normalizeStreetForMatch comparison
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const PROPERTY_ID = 'prop-1778086971512-3rjsphm';
const TARGET_STREET = '1855 Beachside Court';
const TARGET_CITY = 'Atlantic Beach';
const TARGET_STATE = 'FL';
const TARGET_ZIP = '32233';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// ── normalizeStreetForMatch (mirrors src/services/property-record.service.ts) ──
const STREET_SUFFIX_CANONICAL = {
  ALLEY: 'ALY', ALLY: 'ALY',
  AVENUE: 'AVE', AV: 'AVE',
  BOULEVARD: 'BLVD', BOULV: 'BLVD',
  CIRCLE: 'CIR', CIRC: 'CIR', CIRCL: 'CIR',
  COURT: 'CT',
  COVE: 'CV',
  CROSSING: 'XING', CRSSNG: 'XING',
  DRIVE: 'DR', DRV: 'DR',
  EXPRESSWAY: 'EXPY', EXPWY: 'EXPY',
  FREEWAY: 'FWY', FRWY: 'FWY',
  HIGHWAY: 'HWY', HIGHWY: 'HWY', HIWAY: 'HWY', HIWY: 'HWY',
  LANE: 'LN',
  PARKWAY: 'PKWY', PARKWY: 'PKWY', PKWAY: 'PKWY', PWY: 'PKWY',
  PLACE: 'PL',
  ROAD: 'RD',
  SQUARE: 'SQ',
  STREET: 'ST',
  TERRACE: 'TER', TERR: 'TER',
  TRAIL: 'TRL', TRAILS: 'TRL',
  TURNPIKE: 'TPKE', TURNPK: 'TPKE',
};
const STREET_DIRECTION_CANONICAL = {
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW',
};
function normalizeStreet(s) {
  return s.toUpperCase().replace(/[.,#']/g, '').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => STREET_SUFFIX_CANONICAL[w] ?? STREET_DIRECTION_CANONICAL[w] ?? w).join(' ');
}
function reconstructStreet(addr) {
  return [addr.houseNumber, addr.streetDirection, addr.streetName, addr.streetSuffix, addr.streetPostDirection]
    .map(p => (p ?? '').trim()).filter(p => p.length > 0).join(' ');
}

console.log('\n══ 1. PROPERTY RECORD ════════════════════════════════════════════');
const propContainer = db.container('property-records');
try {
  const { resource: propRecord } = await propContainer.item(PROPERTY_ID, TENANT).read();
  if (!propRecord) {
    console.log('ERROR: Property record not found!');
  } else {
    console.log('id:', propRecord.id);
    console.log('address:', JSON.stringify(propRecord.address));
    console.log('building:', JSON.stringify(propRecord.building));
    console.log('lastVerifiedAt:', propRecord.lastVerifiedAt ?? '(none)');
    console.log('lastVerifiedSource:', propRecord.lastVerifiedSource ?? '(none)');
    console.log('dataSource:', propRecord.dataSource);
    console.log('recordVersion:', propRecord.recordVersion);
    console.log('versionHistory entries:', propRecord.versionHistory?.length ?? 0);
    if (propRecord.versionHistory?.length > 0) {
      const last = propRecord.versionHistory[propRecord.versionHistory.length - 1];
      console.log('  last version:', JSON.stringify({ version: last.version, source: last.source, sourceProvider: last.sourceProvider, reason: last.reason, createdAt: last.createdAt }));
    }
  }
} catch (e) {
  console.log('ERROR reading property record:', e.message);
}

console.log('\n══ 2. ATTOM-DATA CANDIDATES FOR FL 32233 ════════════════════════');
const attomContainer = db.container('attom-data');
const { resources: candidates } = await attomContainer.items.query(
  {
    query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip ORDER BY c.sourcedAt DESC",
    parameters: [{ name: '@state', value: TARGET_STATE }, { name: '@zip', value: TARGET_ZIP }],
  }
).fetchAll();

console.log(`Total candidates for ${TARGET_STATE} ${TARGET_ZIP}:`, candidates.length);

// Show any that contain "BEACHSIDE"
const beachside = candidates.filter(c => JSON.stringify(c.address || '').toUpperCase().includes('BEACHSIDE'));
console.log(`Candidates containing "BEACHSIDE":`, beachside.length);
if (beachside.length > 0) {
  for (const c of beachside) {
    const reconstructed = reconstructStreet(c.address);
    const normalized = normalizeStreet(reconstructed);
    console.log('\n  attomId:', c.attomId);
    console.log('  address raw:', JSON.stringify(c.address));
    console.log('  reconstructedStreet:', reconstructed);
    console.log('  normalizedCandStreet:', normalized);
  }
}

console.log('\n══ 3. NORMALIZATION COMPARISON ══════════════════════════════════');
const inStreetNorm = normalizeStreet(TARGET_STREET);
const inCityNorm = TARGET_CITY.toUpperCase().trim();
console.log(`Input street: "${TARGET_STREET}" → normalized: "${inStreetNorm}"`);
console.log(`Input city: "${TARGET_CITY}" → normalized: "${inCityNorm}"`);

if (beachside.length > 0) {
  for (const c of beachside) {
    const reconstructed = reconstructStreet(c.address);
    const candStreetNorm = normalizeStreet(reconstructed);
    const candCityNorm = (c.address.city ?? '').toUpperCase().trim();
    const match = candStreetNorm === inStreetNorm && candCityNorm === inCityNorm;
    console.log(`\n  Candidate: "${reconstructed}" → "${candStreetNorm}" / city "${candCityNorm}"`);
    console.log(`  Street match: ${candStreetNorm === inStreetNorm} | City match: ${candCityNorm === inCityNorm} | OVERALL: ${match}`);
  }
} else {
  console.log('\n  No BEACHSIDE candidates found in attom-data for FL 32233.');
  console.log('  → This means Local ATTOM has no record for this address.');
  console.log('  → The provider chain falls through to Bridge Interactive (expected).');
  if (candidates.length > 0) {
    console.log('\n  Sample of candidates found in FL 32233 (first 5):');
    for (const c of candidates.slice(0, 5)) {
      console.log('   ', c.attomId, JSON.stringify(c.address));
    }
  }
}
