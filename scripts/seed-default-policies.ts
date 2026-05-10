/**
 * Seed Default Authorization Policies
 *
 * Upserts the default PolicyRule documents (replicating the hardcoded
 * `CasbinAuthorizationEngine.buildQueryFilter()` logic) into the
 * `authorization-policies` Cosmos container.
 *
 * Each rule is identified by a deterministic `id` derived from
 * `tenantId + role + resourceType + description` so re-running the script
 * is idempotent (upsert by id).
 *
 * Usage:
 *   npx tsx scripts/seed-default-policies.ts
 *
 * Required environment variables:
 *   COSMOS_ENDPOINT       — Cosmos DB account endpoint
 *   COSMOS_DATABASE_ID or COSMOS_DATABASE_NAME — Cosmos DB database name
 *   SEED_TENANT_ID        — Target tenant; defaults to 'default'
 *
 * Authentication:
 *   DefaultAzureCredential (managed identity / az login / env vars)
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { buildDefaultPolicies } from '../src/data/default-policy-rules.js';
import {
  materializeAuthorizationCapabilityDocuments,
  AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
} from '../src/data/platform-capability-matrix.js';
import type { PolicyRule } from '../src/types/policy.types.js';

dotenv.config();

const CONTAINER = 'authorization-policies';

/**
 * Derive a deterministic, stable id from a rule's logical identity so that
 * repeated seeds are idempotent (same content → same id → upsert is a no-op).
 */
function deterministicId(tenantId: string, r: PolicyRule): string {
  const key = `${tenantId}|${r.role}|${r.resourceType}|${r.description}`;
  return crypto.createHash('sha1').update(key).digest('hex');
}

async function main(): Promise<void> {
  const endpoint = process.env['COSMOS_ENDPOINT'];
  const databaseId = process.env['COSMOS_DATABASE_ID'] ?? process.env['COSMOS_DATABASE_NAME'];
  const tenantId = process.env['SEED_TENANT_ID'] ?? 'default';

  if (!endpoint) throw new Error('COSMOS_ENDPOINT is required');
  if (!databaseId) throw new Error('COSMOS_DATABASE_ID or COSMOS_DATABASE_NAME is required');

  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  const container = client.database(databaseId).container(CONTAINER);

  const rules = buildDefaultPolicies(tenantId).map(r => ({
    ...r,
    id: deterministicId(tenantId, r),
  }));

  const capabilityDocs = materializeAuthorizationCapabilityDocuments(
    AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
    'system:seed',
  );

  console.log(
    `Seeding ${rules.length} default policy rules for tenantId="${tenantId}" and ` +
    `${capabilityDocs.length} Casbin capability docs for tenantId="${AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID}" …`,
  );

  let upserted = 0;
  let failed = 0;

  for (const rule of rules) {
    try {
      await container.items.upsert(rule);
      upserted++;
    } catch (err) {
      console.error(`  ✗ Failed to upsert rule "${rule.description}":`, err);
      failed++;
    }
  }

  for (const capability of capabilityDocs) {
    try {
      await container.items.upsert(capability);
      upserted++;
    } catch (err) {
      console.error(`  ✗ Failed to upsert capability "${capability.description}":`, err);
      failed++;
    }
  }

  console.log(`Done. ${upserted} upserted, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
