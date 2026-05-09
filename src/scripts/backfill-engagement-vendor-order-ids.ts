#!/usr/bin/env tsx
/**
 * Backfill EngagementClientOrder.vendorOrderIds from the orders container.
 *
 * The embedded `engagement.loans[].clientOrders[].vendorOrderIds` array is an
 * eventually-consistent denormalized cache. It can drift on partial-failure
 * writes — e.g. ClientOrderService.placeClientOrder is not atomic; a failed
 * etag-retry on the linkOrder mutation leaves the array missing entries.
 *
 * Source of truth for "which vendor orders belong to this engagement" is the
 * `orders` container (engagement-primacy guard ensures every VendorOrder doc
 * carries engagementId / engagementPropertyId / clientOrderId).
 *
 * This script reconciles every engagement's embedded array against the orders
 * container, in place, with ETag-aware updates.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-engagement-vendor-order-ids.ts                 # Dry-run
 *   npx tsx src/scripts/backfill-engagement-vendor-order-ids.ts --apply         # Write
 *   npx tsx src/scripts/backfill-engagement-vendor-order-ids.ts --tenant <id>   # Scope
 *   npx tsx src/scripts/backfill-engagement-vendor-order-ids.ts --verbose       # Per-engagement diff
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID (for Managed Identity auth)
 *
 * Idempotent: re-running with no drift produces zero writes.
 */

import 'dotenv/config';
import { CosmosClient, type Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// ── Pure logic (exported for unit tests) ─────────────────────────────────────

interface VendorOrderRef {
  id: string;
  engagementPropertyId?: string;
  clientOrderId?: string;
}

interface ClientOrderShape {
  id: string;
  vendorOrderIds: string[];
}

interface LoanShape {
  id: string;
  clientOrders: ClientOrderShape[];
}

export interface EngagementShape {
  id: string;
  tenantId: string;
  /** Engagement docs use either `loans` or `properties` for the loan array. */
  loans?: LoanShape[];
  properties?: LoanShape[];
}

export interface ReconcileChange {
  loanId: string;
  clientOrderId: string;
  /** IDs present in the current embedded array but not in the orders container. */
  removed: string[];
  /** IDs present in the orders container but not in the current embedded array. */
  added: string[];
  /** New value for `vendorOrderIds` (sorted alphabetically for stability). */
  next: string[];
}

export interface ReconcileResult {
  changes: ReconcileChange[];
  /** Vendor orders that could not be attributed (missing/unknown engagementPropertyId or clientOrderId). */
  orphaned: VendorOrderRef[];
}

/**
 * Compute the diff between the engagement's current embedded vendor-order
 * linkages and the linkages implied by VendorOrder docs in the orders
 * container. Pure: no I/O, no side effects.
 */
export function reconcile(
  engagement: EngagementShape,
  vendorOrders: VendorOrderRef[],
): ReconcileResult {
  const loans = engagement.loans ?? engagement.properties ?? [];
  const loansById = new Map(loans.map((l) => [l.id, l] as const));

  // Group VendorOrder ids by (loanId, clientOrderId).
  const byClientOrder = new Map<string, Set<string>>();
  const orphaned: VendorOrderRef[] = [];
  for (const vo of vendorOrders) {
    if (!vo.engagementPropertyId || !vo.clientOrderId) {
      orphaned.push(vo);
      continue;
    }
    const loan = loansById.get(vo.engagementPropertyId);
    if (!loan) {
      orphaned.push(vo);
      continue;
    }
    const co = loan.clientOrders?.find((c) => c.id === vo.clientOrderId);
    if (!co) {
      orphaned.push(vo);
      continue;
    }
    const key = `${vo.engagementPropertyId}::${vo.clientOrderId}`;
    if (!byClientOrder.has(key)) byClientOrder.set(key, new Set());
    byClientOrder.get(key)!.add(vo.id);
  }

  const changes: ReconcileChange[] = [];

  // For every (loan, clientOrder) currently in the engagement, compare current
  // vendorOrderIds against what the orders container says.
  for (const loan of loans) {
    for (const co of loan.clientOrders ?? []) {
      const key = `${loan.id}::${co.id}`;
      const fromOrders = byClientOrder.get(key) ?? new Set<string>();
      const fromEmbedded = new Set(co.vendorOrderIds ?? []);

      const added: string[] = [];
      for (const id of fromOrders) {
        if (!fromEmbedded.has(id)) added.push(id);
      }
      const removed: string[] = [];
      for (const id of fromEmbedded) {
        if (!fromOrders.has(id)) removed.push(id);
      }

      if (added.length === 0 && removed.length === 0) continue;

      const next = Array.from(fromOrders).sort();
      changes.push({ loanId: loan.id, clientOrderId: co.id, added, removed, next });
    }
  }

  return { changes, orphaned };
}

/** Apply reconciliation changes to a copy of the engagement, leaving the input untouched. */
export function applyReconciliation(
  engagement: EngagementShape,
  result: ReconcileResult,
): EngagementShape {
  if (result.changes.length === 0) return engagement;

  const loanField: 'loans' | 'properties' =
    engagement.loans !== undefined ? 'loans' : 'properties';
  const loans = engagement[loanField] ?? [];

  const changesByKey = new Map<string, ReconcileChange>();
  for (const c of result.changes) changesByKey.set(`${c.loanId}::${c.clientOrderId}`, c);

  const updatedLoans = loans.map((loan) => ({
    ...loan,
    clientOrders: (loan.clientOrders ?? []).map((co) => {
      const change = changesByKey.get(`${loan.id}::${co.id}`);
      if (!change) return co;
      return { ...co, vendorOrderIds: change.next };
    }),
  }));

  return { ...engagement, [loanField]: updatedLoans };
}

// ── Cosmos plumbing ──────────────────────────────────────────────────────────

interface BackfillStats {
  scanned: number;
  alreadyConsistent: number;
  drifted: number;
  patched: number;
  failed: number;
  orphanedVendorOrders: number;
}

function buildCosmosClient(endpoint: string): CosmosClient {
  const isEmulator = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
  if (isEmulator) {
    return new CosmosClient({
      endpoint,
      key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: false },
    } as never);
  }
  return new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
    connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
  } as never);
}

async function fetchVendorOrders(
  ordersContainer: Container,
  engagementId: string,
  tenantId: string,
): Promise<VendorOrderRef[]> {
  const { resources } = await ordersContainer.items
    .query<VendorOrderRef>({
      query:
        'SELECT c.id, c.engagementPropertyId, c.clientOrderId FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId',
      parameters: [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    })
    .fetchAll();
  return resources;
}

async function processEngagement(
  engagementsContainer: Container,
  ordersContainer: Container,
  engagement: EngagementShape & { _etag?: string },
  apply: boolean,
  verbose: boolean,
  stats: BackfillStats,
): Promise<void> {
  stats.scanned += 1;

  const vendorOrders = await fetchVendorOrders(ordersContainer, engagement.id, engagement.tenantId);
  const result = reconcile(engagement, vendorOrders);

  stats.orphanedVendorOrders += result.orphaned.length;
  if (result.orphaned.length > 0) {
    console.warn(
      `⚠️  Engagement ${engagement.id}: ${result.orphaned.length} vendor order(s) ` +
        `cannot be attributed (missing/unknown engagementPropertyId or clientOrderId): ` +
        `${result.orphaned.map((o) => o.id).join(', ')}`,
    );
  }

  if (result.changes.length === 0) {
    stats.alreadyConsistent += 1;
    if (verbose) console.log(`✓  Engagement ${engagement.id}: consistent (${vendorOrders.length} vendor orders)`);
    return;
  }

  stats.drifted += 1;
  console.log(
    `Δ  Engagement ${engagement.id}: ${result.changes.length} clientOrder(s) drifted (` +
      result.changes.map((c) => `${c.clientOrderId}: +${c.added.length}/-${c.removed.length}`).join(', ') +
      `)`,
  );

  if (verbose) {
    for (const c of result.changes) {
      if (c.added.length > 0) console.log(`     +added to ${c.clientOrderId}: ${c.added.join(', ')}`);
      if (c.removed.length > 0) console.log(`     -removed from ${c.clientOrderId}: ${c.removed.join(', ')}`);
    }
  }

  if (!apply) return;

  // ETag-aware update with one retry on conflict (re-read, re-reconcile).
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const reconciledDoc = applyReconciliation(engagement, result);
      const etag = engagement._etag;
      await engagementsContainer
        .item(engagement.id, engagement.tenantId)
        .replace(reconciledDoc, etag ? { accessCondition: { type: 'IfMatch', condition: etag } } : undefined);
      stats.patched += 1;
      return;
    } catch (err: unknown) {
      const e = err as { code?: number; statusCode?: number };
      const isConflict = e.code === 412 || e.statusCode === 412;
      if (!isConflict || attempt === 2) {
        stats.failed += 1;
        console.error(`✗  Engagement ${engagement.id}: replace failed (attempt ${attempt}):`, err);
        return;
      }
      // Re-read for fresh etag and re-reconcile against latest VendorOrders.
      const fresh = await engagementsContainer.item(engagement.id, engagement.tenantId).read<EngagementShape & { _etag?: string }>();
      if (!fresh.resource) {
        stats.failed += 1;
        console.error(`✗  Engagement ${engagement.id}: vanished during retry`);
        return;
      }
      engagement = fresh.resource;
      const refreshed = await fetchVendorOrders(ordersContainer, engagement.id, engagement.tenantId);
      Object.assign(result, reconcile(engagement, refreshed));
      if (result.changes.length === 0) {
        // Concurrent process already reconciled; treat as success.
        stats.patched += 1;
        return;
      }
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const verbose = process.argv.includes('--verbose');
  const tenantArgIndex = process.argv.indexOf('--tenant');
  const tenantFilter = tenantArgIndex >= 0 ? process.argv[tenantArgIndex + 1] : undefined;

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    console.error('❌ COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    process.exit(1);
  }

  const databaseName = process.env.COSMOS_DATABASE_NAME ?? 'AppraisalDB';
  console.log(`Backfill engagement vendor-order linkages — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Endpoint: ${cosmosEndpoint}`);
  console.log(`Database: ${databaseName}`);
  if (tenantFilter) console.log(`Tenant filter: ${tenantFilter}`);
  console.log('');

  const client = buildCosmosClient(cosmosEndpoint);
  const database = client.database(databaseName);
  const engagementsContainer = database.container('engagements');
  const ordersContainer = database.container('orders');

  const stats: BackfillStats = {
    scanned: 0,
    alreadyConsistent: 0,
    drifted: 0,
    patched: 0,
    failed: 0,
    orphanedVendorOrders: 0,
  };

  const engagementQuery = tenantFilter
    ? {
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId',
        parameters: [{ name: '@tenantId', value: tenantFilter }],
      }
    : { query: 'SELECT * FROM c' };

  const iter = engagementsContainer.items.query<EngagementShape & { _etag?: string }>(engagementQuery);
  while (iter.hasMoreResults()) {
    const { resources } = await iter.fetchNext();
    for (const eng of resources) {
      try {
        await processEngagement(engagementsContainer, ordersContainer, eng, apply, verbose, stats);
      } catch (err) {
        stats.failed += 1;
        console.error(`✗  Engagement ${eng.id}: unexpected failure:`, err);
      }
    }
  }

  console.log('');
  console.log('── Summary ──');
  console.log(`Scanned:             ${stats.scanned}`);
  console.log(`Already consistent:  ${stats.alreadyConsistent}`);
  console.log(`Drifted:             ${stats.drifted}`);
  console.log(`Patched:             ${apply ? stats.patched : `0 (dry-run; would patch ${stats.drifted})`}`);
  console.log(`Failed:              ${stats.failed}`);
  console.log(`Orphan vendor orders: ${stats.orphanedVendorOrders}`);

  if (stats.failed > 0) process.exit(2);
}

// Allow `import { reconcile } from '...';` from tests without running main().
const isDirectInvocation =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  process.argv[1].includes('backfill-engagement-vendor-order-ids');
if (isDirectInvocation) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
