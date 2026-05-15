/**
 * migrate-product-type-to-screaming-snake.ts
 *
 * Phase 6 data migration: normalises the `productType` field in existing
 * Cosmos documents from legacy snake_case ('full_appraisal') to the canonical
 * SCREAMING_SNAKE values ('FULL_APPRAISAL') used by the backend product catalog.
 *
 * Containers affected:
 *   orders              — AppraisalOrder.productType               (partition: /tenantId)
 *   engagements         — EngagementProduct.productType            (partition: /tenantId)
 *                         nested in loans[*].products[*].productType
 *   bulk-portfolio-jobs — BulkPortfolioItem.productType            (partition: /tenantId)
 *                         nested in items[*].productType
 *                         and items[*].additionalProducts[*].productType (if present)
 *
 * Normalisation rule:
 *   newValue = oldValue.toUpperCase()
 *   A document is skipped when ALL productType fields already equal their .toUpperCase() form.
 *   This is idempotent: running the script multiple times produces the same result.
 *
 * Write strategy:
 *   - orders:       Cosmos Patch API patch() — updates only the productType field
 *                   (minimal RUs, atomic, does not touch surrounding fields).
 *   - engagements:  read entire doc → mutate loans[*].products[*] in memory → upsert
 *                   (nested array prevents field-level patch via the SDK).
 *   - bulk jobs:    read entire doc → mutate items[*] in memory → upsert (same reason).
 *
 * Dry-run mode:
 *   Set DRY_RUN=true or pass --dry-run flag.  The script reports what it WOULD change
 *   without writing anything to Cosmos.
 *
 * Targeting a single container:
 *   Pass --container <name>  (orders | engagements | bulk-portfolio-jobs)
 *   Omit to migrate all three.
 *
 * Usage:
 *   npx tsx scripts/migrate-product-type-to-screaming-snake.ts
 *   npx tsx scripts/migrate-product-type-to-screaming-snake.ts --dry-run
 *   npx tsx scripts/migrate-product-type-to-screaming-snake.ts --container orders
 *   npx tsx scripts/migrate-product-type-to-screaming-snake.ts --container engagements --dry-run
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
// Note: dotenv.config() runs FIRST so that .env-sourced DRY_RUN is visible.
// Shell-level env vars (e.g. DRY_RUN=true npx tsx ...) take precedence over
// .env because dotenv only writes to process.env when the key isn't already set.
const DRY_RUN: boolean =
  args.includes('--dry-run') ||
  process.env['DRY_RUN'] === 'true' ||
  process.env['DRY_RUN'] === '1';

const containerArg: string | undefined = (() => {
  const idx = args.indexOf('--container');
  return idx !== -1 ? args[idx + 1] : undefined;
})();

const VALID_CONTAINERS = ['orders', 'engagements', 'bulk-portfolio-jobs'] as const;
type TargetContainer = (typeof VALID_CONTAINERS)[number];

if (containerArg !== undefined && !(VALID_CONTAINERS as readonly string[]).includes(containerArg)) {
  console.error(`❌ Unknown --container value: "${containerArg}". Must be one of: ${VALID_CONTAINERS.join(', ')}`);
  process.exit(1);
}

const TARGETS: TargetContainer[] = containerArg
  ? [containerArg as TargetContainer]
  : [...VALID_CONTAINERS];

// ─── Normalisation helper ─────────────────────────────────────────────────────

/**
 * Returns true when the value needs migration (is snake_case / mixed-case)
 * and false when it is already SCREAMING_SNAKE or absent.
 *
 * Uses .toUpperCase() because the mapping is lossless:
 *   'full_appraisal' → 'FULL_APPRAISAL', 'BPO_EXTERIOR' → 'BPO_EXTERIOR' (unchanged).
 */
function needsNorm(value: string | undefined | null): boolean {
  if (!value) return false;
  return value !== value.toUpperCase();
}

function normalize(value: string): string {
  return value.toUpperCase();
}

// ─── Per-container result tracking ───────────────────────────────────────────

interface MigrateResult {
  container: string;
  scanned: number;
  skipped: number;   // already normalised
  patched: number;   // written (or would-write in dry-run)
  errors: number;
}

// ─── orders migration ─────────────────────────────────────────────────────────

async function migrateOrders(container: Container, dryRun: boolean): Promise<MigrateResult> {
  const result: MigrateResult = { container: 'orders', scanned: 0, skipped: 0, patched: 0, errors: 0 };

  // Only fetch documents that have a productType field AND it isn't already upper-case.
  // Cosmos SQL has no regex, but LOWER() lets us detect non-upper values:
  // c.productType = LOWER(c.productType)  → true only when value is already fully lowercase.
  // We also catch mixed-case (e.g. 'BpoExterior') via a JS cross-check after fetching.
  const query = {
    query: `SELECT c.id, c.tenantId, c.productType FROM c
            WHERE c.type = 'order'
              AND IS_DEFINED(c.productType)
              AND IS_STRING(c.productType)
              AND c.productType = LOWER(c.productType)`,
  };

  let continuationToken: string | undefined;
  do {
    const response = await container.items.query<{
      id: string;
      tenantId: string | undefined;
      productType: string;
    }>(query, {
      maxItemCount: 200,
      continuationToken,
    }).fetchNext();

    for (const doc of response.resources) {
      result.scanned++;
      if (!needsNorm(doc.productType)) {
        result.skipped++;
        continue;
      }

      const newValue = normalize(doc.productType);
      console.log(
        `  [orders] id=${doc.id} tenantId=${doc.tenantId ?? '(none)'} ` +
        `"${doc.productType}" → "${newValue}"${dryRun ? ' [DRY RUN]' : ''}`,
      );

      if (!dryRun) {
        try {
          const ops: PatchOperation[] = [{ op: 'replace', path: '/productType', value: newValue }];
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

// ─── engagements migration ────────────────────────────────────────────────────

interface EngagementLoanProduct {
  productType?: string;
  [key: string]: unknown;
}
interface EngagementProperty {
  products?: EngagementLoanProduct[];
  [key: string]: unknown;
}
interface EngagementDoc {
  id: string;
  tenantId?: string;
  engagementNumber?: string;
  loans?: EngagementProperty[];
  [key: string]: unknown;
}

async function migrateEngagements(container: Container, dryRun: boolean): Promise<MigrateResult> {
  const result: MigrateResult = { container: 'engagements', scanned: 0, skipped: 0, patched: 0, errors: 0 };

  // Cosmos SQL cannot efficiently filter on nested arrays, so fetch all and filter in JS.
  // Use a projection to avoid reading fields we don't need, but we need the full doc for upsert.
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
        for (const product of loan.products ?? []) {
          if (needsNorm(product.productType)) {
            const oldValue = product.productType!;
            product.productType = normalize(oldValue);
            console.log(
              `  [engagements] id=${doc.id} enNum=${doc.engagementNumber ?? '?'} ` +
              `"${oldValue}" → "${product.productType}"${dryRun ? ' [DRY RUN]' : ''}`,
            );
            mutated = true;
          }
        }
      }

      if (!mutated) {
        result.skipped++;
        continue;
      }

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

// ─── bulk-portfolio-jobs migration ───────────────────────────────────────────

interface AdditionalProduct {
  productType?: string;
  [key: string]: unknown;
}
interface BulkPortfolioItem {
  productType?: string;
  additionalProducts?: AdditionalProduct[];
  [key: string]: unknown;
}
interface BulkJobDoc {
  id: string;
  tenantId?: string;
  jobName?: string;
  items?: BulkPortfolioItem[];
  [key: string]: unknown;
}

async function migrateBulkJobs(container: Container, dryRun: boolean): Promise<MigrateResult> {
  const result: MigrateResult = { container: 'bulk-portfolio-jobs', scanned: 0, skipped: 0, patched: 0, errors: 0 };

  const query = { query: 'SELECT * FROM c WHERE IS_DEFINED(c.items)' };

  let continuationToken: string | undefined;
  do {
    const response = await container.items.query<BulkJobDoc>(query, {
      maxItemCount: 20,   // bulk jobs can have large items arrays; fetch fewer at once
      continuationToken,
    }).fetchNext();

    for (const doc of response.resources) {
      result.scanned++;

      let mutated = false;
      for (const item of doc.items ?? []) {
        if (needsNorm(item.productType)) {
          const oldValue = item.productType!;
          item.productType = normalize(oldValue);
          console.log(
            `  [bulk-jobs] id=${doc.id} "${oldValue}" → "${item.productType}"${dryRun ? ' [DRY RUN]' : ''}`,
          );
          mutated = true;
        }
        // additionalProducts[*].productType
        for (const additional of item.additionalProducts ?? []) {
          if (needsNorm(additional.productType)) {
            const oldValue = additional.productType!;
            additional.productType = normalize(oldValue);
            console.log(
              `  [bulk-jobs] id=${doc.id} additionalProduct "${oldValue}" → "${additional.productType}"${dryRun ? ' [DRY RUN]' : ''}`,
            );
            mutated = true;
          }
        }
      }

      if (!mutated) {
        result.skipped++;
        continue;
      }

      if (!dryRun) {
        try {
          await container.items.upsert(doc);
          result.patched++;
        } catch (err) {
          console.error(`  ❌ [bulk-jobs] upsert failed for id=${doc.id}: ${(err as Error).message}`);
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
  console.log('MIGRATION: Normalise productType values to SCREAMING_SNAKE');
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

    if (target === 'orders') {
      result = await migrateOrders(container, DRY_RUN);
    } else if (target === 'engagements') {
      result = await migrateEngagements(container, DRY_RUN);
    } else {
      result = await migrateBulkJobs(container, DRY_RUN);
    }

    results.push(result);

    console.log('');
    console.log(`  ✅ ${target}: scanned=${result.scanned}  skipped=${result.skipped}  ${DRY_RUN ? 'would-patch' : 'patched'}=${result.patched}  errors=${result.errors}`);
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
  if (DRY_RUN) {
    console.log(`  DRY RUN complete — ${totalPatched} document(s) would be updated. No writes made.`);
  } else if (totalErrors === 0) {
    console.log(`  ✅ Migration complete — ${totalPatched} document(s) updated.`);
  } else {
    console.log(`  ⚠️  Migration finished with errors — ${totalPatched} updated, ${totalErrors} failed.`);
    console.log('     Re-run the script to retry failed documents (it is idempotent).');
  }
  console.log('');

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Migration failed:', (err as Error).message);
  process.exit(1);
});
