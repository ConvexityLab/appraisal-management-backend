#!/usr/bin/env tsx
/**
 * Seed Staging Cosmos DB — User Profile Documents
 *
 * Creates (upserts) UserProfile documents in the `users` Cosmos container for
 * each staging Entra user.  The document `id` must be the Entra OID because
 * `authorization.middleware.ts` queries:
 *
 *   WHERE c.id = @id AND c.tenantId = @tenantId
 *
 * where `@id` is `payload.oid` from the validated JWT.
 *
 * The `set-user-identities.yml` CI workflow only stamps Entra extension
 * attributes — it does NOT create Cosmos documents.  This script fills that
 * gap for the staging environment.
 *
 * Safe to run multiple times — all writes are upserts.
 *
 * Usage:
 *   cd c:\source\appraisal-management-backend
 *   npx tsx scripts/live-fire/seed-staging-users.ts
 *
 * Auth: DefaultAzureCredential — must be `az login`-ed or running under a
 *       managed identity that has Cosmos "Contributor" or a custom data-plane
 *       role on the staging account.
 *
 * Env vars (all have staging defaults baked in — override if needed):
 *   COSMOS_ENDPOINT        — staging Cosmos endpoint
 *   COSMOS_DATABASE_NAME   — Cosmos database name
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load both the backend root .env and the staging overlay so any local
// overrides are respected.  Neither file is required — defaults are below.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.staging'), override: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGING_TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';

/** Staging Cosmos container that the authorization middleware reads from. */
const USERS_CONTAINER = 'users';

// ─── Staging user definitions ─────────────────────────────────────────────────

interface StagingUser {
  readonly oid: string;         // Entra Object ID — used as Cosmos doc `id`
  readonly email: string;       // Entra UPN
  readonly name: string;        // Display name
  readonly role: string;        // Must match backend role enum
}

const STAGING_USERS: readonly StagingUser[] = [
  {
    oid:   'd14de96e-1d1b-43d4-8250-7086f0a386b9',
    email: 'L1Admin@l1-analytics.com',
    name:  'L1 Admin',
    role:  'admin',
  },
  {
    oid:   '3cb04a10-b6f3-4fd1-8997-798507299d73',
    email: 'hiro@loneanalytics.com',
    name:  'Hiro',
    role:  'admin',
  },
  {
    oid:   '057faa65-5ffd-4c8b-8edf-19820c2cc01a',
    email: 'wyano@loneanalytics.com',
    name:  'Wyano',
    role:  'admin',
  },
];

// ─── Config helpers ───────────────────────────────────────────────────────────

function requiredEnvWithDefault(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  return defaultValue;
}

// ─── Document builder ─────────────────────────────────────────────────────────

function buildUserProfileDocument(user: StagingUser): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    // Cosmos document ID = Entra OID: must match what auth middleware queries.
    id: user.oid,

    // Entra identity
    azureAdObjectId: user.oid,
    email: user.email,
    name:  user.name,

    // Multi-tenancy — tenantId is what the auth query filters on.
    tenantId: STAGING_TENANT_ID,

    // organizationId is the Cosmos partition key for the `users` container.
    // Using the tenantId keeps all staging users in one logical partition.
    organizationId: STAGING_TENANT_ID,

    // Authorization
    role: user.role,
    isActive: true,
    accessScope: {
      teamIds:          [],
      departmentIds:    [],
      canViewAllOrders: true,
      canViewAllVendors: true,
    },

    // Timestamps
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const endpoint = requiredEnvWithDefault(
    'COSMOS_ENDPOINT',
    'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/',
  );
  const databaseName = requiredEnvWithDefault(
    'COSMOS_DATABASE_NAME',
    'appraisal-management',
  );

  console.log('\n' + '='.repeat(64));
  console.log('SEED: Staging Cosmos DB — User Profile Documents');
  console.log('='.repeat(64));
  console.log(`  Cosmos endpoint  : ${endpoint}`);
  console.log(`  Database         : ${databaseName}`);
  console.log(`  Container        : ${USERS_CONTAINER}`);
  console.log(`  Tenant           : ${STAGING_TENANT_ID}`);
  console.log(`  Users            : ${STAGING_USERS.length}`);
  console.log('');

  const client = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  const container = client.database(databaseName).container(USERS_CONTAINER);

  for (const user of STAGING_USERS) {
    const doc = buildUserProfileDocument(user);

    process.stdout.write(`  Upserting ${user.email} (OID: ${user.oid}) ... `);
    await container.items.upsert(doc);
    process.stdout.write('done\n');

    // Verify the write is readable — supply the partition key to avoid a
    // cross-partition point read.
    const { resource } = await container
      .item(user.oid, STAGING_TENANT_ID)
      .read<{ id: string; email: string; role: string; isActive: boolean }>();

    if (!resource) {
      throw new Error(`Read-back failed for OID ${user.oid} — upsert did not persist.`);
    }
    if (resource.id !== user.oid) {
      throw new Error(
        `Read-back id mismatch: expected ${user.oid}, got ${resource.id}`,
      );
    }

    console.log(
      `    ✅  id=${resource.id}  role=${resource.role}  isActive=${resource.isActive}`,
    );
  }

  console.log('\n✅  All staging user documents upserted and verified.\n');
}

main().catch((err: unknown) => {
  console.error('\n❌  Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
