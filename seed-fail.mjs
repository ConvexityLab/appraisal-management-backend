import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const c = db.container('canonical-snapshots');

// 1. Find latest snapshot for SEED-VO-00101
const { resources } = await c.items.query({
  query: "SELECT TOP 1 * FROM c WHERE c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
const snap = resources[0];
const before = snap.normalizedData?.canonical?.subject?.occupancy;
console.log(`Before: canonical.subject.occupancy = ${JSON.stringify(before)}`);

// 2. Inject known-failing value at the path the criterion expects.
//    Criterion OccupancyStatusIndicated requires occupancy ∈ ["Owner","Tenant","Vacant"].
//    "Squatter" is intentionally out-of-enum → must produce FAIL.
snap.normalizedData = snap.normalizedData || {};
snap.normalizedData.canonical = snap.normalizedData.canonical || {};
snap.normalizedData.canonical.subject = snap.normalizedData.canonical.subject || {};
snap.normalizedData.canonical.subject.occupancy = "Squatter";

// 3. Replace in place.
const { resource: updated } = await c.item(snap.id, snap.tenantId).replace(snap);
console.log(`After:  canonical.subject.occupancy = ${JSON.stringify(updated.normalizedData?.canonical?.subject?.occupancy)} (snapshot ${updated.id})`);
