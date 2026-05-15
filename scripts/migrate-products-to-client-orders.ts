/**
 * migrate-products-to-client-orders.ts
 *
 * Data migration: rename `EngagementProduct` → `EngagementClientOrder` in persisted
 * documents, after the corresponding code rename. The logical model is unchanged;
 * only field names move.
 *
 * Containers affected:
 *   engagements   — rename loans[*].products → loans[*].clientOrders   (partition: /tenantId)
 *   orders        — rename engagementProductId → engagementClientOrderId (partition: /tenantId)
 *
 * Idempotent:
 *   - engagements: a doc is skipped when no loan still has a `products` array
 *     (and any pre-existing `clientOrders` is left untouched).
 *   - orders: query already filters on IS_DEFINED(c.engagementProductId), so
 *     re-runs find nothing.
 *
 * Write strategy:
 *   - orders:       Cosmos Patch API (atomic, minimal RU): add the new field, remove the old.
 *   - engagements:  read full doc → mutate loans[*] in memory (rename products → clientOrders) → upsert.
 *                   Nested array prevents a clean field-level patch via the SDK.
 *
 * Dry-run mode:
 *   Set DRY_RUN=true or pass --dry-run flag. Reports what it WOULD change without writing.
 *
 * Targeting a single container:
 *   Pass --container <name>  (engagements | orders)
 *   Omit to migrate both.
 *
 * Usage:
 *   npx tsx scripts/migrate-products-to-client-orders.ts
 *   npx tsx scripts/migrate-products-to-client-orders.ts --dry-run
 *   npx tsx scripts/migrate-products-to-client-orders.ts --container engagements
 *   npx tsx scripts/migrate-products-to-client-orders.ts --container orders --dry-run
 *
 * Required environment variables (set in .env or shell):
 *   COSMOS_ENDPOINT      — e.g. https://my-account.documents.azure.com:443/
 *   COSMOS_DATABASE_ID   — e.g. appraisal-management
 *   (auth via DefaultAzureCredential — az login / managed identity)
 */

import { CosmosClient } from '@azure/cosmos';
import type { Container, PatchOperation } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN: boolean =
  args.includes('--dry-run') ||
  process.env['DRY_RUN'] === 'true' ||
  process.env['DRY_RUN'] === '1';

const containerArg: string | undefined = (() => {
  const idx = args.indexOf('--container');
  return idx !== -1 ? args[idx + 1] : undefined;
})();

const VALID_CONTAINERS = ['engagements', 'orders'] as const;
type TargetContainer = (typeof VALID_CONTAINERS)[number];

if (containerArg !== undefined && !(VALID_CONTAINERS as readonly string[]).includes(containerArg)) {
  console.error(`❌ Unknown --container value: "${containerArg}". Must be one of: ${VALID_CONTAINERS.join(', ')}`);
  process.exit(1);
}

const TARGETS: TargetContainer[] = containerArg
  ? [containerArg as TargetContainer]
  : [...VALID_CONTAINERS];

// ─── Per-container result tracking ───────────────────────────────────────────

interface MigrateResult {
  container: string;
  scanned: number;
  skipped: number;
  patched: number;
  errors: number;
}

// ─── engagements migration ────────────────────────────────────────────────────

interface EngagementLoanShape {
  products?: unknown[];
  clientOrders?: unknown[];
  [key: string]: unknown;
}
interface EngagementDoc {
  id: string;
  tenantId?: string;
  engagementNumber?: string;
  loans?: EngagementLoanShape[];
  [key: string]: unknown;
}

async function migrateEngagements(container: Container, dryRun: boolean): Promise<MigrateResult> {
  const result: MigrateResult = { container: 'engagements', scanned: 0, skipped: 0, patched: 0, errors: 0 };

  const query = { query: 'SELECT * FROM c WHERE IS_DEFINED(c.loans)' };

  let continuationToken: string | undefined;
  do {
    const response = await container.items.query<EngagementDoc>(query, {
      maxItemCount: 50,
      continuationToken,
    }).fetchNext();

    for (const doc of response.resources) {
      result.scanned++;

      let mutated = false;
      const loans = doc.loans ?? [];
      for (const loan of loans) {
        if (Object.prototype.hasOwnProperty.call(loan, 'products')) {
          // If both fields exist, prefer existing clientOrders (assume already migrated)
          // and just drop the stale products field. Otherwise, move products → clientOrders.
          if (!Object.prototype.hasOwnProperty.call(loan, 'clientOrders')) {
            loan.clientOrders = loan.products ?? [];
          }
          delete loan.products;
          mutated = true;
        }
      }

      if (!mutated) {
        result.skipped++;
        continue;
      }

      console.log(
        `  [engagements] id=${doc.id} enNum=${doc.engagementNumber ?? '?'} ` +
        `loans.products → loans.clientOrders${dryRun ? ' [DRY RUN]' : ''}`,
      );

      if (!dryRun) {
        try {
          await container.items.upsert(doc);
          result.patched++;
        } catch (err) {
          console.error(`  ❌ [engagements] upsert failed for id=${doc.id}: ${(err as Error).message}`);
          result.errors++;
        }
      } else {
        result.patched++;
      }
    }

    continuationToken = response.continuationToken ?? undefined;
  } while (continuationToken);

  return result;
}

// ─── orders migration ─────────────────────────────────────────────────────────

interface OrderProjection {
  id: string;
  tenantId?: string;
  engagementProductId?: string;
  engagementClientOrderId?: string;
}

async function migrateOrders(container: Container, dryRun: boolean): Promise<MigrateResult> {
  const result: MigrateResult = { container: 'orders', scanned: 0, skipped: 0, patched: 0, errors: 0 };

  const query = {
    query: `SELECT c.id, c.tenantId, c.engagementProductId, c.engagementClientOrderId
            FROM c
            WHERE c.type = 'order' AND IS_DEFINED(c.engagementProductId)`,
  };

  let continuationToken: string | undefined;
  do {
    const response = await container.items.query<OrderProjection>(query, {
      maxItemCount: 200,
      continuationToken,
    }).fetchNext();

    for (const doc of response.resources) {
      result.scanned++;

      if (!doc.engagementProductId) {
        result.skipped++;
        continue;
      }

      // Build patch:
      //   - if engagementClientOrderId already exists, just drop the legacy field;
      //   - otherwise, copy then drop.
      const ops: PatchOperation[] = [];
      if (doc.engagementClientOrderId === undefined) {
        ops.push({ op: 'add', path: '/engagementClientOrderId', value: doc.engagementProductId });
      }
      ops.push({ op: 'remove', path: '/engagementProductId' });

      console.log(
        `  [orders] id=${doc.id} tenantId=${doc.tenantId ?? '(none)'} ` +
        `engagementProductId="${doc.engagementProductId}" → engagementClientOrderId` +
        `${dryRun ? ' [DRY RUN]' : ''}`,
      );

      if (!dryRun) {
        try {
          await container.item(doc.id, doc.tenantId).patch(ops);
          result.patched++;
        } catch (err) {
          console.error(`  ❌ [orders] patch failed for id=${doc.id}: ${(err as Error).message}`);
          result.errors++;
        }
      } else {
        result.patched++;
      }
    }

    continuationToken = response.continuationToken ?? undefined;
  } while (continuationToken);

  return result;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const endpoint = process.env['COSMOS_ENDPOINT'] ?? process.env['AZURE_COSMOS_ENDPOINT'];
  const databaseId =
    process.env['COSMOS_DATABASE_ID'] ??
    process.env['COSMOS_DATABASE_NAME'] ??
    process.env['AZURE_COSMOS_DATABASE_NAME'];

  if (!endpoint) throw new Error('COSMOS_ENDPOINT is required — set it in .env or the environment');
  if (!databaseId) {
    throw new Error(
      'Cosmos database name is required — set COSMOS_DATABASE_ID, COSMOS_DATABASE_NAME, ' +
      'or AZURE_COSMOS_DATABASE_NAME in .env or the environment',
    );
  }

  const cosmosClient = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });
  const db = cosmosClient.database(databaseId);

  console.log('');
  console.log('='.repeat(72));
  console.log('MIGRATION: rename EngagementProduct → EngagementClientOrder');
  console.log('='.repeat(72));
  console.log(`  Cosmos endpoint : ${endpoint}`);
  console.log(`  Database        : ${databaseId}`);
  console.log(`  Dry run         : ${DRY_RUN}`);
  console.log(`  Containers      : ${TARGETS.join(', ')}`);
  console.log('');

  const results: MigrateResult[] = [];

  for (const target of TARGETS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Processing container: ${target}`);
    console.log('─'.repeat(60));

    const container = db.container(target);
    let result: MigrateResult;

    if (target === 'engagements') {
      result = await migrateEngagements(container, DRY_RUN);
    } else {
      result = await migrateOrders(container, DRY_RUN);
    }

    results.push(result);

    console.log('');
    console.log(
      `  ✅ ${target}: scanned=${result.scanned}  skipped=${result.skipped}  ` +
      `${DRY_RUN ? 'would-patch' : 'patched'}=${result.patched}  errors=${result.errors}`,
    );
  }

  console.log('');
  console.log('='.repeat(72));
  console.log('SUMMARY');
  console.log('='.repeat(72));

  let totalPatched = 0;
  let totalErrors = 0;
  for (const r of results) {
    console.log(
      `  ${r.container.padEnd(24)} scanned=${String(r.scanned).padStart(6)}  ` +
      `skipped=${String(r.skipped).padStart(6)}  ` +
      `${DRY_RUN ? 'would-patch' : 'patched'}=${String(r.patched).padStart(6)}  ` +
      `errors=${String(r.errors).padStart(4)}`,
    );
    totalPatched += r.patched;
    totalErrors += r.errors;
  }

  console.log('');
  console.log(`  TOTAL ${DRY_RUN ? 'would-patch' : 'patched'}: ${totalPatched}   errors: ${totalErrors}`);
  console.log('='.repeat(72));

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
