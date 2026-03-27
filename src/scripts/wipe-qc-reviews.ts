/**
 * One-time script: wipe ALL documents from the qc-reviews container.
 * Run: npx tsx src/scripts/wipe-qc-reviews.ts
 * Then re-run: pnpm run seed
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// Load .env from project root
config({ path: resolve(process.cwd(), '.env') });

const endpoint = process.env['AZURE_COSMOS_ENDPOINT'];
if (!endpoint) throw new Error('AZURE_COSMOS_ENDPOINT not set');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const container = client.database('appraisal-management').container('qc-reviews');

async function main() {
  const { resources } = await container.items.query('SELECT c.id, c.tenantId, c.orderId FROM c').fetchAll();
  console.log(`Found ${resources.length} docs in qc-reviews`);

  let deleted = 0;
  for (const doc of resources) {
    try {
      await container.item(doc.id, doc.orderId).delete();
      deleted++;
      console.log(`Deleted: ${doc.id}`);
    } catch (e: any) {
      console.log(`FAILED ${doc.id} (orderId=${doc.orderId}): ${e?.code} ${e?.message?.slice(0, 120)}`);
    }
  }
  console.log(`\nDeleted ${deleted} / ${resources.length}`);
}

main().catch(console.error);
