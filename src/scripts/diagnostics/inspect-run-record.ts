#!/usr/bin/env tsx
/**
 * inspect-run-record
 *
 * Prints a single run-ledger record from the aiInsights container, plus any
 * related records that mention the same run id (step runs, criteria-step
 * inputs, etc). Useful when debugging run-ledger linkage problems — for
 * instance, when backfill-verdict-counts cannot find a run's evaluation
 * because engineRunRef / pipelineId / statusDetails do not point where
 * expected.
 *
 * Read-only. Safe to run against any environment.
 *
 * Usage:
 *   npx tsx src/scripts/diagnostics/inspect-run-record.ts <runId>
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID (for non-emulator endpoints)
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId) {
    console.error('Usage: npx tsx src/scripts/diagnostics/inspect-run-record.ts <runId>');
    process.exit(1);
  }

  const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) {
    console.error('COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required');
    process.exit(1);
  }

  const cosmos = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
    connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
  } as never);

  const databaseName =
    process.env.COSMOS_DATABASE_NAME
    ?? process.env.AZURE_COSMOS_DATABASE_NAME
    ?? 'appraisal-management';
  const container = cosmos.database(databaseName).container('aiInsights');

  const { resources } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: runId }],
    })
    .fetchAll();

  if (resources.length === 0) {
    console.log(`No record found with id=${runId}`);
    return;
  }
  console.log(JSON.stringify(resources[0], null, 2));

  console.log('\n---\nSearching for related records that mention this runId...\n');
  const { resources: related } = await container.items
    .query({
      query:
        'SELECT TOP 5 c.id, c.type, c.evaluationId, c.pipelineJobId, c.orderId FROM c WHERE CONTAINS(c.id, @id) OR c.parentRunId = @id OR c.criteriaRunId = @id',
      parameters: [{ name: '@id', value: runId }],
    })
    .fetchAll();
  console.log(`Found ${related.length} related records:`);
  for (const r of related) console.log('  ', r);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
