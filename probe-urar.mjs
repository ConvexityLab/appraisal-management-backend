import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://axiom-cosmos-dev.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('axiom');
const reg = db.container('document-type-registry');

// All urar-like entries
const { resources: urarRows } = await reg.items.query("SELECT c.id, c.canonicalType, c.aliases, c.tenantId, c.clientId FROM c WHERE CONTAINS(LOWER(c.id), 'urar') OR CONTAINS(LOWER(c.canonicalType), 'urar') OR ARRAY_CONTAINS(c.aliases, 'urar', false) OR ARRAY_CONTAINS(c.aliases, 'URAR', false)").fetchAll();
console.log('-- urar-related registry rows --');
for (const r of urarRows) console.log(`  ${JSON.stringify(r)}`);

// Distinct tenants / clients
const { resources: tenants } = await reg.items.query("SELECT DISTINCT c.tenantId, c.clientId FROM c").fetchAll();
console.log('-- distinct (tenantId, clientId) --');
for (const t of tenants) console.log(`  ${JSON.stringify(t)}`);
