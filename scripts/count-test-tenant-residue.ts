/**
 * Read-only audit of test-tenant data left behind by integration tests.
 *
 * Run: pnpm exec tsx --env-file .env scripts/count-test-tenant-residue.ts
 */
import { CosmosDbService } from '../src/services/cosmos-db.service.js';

async function main() {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) {
    console.error('Set AZURE_COSMOS_ENDPOINT first (in .env or shell)');
    process.exit(2);
  }
  const db = new CosmosDbService(endpoint);
  await db.initialize();

  const containers = [
    { name: 'engagements', label: 'Engagements' },
    { name: 'client-orders', label: 'ClientOrders' },
    { name: 'orders', label: 'VendorOrders (orders container)' },
    { name: 'vendors', label: 'Vendors' },
    { name: 'property-records', label: 'PropertyRecords' },
  ];

  for (const c of containers) {
    try {
      const total = await db.queryItems<number>(
        c.name,
        'SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @t',
        [{ name: '@t', value: 'test-tenant' }],
      );
      const recent = await db.queryItems(
        c.name,
        'SELECT TOP 3 c.id, c.createdAt FROM c WHERE c.tenantId = @t ORDER BY c.createdAt DESC',
        [{ name: '@t', value: 'test-tenant' }],
      );
      const count = (total.data as any)?.[0] ?? 'unknown';
      console.log(`\n=== ${c.label} ===`);
      console.log(`  rows under test-tenant: ${count}`);
      console.log(`  most recent 3:`, recent.data);
    } catch (e: any) {
      console.log(`\n=== ${c.label} ===`);
      console.log(`  query failed: ${e?.message ?? e}`);
    }
  }

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
