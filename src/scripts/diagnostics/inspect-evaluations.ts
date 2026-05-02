#!/usr/bin/env tsx
/**
 * inspect-evaluations
 *
 * Lists Axiom evaluation records (and any record carrying a `criteria`
 * array) for a given orderId. Used to debug whether an Axiom evaluation
 * actually completed with criteria results, and what fields link it back
 * to a run-ledger record (evaluationId / pipelineJobId / etc).
 *
 * Read-only. Safe to run against any environment.
 *
 * Usage:
 *   npx tsx src/scripts/diagnostics/inspect-evaluations.ts <orderId>
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID (for non-emulator endpoints)
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

async function main(): Promise<void> {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Usage: npx tsx src/scripts/diagnostics/inspect-evaluations.ts <orderId>');
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
      query:
        'SELECT TOP 10 c.id, c.type, c.orderId, c.evaluationId, c.pipelineJobId, c.status, c.criteria, c.programId FROM c WHERE c.orderId = @orderId AND (c.type = @t1 OR c.type = @t2 OR c.type = @t3 OR IS_DEFINED(c.criteria))',
      parameters: [
        { name: '@orderId', value: orderId },
        { name: '@t1', value: 'axiom-evaluation' },
        { name: '@t2', value: 'evaluation' },
        { name: '@t3', value: 'axiom-evaluation-result' },
      ],
    })
    .fetchAll();

  console.log(`Found ${resources.length} record(s) for order ${orderId}:`);
  for (const r of resources) {
    const criteriaCount = Array.isArray((r as { criteria?: unknown[] }).criteria)
      ? (r as { criteria: unknown[] }).criteria.length
      : 0;
    console.log({
      id: r.id,
      type: r.type,
      orderId: r.orderId,
      evaluationId: r.evaluationId,
      pipelineJobId: r.pipelineJobId,
      status: r.status,
      programId: r.programId,
      criteriaCount,
    });
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
