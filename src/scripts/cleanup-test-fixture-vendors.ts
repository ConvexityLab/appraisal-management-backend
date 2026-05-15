#!/usr/bin/env tsx
/**
 * Cleanup Test-Fixture Vendors
 *
 * Purges the leakage from three test suites that historically created
 * vendor docs without an afterAll cleanup hook:
 *   - tests/integration/live-api.test.ts          ("Integration Test Appraisals <ts>")
 *   - tests/integration/manual-api.test.ts        ("Test Appraisal Services")
 *   - tests/comprehensive-crud.test.ts            ("Test Appraisal Services")
 * Also picks up "Comprehensive Test Appraisals <ts>" from the one suite that
 * DID have cleanup but may have left rows behind on failed runs, plus
 * "E2E Workflow Appraisals <ts>" if any are present.
 *
 * These rows show up in the FE vendor list because findAllVendors filters
 * loosely (anything not type='appraiser') and then 404 on detail because
 * authorizeResource rejects docs without a real-user-accessible tenant
 * envelope.
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-test-fixture-vendors.ts             # dry run (list matches)
 *   npx tsx src/scripts/cleanup-test-fixture-vendors.ts --delete    # actually delete
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID (for DefaultAzureCredential)
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Substring patterns that mark a doc as a test-fixture. Match against
 * businessName so we don't catch a vendor with a real name like
 * "Test Industries Inc" — every entry here is a literal test-suite-generated
 * string that no real vendor would carry.
 */
const TEST_FIXTURE_NAME_PATTERNS = [
  'Integration Test Appraisals',
  'Comprehensive Test Appraisals',
  'E2E Workflow Appraisals',
  // 'Test Appraisal Services' is more ambiguous (could match a real vendor
  // someday); include it but log loudly so the operator can spot a false
  // positive in the dry-run output before passing --delete.
  'Test Appraisal Services',
];

const DATABASE_NAME = 'appraisal-management';
const CONTAINER_NAME = 'vendors';

async function main(): Promise<void> {
  const doDelete = process.argv.includes('--delete');

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    console.error('❌ COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    process.exit(1);
  }
  if (!process.env.AZURE_TENANT_ID) {
    console.error('❌ AZURE_TENANT_ID is required (for Managed Identity / Azure CLI auth).');
    process.exit(1);
  }

  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log(`Scanning ${DATABASE_NAME}/${CONTAINER_NAME} for test-fixture vendors…`);

  // Build a single Cosmos query that matches any of the patterns. We use
  // CONTAINS on businessName; the patterns are static strings (not user
  // input) so parameterisation is for cleanliness, not safety.
  const params = TEST_FIXTURE_NAME_PATTERNS.map((p, i) => ({
    name: `@p${i}`,
    value: p,
  }));
  const orClauses = params.map((p) => `CONTAINS(c.businessName, ${p.name})`).join(' OR ');
  const query = `SELECT c.id, c.businessName, c.tenantId FROM c WHERE (${orClauses})`;

  const { resources } = await container.items
    .query<{ id: string; businessName: string; tenantId: string }>(
      { query, parameters: params },
      { maxItemCount: 1000 },
    )
    .fetchAll();

  if (resources.length === 0) {
    console.log('✅ No test-fixture vendors found. Nothing to do.');
    return;
  }

  console.log(`Found ${resources.length} candidate(s):`);
  for (const v of resources) {
    console.log(`  - ${v.id}  tenant=${v.tenantId ?? '<missing>'}  name="${v.businessName}"`);
  }

  if (!doDelete) {
    console.log(`\nDry run — pass --delete to remove the ${resources.length} row(s) above.`);
    return;
  }

  console.log(`\nDeleting ${resources.length} test-fixture vendor(s)…`);
  let deleted = 0;
  let failed = 0;
  for (const v of resources) {
    try {
      // The vendors container's partition key is /tenantId; pass it explicitly
      // (undefined falls back to a cross-partition delete which the SDK doesn't
      // support).
      await container.item(v.id, v.tenantId).delete();
      deleted++;
      console.log(`  ✓ deleted ${v.id}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${v.id}: ${msg}`);
    }
  }

  console.log(`\nDone. deleted=${deleted}  failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ cleanup-test-fixture-vendors failed:', err);
  process.exit(1);
});
