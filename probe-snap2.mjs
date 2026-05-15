import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources } = await db.container('canonical-snapshots').items.query({
  query: "SELECT TOP 1 * FROM c WHERE c.orderId='SEED-VO-00101' ORDER BY c._ts DESC"
}).fetchAll();
const snap = resources[0];
console.log('keys:', Object.keys(snap));
console.log('-- normalizedData keys --');
if (snap.normalizedData) {
  console.log('top-level:', Object.keys(snap.normalizedData));
  if (snap.normalizedData.canonical) {
    console.log('canonical top-level:', Object.keys(snap.normalizedData.canonical));
    if (snap.normalizedData.canonical.subject) {
      console.log('canonical.subject keys:', Object.keys(snap.normalizedData.canonical.subject));
      console.log('canonical.subject (full):', JSON.stringify(snap.normalizedData.canonical.subject, null, 2).substring(0, 1500));
    }
  }
}
