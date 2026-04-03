/**
 * Query Cosmos DB for aiInsights records AND bulk-portfolio-jobs items for the
 * latest e2e run.  After fix ca5511e, both containers should have data.
 */
import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// Job ID from the latest successful e2e run (2026-04-02 20:30, revision 743)
const JOB_ID = 'bulk-ingest-193d4b87-9dd9-4307-8358-49e14a0e3dad';

// Order IDs created in that run
const ORDER_IDS = [
  '1775161646314-k4nuf5i28',
  '1775161646445-pdsvsxuu4',
  '1775161646466-4uwr1ualj',
];

const endpoint =
  process.env['COSMOS_ENDPOINT'] ?? process.env['AZURE_COSMOS_ENDPOINT'];
const databaseId =
  process.env['COSMOS_DATABASE_NAME'] ??
  process.env['COSMOS_DATABASE_ID'] ??
  process.env['AZURE_COSMOS_DATABASE_NAME'];

if (!endpoint) throw new Error('COSMOS_ENDPOINT not set');
if (!databaseId) throw new Error('COSMOS_DATABASE_NAME not set');

const cosmosClient = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = cosmosClient.database(databaseId);

async function main() {
  console.log(`\nEndpoint : ${endpoint}`);
  console.log(`Database : ${databaseId}`);
  console.log(`Job ID   : ${JOB_ID}`);
  console.log(`Orders   : ${ORDER_IDS.join(', ')}\n`);

  // ── 1. aiInsights ────────────────────────────────────────────────────────
  console.log('━'.repeat(80));
  console.log('SECTION 1 — aiInsights container');
  console.log('━'.repeat(80));

  const { resources: aiCount } = await db.container('aiInsights').items.query(
    'SELECT VALUE COUNT(1) FROM c',
    { enableCrossPartitionQuery: true },
  ).fetchAll();
  console.log(`\naiInsights total docs: ${aiCount[0]}\n`);

  for (const orderId of ORDER_IDS) {
    const { resources: aiDocs } = await db.container('aiInsights').items.query(
      { query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: orderId }] },
      { enableCrossPartitionQuery: true },
    ).fetchAll();
    console.log('─'.repeat(80));
    console.log(`Order: ${orderId}`);
    if (aiDocs.length === 0) {
      console.log('  ❌ NOT FOUND in aiInsights');
    } else {
      const doc = aiDocs[0];
      console.log(`  ✅ FOUND  axiomStatus=${doc.axiomStatus ?? '(unset)'}  decision=${doc.axiomDecision ?? '(unset)'}`);
      console.log(`  axiomRiskScore     : ${doc.axiomRiskScore ?? '(unset)'}`);
      console.log(`  axiomExtractionResult : ${doc.axiomExtractionResult ? '✅ present' : '❌ missing'}`);
      console.log(`  axiomCriteriaResult   : ${doc.axiomCriteriaResult   ? '✅ present' : '❌ missing'}`);
      console.log(`  pipelineExecutionLog  : ${doc.pipelineExecutionLog  ? `✅ ${Array.isArray(doc.pipelineExecutionLog) ? doc.pipelineExecutionLog.length + ' stages' : 'present'}` : '❌ missing'}`);
      if (doc.axiomExtractionResult) {
        const ex = JSON.stringify(doc.axiomExtractionResult, null, 2);
        console.log('\n  ── axiomExtractionResult (first 800 chars) ──');
        console.log((ex.length > 800 ? ex.slice(0, 800) + '\n  ...(truncated)' : ex).replace(/^/gm, '  '));
      }
      if (doc.axiomCriteriaResult) {
        const cr = JSON.stringify(doc.axiomCriteriaResult, null, 2);
        console.log('\n  ── axiomCriteriaResult (first 800 chars) ──');
        console.log((cr.length > 800 ? cr.slice(0, 800) + '\n  ...(truncated)' : cr).replace(/^/gm, '  '));
      }
    }
    console.log('');
  }

  // ── 2. bulk-portfolio-jobs ────────────────────────────────────────────────
  console.log('━'.repeat(80));
  console.log('SECTION 2 — bulk-portfolio-jobs container');
  console.log('━'.repeat(80));

  const { resources } = await db.container('bulk-portfolio-jobs').items.query(
    { query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: JOB_ID }] },
    { enableCrossPartitionQuery: true },
  ).fetchAll();

  if (resources.length === 0) {
    console.log('\nJob not found. Recent jobs:');
    const { resources: recent } = await db.container('bulk-portfolio-jobs').items.query(
      'SELECT TOP 5 c.id, c.status, c._ts FROM c ORDER BY c._ts DESC',
      { enableCrossPartitionQuery: true },
    ).fetchAll();
    for (const r of recent) {
      console.log(`  id=${r.id}  status=${r.status}  ts=${new Date((r._ts as number) * 1000).toISOString()}`);
    }
    return;
  }

  const job = resources[0];
  console.log(`\nJob status : ${job.status}   items: ${job.items?.length ?? 0}\n`);

  for (const item of (job.items ?? [])) {
    const cr = item.canonicalRecord ?? {};
    console.log('─'.repeat(80));
    console.log(`ITEM: ${item.id}  status=${item.status}  orderId=${cr.orderId ?? '(none)'}`);
    console.log(`  axiomExtractionStatus : ${cr.axiomExtractionStatus ?? '(unset)'}`);
    console.log(`  axiomExtractionResult : ${cr.axiomExtractionResult ? '✅ present' : '❌ missing'}`);
    console.log(`  axiomCriteriaResult   : ${cr.axiomCriteriaResult   ? '✅ present' : '❌ missing'}`);
    console.log(`  pipelineExecutionLog  : ${cr.pipelineExecutionLog  ? `✅ present` : '❌ missing'}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

