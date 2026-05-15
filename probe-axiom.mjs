import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources: any } = await db.container('axiom-executions').items.query("SELECT TOP 10 c.id, c.orderId, c.status, c._ts FROM c ORDER BY c._ts DESC").fetchAll();
console.log('-- axiom-executions any status (top 10) --');
for (const r of any) console.log(`  ${JSON.stringify(r)}`);
