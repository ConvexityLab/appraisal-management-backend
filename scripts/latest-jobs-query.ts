import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env['COSMOS_ENDPOINT'] ?? process.env['AZURE_COSMOS_ENDPOINT'];
const databaseId = process.env['COSMOS_DATABASE_NAME'] ?? process.env['COSMOS_DATABASE_ID'] ?? process.env['AZURE_COSMOS_DATABASE_NAME'];
if (!endpoint) throw new Error('COSMOS_ENDPOINT not set');
if (!databaseId) throw new Error('COSMOS_DATABASE_NAME not set');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = client.database(databaseId);

async function main() {
// Latest 3 bulk jobs
const { resources: jobs } = await db.container('bulk-portfolio-jobs').items.query({
  query: 'SELECT TOP 5 c.id, c.createdAt, c._ts, c.items FROM c WHERE STARTSWITH(c.id, "bulk-ingest-") ORDER BY c._ts DESC',
}).fetchAll();

console.log('\n=== LATEST BULK JOBS ===');
for (const job of jobs) {
  console.log(`\nJob: ${job.id}  (created: ${job.createdAt})`);
  for (const item of (job.items ?? [])) {
    const rec = item.canonicalRecord ?? {};
    console.log(`  item: ${item.id}  orderId: ${rec.orderId ?? '—'}  axiomStatus: ${rec.axiomExtractionStatus ?? '—'}  pipelineJobId: ${rec.axiomPipelineJobId ?? '—'}`);
  }
}

// Latest aiInsights entries
const { resources: insights } = await db.container('aiInsights').items.query({
  query: 'SELECT TOP 10 c.id, c.orderId, c.status, c.overallRiskScore, c.axiomExtractionResult, c.axiomCriteriaResult, c.pipelineExecutionLog, c._metadata, c._ts FROM c ORDER BY c._ts DESC',
}).fetchAll();

console.log('\n=== LATEST aiInsights ===');
if (insights.length === 0) {
  console.log('  (empty)');
} else {
  for (const ins of insights) {
    const hasExtraction = ins.axiomExtractionResult !== undefined;
    const hasCriteria = ins.axiomCriteriaResult !== undefined;
    const stageCount = Array.isArray(ins.pipelineExecutionLog) ? ins.pipelineExecutionLog.length : 0;
    const partial = ins._metadata?.partialResults === true;
    console.log(`  orderId: ${ins.orderId}  status: ${ins.status}  riskScore: ${ins.overallRiskScore}  extractionResult: ${hasExtraction ? '✅' : '❌'}  criteriaResult: ${hasCriteria ? '✅' : '❌'}  stageLog: ${stageCount} entries  partial: ${partial}`);
  }
}}
main().catch((err) => { console.error(err); process.exit(1); });