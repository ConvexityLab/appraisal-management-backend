#!/usr/bin/env node
/**
 * Seed a BulkIngestionCriteriaConfig document into the 'bulk-portfolio-jobs'
 * Cosmos container.  Plain ESM — no transpilation required.
 *
 * Required env vars:
 *   AZURE_COSMOS_ENDPOINT         e.g. https://my-cosmos.documents.azure.com:443/
 *   AZURE_COSMOS_DATABASE_NAME    e.g. appraisal-management
 *   SEED_TENANT_ID                e.g. tenant-demo
 *
 * Optional env vars:
 *   SEED_CLIENT_ID                Scope the config to one client
 *   SEED_MODE                     'upsert' (default) | 'check-only'
 *   AZURE_COSMOS_KEY              Azurite emulator key (skips AAD when set)
 *
 * Usage:
 *   node scripts/seed-bulk-ingestion-criteria-config.mjs
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function readRequired(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required env var: ${name}\n` +
      `Set it before running this script (e.g. export ${name}=<value>).`,
    );
  }
  return value.trim();
}

function readOptional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const endpoint = readRequired('AZURE_COSMOS_ENDPOINT');
  const dbName   = readRequired('AZURE_COSMOS_DATABASE_NAME');
  const tenantId = readRequired('SEED_TENANT_ID');
  const clientId = readOptional('SEED_CLIENT_ID', '');
  const mode     = readOptional('SEED_MODE', 'upsert').toLowerCase();

  if (mode !== 'upsert' && mode !== 'check-only') {
    throw new Error(`SEED_MODE must be 'upsert' or 'check-only'. Got: ${mode}`);
  }

  const emulatorKey = process.env['AZURE_COSMOS_KEY'];
  const client = emulatorKey
    ? new CosmosClient({ endpoint, key: emulatorKey })
    : new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });

  const container = client.database(dbName).container('bulk-portfolio-jobs');

  // Verify container is reachable — fail loudly if not.
  try {
    await container.read();
  } catch (err) {
    throw new Error(
      `Container 'bulk-portfolio-jobs' not found in database '${dbName}' at ${endpoint}.\n` +
      `This script never creates infrastructure. Provision the container first.\n` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const idSuffix = clientId ? `${tenantId}-${clientId}` : tenantId;
  const docId = `bulk-ingestion-criteria-config-${idSuffix}`;

  // Check for existing doc to preserve createdAt.
  let existingCreatedAt;
  try {
    const { resource } = await container.item(docId, tenantId).read();
    if (resource) {
      existingCreatedAt = resource.createdAt;
      console.log(`ℹ️  Existing config found (id=${docId}, createdAt=${resource.createdAt})`);
      console.log(`   Rules: ${resource.rules.length}, defaultDecision: ${resource.defaultDecision}`);
    }
  } catch {
    // 404 — not yet seeded
  }

  if (mode === 'check-only') {
    console.log(existingCreatedAt
      ? '✅ check-only: config already exists — no changes made.'
      : '⚠️  check-only: no criteria config found for this tenant/client.');
    return;
  }

  const now = new Date().toISOString();

  const rules = [
    {
      field: 'loanNumber',
      operator: 'exists',
      description: 'Loan number must be present',
      failDecision: 'FAILED',
    },
    {
      field: 'loanAmount',
      operator: 'gte',
      value: 50_000,
      description: 'Loan amount must be at least $50,000',
      failDecision: 'FAILED',
    },
    {
      field: 'loanAmount',
      operator: 'lte',
      value: 5_000_000,
      description: 'Loan amounts exceeding $5M require manual review',
      failDecision: 'REVIEW',
    },
    {
      field: 'propertyType',
      operator: 'in',
      values: ['SFR', 'CONDO', 'PUD', '2-4 UNIT', 'MANUFACTURED'],
      description: 'Property type must be a recognised residential category',
      failDecision: 'FAILED',
    },
  ];

  const doc = {
    id: docId,
    type: 'bulk-ingestion-criteria-config',
    tenantId,
    ...(clientId ? { clientId } : {}),
    rules,
    defaultDecision: 'PASSED',
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
  };

  await container.items.upsert(doc);

  console.log(`✅ Upserted criteria config:`);
  console.log(`   id             : ${doc.id}`);
  console.log(`   tenantId       : ${doc.tenantId}`);
  if (doc.clientId) console.log(`   clientId       : ${doc.clientId}`);
  console.log(`   rules          : ${doc.rules.length}`);
  console.log(`   defaultDecision: ${doc.defaultDecision}`);
  console.log(`   updatedAt      : ${doc.updatedAt}`);
  console.log('');
  console.log('Rules seeded:');
  for (const rule of doc.rules) {
    const valueStr = rule.values != null
      ? `[${rule.values.join(', ')}]`
      : rule.value !== undefined ? String(rule.value) : '—';
    console.log(`  • ${rule.field} ${rule.operator} ${valueStr}  → fail: ${rule.failDecision ?? 'FAILED'}`);
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
