/**
 * Vitest globalSetup — the function exported here runs ONCE before the suite;
 * the function it returns runs ONCE after the entire suite finishes.
 *
 * We only need the teardown half: when integration tests run
 * (VITEST_INTEGRATION=true), they create real documents in Cosmos under
 * tenantId='test-tenant'. This teardown deletes that residue so successive
 * runs don't accumulate (left unchecked, the suite was leaking 100+ rows
 * per run and reached 1,487 before manual cleanup).
 *
 * No-op when VITEST_INTEGRATION!=='true' (unit-test runs never write to Cosmos).
 *
 * The cleanup is guarded: it only deletes under a tenant whose id starts
 * with 'test-' (matches the cleanup-test-tenant.ts script behaviour).
 */

import { CosmosDbService } from '../src/services/cosmos-db.service.js';

const TARGET_TENANT = 'test-tenant';

interface ContainerSpec {
  name: string;
  label: string;
}

const CONTAINERS: ContainerSpec[] = [
  { name: 'engagements',          label: 'Engagements' },
  { name: 'client-orders',        label: 'ClientOrders' },
  { name: 'orders',               label: 'VendorOrders' },
  { name: 'vendors',              label: 'Vendors' },
  { name: 'property-records',     label: 'PropertyRecords' },
  { name: 'audit-events',         label: 'AuditEvents' },
  { name: 'client-order-events',  label: 'ClientOrderEvents' },
  { name: 'property-enrichments', label: 'PropertyEnrichments' },
  { name: 'property-observations',label: 'PropertyObservations' },
  { name: 'property-event-outbox',label: 'PropertyEventOutbox' },
  { name: 'canonical-snapshots',  label: 'CanonicalSnapshots' },
  { name: 'order-comparables',    label: 'OrderComparables' },
];

/**
 * Default export = setup. Vitest calls this once before the suite begins.
 * The returned function is invoked once after the suite ends (teardown).
 */
export default function setup() {
  // No setup work needed; the returned function does the post-suite cleanup.
  return async function teardown() {
    if (process.env.VITEST_INTEGRATION !== 'true') return;

    if (!TARGET_TENANT.startsWith('test-')) {
      throw new Error(`globalTeardown refusing: target tenant '${TARGET_TENANT}' does not start with 'test-'`);
    }

    const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
    if (!endpoint) {
      console.warn('[globalTeardown] AZURE_COSMOS_ENDPOINT unset — skipping test-tenant cleanup');
      return;
    }

    console.log(`\n[globalTeardown] Cleaning up tenantId='${TARGET_TENANT}' residue…`);
    const db = new CosmosDbService(endpoint);
    await db.initialize();

    let totalDeleted = 0;
    for (const spec of CONTAINERS) {
      try {
        const rows = await db.queryItems<{ id: string; tenantId: string }>(
          spec.name,
          'SELECT c.id, c.tenantId FROM c WHERE c.tenantId = @t',
          [{ name: '@t', value: TARGET_TENANT }],
        );
        const items = (rows.data as Array<{ id: string; tenantId: string }>) ?? [];
        if (items.length === 0) continue;

        let deleted = 0;
        for (const row of items) {
          const res = await db.deleteItem(spec.name, row.id, row.tenantId);
          if (res.success) deleted++;
        }
        totalDeleted += deleted;
        console.log(`[globalTeardown]   ${spec.label}: deleted ${deleted}/${items.length}`);
      } catch {
        // Container may not exist on the target instance — silent skip.
      }
    }

    console.log(`[globalTeardown] Done — ${totalDeleted} rows deleted under '${TARGET_TENANT}'`);
    await db.disconnect();
  };
}
