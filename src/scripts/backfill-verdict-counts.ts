#!/usr/bin/env tsx
/**
 * Backfill verdictCounts on past completed criteria run-ledger records.
 *
 * After we shipped per-run verdict-count stamping in axiom.service, only
 * NEW Axiom evaluations got pass/warn/fail counts on their run-ledger
 * record. Older completed runs render with no breakdown chips in the UI.
 *
 * This script walks every completed criteria run that lacks
 * statusDetails.verdictCounts, finds the corresponding Axiom evaluation
 * record (by evaluationId / pipelineJobId / engineRunRef), recomputes
 * counts from its criteria array, and patches the run-ledger record.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-verdict-counts.ts                 # Dry-run
 *   npx tsx src/scripts/backfill-verdict-counts.ts --apply         # Write
 *   npx tsx src/scripts/backfill-verdict-counts.ts --tenant <id>   # Scope
 *
 * Requires:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT
 *   AZURE_TENANT_ID
 *
 * Idempotent: skips runs that already have verdictCounts stamped.
 */

import 'dotenv/config';
import { CosmosClient, type Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { computeVerdictCounts } from '../utils/verdict-counts.js';

interface RunLedgerRecord {
  id: string;
  type: 'run-ledger-entry';
  runType: 'extraction' | 'criteria' | 'criteria-step';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  tenantId: string;
  engine: 'AXIOM' | 'MOP_PRIO';
  engineRunRef?: string;
  pipelineId?: string;
  statusDetails?: Record<string, unknown> & {
    verdictCounts?: { passCount: number; warnCount: number; failCount: number; cannotEvaluateCount: number; totalCount: number };
  };
}

interface AxiomEvaluationRecord {
  id: string;
  evaluationId?: string;
  pipelineJobId?: string;
  tenantId?: string;
  criteria?: Array<{ evaluation?: string }>;
}

interface BackfillStats {
  scanned: number;
  alreadyStamped: number;
  evaluationMissing: number;
  patched: number;
  failed: number;
}

function buildCosmosClient(endpoint: string): CosmosClient {
  const isEmulator = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
  if (isEmulator) {
    return new CosmosClient({
      endpoint,
      key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: false },
    } as never);
  }
  return new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
    connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
  } as never);
}

async function findEvaluationForRun(
  container: Container,
  run: RunLedgerRecord,
): Promise<AxiomEvaluationRecord | null> {
  // Run-ledger linkage to evaluations is one of these (in priority order):
  //   1. statusDetails.evaluationId (set by some flows)
  //   2. engineRunRef === Axiom evaluationId for AXIOM-engine runs
  //   3. pipelineId === Axiom pipelineJobId
  const candidateIds = [
    typeof run.statusDetails?.['evaluationId'] === 'string' ? (run.statusDetails['evaluationId'] as string) : undefined,
    run.engine === 'AXIOM' ? run.engineRunRef : undefined,
    run.pipelineId,
  ].filter((id): id is string => typeof id === 'string' && id.length > 0);

  for (const id of candidateIds) {
    // Try direct lookup by id (partition key /orderId varies, so query by id).
    try {
      const { resources } = await container.items
        .query<AxiomEvaluationRecord>({
          query:
            'SELECT TOP 1 * FROM c WHERE c.id = @id OR c.evaluationId = @id OR c.pipelineJobId = @id',
          parameters: [{ name: '@id', value: id }],
        })
        .fetchAll();
      if (resources[0]) {
        return resources[0];
      }
    } catch {
      // Continue to next candidate id.
    }
  }
  return null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const tenantArgIndex = process.argv.indexOf('--tenant');
  const tenantFilter = tenantArgIndex >= 0 ? process.argv[tenantArgIndex + 1] : undefined;

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    console.error('❌ COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required.');
    process.exit(1);
  }

  const cosmos = buildCosmosClient(cosmosEndpoint);
  const databaseName =
    process.env.COSMOS_DATABASE_NAME
    ?? process.env.AZURE_COSMOS_DATABASE_NAME
    ?? 'appraisal-management';
  const container = cosmos.database(databaseName).container('aiInsights');

  console.log(`Mode: ${apply ? 'APPLY (writing)' : 'dry-run'}`);
  console.log(`Tenant filter: ${tenantFilter ?? '(all)'}`);
  console.log(`Container: ${databaseName}/aiInsights`);
  console.log('');

  const tenantClause = tenantFilter ? 'AND c.tenantId = @tenantId' : '';
  const query = `
    SELECT * FROM c
    WHERE c.type = 'run-ledger-entry'
      AND c.runType = 'criteria'
      AND c.status = 'completed'
      ${tenantClause}
  `;
  const parameters = tenantFilter ? [{ name: '@tenantId', value: tenantFilter }] : [];

  const stats: BackfillStats = { scanned: 0, alreadyStamped: 0, evaluationMissing: 0, patched: 0, failed: 0 };

  const iterator = container.items.query<RunLedgerRecord>({ query, parameters });
  while (iterator.hasMoreResults()) {
    const { resources } = await iterator.fetchNext();
    for (const run of resources) {
      stats.scanned += 1;

      if (run.statusDetails?.verdictCounts) {
        stats.alreadyStamped += 1;
        continue;
      }

      const evaluation = await findEvaluationForRun(container, run);
      if (!evaluation || !Array.isArray(evaluation.criteria) || evaluation.criteria.length === 0) {
        stats.evaluationMissing += 1;
        console.log(`  · skip ${run.id} — no evaluation criteria found`);
        continue;
      }

      const verdictCounts = computeVerdictCounts(evaluation.criteria);
      if (verdictCounts.totalCount === 0) {
        stats.evaluationMissing += 1;
        continue;
      }

      const updated: RunLedgerRecord = {
        ...run,
        statusDetails: {
          ...(run.statusDetails ?? {}),
          verdictCounts,
        },
      };

      if (!apply) {
        console.log(
          `  · would patch ${run.id} → pass=${verdictCounts.passCount} warn=${verdictCounts.warnCount} fail=${verdictCounts.failCount} (total=${verdictCounts.totalCount})`,
        );
        stats.patched += 1;
        continue;
      }

      try {
        await container.items.upsert(updated);
        console.log(
          `  ✓ patched ${run.id} → pass=${verdictCounts.passCount} warn=${verdictCounts.warnCount} fail=${verdictCounts.failCount}`,
        );
        stats.patched += 1;
      } catch (err) {
        stats.failed += 1;
        console.error(`  ✗ failed ${run.id}:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`  scanned:           ${stats.scanned}`);
  console.log(`  alreadyStamped:    ${stats.alreadyStamped}`);
  console.log(`  evaluationMissing: ${stats.evaluationMissing}`);
  console.log(`  ${apply ? 'patched' : 'wouldPatch'}: ${stats.patched}`);
  if (stats.failed > 0) {
    console.log(`  failed:            ${stats.failed}`);
  }
  if (!apply && stats.patched > 0) {
    console.log('');
    console.log('Re-run with --apply to write the changes.');
  }
}

main().catch((err) => {
  console.error('❌ backfill-verdict-counts failed:', err);
  process.exit(1);
});
