#!/usr/bin/env tsx
/**
 * Cleanup Orphan Orders
 *
 * Deletes all orders from the Cosmos `orders` container that are NOT the 12
 * known seed orders (IDs: seed-order-001 through seed-order-012).
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-orphan-orders.ts             # Dry-run: list orphans
 *   npx tsx src/scripts/cleanup-orphan-orders.ts --delete     # Actually delete
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const KEEP_IDS = new Set([
  'seed-order-001', 'seed-order-002', 'seed-order-003', 'seed-order-004',
  'seed-order-005', 'seed-order-006', 'seed-order-007', 'seed-order-008',
  'seed-order-009', 'seed-order-010', 'seed-order-011', 'seed-order-012',
]);

async function main(): Promise<void> {
  const doDelete = process.argv.includes('--delete');

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    console.error('❌ COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    process.exit(1);
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) {
    console.error('❌ AZURE_TENANT_ID is required.');
    process.exit(1);
  }

  const isEmulator = cosmosEndpoint.includes('localhost') || cosmosEndpoint.includes('127.0.0.1');
  let cosmosClient: CosmosClient;

  if (isEmulator) {
    const https = await import('https');
    cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
      agent: new https.Agent({ rejectUnauthorized: false }),
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: false },
    } as any);
  } else {
    cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      aadCredentials: new DefaultAzureCredential(),
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
    } as any);
  }

  const container = cosmosClient.database('appraisal-management').container('orders');

  console.log(`\n🔍 Querying ALL orders for tenant ${tenantId}...\n`);

  const { resources } = await container.items
    .query({
      query: `SELECT c.id, c.tenantId, c.orderNumber, c.status, c.propertyAddress.street AS street, c.createdAt FROM c WHERE c.tenantId = @tid`,
      parameters: [{ name: '@tid', value: tenantId }],
    })
    .fetchAll();

  const toKeep = resources.filter(d => KEEP_IDS.has(d.id));
  const toDelete = resources.filter(d => !KEEP_IDS.has(d.id));

  console.log(`  Total orders:  ${resources.length}`);
  console.log(`  Seed orders:   ${toKeep.length} (will keep)`);
  console.log(`  Orphans:       ${toDelete.length} (will ${doDelete ? 'DELETE' : 'list only'})\n`);

  if (toDelete.length === 0) {
    console.log('✅ No orphan orders found — nothing to do.');
    process.exit(0);
  }

  // Show first 30 orphans for review
  console.log('  Orphan orders:');
  for (const doc of toDelete.slice(0, 30)) {
    console.log(`    ${doc.id}  ${doc.orderNumber ?? '(no number)'}  ${doc.status ?? '?'}  ${doc.street ?? '(no address)'}  ${doc.createdAt ?? ''}`);
  }
  if (toDelete.length > 30) {
    console.log(`    ... and ${toDelete.length - 30} more`);
  }

  if (!doDelete) {
    console.log('\n⚠️  Dry run. Pass --delete to actually remove these.\n');
    process.exit(0);
  }

  console.log(`\n🗑️  Deleting ${toDelete.length} orphan orders...\n`);

  let deleted = 0;
  let failed = 0;

  for (const doc of toDelete) {
    try {
      await container.item(doc.id, doc.tenantId).delete();
      deleted++;
      process.stdout.write('.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  ❌ Failed to delete ${doc.id}: ${msg}`);
      failed++;
    }
  }

  console.log(`\n\n✅ Deleted: ${deleted}  ❌ Failed: ${failed}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
