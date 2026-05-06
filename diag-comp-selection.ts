import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

async function main() {
  const client = new CosmosClient({
    endpoint: process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT ?? '',
    aadCredentials: new DefaultAzureCredential(),
  });
  const db = client.database('appraisal-management');

  // Full detail on the most recent collection doc
  const { resources: col } = await db.container('order-comparables').items.query(
    'SELECT TOP 1 c.id, c.orderId, c.productType, c.skipped, c.skipReason, c.createdAt, ' +
    'ARRAY_LENGTH(c.soldCandidates) as soldCount, ARRAY_LENGTH(c.activeCandidates) as activeCount ' +
    'FROM c ORDER BY c.createdAt DESC',
  ).fetchAll();
  console.log('=== Most recent collection doc (candidate counts) ===');
  console.log(JSON.stringify(col, null, 2));

  // Check whether comparable-analyses container exists + its partition key
  try {
    const { resource: containerDef } = await db.container('comparable-analyses').read();
    console.log('\n=== comparable-analyses container definition ===');
    console.log('partitionKey:', JSON.stringify(containerDef?.partitionKey));
  } catch (e: unknown) {
    console.log('\n=== comparable-analyses DOES NOT EXIST ===', (e as Error).message);
  }

  // Check comparable-analyses for ALL doc types (not just comp-selection)
  const { resources: allDocs } = await db.container('comparable-analyses').items.query(
    'SELECT c.id, c.type, c.reviewId, c.createdAt FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 5',
  ).fetchAll();
  console.log('\n=== comparable-analyses all docs (newest 5) ===');
  console.log(JSON.stringify(allDocs, null, 2));
}

main().catch(err => { console.error('FATAL:', (err as Error).message ?? err); process.exit(1); });
