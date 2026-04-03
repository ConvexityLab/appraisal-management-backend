import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const ORDER_IDS = [
  '1775182853417-k6731h3e0',
  '1775182853540-0tgvrbaed',
  '1775182853560-fkmym44bk',
];

const endpoint = process.env['COSMOS_ENDPOINT'];
const databaseId = process.env['COSMOS_DATABASE_NAME'];
if (!endpoint) throw new Error('COSMOS_ENDPOINT not set');
if (!databaseId) throw new Error('COSMOS_DATABASE_NAME not set');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = client.database(databaseId);

async function main() {
  for (const orderId of ORDER_IDS) {
    const { resources } = await db.container('aiInsights').items.query(
      { query: 'SELECT * FROM c WHERE c.orderId = @id', parameters: [{ name: '@id', value: orderId }] },
      { enableCrossPartitionQuery: true },
    ).fetchAll();

    console.log('\n' + '='.repeat(80));
    console.log('ORDER:', orderId);
    console.log('='.repeat(80));

    if (!resources.length) {
      console.log('NOT FOUND in aiInsights');
      continue;
    }

    const doc = resources[0];
    console.log('id          :', doc.id);
    console.log('axiomStatus :', doc.axiomStatus ?? '(unset)');

    console.log('\n--- axiomExtractionResult ---');
    console.log(JSON.stringify(doc.axiomExtractionResult, null, 2));

    console.log('\n--- axiomCriteriaResult ---');
    console.log(JSON.stringify(doc.axiomCriteriaResult, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
