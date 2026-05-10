/**
 * Read-only: show sample docs from the test-tenant residue so you can verify
 * none of it is real customer data before running cleanup-test-tenant.ts.
 *
 *   pnpm exec tsx --env-file .env scripts/inspect-test-tenant.ts
 */
import { CosmosDbService } from '../src/services/cosmos-db.service.js';

async function main() {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) {
    console.error('Set AZURE_COSMOS_ENDPOINT first');
    process.exit(2);
  }
  const db = new CosmosDbService(endpoint);
  await db.initialize();

  const containers = ['engagements', 'orders', 'vendors', 'client-orders'];

  for (const name of containers) {
    console.log(`\n${'═'.repeat(72)}\n${name} — oldest 3 + newest 3 + creator breakdown\n${'═'.repeat(72)}`);

    // Oldest 3 — these tell us if the tenant predates the integration tests
    const oldest = await db.queryItems(
      name,
      'SELECT TOP 3 c.id, c.createdAt, c.createdBy, c.client, c.clientId, c.clientName, c.orderNumber, c.engagementNumber, c.name FROM c WHERE c.tenantId = @t ORDER BY c.createdAt ASC',
      [{ name: '@t', value: 'test-tenant' }],
    );
    console.log('OLDEST 3:');
    console.log(JSON.stringify(oldest.data, null, 2));

    const newest = await db.queryItems(
      name,
      'SELECT TOP 3 c.id, c.createdAt, c.createdBy, c.client, c.clientId, c.clientName, c.orderNumber, c.engagementNumber, c.name FROM c WHERE c.tenantId = @t ORDER BY c.createdAt DESC',
      [{ name: '@t', value: 'test-tenant' }],
    );
    console.log('NEWEST 3:');
    console.log(JSON.stringify(newest.data, null, 2));

    // Distinct createdBy
    const creators = await db.queryItems(
      name,
      'SELECT c.createdBy, COUNT(1) AS n FROM c WHERE c.tenantId = @t GROUP BY c.createdBy',
      [{ name: '@t', value: 'test-tenant' }],
    );
    console.log('CREATED-BY BREAKDOWN:');
    console.log(JSON.stringify(creators.data, null, 2));
  }

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
