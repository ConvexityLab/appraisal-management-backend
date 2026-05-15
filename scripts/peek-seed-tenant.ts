/**
 * Counts under the seed tenantId (from AZURE_TENANT_ID) so you can confirm
 * the cleanup script (which targets 'test-tenant') won't touch seed data.
 *
 *   pnpm exec tsx --env-file .env scripts/peek-seed-tenant.ts
 */
import { CosmosDbService } from '../src/services/cosmos-db.service.js';

async function main() {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  const seedTenant = process.env.AZURE_TENANT_ID;
  if (!endpoint || !seedTenant) {
    console.error('AZURE_COSMOS_ENDPOINT and AZURE_TENANT_ID required');
    process.exit(2);
  }
  console.log(`Seed tenantId: ${seedTenant}`);
  console.log(`(Cleanup script targets 'test-tenant' — different namespace)\n`);
  const db = new CosmosDbService(endpoint);
  await db.initialize();

  for (const name of ['engagements', 'orders', 'vendors', 'clients', 'client-orders']) {
    const r = await db.queryItems<number>(
      name,
      'SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @t',
      [{ name: '@t', value: seedTenant }],
    );
    console.log(`  ${name.padEnd(20)} ${(r.data as any)?.[0] ?? 'n/a'} rows under seed tenant`);
  }

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
