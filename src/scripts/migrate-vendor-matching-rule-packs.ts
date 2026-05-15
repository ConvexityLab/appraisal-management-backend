#!/usr/bin/env tsx
/**
 * One-shot migration from the vendor-matching-specific Cosmos containers
 * (Phase 3 of AUTO_ASSIGNMENT_REVIEW.md) to the generalized Decision
 * Engine containers (Phase A of DECISION_ENGINE_RULES_SURFACE.md).
 *
 * Source containers (read-only, untouched after run):
 *   vendor-matching-rule-packs   →   decision-rule-packs
 *   vendor-matching-rule-audit   →   decision-rule-audit
 *
 * Per-document transformation for packs:
 *   - type:  'vendor-matching-rule-pack'  →  'decision-rule-pack'
 *   - id:    `${tenantId}__${packId}__v${version}`
 *           →  `${tenantId}__vendor-matching__${packId}__v${version}`
 *   - +     `category: 'vendor-matching'` field added
 *
 * Per-document transformation for audit:
 *   - type:  'vendor-matching-rule-audit'  →  'decision-rule-audit'
 *   - id:    unchanged (uuid)
 *   - +     `category: 'vendor-matching'` field added
 *
 * Idempotent: writes use upsertItem keyed on the new synthetic id (or uuid
 * for audit). Re-running the script with no source changes produces only
 * no-op upserts; with new source docs it picks them up incrementally.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-vendor-matching-rule-packs.ts                 # Dry-run
 *   npx tsx src/scripts/migrate-vendor-matching-rule-packs.ts --apply         # Write
 *   npx tsx src/scripts/migrate-vendor-matching-rule-packs.ts --apply --tenant <id>
 *   npx tsx src/scripts/migrate-vendor-matching-rule-packs.ts --verbose       # Per-doc trace
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   Managed Identity / DefaultAzureCredential
 */

import 'dotenv/config';
import { CosmosClient, type Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// ── Source/target shapes ─────────────────────────────────────────────────────

const VENDOR_MATCHING_CATEGORY = 'vendor-matching';

const SRC_PACKS = 'vendor-matching-rule-packs';
const SRC_AUDIT = 'vendor-matching-rule-audit';
const DST_PACKS = 'decision-rule-packs';
const DST_AUDIT = 'decision-rule-audit';

interface SourcePackDoc {
  id: string;
  type: 'vendor-matching-rule-pack';
  tenantId: string;
  packId: string;
  version: number;
  parentVersion: number | null;
  status: 'active' | 'inactive' | 'archived';
  rules: unknown[];
  metadata?: { name?: string; description?: string };
  createdAt: string;
  createdBy: string;
}

interface SourceAuditDoc {
  id: string;
  type: 'vendor-matching-rule-audit';
  tenantId: string;
  packId: string;
  fromVersion: number | null;
  toVersion: number;
  action: string;
  diff?: { added: string[]; removed: string[]; modified: string[] };
  actor: string;
  reason?: string;
  timestamp: string;
}

interface TargetPackDoc {
  id: string;
  type: 'decision-rule-pack';
  category: typeof VENDOR_MATCHING_CATEGORY;
  tenantId: string;
  packId: string;
  version: number;
  parentVersion: number | null;
  status: 'active' | 'inactive' | 'archived';
  rules: unknown[];
  metadata: { name?: string; description?: string };
  createdAt: string;
  createdBy: string;
}

interface TargetAuditDoc {
  id: string;
  type: 'decision-rule-audit';
  category: typeof VENDOR_MATCHING_CATEGORY;
  tenantId: string;
  packId: string;
  fromVersion: number | null;
  toVersion: number;
  action: string;
  diff?: { added: string[]; removed: string[]; modified: string[] };
  actor: string;
  reason?: string;
  timestamp: string;
}

// ── Pure transforms (exported for tests) ─────────────────────────────────────

export function transformPack(src: SourcePackDoc): TargetPackDoc {
  return {
    id: `${src.tenantId}__${VENDOR_MATCHING_CATEGORY}__${src.packId}__v${src.version}`,
    type: 'decision-rule-pack',
    category: VENDOR_MATCHING_CATEGORY,
    tenantId: src.tenantId,
    packId: src.packId,
    version: src.version,
    parentVersion: src.parentVersion,
    status: src.status,
    rules: src.rules,
    metadata: src.metadata ?? {},
    createdAt: src.createdAt,
    createdBy: src.createdBy,
  };
}

export function transformAudit(src: SourceAuditDoc): TargetAuditDoc {
  return {
    id: src.id,
    type: 'decision-rule-audit',
    category: VENDOR_MATCHING_CATEGORY,
    tenantId: src.tenantId,
    packId: src.packId,
    fromVersion: src.fromVersion,
    toVersion: src.toVersion,
    action: src.action,
    ...(src.diff ? { diff: src.diff } : {}),
    actor: src.actor,
    ...(src.reason ? { reason: src.reason } : {}),
    timestamp: src.timestamp,
  };
}

// ── Migration runner ─────────────────────────────────────────────────────────

interface RunOptions {
  apply: boolean;
  tenant: string | null;
  verbose: boolean;
}

interface RunStats {
  packsRead: number;
  packsWritten: number;
  packsSkipped: number;
  auditRead: number;
  auditWritten: number;
  auditSkipped: number;
  errors: Array<{ container: string; id: string; error: string }>;
}

async function migrateContainer<S, T extends { id: string }>(
  src: Container,
  dst: Container,
  transform: (s: S) => T,
  filterTenant: string | null,
  apply: boolean,
  verbose: boolean,
  label: string,
): Promise<{ read: number; written: number; skipped: number; errors: RunStats['errors'] }> {
  const errors: RunStats['errors'] = [];
  let read = 0;
  let written = 0;
  let skipped = 0;

  // Stream by partition (tenant-scoped) when --tenant supplied; otherwise
  // cross-partition scan is unavoidable but acceptable for a one-shot tool.
  const querySpec = filterTenant
    ? {
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId',
        parameters: [{ name: '@tenantId', value: filterTenant }],
      }
    : { query: 'SELECT * FROM c' };

  const iterator = src.items.query<S>(querySpec, {
    ...(filterTenant ? { partitionKey: filterTenant } : {}),
    maxItemCount: 100,
  });

  while (iterator.hasMoreResults()) {
    const { resources } = await iterator.fetchNext();
    for (const srcDoc of resources) {
      read++;
      let target: T;
      try {
        target = transform(srcDoc);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ container: label, id: (srcDoc as unknown as { id?: string }).id ?? '<unknown>', error: msg });
        skipped++;
        continue;
      }
      if (verbose) {
        console.log(`[${label}] ${(srcDoc as unknown as { id: string }).id} → ${target.id}`);
      }
      if (!apply) {
        // Dry-run: count it as skipped so the operator sees how many writes
        // an --apply run would perform.
        skipped++;
        continue;
      }
      try {
        await dst.items.upsert(target);
        written++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ container: label, id: target.id, error: msg });
      }
    }
  }

  return { read, written, skipped, errors };
}

async function run(options: RunOptions): Promise<RunStats> {
  const endpoint = process.env['COSMOS_ENDPOINT'] ?? process.env['AZURE_COSMOS_ENDPOINT'];
  if (!endpoint) {
    throw new Error('COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) must be set');
  }
  const databaseName = process.env['COSMOS_DATABASE_NAME'] ?? 'appraisal-management';

  const isEmulator = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
  const client = isEmulator
    ? new CosmosClient({
        endpoint,
        key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
        connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: false },
      } as never)
    : new CosmosClient({
        endpoint,
        aadCredentials: new DefaultAzureCredential(),
        connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
      } as never);
  const db = client.database(databaseName);

  const srcPacks = db.container(SRC_PACKS);
  const srcAudit = db.container(SRC_AUDIT);
  const dstPacks = db.container(DST_PACKS);
  const dstAudit = db.container(DST_AUDIT);

  console.log(`Endpoint:    ${endpoint}`);
  console.log(`Database:    ${databaseName}`);
  console.log(`Mode:        ${options.apply ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  if (options.tenant) console.log(`Tenant:      ${options.tenant}`);
  console.log();

  const packsResult = await migrateContainer<SourcePackDoc, TargetPackDoc>(
    srcPacks,
    dstPacks,
    transformPack,
    options.tenant,
    options.apply,
    options.verbose,
    'packs',
  );

  const auditResult = await migrateContainer<SourceAuditDoc, TargetAuditDoc>(
    srcAudit,
    dstAudit,
    transformAudit,
    options.tenant,
    options.apply,
    options.verbose,
    'audit',
  );

  return {
    packsRead: packsResult.read,
    packsWritten: packsResult.written,
    packsSkipped: packsResult.skipped,
    auditRead: auditResult.read,
    auditWritten: auditResult.written,
    auditSkipped: auditResult.skipped,
    errors: [...packsResult.errors, ...auditResult.errors],
  };
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

function parseArgs(argv: string[]): RunOptions {
  const options: RunOptions = { apply: false, tenant: null, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--apply') options.apply = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--tenant') options.tenant = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      printHelp();
      process.exit(2);
    }
  }
  return options;
}

function printHelp(): void {
  console.log(`Usage:
  npx tsx src/scripts/migrate-vendor-matching-rule-packs.ts [options]

Options:
  --apply           Perform the writes. Without this, runs in dry-run mode.
  --tenant <id>    Limit migration to a single tenant.
  --verbose        Log every source → target id transition.
  -h, --help       Show this help.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const stats = await run(options);

  console.log();
  console.log(`Packs: read=${stats.packsRead}  written=${stats.packsWritten}  skipped=${stats.packsSkipped}`);
  console.log(`Audit: read=${stats.auditRead}  written=${stats.auditWritten}  skipped=${stats.auditSkipped}`);
  if (stats.errors.length > 0) {
    console.error(`\n${stats.errors.length} error(s):`);
    for (const e of stats.errors) {
      console.error(`  [${e.container}] ${e.id}: ${e.error}`);
    }
    process.exit(1);
  }
  if (!options.apply) {
    console.log('\nDry-run complete. Re-run with --apply to perform the writes.');
  }
}

// Allow `import { transformPack, transformAudit } from '...';` from tests without running main().
const isDirectInvocation =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  process.argv[1].includes('migrate-vendor-matching-rule-packs');

if (isDirectInvocation) {
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
