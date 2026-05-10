/**
 * Human-readable summary of test-tenant residue grouped by cohort + age.
 *
 *   pnpm exec tsx --env-file .env scripts/inspect-test-tenant-summary.ts
 */
import { CosmosDbService } from '../src/services/cosmos-db.service.js';

async function main() {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) { console.error('Set AZURE_COSMOS_ENDPOINT first'); process.exit(2); }
  const db = new CosmosDbService(endpoint);
  await db.initialize();

  for (const name of ['engagements', 'orders', 'vendors', 'client-orders']) {
    console.log(`\n── ${name} ──────────────────────────────────────────────`);

    const ageBuckets = await db.queryItems<any>(
      name,
      `SELECT
         LEFT(c.createdAt, 7) AS month,
         COUNT(1) AS n
       FROM c
       WHERE c.tenantId = @t
       GROUP BY LEFT(c.createdAt, 7)`,
      [{ name: '@t', value: 'test-tenant' }],
    );
    const months = (ageBuckets.data as Array<{ month: string; n: number }> ?? [])
      .sort((a, b) => a.month.localeCompare(b.month));
    console.log('Rows by month:');
    for (const m of months) console.log(`  ${m.month}: ${m.n}`);

    const creators = await db.queryItems<any>(
      name,
      'SELECT c.createdBy, COUNT(1) AS n FROM c WHERE c.tenantId = @t GROUP BY c.createdBy',
      [{ name: '@t', value: 'test-tenant' }],
    );
    const groups = (creators.data as Array<{ createdBy: string; n: number }> ?? [])
      .map(c => {
        const id = c.createdBy ?? '(null)';
        // Cohort classification
        let cohort = id;
        if (id === 'test-admin') cohort = 'test-admin (api integration tests)';
        else if (id === 'integration-test') cohort = 'integration-test (raw-DB integration tests)';
        else if (id === 'bulk-upload-event-listener') cohort = 'bulk-upload-event-listener (BULK PROCESSOR — likely real test fixture)';
        else if (id.match(/^test-\d{13,}$/)) cohort = 'test-<timestamp> (per-run synthetic test users)';
        return { cohort, n: c.n };
      })
      .reduce((acc, cur) => {
        acc[cur.cohort] = (acc[cur.cohort] ?? 0) + cur.n;
        return acc;
      }, {} as Record<string, number>);
    console.log('Cohorts:');
    for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v.toString().padStart(4)} × ${k}`);
    }
  }

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
