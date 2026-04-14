#!/usr/bin/env tsx
/** Quick check: fetch the latest evaluation record + pipeline status. */
import { loadLiveFireContext, getJson } from './_axiom-live-fire-common.js';

void (async () => {
  const ctx = await loadLiveFireContext();
  const base = ctx.baseUrl;
  const headers = { ...ctx.authHeader, 'x-tenant-id': ctx.tenantId };

  const evalId = process.env['EVAL_ID'] ?? 'eval-1775235262143-k13sb1btj-1775235262143-k13sb1btj~r1775801949995';
  const pipelineJobId = process.env['PIPELINE_JOB_ID'] ?? '1775235262143-k13sb1btj~r1775801949995';

  console.log(`\n[eval]     ${evalId}`);
  const evalRes = await getJson<unknown>(`${base}/api/axiom/evaluations/${encodeURIComponent(evalId)}?bypassCache=true`, headers);
  console.log(`  HTTP ${evalRes.status}`, JSON.stringify(evalRes.data, null, 2));

  console.log(`\n[pipeline] ${pipelineJobId}`);
  const pipeRes = await getJson<unknown>(`${base}/api/axiom/pipeline/${encodeURIComponent(pipelineJobId)}/status`, headers);
  console.log(`  HTTP ${pipeRes.status}`, JSON.stringify(pipeRes.data, null, 2));
})();
