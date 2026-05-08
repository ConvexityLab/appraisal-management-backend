import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = 'https://appraisal-mgmt-dev-cosmos.documents.azure.com:443/';
const db = 'appraisal-management';
const VO_ID = 'VO-T4CV2SBX';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });

// 1. Fetch vendor order — container is 'orders', partition key is /tenantId, so cross-partition query
const { resources: voResources } = await client
  .database(db)
  .container('orders')
  .items.query(
    {
      query: "SELECT c.id, c.clientOrderId, c.tenantId, c.productType, c.propertyId, c.type FROM c WHERE c.id = @id",
      parameters: [{ name: '@id', value: VO_ID }],
    },
    { enableCrossPartitionQuery: true },
  )
  .fetchAll();

const vo = voResources[0];
if (!vo) {
  console.log('VENDOR ORDER NOT FOUND in orders container');
  process.exit(0);
}

console.log('=== VENDOR ORDER ===');
console.log(JSON.stringify({
  id: vo.id,
  clientOrderId: vo.clientOrderId,
  tenantId: vo.tenantId,
  productType: vo.productType,
  propertyId: vo.propertyId,
  type: vo.type,
}, null, 2));

const clientOrderId = vo.clientOrderId;
if (!clientOrderId) {
  console.log('\nNO clientOrderId on vendor order — that is the problem');
  process.exit(0);
}

// 2. Check order-comparables for collection + selection docs
const { resources: compDocs } = await client
  .database(db)
  .container('order-comparables')
  .items.query(
    {
      query: 'SELECT c.id, c.stage, c.skipped, c.skipReason, c.createdAt, c.soldCandidates, c.activeCandidates FROM c WHERE c.orderId = @orderId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@orderId', value: clientOrderId }],
    },
    { partitionKey: clientOrderId },
  )
  .fetchAll();

console.log('\n=== ORDER-COMPARABLES DOCS ===');
for (const d of compDocs) {
  console.log(JSON.stringify({
    id: d.id,
    stage: d.stage,
    skipped: d.skipped ?? false,
    skipReason: d.skipReason ?? null,
    soldCandidates: d.soldCandidates?.length ?? 0,
    activeCandidates: d.activeCandidates?.length ?? 0,
    createdAt: d.createdAt,
  }, null, 2));
}
if (compDocs.length === 0) console.log('  (none)');

// 3. Check comparable-analyses for ANY docs related to this order
const { resources: analysisDocs } = await client
  .database(db)
  .container('comparable-analyses')
  .items.query(
    {
      query: 'SELECT c.id, c.type, c.strategyName, c.selectedSold, c.selectedActive, c.shortfall, c.diagnostics, c.createdAt FROM c WHERE c.reviewId = @orderId OR c.orderId = @orderId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@orderId', value: clientOrderId }],
    },
    { partitionKey: clientOrderId },
  )
  .fetchAll();

console.log('\n=== COMPARABLE-ANALYSES DOCS (all types) ===');
for (const d of analysisDocs) {
  console.log(JSON.stringify({
    id: d.id,
    type: d.type,
    strategyName: d.strategyName ?? null,
    selectedSold: d.selectedSold?.length ?? 0,
    selectedActive: d.selectedActive?.length ?? 0,
    shortfall: d.shortfall ?? null,
    createdAt: d.createdAt,
  }, null, 2));
}
if (analysisDocs.length === 0) console.log('  (none)');

// 4. Check if the client order document has expected fields
const { resources: clientOrderDocs } = await client
  .database(db)
  .container('client-orders')
  .items.query(
    {
      query: 'SELECT c.id, c.tenantId, c.productType, c.propertyId, c.status, c.placedAt FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: clientOrderId }],
    },
    { partitionKey: clientOrderId },
  )
  .fetchAll()
  .catch(() => ({ resources: [] }));

// Try alternate container names
let clientOrder = clientOrderDocs[0];
if (!clientOrder) {
  const { resources: ordersDocs } = await client
    .database(db)
    .container('orders')
    .items.query(
      {
        query: 'SELECT c.id, c.tenantId, c.type, c.productType, c.propertyId, c.status FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: clientOrderId }],
      },
      { enableCrossPartitionQuery: true },
    )
    .fetchAll()
    .catch(() => ({ resources: [] }));
  clientOrder = ordersDocs.find(d => d.id === clientOrderId);
}
console.log('\n=== CLIENT ORDER ===');
console.log(clientOrder ? JSON.stringify(clientOrder, null, 2) : '  (not found in client-orders or orders containers)');

// 6. Check the subject PropertyRecord
const propId = vo.propertyId;
const tenantId = vo.tenantId;
const { resource: propRecord } = await client
  .database(db)
  .container('property-records')
  .item(propId, tenantId)
  .read()
  .catch(() => ({ resource: null }));

console.log('\n=== SUBJECT PROPERTY RECORD ===');
if (!propRecord) {
  console.log(`  NOT FOUND (id: ${propId}, tenantId: ${tenantId})`);
} else {
  console.log(JSON.stringify({
    id: propRecord.id,
    latitude: propRecord.address?.latitude,
    longitude: propRecord.address?.longitude,
    gla: propRecord.building?.gla,
    yearBuilt: propRecord.building?.yearBuilt,
    bedrooms: propRecord.building?.bedrooms,
    bathrooms: propRecord.building?.bathrooms,
    propertyType: propRecord.propertyType,
  }, null, 2));
}
const latestCollection = compDocs.find(d => d.stage === 'COLLECTION' && !d.skipped);
if (latestCollection) {
  const { resources: fullDoc } = await client
    .database(db)
    .container('order-comparables')
    .items.query(
      {
        query: "SELECT c.soldCandidates, c.activeCandidates, c.config FROM c WHERE c.id = @id",
        parameters: [{ name: '@id', value: latestCollection.id }],
      },
      { partitionKey: clientOrderId },
    )
    .fetchAll();
  if (fullDoc[0]) {
    const doc = fullDoc[0];
    console.log('\n=== COLLECTION CONFIG ===');
    console.log(JSON.stringify(doc.config, null, 2));
    console.log(`\n=== FIRST SOLD CANDIDATE (sample) ===`);
    console.log(JSON.stringify(doc.soldCandidates?.[0] ?? null, null, 2));
  }
}
