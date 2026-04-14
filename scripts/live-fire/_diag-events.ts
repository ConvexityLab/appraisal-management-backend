#!/usr/bin/env tsx
/**
 * Diagnostic: dump all Axiom pipeline events for a given executionId.
 * Usage: pnpm tsx scripts/live-fire/_diag-events.ts <executionId>
 */
import axios from 'axios';
import { DefaultAzureCredential } from '@azure/identity';

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: pnpm tsx scripts/live-fire/_diag-events.ts <executionId>');
  process.exit(1);
}

const baseURL = process.env.AXIOM_API_BASE_URL;
if (!baseURL) {
  console.error('AXIOM_API_BASE_URL not set');
  process.exit(1);
}

async function main() {
  const cred = new DefaultAzureCredential();
  const tok = await cred.getToken('api://3bc96929-593c-4f35-8997-e341a7e09a69/.default');
  const headers = { Authorization: `Bearer ${tok!.token}` };

  const url = `${baseURL}/api/admin/events?executionId=${encodeURIComponent(jobId)}&orderBy=timestamp&order=asc&limit=200`;
  console.log('Querying:', url, '\n');

  const res = await axios.get<{ events: any[]; hasMore: boolean }>(url, { headers, timeout: 30000 });
  const events: any[] = res.data.events ?? (res.data as any);

  console.log(`Total events in Cosmos: ${events.length}  (hasMore=${res.data.hasMore})\n`);
  console.log('TIMESTAMP'.padEnd(30), 'EVENT_TYPE'.padEnd(30), 'STAGE / DATA');
  console.log('-'.repeat(100));
  for (const e of events) {
    const stage = e.data?.stage ?? e.data?.reason ?? '';
    const extra = e.data?.stagesCompleted !== undefined ? ` stagesCompleted=${e.data.stagesCompleted}` : '';
    const duration = e.durationMs !== undefined ? ` (${e.durationMs}ms)` : '';
    console.log(String(e.timestamp).padEnd(30), String(e.eventType).padEnd(30), stage + extra + duration);
  }

  // Also try the execution status endpoint
  console.log('\n--- Execution status ---');
  try {
    const execRes = await axios.get(`${baseURL}/api/admin/executions/${encodeURIComponent(jobId)}`, { headers, timeout: 15000 });
    const d = execRes.data;
    console.log('status:', d.status);
    console.log('completedAt:', d.completedAt ?? d.endTime ?? 'n/a');
    console.log('error:', d.error ?? d.errorMessage ?? 'none');
  } catch (err: any) {
    console.log('Execution endpoint:', err.response?.status ?? err.message);
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
