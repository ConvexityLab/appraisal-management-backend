#!/usr/bin/env tsx
/**
 * Patch existing orders to set clientId = "vision" where missing.
 *
 * Scans the 'orders' container for documents under the specified tenantId
 * that have no clientId, and patches them with clientId = "vision".
 *
 * Also patches the 'documents' container for documents under the same
 * tenantId that have no clientId.
 *
 * Usage:
 *   COSMOS_ENDPOINT=https://... \
 *   COSMOS_DATABASE_NAME=appraisal-management \
 *   PATCH_TENANT_ID=885097ba-35ea-48db-be7a-a0aa7ff451bd \
 *   PATCH_CLIENT_ID=vision \
 *   npx tsx scripts/live-fire/patch-orders-clientId.ts
 *
 * Add DRY_RUN=true to preview without writing.
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function patchContainer(
  client: CosmosClient,
  dbName: string,
  containerName: string,
  tenantId: string,
  clientId: string,
  dryRun: boolean,
): Promise<number> {
  const container = client.database(dbName).container(containerName);

  const { resources } = await container.items.query<{ id: string; tenantId: string }>({
    query: `SELECT c.id, c.tenantId FROM c WHERE c.tenantId = @tenantId AND (NOT IS_DEFINED(c.clientId) OR c.clientId = null OR c.clientId = "")`,
    parameters: [{ name: '@tenantId', value: tenantId }],
  }).fetchAll();

  console.log(`  ${containerName}: ${resources.length} documents missing clientId`);

  if (dryRun) {
    for (const doc of resources.slice(0, 5)) {
      console.log(`    [DRY RUN] would patch: ${doc.id}`);
    }
    if (resources.length > 5) {
      console.log(`    ... and ${resources.length - 5} more`);
    }
    return resources.length;
  }

  let patched = 0;
  for (const doc of resources) {
    try {
      await container.item(doc.id, doc.tenantId).patch([
        { op: 'add', path: '/clientId', value: clientId },
      ]);
      patched++;
    } catch (err) {
      console.error(`    Failed to patch ${doc.id}: ${(err as Error).message}`);
    }
  }

  console.log(`  ${containerName}: patched ${patched}/${resources.length}`);
  return patched;
}

async function main(): Promise<void> {
  const endpoint = readRequired('COSMOS_ENDPOINT');
  const dbName = readRequired('COSMOS_DATABASE_NAME');
  const tenantId = readRequired('PATCH_TENANT_ID');
  const clientId = readRequired('PATCH_CLIENT_ID');
  const dryRun = (process.env.DRY_RUN ?? '').toLowerCase() === 'true';

  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  console.log(`Patching clientId="${clientId}" for tenantId="${tenantId}" (dryRun=${dryRun})`);
  console.log();

  const containers = ['orders', 'documents'];
  let total = 0;
  for (const containerName of containers) {
    total += await patchContainer(client, dbName, containerName, tenantId, clientId, dryRun);
  }

  console.log();
  if (dryRun) {
    console.log(`Dry run complete. ${total} documents would be patched. Re-run without DRY_RUN=true to apply.`);
  } else {
    console.log(`Done. ${total} documents patched with clientId="${clientId}".`);
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${(err as Error).message}`);
  process.exit(1);
});
