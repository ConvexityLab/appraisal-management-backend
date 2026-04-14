/**
 * Seed Module Contract
 *
 * Every seed module under `modules/` exports a single `SeedModule` object.
 * The orchestrator calls `module.run(ctx)` with a shared context.
 */

import type { CosmosClient, Database } from '@azure/cosmos';

/** Context passed to every seed module's `run()` function. */
export interface SeedContext {
  /** Authenticated CosmosClient (emulator or cloud). */
  cosmosClient: CosmosClient;
  /** Pre-resolved Database handle (`appraisal-management`). */
  db: Database;
  /** The tenant ID to stamp on every document (from AZURE_TENANT_ID). */
  tenantId: string;
  /** The platform client ID aligned with Axiom (from AXIOM_CLIENT_ID). */
  clientId: string;
  /** The platform sub-client ID aligned with Axiom (from AXIOM_SUB_CLIENT_ID). */
  subClientId: string;
  /** Current ISO timestamp — consistent across the entire run. */
  now: string;
  /** If true, delete seed data before upserting. */
  clean: boolean;
  /** If true, only clean — skip all seeding (upserts become no-ops). */
  cleanOnly: boolean;
  /** Storage account name for blob operations (may be empty). */
  storageAccountName: string;
}

export interface SeedModuleResult {
  created: number;
  failed: number;
  skipped: number;
  cleaned: number;
}

export interface SeedModule {
  /** Human-readable name for log output. */
  name: string;
  /** Cosmos containers this module writes to (for --clean). */
  containers: string[];
  /** Execute the seed. */
  run(ctx: SeedContext): Promise<SeedModuleResult>;
}

// ─── Helpers shared by all seed modules ────────────────────────────────────────

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

/** Upsert with progress dot and error tracking. */
export async function upsert(
  ctx: SeedContext,
  containerName: string,
  item: Record<string, unknown>,
  result: SeedModuleResult,
): Promise<void> {
  if (ctx.cleanOnly) return;
  try {
    const container = ctx.db.container(containerName);
    await container.items.upsert(item);
    result.created++;
    process.stdout.write('.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ❌ Upsert failed for ${containerName}/${String(item['id'] ?? '?')}: ${msg}`);
    result.failed++;
  }
}

/**
 * Delete all documents with IDs starting with the given prefix from the given container.
 * Uses a cross-partition query to find them, then deletes by id + partition key.
 */
export async function cleanContainer(
  ctx: SeedContext,
  containerName: string,
  partitionKeyPath: string = '/tenantId',
  idPrefix: string = 'seed-',
): Promise<number> {
  const container = ctx.db.container(containerName);
  let deleted = 0;

  try {
    const { resources } = await container.items
      .query({
        query: `SELECT c.id, c${partitionKeyPath.replace(/\//g, '.')} AS pk FROM c WHERE STARTSWITH(c.id, @prefix)`,
        parameters: [{ name: '@prefix', value: idPrefix }],
      })
      .fetchAll();

    for (const doc of resources) {
      try {
        await container.item(doc.id, doc.pk ?? doc.id).delete();
        deleted++;
        process.stdout.write('x');
      } catch {
        // Item may already be gone — ignore
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ Could not clean ${containerName}: ${msg}`);
  }

  return deleted;
}
