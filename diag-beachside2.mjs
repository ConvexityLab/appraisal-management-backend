/**
 * Deep diagnostic: show full version history + full attom-data document
 */
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosClient } from '@azure/cosmos';

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
if (!ENDPOINT) throw new Error('AZURE_COSMOS_ENDPOINT is required');

const TENANT = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const PROPERTY_ID = 'prop-1778086971512-3rjsphm';

const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');

// ── 1. Full property record version history ──
console.log('══ FULL VERSION HISTORY ══════════════════════════════════════════');
const propContainer = db.container('property-records');
const { resource: propRecord } = await propContainer.item(PROPERTY_ID, TENANT).read();
console.log('recordVersion:', propRecord.recordVersion);
console.log('lastVerifiedAt:', propRecord.lastVerifiedAt);
console.log('lastVerifiedSource:', propRecord.lastVerifiedSource);
console.log('building:', JSON.stringify(propRecord.building));
for (const v of propRecord.versionHistory ?? []) {
  console.log(`  v${v.version}: source=${v.source} | sourceProvider=${v.sourceProvider ?? '(none)'} | reason="${v.reason}" | createdAt=${v.createdAt}`);
  if (v.changedFields?.length > 0) console.log(`    changedFields: ${v.changedFields.join(', ')}`);
}

// ── 2. attom-data document for attomId 159599103 ──
console.log('\n══ ATTOM-DATA DOCUMENT (attomId 159599103) ═══════════════════════');
const attomContainer = db.container('attom-data');
const { resources: attomDocs } = await attomContainer.items.query({
  query: "SELECT * FROM c WHERE c.attomId = @attomId",
  parameters: [{ name: '@attomId', value: 159599103 }],
}).fetchAll();

if (attomDocs.length === 0) {
  console.log('NOT FOUND — no document with attomId 159599103');
} else {
  const doc = attomDocs[0];
  console.log('attomId:', doc.attomId);
  console.log('address:', JSON.stringify(doc.address));
  console.log('livingAreaSqft:', doc.livingAreaSqft);
  console.log('yearBuilt:', doc.yearBuilt);
  console.log('bedroomsTotal:', doc.bedroomsTotal);
  console.log('bathroomsFull:', doc.bathroomsFull);
  console.log('bathroomsHalf:', doc.bathroomsHalf);
  console.log('apnFormatted:', doc.apnFormatted);
  console.log('sourcedAt:', doc.sourcedAt);
  console.log('type:', doc.type);
  // Show the raw keys to spot anything unexpected
  console.log('Keys:', Object.keys(doc).join(', '));
}

// ── 3. enrichment-audits for this property ──
console.log('\n══ ENRICHMENT AUDIT RECORDS ══════════════════════════════════════');
try {
  const enrichContainer = db.container('property-enrichments');
  const { resources: audits } = await enrichContainer.items.query(
    {
      query: "SELECT c.id, c.propertyId, c.source, c.fetchedAt, c.orderId, c.outcome FROM c WHERE c.tenantId = @tenantId AND c.propertyId = @propertyId ORDER BY c.fetchedAt DESC",
      parameters: [
        { name: '@tenantId', value: TENANT },
        { name: '@propertyId', value: PROPERTY_ID },
      ],
    },
    { partitionKey: TENANT }
  ).fetchAll();

  console.log(`Found ${audits.length} enrichment audit records`);
  for (const a of audits) {
    console.log(`  fetchedAt=${a.fetchedAt} | source="${a.source}" | outcome="${a.outcome}" | orderId=${a.orderId}`);
  }
} catch (e) {
  console.log('Could not query enrichments:', e.message);
}
