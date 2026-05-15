/**
 * Diagnostic: inspect the full structure of the 1855 Beachside CT attom-data document
 * specifically checking for propertyDetail nested object.
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const attomContainer = db.container('attom-data');

// Query by string attomId (it's stored as string per the TypeScript type)
const { resources: byStringId } = await attomContainer.items.query({
  query: "SELECT * FROM c WHERE c.attomId = @attomId",
  parameters: [{ name: '@attomId', value: '159599103' }],
}).fetchAll();

console.log('Query by attomId="159599103" (string):', byStringId.length, 'results');

// Also query by address to get it regardless
const { resources: byAddr } = await attomContainer.items.query({
  query: "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = 'FL' AND c.address.zip = '32233' AND c.address.houseNumber = '1855' AND c.address.streetName = 'BEACHSIDE'",
}).fetchAll();

console.log('Query by address (FL 32233 1855 BEACHSIDE):', byAddr.length, 'results');

const doc = byStringId[0] ?? byAddr[0];
if (!doc) {
  console.log('\nNO DOCUMENT FOUND for 1855 Beachside CT FL 32233');
} else {
  console.log('\n══ DOCUMENT STRUCTURE ════════════════════════════════════════');
  console.log('Top-level keys:', Object.keys(doc).join(', '));
  console.log('\nattomId:', doc.attomId, '(type:', typeof doc.attomId, ')');
  console.log('type:', doc.type);
  console.log('geohash5:', doc.geohash5);
  console.log('sourcedAt:', doc.sourcedAt);
  console.log('\naddress:', JSON.stringify(doc.address, null, 2));
  
  console.log('\n── propertyDetail ───────────────────────────────────────────');
  if (doc.propertyDetail) {
    console.log('propertyDetail exists:', JSON.stringify(doc.propertyDetail, null, 2));
  } else {
    console.log('propertyDetail: MISSING/UNDEFINED');
    // Check if fields are at top level instead
    console.log('Top-level livingAreaSqft:', doc.livingAreaSqft);
    console.log('Top-level yearBuilt:', doc.yearBuilt);
    console.log('Top-level bedroomsTotal:', doc.bedroomsTotal);
    console.log('Top-level bathroomsFull:', doc.bathroomsFull);
  }
  
  console.log('\n── assessment ───────────────────────────────────────────────');
  if (doc.assessment) {
    console.log('assessment exists:', JSON.stringify(doc.assessment, null, 2));
  } else {
    console.log('assessment: MISSING/UNDEFINED');
  }
  
  console.log('\n── salesHistory ─────────────────────────────────────────────');
  if (doc.salesHistory) {
    console.log('salesHistory exists:', JSON.stringify(doc.salesHistory, null, 2));
  } else {
    console.log('salesHistory: MISSING/UNDEFINED');
  }
  
  console.log('\n── Full rawData (first 5 keys) ──────────────────────────────');
  if (doc.rawData) {
    const rawKeys = Object.keys(doc.rawData).slice(0, 10);
    for (const k of rawKeys) console.log(' ', k, ':', doc.rawData[k]);
  } else {
    console.log('rawData: MISSING');
  }
}
