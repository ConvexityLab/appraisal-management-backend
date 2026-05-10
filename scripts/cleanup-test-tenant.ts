/**
 * Delete every document under tenantId='test-tenant' across the containers
 * integration tests write to. Run on demand or wire to a cron.
 *
 *   pnpm exec tsx --env-file .env scripts/cleanup-test-tenant.ts
 *
 * Options:
 *   --dry-run   List what would be deleted; perform no writes.
 *   --tenant=X  Override the target tenant (default: 'test-tenant').
 *               Refuses anything that doesn't start with 'test-'.
 */
import { CosmosDbService } from '../src/services/cosmos-db.service.js';

const TARGET_TENANT_DEFAULT = 'test-tenant';

interface ContainerSpec {
  name: string;
  /** partition key path on the container — Cosmos needs this for point deletes. */
  partitionKey: (doc: any) => string;
  /** human label */
  label: string;
}

// Each container's partition key must be supplied as it exists in the doc.
// /tenantId is the common case; deviations are noted.
const CONTAINERS: ContainerSpec[] = [
  { name: 'engagements',     label: 'Engagements',     partitionKey: d => d.tenantId },
  { name: 'client-orders',   label: 'ClientOrders',    partitionKey: d => d.tenantId },
  { name: 'orders',          label: 'VendorOrders',    partitionKey: d => d.tenantId },
  { name: 'vendors',         label: 'Vendors',         partitionKey: d => d.tenantId },
  { name: 'property-records',label: 'PropertyRecords', partitionKey: d => d.tenantId },
  // Side-effect containers populated by the integration flows. Best-effort: a
  // missing container just logs and continues.
  { name: 'audit-events',           label: 'AuditEvents',          partitionKey: d => d.tenantId },
  { name: 'client-order-events',    label: 'ClientOrderEvents',    partitionKey: d => d.tenantId },
  { name: 'property-enrichments',   label: 'PropertyEnrichments',  partitionKey: d => d.tenantId },
  { name: 'property-observations',  label: 'PropertyObservations', partitionKey: d => d.tenantId },
  { name: 'property-event-outbox',  label: 'PropertyEventOutbox',  partitionKey: d => d.tenantId },
  { name: 'canonical-snapshots',    label: 'CanonicalSnapshots',   partitionKey: d => d.tenantId },
  { name: 'order-comparables',      label: 'OrderComparables',     partitionKey: d => d.tenantId },
];

interface Args {
  dryRun: boolean;
  tenant: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, tenant: TARGET_TENANT_DEFAULT };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length);
  }
  if (!args.tenant.startsWith('test-')) {
    throw new Error(
      `Refusing to delete under tenant '${args.tenant}': name must start with 'test-' to guard against running this on a real tenant.`,
    );
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) {
    console.error('Set AZURE_COSMOS_ENDPOINT first (in .env or shell)');
    process.exit(2);
  }

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Tenant:   ${args.tenant}`);
  console.log(`Mode:     ${args.dryRun ? 'DRY RUN (no deletes)' : 'DELETE'}`);
  console.log('');

  const db = new CosmosDbService(endpoint);
  await db.initialize();

  let grandTotal = 0;
  let grandDeleted = 0;

  for (const spec of CONTAINERS) {
    try {
      // We pull ids+partition keys (small payload) rather than the full docs.
      // queryItems uses cross-partition queries — fine for this scale.
      const idQuery = await db.queryItems<{ id: string; tenantId: string }>(
        spec.name,
        'SELECT c.id, c.tenantId FROM c WHERE c.tenantId = @t',
        [{ name: '@t', value: args.tenant }],
      );
      const rows = (idQuery.data as Array<{ id: string; tenantId: string }>) ?? [];
      grandTotal += rows.length;

      if (rows.length === 0) {
        console.log(`  ${spec.label.padEnd(24)} 0 rows`);
        continue;
      }

      if (args.dryRun) {
        console.log(`  ${spec.label.padEnd(24)} ${rows.length} rows (would delete)`);
        continue;
      }

      let deleted = 0;
      let failed = 0;
      for (const row of rows) {
        const pk = spec.partitionKey(row);
        const res = await db.deleteItem(spec.name, row.id, pk);
        if (res.success) deleted++; else failed++;
      }
      grandDeleted += deleted;
      console.log(
        `  ${spec.label.padEnd(24)} ${rows.length} rows → ${deleted} deleted${failed > 0 ? `, ${failed} failed` : ''}`,
      );
    } catch (e: any) {
      console.log(`  ${spec.label.padEnd(24)} skipped — ${e?.message ?? e}`);
    }
  }

  console.log('');
  console.log(`Total rows under '${args.tenant}': ${grandTotal}`);
  if (!args.dryRun) console.log(`Total deleted:                ${grandDeleted}`);

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
